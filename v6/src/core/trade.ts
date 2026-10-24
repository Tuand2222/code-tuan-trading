import type { Trade, Dec } from '../data/schema';
import { D, dec, sum, ratio } from './money';
export interface TradeEvent {
  id: string;
  tradeId: string;
  time: string;
  gross: Dec;
  net?: Dec;
  cost: Dec;
  costs: Trade['costs'];
  quantity: Dec;
}
let requestFacts: WeakMap<Trade, ReturnType<typeof computeTradeFacts>> | undefined;
// A cache lives only for one synchronous calculation, never across edits.
export function withTradeFactsCache<T>(calculate: () => T): T {
  const previous = requestFacts;
  requestFacts = new WeakMap();
  try {
    return calculate();
  } finally {
    requestFacts = previous;
  }
}
export function tradeFacts(trade: Trade) {
  const cached = requestFacts?.get(trade);
  if (cached) return cached;
  const facts = computeTradeFacts(trade);
  requestFacts?.set(trade, facts);
  return facts;
}
function computeTradeFacts(trade: Trade) {
  if (
    trade.legs.length === 2 &&
    trade.legs[0].kind === 'in' &&
    trade.legs[1].kind === 'out' &&
    trade.legs[0].time <= trade.legs[1].time &&
    !trade.legs[1].realizedCosts &&
    !trade.legs[1].entryAllocations &&
    trade.legs[1].costsKnown === undefined
  )
    return simpleFacts(trade);
  const legs = [...trade.legs].sort(
    (a, b) => a.time.localeCompare(b.time) || trade.legs.indexOf(a) - trade.legs.indexOf(b),
  );
  let quantity = D('0'),
    basis = D('0'),
    gross = D('0');
  const events: TradeEvent[] = [];
  const ins = legs.filter((l) => l.kind === 'in'),
    outs = legs.filter((l) => l.kind === 'out');
  const inQty = sum(ins.map((l) => l.quantity)),
    outQty = sum(outs.map((l) => l.quantity)),
    multiplier = D(trade.multiplier ?? '1');
  if (!ins.length) throw Error('MISSING_ENTRY');
  const ids = new Set<string>();
  const lots = new Map<string, { price: string; quantity: ReturnType<typeof D> }>();
  if (outs.some((l) => l.entryAllocations) && outs.some((l) => !l.entryAllocations))
    throw Error('MIXED_BASIS_ALLOCATION');
  for (const leg of legs) {
    if (
      ids.has(leg.id) ||
      !D(leg.quantity).gt(0) ||
      !D(leg.price).gt(0) ||
      !Number.isFinite(Date.parse(leg.time))
    )
      throw Error('INVALID_LEG');
    ids.add(leg.id);
    if (leg.kind === 'in') {
      lots.set(leg.id, { price: leg.price, quantity: D(leg.quantity) });
      quantity = quantity.plus(D(leg.quantity));
      basis = basis.plus(D(leg.price).mul(D(leg.quantity)));
    } else {
      if (D(leg.quantity).gt(quantity)) throw Error('OVER_CLOSE');
      const average = basis.div(quantity);
      let piece = D(leg.price)
        .minus(average)
        .mul(D(leg.quantity))
        .mul(multiplier)
        .mul(trade.side === 'long' ? 1 : -1);
      if (leg.entryAllocations) {
        if (!D(sum(leg.entryAllocations.map((a) => a.quantity))).eq(leg.quantity))
          throw Error('ENTRY_ALLOCATION_QUANTITY');
        let matchedBasis = D('0');
        for (const a of leg.entryAllocations) {
          const lot = lots.get(a.entryLegId);
          if (!lot || lot.quantity.lt(a.quantity)) throw Error('ENTRY_ALLOCATION_OVER_CLOSE');
          lot.quantity = lot.quantity.minus(a.quantity);
          matchedBasis = matchedBasis.plus(D(lot.price).mul(a.quantity));
        }
        piece = D(leg.price)
          .mul(leg.quantity)
          .minus(matchedBasis)
          .mul(multiplier)
          .mul(trade.side === 'long' ? 1 : -1);
        basis = basis.minus(matchedBasis);
      } else basis = basis.minus(average.mul(D(leg.quantity)));
      quantity = quantity.minus(D(leg.quantity));
      gross = gross.plus(piece);
      events.push({
        id: leg.id,
        tradeId: trade.id,
        time: leg.time,
        gross: dec(piece),
        cost: '0',
        costs: { commission: '0', tax: '0', funding: '0', swap: '0', other: '0' },
        quantity: leg.quantity,
      });
    }
  }
  if ((trade.status === 'closed') !== quantity.isZero()) throw Error('STATUS_QUANTITY_MISMATCH');
  if (trade.highestPrice && trade.lowestPrice && D(trade.highestPrice).lt(D(trade.lowestPrice)))
    throw Error('INVALID_PRICE_RANGE');
  // Trade.costs is the total cost ledger. Leg.fee is informational, never added twice.
  // Allocate total costs by closed quantity, final remainder exactly; for an open
  // trade only the closed proportion is recognized. Migration rejects different
  // historical cost timing until its representation can be preserved exactly.
  let used = D('0');
  const allocated: Trade['costs'] = {
    commission: '0',
    tax: '0',
    funding: '0',
    swap: '0',
    other: '0',
  };
  const legById = new Map(outs.map((l) => [l.id, l]));
  const explicitQty = sum(outs.filter((l) => l.realizedCosts).map((l) => l.quantity));
  const explicit = Object.fromEntries(
    Object.keys(trade.costs).map((k) => [
      k,
      sum(outs.map((l) => l.realizedCosts?.[k as keyof Trade['costs']] ?? '0')),
    ]),
  ) as Trade['costs'];
  const nonExplicit = events.filter((e) => !legById.get(e.id)?.realizedCosts);
  for (const key of ['commission', 'tax', 'other'] as const)
    if (D(explicit[key]).gt(trade.costs[key])) throw Error('EXPLICIT_COST_EXCEEDS_TOTAL');
  const usedBudget = { ...allocated };
  if (
    nonExplicit.length === 0 &&
    trade.status === 'closed' &&
    Object.keys(trade.costs).some(
      (k) => !D(explicit[k as keyof Trade['costs']]).eq(trade.costs[k as keyof Trade['costs']]),
    )
  )
    throw Error('EXPLICIT_COST_TOTAL_MISMATCH');
  events.forEach((e) => {
    for (const key of Object.keys(trade.costs) as (keyof Trade['costs'])[]) {
      const recorded = legById.get(e.id)?.realizedCosts;
      if (recorded) {
        e.costs[key] = dec(D(recorded[key]));
        allocated[key] = dec(D(allocated[key]).plus(e.costs[key]));
        continue;
      }
      const budget = D(trade.costs[key]).minus(explicit[key]);
      const part =
        trade.status === 'closed' && e === nonExplicit.at(-1)
          ? budget.minus(usedBudget[key])
          : budget.mul(D(e.quantity)).div(D(inQty).minus(explicitQty));
      e.costs[key] = dec(part);
      usedBudget[key] = dec(D(usedBudget[key]).plus(part));
      allocated[key] = dec(D(allocated[key]).plus(part));
    }
    const cost = D(sum(Object.values(e.costs)));
    used = used.plus(cost);
    e.cost = dec(cost);
    e.net =
      (legById.get(e.id)?.costsKnown ?? trade.costsKnown) ? dec(D(e.gross).minus(cost)) : undefined;
  });
  const avgEntry = ratio(sum(ins.map((l) => dec(D(l.price).mul(D(l.quantity))))), inQty)!;
  const avgExit = ratio(sum(outs.map((l) => dec(D(l.price).mul(D(l.quantity))))), outQty);
  let risk = trade.initialRisk;
  if (
    !risk &&
    trade.plannedSL &&
    ((trade.side === 'long' && D(trade.plannedSL).lt(D(avgEntry))) ||
      (trade.side === 'short' && D(trade.plannedSL).gt(D(avgEntry))))
  )
    risk = dec(D(avgEntry).minus(D(trade.plannedSL)).abs().mul(D(inQty)).mul(multiplier));
  if (risk && !D(risk).gt(0)) throw Error('INVALID_RISK');
  const net =
    events.every((e) => e.net !== undefined) && (events.length || trade.costsKnown)
      ? sum(events.map((e) => e.net!))
      : undefined;
  return {
    id: trade.id,
    trade,
    gross: dec(gross),
    net,
    cost: dec(used),
    risk,
    r: net && risk ? ratio(net, risk) : undefined,
    openQty: dec(quantity),
    avgEntry,
    avgExit,
    openTime: ins[0].time,
    closeTime: trade.status === 'closed' ? outs.at(-1)?.time : undefined,
    holdMinutes:
      trade.status === 'closed'
        ? (Date.parse(outs.at(-1)!.time) - Date.parse(ins[0].time)) / 60000
        : undefined,
    events,
  };
}
// A single actual entry/exit needs no average-cost loop or proportional cost
// allocation when fully closed. Decimal arithmetic and public facts stay identical.
function simpleFacts(trade: Trade) {
  const [a, b] = trade.legs,
    qi = D(a.quantity),
    qo = D(b.quantity),
    entry = D(a.price),
    exit = D(b.price),
    mult = D(trade.multiplier ?? '1');
  if (
    a.id === b.id ||
    !qi.gt(0) ||
    !qo.gt(0) ||
    !entry.gt(0) ||
    !exit.gt(0) ||
    !Number.isFinite(Date.parse(a.time)) ||
    !Number.isFinite(Date.parse(b.time))
  )
    throw Error('INVALID_LEG');
  if (qo.gt(qi)) throw Error('OVER_CLOSE');
  const openQty = qi.minus(qo);
  if ((trade.status === 'closed') !== openQty.isZero()) throw Error('STATUS_QUANTITY_MISMATCH');
  if (trade.highestPrice && trade.lowestPrice && D(trade.highestPrice).lt(trade.lowestPrice))
    throw Error('INVALID_PRICE_RANGE');
  const gross = exit
    .minus(entry)
    .mul(qo)
    .mul(mult)
    .mul(trade.side === 'long' ? 1 : -1);
  const costs = {} as Trade['costs'];
  let cost = D('0');
  for (const k of Object.keys(trade.costs) as (keyof Trade['costs'])[]) {
    const part = trade.status === 'closed' ? D(trade.costs[k]) : D(trade.costs[k]).mul(qo).div(qi);
    costs[k] = dec(part);
    cost = cost.plus(part);
  }
  const net = trade.costsKnown ? dec(gross.minus(cost)) : undefined;
  let risk = trade.initialRisk;
  if (
    !risk &&
    trade.plannedSL &&
    ((trade.side === 'long' && D(trade.plannedSL).lt(entry)) ||
      (trade.side === 'short' && D(trade.plannedSL).gt(entry)))
  )
    risk = dec(entry.minus(trade.plannedSL).abs().mul(qi).mul(mult));
  if (risk && !D(risk).gt(0)) throw Error('INVALID_RISK');
  const event: TradeEvent = {
    id: b.id,
    tradeId: trade.id,
    time: b.time,
    gross: dec(gross),
    net,
    cost: dec(cost),
    costs,
    quantity: b.quantity,
  };
  return {
    id: trade.id,
    trade,
    gross: event.gross,
    net,
    cost: event.cost,
    risk,
    r: net && risk ? ratio(net, risk) : undefined,
    openQty: dec(openQty),
    avgEntry: dec(entry),
    avgExit: dec(exit),
    openTime: a.time,
    closeTime: trade.status === 'closed' ? b.time : undefined,
    holdMinutes:
      trade.status === 'closed' ? (Date.parse(b.time) - Date.parse(a.time)) / 60000 : undefined,
    events: [event],
  };
}
export type TradeFacts = ReturnType<typeof tradeFacts>;

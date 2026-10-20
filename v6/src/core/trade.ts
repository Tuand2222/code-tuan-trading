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
export function tradeFacts(trade: Trade) {
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
      quantity = quantity.plus(D(leg.quantity));
      basis = basis.plus(D(leg.price).mul(D(leg.quantity)));
    } else {
      if (D(leg.quantity).gt(quantity)) throw Error('OVER_CLOSE');
      const average = basis.div(quantity),
        piece = D(leg.price)
          .minus(average)
          .mul(D(leg.quantity))
          .mul(multiplier)
          .mul(trade.side === 'long' ? 1 : -1);
      basis = basis.minus(average.mul(D(leg.quantity)));
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
  events.forEach((e, i) => {
    for (const key of Object.keys(trade.costs) as (keyof Trade['costs'])[]) {
      const part =
        trade.status === 'closed' && i === events.length - 1
          ? D(trade.costs[key]).minus(D(allocated[key]))
          : D(trade.costs[key]).mul(D(e.quantity)).div(D(inQty));
      e.costs[key] = dec(part);
      allocated[key] = dec(D(allocated[key]).plus(part));
    }
    const cost = D(sum(Object.values(e.costs)));
    used = used.plus(cost);
    e.cost = dec(cost);
    e.net = trade.costsKnown ? dec(D(e.gross).minus(cost)) : undefined;
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
  const net = trade.costsKnown ? sum(events.map((e) => e.net!)) : undefined;
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
export type TradeFacts = ReturnType<typeof tradeFacts>;

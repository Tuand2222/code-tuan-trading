import { D, dec, positive, splitCosts, sum } from './decimal';
import {
  aggregateCycle,
  eventFinance,
  fxRate,
  reanchorOverlays,
  reconcile,
  resolveRisk,
  valueCosts,
} from './finance';
import { bookKey, hash } from './identity';
import type {
  Account,
  CashEvent,
  CostItem,
  Cycle,
  Fill,
  ImportBatch,
  OpenLot,
  RealizedEvent,
  ReplayResult,
  TradeFill,
  TradeOverlay,
} from './types';

export function compareFills(a: TradeFill, b: TradeFill): number {
  const time = Date.parse(a.tsUtc) - Date.parse(b.tsUtc);
  if (time) return time;
  if (a.seq !== undefined && b.seq !== undefined && BigInt(a.seq) !== BigInt(b.seq))
    return BigInt(a.seq) < BigInt(b.seq) ? -1 : 1;
  return (
    a.dedupeKey.localeCompare(b.dedupeKey) ||
    a.dedupeOcc - b.dedupeOcc ||
    a.fillId.localeCompare(b.fillId)
  );
}
function cycleFrom(fill: Fill, account: Account, tradeId: string): Cycle {
  const isFill = fill.role === 'fill';
  return {
    tradeId,
    orderKey: fill.synthetic === 'legacy-migration' ? fill.raw.legacyId : undefined,
    accountId: account.accountId,
    bookKey: fill.bookKey,
    symbol: fill.symbol,
    rootSymbol: fill.rootSymbol,
    market: account.market,
    platform: account.platform,
    direction: isFill
      ? fill.side === 'buy'
        ? 'LONG'
        : 'SHORT'
      : fill.role === 'reported-position'
        ? fill.direction
        : 'LONG',
    status: 'open',
    granularity: isFill
      ? 'fill'
      : fill.role === 'reported-position'
        ? 'position'
        : fill.granularity,
    openTsUtc: isFill ? fill.tsUtc : fill.role === 'reported-position' ? fill.openTsUtc : undefined,
    qtyOpened: '0',
    avgEntry: '0',
    legs: [],
    grossSource: isFill ? 'computed' : 'reported',
    costs: [],
    ccy: account.baseCcy,
    pnlBasis: 'gross',
    costCompleteness: 'complete',
    reconciliation: 'unverifiable',
    risk: { origin: 'none' },
    sourceFillIds: [],
    sourceBatchIds: [],
    anomalies: [],
  };
}
export type SourcePreference = 'confirm-overlaps' | 'prefer-fills' | 'prefer-reports';
export async function replayBook(
  entries: Fill[],
  account: Account,
  batches: ImportBatch[],
  cashEvents: CashEvent[] = [],
  overlays: TradeOverlay[] = [],
  sourcePreference: SourcePreference = 'confirm-overlaps',
): Promise<ReplayResult> {
  const result: ReplayResult = { cycles: [], events: [], openPositions: [], anomalies: [] };
  const batchMap = new Map(batches.map((b) => [b.batchId, b]));
  const active = entries.filter((f) => f.active && f.accountId === account.accountId);
  const flag = (
    code: string,
    fillIds: string[],
    severity: 'blocker' | 'needs-confirmation' | 'info' = 'needs-confirmation',
  ) => {
    result.anomalies.push({ code, fillIds, severity, message: code });
  };
  const groups = new Map<string, TradeFill[]>();
  for (const fill of active.filter((f): f is TradeFill => f.role === 'fill')) {
    positive(fill.qty, 'quantity');
    positive(fill.price, 'price');
    const key = bookKey(account, fill);
    if (fill.bookKey !== key) throw new Error('INVALID_BOOK_KEY');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(fill);
  }
  for (const [index, opening] of account.openingBalances.entries()) {
    const qty = D(opening.qty);
    if (qty.isZero()) continue;
    if (qty.lt(0) && !account.allowsShort) throw new Error('SHORT_OPENING_NOT_ALLOWED');
    const key = bookKey(account, opening);
    const first = groups.get(key)?.sort(compareFills)[0];
    if (first && Date.parse(first.tsUtc) < Date.parse(opening.asOfUtc)) {
      flag('OPENING_AFTER_HISTORY', [first.fillId], 'blocker');
      continue;
    }
    const lots = opening.lots ?? [{ qty: dec(qty.abs()), price: opening.avgPrice }];
    if (!D(sum(lots.map((l) => l.qty))).eq(qty.abs()))
      throw new Error('OPENING_LOT_QUANTITY_MISMATCH');
    if (!opening.lots && account.costBasis === 'fifo')
      flag('OPENING_FIFO_APPROXIMATE', [], 'needs-confirmation');
    for (const [lotIndex, lot] of lots.entries()) {
      const id = await hash(['opening', account.accountId, index, lotIndex, opening]);
      const fill: TradeFill = {
        fillId: id,
        batchId: `opening:${index}`,
        accountId: account.accountId,
        bookKey: key,
        symbol: opening.symbol,
        rootSymbol: opening.symbol,
        positionSide: opening.positionSide,
        dedupeKey: id,
        dedupeOcc: 1,
        normVersion: 1,
        active: true,
        synthetic: 'opening-balance',
        raw: {},
        role: 'fill',
        tsUtc: opening.asOfUtc,
        seq: String(lotIndex),
        side: qty.gt(0) ? 'buy' : 'sell',
        qty: positive(lot.qty),
        price: positive(lot.price),
        costs: [{ kind: 'commission', ccy: account.baseCcy, origin: 'missing' }],
      };
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(fill);
    }
  }
  for (const [key, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...rows].sort(compareFills),
      lots: OpenLot[] = [];
    let cycle: Cycle | undefined;
    const timeGroups = new Map<string, TradeFill[]>();
    for (const f of sorted) {
      const ts = new Date(f.tsUtc).toISOString();
      if (!timeGroups.has(ts)) timeGroups.set(ts, []);
      timeGroups.get(ts)!.push(f);
    }
    const ambiguous = new Set<string>();
    for (const group of timeGroups.values())
      if (
        new Set(group.map((f) => f.side)).size > 1 &&
        (group.some((f) => f.seq === undefined) ||
          new Set(group.map((f) => f.seq)).size !== group.length)
      ) {
        group.forEach((f) => ambiguous.add(f.fillId));
        flag(
          'AMBIGUOUS_ORDER',
          group.map((f) => f.fillId),
        );
      }
    for (const f of sorted) {
      if (f.adjustment) {
        if (
          f.synthetic !== 'manual' ||
          !cycle ||
          !lots.length ||
          f.costs.length ||
          account.pnlModel !== 'linear'
        ) {
          flag('INVALID_POSITION_ADJUSTMENT', [f.fillId], 'blocker');
          continue;
        }
        const factor = positive(f.adjustment.quantityFactor),
          totalQty = D(sum(lots.map((l) => l.qty))),
          basisDelta = D(f.adjustment.basisDelta);
        const updates = lots.map((l) => ({ ...l }));
        let residue = basisDelta;
        for (const [i, lot] of updates.entries()) {
          const delta =
            i === updates.length - 1
              ? residue
              : basisDelta.mul(D(lot.qty)).div(totalQty).toDecimalPlaces(24);
          residue = residue.minus(delta);
          lot.qty = dec(D(lot.qty).mul(D(factor)));
          lot.basis = dec(D(lot.basis).plus(delta));
          lot.price = dec(D(lot.basis).div(D(lot.qty)));
        }
        if (updates.some((l) => D(l.basis).lt(0))) {
          flag('NEGATIVE_ADJUSTED_BASIS', [f.fillId], 'blocker');
          continue;
        }
        lots.splice(0, lots.length, ...updates);
        cycle.adjustments = [
          ...(cycle.adjustments ?? []),
          { fillId: f.fillId, tsUtc: f.tsUtc, afterLegCount: cycle.legs.length, ...f.adjustment },
        ];
        cycle.sourceFillIds.push(f.fillId);
        cycle.sourceBatchIds.push(f.batchId);
        cycle.anomalies.push('USER_DECLARED_ADJUSTMENT');
        continue;
      }
      const direction = f.side === 'buy' ? 'LONG' : 'SHORT';
      const batch = batchMap.get(f.batchId);
      let remaining = f.qty,
        remainingCosts = valueCosts(f.costs, batch);
      const closingQty =
        lots.length && lots[0].direction !== direction
          ? dec(
              D(f.qty).lt(D(sum(lots.map((l) => l.qty))))
                ? D(f.qty)
                : D(sum(lots.map((l) => l.qty))),
            )
          : '0';
      let reportedRemaining = f.reportedRealized?.gross;
      let closingRemaining = closingQty;
      let closeEvent: RealizedEvent | undefined;
      while (D(remaining).gt(0)) {
        const head = lots[0];
        if (!head || head.direction === direction) {
          if (!head && direction === 'SHORT' && !account.allowsShort) {
            flag('OVERSELL', [f.fillId], 'blocker');
            const incomplete = cycleFrom(
              f,
              account,
              await hash([account.accountId, key, f.fillId, 'unmatched']),
            );
            incomplete.status = 'incomplete';
            incomplete.sourceFillIds = [f.fillId];
            incomplete.sourceBatchIds = [f.batchId];
            incomplete.anomalies = ['MISSING_OPENING', 'OVERSELL'];
            result.cycles.push(incomplete);
            break;
          }
          if (!cycle) cycle = cycleFrom(f, account, await hash([account.accountId, key, f.fillId]));
          cycle.legs.push({
            fillId: f.fillId,
            role: 'open',
            qty: remaining,
            price: f.price,
            tsUtc: f.tsUtc,
          });
          cycle.sourceFillIds.push(f.fillId);
          cycle.sourceBatchIds.push(f.batchId);
          if (ambiguous.has(f.fillId)) cycle.anomalies.push('AMBIGUOUS_ORDER');
          const basis = dec(D(f.price).mul(D(remaining)));
          if (account.costBasis === 'average' && head) {
            head.qty = sum([head.qty, remaining]);
            head.basis = sum([head.basis, basis]);
            head.price = dec(D(head.basis).div(D(head.qty)));
            head.costs.push(...remainingCosts);
          } else
            lots.push({
              fillId: f.fillId,
              tradeId: cycle.tradeId,
              bookKey: key,
              symbol: f.symbol,
              direction,
              qty: remaining,
              price: f.price,
              basis,
              costs: remainingCosts,
            });
          remaining = '0';
        } else {
          if (!cycle) throw new Error('REPLAY_CYCLE_MISSING');
          const take = D(remaining).lt(D(head.qty)) ? remaining : head.qty;
          const [openCosts, leftOpenCosts] = splitCosts(head.costs, take, head.qty);
          const [closeCosts, leftCloseCosts] = splitCosts(remainingCosts, take, remaining);
          const consumedBasis = D(take).eq(D(head.qty))
            ? head.basis
            : dec(D(head.basis).mul(D(take)).div(D(head.qty)).toDecimalPlaces(24));
          let gross: string | undefined;
          if (account.pnlModel === 'linear' && account.quoteCcy === account.baseCcy)
            gross = dec(
              D(f.price)
                .mul(D(take))
                .minus(D(consumedBasis))
                .mul(head.direction === 'LONG' ? '1' : '-1')
                .mul(D(account.contractMultiplier)),
            );
          else if (reportedRemaining !== undefined && f.reportedRealized?.ccy === account.baseCcy) {
            gross = D(take).eq(D(closingRemaining))
              ? reportedRemaining
              : dec(D(reportedRemaining).mul(D(take)).div(D(closingRemaining)).toDecimalPlaces(24));
            reportedRemaining = dec(D(reportedRemaining).minus(D(gross)));
            closingRemaining = dec(D(closingRemaining).minus(D(take)));
            cycle.grossSource = 'reported';
          } else if (
            f.reportedRealized?.net === undefined ||
            f.reportedRealized.ccy !== account.baseCcy
          ) {
            flag('UNSUPPORTED_PNL_MODEL', [f.fillId], 'blocker');
            cycle.anomalies.push('UNSUPPORTED_PNL_MODEL');
          }
          if (!closeEvent)
            closeEvent = {
              eventId: await hash([cycle.tradeId, f.fillId, 'close']),
              tradeId: cycle.tradeId,
              fillId: f.fillId,
              accountId: account.accountId,
              symbol: f.symbol,
              batchId: f.batchId,
              tsUtc: f.tsUtc,
              qtyClosed: '0',
              gross: '0',
              costs: [],
              ccy: account.baseCcy,
              fx: fxRate(batch, account.baseCcy)
                ? { rateToVND: fxRate(batch, account.baseCcy)! }
                : undefined,
              costCompleteness: batch?.parseConfig.costCompleteness ?? 'partial',
              kind: 'close',
              orderKey: cycle.orderKey,
            };
          closeEvent.qtyClosed = sum([closeEvent.qtyClosed, take]);
          closeEvent.gross =
            closeEvent.gross !== undefined && gross !== undefined
              ? sum([closeEvent.gross, gross])
              : undefined;
          closeEvent.costs.push(...openCosts, ...closeCosts);
          cycle.legs.push({
            fillId: f.fillId,
            role: 'close',
            qty: take,
            price: f.price,
            tsUtc: f.tsUtc,
          });
          cycle.sourceFillIds.push(f.fillId);
          cycle.sourceBatchIds.push(f.batchId);
          if (ambiguous.has(f.fillId)) cycle.anomalies.push('AMBIGUOUS_ORDER');
          head.basis = dec(D(head.basis).minus(D(consumedBasis)));
          head.qty = dec(D(head.qty).minus(D(take)));
          head.costs = leftOpenCosts;
          remaining = dec(D(remaining).minus(D(take)));
          remainingCosts = leftCloseCosts;
          if (D(head.qty).isZero()) lots.shift();
          if (!lots.length) {
            cycle.status = cycle.anomalies.includes('UNSUPPORTED_PNL_MODEL')
              ? 'incomplete'
              : 'closed';
            cycle.closeTsUtc = f.tsUtc;
            result.cycles.push(cycle);
            cycle = undefined;
          }
        }
      }
      if (closeEvent) {
        const valued = eventFinance(
          closeEvent,
          f.reportedRealized?.ccy === account.baseCcy ? f.reportedRealized.net : undefined,
        );
        result.events.push(valued);
      }
    }
    if (cycle) result.cycles.push(cycle);
    result.openPositions.push(...lots);
  }
  for (const f of active.filter((f) => f.role !== 'fill')) {
    const batch = batchMap.get(f.batchId),
      rate = fxRate(batch, f.ccy);
    const cycle = cycleFrom(f, account, await hash([account.accountId, f.bookKey, f.fillId]));
    cycle.status = 'closed';
    cycle.closeTsUtc = f.closeTsUtc;
    cycle.qtyOpened = f.qty;
    cycle.avgEntry = f.role === 'reported-position' ? f.openPrice : f.avgCostPrice;
    cycle.avgExit = f.closePrice;
    cycle.ccy = f.ccy;
    cycle.sourceFillIds = [f.fillId];
    cycle.sourceBatchIds = [f.batchId];
    cycle.pnlBasis = batch?.parseConfig.pnlBasis ?? 'unknown';
    if (f.role === 'reported-position')
      cycle.legs = [
        { fillId: f.fillId, role: 'open', qty: f.qty, price: f.openPrice, tsUtc: f.openTsUtc },
      ];
    let gross = f.reportedGross;
    const costs = valueCosts(f.costs, batch);
    if (
      gross === undefined &&
      f.reportedNet !== undefined &&
      batch?.parseConfig.costCompleteness === 'complete' &&
      costs.every((c) => c.amount !== undefined && c.ccy === f.ccy)
    )
      gross = sum([f.reportedNet, ...costs.map((c) => c.amount!)]);
    const exact = active.filter(
      (e) =>
        e.role === 'fill' && f.positionId && e.positionId === f.positionId && e.symbol === f.symbol,
    );
    const covered = result.cycles.filter(
      (c) =>
        c.granularity === 'fill' &&
        c.status === 'closed' &&
        c.bookKey === f.bookKey &&
        c.sourceFillIds.every((id) => exact.some((e) => e.fillId === id)),
    );
    // An ID alone is insufficient: a truncated fill export must not hide a complete position.
    if (
      sourcePreference !== 'prefer-reports' &&
      f.role === 'reported-position' &&
      covered.length === 1 &&
      covered[0].openTsUtc === f.openTsUtc &&
      covered[0].closeTsUtc === f.closeTsUtc &&
      D(sum(covered[0].legs.filter((l) => l.role === 'open').map((l) => l.qty))).eq(D(f.qty))
    )
      cycle.shadowed = true;
    const event = eventFinance(
      {
        eventId: await hash([cycle.tradeId, f.fillId, 'reported']),
        tradeId: cycle.tradeId,
        fillId: f.fillId,
        accountId: account.accountId,
        symbol: f.symbol,
        batchId: f.batchId,
        tsUtc: f.closeTsUtc,
        qtyClosed: f.qty,
        gross,
        costs,
        ccy: f.ccy,
        fx: rate ? { rateToVND: rate } : undefined,
        kind: 'close',
        shadowed: cycle.shadowed,
        costCompleteness: batch?.parseConfig.costCompleteness ?? 'unknown',
      },
      f.reportedNet,
    );
    if (cycle.pnlBasis === 'unknown') {
      event.net = undefined;
      event.netVND = undefined;
      flag('UNKNOWN_PNL_BASIS', [f.fillId], 'blocker');
    }
    cycle.reconciliation = reconcile(f.reportedNet, eventFinance({ ...event }).net);
    result.events.push(event);
    result.cycles.push(cycle);
  }
  const localDay = (ts: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: account.sourceTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ts));
  const rank = (c: Cycle) =>
    ({ fill: 4, position: 3, 'closing-order': 2, 'day-symbol': 1 })[c.granularity];
  const overlaps = (a: Cycle, b: Cycle) => {
    if (a.bookKey !== b.bookKey || a.granularity === b.granularity) return false;
    const [higher, lower] = rank(a) > rank(b) ? [a, b] : [b, a];
    if (!lower.closeTsUtc) return false;
    if (lower.granularity === 'position')
      return (
        !!higher.openTsUtc &&
        higher.openTsUtc <= lower.closeTsUtc &&
        (!higher.closeTsUtc || higher.closeTsUtc >= lower.openTsUtc!)
      );
    return result.events.some(
      (e) => e.tradeId === higher.tradeId && localDay(e.tsUtc) === localDay(lower.closeTsUtc!),
    );
  };
  // Resolve the entire graph, not insertion order. Source choices are explicit settings;
  // raw rows remain active so another choice can replay the original evidence.
  const excluded = new Set(result.cycles.filter((c) => c.shadowed).map((c) => c.tradeId));
  const crossGroups = new Map<string, Map<string, Cycle[]>>();
  for (const c of result.cycles) {
    if (!crossGroups.has(c.bookKey)) crossGroups.set(c.bookKey, new Map());
    const g = crossGroups.get(c.bookKey)!;
    if (!g.has(c.granularity)) g.set(c.granularity, []);
    g.get(c.granularity)!.push(c);
  }
  const pairs = function* () {
    for (const groups of crossGroups.values()) {
      const kinds = [...groups.values()];
      for (let i = 0; i < kinds.length; i++)
        for (let j = i + 1; j < kinds.length; j++)
          for (const a of kinds[i]) for (const b of kinds[j]) yield [a, b];
    }
  };
  for (const [a, b] of pairs()) {
    if (a.shadowed || b.shadowed || !overlaps(a, b)) continue;
    if (sourcePreference === 'confirm-overlaps')
      flag('POSSIBLE_CROSS_REPORT_OVERLAP', [...a.sourceFillIds, ...b.sourceFillIds], 'blocker');
    else {
      const useReports =
        sourcePreference === 'prefer-reports' &&
        (a.granularity === 'fill' || b.granularity === 'fill');
      const lower = useReports ? (a.granularity === 'fill' ? a : b) : rank(a) < rank(b) ? a : b;
      excluded.add(lower.tradeId);
    }
  }
  for (const cycle of result.cycles)
    if (excluded.has(cycle.tradeId)) {
      cycle.shadowed = true;
      cycle.anomalies.push('CROSS_REPORT_COMPARISON_ONLY');
    }
  for (const event of result.events)
    if (event.tradeId && excluded.has(event.tradeId)) event.shadowed = true;
  result.openPositions = result.openPositions.filter((lot) => !excluded.has(lot.tradeId));
  for (const cash of cashEvents.filter((e) => e.active && e.accountId === account.accountId)) {
    if (['deposit', 'withdrawal', 'reported-realized'].includes(cash.kind)) continue;
    if (cash.reconcilesFillId) {
      if (
        !active.some(
          (f) =>
            f.fillId === cash.reconcilesFillId &&
            (!cash.symbol || f.symbol === cash.symbol) &&
            f.costs.some(
              (c) =>
                c.kind === cash.kind &&
                c.ccy === cash.ccy &&
                c.amount !== undefined &&
                D(c.amount).eq(D(cash.amount)),
            ),
        )
      )
        flag('INVALID_CASH_LINK', [cash.eventId], 'blocker');
      continue;
    }
    const possibleCostCopies = active.filter(
      (f) =>
        f.batchId !== cash.batchId &&
        (!cash.symbol || f.symbol === cash.symbol) &&
        (f.role === 'fill' ? f.tsUtc === cash.tsUtc : f.closeTsUtc === cash.tsUtc) &&
        f.costs.some(
          (c) =>
            c.kind === cash.kind &&
            c.ccy === cash.ccy &&
            c.amount !== undefined &&
            D(c.amount).eq(D(cash.amount)),
        ),
    );
    if (possibleCostCopies.length)
      flag(
        'POSSIBLE_DUPLICATE_CASH_COST',
        [cash.eventId, ...possibleCostCopies.map((f) => f.fillId)],
        'blocker',
      );
    const matches = result.cycles.filter(
      (c) =>
        !c.shadowed &&
        c.symbol === cash.symbol &&
        c.openTsUtc &&
        c.openTsUtc <= cash.tsUtc &&
        (!c.closeTsUtc || c.closeTsUtc >= cash.tsUtc) &&
        (!cash.positionId ||
          c.sourceFillIds.some((id) =>
            active.some((f) => f.fillId === id && f.positionId === cash.positionId),
          )),
    );
    const cycle = matches.length === 1 ? matches[0] : undefined;
    if (matches.length > 1) flag('AMBIGUOUS_CASH_ALLOCATION', [cash.eventId]);
    const batch = batchMap.get(cash.batchId),
      ccy = cycle?.ccy ?? cash.ccy;
    const rate = fxRate(batch, ccy);
    const cost: CostItem = {
      kind: cash.kind as CostItem['kind'],
      amount: cash.amount,
      ccy: cash.ccy,
      origin: 'reported',
      rateToVND: fxRate(batch, cash.ccy),
      batchId: cash.batchId,
      sourceId: cash.eventId,
    };
    result.events.push(
      eventFinance({
        eventId: await hash(['cash', cash.eventId]),
        tradeId: cycle?.tradeId,
        fillId: cash.eventId,
        accountId: account.accountId,
        symbol: cash.symbol,
        batchId: cash.batchId,
        tsUtc: cash.tsUtc,
        qtyClosed: '0',
        gross: '0',
        costs: [cost],
        ccy,
        fx: rate ? { rateToVND: rate } : undefined,
        costCompleteness: 'complete',
        kind: 'cash',
      }),
    );
  }
  const eventsByTrade = new Map<string, typeof result.events>();
  for (const e of result.events)
    if (e.tradeId) {
      if (!eventsByTrade.has(e.tradeId)) eventsByTrade.set(e.tradeId, []);
      eventsByTrade.get(e.tradeId)!.push(e);
    }
  const fillById = new Map(active.map((f) => [f.fillId, f]));
  result.cycles = result.cycles.map((c) => {
    const terminalUnits = c.legs.map((leg, index) => {
      const factor = (c.adjustments ?? [])
        .filter((a) => a.afterLegCount > index)
        .reduce((v, a) => v.mul(D(a.quantityFactor)), D('1'));
      return { ...leg, qty: dec(D(leg.qty).mul(factor)), price: dec(D(leg.price).div(factor)) };
    });
    const opens = terminalUnits.filter((l) => l.role === 'open'),
      closes = terminalUnits.filter((l) => l.role === 'close');
    const qtyOpened = opens.length ? sum(opens.map((l) => l.qty)) : c.qtyOpened;
    const avg = (legs: Cycle['legs']) =>
      dec(
        D(sum(legs.map((l) => dec(D(l.price).mul(D(l.qty)))))).div(D(sum(legs.map((l) => l.qty)))),
      );
    const adjustedEntry = opens.length
      ? dec(
          D(avg(opens)).plus(
            D(sum((c.adjustments ?? []).map((a) => a.basisDelta))).div(D(qtyOpened)),
          ),
        )
      : c.avgEntry;
    const aggregated = aggregateCycle(
      {
        ...c,
        qtyOpened,
        avgEntry: adjustedEntry,
        avgExit: closes.length ? avg(closes) : c.avgExit,
        holdMinutes:
          c.openTsUtc && c.closeTsUtc
            ? (Date.parse(c.closeTsUtc) - Date.parse(c.openTsUtc)) / 60000
            : undefined,
        sourceFillIds: [...new Set(c.sourceFillIds)],
        sourceBatchIds: [...new Set(c.sourceBatchIds)],
        anomalies: [...new Set(c.anomalies)],
      },
      eventsByTrade.get(c.tradeId) ?? [],
    );
    const closingIds = new Set(closes.map((l) => l.fillId));
    const reported = [...closingIds]
      .map((id) => fillById.get(id))
      .filter((f): f is TradeFill => f?.role === 'fill');
    if (
      c.status === 'closed' &&
      reported.length &&
      reported.every(
        (f) =>
          f.reportedRealized?.gross !== undefined && f.reportedRealized.ccy === account.baseCcy,
      )
    ) {
      aggregated.reconciliation = reconcile(
        sum(reported.map((f) => f.reportedRealized!.gross!)),
        sum(
          (eventsByTrade.get(c.tradeId) ?? [])
            .filter((e) => e.kind === 'close' && e.gross !== undefined)
            .map((e) => e.gross!),
        ),
      );
      if (aggregated.reconciliation === 'mismatch') flag('REPORTED_PNL_MISMATCH', [...closingIds]);
    }
    return aggregated;
  });
  const attached = reanchorOverlays(result.cycles, overlays);
  result.cycles = result.cycles.map((c) => {
    const candidates = attached.filter((o) => o.attachedTradeId === c.tradeId);
    // Never silently overwrite two user journals that merge into a single cycle.
    const overlay = candidates.length === 1 ? candidates[0] : undefined;
    if (candidates.length > 1) flag('OVERLAY_MERGE_CONFLICT', c.sourceFillIds);
    const source = c.sourceFillIds
      .map((id) => fillById.get(id))
      .find((f) => f?.role === 'reported-position');
    const risk = resolveRisk(
      c,
      account,
      batches,
      overlay,
      source?.role === 'reported-position'
        ? { price: source.stopLossPrice, origin: source.stopOrigin }
        : undefined,
    );
    return { ...c, overlay, risk: risk.risk, anomalies: [...c.anomalies, ...risk.warnings] };
  });
  result.cycles.sort((a, b) => a.tradeId.localeCompare(b.tradeId));
  result.events.sort(
    (a, b) => Date.parse(a.tsUtc) - Date.parse(b.tsUtc) || a.eventId.localeCompare(b.eventId),
  );
  result.events = result.events.map((e) => ({
    ...e,
    market: account.market,
    platform: account.platform,
  }));
  return result;
}

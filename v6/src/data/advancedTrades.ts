import { tradeSchema, type Trade } from './schema';
import { validateSnapshot, type Snapshot } from './snapshot';
import { tradeFacts } from '../core/trade';
import { canonical } from './backup';
import { sum } from '../core/money';
export function replaceTradeLegs(
  data: Snapshot,
  id: string,
  legs: Trade['legs'],
  status: Trade['status'],
) {
  const old = data.trades.find((t) => t.id === id);
  if (!old) throw Error('TRADE_NOT_FOUND');
  const trade = tradeSchema.parse({
    ...old,
    legs,
    status,
    review: { ...old.review, done: false, at: undefined },
    updatedAt: new Date().toISOString(),
  });
  tradeFacts(trade);
  return validateSnapshot({ ...data, trades: data.trades.map((t) => (t.id === id ? trade : t)) });
}
export function mergeTrades(data: Snapshot, ids: string[]) {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw Error('SELECT_DISTINCT_TRADES');
  const trades = ids.map((id) => {
    const t = data.trades.find((t) => t.id === id);
    if (!t) throw Error('TRADE_NOT_FOUND');
    return t;
  });
  const first = trades[0];
  for (const t of trades) {
    if (
      t.journalId !== first.journalId ||
      t.symbol !== first.symbol ||
      t.market !== first.market ||
      t.side !== first.side ||
      t.status !== 'closed' ||
      t.importBatchId ||
      t.setupId !== first.setupId ||
      t.review.done ||
      t.review.noteId ||
      t.attachments.length ||
      t.errorTagIds.length ||
      Object.keys(t.customStats).length ||
      t.disciplineLegacy !== undefined ||
      t.stageChips ||
      t.checklist ||
      t.emotion ||
      t.plannedSL ||
      t.plannedTP ||
      t.highestPrice ||
      t.lowestPrice ||
      t.otpHit ||
      t.starred ||
      canonical(t.tags) !== canonical(first.tags) ||
      t.costsKnown !== first.costsKnown ||
      (t.multiplier ?? '1') !== (first.multiplier ?? '1') ||
      (t.lotSize ?? '1') !== (first.lotSize ?? '1')
    )
      throw Error('MERGE_METADATA_OR_INSTRUMENT_CONFLICT');
  }
  const costs = Object.fromEntries(
    Object.keys(first.costs).map((key) => [
      key,
      sum(trades.map((t) => t.costs[key as keyof Trade['costs']])),
    ]),
  );
  const trade = tradeSchema.parse({
    ...first,
    id: 'merge:' + crypto.randomUUID(),
    legs: trades.flatMap((t) => t.legs),
    costs,
    initialRisk: trades.every((t) => t.initialRisk)
      ? sum(trades.map((t) => t.initialRisk!))
      : undefined,
    mergedFrom: trades.flatMap((t) => [t.id, ...(t.mergedFrom ?? [])]),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const signature = (ts: Trade[]) =>
    canonical(
      ts
        .flatMap((t) => tradeFacts(t).events)
        .map((e) => ({
          time: e.time,
          gross: e.gross,
          net: e.net,
          quantity: e.quantity,
          costs: e.costs,
        }))
        .sort((a, b) => canonical(a).localeCompare(canonical(b))),
    );
  if (signature(trades) !== signature([trade])) throw Error('MERGE_EVENT_TIMING_NOT_LOSSLESS');
  return validateSnapshot({
    ...data,
    trades: [...data.trades.filter((t) => !ids.includes(t.id)), trade],
    sources: [
      ...data.sources,
      { id: trade.id, raw: canonical(trades), createdAt: new Date().toISOString() },
    ],
  });
}

import { tradeSchema, type Trade } from './schema';
import { type Snapshot, validateSnapshot } from './snapshot';
import { tradeFacts } from '../core/trade';
import { D, dec, sum } from '../core/money';
import { canonical } from './backup';
export function mergeTrades(data: Snapshot, ids: string[]) {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw Error('SELECT_DISTINCT_TRADES');
  const ts = ids.map((id) => {
      const t = data.trades.find((t) => t.id === id);
      if (!t) throw Error('TRADE_NOT_FOUND');
      return t;
    }),
    first = ts[0];
  for (const t of ts)
    if (
      t.journalId !== first.journalId ||
      t.symbol !== first.symbol ||
      t.market !== first.market ||
      t.side !== first.side ||
      t.setupId !== first.setupId ||
      t.importBatchId !== first.importBatchId ||
      (t.multiplier ?? '1') !== (first.multiplier ?? '1') ||
      (t.lotSize ?? '1') !== (first.lotSize ?? '1') ||
      t.tags.includes('fifo-import')
    )
      throw Error('MERGE_METADATA_OR_INSTRUMENT_CONFLICT');
  for (const key of ['plannedSL', 'plannedTP', 'otpHit'] as const)
    if (ts.some((t) => t[key] !== first[key])) throw Error('MERGE_PLAN_CONFLICT');
  const custom: Trade['customStats'] = {},
    check = new Map<string, boolean>();
  for (const t of ts) {
    for (const [k, v] of Object.entries(t.customStats)) {
      if (custom[k] !== undefined && custom[k] !== v) throw Error('MERGE_CUSTOM_STAT_CONFLICT');
      custom[k] = v;
    }
    for (const c of t.checklist ?? []) {
      if (check.has(c.criterionId) && check.get(c.criterionId) !== c.checked)
        throw Error('MERGE_CHECKLIST_CONFLICT');
      check.set(c.criterionId, c.checked);
    }
  }
  const facts = ts.map(tradeFacts),
    legs: Trade['legs'] = [];
  for (const [index, t] of ts.entries()) {
    const f = facts[index],
      events = new Map(f.events.map((e) => [e.id, e])),
      inventory: { id: string; qty: ReturnType<typeof D> }[] = [];
    const rename = (id: string) => t.id + '|' + id;
    for (const l of [...t.legs].sort(
      (a, b) => a.time.localeCompare(b.time) || t.legs.indexOf(a) - t.legs.indexOf(b),
    )) {
      if (l.kind === 'in') {
        inventory.push({ id: l.id, qty: D(l.quantity) });
        legs.push({ ...l, id: rename(l.id) });
        continue;
      }
      const e = events.get(l.id)!;
      let allocations: NonNullable<typeof l.entryAllocations>;
      if (l.entryAllocations)
        allocations = l.entryAllocations.map((a) => ({ ...a, entryLegId: rename(a.entryLegId) }));
      else {
        const available = inventory.filter((x) => x.qty.gt(0)),
          total = sum(available.map((x) => dec(x.qty)));
        let used = D('0');
        allocations = available
          .map((x, i) => {
            const q =
              i === available.length - 1
                ? D(l.quantity).minus(used)
                : D(l.quantity).mul(x.qty).div(total);
            used = used.plus(q);
            x.qty = x.qty.minus(q);
            return { entryLegId: rename(x.id), quantity: dec(q) };
          })
          .filter((a) => D(a.quantity).gt(0));
      }
      legs.push({
        ...l,
        id: rename(l.id),
        entryAllocations: allocations,
        realizedCosts: e.costs,
        costsKnown: e.net !== undefined,
      });
    }
  }
  const costs = Object.fromEntries(
    Object.keys(first.costs).map((k) => [
      k,
      sum(ts.map((t) => t.costs[k as keyof Trade['costs']])),
    ]),
  );
  const union = (xs: string[][]) => [...new Set(xs.flat())];
  const attached = ts.flatMap((t) => t.attachments);
  if (attached.length > 6) throw Error('MERGE_ATTACHMENT_LIMIT');
  const trade = tradeSchema.parse({
    ...first,
    id: 'merge:' + crypto.randomUUID(),
    legs,
    costs,
    costsKnown: ts.every((t) => t.costsKnown),
    status: facts.every((f) => f.closeTime) ? 'closed' : 'open',
    initialRisk: facts.every((f) => f.risk) ? sum(facts.map((f) => f.risk!)) : undefined,
    review: { done: false },
    starred: ts.some((t) => t.starred),
    tags: union(ts.map((t) => t.tags)),
    errorTagIds: union(ts.map((t) => t.errorTagIds)),
    stageChips: ts.some((t) => t.stageChips)
      ? {
          entry: union(ts.map((t) => t.stageChips?.entry ?? [])),
          management: union(ts.map((t) => t.stageChips?.management ?? [])),
          exit: union(ts.map((t) => t.stageChips?.exit ?? [])),
        }
      : undefined,
    checklist: check.size
      ? [...check].map(([criterionId, checked]) => ({ criterionId, checked }))
      : undefined,
    customStats: custom,
    attachments: attached,
    emotion:
      [...new Set(ts.flatMap((t) => (t.emotion ? [t.emotion] : [])))].join(' · ') || undefined,
    disciplineLegacy: ts.every((t) => t.disciplineLegacy === first.disciplineLegacy)
      ? first.disciplineLegacy
      : undefined,
    highestPrice: ts.every((t) => t.highestPrice)
      ? dec(ts.map((t) => D(t.highestPrice!)).reduce((a, b) => (a.gt(b) ? a : b)))
      : undefined,
    lowestPrice: ts.every((t) => t.lowestPrice)
      ? dec(ts.map((t) => D(t.lowestPrice!)).reduce((a, b) => (a.lt(b) ? a : b)))
      : undefined,
    mergedFrom: union(ts.map((t) => [t.id, ...(t.mergedFrom ?? [])])),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const signature = (rows: Trade[]) =>
    canonical(
      rows
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
  if (signature(ts) !== signature([trade])) throw Error('MERGE_EVENT_TIMING_NOT_LOSSLESS');
  return validateSnapshot({
    ...data,
    trades: [...data.trades.filter((t) => !ids.includes(t.id)), trade],
    notes: data.notes.map((n) =>
      n.scope === 'trade' && ids.includes(n.refId) ? { ...n, refId: trade.id } : n,
    ),
    plannedTrades: data.plannedTrades.map((p) =>
      p.takenTradeId && ids.includes(p.takenTradeId) ? { ...p, takenTradeId: trade.id } : p,
    ),
    altStrategies: data.altStrategies.map((a) => {
      if (a.hypotheticalR.some((r) => ids.includes(r.tradeId)))
        throw Error('MERGE_ALTERNATIVE_REFERENCE');
      return a;
    }),
    batches: data.batches.map((b) => ({
      ...b,
      tradeIds: union([b.tradeIds.map((id) => (ids.includes(id) ? trade.id : id))]),
    })),
    sources: [
      ...data.sources,
      {
        id: trade.id,
        raw: canonical({
          trades: ts,
          notes: data.notes.filter((n) => n.scope === 'trade' && ids.includes(n.refId)),
        }),
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

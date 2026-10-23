import { z } from 'zod';
import {
  journalSchema,
  tradeSchema,
  setupSchema,
  errorTagSchema,
  planSchema,
  cashFlowSchema,
  importBatchSchema,
  noteSchema,
  plannedTradeSchema,
  altStrategySchema,
  customStatDefSchema,
} from './schema';
import { tradeFacts } from '../core/trade';
import { imageDataURL } from './images';
export const snapshotSchema = z
  .object({
    sources: z
      .array(
        z.object({ id: z.string(), raw: z.string(), createdAt: z.string().datetime() }).strict(),
      )
      .default([]),
    journals: z.array(journalSchema),
    trades: z.array(tradeSchema),
    setups: z.array(setupSchema),
    errorTags: z.array(errorTagSchema),
    plans: z.array(planSchema),
    cashFlows: z.array(cashFlowSchema),
    batches: z.array(importBatchSchema),
    notes: z.array(noteSchema),
    plannedTrades: z.array(plannedTradeSchema),
    altStrategies: z.array(altStrategySchema),
    customStatDefs: z.array(customStatDefSchema),
  })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export const emptySnapshot = (): Snapshot => ({
  sources: [],
  journals: [],
  trades: [],
  setups: [],
  errorTags: [],
  plans: [],
  cashFlows: [],
  batches: [],
  notes: [],
  plannedTrades: [],
  altStrategies: [],
  customStatDefs: [],
});
export function validateSnapshot(value: unknown): Snapshot {
  const data = snapshotSchema.parse(value),
    journals = new Set(data.journals.map((j) => j.id));
  const sourcesById = new Map(data.sources.map((s) => [s.id, s])),
    checkedImages = new Set<string>();
  for (const [table, rows] of Object.entries(data)) {
    if (table === 'sources') {
      if (new Set(data.sources.map((x) => x.id)).size !== data.sources.length)
        throw Error('DUPLICATE_SOURCES');
      continue;
    }
    const ids = rows.map((r) =>
      'id' in r
        ? r.id
        : table === 'customStatDefs'
          ? `${r.journalId}:${'slot' in r ? r.slot : ''}`
          : r.journalId,
    );
    if (new Set(ids).size !== ids.length) throw Error('DUPLICATE_' + table);
    if (table !== 'journals')
      for (const r of rows) {
        if (!('journalId' in r) || !journals.has(r.journalId)) throw Error('ORPHAN_' + table);
      }
  }
  const requireRef = (
    id: string | undefined,
    rows: { id: string; journalId: string }[],
    journalId: string,
  ) => {
    if (id && !rows.some((r) => r.id === id && r.journalId === journalId))
      throw Error('CROSS_JOURNAL_REFERENCE');
  };
  for (const t of data.trades) {
    tradeFacts(t);
    requireRef(t.setupId, data.setups, t.journalId);
    requireRef(t.importBatchId, data.batches, t.journalId);
    requireRef(t.review.noteId, data.notes, t.journalId);
    for (const id of [...t.errorTagIds, ...Object.values(t.stageChips ?? {}).flat()])
      requireRef(id, data.errorTags, t.journalId);
    for (const a of t.attachments)
      if (a.kind === 'blob') {
        const source = sourcesById.get(a.blobKey);
        if (!source) throw Error('BLOB_SOURCE_MISSING');
        if (!checkedImages.has(a.blobKey)) {
          imageDataURL(source.raw);
          checkedImages.add(a.blobKey);
        }
      }
  }
  for (const n of data.notes)
    if (n.scope === 'trade') requireRef(n.refId, data.trades, n.journalId);
  for (const b of data.batches)
    for (const id of b.tradeIds) requireRef(id, data.trades, b.journalId);
  for (const p of data.plannedTrades) {
    requireRef(p.setupId, data.setups, p.journalId);
    requireRef(p.takenTradeId, data.trades, p.journalId);
    for (const a of p.attachments ?? [])
      if (a.kind === 'blob') {
        const source = sourcesById.get(a.blobKey);
        if (!source) throw Error('BLOB_SOURCE_MISSING');
        if (!checkedImages.has(a.blobKey)) {
          imageDataURL(source.raw);
          checkedImages.add(a.blobKey);
        }
      }
  }
  for (const a of data.altStrategies) {
    requireRef(a.setupId, data.setups, a.journalId);
    for (const r of a.hypotheticalR) requireRef(r.tradeId, data.trades, a.journalId);
  }
  for (const p of data.plans)
    for (const id of p.allowedSetupIds) requireRef(id, data.setups, p.journalId);
  return data;
}

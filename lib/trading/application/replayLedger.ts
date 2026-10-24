import { reanchorOverlays } from '../domain/finance';
import { replayBook, type SourcePreference } from '../domain/replayBook';
import type { LedgerSnapshot, ReplayResult } from '../domain/types';

export async function replayLedger(data: LedgerSnapshot): Promise<ReplayResult> {
  const preferences = data.settings.sourcePreferences as Record<string, SourcePreference> | undefined;
  const results = await Promise.all(data.accounts.map(a => replayBook(data.fills, a, data.batches, data.cashEvents, data.overlays,
    ['prefer-fills', 'prefer-reports'].includes(preferences?.[a.accountId] ?? '') ? preferences![a.accountId] : 'confirm-overlaps')));
  return { cycles: results.flatMap(r => r.cycles), events: results.flatMap(r => r.events).sort((a, b) => a.tsUtc.localeCompare(b.tsUtc) || a.eventId.localeCompare(b.eventId)), openPositions: results.flatMap(r => r.openPositions), anomalies: results.flatMap(r => r.anomalies) };
}
export async function anchorSnapshot(data: LedgerSnapshot): Promise<LedgerSnapshot> {
  const result = await replayLedger(data);
  const overlays = reanchorOverlays(result.cycles, data.overlays);
  const counts = new Map<string, number>();
  for (const o of overlays) if (o.attachedTradeId) counts.set(o.attachedTradeId, (counts.get(o.attachedTradeId) ?? 0) + 1);
  return { ...data, overlays: overlays.map(o => o.attachedTradeId && counts.get(o.attachedTradeId)! > 1 ? { ...o, state: 'needs-attention' as const } : o) };
}
export async function rollbackPreview(data: LedgerSnapshot, batchId: string) {
  if (!data.batches.some(b => b.batchId === batchId && b.status === 'committed')) throw new Error('BATCH_NOT_COMMITTED');
  const next: LedgerSnapshot = { ...data, batches: data.batches.map(b => b.batchId === batchId ? { ...b, status: 'rolled-back', rolledBackAt: new Date().toISOString() } : b),
    fills: data.fills.map(f => f.batchId === batchId ? { ...f, active: false } : f), cashEvents: data.cashEvents.map(e => e.batchId === batchId ? { ...e, active: false } : e) };
  const before = await replayLedger(data), after = await replayLedger(next), anchored = await anchorSnapshot(next);
  return { data: anchored, before, after, affectedBookKeys: [...new Set(data.fills.filter(f => f.batchId === batchId).map(f => f.bookKey))],
    dependentBatches: [...new Set(before.cycles.filter(c => c.sourceBatchIds.includes(batchId)).flatMap(c => c.sourceBatchIds).filter(id => id !== batchId))],
    affectedOverlays: anchored.overlays.filter(o => o.state !== 'attached') };
}

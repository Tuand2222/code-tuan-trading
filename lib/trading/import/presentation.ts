import { D, dec, sum } from '../domain/decimal';
import { costsVND, fxRate, reconcile } from '../domain/finance';
import type { Cycle, Fill, ImportBatch, LedgerSnapshot, ReplayResult } from '../domain/types';
import type { StagedImport } from './stage';

export function displayAmount(value: string | undefined, ccy = 'VND'): string {
  if (value === undefined) return 'Chưa xác định';
  const n = D(value).toNumber();
  return Number.isFinite(n) && Math.abs(n) < 1e16 ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: ccy === 'VND' ? 0 : 8 }).format(n)} ${ccy}` : `${value} ${ccy}`;
}
export function batchComparison(stage: StagedImport) {
  const batch = stage.batch, account = stage.account;
  return stage.parsed.fills.filter((f): f is Exclude<Fill, { role: 'fill' }> => f.role !== 'fill').map(f => {
    const cycle = stage.replay.cycles.find(c => c.sourceFillIds.includes(f.fillId));
    const entry = f.role === 'reported-position' ? f.openPrice : f.avgCostPrice;
    const direction = f.role === 'reported-position' && f.direction === 'SHORT' ? '-1' : '1';
    const grossComputed = account.pnlModel === 'linear' && account.baseCcy === account.quoteCcy ? dec(D(f.closePrice).minus(D(entry)).mul(D(f.qty)).mul(D(account.contractMultiplier)).mul(D(direction))) : undefined;
    const rate = fxRate(batch, f.ccy), costs = costsVND(f.costs.map(c => ({ ...c, rateToVND: c.rateToVND ?? fxRate(batch, c.ccy) })));
    const computedNet = grossComputed !== undefined && rate && costs !== undefined ? dec(D(grossComputed).mul(D(rate)).minus(D(costs))) : undefined;
    const reportedNet = f.reportedNet !== undefined && rate ? dec(D(f.reportedNet).mul(D(rate))) : undefined;
    const reportedGross = f.reportedGross !== undefined && rate ? dec(D(f.reportedGross).mul(D(rate))) : undefined;
    const computedGrossVND = grossComputed !== undefined && rate ? dec(D(grossComputed).mul(D(rate))) : undefined;
    return { fillId: f.fillId, symbol: f.symbol, reportedGross, reportedNet, computedGross: computedGrossVND, computedNet, status: reportedNet !== undefined ? reconcile(reportedNet, computedNet) : reconcile(reportedGross, computedGrossVND), shadowed: !!cycle?.shadowed };
  });
}
export function importSummary(data: LedgerSnapshot, replay: ReplayResult, batchIds: string[]) {
  const batches = data.batches.filter(b => batchIds.includes(b.batchId));
  const cycles = replay.cycles.filter(c => !c.shadowed && c.sourceBatchIds.some(id => batchIds.includes(id)));
  const events = replay.events.filter(e => !e.shadowed && batchIds.includes(e.batchId));
  const knownEvents = events.filter(e => e.netVND !== undefined);
  const dates = events.map(e => e.tsUtc).sort();
  return {
    batchIds, batches: batches.length, newEntries: batches.reduce((n, b) => n + b.counts.newEntries, 0), duplicates: batches.reduce((n, b) => n + b.counts.duplicates, 0),
    conflicts: batches.reduce((n, b) => n + b.counts.conflicts, 0), errors: batches.reduce((n, b) => n + b.counts.errors, 0),
    closed: cycles.filter(c => c.status === 'closed').length, open: cycles.filter(c => c.status === 'open').length, incomplete: cycles.filter(c => c.status === 'incomplete').length,
    approx: cycles.filter(c => ['closing-order', 'day-symbol'].includes(c.granularity)).length,
    riskKnown: cycles.filter(c => c.risk.amountVND !== undefined).length, reviewed: cycles.filter(c => c.overlay?.reviewStatus === 'reviewed').length,
    completeCosts: cycles.filter(c => c.costCompleteness === 'complete').length, cycleCount: cycles.length,
    netVND: knownEvents.length ? sum(knownEvents.map(e => e.netVND!)) : undefined, knownEvents: knownEvents.length, eventCount: events.length,
    from: dates[0], to: dates.at(-1), shadowed: replay.cycles.filter(c => c.shadowed && c.sourceBatchIds.some(id => batchIds.includes(id))).length,
    warnings: batches.flatMap(b => b.warnings),
  };
}
export type ImportSummaryVM = ReturnType<typeof importSummary>;
export function sourceImpact(before: ReplayResult, after: ReplayResult) {
  const active = (r: ReplayResult) => r.events.filter(e => !e.shadowed && e.netVND !== undefined);
  const coverage = (r: ReplayResult) => r.cycles.filter(c => !c.shadowed).length;
  return { beforeNet: sum(active(before).map(e => e.netVND!)), afterNet: sum(active(after).map(e => e.netVND!)), beforeCount: coverage(before), afterCount: coverage(after), shadowed: after.cycles.filter(c => c.shadowed).length };
}
export function riskOverlay(cycle: Cycle, batch: ImportBatch, amount?: string, stop?: string) {
  return { overlayId: crypto.randomUUID(), anchorFillIds: cycle.sourceFillIds, state: 'attached' as const, attachedTradeId: cycle.tradeId, mistakeTags: [], reviewStatus: 'needs-review' as const,
    ...(amount ? { riskOverrideVND: dec(D(amount)) } : {}), ...(stop ? { stopLossPrice: stop, stopOrigin: 'confirmed-initial' as const } : {}), updatedAt: batch.createdAt };
}

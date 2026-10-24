import { replayLedger } from '../application/replayLedger';
import { dedupeMultiset, hash } from '../domain/identity';
import { accountSchema, batchSchema, type Account, type ImportBatch, type LedgerSnapshot, type ParseConfig, type TradeOverlay } from '../domain/types';
import type { ConnectorId, Parsed, SheetSample } from './types';
import { getAdapter } from './adapters';
import { positive } from '../domain/decimal';

export async function createBatch(connector: ConnectorId, sample: SheetSample, account: Account, config: ParseConfig, version: number, fileHash: string, rate: string, fixedRisk?: string): Promise<ImportBatch> {
  accountSchema.parse(account);
  positive(rate); if (fixedRisk) positive(fixedRisk); positive(account.contractMultiplier);
  positive(config.priceUnit.multiplierToCcy); if (config.qtyUnit) positive(config.qtyUnit.multiplier);
  return batchSchema.parse({ batchId: crypto.randomUUID(), accountId: account.accountId, status: 'staged', connector, reportType: getAdapter(connector).detect(sample).reportType, fileName: sample.fileName ?? sample.name, fileSha256: fileHash,
    parseConfig: { ...config, tableName: sample.name }, adapterVersion: getAdapter(connector).version, normVersion: 1, counts: { rows: sample.rows.length, newEntries: 0, duplicates: 0, conflicts: 0, errors: 0 }, warnings: [],
    fx: [{ ccy: 'VND', rateToVND: '1', source: 'default' }, ...[...new Set(['USD', 'USDT'])].map(ccy => ({ ccy, rateToVND: rate, source: 'user' })), ...(config.feeFx ?? []).filter(f => !['VND', 'USD', 'USDT'].includes(f.ccy)).map(f => ({ ...f, rateToVND: positive(f.rateToVND) }))],
    fixedRiskVND: fixedRisk, idempotencyKey: await hash([fileHash, { ...config, tableName: sample.name }, account.accountId]), ledgerVersionAtStage: version, createdAt: new Date().toISOString() });
}
export async function stageImport(parsed: Parsed, batch: ImportBatch, account: Account, data: LedgerSnapshot, overlays: TradeOverlay[] = []) {
  const fills = dedupeMultiset(parsed.fills, data.fills), cash = dedupeMultiset(parsed.cashEvents, data.cashEvents);
  const nextBatch = { ...batch, counts: { ...batch.counts, newEntries: fills.newEntries.length + cash.newEntries.length, duplicates: fills.duplicates.length + cash.duplicates.length, conflicts: fills.conflicts.length + cash.conflicts.length, errors: parsed.errors.length }, warnings: [...parsed.warnings] };
  if (parsed.errors.length) nextBatch.warnings.push({ code: 'ROW_ERRORS', severity: 'blocker', message: `${parsed.errors.length} dòng lỗi. Sửa file và nhập lại để tránh mất một phần chu kỳ.` });
  if (nextBatch.counts.conflicts) nextBatch.warnings.push({ code: 'NATIVE_ID_CONFLICT', severity: 'blocker', message: 'Cùng mã nguồn nhưng số liệu thay đổi. Đối chiếu/hoàn tác đợt cũ trước khi thay thế.' });
  const replay = await replayLedger({ ...data, accounts: data.accounts.some(a => a.accountId === account.accountId) ? data.accounts : [...data.accounts, account], batches: [...data.batches, { ...nextBatch, status: 'committed' }], fills: [...data.fills, ...fills.newEntries], cashEvents: [...data.cashEvents, ...cash.newEntries], overlays: [...data.overlays, ...overlays] });
  const warnings = [...nextBatch.warnings, ...replay.anomalies];
  for (const cycle of replay.cycles.filter(c => c.sourceBatchIds.includes(batch.batchId) && !c.shadowed)) {
    for (const code of cycle.anomalies) if (['INITIAL_STOP_UNCONFIRMED', 'TRAILED_STOP_DETECTED', 'RISK_ESTIMATED_FROM_PNL'].includes(code)) warnings.push({ code, severity: 'needs-confirmation', message: code === 'INITIAL_STOP_UNCONFIRMED' ? 'SL báo cáo chưa được xác nhận là stop ban đầu; chưa tự tính 1R.' : code === 'TRAILED_STOP_DETECTED' ? 'SL nằm ở vùng hòa vốn/có lãi; không dùng để tính 1R.' : '1R được ước lượng từ P&L, cần kiểm tra.' });
    if (cycle.netVND === undefined) warnings.push({ code: 'UNKNOWN_NET_VND', severity: 'needs-confirmation', message: 'Có chu kỳ chưa xác định Net VNĐ do thiếu phí/P&L/tỷ giá. Chưa đưa số tiền chưa biết vào tổng.' });
  }
  return { batch: nextBatch, parsed, fills, cash, replay, warnings, account, overlays };
}
export type StagedImport = Awaited<ReturnType<typeof stageImport>>;

export type ImportDraft = { parsed: Parsed; batch: ImportBatch; account: Account; overlays: TradeOverlay[] };
const firstTime = (d: ImportDraft) => [...d.parsed.fills.map(f => f.role === 'fill' ? f.tsUtc : f.role === 'reported-position' ? f.openTsUtc : f.closeTsUtc), ...d.parsed.cashEvents.map(e => e.tsUtc)].sort()[0] ?? d.batch.createdAt;
export async function stageQueue(drafts: ImportDraft[], snapshot: { version: number; data: LedgerSnapshot }): Promise<StagedImport[]> {
  let { data, version } = snapshot;
  const stages: StagedImport[] = [];
  for (const draft of [...drafts].sort((a, b) => firstTime(a).localeCompare(firstTime(b)) || a.batch.fileName!.localeCompare(b.batch.fileName!))) {
    const batch = { ...draft.batch, ledgerVersionAtStage: version };
    const stage = await stageImport(draft.parsed, batch, draft.account, data, draft.overlays); stages.push(stage);
    const already = data.batches.some(b => b.status === 'committed' && b.accountId === batch.accountId && b.idempotencyKey === batch.idempotencyKey);
    if (!already) {
      data = { ...data, accounts: data.accounts.some(a => a.accountId === draft.account.accountId) ? data.accounts : [...data.accounts, draft.account], batches: [...data.batches, { ...stage.batch, status: 'committed' }], fills: [...data.fills, ...stage.fills.newEntries], cashEvents: [...data.cashEvents, ...stage.cash.newEntries], overlays: [...data.overlays, ...draft.overlays] };
      version++;
    }
  }
  return stages;
}

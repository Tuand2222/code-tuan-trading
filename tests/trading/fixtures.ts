import type { Account, Fill, ImportBatch, LedgerSnapshot, TradeFill } from '../../lib/trading/domain/types';
import { bookKey, fillKey } from '../../lib/trading/domain/identity';
export function account(patch: Partial<Account> = {}): Account {
  return { accountId: 'a', accountKey: 'test-account', label: 'Test', platform: 'GENERIC', market: 'stock', baseCcy: 'VND', quoteCcy: 'VND', pnlModel: 'linear', contractMultiplier: '1', costBasis: 'fifo', allowsShort: false, bookMode: 'netting', sourceTimezone: 'Asia/Ho_Chi_Minh', openingBalances: [], ...patch };
}
export function batch(id = 'b', patch: Partial<ImportBatch> = {}): ImportBatch {
  return { batchId: id, accountId: 'a', status: 'committed', connector: 'generic-template', reportType: 'fills', adapterVersion: '1', normVersion: 1, counts: { rows: 0, newEntries: 0, duplicates: 0, conflicts: 0, errors: 0 }, warnings: [], fx: [], idempotencyKey: id, ledgerVersionAtStage: 0, createdAt: '2026-01-01T00:00:00.000Z',
    parseConfig: { templateFingerprint: 'test', platform: 'GENERIC', reportType: 'fills', granularity: 'fill', columnMapping: {}, decimalSeparator: '.', thousandSeparator: ',', sourceTimezone: 'UTC', priceUnit: { multiplierToCcy: '1', confirmedBy: 'user', crossCheck: 'passed' }, pnlBasis: 'gross', costCompleteness: 'complete', openingPositionsConfirmed: true }, ...patch };
}
export async function fill(id: string, side: 'buy' | 'sell', qty: string, price: string, tsUtc: string, patch: Partial<TradeFill> = {}, acct = account()): Promise<TradeFill> {
  const f: TradeFill = { fillId: id, batchId: 'b', accountId: acct.accountId, bookKey: '', symbol: 'FPT', rootSymbol: 'FPT', nativeId: id, dedupeKey: '', dedupeOcc: 1, normVersion: 1, active: true, raw: {}, role: 'fill', tsUtc, side, qty, price, costs: [], ...patch };
  f.bookKey = bookKey(acct, f); f.dedupeKey = await fillKey(f, acct); return f;
}
export async function golden(acct = account()): Promise<TradeFill[]> {
  return Promise.all([fill('1', 'buy', '500', '100', '2026-01-01T00:00:00Z', {}, acct), fill('2', 'buy', '500', '120', '2026-01-02T00:00:00Z', {}, acct),
    fill('3', 'sell', '400', '130', '2026-01-03T00:00:00Z', {}, acct), fill('4', 'sell', '600', '130', '2026-02-01T00:00:00Z', {}, acct)]);
}
export function snapshot(fills: Fill[], acct = account(), batches = [batch()]): LedgerSnapshot { return { accounts: [acct], batches, fills, cashEvents: [], overlays: [], settings: {} }; }

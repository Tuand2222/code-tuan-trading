import { z } from 'zod';
import { DecimalValue, dec, D } from '../domain/decimal';
import { bookKey, fillKey, hash } from '../domain/identity';
import type { Account, ImportBatch, LedgerSnapshot, TradeFill, TradeOverlay } from '../domain/types';
import type { DexieLedgerStore } from './DexieLedgerStore';

const legacySchema = z.object({
  id: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), symbol: z.string().min(1), side: z.enum(['Buy', 'Sell']),
  pnl: z.number().finite(), risk: z.number().finite().nonnegative(), discipline: z.number().min(0).max(100), durationMin: z.number().finite().nonnegative(),
  fees: z.number().finite().nonnegative().optional(), setup: z.string(), note: z.string(), psychology: z.string(),
  market: z.string().optional(), source: z.string().optional(), accountId: z.string().nullable().optional(),
}).passthrough();
export type LegacyTrade = z.infer<typeof legacySchema>;
const fromNumber = (n: number) => dec(new DecimalValue(String(n)));
export async function prepareLegacyMigration(input: unknown, scopeKey: string): Promise<LedgerSnapshot> {
  const trades = z.array(legacySchema).parse(input);
  if (new Set(trades.map(t => t.id)).size !== trades.length) throw new Error('DUPLICATE_LEGACY_ID');
  const data: LedgerSnapshot = { accounts: [], batches: [], fills: [], cashEvents: [], overlays: [], settings: { legacyScope: scopeKey, legacyMigrationVersion: 1 } };
  const now = new Date().toISOString();
  for (const trade of [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const market = trade.market === 'Chứng khoán' ? 'stock' : trade.market === 'Crypto' ? 'crypto' : trade.market === 'Forex' ? 'forex' : 'commodity';
    const accountId = await hash(['legacy', scopeKey, trade.accountId ?? 'device', market]);
    let account = data.accounts.find(a => a.accountId === accountId);
    if (!account) {
      account = { accountId, accountKey: `legacy:${scopeKey}:${trade.accountId ?? 'device'}:${market}`, label: 'Nhật ký cũ (dữ liệu tổng hợp)', platform: 'MANUAL', market, baseCcy: 'VND', quoteCcy: 'VND',
        pnlModel: 'reported', contractMultiplier: '1', costBasis: 'fifo', allowsShort: true, bookMode: 'hedging', sourceTimezone: 'Asia/Ho_Chi_Minh', openingBalances: [] } satisfies Account;
      data.accounts.push(account);
    }
    const batchId = await hash(['legacy-batch', scopeKey, trade.id]);
    const batch: ImportBatch = { batchId, accountId, status: 'committed', connector: 'legacy-migration', reportType: 'fills', adapterVersion: '1', normVersion: 1,
      parseConfig: { templateFingerprint: 'legacy-v1', platform: 'MANUAL', reportType: 'fills', granularity: 'fill', columnMapping: {}, decimalSeparator: '.', thousandSeparator: '', sourceTimezone: 'Asia/Ho_Chi_Minh',
        priceUnit: { multiplierToCcy: '1', confirmedBy: 'report', crossCheck: 'n/a' }, pnlBasis: 'net', costCompleteness: trade.fees === undefined ? 'partial' : 'complete', openingPositionsConfirmed: true },
      counts: { rows: 1, newEntries: 2, duplicates: 0, conflicts: 0, errors: 0 }, warnings: [{ code: 'LEGACY_SYNTHETIC', severity: 'info', message: 'Giá/khối lượng chuẩn hóa kỹ thuật; không phải lịch sử khớp lệnh thật. Giờ đóng quy ước 12:00 theo ngày cũ.' }],
      fx: [{ ccy: 'VND', rateToVND: '1', source: 'user' }], idempotencyKey: batchId, ledgerVersionAtStage: 0, createdAt: now, committedAt: now };
    data.batches.push(batch);
    const close = new Date(`${trade.date}T12:00:00+07:00`);
    if (Number.isNaN(close.getTime()) || close.toISOString().slice(0, 10) !== trade.date) throw new Error('INVALID_LEGACY_DATE');
    const open = new Date(close.getTime() - trade.durationMin * 60000);
    const positionId = trade.id;
    const raw = { legacy: JSON.stringify(trade), legacyId: trade.id, legacyNetVND: fromNumber(trade.pnl), legacyFeesKnown: String(trade.fees !== undefined), datePrecision: 'day', priceQuantitySynthetic: 'true' };
    const base = { batchId, accountId, bookKey: bookKey(account, { symbol: trade.symbol, positionId }), symbol: trade.symbol, rootSymbol: trade.symbol, positionId,
      active: true, synthetic: 'legacy-migration' as const, normVersion: 1, raw, role: 'fill' as const, qty: '1', price: '1', dedupeOcc: 1, dedupeKey: '' };
    const first: TradeFill = { ...base, fillId: crypto.randomUUID(), nativeId: `${trade.id}:open`, tsUtc: open.toISOString(), seq: '0', side: trade.side === 'Buy' ? 'buy' : 'sell', costs: [] };
    const last: TradeFill = { ...base, fillId: crypto.randomUUID(), nativeId: `${trade.id}:close`, tsUtc: close.toISOString(), seq: '1', side: trade.side === 'Buy' ? 'sell' : 'buy',
      costs: trade.fees === undefined ? [{ kind: 'commission', ccy: 'VND', origin: 'missing' }] : [{ kind: 'commission', amount: fromNumber(trade.fees), ccy: 'VND', origin: 'reported' }],
      reportedRealized: { gross: trade.fees === undefined ? undefined : dec(D(fromNumber(trade.pnl)).plus(D(fromNumber(trade.fees)))), net: fromNumber(trade.pnl), ccy: 'VND' } };
    first.dedupeKey = await fillKey(first, account); last.dedupeKey = await fillKey(last, account); data.fills.push(first, last);
    const overlay: TradeOverlay = { overlayId: await hash(['legacy-overlay', scopeKey, trade.id]), anchorFillIds: [first.fillId, last.fillId], state: 'attached', setupTag: trade.setup,
      mistakeTags: [], notes: trade.note, reviewStatus: 'reviewed', disciplineScore: trade.discipline, updatedAt: now,
      riskOverrideVND: trade.risk > 0 ? fromNumber(trade.risk) : undefined };
    data.overlays.push(overlay);
  }
  return data;
}
export async function migrateLegacyStorage(store: DexieLedgerStore, storage: Pick<Storage, 'getItem'>, key: string, expected: number) {
  if (!key.startsWith('tuan-trader-trades')) throw new Error('INVALID_LEGACY_SCOPE');
  const suffix = key.slice('tuan-trader-trades'.length), demoKey = `tuan-trader-demo-mode-v1${suffix}`;
  if (storage.getItem(demoKey) !== 'false') throw new Error('LEGACY_DATA_ORIGIN_REQUIRES_CONFIRMATION');
  const original = storage.getItem(key); if (original === null) return { migrated: false, count: 0 };
  const input: unknown = JSON.parse(original), data = await prepareLegacyMigration(input, key);
  const rawKeys = Object.fromEntries([key, demoKey, `tuan-trader-notes${suffix}`, 'tuan-trader-system-range-v1', 'tuan-trader-valuation-lab-v4'].map(k => [k, storage.getItem(k)]));
  data.settings.legacyStorage = rawKeys;
  // The original bytes and the new ledger are written together. Never remove localStorage.
  await store.importLegacy(data, JSON.stringify({ keys: rawKeys }), expected);
  return { migrated: true, count: data.overlays.length };
}

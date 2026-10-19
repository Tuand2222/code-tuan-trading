import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { account, batch, fill, snapshot } from './fixtures';
import { getAdapter } from '../../lib/trading/import/adapters';
import { readTables } from '../../lib/trading/import/tableReader';
import { createBatch, stageImport, stageQueue } from '../../lib/trading/import/stage';
import { importSummary, riskOverlay } from '../../lib/trading/import/presentation';
import { replayLedger } from '../../lib/trading/application/replayLedger';
import { replayBook } from '../../lib/trading/domain/replayBook';
import { hash, bookKey } from '../../lib/trading/domain/identity';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import { sum } from '../../lib/trading/domain/decimal';
import type { Fill, CashEvent } from '../../lib/trading/domain/types';
const stores: DexieLedgerStore[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.delete(); });
const db = () => { const s = new DexieLedgerStore('import-' + crypto.randomUUID()); stores.push(s); return s; };
const table = (values: Record<string, string>) => ({ name: 'synthetic fixture', headers: Object.keys(values), rows: [{ row: 2, values }] });
describe('R3/R4 pipeline integration', () => {
  it('reads MT5 HTML sections with repeated Time/Price headers without executing page scripts', () => {
    const html = '<html><script>throw new Error("must never execute")</script><table><tr><td>Positions</td></tr><tr><td>Time</td><td>Position</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>Time</td><td>Price</td><td>Profit</td></tr><tr><td>2026.10.01 09:00:00</td><td>100</td><td>EURUSD</td><td>buy</td><td>1</td><td>1.1</td><td>2026.10.02 09:00:00</td><td>1.11</td><td>1000</td></tr><tr><td>Deals</td></tr><tr><td>Time</td><td>Deal</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>Profit</td></tr><tr><td>2026.10.01 09:00:00</td><td>101</td><td>EURUSD</td><td>buy</td><td>1</td><td>1.1</td><td>0</td></tr></table></html>';
    const sheets = readTables(new TextEncoder().encode(html).buffer, 'synthetic.html');
    expect(sheets).toHaveLength(2); expect(sheets[0].headers).toContain('Time__2'); expect(sheets[0].headers).toContain('Price__2');
    expect(sheets[0].rows).toHaveLength(1); expect(sheets[1].rows).toHaveLength(1);
  });
  it('uses cached spreadsheet formula values without evaluating formulas', () => {
    const wb = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([['Symbol', 'Quantity', 'Price'], ['FPT', 100, 12]]);
    sheet.C2.f = '1+99999'; XLSX.utils.book_append_sheet(wb, sheet, 'Cached');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    expect(readTables(bytes, 'cached.xlsx')[0].rows[0].values.Price).toBe('12');
  });
  it('reads numeric Excel values and serial dates independently of decimal separator', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ngày khớp', 'Mã CK', 'Mua/Bán', 'Khối lượng', 'Giá', 'Phí', 'Giá trị'], [46300.5, 'FPT', 'Mua', 100, 25.4, 2540, 2540000]]), 'Lệnh khớp');
    const bytes: Uint8Array = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const sheet = readTables(bytes as unknown as ArrayBuffer, 'synthetic.xlsx')[0], a = getAdapter('vn-stock-fills');
    const parsed = await a.parse(sheet.rows, { account: account({ platform: 'VN_STOCK' }), config: { ...batch().parseConfig, decimalSeparator: ',', thousandSeparator: '.', costCompleteness: 'partial', columnMapping: a.detect(sheet).columnMapping, priceUnit: { multiplierToCcy: '1000', confirmedBy: 'user', crossCheck: 'passed' } }, batchId: 'b' });
    expect(parsed.errors).toEqual([]); expect(parsed.fills[0]).toMatchObject({ price: '25400', qty: '100' });
  });
  it('derives combined selling costs without also adding tax, keeping purchase fees unknown', async () => {
    const a = getAdapter('vn-stock-realized-pl');
    const sheet = table({ 'Mã CK': 'FPT', 'Ngày bán': '01/10/2026', 'Khối lượng': '100', 'Giá vốn': '25000', 'Giá bán': '26000', 'Lãi/Lỗ': '100000', 'Giá trị bán': '2600000', 'Giá trị ròng': '2595000' });
    const parsed = await a.parse(sheet.rows, { account: account({ platform: 'VN_STOCK' }), batchId: 'b', config: { ...batch().parseConfig, columnMapping: a.detect(sheet).columnMapping, costCompleteness: 'partial' } });
    expect(parsed.errors).toEqual([]); expect(parsed.fills[0].costs).toHaveLength(2);
    expect(parsed.fills[0].costs).toContainEqual(expect.objectContaining({ amount: '5000', origin: 'derived' }));
    expect(parsed.fills[0].costs).toContainEqual(expect.objectContaining({ amount: undefined, origin: 'missing' }));
  });
  it('converts base-asset fees at the fill price and does not invent BNB FX', async () => {
    const a = getAdapter('binance-trade-history'), acct = account({ platform: 'BINANCE', market: 'crypto', baseCcy: 'USDT', quoteCcy: 'USDT', allowsShort: true });
    for (const feeCoin of ['BTC', 'BNB']) {
      const sheet = table({ Symbol: 'BTCUSDT', 'Date(UTC)': '2026-10-01 09:00:00', Side: 'BUY', Quantity: '0.1', Price: '60000', Fee: '0.0001', 'Fee Coin': feeCoin });
      const parsed = await a.parse(sheet.rows, { account: acct, batchId: 'b', config: { ...batch().parseConfig, columnMapping: a.detect(sheet).columnMapping, costCompleteness: 'partial' } });
      expect(parsed.errors).toEqual([]);
      if (feeCoin === 'BTC') expect(parsed.fills[0].costs[0]).toMatchObject({ ccy: 'USDT', amount: '6', origin: 'derived' });
      else { expect(parsed.fills[0].costs[0].rateToVND).toBeUndefined(); expect(parsed.warnings.some(w => w.code === 'MISSING_FEE_FX')).toBe(true); }
    }
  });
  it('requires timezone-qualified generic timestamps', async () => {
    const a = getAdapter('generic-template'), sheet = table({ timestamp_utc: '2026-10-01 09:00:00', symbol: 'FPT', side: 'buy', quantity: '1', price: '1', fee: '0', fee_currency: 'VND', source_id: '1', account_key: 'test-account' });
    const parsed = await a.parse(sheet.rows, { account: account(), batchId: 'b', config: { ...batch().parseConfig, columnMapping: a.detect(sheet).columnMapping } });
    expect(parsed.errors[0].message).toContain('ISO');
  });
  it('sorts file batches chronologically, saves, skips duplicates and previews rollback dependencies', async () => {
    const s = db(), acct = account(), a = getAdapter('generic-template'), initial = await s.snapshot();
    const inputs = [];
    for (const [side, time, price, id] of [['sell', '2026-10-02T02:00:00Z', '26000', 'out'], ['buy', '2026-10-01T02:00:00Z', '25400', 'in']]) {
      const sheet = table({ timestamp_utc: time, symbol: 'FPT', side, quantity: '100', price, fee: '1000', fee_currency: 'VND', source_id: id, account_key: 'test-account' });
      sheet.name = id + '.csv';
      const config = { ...batch().parseConfig, columnMapping: a.detect(sheet).columnMapping };
      const b = await createBatch(a.id, sheet, acct, config, 0, await hash(sheet), '25500');
      inputs.push({ batch: b, account: acct, parsed: await a.parse(sheet.rows, { account: acct, config, batchId: b.batchId }), overlays: [] });
    }
    const stages = await stageQueue(inputs, initial);
    expect(stages.map(q => q.batch.fileName)).toEqual(['in.csv', 'out.csv']);
    for (const stage of stages) await s.commitBatch({ batch: stage.batch, fills: stage.parsed.fills, cashEvents: [], accounts: [acct], confirmedWarnings: stage.warnings.map(w => w.code) }, stage.batch.ledgerVersionAtStage);
    const saved = await s.snapshot(), replay = await replayLedger(saved.data);
    expect(replay.cycles).toHaveLength(1); expect(replay.cycles[0].netVND).toBe('58000');
    expect(importSummary(saved.data, replay, stages.map(q => q.batch.batchId))).toMatchObject({ newEntries: 2, closed: 1, netVND: '58000', reviewed: 0 });
    const again = await stageQueue(inputs, saved);
    expect(again.flatMap(q => q.fills.newEntries)).toHaveLength(0);
    for (const stage of again) expect((await s.commitBatch({ batch: stage.batch, fills: stage.parsed.fills, cashEvents: [], accounts: [acct] }, stage.batch.ledgerVersionAtStage)).newEntries).toBe(0);
    await s.rollbackBatch(stages[1].batch.batchId, saved.version);
    expect((await replayLedger((await s.snapshot()).data)).openPositions[0].qty).toBe('100');
  });
  it('blocks row errors without writing any account or batch', async () => {
    const s = db(), acct = account(), b = batch('b', { status: 'staged' });
    const stage = await stageImport({ fills: [], cashEvents: [], warnings: [], errors: [{ row: 2, values: {}, message: 'missing qty' }] }, b, acct, (await s.snapshot()).data);
    await expect(s.commitBatch({ batch: stage.batch, fills: [], cashEvents: [], accounts: [acct] }, 0)).rejects.toThrow('UNRESOLVED_ROWS');
    expect(await s.accounts.count()).toBe(0); expect(await s.batches.count()).toBe(0);
  });
  it('shadows only complete shared-ID positions, preserves audit amounts and reverses preference', async () => {
    const acct = account(), rows = await Promise.all([fill('buy', 'buy', '2', '100', '2026-01-01T00:00:00.000Z', { positionId: 'p' }), fill('sell', 'sell', '2', '110', '2026-01-02T00:00:00.000Z', { positionId: 'p' })]);
    const report: Fill = { ...rows[1], fillId: 'report', nativeId: 'report', role: 'reported-position', openTsUtc: rows[0].tsUtc, closeTsUtc: rows[1].tsUtc, direction: 'LONG', openPrice: '100', closePrice: '110', qty: '2', reportedGross: '20', ccy: 'VND', stopOrigin: 'unknown' };
    const replay = await replayBook([...rows, report], acct, [batch()]);
    expect(replay.cycles.filter(c => c.shadowed)).toHaveLength(1); expect(replay.cycles.find(c => c.shadowed)?.grossVND).toBe('20');
    expect(sum(replay.events.filter(e => !e.shadowed).map(e => e.netVND!))).toBe('20');
    const preferred = await replayBook([...rows, report], acct, [batch()], [], [], 'prefer-reports');
    expect(preferred.cycles.find(c => c.granularity === 'fill')?.shadowed).toBe(true);
    expect(sum(preferred.events.filter(e => !e.shadowed).map(e => e.netVND!))).toBe('20');
    const partial = { ...report, qty: '3' };
    expect((await replayBook([...rows, partial], acct, [batch()])).anomalies.some(w => w.code === 'POSSIBLE_CROSS_REPORT_OVERLAP' && w.severity === 'blocker')).toBe(true);
  });
  it('does not auto-shadow by time range and resolves explicit source choices without deleting evidence', async () => {
    const acct = account(), rows = await Promise.all([fill('b', 'buy', '1', '100', '2026-01-01T00:00:00.000Z'), fill('s', 'sell', '1', '110', '2026-01-02T00:00:00.000Z')]);
    const report: Fill = { ...rows[1], fillId: 'r', role: 'reported-close', closeTsUtc: rows[1].tsUtc, qty: '1', avgCostPrice: '100', closePrice: '110', reportedGross: '10', ccy: 'VND', granularity: 'day-symbol' };
    const pending = await replayBook([...rows, report], acct, [batch()]); expect(pending.anomalies.some(w => w.code === 'POSSIBLE_CROSS_REPORT_OVERLAP')).toBe(true);
    for (const preference of ['prefer-fills', 'prefer-reports'] as const) {
      const r = await replayBook([...rows, report], acct, [batch()], [], [], preference);
      expect(r.cycles).toHaveLength(2); expect(r.cycles.filter(c => !c.shadowed)).toHaveLength(1); expect(sum(r.events.filter(e => !e.shadowed).map(e => e.netVND!))).toBe('10');
    }
  });
  it('requires an explicit verified cash reconciliation link to avoid a second commission charge', async () => {
    const acct = account(), f = await fill('x', 'buy', '1', '100', '2026-01-01T00:00:00.000Z', { costs: [{ kind: 'commission', ccy: 'VND', origin: 'reported', amount: '2' }] });
    const e: CashEvent = { eventId: 'cash', batchId: 'c', accountId: acct.accountId, active: true, tsUtc: f.tsUtc, kind: 'commission', amount: '2', ccy: 'VND', symbol: 'FPT', dedupeKey: 'cash', dedupeOcc: 1, normVersion: 1, raw: {} };
    const unlinked = await replayBook([f], acct, [batch(), batch('c')], [e]); expect(unlinked.anomalies.some(w => w.code === 'POSSIBLE_DUPLICATE_CASH_COST')).toBe(true);
    const linked = await replayBook([f], acct, [batch(), batch('c')], [{ ...e, reconcilesFillId: f.fillId }]); expect(linked.events).toHaveLength(0); expect(linked.anomalies).toEqual([]);
    expect((await replayBook([f], acct, [batch(), batch('c')], [{ ...e, amount: '3', reconcilesFillId: f.fillId }])).anomalies.some(w => w.code === 'INVALID_CASH_LINK')).toBe(true);
  });
  it('stores risk overlays separately from normalized raw fills', async () => {
    const acct = account(), rows = await Promise.all([fill('b', 'buy', '1', '100', '2026-01-01T00:00:00.000Z'), fill('s', 'sell', '1', '110', '2026-01-02T00:00:00.000Z')]);
    const data = snapshot(rows), before = await replayLedger(data), overlay = riskOverlay(before.cycles[0], batch(), '5');
    const after = await replayLedger({ ...data, overlays: [overlay] });
    expect(after.cycles[0].risk).toMatchObject({ amountVND: '5', origin: 'user-entered' });
    expect(await hash(data.fills)).toBe(await hash(rows)); expect(after.cycles[0].overlay?.reviewStatus).toBe('needs-review');
    expect(bookKey(acct, rows[0])).toBe(rows[0].bookKey);
  });
});

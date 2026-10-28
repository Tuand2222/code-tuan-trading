import { describe, expect, it } from 'vitest';
import { account, batch } from './fixtures';
import { adapters, getAdapter } from '../../lib/trading/import/adapters';
import { readTables, errorCSV } from '../../lib/trading/import/tableReader';
import { parseTime } from '../../lib/trading/import/time';
import type { ConnectorId, SheetSample } from '../../lib/trading/import/types';
import { dedupeMultiset } from '../../lib/trading/domain/identity';
const fixtures: Record<ConnectorId, Record<string, string>> = {
  'vn-stock-fills': { 'Mã CK': 'FPT', 'Ngày khớp': '01/10/2026 09:00:00', 'Mua/Bán': 'Mua', 'Khối lượng': '100', 'Giá': '25400', 'Phí': '2540', 'Giá trị': '2540000' },
  'vn-stock-realized-pl': { 'Mã CK': 'FPT', 'Ngày bán': '02/10/2026', 'Khối lượng': '100', 'Giá vốn': '25400', 'Giá bán': '26000', 'Lãi/Lỗ': '60000', 'Phí mua': '2540', 'Phí bán': '2600', 'Thuế': '2600' },
  'mt5-positions': { Position: '100', Symbol: 'EURUSD', Type: 'buy', Volume: '1', Time: '2026.10.01 09:00:00', Time__2: '2026.10.02 09:00:00', Price: '1.10', Price__2: '1.11', 'S / L': '1.09', Commission: '-7', Swap: '-2', Profit: '1000' },
  'mt5-deals': { Deal: '101', Symbol: 'EURUSD', Type: 'buy', Direction: 'in', Volume: '1', Time: '2026.10.01 09:00:00', Price: '1.10', Commission: '-3.5', Swap: '0', Profit: '0' },
  'binance-position-history': { Symbol: 'BTCUSDT', 'Position Side': 'LONG', Opened: '2026-10-01 09:00:00', Closed: '2026-10-02 09:00:00', 'Entry Price': '60000', 'Avg Close Price': '61000', 'Closed Quantity': '0.1', 'Closing PNL': '100', Fee: '2', 'Fee Coin': 'USDT' },
  'binance-trade-history': { Symbol: 'BTCUSDT', 'Date(UTC)': '2026-10-01 09:00:00', Side: 'BUY', Quantity: '0.1', Price: '60000', Fee: '2', 'Fee Coin': 'USDT' },
  'binance-transaction-history': { Time: '2026-10-01 09:00:00', Type: 'FUNDING_FEE', Asset: 'USDT', Amount: '-2', Symbol: 'BTCUSDT', TranId: '9001' },
  'generic-template': { timestamp_utc: '2026-10-01T09:00:00Z', symbol: 'FPT', side: 'buy', quantity: '100', price: '25400', fee: '2540', fee_currency: 'VND', source_id: 'g1', account_key: 'test-account' },
};
const sample = (values: Record<string, string>): SheetSample => ({ name: 'synthetic fixture', headers: Object.keys(values), rows: [{ row: 2, values }] });
describe('R3 synthetic adapter fixtures (not broker-certified)', () => {
  for (const adapter of adapters) for (const variant of ['original', 'comma-decimal', 'extra-column']) {
    it(`${adapter.id}: ${variant}`, async () => {
      const values = { ...fixtures[adapter.id] };
      if (variant === 'comma-decimal') for (const key of Object.keys(values)) if (/^-?\d+\.\d+$/.test(values[key])) values[key] = values[key].replace('.', ',');
      if (variant === 'extra-column') values['Ghi chú riêng'] = '=HYPERLINK("evil")';
      const sheet = sample(values), detected = adapter.detect(sheet);
      expect(detected.confidence).toBe(1);
      const acct = account({ platform: adapter.platform, baseCcy: adapter.platform === 'MT5' ? 'USD' : adapter.platform === 'BINANCE' ? 'USDT' : 'VND' });
      const config = { ...batch().parseConfig, platform: adapter.platform, columnMapping: detected.columnMapping, costCompleteness: 'partial' as const, decimalSeparator: variant === 'comma-decimal' ? ',' as const : '.' as const, thousandSeparator: '' as const };
      const result = await adapter.parse(sheet.rows, { account: acct, config, batchId: 'b' });
      if (adapter.id === 'generic-template' && variant === 'comma-decimal') { expect(result.errors[0]?.message).toContain('Mẫu chuẩn dùng dấu'); return; }
      expect(result.errors).toEqual([]); expect(result.fills.length + result.cashEvents.length).toBe(1);
      if (variant === 'extra-column') expect((result.fills[0] ?? result.cashEvents[0]).raw['Ghi chú riêng']).toContain('HYPERLINK');
      const rows = [...result.fills, ...result.cashEvents]; expect(dedupeMultiset(rows, rows).newEntries).toHaveLength(0);
      if (adapter.id === 'mt5-positions') expect(result.fills[0].costs.map(c => c.amount)).toEqual(['7', '2']);
      if (adapter.id === 'binance-transaction-history') expect(result.cashEvents[0].amount).toBe('2');
    });
  }
  it('rejects missing quantity instead of substituting Max Open Interest', async () => {
    const a = getAdapter('binance-position-history'), values = { ...fixtures[a.id], 'Closed Quantity': '', 'Max Open Interest': '1' }, s = sample(values);
    const result = await a.parse(s.rows, { account: account({ platform: 'BINANCE' }), config: { ...batch().parseConfig, costCompleteness: 'partial', columnMapping: a.detect(s).columnMapping }, batchId: 'b' });
    expect(result.errors).toHaveLength(1); expect(result.fills).toHaveLength(0);
  });
  it('keeps malformed numbers as errors and verifies stock units', async () => {
    const a = getAdapter('vn-stock-fills');
    for (const value of ['NaN', '25.4']) {
      const s = sample({ ...fixtures[a.id], 'Giá': value });
      const result = await a.parse(s.rows, { account: account({ platform: 'VN_STOCK' }), config: { ...batch().parseConfig, costCompleteness: 'partial', columnMapping: a.detect(s).columnMapping }, batchId: 'b' });
      expect(result.errors).toHaveLength(1);
    }
  });
  it('reads BOM / semicolon / duplicate headers and escapes CSV formulas', () => {
    const data = new TextEncoder().encode('\uFEFFTime;Price;Time;Price\n2026-01-01;1;2026-01-02;2');
    const s = readTables(data.buffer, 'fixture.csv')[0];
    expect(s.headers).toEqual(['Time', 'Price', 'Time__2', 'Price__2']);
    expect(errorCSV([{ row: 1, message: 'bad', values: { Note: '=1+1' } }])).toContain("'=1+1");
  });
  it('rejects invalid dates and ambiguous DST rather than guessing', () => {
    expect(parseTime('01/10/2026 09:00:00', 'Asia/Ho_Chi_Minh')).toBe('2026-10-01T02:00:00.000Z');
    expect(() => parseTime('2026-11-01 01:30:00', 'America/New_York')).toThrow();
    expect(() => parseTime('31/02/2026', 'UTC')).toThrow();
  });
});

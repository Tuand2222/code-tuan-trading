import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import baseline from './fixtures/legacy-baseline.json';
import { prepareLegacyMigration, migrateLegacyStorage } from '../../lib/trading/storage/migration';
import { replayLedger } from '../../lib/trading/application/replayLedger';
import { replayBook } from '../../lib/trading/domain/replayBook';
import { metricsVM, calendarVM, feeImpact } from '../../lib/trading/selectors';
import { tradeDims } from '../../lib/trading/selectors/dimensions';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import { storageHealth, backupReminder } from '../../lib/trading/storage/browserStorage';
import { sum } from '../../lib/trading/domain/decimal';
import { fill, account, batch, golden } from './fixtures';
import type { Fill, TradeFill } from '../../lib/trading/domain/types';

describe('R1/R2 golden acceptance cases', () => {
  it('replays an explicit corporate split and basis adjustment without synthetic P&L', async () => {
    const rows = [await fill('1', 'buy', '100', '100', '2026-01-01T00:00:00Z'),
      await fill('adjust', 'buy', '1', '1', '2026-01-02T00:00:00Z', { synthetic: 'manual', adjustment: { quantityFactor: '2', basisDelta: '2000', reason: 'Điều chỉnh do người dùng xác nhận' } }),
      await fill('2', 'sell', '200', '70', '2026-01-03T00:00:00Z')];
    const r = await replayBook(rows, account(), [batch()]);
    expect(r.events).toHaveLength(1); expect(r.cycles[0]).toMatchObject({ netVND: '2000', qtyOpened: '200', avgEntry: '60' });
    expect(r.cycles[0].adjustments?.[0].fillId).toBe('adjust');
  });
  it('compares all 24 metrics against the frozen production 20-trade fixture', async () => {
    const result = await replayLedger(await prepareLegacyMigration(baseline.trades, 'test-only-production-fixture'));
    const metrics = metricsVM(result);
    for (const [id, expected] of Object.entries(baseline.metrics)) {
      const metric = metrics[id]; expect(metric.status, id).toBe('ok');
      if (metric.status === 'ok') expect(metric.value, id).toBeCloseTo(['avgLoss', 'grossLoss'].includes(id) ? -expected : expected, 7);
    }
  });
  it('reconciles partial P&L only after the full cycle closes', async () => {
    const f = await golden(); f[2].reportedRealized = { gross: '8000', ccy: 'VND' }; f[3].reportedRealized = { gross: '12000', ccy: 'VND' };
    const r = await replayBook(f, account(), [batch()]);
    expect(r.cycles[0].reconciliation).toBe('reconciled'); expect(r.anomalies.some(a => a.code === 'REPORTED_PNL_MISMATCH')).toBe(false);
  });
  it('keeps two identical no-ID fills after overlapping imports and flags amended costs', async () => {
    const s = new DexieLedgerStore(`acceptance-${crypto.randomUUID()}`);
    try {
      const f = await fill('x', 'buy', '1', '100', '2026-01-01T00:00:00Z', { nativeId: undefined });
      await s.commitBatch({ batch: batch('b', { status: 'staged' }), accounts: [account()], fills: [f, { ...f, fillId: 'y' }], cashEvents: [] }, 0);
      const copies = [f, { ...f, fillId: 'z' }].map(f => ({ ...f, batchId: 'c', qty: '1.0', price: '100.00', tsUtc: '2026-01-01T07:00:00+07:00' }));
      expect((await s.commitBatch({ batch: batch('c', { status: 'staged', ledgerVersionAtStage: 1 }), fills: copies, cashEvents: [] }, 1)).newEntries).toBe(0);
      const amended = { ...copies[0], batchId: 'd', costs: [{ kind: 'commission' as const, amount: '1', ccy: 'VND', origin: 'reported' as const }] };
      await expect(s.commitBatch({ batch: batch('d', { status: 'staged', ledgerVersionAtStage: 2 }), fills: [amended], cashEvents: [] }, 2)).rejects.toThrow('IMPORT_CONFLICT');
    } finally { await s.delete(); }
  });
  it('preserves immutable fill IDs on rollback and uses new IDs after reimport', async () => {
    const s = new DexieLedgerStore(`acceptance-${crypto.randomUUID()}`);
    try {
      const fills = await golden(); await s.commitBatch({ batch: batch('b', { status: 'staged' }), accounts: [account()], fills, cashEvents: [] }, 0);
      const old = await s.listEntries(); await s.rollbackBatch('b', 1);
      await s.commitBatch({ batch: batch('c', { status: 'staged', ledgerVersionAtStage: 2 }), fills: fills.map(f => ({ ...f, batchId: 'c' })), cashEvents: [] }, 2);
      expect((await s.listEntries({ active: true })).every(f => !old.some(o => o.fillId === f.fillId))).toBe(true);
      expect(await s.listEntries({ active: false })).toHaveLength(4);
    } finally { await s.delete(); }
  });
  it('uses explicit opening lots; never silently recreates FIFO from average cost', async () => {
    const acct = account({ openingBalances: [{ symbol: 'FPT', qty: '600', avgPrice: '116.66666666666666666667', asOfUtc: '2026-02-01T00:00:00Z', origin: 'user-declared', lots: [{ qty: '100', price: '100' }, { qty: '500', price: '120' }] }] });
    const sell = await fill('s', 'sell', '600', '130', '2026-02-02T00:00:00Z');
    const r = await replayBook([sell], acct, [batch()]); expect(r.events[0].gross).toBe('8000'); expect(r.events[0].net).toBeUndefined();
    expect(r.anomalies.some(a => a.code === 'OPENING_FIFO_APPROXIMATE')).toBe(false);
    const approx = await replayBook([sell], { ...acct, openingBalances: acct.openingBalances.map(o => ({ ...o, lots: undefined })) }, [batch()]);
    expect(approx.anomalies.some(a => a.code === 'OPENING_FIFO_APPROXIMATE')).toBe(true);
  });
  it('supports partial exit then add again without prematurely closing the cycle', async () => {
    const rows = [await fill('1', 'buy', '10', '100', '2026-01-01T00:00:00Z'), await fill('2', 'sell', '4', '110', '2026-01-02T00:00:00Z'), await fill('3', 'buy', '4', '120', '2026-01-03T00:00:00Z'), await fill('4', 'sell', '10', '130', '2026-01-04T00:00:00Z')];
    for (const costBasis of ['fifo', 'average'] as const) {
      const r = await replayBook(rows, account({ costBasis }), [batch()]); expect(r.cycles).toHaveLength(1); expect(r.cycles[0].netVND).toBe('260');
    }
  });
  it('reports mixed-currency missing fee rates as unknown rather than USDT or zero', async () => {
    const f = await golden(); f[0].costs = [{ kind: 'commission', amount: '0.1', ccy: 'BNB', origin: 'reported' }];
    const r = await replayBook(f, account(), [batch()]); expect(r.cycles[0].netVND).toBeUndefined(); expect(feeImpact(r).unknownCostCount).toBeGreaterThan(0);
  });
  it('conserves date-group totals across UTC/Vietnam boundaries', async () => {
    const rows = [await fill('1', 'buy', '2', '10', '2026-01-01T00:00:00Z'), await fill('2', 'sell', '1', '12', '2026-01-31T16:59:59Z'), await fill('3', 'sell', '1', '15', '2026-01-31T17:00:00Z')];
    const r = await replayBook(rows, account(), [batch()]), days = calendarVM(r);
    expect(days.map(d => d.date)).toEqual(['2026-01-31', '2026-02-01']); expect(sum(days.map(d => d.netVND!))).toBe('7');
    expect(metricsVM(r, { from: '2026-01-01', to: '2026-01-31' }).net).toMatchObject({ value: 2 });
    expect(tradeDims(r.cycles[0]).closeDate).toBe('2026-02-01');
  });
  it('handles reported close without inventing hold time or silently shadowing by range', async () => {
    const fills = await golden();
    const reported: Fill = { ...fills[3], role: 'reported-close', fillId: 'report', nativeId: 'report', closeTsUtc: '2026-01-03T00:00:00Z', avgCostPrice: '110', closePrice: '130', reportedGross: '8000', ccy: 'VND', granularity: 'day-symbol' };
    const r = await replayBook([...fills, reported], account(), [batch()]); const cycle = r.cycles.find(c => c.sourceFillIds.includes('report'))!;
    expect(cycle.holdMinutes).toBeUndefined(); expect(cycle.shadowed).not.toBe(true); expect(r.anomalies.some(a => a.code === 'POSSIBLE_CROSS_REPORT_OVERLAP')).toBe(true);
  });
  it('exposes persistence refusal and backup reminders; demo cannot silently migrate', async () => {
    const storage = { persisted: async () => false, persist: async () => false, estimate: async () => ({ usage: 100, quota: 1000 }) } as unknown as StorageManager;
    expect(await storageHealth(storage, true)).toMatchObject({ supported: true, persisted: false }); expect(backupReminder().due).toBe(true);
    const s = new DexieLedgerStore(`acceptance-${crypto.randomUUID()}`);
    try { await expect(migrateLegacyStorage(s, { getItem: () => 'true' }, 'tuan-trader-trades', 0)).rejects.toThrow('ORIGIN_REQUIRES_CONFIRMATION'); } finally { await s.delete(); }
  });
  it('property: full replay is independent of imported file order', async () => {
    const f = await golden();
    await fc.assert(fc.asyncProperty(fc.shuffledSubarray(f, { minLength: 4, maxLength: 4 }), async (permutation: TradeFill[]) => {
      const r = await replayBook(permutation, account(), [batch()]);
      expect(r.cycles[0].netVND).toBe('20000'); expect(r.events.map(e => e.netVND)).toEqual(['12000', '8000']);
    }), { numRuns: 30, seed: 19 });
  });
});

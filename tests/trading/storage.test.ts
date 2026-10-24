import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import { decodeBackup, encodeBackup } from '../../lib/trading/storage/backup';
import { prepareLegacyMigration } from '../../lib/trading/storage/migration';
import { replayLedger, rollbackPreview } from '../../lib/trading/application/replayLedger';
import { hash } from '../../lib/trading/domain/identity';
import { metricsVM } from '../../lib/trading/selectors';
import { account, batch, golden } from './fixtures';
const stores: DexieLedgerStore[] = [];
const store = () => { const s = new DexieLedgerStore(`test-${crypto.randomUUID()}`); stores.push(s); return s; };
afterEach(async () => { for (const s of stores.splice(0)) await s.delete(); });
describe('atomic ledger storage', () => {
  it('commits once, dedupes overlapping files, preserves IDs, rejects stale writers', async () => {
    const s = store(), f = await golden();
    const first = await s.commitBatch({ batch: batch('b', { status: 'staged' }), fills: f, cashEvents: [], accounts: [account()] }, 0);
    expect(first.newEntries).toBe(4); const ids = (await s.listEntries()).map(f => f.fillId);
    expect((await s.commitBatch({ batch: batch('b', { status: 'staged' }), fills: f, cashEvents: [] }, 1)).newEntries).toBe(0);
    expect((await s.commitBatch({ batch: batch('c', { status: 'staged', ledgerVersionAtStage: 1 }), fills: f.map(f => ({ ...f, batchId: 'c' })), cashEvents: [] }, 1)).newEntries).toBe(0);
    expect((await s.listEntries()).map(f => f.fillId)).toEqual(ids);
    await expect(s.rollbackBatch('b', 1)).rejects.toThrow('STALE_LEDGER_VERSION');
  });
  it('rejects all writes for native conflict, malformed row or blocker', async () => {
    const s = store(), f = await golden();
    await s.commitBatch({ batch: batch('b', { status: 'staged' }), fills: f, cashEvents: [], accounts: [account()] }, 0);
    await expect(s.commitBatch({ batch: batch('c', { status: 'staged', ledgerVersionAtStage: 1 }), fills: [{ ...f[0], batchId: 'c', price: '999' }], cashEvents: [] }, 1)).rejects.toThrow('IMPORT_CONFLICT');
    expect(await s.getLedgerVersion()).toBe(1); expect(await s.batches.count()).toBe(1);
    await expect(s.commitBatch({ batch: batch('c', { status: 'staged', ledgerVersionAtStage: 1 }), fills: [{ ...f[0], batchId: 'c', qty: '0' }], cashEvents: [] }, 1)).rejects.toThrow();
    const empty = store();
    await expect(empty.commitBatch({ batch: batch('b', { status: 'staged' }), fills: [f[3]], cashEvents: [], accounts: [account()] }, 0)).rejects.toThrow('IMPORT_BLOCKED');
    expect(await empty.accounts.count()).toBe(0);
  });
  it('serializes concurrent tabs via compare-and-swap', async () => {
    const s = store(), second = new DexieLedgerStore(s.name); stores.push(second);
    const f = await golden();
    const input = { batch: batch('b', { status: 'staged' }), fills: f, cashEvents: [], accounts: [account()] };
    const results = await Promise.allSettled([s.commitBatch(input, 0), second.commitBatch(input, 0)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await s.fills.count()).toBe(4);
  });
  it('rolls back dependent batches without deleting their evidence and round-trips backups', async () => {
    const s = store(); const f = await golden();
    await s.commitBatch({ batch: batch('b', { status: 'staged' }), fills: f.slice(0, 3), cashEvents: [], accounts: [account()] }, 0);
    const before = await replayLedger((await s.snapshot()).data);
    await s.commitBatch({ batch: batch('c', { status: 'staged', ledgerVersionAtStage: 1 }), fills: [{ ...f[3], batchId: 'c' }], cashEvents: [] }, 1);
    const saved = await s.exportAll();
    const preview = await rollbackPreview((await s.snapshot()).data, 'b'); expect(preview.dependentBatches).toContain('c'); expect(preview.after.anomalies.some(a => a.code === 'OVERSELL')).toBe(true);
    await s.rollbackBatch('c', 2);
    expect(await hash(await replayLedger((await s.snapshot()).data))).toBe(await hash(before));
    await s.importAll(saved, 3); expect(await s.archives.count()).toBe(1);
    const restored = await replayLedger((await s.snapshot()).data); expect(restored.cycles[0].netVND).toBe('20000');
    const parsed = JSON.parse(saved); parsed.data.fills[0].price = '999';
    await expect(decodeBackup(JSON.stringify(parsed))).rejects.toThrow('CHECKSUM_MISMATCH');
    expect(await hash(await decodeBackup(await encodeBackup((await s.snapshot()).data)))).toBe(await hash((await s.snapshot()).data));
  });
  it('migrates 20 legacy trades preserving known P&L, risk and discipline with a durable original backup', async () => {
    const legacy = Array.from({ length: 20 }, (_, i) => ({ id: String(i).padStart(3, '0'), date: `2026-01-${String(i + 1).padStart(2, '0')}`, symbol: 'FPT', side: 'Buy', pnl: i % 2 ? -100 : 200, risk: 100, discipline: 80, durationMin: 30, setup: 'A', note: 'Ghi chú', psychology: '' }));
    const data = await prepareLegacyMigration(legacy, 'local-user');
    const s = store(); await s.importLegacy(data, JSON.stringify(legacy), 0);
    expect((await s.archives.toArray())[0].json).toBe(JSON.stringify(legacy));
    const r = await replayLedger((await s.snapshot()).data), m = metricsVM(r);
    expect(r.cycles).toHaveLength(20); expect(m.net).toMatchObject({ value: 1000 }); expect(m.averageR).toMatchObject({ value: 0.5 });
    expect(m.roi).toMatchObject({ value: 50 }); expect(m.discipline).toMatchObject({ value: 80 }); expect(m.avgDuration).toMatchObject({ value: 30 });
    expect(r.cycles.every(c => c.grossVND === undefined && c.costCompleteness === 'partial')).toBe(true);
    const backup = await s.exportAll(), restored = store(); await restored.importAll(backup, 0);
    expect(await hash(await replayLedger((await restored.snapshot()).data))).toBe(await hash(r));
    await expect(s.importLegacy(data, JSON.stringify(legacy), 1)).rejects.toThrow('LEGACY_MIGRATION_REQUIRES_EMPTY_LEDGER');
  });
});

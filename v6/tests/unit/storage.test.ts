import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { JournalRepository } from '../../src/data/repository';
import { migrateV3 } from '../../src/data/migrateV3';
import { encodeBackup, decodeBackup, canonical, sha256 } from '../../src/data/backup';
import { analyze } from '../../src/core/analyze';
const raw = JSON.stringify(original);
it('migrates original v3 without mutation, saves original raw bytes and roundtrips v4', async () => {
  const unchanged = canonical(original),
    migration = await migrateV3(raw),
    j = migration.data.journals[0];
  expect(canonical(original)).toBe(unchanged);
  expect(migration.data.trades).toHaveLength(30);
  expect(migration.data.notes).toHaveLength(30);
  expect(migration.data.sources[0].raw).toBe(raw);
  expect(migration.data.trades.filter((t) => t.disciplineLegacy !== undefined)).toHaveLength(24);
  expect(analyze(j, migration.data.trades).metrics.net.value).toBe('3302290');
  const db = new JournalRepository('s1-' + crypto.randomUUID());
  try {
    await db.importV3(raw, 0);
    const s = await db.snapshot();
    expect(s.revision).toBe(1);
    expect(s.data.trades).toHaveLength(30);
    const recoveries = await db.recoveries(),
      source = recoveries.find((r) => r.reason === 'original-v3-before-migration')!;
    expect(await db.original(source.id)).toBe(raw);
    const exported = await db.exportJSON();
    expect(canonical(await decodeBackup(exported))).toBe(canonical(s.data));
    expect(await db.equals(exported)).toBe(true);
    expect((await db.previewRestore(exported)).trades).toHaveLength(30);
    expect((await db.snapshot()).revision).toBe(1);
    await expect(db.importV3(raw, 1)).rejects.toThrow('JOURNAL_ALREADY_EXISTS');
    expect((await db.snapshot()).revision).toBe(1);
    await expect(db.commit(s.data, 0)).rejects.toThrow('STALE_REVISION');
    await db.restore(exported, 1);
    expect((await db.snapshot()).revision).toBe(2);
    expect(await db.tradesInRange(j.id, '2026-10-01', '2026-10-17')).toHaveLength(12);
  } finally {
    await db.delete();
  }
});
it('rejects tampering and preserves failed original imports before parsing or writes', async () => {
  const db = new JournalRepository('s1-bad-' + crypto.randomUUID());
  try {
    await expect(
      db.importV3(raw.replace('3302290', '3302291').replace(original.checksum, '0'.repeat(64)), 0),
    ).rejects.toThrow('CHECKSUM_MISMATCH');
    expect((await db.snapshot()).data.trades).toHaveLength(0);
    expect(await db.recoveries()).toHaveLength(1);
    const migrated = (await migrateV3(raw)).data,
      encoded = await encodeBackup(migrated);
    await expect(
      decodeBackup(encoded.replace('3302290', '3302291').replace('Trading Plan Pro', 'Other')),
    ).rejects.toThrow();
    const broken = structuredClone(migrated);
    broken.trades[0].setupId = 'unknown';
    await expect(db.commit(broken, 0)).rejects.toThrow('CROSS_JOURNAL');
  } finally {
    await db.delete();
  }
});
it('does not overwrite a committed revision during concurrent writes', async () => {
  const db = new JournalRepository('s1-cas-' + crypto.randomUUID());
  try {
    const data = (await migrateV3(raw)).data;
    const results = await Promise.allSettled([db.commit(data, 0), db.commit(data, 0)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.snapshot()).revision).toBe(1);
  } finally {
    await db.delete();
  }
});
it('fails closed on legacy financial facts that cannot be represented losslessly', async () => {
  const e = structuredClone(original);
  e.data.accounts[0].pnlModel = 'reported';
  const { checksum: _checksum, ...body } = e;
  void _checksum;
  const changed = JSON.stringify({ ...body, checksum: await sha256(canonical(body)) });
  await expect(migrateV3(changed)).rejects.toThrow('V3_ACCOUNT_NOT_LOSSLESS');
});

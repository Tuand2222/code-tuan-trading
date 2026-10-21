import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { JournalRepository } from '../../src/data/repository';
import { viewRepository, saveView } from '../../src/data/views';
import {
  exportWorkspace,
  previewWorkspace,
  restoreWorkspace,
} from '../../src/data/workspaceBackup';
import { canonical } from '../../src/data/backup';
import { emptyFilters } from '../../src/core/filters';
it('N02 verifies full backups without writes, rejects tampering and restores Views plus exact ledger with recovery', async () => {
  const repo = new JournalRepository('s3-backup-' + crypto.randomUUID());
  try {
    await repo.importV3(JSON.stringify(original), 0);
    await saveView('VCB', { ...emptyFilters, journal: 'demo', symbol: 'VCB' });
    await viewRepository.meta.put({ key: 'lastBackupAt', value: '2026-10-21T00:00:00.000Z' });
    const raw = await exportWorkspace(repo),
      before = await repo.snapshot();
    const preview = await previewWorkspace(raw, repo);
    expect(preview.data.trades).toHaveLength(30);
    expect(preview.views?.[0].name).toBe('VCB');
    expect(canonical(await repo.snapshot())).toBe(canonical(before));
    const bad = JSON.parse(raw);
    bad.views[0].name = 'Changed';
    await expect(previewWorkspace(JSON.stringify(bad), repo)).rejects.toThrow('CHECKSUM_MISMATCH');
    await saveView('Second', { ...emptyFilters, symbol: 'FPT' });
    await restoreWorkspace(raw, repo, 1);
    expect((await viewRepository.views.toArray()).map((v) => v.name)).toEqual(['VCB']);
    expect(canonical((await repo.snapshot()).data)).toBe(canonical(before.data));
    expect(await viewRepository.meta.get('before-workspace-restore')).toBeTruthy();
    expect(JSON.parse(await exportWorkspace(repo)).preferences).toHaveLength(1);
    await expect(restoreWorkspace(raw, repo, 1)).rejects.toThrow('STALE_REVISION');
  } finally {
    await repo.delete();
    await viewRepository.views.clear();
    await viewRepository.meta.clear();
  }
});

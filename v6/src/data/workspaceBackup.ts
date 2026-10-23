import { z } from 'zod';
import { canonical, sha256, decodeBackup } from './backup';
import { viewRepository } from './views';
import type { JournalRepository } from './repository';
import {
  devicePreferenceSchema,
  readDevicePreferences,
  writeDevicePreferences,
} from './devicePreferences';
const view = z.object({ name: z.string().min(1).max(80), hash: z.string().max(4096) }).strict();
const meta = z.object({ key: z.literal('lastBackupAt'), value: z.string().datetime() }).strict();
const bodySchema = z
  .object({
    kind: z.literal('Trading Plan Pro workspace'),
    version: z.literal(1),
    at: z.iso.datetime(),
    ledger: z.string(),
    views: z.array(view).max(1000),
    preferences: z.array(meta).max(1000),
    devicePreferences: z.array(devicePreferenceSchema).max(2).optional(),
    checksum: z.string(),
  })
  .strict();
export async function exportWorkspace(repo: JournalRepository) {
  const body = {
    kind: 'Trading Plan Pro workspace',
    version: 1,
    at: new Date().toISOString(),
    ledger: await repo.exportJSON(),
    views: await viewRepository.views.toArray(),
    preferences: (await viewRepository.meta.toArray()).filter((p) => p.key === 'lastBackupAt'),
    devicePreferences: readDevicePreferences(),
  };
  return canonical({ ...body, checksum: await sha256(canonical(body)) });
}
export async function previewWorkspace(raw: string, repo: JournalRepository) {
  if (new TextEncoder().encode(raw).length > 100 * 1024 * 1024) throw Error('BACKUP_TOO_LARGE');
  const value = JSON.parse(raw);
  if (value.kind !== 'Trading Plan Pro workspace')
    return {
      data: await repo.previewRestore(raw),
      ledger: raw,
      views: undefined,
      preferences: undefined,
      devicePreferences: undefined,
    };
  const parsed = bodySchema.parse(value),
    { checksum, ...body } = parsed;
  if (checksum !== (await sha256(canonical(body)))) throw Error('CHECKSUM_MISMATCH');
  return {
    data: await decodeBackup(parsed.ledger),
    ledger: parsed.ledger,
    views: parsed.views,
    preferences: parsed.preferences,
    devicePreferences: parsed.devicePreferences,
  };
}
export async function restoreWorkspace(raw: string, repo: JournalRepository, revision: number) {
  const preview = await previewWorkspace(raw, repo);
  const before = await exportWorkspace(repo);
  if ((await repo.snapshot()).revision !== revision) throw Error('STALE_REVISION');
  await viewRepository.transaction('rw', viewRepository.meta, async () => {
    if (await viewRepository.meta.get('pending-workspace-restore'))
      throw Error('WORKSPACE_RECOVERY_REQUIRED');
    await viewRepository.meta.put({ key: 'before-workspace-restore', value: before });
    await viewRepository.meta.put({
      key: 'pending-workspace-restore',
      value: JSON.stringify({ repository: repo.name, raw }),
    });
  });
  try {
    await repo.restore(preview.ledger, revision);
  } catch (error) {
    await viewRepository.meta.delete('pending-workspace-restore');
    throw error;
  }
  await finishWorkspaceRestore(preview);
  return preview.data;
}
async function finishWorkspaceRestore(preview: Awaited<ReturnType<typeof previewWorkspace>>) {
  writeDevicePreferences(preview.devicePreferences);
  await viewRepository.transaction('rw', viewRepository.views, viewRepository.meta, async () => {
    if (preview.views && preview.preferences) {
      await viewRepository.views.clear();
      await viewRepository.views.bulkPut(preview.views!);
      await viewRepository.meta.delete('lastBackupAt');
      await viewRepository.meta.bulkPut(preview.preferences!);
    }
    await viewRepository.meta.delete('pending-workspace-restore');
  });
}
export async function recoverWorkspaceRestore(repo: JournalRepository) {
  const pending = await viewRepository.meta.get('pending-workspace-restore');
  if (!pending) return false;
  const record = z
    .object({ repository: z.string(), raw: z.string() })
    .strict()
    .parse(JSON.parse(pending.value));
  if (record.repository !== repo.name) throw Error('WORKSPACE_RECOVERY_WRONG_REPOSITORY');
  const preview = await previewWorkspace(record.raw, repo);
  if (canonical((await repo.snapshot()).data) !== canonical(preview.data)) {
    const before = await viewRepository.meta.get('before-workspace-restore');
    if (before) {
      const previous = await previewWorkspace(before.value, repo);
      if (canonical((await repo.snapshot()).data) === canonical(previous.data)) {
        // The process stopped before the ledger commit; Views were never changed.
        await viewRepository.meta.delete('pending-workspace-restore');
        return false;
      }
    }
    throw Error('WORKSPACE_RECOVERY_LEDGER_CHANGED');
  }
  await finishWorkspaceRestore(preview);
  return true;
}

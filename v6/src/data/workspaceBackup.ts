import { z } from 'zod';
import { canonical, sha256, decodeBackup } from './backup';
import { viewRepository } from './views';
import type { JournalRepository } from './repository';
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
    };
  const parsed = bodySchema.parse(value),
    { checksum, ...body } = parsed;
  if (checksum !== (await sha256(canonical(body)))) throw Error('CHECKSUM_MISMATCH');
  return {
    data: await decodeBackup(parsed.ledger),
    ledger: parsed.ledger,
    views: parsed.views,
    preferences: parsed.preferences,
  };
}
export async function restoreWorkspace(raw: string, repo: JournalRepository, revision: number) {
  const preview = await previewWorkspace(raw, repo);
  const before = await exportWorkspace(repo);
  await viewRepository.meta.put({ key: 'before-workspace-restore', value: before });
  await repo.restore(preview.ledger, revision);
  if (preview.views && preview.preferences)
    await viewRepository.transaction('rw', viewRepository.views, viewRepository.meta, async () => {
      await viewRepository.views.clear();
      await viewRepository.views.bulkPut(preview.views!);
      await viewRepository.meta.bulkPut(preview.preferences!);
    });
  return preview.data;
}

import { canonical, encodeBackup, sha256 } from './backup';
import { mergeSnapshots } from './mergeSnapshot';
import type { JournalRepository } from './repository';
import { viewRepository } from './views';
import { readDevicePreferences } from './devicePreferences';
import { previewWorkspace, restoreWorkspace } from './workspaceBackup';

export async function prepareWorkspaceMerge(raw: string, repo: JournalRepository) {
  const incoming = await previewWorkspace(raw, repo);
  const current = await repo.snapshot();
  const merged = await mergeSnapshots(current.data, incoming.data);
  // Keep the entire imported workspace, including unsupported old settings, as
  // a private original. This record is never included in public site assets.
  const id = 'workspace-source:' + (await sha256(raw));
  if (!merged.data.sources.some((s) => s.id === id))
    merged.data.sources.push({ id, raw, createdAt: new Date().toISOString() });
  const views = await viewRepository.views.toArray();
  for (const v of incoming.views ?? []) {
    if (views.some((old) => old.name === v.name && old.hash === v.hash)) continue;
    let name = v.name;
    for (let i = 2; views.some((old) => old.name === name); i++)
      name = v.name.slice(0, 65) + ' (gộp ' + i + ')';
    views.push({ ...v, name });
  }
  const devicePreferences = readDevicePreferences();
  for (const p of incoming.devicePreferences ?? [])
    if (!devicePreferences.some((old) => old.key === p.key)) devicePreferences.push(p);
  const body = {
    kind: 'Trading Plan Pro workspace',
    version: 1,
    at: new Date().toISOString(),
    ledger: await encodeBackup(merged.data),
    views,
    preferences: (await viewRepository.meta.toArray()).filter((p) => p.key === 'lastBackupAt'),
    devicePreferences,
  };
  return {
    raw: canonical({ ...body, checksum: await sha256(canonical(body)) }),
    report: merged.report,
    revision: current.revision,
    data: merged.data,
  };
}
export async function mergeWorkspace(raw: string, repo: JournalRepository, revision: number) {
  const next = await prepareWorkspaceMerge(raw, repo);
  if (next.revision !== revision) throw Error('STALE_REVISION');
  await restoreWorkspace(next.raw, repo, revision);
  await viewRepository.meta.put({
    key: 'last-workspace-merge',
    value: JSON.stringify({ at: new Date().toISOString(), ...next.report }),
  });
  return next.report;
}

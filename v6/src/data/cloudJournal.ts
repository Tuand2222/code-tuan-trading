import Dexie, { type Table } from 'dexie';
import { canonical, sha256 } from './backup';
import { emptySnapshot, validateSnapshot, type Snapshot } from './snapshot';
import type { JournalRepository } from './repository';
import { viewRepository } from './views';
import { parseCloudArchives } from './cloudArchiveFormat';

type Doc = { collection: string; id: string; value?: unknown; deleted?: boolean; period?: string };
export type CloudRow = {
  record_key: string;
  collection: string;
  record_id: string;
  hash: string;
  deleted: number;
  revision: number;
  size_bytes: number;
  updated_at: string;
};
type Base = { key: string; hash: string };
class SyncStore extends Dexie {
  meta!: Table<{ key: string; value: unknown }, string>;
  bases!: Table<Base, string>;
  constructor() {
    super('tuan-v6-cloud-sync-v1');
    this.version(1).stores({ meta: 'key', bases: 'key' });
  }
}
const syncDB = new SyncStore();
export async function cloudIdentity() {
  for (const path of ['/api/site-session', '/api/auth/get-session']) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok) {
        const s = await r.json();
        if (s.user?.id)
          return {
            id: String(s.user.id),
            name: String(s.user.name ?? s.user.email ?? 'Tài khoản'),
          };
      }
    } catch {
      /* offline */
    }
  }
  return null;
}
export async function cloudBinding() {
  return (await syncDB.meta.get('binding'))?.value as
    { owner: string; enabled: boolean } | undefined;
}
export async function enableCloud(owner: string) {
  const bound = await cloudBinding();
  if (bound && bound.owner !== owner)
    throw Error(
      'Kho trên thiết bị thuộc tài khoản khác. Hãy xuất bản sao và dùng hồ sơ trình duyệt riêng.',
    );
  await syncDB.meta.put({ key: 'binding', value: { owner, enabled: true } });
}
export async function disableCloud() {
  const b = await cloudBinding();
  if (b) await syncDB.meta.put({ key: 'binding', value: { ...b, enabled: false } });
}
export async function captureClassicArchive(owner: string) {
  const metaKey = 'classic-archive:' + owner;
  let cursor = (await syncDB.meta.get(metaKey))?.value as
    { kind: 'trades' | 'images' | 'done'; after: string } | undefined;
  cursor ??= { kind: 'trades', after: '' };
  let pending = 0,
    drained = false;
  for (let i = 0; i < 4; i++) {
    const response: Response = await fetch('/api/classic-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedOwner: owner,
        ...(cursor.kind !== 'done' ? { seed: true, kind: cursor.kind, after: cursor.after } : {}),
      }),
    });
    const body: { next?: string | null; pending?: number; error?: string } = await response.json();
    if (!response.ok)
      throw Error(body.error ?? 'Bản sao Classic chưa hoàn tất; sổ chính vẫn được giữ.');
    if (cursor.kind !== 'done') {
      cursor = body.next
        ? { ...cursor, after: body.next }
        : { kind: cursor.kind === 'trades' ? 'images' : 'done', after: '' };
      await syncDB.meta.put({ key: metaKey, value: cursor });
    } else {
      if (!Number.isInteger(body.pending) || body.pending! < 0)
        throw Error('Chưa xác nhận hàng đợi Classic.');
      pending = body.pending!;
      drained = true;
      if (!pending) break;
    }
  }
  if (cursor.kind === 'done' && !drained) {
    const response = await fetch('/api/classic-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedOwner: owner }),
    });
    const body = await response.json();
    if (!response.ok || !Number.isInteger(body.pending) || body.pending < 0)
      throw Error(body.error ?? 'Chưa xác nhận hàng đợi Classic.');
    pending = body.pending;
  }
  await syncDB.meta.put({
    key: 'classic-archive-status',
    value: { pending, seeding: cursor.kind !== 'done' },
  });
  return { pending, seeding: cursor.kind !== 'done' };
}
export async function classicArchiveStatus() {
  return (await syncDB.meta.get('classic-archive-status'))?.value as
    { pending: number; seeding: boolean } | undefined;
}
const key = (d: Pick<Doc, 'collection' | 'id'>) => d.collection + ':' + d.id;
function recordId(collection: string, r: Record<string, unknown>) {
  return String(
    r.id ??
      (collection === 'customStatDefs' ? String(r.journalId) + ':' + String(r.slot) : r.journalId),
  );
}
export async function cloudDocuments(data: Snapshot): Promise<Doc[]> {
  const docs: Doc[] = [];
  for (const [collection, rows] of Object.entries(data))
    for (const item of rows) {
      const row = item as unknown as Record<string, unknown>,
        id = recordId(collection, row),
        raw = canonical(row);
      let value: unknown = row;
      if (raw.length > 500000) {
        const chunks: string[] = [];
        for (let i = 0; i < raw.length; i += 500000) {
          const part = raw.slice(i, i + 500000),
            cid = await sha256(canonical(part));
          docs.push({ collection: 'chunks', id: cid, value: part });
          chunks.push(cid);
        }
        value = { __cloudChunks: chunks };
      }
      const period =
        collection === 'trades'
          ? String(
              (row.legs as { time: string }[] | undefined)?.at(-1)?.time ?? row.updatedAt ?? '',
            ).slice(0, 7)
          : undefined;
      docs.push({
        collection,
        id,
        value,
        ...(period && /^\d{4}-\d{2}$/.test(period) ? { period } : {}),
      });
    }
  for (const j of data.journals) {
    const raw = localStorage.getItem('tuan-v6-quant:' + j.id);
    if (raw) docs.push({ collection: 'preferences', id: 'quant:' + j.id, value: JSON.parse(raw) });
  }
  docs.push({
    collection: 'preferences',
    id: 'views',
    value: await viewRepository.views.toArray(),
  });
  return [...new Map(docs.map((d) => [key(d), d])).values()];
}
async function api(path: string, options?: RequestInit) {
  const owner = (await cloudBinding())?.owner;
  const headers = new Headers(options?.headers);
  if (owner) headers.set('X-Journal-Owner', owner);
  const r = await fetch('/api/journal-cloud' + path, { cache: 'no-store', ...options, headers });
  const body = await r.json();
  if (!r.ok)
    throw Error(r.status === 409 ? 'CLOUD_CONFLICT' : (body.error ?? 'Không kết nối được cloud'));
  if (owner && body.owner && body.owner !== owner) throw Error('CLOUD_OWNER_MISMATCH');
  return body;
}
export async function cloudManifest() {
  const records: CloudRow[] = [];
  let next = '',
    revision: number | undefined,
    owner: string;
  do {
    const page = await api(next ? '?after=' + encodeURIComponent(next) : '');
    if (revision !== undefined && page.revision !== revision)
      throw Error('Cloud đang thay đổi. Hãy đồng bộ lại.');
    revision = page.revision;
    owner = page.owner;
    records.push(...page.records);
    next = page.next ?? '';
  } while (next);
  return { records, revision: revision ?? 0, owner };
}
export async function cloudValue(row: CloudRow) {
  return (await api('?key=' + encodeURIComponent(row.record_key) + '&version=' + row.revision))
    .value as unknown;
}
async function snapshotFrom(docs: Map<string, Doc>) {
  const result = emptySnapshot();
  for (const d of docs.values()) {
    if (!Object.hasOwn(result, d.collection) || d.deleted) continue;
    let value = d.value;
    if (value && typeof value === 'object' && '__cloudChunks' in value) {
      value = JSON.parse(
        (
          await Promise.all(
            (value as { __cloudChunks: string[] }).__cloudChunks.map(async (id) => {
              const chunk = docs.get('chunks:' + id)?.value;
              if (typeof chunk !== 'string')
                throw Error('Thiếu phần dữ liệu cloud; chưa thay đổi bản trên thiết bị.');
              if ((await sha256(canonical(chunk))) !== id)
                throw Error('Checksum phần dữ liệu cloud không khớp.');
              return chunk;
            }),
          )
        ).join(''),
      );
    }
    (result[d.collection as keyof Snapshot] as unknown[]).push(value);
  }
  return validateSnapshot(result);
}
let running = false;
export type SyncResult = {
  at: string;
  lastAttemptAt?: string;
  error?: string;
  localRevision?: number;
  conflicts: string[];
  pushed: number;
  pulled: number;
  records: number;
};
export async function syncJournal(
  repo: JournalRepository,
  force?: 'local' | 'cloud',
): Promise<SyncResult> {
  if (running) throw Error('Đang đồng bộ');
  running = true;
  try {
    const identity = await cloudIdentity(),
      binding = await cloudBinding();
    if (!identity || !binding?.enabled || binding.owner !== identity.id)
      throw Error('Cần đăng nhập đúng tài khoản và bật lưu cloud.');
    await captureClassicArchive(identity.id);
    const before = await repo.snapshot(),
      manifest = await cloudManifest();
    if (manifest.owner !== identity.id) throw Error('CLOUD_OWNER_MISMATCH');
    const local = new Map((await cloudDocuments(before.data)).map((d) => [key(d), d]));
    const managed = (collection: string, id: string) =>
      collection !== 'classic' &&
      (collection !== 'preferences' || id === 'views' || id.startsWith('quant:'));
    const remote = new Map(
      manifest.records
        .filter((r) => managed(r.collection, r.record_id))
        .map((r) => [r.record_key, r]),
    );
    const bases = new Map(
      (await syncDB.bases.toArray())
        .filter((b) => {
          const k = b.key.slice(identity.id.length + 1),
            i = k.indexOf(':');
          return b.key.startsWith(identity.id + '\n') && managed(k.slice(0, i), k.slice(i + 1));
        })
        .map((b) => [b.key.slice(identity.id.length + 1), b.hash]),
    );
    const hashes = new Map<string, string>();
    for (const [k, d] of local) hashes.set(k, await sha256(canonical(d.value)));
    const conflicts: string[] = [],
      push: Doc[] = [],
      pulled: string[] = [];
    const next = new Map(local);
    for (const k of new Set([...local.keys(), ...remote.keys(), ...bases.keys()])) {
      const l = hashes.get(k),
        r = remote.get(k),
        rh = r?.deleted ? undefined : r?.hash,
        b = bases.get(k);
      if (l === rh) continue;
      const normal = l === b ? 'cloud' : rh === b ? 'local' : 'conflict';
      const action = normal === 'conflict' && force ? force : normal;
      if (action === 'conflict') {
        conflicts.push(k);
        continue;
      }
      if (action === 'cloud') {
        if (r && !r.deleted)
          next.set(k, { collection: r.collection, id: r.record_id, value: await cloudValue(r) });
        else if (r?.deleted) next.delete(k);
        else continue;
        pulled.push(k);
      } else {
        const d = local.get(k);
        if (d) push.push(d);
        else if (r && !r.deleted)
          push.push({ collection: r.collection, id: r.record_id, deleted: true });
      }
    }
    if (conflicts.length) {
      const previous = await cloudStatus();
      const result = {
        at: previous?.at ?? '',
        lastAttemptAt: new Date().toISOString(),
        conflicts,
        pushed: 0,
        pulled: 0,
        records: manifest.records.length,
      };
      await syncDB.meta.put({ key: 'status', value: result });
      window.dispatchEvent(new Event('v6-cloud-sync'));
      return result;
    }
    // Validate the complete reference graph before either side advances.
    const merged = await snapshotFrom(next);
    if (pulled.length && before.revision !== (await repo.snapshot()).revision)
      throw Error('Nhật ký vừa thay đổi; hãy đồng bộ lại.');
    let revision = manifest.revision;
    for (let i = 0; i < push.length;) {
      const batch: Doc[] = [];
      let size = 0;
      while (i < push.length && batch.length < 16) {
        const d = push[i],
          n = canonical(d).length * 3;
        if (batch.length && size + n > 6 * 1024 * 1024) break;
        batch.push(d);
        size += n;
        i++;
      }
      const response = await api('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedOwner: identity.id,
          expectedRevision: revision,
          mutationId: crypto.randomUUID(),
          records: batch,
        }),
      });
      revision = response.revision;
    }
    if ((await cloudIdentity())?.id !== identity.id) throw Error('CLOUD_OWNER_MISMATCH');
    if (pulled.length) {
      await repo.commit(merged, before.revision, 'cloud-reconcile');
      for (const d of next.values())
        if (d.collection === 'preferences') {
          if (d.id.startsWith('quant:'))
            localStorage.setItem('tuan-v6-quant:' + d.id.slice(6), JSON.stringify(d.value));
          if (d.id === 'views' && Array.isArray(d.value))
            await viewRepository.transaction('rw', viewRepository.views, async () => {
              await viewRepository.views.clear();
              await viewRepository.views.bulkPut(d.value as { name: string; hash: string }[]);
            });
        }
    }
    for (const k of pulled) {
      if (!next.has(k) && k.startsWith('preferences:quant:'))
        localStorage.removeItem('tuan-v6-quant:' + k.slice('preferences:quant:'.length));
    }
    const final = new Map([...next].map(([k, d]) => [k, d]));
    for (const d of push) {
      if (d.deleted) final.delete(key(d));
      else final.set(key(d), d);
    }
    const acknowledged: Base[] = [];
    const removed: string[] = [];
    for (const k of new Set([...bases.keys(), ...remote.keys(), ...final.keys()])) {
      const d = final.get(k);
      if (d)
        acknowledged.push({ key: identity.id + '\n' + k, hash: await sha256(canonical(d.value)) });
      else removed.push(identity.id + '\n' + k);
    }
    await syncDB.transaction('rw', syncDB.bases, async () => {
      await syncDB.bases.bulkPut(acknowledged);
      await syncDB.bases.bulkDelete(removed);
    });
    const result = {
      at: new Date().toISOString(),
      localRevision: pulled.length ? before.revision + 1 : before.revision,
      conflicts: [],
      pushed: push.length,
      pulled: pulled.length,
      records: final.size,
    };
    await syncDB.meta.put({ key: 'status', value: result });
    window.dispatchEvent(new Event('v6-cloud-sync'));
    return result;
  } finally {
    running = false;
  }
}
export async function cloudStatus() {
  return (await syncDB.meta.get('status'))?.value as SyncResult | undefined;
}
export async function recordCloudFailure(error: unknown) {
  const old = await cloudStatus();
  await syncDB.meta.put({
    key: 'status',
    value: {
      at: '',
      conflicts: [],
      pushed: 0,
      pulled: 0,
      records: 0,
      ...old,
      lastAttemptAt: new Date().toISOString(),
      error: String(error),
    },
  });
  window.dispatchEvent(new Event('v6-cloud-sync'));
}
export async function cloudVersions(recordKey: string, before?: number) {
  return (
    await api('?history=' + encodeURIComponent(recordKey) + (before ? '&before=' + before : ''))
  ).versions as { revision: number; updated_at: string; deleted: number; hash: string }[];
}
export async function recoverCloudRecord(repo: JournalRepository, row: CloudRow, revision: number) {
  const binding = await cloudBinding(),
    identity = await cloudIdentity();
  if (!binding || binding.owner !== identity?.id) throw Error('CLOUD_OWNER_MISMATCH');
  const response = await api('?key=' + encodeURIComponent(row.record_key) + '&version=' + revision);
  if (response.deleted) throw Error('Phiên bản này là mốc xóa.');
  if (row.collection === 'preferences' || row.collection === 'classic')
    throw Error('Khôi phục mục này qua gói sao lưu đầy đủ, không thay đổi dữ liệu giao dịch.');
  const current = await repo.snapshot(),
    docs = new Map((await cloudDocuments(current.data)).map((d) => [key(d), d]));
  docs.set(row.record_key, {
    collection: row.collection,
    id: row.record_id,
    value: response.value,
  });
  // Chunks are immutable; retrieve referenced originals even if now tombstoned.
  if (response.value?.__cloudChunks)
    for (const id of response.value.__cloudChunks) {
      const versions = await cloudVersions('chunks:' + id);
      const v = versions.find((v) => !v.deleted);
      if (!v) throw Error('Thiếu phần lưu trữ gốc');
      const c = await api('?key=' + encodeURIComponent('chunks:' + id) + '&version=' + v.revision);
      docs.set('chunks:' + id, { collection: 'chunks', id, value: c.value });
    }
  if ((await cloudIdentity())?.id !== binding.owner) throw Error('CLOUD_OWNER_MISMATCH');
  await repo.commit(await snapshotFrom(docs), current.revision, 'cloud-version-restore');
}
export async function previewCloudArchive(files: string[]) {
  const records = await parseCloudArchives(files);
  const docs = new Map(
    records
      .filter((r) => !r.deleted)
      .map((r) => [key(r), { collection: r.collection, id: r.id, value: r.value }]),
  );
  const classic = records.filter((r) => !r.deleted && r.collection === 'classic');
  const classicBackup = {
    trades: classic
      .filter(
        (r) =>
          r.id.startsWith('trade:') &&
          r.value &&
          typeof r.value === 'object' &&
          !('deletedAt' in r.value && r.value.deletedAt),
      )
      .map((r) => r.value),
    notes: classic.find((r) => r.id === 'notes')?.value,
    riskSettings: records.find(
      (r) => !r.deleted && r.collection === 'preferences' && r.id === 'risk',
    )?.value,
  };
  return { data: await snapshotFrom(docs), records, classicBackup };
}
export async function restoreCloudArchive(repo: JournalRepository, files: string[]) {
  const preview = await previewCloudArchive(files),
    current = await repo.snapshot();
  await repo.commit(preview.data, current.revision, 'portable-cloud-restore');
  for (const r of preview.records)
    if (!r.deleted && r.collection === 'preferences' && r.id.startsWith('quant:'))
      localStorage.setItem('tuan-v6-quant:' + r.id.slice(6), JSON.stringify(r.value));
  const views = preview.records.find(
    (r) => !r.deleted && r.collection === 'preferences' && r.id === 'views',
  );
  if (views && Array.isArray(views.value))
    await viewRepository.transaction('rw', viewRepository.views, async () => {
      await viewRepository.views.clear();
      await viewRepository.views.bulkPut(views.value as { name: string; hash: string }[]);
    });
}

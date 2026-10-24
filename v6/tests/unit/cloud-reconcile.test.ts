import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { JournalRepository } from '../../src/data/repository';
import {
  enableCloud,
  syncJournal,
  cloudDocuments,
  previewCloudArchive,
  captureClassicArchive,
} from '../../src/data/cloudJournal';
import { canonical, sha256 } from '../../src/data/backup';
it('reconciles only conflicting records while preserving unrelated new records on both sides', async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  vi.stubGlobal('window', new EventTarget());
  let revision = 0;
  type Remote = {
    record_key: string;
    collection: string;
    record_id: string;
    hash: string;
    deleted: number;
    revision: number;
    value: unknown;
  };
  const remote = new Map<string, Remote>();
  const putRemote = async (collection: string, id: string, value: unknown) => {
    revision++;
    remote.set(collection + ':' + id, {
      record_key: collection + ':' + id,
      collection,
      record_id: id,
      value,
      hash: await sha256(canonical(value)),
      deleted: 0,
      revision,
    });
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes('session')) return Response.json({ user: { id: 'reconcile-owner' } });
      if (url.includes('classic-archive')) return Response.json({ pending: 0, next: null });
      const parsed = new URL(url, 'https://test.invalid');
      if (options?.method === 'POST') {
        const m = JSON.parse(String(options.body));
        if (m.expectedOwner !== 'reconcile-owner' || m.expectedRevision !== revision)
          return Response.json({ error: 'conflict' }, { status: 409 });
        revision++;
        for (const d of m.records)
          remote.set(d.collection + ':' + d.id, {
            record_key: d.collection + ':' + d.id,
            collection: d.collection,
            record_id: d.id,
            value: d.value,
            hash: await sha256(canonical(d.deleted ? null : d.value)),
            deleted: d.deleted ? 1 : 0,
            revision,
          });
        return Response.json({ revision });
      }
      const k = parsed.searchParams.get('key');
      if (k) {
        const r = remote.get(k);
        return Response.json({
          owner: 'reconcile-owner',
          value: r?.value,
          hash: r?.hash,
          revision: r?.revision,
        });
      }
      return Response.json({
        owner: 'reconcile-owner',
        revision,
        records: [...remote.values()].map(({ value, ...r }) => {
          void value;
          return r;
        }),
        next: null,
      });
    }),
  );
  const repo = new JournalRepository('cloud-reconcile-' + crypto.randomUUID());
  try {
    await repo.importV3(JSON.stringify(original), 0);
    await enableCloud('reconcile-owner');
    await syncJournal(repo);
    let local = await repo.snapshot();
    const journal = local.data.journals[0];
    await repo.commit(
      {
        ...local.data,
        journals: local.data.journals.map((j) =>
          j.id === journal.id ? { ...j, name: 'local choice' } : j,
        ),
        errorTags: [
          ...local.data.errorTags,
          {
            id: 'local-only',
            journalId: journal.id,
            code: 'local',
            name: 'Local',
            stage: 'entry',
            tone: 'neu',
          },
        ],
      },
      local.revision,
    );
    await putRemote('journals', journal.id, { ...journal, name: 'cloud choice' });
    await putRemote('setups', 'remote-only', {
      id: 'remote-only',
      journalId: journal.id,
      name: 'Remote',
      checklist: [],
    });
    expect((await syncJournal(repo)).conflicts).toContain('journals:' + journal.id);
    await syncJournal(repo, 'local');
    local = await repo.snapshot();
    expect(local.data.journals[0].name).toBe('local choice');
    expect(local.data.setups.some((s) => s.id === 'remote-only')).toBe(true);
    expect(remote.get('setups:remote-only')?.deleted).toBe(0);
    expect(remote.has('errorTags:local-only')).toBe(true);
    await repo.commit(
      {
        ...local.data,
        journals: local.data.journals.map((j) => ({ ...j, name: 'local second' })),
        setups: [
          ...local.data.setups,
          { id: 'another-local', journalId: journal.id, name: 'Another', checklist: [] },
        ],
      },
      local.revision,
    );
    await putRemote('journals', journal.id, { ...journal, name: 'cloud second' });
    await putRemote('errorTags', 'another-remote', {
      id: 'another-remote',
      journalId: journal.id,
      code: 'another',
      name: 'Another remote',
      stage: 'exit',
      tone: 'neu',
    });
    expect((await syncJournal(repo)).conflicts.length).toBe(1);
    await syncJournal(repo, 'cloud');
    local = await repo.snapshot();
    expect(local.data.journals[0].name).toBe('cloud second');
    expect(local.data.setups.some((s) => s.id === 'another-local')).toBe(true);
    expect(remote.has('setups:another-local')).toBe(true);
    expect(local.data.errorTags.some((s) => s.id === 'another-remote')).toBe(true);
    expect(local.data.trades).toHaveLength(30);
  } finally {
    await repo.delete();
    vi.unstubAllGlobals();
  }
});

it('retains distinct Unicode fragments across the 500k chunk boundary and verifies restoration', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const { migrateV3 } = await import('../../src/data/migrateV3');
  const { data } = await migrateV3(JSON.stringify(original));
  const first = data.notes[0];
  const skeleton = canonical({ ...first, body: '' });
  const prefix = skeleton.indexOf('"body":"') + '"body":"'.length;
  const unicodeNotes = ['😀', '🨀'].map((emoji, i) => ({
    ...first,
    id: 'unicode-' + i,
    body: 'x'.repeat(499999 - prefix) + emoji + 'tail',
  }));
  data.notes.push(...unicodeNotes);
  const docs = await cloudDocuments(data);
  const chunks = docs.filter((d) => d.collection === 'chunks');
  const ids = new Set(chunks.map((d) => d.id));
  expect(ids.size).toBe(chunks.length);
  for (const d of chunks) expect(d.id).toBe(await sha256(canonical(d.value)));
  const records = await Promise.all(
    docs.map(async (d) => ({ ...d, deleted: false, hash: await sha256(canonical(d.value)) })),
  );
  const archive = [
    { format: 'tuan-cloud-archive', version: 1, revision: 1, after: '', archiveId: 'unicode:1' },
    ...records,
    { complete: true, next: null, revision: 1 },
  ]
    .map((x) => JSON.stringify(x))
    .join('\n');
  const restored = await previewCloudArchive([archive]);
  expect(restored.data.notes.map((n) => n.body)).toEqual(data.notes.map((n) => n.body));
});
it('checks the real Classic queue when seeding ends on the last bounded iteration', async () => {
  let seeds = 0,
    drains = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_: string, options: RequestInit) => {
      const m = JSON.parse(String(options.body));
      if (m.seed) {
        seeds++;
        return Response.json({ next: seeds <= 2 ? 'next-' + seeds : null });
      }
      drains++;
      return Response.json({ pending: 7 });
    }),
  );
  const result = await captureClassicArchive('seed-boundary-' + crypto.randomUUID());
  expect(seeds).toBe(4);
  expect(drains).toBe(1);
  expect(result).toEqual({ pending: 7, seeding: false });
});

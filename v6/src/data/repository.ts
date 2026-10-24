import Dexie, { type Table } from 'dexie';
import { validateSnapshot, emptySnapshot, type Snapshot } from './snapshot';
import { canonical, sha256, encodeBackup, decodeBackup } from './backup';
import { migrateV3 } from './migrateV3';
import { tradeFacts } from '../core/trade';
import { analyze } from '../core/analyze';
interface State {
  id: 'current';
  cacheToken?: string;
  revision: number;
  data: Snapshot;
}
interface Recovery {
  id: string;
  at: string;
  reason: string;
  raw: string;
}
interface TradeIndex {
  id: string;
  journalId: string;
  closedAt?: string;
  symbol: string;
  setupId?: string;
  status: string;
  reviewed: number;
}
export class JournalRepository extends Dexie {
  private states!: Table<State, string>;
  private recovery!: Table<Recovery, string>;
  private tradeIndex!: Table<TradeIndex, string>;
  constructor(name = 'tuan-trader-v6') {
    super(name);
    this.version(1).stores({
      states: 'id',
      recovery: 'id,at,reason',
      tradeIndex: 'id,journalId,[journalId+closedAt],symbol,setupId,status,reviewed',
    });
  }
  async snapshot() {
    const state = await this.states.get('current');
    return state
      ? {
          revision: state.revision,
          cacheToken: state.cacheToken ?? '',
          data: structuredClone(state.data),
        }
      : { revision: 0, cacheToken: '', data: emptySnapshot() };
  }
  async recoveries() {
    return (await this.recovery.toArray()).map(({ id, at, reason }) => ({ id, at, reason }));
  }
  async original(id: string) {
    return (await this.recovery.get(id))?.raw;
  }
  private async preserve(raw: string, reason: string) {
    const id = await sha256(reason + '\n' + raw);
    await this.recovery.put({ id, at: new Date().toISOString(), reason, raw });
    return id;
  }
  async commit(input: Snapshot, expectedRevision: number, reason = 'edit') {
    const data = validateSnapshot(input),
      before = await this.snapshot();
    if (before.revision !== expectedRevision) throw Error('STALE_REVISION');
    const raw = await encodeBackup(before.data),
      id = await sha256(raw),
      index = data.trades.map((t) => ({
        id: t.id,
        journalId: t.journalId,
        closedAt: tradeFacts(t).closeTime,
        symbol: t.symbol,
        setupId: t.setupId,
        status: t.status,
        reviewed: t.review.done ? 1 : 0,
      }));
    await this.transaction('rw', [this.states, this.recovery, this.tradeIndex], async () => {
      const current = await this.states.get('current');
      if ((current?.revision ?? 0) !== expectedRevision) throw Error('STALE_REVISION');
      await this.recovery.put({
        id,
        at: new Date().toISOString(),
        reason: 'before-' + reason,
        raw,
      });
      await this.tradeIndex.clear();
      await this.tradeIndex.bulkPut(index);
      await this.states.put({
        id: 'current',
        revision: expectedRevision + 1,
        cacheToken: crypto.randomUUID(),
        data,
      });
    });
    return expectedRevision + 1;
  }
  async exportJSON() {
    return encodeBackup((await this.snapshot()).data);
  }
  async previewRestore(raw: string) {
    const parsed = JSON.parse(raw) as { schemaVersion?: number };
    return parsed.schemaVersion === 3 ? (await migrateV3(raw)).data : decodeBackup(raw);
  }
  async restore(raw: string, expectedRevision: number) {
    await this.preserve(raw, 'source-before-restore');
    const data = await this.previewRestore(raw);
    return this.commit(data, expectedRevision, 'restore');
  }
  async importV3(raw: string, expectedRevision: number) {
    await this.preserve(raw, 'original-v3-before-migration');
    const migration = await migrateV3(raw),
      current = await this.snapshot();
    if (current.revision !== expectedRevision) throw Error('STALE_REVISION');
    if (migration.data.journals.some((j) => current.data.journals.some((old) => old.id === j.id)))
      throw Error('JOURNAL_ALREADY_EXISTS');
    const next = Object.fromEntries(
      Object.keys(current.data).map((key) => [
        key,
        [...current.data[key as keyof Snapshot], ...migration.data[key as keyof Snapshot]],
      ]),
    ) as Snapshot;
    // Migration verifies v3 accounting per trade/event. This second pass validates
    // referential integrity and pure v6 derivation before any transaction commits.
    for (const j of migration.data.journals)
      analyze(j, migration.data.trades, {}, migration.data.cashFlows);
    await this.commit(next, expectedRevision, 'migration');
    return { ...migration.report, revision: expectedRevision + 1 };
  }
  async tradesInRange(journalId: string, from: string, to: string) {
    const ids = (
      await this.tradeIndex
        .where('[journalId+closedAt]')
        .between([journalId, from], [journalId, to], true, true)
        .toArray()
    ).map((r) => r.id);
    const s = await this.snapshot();
    return s.data.trades.filter((t) => ids.includes(t.id));
  }
  async restoreRecovery(id: string, expectedRevision: number) {
    const raw = await this.original(id);
    if (!raw) throw Error('RECOVERY_NOT_FOUND');
    return this.restore(raw, expectedRevision);
  }
  async equals(raw: string) {
    return canonical(await decodeBackup(raw)) === canonical((await this.snapshot()).data);
  }
}

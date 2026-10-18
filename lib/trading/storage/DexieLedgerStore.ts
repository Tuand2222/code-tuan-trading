import Dexie, { type Table } from 'dexie';
import { anchorSnapshot, replayLedger, rollbackPreview } from '../application/replayLedger';
import { bookKey, cashKey, dedupeMultiset, fillKey } from '../domain/identity';
import { normalizeCash, normalizeFill } from '../domain/normalize';
import { storageHealth } from './browserStorage';
import { accountSchema, batchSchema, cashSchema, fillSchema, overlaySchema, type Account, type CashEvent, type Fill, type ImportBatch, type LedgerSnapshot, type TradeOverlay } from '../domain/types';
import { decodeBackup, encodeBackup, restoreDryRun, validateSnapshot } from './backup';
import type { CommitInput, CommitResult, LedgerStore } from './LedgerStore';

export class DexieLedgerStore extends Dexie implements LedgerStore {
  accounts!: Table<Account, string>; batches!: Table<ImportBatch, string>; fills!: Table<Fill, string>; cashEvents!: Table<CashEvent, string>; overlays!: Table<TradeOverlay, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  archives!: Table<{ id: string; createdAt: string; kind: string; json: string }, string>;
  constructor(name = 'trading-plan-pro-ledger-v3') {
    super(name);
    this.version(1).stores({ accounts: 'accountId', batches: 'batchId,accountId,idempotencyKey', fills: 'fillId,accountId,bookKey,batchId,dedupeKey', cashEvents: 'eventId,accountId,batchId,dedupeKey', overlays: 'overlayId', meta: 'key', archives: 'id,createdAt' });
  }
  private ledgerTables() { return [this.accounts, this.batches, this.fills, this.cashEvents, this.overlays, this.meta, this.archives]; }
  async getLedgerVersion(): Promise<number> { return (await this.meta.get('ledgerVersion'))?.value as number ?? 0; }
  async listEntries(scope: { bookKey?: string; active?: boolean; accountId?: string } = {}): Promise<Fill[]> {
    return (await this.fills.toArray()).filter(f => (scope.bookKey === undefined || f.bookKey === scope.bookKey) && (scope.active === undefined || f.active === scope.active) && (scope.accountId === undefined || f.accountId === scope.accountId));
  }
  async snapshot(): Promise<{ version: number; data: LedgerSnapshot }> {
    return this.transaction('r', this.ledgerTables(), async () => ({ version: await this.getLedgerVersion(), data: {
      accounts: await this.accounts.toArray(), batches: await this.batches.toArray(), fills: await this.fills.toArray(), cashEvents: await this.cashEvents.toArray(), overlays: await this.overlays.toArray(),
      settings: (await this.meta.get('settings'))?.value as Record<string, unknown> ?? {},
    } }));
  }
  private async replace(data: LedgerSnapshot, expected: number, archive?: { kind: string; json: string }): Promise<number> {
    const validated = validateSnapshot(data);
    // All crypto/replay work finishes before this transaction. Only IndexedDB awaits here.
    return this.transaction('rw', this.ledgerTables(), async () => {
      if (await this.getLedgerVersion() !== expected) throw new Error('STALE_LEDGER_VERSION');
      if (archive) await this.archives.add({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...archive });
      await this.accounts.clear(); await this.batches.clear(); await this.fills.clear(); await this.cashEvents.clear(); await this.overlays.clear();
      await this.accounts.bulkAdd(validated.accounts); await this.batches.bulkAdd(validated.batches); await this.fills.bulkAdd(validated.fills); await this.cashEvents.bulkAdd(validated.cashEvents); await this.overlays.bulkAdd(validated.overlays);
      await this.meta.put({ key: 'settings', value: validated.settings }); await this.meta.put({ key: 'ledgerVersion', value: expected + 1 });
      return expected + 1;
    });
  }
  async commitBatch(input: CommitInput, expected: number): Promise<CommitResult> {
    const snapshot = await this.snapshot(); if (snapshot.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    const batch = batchSchema.parse(input.batch), data = snapshot.data;
    const already = data.batches.find(b => b.idempotencyKey === batch.idempotencyKey && b.accountId === batch.accountId && b.status === 'committed');
    if (already) return { version: expected, newEntries: 0, duplicates: input.fills.length + input.cashEvents.length, batchId: already.batchId };
    if (data.batches.some(b => b.batchId === batch.batchId)) throw new Error('BATCH_ID_ALREADY_USED');
    if (batch.status !== 'staged' || batch.ledgerVersionAtStage !== expected) throw new Error('INVALID_STAGE');
    const accounts = [...data.accounts];
    for (const a of input.accounts ?? []) {
      const parsed = accountSchema.parse(a), old = accounts.find(x => x.accountId === a.accountId);
      if (old && JSON.stringify(old) !== JSON.stringify(parsed)) throw new Error('ACCOUNT_CHANGE_REQUIRES_REPLAY');
      if (!old) accounts.push(parsed);
    }
    const account = accounts.find(a => a.accountId === batch.accountId); if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    const fills: Fill[] = [];
    for (const raw of input.fills) {
      const f = normalizeFill(fillSchema.parse(raw)); if (f.accountId !== account.accountId || f.batchId !== batch.batchId) throw new Error('ENTRY_SCOPE_MISMATCH');
      f.bookKey = bookKey(account, f); f.dedupeKey = await fillKey(f, account); f.active = true; fills.push(f);
    }
    const cash: CashEvent[] = [];
    for (const raw of input.cashEvents) {
      const e = normalizeCash(cashSchema.parse(raw)); if (e.accountId !== account.accountId || e.batchId !== batch.batchId) throw new Error('ENTRY_SCOPE_MISMATCH');
      e.dedupeKey = await cashKey(e, account); e.active = true; cash.push(e);
    }
    const fd = dedupeMultiset(fills, data.fills), cd = dedupeMultiset(cash, data.cashEvents);
    if (fd.conflicts.length || cd.conflicts.length) throw new Error('IMPORT_CONFLICT');
    const idMap = new Map<string, string>();
    const newFills = fd.newEntries.map(f => { const id = crypto.randomUUID(); idMap.set(f.fillId, id); return { ...f, fillId: id }; });
    const newCash = cd.newEntries.map(e => ({ ...e, eventId: crypto.randomUUID(), reconcilesFillId: e.reconcilesFillId ? idMap.get(e.reconcilesFillId) ?? e.reconcilesFillId : undefined }));
    const committed: ImportBatch = { ...batch, status: 'committed', committedAt: new Date().toISOString(), counts: { ...batch.counts, newEntries: newFills.length + newCash.length, duplicates: fd.duplicates.length + cd.duplicates.length, conflicts: 0 } };
    let next: LedgerSnapshot = { ...data, accounts, batches: [...data.batches, committed], fills: [...data.fills, ...newFills], cashEvents: [...data.cashEvents, ...newCash],
      overlays: [...data.overlays, ...(input.overlays ?? []).map(o => ({ ...overlaySchema.parse(o), anchorFillIds: o.anchorFillIds.map(id => idMap.get(id) ?? id) }))] };
    const replay = await replayLedger(next);
    const warnings = [...batch.warnings, ...replay.anomalies];
    if (warnings.some(w => w.severity === 'blocker')) throw new Error(`IMPORT_BLOCKED:${warnings.filter(w => w.severity === 'blocker').map(w => w.code).join(',')}`);
    if (warnings.some(w => w.severity === 'needs-confirmation' && !input.confirmedWarnings?.includes(w.code))) throw new Error('IMPORT_CONFIRMATION_REQUIRED');
    next = await anchorSnapshot(next);
    const version = await this.replace(next, expected);
    if (!data.batches.length) await storageHealth(undefined, true).catch(() => undefined);
    return { version, newEntries: committed.counts.newEntries, duplicates: committed.counts.duplicates, batchId: committed.batchId };
  }
  async rollbackBatch(batchId: string, expected: number): Promise<number> {
    const current = await this.snapshot(); if (current.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    const preview = await rollbackPreview(current.data, batchId);
    return this.replace(preview.data, expected);
  }
  async saveOverlay(overlay: TradeOverlay, expected: number): Promise<number> {
    const current = await this.snapshot(); if (current.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    const parsed = overlaySchema.parse(overlay), next = { ...current.data, overlays: [...current.data.overlays.filter(o => o.overlayId !== parsed.overlayId), parsed] };
    return this.replace(await anchorSnapshot(next), expected);
  }
  async exportAll(): Promise<string> { return encodeBackup((await this.snapshot()).data); }
  async dryRunRestore(json: string) { return restoreDryRun(json, (await this.snapshot()).data); }
  async importAll(json: string, expected: number): Promise<number> {
    const data = await decodeBackup(json), current = await this.snapshot(); if (current.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    return this.replace(await anchorSnapshot(data), expected, { kind: 'before-restore', json: await encodeBackup(current.data) });
  }
  async importLegacy(data: LedgerSnapshot, rawBackup: string, expected: number): Promise<number> {
    const current = await this.snapshot(); if (current.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    if (current.data.fills.length || current.data.batches.length || current.data.cashEvents.length) throw new Error('LEGACY_MIGRATION_REQUIRES_EMPTY_LEDGER');
    return this.replace(await anchorSnapshot(data), expected, { kind: 'legacy-original', json: rawBackup });
  }
  async setSettings(settings: Record<string, unknown>, expected: number) {
    const current = await this.snapshot(); if (current.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    return this.replace({ ...current.data, settings }, expected);
  }
  async updateAccount(account: Account, expected: number): Promise<number> {
    const current = await this.snapshot(); if (current.version !== expected) throw new Error('STALE_LEDGER_VERSION');
    const parsed = accountSchema.parse(account), previous = current.data.accounts.find(a => a.accountId === parsed.accountId);
    if (!previous) throw new Error('ACCOUNT_NOT_FOUND');
    if (previous.accountKey !== parsed.accountKey || previous.platform !== parsed.platform || previous.bookMode !== parsed.bookMode || previous.baseCcy !== parsed.baseCcy) throw new Error('ACCOUNT_IDENTITY_CHANGE_REQUIRES_MIGRATION');
    const next = { ...current.data, accounts: current.data.accounts.map(a => a.accountId === parsed.accountId ? parsed : a) };
    return this.replace(await anchorSnapshot(next), expected, { kind: 'before-account-update', json: await encodeBackup(current.data) });
  }
  async markBackupDownloaded(at = new Date().toISOString()) { await this.meta.put({ key: 'lastBackupAt', value: at }); }
}

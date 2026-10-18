import { z } from 'zod';
import { D, positive } from '../domain/decimal';
import { canonicalJSON, hash } from '../domain/identity';
import { snapshotSchema, type LedgerSnapshot } from '../domain/types';

export const SCHEMA_VERSION = 3;
const envelopeSchema = z.object({ schemaVersion: z.literal(SCHEMA_VERSION), exportedAt: z.string().datetime(), data: snapshotSchema, checksum: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export function validateSnapshot(input: unknown): LedgerSnapshot {
  const data = snapshotSchema.parse(input);
  const unique = (ids: string[], name: string) => { if (new Set(ids).size !== ids.length) throw new Error(`DUPLICATE_${name}`); };
  unique(data.accounts.map(a => a.accountId), 'ACCOUNT'); unique(data.accounts.map(a => JSON.stringify([a.platform, a.accountKey])), 'ACCOUNT_KEY');
  unique(data.batches.map(b => b.batchId), 'BATCH'); unique(data.fills.map(f => f.fillId), 'FILL'); unique(data.cashEvents.map(e => e.eventId), 'CASH'); unique(data.overlays.map(o => o.overlayId), 'OVERLAY');
  unique(data.fills.filter(f => f.active).map(f => JSON.stringify([f.dedupeKey, f.dedupeOcc])), 'ACTIVE_FILL_OCCURRENCE');
  unique(data.cashEvents.filter(f => f.active).map(f => JSON.stringify([f.dedupeKey, f.dedupeOcc])), 'ACTIVE_CASH_OCCURRENCE');
  const accounts = new Set(data.accounts.map(a => a.accountId)), batches = new Map(data.batches.map(b => [b.batchId, b]));
  for (const a of data.accounts) { positive(a.contractMultiplier); new Intl.DateTimeFormat('en', { timeZone: a.sourceTimezone }); for (const opening of a.openingBalances) { D(opening.qty); positive(opening.avgPrice); } }
  for (const b of data.batches) {
    if (!accounts.has(b.accountId)) throw new Error('ORPHAN_BATCH');
    if (b.fixedRiskVND !== undefined) positive(b.fixedRiskVND);
    unique(b.fx.map(x => x.ccy), 'FX_CURRENCY'); for (const fx of b.fx) { positive(fx.rateToVND); if (fx.ccy === 'VND' && !D(fx.rateToVND).eq(1)) throw new Error('INVALID_VND_RATE'); }
  }
  for (const e of [...data.fills, ...data.cashEvents]) {
    const batch = batches.get(e.batchId);
    if (!accounts.has(e.accountId) || !batch || batch.accountId !== e.accountId) throw new Error('ORPHAN_ENTRY');
    if (e.active !== (batch.status === 'committed')) throw new Error('INVALID_ACTIVE_STATUS');
    if ('qty' in e) positive(e.qty, 'quantity');
    if ('price' in e) positive(e.price, 'price');
    if ('costs' in e) for (const c of e.costs) { if (c.amount !== undefined) D(c.amount); if (c.rateToVND !== undefined) positive(c.rateToVND); }
  }
  for (const o of data.overlays) if (o.riskOverrideVND !== undefined) positive(o.riskOverrideVND);
  return data;
}
export async function encodeBackup(data: LedgerSnapshot, exportedAt = new Date().toISOString()): Promise<string> {
  const body = { schemaVersion: SCHEMA_VERSION, exportedAt, data: validateSnapshot(data) };
  return canonicalJSON({ ...body, checksum: await hash(body) });
}
export async function decodeBackup(json: string): Promise<LedgerSnapshot> {
  if (new TextEncoder().encode(json).length > 100 * 1024 * 1024) throw new Error('BACKUP_TOO_LARGE');
  const parsed = envelopeSchema.parse(JSON.parse(json)); const { checksum, ...body } = parsed;
  if (checksum !== await hash(body)) throw new Error('CHECKSUM_MISMATCH');
  return validateSnapshot(parsed.data);
}
export async function restoreDryRun(json: string, current: LedgerSnapshot) {
  const data = await decodeBackup(json);
  const conflicts = data.fills.filter(f => current.fills.some(old => old.fillId === f.fillId && canonicalJSON(old) !== canonicalJSON(f))).map(f => f.fillId);
  return { data, conflicts, counts: { accounts: data.accounts.length, batches: data.batches.length, fills: data.fills.length, cashEvents: data.cashEvents.length, overlays: data.overlays.length }, replacesCurrent: true };
}

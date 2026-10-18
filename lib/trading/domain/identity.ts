import { D, dec } from './decimal';
import type { Account, CashEvent, Fill } from './types';

export function canonicalJSON(value: unknown): string {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, val]) => [k, normalize(val)])) : v;
  return JSON.stringify(normalize(value));
}
export async function hash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJSON(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function symbolIdentity(value: string, suffixes: string[] = []): string {
  let symbol = value.trim().toUpperCase();
  // Only strip explicitly configured broker suffixes, never guess an instrument alias.
  for (const suffix of suffixes) if (suffix && symbol.endsWith(suffix.toUpperCase())) { symbol = symbol.slice(0, -suffix.length); break; }
  if (!symbol) throw new Error('MISSING_SYMBOL'); return symbol;
}
export function bookKey(account: Account, fill: Pick<Fill, 'symbol' | 'positionId' | 'positionSide'>): string {
  const hedge = account.bookMode === 'hedging' ? fill.positionId ?? fill.positionSide : undefined;
  if (account.bookMode === 'hedging' && !hedge) throw new Error('MISSING_HEDGE_ID');
  return JSON.stringify([account.accountId, fill.symbol, hedge ?? null]);
}
export async function fillKey(fill: Fill, account: Account): Promise<string> {
  const common = [fill.normVersion, account.platform, account.accountKey, fill.symbol, fill.role];
  if (fill.nativeId) return hash([...common, 'native', fill.nativeId]);
  if (fill.role === 'fill') return hash([...common, new Date(fill.tsUtc).toISOString(), fill.side, dec(D(fill.qty)), dec(D(fill.price)), fill.positionId ?? fill.positionSide ?? null, fill.adjustment ?? null]);
  return hash([...common, new Date(fill.closeTsUtc).toISOString(), dec(D(fill.qty)), fill.role === 'reported-position' ? [new Date(fill.openTsUtc).toISOString(), fill.direction, dec(D(fill.openPrice))] : dec(D(fill.avgCostPrice)), dec(D(fill.closePrice))]);
}
export async function cashKey(event: CashEvent, account: Account): Promise<string> {
  return hash([event.normVersion, account.platform, account.accountKey, 'cash', event.kind, event.symbol ?? null,
    ...(event.nativeId ? ['native', event.nativeId] : [new Date(event.tsUtc).toISOString(), dec(D(event.amount)), event.ccy])]);
}
export function economicSignature(entry: Fill | CashEvent): string {
  const ignored = new Set(['fillId', 'eventId', 'batchId', 'dedupeKey', 'dedupeOcc', 'active', 'raw']);
  const value: Record<string, unknown> = Object.fromEntries(Object.entries(entry).filter(([k]) => !ignored.has(k)));
  if ('costs' in value) value.costs = (entry as Fill).costs.map(c => Object.fromEntries(Object.entries(c).filter(([key]) => key !== 'rateToVND' && key !== 'batchId')));
  return canonicalJSON(value);
}
export function dedupeMultiset<T extends Fill | CashEvent>(incoming: T[], existing: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of existing.filter(x => x.active)) groups.set(row.dedupeKey, [...(groups.get(row.dedupeKey) ?? []), row]);
  const seen = new Map<string, number>(), newEntries: T[] = [], duplicates: T[] = [], conflicts: T[] = [];
  const nativeIncoming = new Map<string, string>();
  for (const original of incoming) {
    const occurrence = (seen.get(original.dedupeKey) ?? 0) + 1; seen.set(original.dedupeKey, occurrence);
    const row = { ...original, dedupeOcc: occurrence };
    const old = groups.get(row.dedupeKey) ?? [];
    const signature = economicSignature(row);
    if (row.nativeId) {
      const previous = nativeIncoming.get(row.dedupeKey);
      if (old.some(x => economicSignature(x) !== signature) || (previous !== undefined && previous !== signature)) { conflicts.push(row); continue; }
      nativeIncoming.set(row.dedupeKey, signature);
      if (old.length || previous !== undefined) duplicates.push(row); else newEntries.push(row);
    } else if (occurrence <= old.length) {
      // Same economics but amended fees without a source ID also require explicit resolution.
      if (economicSignature(old[occurrence - 1]) !== signature) conflicts.push(row); else duplicates.push(row);
    } else newEntries.push(row);
  }
  return { newEntries, duplicates, conflicts };
}

import { z } from 'zod';
import { validateSnapshot, type Snapshot } from './snapshot';
export const canonical = (value: unknown): string => JSON.stringify(normalize(value));
function normalize(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b, 'en'))
            .map(([k, v]) => [k, normalize(v)]),
        )
      : value;
}
export async function sha256(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
const envelopeSchema = z
  .object({
    app: z.literal('Trading Plan Pro'),
    schemaVersion: z.literal(4),
    exportedAt: z.iso.datetime(),
    data: z.unknown(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export async function encodeBackup(data: Snapshot, exportedAt = new Date().toISOString()) {
  const body = {
    app: 'Trading Plan Pro',
    schemaVersion: 4,
    exportedAt,
    data: validateSnapshot(data),
  };
  return canonical({ ...body, checksum: await sha256(canonical(body)) });
}
export async function decodeBackup(raw: string) {
  if (new TextEncoder().encode(raw).length > 100 * 1024 * 1024) throw Error('BACKUP_TOO_LARGE');
  const e = envelopeSchema.parse(JSON.parse(raw)),
    { checksum, ...body } = e;
  if (checksum !== (await sha256(canonical(body)))) throw Error('CHECKSUM_MISMATCH');
  return validateSnapshot(e.data);
}

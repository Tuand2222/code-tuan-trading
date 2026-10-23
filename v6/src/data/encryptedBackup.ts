import { z } from 'zod';
const schema = z
  .object({
    kind: z.literal('Trading Plan Pro encrypted workspace'),
    version: z.literal(1),
    iterations: z.literal(600000),
    salt: z.string().max(64),
    iv: z.string().max(64),
    ciphertext: z.string().max(150 * 1024 * 1024),
  })
  .strict();
const base64 = (bytes: Uint8Array) => {
  let value = '';
  for (let i = 0; i < bytes.length; i += 8192)
    value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
};
const bytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array<ArrayBuffer>, usage: 'encrypt' | 'decrypt') {
  if (password.length < 8) throw Error('PASSWORD_MIN_8');
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}
export async function encryptBackup(raw: string, password: string) {
  if (new TextEncoder().encode(raw).length > 100 * 1024 * 1024) throw Error('BACKUP_TOO_LARGE');
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(password, salt, 'encrypt'),
    new TextEncoder().encode(raw),
  );
  return JSON.stringify({
    kind: 'Trading Plan Pro encrypted workspace',
    version: 1,
    iterations: 600000,
    salt: base64(salt),
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(ciphertext)),
  });
}
export async function decryptBackup(raw: string, password: string) {
  if (raw.length > 150 * 1024 * 1024) throw Error('BACKUP_TOO_LARGE');
  const envelope = schema.parse(JSON.parse(raw)),
    salt = bytes(envelope.salt),
    iv = bytes(envelope.iv);
  if (salt.length !== 16 || iv.length !== 12) throw Error('INVALID_ENCRYPTION_PARAMETERS');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await key(password, salt, 'decrypt'),
    bytes(envelope.ciphertext),
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}

import { env } from "cloudflare:workers";

type BrokerSecrets = {
  apiKey?: string;
  apiSecret?: string;
  symbols?: string[];
  fxRate?: number;
  bridgeUrl?: string;
  bridgeToken?: string;
  brokerName?: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getEncryptionKey() {
  const secret = (env as unknown as Record<string, string | undefined>)[
    "BROKER_ENCRYPTION_KEY"
  ];
  if (!secret) throw new Error("Broker encryption is not configured");
  const raw = base64ToBytes(secret);
  if (raw.byteLength !== 32) throw new Error("Broker encryption key is invalid");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptBrokerSecrets(value: BrokerSecrets) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptBrokerSecrets(value: string): Promise<BrokerSecrets> {
  const [version, ivValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new Error("Stored broker credentials are invalid");
  }
  const key = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) },
    key,
    base64ToBytes(ciphertextValue),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as BrokerSecrets;
}

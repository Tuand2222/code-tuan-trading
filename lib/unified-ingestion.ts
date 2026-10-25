/** Identity is exact; a rounded fingerprint is only a review candidate, never a deletion rule. */
export interface IngestionTrade {
  id: string;
  symbol: string;
  side: string;
  date: string;
  source?: string;
  accountId?: string | null;
  externalId?: string | null;
  externalOrderId?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  entryPrice?: number;
  quantity?: number;
  recordKind?: string;
  pnl?: number;
  fees?: number;
  note?: string;
  version?: number;
  dedupHash?: string | null;
  semanticHash?: string | null;
  rawPayloadJson?: string | null;
  sourceType?: string;
}
export const normalizeSymbol = (s: string) =>
  s
    .toUpperCase()
    .replace(/\.P$/, "")
    .replace(/[\s/_-]/g, "");
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        /(api.?key|api.?secret|token|password|credentials|authorization)/i.test(
          key,
        )
          ? "[redacted]"
          : redactSecrets(v),
      ]),
    );
  return value;
}
export function normalizeBroker(s = "manual") {
  const name = s.toLowerCase();
  for (const broker of [
    "binance",
    "bybit",
    "okx",
    "exness",
    "vps",
    "ssi",
    "tcbs",
    "mt5",
    "mt4",
    "cqg",
  ])
    if (name.includes(broker)) return broker;
  if (name.includes("metatrader 5")) return "mt5";
  if (name.includes("metatrader 4")) return "mt4";
  return (
    name
      .replace(/\b(csv|excel|api|webhook|import)\b/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "") || "manual"
  );
}
export async function sha256(value: string | Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : (value as Uint8Array<ArrayBuffer>),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function identifyTrade<T extends IngestionTrade>(
  t: T,
  user = "device",
): Promise<T & { dedupHash: string; semanticHash: string }> {
  const broker = normalizeBroker(t.source);
  const account = t.accountId || "unassigned";
  const external = t.externalId?.startsWith("import-") ? null : t.externalId;
  const identity = JSON.stringify([
    user,
    broker,
    account,
    normalizeSymbol(t.symbol),
    t.recordKind ?? "position",
    external?.replace(new RegExp("^" + normalizeSymbol(t.symbol) + ":"), "") ||
      t.id,
  ]);
  const time = Date.parse(t.openedAt || t.closedAt || t.date);
  const fingerprint = JSON.stringify([
    user,
    account,
    normalizeSymbol(t.symbol),
    t.side,
    Number.isFinite(time) ? Math.floor(time / 60000) : t.date,
    (t.entryPrice ?? 0).toFixed(4),
    (t.quantity ?? 0).toFixed(4),
  ]);
  return {
    ...t,
    dedupHash: await sha256(identity),
    semanticHash: await sha256(fingerprint),
  };
}
export type Resolution = "skip" | "enrich" | "keep";
export async function identifyTrades<T extends IngestionTrade>(rows:T[],user='device'){
  const result:Array<T & {dedupHash:string;semanticHash:string}>=[];
  for(let i=0;i<rows.length;i+=250)result.push(...await Promise.all(rows.slice(i,i+250).map(t=>identifyTrade(t,user))));
  return result;
}
export async function planIngestion<T extends IngestionTrade>(
  existing: T[],
  incoming: T[],
  user = "device",
) {
  const known = await identifyTrades(existing,user);
  const exact = new Map(known.map((t) => [t.dedupHash, t]));
  const semantic=new Map<string,{row:typeof known[number];index:number}>(),buckets=new Map<string,Array<{row:typeof known[number];index:number}>>();
  const group=(t:T)=>[t.accountId||'unassigned',normalizeSymbol(t.symbol),t.side].join('|');
  known.forEach((row,index)=>{if(!semantic.has(row.semanticHash))semantic.set(row.semanticHash,{row,index});const time=Date.parse(row.openedAt||'');if(Number.isFinite(time)){const key=group(row)+'|'+Math.floor(time/300000);const bucket=buckets.get(key)||[];bucket.push({row,index});buckets.set(key,bucket);}});
  const seen = new Map(exact);
  const additions: typeof known = [];
  const duplicates: Array<{ incoming: T; existing: T; hash: string }> = [];
  const candidates: Array<{ incoming: T; existing: T; reason: string }> = [];
  for (const t of await identifyTrades(incoming,user)) {
    const old = seen.get(t.dedupHash);
    if (old) {
      duplicates.push({ incoming: t, existing: old, hash: t.dedupHash });
      continue;
    }
    // Never collapse real fills which happen to share price/time/quantity.
    const match=semantic.get(t.semanticHash);let candidate=match?.row;
    const time=Date.parse(t.openedAt||'');
    if(Number.isFinite(time)){
      let first=match?.index??Infinity;
      for(const bin of [-1,0,1])for(const entry of buckets.get(group(t)+'|'+(Math.floor(time/300000)+bin))||[]){if(entry.index<first&&Math.abs(Date.parse(entry.row.openedAt!)-time)<=300000){candidate=entry.row;first=entry.index;}if(first===0)break;}
    }
    if (candidate)
      candidates.push({
        incoming: t,
        existing: candidate,
        reason:
          candidate.semanticHash === t.semanticHash
            ? "Dấu vân tay gần giống"
            : "Cùng mã/chiều trong 5 phút",
      });
    additions.push(t);
    seen.set(t.dedupHash, t);
  }
  return { additions, duplicates, candidates };
}

import Dexie, { type EntityTable } from "dexie";
type Item = { key: string; value: unknown; updatedAt: string };
export type QueuedMutation = {
  id: string;
  owner: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  status: "pending" | "conflict";
  error?: string;
  createdAt: string;
};
class ClassicStore extends Dexie {
  values!: EntityTable<Item, "key">;
  queue!: EntityTable<QueuedMutation, "id">;
  constructor() {
    super("tuan-classic-local-first-v1");
    this.version(1).stores({
      values: "key",
      queue: "id,owner,status,createdAt",
    });
  }
}
let store: ClassicStore | undefined;
// Worker SSR imports this module outside a request; random values are browser-only.
export const classicSender=typeof window==='undefined'?'classic-server':'classic-'+crypto.randomUUID();
const db = () => (store ??= new ClassicStore());
export async function saveLocal(key: string, value: unknown) {
  await db().values.put({ key, value, updatedAt: new Date().toISOString() });
}
export async function readLocal<T>(key: string) {
  return (await db().values.get(key))?.value as T | undefined;
}
export async function persistClassicLedger(key:string,rows:unknown[]){
  // IndexedDB is authoritative for large ledgers; localStorage is only a small mirror.
  await saveLocal('ledger-cache:'+key,rows);
  try{const raw=JSON.stringify(rows);localStorage.setItem(key,raw.length<1000000?raw:JSON.stringify({storage:'indexeddb',count:rows.length}));}
  catch{/* the complete IndexedDB copy has already committed */}
  window.dispatchEvent(new CustomEvent('classic-ledger-updated'));
  try{const ch=new BroadcastChannel('tuan-classic-journal');ch.postMessage({sender:classicSender});ch.close();}catch{}
}
export async function readClassicLedger(key:string){
  const cached=await readLocal<unknown[]>('ledger-cache:'+key);
  if(Array.isArray(cached))return cached;
  const stored=localStorage.getItem(key);
  if(stored){try{const value=JSON.parse(stored);if(Array.isArray(value))return value;}catch{}}
  return [];
}
export async function removeLocal(key: string) {
  await db().values.delete(key);
}
export async function queueMutation(
  item: Omit<QueuedMutation, "id" | "status" | "createdAt">,
) {
  const mutation = {
    ...item,
    id: crypto.randomUUID(),
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  await db().queue.add(mutation);
  return mutation.id;
}
const locks = new Set<string>();
export async function flushQueue(owner: string, onChange?: () => void) {
  if (locks.has(owner) || !navigator.onLine) return;
  locks.add(owner);
  try {
    const rows = (await db().queue.where("owner").equals(owner).toArray()).sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt),
    );
    for (const item of rows) {
      if (item.status === "conflict") break; // dependent edits must not leapfrog a conflict
      let response: Response;
      try {
        response = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json", "X-Journal-Owner": item.owner },
          body: item.body === undefined ? undefined : JSON.stringify(item.body),
        });
      } catch {
        break;
      }
      if (
        response.status === 401 ||
        response.status >= 500 ||
        response.status === 429
      )
        break;
      if (!response.ok) {
        if (response.status === 409) {
          const body = await response.clone().json().catch(() => null);
          if (body && typeof body === "object" && "code" in body && body.code === "ACCOUNT_CHANGED") break;
        }
        await db().queue.update(item.id, {
          status: "conflict",
          error: (await response.text()).slice(0, 400),
        });
        onChange?.();
        break;
      }
      await db().queue.delete(item.id);
      onChange?.();
    }
  } finally {
    locks.delete(owner);
  }
}
export async function listQueue(owner: string) {
  return db().queue.where("owner").equals(owner).toArray();
}
export async function discardQueued(id: string) {
  await db().queue.delete(id);
}
export async function listLocal<T>(prefix: string) {
  return (await db().values.where("key").startsWith(prefix).toArray()).map(
    (r) => ({ ...r, value: r.value as T }),
  );
}

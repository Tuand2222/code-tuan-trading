import Dexie, { type EntityTable } from "dexie";
import {JournalLifecycle} from './journal-lifecycle.js';
import {UnifiedJournal} from './journal-unified.js';
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
  generation?: number;
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
  if(key.startsWith('risk:')){const owner=key.slice(5),current=await UnifiedJournal.ensure(owner),seen=UnifiedJournal.snapshots.get(owner)||current;if(seen.settings?.currency&&seen.settings.currency!=='VND'&&(seen.rows.length||seen.cashflows.length||seen.settings.initialCapital>0))throw Error('Nhật ký dùng '+seen.settings.currency+'; Classic dùng VNĐ. Hãy giữ bản JSON và xác minh quy đổi trước khi chỉnh sửa.');const settings={...(value as Record<string,unknown>),currency:'VND'};const saved=await UnifiedJournal.commit(owner,[],[],{generation:seen.generation,beforeSettings:seen.settings,settings});UnifiedJournal.snapshots.set(owner,saved);}
  if(key.startsWith('risk:')||key.startsWith('notes:')){const previous=await db().values.get(key);if(previous&&UnifiedJournal.same(previous.value,value))return;}
  await db().values.put({ key, value, updatedAt: new Date().toISOString() });
}
export async function readLocal<T>(key: string) {
  if(key.startsWith('risk:')){const owner=key.slice(5),state=await UnifiedJournal.ensure(owner);UnifiedJournal.snapshots.set(owner,state);if(state.settings)return state.settings as T;}
  return (await db().values.get(key))?.value as T | undefined;
}
export async function persistClassicLedger(key:string,rows:unknown[],options:{history?:boolean;before?:unknown[]}={}){
  // IndexedDB is authoritative for large ledgers; localStorage is only a small mirror.
  const owner=key==='tuan-trader-trades'?'device':key.slice('tuan-trader-trades:'.length),tagged=JournalLifecycle.tag(rows);
  const demo=tagged.length>0&&tagged.every((t:{origin:string})=>t.origin==='MOCK_SEED_V3');if(!demo){const current=await UnifiedJournal.ensure(owner),seen=UnifiedJournal.snapshots.get(owner)||current;if(seen.settings?.currency&&seen.settings.currency!=='VND'&&(seen.rows.length||seen.cashflows.length||seen.settings.initialCapital>0))throw Error('Nhật ký đang dùng đơn vị khác VNĐ; giữ bản chờ để xác minh quy đổi.');const saved=await UnifiedJournal.commit(owner,options.before||seen.rows,tagged,{generation:seen.generation});UnifiedJournal.snapshots.set(owner,saved);rows=saved.rows;}
  await db().transaction('rw',db().values,async()=>{if(options.history){const before=options.before||(await db().values.get('ledger-cache:'+key))?.value as unknown[]||[],history=(await db().values.get('mutation_oplog:'+owner))?.value as unknown[]||[];await db().values.put({key:'mutation_oplog:'+owner,value:JournalLifecycle.log(JournalLifecycle.tag(before),tagged,history),updatedAt:new Date().toISOString()});}await db().values.put({key:'ledger-cache:'+key,value:rows,updatedAt:new Date().toISOString()});});
  try{const raw=JSON.stringify(rows);localStorage.setItem(key,raw.length<1000000?raw:JSON.stringify({storage:'indexeddb',count:rows.length}));}
  catch{/* the complete IndexedDB copy has already committed */}
  window.dispatchEvent(new CustomEvent('classic-ledger-updated'));
  if(tagged.some((t:{origin:string})=>t.origin!=='MOCK_SEED_V3'))JournalLifecycle.set('LIVE_PRODUCTION',owner);
  try{const ch=new BroadcastChannel('tuan-classic-journal');ch.postMessage({sender:classicSender});ch.close();}catch{}
}
export async function readClassicLedger(key:string){
  const owner=key==='tuan-trader-trades'?'device':key.slice('tuan-trader-trades:'.length),state=await UnifiedJournal.ensure(owner);UnifiedJournal.snapshots.set(owner,state);
  if(state.settings?.currency&&state.settings.currency!=='VND'&&state.rows.length)throw Error('Nhật ký dùng '+state.settings.currency+'; mở V6 để giữ đúng đơn vị, chưa tự quy đổi sang VNĐ.');
  if(!(localStorage.getItem('tuan-trader-demo-mode-v1'+(owner==='device'?'':':'+owner))==='true'&&!JournalLifecycle.read(owner).noMock))return state.rows;
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
  const snapshot=await UnifiedJournal.ensure(item.owner);
  const mutation = {
    ...item,
    id: crypto.randomUUID(),
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    generation:snapshot.generation,
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
      const current=await UnifiedJournal.read(owner);
      if((item.generation??0)!==current.generation){await db().queue.update(item.id,{status:"conflict",error:"Nhật ký đã reset; không phát lại bản chờ cũ."});onChange?.();break;}
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

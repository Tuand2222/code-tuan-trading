import {env} from 'cloudflare:workers';
import {requireUser,routeError} from '../../../lib/server-auth';
import {cloudHash,stableJSON} from '../../../lib/journal-cloud';

// Owner-only, bounded backup first. No broker credentials/auth/account tables are included or deleted.
async function snapshot(owner:string){
 const db=env.DB, tables:Record<string,unknown[]>={};
 for(const table of ['trades','trade_audit','trade_images','report_jobs','report_preferences']){
  const rows=await db.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY ${table==='report_preferences'?'user_id':'id'}`).bind(owner).all();tables[table]=rows.results;
 }
 for(const table of ['journal_cloud_heads','journal_cloud_records','journal_cloud_versions','classic_archive_queue'])tables[table]=(await db.prepare(`SELECT * FROM ${table} WHERE owner_id=? ORDER BY ${table==='journal_cloud_heads'?'owner_id':table==='journal_cloud_records'||table==='classic_archive_queue'?'record_key':'record_key,revision'}`).bind(owner).all()).results;
 const trades=tables.trades as {version:number}[],images=tables.trade_images as {id:string;object_key:string}[],head=tables.journal_cloud_heads as {revision:number}[];
 const reports=tables.report_preferences as {settings_json:string;destination_ciphertext:string|null;updated_at:string}[],jobs=tables.report_jobs as {id:string;period:string;status:string;object_key:string|null;error:string|null;created_at:string}[];
 const fence={count:trades.length,versions:trades.reduce((s,t)=>s+t.version,0),revision:head[0]?.revision??0,images:images.map(x=>x.id+':'+x.object_key).join('|'),audits:tables.trade_audit.length,reports:JSON.stringify(reports.map(r=>[r.settings_json,r.destination_ciphertext,r.updated_at])),jobs:JSON.stringify(jobs.map(r=>[r.id,r.period,r.status,r.object_key,r.error,r.created_at]))};
 const keys=new Set<string>(images.map(x=>x.object_key));for(const row of [...tables.journal_cloud_records,...tables.journal_cloud_versions,...tables.report_jobs] as {object_key:string|null}[])if(row.object_key)keys.add(row.object_key);
 const objects:Record<string,string>={};let bytes=0;
 for(const key of keys){const object=await env.BUCKET.get(key);if(!object)throw Error('Backup object unavailable; nothing was deleted');const buffer=new Uint8Array(await object.arrayBuffer());bytes+=buffer.length;if(bytes>24*1024*1024)throw new Response('Journal assets exceed the safe reset backup size; export assets separately before reset.',{status:413});let binary='';for(const byte of buffer)binary+=String.fromCharCode(byte);objects[key]=btoa(binary);}
 const data={tables,objects},raw=stableJSON(data);if(new TextEncoder().encode(raw).length>64*1024*1024)throw new Response('Backup exceeds 64 MiB; nothing was deleted.',{status:413});
 return {format:'tuannhatky-cloud-reset-backup',version:1,owner,data,fence,checksum:await cloudHash(raw)};
}
export async function GET(request:Request){try{const owner=await requireUser(request);if(request.headers.get('X-Journal-Owner')!==owner.id)return Response.json({error:'Account changed'},{status:409});return Response.json(await snapshot(owner.id),{headers:{'Cache-Control':'no-store'}});}catch(e){return routeError(e);}}
export async function POST(request:Request){try{
 const user=await requireUser(request),body=await request.json() as {owner?:string;checksum?:string;confirmation?:string;downloadVerified?:boolean};
 if(body.owner!==user.id||request.headers.get('X-Journal-Owner')!==user.id)return Response.json({error:'Account changed'},{status:409});
 if(body.confirmation!=='XOA NHAT KY'||body.downloadVerified!==true)return Response.json({error:'Verified downloaded JSON and confirmation code required'},{status:400});
 const copy=await snapshot(user.id);if(body.checksum!==copy.checksum)return Response.json({error:'Journal changed since backup; save a fresh backup before resetting'},{status:409});
 const db=env.DB,token=crypto.randomUUID(),key='reset:'+token,exists='EXISTS(SELECT 1 FROM classic_archive_queue WHERE owner_id=? AND record_key=? AND token=?)',bind=[user.id,key,token];
 const fence=db.prepare(`INSERT INTO classic_archive_queue(owner_id,record_key,token,updated_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM trades WHERE user_id=?)=? AND (SELECT COALESCE(SUM(version),0) FROM trades WHERE user_id=?)=? AND COALESCE((SELECT revision FROM journal_cloud_heads WHERE owner_id=?),0)=? AND COALESCE((SELECT group_concat(v,'|') FROM (SELECT id||':'||object_key AS v FROM trade_images WHERE user_id=? ORDER BY id)),'')=? AND (SELECT COUNT(*) FROM trade_audit WHERE user_id=?)=? AND (SELECT json_group_array(json_array(settings_json,destination_ciphertext,updated_at)) FROM (SELECT * FROM report_preferences WHERE user_id=? ORDER BY user_id))=? AND (SELECT json_group_array(json_array(id,period,status,object_key,error,created_at)) FROM (SELECT * FROM report_jobs WHERE user_id=? ORDER BY id))=?`).bind(...bind,new Date().toISOString(),user.id,copy.fence.count,user.id,copy.fence.versions,user.id,copy.fence.revision,user.id,copy.fence.images,user.id,copy.fence.audits,user.id,copy.fence.reports,user.id,copy.fence.jobs);
 const statements=[fence];
 for(const table of ['trade_images','trade_audit','report_jobs','report_preferences','trades'])statements.push(db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${exists}`).bind(user.id,...bind));
 for(const table of ['journal_cloud_records','journal_cloud_versions'])statements.push(db.prepare(`DELETE FROM ${table} WHERE owner_id=? AND ${exists}`).bind(user.id,...bind));
 statements.push(db.prepare(`INSERT INTO journal_cloud_heads(owner_id,revision,mutation_id,updated_at) SELECT ?,?,?,? WHERE ${exists} ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at`).bind(user.id,copy.fence.revision+1,token,new Date().toISOString(),...bind));
 statements.push(db.prepare(`DELETE FROM classic_archive_queue WHERE owner_id=? AND ${exists}`).bind(user.id,...bind));
 const result=await db.batch(statements);if(!result[0].meta.changes)return Response.json({error:'Concurrent journal change; reset cancelled'},{status:409});
 const keys=Object.keys(copy.data.objects),cleanupErrors:string[]=[];for(let i=0;i<keys.length;i+=100)try{await env.BUCKET.delete(keys.slice(i,i+100));}catch{cleanupErrors.push('Asset cleanup pending');}
 return Response.json({reset:true,owner:user.id,revision:copy.fence.revision+1,cleanupErrors,retained:['account','authentication','broker connections']});
}catch(e){return routeError(e);}}

import {stableJSON} from './journal-cloud';
export function mergeSharedValue(base:any,local:any,remote:any):{value:any;conflicts:string[]} {
 const conflicts:string[]=[];
 const equal=(a:any,b:any)=>stableJSON(a)===stableJSON(b);
 const object=(x:any)=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const walk=(b:any,l:any,r:any,path:string):any=>{
  if(equal(l,r))return structuredClone(l);
  if(equal(l,b))return structuredClone(r);
  if(equal(r,b))return structuredClone(l);
  if(object(l)&&object(r)&&(object(b)||b===undefined)){
   const result:Record<string,unknown>={};
   for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){
    if(['__proto__','constructor','prototype'].includes(key)){conflicts.push(path||key);continue;}
    const v=walk(b?.[key],l[key],r[key],path?path+'.'+key:key);if(v!==undefined)result[key]=v;
   }return result;
  }
  if(Array.isArray(l)&&Array.isArray(r)&&(Array.isArray(b)||b===undefined)){
   const lists=[b||[],l,r],identified=lists.every(xs=>xs.every((x:any)=>object(x)&&typeof x.id==='string')&&new Set(xs.map((x:any)=>x.id)).size===xs.length);
   if(identified){const maps=lists.map(xs=>new Map(xs.map((x:any)=>[x.id,x]))),ids=new Set([...l.map(x=>x.id),...r.map(x=>x.id),...(b||[]).map((x:any)=>x.id)]);const result:any[]=[];for(const id of ids){const v=walk(maps[0].get(id),maps[1].get(id),maps[2].get(id),path+'.'+id);if(v!==undefined)result.push(v);}return result;}
  }
  conflicts.push(path||'value');return structuredClone(l);
 };
 const value=walk(base,local,remote,'');return {value,conflicts};
}

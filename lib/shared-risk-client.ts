import {useEffect,useRef,useState} from "react";
import {stableJSON} from "./journal-cloud";
import {readLocal,saveLocal} from "./classic-persistence";
import {DEFAULT_RISK,type RiskSettings} from "./risk-analytics";
import {normalizeRiskSettings} from "./risk-settings-schema";
import {mergeSharedValue} from "./shared-settings-merge";
type Conflict<T>={owner:string;base:T;local:T;remote:T;version:number;fields:string[];time:string};
function downloadConflict(value:unknown){
 const link=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
 link.href=url;link.download="doi-chieu-cau-hinh-"+Date.now()+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function useSharedValue<T>(owner:string|undefined,settings:T,change:(s:T)=>void,notify:(m:string)=>void,path:string,fallback:T){
 const [conflictView,setConflictView]=useState<Conflict<T>|null>(null);
 const current=useRef({owner,settings,change,notify});current.current={owner,settings,change,notify};
 const pump=useRef<()=>Promise<void>>(async()=>{});
 const resolveRef=useRef<(choice:"local"|"remote")=>Promise<void>>(async()=>{});
 useEffect(()=>{
  setConflictView(null);if(!owner)return;
  let active=true,version=0,base:T|undefined,ready=false,busy=false,conflict:Conflict<T>|null=null;
  const canonical=(value:T):T=>path==="/api/risk-settings"?normalizeRiskSettings(value) as T:value;
  const isCurrent=()=>active&&current.current.owner===owner;
  const key=path+":base:"+owner;
  const remember=async()=>{await saveLocal(key,{version,raw:stableJSON(base)});};
  const block=async(local:T,remote:T,fields:string[])=>{
   const record:Conflict<T>={owner,base:base??canonical(fallback),local:structuredClone(local),remote:structuredClone(remote),version,fields,time:new Date().toISOString()};
   await saveLocal(path+":conflict:"+owner+":"+Date.now(),record);
   if(!isCurrent())return;
   conflict=record;setConflictView(record);
   current.current.notify("Cấu hình cần đối chiếu. Hai bản đã được giữ riêng; chọn bản cần dùng trong bảng đối chiếu.");
  };
  const getRemote=async()=>{
   const response=await fetch(path,{cache:"no-store",headers:{"X-Journal-Owner":owner}});
   if(!response.ok)throw Error(response.status===401?"Đăng nhập lại để đồng bộ; dữ liệu trên thiết bị được giữ.":"Chưa đọc được cấu hình cloud; dữ liệu trên thiết bị được giữ.");
   const result=await response.json() as {owner:string;settings:T|null;version:number};
   if(!isCurrent()||result.owner!==owner)throw Error("Tài khoản đã đổi; không ghi cấu hình.");
   if(!Number.isSafeInteger(result.version)||result.version<0)throw Error("Phiên bản cấu hình không hợp lệ.");
   return {...result,settings:result.settings===null?null:canonical(result.settings)};
  };
  const rebase=async(remote:T|null,remoteVersion:number)=>{
   version=remoteVersion;
   const local=canonical(current.current.settings);
   if(remote===null){if(base!==undefined&&version!==0){await block(local,canonical(fallback),["cloud đã xóa cấu hình"]);return;}base=undefined;return;}
   const result=mergeSharedValue(base??canonical(fallback),local,remote);
   if(result.conflicts.length){await block(local,remote,result.conflicts);return;}
   base=remote;
   if(stableJSON(local)!==stableJSON(result.value)){current.current.change(result.value);current.current.settings=result.value;}
   await remember();
  };
  const sync=async()=>{
   if(!isCurrent()||busy||conflict)return;busy=true;
   try{
    if(!ready){
     const remote=await getRemote(),saved=await readLocal<{raw:string;version:number}>(key);
     if(!isCurrent())return;
     if(saved){try{base=canonical(JSON.parse(saved.raw));}catch{base=undefined;}}
     await rebase(remote.settings,remote.version);ready=true;
    }else{
     const remote=await getRemote();if(!isCurrent())return;
     if(remote.version!==version||stableJSON(remote.settings)!==stableJSON(base))await rebase(remote.settings,remote.version);
    }
    for(let attempt=0;attempt<3&&isCurrent()&&!conflict;attempt++){
     const local=canonical(current.current.settings),raw=stableJSON(local);
     if(raw===stableJSON(base))break;
     const response=await fetch(path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedOwner:owner,settings:local,version})});
     if(!isCurrent())return;
     if(response.status===409){const remote=await getRemote();await rebase(remote.settings,remote.version);continue;}
     if(!response.ok)throw Error(response.status===400?"Cấu hình chưa hợp lệ; bản thiết bị được giữ để sửa.":"Chưa lưu được cấu hình cloud; bản thiết bị được giữ và sẽ thử lại.");
     const result=await response.json() as {revision:number};
     if(!isCurrent())return;
     if(!Number.isSafeInteger(result.revision))throw Error("Cloud chưa xác nhận phiên bản cấu hình.");
     version=result.revision;base=local;await remember();
    }
   }catch(error){if(isCurrent())current.current.notify(error instanceof Error?error.message:String(error));}
   finally{busy=false;}
  };
  pump.current=sync;
  resolveRef.current=async(choice)=>{
   if(!isCurrent()||!conflict||busy)return;
   try{
    const selected=conflict,remote=await getRemote();
    if(remote.version!==selected.version){conflict=null;setConflictView(null);base=selected.base;await rebase(remote.settings,remote.version);if(!conflict)await sync();return;}
    await saveLocal(path+":resolution:"+owner+":"+Date.now(),{...selected,choice});
    if(!isCurrent())return;
    base=remote.settings??undefined;version=remote.version;
    const value=choice==="local"?canonical(current.current.settings):selected.remote;
    current.current.change(value);current.current.settings=value;
    conflict=null;setConflictView(null);ready=true;await remember();await sync();
   }catch(error){if(isCurrent())current.current.notify(error instanceof Error?error.message:String(error));}
  };
  void sync();
  const run=()=>{void sync();};
  window.addEventListener("focus",run);window.addEventListener("online",run);
  const timer=setInterval(run,30000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",run);window.removeEventListener("online",run);pump.current=async()=>{};resolveRef.current=async()=>{};};
 },[owner,path]);
 useEffect(()=>{const timer=setTimeout(()=>void pump.current(),800);return()=>clearTimeout(timer);},[owner,settings]);
 const visible=conflictView?.owner===owner?conflictView:null;
 return {conflict:visible,resolve:(choice:"local"|"remote")=>resolveRef.current(choice),download:()=>{if(visible)downloadConflict(visible);}};
}
export function useSharedRisk(owner:string|undefined,settings:RiskSettings,change:(s:RiskSettings)=>void,notify:(m:string)=>void){
 return useSharedValue(owner,settings,change,notify,"/api/risk-settings",DEFAULT_RISK);
}
export function useSharedNotes(owner:string|undefined,notes:string,change:(s:string)=>void,notify:(m:string)=>void,template:string){
 return useSharedValue(owner,notes,change,notify,"/api/journal-notes",template);
}

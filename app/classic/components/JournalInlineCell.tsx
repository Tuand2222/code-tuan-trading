"use client";
import {useRef,useState} from 'react';
export default function JournalInlineCell({value,label,disabled,onSave}:{value:string;label:string;disabled:boolean;onSave:(value:string,baseline:string)=>Promise<void>}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),[error,setError]=useState('');const baseline=useRef(value),busy=useRef(false);
 const begin=()=>{if(disabled)return;baseline.current=value;setDraft(value);setError('');setEditing(true);};
 const save=async()=>{if(busy.current)return;busy.current=true;try{await onSave(draft,baseline.current);setEditing(false);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{busy.current=false;}};
 if(!editing)return <span className="journal-inline-value" role="button" aria-label={'Sửa '+label} tabIndex={disabled?-1:0} aria-disabled={disabled} title="Nhấp đúp hoặc Enter để sửa" onDoubleClick={begin} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();begin();}}}>{value}</span>;
 return <span><input autoFocus aria-label={'Sửa '+label} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>void save()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save();}if(e.key==='Escape'){e.preventDefault();setEditing(false);}}}/>{error&&<small role="alert">{error}</small>}</span>;
}

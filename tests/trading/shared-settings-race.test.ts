import { it, expect, vi, beforeEach, afterEach } from 'vitest';
const h = vi.hoisted(() => ({
  index: 0,
  refs: [] as {current:unknown}[],
  effects: [] as {deps:unknown[];cleanup?:()=>void}[],
  read: vi.fn(), save: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (value:unknown) => {const i=h.index++;const slot=h.refs[i]??={current:value};return [slot.current,(v:unknown)=>{slot.current=v;}];},
  useRef: (value:unknown) => {const i=h.index++; return h.refs[i] ??= {current:value};},
  useEffect: (effect:()=>void|(()=>void), deps:unknown[]) => {
    const i=h.index++, old=h.effects[i];
    if(old && deps.every((d,j)=>Object.is(d,old.deps[j]))) return;
    old?.cleanup?.();
    h.effects[i]={deps,cleanup:effect() || undefined};
  },
}));
vi.mock('../../lib/classic-persistence', () => ({readLocal:h.read,saveLocal:h.save}));
import { useSharedRisk } from '../../lib/shared-risk-client';
import { DEFAULT_RISK } from '../../lib/risk-analytics';
const settle = async () => {for(let i=0;i<25;i++) await Promise.resolve();};
const render = (owner:string, capital:number, change:(v:unknown)=>void) => {
  h.index=0; return useSharedRisk(owner,{...DEFAULT_RISK,initialCapital:capital},change,vi.fn());
};
beforeEach(()=>{
  h.refs=[];h.effects=[];h.read.mockReset();h.save.mockReset();h.save.mockResolvedValue(undefined);
  vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());
});
it('retries a 409 caused by an unrelated journal write and preserves independent remote settings',async()=>{
 let remote={...DEFAULT_RISK,initialCapital:1000},version=1,rejected=false;
 h.read.mockResolvedValue({version:1,raw:JSON.stringify(remote)});
 const bodies:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_:string,options:RequestInit)=>{
  if(options.method==='PUT'){
   const b=JSON.parse(String(options.body));bodies.push(b);
   if(!rejected){rejected=true;remote={...remote,dailyLossPercent:4};version=2;return Response.json({error:'race'},{status:409});}
   remote=b.settings;version++;return Response.json({revision:version});
  }
  return Response.json({owner:'A',settings:remote,version});
 }));
 const change=vi.fn();render('A',2000,change);await settle();await settle();
 expect(bodies).toHaveLength(2);expect(bodies[1]).toMatchObject({expectedOwner:'A',version:2,settings:{initialCapital:2000,dailyLossPercent:4}});
 expect(remote).toMatchObject({initialCapital:2000,dailyLossPercent:4});
});
it('real same-field conflicts are backed up and resolved only by an explicit choice',async()=>{
 h.read.mockResolvedValue({version:1,raw:JSON.stringify({...DEFAULT_RISK,initialCapital:1000})});
 const puts:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_:string,options:RequestInit)=>{
  if(options.method==='PUT'){puts.push(JSON.parse(String(options.body)));return Response.json({revision:3});}
  return Response.json({owner:'A',settings:{...DEFAULT_RISK,initialCapital:3000},version:2});
 }));
 const change=vi.fn();render('A',2000,change);await settle();
 const view=render('A',2000,change);expect(view.conflict?.fields).toEqual(['initialCapital']);expect(puts).toHaveLength(0);
 await view.resolve('remote');await settle();expect(change).toHaveBeenCalledWith(expect.objectContaining({initialCapital:3000}));expect(puts).toHaveLength(0);
 expect(h.save).toHaveBeenCalledWith(expect.stringContaining(':resolution:A:'),expect.objectContaining({local:expect.objectContaining({initialCapital:2000}),remote:expect.objectContaining({initialCapital:3000}),choice:'remote'}));
});
afterEach(()=>{h.effects.forEach(e=>e?.cleanup?.());vi.useRealTimers();vi.unstubAllGlobals();});
it('does not replace a new account with cloud settings that arrive during an older IndexedDB read', async()=>{
  let release!:(v:unknown)=>void;
  h.read.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
  const writes: unknown[]=[];
  vi.stubGlobal('fetch',vi.fn(async (_:string,options:RequestInit)=>{
    if(options.method==='PUT'){writes.push(JSON.parse(String(options.body)));return Response.json({revision:1});}
    const owner=new Headers(options.headers).get('X-Journal-Owner');
    return Response.json({owner,version:0,settings:owner==='A'?{...DEFAULT_RISK,initialCapital:999}:null});
  }));
  const changeA=vi.fn(),changeB=vi.fn();
  render('A',DEFAULT_RISK.initialCapital,changeA);await settle();
  expect(h.read).toHaveBeenCalledOnce();
  render('B',DEFAULT_RISK.initialCapital,changeB);await settle();
  release(undefined);await settle();
  expect(changeA).not.toHaveBeenCalled();expect(changeB).not.toHaveBeenCalled();
  expect(writes).toEqual([{expectedOwner:'B',settings:DEFAULT_RISK,version:0}]);
});
it('does not overwrite an edit made while a shared configuration read is pending',async()=>{
  let release!:(v:unknown)=>void;
  h.read.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({owner:'A',version:2,settings:{...DEFAULT_RISK,initialCapital:999}})));
  const change=vi.fn();render('A',DEFAULT_RISK.initialCapital,change);await settle();
  render('A',12345,change);release(undefined);await settle();
  expect(change).not.toHaveBeenCalled();
  expect(h.save).toHaveBeenCalledWith(expect.stringContaining('/api/risk-settings:conflict:A:'),expect.objectContaining({local:expect.objectContaining({initialCapital:12345}),remote:expect.objectContaining({initialCapital:999}),fields:['initialCapital']}));
});

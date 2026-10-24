import { it, expect, vi, beforeEach, afterEach } from 'vitest';
const h = vi.hoisted(() => ({
  index: 0,
  refs: [] as {current:unknown}[],
  effects: [] as {deps:unknown[];cleanup?:()=>void}[],
  read: vi.fn(), save: vi.fn(),
}));
vi.mock('react', () => ({
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
  h.index=0; useSharedRisk(owner,{...DEFAULT_RISK,initialCapital:capital},change,vi.fn());
};
beforeEach(()=>{
  h.refs=[];h.effects=[];h.read.mockReset();h.save.mockReset();h.save.mockResolvedValue(undefined);
  vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());
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
  expect(h.save).not.toHaveBeenCalled();
});

import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import { queueMutation, flushQueue, listQueue, discardQueued } from '../../lib/classic-persistence';
import { fetchAllTrades } from '../../lib/read-trades';
it('pins the offline queue to its original owner and resumes after returning to that account', async()=>{
  vi.stubGlobal('navigator',{onLine:true});
  const id=await queueMutation({owner:'queue-A',method:'DELETE',url:'/api/trades?all=1'});
  const fn=vi.fn(async(_:string,options:RequestInit)=>{
    expect(new Headers(options.headers).get('X-Journal-Owner')).toBe('queue-A');
    return Response.json({code:'ACCOUNT_CHANGED'},{status:409});
  });vi.stubGlobal('fetch',fn);
  try {
    await flushQueue('queue-A');
    expect((await listQueue('queue-A'))[0]?.status).toBe('pending');
    fn.mockImplementation(async()=>Response.json({deleted:true}));
    await flushQueue('queue-A');
    expect(await listQueue('queue-A')).toEqual([]);
  } finally {await discardQueued(id);vi.unstubAllGlobals();}
});
it('pins all subsequent pages to the first authenticated owner and refuses mixed pages',async()=>{
  const fn=vi.fn().mockResolvedValueOnce(Response.json({owner:'A',trades:[{id:'a'}],next:'page2'}))
    .mockImplementationOnce(async(_:string,options:RequestInit)=>{
      expect(new Headers(options.headers).get('X-Journal-Owner')).toBe('A');
      return Response.json({owner:'B',trades:[{id:'b'}]});
    });vi.stubGlobal('fetch',fn);
  try {expect((await fetchAllTrades()).status).toBe(409);}finally{vi.unstubAllGlobals();}
});

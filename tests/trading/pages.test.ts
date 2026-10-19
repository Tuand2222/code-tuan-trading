import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { account, batch, fill, snapshot } from './fixtures';
import { deriveLedger } from '../../lib/trading/application/deriveLedger';
import { replayLedger } from '../../lib/trading/application/replayLedger';
import { D, dec, sum } from '../../lib/trading/domain/decimal';
import { metricsVM, calendarVM, feeImpact, reviewQueue, validRiskTrades, selectScope } from '../../lib/trading/selectors';
import { bootstrapMean, wilson, inference } from '../../lib/trading/selectors/inference';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import { liveQuery } from 'dexie';
import type { LedgerSnapshot, TradeFill } from '../../lib/trading/domain/types';
import { checklistRules, checklistScore, activePlaybook } from '../../lib/trading/selectors/playbook';
import { journalCSV } from '../../lib/trading/selectors/journal';
import { riskReport } from '../../lib/trading/selectors/riskReport';
import { tradeDims } from '../../lib/trading/selectors/dimensions';

describe('R5 cross-page invariants', () => {
  async function dataset() {
    const data: LedgerSnapshot = {accounts:[],batches:[],fills:[],cashEvents:[],overlays:[],settings:{}};
    for(let a=0;a<3;a++) {
      const acct=account({accountId:`a${a}`,accountKey:`acct${a}`,market:(['stock','crypto','forex'] as const)[a],platform:(['VN_STOCK','BINANCE','MT5'] as const)[a]}), b=batch(`b${a}`,{accountId:acct.accountId,fx:[{ccy:'VND',rateToVND:'1',source:'user'}]});
      data.accounts.push(acct);data.batches.push(b);
      for(let i=0;i<10;i++) {
        const date=`2026-10-${String(i+1).padStart(2,'0')}`,id=`${a}-${i}`,delta=i%2?'-4':'10';
        const first=await fill(`${id}-o`,'buy','100','100',`${date}T16:00:00Z`,{batchId:b.batchId,costs:[{kind:'commission',ccy:'VND',amount:'10',origin:'reported'}]},acct);
        const last=await fill(`${id}-c`,'sell','100',dec(D('100').plus(delta)),`${date}T18:00:00Z`,{batchId:b.batchId,costs:[{kind:'tax',ccy:'VND',amount:'5',origin:'reported'}]},acct);
        data.fills.push(first,last);
        data.overlays.push({overlayId:id,anchorFillIds:[first.fillId,last.fillId],state:'attached',setupTag:i%3?'Trend':undefined,mistakeTags:i===0?['FOMO']:[],reviewStatus:i<4?'reviewed':'needs-review',disciplineScore:i<4?90:undefined,riskOverrideVND:i<7?'500':undefined,updatedAt:'2026-10-18T00:00:00Z'});
      }
    } return data;
  }
  it('keeps Overview = calendar = fee waterfall = MetriX for 3 accounts/60 fills and shared filters', async()=>{
    const data=await dataset(),r=await replayLedger(data);
    for(const filters of [{},{from:'2026-10-03',to:'2026-10-08'},{accountIds:['a1']},{markets:['forex'],timezone:'UTC'},{platforms:['VN_STOCK'],exactOnly:true}]) {
      const m=metricsVM(r,filters),days=calendarVM(r,filters),fees=feeImpact(r,filters),d=await deriveLedger(data,1,filters);
      expect(m.net.status).toBe('ok');if(m.net.status!=='ok')throw Error();
      expect(Number(sum(days.map(x=>x.netVND!)))).toBe(m.net.value);
      expect(Number(dec(D(fees.grossVND!).minus(fees.netCostsVND!)))).toBe(m.net.value);
      expect(d.metrics.net).toEqual(m.net);
      expect(m.averageR.n).toBe(validRiskTrades(selectScope(r, filters).cycles).length);
      for(const groups of Object.values(d.edge))expect(groups.reduce((n,g)=>n+g.count,0)).toBe(m.total.status==='ok'?m.total.value:0);
    }
    for(const c of r.cycles)expect(sum(r.events.filter(e=>e.tradeId===c.tradeId).map(e=>e.netVND!))).toBe(c.netVND);
    expect(reviewQueue(r.cycles).slice(0,4).map(c=>D(c.netVND!).isNegative())).toEqual([true,false,true,false]);
  });
  it('reuses identical derivations but invalidates for settings, overlays and filters',async()=>{
    const data=await dataset(),first=await deriveLedger(data,1),again=await deriveLedger(data,1);expect(again).toBe(first);
    const next=await deriveLedger({...data,overlays:data.overlays.map(o=>({...o,riskOverrideVND:'1000'}))},2);
    expect(next.metrics.averageR).not.toEqual(first.metrics.averageR);
    expect((await deriveLedger(data,1,{accountIds:['a0']})).metrics.total).toMatchObject({value:10});
  });
  it('uses real event timezone, including partial closes on days without closed cycles',async()=>{
    const a=account(),b=batch('b',{fx:[{ccy:'VND',rateToVND:'1',source:'user'}]}),fills=await Promise.all([fill('o','buy','2','100','2026-10-01T16:00:00Z'),fill('p','sell','1','110','2026-10-01T18:00:00Z'),fill('c','sell','1','90','2026-10-03T18:00:00Z')]);
    const r=await replayLedger(snapshot(fills,a,[b])),days=calendarVM(r,{timezone:'Asia/Ho_Chi_Minh'});
    expect(days.map(d=>[d.date,d.netVND,d.closedCycles])).toEqual([['2026-10-02','10',0],['2026-10-04','-10',1]]);
    expect(riskReport(r).currentDrawdownVND).toBe('10');
    const c=r.cycles[0];
    expect(journalCSV([{...c,symbol:'=HYPERLINK("test")'}])).toContain("'=HYPERLINK");
    expect(tradeDims(c,'UTC','0',[{name:'Overnight',market:'stock',start:'22:00',end:'02:00',timezone:'Asia/Ho_Chi_Minh'}]).session).toBe('Overnight');
  });
});
describe('statistical inference',()=>{
  it('scores checklists by weight and uses the playbook version valid on the trade date',()=>{
    const rules=checklistRules('Trend | 2\nEntry | 3');expect(checklistScore(rules,{'0':true})).toBe(40);expect(checklistScore([],{})).toBeUndefined();expect(()=>checklistRules('Bad | -1')).toThrow();
    const books=[{name:'Trend',description:'old',checklist:'A | 1',validFrom:'2026-01-01'},{name:'Trend',description:'new',checklist:'B | 1',validFrom:'2026-11-01'}];
    expect(activePlaybook(books,'Trend','2026-10-18')?.description).toBe('old');
  });
  it('has deterministic percentile bootstrap and Wilson bounds without fake confidence',()=>{
    expect(wilson(0,0)).toBeNull();expect(wilson(5,10)![0]).toBeCloseTo(.2366,3);expect(wilson(10,10)![1]).toBe(1);
    expect(bootstrapMean([])).toBeNull();expect(bootstrapMean([2,2,2])).toEqual([2,2]);expect(bootstrapMean([-1,2,3])).toEqual(bootstrapMean([-1,2,3]));
    expect(inference([]).edgeState).toBe('insufficient');
  });
});
describe('live store and performance',()=>{
  it('notifies subscribers after settings write so every page refreshes without a reload',async()=>{
    const db=new DexieLedgerStore('pages-'+crypto.randomUUID());let sub:ReturnType<ReturnType<typeof liveQuery>['subscribe']>|undefined;
    try{const next=new Promise<number>((resolve,reject)=>{sub=liveQuery(()=>db.snapshot()).subscribe({next:s=>{if(s.version===1)resolve(s.version);},error:reject});});await db.setSettings({timezone:'UTC'},0);expect(await next).toBe(1);}finally{sub?.unsubscribe();await db.delete();}
  });
  it('rejects malformed settings and restores no records on validation failure',async()=>{
    const db=new DexieLedgerStore('settings-'+crypto.randomUUID());try{await expect(db.setSettings({playbooks:'not-an-array'},0)).rejects.toThrow();expect(await db.getLedgerVersion()).toBe(0);await expect(db.setSettings({timezone:'Bogus/Zone'},0)).rejects.toThrow();}finally{await db.delete();}
  });
  it('replays 10,000 fills without quadratic same-granularity cross-report scans',async()=>{
    const a=account(),b=batch('b',{fx:[{ccy:'VND',rateToVND:'1',source:'user'}]}),fills:TradeFill[]=[];
    for(let i=0;i<5000;i++){const ts=new Date(Date.UTC(2026,0,1)+i*60000).toISOString(),close=new Date(Date.parse(ts)+1000).toISOString();fills.push(await fill(`${i}o`,'buy','1','100',ts),await fill(`${i}c`,'sell','1','101',close));}
    const started=performance.now(),result=await replayLedger(snapshot(fills,a,[b])),elapsed=performance.now()-started;
    expect(result.cycles).toHaveLength(5000);expect(sum(result.events.map(e=>e.netVND!))).toBe('5000');expect(elapsed).toBeLessThan(15000);
  },30000);
});

import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { stageManualTrades, type ManualInput } from '../../lib/trading/application/manualTrade';
import { stageDemoTrades } from '../../lib/trading/application/demoTrades';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import { replayLedger } from '../../lib/trading/application/replayLedger';
import { calendarVM, metricsVM } from '../../lib/trading/selectors';
import { D, sum } from '../../lib/trading/domain/decimal';
const empty=()=>({version:0,data:{accounts:[],batches:[],fills:[],cashEvents:[],overlays:[],settings:{}}});
const input:ManualInput={accountLabel:'Test manual',market:'stock',currency:'VND',symbol:'FPT',direction:'LONG',openTime:'2026-10-01T02:00:00Z',closeTime:'2026-10-02T07:00:00Z',quantity:'100',entryPrice:'25400',exitPrice:'26000',multiplier:'1',fees:'7740',carryingCost:'-1000',rateToVND:'1',riskVND:'100000',setup:'Pullback',notes:'Đã đối chiếu',mistakeTags:['FOMO'],reviewed:true,disciplineScore:60};
it('manual entry persists journal fields and same money/R through commit, replay and calendar',async()=>{
  const db=new DexieLedgerStore('manual-'+crypto.randomUUID());try{
    const stage=await stageManualTrades([input],empty());expect(stage.warnings).toEqual([]);
    await db.commitBatch({batch:stage.batch,fills:stage.parsed.fills,cashEvents:[],accounts:[stage.account],overlays:stage.overlays},0);
    const r=await replayLedger((await db.snapshot()).data),c=r.cycles[0];expect(c.netVND).toBe('53260');expect(c.risk.amountVND).toBe('100000');expect(c.overlay).toMatchObject({setupTag:'Pullback',notes:'Đã đối chiếu',mistakeTags:['FOMO'],reviewStatus:'reviewed',disciplineScore:60});
    expect(calendarVM(r)[0].netVND).toBe('53260');expect(metricsVM(r).averageR).toMatchObject({value:.5326});
  }finally{await db.delete();}
});
it('enforces multiplier, positive risk and stop guards; unreviewed has no discipline score',async()=>{
  const stage=await stageManualTrades([{...input,market:'forex',currency:'USD',quantity:'1',entryPrice:'1.1',exitPrice:'1.11',multiplier:'100000',fees:'7',carryingCost:'0',rateToVND:'25500',riskVND:undefined,initialStop:'1.09',reviewed:false}],empty());
  const c=stage.replay.cycles[0];expect(c.grossVND).toBe('25500000');expect(c.risk.amountVND).toBe('25500000');expect(c.overlay?.disciplineScore).toBeUndefined();
  await expect(stageManualTrades([{...input,riskVND:'0'}],empty())).rejects.toThrow();
  await expect(stageManualTrades([{...input,direction:'SHORT'}],empty())).rejects.toThrow();
  const trailed=await stageManualTrades([{...input,riskVND:undefined,initialStop:'26000'}],empty());expect(trailed.replay.cycles[0].risk.origin).toBe('none');expect(trailed.warnings.some(w=>w.code==='TRAILED_STOP_DETECTED')).toBe(true);
});
it('30 demo trades are labelled, stored in one reversible batch, deduplicated, and agree across pages',async()=>{
  const db=new DexieLedgerStore('demo-'+crypto.randomUUID());try{
    const stage=await stageDemoTrades(empty(),new Date('2026-10-19T00:00:00Z'));expect(stage.parsed.fills).toHaveLength(60);expect(stage.replay.cycles).toHaveLength(30);expect(stage.warnings).toEqual([]);
    expect(stage.overlays.every(o=>o.notes?.includes('DỮ LIỆU GIẢ LẬP'))).toBe(true);
    await db.commitBatch({batch:stage.batch,fills:stage.parsed.fills,cashEvents:[],accounts:[stage.account],overlays:stage.overlays},0);
    const snap=await db.snapshot(),r=await replayLedger(snap.data);expect(r.cycles).toHaveLength(30);expect(r.cycles.some(c=>D(c.netVND!).gt(0))).toBe(true);expect(r.cycles.some(c=>D(c.netVND!).lt(0))).toBe(true);
    expect(Number(sum(calendarVM(r).map(d=>d.netVND!)))).toBe((metricsVM(r).net as {value:number}).value);
    await expect(stageDemoTrades(snap)).rejects.toThrow('đã có');await db.rollbackBatch(stage.batch.batchId,snap.version);expect((await replayLedger((await db.snapshot()).data)).cycles).toHaveLength(0);
  }finally{await db.delete();}
});

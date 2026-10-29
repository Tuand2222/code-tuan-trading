import {describe,it,expect} from 'vitest';
import {QuantV34 as Q} from '../../src/core/quant-v34.js';
// Independent deterministic currency paths; expected values from §12.5 arithmetic,
// not a snapshot of this browser implementation.
const base={size:1000,ml:.1,dl:0,f:.01,sp:.8,payoutDays:2,minPayout:0,payoutFraction:1,payoutCap:null,afterPayout:'KEEP_FLOOR',lockInitial:false,lockOffset:0,ddType:'STATIC',dailyMode:'FIXED_INITIAL_PCT_FROM_MIDNIGHT_BALANCE',consistencyShare:.5,consistencyScope:'off',consistencyBehavior:'INCREASE_TARGET_SOFT',comp:false};
describe('v3.4 funded money and lifecycle acceptance',()=>{
 it('requires day keys and preserves day-cluster order',()=>{
  expect(Q.propGroupDays([{r:1}]).reason).toBe('day_keys_required');
  expect(Q.propGroupDays([{r:2,day:'2026-01-01'},{r:-1,day:'2026-01-01'},{r:3,day:'2026-01-02'}]).groups.map((g:Array<{r:number}>)=>g.map(x=>x.r))).toEqual([[2,-1],[3]]);
 });
 it('cash payouts use split and only completed cycles',()=>{
  const r=Q.propPath({...base,mode:'funded'},{dailyReturns:[20,30,40],dayCap:3});
  expect(r.status).toBe('ok');expect(r.grossPayout).toBe('50');expect(r.netPayout).toBe('40');expect(r.balance).toBe('1040');expect(r.payouts).toHaveLength(1);
 });
 it.each([['KEEP_FLOOR','900',true],['LOCK_AT_INITIAL','1000',false],['LOCK_AT_BUFFER','1010',false],['FULL_RESET','900',true]])('%s preserves explicit post-payout semantics',(afterPayout,floor,survived)=>{
  const r=Q.propPath({...base,mode:'funded',afterPayout,lockOffset:10},{dailyReturns:[20,30],dayCap:2});
  expect(r.floor).toBe(floor);expect(r.survived).toBe(survived);
  if(!survived)expect(r.reason).toBe('post_payout_floor_reached');
 });
 it('fraction and cap leave real retained balance',()=>{
  const r=Q.propPath({...base,mode:'funded',payoutFraction:.5,payoutCap:20},{dailyReturns:[20,30],dayCap:2});
  expect(r.grossPayout).toBe('20');expect(r.balance).toBe('1030');expect(r.netPayout).toBe('16');
 });
 it('minimum payout postpones withdrawal',()=>{
  expect(Q.propPath({...base,mode:'funded',minPayout:60},{dailyReturns:[20,30],dayCap:2}).grossPayout).toBe('0');
 });
 it('consistency applies to the current payout window',()=>{
  const r=Q.propPath({...base,mode:'funded',consistencyScope:'funded',consistencyShare:.5},{dailyReturns:[40,10,30],dayCap:3});
  expect(r.payouts[0].day).toBe(3);expect(r.grossPayout).toBe('80');
 });
 it('touching daily or maximum floor breaches before recovery',()=>{
  expect(Q.propPath({...base,mode:'funded',dl:.05},{dailyReturns:[-50,100],dayCap:2}).reason).toBe('daily_loss');
  expect(Q.propPath({...base,mode:'funded'},{dailyReturns:[-100,200],dayCap:2}).reason).toBe('max_loss');
 });
 it('EOD trailing and payout do not rescale a retained floor',()=>{
  const r=Q.propPath({...base,mode:'funded',ddType:'EOD_TRAILING'},{dailyReturns:[50,50],dayCap:2});
  expect(r.floor).toBe('1000');expect(r.reason).toBe('post_payout_floor_reached');
 });
 it('evaluation target None rejects; direct funded has no target',()=>{
  expect(Q.propPath({...base,mode:'evaluation',target:null},{dailyReturns:[100],dayCap:1}).reason).toBe('phase_khong_co_muc_tieu');
  expect(Q.propPath({...base,mode:'funded'},{dailyReturns:[100],dayCap:1}).status).toBe('ok');
 });
 it('EV uses unconditional mean once, activation and refund by P(Funded)',()=>{
  expect(Q.propEconomics({pFunded:.5,meanGrossPayout:100,split:.8,fee:50,activation:20,refund:true})).toMatchObject({evAttempt:'45',expectedOutlay:'60',roiPct:'75'});
  expect(Q.propEconomics({pFunded:1,meanGrossPayout:100,split:.8,fee:0,activation:0}).roiPct).toBeNull();
 });
 it('invalid money, bool and missing samples are explicit errors',()=>{
  for(const size of [NaN,Infinity,true,null,''])expect(Q.propPath({...base,size,mode:'funded'},{dailyReturns:[1],dayCap:1}).status).toBe('error');
  expect(Q.propLifecycle({...base,mode:'evaluation',R:[],n:20,stages:[.01],tpd:1,maxT:2,fT:2,resample:'none'}).status).toBe('empty');
 });
 it('deterministic all-winning lifecycle exactly matches hand computation',()=>{
  const r=Q.propLifecycle({...base,mode:'evaluation',R:[1,1],n:10,stages:[.01],tpd:1,maxT:2,fT:4,fee:5,actFee:2,resample:'none',seed:7});
  expect(r.status).toBe('ok');expect(r.pFunded).toBe(1);expect(r.meanGrossPayout).toBe('40');expect(r.meanNetPayout).toBe('32');expect(r.evAttempt).toBe('25');expect(r.expectedOutlay).toBe('7');expect(r.phasePassCounts).toEqual([10]);
 });
 it('day bootstrap rejects unavailable dates instead of iid fallback',()=>{
  const r=Q.propLifecycle({...base,mode:'funded',R:[1,-1],n:10,tpd:1,maxT:2,fT:2,resample:'day'});
  expect(r.reason).toBe('day_keys_required');
 });
 it('separate funded capital and split use the same latent world, not evaluation split',()=>{
  const r=Q.propLifecycle({...base,mode:'evaluation',R:[1,1],n:10,stages:[.01],tpd:1,maxT:2,fT:4,fee:5,actFee:2,resample:'none',fundedRules:{...base,size:2000,sp:.5}});
  expect(r.meanGrossPayout).toBe('80');expect(r.meanNetPayout).toBe('40');expect(r.evAttempt).toBe('33');
 });
 it('day bootstrap resolves account timezone and reset inside the shared Worker engine',()=>{
  const p={...base,mode:'evaluation',R:[2,-2],samples:[{r:2,dayTime:'2026-01-01T23:00:00Z'},{r:-2,dayTime:'2026-01-02T01:00:00Z'}],n:10,stages:[.01],tpd:2,maxT:4,fT:4,resample:'day',seed:19,serverTimeZone:'America/New_York',dailyResetTime:'00:00'};
  const r=Q.propLifecycle(p);expect(r.status).toBe('ok');expect(r.sourceDays).toBe(1);expect(r.pFunded).toBe(0);
  expect(Q.propLifecycle({...p,serverTimeZone:'UTC'}).sourceDays).toBe(2);
 });
 it('seeded worlds are repeatable and outcomes partition the attempts',()=>{
  const p={...base,mode:'evaluation',R:[-1,2,3,-2],n:20,stages:[.02,.01],tpd:2,maxT:10,fT:6,fee:5,actFee:2,resample:'bayesian',outer:4,seed:42};
  const a=Q.propLifecycle(p);expect(a).toEqual(Q.propLifecycle(p));expect(a.fundedCount+a.failedCount+a.timeoutCount).toBe(20);expect(a.phasePassCounts[0]).toBeGreaterThanOrEqual(a.phasePassCounts[1]);expect(a.payoutMeanScope).toBe('unconditional_per_attempt');
 });
});

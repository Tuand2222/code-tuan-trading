import { expect, it } from 'vitest';
import { account, batch, fill, snapshot } from './fixtures';
import { replayLedger } from '../../lib/trading/application/replayLedger';
import { classicReport, classicYear, metricText } from '../../lib/trading/selectors/classic';
import { calendarVM, metricsVM } from '../../lib/trading/selectors';

it('restored reports retain event dates for partial closes across years and timezone',async()=>{
  const a=account(),b=batch('b',{fx:[{ccy:'VND',rateToVND:'1',source:'user'}]});
  const fills=await Promise.all([fill('o','buy','2','100','2026-12-30T16:00:00Z'),fill('p','sell','1','120','2026-12-31T16:00:00Z'),fill('c','sell','1','90','2026-12-31T18:00:00Z')]);
  const r=await replayLedger(snapshot(fills,a,[b])), f={timezone:'Asia/Ho_Chi_Minh'};
  const report=classicReport(r,f,200000000);
  expect(report.rows.map(d=>[d.date,d.pnl,d.trades])).toEqual([['2026-12-31',20,0],['2027-01-01',-10,1]]);
  expect(report.net).toBe(10);expect(report.maximumDrawdown).toBe(10);
  expect(report.rows.map(d=>String(d.pnl))).toEqual(calendarVM(r,f).map(d=>d.netVND));
  expect(classicYear(2026,r,f,200000000)).toMatchObject({net:20,total:0,hasData:true,expectedR:null});
  expect(classicYear(2027,r,f,200000000)).toMatchObject({net:-10,total:1,hasData:true});
  expect(classicReport(r,{...f,from:'2027-01-01'},200000000).net).toBe(-10);
});
it('never fills absent risk/review with zero or uses 99 as infinite profit factor',async()=>{
  const a=account(),b=batch('b',{fx:[{ccy:'VND',rateToVND:'1',source:'user'}]});
  const r=await replayLedger(snapshot(await Promise.all([fill('o','buy','1','100','2026-10-01T00:00:00Z'),fill('c','sell','1','110','2026-10-02T00:00:00Z')]),a,[b]));
  const report=classicReport(r,{},200000000), year=classicYear(2026,r,{},200000000);
  expect(report.riskCount).toBe(0);expect(report.reviewedCount).toBe(0);
  expect(year).toMatchObject({expectedR:null,avgGainR:null,discipline:null,profitFactor:Infinity});
  expect(metricText(metricsVM(r).averageR,'R')).toBe('—');
  expect(metricText({status:'ok',value:100,n:1,of:1},'ratio')).toBe('100.00');
  expect(classicYear(2026,r,{markets:['crypto']},200000000).hasData).toBe(false);
  r.cycles[0].risk={origin:'user-entered',amountVND:'5'};
  const mixed={...r,cycles:[r.cycles[0],{...r.cycles[0],tradeId:'unknown',risk:{origin:'none' as const},netVND:'1000'}],events:[...r.events,{...r.events[0],eventId:'unknown',tradeId:'unknown',netVND:'1000'}]};
  const mixedReport=classicReport(mixed,{},200000000);
  expect(mixedReport.net).toBe(1010);
  expect(mixedReport.rows.at(-1)?.riskPercent).toBe(200);
  expect(classicYear(2026,mixed,{},200000000).expectedR).toBe(2);
  r.events[0].netVND=undefined;
  expect(classicReport(r,{},200000000).complete).toBe(false);
});

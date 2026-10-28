import {describe,it,expect} from 'vitest';
import {QuantV34 as Q} from '../../src/core/quant-v34.js';

describe('v3.4 decisions and missing-data boundaries',()=>{
 it('Q1 includes the starting zero peak',()=>{
  expect(Q.drawdownR([-1])).toMatchObject({ddR:'1',maxDDR:'1'});
  expect(Q.drawdownR([-1,-2,1])).toMatchObject({ddR:'2',maxDDR:'3'});
 });
 it('small samples carry the specified label and general Omega',()=>{
  expect((Q as any).metrics([-3,0,1,2],{theta:1})).toMatchObject({omega:.2,median:.5,sampleLabel:'Chưa đủ mẫu',esWarning:true});
 });
 it('does not let an invalid R become a breakeven Kelly observation',()=>{
  expect(Q.kelly([null as any,true as any,NaN])).toMatchObject({status:'error',f:null});
 });
 it('validates stop side and preserves all-leg risk',()=>{
  expect((Q as any).risk1r({entry:100,sl:105,volume:1,vpoint:1,side:'buy'}).oneR).toBeNull();
  expect((Q as any).rMultiple({netPnl:50,entry:100,sl:105,volume:1,vpoint:1,side:'buy',fallback:{fixedAmount:25}})).toMatchObject({oneR:'25',oneRSource:'fallback_fixed',rMultiple:'2'});
 });
 it('uses the same clock rules in both interfaces',()=>{
  expect((Q as any).sourceTime('2026-03-08T02:30:00','America/New_York').reason).toBe('dst_nonexistent');
  expect((Q as any).sourceTime('2026-11-01T01:30:00','America/New_York').reason).toBe('dst_ambiguous');
  expect((Q as any).sourceTime('2026-11-01T01:30:00','America/New_York',0).iso).toBe('2026-11-01T05:30:00Z');
  expect((Q as any).sourceTime('2026-11-01T01:30:00','America/New_York',1).iso).toBe('2026-11-01T06:30:00Z');
 });
 it('FIFO Q2 keeps full and realized cost bases and account fees',()=>{
  const r=(Q as any).fifo([{side:'buy',qty:1,price:100,fee:'.10',sl:95},{side:'buy',qty:1,price:110,fee:'.11',sl:104},{side:'sell',qty:'1.5',price:120,fee:'.18'}],{vpoint:1});
  expect(r.cycles[0]).toMatchObject({status:'open',entryPrice:'105',netPnl:'24.665',openQty:'0.5',oneR:'11'});
  expect(Number(r.cycles[0].entryAvgClosed)).toBeCloseTo(310/3,12);
 });
 it('replays UTC instants rather than sorting offset strings',()=>{
  const r=(Q as any).replay(1000,[{id:'a',status:'closed',openTime:'2026-01-01T00:00:00Z',closeTime:'2026-01-01T10:00:00+07:00',netPnl:-60},{id:'b',status:'open',openTime:'2026-01-01T04:00:00Z'}]);
  expect(r.breachCount).toBe(1);expect(r.trades[1].autoTags).toContain('tier3_breach_at_open');
 });
});

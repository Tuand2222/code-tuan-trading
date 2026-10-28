import {it,expect} from 'vitest';
import Decimal from 'decimal.js';
import vectors from './fixtures/quant-v34-oracles.json';
import {QuantV34 as Q} from '../../src/core/quant-v34.js';
for(const [raw,expected] of vectors.normalize)it('v3.4 normalize '+raw,()=>expect(Q.normalize(raw)).toBe(expected));
for(const {input,expected} of vectors.classify)it('v3.4 classify '+input.symbol+' '+input.context,()=>{
 const actual=Q.classify(input.symbol,input.context);expect(actual.status).toBe(expected.status);expect(actual.symbol).toBe(expected.symbol);expect(actual.cls).toBe(expected.cls);
 if('suggest' in expected)expect(actual.suggest).toEqual(expected.suggest);
});
for(const [i,{input,expected}] of vectors.sizing.entries())it('v3.4 Decimal sizer Python parity '+i+' '+input.symbol,()=>{
 const actual:Record<string,any>=Q.size(input);const expectedFields=expected as Record<string,any>;expect(actual.status).toBe(expected.status);
 for(const key of ['volume','vRaw','lossPerLot','riskActual','minLotRisk'])if(key in expected){
  expect(actual[key],key).toBeDefined();expect(new Decimal(actual[key]).minus(expectedFields[key]).abs().lt('1e-28'),key).toBe(true);
 }
 if(actual.status==='ok')expect(new Decimal(actual.riskActual).lte(actual.riskBudget)).toBe(true);
});
it('v3.4 corrected master-prompt vectors preserve risk budget',()=>{
 expect(Q.kelly([2,2,2,-1,-1]).f).toBe(.4);
 expect((Q.size({symbol:'EURGBP',entry:'.855',sl:'.852',equity:5000,riskPct:1,rates:{'GBP/USD':'1.27'}}) as any).volume).toBe('.13'.replace(/^\./,'0.'));
});
it('v3.4 raw numeric Excel values never undergo locale text stripping',()=>{
 expect(Q.parseNumber(1983.983996,',')).toBe('1983.983996');expect(Q.parseColumn(['1.234','2.500','12,50'])).toEqual({separator:',',ambiguous:false,values:['1234','2500','12.5']});
 expect(Q.parseColumn(['1,234','2,500']).ambiguous).toBe(true);for(const x of ['',null,NaN,Infinity,true,'USD'])expect(Q.parseNumber(x)).toBeNull();
});
it('v3.4 currency inverse and USD bridge require a positive real rate',()=>{
 expect(Q.convert(13,'EUR','GBP',{'EUR/USD':'1.3','GBP/USD':'1.25'}).value).toBe('13.52');expect(Q.convert(1,'EUR','JPY',{}).status).toBe('error');
});
it('v3.4 NAV excludes cashflow jumps and date-only order is explicitly unknown',()=>{
 const r=Q.nav(10000,[{kind:'trade',amount:1000},{kind:'cash',amount:-5000},{kind:'trade',amount:-500}]);expect(Number(r.dd)*100).toBeCloseTo(8.333333333333,10);expect(r.equity).toBe('5500');
 const e:any=Q.nav(10000,[{kind:'trade',amount:1000,time:'2026-03-01'},{kind:'trade',amount:-1000,time:'2026-03-01'}],true);expect(e.dd).toBe('0');expect(e.flags).toContain('intraday_order_unknown');
});
it('v3.4 Q1 DD-R includes zero peak; missing sample stays unknown',()=>{
 expect(Q.drawdownR([-1,-2,1])).toMatchObject({ddR:'2',maxDDR:'3',cumR:'-2'});expect(Q.drawdownR([]).ddR).toBeNull();
});
it('v3.4 realized daily loss uses day-start equity and excludes future trades',()=>{
 const r=Q.daily(1000,[{date:'2026-03-01',netPnl:100},{date:'2026-03-02',netPnl:20},{date:'2026-03-02',netPnl:-130},{date:'2026-03-03',netPnl:900}],[],'2026-03-02');expect(r.equityStart).toBe('1100');expect(r.lossPct).toBe('10');
});
it('v3.4 warning gate always allows recording facts, even at 100% loss',()=>{
 const r=Q.safety(1000,[{id:'x',date:'2026-03-01',netPnl:-1000}],[]);expect(r.tier).toBe(3);expect(r.canInput).toBe(true);expect(Q.safety(1000,[],[]).status).toBe('STANDBY');
});
it('v3.4 metrics have integer ES count, safe infinity, and sample-aware SQN',()=>{
 const r=Q.metrics([2,-1,-1,1.5,-1,3,-1,.5,-1,2]);expect(r.kelly).toBeCloseTo(.20534890687807061,12);expect(r.sqnCategory).toBeNull();expect(r.sqnMessage).toContain('20');
 expect(Q.metrics([1,2]).pfDisplay).toBe('∞');expect(Q.metrics(Array(20).fill(-1)).esK).toBe(1);expect(Q.metrics([Infinity,null,''])).toMatchObject({N:0,status:'empty'});
});
it('v3.4 unknown timezone/date-only never invents session or duration',()=>{
 expect(Q.session('2026-03-01','2026-03-02',true)).toMatchObject({minutes:null,session:null});expect(Q.session('2026-03-01T01:00:00Z','2026-03-01T02:00:00Z')).toMatchObject({minutes:60,session:'Asia'});
});

import {it,expect} from 'vitest';
import {parseTradeCsv} from '../../lib/trade-import';
import {analyzeRiskTrades,riskDesk,DEFAULT_RISK,netPnl} from '../../lib/risk-analytics';
import {buildMetrixReport} from '../../lib/classic-analysis';
import {normalizeRiskSettings} from '../../lib/risk-settings-schema';
import {mergeSharedValue} from '../../lib/shared-settings-merge';
import {PositionProjection} from '../../src/core/position-cycles.js';
import {JournalAdapters} from '../../src/core/journal-adapters.js';
const row=(o:any={})=>({id:'one',date:'2026-10-23',symbol:'EURUSD',side:'Buy',pnl:100,fees:2,swap:0,risk:50,riskKnown:true,feesKnown:true,pnlKnown:true,session:'London',setup:'test',discipline:100,durationMin:20,...o});
it('unverified money cannot become SAFE, balance, WR or a zero-R sample',()=>{
 const rows=[row(),row({id:'bad',pnl:999999,feesKnown:false,risk:0,riskKnown:false})];
 const a=analyzeRiskTrades(rows,1000);expect(a.knownN).toBe(1);expect(a.net).toBe(98);expect(a.expectancyR).toBe(1.96);
 const d=riskDesk(rows,{...DEFAULT_RISK,initialCapital:1000},new Date('2026-10-23T12:00Z'));expect(d.balance).toBe(1098);expect(d.tier).toBe('unknown');expect(d.level).toBe('unknown');expect(d.usage).toBeNull();
});
it('Metrix reads shared actual capital, flags incomplete day and never invents PF/R/discipline',()=>{
 const r=buildMetrixReport([row({feesKnown:false,risk:0,riskKnown:false})],{...DEFAULT_RISK,initialCapital:12345});
 expect(r.balance).toBe(12345);expect(r.netN).toBe(0);expect(r.complete).toBe(false);expect(r.averageRR).toBeNull();expect(r.profitFactor).toBeNull();expect(r.rows[0].complete).toBe(false);expect(r.rows[0].pnl).toBeNull();expect(r.rows[0].risk).toBeNull();
});
it('Metrix and shared selectors use the same verified net and cash-neutral DD',()=>{
 const settings={...DEFAULT_RISK,initialCapital:1000,cashFlows:[{id:'dep',date:'2026-10-24',type:'deposit' as const,amount:9000}]},rows=[row({pnl:-100,fees:0,date:'2026-10-23'})];
 const r=buildMetrixReport(rows,settings),a=analyzeRiskTrades(rows,1000,settings.timezone,settings.cashFlows);expect(r.balance).toBe(9900);expect(r.net).toBe(-100);expect(r.maximumDrawdown).toBe(a.maxDD);expect(r.averageRR).toBe(-2);
});
it('risk settings wire contract preserves shared currency and cashflow audit fields',()=>{
 const cfg=normalizeRiskSettings({...DEFAULT_RISK,currency:'VND',cashFlows:[{id:'f',date:'2026-10-23',type:'deposit',amount:100,origin:'USER_LIVE',unifiedV6:{note:'keep'}}]});
 expect(cfg.currency).toBe('VND');expect(cfg.cashFlows![0].origin).toBe('USER_LIVE');expect(cfg.cashFlows![0].unifiedV6).toEqual({note:'keep'});
 expect(()=>normalizeRiskSettings({...DEFAULT_RISK,initialCapital:NaN})).toThrow();
});
it('three-way settings merge combines independent fields and distinct flow IDs',()=>{
 const base={capital:1000,risk:1,cashFlows:[]},local={...base,risk:2,cashFlows:[{id:'a',amount:10}]},remote={...base,capital:2000,cashFlows:[{id:'b',amount:20}]};
 const r=mergeSharedValue(base,local,remote);expect(r.conflicts).toEqual([]);expect(r.value).toEqual({capital:2000,risk:2,cashFlows:[{id:'a',amount:10},{id:'b',amount:20}]});
});
it('same-field conflict and delete/edit preserve both snapshots instead of guessing',()=>{
 expect(mergeSharedValue({capital:1000},{capital:2000},{capital:3000}).conflicts).toContain('capital');
 expect(mergeSharedValue({cashFlows:[{id:'a',amount:10}]},{cashFlows:[]},{cashFlows:[{id:'a',amount:20}]}).conflicts).toContain('cashFlows.a');
});
it('MT4 signed commission and swap are costs once, not positive profits',()=>{
 const r=parseTradeCsv('Date,Symbol,Type,Profit,Commission,Swap,Risk\n2026-10-23,EURUSD,buy,100,-2,-1.5,50','MT4');
 expect(r.errors).toEqual([]);expect(r.trades[0]).toMatchObject({pnl:100,fees:2,swap:1.5,feesKnown:true,pnlKnown:true,risk:50});expect(netPnl(r.trades[0] as any)).toBe(96.5);
});
it('Net P&L columns never subtract the recorded fees twice',()=>{
 const r=parseTradeCsv('Date,Symbol,Side,Net PnL,Fee\n2026-10-23,BTCUSDT,BUY,9.5,0.5');
 expect(r.errors).toEqual([]);expect(netPnl(r.trades[0] as any)).toBe(9.5);
});
it('file net remains verified without inventing a fee, missing direction is rejected',()=>{
 const r=parseTradeCsv('Date,Symbol,Side,Net PnL\n2026-10-23,EURUSD,buy,10');
 expect(r.trades[0].feesKnown).toBe(false);expect(analyzeRiskTrades(r.trades as any,1000).knownN).toBe(1);
 const v6=JournalAdapters.fromClassic(r.trades[0]);expect(v6.grossPnl).toBeNull();expect(v6.feeR).toBeNull();
 expect(parseTradeCsv('Date,Symbol,Profit,Fee\n2026-10-23,EURUSD,100,0').trades).toHaveLength(0);
});
it('explicit zero PnL/fee is valid; missing risk or clock does not become R=0 or Asia',()=>{
 const r=parseTradeCsv('Date,Symbol,Side,Profit,Fee\n2026-10-23,EURUSD,buy,0,0');expect(r.trades[0].feesKnown).toBe(true);expect(r.trades[0].pnlKnown).toBe(true);expect(r.trades[0].riskKnown).toBe(false);expect(r.trades[0].session).toBe('Chưa rõ');expect(analyzeRiskTrades(r.trades as any).expectancyR).toBeNull();
});
it('Classic and V6 project the same closed executions, including all fees/swap and no invented 1R',()=>{
 const fills=[row({id:'open',pnl:0,fees:2,swap:1,quantity:1,entryPrice:100,recordKind:'fill',side:'Buy'}),row({id:'close',pnl:20,fees:3,swap:-.5,quantity:1,entryPrice:120,recordKind:'fill',side:'Sell'})];
 const classic=PositionProjection.closedCycles(fills).closed;
 expect(classic).toHaveLength(1);expect(netPnl(classic[0])).toBe(14.5);expect(classic[0].riskKnown).toBe(false);
 const v6=PositionProjection.analytics(fills.map(t=>JournalAdapters.fromClassic(t)));
 expect(v6).toHaveLength(1);expect(v6[0]).toMatchObject({netPnl:14.5,is_net_pnl_verified:true,is_1r_verified:false});
 expect(PositionProjection.closedCycles([fills[1]]).closed).toHaveLength(0);
});
it('partial reports retain verified trade money but cannot certify the whole account',()=>{
 const p=parseTradeCsv('Date,Symbol,Side,Profit,Fee\n2026-10-23,EURUSD,buy,100,0\n2026-10-24,,balance,500,0');
 expect(p.errors).toHaveLength(1);expect(analyzeRiskTrades(p.trades as any,1000)).toMatchObject({knownN:1,net:100,financialComplete:false});
 expect(buildMetrixReport(p.trades as any,{...DEFAULT_RISK,initialCapital:1000}).ready).toBe(false);
});
it('MT4 repeated Time/Price columns use the closing date without guessing broker timezone',()=>{
 const p=parseTradeCsv('Time,Ticket,Symbol,Type,Volume,Price,Time,Price,Commission,Swap,Profit\n2026.10.20 09:00:00,123,EURUSD,buy,1,1.1,2026.10.23 10:00:00,1.11,-2,0,100','MT4');
 expect(p.trades[0]).toMatchObject({date:'2026-10-23',entryPrice:1.1,exitPrice:1.11,closedAt:null,session:'Chưa rõ'});
});

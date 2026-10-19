import type { ReplayResult, MetricResult } from '../domain/types';
import { costsVND } from '../domain/finance';
import { D, DecimalValue, sum, finiteNumber } from '../domain/decimal';
import { dateInZone, metricsVM, selectScope, validRiskTrades, rMultiple, type Filters } from './index';
import { metricRegistry } from './metricRegistry';

export function metricText(m: MetricResult<number>, format: string): string {
  if (m.status === 'no-losses') return '∞';
  if (m.status !== 'ok') return '—';
  if (format === 'money') return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(m.value);
  if (format === 'percent') return m.value.toFixed(1) + '%';
  if (format === 'R') return m.value.toFixed(2) + 'R';
  if (format === 'minutes') return Math.round(m.value) + 'm';
  if (format === 'streak') return m.value > 0 ? `W${m.value}` : m.value < 0 ? `L${-m.value}` : '0';
  return format === 'count' ? String(m.value) : m.value.toFixed(2);
}
export function classicReport(result: ReplayResult, filters: Filters, capital: number, dailyPct = 5, maximumPct = 10) {
  const scope = selectScope(result, filters), metrics = metricsVM(result, filters);
  const ordered = [...scope.cycles].sort((a,b)=>a.closeTsUtc!.localeCompare(b.closeTsUtc!) || a.tradeId.localeCompare(b.tradeId));
  const events = [...scope.events].sort((a,b)=>a.tsUtc.localeCompare(b.tsUtc) || (a.orderKey ?? a.eventId).localeCompare(b.orderKey ?? b.eventId));
  const risk = validRiskTrades(ordered, filters.includeEstimatedRisk), riskIds = new Set(risk.map(c=>c.tradeId));
  const totalRisk=D(sum(risk.map(c=>c.risk.amountVND!))); let realizedRiskNet=D('0');
  const maximumAmount = capital * maximumPct / 100, dailyLimitAmount = capital * dailyPct / 100;
  let balance = D(String(capital)), peak = balance, dd = D('0'), low = balance;
  const groups = new Map<string, typeof events>();
  for (const e of events) { const date=dateInZone(e.tsUtc,filters.timezone); groups.set(date,[...(groups.get(date)??[]),e]); }
  const rows = [...groups].map(([date, es])=>{
    const dayCycles=ordered.filter(c=>dateInZone(c.closeTsUtc!,filters.timezone)===date);
    const startBalance=finiteNumber(balance.toFixed()); let dayLow=balance;
    for(const e of es) { if(e.netVND===undefined) continue; balance=balance.plus(D(e.netVND)); peak=DecimalValue.max(peak,balance); dd=DecimalValue.max(dd,peak.minus(balance)); low=DecimalValue.min(low,balance);dayLow=DecimalValue.min(dayLow,balance); }
    const fees=costsVND(es.flatMap(e=>e.costs));
    realizedRiskNet=realizedRiskNet.plus(D(sum(dayCycles.filter(c=>riskIds.has(c.tradeId)).map(c=>c.netVND!))));
    return {date,trades:dayCycles.length,buys:dayCycles.filter(c=>c.direction==='LONG').length,sells:dayCycles.filter(c=>c.direction==='SHORT').length,
      riskPercent:totalRisk.gt(0)?finiteNumber(realizedRiskNet.div(totalRisk).mul(100).toFixed()):undefined,
      pnl:finiteNumber(sum(es.map(e=>e.netVND??'0'))),risk:finiteNumber(sum(dayCycles.filter(c=>riskIds.has(c.tradeId)).map(c=>c.risk.amountVND!))),
      riskCount:dayCycles.filter(c=>riskIds.has(c.tradeId)).length,fees:fees===undefined?undefined:finiteNumber(fees),
      startBalance,endBalance:finiteNumber(balance.toFixed()),lowestBalance:finiteNumber(dayLow.toFixed()),dailyDrawdown:Math.max(0,startBalance-finiteNumber(dayLow.toFixed())),maxLossLimit:capital-maximumAmount};
  });
  const symbols=[...new Set(ordered.map(c=>c.symbol))].map(symbol=>{const cs=ordered.filter(c=>c.symbol===symbol);return {symbol,trades:cs.length,wins:cs.filter(c=>c.netVND!==undefined&&D(c.netVND).gt(filters.breakevenBandVND??'0')).length,pnl:finiteNumber(sum(cs.map(c=>c.netVND??'0')))};}).sort((a,b)=>b.pnl-a.pnl);
  const absoluteSum=rows.reduce((s,r)=>s+Math.abs(r.pnl),0),largest=rows.reduce((v,r)=>Math.max(v,Math.abs(r.pnl)),0);
  return {metrics,ordered,rows,symbols,riskCount:risk.length,reviewedCount:ordered.filter(c=>c.overlay?.reviewStatus==='reviewed'&&c.overlay.disciplineScore!==undefined).length,
    complete:events.every(e=>e.netVND!==undefined)&&ordered.every(c=>c.netVND!==undefined),
    balance:finiteNumber(balance.toFixed()),net:finiteNumber(balance.minus(capital).toFixed()),maximumDrawdown:finiteNumber(dd.toFixed()),
    dailyLimitAmount,maximumAmount,currentMaxLossLimit:capital-maximumAmount,maxLossUsed:Math.max(0,capital-finiteNumber(low.toFixed())),
    anyDailyBreach:rows.some(r=>r.dailyDrawdown>dailyLimitAmount),anyMaximumBreach:finiteNumber(low.toFixed())<capital-maximumAmount,
    worstDailyDrawdown:rows.reduce((v,r)=>Math.max(v,r.dailyDrawdown),0),bestDay:rows.reduce((v,r)=>Math.max(v,r.pnl),0),
    consistency:absoluteSum?(1-largest/absoluteSum)*100:undefined,
    stats:metricRegistry.map(def=>[def.labelVi,metricText(metrics[def.id],def.format)]),
  };
}

export function classicYear(year: number, result: ReplayResult, filters: Filters, capital: number) {
  const from=[filters.from,`${year}-01-01`].filter(Boolean).sort().at(-1)!;
  const to=[filters.to,`${year}-12-31`].filter(Boolean).sort()[0]!;
  const f={...filters,from,to}, scope=selectScope(result,f), m=metricsVM(result,f), report=classicReport(result,f,capital);
  const val=(key:string)=>m[key].status==='ok'?m[key].value:null;
  const valid=validRiskTrades(scope.cycles,filters.includeEstimatedRisk), rs=valid.map(c=>Number(rMultiple(c))).sort((a,b)=>b-a);
  const mean=(xs:number[])=>xs.length?xs.reduce((s,v)=>s+v,0)/xs.length:null;
  const gain=mean(rs.filter(r=>r>0)),loss=mean(rs.filter(r=>r<0)),topCount=Math.ceil(rs.length*.15),top=rs.slice(0,topCount).reduce((s,v)=>s+v,0),bottom=rs.slice(topCount);
  const bottomTotal=bottom.reduce((s,v)=>s+v,0),profit=val('grossProfit');
  const topCash=scope.cycles.every(c=>c.netVND!==undefined)?[...scope.cycles].map(c=>Number(c.netVND)).sort((a,b)=>b-a).slice(0,Math.ceil(scope.cycles.length*.15)).reduce((s,v)=>s+Math.max(0,v),0):null;
  const net=val('net'),dd=val('maxDrawdown');
  return {year,hasData:!!(scope.cycles.length||scope.events.length),total:scope.cycles.length,net,winRate:val('winRate'),avgGainR:gain,avgLossR:loss,
    winLossRatio:gain!==null&&loss!==null&&loss!==0?Math.abs(gain/loss):null,returnPercent:net===null?null:net/capital*100,
    profitFactor:m.profitFactor.status==='no-losses'?Infinity:val('profitFactor'),expectedR:val('averageR'),
    top15Share:profit!==null&&profit>0&&topCash!==null?topCash/profit*100:null,bottomR:mean(bottom),paretoRatio:bottomTotal?Math.abs(top/bottomTotal):null,
    maxDrawdownPercent:dd===null?null:dd/capital*100,recoveryFactor:val('recovery'),discipline:val('discipline'),riskCount:valid.length,reviewedCount:report.reviewedCount};
}

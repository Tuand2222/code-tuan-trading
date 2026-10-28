import { D, dec, sum } from '../domain/decimal';
import type { ReplayResult } from '../domain/types';
import { dateInZone, selectScope, validRiskTrades, rMultiple, type Filters } from './index';
export function riskReport(result:ReplayResult,filters:Filters={}) {
  const {cycles,events}=selectScope(result,filters),risk=validRiskTrades(cycles,filters.includeEstimatedRisk),months=new Map<string,typeof events>();
  let equity=D('0'),peak=D('0'),unknown=false;
  const underwater=[...events].sort((a,b)=>a.tsUtc.localeCompare(b.tsUtc)||a.eventId.localeCompare(b.eventId)).map(e=>{if(e.netVND===undefined)unknown=true;else equity=equity.plus(e.netVND);if(equity.gt(peak))peak=equity;return{tsUtc:e.tsUtc,drawdownVND:unknown?undefined:dec(peak.minus(equity))};});
  for(const e of events){const month=dateInZone(e.tsUtc,filters.timezone).slice(0,7);if(!months.has(month))months.set(month,[]);months.get(month)!.push(e);}
  const wins=cycles.filter(c=>c.netVND!==undefined&&D(c.netVND).gt(0)).sort((a,b)=>D(b.netVND!).cmp(D(a.netVND!))),positive=sum(wins.map(c=>c.netVND!)),top=sum(wins.slice(0,5).map(c=>c.netVND!));
  const buckets=new Map<string,number>();for(const c of risk){const r=D(rMultiple(c)!),key=r.lte(-1)?'≤ −1R':r.lt(0)?'−1R → 0':r.lt(1)?'0 → 1R':r.lt(2)?'1R → 2R':r.lt(3)?'2R → 3R':'≥ 3R';buckets.set(key,(buckets.get(key)??0)+1);}
  return {underwater,currentDrawdownVND:underwater.at(-1)?.drawdownVND,top5ProfitShare:wins.length&&cycles.every(c=>c.netVND!==undefined)?Number(dec(D(top).div(positive).mul('100'))):null,top5Count:Math.min(5,wins.length),riskN:risk.length,riskOf:cycles.length,
    meanRiskVND:risk.length?dec(D(sum(risk.map(c=>c.risk.amountVND!))).div(String(risk.length))):undefined,rDistribution:[...buckets].map(([label,count])=>({label,count})),
    months:[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,es])=>({month,netVND:es.every(e=>e.netVND!==undefined)?sum(es.map(e=>e.netVND!)):undefined,events:es.length}))};
}

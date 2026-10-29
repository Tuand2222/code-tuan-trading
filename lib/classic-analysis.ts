import {JournalForm} from '../src/core/trade-form.js';
import {riskDesk,type RiskSettings,type RiskTrade,netPnl} from './risk-analytics';

/** Presentation of the shared verified sample. Unknown fields stay unknown. */
export function buildMetrixReport(input: readonly RiskTrade[], settings:RiskSettings) {
 const desk=riskDesk(input,settings),a=desk;
 const all=a.trades, ordered=all.filter(JournalForm.netVerified).map(t=>({...t,pnl:netPnl(t)}));
 const complete=a.financialComplete,capitalReady=settings.initialCapital>0, ready=complete&&capitalReady&&ordered.length>0;
 const grouped=new Map<string,RiskTrade[]>();for(const t of all){const items=grouped.get(t.date);if(items)items.push(t);else grouped.set(t.date,[t]);}
 const cash=[...(settings.cashFlows||[])].sort((a,b)=>a.date.localeCompare(b.date));
 let prior=0,flows=0,cashIndex=0;
 const rows=[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>{
  const known=items.filter(JournalForm.netVerified);
  const dayComplete=known.length===items.length;
  while(cashIndex<cash.length&&cash[cashIndex].date<=date){const f=cash[cashIndex++];flows+=f.type==='withdrawal'?-f.amount:f.amount;}
  const startBalance=settings.initialCapital+prior+flows;
  let low=startBalance,balance=startBalance;
  for(const t of known){balance+=netPnl(t);low=Math.min(low,balance);}
  const dailyBudget=Math.max(0,startBalance)*settings.dailyLossPercent/100;
  const maxLossLimit=settings.floorMode==='static'?settings.initialCapital*(1-settings.maxDrawdownPercent/100)+flows:desk.floor;
  prior+=known.reduce((s,t)=>s+netPnl(t),0);
  return {date,trades:items.length,buys:items.filter(t=>t.side==='Buy').length,sells:items.filter(t=>t.side==='Sell').length,complete:dayComplete,
   pnl:dayComplete?known.reduce((s,t)=>s+netPnl(t),0):null,
   risk:dayComplete&&known.every(JournalForm.riskVerified)?known.reduce((s,t)=>s+t.risk,0):null,
   fees:items.every(t=>t.feesKnown!==false)?items.reduce((s,t)=>s+(t.fees||0)+(t.swap||0),0):null,
   startBalance,endBalance:balance,lowestBalance:low,dailyDrawdown:Math.max(0,startBalance-low),dailyBudget,maxLossLimit,
   usage:ready&&dailyBudget>0?100*Math.max(0,startBalance-low)/dailyBudget:null};
 });
 const wins=ordered.filter(t=>t.pnl>0),losses=ordered.filter(t=>t.pnl<0),sum=(xs:typeof ordered)=>xs.reduce((s,t)=>s+t.pnl,0);
 const avg=(xs:number[])=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:null;
 const symbols=a.symbols.map(g=>({symbol:g.label,pnl:g.net,trades:g.n,wins:Math.round(g.winRate*g.n/100)}));
 let win=0,loss=0,maxWin=0,maxLoss=0;for(const t of ordered){if(t.pnl>0){win++;loss=0;}else if(t.pnl<0){loss++;win=0;}else{win=loss=0;}maxWin=Math.max(maxWin,win);maxLoss=Math.max(maxLoss,loss);}
 const absolute=rows.reduce((s,r)=>s+Math.abs(r.pnl??0),0),largest=Math.max(0,...rows.map(r=>Math.abs(r.pnl??0)));
 const duration=ordered.filter(t=>t.durationMin>0||(t.openedAt&&t.closedAt));
 const discipline=ordered.filter(t=>Object.keys(t.rules||{}).length>0||t.unifiedV6?.disciplineKnown===true||t.discipline>0);
 return {ordered,rows,rawCount:all.length,netN:a.knownN,rN:a.rN,excludedN:all.length-a.knownN,complete,capitalReady,ready,
  balance:a.balance,net:a.net,grossProfit:sum(wins),grossLoss:-sum(losses),wins,losses,
  totalRisk:a.rN===ordered.length&&ordered.length?ordered.reduce((s,t)=>s+t.risk,0):null,
  profitFactor:a.profitFactor,noLoss:a.noLoss,expectancy:ordered.length?a.net/ordered.length:null,averageRR:a.expectancyR,
  averageWin:wins.length?sum(wins)/wins.length:null,averageLoss:losses.length?-sum(losses)/losses.length:null,
  biggestWin:wins.length?Math.max(...wins.map(t=>t.pnl)):null,biggestLoss:losses.length?Math.min(...losses.map(t=>t.pnl)):null,
  averageDuration:avg(duration.map(t=>t.durationMin)),averageDiscipline:avg(discipline.map(t=>t.discipline)),maximumDrawdown:a.maxDD,
  lowestBalance:Math.min(settings.initialCapital,...rows.map(r=>r.lowestBalance)),worstDailyDrawdown:Math.max(0,...rows.map(r=>r.dailyDrawdown)),
  anyDailyBreach:ready&&rows.some(r=>(r.usage??0)>=100),anyMaximumBreach:ready&&desk.tier==='stop',
  currentMaxLossLimit:desk.floor,maxLossUsed:Math.max(0,desk.peak-desk.balance),maximumAmount:settings.initialCapital*settings.maxDrawdownPercent/100,
  dailyLimitAmount:desk.dailyBudget,bestDay:Math.max(0,...rows.map(r=>r.pnl??0)),consistency:complete&&absolute?(1-largest/absolute)*100:null,
  symbols,streak:{maxWin,maxLoss},desk};
}

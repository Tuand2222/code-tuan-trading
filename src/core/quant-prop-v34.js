// Browser port of quant/tuan_trader_v3_4.py §12.5.
// Decimal is injected by QuantV34, including its generated Worker bundle.
export const createPropV34 = D => {
 const dec=x=>{if(x===null||x===undefined||x===''||typeof x==='boolean')return null;try{const d=new D(String(x));return d.isFinite()?d:null;}catch{return null;}};
 const str=x=>x===null?null:x.toFixed(), zero=()=>new D(0);
 const rngFor=seed=>{let a=Number(seed)>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};};
 const normalized=raw=>{
  const x=typeof raw==='object'&&raw!==null?raw:{r:raw},r=dec(x.r??x.R);
  if(!r||!Number.isFinite(r.toNumber()))return null;
  if(x.mae!==undefined&&x.mae!==null&&!dec(x.mae)||x.mfe!==undefined&&x.mfe!==null&&!dec(x.mfe))return null;
  return {r:r.toNumber(),feeKnown:x.feeKnown!==false,mae:x.mae??null,mfe:x.mfe??null,day:x.day??null};
 };
 const config=raw=>{
  const p={dl:0,sp:.8,f:.01,payoutDays:14,minPayout:0,payoutFraction:1,payoutCap:null,afterPayout:'KEEP_FLOOR',lockInitial:false,lockOffset:0,ddType:'STATIC',dailyMode:'FIXED_INITIAL_PCT_FROM_MIDNIGHT_BALANCE',consistencyShare:.55,consistencyScope:'off',consistencyBehavior:'INCREASE_TARGET_SOFT',comp:false,bound:'optimistic',feeDragR:0,mfeExtraR:.5,...raw};
  const money=['size','ml','dl','sp','f','minPayout','payoutFraction','lockOffset','consistencyShare','feeDragR','mfeExtraR'];
  const d=Object.fromEntries(money.map(k=>[k,dec(p[k])]));
  if(Object.values(d).some(v=>v===null)||!d.size.gt(0)||!d.ml.gt(0)||d.ml.gte(1)||d.dl.lt(0)||d.dl.gte(1)||!d.f.gt(0)||d.f.gt(.05)||d.sp.lt(0)||d.sp.gt(1)||d.minPayout.lt(0)||!d.payoutFraction.gt(0)||d.payoutFraction.gt(1)||d.lockOffset.lt(0)||!d.consistencyShare.gt(0)||d.consistencyShare.gt(1)||d.feeDragR.lt(0)||d.mfeExtraR.lt(0))return null;
  if(!['STATIC','EOD_TRAILING','INTRADAY_TRAILING'].includes(p.ddType)||!['KEEP_FLOOR','LOCK_AT_INITIAL','LOCK_AT_BUFFER','FULL_RESET'].includes(p.afterPayout)||!['evaluation','funded','both','off'].includes(p.consistencyScope)||!['INCREASE_TARGET_SOFT','FAIL_HARD'].includes(p.consistencyBehavior)||!['FIXED_INITIAL_PCT_FROM_MIDNIGHT_BALANCE','PCT_OF_MAX_PREV_BALANCE_EQUITY'].includes(p.dailyMode)||!['optimistic','pessimistic'].includes(p.bound)||!Number.isInteger(p.payoutDays)||p.payoutDays<1||p.payoutDays>365)return null;
  if(p.payoutCap!==null&&(!dec(p.payoutCap)?.gt(0)))return null;
  if(!['comp','lockInitial'].every(k=>typeof p[k]==='boolean')||p.refund!==undefined&&typeof p.refund!=='boolean')return null;
  if(['minTradingDays','minProfitableDays'].some(k=>p[k]!==undefined&&(!Number.isInteger(p[k])||p[k]<0||p[k]>5000)))return null;
  if(p.profitableDayMinPct!==undefined&&(!dec(p.profitableDayMinPct)||dec(p.profitableDayMinPct).lt(0)))return null;
  return {...p,d};
 };
 const weighted=(pop,cum,rng)=>{const v=rng()*cum[cum.length-1];let lo=0,hi=cum.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(v<cum[mid])hi=mid;else lo=mid+1;}return pop[lo];};
 const accumulate=weights=>{let s=0;return weights.map(w=>(s+=w));};
 return {
 /** @returns {any} */
 propGroupDays(samples){
  if(!samples.length)return {status:'empty',reason:'khong co mau R'};
  const groups=new Map();
  for(const raw of samples){if(!raw||typeof raw!=='object'||!raw.day)return {status:'error',reason:'day_keys_required',warnings:['day_bootstrap_requires_day_key']};
   const x=normalized(raw);if(!x)return {status:'error',reason:'invalid_day_sample'};if(!groups.has(x.day))groups.set(x.day,[]);groups.get(x.day).push(x);
  }return {status:'ok',groups:[...groups.values()]};
 },
 /** @returns {any} */
 propEconomics({pFunded,meanGrossPayout,split,fee,activation=0,refund=false}){
  const ds=[pFunded,meanGrossPayout,split,fee,activation].map(dec);
  if(ds.some(x=>x===null))return {status:'missing',evAttempt:null,roiPct:null};
  const [pf,mean,sp,cost,act]=ds;
  if(pf.lt(0)||pf.gt(1)||sp.lt(0)||sp.gt(1)||mean.lt(0)||cost.lt(0)||act.lt(0))return {status:'error',reason:'invalid_ev_input',evAttempt:null,roiPct:null};
  const ev=mean.mul(sp).plus(refund?pf.mul(cost):0).minus(cost).minus(pf.mul(act)),outlay=cost.plus(pf.mul(act));
  return {status:'ok',evAttempt:str(ev),expectedOutlay:str(outlay),roiPct:outlay.gt(0)?str(ev.div(outlay).mul(100)):null};
 },
 /** @returns {any} */
 propPath(raw,options={}){
  const p=config(raw);if(!p)return {status:'error',reason:'invalid_payout_configuration'};
  const funded=p.mode==='funded',target=dec(p.target);
  if(!funded&&!target)return {status:'error',reason:'phase_khong_co_muc_tieu'};
  if(!funded&&!target.gt(0))return {status:'error',reason:'invalid_target'};
  const dayCap=p.maxDays??options.dayCap??250,tpd=options.tpd??1;
  if(!Number.isInteger(dayCap)||dayCap<0||dayCap>5000||!Number.isInteger(tpd)||tpd<1||tpd>30)return {status:'error',reason:'invalid_simulation_count'};
  const scripted=options.dailyReturns,pop=options.population||[],cum=options.cumulative||accumulate(pop.map(()=>1)),rng=options.rng||rngFor(0),groups=options.groups;
  if(!scripted&&!pop.length)return {status:'empty',reason:'khong co mau R'};
  const {size:B0,ml,dl,f,sp,minPayout,payoutFraction,lockOffset,consistencyShare,feeDragR,mfeExtraR}=p.d;
  const loss=B0.mul(ml),cap=dec(p.payoutCap),scope=p.consistencyScope==='both'||p.consistencyScope===(funded?'funded':'evaluation');
  let B=B0,peak=B0,floor=B0.minus(loss),locked=false,paid=false,since=0,best=zero(),profDays=0,reason=null,trades=0,grossTotal=zero(),payoutCount=0,daysDone=0;
  const payouts=[],path=[],window=[];
  const floorValue=()=>{const v=p.ddType==='STATIC'?B0.minus(loss):peak.minus(loss);return p.lockInitial&&p.ddType!=='STATIC'?D.min(v,B0.plus(lockOffset)):v;};
  const remember=event=>{if(options.track!==false)path.push({day:daysDone,balance:str(B),floor:str(floor),event});};
  const end=(passed=false)=>({status:'ok',passed,survived:!reason,reason,balance:str(B),floor:str(floor),grossPayout:str(grossTotal),netPayout:str(grossTotal.mul(sp)),payoutCount,payouts,path,days:daysDone,trades, ...(!funded?{outcome:passed?'passed':reason?'failed':'timeout'}:{})});
  const limit=Math.min(dayCap,scripted?scripted.length:dayCap);
  for(let day=0;day<limit;day++){
   daysDone=day+1;const start=B,dailyFloor=dl.gt(0)?(p.dailyMode==='PCT_OF_MAX_PREV_BALANCE_EQUITY'?start.mul(new D(1).minus(dl)):start.minus(B0.mul(dl))):null;
   const picked=scripted?[{cash:scripted[day]}]:groups?groups[Math.floor(rng()*groups.length)]:Array.from({length:tpd},()=>weighted(pop,cum,rng));
   for(const obs of picked){
    const unit=(p.comp?B:B0).mul(f);
    let pnl,mae=null,mfe=null;
    if('cash' in obs){pnl=dec(obs.cash);if(!pnl)return {status:'error',reason:'invalid_daily_return'};}
    else{const rate=dec(obs.r).minus(obs.feeKnown?0:feeDragR);pnl=rate.mul(unit);mae=dec(obs.mae)?.mul(unit)??null;mfe=dec(obs.mfe)?.mul(unit)??(p.bound==='pessimistic'&&rate.gt(0)?rate.plus(mfeExtraR).mul(unit):null);}
    const after=B.plus(pnl),low=D.min(B,after,mae?B.plus(mae):B),high=D.max(B,after,mfe?B.plus(mfe):B);trades++;
    if(p.ddType==='INTRADAY_TRAILING'&&!locked&&p.bound==='pessimistic'){peak=D.max(peak,high);floor=D.max(floor,floorValue());}
    if(low.lte(floor)||dailyFloor&&low.lte(dailyFloor)){reason=low.lte(floor)?'max_loss':'daily_loss';B=after;break;}
    if(p.ddType==='INTRADAY_TRAILING'&&!locked){peak=D.max(peak,high);floor=D.max(floor,floorValue());if(after.lte(floor)){reason='max_loss';B=after;break;}}
    B=after;
   }
   if(reason){remember(reason);return end();}
   if(p.ddType==='EOD_TRAILING'&&!locked){peak=D.max(peak,B);floor=D.max(floor,floorValue());}
   const gain=B.minus(start);best=D.max(best,gain);
   if(gain.gt(0)&&gain.gte(B0.mul(p.profitableDayMinPct??0).div(100)))profDays++;
   if(!funded){
    let need=B0.mul(target),total=B.minus(B0);
    if(scope){if(p.consistencyBehavior==='INCREASE_TARGET_SOFT')need=D.max(need,best.div(consistencyShare));else if(total.gte(need)&&best.gt(total.mul(consistencyShare))){reason='consistency';remember(reason);return end();}}
    remember('trade');
    if(total.gte(need)&&daysDone>=(p.minTradingDays??0)&&profDays>=(p.minProfitableDays??0))return end(true);
    continue;
   }
   window.push(gain);since++;
   const sum=window.reduce((a,b)=>a.plus(b),zero()),bestWindow=window.reduce((a,b)=>D.max(a,b),zero()),eligible=!scope||sum.gt(0)&&bestWindow.lte(sum.mul(consistencyShare));
   let gross=D.max(0,B.minus(B0)).mul(payoutFraction);if(cap)gross=D.min(gross,cap);
   let event='trade';
   if(since>=p.payoutDays&&gross.gt(0)&&gross.gte(minPayout)&&eligible){
    B=B.minus(gross);grossTotal=grossTotal.plus(gross);payoutCount++;event='payout';
    if(options.track!==false)payouts.push({day:daysDone,gross:str(gross),net:str(gross.mul(sp))});
    if(!paid){if(p.afterPayout==='LOCK_AT_INITIAL'){floor=B0;locked=true;}else if(p.afterPayout==='LOCK_AT_BUFFER'){floor=B0.plus(lockOffset);locked=true;}else if(p.afterPayout==='FULL_RESET'){peak=B0;floor=B0.minus(loss);locked=false;}paid=true;}
    window.length=0;since=0;if(B.lte(floor))reason='post_payout_floor_reached';
   }
   remember(event);if(reason)return end();
  }
  return end();
 },
 /** @returns {any} */
 propLifecycle(raw,progress){
  const p=config(raw);if(!p)return {status:'error',reason:'invalid_payout_configuration'};
  if(!['evaluation','funded'].includes(p.mode??'evaluation'))return {status:'error',reason:'invalid_prop_mode'};
  // R remains the public compatibility input; attach metadata only for the same population.
  const metadataMatches=Array.isArray(p.R)&&Array.isArray(p.samples)&&p.R.length===p.samples.length&&p.R.every((r,i)=>r===p.samples[i].r);
  let source=Array.isArray(p.R)?(metadataMatches?p.samples:p.R):(p.samples??[]);
  if(!Array.isArray(source)||!source.length)return {status:'empty',reason:'khong co mau R'};
  if(p.resample==='day'&&source.some(x=>x?.dayTime)){
   source=source.map(x=>{if(!x?.dayTime)return x;const time=this.sourceTime(x.dayTime,p.serverTimeZone||'UTC'),key=this.dayKey(time.iso||x.dayTime,p.serverTimeZone||'UTC',p.dailyResetTime||'00:00');return {...x,day:key.day,order:time.iso?Date.parse(time.iso):Date.parse(x.dayTime)};}).sort((a,b)=>(a.order??0)-(b.order??0));
  }
  const pop0=source.map(normalized);
  if(pop0.some(x=>x===null))return {status:'error',reason:'invalid_R_sample'};
  const mode=p.mode??'evaluation',stages=p.stages??[],resample=p.resample??'none',n=p.n??1000,tpd=p.tpd??1,maxT=p.maxT??250,fT=p.fT??250;
  const fundedConfig=config({...p,...(mode==='evaluation'?p.fundedRules:null)});
  if(!fundedConfig)return {status:'error',reason:'invalid_funded_preset'};
  if(mode==='evaluation'&&(!stages.length||stages.some(x=>x===null)))return {status:'error',reason:'phase_khong_co_muc_tieu'};
  if(mode==='evaluation'&&stages.some(x=>!dec(x)?.gt(0)))return {status:'error',reason:'invalid_target'};
  if(!['none','bayesian','efron','day'].includes(resample)||![n,tpd,maxT,fT].every(Number.isInteger)||n<1||n>10000||tpd<1||tpd>30||maxT<1||maxT>5000||fT<1||fT>5000)return {status:'error',reason:'invalid_simulation_count'};
  const fee=dec(p.fee??0),act=dec(p.actFee??0);
  if(!fee||!act||fee.lt(0)||act.lt(0))return {status:'error',reason:'invalid_ev_input'};
  const grouping=resample==='day'?this.propGroupDays(source):null;
  if(grouping&&grouping.status!=='ok')return grouping;
  const outer=resample==='none'?1:Math.min(n,p.outer??20);
  if(!Number.isInteger(outer)||outer<1||outer>100)return {status:'error',reason:'invalid_outer_worlds'};
  let fundedCount=0,failedCount=0,timeoutCount=0,failPhase1=0,toPhase1=0,gross=zero(),net=zero(),survivors=0,payoutAccounts=0,attempt=0,example=null;
  const phasePassCounts=stages.map(()=>0),ps=[],lengths=[],roiValues=[];
  for(let world=0;world<outer;world++){
   const rng=rngFor((p.seed??0)*1000003+world),choose=arr=>arr[Math.floor(rng()*arr.length)];
   let pop=pop0,weights=pop.map(()=>1),groups=null;
   if(resample==='bayesian')weights=pop.map(()=>-Math.log(Math.max(Number.MIN_VALUE,1-rng())));
   if(resample==='efron')pop=pop0.map(()=>choose(pop0));
   if(resample==='day'){groups=grouping.groups.map(()=>choose(grouping.groups));pop=groups.flat();weights=pop.map(()=>1);}
   const cum=accumulate(weights),worldN=Math.floor(n/outer)+(world<n%outer?1:0);let wins=0;
   for(let inner=0;inner<worldN;inner++){
    let passed=true,used=0,attemptGross=zero(),attemptNet=zero();
    if(mode==='evaluation')for(let phase=0;phase<stages.length;phase++){
     const rules=p.phaseRules?.[phase]||{};
     const evaluated=this.propPath({...p,...rules,mode:'evaluation',target:stages[phase]},{population:pop,cumulative:cum,rng,groups,dayCap:Math.floor(maxT/tpd),tpd,track:false});
     if(evaluated.status!=='ok')return evaluated;used+=evaluated.trades;
     if(evaluated.passed)phasePassCounts[phase]++;else{passed=false;if(evaluated.outcome==='failed'){failedCount++;if(!phase)failPhase1++;}else{timeoutCount++;if(!phase)toPhase1++;}break;}
    }
    if(passed){
     fundedCount++;wins++;lengths.push(used);
     const result=this.propPath({...fundedConfig,mode:'funded'},{population:pop,cumulative:cum,rng,groups,dayCap:Math.floor(fT/tpd),tpd,track:!example});
     if(result.status!=='ok')return result;
     attemptGross=dec(result.grossPayout);attemptNet=dec(result.netPayout);gross=gross.plus(attemptGross);net=net.plus(attemptNet);
     if(result.survived)survivors++;if(result.payoutCount)payoutAccounts++;if(!example)example=result;
    }
    const cost=fee.plus(passed?act:0),earned=attemptNet.plus(passed&&p.refund?fee:0);
    if(cost.gt(0))roiValues.push(earned.minus(cost).div(cost).toNumber());
    attempt++;if(progress&&(attempt%25===0||attempt===n))progress(attempt/n);
   }
   ps.push(wins/worldN);
  }
  const pFunded=fundedCount/n,meanGross=gross.div(n),economics=this.propEconomics({pFunded,meanGrossPayout:str(meanGross),split:fundedConfig.sp,fee:str(fee),activation:str(act),refund:p.refund});
  lengths.sort((a,b)=>a-b);roiValues.sort((a,b)=>a-b);
  const mu=pop0.reduce((a,x)=>a+x.r,0)/pop0.length,theoCycle=new D(Math.max(0,mu)).mul(fundedConfig.d.f).mul(fundedConfig.d.size).mul(tpd).mul(fundedConfig.payoutDays).mul(fundedConfig.d.sp),theoMonthly=theoCycle.div(fundedConfig.payoutDays).mul(p.tradingDays??21);
  return {status:'ok',engine:'3.4',mode,resample,seed:p.seed??0,attempts:n,worlds:outer,sourceDays:grouping?.groups.length??null,pFunded,fundedCount,failedCount,timeoutCount,phasePassCounts,ps,
   meanGrossPayout:str(meanGross),meanNetPayout:str(net.div(n)),payoutMeanScope:'unconditional_per_attempt',...economics,
   survivalGivenFunded:fundedCount?survivors/fundedCount:null,pPayout:payoutAccounts/n,example,
   pass:pFunded,fail:failedCount/n,to:timeoutCount/n,failPhase1:failPhase1/n,toPhase1:toPhase1/n,stPass:phasePassCounts.map(x=>x/n),medT:lengths.length?lengths[lengths.length>>1]:null,
   ev:Number(economics.expectedOutlay),evPay:net.div(n).toNumber(),campaignPay:null,evUsd:Number(economics.evAttempt),evPct:economics.roiPct===null?null:Number(economics.roiPct),roiPdfFunded:economics.roiPct===null?null:Number(economics.roiPct),roiPdfCycle:null,
   roiMed:roiValues.length?roiValues[roiValues.length>>1]:null,expectedCostOneAttempt:Number(economics.expectedOutlay),theoCycleProfit:theoCycle.toNumber(),theoMonthlyProfit:theoMonthly.toNumber(),cyc:null,
   warnings:['generic_payout_model_verify_contract_before_use',...(p.verified?[]:['preset_unverified']),...(pop0.length<30?['small_sample']:[]),...(p.comp?['compound_extension_not_reference_fixed_risk']:[])]};
 },
 /** @returns {Record<number, any>} */
 propCompare(p,progress){
  const out={};
  for(const idx of [0,1]){const ddType=idx?(p.trailingType??'INTRADAY_TRAILING'):'STATIC';out[idx]=this.propLifecycle({...p,ddType,...(p.fundedRules?{fundedRules:{...p.fundedRules,ddType}}:{})},v=>progress?.((idx+v)/2));}
  return out;
 }
 };
};

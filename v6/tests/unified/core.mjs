import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=process.cwd()+'/';
const out=process.env.UNIFIED_TEST_OUT;
const runtime=fs.readFileSync(out+'P7_RUNTIME.js','utf8');
const sandbox={structuredClone,setTimeout,clearTimeout,console};
vm.createContext(sandbox);vm.runInContext(runtime,sandbox);
const {Core:C,RiskMath:M,RiskStore:S,WorkerBridge:W,STORE_KEY}=sandbox.Unified;
const samples=JSON.parse(fs.readFileSync(out+'P2_SAMPLES.json','utf8'));
const plain=o=>JSON.parse(JSON.stringify(o));
const mem=initial=>{const data=new Map(Object.entries(initial||{})),writes=[];return {data,writes,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{writes.push(k);data.set(k,v);}};};
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const cases=[];
const check=(name,fn)=>{try{const detail=fn();cases.push({name,pass:true,...detail});}catch(error){cases.push({name,pass:false,error:error.message});}};
const oracle=vm.createContext({state:{},getCashflow:()=>[],Number,Math});
vm.runInContext(fs.readFileSync(out+'P2_SOURCE_A_ORACLE.js','utf8'),oracle);
const snapshotMetrics=[];
for(const which of ['A','B'])check('Sample '+which+': equity, NAV, expectancy, SQN, Omega, weighted ES',()=>{
  const s=C.sample(which);C.replace(s);const v=S.read(),r=s.trades.map(t=>t.netPnl/t.initialRisk),sum=r.reduce((x,y)=>x+y,0),mu=sum/r.length,sd=Math.sqrt(r.reduce((x,y)=>x+(y-mu)**2,0)/(r.length-1)),gain=r.filter(x=>x>0).reduce((x,y)=>x+y,0),loss=-r.filter(x=>x<0).reduce((x,y)=>x+y,0);
  close(v.equity,which==='A'?11850:23250);close(v.edge.expectancy,mu);close(v.edge.sqn,Math.sqrt(15)*mu/sd);close(v.edge.omega0,gain/loss);close(v.tail.es975,-1);assert.equal(v.tier,1);assert.equal(v.gates.sample,false);assert.equal(v.gates.pass,false);assert.equal(v.tail.smallSample,true);
  if(which==='A'){oracle.state=s;oracle.getCashflow=()=>[];const expected=vm.runInContext('capitalNAV()',oracle);for(const key of ['equity','nav','peak','dd','maxdd','pnl','flows'])close(v[key],expected[key]);}
  const metrics={sample:which,count:s.trades.length,equity:v.equity,dd:v.dd,maxdd:v.maxdd,tier:v.tier,expectancy:v.edge.expectancy,sqn:v.edge.sqn,omega0:v.edge.omega0,es975:v.tail.es975,rckRobust:v.rck.f,fStar:v.recommendation,gate:v.gates.pass};snapshotMetrics.push(metrics);return {metrics};
});
check('B conversion: side, MAE, discipline, PnL per trade; input immutable',()=>{
  const original=JSON.stringify(samples.B),s=C.sample('B');assert.equal(s.trades.length,15);for(let i=0;i<15;i++){const t=s.trades[i],raw=samples.B.trades[i];assert.ok(['Long','Short'].includes(t.side));assert.ok(t.maeR<=0);assert.ok(!('plannedRiskUsd' in t));const direct=(raw.side==='BUY'?1:-1)*(raw.exitPrice-raw.entryPrice)/Math.abs(raw.entryPrice-raw.slPrice)*raw.plannedRiskUsd;close(t.netPnl,direct);}assert.equal(s.trades[3].discipline,'FOMO');assert.equal(s.trades[4].discipline,'REVENGE');assert.equal(s.trades[0].discipline,'NONE');assert.equal(JSON.stringify(samples.B),original);return {};
});
check('Cashflow-neutral NAV after loss: deposit and withdrawal',()=>{
  const t=[{date:'2026-01-01',netPnl:1000},{date:'2026-01-02',netPnl:-1100}],base=M.capitalNAV(10000,t,[]);
  close(base.dd,.1);for(const [type,amount] of [['DEPOSIT',5000],['WITHDRAWAL',4000]]){const v=M.capitalNAV(10000,t,[{time:'2026-01-03T00:00',type,amount}]);close(v.dd,base.dd);close(v.nav,base.nav);close(v.maxdd,base.maxdd);close(v.equity,base.equity+(type==='DEPOSIT'?amount:-amount));}return {baseDD:base.dd};
});
check('Date-only day applies trade before EOD cashflow; intraday sequence unknown',()=>{
 const v=M.capitalNAV(10000,[{date:'2026-01-01',netPnl:-2000}],[{time:'2026-01-01T00:00',type:'DEPOSIT',amount:10000}]);close(v.dd,.2);assert.ok(v.flags.includes('intraday_order_unknown'));return {dd:v.dd};
});
check('Mixed timestamp offsets sort by actual instant, not lexical text',()=>{
 const trades=[{date:'2026-01-01',closeTime:'2026-01-01T01:00:00Z',netPnl:-2000}],flows=[{time:'2026-01-01T07:30:00+07:00',type:'DEPOSIT',amount:10000}];const v=M.capitalNAV(10000,trades,flows);close(v.dd,.1);return {dd:v.dd};
});
check('Tier thresholds, overrides, daily cap and three gates',()=>{
 const p=C.sample('A').riskProfile;assert.equal(M.tierOf(.03,p),1);assert.equal(M.tierOf(.030001,p),2);assert.equal(M.tierOf(.05,p),2);assert.equal(M.tierOf(.050001,p),3);close(M.dailyBudget(20000,1,p),125);close(M.dailyBudget(20000,2,p),100);close(M.dailyBudget(20000,3,p),0);
 const a=C.sample('A');a.trades=[...a.trades,...a.trades.map(t=>({...t,id:'copy-'+t.id}))];C.replace(a);assert.equal(S.read().gates.pass,true);a.riskProfile.tierOverride=3;C.replace(a);assert.equal(S.read().gates.pass,false);assert.equal(S.read().gates.stress,false);assert.equal(S.read().budget,0);return {};
});
check('Invalid initialRisk / estimated risk excluded; gross missing fees excluded',()=>{
 const t=C.sample('A').trades[0];assert.equal(M.validTrade({...t,initialRisk:null}),false);assert.equal(M.validTrade({...t,riskEstimated:true}),false);assert.equal(M.validTrade(t,true),false);close(M.netR({...t,feeR:.05},true),4.55);return {};
});
check('Fractional weighted ES vs floor/ceil; Omega(mu)=1',()=>{
 const r=Array.from({length:50},(_,i)=>i-10);close(M.esW(r,.975),-9.8);close(M.varW(r,.975),-9);close(M.omega(r,M.mean(r)),1);assert.ok(Number.isNaN(M.esW([])));assert.equal(M.omega([1,2],0),Infinity);return {};
});
check('Audited RCK and analytic RoR match actual source A',()=>{
 const r=C.sample('A').trades.map(t=>t.netPnl/t.initialRisk);for(const alpha of [.05,.2,.8])for(const beta of [.1,.2]){const v=M.rckEmpirical(r,alpha,beta),ref=oracle.rckEmpirical(r,alpha,beta);close(v.f,ref.f);close(v.kelly,ref.kelly);const phi=r.reduce((s,x)=>s+(1+v.f*x)**(-v.lambda),0)/r.length;assert.ok(phi<=1+1e-9);assert.ok(v.f<=v.kelly+1e-12);}
 const v=M.rckBinary(.6,1.5,.05,.2,30),ref=oracle.rckBernoulli(.6,1.5,.05,.2,30);close(v.f,ref.f);close(M.rorAnalytic(.6,1.5,.2,.01),oracle.analyticRoR(.6,1.5,.2,.01));assert.equal(M.rckEmpirical([-1,-2]).f,0);return {};
});
check('Seeded Monte Carlo exactly matches A; permutation/revenge deterministic',()=>{
 const r=[-1,1,2,-1,.5],o={horizon:30,runs:100,riskPct:1,ddLimit:.2};const v=M.simulate(r,o,2026),expected=oracle.simulate(r,o,2026);for(const key of ['med','p5','p95','win','ddMed','ddProb'])close(v[key],expected[key]);assert.deepEqual(plain(v.bands),plain(expected.bands));
 const z=M.simulate(r,{...o,mode:'permute',revenge:true},123);assert.deepEqual(plain(z),plain(M.simulate(r,{...o,mode:'permute',revenge:true},123)));assert.notDeepEqual(plain(z),plain(M.simulate(r,{...o,mode:'permute',revenge:true},124)));return {ddMedian:v.ddMed,ddP95:v.ddP95};
});
check('Manual close has zero auto slip; explicit A price-unit override',()=>{
 const t={side:'Long',symbol:'EURUSD',entryPrice:100,slPrice:90,tpPrice:120,exitPrice:95,openTime:'2026-01-01T00:00',closeTime:'2026-01-01T01:00'};assert.equal(M.calcTradeMetrics(t).slippageR,0);close(M.calcTradeMetrics({...t,exitPrice:88}).slippageR,.2);close(M.calcTradeMetrics({...t,exitPrice:119,exitReason:'TP'}).slippageR,.1);close(M.calcTradeMetrics({...t,slippage:2}).slippageR,.2);assert.equal(M.calcTradeMetrics({...t,side:'Short',slPrice:110,tpPrice:80,exitPrice:112}).exitReason,'SL');return {};
});
check('RiskStore cache computes once per commit and emits once',()=>{
 C.replace(C.sample('A'));const before=S.computeCount,a=S.read(),b=S.read();assert.equal(a,b);assert.equal(S.computeCount,before+1);let notifications=0;const unsub=C.subscribe(()=>{notifications++;S.read();});const st=mem();C.commit(d=>d.trades.push({...d.trades[0],id:'new',date:'2026-10-23',netPnl:100}),st);assert.equal(notifications,1);assert.equal(S.computeCount,before+2);assert.notEqual(S.read(),a);assert.ok(Object.isFrozen(S.read().edge));unsub();return {};
});
check('Backup -> clear -> restore preserves every field',()=>{
 const a=C.sample('A');a.extra={notes:{week:'hello'},book:[{image:'data:image/png;base64,AA=='}]};a.ext2={opt:{color:'red'},pip:20};a.snapshots=[{id:'s',f:.01}];a.cashflows=[{id:'flow',time:'2026-10-23T12:00',type:'DEPOSIT',amount:100,note:'test'}];a.trades[0].customField={text:'Giữ nguyên'};C.replace(a);const text=C.backupText(),store=mem();C.replace(C.sample('B'));C.importBackup(text,store);assert.deepEqual(plain(C.snapshot()),JSON.parse(text));assert.deepEqual(JSON.parse(store.getItem(STORE_KEY)),JSON.parse(text));return {fields:Object.keys(a).length};
});
check('Atomic failed commit/restore/quota does not change current state',()=>{
 const before=C.backupText(),broken={setItem(){throw new Error('quota');}};assert.throws(()=>C.commit(d=>d.trades=[],broken));assert.equal(C.backupText(),before);assert.throws(()=>C.importBackup('{"bad":1}',mem()));assert.equal(C.backupText(),before);assert.throws(()=>C.commit(d=>d.riskProfile.t3=1,mem()));assert.equal(C.backupText(),before);return {};
});
check('Migrate A+B: backup before write, priority, dedupe, extra/ext2, no removed keys',()=>{
 const a={...samples.A,trades:samples.A.trades,extra:{embedded:'kept'},initialCapital:10000};const b={tradeData:[samples.B.trades[0],samples.B.trades[0],{...samples.B.trades[1],id:1}],cashflowData:[{id:'CF1',time:'2026-09-25T09:00',type:'DEPOSIT',amount:20000,note:'Vốn khởi tạo ban đầu'},...samples.B.cashflows],simSnapshotsData:[{id:'SN1'}]};
 const keys={'tuannhatky_trial_v3_data':JSON.stringify(a),'tuannhatky_trial_v3_extra':JSON.stringify({dep:[{date:'2026-10-20',amt:-100,note:'a'}],notes:{a:'b'}}),'tuannhatky_trial_v3_ext2':JSON.stringify({pip:30}),'tuannhatky_v10_db_state':JSON.stringify(b)},store=mem(keys);let backup;
 const result=C.migrateLegacy(store,(name,text)=>{assert.equal(store.getItem(STORE_KEY),null);backup=JSON.parse(text);});assert.equal(result.trades,17);assert.equal(result.duplicates,1);assert.equal(result.cashflows,3);assert.equal(C.state.initialCapital,10000);assert.equal(C.state.extra.notes.a,'b');assert.ok(!('dep' in C.state.extra));assert.equal(C.state.ext2.pip,30);assert.equal(C.state.snapshots[0].id,'SN1');assert.equal(C.state.migration.idRenames.length,1);for(const [key,value] of Object.entries(keys))assert.equal(store.getItem(key),value);assert.deepEqual(backup.raw,keys);const before=store.writes.length;const second=C.migrateLegacy(store,()=>assert.fail('second migration backup'));assert.equal(second.alreadyUnified,true);assert.equal(store.writes.length,before);return {trades:result.trades,flows:result.cashflows,duplicates:result.duplicates};
});
check('B-only migration preserves raw trades and converts CF1 once without verifying missing Net flags',()=>{
 const store=mem({'tuannhatky_v10_db_state':JSON.stringify({tradeData:samples.B.trades,cashflowData:[{id:'CF1',time:'2026-09-25T09:00',type:'DEPOSIT',amount:20000,note:'Vốn khởi tạo ban đầu'},...samples.B.cashflows]})});C.migrateLegacy(store,()=>{});assert.equal(C.state.initialCapital,20000);assert.equal(C.state.cashflows.length,2);assert.equal(C.state.trades.length,15);close(S.read().equity,20000);assert.equal(S.read().edge.n,0);assert.equal(S.read().warning,true);return {};
});
check('Malformed legacy / failed backup / quota: no unified write, no lost raw',()=>{
 const valid=JSON.stringify({trades:samples.A.trades,initialCapital:10000});for(const value of ['{broken',JSON.stringify({oops:1})]){const store=mem({'tuannhatky_trial_v3_data':value});assert.throws(()=>C.migrateLegacy(store,()=>{}));assert.equal(store.getItem(STORE_KEY),null);assert.equal(store.getItem('tuannhatky_trial_v3_data'),value);}
 const store=mem({'tuannhatky_trial_v3_data':valid});assert.throws(()=>C.migrateLegacy(store,()=>{throw new Error('backup blocked');}));assert.equal(store.getItem(STORE_KEY),null);store.setItem=()=>{throw new Error('quota');};assert.throws(()=>C.migrateLegacy(store,()=>{}));assert.equal(store.getItem('tuannhatky_trial_v3_data'),valid);return {};
});
check('Empty existing ledger stays empty; fresh install waits for explicit choice',()=>{
 const store=mem({'tuannhatky_trial_v3_data':JSON.stringify({trades:[],initialCapital:1234})});C.migrateLegacy(store,()=>{});assert.equal(C.state.trades.length,0);assert.equal(C.state.initialCapital,1234);const fresh=mem();assert.equal(C.migrateLegacy(fresh).fresh,true);assert.equal(C.state.trades.length,0);assert.equal(C.state.sampleSource,null);return {};
});
check('Clear sample data preserves new user trades and edited sample records',()=>{
 const data=C.sample('A');data.trades[0].netPnl=999;data.trades.push({...data.trades[1],id:'real-added',date:'2026-10-24'});data.cashflows.push({id:'real-flow',time:'2026-10-24T10:00',type:'DEPOSIT',amount:50,note:'real'});C.replace(data);C.clearSamples(mem());assert.equal(C.state.trades.length,2);assert.equal(C.state.cashflows.length,1);assert.equal(C.state.trades[0].netPnl,999);assert.equal(C.state.trades[1].id,'real-added');assert.equal(C.state.sampleSource,null);return {};
});
check('B manual Tier string migrates to canonical numeric override',()=>{
 const store=mem({'tuannhatky_v10_db_state':JSON.stringify({tradeData:samples.B.trades,cashflowData:[],config:{ovr:'3'}})});C.migrateLegacy(store,()=>{});assert.equal(C.state.riskProfile.tierOverride,3);assert.equal(S.read().tier,3);return {};
});
check('B sample floating position is separate from realized ledger; safe sample removal',()=>{
 const data=C.sample('B');assert.equal(data.openPositions.length,1);data.openPositions.push({id:'real-open',floatingUsd:-50});C.replace(data);close(S.read().equity,23250);C.clearSamples(mem());assert.equal(C.state.trades.length,0);assert.equal(C.state.cashflows.length,0);assert.equal(C.state.openPositions.length,1);assert.equal(C.state.openPositions[0].id,'real-open');return {};
});
check('Generated Worker syntax + all four tasks equal main source functions',()=>{
 const src=W.source();new vm.Script(src);fs.writeFileSync(out+'P7_WORKER_GENERATED.js',src);const worker=vm.createContext({self:{postMessage:message=>{worker.reply=message;}}});vm.runInContext(src,worker);
 const payloads={mc:{R:[-1,2,1],options:{horizon:5,runs:20,riskPct:1},seed:123},ror:{R:[-1,2,1],horizon:10,runs:20,seed:123},prop:{R:[-1,2,1],n:10,f:.01,size:10000,fee:100,actFee:0,stages:[.03],ml:.1,dl:.05,tpd:3,maxT:20,fT:30,sp:.8,payoutDays:10,comp:true,seed:123},analytics:{R:[-1,2,1],winrate:2/3,payoff:1.5}};
 for(const [task,payload] of Object.entries(payloads)){worker.message={id:1,task,payload};vm.runInContext('self.onmessage({data:message})',worker);assert.ok(!worker.reply.error,worker.reply.error);assert.deepEqual(plain(worker.reply.result),plain(W.local(task,payload)));}return {tasks:Object.keys(payloads)};
});
const result={phase:'P7',passed:cases.filter(x=>x.pass).length,total:cases.length,cases,samples:snapshotMetrics,timestamp:new Date().toISOString()};fs.writeFileSync(out+'P7_CORE_TESTS.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.passed!==result.total)process.exit(1);

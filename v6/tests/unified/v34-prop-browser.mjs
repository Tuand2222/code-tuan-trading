import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../package.json',import.meta.url)),{chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),cases=[],errors=[],out=process.env.UNIFIED_TEST_OUT;
page.on('pageerror',e=>errors.push(e.stack));
const test=async(name,fn)=>{try{const detail=await fn();cases.push({name,pass:true,...detail});console.log(name+' PASS');}catch(e){cases.push({name,pass:false,error:e.stack});throw e;}};
const idle=()=>page.waitForFunction(()=>RiskStore.pendingJobs.size===0&&RiskStore.read().prop!==null,{timeout:60000});
const load=async(patch={})=>{await page.evaluate(patch=>{propPaused=true;WorkerBridge.cancel();const d=Core.sample('A');d.trades=d.trades.slice(0,12).map((t,i)=>({...t,id:'synthetic-'+i,netPnl:100,initialRisk:100,realizedR:1,maeR:0,mfeR:1,is_net_pnl_verified:true,is_1r_verified:true}));d.extra={...extraDefaults,propConfig:{...PROP_DEFAULTS,size:1000,fee:5,actFee:2,stages:[1],risk:1,ml:10,dl:0,split:80,runs:500,resample:'none',tpd:1,horizon:10,fundedH:4,payoutDays:2,comp:false,...patch}};d.ext2={...extDefaults};Core.importBackup(JSON.stringify(d));resetFilters();propPaused=false;go('riskprop');ensurePropJob();},patch);await idle();};
try{
 await page.goto(process.env.UNIFIED_TEST_URL+'#riskprop',{waitUntil:'networkidle'});await page.waitForFunction(()=>globalThis.Unified&&!Unified.bootProblem);
 await test('v3.4 visible lifecycle controls and exact deterministic USD payout',async()=>{
  await load();assert.match(await page.locator('#tab-riskprop').innerText(),/Tuan Trader v3.4/i);
  const r=await page.evaluate(()=>RiskStore.read().prop[0]);assert.equal(r.meanGrossPayout,'40');assert.equal(r.meanNetPayout,'32');assert.equal(r.evAttempt,'25');assert.equal(r.expectedOutlay,'7');assert.equal(r.pFunded,1);
  assert.match(await page.locator('#pf-out').innerText(),/Mean net payout/);assert.equal(await page.evaluate(()=>WorkerBridge.lastExecution),'worker');
  await page.screenshot({path:out+'V34_PROP_DESKTOP.png',fullPage:true});return {meanGross:r.meanGrossPayout,meanNet:r.meanNetPayout,ev:r.evAttempt};
 });
 await test('day bootstrap keeps complete zero-sum clusters and leaves journal unchanged',async()=>{
  await load({resample:'day',tpd:2,fundedH:10});
  await page.evaluate(()=>{propPaused=true;Core.commit(d=>{d.trades=d.trades.map((t,i)=>({...t,date:'2026-01-'+String(Math.floor(i/2)+1).padStart(2,'0'),openTime:'',closeTime:'',netPnl:i%2?-200:200,realizedR:i%2?-2:2,maeR:null,mfeR:null}));});propPaused=false;ensurePropJob();});
  const before=await page.evaluate(()=>JSON.stringify(Core.state.trades));await idle();const r=await page.evaluate(()=>RiskStore.read().prop[0]);assert.equal(r.pFunded,0);assert.equal(r.timeoutCount,500);assert.equal(await page.evaluate(()=>JSON.stringify(Core.state.trades)),before);return {pFunded:r.pFunded,timeout:r.timeoutCount};
 });
 await test('payout fraction cap and persisted rules feed one RiskStore result',async()=>{
  await load({payoutFraction:50,payoutCap:5});const r=await page.evaluate(()=>RiskStore.read().prop[0]);assert.equal(r.meanGrossPayout,'10');assert.equal(r.meanNetPayout,'8');
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>go('riskprop'));await idle();assert.equal(await page.locator('#pf-cap').inputValue(),'5');assert.equal(await page.locator('#pf-fraction').inputValue(),'50');assert.equal(await page.evaluate(()=>RiskStore.read().prop[0].meanGrossPayout),'10');return {meanGross:'10',reload:true};
 });
 await test('phase minimum days and separate funded preset are editable and effective',async()=>{
  await load();const days=page.locator('[data-pf-phase="0"][data-pf-rule="minTradingDays"]');await days.fill('3');await days.dispatchEvent('change');await idle();assert.equal(await page.evaluate(()=>RiskStore.read().prop[0].medT),3);
  await page.locator('#pf-funded-preset').selectOption('topstep_50k_xfa_standard');await idle();
  assert.equal(await page.locator('#adv-p-split').isDisabled(),true);assert.equal(await page.locator('#adv-p-split').inputValue(),'90');assert.equal(await page.locator('#pf-pdays').inputValue(),'14');assert.equal(await page.evaluate(()=>RiskStore.read().prop[0].meanGrossPayout),'0');
  await page.locator('#pf-funded-preset').selectOption('same');await idle();assert.equal(await page.locator('#adv-p-split').inputValue(),'80');assert.equal(await page.locator('#pf-pdays').inputValue(),'2');return {minimumDays:3,separatePreset:true,customTermsPreserved:true};
 });
 await test('XFA preset goes directly to funded without inventing evaluation target',async()=>{
  await load();await page.locator('#adv-preset').selectOption('topstep_50k_xfa_standard');await idle();
  const v=await page.evaluate(()=>({cfg:RiskStore.read().propConfig,r:RiskStore.read().prop[0]}));assert.equal(v.cfg.mode,'funded');assert.deepEqual(v.cfg.stages,[]);assert.equal(v.cfg.consistencyScope,'off');assert.equal(v.r.status,'ok');assert.equal(v.r.pFunded,1);assert.equal(await page.locator('#adv-p-target').isDisabled(),true);
  assert.match(await page.locator('#pf-preset-info').innerText(),/chưa xác minh/);return {mode:v.cfg.mode,pFunded:v.r.pFunded};
 });
 await test('invalid timezone does not replace saved configuration',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(RiskStore.read().propConfig));await page.locator('#pf-timezone').fill('Invalid/Zone');await page.locator('#pf-timezone').dispatchEvent('change');assert.equal(await page.evaluate(()=>JSON.stringify(RiskStore.read().propConfig)),before);await page.locator('#pf-timezone').fill('UTC');return {preserved:true};
 });
 await test('large Worker simulation can be cancelled without local failover or auto restart',async()=>{
  await load();await page.evaluate(()=>{propPaused=true;Core.commit(d=>d.extra.propConfig={...RiskStore.read().propConfig,runs:10000,fundedH:1000,horizon:1000});propPaused=false;ensurePropJob();});
  await page.waitForFunction(()=>!document.getElementById('pf-cancel').disabled);await page.locator('#pf-cancel').click();await page.waitForFunction(()=>RiskStore.pendingJobs.size===0&&propPaused);
  assert.equal(await page.evaluate(()=>WorkerBridge.worker),null);assert.match(await page.locator('#pf-out').innerText(),/hủy/);return {cancelled:true,localFallback:false};
 });
 await test('mobile dark layout keeps controls inside viewport',async()=>{
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.classList.add('dark');document.body.classList.add('dark');});await page.screenshot({path:out+'V34_PROP_MOBILE_DARK.png',fullPage:true});
  const sizes=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(sizes.scroll<=sizes.w+1);return sizes;
 });
 assert.deepEqual(errors,[]);
}finally{
 const result={passed:cases.filter(x=>x.pass).length,total:cases.length,cases,pageErrors:errors,productionJournalWrites:0};await fs.writeFile(out+'V34_PROP_BROWSER.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();await browser.close();
}

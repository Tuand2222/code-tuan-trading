import fs from 'node:fs/promises';import http from 'node:http';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const repo=process.cwd(),out=repo+'/test-results/intake-browser/';await fs.mkdir(out,{recursive:true});
const require=createRequire(repo+'/v6/package.json'),{chromium}=require('@playwright/test'),{default:worker}=await import('../dist/server/index.js');
const asset=async request=>{const p=new URL(request.url).pathname;try{if(p.includes('..'))return new Response('Bad path',{status:400});return new Response(await fs.readFile(repo+'/dist/client'+p),{headers:{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;if(p.startsWith('/v6/')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(repo+'/v6/index.html'));return;}if(p.startsWith('/api/')){res.writeHead(p==='/api/auth/get-session'||p==='/api/site-session'?200:401,{'Content-Type':'application/json'});res.end('null');return;}const request=new Request('http://'+req.headers.host+req.url,{headers:req.headers});let response=await asset(request);if(response.status===404)response=await worker.fetch(request,{ASSETS:{fetch:asset}},{waitUntil(){},passThroughOnException(){}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.stack);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),cases=[],errors=[];
const test=async(name,fn)=>{await fn();cases.push({name,pass:true});console.log('PASS '+name);};
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
const classic=await context.newPage(),v6=await context.newPage();for(const page of [classic,v6]){page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));}
try{
 await classic.goto(base+'/classic#journal',{waitUntil:'networkidle'});await v6.goto(base+'/v6/?fresh=1#workspace',{waitUntil:'networkidle'});await v6.waitForFunction(()=>globalThis.Unified&&!Unified.bootProblem);
 await test('30 unknown-cost rows are kept, currency must be confirmed, and both views exclude their money',async()=>{
  const csv='id,Date,Symbol,Side,Profit\n'+Array.from({length:30},(_,i)=>'unknown-'+i+',2026-10-'+String(i%23+1).padStart(2,'0')+',EURUSD,Buy,100').join('\n');
  await classic.locator('input[accept*=".pdf"]').setInputFiles({name:'synthetic-unknown.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  const add=classic.getByRole('button',{name:'Thêm 30 giao dịch',exact:true});await add.waitFor();assert.equal(await add.isEnabled(),false);
  await classic.getByLabel('Đơn vị P&L nhập',{exact:true}).selectOption('VND');await add.click();
  await v6.waitForFunction(()=>Core.state.trades.length===30);
  const value=await v6.evaluate(()=>({n:Core.state.trades.length,verified:Core.state.trades.filter(RiskMath.verifiedNet).length,pnl:RiskStore.read().pnl,warning:RiskStore.read().warning}));
  assert.deepEqual(value,{n:30,verified:0,pnl:0,warning:true});
  await classic.goto(base+'/classic#statistics',{waitUntil:'networkidle'});await classic.getByTestId('metrix-coverage').waitFor();
  assert.match(await classic.getByTestId('metrix-coverage').innerText(),/0\/30/);
  assert.match(await classic.locator('.metrix-risk-panel').innerText(),/CHƯA ĐỦ DỮ LIỆU/);
  assert.equal(await classic.locator('.metrix-day-status').filter({hasText:/^Đạt$/}).count(),0);
  assert.match(await classic.locator('.metrix-stat-list').innerText(),/Chưa đủ dữ liệu/);
  await classic.screenshot({path:out+'unknown-30.png',fullPage:true});
 });
 await test('Metrix capital edits update V6 through the common ledger without the old 200m default',async()=>{
  const capital=classic.getByLabel('Vốn khởi điểm',{exact:true});await capital.fill('12345');await capital.press('Tab');
  await v6.waitForFunction(()=>Core.state.initialCapital===12345);assert.equal(await capital.inputValue(),'12345');
  assert.equal(await v6.evaluate(()=>RiskStore.read().equity),12345);
 });
 await test('Review of an imported row leaves its missing risk/fees unverified',async()=>{
  await classic.goto(base+'/classic#journal',{waitUntil:'networkidle'});await classic.getByRole('button',{name:'Sửa lệnh EURUSD',exact:true}).first().click();
  const setup=classic.getByLabel(/Setup \/ Playbook/);await setup.selectOption({label:await setup.locator('optgroup option').first().textContent()});
  await classic.getByRole('button',{name:'Lưu thay đổi',exact:true}).last().click();
  await v6.waitForFunction(()=>Core.state.trades.some(t=>t.setup!=='Chưa phân loại'));
  assert.equal(await v6.evaluate(()=>Core.state.trades.filter(t=>t.is_1r_verified||t.is_net_pnl_verified).length),0);
 });
 await test('MT4 commission/swap and USD FX reach both views once, with verified R only for the complete row',async()=>{
  const csv='id,Date,Symbol,Side,Profit,Commission,Swap,Risk\nmt4-known,2026-10-24,GBPUSD,buy,100,-2,-1.5,50';
  await classic.locator('input[accept*=".pdf"]').setInputFiles({name:'synthetic-mt4.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await classic.getByLabel('Đơn vị P&L nhập',{exact:true}).selectOption('USD');
  await classic.getByLabel('Tỷ giá nhập về VNĐ',{exact:true}).fill('25000');
  await classic.getByLabel('Tỷ giá nhập về VNĐ',{exact:true}).press('Tab');
  await classic.getByRole('button',{name:'Thêm 1 giao dịch',exact:true}).click();
  await v6.waitForFunction(()=>Core.state.trades.some(t=>t.symbol==='GBPUSD'));
  const t=await v6.evaluate(()=>Core.state.trades.find(t=>t.symbol==='GBPUSD'));assert.equal(t.netPnl,2412500);assert.equal(t.initialRisk,1250000);assert.equal(t.realizedR,1.93);
  await classic.goto(base+'/classic#statistics',{waitUntil:'networkidle'});assert.match(await classic.getByTestId('metrix-coverage').innerText(),/1\/31/);assert.match(await classic.locator('.metrix-stat-list').innerText(),/1.93R/);
 });
 await test('Reported Net with no fee breakdown stays Net across Classic and V6 and survives a zero-fee edit',async()=>{
  await classic.goto(base+'/classic#journal',{waitUntil:'networkidle'});
  const csv='id,Date,Symbol,Side,Net PnL,Fee,Risk\nnet-zero,2026-10-25,ZEROUSD,buy,0,0,50\nnet-only,2026-10-25,NETONLYUSD,buy,44.5,,50';
  await classic.locator('input[accept*=".pdf"]').setInputFiles({name:'synthetic-net-zero.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await classic.getByLabel('Đơn vị P&L nhập',{exact:true}).selectOption('VND');await classic.getByRole('button',{name:'Thêm 2 giao dịch',exact:true}).click();
  await classic.getByRole('button',{name:'Sửa lệnh ZEROUSD',exact:true}).first().click();
  assert.equal(await classic.getByLabel(/Phí giao dịch/).inputValue(),'0');
  const setup=classic.getByLabel(/Setup \/ Playbook/);await setup.selectOption({label:await setup.locator('optgroup option').first().textContent()});await classic.getByRole('button',{name:'Lưu thay đổi',exact:true}).last().click();
  await v6.waitForFunction(()=>Core.state.trades.some(t=>t.symbol==='ZEROUSD'&&t.setup!=='Chưa phân loại'));
  const netOnly=await v6.evaluate(()=>Core.state.trades.find(t=>t.symbol==='NETONLYUSD'));assert.equal(netOnly.netPnl,44.5);assert.equal(netOnly._classic.feesKnown,false);assert.equal(netOnly.is_net_pnl_verified,true);
  const t=await v6.evaluate(()=>Core.state.trades.find(t=>t.symbol==='ZEROUSD'));assert.equal(t.netPnl,0);assert.equal(t._classic.feesKnown,true);assert.equal(t.is_net_pnl_verified,true);
 });
}catch(e){errors.push(e.stack);console.error(e.stack);await classic.screenshot({path:out+'failure.png',fullPage:true});}finally{
 const result={passed:cases.length,total:5,cases,errors,productionWrites:0,scope:'Compiled Classic and generated V6; isolated synthetic data; currency, money verification, shared capital and unknown-field editing'};
 await fs.writeFile(out+'RESULTS.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.close(r));if(cases.length!==5||errors.length)process.exitCode=1;
}

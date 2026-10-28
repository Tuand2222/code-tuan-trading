// Run real financial regressions against deliberately broken formulas in temp copies.
// Never rewrite the working source or persistent journals.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {repo,renderV6,checkV6} from './render-v6.mjs';
const require=createRequire(path.join(repo,'v6/package.json')), {parse}=require('acorn');
checkV6();
const app=[...renderV6().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const STORE_KEY ='));
const runtime=app.slice(0,app.indexOf('const TABS='));
const ast=parse(runtime,{ecmaVersion:'latest'}),decl=ast.body.flatMap(n=>n.declarations||[]).find(n=>n.id.name==='RiskMath');
assert.ok(decl,'One existing RiskMath must be found');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'journal-financial-guards-'));
const results=[];
function execute(name,source,expectedSuccess) {
  const dir=path.join(temp,name);fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'P7_RUNTIME.js'),source);
  const check=spawnSync(process.execPath,['--check',path.join(dir,'P7_RUNTIME.js')],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  const run=spawnSync(process.execPath,[path.join(repo,'v6/tests/unified/advanced-core.mjs')],{
    env:{...process.env,UNIFIED_TEST_OUT:dir+path.sep},encoding:'utf8',timeout:120000});
  fs.writeFileSync(path.join(dir,'regression.log'),(run.stdout||'')+(run.stderr||''));
  if(run.error)throw run.error;
  if(expectedSuccess)assert.equal(run.status,0,run.stderr);
  else {assert.equal(run.status,1,`Expected regression rejection, got ${run.status}`);assert.match(run.stderr,/AssertionError/);}
  results.push({name,exitCode:run.status,expectedSuccess,syntaxValid:true,pass:true});
}
execute('baseline',runtime,true);
for(const method of ['esW','rckEmpirical']) {
  const prop=decl.init.properties.find(p=>p.key.name===method);
  assert.ok(prop,method);
  // Semantically wrong, syntactically valid: the independent oracle must catch it.
  const body=method==='esW'?'{ return 0; }':'{ return {f:0,kelly:0,lambda:1,feasible:false}; }';
  execute('broken-'+method,runtime.slice(0,prop.value.body.start)+body+runtime.slice(prop.value.body.end),false);
}
const result={passed:results.length,total:3,cases:results,scope:'Isolated temp copies; actual P5 advanced financial regression suite; no source/data writes',output:temp};
const destination=path.join(repo,'test-results/financial-guards');fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,'RESULTS.json'),JSON.stringify(result,null,2)+'\n');
fs.cpSync(temp,path.join(destination,'runs'),{recursive:true});
console.log(JSON.stringify(result,null,2));

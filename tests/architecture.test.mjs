import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {repo,renderV6,checkV6,sharedModules} from '../scripts/render-v6.mjs';

test('Standalone artifact exactly matches authoritative sources',()=>{
  checkV6();assert.equal(renderV6(),fs.readFileSync(path.join(repo,'v6/index.html'),'utf8'));
});
test('Compatibility exports share identical ESM instances with src/core',async()=>{
  for(const name of sharedModules){
    const legacy=await import(pathToFileURL(path.join(repo,'lib',name)));
    const core=await import(pathToFileURL(path.join(repo,'src/core',name)));
    assert.deepEqual(Object.keys(legacy).sort(),Object.keys(core).sort());
    for(const key of Object.keys(core))assert.equal(legacy[key],core[key],name+':'+key);
  }
});
test('A stale generated artifact fails verification without being silently rebuilt',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'journal-source-drift-'));
  fs.mkdirSync(path.join(dir,'scripts'));fs.mkdirSync(path.join(dir,'v6'));
  fs.cpSync(path.join(repo,'src'),path.join(dir,'src'),{recursive:true});
  fs.copyFileSync(path.join(repo,'scripts/render-v6.mjs'),path.join(dir,'scripts/render-v6.mjs'));
  const target=path.join(dir,'v6/index.html'),text=renderV6()+'\n<!-- stale fixture -->';fs.writeFileSync(target,text);
  const run=spawnSync(process.execPath,[path.join(dir,'scripts/render-v6.mjs'),'--check'],{encoding:'utf8'});
  assert.equal(run.status,1);assert.match(run.stderr,/Generated V6 is stale/);
  assert.equal(fs.readFileSync(target,'utf8'),text);
});
test('Required CI job fails closed and is scheduled for all PRs to main',()=>{
  const workflow=fs.readFileSync(path.join(repo,'.github/workflows/verify-main.yml'),'utf8');
  assert.match(workflow,/name: Journal required checks/);
  assert.match(workflow,/if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow,/needs: \[journal\]/);
  assert.match(workflow,/needs\.journal\.result/);
  assert.match(workflow,/pull_request:\s*\n\s*branches: \[main\]/);
  assert.ok(!workflow.includes('paths:'));
  assert.match(workflow,/npm run ci:check/);
  for(const result of ['success','failure','cancelled','skipped','']){
    const run=spawnSync(process.execPath,[path.join(repo,'scripts/ci-gate.mjs'),result],{encoding:'utf8'});
    assert.equal(run.status,result==='success'?0:1,`Gate for ${result}`);
  }
});

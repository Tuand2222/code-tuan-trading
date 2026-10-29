import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {repo} from './render-v6.mjs';
const cli=process.env.npm_execpath||process.env.SITES_NPM_CLI;
if(!cli||!fs.existsSync(cli))throw Error('Run npm run ci:check, or set SITES_NPM_CLI to the npm CLI entrypoint.');
const root=path.join(repo,'test-results/ci');fs.mkdirSync(root,{recursive:true});
const steps=[
  ['source-drift',['scripts/render-v6.mjs','--check']],
  ['v6-core',[cli,'run','verify'],path.join(repo,'v6')],
  ['financial-guards',['scripts/check-financial-guards.mjs']],
  ['root-tests',[cli,'test']],
  ['v6-browser',[cli,'run','e2e'],path.join(repo,'v6')],
  ['two-tab-sync',['--experimental-loader','./scripts/cloudflare-validation-loader.mjs','tests/unified-two-tab-browser.mjs']],
  ['classic-lifecycle',['--experimental-loader','./scripts/cloudflare-validation-loader.mjs','tests/lifecycle-classic-browser.mjs']],
  ['intake-browser',['--experimental-loader','./scripts/cloudflare-validation-loader.mjs','tests/intake-browser.mjs']],
  ['cloud-sync-safety',['tests/scale/sync-safety.mjs']],
];
const results=[];
for(const [name,args,cwd=repo] of steps) {
  console.log(`CI: ${name}`);const start=Date.now(),log=fs.createWriteStream(path.join(root,name+'.log'));
  const result=await new Promise(resolve=>{
    const child=spawn(process.execPath,args,{cwd,env:{...process.env,WRANGLER_WRITE_LOGS:'false'},timeout:900000});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk);});
    child.on('error',error=>{log.write(error.stack);});
    child.on('close',(code,signal)=>resolve({exitCode:code,signal}));
  });
  await new Promise(resolve=>log.end(resolve));
  results.push({name,...result,elapsedMs:Date.now()-start});
  fs.writeFileSync(path.join(root,'RESULTS.json'),JSON.stringify({passed:results.filter(r=>r.exitCode===0).length,total:steps.length,steps:results},null,2)+'\n');
  if(result.exitCode!==0)process.exit(result.exitCode||1);
}
console.log('All journal CI checks passed.');

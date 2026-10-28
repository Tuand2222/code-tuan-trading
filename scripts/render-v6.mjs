import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const repo = fileURLToPath(new URL('../', import.meta.url));
export const sharedModules = ['trade-normalizer.js','trade-form.js','journal-adapters.js','journal-unified.js','journal-lifecycle.js'];
const read = name => fs.readFileSync(resolve(repo,name),'utf8');
function replaceOnce(text, token, value) {
  if (text.split(token).length !== 2) throw Error(`Expected exactly one source slot: ${token}`);
  return text.replace(token, () => value);
}
export function sharedCore() {
  return sharedModules.map(name => read('src/core/'+name).replace(/^import .*;\r?\n/gm,'').replaceAll('export const ','const ')).join('\n');
}
export function renderV6() {
  const runtime = replaceOnce(read('src/core/journal-runtime.js'),'/* @TNK_SHARED_CORE@ */',
    '// BEGIN GENERATED JOURNAL LIFECYCLE\n'+sharedCore()+'\n// END GENERATED JOURNAL LIFECYCLE');
  return replaceOnce(read('src/views/v6/shell.html'),'/* @TNK_APP@ */',runtime+read('src/views/v6/app.js'));
}
export function checkV6() {
  if (read('v6/index.html') !== renderV6()) throw Error('Generated V6 is stale. Run node scripts/render-v6.mjs; edit src/, not v6/index.html.');
}
export function writeV6() {
  const next=renderV6();
  if(read('v6/index.html')!==next)fs.writeFileSync(resolve(repo,'v6/index.html'),next);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')) checkV6(); else writeV6();
  console.log(process.argv.includes('--check')?'V6 source/artifact match':'V6 single HTML generated from src/');
}

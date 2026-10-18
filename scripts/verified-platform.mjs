import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const action = process.argv[2];
if (!['install', 'build'].includes(action)) throw new Error('Expected install or build');
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, WRANGLER_WRITE_LOGS: 'false' }, timeout: action === 'build' ? 180000 : 600000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (process.platform !== 'win32') run('bash', [action === 'install' ? 'scripts/install-ci.sh' : 'scripts/build-verified.sh']);
else if (action === 'install') {
  const cli = process.env.npm_execpath || process.env.SITES_NPM_CLI;
  if (!cli || !existsSync(cli)) throw new Error('Run through npm run install:ci, or set SITES_NPM_CLI to the npm CLI entrypoint.');
  run(process.execPath, [cli, 'ci', '--no-audit', '--no-fund']);
} else {
  run(process.execPath, ['node_modules/vinext/dist/cli.js', 'build']);
  for (const file of ['dist/server/index.js', 'dist/.openai/hosting.json', 'dist/client']) if (!existsSync(file)) throw new Error(`Missing build output: ${file}`);
  const source = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
  const output = JSON.parse(readFileSync('dist/.openai/hosting.json', 'utf8'));
  for (const field of ['project_id', 'd1', 'r2']) if (source[field] !== output[field]) throw new Error(`Hosting manifest mismatch: ${field}`);
  const worker = readFileSync(path.join('dist', 'server', 'index.js'), 'utf8');
  if (!worker.includes('fetch')) throw new Error('Worker fetch handler missing');
}

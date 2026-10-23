import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, cpSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
const action = process.argv[2];
if (!['install', 'build'].includes(action)) throw new Error('Expected install or build');
function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, WRANGLER_WRITE_LOGS: 'false' }, timeout: action === 'build' ? 180000 : 600000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const v6Root = path.resolve('v6');
if (action === 'build') {
  run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], v6Root);
  const destination = path.resolve('public', 'v6');
  if (path.dirname(destination) !== path.resolve('public')) throw new Error('Invalid v6 asset destination');
  rmSync(destination, { recursive: true, force: true });
  cpSync(path.join(v6Root, 'dist'), destination, { recursive: true });
  // HTML requests must pass through the Worker so response security headers apply.
  renameSync(path.join(destination,'index.html'),path.join(destination,'app-shell.txt'));
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
if (action === 'install') {
  const cli = process.env.npm_execpath || process.env.SITES_NPM_CLI;
  if (!cli || !existsSync(cli)) throw new Error('The npm CLI is required to install the v6 application.');
  run(process.execPath, [cli, 'ci', '--no-audit', '--no-fund'], v6Root);
}

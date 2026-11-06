import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

// 실제 로컬 Worker/D1과 앱을 함께 검증한다. 운영 DB·기존 개발 DB에는 쓰지 않는다.
const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, '.orchestrate', 'api-connected', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(output, { recursive: true });
const state = path.join(output, 'state');
const varsPath = path.join(root, 'server/.dev.vars');
const config = ['--config', 'server/wrangler.toml'];
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const apiPort = Number(process.env.E2E_API_PORT ?? 8799);
const appPort = Number(process.env.E2E_PORT ?? 5199);
const env = { ...process.env, CI: '1', BROWSER: 'none', CLOUDFLARE_SEND_METRICS: 'false',
  E2E_PORT: String(appPort), E2E_API_BASE: `http://127.0.0.1:${apiPort}`, VITE_API_BASE: `http://127.0.0.1:${apiPort}` };
let ownedVars;
let server;
let serverClosed;
const logs = [];

async function freePort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('로컬 시험 포트가 올바르지 않습니다.');
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(port, () => probe.close(resolve));
  });
}

async function run(args, options = {}) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: options.visible ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
  if (!options.visible) {
    child.stdout.on('data', chunk => logs.push(chunk.toString()));
    child.stderr.on('data', chunk => logs.push(chunk.toString()));
  }
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  if (code !== 0) throw Error(`로컬 시험 명령 실패(exit ${code}), 로그: ${output}`);
}

try {
  await freePort(apiPort);
  await freePort(appPort);
  if (!existsSync(varsPath)) {
    // 시험마다 만든 값은 로컬 제외 파일에만 두고, 자신이 만든 내용일 때만 종료 후 지운다.
    ownedVars = `PLAYER_SALT=${randomBytes(32).toString('hex')}\n`;
    writeFileSync(varsPath, ownedVars, { flag: 'wx', mode: 0o600 });
  }
  await run([wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state, ...config]);
  await run([wrangler, 'd1', 'execute', 'DB', '--local', '--persist-to', state, ...config, '--file', 'server/seed/question_keys.sql']);
  server = spawn(process.execPath, [wrangler, 'dev', ...config, '--local', '--port', String(apiPort),
    '--persist-to', state, '--var', `ALLOWED_ORIGINS:http://localhost:${appPort}`, '--var', 'RANKING_CACHE_SECONDS:0'],
  { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => logs.push(chunk.toString()));
  server.stderr.on('data', chunk => logs.push(chunk.toString()));
  serverClosed = new Promise(resolve => server.once('close', resolve));
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error('로컬 서버가 준비 전에 종료됐습니다.');
    try { await fetch(env.E2E_API_BASE, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { /* 준비 대기 */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw Error('로컬 서버 준비 시간 초과');
  console.log(`로컬 DB 준비 완료. 증거: ${output}`);
  const filters = process.argv.slice(2);
  await run([path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', 'tests/e2e/api-connected.spec.ts', '--workers=1', '--output', path.join(output, 'playwright'), ...filters], { visible: true });
  writeFileSync(path.join(output, 'result.json'), JSON.stringify({ at: new Date().toISOString(), status: 'passed', apiPort, appPort, filters, scope: 'local-only' }, null, 2));
} catch (error) {
  writeFileSync(path.join(output, 'result.json'), JSON.stringify({ at: new Date().toISOString(), status: 'failed', error: String(error), scope: 'local-only' }, null, 2));
  console.error(String(error));
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) server.kill('SIGTERM');
  if (serverClosed) await serverClosed;
  // Wrangler는 vars를 가려 출력하지만 자체 생성한 값은 로그에서도 한 번 더 제거한다.
  const secret = ownedVars?.match(/^PLAYER_SALT=(.+)/)?.[1];
  writeFileSync(path.join(output, 'server.log'), secret ? logs.join('').replaceAll(secret, '[redacted]') : logs.join(''));
  if (ownedVars && existsSync(varsPath) && readFileSync(varsPath, 'utf8') === ownedVars) unlinkSync(varsPath);
}

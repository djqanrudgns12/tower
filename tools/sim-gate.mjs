import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { runnerImport } from 'vite';

// 밸런스 관문(PRD r4 §7.1·§7.3 B0): 가상 플레이어(초보·균형·상성·최적화·단일 타워·조합) × 4개 맵 × 정답률로 판을 돌려
// 목표표의 모든 줄을 PASS/FAIL/N/A로 판정한다. 학생 실측이 아니다. 종료 코드는 항상 0이다(보고서).
//   npm run simulate:gate                 빠른 모드(seed 8, 작은 K)
//   npm run simulate:gate -- --full       전체 모드(seed 24, K 10, 최적화형 네 정답률)
//   옵션: --seeds N  --workers N  --maps garden_u,river_z  --set 경로=값(여러 번)  --out 결과.json  --report 보고서.md  --raw
//         --bots balanced,optimizer,mono,core4  일부 봇만(mono·core4는 접두어). 빠진 봇의 줄은 N/A가 된다. 조정 중 빠른 반복용
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const full = args.includes('--full');
const mode = full ? 'full' : 'fast';
const seeds = Number(flag('seeds', full ? 24 : 8));
const workers = Math.max(1, Number(flag('workers', Math.min(10, Math.max(1, os.availableParallelism() - 2)))));
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const maps = flag('maps', null)?.split(',').filter(Boolean);
const out = flag('out', null);
const reportPath = flag('report', null);

const load = file => runnerImport(path.join(root, file), { configFile: false, logLevel: 'error', root }).then(r => r.module);
const [gate, jobsMod, report] = await Promise.all([load('tools/sim/gate.ts'), load('tools/sim/gateJobs.ts'), load('tools/sim/gateReport.ts')]);

const bots = flag('bots', null)?.split(',').filter(Boolean);
const keep = bot => !bots || bots.some(b => bot === b || (b === 'mono' && bot.startsWith('mono-')) || (b === 'core4' && bot.startsWith('core4')));
const jobs = jobsMod.planJobs({ mode, seeds, ...(maps ? { maps } : {}) }).filter(j => j.kind !== 'run' || keep(j.spec.bot));
const started = performance.now();
console.error(`simulate:gate ${mode} · seed ${seeds} · 작업 ${jobs.length}개 · 워커 ${workers}${sets.length ? ` · 조정 ${sets.join(' ')}` : ''}`);

const results = new Array(jobs.length);
let next = 0, done = 0, lastLog = performance.now();
const failures = [];
await new Promise((resolve, reject) => {
  const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => new Worker(path.join(root, 'tools/sim/gate-worker.mjs'), { workerData: { sets } }));
  let alive = pool.length;
  const feed = w => {
    if (next < jobs.length) { const id = next++; w.postMessage({ type: 'job', id, job: jobs[id] }); } else { alive--; w.terminate(); if (alive === 0) resolve(); }
  };
  for (const w of pool) {
    w.on('message', msg => {
      if (msg.type === 'ready') return feed(w);
      if (msg.type === 'done') results[msg.id] = msg.result; else failures.push(msg);
      done++;
      if (performance.now() - lastLog > 10000) { lastLog = performance.now(); console.error(`  ${done}/${jobs.length} (${Math.round((performance.now() - started) / 1000)}초)`); }
      feed(w);
    });
    w.on('error', reject);
  }
});
if (failures.length) { for (const f of failures.slice(0, 3)) console.error(`작업 실패: ${JSON.stringify(f.job)}\n${f.error}`); throw new Error(`작업 ${failures.length}개 실패`); }

const order = r => [r.difficulty, r.bot, r.acc, r.map, r.seed].join('|');
const runs = results.filter(r => r.kind === 'run').map(r => r.summary).sort((a, b) => order(a).localeCompare(order(b)));
const matrix = Object.fromEntries(results.filter(r => r.kind === 'matrix').map(r => [r.mapId, r.rows]));
const efficiency = results.filter(r => r.kind === 'efficiency').map(r => r.row);
const dataset = { runs, matrix, efficiency };
const wall = (performance.now() - started) / 1000;
const cpu = runs.reduce((a, r) => a + r.ms, 0) / 1000;

const metrics = gate.computeMetrics(dataset, seeds);
const rows = gate.evaluateGate(metrics);
console.log(gate.formatRows(rows));
console.log(`\n소요 ${wall.toFixed(1)}초 (판 ${runs.length}개, 판 합계 CPU ${cpu.toFixed(0)}초, 워커 ${workers}) · 엔진 수치 한계로 끊겨 제외한 판 ${metrics.engineErrors}개`);

const meta = { mode, seeds, workers, sets, wallSeconds: Math.round(wall), runs: runs.length, generatedAt: new Date().toISOString() };
const text = report.fullReport(dataset, metrics, rows, meta);
if (reportPath) { fs.mkdirSync(path.dirname(path.resolve(root, reportPath)), { recursive: true }); fs.writeFileSync(path.resolve(root, reportPath), text); console.log(`보고서: ${reportPath}`); }
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
  const body = { meta, summary: gate.summarize(rows), rows, metrics, report: report.reportData(dataset), ...(args.includes('--raw') ? { runs } : {}) };
  fs.writeFileSync(path.resolve(root, out), `${JSON.stringify(body)}\n`);
  console.log(`결과: ${out}`);
}

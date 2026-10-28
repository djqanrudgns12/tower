import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';

// S11 엔진 밸런스 시뮬레이터 실행기. 계산은 tools/sim/balanceSim.ts가 제품 domain 엔진으로 한다.
// 예: npm run simulate:balance -- --seeds 8 --strats novice,balanced --diffs Normal --set difficulties.Normal.killGold.regular=2 --out docs/balance/s11.json
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const list = (name, fallback) => String(flag(name, fallback)).split(',').filter(Boolean);

const { module: sim } = await runnerImport(path.join(root, 'tools/sim/balanceSim.ts'), { configFile: false, logLevel: 'error', root });
const { MAPS } = sim;
// --set 경로=값(여러 번 가능)으로 후보를 잰다. 계약 파일은 바꾸지 않는다.
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const BALANCE = sim.withOverrides(sets);

const maps = flag('map', 'garden_u') === 'all' ? MAPS.map(m => m.id) : list('map', 'garden_u');
const diffs = list('diffs', Object.keys(BALANCE.difficulties).join(','));
const strats = list('strats', 'novice,balanced,focused');
const accs = list('acc', '0.6,0.8,0.95').map(Number);
const seeds = Number(flag('seeds', 6));
const readSec = Number(flag('read', 12));
const maxWaves = Number(flag('max-waves', 60));

const median = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const started = performance.now();
const rows = [];
for (const mapId of maps) for (const difficulty of diffs) for (const strategy of strats) for (const accuracy of accs) {
  const rs = Array.from({ length: seeds }, (_, i) => sim.simulateRun({ mapId, difficulty, accuracy, readSec, strategy, seed: i + 1, maxWaves, balance: BALANCE }));
  const bossTotal = rs.reduce((a, r) => a + r.bossKills + r.bossLeaks, 0);
  const waves = rs.map(r => r.completedWave);
  rows.push({
    mapId, diff: difficulty, strat: strategy, acc: accuracy,
    waves: `${median(waves)} (${Math.min(...waves)}-${Math.max(...waves)})`,
    minutes: r1(median(rs.map(r => r.minutes))),
    prepMin: r1(median(rs.map(r => r.phaseMinutes.PREP_QUIZ))),
    battleMin: r1(median(rs.map(r => r.phaseMinutes.BATTLE))),
    wave1Fail: `${rs.filter(r => r.completedWave === 0).length}/${seeds}`,
    firstEvo: median(rs.map(r => r.firstEvoWave ?? 99)),
    bossKill: bossTotal ? r2(rs.reduce((a, r) => a + r.bossKills, 0) / bossTotal) : null,
    vocabPt: r2(median(rs.map(r => r.vocabPtShare))),
    answerGold: r2(median(rs.map(r => r.answerGoldShare))),
    capped: rs.filter(r => r.endReason === 'WAVE_CAP').length,
    _waves: waves, _minutes: rs.map(r => r1(r.minutes)),
  });
}

console.log(`S11 엔진 시뮬레이션 · ${BALANCE.balanceVersion} · 성장 ${BALANCE.waves.hpGrowthPercent}% · 읽기 ${readSec}초 · seed ${seeds} · 상한 ${maxWaves}웨이브 · ${r1((performance.now() - started) / 1000)}초`);
if (sets.length) console.log(`조정 후보: ${sets.join(' · ')}`);
console.log('제품 엔진으로 판정한 가상 플레이어 결과다. 학생 실측·밸런스 승인이 아니다.');
console.table(rows.map(row => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')))));

// PRD 기준(§7·§8.2·§17.3). 해당 조건을 돌리지 않았으면 건너뛴다.
const find = (diff, strat, acc) => rows.find(r => r.diff === diff && r.strat === strat && r.acc === acc && r.mapId === maps[0]);
const checks = [];
const base = find('Normal', 'novice', 0.8);
if (base && readSec === 12) checks.push(['Normal 초보형 80% 한 판 15~25분', `${base.minutes}분`, base.minutes >= 15 && base.minutes <= 25]);
const hard = find('Hard', 'novice', 0.8);
if (hard) { const [n, d] = hard.wave1Fail.split('/').map(Number); checks.push(['Hard 초보형 80% 1웨이브 패배 30% 이하', hard.wave1Fail, n / d <= 0.3]); }
for (const diff of diffs) {
  const f = find(diff, 'focused', 0.8), b = find(diff, 'balanced', 0.8);
  if (f && b) checks.push([`${diff} 궁수 집중이 균형보다 1웨이브 넘게 앞서지 않음`, `${median(f._waves)} vs ${median(b._waves)}`, median(f._waves) - median(b._waves) <= 1]);
}
for (const diff of diffs) for (const strat of strats) {
  const lo = find(diff, strat, 0.6), hi = find(diff, strat, 0.95);
  if (lo && hi) checks.push([`${diff} ${strat} 정답률 60→95% 생존 차이(참고)`, `${median(hi._waves) - median(lo._waves)}웨이브`, null]);
}
if (checks.length) {
  console.log('\n기준 확인');
  for (const [name, got, pass] of checks) console.log(`${pass === null ? '·' : pass ? '통과' : '미달'}  ${name}: ${got}`);
}

const out = flag('out', null);
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
  fs.writeFileSync(path.resolve(root, out), `${JSON.stringify({ balanceVersion: BALANCE.balanceVersion, overrides: sets, readSec, seeds, maxWaves, generatedAt: new Date().toISOString(), rows, checks }, null, 2)}\n`);
  console.log(`\n저장: ${out}`);
}

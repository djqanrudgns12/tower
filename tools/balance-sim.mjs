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
// --towers all: P2 10종을 모두 쓸 수 있게 한다(기본은 P1 3종). balanced10 전략은 10종이 있어야 의미가 있다.
const towers = flag('towers', '') === 'all' ? sim.TOWER_IDS : undefined;
const accs = list('acc', '0.6,0.8,0.95').map(Number);
const seeds = Number(flag('seeds', 6));
const readSec = Number(flag('read', 12));
const maxWaves = Number(flag('max-waves', 60));
// --judge engine|sketch: 모든 전략이 같은 눈으로 거래한다(기본은 전략마다 정한 눈, balanced10만 engine).
const judge = flag('judge', null);
if (judge && !['engine', 'sketch'].includes(judge)) throw new Error(`--judge는 engine 또는 sketch: ${judge}`);
// --forms best,random,A1,A2,B1,B2: 가상 플레이어의 진화 선택 규칙(progression.md §1). 여럿이면 규칙마다 줄을 따로 낸다.
// 타워마다 따로 주려면 archer:B1/cannon:A1처럼 쓴다(적지 않은 타워는 best).
const formPolicies = list('forms', 'best');
for (const f of formPolicies) sim.parseFormPolicies(f);
// 리뉴얼 전(0.4.2-candidate) 균형형 정답률 80% 도달 웨이브 중앙값(progression.md §6 ③).
const REFERENCE_WAVES = { Easy: 18, Normal: 15, Hard: 14, Crazy: 11 };

const median = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const started = performance.now();
const rows = [];
for (const mapId of maps) for (const difficulty of diffs) for (const strategy of strats) for (const forms of formPolicies) for (const accuracy of accs) {
  const rs = Array.from({ length: seeds }, (_, i) => sim.simulateRun({ mapId, difficulty, accuracy, readSec, strategy, forms: sim.parseFormPolicies(forms), seed: i + 1, maxWaves, balance: BALANCE, ...(towers ? { towers } : {}), ...(judge ? { judge } : {}) }));
  const bossTotal = rs.reduce((a, r) => a + r.bossKills + r.bossLeaks, 0);
  const waves = rs.map(r => r.completedWave);
  rows.push({
    mapId, diff: difficulty, strat: strategy, forms, acc: accuracy,
    waves: `${median(waves)} (${Math.min(...waves)}-${Math.max(...waves)})`,
    minutes: r1(median(rs.map(r => r.minutes))),
    prepMin: r1(median(rs.map(r => r.phaseMinutes.PREP_QUIZ))),
    battleMin: r1(median(rs.map(r => r.phaseMinutes.BATTLE))),
    wave1Fail: `${rs.filter(r => r.completedWave === 0).length}/${seeds}`,
    firstEvo: median(rs.map(r => r.firstEvoWave ?? 99)),
    maxLv: median(rs.map(r => r.maxLevel)),
    lv7: median(rs.map(r => r.evolvedTwice)),
    bossKill: bossTotal ? r2(rs.reduce((a, r) => a + r.bossKills, 0) / bossTotal) : null,
    boss5: (b5 => (b5.length ? r2(b5.filter(b => b.killed).length / b5.length) : null))(rs.flatMap(r => r.bosses.filter(b => b.wave === 5))),
    vocabPt: r2(median(rs.map(r => r.vocabPtShare))),
    answerGold: r2(median(rs.map(r => r.answerGoldShare))),
    capped: rs.filter(r => r.endReason === 'WAVE_CAP').length,
    _waves: waves, _minutes: rs.map(r => r1(r.minutes)), _maxLv: rs.map(r => r.maxLevel), _lv7: rs.map(r => r.evolvedTwice),
    _forms: Object.fromEntries(Object.keys(rs[0].formCounts).map(f => [f, rs.reduce((a, r) => a + r.formCounts[f], 0)])),
  });
}

console.log(`S11 엔진 시뮬레이션 · ${BALANCE.balanceVersion} · 성장 ${BALANCE.waves.hpGrowthPercent}% · 읽기 ${readSec}초 · seed ${seeds} · 상한 ${maxWaves}웨이브 · ${r1((performance.now() - started) / 1000)}초`);
if (sets.length) console.log(`조정 후보: ${sets.join(' · ')}`);
if (judge) console.log(`거래 가치: 모든 전략 ${judge}`);
console.log('제품 엔진으로 판정한 가상 플레이어 결과다. 학생 실측·밸런스 승인이 아니다.');
console.table(rows.map(row => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')))));

// PRD 기준(§7·§8.2·§17.3). 해당 조건을 돌리지 않았으면 건너뛴다.
const find = (diff, strat, acc, forms = formPolicies[0]) => rows.find(r => r.diff === diff && r.strat === strat && r.acc === acc && r.forms === forms && r.mapId === maps[0]);
const checks = [];
const base = find('Normal', 'novice', 0.8);
if (base && readSec === 12) checks.push(['Normal 초보형 80% 한 판 15~25분', `${base.minutes}분`, base.minutes >= 15 && base.minutes <= 25]);
const hard = find('Hard', 'novice', 0.8);
if (hard) { const [n, d] = hard.wave1Fail.split('/').map(Number); checks.push(['Hard 초보형 80% 1웨이브 패배 30% 이하', hard.wave1Fail, n / d <= 0.3]); }
for (const diff of diffs) {
  const f = find(diff, 'focused', 0.8);
  for (const bal of ['balanced', 'balanced10']) {
    const b = find(diff, bal, 0.8);
    if (f && b) checks.push([`${diff} 궁수 집중이 ${bal}보다 1웨이브 넘게 앞서지 않음`, `${median(f._waves)} vs ${median(b._waves)}`, median(f._waves) - median(b._waves) <= 1]);
  }
}
for (const diff of diffs) {
  // 성장 구조가 바뀌어도 난이도별 도달 웨이브가 리뉴얼 전 기준에서 ±2 안이어야 한다(progression.md §6 ③).
  const b = find(diff, 'balanced', 0.8, 'best');
  if (b && REFERENCE_WAVES[diff] !== undefined) checks.push([`${diff} 균형형 80% 도달 웨이브 중앙값이 기준 ${REFERENCE_WAVES[diff]}±2`, `${median(b._waves)}`, Math.abs(median(b._waves) - REFERENCE_WAVES[diff]) <= 2]);
  // ⑤ 진화가 일찍 보여야 한다: 보통 균형형 80% 첫 진화(Lv4) 웨이브 중앙값 8 이하(progression.md §2, 2026-10-31).
  if (b && diff === 'Normal') checks.push([`${diff} 균형형 80% 첫 진화(Lv4) 웨이브 중앙값 8 이하`, `${b.firstEvo}`, b.firstEvo <= 8]);
  // 진화 길을 하나로 고정해도 판 결과가 크게 갈리지 않아야 한다(한 형태가 압도하지 않음).
  const fixed = ['A1', 'A2', 'B1', 'B2'].map(f => find(diff, 'balanced', 0.8, f)).filter(Boolean);
  if (fixed.length === 4) { const m = fixed.map(r => median(r._waves)); checks.push([`${diff} 균형형 80% 고정 진화 길 A1/A2/B1/B2 도달 웨이브 차이 2 이하`, m.join(' / '), Math.max(...m) - Math.min(...m) <= 2]); }
}
// progression.md §2 우선순위(2026-10-31): ③ 20웨이브 판(도달 웨이브 중앙값 18 이상)에서 주력 2~3기가 Lv7, ④ 가장 높은 타워 Lv10~13.
// 판정은 균형형 정답률 80% 줄만, 다른 전략·정답률은 골드와 습관이 달라 참고로 보인다.
const long = rows.filter(x => median(x._waves) >= 18);
for (const r of long) { const judged = r.acc === 0.8 && r.strat === 'balanced'; checks.push([`${r.diff} ${r.strat} ${r.forms} ${Math.round(r.acc * 100)}% Lv7 이상 타워 수 중앙값 2~3${judged ? '' : '(참고)'}`, `${r.lv7}기 (${Math.min(...r._lv7)}-${Math.max(...r._lv7)})`, judged ? r.lv7 >= 2 && r.lv7 <= 3 : null]); }
for (const r of long) { const judged = r.acc === 0.8 && r.strat === 'balanced'; checks.push([`${r.diff} ${r.strat} ${r.forms} ${Math.round(r.acc * 100)}% 최고 레벨 중앙값 Lv10~13${judged ? '' : '(참고)'}`, `Lv${r.maxLv} (${Math.min(...r._maxLv)}-${Math.max(...r._maxLv)})`, judged ? r.maxLv >= 10 && r.maxLv <= 13 : null]); }
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
  fs.writeFileSync(path.resolve(root, out), `${JSON.stringify({ balanceVersion: BALANCE.balanceVersion, overrides: sets, judge: judge ?? 'strategy', readSec, seeds, maxWaves, generatedAt: new Date().toISOString(), rows, checks }, null, 2)}\n`);
  console.log(`\n저장: ${out}`);
}

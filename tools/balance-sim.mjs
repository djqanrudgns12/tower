import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runnerImport } from 'vite';

// S11 엔진 밸런스 시뮬레이터 실행기. 계산은 tools/sim/balanceSim.ts가 제품 domain 엔진으로 한다.
// 예: npm run simulate:balance -- --seeds 8 --strats novice,balanced --diffs Normal --set difficulties.Normal.killGold.regular=2 --out docs/balance/s11.json
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const list = (name, fallback) => String(flag(name, fallback)).split(',').filter(Boolean);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (args.includes('--v2')) await simulateR6(false);
  else await simulateLegacy();
}

async function simulateLegacy() {
  const { module: sim } = await runnerImport(path.join(root, 'tools/sim/balanceSim.ts'), { configFile: false, logLevel: 'error', root });
  const { MAPS } = sim;
  // --set 경로=값(여러 번 가능)으로 후보를 잰다. 계약 파일은 바꾸지 않는다.
  const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
  const BALANCE = sim.withOverrides(sets);

  const maps = flag('map', 'garden_u') === 'all' ? MAPS.map(m => m.id) : list('map', 'garden_u');
  const diffs = list('diffs', Object.keys(BALANCE.difficulties).join(','));
  const strats = list('strats', 'novice,balanced,focused');
  // 기본은 앱 기본 판(product.defaults pilot.towers)이다. --towers all이면 타워 20종 모두를 그 판이 쓸 수 있다.
  // 어느 쪽이든 시작 4종(궁수·포탑·서리·마법)에 W3·W6·W10·W14 뒤 후보 3종 중 1종을 고른다(towers.md §0-2). 후보가 없으면 징집이 없다.
  const towers = flag('towers', '') === 'all' ? sim.TOWER_IDS : undefined;
  // --draft best|random: 모든 전략의 징집 습관(기본은 전략마다: 초보형 random, 나머지 best).
  const draftPolicy = flag('draft', null);
  if (draftPolicy && !sim.DRAFT_POLICIES.includes(draftPolicy)) throw new Error(`--draft는 ${sim.DRAFT_POLICIES.join('|')}: ${draftPolicy}`);
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
    const rs = Array.from({ length: seeds }, (_, i) => sim.simulateRun({ mapId, difficulty, accuracy, readSec, strategy, forms: sim.parseFormPolicies(forms), seed: i + 1, maxWaves, balance: BALANCE, ...(towers ? { towers } : {}), ...(judge ? { judge } : {}), ...(draftPolicy ? { draft: draftPolicy } : {}) }));
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
      owned: median(rs.map(r => r.owned.length)),
      _waves: waves, _minutes: rs.map(r => r1(r.minutes)), _maxLv: rs.map(r => r.maxLevel), _lv7: rs.map(r => r.evolvedTwice),
      _owned: Object.fromEntries(sim.TOWER_IDS.map(t => [t, rs.filter(r => r.owned.includes(t)).length]).filter(([, n]) => n > 0)),
      _forms: Object.fromEntries(Object.keys(rs[0].formCounts).map(f => [f, rs.reduce((a, r) => a + r.formCounts[f], 0)])),
    });
  }

  console.log(`S11 엔진 시뮬레이션 · ${BALANCE.balanceVersion} · 성장 ${BALANCE.waves.hpGrowthPercent}% · 읽기 ${readSec}초 · seed ${seeds} · 상한 ${maxWaves}웨이브 · ${r1((performance.now() - started) / 1000)}초`);
  if (sets.length) console.log(`조정 후보: ${sets.join(' · ')}`);
  if (judge) console.log(`거래 가치: 모든 전략 ${judge}`);
  const pool = towers ?? sim.PILOT_TOWERS;
  console.log(`${towers ? '타워 20종' : `앱 기본 판 ${pool.length}종`} · 징집: 시작 ${BALANCE.draft.startTowers.join('·')}, W${BALANCE.draft.afterWaves.join('·W')} 뒤 ${BALANCE.draft.offerCount}종 중 1종, 장착함 ${BALANCE.draft.maxOwned}칸${draftPolicy ? ` · 징집 습관 ${draftPolicy}` : ''}${pool.length <= BALANCE.draft.startTowers.length ? ' (후보 없음, 징집 없음)' : ''}`);
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
    fs.writeFileSync(path.resolve(root, out), `${JSON.stringify({ balanceVersion: BALANCE.balanceVersion, overrides: sets, judge: judge ?? 'strategy', towers: towers ? 'all20' : `pilot${sim.PILOT_TOWERS.length}`, draft: draftPolicy ?? 'strategy', readSec, seeds, maxWaves, generatedAt: new Date().toISOString(), rows, checks }, null, 2)}\n`);
    console.log(`\n저장: ${out}`);
  }
}

/** R6는 실제 거래 비용(보물 포함)을 읽고, 갈래 선택 없이 현재 열린 여섯 종류에서 고른다. */
export async function simulateR6(gate) {
  const load = (file) =>
    runnerImport(path.join(root, file), { configFile: false, logLevel: 'error', root }).then((r) => r.module);
  const [sim, contract, engine, relics] = await Promise.all([
    load('tools/sim/balanceSim.ts'),
    load('src/contracts/balanceV2.ts'),
    load('src/domain/r6Balance.ts'),
    load('src/domain/relics.ts'),
  ]);
  const rules = contract.balanceV2Schema.parse(
    JSON.parse(fs.readFileSync(path.join(root, 'docs/contracts/balance.v2.json'), 'utf8')),
  );
  const balance = engine.compileR6Balance(sim.BALANCE, rules);
  const towers = contract.R6_TOWERS;
  const seeds = Number(flag('seeds', args.includes('--full') ? 24 : 8));
  const maxWaves = Number(flag('max-waves', 40)),
    readSec = Number(flag('read', 12));
  if (!Number.isInteger(seeds) || seeds < 1 || !Number.isInteger(maxWaves) || maxWaves < 1 || !(readSec > 0))
    throw new Error('시드 수·웨이브 상한·읽기 시간을 확인하세요');
  if (flag('maps', flag('map', rules.prototypeMap)) !== rules.prototypeMap)
    throw new Error('v2 지도는 초원 고원입니다');
  if (args.includes('--set')) throw new Error('v2는 선택한 계약의 수치를 사용합니다');
  const difficultyIds = Object.keys(rules.difficulties);
  const gateCases = [
    ['Normal', 'novice', 0.6],
    ...difficultyIds.map((d) => [d, 'balanced', 0.8]),
    ['Normal', 'optimizer', 0.95],
  ];
  const bots = list(gate ? 'bots' : 'strats', gate ? 'novice,balanced,optimizer' : 'balanced');
  const cases = gate
    ? gateCases.filter((c) => bots.includes(c[1]))
    : list('diffs', 'Normal').flatMap((d) => bots.flatMap((b) => list('acc', '0.8').map((a) => [d, b, Number(a)])));
  if (!cases.length) throw new Error('측정할 조합이 없습니다');
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const median = (a) => {
    const v = [...a].sort((x, y) => x - y);
    return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2;
  };
  const options = (p) =>
    sim.greedyOptions({ ...p, ctx: relics.relicContext(p.ctx, p.s) }).sort((a, b) => b.gain / b.cost - a.gain / a.cost);
  const greedy = {
    ...sim.GREEDY,
    spend(p) {
      for (;;) {
        const best = options(p)[0];
        if (!best || best.cost > p.s.gold) return;
        sim.runCmd(p, best.cmd);
      }
    },
  };
  // 최적화형은 매 준비 단계의 첫 거래 후보 3개와 저축을 현재 판 사본에서 다음 두 웨이브까지 비교한다.
  const optimizer = {
    ...greedy,
    spend(p) {
      if (p.s.phase === 'BUILD') {
        const choices = options(p)
          .filter((o) => o.cost <= p.s.gold)
          .slice(0, 3);
        if (choices.length) {
          let bestScore = -Infinity,
            best = null;
          for (const choice of [...choices, null]) {
            const q = sim.clonePlayer(p, greedy);
            if (choice) sim.runCmd(q, choice.cmd);
            q.startAt = q.s.tick + 240;
            const until = q.s.completedWave + 2;
            let loss = 0,
              exposure = 0;
            while (!sim.playerDone(q) && q.s.completedWave < until) {
              for (const e of sim.stepPlayer(q)) if (e.type === 'leak') loss += e.damage;
              if (q.s.pause.length) throw new Error('예측 중 엔진이 멈췄습니다');
              for (const e of q.s.enemies) exposure += (e.progress / q.ctx.path.length) ** 2;
            }
            const score = 100000 * q.s.completedWave - (1000 * loss) / q.s.gateMaxHp - exposure / 30 + 0.02 * q.s.gold;
            if (score > bestScore) {
              bestScore = score;
              best = choice;
            }
          }
          if (best) sim.runCmd(p, best.cmd);
          return;
        }
      }
      greedy.spend(p);
    },
  };
  const rows = [];
  for (const [difficulty, bot, accuracy] of cases) {
    const mono = bot.startsWith('mono-') ? bot.slice(5) : null;
    if (
      !difficultyIds.includes(difficulty) ||
      !(mono ? towers.includes(mono) : ['novice', 'balanced', 'optimizer'].includes(bot)) ||
      !(accuracy >= 0 && accuracy <= 1)
    )
      throw new Error('지원하지 않는 난이도·봇·정답률입니다');
    const base = sim.STRATEGIES[bot === 'novice' ? 'novice' : 'balanced'];
    const pattern = base.pattern.map((id) => ({ archer: 'rail', cannon: 'mortar', frost: 'cryo' })[id]);
    const policy = mono
      ? { ...base, pattern: [mono], useOwned: false, fixedOwned: [mono] }
      : { ...base, pattern: bot === 'optimizer' ? towers : pattern, ...(bot === 'optimizer' && { pick: 'free' }) };
    const runs = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const p = sim.createPlayer({
        balance,
        towers,
        mapId: rules.prototypeMap,
        seed,
        difficulty,
        accuracy,
        readSec,
        maxWaves,
        policy,
        telemetry: true,
        brain: bot === 'optimizer' ? optimizer : greedy,
      });
      while (!sim.playerDone(p)) {
        sim.stepPlayer(p);
        if (p.s.pause.length) throw new Error('측정 중 엔진이 멈췄습니다');
      }
      const r = sim.finishPlayer(p),
        waves = p.tel.waves;
      const durations = waves.flatMap((w, i) =>
        w.completed ? [((waves[i + 1]?.startTick ?? p.s.tick) - w.startTick) / 1800] : [],
      );
      const mid = p.tel.actions.filter((a) => a.wave >= 6 && a.wave <= 13);
      runs.push({
        seed,
        wave: r.completedWave,
        minutes: r.minutes,
        reason: r.endReason,
        waveMinutes: durations.length ? mean(durations) : null,
        answerGold: waves.reduce((s, w) => s + w.answerGold, 0) / Math.max(1, p.s.stats.goldEarned),
        midPurchases: mid.length,
        midGateLoss: waves.filter((w) => w.wave >= 6 && w.wave <= 13).reduce((s, w) => s + w.gateLoss, 0),
        unlocked: [...p.s.owned],
        installed: [...new Set(p.tel.actions.filter((a) => a.type === 'build').map((a) => a.tower))],
        maxLevel: r.maxLevel,
        weaponLevels: [6, 12, 18].filter((level) => p.tel.actions.some((a) => a.level >= level)),
      });
    }
    const row = {
      difficulty,
      bot,
      accuracy,
      wave: median(runs.map((r) => r.wave)),
      minutes: median(runs.map((r) => r.minutes)),
      midPurchases: median(runs.map((r) => r.midPurchases)),
      midGateLoss: median(runs.map((r) => r.midGateLoss)),
      waveMinutes: mean(runs.flatMap((r) => (r.waveMinutes === null ? [] : [r.waveMinutes]))),
      answerGold: mean(runs.map((r) => r.answerGold)),
      runs,
    };
    row.installRate = Object.fromEntries(
      towers.map((id) => {
        const eligible = runs.filter((r) => r.unlocked.includes(id));
        return [id, eligible.length ? eligible.filter((r) => r.installed.includes(id)).length / eligible.length : null];
      }),
    );
    row.weaponReach = Object.fromEntries(
      [6, 12, 18].map((level) => [level, runs.filter((r) => r.weaponLevels.includes(level)).length / runs.length]),
    );
    rows.push(row);
    console.log(
      `${difficulty} ${bot} ${accuracy} · ${row.wave}웨이브 (${runs.map((r) => r.wave).join(',')}) · W6~13 구매 ${row.midPurchases}회, 성문 피해 ${row.midGateLoss} · 웨이브 ${row.waveMinutes.toFixed(2)}분, 정답 골드 ${(row.answerGold * 100).toFixed(1)}%`,
    );
  }
  const checks = [];
  if (gate) {
    const get = (d, b) => rows.find((r) => r.difficulty === d && r.bot === b);
    const n = get('Normal', 'balanced'),
      novice = get('Normal', 'novice'),
      opt = get('Normal', 'optimizer');
    const check = (name, value, min, max) => {
      if (value !== undefined)
        checks.push({ name, value, min, max, pass: value >= min && (max === null || value <= max) });
    };
    check('초보형', novice?.wave, 10, 12);
    check('균형형', n?.wave, 14, 17);
    check('최적화형', opt?.wave, 22, 26);
    if (opt && novice) check('초보↔최적', opt.wave - novice.wave, 12, null);
    for (const [d, min, max] of [
      ['Easy', 4, 6],
      ['Hard', -5, -3],
      ['Crazy', -8, -6],
    ])
      if (n && get(d, 'balanced')) check(d + ' 간격', get(d, 'balanced').wave - n.wave, min, max);
    check('웨이브 시간(분)', n?.waveMinutes, 0, 1.4);
    check('정답 골드 비율', n?.answerGold, 0.55, 1);
    console.table(checks);
  }
  const out = flag('out', null);
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify({ balanceVersion: rules.balanceVersion, seeds, readSec, maxWaves, rows, checks }, null, 2) + '\n',
    );
  }
  const report = flag('report', null);
  if (report) {
    const lines = [
      '# R6 밸런스 측정',
      '',
      `초원 고원, 시드 1~${seeds}, 읽기 ${readSec}초`,
      '',
      '| 난이도 | 봇 | 정답률 | 완료 웨이브 중앙값 | 한 판 중앙값(분) |',
      '|---|---|---:|---:|---:|',
      ...rows.map((r) => `| ${r.difficulty} | ${r.bot} | ${r.accuracy} | ${r.wave} | ${r.minutes.toFixed(1)} |`),
      '',
      ...checks.map((c) => `- ${c.name} ${Number(c.value.toFixed(3))}, ${c.pass ? '통과' : '미달'}`),
      '',
    ];
    fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
    fs.writeFileSync(report, lines.join('\n'));
  }
}

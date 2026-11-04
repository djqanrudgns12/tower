import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import { relicIds } from '../../src/domain/relics';
import { clonePlayer, createPlayer, GREEDY, simulateRun, stepPlayer, withOverrides } from '../../tools/sim/balanceSim';
import { botPolicy, optimizerBrain, rollout, runBot, toSimOptions, type BotName, type RunSpec, type RunSummary } from '../../tools/sim/bots';
import {
  bossDeathShare, bossKill, cellKey, cellStat, computeMetrics, evaluateGate, gateEarly, gradualDeath, income, lossBy, mapAvg, median, quantile, summarize,
  type Metrics,
} from '../../tools/sim/gate';
import { planJobs } from '../../tools/sim/gateJobs';
import { ROLES, TRAITS } from '../../tools/sim/towerEfficiency';

const spec = (bot: BotName, over: Partial<RunSpec> = {}): RunSpec => ({ bot, map: 'garden_u', difficulty: 'Normal', acc: 0.8, seed: 3, maxWaves: 5, tuning: { K: 3, horizon: 1, waveTickBudget: 50_000 }, ...over });
const stable = (r: RunSummary) => ({ ...r, ms: 0 });

describe('B0 가상 플레이어: 같은 seed면 같은 판', () => {
  it.each(['novice', 'balanced', 'counter', 'mono-archer', 'core4+frost'] as BotName[])('%s 봇은 두 번 돌려도 같은 결과를 낸다', bot => {
    const a = runBot(spec(bot));
    expect(a.completedWave).toBe(5);
    expect(stable(runBot(spec(bot)))).toEqual(stable(a));
  });

  it('최적화형(미리 돌려 보기)도 같은 seed면 같은 판을 내고, 미리 돌려 본 사본이 원본 상태를 바꾸지 않는다', () => {
    const s = spec('optimizer', { maxWaves: 3 });
    const a = runBot(s);
    expect(stable(runBot(s))).toEqual(stable(a));
    // 롤아웃은 사본에서만 돈다: 전후 원본 상태가 같아야 한다.
    const p = createPlayer(toSimOptions(spec('balanced')));
    while (p.s.phase !== 'BUILD') stepPlayer(p);
    const before = JSON.stringify(p.s);
    const r1 = rollout(p, [], 1);
    expect(JSON.stringify(p.s)).toBe(before);
    expect(rollout(p, [], 1)).toEqual(r1);
    // 사본은 원본과 독립이다.
    const q = clonePlayer(p, GREEDY);
    q.s.gold += 999;
    expect(p.s.gold).not.toBe(q.s.gold);
  });

  it('균형형은 예전 균형10 전략과 같은 판을 낸다(리팩터링 회귀)', () => {
    const a = runBot(spec('balanced', { maxWaves: 8, seed: 5 }));
    const legacy = simulateRun({ mapId: 'garden_u', difficulty: 'Normal', accuracy: 0.8, readSec: 12, strategy: 'balanced10', seed: 5, maxWaves: 8 });
    expect(a.completedWave).toBe(legacy.completedWave);
    expect(a.firstEvoWave).toBe(legacy.firstEvoWave);
    expect(a.correct).toBe(legacy.correct);
    expect(a.wrong).toBe(legacy.wrong);
  });

  it('단일 타워는 그 종류만 짓고, 조합 시험은 유틸 타워를 하나만 짓는다', () => {
    const mono = runBot(spec('mono-spear', { maxWaves: 6 }));
    expect(Object.keys(mono.builds)).toEqual(['spear']);
    // R4 B2부터 강화 효율이 새 설치와 비슷해 균형형 습관은 몇 기만 짓고 키운다. 상한(유틸 1기)을 보려고 강화를 막은 밸런스로 넓게 짓게 한다.
    const combo = runBot(spec('core4+frost', { maxWaves: 8, balance: withOverrides(['levels.max=1']) }));
    expect(combo.builds.frost).toBe(1);
    expect(Object.keys(combo.builds).every(t => ['archer', 'crossbow', 'cannon', 'mage', 'frost'].includes(t))).toBe(true);
    expect(botPolicy('core4+bell').cap).toEqual({ bell: 1 });
  });

  it('상성형은 다음 웨이브 구성을 보고 균형형과 다르게 고른다', () => {
    const c = runBot(spec('counter', { maxWaves: 12 }));
    const b = runBot(spec('balanced', { maxWaves: 12 }));
    expect(c.builds).not.toEqual(b.builds);
  });

  it('최적화형 두뇌는 후보가 없어도 던지지 않는다(돈이 없을 때)', () => {
    const p = createPlayer({ ...toSimOptions(spec('optimizer', { maxWaves: 2 })), brain: optimizerBrain({ K: 2, horizon: 1, waveTickBudget: 50_000 }) });
    p.s.phase = 'BUILD'; p.s.quiz.current = null; p.s.quiz.feedback = null; p.s.gold = 0;
    expect(() => p.brain.spend(p)).not.toThrow();
  });
});

describe('관문 작업 계획', () => {
  it('빠른 모드는 4개 맵 × 모든 봇 셀을 포함하고, 봇 이름이 모두 해석된다', () => {
    const jobs = planJobs({ mode: 'fast', seeds: 2 });
    const runs = jobs.filter(j => j.kind === 'run');
    expect(new Set(runs.map(j => j.spec.map)).size).toBe(4);
    for (const bot of new Set(runs.map(j => j.spec.bot))) expect(() => botPolicy(bot)).not.toThrow();
    expect(runs.filter(j => j.spec.bot.startsWith('mono-'))).toHaveLength(TOWER_IDS.length * 4 * 2);
    expect(jobs.filter(j => j.kind === 'matrix')).toHaveLength(4);
    expect(jobs.filter(j => j.kind === 'efficiency')).toHaveLength(TOWER_IDS.length);
  });
});

// ── 집계 함수와 줄별 판정 ─────────────────────────────────────────────────────────────────

/** 시험용 판 요약. waves는 [성문피해, 새는 적, 정답골드, 처치골드, 보스골드, 생존골드, 오라골드, 분, 끝냄, 최고Lv, Lv7↑, 타워]. */
function run(over: Partial<RunSummary> & { loss?: number[] } = {}): RunSummary {
  const { loss = [0, 0, 0], ...rest } = over;
  return {
    bot: 'balanced', map: 'garden_u', difficulty: 'Normal', acc: 0.8, seed: 1, completedWave: loss.length, endReason: 'DEFEAT', minutes: 20, gateMax: 15,
    waves: loss.map((l, i) => [l, l, 22, 10, i === 4 ? 75 : 0, 0, 0, 1.2, i === loss.length - 1 && rest.endReason !== 'WAVE_CAP' ? 0 : 1, 2, 0, 5]),
    bosses: [], firstEvoWave: 6, snap20: null, finalTowers: [], builds: {}, upgrades: [], drafts: [], relics: [], sells: 0, damage: {}, correct: 10, wrong: 2, ms: 1,
    ...rest,
  };
}

describe('관문 집계', () => {
  it('분위수·중앙값·맵 평균', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(quantile([0, 10], 0.1)).toBe(1);
    expect(quantile([5], 0.9)).toBe(5);
    const runs = [run({ map: 'a', completedWave: 10 }), run({ map: 'a', completedWave: 12 }), run({ map: 'b', completedWave: 20 })];
    expect(mapAvg(runs)).toEqual({ avg: (11 + 20) / 2, byMap: { a: 11, b: 20 } });
  });

  it('W1~5 패배율은 W5 안에서 진 판의 비율이다', () => {
    const runs = [run({ completedWave: 4 }), run({ completedWave: 5 }), run({ completedWave: 2 }), run({ completedWave: 9, endReason: 'WAVE_CAP' })];
    expect(lossBy(runs, 5)).toBe(0.5);
    expect(lossBy(runs, 1)).toBe(0);
    expect(lossBy([], 5)).toBeNull();
  });

  it('성문 피해: W1~8 평균, 직전 2웨이브 50% 이상, 보스 웨이브 사망', () => {
    const slow = run({ loss: [0, 0, 3, 8, 15], completedWave: 4 }); // 패배 W5(보스 웨이브), 직전 W4가 8/15=53%
    const sudden = run({ loss: [0, 0, 0, 1, 15], completedWave: 4 });
    expect(gradualDeath([slow, sudden])).toEqual({ share: 0.5, defeats: 2 });
    expect(bossDeathShare([slow, sudden])).toEqual({ share: 1, defeats: 2 });
    expect(bossDeathShare([run({ completedWave: 6 })]).share).toBe(0);
    // 마지막(패배) 웨이브는 최대 100%로 센다.
    expect(gateEarly([run({ loss: [0, 15] })], 8)).toBeCloseTo(0.5, 6);
  });

  it('보스 처치율: 웨이브에 들어선 판 기준과 보스가 나온 판 기준', () => {
    const killed = run({ completedWave: 6, bosses: [[5, 1]] });
    const leaked = run({ completedWave: 6, bosses: [[5, 0]] });
    const diedBefore = run({ completedWave: 4, bosses: [] }); // W5에 들어섰지만 보스가 나오기 전에 졌다
    const notReached = run({ completedWave: 2 });
    const r = bossKill([killed, leaked, diedBefore, notReached], 5);
    expect(r.reached).toBeCloseTo(1 / 3, 6);
    expect(r.event).toBe(0.5);
    expect(r.n).toBe(3);
  });

  it('수입 구성은 정답·처치·보스·생존·오라 골드를 센다', () => {
    const r = income([run({ loss: [0, 0, 0, 0, 0] })], 20);
    expect(r.answer).toBe(110);
    expect(r.boss).toBe(75);
    expect(r.answerShare).toBeCloseTo(110 / (110 + 50 + 75), 6);
  });

  it('셀 통계: 생존 곡선과 웨이브 길이', () => {
    const s = cellStat([run({ completedWave: 2, loss: [0, 0] }), run({ completedWave: 4, loss: [0, 0, 0, 0] })]);
    expect(s.survival).toEqual([1, 1, 0.5, 0.5]);
    expect(s.median).toBe(3);
    expect(s.waveMinutes).toBeGreaterThan(0);
  });
});

/** 모든 줄이 PASS가 되는 지표. 줄 하나씩 어긋나게 해서 판정을 확인한다. */
function goodMetrics(): Metrics {
  const strong = Object.fromEntries(ROLES.map(r => [r, { count: 2, towers: ['mortar', 'roller'] as TowerId[] }])) as Metrics['counterStrong'];
  return {
    seeds: 8, engineErrors: 0, runs: 100,
    novice60: 11, balanced80: 16, optimizer95: 24, optimizer80: 22, balanced60: 13, balanced95: 19, monoArcher80: 12,
    monoWaves: Object.fromEntries(TOWER_IDS.map(t => [t, t === 'banner' ? 0 : 10])),
    balanced80Spread: { p10: 13, p90: 19, width: 6 }, mapSpread: 1, novice50Early: 0, gateEarly: 0.1,
    gradual: { share: 0.7, defeats: 20 }, bossDeath: { share: 0.3, defeats: 20, balanced80: 0.1 },
    bossKill: { 5: { reached: 0.97, event: 1, n: 30 }, 10: { reached: 0.9, event: 0.95, n: 30 }, 15: { reached: 0.75, event: 0.9, n: 20 }, 20: { reached: 0.4, event: 0.6, n: 10 } },
    waveMinutes: 1.3, answerShare: 0.6,
    diffWaves: { Easy: 21, Normal: 16, Hard: 12, Crazy: 9 }, w1Loss: { Hard: 0.03, Crazy: 0.1 },
    firstEvo: 6, w20: { lv7: 2, n: 10, source: '최적화형 95%' }, effEarly: 0.95, effLate: 0.75,
    branches: [{ tower: 'archer', branch: 'Lv4', shares: { A: 0.5, B: 0.5 }, n: 20, ok: true }], branchLowN: 5,
    counterStrong: strong,
    towerRoles: [{ tower: 'cannon', strongRole: 'swarm', strong: 2, weakRole: 'flyer', weak: 0, ok: true }],
    pickShare: Object.fromEntries(TOWER_IDS.map(t => [t, 0.05])), pickRuns: 30,
    draftPicks: Object.fromEntries(TOWER_IDS.slice(4).map(t => [t, { offered: 20, picked: 6 }])),
    utility: (['frost', 'wind', 'bell', 'banner', 'alchemist', 'guardian'] as const).map(tower => ({ tower, waveDelta: 2, gateDelta: -0.1, pass: true, n: 32, coreWaves: 16, withWaves: 18, coreGate: 0.1, withGate: 0.09 })),
    utilityWindow: 15,
    relics: { ids: RELICS, picks: Object.fromEntries(RELICS.map(id => [id, 10])), offered: Object.fromEntries(RELICS.map(id => [id, 30])), total: 120, gains: Object.fromEntries(RELICS.map(id => [id, 1])), base: 15 },
    traitStrong: Object.fromEntries(TRAITS.map(t => [t, { count: 2, towers: ['mortar', 'roller'] as TowerId[] }])),
  };
}
const RELICS = relicIds(BALANCE);

describe('관문 줄 판정', () => {
  const status = (m: Metrics, id: string) => evaluateGate(m).find(r => r.id === id)!.status;

  it('목표를 모두 맞춘 지표는 전부 PASS다(R4 B3부터 보물·특성 줄도 판정한다)', () => {
    const rows = evaluateGate(goodMetrics());
    expect(rows.filter(r => r.status !== 'PASS').map(r => r.id)).toEqual([]);
    expect(summarize(rows)).toEqual({ pass: rows.length, fail: 0, na: 0, total: rows.length });
  });

  it('보물 줄: 선택률 5% 미만이나 상승폭 +3 초과면 미달, 표본이 모자라면 N/A, 특성 줄: 특성마다 1.4배 타워 2종', () => {
    const m = goodMetrics();
    const relics = (over: Partial<Metrics['relics']>): Metrics => ({ ...m, relics: { ...m.relics, ...over } });
    // 선택률 = 후보로 나왔을 때 고른 비율(징집과 같은 정의): 1/30 < 5% 미달, 2/30 통과, 후보 9번 이하는 표본 부족.
    expect(status(relics({ picks: { ...m.relics.picks, [RELICS[0]!]: 1 } }), 'tower.relics')).toBe('FAIL');
    expect(status(relics({ picks: { ...m.relics.picks, [RELICS[0]!]: 2 } }), 'tower.relics')).toBe('PASS');
    expect(status(relics({ picks: { ...m.relics.picks, [RELICS[0]!]: 0 }, offered: { ...m.relics.offered, [RELICS[0]!]: 9 } }), 'tower.relics')).toBe('N/A');
    expect(status(relics({ gains: { ...m.relics.gains, [RELICS[1]!]: 3.5 } }), 'tower.relics')).toBe('FAIL');
    expect(status(relics({ gains: { ...m.relics.gains, [RELICS[1]!]: 3 } }), 'tower.relics')).toBe('PASS');
    expect(status(relics({ offered: {}, gains: {} }), 'tower.relics')).toBe('N/A');
    expect(status(relics({ gains: { ...m.relics.gains, [RELICS[2]!]: null } }), 'tower.relics')).toBe('N/A');
    expect(status({ ...m, traitStrong: { ...m.traitStrong, clay: { count: 1, towers: ['hwacha'] } } }, 'tower.traits')).toBe('FAIL');
    expect(status({ ...m, traitStrong: {} }, 'tower.traits')).toBe('N/A');
  });

  it('범위 줄은 경계값을 포함하고, 벗어나면 FAIL이다', () => {
    const m = goodMetrics();
    expect(status({ ...m, novice60: 10 }, 'curve.novice60')).toBe('PASS');
    expect(status({ ...m, novice60: 12 }, 'curve.novice60')).toBe('PASS');
    expect(status({ ...m, novice60: 12.5 }, 'curve.novice60')).toBe('FAIL');
    expect(status({ ...m, balanced80: 13.5 }, 'curve.balanced80')).toBe('FAIL');
    expect(status({ ...m, diffWaves: { ...m.diffWaves, Hard: 11 } }, 'diff.hard')).toBe('PASS'); // 16 → 11은 -5로 경계
    expect(status({ ...m, diffWaves: { ...m.diffWaves, Hard: 10.5 } }, 'diff.hard')).toBe('FAIL');
    expect(status({ ...m, diffWaves: { ...m.diffWaves, Hard: 13.5 } }, 'diff.hard')).toBe('FAIL'); // -2.5는 목표(-5~-3) 밖
  });

  it('차이·비율 줄: 전략 효과, 정답률 효과, 단일 타워 상한', () => {
    const m = goodMetrics();
    expect(status({ ...m, optimizer80: 17 }, 'curve.strategyEffect')).toBe('FAIL'); // 17 - 12 = 5 < 6
    expect(status({ ...m, balanced95: 17 }, 'curve.accEffect')).toBe('FAIL'); // 17 - 13 = 4 < 5
    expect(status({ ...m, monoWaves: { ...m.monoWaves, crossbow: 14 } }, 'curve.bestMono')).toBe('FAIL'); // 균형형 16 - 3 = 13 < 14
    expect(status({ ...m, monoWaves: { ...m.monoWaves, crossbow: 13 } }, 'curve.bestMono')).toBe('PASS');
    // 유틸 6종(깃발·서리·바람·종각·약병·수호기사)은 단일 타워 판정에서 빠진다(측정 정의 보정 B2). 공격 타워는 W6 미만이면 미달.
    expect(status({ ...m, monoWaves: { ...m.monoWaves, banner: 0, frost: 2, wind: 0 } }, 'tower.monoMin')).toBe('PASS');
    expect(status({ ...m, monoWaves: { ...m.monoWaves, mortar: 5 } }, 'tower.monoMin')).toBe('FAIL');
  });

  it('보스 처치율은 웨이브마다 다른 기준을 쓴다', () => {
    const m = goodMetrics();
    const kill = (w: number, reached: number): Metrics => ({ ...m, bossKill: { ...m.bossKill, [w]: { reached, event: reached, n: 10 } } });
    expect(status(kill(5, 0.94), 'curve.bossKill5')).toBe('FAIL');
    expect(status(kill(10, 0.85), 'curve.bossKill10')).toBe('PASS');
    expect(status(kill(15, 0.69), 'curve.bossKill15')).toBe('FAIL');
  });

  it('타워 균형 줄: 징집 선택률(후보로 나왔을 때) 10~60%, 역할별 강한 타워 2종, 유틸 시너지', () => {
    const m = goodMetrics();
    expect(status({ ...m, draftPicks: { ...m.draftPicks, bell: { offered: 20, picked: 1 } } }, 'tower.pickRate')).toBe('FAIL'); // 5% < 10%
    expect(status({ ...m, draftPicks: { ...m.draftPicks, bell: { offered: 20, picked: 13 } } }, 'tower.pickRate')).toBe('FAIL'); // 65% > 60%
    expect(status({ ...m, draftPicks: { ...m.draftPicks, bell: { offered: 20, picked: 2 } } }, 'tower.pickRate')).toBe('PASS'); // 10%는 경계 안
    // 후보로 9번 이하 나온 타워는 표본 부족으로 판정에서 뺀다. 설치 점유(pickShare)는 판정에 쓰지 않는다.
    expect(status({ ...m, draftPicks: { ...m.draftPicks, bell: { offered: 9, picked: 0 } } }, 'tower.pickRate')).toBe('PASS');
    expect(status({ ...m, pickShare: { ...m.pickShare, archer: 0.5 } }, 'tower.pickRate')).toBe('PASS');
    const weak = { ...m.counterStrong, swarm: { count: 1, towers: ['cannon' as TowerId] } };
    expect(status({ ...m, counterStrong: weak }, 'tower.counter2')).toBe('FAIL');
    // 웨이브 +1.5 또는 성문 −25% 둘 중 하나면 통과, 둘 다 못 하면 미달.
    const ut = (waveDelta: number, gateDelta: number): Metrics => ({ ...m, utility: m.utility.map((u, i) => (i === 0 ? { ...u, waveDelta, gateDelta, pass: waveDelta >= 1.5 || gateDelta <= -0.25 } : u)) });
    expect(status(ut(1.5, 0), 'tower.utility')).toBe('PASS');
    expect(status(ut(0, -0.25), 'tower.utility')).toBe('PASS');
    expect(status(ut(1, -0.2), 'tower.utility')).toBe('FAIL');
  });

  it('자료가 없으면 N/A이고, 표본이 모자라면 판정하지 않는다', () => {
    const m = goodMetrics();
    expect(status({ ...m, optimizer95: null }, 'curve.optimizer95')).toBe('N/A');
    expect(status({ ...m, branches: [] }, 'grow.branch')).toBe('N/A');
    expect(status({ ...m, w20: { lv7: 2, n: 1, source: 'x' } }, 'grow.w20')).toBe('N/A');
    expect(status({ ...m, branches: [{ tower: 'archer', branch: 'Lv4', shares: { A: 0.8, B: 0.2 }, n: 20, ok: false }] }, 'grow.branch')).toBe('FAIL');
  });
});

describe('관문 지표 계산', () => {
  it('computeMetrics가 셀 키로 봇·정답률을 찾아 줄 지표를 채운다', () => {
    const mk = (bot: string, acc: number, wave: number, over: Partial<RunSummary> = {}) => run({ bot: bot as BotName, acc, completedWave: wave, loss: Array.from({ length: wave }, () => 0), ...over });
    const runs = [
      mk('novice', 0.6, 11), mk('novice', 0.6, 12), mk('balanced', 0.8, 15), mk('balanced', 0.8, 17),
      mk('optimizer', 0.95, 24), mk('mono-archer', 0.8, 12), mk('core4', 0.8, 15), mk('core4+frost', 0.8, 17),
    ];
    const m = computeMetrics({ runs, matrix: {}, efficiency: [] }, 2);
    expect(m.novice60).toBe(11.5);
    expect(m.balanced80).toBe(16);
    expect(m.optimizer95).toBe(24);
    expect(m.monoArcher80).toBe(12);
    expect(m.utility.find(u => u.tower === 'frost')?.waveDelta).toBe(2);
    expect(cellKey('Normal', 'balanced', 0.8)).toBe('Normal|balanced|0.8');
    // 엔진 수치 한계로 끊긴 판은 집계에서 빠지고 개수만 센다.
    const withError = computeMetrics({ runs: [...runs, mk('balanced', 0.8, 1, { engineError: 'NUMERIC_LIMIT' })], matrix: {}, efficiency: [] }, 2);
    expect(withError.engineErrors).toBe(1);
    expect(withError.balanced80).toBe(16);
  });

  it('측정 정의 보정(B2): 강점·약점 줄은 유틸 6종·덫을 빼고, 징집 선택률은 최적화형 판의 후보·선택을 센다', () => {
    const ratio = (best: number, worst: number) => Object.fromEntries(ROLES.map((r, i) => [r, i === 0 ? best : i === 1 ? worst : 1]));
    const rows = TOWER_IDS.map(tower => ({ tower, attacks: tower !== 'banner', ratio: ratio(1.5, 0.5), per100: ratio(1, 1), best: { role: ROLES[0]!, ratio: 1.5 }, worst: { role: ROLES[1]!, ratio: 0.5 }, utility: false, pass: null }));
    const opt = run({ bot: 'optimizer', acc: 0.95, completedWave: 10, loss: Array.from({ length: 10 }, () => 0) });
    opt.drafts = [{ wave: 3, offers: ['spear', 'trap', 'bell'], picked: 'trap' }, { wave: 6, offers: ['spear', 'falcon', 'hwacha'], picked: 'falcon' }];
    const m = computeMetrics({ runs: [opt], matrix: { garden_u: rows as never }, efficiency: [] }, 1);
    const judged = m.towerRoles.map(t => t.tower);
    for (const t of ['archer', 'banner', 'frost', 'wind', 'bell', 'alchemist', 'guardian', 'trap'] as const) expect(judged).not.toContain(t);
    expect(judged).toContain('crossbow');
    expect(m.draftPicks.spear).toEqual({ offered: 2, picked: 0 });
    expect(m.draftPicks.trap).toEqual({ offered: 1, picked: 1 });
  });
});

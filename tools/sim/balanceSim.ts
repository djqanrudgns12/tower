import { balanceSchema, TOWER_IDS, type Balance, type BranchId, type DifficultyId, type TowerId } from '../../src/contracts/balance';
import { BALANCE, gradeContent, MAPS, PILOT_TOWERS, toRuntime } from '../../src/content';
import { createContext, type GameContext } from '../../src/domain/context';
import { center, dist2, positionAt } from '../../src/domain/geometry';
import { msToTicks, TICK_HZ } from '../../src/domain/num';
import { intBelow, shuffle, u32, type Rng } from '../../src/domain/rng';
import { advanceTick, applyCommand, createRun, type Command } from '../../src/domain/run';
import { attackIntervalTicks, attacks, bannerAura, buildCost, needsBranch, towerStats, upgradeCost } from '../../src/domain/towers';
import type { Phase, Tower } from '../../src/domain/types';
import { measure, STREAMS } from './towerEfficiency';

// S11 엔진 밸런스 시뮬레이터(PRD §17.3, §18.1). 판정은 제품 domain 엔진(createRun·applyCommand·advanceTick)이 하고,
// 여기서는 가상 플레이어(읽기 시간·정답률·돈 쓰는 습관)만 흉내 낸다. 학생 실측이 아니다.

export type StrategyId = 'novice' | 'balanced' | 'focused' | 'balanced10';

interface Strategy {
  /** 전투 중 돈을 쓰러 오는 간격. */
  attentionMs: number;
  /** true면 칸을 무작위로 고른다. false면 경로를 많이 덮는 칸부터. */
  randomSlots: boolean;
  pattern: TowerId[];
  /** 타워가 이만큼 생기기 전에는 강화하지 않는다. */
  upgradeAfterTowers: number;
  /**
   * 'sequence'는 pattern 차례대로 짓고 그 칸은 slotOrder 순서다. 'round'는 pattern에서 덜 지은 종류들 가운데
   * 그 종류에 가장 좋은 빈칸에서 가성비가 가장 좋은 것을 짓는다(가치가 낮게 잡힌 차례 하나에 막혀 강화만 하지 않게).
   */
  pick?: 'sequence' | 'round';
  /** 거래 가치를 보는 눈(value 참고). 없으면 'sketch'. */
  judge?: Judge;
}

/** 'sketch'는 balance-sketch에서 이어받은 어림, 'engine'은 제품 엔진으로 잰 피해다. */
export type Judge = 'sketch' | 'engine';

// tools/balance-sketch.mjs의 가상 플레이어를 이어받았다. 마법탑은 P1 범위 밖이라 뺐다.
export const STRATEGIES: Record<StrategyId, Strategy> = {
  novice: { attentionMs: 30000, randomSlots: true, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'archer', 'cannon'], upgradeAfterTowers: 6 },
  balanced: { attentionMs: 20000, randomSlots: false, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'archer', 'cannon'], upgradeAfterTowers: 0 },
  focused: { attentionMs: 20000, randomSlots: false, pattern: ['archer'], upgradeAfterTowers: 0 },
  /** P2: 10종을 고르게 쓰는 균형 전략(PRD §7.5 ②의 비교 대상). 지을 수 없는 종류(수호기사 2기째 등)는 건너뛴다. */
  balanced10: { attentionMs: 20000, randomSlots: false, pattern: ['archer', 'mage', 'cannon', 'spear', 'frost', 'lightning', 'archer', 'flame', 'crossbow', 'guardian', 'banner', 'cannon'], upgradeAfterTowers: 0, pick: 'round', judge: 'engine' },
};

export interface SimOptions {
  mapId: string;
  difficulty: DifficultyId;
  /** 정답 확률(0~1). */
  accuracy: number;
  /** 문항을 읽고 고르는 평균 시간(초). 실제로는 ±25% 안에서 흔들린다. */
  readSec: number;
  strategy: StrategyId;
  seed: number;
  /** 웨이브 사이 배치 시간(초). */
  buildSec?: number;
  /** 이 웨이브를 넘기면 멈춘다(무한 웨이브 상한). */
  maxWaves?: number;
  towers?: TowerId[];
  /** 조정 후보를 잴 때 쓰는 밸런스. 없으면 계약 파일 그대로. */
  balance?: Balance;
  /** 전략의 judge 대신 쓸 눈(모든 전략을 같은 눈으로 견줄 때). */
  judge?: Judge;
  /** 거래·답안 명령을 내기 직전에 부른다(가상 플레이어 추적용). */
  onCommand?: (wave: number, gold: number, cmd: Command) => void;
}

export interface SimResult {
  completedWave: number;
  endReason: 'DEFEAT' | 'WAVE_CAP';
  minutes: number;
  /** 단계별 능동 시간(분). */
  phaseMinutes: Record<Phase, number>;
  firstEvoWave: number | null;
  bossKills: number;
  bossLeaks: number;
  /** 보스가 나온 웨이브별 처치 여부. */
  bosses: Array<{ wave: number; killed: boolean }>;
  correct: number;
  wrong: number;
  /** 문항 PT ÷ (문항 PT + 처치 PT). */
  vocabPtShare: number;
  /** 정답 골드 ÷ 시작 골드를 뺀 전체 골드 유입. */
  answerGoldShare: number;
  goldEarned: number;
}

export { BALANCE, MAPS, TOWER_IDS };

const BRANCH: BranchId = 'A';
const WRONG_FEEDBACK_READ_MS = 1000;

const contexts = new WeakMap<Balance, Map<string, GameContext>>();

/** 맵만 바꾼 정규 문맥. 은행은 3학년 개발용 은행을 쓴다(문항 내용은 결과에 영향이 없다). */
export function simContext(mapId: string, difficulty: DifficultyId, balance: Balance = BALANCE): GameContext {
  let byKey = contexts.get(balance);
  if (!byKey) { byKey = new Map(); contexts.set(balance, byKey); }
  const key = `${mapId}/${difficulty}`;
  let ctx = byKey.get(key);
  if (!ctx) {
    const map = MAPS.find(m => m.id === mapId);
    const bank = gradeContent(3).bank;
    if (!map || !bank) throw new Error(`알 수 없는 맵 또는 은행: ${mapId}`);
    ctx = createContext({ balance, difficulty, map, questions: toRuntime(bank), battleReadingLoadMax: 70 });
    byKey.set(key, ctx);
  }
  return ctx;
}

/** `waves.count.step=3` 같은 경로=값 목록을 계약 밸런스 사본에 덮어쓰고 스키마로 다시 검사한다. */
export function withOverrides(sets: readonly string[]): Balance {
  const draft = structuredClone(BALANCE) as unknown as Record<string, unknown>;
  for (const set of sets) {
    const eq = set.indexOf('=');
    const keys = set.slice(0, eq).split('.');
    if (eq < 1 || keys.some(k => !k)) throw new Error(`--set 형식은 경로=값: ${set}`);
    let node = draft;
    for (const k of keys.slice(0, -1)) {
      if (typeof node[k] !== 'object' || node[k] === null) throw new Error(`없는 밸런스 경로: ${set}`);
      node = node[k] as Record<string, unknown>;
    }
    const last = keys.at(-1)!;
    if (!(last in node)) throw new Error(`없는 밸런스 경로: ${set}`);
    node[last] = JSON.parse(set.slice(eq + 1));
  }
  const parsed = balanceSchema.parse(draft);
  if (sets.length) parsed.balanceVersion = `${BALANCE.balanceVersion}+sim`;
  return parsed;
}

/** 칸 중심에서 사거리 안에 드는 경로 길이(칸). 0.1칸 간격 표본. */
function coverage(ctx: GameContext, slotId: string, range: number, cache: Map<string, number>): number {
  const key = `${slotId}:${range}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const slot = ctx.map.slots.find(x => x.id === slotId)!;
  const sx = center(slot.x), sy = center(slot.y), r2 = range * range;
  let n = 0;
  for (let p = 0; p <= ctx.path.length; p += 100) {
    const at = positionAt(ctx.path, p);
    if (dist2(at.x, at.y, sx, sy) <= r2) n++;
  }
  cache.set(key, n / 10);
  return n / 10;
}

const measured = new WeakMap<Balance, Map<string, number>>();

/**
 * 가상 플레이어가 보는 가치. 깃발은 반경 안 공격 타워 가치에 오라 비율을 곱한 합이다(towers를 넘길 때만).
 * sketch: 초당 피해 × 덮는 경로. 범위·부채꼴 ×2, 감속 +6(balance-sketch와 같은 어림). P2: 연쇄는 대상 수만큼 감쇠 합, 선분 ×1.3,
 *   화상은 초당 화상 피해를 더하고, 정예·대장 배율은 ×1.1로 어림한다. 덮는 경로에 비례해서 짧은 사거리 타워(창병·화염·수호기사)를 크게 낮춰 본다.
 * engine: 그 칸에 그 타워 하나만 두고 기본 줄(STREAMS.line)을 한 번 통과시켰을 때 제품 엔진이 준 피해(HP, 직접+화상).
 *   감속은 다른 타워의 사거리 안 체류를 늘리므로 감속 비율만큼 더 쳐 준다.
 */
function value(ctx: GameContext, judge: Judge, type: TowerId, level: number, branch: BranchId | null, slotId: string, cache: Map<string, number>, towers: readonly Tower[] = []): number {
  const b = ctx.balance;
  const slot = ctx.map.slots.find(x => x.id === slotId)!;
  if (!attacks(b, type)) {
    const aura = bannerAura(b, { type, level, branch });
    const r = b.towers[type].rangeMilli;
    return towers.filter(t => attacks(b, t.type) && dist2(t.x, t.y, center(slot.x), center(slot.y)) <= r * r)
      .reduce((sum, t) => sum + value(ctx, judge, t.type, t.level, t.branch, t.slotId, cache) * (aura.damageBP + aura.speedBP) / 10000, 0);
  }
  const st = towerStats(b, type, level, branch);
  if (judge === 'engine') {
    let byKey = measured.get(b);
    if (!byKey) { byKey = new Map(); measured.set(b, byKey); }
    const key = `${ctx.map.id}/${slotId}/${type}/${level}/${branch}`;
    let v = byKey.get(key);
    if (v === undefined) {
      v = (measure([{ type, slot: [slot.x, slot.y], level, branch }], STREAMS.line, b, ctx.map.id).damage / 1000) * (1 + st.slowBP / 10000);
      byKey.set(key, v);
    }
    return v;
  }
  const perSec = (st.damage / 1000) * (TICK_HZ / attackIntervalTicks(b, st, 0));
  let mult = st.splashRadius > 0 || st.cone ? 2 : st.lineWidth > 0 ? 1.3 : 1;
  if (st.chainRadius > 0) { mult = 0; for (let k = 0; k < st.maxTargets; k++) mult += (st.chainFalloffBP / 10000) ** k; mult = 1 + (mult - 1) * 0.5; }
  const burnPerSec = st.burnTicks > 0 ? (st.burnTotal / 1000) * (TICK_HZ / st.burnTicks) : 0;
  const base = (perSec * mult + burnPerSec) * (st.eliteBossDamageBP > 10000 ? 1.1 : 1) + (st.slowBP > 0 ? 6 : 0);
  return (base * coverage(ctx, slotId, st.range, cache)) / 4;
}

export function simulateRun(opt: SimOptions): SimResult {
  const ctx = simContext(opt.mapId, opt.difficulty, opt.balance);
  const towers = opt.towers ?? PILOT_TOWERS;
  const s = createRun(ctx, {
    runId: `s11-${opt.seed}`, playerId: 'sim', nickname: '시뮬', grade: 3, difficulty: opt.difficulty, mapId: ctx.map.id, seed: opt.seed,
    bankId: 'g3-dev', bankVersion: 'sim', contentMode: 'development', availableTowers: [...towers], rankingEligibility: 'personal', createdAt: '2026-10-28T00:00:00.000Z',
  });
  const strat = STRATEGIES[opt.strategy];
  const pattern = strat.pattern.filter(t => towers.includes(t));
  const judge = opt.judge ?? strat.judge ?? 'sketch';
  // 플레이어의 선택은 엔진 난수와 다른 흐름을 쓴다. 같은 seed면 같은 판이 나온다.
  const rng: Rng = { s: (opt.seed * 2654435761 + 0x5bd1e995) >>> 0 || 1 };
  const cache = new Map<string, number>();
  const slotOrder = ctx.map.slots.map(x => x.id).sort((a, b) => coverage(ctx, b, 2500, cache) - coverage(ctx, a, 2500, cache) || a.localeCompare(b));
  if (strat.randomSlots) shuffle(rng, slotOrder);

  const maxWaves = opt.maxWaves ?? 60;
  const attention = msToTicks(strat.attentionMs);
  const readTicks = () => Math.round(opt.readSec * TICK_HZ * (0.75 + (u32(rng) / 0x100000000) * 0.5));
  const phaseTicks: Record<Phase, number> = { PREP_QUIZ: 0, BUILD: 0, BATTLE: 0, WAVE_WRAPUP: 0, GAME_OVER: 0 };
  let firstEvoWave: number | null = null;
  const bosses: SimResult['bosses'] = [];
  let encId = -1, answerAt = 0, startAt = -1, spendAt = 0;

  const run = (cmd: Command) => {
    opt.onCommand?.(s.wave, s.gold, cmd);
    const r = applyCommand(ctx, s, cmd);
    if (!r.ok) throw new Error(`시뮬레이터 명령 거부: ${cmd.type} → ${r.error} (wave ${s.wave}, tick ${s.tick})`);
  };

  const spend = () => {
    for (;;) {
      const options: Array<{ cost: number; gain: number; cmd: Command }> = [];
      const frees = slotOrder.filter(id => !s.towers.some(t => t.slotId === id));
      const canBuild = (type: TowerId) => { const max = ctx.balance.towers[type].maxOnField; return !max || s.towers.filter(t => t.type === type).length < max; };
      if (frees.length && strat.pick === 'round') {
        // pattern에 나온 횟수 대비 지은 수가 가장 적은 종류들만 후보로 두고, 종류마다 가치가 가장 큰 빈칸을 고른다.
        const share = (type: TowerId) => s.towers.filter(t => t.type === type).length / pattern.filter(x => x === type).length;
        const kinds = [...new Set(pattern)].filter(canBuild);
        const least = Math.min(...kinds.map(share));
        for (const type of kinds.filter(k => share(k) === least)) {
          const slotId = frees.reduce((best, id) => (value(ctx, judge, type, 1, null, id, cache, s.towers) > value(ctx, judge, type, 1, null, best, cache, s.towers) ? id : best));
          options.push({ cost: buildCost(ctx.balance, type), gain: value(ctx, judge, type, 1, null, slotId, cache, s.towers), cmd: { type: 'build', slotId, tower: type } });
        }
      } else if (frees.length && pattern.length) {
        // 차례의 종류를 지을 수 없으면(동시 1기 제한) 다음 종류로 넘어간다.
        const type = Array.from({ length: pattern.length }, (_, k) => pattern[(s.towers.length + k) % pattern.length]!).find(canBuild);
        if (type) options.push({ cost: buildCost(ctx.balance, type), gain: value(ctx, judge, type, 1, null, frees[0]!, cache, s.towers), cmd: { type: 'build', slotId: frees[0]!, tower: type } });
      }
      if (s.towers.length >= strat.upgradeAfterTowers) for (const t of s.towers) {
        const cost = upgradeCost(ctx.balance, t.type, t.level);
        if (cost === null) continue;
        const branch = needsBranch(ctx.balance, t.level) ? BRANCH : undefined;
        const gain = value(ctx, judge, t.type, t.level + 1, branch ?? t.branch, t.slotId, cache, s.towers) - value(ctx, judge, t.type, t.level, t.branch, t.slotId, cache, s.towers);
        options.push({ cost, gain, cmd: branch ? { type: 'upgrade', towerId: t.id, branch } : { type: 'upgrade', towerId: t.id } });
      }
      // 가성비가 가장 좋은 것 하나를 노리고, 돈이 모자라면 모은다.
      const best = options.sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];
      if (!best || best.cost > s.gold) return;
      run(best.cmd);
      if (best.cmd.type === 'upgrade' && firstEvoWave === null && s.towers.some(t => t.branch !== null)) firstEvoWave = s.wave;
    }
  };

  while (s.phase !== 'GAME_OVER' && s.completedWave < maxWaves) {
    const enc = s.quiz.current;
    if (enc && !enc.answer) {
      if (enc.id !== encId) { encId = enc.id; answerAt = s.tick + readTicks(); }
      if (s.tick >= answerAt) {
        const q = ctx.questions.get(enc.questionId)!;
        const wrong = q.options.filter(o => o.id !== q.correctOptionId);
        const correct = u32(rng) / 0x100000000 < opt.accuracy;
        run({ type: 'answer', encounterId: enc.id, choice: correct ? q.correctOptionId : wrong[intBelow(rng, wrong.length)]!.id });
      }
    }
    const fb = s.quiz.feedback;
    if (fb && fb.autoAdvanceTick === null && fb.nextEnabledTick !== null && s.tick >= fb.nextEnabledTick + msToTicks(WRONG_FEEDBACK_READ_MS)) run({ type: 'next', encounterId: fb.encounterId });
    if (s.phase === 'BUILD') {
      if (startAt < 0) { spend(); startAt = s.tick + msToTicks((opt.buildSec ?? 8) * 1000); }
      if (s.tick >= startAt) { run({ type: 'startBattle' }); startAt = -1; spendAt = s.tick + attention; }
    } else if (s.phase === 'BATTLE' && s.tick >= spendAt) { spend(); spendAt = s.tick + attention; }
    phaseTicks[s.phase]++;
    for (const e of advanceTick(ctx, s)) if ((e.type === 'kill' || e.type === 'leak') && e.kind === 'boss') bosses.push({ wave: s.wave, killed: e.type === 'kill' });
  }

  const st = s.stats;
  const toMin = (ticks: number) => ticks / TICK_HZ / 60;
  return {
    completedWave: s.completedWave,
    endReason: s.phase === 'GAME_OVER' ? 'DEFEAT' : 'WAVE_CAP',
    minutes: toMin(st.activeTicks),
    phaseMinutes: { PREP_QUIZ: toMin(phaseTicks.PREP_QUIZ), BUILD: toMin(phaseTicks.BUILD), BATTLE: toMin(phaseTicks.BATTLE), WAVE_WRAPUP: toMin(phaseTicks.WAVE_WRAPUP), GAME_OVER: 0 },
    firstEvoWave,
    bossKills: st.bossKills,
    bossLeaks: st.bossLeaks,
    bosses,
    correct: st.correct,
    wrong: st.wrong,
    vocabPtShare: st.ptFromQuestions / Math.max(1, st.ptFromQuestions + st.ptFromKills),
    answerGoldShare: (st.correct * ctx.difficulty.correctGold) / Math.max(1, st.goldEarned),
    goldEarned: st.goldEarned,
  };
}

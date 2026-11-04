import { balanceSchema, FORM_IDS, TOWER_IDS, type Balance, type DifficultyId, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE, gradeContent, MAPS, PILOT_TOWERS, toRuntime } from '../../src/content';
import { createContext, type GameContext } from '../../src/domain/context';
import { center, dist2, positionAt } from '../../src/domain/geometry';
import { msToTicks, TICK_HZ } from '../../src/domain/num';
import { intBelow, shuffle, u32, type Rng } from '../../src/domain/rng';
import type { DomainEvent } from '../../src/domain/events';
import { advanceTick, applyCommand, createRun, type Command } from '../../src/domain/run';
import { attackIntervalTicks, attacks, bannerAura, buildCost, evolutionChoices, formTier, towerStats, upgradeCost } from '../../src/domain/towers';
import type { Phase, RunState, Tower } from '../../src/domain/types';
import { measure, STREAMS } from './towerEfficiency';

// S11 엔진 밸런스 시뮬레이터(PRD §17.3, §18.1). 판정은 제품 domain 엔진(createRun·applyCommand·advanceTick)이 하고,
// 여기서는 가상 플레이어(읽기 시간·정답률·돈 쓰는 습관)만 흉내 낸다. 학생 실측이 아니다.

export type StrategyId = 'novice' | 'balanced' | 'focused' | 'balanced10' | 'tall';

export interface Strategy {
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
  pick?: 'sequence' | 'round' | 'free';
  /** 거래 가치를 보는 눈(value 참고). 없으면 'sketch'. */
  judge?: Judge;
  /** 지금 가장 높은 타워의 강화 가치를 이만큼 곱해 본다(한 타워를 몰아 키우는 습관). 없으면 1. */
  favorTopBP?: number;
  /** 징집 카드 고르는 습관(징집이 있는 판만). 없으면 'best'. */
  draft?: DraftPolicy;
  /** false면 pattern에 없는 장착함 타워(시작 마법탑·징집 타워)를 짓지 않는다(궁수 집중형). 없으면 true. */
  useOwned?: boolean;
  /** 이 종류만 장착함에 두고 징집을 없앤다(단일 타워·조합 시험, B0). 없으면 balance의 시작 타워 + 징집. */
  fixedOwned?: TowerId[];
  /** 종류별 최대 설치 수(유틸 시너지 시험: 유틸 타워는 하나만). */
  cap?: Partial<Record<TowerId, number>>;
}

/**
 * 징집 카드 고르는 습관(towers.md §0-2). 'best'는 후보마다 가장 좋은 빈칸의 1레벨 가치/설치비가 가장 큰 것,
 * 'random'은 가상 플레이어 난수로 하나다. 고른 타워는 장착함에 들어오고 pattern 뒤에 한 번 붙어 차례대로 지어진다.
 */
export type DraftPolicy = 'best' | 'random';
export const DRAFT_POLICIES: readonly DraftPolicy[] = ['best', 'random'];

/** 'sketch'는 balance-sketch에서 이어받은 어림, 'engine'은 제품 엔진으로 잰 피해다. */
export type Judge = 'sketch' | 'engine';

/**
 * 진화 선택 규칙(progression.md §1). 'best'는 그 타워의 거래 가치(judge)가 더 큰 형태, 'A1'~'B2'는 늘 그 길(1차는 앞 글자),
 * 'random'은 seed·타워·레벨로 정한 동전 던지기다(판정 난수와 따로라 다른 선택이 문항 흐름을 바꾸지 않는다).
 */
export type FormPolicy = 'best' | 'random' | 'A1' | 'A2' | 'B1' | 'B2';
export const FORM_POLICIES: readonly FormPolicy[] = ['best', 'random', 'A1', 'A2', 'B1', 'B2'];
/** 타워마다 다른 규칙(적지 않은 타워는 'best'). 예: 'archer:B1/cannon:A1'. */
export type FormPolicies = FormPolicy | Partial<Record<TowerId, FormPolicy>>;

/** 'best' 또는 'archer:B1/cannon:A1' 꼴을 읽는다. */
export function parseFormPolicies(text: string): FormPolicies {
  if (!text.includes(':')) {
    if (!FORM_POLICIES.includes(text as FormPolicy)) throw new Error(`진화 규칙은 ${FORM_POLICIES.join('|')}: ${text}`);
    return text as FormPolicy;
  }
  return Object.fromEntries(text.split('/').map(part => {
    const [type, policy] = part.split(':') as [TowerId, FormPolicy];
    if (!TOWER_IDS.includes(type) || !FORM_POLICIES.includes(policy)) throw new Error(`타워별 진화 규칙은 타워:규칙: ${part}`);
    return [type, policy];
  }));
}

// tools/balance-sketch.mjs의 가상 플레이어를 이어받았다. 마법탑은 P1 범위 밖이라 뺐다.
export const STRATEGIES: Record<StrategyId, Strategy> = {
  novice: { attentionMs: 30000, randomSlots: true, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'archer', 'cannon'], upgradeAfterTowers: 6, draft: 'random' },
  balanced: { attentionMs: 20000, randomSlots: false, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'archer', 'cannon'], upgradeAfterTowers: 0 },
  focused: { attentionMs: 20000, randomSlots: false, pattern: ['archer'], upgradeAfterTowers: 0, useOwned: false },
  /** P2: 10종을 고르게 쓰는 균형 전략(PRD §7.5 ②의 비교 대상). 지을 수 없는 종류(수호기사 2기째 등)는 건너뛴다. */
  balanced10: { attentionMs: 20000, randomSlots: false, pattern: ['archer', 'mage', 'cannon', 'spear', 'frost', 'lightning', 'archer', 'flame', 'crossbow', 'guardian', 'banner', 'cannon'], upgradeAfterTowers: 0, pick: 'round', judge: 'engine' },
  /** 리뉴얼: 균형형처럼 짓되 가장 높은 타워를 먼저 키운다(무제한 레벨에서 한 타워가 판을 지배하지 않는지 본다). */
  tall: { attentionMs: 20000, randomSlots: false, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'archer', 'cannon'], upgradeAfterTowers: 0, favorTopBP: 40000 },
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
  /** 진화 선택 규칙. 없으면 'best'. */
  forms?: FormPolicies;
  /** 전략의 징집 습관 대신 쓸 습관. */
  draft?: DraftPolicy;
  /** 거래·답안 명령을 내기 직전에 부른다(가상 플레이어 추적용). */
  onCommand?: (wave: number, gold: number, cmd: Command) => void;
  /** 이름 붙은 전략 대신 쓸 습관(B0 봇: 단일 타워·조합 시험). */
  policy?: Strategy;
  /** 거래 두뇌를 바꾼다(상성형·최적화형). 없으면 탐욕 두뇌. */
  brain?: Brain;
  /** true면 웨이브별 성문 피해·수입·행동·타워별 피해를 기록한다(관문 보고서용). */
  telemetry?: boolean;
}

export interface SimResult {
  completedWave: number;
  endReason: 'DEFEAT' | 'WAVE_CAP';
  minutes: number;
  /** 단계별 능동 시간(분). */
  phaseMinutes: Record<Phase, number>;
  firstEvoWave: number | null;
  /** 판이 끝났을 때 가장 높은 타워 레벨. */
  maxLevel: number;
  /** 판이 끝났을 때 2차 진화 레벨(Lv7) 이상인 타워 수. */
  evolvedTwice: number;
  /** 판이 끝났을 때 형태별 타워 수. */
  formCounts: Record<FormId, number>;
  /** 판이 끝났을 때 장착함(시작 + 징집 순서). */
  owned: TowerId[];
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

export { BALANCE, MAPS, PILOT_TOWERS, TOWER_IDS };

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
export function coverage(ctx: GameContext, slotId: string, range: number, cache: Map<string, number>): number {
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
 * sketch: 초당 피해 × 덮는 경로. 범위·부채꼴·굴림체 ×2, 감속 +6(balance-sketch와 같은 어림). P2: 연쇄는 대상 수만큼 감쇠 합, 선분 ×1.3,
 *   장판은 타격 횟수 × 장판 수의 3/4(걸어 나감), 지연 폭발은 뒤따르는 한 발, 화약 술통 폭발은 2차 피해처럼 절반으로 본다.
 *   화상은 초당 화상 피해를 더하고, 정예·대장 배율은 ×1.1로 어림한다. 덮는 경로에 비례해서 짧은 사거리 타워(창병·화염·수호기사)를 크게 낮춰 본다.
 * engine: 그 칸에 그 타워 하나만 두고 기본 줄(STREAMS.line)을 한 번 통과시켰을 때 제품 엔진이 준 피해(HP, 직접+화상).
 *   감속은 다른 타워의 사거리 안 체류를 늘리므로 감속 비율만큼 더 쳐 준다.
 */
export function value(ctx: GameContext, judge: Judge, type: TowerId, level: number, form: FormId, slotId: string, cache: Map<string, number>, towers: readonly Tower[] = []): number {
  const b = ctx.balance;
  const slot = ctx.map.slots.find(x => x.id === slotId)!;
  if (!attacks(b, type)) {
    const aura = bannerAura(b, { type, level, form });
    const r = b.towers[type].rangeMilli;
    return towers.filter(t => attacks(b, t.type) && dist2(t.x, t.y, center(slot.x), center(slot.y)) <= r * r)
      .reduce((sum, t) => sum + value(ctx, judge, t.type, t.level, t.form, t.slotId, cache) * (aura.damageBP + aura.speedBP) / 10000, 0);
  }
  const st = towerStats(b, type, level, form);
  if (judge === 'engine') {
    let byKey = measured.get(b);
    if (!byKey) { byKey = new Map(); measured.set(b, byKey); }
    const key = `${ctx.map.id}/${slotId}/${type}/${level}/${form}`;
    let v = byKey.get(key);
    if (v === undefined) {
      v = (measure([{ type, slot: [slot.x, slot.y], level, form }], STREAMS.line, b, ctx.map.id).damage / 1000) * (1 + st.slowBP / 10000);
      byKey.set(key, v);
    }
    return v;
  }
  // 리뉴얼 효과 어림: 다연발·공격 주기 덧발·여러 표적은 발 수만큼, 도탄·2차 피해는 절반, 취약은 받는 피해만큼, 밀치기는 감속처럼 더한다.
  const fx = st.fx;
  const follow = (x: { count: number; followDamageBP?: number | undefined }) => ((x.count - 1) * (x.followDamageBP ?? 10000)) / 10000;
  const zone = fx.zone ? Math.ceil(msToTicks(fx.zone.durationMs) / msToTicks(fx.zone.periodMs)) * (fx.zone.count ?? 1) * 0.75 : 1;
  const shots = (1 + (fx.burst ? follow(fx.burst) : 0) + (fx.cycle?.burst ? follow(fx.cycle.burst) / fx.cycle.every : 0) + (fx.delayedBlast ? fx.delayedBlast.damageBP / 10000 : 0)) * st.volley * zone;
  const perSec = (st.damage / 1000) * (TICK_HZ / attackIntervalTicks(b, st, 0)) * shots;
  let mult = st.splashRadius > 0 || st.cone || fx.ring || fx.roller ? 2 : st.lineWidth > 0 ? 1.3 : 1;
  if (st.chainRadius > 0) { mult = 0; for (let k = 0; k < st.maxTargets; k++) mult += (st.chainFalloffBP / 10000) ** k; mult = 1 + (mult - 1) * 0.5; }
  if (fx.ricochet) { let r = 0; for (let k = 1; k <= fx.ricochet.count; k++) r += (fx.ricochet.falloffBP / 10000) ** k; mult += r * 0.5; }
  if (fx.onHitSplash) mult += (fx.onHitSplash.damageBP / 10000) * 0.5;
  if (fx.rollBlast) mult += (fx.rollBlast.damageBP / 10000) * 0.5;
  mult *= 1 + (fx.vulnBP ?? 0) / 10000 + ((fx.knockbackMilli ?? 0) / 1000) * 0.5;
  const burnPerSec = st.burnTicks > 0 ? (st.burnTotal / 1000) * (TICK_HZ / st.burnTicks) : 0;
  const base = (perSec * mult + burnPerSec) * (st.eliteBossDamageBP > 10000 ? 1.1 : 1) + (st.slowBP > 0 ? 6 : 0);
  return (base * coverage(ctx, slotId, st.range, cache)) / 4;
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// 가상 플레이어(B0): 한 틱씩 전진하는 명시적 상태 기계. 상태가 모두 데이터라서 복제해 미리 돌려 볼 수 있다(최적화형 롤아웃).
// ───────────────────────────────────────────────────────────────────────────────────────────

/** 거래 두뇌: 거래 단계·전투 중 돈을 쓸 때(spend), 징집 카드가 열렸을 때(draft), 원정 보물 창이 열렸을 때(relic, 없으면 relicGreedy). */
export interface Brain {
  spend(p: Player): void;
  draft(p: Player): void;
  relic?(p: Player): void;
}

export interface WaveRec {
  wave: number;
  /** 이 웨이브에서 성문이 잃은 체력(성문 체력 단위). 패배한 웨이브는 최대 체력 이상이다. */
  gateLoss: number;
  leaks: number;
  answerGold: number;
  killGold: number;
  bossGold: number;
  milestoneGold: number;
  auraGold: number;
  startTick: number;
  endTick: number | null;
  completed: boolean;
  /** 이 웨이브 끝에 가장 높은 타워 레벨과 Lv7 이상 타워 수. */
  maxLevel: number;
  lv7: number;
  towers: number;
}

export interface ActionRec { wave: number; type: 'build' | 'upgrade' | 'sell' | 'draft'; tower: TowerId; level?: number; form?: FormId; cost: number; offers?: TowerId[] }

export interface Telemetry {
  waves: WaveRec[];
  actions: ActionRec[];
  /** 타워 종류별로 준 총 피해(직접 + 화상 출처, milli-HP). */
  damage: Partial<Record<TowerId, number>>;
  /** 20웨이브를 막 지켰을 때 타워(종류·레벨·형태). 그 웨이브까지 못 갔으면 null. */
  snap20: Array<{ type: TowerId; level: number; form: FormId }> | null;
  /** 징집 후보가 열린 기록. */
  offers: Array<{ wave: number; offers: TowerId[] }>;
  /** 원정 보물 후보가 열린 기록과 가진 보물(R4 B3). auto는 고르지 않아 다음 보물 웨이브에 첫 후보로 정해진 것. */
  relicOffers: Array<{ wave: number; offers: string[] }>;
  relicPicks: Array<{ relic: string; auto: boolean; wave: number }>;
}

export interface Player {
  ctx: GameContext;
  s: RunState;
  opt: SimOptions;
  strat: Strategy;
  brain: Brain;
  judge: Judge;
  draftPolicy: DraftPolicy;
  /** 가상 플레이어 난수(엔진 난수와 따로). */
  rng: Rng;
  /** 사거리 덮개 표본 기억(복제본끼리 함께 쓴다). */
  cache: Map<string, number>;
  slotOrder: string[];
  attention: number;
  maxWaves: number;
  encId: number;
  answerAt: number;
  startAt: number;
  spendAt: number;
  phaseTicks: Record<Phase, number>;
  firstEvoWave: number | null;
  bosses: Array<{ wave: number; killed: boolean }>;
  tel: Telemetry | null;
}

export interface Option { cost: number; gain: number; cmd: Command; type: TowerId; form?: FormId }

export function createPlayer(opt: SimOptions): Player {
  const ctx = simContext(opt.mapId, opt.difficulty, opt.balance);
  const strat = opt.policy ?? STRATEGIES[opt.strategy];
  const towers = strat.fixedOwned ?? opt.towers ?? PILOT_TOWERS;
  const s = createRun(ctx, {
    runId: `s11-${opt.seed}`, playerId: 'sim', nickname: '시뮬', grade: 3, difficulty: opt.difficulty, mapId: ctx.map.id, seed: opt.seed,
    bankId: 'g3-dev', bankVersion: 'sim', contentMode: 'development', availableTowers: [...towers], rankingEligibility: 'personal', createdAt: '2026-10-28T00:00:00.000Z',
  });
  if (strat.fixedOwned) s.owned = [...strat.fixedOwned];
  // 플레이어의 선택은 엔진 난수와 다른 흐름을 쓴다. 같은 seed면 같은 판이 나온다.
  const rng: Rng = { s: (opt.seed * 2654435761 + 0x5bd1e995) >>> 0 || 1 };
  const cache = new Map<string, number>();
  const slotOrder = ctx.map.slots.map(x => x.id).sort((a, b) => coverage(ctx, b, 2500, cache) - coverage(ctx, a, 2500, cache) || a.localeCompare(b));
  if (strat.randomSlots) shuffle(rng, slotOrder);
  return {
    ctx, s, opt, strat, brain: opt.brain ?? GREEDY,
    judge: opt.judge ?? strat.judge ?? 'sketch',
    draftPolicy: opt.draft ?? strat.draft ?? 'best',
    rng, cache, slotOrder,
    attention: msToTicks(strat.attentionMs),
    maxWaves: opt.maxWaves ?? 60,
    encId: -1, answerAt: 0, startAt: -1, spendAt: 0,
    phaseTicks: { PREP_QUIZ: 0, BUILD: 0, BATTLE: 0, WAVE_WRAPUP: 0, GAME_OVER: 0 },
    firstEvoWave: null, bosses: [],
    tel: opt.telemetry ? { waves: [], actions: [], damage: {}, snap20: null, offers: [], relicOffers: [], relicPicks: [] } : null,
  };
}

/** 미리 돌려 볼 사본. 기록은 끄고 두뇌를 바꿔 끼운다. 사거리 덮개 기억은 함께 쓴다. */
export function clonePlayer(p: Player, brain: Brain, strat: Strategy = p.strat): Player {
  const { onCommand: _hook, ...opt } = p.opt;
  void _hook;
  return { ...p, opt, strat, s: structuredClone(p.s), rng: { ...p.rng }, phaseTicks: { ...p.phaseTicks }, bosses: [], brain, tel: null };
}

export const playerDone = (p: Player) => p.s.phase === 'GAME_OVER' || p.s.completedWave >= p.maxWaves;

/** 명령 하나를 낸다. 거부되면 시뮬레이터 오류로 던진다. 기록·첫 진화 웨이브는 여기서 센다. */
export function runCmd(p: Player, cmd: Command) {
  const { s, ctx } = p;
  p.opt.onCommand?.(s.wave, s.gold, cmd);
  const before = cmd.type === 'upgrade' ? s.towers.find(t => t.id === cmd.towerId) : cmd.type === 'sell' ? s.towers.find(t => t.id === cmd.towerId) : undefined;
  const level = before?.level ?? 0;
  const goldBefore = s.gold;
  const r = applyCommand(ctx, s, cmd);
  if (!r.ok) throw new Error(`시뮬레이터 명령 거부: ${cmd.type} → ${r.error} (wave ${s.wave}, tick ${s.tick})`);
  if (cmd.type === 'upgrade' && p.firstEvoWave === null && s.towers.some(t => t.form !== 'base')) p.firstEvoWave = s.wave;
  if (p.tel) {
    // 답안 보상 같은 명령 사건(answered)도 센다. 틱 사건(처치·누출·피해)은 stepPlayer가 센다.
    record(p, r.events, null);
    if (cmd.type === 'build') p.tel.actions.push({ wave: s.wave, type: 'build', tower: cmd.tower, cost: goldBefore - s.gold });
    else if (cmd.type === 'upgrade' && before) p.tel.actions.push({ wave: s.wave, type: 'upgrade', tower: before.type, level: level + 1, ...(cmd.form ? { form: cmd.form } : {}), cost: goldBefore - s.gold });
    else if (cmd.type === 'sell' && before) p.tel.actions.push({ wave: s.wave, type: 'sell', tower: before.type, level, cost: goldBefore - s.gold });
    else if (cmd.type === 'draftPick') p.tel.actions.push({ wave: s.wave, type: 'draft', tower: cmd.tower, cost: 0 });
  }
}

const canBuildType = (p: Player, type: TowerId) => {
  const max = p.ctx.balance.towers[type].maxOnField;
  const n = p.s.towers.filter(t => t.type === type).length;
  if (max && n >= max) return false;
  const cap = p.strat.cap?.[type];
  return cap === undefined || n < cap;
};

/** 장착함 타워 가운데 pattern 차례대로. pattern에 없는 장착함 타워는 뒤에 한 번씩 붙인다(useOwned). */
export const patternOf = (p: Player): TowerId[] =>
  [...p.strat.pattern.filter(t => p.s.owned.includes(t)), ...(p.strat.useOwned === false ? [] : p.s.owned.filter(t => !p.strat.pattern.includes(t)))];

export const freeSlots = (p: Player) => p.slotOrder.filter(id => !p.s.towers.some(t => t.slotId === id));

/** 진화 선택(progression.md §1): 'best'는 거래 가치가 큰 형태. */
export function chooseForm(p: Player, t: Tower, choices: FormId[]): FormId {
  const { ctx, s } = p;
  const policy = ((): FormPolicy => (typeof p.opt.forms === 'object' ? p.opt.forms[t.type] : p.opt.forms) ?? 'best')();
  if (policy === 'best') return choices.reduce((best, f) => (value(ctx, p.judge, t.type, t.level + 1, f, t.slotId, p.cache, s.towers) > value(ctx, p.judge, t.type, t.level + 1, best, t.slotId, p.cache, s.towers) ? f : best));
  if (policy === 'random') return choices[(Math.imul(p.opt.seed, 0x9e3779b1) ^ Math.imul(t.id, 0x85ebca6b) ^ t.level) & 1]!;
  // 고정 길: 1차는 앞 글자(A·B), 2차는 그 형태. 이미 다른 길이면 그 길의 같은 번호를 고른다.
  return formTier(choices[0]!) === 1 ? (policy[0] as FormId) : choices.find(f => f === policy) ?? choices[Number(policy[1]) - 1]!;
}

/** 지금 살 수 있는 거래 후보(설치·강화)와 가치. 가성비(gain/cost)가 가장 큰 것을 노리는 탐욕 규칙의 재료다. */
export function greedyOptions(p: Player, fit?: (type: TowerId) => number): Option[] {
  const { ctx, s, strat } = p;
  const pattern = patternOf(p);
  const weigh = (type: TowerId) => fit?.(type) ?? 1;
  const options: Option[] = [];
  const frees = freeSlots(p);
  if (frees.length && (strat.pick === 'round' || strat.pick === 'free')) {
    // round: pattern에 나온 횟수 대비 지은 수가 가장 적은 종류들만 후보로 두고, 종류마다 가치가 가장 큰 빈칸을 고른다.
    // free: 장착함의 모든 종류가 후보다(상성형이 가치에 가중을 곱해 고른다).
    const share = (type: TowerId) => s.towers.filter(t => t.type === type).length / pattern.filter(x => x === type).length;
    const kinds = [...new Set(pattern)].filter(k => canBuildType(p, k));
    const least = Math.min(...kinds.map(share));
    for (const type of kinds.filter(k => strat.pick === 'free' || share(k) === least)) {
      const slotId = frees.reduce((best, id) => (value(ctx, p.judge, type, 1, 'base', id, p.cache, s.towers) > value(ctx, p.judge, type, 1, 'base', best, p.cache, s.towers) ? id : best));
      options.push({ cost: buildCost(ctx.balance, type), gain: weigh(type) * value(ctx, p.judge, type, 1, 'base', slotId, p.cache, s.towers), cmd: { type: 'build', slotId, tower: type }, type });
    }
  } else if (frees.length && pattern.length) {
    // 차례의 종류를 지을 수 없으면(동시 1기 제한) 다음 종류로 넘어간다.
    const type = Array.from({ length: pattern.length }, (_, k) => pattern[(s.towers.length + k) % pattern.length]!).find(k => canBuildType(p, k));
    if (type) options.push({ cost: buildCost(ctx.balance, type), gain: weigh(type) * value(ctx, p.judge, type, 1, 'base', frees[0]!, p.cache, s.towers), cmd: { type: 'build', slotId: frees[0]!, tower: type }, type });
  }
  const top = s.towers.reduce<Tower | null>((best, t) => (!best || t.level > best.level ? t : best), null);
  if (s.towers.length >= strat.upgradeAfterTowers) for (const t of s.towers) {
    const cost = upgradeCost(ctx.balance, t.type, t.level);
    if (cost === null) continue;
    const choices = evolutionChoices(ctx.balance, t);
    const form = choices ? chooseForm(p, t, choices) : undefined;
    const favor = t === top ? (strat.favorTopBP ?? 10000) / 10000 : 1;
    const gain = weigh(t.type) * favor * (value(ctx, p.judge, t.type, t.level + 1, form ?? t.form, t.slotId, p.cache, s.towers) - value(ctx, p.judge, t.type, t.level, t.form, t.slotId, p.cache, s.towers));
    options.push({ cost, gain, cmd: form ? { type: 'upgrade', towerId: t.id, form } : { type: 'upgrade', towerId: t.id }, type: t.type, ...(form ? { form } : {}) });
  }
  return options;
}

/** 가성비가 가장 좋은 것 하나(없으면 undefined). 같으면 앞 후보. */
export const bestOption = (options: Option[]): Option | undefined => [...options].sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];

/** 탐욕 규칙: 가성비가 가장 좋은 것을 사고, 돈이 모자라면 모은다. */
export function spendGreedy(p: Player, fit?: (type: TowerId) => number) {
  for (;;) {
    const best = bestOption(greedyOptions(p, fit));
    if (!best || best.cost > p.s.gold) return;
    runCmd(p, best.cmd);
  }
}

/** 징집 카드가 열리면 바로 고른다(화면의 큰 카드 3장). */
export function draftGreedy(p: Player, fit?: (type: TowerId) => number) {
  const { ctx, s } = p;
  const offer = s.draft;
  if (!offer) return;
  const free = freeSlots(p);
  const slots = free.length ? free : p.slotOrder;
  const worth = (type: TowerId) => (fit?.(type) ?? 1) * Math.max(...slots.map(id => value(ctx, p.judge, type, 1, 'base', id, p.cache, s.towers))) / buildCost(ctx.balance, type);
  const tower = p.draftPolicy === 'random' ? offer.offers[intBelow(p.rng, offer.offers.length)]! : offer.offers.reduce((best, t) => (worth(t) > worth(best) ? t : best));
  runCmd(p, { type: 'draftPick', tower });
}

/**
 * 균형형·상성형·초보형의 원정 보물 고르기(R4 B3): 정해 둔 순서에서 가장 앞선 후보(초보형처럼 징집을 무작위로 고르는 습관이면 무작위).
 * 순서는 "곧바로 힘이 되는 것 → 경제 → 특정 타워에 기대는 것"이다. 최적화형은 미리 돌려 고른다(bots.ts).
 */
export const RELIC_PRIORITY: readonly string[] = [
  'hero_blade', 'big_blast', 'wise_book', 'arrow_range', 'evolve_stone', 'sky_net', 'ember_charm', 'frost_bead', 'lucky_pouch', 'quick_spring', 'tall_pole', 'trade_seal',
];
export function relicGreedy(p: Player) {
  const offer = p.s.relicOffer;
  if (!offer) return;
  const rank = (id: string) => { const i = RELIC_PRIORITY.indexOf(id); return i < 0 ? RELIC_PRIORITY.length : i; };
  const relic = p.draftPolicy === 'random' ? offer.offers[intBelow(p.rng, offer.offers.length)]! : offer.offers.reduce((best, id) => (rank(id) < rank(best) ? id : best));
  runCmd(p, { type: 'relicPick', relic });
}

export const GREEDY: Brain = { spend: p => spendGreedy(p), draft: p => draftGreedy(p), relic: p => relicGreedy(p) };

const WAVE_FIELDS = (wave: number, tick: number): WaveRec => ({ wave, gateLoss: 0, leaks: 0, answerGold: 0, killGold: 0, bossGold: 0, milestoneGold: 0, auraGold: 0, startTick: tick, endTick: null, completed: false, maxLevel: 0, lv7: 0, towers: 0 });

/** 화상 피해를 낸 출처(타워 종류). 다음 틱에 화상이 터질 적만 미리 읽는다. */
function burnOwners(s: RunState): Map<number, TowerId> {
  const out = new Map<number, TowerId>();
  for (const e of s.enemies) {
    if (!e.alive || e.burnNextTick === null || s.tick + 1 < e.burnNextTick || e.burns.length === 0) continue;
    const top = e.burns.reduce((a, b) => (b.total > a.total || (b.total === a.total && b.source < a.source) ? b : a));
    const owner = s.towers.find(t => t.id === top.source);
    if (owner) out.set(e.id, owner.type);
  }
  return out;
}

function record(p: Player, events: DomainEvent[], burners: Map<number, TowerId> | null) {
  const tel = p.tel!;
  const { s } = p;
  const rec = (w: number) => (tel.waves[w - 1] ??= WAVE_FIELDS(w, w === 1 ? 0 : s.tick));
  for (const e of events) {
    switch (e.type) {
      case 'phase': rec(e.wave); break;
      case 'answered': rec(s.wave).answerGold += e.gold; break;
      case 'kill': if (e.kind === 'boss') rec(s.wave).bossGold += e.gold; else rec(s.wave).killGold += e.gold; break;
      case 'leak': { const r = rec(s.wave); r.gateLoss += e.damage; r.leaks++; break; }
      case 'auraGold': rec(s.wave).auraGold += e.gold; break;
      case 'draftOffered': tel.offers.push({ wave: e.wave, offers: [...e.offers] }); break;
      case 'relicOffered': tel.relicOffers.push({ wave: e.wave, offers: [...e.offers] }); break;
      case 'relicPicked': tel.relicPicks.push({ relic: e.relic, auto: e.auto, wave: s.wave }); if (e.gold) rec(s.wave).milestoneGold += e.gold; break;
      case 'hit': tel.damage[e.towerType] = (tel.damage[e.towerType] ?? 0) + e.damage; break;
      case 'burn': { const owner = burners?.get(e.enemyId); if (owner) tel.damage[owner] = (tel.damage[owner] ?? 0) + e.damage; break; }
      case 'waveComplete': {
        const r = rec(e.wave);
        r.completed = true; r.endTick = s.tick; r.milestoneGold += e.milestoneGold;
        r.maxLevel = Math.max(0, ...s.towers.map(t => t.level));
        r.lv7 = s.towers.filter(t => t.level >= p.ctx.balance.levels.evolveAt[1]).length;
        r.towers = s.towers.length;
        if (e.wave === 20) tel.snap20 = s.towers.map(t => ({ type: t.type, level: t.level, form: t.form }));
        break;
      }
      default: break;
    }
  }
}

/** 틱 하나: 가상 플레이어가 답하고 돈을 쓰고, 엔진이 한 틱 전진한다. */
export function stepPlayer(p: Player): DomainEvent[] {
  const { s, ctx, opt } = p;
  const enc = s.quiz.current;
  if (enc && !enc.answer) {
    if (enc.id !== p.encId) { p.encId = enc.id; p.answerAt = s.tick + Math.round(opt.readSec * TICK_HZ * (0.75 + (u32(p.rng) / 0x100000000) * 0.5)); }
    if (s.tick >= p.answerAt) {
      const q = ctx.questions.get(enc.questionId)!;
      const wrong = q.options.filter(o => o.id !== q.correctOptionId);
      const correct = u32(p.rng) / 0x100000000 < opt.accuracy;
      runCmd(p, { type: 'answer', encounterId: enc.id, choice: correct ? q.correctOptionId : wrong[intBelow(p.rng, wrong.length)]!.id });
    }
  }
  const fb = s.quiz.feedback;
  if (fb && fb.autoAdvanceTick === null && fb.nextEnabledTick !== null && s.tick >= fb.nextEnabledTick + msToTicks(WRONG_FEEDBACK_READ_MS)) runCmd(p, { type: 'next', encounterId: fb.encounterId });
  if (s.phase === 'BUILD') {
    if (p.startAt < 0) { p.brain.spend(p); p.startAt = s.tick + msToTicks((opt.buildSec ?? 8) * 1000); }
    if (s.tick >= p.startAt) { runCmd(p, { type: 'startBattle' }); p.startAt = -1; p.spendAt = s.tick + p.attention; }
  } else if (s.phase === 'BATTLE' && s.tick >= p.spendAt) { p.brain.spend(p); p.spendAt = s.tick + p.attention; }
  if (s.draft) p.brain.draft(p);
  if (s.relicOffer) (p.brain.relic ?? relicGreedy)(p);
  p.phaseTicks[s.phase]++;
  const burners = p.tel && s.phase === 'BATTLE' ? burnOwners(s) : null;
  const events = advanceTick(ctx, s);
  for (const e of events) if ((e.type === 'kill' || e.type === 'leak') && e.kind === 'boss') p.bosses.push({ wave: s.wave, killed: e.type === 'kill' });
  if (p.tel) record(p, events, burners);
  return events;
}

export function finishPlayer(p: Player): SimResult {
  const { s, ctx } = p;
  const st = s.stats;
  const toMin = (ticks: number) => ticks / TICK_HZ / 60;
  const pt = p.phaseTicks;
  return {
    completedWave: s.completedWave,
    endReason: s.phase === 'GAME_OVER' ? 'DEFEAT' : 'WAVE_CAP',
    minutes: toMin(st.activeTicks),
    phaseMinutes: { PREP_QUIZ: toMin(pt.PREP_QUIZ), BUILD: toMin(pt.BUILD), BATTLE: toMin(pt.BATTLE), WAVE_WRAPUP: toMin(pt.WAVE_WRAPUP), GAME_OVER: 0 },
    firstEvoWave: p.firstEvoWave,
    maxLevel: Math.max(0, ...s.towers.map(t => t.level)),
    evolvedTwice: s.towers.filter(t => t.level >= ctx.balance.levels.evolveAt[1]).length,
    formCounts: Object.fromEntries(FORM_IDS.map(f => [f, s.towers.filter(t => t.form === f).length])) as Record<FormId, number>,
    owned: [...s.owned],
    bossKills: st.bossKills,
    bossLeaks: st.bossLeaks,
    bosses: p.bosses,
    correct: st.correct,
    wrong: st.wrong,
    vocabPtShare: st.ptFromQuestions / Math.max(1, st.ptFromQuestions + st.ptFromKills),
    answerGoldShare: (st.correct * ctx.difficulty.correctGold) / Math.max(1, st.goldEarned),
    goldEarned: st.goldEarned,
  };
}

export function simulateRun(opt: SimOptions): SimResult {
  const p = createPlayer(opt);
  while (!playerDone(p)) stepPlayer(p);
  return finishPlayer(p);
}

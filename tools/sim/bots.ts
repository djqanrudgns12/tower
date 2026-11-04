import { TOWER_IDS, type Balance, type DifficultyId, type EnemyKind, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import { msToTicks, TICK_HZ } from '../../src/domain/num';
import { buildCost, evolutionChoices, sellRefund, upgradeCost } from '../../src/domain/towers';
import type { Command } from '../../src/domain/run';
import { composeWave } from '../../src/domain/waves';
import type { Tower } from '../../src/domain/types';
import {
  bestOption, clonePlayer, createPlayer, draftGreedy, finishPlayer, freeSlots, greedyOptions, playerDone, runCmd, spendGreedy, stepPlayer, STRATEGIES, value,
  GREEDY, type Brain, type Option, type Player, type SimOptions, type Strategy,
} from './balanceSim';
import { measure, ROLE_STREAMS, ROLES, STREAMS, referenceSlot, type Role } from './towerEfficiency';

// B0 가상 플레이어(PRD §7.3): 초보형·균형형·상성형·최적화형·단일 타워·조합. 판정은 제품 engine이 하고 여기서는 돈 쓰는 습관만 흉내 낸다.
// 모두 seed로 결정적이다(같은 seed·같은 설정이면 같은 판). 학생 실측이 아니다.

export const NUMERIC_LIMIT = 'NumericLimitError';

/** 핵심 4종 조합(유틸 시너지 시험의 기준 조합): 궁수·석궁·포탑·마법. */
export const CORE4: readonly TowerId[] = ['archer', 'crossbow', 'cannon', 'mage'];

export type BotName = 'novice' | 'balanced' | 'focused' | 'counter' | 'optimizer' | 'core4' | `mono-${TowerId}` | `core4+${TowerId}`;

export interface BotTuning {
  /** 최적화형: 결정마다 미리 돌려 볼 후보 수 상한. */
  K: number;
  /** 최적화형: 미리 돌릴 웨이브 수. */
  horizon: number;
  /**
   * 최적화형: 웨이브 하나에서 미리 돌려 볼 틱 수 상한. 다 쓰면 그 웨이브의 남은 결정은 균형형 선택(후보 맨 앞)을 따른다.
   * 시계가 아니라 틱 수라서 결과가 seed로 결정적이고, 깊은 웨이브까지 가는 판이 있어도 한 판의 시간이 웨이브 수에 비례해서만 늘어난다.
   */
  waveTickBudget: number;
}
export const FAST_TUNING: BotTuning = { K: 6, horizon: 2, waveTickBudget: 140_000 };
export const FULL_TUNING: BotTuning = { K: 10, horizon: 2, waveTickBudget: 400_000 };

const ENGINE_BALANCED: Strategy = STRATEGIES.balanced10;

/** 봇 이름에서 습관(Strategy)을 만든다. 상성형·최적화형은 두뇌를 따로 쓴다(botBrain). */
export function botPolicy(bot: BotName): Strategy {
  if (bot === 'novice') return STRATEGIES.novice;
  if (bot === 'focused') return STRATEGIES.focused;
  if (bot === 'balanced' || bot === 'optimizer') return ENGINE_BALANCED;
  if (bot === 'counter') return { ...ENGINE_BALANCED, pattern: [...TOWER_IDS], pick: 'free' };
  if (bot === 'core4') return { ...ENGINE_BALANCED, pattern: [...CORE4], fixedOwned: [...CORE4], useOwned: false };
  if (bot.startsWith('core4+')) {
    const u = bot.slice(6) as TowerId;
    if (!TOWER_IDS.includes(u)) throw new Error(`알 수 없는 유틸 타워: ${bot}`);
    return { ...ENGINE_BALANCED, pattern: [...CORE4, u], fixedOwned: [...CORE4, u], useOwned: false, cap: { [u]: 1 } };
  }
  if (bot.startsWith('mono-')) {
    const t = bot.slice(5) as TowerId;
    if (!TOWER_IDS.includes(t)) throw new Error(`알 수 없는 타워: ${bot}`);
    // 칸은 그 타워 하나를 놓았을 때 피해가 가장 큰 빈칸(round)이다. 사거리가 짧은 타워가 경로에서 먼 칸에 놓이지 않게 한다.
    return { attentionMs: 20000, randomSlots: false, pattern: [t], upgradeAfterTowers: 0, useOwned: false, judge: 'engine', pick: 'round', fixedOwned: [t] };
  }
  throw new Error(`알 수 없는 봇: ${bot}`);
}

// ── 상성형 ─────────────────────────────────────────────────────────────────────────────────

type PerRole = Record<Role, number>;
const perRoleCache = new WeakMap<Balance, Map<TowerId, PerRole>>();

/** 타워 하나가 역할 9종 줄에서 100골드당 내는 피해(정원 맵 기준 칸). 상성형이 쓰는 표다. */
export function perRoleDamage(balance: Balance, tower: TowerId): PerRole {
  let byTower = perRoleCache.get(balance);
  if (!byTower) { byTower = new Map(); perRoleCache.set(balance, byTower); }
  let row = byTower.get(tower);
  if (!row) {
    const slot = referenceSlot('garden_u', balance);
    row = Object.fromEntries(ROLES.map(r => {
      if (balance.towers[tower].damageType === 'none') return [r, 0];
      const m = measure([{ type: tower, slot }], STREAMS[ROLE_STREAMS[r]], balance);
      return [r, (m.damage / m.gold) * 100 / 1000];
    })) as PerRole;
    byTower.set(tower, row);
  }
  return row;
}

/** 웨이브 편성의 역할별 체력 가중 비율(미리보기 화면이 보여 주는 정보: 역할 수·대장 유무). */
export function waveMix(balance: Balance, mapId: string, wave: number): PerRole {
  const list = composeWave(balance, mapId, wave, { s: 1 });
  const mix = Object.fromEntries(ROLES.map(r => [r, 0])) as PerRole;
  for (const e of list) {
    const role = e.kind as EnemyKind;
    if (role in mix) mix[role as Role] += balance.enemies[role].hpBP / 10000;
  }
  return mix;
}

/** 다음에 오는 웨이브 구성에 맞춘 타워 종류별 가치 배율(1이면 기본 줄과 같다). */
function mixFit(p: Player, weights: Array<[number, number]>): (type: TowerId) => number {
  const b = p.ctx.balance;
  const mix = Object.fromEntries(ROLES.map(r => [r, 0])) as PerRole;
  for (const [wave, w] of weights) { const m = waveMix(b, p.ctx.map.id, wave); for (const r of ROLES) mix[r] += m[r] * w; }
  const total = ROLES.reduce((a, r) => a + mix[r], 0) || 1;
  return type => {
    if (b.towers[type].damageType === 'none') return 1;
    const row = perRoleDamage(b, type);
    if (row.walker <= 0) return 1;
    const fit = ROLES.reduce((a, r) => a + mix[r] * row[r], 0) / total / row.walker;
    // 같은 종류를 이미 많이 지었으면 조금씩 덜 끌린다(한 종류로 쏠리지 않게).
    const have = p.s.towers.filter(t => t.type === type).length;
    return Math.min(4, Math.max(0.1, fit)) * 0.88 ** have;
  };
}

function buildFit(p: Player): (type: TowerId) => number {
  const s = p.s;
  // 거래 단계에는 곧 싸울 웨이브를, 전투 중에는 다음 웨이브를 더 본다.
  return s.phase === 'BATTLE' ? mixFit(p, [[s.wave + 1, 1], [s.wave, 0.3]]) : mixFit(p, [[s.wave, 1], [s.wave + 1, 0.5]]);
}

export const COUNTER: Brain = {
  spend: p => spendGreedy(p, buildFit(p)),
  draft: p => {
    const s = p.s;
    const next = s.phase === 'WAVE_WRAPUP' ? s.wave + 1 : s.wave;
    draftGreedy(p, mixFit(p, [[next, 1], [next + 1, 0.7], [next + 2, 0.5]]));
  },
};

// ── 최적화형 ───────────────────────────────────────────────────────────────────────────────

interface Cand { cmds: Command[]; cost: number; label: string; wait?: boolean }

const WAIT: Cand = { cmds: [], cost: 0, label: 'wait', wait: true };

/** 진단용 계수: 미리 돌려 본 횟수와 그 틱 수. */
export const rolloutStats = { rollouts: 0, ticks: 0 };

interface RolloutScore { score: number; gateLoss: number; exposure: number; gold: number; defeated: boolean; ticks: number }

/** 후보 행동을 낸 사본을 horizon 웨이브 끝까지 탐욕 규칙으로 돌려 본 점수(클수록 좋다). 성문 피해 > 적이 깊이 들어온 정도 > 남은 골드. */
export function rollout(p: Player, cmds: Command[], horizon: number): RolloutScore {
  const q = clonePlayer(p, GREEDY, ENGINE_BALANCED_FOR(p));
  const { s } = q;
  for (const c of cmds) runCmd(q, c);
  const target = s.completedWave + horizon;
  const len = q.ctx.path.length;
  let leak = 0, exposure = 0, ticks = 0;
  rolloutStats.rollouts++;
  while (s.phase !== 'GAME_OVER' && s.completedWave < target) {
    rolloutStats.ticks++; ticks++;
    for (const e of stepPlayer(q)) if (e.type === 'leak') leak += e.damage;
    if (s.phase === 'BATTLE') for (const e of s.enemies) if (e.alive) { const f = e.progress / len; exposure += f * f; }
  }
  const defeated = s.phase === 'GAME_OVER';
  const gateLoss = leak / s.gateMaxHp;
  const score = -1000 * gateLoss - exposure / TICK_HZ + 0.02 * s.gold - (defeated ? 5000 + 1000 * (target - s.completedWave) : 0);
  return { score, gateLoss, exposure: exposure / TICK_HZ, gold: s.gold, defeated, ticks };
}

/** 미리 돌릴 때 이어받는 기본 습관: 균형형(고정 장착함·상한은 원래 판의 것을 따른다). */
function ENGINE_BALANCED_FOR(p: Player): Strategy {
  return { ...ENGINE_BALANCED, ...(p.strat.fixedOwned ? { fixedOwned: p.strat.fixedOwned } : {}), ...(p.strat.cap ? { cap: p.strat.cap } : {}) };
}

function candidates(p: Player, K: number): Cand[] {
  const { ctx, s } = p;
  const b = ctx.balance;
  const baseline = { ...p, strat: ENGINE_BALANCED_FOR(p) };
  const out: Cand[] = [];
  const seen = new Set<string>();
  const add = (c: Cand) => { const key = c.cmds.map(x => JSON.stringify(x)).join('+') || 'wait'; if (!seen.has(key)) { seen.add(key); out.push(c); } };
  const label = (o: Option) => (o.cmd.type === 'build' ? `build:${o.type}` : `up:${o.type}${o.form ? `:${o.form}` : ''}`);

  // 1) 균형형이 지금 고를 거래(없거나 돈이 모자라면 ‘모으기’): 최적화형이 균형형보다 나쁘지 않게 하는 닻.
  const greedy = bestOption(greedyOptions(baseline));
  if (greedy && greedy.cost <= s.gold) add({ cmds: [greedy.cmd], cost: greedy.cost, label: `greedy:${label(greedy)}` });
  else if (greedy) add(WAIT);

  // 2) 설치: 장착함의 종류마다 가장 좋은 빈칸. 아직 한 기도 안 지은 종류를 먼저 본다(유틸·새 징집이 후보에서 빠지지 않게).
  const frees = freeSlots(p);
  const canBuild = (type: TowerId) => {
    const max = b.towers[type].maxOnField;
    return !(max && s.towers.filter(t => t.type === type).length >= max) && (p.strat.cap?.[type] === undefined || s.towers.filter(t => t.type === type).length < p.strat.cap[type]!);
  };
  const builds: Option[] = [];
  if (frees.length) for (const type of s.owned) {
    if (!canBuild(type)) continue;
    const slotId = frees.reduce((best, id) => (value(ctx, 'engine', type, 1, 'base', id, p.cache, s.towers) > value(ctx, 'engine', type, 1, 'base', best, p.cache, s.towers) ? id : best));
    builds.push({ cost: buildCost(b, type), gain: value(ctx, 'engine', type, 1, 'base', slotId, p.cache, s.towers), cmd: { type: 'build', slotId, tower: type }, type });
  }
  const have = (type: TowerId) => s.towers.some(t => t.type === type);
  builds.sort((x, y) => Number(have(x.type)) - Number(have(y.type)) || y.gain / y.cost - x.gain / x.cost);

  // 3) 강화: 진화 레벨이면 두 갈래를 모두 후보로(갈래 선택도 미리 돌려 정한다).
  const upgrades: Option[] = [];
  for (const t of s.towers) {
    const cost = upgradeCost(b, t.type, t.level);
    if (cost === null) continue;
    const choices = evolutionChoices(b, t);
    for (const form of choices ?? [undefined]) {
      const gain = value(ctx, 'engine', t.type, t.level + 1, form ?? t.form, t.slotId, p.cache, s.towers) - value(ctx, 'engine', t.type, t.level, t.form, t.slotId, p.cache, s.towers);
      upgrades.push({ cost, gain, cmd: form ? { type: 'upgrade', towerId: t.id, form } : { type: 'upgrade', towerId: t.id }, type: t.type, ...(form ? { form } : {}) });
    }
  }
  upgrades.sort((x, y) => y.gain / y.cost - x.gain / x.cost);

  const affordable = (o: Option) => o.cost <= s.gold;
  // 강화 상위 하나(진화면 두 갈래 모두), 설치 상위들, 다음 강화 순으로 채운다.
  const topUp = upgrades.filter(affordable)[0];
  if (topUp) for (const o of upgrades.filter(x => affordable(x) && x.cmd.type === 'upgrade' && topUp.cmd.type === 'upgrade' && x.cmd.towerId === topUp.cmd.towerId)) add({ cmds: [o.cmd], cost: o.cost, label: label(o) });
  for (const o of builds.filter(affordable)) { if (out.length >= K) break; add({ cmds: [o.cmd], cost: o.cost, label: label(o) }); }
  for (const o of upgrades.filter(affordable)) { if (out.length >= K) break; add({ cmds: [o.cmd], cost: o.cost, label: label(o) }); }

  // 4) 칸이 다 찼으면 가장 약한 타워를 팔고 그 자리에 가장 좋은 종류를 짓는다(판매·재배치).
  if (frees.length === 0 && s.towers.length > 0) {
    const weakest = s.towers.reduce<Tower>((w, t) => (value(ctx, 'engine', t.type, t.level, t.form, t.slotId, p.cache, s.towers) / t.invested < value(ctx, 'engine', w.type, w.level, w.form, w.slotId, p.cache, s.towers) / w.invested ? t : w), s.towers[0]!);
    const refund = sellRefund(b, weakest);
    const pick = s.owned.filter(canBuild).map(type => ({ type, gain: value(ctx, 'engine', type, 1, 'base', weakest.slotId, p.cache, s.towers), cost: buildCost(b, type) }))
      .filter(x => x.cost <= s.gold + refund).sort((x, y) => y.gain / y.cost - x.gain / x.cost)[0];
    if (pick && pick.gain / pick.cost > (value(ctx, 'engine', weakest.type, weakest.level, weakest.form, weakest.slotId, p.cache, s.towers) / weakest.invested) * 1.5) {
      add({ cmds: [{ type: 'sell', towerId: weakest.id }, { type: 'build', slotId: weakest.slotId, tower: pick.type }], cost: pick.cost - refund, label: `replace:${weakest.type}->${pick.type}` });
    }
  }
  return out.slice(0, Math.max(K, 1) + 2);
}

/** 후보를 모두 미리 돌려 가장 좋은 것을 고른다. 같은 점수면 앞 후보(균형형의 선택)를 따른다. 쓴 틱 수는 onTicks로 알린다. */
function choose(p: Player, cands: Cand[], horizon: number, onTicks: (n: number) => void): Cand {
  if (cands.length === 1) return cands[0]!;
  let best = cands[0]!, bestScore = -Infinity;
  for (const c of cands) {
    const r = rollout(p, c.cmds, horizon);
    onTicks(r.ticks);
    if (r.score > bestScore + 1e-9) { best = c; bestScore = r.score; }
  }
  return best;
}

export function optimizerBrain(tuning: BotTuning): Brain {
  // 웨이브마다 미리 돌려 본 틱 수(예산). 판마다 두뇌를 새로 만든다.
  let budgetWave = -1, used = 0;
  const pick = (p: Player, cands: Cand[], horizon: number): Cand => {
    if (p.s.wave !== budgetWave) { budgetWave = p.s.wave; used = 0; }
    if (used >= tuning.waveTickBudget) return cands[0]!;
    return choose(p, cands, horizon, n => { used += n; });
  };
  return {
    spend(p) {
      for (let guard = 0; guard < 16; guard++) {
        const cands = candidates(p, tuning.K);
        if (!cands.length) return;
        const chosen = pick(p, cands, tuning.horizon);
        if (chosen.wait) return;
        for (const c of chosen.cmds) runCmd(p, c);
      }
    },
    draft(p) {
      const offer = p.s.draft;
      if (!offer) return;
      const cands: Cand[] = offer.offers.map(tower => ({ cmds: [{ type: 'draftPick', tower } as Command], cost: 0, label: `draft:${tower}` }));
      const chosen = pick(p, cands, tuning.horizon + 1);
      for (const c of chosen.cmds) runCmd(p, c);
    },
  };
}

export function botBrain(bot: BotName, tuning: BotTuning = FAST_TUNING): Brain {
  if (bot === 'counter') return COUNTER;
  if (bot === 'optimizer') return optimizerBrain(tuning);
  return GREEDY;
}

// ── 한 판 요약 ─────────────────────────────────────────────────────────────────────────────

export interface RunSpec {
  bot: BotName;
  map: string;
  difficulty: DifficultyId;
  acc: number;
  seed: number;
  maxWaves?: number;
  tuning?: BotTuning;
  balance?: Balance;
  readSec?: number;
}

/** 웨이브 기록 한 줄: [성문피해(체력), 새는 적, 정답골드, 처치골드, 보스골드, 보물·생존골드, 오라골드, 걸린 분, 끝냈나(0/1), 최고레벨, Lv7이상 수, 타워 수]. */
export type WaveRow = [number, number, number, number, number, number, number, number, number, number, number, number];

export interface RunSummary {
  bot: BotName;
  map: string;
  difficulty: DifficultyId;
  acc: number;
  seed: number;
  completedWave: number;
  endReason: 'DEFEAT' | 'WAVE_CAP';
  minutes: number;
  gateMax: number;
  waves: WaveRow[];
  bosses: Array<[number, number]>;
  firstEvoWave: number | null;
  snap20: Array<[TowerId, number, FormId]> | null;
  finalTowers: Array<[TowerId, number, FormId]>;
  /** 설치 횟수(종류별), 강화 기록(종류, 도달 레벨, 형태), 징집(후보, 고른 것). */
  builds: Partial<Record<TowerId, number>>;
  upgrades: Array<[TowerId, number, FormId | null]>;
  drafts: Array<{ wave: number; offers: TowerId[]; picked: TowerId | null }>;
  sells: number;
  damage: Partial<Record<TowerId, number>>;
  correct: number;
  wrong: number;
  ms: number;
  engineError?: string;
}

export function toSimOptions(spec: RunSpec): SimOptions {
  return {
    mapId: spec.map, difficulty: spec.difficulty, accuracy: spec.acc, readSec: spec.readSec ?? 12, strategy: 'balanced10', seed: spec.seed,
    maxWaves: spec.maxWaves ?? 40, policy: botPolicy(spec.bot), brain: botBrain(spec.bot, spec.tuning), telemetry: true,
    ...(spec.balance ? { balance: spec.balance } : {}),
  };
}

export function runBot(spec: RunSpec): RunSummary {
  const t0 = performance.now();
  const p = createPlayer(toSimOptions(spec));
  let engineError: string | undefined;
  try {
    while (!playerDone(p)) stepPlayer(p);
  } catch (e) {
    // 엔진의 수치 한계(NUMERIC_LIMIT)는 제품에서는 ‘수치 복구 정지’다. 시뮬레이터는 그 판을 제외 표시하고 계속한다.
    if (e instanceof Error && e.name === NUMERIC_LIMIT) engineError = e.message;
    else throw e;
  }
  const r = finishPlayer(p);
  const tel = p.tel!;
  // 웨이브 길이는 준비 문제가 시작될 때부터 다음 웨이브의 준비 문제가 시작될 때까지(전투 뒤 마무리 문항 포함)다.
  const waves: WaveRow[] = tel.waves.map((w, i) => [
    w.gateLoss, w.leaks, w.answerGold, w.killGold, w.bossGold, w.milestoneGold, w.auraGold,
    ((tel.waves[i + 1]?.startTick ?? p.s.tick) - w.startTick) / TICK_HZ / 60, w.completed ? 1 : 0, w.maxLevel, w.lv7, w.towers,
  ]);
  const builds: Partial<Record<TowerId, number>> = {};
  const upgrades: RunSummary['upgrades'] = [];
  let sells = 0;
  for (const a of tel.actions) {
    if (a.type === 'build') builds[a.tower] = (builds[a.tower] ?? 0) + 1;
    else if (a.type === 'upgrade') upgrades.push([a.tower, a.level ?? 0, a.form ?? null]);
    else if (a.type === 'sell') sells++;
  }
  const picks = tel.actions.filter(a => a.type === 'draft');
  const drafts = tel.offers.map((o, i) => ({ wave: o.wave, offers: o.offers, picked: picks[i]?.tower ?? null }));
  return {
    bot: spec.bot, map: spec.map, difficulty: spec.difficulty, acc: spec.acc, seed: spec.seed,
    completedWave: r.completedWave, endReason: r.endReason, minutes: r.minutes, gateMax: p.s.gateMaxHp,
    waves, bosses: r.bosses.map(b => [b.wave, b.killed ? 1 : 0]), firstEvoWave: r.firstEvoWave,
    snap20: tel.snap20 ? tel.snap20.map(t => [t.type, t.level, t.form]) : null,
    finalTowers: p.s.towers.map(t => [t.type, t.level, t.form]),
    builds, upgrades, drafts, sells, damage: tel.damage, correct: r.correct, wrong: r.wrong, ms: Math.round(performance.now() - t0),
    ...(engineError ? { engineError } : {}),
  };
}

export { BALANCE, msToTicks };

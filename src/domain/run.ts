import type { BranchId, TowerId } from '../contracts/balance';
import type { OptionId } from '../contracts/questions';
import { battleTick, towerSpeedBonusBP } from './combat';
import type { GameContext } from './context';
import type { DomainEvent } from './events';
import { center } from './geometry';
import { add, msToTicks } from './num';
import { createEncounter } from './quiz';
import { RNG_ALGORITHM, streamSeed } from './rng';
import { attackIntervalTicks, attacks, buildCost, needsBranch, sellRefund, towerStats, upgradeCost } from './towers';
import { RULES_VERSION, RUN_STATE_VERSION, type PauseReason, type RunConfig, type RunState } from './types';
import { composeWave, hpBaseMilli, isMilestone, spawnIntervalTicks } from './waves';

export type Command =
  | { type: 'answer'; encounterId: number; choice: OptionId }
  | { type: 'skip'; encounterId: number }
  | { type: 'next'; encounterId: number }
  | { type: 'build'; slotId: string; tower: TowerId }
  | { type: 'upgrade'; towerId: number; branch?: BranchId }
  | { type: 'sell'; towerId: number }
  | { type: 'startBattle' }
  | { type: 'pause'; reason: PauseReason }
  | { type: 'resume'; reason: PauseReason }
  | { type: 'quit' };

export type CommandError =
  | 'PAUSED' | 'WRONG_PHASE' | 'STALE_ENCOUNTER' | 'ALREADY_ANSWERED' | 'NEXT_NOT_READY' | 'NOT_ENOUGH_GOLD'
  | 'SLOT_TAKEN' | 'UNKNOWN_SLOT' | 'UNKNOWN_TOWER' | 'MAX_LEVEL' | 'BRANCH_REQUIRED' | 'TOWER_LIMIT' | 'GAME_OVER' | 'NOT_AVAILABLE'
  | 'NUMERIC_LIMIT';

export type CommandResult = { ok: true; events: DomainEvent[] } | { ok: false; error: CommandError };

export type NewRunInput = Omit<RunConfig, 'rngAlgorithm' | 'rulesVersion' | 'balanceVersion' | 'mapVersion'>;

export function createRun(ctx: GameContext, input: NewRunInput): RunState {
  const config: RunConfig = { ...input, rngAlgorithm: RNG_ALGORITHM, rulesVersion: RULES_VERSION, balanceVersion: ctx.balance.balanceVersion, mapVersion: ctx.map.mapVersion };
  const seed = config.seed >>> 0;
  const s: RunState = {
    v: RUN_STATE_VERSION, config, phase: 'PREP_QUIZ', pause: [], tick: 0, wave: 0, completedWave: 0, endedAtWave: null, endReason: null,
    gateHp: ctx.difficulty.gateHp, gateMaxHp: ctx.difficulty.gateHp, gold: ctx.balance.run.startGold, pt: 0, waveKillPtGranted: 0, burningUntilTick: -1,
    rng: { battle: streamSeed(seed, 'battle'), question: streamSeed(seed, 'question'), option: streamSeed(seed, 'option') },
    seq: { command: 0, enemy: 1, tower: 1, projectile: 1 },
    quiz: { queue: [], cursor: 0, cycle: 0, recentQuestions: [], recentSenses: [], current: null, feedback: null, prepTarget: 0, prepDone: 0, battleStreak: 0, nextEncounterId: 1, history: [] },
    towers: [], enemies: [], projectiles: [], battle: null,
    stats: { correct: 0, wrong: 0, skipped: 0, kills: 0, bossKills: 0, bossLeaks: 0, leaks: 0, goldEarned: 0, ptFromQuestions: 0, ptFromKills: 0, activeTicks: 0, battleTicks: 0 },
    milestoneRewardedWaves: [],
  };
  enterPrep(ctx, s, 1, []);
  return s;
}

function enterPrep(ctx: GameContext, s: RunState, wave: number, ev: DomainEvent[]) {
  s.phase = 'PREP_QUIZ';
  s.wave = wave;
  s.waveKillPtGranted = 0;
  s.quiz.prepTarget = wave === 1 ? ctx.balance.run.prepAttempts.firstWave : ctx.balance.run.prepAttempts.laterWaves;
  s.quiz.prepDone = 0;
  s.quiz.feedback = null;
  s.quiz.current = createEncounter(ctx, s, 'prep');
  ev.push({ type: 'phase', phase: s.phase, wave }, { type: 'encounter', encounterId: s.quiz.current.id });
}

const tradingPhase = (s: RunState) => s.phase === 'BUILD' || s.phase === 'BATTLE';

export function applyCommand(ctx: GameContext, s: RunState, cmd: Command): CommandResult {
  if (s.phase === 'GAME_OVER' && cmd.type !== 'pause' && cmd.type !== 'resume') return { ok: false, error: 'GAME_OVER' };
  if (cmd.type === 'pause') {
    if (!s.pause.includes(cmd.reason)) s.pause.push(cmd.reason);
    return { ok: true, events: [] };
  }
  if (cmd.type === 'resume') {
    s.pause = s.pause.filter(r => r !== cmd.reason);
    return { ok: true, events: [] };
  }
  // 정지 중에는 답안·거래를 받지 않는다. 밀린 입력을 재개 뒤 자동 실행하지 않는다(PRD §3.6, §20.3).
  if (s.pause.length > 0) return { ok: false, error: 'PAUSED' };
  const ev: DomainEvent[] = [];
  const result = (() => {
    switch (cmd.type) {
      case 'answer': return answer(ctx, s, cmd.encounterId, cmd.choice, ev);
      case 'skip': return answer(ctx, s, cmd.encounterId, 'skipped', ev);
      case 'next': return next(s, cmd.encounterId);
      case 'build': return build(ctx, s, cmd.slotId, cmd.tower, ev);
      case 'upgrade': return upgrade(ctx, s, cmd.towerId, cmd.branch, ev);
      case 'sell': return sell(ctx, s, cmd.towerId, ev);
      case 'startBattle': return startBattle(ctx, s, ev);
      case 'quit': return quit(s, ev);
    }
  })();
  if (result) return { ok: false, error: result };
  s.seq.command++;
  return { ok: true, events: ev };
}

function answer(ctx: GameContext, s: RunState, encounterId: number, choice: OptionId | 'skipped', ev: DomainEvent[]): CommandError | null {
  if (s.phase !== 'PREP_QUIZ' && s.phase !== 'BATTLE' && s.phase !== 'WAVE_WRAPUP') return 'WRONG_PHASE';
  const enc = s.quiz.current;
  if (!enc || enc.id !== encounterId) return 'STALE_ENCOUNTER';
  if (enc.answer) return 'ALREADY_ANSWERED';
  const q = ctx.questions.get(enc.questionId);
  // 손상·철회된 문항은 채점하지 않고 바꾼다(PRD §3.5, §9.5, A26).
  if (!q || q.revision !== enc.revision) {
    replaceCurrent(ctx, s, ev);
    return null;
  }
  const d = ctx.difficulty;
  const result = choice === 'skipped' ? 'skipped' : choice === q.correctOptionId ? 'correct' : 'wrong';
  const pt = result === 'correct' ? d.correctPt : result === 'wrong' ? d.wrongPt : d.skipPt;
  const gold = result === 'correct' ? d.correctGold : 0;
  // 합계를 모두 계산한 뒤 반영한다. 하나라도 안전 범위를 넘으면 아무것도 바꾸지 않고 던진다(PRD §3.4(2), §8.6).
  const totals = { pt: add(s.pt, pt, 'pt'), gold: add(s.gold, gold, 'gold'), ptFromQuestions: add(s.stats.ptFromQuestions, pt), goldEarned: add(s.stats.goldEarned, gold) };
  enc.answer = { choice, tick: s.tick, correct: result === 'correct', pt, gold };
  s.pt = totals.pt;
  s.gold = totals.gold;
  s.stats.ptFromQuestions = totals.ptFromQuestions;
  s.stats.goldEarned = totals.goldEarned;
  if (result === 'correct') s.stats.correct++;
  else if (result === 'wrong') s.stats.wrong++;
  else s.stats.skipped++;
  s.quiz.history.push(structuredClone(enc));
  if (s.phase === 'PREP_QUIZ') s.quiz.prepDone++;
  // 버닝은 전투 문항만 충전한다. 준비·마무리 문항은 충전하지 않는다(PRD §5).
  if (s.phase === 'BATTLE' && !enc.wrapup) {
    if (result === 'correct') {
      s.quiz.battleStreak++;
      if (s.quiz.battleStreak % ctx.balance.burning.streak === 0) {
        s.burningUntilTick = s.tick + msToTicks(ctx.balance.burning.durationMs);
        ev.push({ type: 'burning', untilTick: s.burningUntilTick });
      }
    } else s.quiz.battleStreak = 0;
  }
  s.quiz.feedback = result === 'correct'
    ? { encounterId, result, autoAdvanceTick: s.tick + msToTicks(ctx.balance.run.correctFeedbackMs), nextEnabledTick: null }
    : { encounterId, result, autoAdvanceTick: null, nextEnabledTick: s.tick + msToTicks(ctx.balance.run.wrongFeedbackMinMs) };
  ev.push({ type: 'answered', encounterId, result, pt, gold });
  return null;
}

function next(s: RunState, encounterId: number): CommandError | null {
  const fb = s.quiz.feedback;
  if (!fb || fb.encounterId !== encounterId) return 'STALE_ENCOUNTER';
  if (fb.nextEnabledTick === null || s.tick < fb.nextEnabledTick) return 'NEXT_NOT_READY';
  // 다음 문항 전환은 그 틱의 처치·누출·완료 판정 뒤에 한다(PRD §3.4(8)). 정답의 자동 전환과 같은 자리에서 처리된다.
  fb.autoAdvanceTick = s.tick;
  return null;
}

/**
 * 현재 문항을 쓸 수 없을 때(손상·철회) 무벌점·무보상으로 바꾼다(PRD §9.5).
 * 준비는 시도 수를 늘리지 않고 교체, 전투도 교체, 마무리는 취소하고 새 문항 없이 다음 준비로 간다.
 */
function replaceCurrent(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  s.quiz.feedback = null;
  if (s.phase === 'WAVE_WRAPUP') {
    s.quiz.current = null;
    enterPrep(ctx, s, s.wave + 1, ev);
    return;
  }
  s.quiz.current = createEncounter(ctx, s, s.phase === 'PREP_QUIZ' ? 'prep' : 'battle');
  ev.push({ type: 'encounter', encounterId: s.quiz.current.id });
}

/** 이어하기·철회 목록 적용 뒤 화면에 걸린 미제출 문항이 사라졌으면 바꾼다. 답한 문항은 소급 변경하지 않는다. */
export function replaceUnavailableQuestion(ctx: GameContext, s: RunState): DomainEvent[] {
  const enc = s.quiz.current;
  if (!enc || enc.answer || s.phase === 'GAME_OVER') return [];
  const q = ctx.questions.get(enc.questionId);
  if (q && q.revision === enc.revision) return [];
  const ev: DomainEvent[] = [];
  replaceCurrent(ctx, s, ev);
  return ev;
}

/** 피드백이 끝난 뒤 다음 단계. 전투가 끝난 뒤에는 새 전투 문항을 만들지 않는다(PRD §3.5). */
function advanceQuestion(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  s.quiz.feedback = null;
  if (s.phase === 'PREP_QUIZ') {
    if (s.quiz.prepDone >= s.quiz.prepTarget) {
      s.quiz.current = null;
      s.phase = 'BUILD';
      ev.push({ type: 'phase', phase: 'BUILD', wave: s.wave });
    } else {
      s.quiz.current = createEncounter(ctx, s, 'prep');
      ev.push({ type: 'encounter', encounterId: s.quiz.current.id });
    }
  } else if (s.phase === 'BATTLE') {
    s.quiz.current = createEncounter(ctx, s, 'battle');
    ev.push({ type: 'encounter', encounterId: s.quiz.current.id });
  } else if (s.phase === 'WAVE_WRAPUP') {
    s.quiz.current = null;
    enterPrep(ctx, s, s.wave + 1, ev);
  }
}

function build(ctx: GameContext, s: RunState, slotId: string, type: TowerId, ev: DomainEvent[]): CommandError | null {
  if (!tradingPhase(s)) return 'WRONG_PHASE';
  const slot = ctx.map.slots.find(x => x.id === slotId);
  if (!slot) return 'UNKNOWN_SLOT';
  if (s.towers.some(t => t.slotId === slotId)) return 'SLOT_TAKEN';
  const cfg = ctx.balance.towers[type];
  if (!s.config.availableTowers.includes(type)) return 'NOT_AVAILABLE';
  if (cfg.maxOnField && s.towers.filter(t => t.type === type).length >= cfg.maxOnField) return 'TOWER_LIMIT';
  const cost = buildCost(ctx.balance, type);
  if (s.gold < cost) return 'NOT_ENOUGH_GOLD';
  s.gold -= cost;
  const tower = { id: s.seq.tower++, type, slotId, x: center(slot.x), y: center(slot.y), level: 1, branch: null, invested: cost, nextAttackTick: null as number | null };
  s.towers.push(tower);
  // 전투 중 구매는 구매 시점부터 공격 간격 하나를 기다린다(PRD §7.2). 깃발처럼 공격하지 않는 타워는 공격 예약이 없다.
  if (s.phase === 'BATTLE' && attacks(ctx.balance, type)) tower.nextAttackTick = s.tick + attackIntervalTicks(ctx.balance, towerStats(ctx.balance, type, 1, null), towerSpeedBonusBP(ctx, s, tower));
  ev.push({ type: 'towerBuilt', towerId: tower.id, slotId, gold: -cost });
  return null;
}

function upgrade(ctx: GameContext, s: RunState, towerId: number, branch: BranchId | undefined, ev: DomainEvent[]): CommandError | null {
  if (!tradingPhase(s)) return 'WRONG_PHASE';
  const tower = s.towers.find(t => t.id === towerId);
  if (!tower) return 'UNKNOWN_TOWER';
  const cost = upgradeCost(ctx.balance, tower.type, tower.level);
  if (cost === null) return 'MAX_LEVEL';
  const choosing = needsBranch(ctx.balance, tower.level);
  if (choosing && (!branch || !ctx.balance.branches[tower.type]?.[branch])) return 'BRANCH_REQUIRED';
  if (s.gold < cost) return 'NOT_ENOUGH_GOLD';
  const invested = add(tower.invested, cost, 'invested');
  s.gold -= cost;
  tower.invested = invested;
  tower.level++;
  if (choosing && branch) tower.branch = branch;
  // 이미 예약된 다음 공격 시각은 바꾸지 않는다(PRD §7.2).
  ev.push({ type: 'towerUpgraded', towerId, slotId: tower.slotId, gold: -cost });
  return null;
}

function sell(ctx: GameContext, s: RunState, towerId: number, ev: DomainEvent[]): CommandError | null {
  if (!tradingPhase(s)) return 'WRONG_PHASE';
  const index = s.towers.findIndex(t => t.id === towerId);
  if (index < 0) return 'UNKNOWN_TOWER';
  const tower = s.towers[index]!;
  const refund = sellRefund(ctx.balance, tower);
  const gold = add(s.gold, refund, 'gold');
  s.towers.splice(index, 1);
  s.gold = gold;
  ev.push({ type: 'towerSold', towerId, slotId: tower.slotId, gold: refund });
  return null;
}

function startBattle(ctx: GameContext, s: RunState, ev: DomainEvent[]): CommandError | null {
  if (s.phase !== 'BUILD') return 'WRONG_PHASE';
  const b = ctx.balance;
  const rng = { s: s.rng.battle };
  const spawnList = composeWave(b, s.wave, rng);
  s.rng.battle = rng.s;
  s.battle = { spawnList, spawnIndex: 0, nextSpawnTick: s.tick + 1, intervalTicks: spawnIntervalTicks(b, s.wave), hpBaseMilli: hpBaseMilli(b, s.wave), startedTick: s.tick };
  // 시작 때 버닝은 없고(0), 깃발 B의 속도 보너스는 바로 적용한다.
  for (const t of s.towers) t.nextAttackTick = attacks(b, t.type) ? s.tick + attackIntervalTicks(b, towerStats(b, t.type, t.level, t.branch), towerSpeedBonusBP(ctx, s, t)) : null;
  s.phase = 'BATTLE';
  s.quiz.battleStreak = 0;
  s.quiz.current = createEncounter(ctx, s, 'battle');
  ev.push({ type: 'phase', phase: 'BATTLE', wave: s.wave }, { type: 'encounter', encounterId: s.quiz.current.id });
  return null;
}

function quit(s: RunState, ev: DomainEvent[]): CommandError | null {
  endRun(s, 'QUIT', ev);
  return null;
}

function endRun(s: RunState, reason: 'DEFEAT' | 'QUIT', ev: DomainEvent[]) {
  s.phase = 'GAME_OVER';
  s.endReason = reason;
  s.endedAtWave = s.wave;
  // 미제출 문항은 무보상·무벌점으로 취소한다(PRD §2.2, §3.5).
  if (s.quiz.current && !s.quiz.current.answer) s.quiz.current = null;
  s.quiz.feedback = null;
  s.projectiles = [];
  // 패배·종료 때도 버닝과 전투 연속 카운트를 초기화한다(PRD §5).
  s.burningUntilTick = -1;
  s.quiz.battleStreak = 0;
  ev.push({ type: 'gameOver', completedWave: s.completedWave, endedAtWave: s.wave, reason }, { type: 'phase', phase: 'GAME_OVER', wave: s.wave });
}

function completeWave(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  const b = ctx.balance;
  s.completedWave = s.wave;
  s.gateHp = s.gateMaxHp;
  s.burningUntilTick = -1;
  s.quiz.battleStreak = 0;
  s.projectiles = [];
  s.enemies = [];
  s.battle = null;
  for (const t of s.towers) t.nextAttackTick = null;
  let milestoneGold = 0;
  if (isMilestone(b, s.wave) && !s.milestoneRewardedWaves.includes(s.wave)) {
    milestoneGold = ctx.difficulty.milestoneSurvivalGold;
    s.gold = add(s.gold, milestoneGold, 'gold');
    s.stats.goldEarned = add(s.stats.goldEarned, milestoneGold);
    s.milestoneRewardedWaves.push(s.wave);
  }
  ev.push({ type: 'waveComplete', wave: s.wave, milestoneGold });
  const current = s.quiz.current;
  if (current) {
    if (!current.answer) current.wrapup = true;
    s.phase = 'WAVE_WRAPUP';
    ev.push({ type: 'phase', phase: 'WAVE_WRAPUP', wave: s.wave });
  } else enterPrep(ctx, s, s.wave + 1, ev);
}

/** 논리 틱 하나. 정지 중에는 아무것도 하지 않는다. */
export function advanceTick(ctx: GameContext, s: RunState): DomainEvent[] {
  if (s.pause.length > 0 || s.phase === 'GAME_OVER') return [];
  const ev: DomainEvent[] = [];
  // 상태를 바꾸기 전에 검사한다. 넘치면 tick을 그대로 둔 채 던지고, 컨트롤러가 수치 복구 정지로 바꾼다(PRD §8.6).
  const tick = add(s.tick, 1, 'tick');
  const activeTicks = add(s.stats.activeTicks, 1, 'activeTicks');
  s.tick = tick;
  s.stats.activeTicks = activeTicks;
  if (s.phase === 'BATTLE') {
    s.stats.battleTicks++;
    battleTick(ctx, s, ev);
    const battle = s.battle!;
    // 성문 0 패배가 생존 완료보다 먼저다(PRD §3.3).
    if (s.gateHp <= 0) endRun(s, 'DEFEAT', ev);
    else if (battle.spawnIndex >= battle.spawnList.length && s.enemies.length === 0) completeWave(ctx, s, ev);
  }
  const fb = s.quiz.feedback;
  if (fb && fb.autoAdvanceTick !== null && s.tick >= fb.autoAdvanceTick && (s.phase as string) !== 'GAME_OVER') advanceQuestion(ctx, s, ev);
  return ev;
}

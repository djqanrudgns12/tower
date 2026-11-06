import type { FormId, TowerId } from '../contracts/balance';
import type { OptionId } from '../contracts/questions';
import { battleTick, towerSpeedBonusBP } from './combat';
import type { GameContext } from './context';
import type { DomainEvent } from './events';
import { openDraft, pickDraft, startingOwned } from './draft';
import { center } from './geometry';
import { removeTowerHazards, settleHazardsAtWaveEnd } from './hazards';
import { add, msToTicks, mulDivFloor } from './num';
import { createEncounter, MAX_REVIEW_SENSES, QuestionPoolExhaustedError } from './quiz';
import { openRelicOffer, pickRelic, relicContext } from './relics';
import { RNG_ALGORITHM, streamSeed } from './rng';
import { attackIntervalTicks, attacks, buildCost, evolutionChoices, sellRefund, towerStats, upgradeCost } from './towers';
import { RULES_VERSION, RUN_STATE_VERSION, type PauseReason, type ReviewSense, type RunConfig, type RunEndReason, type RunState, type Tower } from './types';
import { composeWave, isMilestone, spawnIntervalTicks, waveHpBaseMilli } from './waves';

export type Command =
  | { type: 'answer'; encounterId: number; choice: OptionId }
  | { type: 'skip'; encounterId: number }
  | { type: 'next'; encounterId: number }
  | { type: 'build'; slotId: string; tower: TowerId }
  /** 진화 레벨(Lv3→4, Lv6→7)이면 form 필수, 아니면 보내지 않는다(progression.md §5). */
  | { type: 'upgrade'; towerId: number; form?: FormId }
  | { type: 'sell'; towerId: number }
  /** 설치 직후 전액 환불: 설치 뒤 run.undoBuildMs 안, 그 타워를 강화하거나 공격·오라에 쓰기 전에만. */
  | { type: 'undoBuild'; towerId: number }
  /** 징집 후보 가운데 하나를 장착함에 넣는다(towers.md §0-2). 판이 끝나기 전 어느 단계에서나. */
  | { type: 'draftPick'; tower: TowerId }
  /** 원정 보물 후보 가운데 하나를 갖는다(prd-r4 §7.2-F, R4 B3). 판이 끝나기 전 어느 단계에서나. */
  | { type: 'relicPick'; relic: string }
  | { type: 'startBattle' }
  | { type: 'pause'; reason: PauseReason }
  | { type: 'resume'; reason: PauseReason }
  | { type: 'quit' };

export type CommandError =
  | 'PAUSED' | 'WRONG_PHASE' | 'STALE_ENCOUNTER' | 'ALREADY_ANSWERED' | 'NEXT_NOT_READY' | 'NOT_ENOUGH_GOLD'
  | 'SLOT_TAKEN' | 'UNKNOWN_SLOT' | 'UNKNOWN_TOWER' | 'MAX_LEVEL' | 'FORM_REQUIRED' | 'INVALID_FORM' | 'UNDO_EXPIRED' | 'TOWER_LIMIT'
  | 'GAME_OVER' | 'NOT_AVAILABLE' | 'NOT_OWNED' | 'NO_DRAFT' | 'INVALID_DRAFT' | 'NO_RELIC_OFFER' | 'INVALID_RELIC' | 'NUMERIC_LIMIT';

export type CommandResult = { ok: true; events: DomainEvent[] } | { ok: false; error: CommandError };

export type NewRunInput = Omit<RunConfig, 'rngAlgorithm' | 'rulesVersion' | 'balanceVersion' | 'mapVersion'> & {
  /**
   * 판 밖 자료: 이 기기 오답 노트에서 고른 낱말 뜻(R4 L, prd-r4 §6.1). 판 시작 때 한 번 복사하며 판 안에서는 이 복사본만 본다.
   * 생략하면 복습 단계 없이 예전과 같은 출제다. 최대 12뜻, 같은 뜻은 한 번만 쓴다.
   */
  reviewSenses?: readonly ReviewSense[];
  previousQuestionIds?: readonly string[];
};

/** 판에 복사할 오답 노트 뜻: 중복 제거, 앞에서부터 12개, 깊은 복사. */
function copyReviewSenses(input: readonly ReviewSense[] | undefined): ReviewSense[] {
  const seen = new Set<string>();
  const out: ReviewSense[] = [];
  for (const sense of input ?? []) {
    if (seen.has(sense.senseKey) || out.length >= MAX_REVIEW_SENSES) continue;
    seen.add(sense.senseKey);
    out.push({ senseKey: sense.senseKey, lemma: sense.lemma, questionIds: [...sense.questionIds], misses: sense.misses, lastSeenAt: sense.lastSeenAt });
  }
  return out;
}

/**
 * 정답 1회 골드(prd-r4 §7.2 B): correctGold + floor(correctGoldPerWaveBP × (웨이브 − 1) / 10000). 웨이브는 문항이 나온 웨이브
 * (준비 문항은 그 웨이브, 마무리 문항은 막 지킨 웨이브)다. 오답·'모르겠어요'는 0골드 그대로다(확정).
 */
export function correctGoldAt(d: GameContext['difficulty'], wave: number): number {
  const perWave = d.correctGoldPerWaveBP ?? 0;
  return perWave === 0 ? d.correctGold : add(d.correctGold, mulDivFloor(perWave, Math.max(0, wave - 1), 10000, 'correctGold'), 'correctGold');
}

/**
 * 연속 정답 보너스(balance run.answerStreakBonus, R4 B3): 이번 정답까지 이어진 정답이 streak개면 min(maxGold, goldPerStreak × (streak − 1)).
 * 규칙이 없으면 0이다.
 */
export function streakBonusGold(b: GameContext['balance'], streak: number): number {
  const rule = b.run.answerStreakBonus;
  if (!rule || streak <= 1) return 0;
  return Math.min(rule.maxGold, mulDivFloor(rule.goldPerStreak, streak - 1, 1, 'streakBonus'));
}

/**
 * 다음 정답 한 번의 골드(화면의 "정답 +N"): 보물을 적용한 문맥의 정답 골드(웨이브 성장 포함) + 연속 정답 보너스.
 * 엔진 채점(answer)과 같은 식이다.
 */
export function nextCorrectGold(ctx: GameContext, s: Pick<RunState, 'relics' | 'wave' | 'quiz'>): number {
  const c = relicContext(ctx, s);
  return add(correctGoldAt(c.difficulty, Math.max(1, s.wave)), streakBonusGold(c.balance, (s.quiz.answerStreak ?? 0) + 1), 'correctGold');
}

export function createRun(ctx: GameContext, input: NewRunInput): RunState {
  const { reviewSenses, previousQuestionIds, ...rest } = input;
  const config: RunConfig = { ...rest, rngAlgorithm: RNG_ALGORITHM, rulesVersion: RULES_VERSION, balanceVersion: ctx.balance.balanceVersion, mapVersion: ctx.map.mapVersion };
  const seed = config.seed >>> 0;
  const s: RunState = {
    v: RUN_STATE_VERSION, config, phase: 'PREP_QUIZ', pause: [], tick: 0, wave: 0, completedWave: 0, endedAtWave: null, endReason: null,
    gateHp: ctx.difficulty.gateHp, gateMaxHp: ctx.difficulty.gateHp, gold: ctx.balance.run.startGold, pt: 0, waveKillPtGranted: 0, burningUntilTick: -1,
    rng: { battle: streamSeed(seed, 'battle'), question: streamSeed(seed, 'question'), option: streamSeed(seed, 'option'), draft: streamSeed(seed, 'draft') },
    seq: { command: 0, enemy: 1, tower: 1, projectile: 1, hazard: 1 },
    quiz: { presented: [], previousQuestionIds: [...new Set(previousQuestionIds ?? [])].sort(), queue: [], cursor: 0, cycle: 0, recentQuestions: [], recentSenses: [], current: null, feedback: null, prepTarget: 0, prepDone: 0, battleStreak: 0, nextEncounterId: 1, history: [], reviewSenses: copyReviewSenses(reviewSenses), reviewUsed: {} },
    owned: startingOwned(ctx.balance, config), draft: null,
    towers: [], enemies: [], projectiles: [], hazards: [], battle: null,
    stats: { correct: 0, wrong: 0, skipped: 0, kills: 0, bossKills: 0, bossLeaks: 0, leaks: 0, goldEarned: 0, ptFromQuestions: 0, ptFromKills: 0, activeTicks: 0, battleTicks: 0 },
    milestoneRewardedWaves: [],
  };
  enterPrep(ctx, s, 1, []);
  return s;
}

function openQuestion(ctx: GameContext, s: RunState, phase: 'prep' | 'battle', ev: DomainEvent[]): boolean {
  try { s.quiz.current = createEncounter(ctx, s, phase); return true; }
  catch (error) {
    if (!(error instanceof QuestionPoolExhaustedError)) throw error;
    endRun(s, 'CONTENT_COMPLETE', ev);
    return false;
  }
}

function enterPrep(ctx: GameContext, s: RunState, wave: number, ev: DomainEvent[]) {
  s.phase = 'PREP_QUIZ';
  s.wave = wave;
  s.waveKillPtGranted = 0;
  s.quiz.prepTarget = wave === 1 ? ctx.balance.run.prepAttempts.firstWave : ctx.balance.run.prepAttempts.laterWaves;
  s.quiz.prepDone = 0;
  s.quiz.feedback = null;
  if (openQuestion(ctx, s, 'prep', ev)) ev.push({ type: 'phase', phase: s.phase, wave }, { type: 'encounter', encounterId: s.quiz.current!.id });
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
  // 원정 보물(R4 B3)은 밸런스 사본으로 적용한다. 보물이 없으면 ctx 그대로다.
  ctx = relicContext(ctx, s);
  const ev: DomainEvent[] = [];
  const result = (() => {
    switch (cmd.type) {
      case 'answer': return answer(ctx, s, cmd.encounterId, cmd.choice, ev);
      case 'skip': return answer(ctx, s, cmd.encounterId, 'skipped', ev);
      case 'next': return next(s, cmd.encounterId);
      case 'build': return build(ctx, s, cmd.slotId, cmd.tower, ev);
      case 'upgrade': return upgrade(ctx, s, cmd.towerId, cmd.form, ev);
      case 'sell': return sell(ctx, s, cmd.towerId, ev);
      case 'undoBuild': return undoBuild(s, cmd.towerId, ev);
      case 'draftPick': return draftPick(s, cmd.tower, ev);
      case 'relicPick': return relicPick(ctx, s, cmd.relic, ev);
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
  // 연속 정답 보너스(run.answerStreakBonus가 있을 때만 센다, R4 B3): 준비·전투·마무리 문항을 가리지 않고 이어진 정답 수.
  const streakRule = ctx.balance.run.answerStreakBonus;
  const answerStreak = result === 'correct' ? (s.quiz.answerStreak ?? 0) + 1 : 0;
  const gold = result === 'correct' ? add(correctGoldAt(d, enc.wave), streakBonusGold(ctx.balance, answerStreak), 'gold') : 0;
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
  if (streakRule) s.quiz.answerStreak = answerStreak;
  s.quiz.history.push(structuredClone(enc));
  if (s.phase === 'PREP_QUIZ') s.quiz.prepDone++;
  // 버닝은 전투 문항만 충전한다. 준비·마무리 문항은 충전하지 않는다(PRD §5).
  // 연속 수가 웨이브를 넘어 이어지는 규칙(streakAcrossWaves)에서는 마무리 문항(전투 문항)의 오답·'모르겠어요'도 연속을 끊는다.
  if (s.phase === 'WAVE_WRAPUP' && enc.phase === 'battle' && result !== 'correct' && ctx.balance.burning.streakAcrossWaves) s.quiz.battleStreak = 0;
  if (s.phase === 'BATTLE' && !enc.wrapup) {
    if (result === 'correct') {
      s.quiz.battleStreak++;
      const burning = ctx.balance.burning;
      if (s.quiz.battleStreak % burning.streak === 0) {
        // 6연속 이상이면 2단(tier2), 아니면 1단. 다시 켜지면 그 단계로 지금부터 durationMs를 새로 센다(prd-r4 §7.2 B).
        s.burningTier = burning.tier2 && s.quiz.battleStreak >= burning.tier2.streak ? 2 : 1;
        s.burningUntilTick = s.tick + msToTicks(burning.durationMs);
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
  if (openQuestion(ctx, s, s.phase === 'PREP_QUIZ' ? 'prep' : 'battle', ev)) ev.push({ type: 'encounter', encounterId: s.quiz.current!.id });
}

/** 밖에서 들여온 상태(개발용 QA 장면 로더)에 걸린 미제출 문항이 철회됐으면 바꾼다. 답한 문항은 소급 변경하지 않는다. */
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
      if (openQuestion(ctx, s, 'prep', ev)) ev.push({ type: 'encounter', encounterId: s.quiz.current!.id });
    }
  } else if (s.phase === 'BATTLE') {
    if (openQuestion(ctx, s, 'battle', ev)) ev.push({ type: 'encounter', encounterId: s.quiz.current!.id });
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
  if (!s.owned.includes(type)) return 'NOT_OWNED';
  if (cfg.maxOnField && s.towers.filter(t => t.type === type).length >= cfg.maxOnField) return 'TOWER_LIMIT';
  const cost = buildCost(ctx.balance, type);
  if (s.gold < cost) return 'NOT_ENOUGH_GOLD';
  s.gold -= cost;
  const tower: Tower = {
    id: s.seq.tower++, type, slotId, x: center(slot.x), y: center(slot.y), level: 1, form: 'base', invested: cost, nextAttackTick: null,
    undoUntilTick: s.tick + msToTicks(ctx.balance.run.undoBuildMs), attacks: 0, burst: null, focus: null, auraKills: 0, auraGold: 0,
  };
  s.towers.push(tower);
  // 전투 중 구매는 구매 시점부터 공격 간격 하나를 기다린다(PRD §7.2). 깃발처럼 공격하지 않는 타워는 공격 예약이 없다.
  if (s.phase === 'BATTLE' && attacks(ctx.balance, type)) tower.nextAttackTick = s.tick + attackIntervalTicks(ctx.balance, towerStats(ctx.balance, type, 1, 'base'), towerSpeedBonusBP(ctx, s, tower));
  ev.push({ type: 'towerBuilt', towerId: tower.id, slotId, gold: -cost });
  return null;
}

function upgrade(ctx: GameContext, s: RunState, towerId: number, form: FormId | undefined, ev: DomainEvent[]): CommandError | null {
  if (!tradingPhase(s)) return 'WRONG_PHASE';
  const tower = s.towers.find(t => t.id === towerId);
  if (!tower) return 'UNKNOWN_TOWER';
  const cost = upgradeCost(ctx.balance, tower.type, tower.level);
  if (cost === null) return 'MAX_LEVEL';
  // 진화 레벨이면 지금 길에서 고를 수 있는 두 형태 가운데 하나여야 하고, 진화가 아니면 형태를 보내지 않는다.
  const choices = evolutionChoices(ctx.balance, tower);
  if (choices && form === undefined) return 'FORM_REQUIRED';
  if (form !== undefined && !choices?.includes(form)) return 'INVALID_FORM';
  if (s.gold < cost) return 'NOT_ENOUGH_GOLD';
  const invested = add(tower.invested, cost, 'invested');
  s.gold -= cost;
  tower.invested = invested;
  tower.level++;
  if (form !== undefined) tower.form = form;
  tower.undoUntilTick = null;
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
  removeTowerHazards(s, towerId, ev);
  ev.push({ type: 'towerSold', towerId, slotId: tower.slotId, gold: refund });
  return null;
}

/** 설치 취소: 들인 골드(설치비)를 모두 돌려준다. 화면에는 판매와 같은 사건으로 알린다. */
function undoBuild(s: RunState, towerId: number, ev: DomainEvent[]): CommandError | null {
  if (!tradingPhase(s)) return 'WRONG_PHASE';
  const index = s.towers.findIndex(t => t.id === towerId);
  if (index < 0) return 'UNKNOWN_TOWER';
  const tower = s.towers[index]!;
  if (tower.undoUntilTick === null || s.tick >= tower.undoUntilTick) return 'UNDO_EXPIRED';
  const gold = add(s.gold, tower.invested, 'gold');
  s.towers.splice(index, 1);
  s.gold = gold;
  // 장판·덫을 놓으면 공격으로 쳐서 취소 기한이 끝나므로 보통은 없지만, 타워 ID는 다시 쓰지 않으니 남은 것이 있으면 함께 지운다.
  removeTowerHazards(s, towerId, ev);
  ev.push({ type: 'towerSold', towerId, slotId: tower.slotId, gold: tower.invested });
  return null;
}

function draftPick(s: RunState, tower: TowerId, ev: DomainEvent[]): CommandError | null {
  if (!s.draft) return 'NO_DRAFT';
  if (!s.draft.offers.includes(tower)) return 'INVALID_DRAFT';
  pickDraft(s, tower, false, ev);
  return null;
}

function relicPick(ctx: GameContext, s: RunState, relic: string, ev: DomainEvent[]): CommandError | null {
  if (!s.relicOffer) return 'NO_RELIC_OFFER';
  if (!s.relicOffer.offers.includes(relic)) return 'INVALID_RELIC';
  pickRelic(ctx.balance, s, relic, false, ev);
  return null;
}

function startBattle(ctx: GameContext, s: RunState, ev: DomainEvent[]): CommandError | null {
  if (s.phase !== 'BUILD') return 'WRONG_PHASE';
  const b = ctx.balance;
  const rng = { s: s.rng.battle };
  const spawnList = composeWave(b, ctx.map.id, s.wave, rng);
  s.rng.battle = rng.s;
  s.battle = { spawnList, spawnIndex: 0, nextSpawnTick: s.tick + 1, intervalTicks: spawnIntervalTicks(b, s.wave), hpBaseMilli: waveHpBaseMilli(b, s.wave), startedTick: s.tick };
  // 시작 때 버닝은 없고(0), 깃발 B의 속도 보너스는 바로 적용한다.
  for (const t of s.towers) {
    t.nextAttackTick = attacks(b, t.type) ? s.tick + attackIntervalTicks(b, towerStats(b, t.type, t.level, t.form), towerSpeedBonusBP(ctx, s, t)) : null;
    // 웨이브마다 다연발 예약·연속 표적·처치 골드 상한을 새로 센다(공격 주기 수는 이어 간다).
    t.burst = null; t.focus = null; t.auraGold = 0;
  }
  s.phase = 'BATTLE';
  if (!b.burning.streakAcrossWaves) s.quiz.battleStreak = 0;
  if (openQuestion(ctx, s, 'battle', ev)) ev.push({ type: 'phase', phase: 'BATTLE', wave: s.wave }, { type: 'encounter', encounterId: s.quiz.current!.id });
  return null;
}

function quit(s: RunState, ev: DomainEvent[]): CommandError | null {
  endRun(s, 'QUIT', ev);
  return null;
}

function endRun(s: RunState, reason: RunEndReason, ev: DomainEvent[]) {
  s.phase = 'GAME_OVER';
  s.endReason = reason;
  s.endedAtWave = s.wave;
  // 미제출 문항은 무보상·무벌점으로 취소한다(PRD §2.2, §3.5).
  if (s.quiz.current && !s.quiz.current.answer) s.quiz.current = null;
  s.quiz.feedback = null;
  s.projectiles = [];
  s.hazards = [];
  // 패배·종료 때도 버닝과 전투 연속 카운트를 초기화한다(PRD §5).
  s.burningUntilTick = -1;
  if (s.burningTier !== undefined) s.burningTier = 0;
  s.quiz.battleStreak = 0;
  if (s.quiz.answerStreak !== undefined) s.quiz.answerStreak = 0;
  ev.push({ type: 'gameOver', completedWave: s.completedWave, endedAtWave: s.wave, reason }, { type: 'phase', phase: 'GAME_OVER', wave: s.wave });
}

function completeWave(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  const b = ctx.balance;
  s.completedWave = s.wave;
  s.gateHp = s.gateMaxHp;
  s.burningUntilTick = -1;
  if (s.burningTier !== undefined) s.burningTier = 0;
  // 버닝은 끄고, 연속 수는 streakAcrossWaves일 때만 다음 웨이브로 넘긴다(prd-r4 §7.2 B).
  if (!b.burning.streakAcrossWaves) s.quiz.battleStreak = 0;
  s.projectiles = [];
  s.enemies = [];
  s.battle = null;
  for (const t of s.towers) { t.nextAttackTick = null; t.burst = null; }
  // 장판·굴림체는 사라지고 덫은 타워마다 최대 2개 넘어간다(towers.md §2 [19]).
  settleHazardsAtWaveEnd(ctx, s, ev);
  let milestoneGold = 0;
  if (isMilestone(b, s.wave) && !s.milestoneRewardedWaves.includes(s.wave)) {
    milestoneGold = ctx.difficulty.milestoneSurvivalGold;
    s.gold = add(s.gold, milestoneGold, 'gold');
    s.stats.goldEarned = add(s.stats.goldEarned, milestoneGold);
    s.milestoneRewardedWaves.push(s.wave);
  }
  ev.push({ type: 'waveComplete', wave: s.wave, milestoneGold });
  openDraft(b, s, ev);
  openRelicOffer(b, s, ev);
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
  ctx = relicContext(ctx, s);
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

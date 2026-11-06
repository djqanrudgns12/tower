import type { DifficultyId } from '../contracts/balance';
import type { DifficultyTier, OptionId } from '../contracts/questions';
import type { GameContext } from './context';
import { shuffle, type Rng } from './rng';
import type { Encounter, EncounterPhase, QuizState, RunState } from './types';

export const RECENT_QUESTIONS = 30;
export const RECENT_SENSES = 8;
/** 도움 단계를 정하는 최근 채점 수(R4 L, prd-r4 §6.2). */
export const HELP_WINDOW = 4;
/** 단계 없는 은행에서 읽기 부담으로 가르는 하위·상위 비율. */
export const READING_BAND_RATIO = 0.4;
/** 준비 문제 3개에 1번꼴로 복습 단계를 먼저 시도한다(prd-r4 §6.1). */
export const REVIEW_EVERY = 3;
/** 한 판에서 뜻 하나를 복습 단계로 내는 최대 횟수. */
export const REVIEW_MAX_PER_SENSE = 1;
/** 판에 복사하는 오답 노트 뜻의 최대 수. */
export const MAX_REVIEW_SENSES = 12;

const TIER_ORDER: readonly DifficultyTier[] = ['basic', 'core', 'advanced', 'challenge'];

export const DEFAULT_TIER_SCHEDULE: Record<DifficultyId, readonly DifficultyTier[]> = {
  Easy: ['basic', 'basic', 'core', 'basic', 'basic', 'core', 'basic', 'basic', 'core', 'basic'],
  Normal: ['core', 'core', 'advanced', 'basic', 'core', 'advanced', 'core', 'basic', 'core', 'advanced'],
  Hard: ['advanced', 'core', 'challenge', 'advanced', 'advanced', 'challenge', 'core', 'advanced', 'challenge', 'advanced'],
  Crazy: ['challenge', 'advanced', 'challenge', 'challenge', 'advanced', 'challenge', 'core', 'challenge', 'advanced', 'challenge'],
};

/**
 * 도움 단계 h(prd-r4 §6.2): 이번 판 최근 채점 4개로 정한다. 오답·‘모르겠어요’가 3개 이상이면 -1,
 * 4개가 모두 정답이면 +1, 나머지는 0. 판마다 0에서 시작하며 판 밖 숙련도는 보지 않는다. 화면에 단계는 보이지 않는다.
 */
export function helpLevel(history: readonly Pick<Encounter, 'answer'>[]): -1 | 0 | 1 {
  const recent = history.slice(-HELP_WINDOW);
  const misses = recent.filter(e => !e.answer?.correct).length;
  if (misses >= 3) return -1;
  if (recent.length === HELP_WINDOW && misses === 0) return 1;
  return 0;
}

/** 목표 단계를 h칸 옮긴다. 난이도 문이 걸러 낸 풀(`inPool`)에 없는 단계로는 옮기지 않고 원래 단계에 머문다. */
function shiftTier(tier: DifficultyTier, h: number, inPool: ReadonlySet<DifficultyTier>): DifficultyTier {
  const at = Math.min(TIER_ORDER.length - 1, Math.max(0, TIER_ORDER.indexOf(tier) + h));
  const shifted = TIER_ORDER[at]!;
  return inPool.has(shifted) ? shifted : tier;
}

interface ContextIndex {
  /** 읽기 부담 하위·상위 40%(동률은 id 순). 단계 없는 은행의 도움 단계가 쓴다. */
  low: ReadonlySet<string>;
  high: ReadonlySet<string>;
  /** 뜻(senseKey) → 이 풀의 문항 id(id 순). 복습 단계가 같은 뜻의 다른 문항을 찾는다. */
  bySense: ReadonlyMap<string, readonly string[]>;
}
const indexCache = new WeakMap<GameContext, ContextIndex>();

function contextIndex(ctx: GameContext): ContextIndex {
  let index = indexCache.get(ctx);
  if (!index) {
    const ids = ctx.questionIds.filter(id => ctx.questions.has(id));
    const byLoad = [...ids].sort((a, b) => ctx.questions.get(a)!.readingLoad - ctx.questions.get(b)!.readingLoad || (a < b ? -1 : 1));
    const k = Math.min(byLoad.length, Math.max(1, Math.ceil(byLoad.length * READING_BAND_RATIO)));
    const bySense = new Map<string, string[]>();
    for (const id of ids) {
      const key = ctx.questions.get(id)!.target.senseKey;
      const list = bySense.get(key);
      if (list) list.push(id);
      else bySense.set(key, [id]);
    }
    index = { low: new Set(byLoad.slice(0, k)), high: new Set(byLoad.slice(byLoad.length - k)), bySense };
    indexCache.set(ctx, index);
  }
  return index;
}

export interface QuestionPick { id: string; review: boolean }

export class QuestionPoolExhaustedError extends Error {
  constructor() { super('이번 판에서 더 낼 수 있는 문항이 없다'); this.name = 'QuestionPoolExhaustedError'; }
}

/** 읽기량·목표 단계·복습 우선순위를 완화해도 이 제한은 풀지 않는다. */
function runEligibility(ctx: GameContext, quiz: QuizState): (id: string) => boolean {
  const ids = new Set<string>(), senses = new Set<string>(), lemmas = new Map<string, { count: number; last: number }>();
  let shared = 0;
  quiz.presented.forEach((item, index) => {
    ids.add(item.questionId); senses.add(item.senseKey);
    lemmas.set(item.lemma, { count: (lemmas.get(item.lemma)?.count ?? 0) + 1, last: index });
    if (item.shared) shared++;
  });
  const repeatedLemma = ctx.difficultyId === 'Hard' || ctx.difficultyId === 'Crazy';
  return id => {
    const q = ctx.questions.get(id);
    if (!q || ids.has(id) || senses.has(q.target.senseKey)) return false;
    const lemma = lemmas.get(q.target.lemma.normalize('NFC').trim());
    if (lemma && (!repeatedLemma || lemma.count >= 2 || quiz.presented.length - lemma.last < 9)) return false;
    return q.grade === ctx.questionGrade || (shared + 1) * 10 <= (quiz.presented.length + 1) * 3;
  };
}

/** 다음 문항 id. 복습 단계로 뽑았는지가 필요하면 `pickQuestion`을 쓴다. */
export function selectQuestion(ctx: GameContext, quiz: QuizState, phase: EncounterPhase, rng: Rng): string {
  return pickQuestion(ctx, quiz, phase, rng).id;
}

/**
 * 다음 문항 선택(PRD §9.4, §20.5, R4 L). 유한 탐색만 한다. RunState·ctx·rng만 본다(판 밖 저장소를 읽지 않는다).
 * 0단계 복습: 준비 문제 3개에 1번꼴(도움 단계가 -1이면 쉼)로 오답 노트 복사본(`quiz.reviewSenses`)의 뜻을 먼저 시도한다.
 *   최근 30문항·8뜻 제한을 지키고, 같은 뜻의 다른 문항을 우선하며, 뜻 하나는 일반 출제와 합쳐 판당 한 번이다. 조건에 맞는 문항이 없으면 다음 단계로 넘어간다.
 * 1단계 도움 단계: 다단계 심화 문제은행에서는 현재 난이도의 목표 심화 단계를 h칸 옮겨(난이도 문 안에서만) 우선 고르고,
 *   단계 없는 은행에서는 h=-1이면 읽기 부담 하위 40%, h=+1이면 상위 40%를 먼저 고른다. h=0이면 일정표 단계 그대로다.
 * 이후 완화 순서(전투 읽기 부담 상한 → 최근 의미를 오래된 것부터 하나씩 → 최근 문항을 오래된 것부터 하나씩)를 그대로 지킨다.
 * 모든 단계에서 판 전체 제한을 지키며 과거 판에서 풀지 않은 문항을 먼저 찾는다. 철회 문항은 건너뛰고 풀이 소진되면 종료를 알린다.
 */
export function pickQuestion(ctx: GameContext, quiz: QuizState, phase: EncounterPhase, rng: Rng): QuestionPick {
  const pool = ctx.questionIds;
  const eligible = runEligibility(ctx, quiz);
  const previous = new Set(quiz.previousQuestionIds);
  const last = quiz.recentQuestions.at(-1);
  const q = (id: string) => ctx.questions.get(id)!;
  const tierOf = (id: string): DifficultyTier => q(id).difficultyTier ?? 'core';
  const readable = (id: string) => phase !== 'battle' || q(id).readingLoad <= ctx.battleReadingLoadMax;
  // 오래된 k개를 푼 뒤에도 남아 있는 이력.
  const sensesAfter = (k: number) => new Set(quiz.recentSenses.slice(k));
  const questionsAfter = (k: number) => new Set(quiz.recentQuestions.slice(k));
  const stage = (reading: boolean, senses: Set<string>, questions: Set<string>) =>
    (id: string) => eligible(id) && (!reading || readable(id)) && !senses.has(q(id).target.senseKey) && !questions.has(id);
  const allQuestions = questionsAfter(0);
  const baseStage0 = stage(true, sensesAfter(0), allQuestions);

  const distinctTiers = new Set(pool.filter(id => ctx.questions.has(id)).map(tierOf));
  const schedule = ctx.tierSchedule ?? DEFAULT_TIER_SCHEDULE[ctx.difficultyId ?? 'Normal'];
  const preferredTier = schedule[Math.max(0, quiz.nextEncounterId - 1) % schedule.length] ?? 'core';

  // 목표 심화 단계(또는 읽기 부담 구간)는 이번 주기에 남은 문항 안에서만 고른다. 없다고 큐를 다시 섞지 않는다(PRD §9.4 풀을 한 바퀴 쓴 뒤 섞기).
  const h = helpLevel(quiz.history);
  const stages: Array<{ allowed: (id: string) => boolean; reshuffle: boolean }> = [];
  if (distinctTiers.size > 1) {
    // 도움 단계가 목표 단계를 옮긴다. 옮긴 단계가 이번 주기에 비면 원래 일정표 단계로 넘어간다.
    const targets = [shiftTier(preferredTier, h, distinctTiers), preferredTier].filter((tier, i, all) => distinctTiers.has(tier) && all.indexOf(tier) === i);
    for (const tier of targets) stages.push({ allowed: id => tierOf(id) === tier && baseStage0(id), reshuffle: false });
  } else if (h !== 0) {
    // 단계 없는 은행: 읽기 부담으로 대신한다. 구간이 비면 기존 단계로 넘어간다.
    const band = h < 0 ? contextIndex(ctx).low : contextIndex(ctx).high;
    stages.push({ allowed: id => band.has(id) && baseStage0(id), reshuffle: false });
  }
  stages.push({ allowed: baseStage0, reshuffle: true });
  for (let k = 0; k <= quiz.recentSenses.length; k++) stages.push({ allowed: stage(false, sensesAfter(k), allQuestions), reshuffle: true });
  for (let k = 1; k <= quiz.recentQuestions.length; k++) stages.push({ allowed: stage(false, new Set(), questionsAfter(k)), reshuffle: true });

  const newCycle = () => {
    quiz.queue = shuffle(rng, [...pool]);
    quiz.cursor = 0;
    quiz.cycle++;
  };
  if (quiz.queue.length === 0 || quiz.cursor >= quiz.queue.length) newCycle();
  const scan = (allowed: (id: string) => boolean) => {
    for (let i = quiz.cursor; i < quiz.queue.length; i++) {
      const id = quiz.queue[i]!;
      if (!ctx.questions.has(id)) continue;
      if (id === last && pool.length > 1) continue;
      if (allowed(id)) return i;
    }
    return -1;
  };
  // 큐에서 id를 꺼내 이번 주기에서 쓴 것으로 센다. 이미 쓴 자리(커서 앞)에 있으면 큐를 건드리지 않는다.
  const take = (id: string) => {
    for (let i = quiz.cursor; i < quiz.queue.length; i++) {
      if (quiz.queue[i] !== id) continue;
      quiz.queue[i] = quiz.queue[quiz.cursor]!;
      quiz.queue[quiz.cursor] = id;
      quiz.cursor++;
      return;
    }
  };
  // 전에 푼 원ID는 학년을 바꾼 공유 문항에서도 아직 풀지 않은 후보 뒤로 미룬다.
  for (const includePrevious of previous.size ? [false, true] : [true]) {
    const unseen = (id: string) => includePrevious || !previous.has(id);
    if (phase === 'prep' && h >= 0 && isReviewTurn(quiz)) {
      const id = pickReview(ctx, quiz, id => eligible(id) && unseen(id));
      if (id) {
        take(id);
        return { id, review: true };
      }
    }
    for (const { allowed: stageAllowed, reshuffle } of stages) {
      const allowed = (id: string) => unseen(id) && stageAllowed(id);
      let i = scan(allowed);
      if (i < 0 && reshuffle && quiz.cursor > 0 && pool.some(id => ctx.questions.has(id) && (id !== last || pool.length <= 1) && allowed(id))) {
        newCycle();
        i = scan(allowed);
      }
      if (i >= 0) {
        const id = quiz.queue[i]!;
        quiz.queue[i] = quiz.queue[quiz.cursor]!;
        quiz.queue[quiz.cursor] = id;
        quiz.cursor++;
        return { id, review: false };
      }
    }
  }
  throw new QuestionPoolExhaustedError();
}

/** 이 판의 준비 문제 순번(0부터)이 3으로 나눠 1인 차례. 전투·마무리 문제는 세지 않아 전투 읽기 부담을 늘리지 않는다. */
function isReviewTurn(quiz: QuizState): boolean {
  if (quiz.reviewSenses.length === 0) return false;
  let prepAnswered = 0;
  for (const e of quiz.history) if (e.phase === 'prep') prepAnswered++;
  return prepAnswered % REVIEW_EVERY === 1;
}

/**
 * 복습 단계 후보(prd-r4 §6.1). 최근 8뜻·30문항 제한을 지키고, 뜻 하나는 일반 출제와 합쳐 판당 한 번, 아직 내지 않은 뜻부터(같으면 노트 순서).
 * 같은 뜻의 다른 문항이 있으면 그것을, 없으면 전에 틀린 문항을 다시 낸다. 큐에서 앞에 있는 후보를 고른다(큐는 시드로 섞여 있다).
 */
function pickReview(ctx: GameContext, quiz: QuizState, eligible: (id: string) => boolean): string | null {
  const recentSenses = new Set(quiz.recentSenses);
  const recentQuestions = new Set(quiz.recentQuestions);
  const turns = quiz.reviewSenses
    .map((sense, index) => ({ sense, index, used: quiz.reviewUsed[sense.senseKey] ?? 0 }))
    .filter(x => x.used < REVIEW_MAX_PER_SENSE && !recentSenses.has(x.sense.senseKey))
    .sort((a, b) => a.used - b.used || a.index - b.index);
  const bySense = contextIndex(ctx).bySense;
  for (const { sense } of turns) {
    const open = (bySense.get(sense.senseKey) ?? []).filter(id => eligible(id) && !recentQuestions.has(id));
    const missed = new Set(sense.questionIds);
    const others = open.filter(id => !missed.has(id));
    const candidates = new Set(others.length > 0 ? others : open);
    if (candidates.size === 0) continue;
    for (let i = quiz.cursor; i < quiz.queue.length; i++) if (candidates.has(quiz.queue[i]!)) return quiz.queue[i]!;
    return [...candidates][0]!;
  }
  return null;
}

export function createEncounter(ctx: GameContext, s: RunState, phase: EncounterPhase): Encounter {
  const qr: Rng = { s: s.rng.question };
  const { id, review } = pickQuestion(ctx, s.quiz, phase, qr);
  s.rng.question = qr.s;
  const question = ctx.questions.get(id)!;
  const or: Rng = { s: s.rng.option };
  const optionOrder = shuffle(or, question.options.map(o => o.id) as OptionId[]);
  s.rng.option = or.s;
  const quiz = s.quiz;
  quiz.presented.push({ questionId: id, senseKey: question.target.senseKey, lemma: question.target.lemma.normalize('NFC').trim(), shared: question.grade !== ctx.questionGrade });
  quiz.recentQuestions.push(id);
  if (quiz.recentQuestions.length > RECENT_QUESTIONS) quiz.recentQuestions.shift();
  quiz.recentSenses.push(question.target.senseKey);
  if (quiz.recentSenses.length > RECENT_SENSES) quiz.recentSenses.shift();
  if (review) quiz.reviewUsed[question.target.senseKey] = (quiz.reviewUsed[question.target.senseKey] ?? 0) + 1;
  return { id: quiz.nextEncounterId++, questionId: id, revision: question.revision, phase, wave: s.wave, createdTick: s.tick, optionOrder, wrapup: false, review, answer: null };
}

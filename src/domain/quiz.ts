import type { DifficultyId } from '../contracts/balance';
import type { DifficultyTier, OptionId } from '../contracts/questions';
import type { GameContext } from './context';
import { shuffle, type Rng } from './rng';
import type { Encounter, EncounterPhase, QuizState, RunState } from './types';

export const RECENT_QUESTIONS = 30;
export const RECENT_SENSES = 8;

export const DEFAULT_TIER_SCHEDULE: Record<DifficultyId, readonly DifficultyTier[]> = {
  Easy: ['basic', 'basic', 'core', 'basic', 'basic', 'core', 'basic', 'basic', 'core', 'basic'],
  Normal: ['core', 'core', 'advanced', 'basic', 'core', 'advanced', 'core', 'basic', 'core', 'advanced'],
  Hard: ['advanced', 'core', 'challenge', 'advanced', 'advanced', 'challenge', 'core', 'advanced', 'challenge', 'advanced'],
  Crazy: ['challenge', 'advanced', 'challenge', 'challenge', 'advanced', 'challenge', 'core', 'challenge', 'advanced', 'challenge'],
};

/**
 * 다음 문항 선택(PRD §9.4, §20.5). 유한 탐색만 한다.
 * 다단계 심화 문제은행에서는 현재 난이도의 목표 심화 단계(core/advanced/challenge)를 0단계에서 우선 고르고,
 * 완화 순서(전투 읽기 부담 상한 → 최근 의미를 오래된 것부터 하나씩 → 최근 문항을 오래된 것부터 하나씩)를 그대로 지킨다.
 * 바로 앞 문항은 풀이 1개일 때만 반복한다. 저장된 큐에 철회된 문항이 남아 있으면 건너뛴다.
 */
export function selectQuestion(ctx: GameContext, quiz: QuizState, phase: EncounterPhase, rng: Rng): string {
  const pool = ctx.questionIds;
  const last = quiz.recentQuestions.at(-1);
  const q = (id: string) => ctx.questions.get(id)!;
  const tierOf = (id: string): DifficultyTier => q(id).difficultyTier ?? 'core';
  const readable = (id: string) => phase !== 'battle' || q(id).readingLoad <= ctx.battleReadingLoadMax;
  // 오래된 k개를 푼 뒤에도 남아 있는 이력.
  const sensesAfter = (k: number) => new Set(quiz.recentSenses.slice(k));
  const questionsAfter = (k: number) => new Set(quiz.recentQuestions.slice(k));
  const stage = (reading: boolean, senses: Set<string>, questions: Set<string>) =>
    (id: string) => (!reading || readable(id)) && !senses.has(q(id).target.senseKey) && !questions.has(id);
  const allQuestions = questionsAfter(0);
  const baseStage0 = stage(true, sensesAfter(0), allQuestions);

  const distinctTiers = new Set(pool.filter(id => ctx.questions.has(id)).map(tierOf));
  const schedule = ctx.tierSchedule ?? DEFAULT_TIER_SCHEDULE[ctx.difficultyId ?? 'Normal'];
  const preferredTier = schedule[Math.max(0, quiz.nextEncounterId - 1) % schedule.length] ?? 'core';

  const stages: Array<(id: string) => boolean> = [];
  if (distinctTiers.size > 1 && distinctTiers.has(preferredTier)) {
    const preferredStage = (id: string) => tierOf(id) === preferredTier && baseStage0(id);
    if (pool.some(id => ctx.questions.has(id) && (id !== last || pool.length <= 1) && preferredStage(id))) {
      stages.push(preferredStage);
    }
  }
  stages.push(baseStage0);
  for (let k = 0; k <= quiz.recentSenses.length; k++) stages.push(stage(false, sensesAfter(k), allQuestions));
  for (let k = 1; k <= quiz.recentQuestions.length; k++) stages.push(stage(false, new Set(), questionsAfter(k)));

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
  for (const allowed of stages) {
    let i = scan(allowed);
    if (i < 0 && quiz.cursor > 0 && pool.some(id => ctx.questions.has(id) && (id !== last || pool.length <= 1) && allowed(id))) {
      newCycle();
      i = scan(allowed);
    }
    if (i >= 0) {
      const id = quiz.queue[i]!;
      quiz.queue[i] = quiz.queue[quiz.cursor]!;
      quiz.queue[quiz.cursor] = id;
      quiz.cursor++;
      return id;
    }
  }
  return pool[0]!;
}

export function createEncounter(ctx: GameContext, s: RunState, phase: EncounterPhase): Encounter {
  const qr: Rng = { s: s.rng.question };
  const id = selectQuestion(ctx, s.quiz, phase, qr);
  s.rng.question = qr.s;
  const question = ctx.questions.get(id)!;
  const or: Rng = { s: s.rng.option };
  const optionOrder = shuffle(or, question.options.map(o => o.id) as OptionId[]);
  s.rng.option = or.s;
  const quiz = s.quiz;
  quiz.recentQuestions.push(id);
  if (quiz.recentQuestions.length > RECENT_QUESTIONS) quiz.recentQuestions.shift();
  quiz.recentSenses.push(question.target.senseKey);
  if (quiz.recentSenses.length > RECENT_SENSES) quiz.recentSenses.shift();
  return { id: quiz.nextEncounterId++, questionId: id, revision: question.revision, phase, wave: s.wave, createdTick: s.tick, optionOrder, wrapup: false, answer: null };
}

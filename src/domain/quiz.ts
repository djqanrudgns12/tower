import type { OptionId } from '../contracts/questions';
import type { GameContext } from './context';
import { shuffle, type Rng } from './rng';
import type { Encounter, EncounterPhase, QuizState, RunState } from './types';

export const RECENT_QUESTIONS = 30;
export const RECENT_SENSES = 8;

/**
 * 다음 문항 선택(PRD §9.4, §20.5). 유한 탐색만 한다.
 * 완화 순서: 전투 읽기 부담 상한 → 최근 의미 8 → 최근 문항 30. 바로 앞 문항은 풀이 1개일 때만 반복한다.
 */
export function selectQuestion(ctx: GameContext, quiz: QuizState, phase: EncounterPhase, rng: Rng): string {
  const pool = ctx.questionIds;
  const last = quiz.recentQuestions.at(-1);
  const q = (id: string) => ctx.questions.get(id)!;
  const checks: Array<(id: string) => boolean> = [
    id => phase !== 'battle' || q(id).readingLoad <= ctx.battleReadingLoadMax,
    id => !quiz.recentSenses.includes(q(id).target.senseKey),
    id => !quiz.recentQuestions.includes(id),
  ];
  const newCycle = () => {
    quiz.queue = shuffle(rng, [...pool]);
    quiz.cursor = 0;
    quiz.cycle++;
  };
  if (quiz.queue.length === 0 || quiz.cursor >= quiz.queue.length) newCycle();
  const scan = (active: typeof checks) => {
    for (let i = quiz.cursor; i < quiz.queue.length; i++) {
      const id = quiz.queue[i]!;
      if (id === last && pool.length > 1) continue;
      if (active.every(f => f(id))) return i;
    }
    return -1;
  };
  for (let relax = 0; relax <= checks.length; relax++) {
    const active = checks.slice(relax);
    let i = scan(active);
    if (i < 0 && quiz.cursor > 0) {
      newCycle();
      i = scan(active);
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

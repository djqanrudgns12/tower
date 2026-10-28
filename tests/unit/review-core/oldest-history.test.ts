import { expect, test } from 'vitest';
import type { GameContext } from '../../../src/domain/context';
import { selectQuestion } from '../../../src/domain/quiz';
import { newRun } from '../helpers';

// PRD §20.5: "없으면 의미 이력을 오래된 것부터 완화→문항 이력을 오래된 것부터 완화한다."
// PRD §9.4: "작은 승인 풀에서는 의미 반복 제한부터 필요한 만큼 완화".
test('의미 및 문항 이력은 가장 오래된 항목부터 필요한 만큼만 푼다', () => {
  const { ctx, s } = newRun();
  const template = ctx.questions.values().next().value!;
  const questions = ['old', 'new', 'last'].map(id => ({
    ...structuredClone(template), id, readingLoad: 1,
    target: { ...template.target, senseKey: `sense-${id}` },
  }));
  const custom: GameContext = { ...ctx, questions: new Map(questions.map(q => [q.id, q])), questionIds: questions.map(q => q.id) };
  const bySense = structuredClone(s.quiz);
  bySense.queue = ['new', 'old', 'last']; bySense.cursor = 0;
  bySense.recentQuestions = ['last'];
  bySense.recentSenses = ['sense-old', 'sense-new', 'sense-last'];
  const byQuestion = structuredClone(bySense);
  byQuestion.recentSenses = [];
  byQuestion.recentQuestions = ['old', 'new', 'last'];
  expect([
    selectQuestion(custom, bySense, 'prep', { s: 123 }),
    selectQuestion(custom, byQuestion, 'prep', { s: 123 }),
  ]).toEqual(['old', 'old']);
});

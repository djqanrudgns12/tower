import { expect, test } from 'vitest';
import { advanceTick, applyCommand } from '../../../src/domain/run';
import { battleFixture } from './fixtures';

// PRD §3.5: "마무리 문항이 손상되거나 철회되면 무벌점·무보상 취소 후 다음 준비로 이동하고,
// 그 자리에 새 전투 문항을 제공하지 않는다."
// PRD §18.4가 A26을 아직 미구현으로 명시한 알려진 공백도 같은 요구로 재현한다.
test('내용이 사라진 마무리 문항은 채점하지 않고 다음 준비로 이동한다', () => {
  const { ctx, s } = battleFixture();
  advanceTick(ctx, s); // 생존 완료 뒤 원래 미제출 문항이 마무리 후보가 된다.
  expect(s.phase).toBe('WAVE_WRAPUP');
  const current = s.quiz.current!;
  const questions = new Map(ctx.questions);
  questions.delete(current.questionId);
  const damaged = { ...ctx, questions, questionIds: ctx.questionIds.filter(id => id !== current.questionId) };
  const before = { gold: s.gold, pt: s.pt, history: s.quiz.history.length };
  let thrown = false;
  try { applyCommand(damaged, s, { type: 'answer', encounterId: current.id, choice: 'a' }); }
  catch { thrown = true; }
  expect({
    thrown, phase: s.phase, wave: s.wave, questionPhase: s.quiz.current?.phase,
    gold: s.gold, pt: s.pt, history: s.quiz.history.length,
  }).toEqual({ thrown: false, phase: 'PREP_QUIZ', wave: 2, questionPhase: 'prep', ...before });
});

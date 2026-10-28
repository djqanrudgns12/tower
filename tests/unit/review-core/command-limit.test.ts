import { expect, test } from 'vitest';
import { RunController } from '../../../src/application/RunController';
import { correctChoice, newRun } from '../helpers';

// PRD §3.4(2): "최초 답안·구매·강화·판매를 원자적으로 반영한다."
// PRD §8.6: "위반은 학생 패배가 아니라 RECOVERY_REQUIRED(NUMERIC_LIMIT)로 정지하고 그때까지의 기록을 보존한다."
test('정답 골드가 안전 범위를 넘으면 부분 채점 없이 복구 정지한다', () => {
  const { ctx, s } = newRun();
  s.gold = Number.MAX_SAFE_INTEGER - 21; // Normal 정답 +22골드만 한계를 넘는다.
  const before = { gold: s.gold, pt: s.pt, answer: null, correct: s.stats.correct };
  const controller = new RunController(ctx, s, { saveSeq: 0, ownership: null });
  let thrown = false;
  try {
    controller.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(ctx, s) });
  } catch { thrown = true; }
  expect({
    thrown, numericPause: s.pause.includes('NUMERIC_LIMIT'),
    gold: s.gold, pt: s.pt, answer: s.quiz.current!.answer, correct: s.stats.correct,
  }).toEqual({ thrown: false, numericPause: true, ...before });
});

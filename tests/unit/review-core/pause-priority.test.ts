import { expect, test } from 'vitest';
import { correctChoice, newRun } from '../helpers';
import { controlledFrames } from './fixtures';

// PRD §3.4(1): "일시정지 요청이 채택되면 해당 틱의 다른 응답·거래를 처리하지 않는다."
// PRD §20.3: "동일 틱 명령은 sequence순, 정지는 나머지 명령보다 먼저 채택한다."
// "정지에 밀린 답안/거래는 재개 후 자동 실행하지 않고 취소하여 재입력을 받는다."
test('한 논리 틱 사이에 답안 다음 정지가 오면 정지가 우선한다', () => {
  const { ctx, s } = newRun();
  const harness = controlledFrames(ctx, s);
  try {
    const before = { gold: s.gold, pt: s.pt, answer: null };
    harness.controller.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(ctx, s) });
    harness.controller.pause('USER');
    harness.frame();
    harness.controller.resume();
    harness.frame();
    expect({ gold: s.gold, pt: s.pt, answer: s.quiz.current!.answer }).toEqual(before);
  } finally { harness.cleanup(); }
});

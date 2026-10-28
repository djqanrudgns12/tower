import { expect, test } from 'vitest';
import type { DomainEvent } from '../../../src/domain/events';
import { ok, ticks } from '../helpers';
import { battleFixture, controlledFrames, enemy } from './fixtures';

// PRD §3.4(8): "피드백의 다음 문항 전환은 위 판정 이후 처리한다. 여전히 BATTLE인 경우에만 새 전투 문항을 공급한다."
// PRD §3.5: "전투 종료 순간 이미 표시된 미제출 문항 하나만 전투 문항으로 마무리할 수 있다."
test('다음 문제 명령과 마지막 누출이 같은 틱이면 새 전투 문항을 내지 않는다', () => {
  const { ctx, s } = battleFixture();
  s.enemies = [enemy()];
  const encounterId = s.quiz.current!.id;
  ok(ctx, s, { type: 'skip', encounterId });
  ticks(ctx, s, 120); // PRD §4.3의 최소 4초 대기를 정상적으로 완료한다.
  s.enemies[0]!.progress = ctx.path.length - 1;
  const events: DomainEvent[] = [];
  const harness = controlledFrames(ctx, s);
  harness.controller.onEvents(batch => events.push(...batch));
  try {
    harness.controller.dispatch({ type: 'next', encounterId });
    harness.frame();
    expect({
      phase: s.phase, wave: s.wave, questionPhase: s.quiz.current?.phase,
      newQuestions: events.filter(e => e.type === 'encounter').length,
    }).toEqual({ phase: 'PREP_QUIZ', wave: 2, questionPhase: 'prep', newQuestions: 1 });
  } finally { harness.cleanup(); }
});

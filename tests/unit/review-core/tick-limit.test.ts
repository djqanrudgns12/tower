import { expect, test } from 'vitest';
import { newRun } from '../helpers';
import { controlledFrames } from './fixtures';

// PRD §20.1: "전체 run tick ... 모두 안전 정수 Number".
// PRD §8.6: "모든 정수 연산 결과에 Number.isSafeInteger 검사를 둔다. 위반은 학생 패배가 아니라
// RECOVERY_REQUIRED(NUMERIC_LIMIT)로 정지하고 그때까지의 기록을 보존한다."
test('마지막 안전 tick 다음에는 수치 복구 정지하고 기존 tick을 보존한다', () => {
  const { ctx, s } = newRun();
  s.tick = Number.MAX_SAFE_INTEGER;
  const harness = controlledFrames(ctx, s);
  try {
    harness.frame();
    expect({ numericPause: s.pause.includes('NUMERIC_LIMIT'), tick: s.tick, ended: s.endReason })
      .toEqual({ numericPause: true, tick: Number.MAX_SAFE_INTEGER, ended: null });
  } finally { harness.cleanup(); }
});

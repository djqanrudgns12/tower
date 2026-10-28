import { expect, test } from 'vitest';
import { advanceTick } from '../../../src/domain/run';
import { answerCurrent } from '../helpers';
import { battleFixture, enemy } from './fixtures';

// PRD §5: "웨이브 완료·패배 때 버닝과 전투 연속 카운트를 초기화한다."
test('패배하면 전투 연속 정답 카운트도 0으로 초기화한다', () => {
  const { ctx, s } = battleFixture();
  s.enemies = [enemy()];
  answerCurrent(ctx, s, 'correct');
  s.gateHp = 1;
  s.enemies[0]!.progress = ctx.path.length - 1;
  advanceTick(ctx, s);
  expect({ phase: s.phase, streak: s.quiz.battleStreak, burning: s.burningUntilTick })
    .toEqual({ phase: 'GAME_OVER', streak: 0, burning: -1 });
});

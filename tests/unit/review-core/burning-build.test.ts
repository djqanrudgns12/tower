import { expect, test } from 'vitest';
import { answerCurrent, ok } from '../helpers';
import { battleFixture, enemy } from './fixtures';

// PRD §7.2: "전투 중 새로 구매한 타워도 구매 시점부터 한 공격 간격을 기다린다."
// PRD §5: "전투 중 3연속 정답마다 8초 동안 공격 속도 +25%";
// "공격 간격은 기본 간격 / (1 + 속도 보너스 합)".
test('버닝 중 산 궁수의 첫 발사는 구매 24틱 뒤다', () => {
  const { ctx, s } = battleFixture();
  s.enemies = [enemy()];
  for (let i = 0; i < 3; i++) answerCurrent(ctx, s, 'correct');
  expect(s.burningUntilTick).toBeGreaterThan(s.tick);
  ok(ctx, s, { type: 'build', slotId: ctx.map.slots[0]!.id, tower: 'archer' });
  expect(s.towers[0]!.nextAttackTick! - s.tick).toBe(24); // ceil(30 / 1.25)
});

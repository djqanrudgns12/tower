import { expect, test } from 'vitest';
import { advanceTick } from '../../../src/domain/run';
import { battleFixture, enemy } from './fixtures';

// PRD §20.3 비행시간: "발사 거리/속도로 도착틱 결정. 궁수12칸/초 ... 최소1틱."
// PRD §13.3: "정확한 틱 배수가 아닌 값은 일관된 올림 규칙으로 변환한다."
test('비행 거리가 4틱 거리보다 조금 길면 5틱 뒤에 도착한다', () => {
  const { ctx, s } = battleFixture();
  // 축 정렬 길과 길 옆 설치칸. 적은 타워에서 (1249,-1000) 떨어져 있다.
  const straight = { ...ctx, path: { length: 10000, cells: 10, points: [
    { x: 500, y: 500, at: 0 }, { x: 10500, y: 500, at: 10000 },
  ] } };
  s.enemies = [enemy({ progress: 1249 })];
  s.towers = [{ id: 1, type: 'archer', slotId: 'fixture', x: 500, y: 1500,
    level: 1, branch: null, invested: 60, nextAttackTick: s.tick + 1 }];
  advanceTick(straight, s);
  // 거리²=1249²+1000²=2,560,001 > (4×400)²=2,560,000;
  // 1틱에 400 milli-cell이므로 실제 비행시간은 4틱 초과, 5틱 이하다.
  expect(s.projectiles[0]!.arrivalTick - s.projectiles[0]!.firedTick).toBe(5);
});

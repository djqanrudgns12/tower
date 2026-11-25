import { describe, expect, it } from 'vitest';
import { fragmentCount, prismDelay, railLanes, shellPoint } from '../../src/game/r6/vfxTiming';

describe('R6 공격 연출 시간과 품질', () => {
  it('무기 단계에 맞춰 동시에 보이는 예광선 수가 늘어난다', () => {
    expect([1, 5, 6, 11, 12, 17, 18, 20].map(railLanes)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('프리즘은 충전 뒤 0.12초 간격으로 잇고 움직임을 줄이면 같이 표시한다', () => {
    const links = [0, 1, 2, 3, 4];
    expect(links.map(i => prismDelay(i, false))).toEqual([120, 240, 360, 480, 600]);
    expect(links.map(i => prismDelay(i, true))).toEqual([0, 0, 0, 0, 0]);
  });

  it.each(['rail', 'kill'] as const)('품질이 낮아지면 %s 파편 수를 줄이고 움직임을 줄이면 한 조각만 그린다', kind => {
    const counts = [0, 1, 2, 3].map(q => fragmentCount(kind, q, false));
    expect(counts[0]).toBeGreaterThan(counts[1]!);
    expect(counts.slice(1)).toEqual([3, 2, 1]);
    expect(fragmentCount(kind, 0, true)).toBe(1);
  });

  it('포탄은 발사점과 착탄점을 지나고 중간에서 직선보다 높다', () => {
    const from = { x: 44, y: 35 }, to = { x: 126, y: 79 };
    expect(shellPoint(from, to, 0, 32)).toEqual(from);
    expect(shellPoint(from, to, 1, 32)).toEqual(to);
    expect(shellPoint(from, to, .5, 32)).toEqual({ x: 85, y: 25 });
    expect(shellPoint(from, to, .5, 0)).toEqual({ x: 85, y: 57 });
  });
});

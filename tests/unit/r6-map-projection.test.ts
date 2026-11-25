import { describe, expect, it } from 'vitest';
import { projectField, projectFieldDelta, unprojectField } from '../../src/game/r6/mapProjection';
import maps from '../../docs/contracts/maps.candidate.v0.4.json';

const garden = maps.maps.find(map => map.id === 'garden_u')!;

describe('초원 고원 3/4 투영', () => {
  it('왼쪽 설치대와 오른쪽 성문을 Blender 화면 좌표에 고정한다', () => {
    const first = projectField(32, 32);
    const gate = projectField(14.5 * 64, 7.5 * 64);
    expect(first.x).toBeCloseTo(312.10, 1);
    expect(first.y).toBeCloseTo(90.31, 1);
    expect(gate.x).toBeCloseTo(678.94, 1);
    expect(gate.y).toBeCloseTo(460.43, 1);
  });

  it('길 41칸과 설치대 20개의 표시 좌표를 각각 원래 칸으로 되돌린다', () => {
    const cells = [...garden.pathCells, ...garden.slots.map(s => [s.x, s.y])];
    expect(garden.pathCells).toHaveLength(41);
    expect(garden.slots).toHaveLength(20);
    for (const [cellX, cellY] of cells) {
      const x = (cellX! + 0.5) * 64, y = (cellY! + 0.5) * 64;
      const point = projectField(x, y);
      expect(point.x).toBeGreaterThan(24);
      expect(point.x).toBeLessThan(936);
      expect(point.y).toBeGreaterThan(24);
      expect(point.y).toBeLessThan(552);
      expect(unprojectField(point.x, point.y).x).toBeCloseTo(x, 8);
      expect(unprojectField(point.x, point.y).y).toBeCloseTo(y, 8);
    }
  });

  it('동쪽과 남쪽 이동을 같은 직교 카메라의 두 화면 대각선으로 옮긴다', () => {
    const east = projectFieldDelta(64, 0);
    const south = projectFieldDelta(0, 64);
    expect(east.x).toBeGreaterThan(40);
    expect(east.y).toBeGreaterThan(15);
    expect(south.x).toBeLessThan(-30);
    expect(south.y).toBeGreaterThan(20);
  });
});

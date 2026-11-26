import { describe, expect, it } from 'vitest';
import { r6UnitDepth } from '../../src/game/layers/shared';
import { projectField, projectFieldDelta, unprojectField } from '../../src/game/r6/mapProjection';
import {
  padCornerSegments,
  padOcclusionRatio,
  padSamplePoints,
  R6_PAD_CORNER_ALPHA_CLEAR,
  R6_PAD_CORNER_ALPHA_OVERLAP,
  R6_PAD_CORNER_RATIO_CLEAR,
  R6_PAD_CORNER_RATIO_OVERLAP,
} from '../../src/game/r6/padOutline';
import { cellRect, snapSlot, toWorldPoint } from '../../src/ui/game/fieldGeometry';
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

  it('같은 발밑에서는 받침, 적, 타워 순이고 1px 미만의 이동에도 앞뒤가 바뀐다', () => {
    const { y } = projectField(4.5 * 64, 4.5 * 64);
    expect(r6UnitDepth(y, 'pad')).toBeLessThan(r6UnitDepth(y, 'enemy'));
    expect(r6UnitDepth(y, 'enemy')).toBeLessThan(r6UnitDepth(y, 'tower'));
    expect(r6UnitDepth(y + .01, 'enemy')).toBeGreaterThan(r6UnitDepth(y, 'tower'));
    expect(r6UnitDepth(y + .01, 'pad')).toBeGreaterThan(r6UnitDepth(y, 'enemy'));
  });

  it('확대와 CSS 축소가 있는 화면에서 팝오버 기준점과 끌어 놓기가 같은 설치대를 가리킨다', () => {
    const camera = { projected: true, x: 165, y: 90, width: 456, height: 273.6 };
    const cssWidth = 380, cssHeight = 228;
    const slot = garden.slots.find(s => s.id === 'garden_u-s12')!;
    const expected = projectField((slot.x + 0.5) * 64, (slot.y + 0.5) * 64);
    const padX = (expected.x - camera.x) * cssWidth / camera.width;
    const padY = (expected.y - camera.y) * cssHeight / camera.height;
    const rect = cellRect(camera, cssWidth, cssHeight, slot.x, slot.y);
    expect(rect.left + rect.size / 2).toBeCloseTo(padX);
    expect(rect.top + rect.height / 2).toBeCloseTo(padY);
    const grid = toWorldPoint(camera, cssWidth, cssHeight, padX, padY);
    expect(snapSlot(garden.slots, new Set(), grid.x, grid.y)).toBe(slot.id);
  });

  it('빈 설치 칸은 앞쪽 적이 50% 넘게 가릴 때만 짧은 모서리 표식을 만들고 겹치는 꼭짓점을 절제한다', () => {
    const cx = 300, cy = 200, radius = 18.7, squash = 0.506;
    const samples = padSamplePoints(cx, cy, radius, squash);
    expect(samples).toHaveLength(19);

    // 1) 적이 칸 뒤쪽(footY < cy)에 있으면 가림 0
    expect(padOcclusionRatio(cy, samples, [{ footY: cy - 1, left: cx - 30, top: cy - 40, right: cx + 30, bottom: cy + 20 }])).toBe(0);

    // 2) 적이 칸 오른쪽 끝 일부만 스치면 50% 이하
    const edgeRatio = padOcclusionRatio(cy, samples, [{ footY: cy + 5, left: cx + 10, top: cy - 15, right: cx + 30, bottom: cy + 15 }]);
    expect(edgeRatio).toBeLessThanOrEqual(0.5);

    // 3) 적이 앞쪽에서 칸 절반 넘게 덮으면 > 0.5, 겹치는 꼭짓점만 더 짧고 옅어짐
    const bigEnemy = { footY: cy + 12, left: cx - 5, top: cy - 22, right: cx + 28, bottom: cy + 18 };
    expect(padOcclusionRatio(cy, samples, [bigEnemy])).toBeGreaterThan(0.5);

    const segments = padCornerSegments(cx, cy, radius, squash, cy, [bigEnemy]);
    expect(segments).toHaveLength(12);
    // 오른쪽 꼭짓점(i=0, x = cx + radius)은 적 내부에 있으므로 overlap 스타일, 왼쪽 꼭짓점(i=3, x = cx - radius)은 clear 스타일
    expect(segments[0]!.alpha).toBe(R6_PAD_CORNER_ALPHA_OVERLAP);
    expect(segments[6]!.alpha).toBe(R6_PAD_CORNER_ALPHA_CLEAR);
    const len = (s: { x1: number; y1: number; x2: number; y2: number }) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const edgeLen = radius; // v[0] -> v[1] vs v[3] -> v[4] 길이는 대칭이므로 비율 차이가 그대로 드러남
    expect(len(segments[0]!) / edgeLen).toBeLessThan(R6_PAD_CORNER_RATIO_CLEAR);
    expect(len(segments[0]!) / len(segments[6]!)).toBeCloseTo(R6_PAD_CORNER_RATIO_OVERLAP / R6_PAD_CORNER_RATIO_CLEAR, 2);
  });
});

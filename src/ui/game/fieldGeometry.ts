import type { MapConfig } from '../../contracts/maps';
import type { FieldView } from '../../game/bridge';
import { projectField, r6Pad, R6_MAP_SQUASH, unprojectField } from '../../game/r6/mapProjection';

// 전장 DOM 겹층의 좌표 계산. 세계 좌표(칸 64px)와 화면 CSS px 사이를 카메라가 알려 준 보이는 영역으로 바꾼다.
type Slot = MapConfig['slots'][number];

export const WORLD_CELL = 64;
export const WORLD_COLS = 15;
export const WORLD_ROWS = 9;

/** 카메라 알림이 오기 전에는 전장 전체가 보인다고 본다. */
export const FULL_VIEW: FieldView = { x: 0, y: 0, width: WORLD_COLS * WORLD_CELL, height: WORLD_ROWS * WORLD_CELL };

export interface CellRect { left: number; top: number; size: number; height: number }

/** 칸(x, y)이 화면(전장 상자 안 CSS px)에서 차지하는 사각형. */
export function cellRect(view: FieldView, boxW: number, boxH: number, x: number, y: number): CellRect {
  const sx = boxW / view.width, sy = boxH / view.height;
  if (view.projected) {
    const center = toScreenPoint(view, boxW, boxH, (x + 0.5) * WORLD_CELL, (y + 0.5) * WORLD_CELL);
    const size = r6Pad.radius * 2 * sx;
    const height = r6Pad.radius * 2 * R6_MAP_SQUASH * sy;
    return { left: center.x - size / 2, top: center.y - height / 2, size, height };
  }
  const size = WORLD_CELL * Math.min(sx, sy);
  return { left: (x * WORLD_CELL - view.x) * sx, top: (y * WORLD_CELL - view.y) * sy, size, height: size };
}

/** 격자 px → 전장 상자 안 CSS px. */
export function toScreenPoint(view: FieldView, boxW: number, boxH: number, x: number, y: number) {
  const p = view.projected ? projectField(x, y) : { x, y };
  return { x: (p.x - view.x) * boxW / view.width, y: (p.y - view.y) * boxH / view.height };
}

/** 전장 상자 안 CSS px → 격자 px. */
export function toWorldPoint(view: FieldView, boxW: number, boxH: number, px: number, py: number) {
  const x = view.x + (px / boxW) * view.width, y = view.y + (py / boxH) * view.height;
  return view.projected ? unprojectField(x, y) : { x, y };
}

/**
 * 끌어 놓기 자석: 놓을 점에서 가장 가까운 빈 자리. 자리 칸 바깥으로 반 칸까지(가로·세로 각 1칸 안) 붙는다.
 * 붙을 자리가 없으면 null.
 */
export function snapSlot(slots: readonly Slot[], occupied: ReadonlySet<string>, wx: number, wy: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const s of slots) {
    if (occupied.has(s.id)) continue;
    const dx = Math.abs((s.x + 0.5) * WORLD_CELL - wx), dy = Math.abs((s.y + 0.5) * WORLD_CELL - wy);
    if (dx > WORLD_CELL || dy > WORLD_CELL) continue;
    const d = dx * dx + dy * dy;
    if (d < bestD) { best = s.id; bestD = d; }
  }
  return best;
}

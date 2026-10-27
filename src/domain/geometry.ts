import type { MapConfig } from '../contracts/maps';

// 좌표 단위는 milli-cell(1칸=1000). 셀 중심은 (x×1000+500, y×1000+500)(PRD §6.1, §20.1).
export const CELL = 1000;
export const center = (cell: number) => cell * CELL + CELL / 2;

export interface PathGeometry {
  /** 경로 전체 길이(milli-cell). */
  length: number;
  /** 셀 단위 이동 길이(=pathLength). 기본 속도 계산의 분자. */
  cells: number;
  points: Array<{ x: number; y: number; at: number }>;
}

export function buildPath(map: MapConfig): PathGeometry {
  const points: PathGeometry['points'] = [];
  let at = 0;
  map.waypoints.forEach(([x, y], i) => {
    const px = center(x), py = center(y);
    if (i > 0) {
      const prev = points[i - 1]!;
      at += Math.abs(px - prev.x) + Math.abs(py - prev.y);
    }
    points.push({ x: px, y: py, at });
  });
  if (at !== map.pathLength * CELL) throw new Error(`${map.id}: waypoint 길이 ${at} ≠ pathLength`);
  return { length: at, cells: map.pathLength, points };
}

/** 진행도 → 정수 좌표. 경로가 축 정렬이므로 정확한 정수가 나온다. */
export function positionAt(path: PathGeometry, progress: number): { x: number; y: number } {
  const pts = path.points;
  if (progress <= 0) return { x: pts[0]!.x, y: pts[0]!.y };
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!;
    if (progress <= b.at) {
      const a = pts[i - 1]!;
      const d = progress - a.at;
      return { x: a.x + Math.sign(b.x - a.x) * d, y: a.y + Math.sign(b.y - a.y) * d };
    }
  }
  const last = pts[pts.length - 1]!;
  return { x: last.x, y: last.y };
}

export const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

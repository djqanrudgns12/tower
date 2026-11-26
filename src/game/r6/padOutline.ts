import { R6_COLORS } from './manifest';

/** 화면 위 적 한 기의 발밑 Y와 바운딩 박스(월드 px). */
export interface EnemyFootprint {
  footY: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PadSamplePoint {
  x: number;
  y: number;
}

export interface PadCornerSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export const R6_PAD_OCCLUSION_THRESHOLD = 0.5;
export const R6_PAD_OUTLINE_RADIUS_RATIO = 0.83;
export const R6_PAD_OUTLINE_COLOR = R6_COLORS.silver;
export const R6_PAD_CORNER_RATIO_CLEAR = 0.26;
export const R6_PAD_CORNER_ALPHA_CLEAR = 0.44;
export const R6_PAD_CORNER_RATIO_OVERLAP = 0.20;
export const R6_PAD_CORNER_ALPHA_OVERLAP = 0.32;

const INNER_RING_RATIO = 0.48;
const OUTER_RING_RATIO = 0.86;
const FRONT_LIP_X_OFFSETS = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75] as const;

/** 설치 받침의 윗면과 앞쪽 경사면을 대표하는 19개 표본점을 생성한다. */
export function padSamplePoints(cx: number, cy: number, radius: number, squash: number): PadSamplePoint[] {
  const ry = radius * squash;
  const points: PadSamplePoint[] = [{ x: cx, y: cy }];
  for (const ring of [INNER_RING_RATIO, OUTER_RING_RATIO]) {
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      points.push({
        x: cx + radius * ring * Math.cos(angle),
        y: cy + ry * ring * Math.sin(angle),
      });
    }
  }
  const frontY = cy + ry * 0.65;
  for (const offset of FRONT_LIP_X_OFFSETS) {
    points.push({ x: cx + radius * offset, y: frontY });
  }
  return points;
}

/** 적 바운딩 박스 내접 타원이 한 점을 가리는지 판정한다(모서리 투명 여백 오탐 제외). */
export function enemyCoversPoint(enemy: EnemyFootprint, px: number, py: number): boolean {
  if (px < enemy.left || px > enemy.right || py < enemy.top || py > enemy.bottom) return false;
  const rx = Math.max(1, (enemy.right - enemy.left) * 0.46);
  const ry = Math.max(1, (enemy.bottom - enemy.top) * 0.48);
  const dx = (px - (enemy.left + enemy.right) * 0.5) / rx;
  const dy = (py - (enemy.top + enemy.bottom) * 0.5) / ry;
  return dx * dx + dy * dy <= 1;
}

/** 설치 칸보다 앞에 있는 적들이 표본점을 가리는 비율(0~1)을 계산한다. */
export function padOcclusionRatio(
  padY: number,
  samples: readonly PadSamplePoint[],
  enemies: readonly EnemyFootprint[],
): number {
  if (samples.length === 0 || enemies.length === 0) return 0;
  let covered = 0;
  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i]!;
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j]!;
      if (e.footY >= padY && enemyCoversPoint(e, pt.x, pt.y)) {
        covered++;
        break;
      }
    }
  }
  return covered / samples.length;
}

/** 육각 6개 꼭짓점의 R04 짧은 L자 모서리 선분(총 12개)을 계산한다. */
export function padCornerSegments(
  cx: number,
  cy: number,
  radius: number,
  squash: number,
  padY: number,
  enemies: readonly EnemyFootprint[],
): PadCornerSegment[] {
  const ry = radius * squash;
  const vertices: PadSamplePoint[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    vertices.push({ x: cx + radius * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  const segments: PadCornerSegment[] = [];
  for (let i = 0; i < 6; i++) {
    const cur = vertices[i]!;
    const prev = vertices[(i + 5) % 6]!;
    const next = vertices[(i + 1) % 6]!;
    let overlap = false;
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j]!;
      if (e.footY >= padY && enemyCoversPoint(e, cur.x, cur.y)) {
        overlap = true;
        break;
      }
    }
    const ratio = overlap ? R6_PAD_CORNER_RATIO_OVERLAP : R6_PAD_CORNER_RATIO_CLEAR;
    const alpha = overlap ? R6_PAD_CORNER_ALPHA_OVERLAP : R6_PAD_CORNER_ALPHA_CLEAR;
    segments.push(
      {
        x1: cur.x,
        y1: cur.y,
        x2: cur.x + (prev.x - cur.x) * ratio,
        y2: cur.y + (prev.y - cur.y) * ratio,
        alpha,
      },
      {
        x1: cur.x,
        y1: cur.y,
        x2: cur.x + (next.x - cur.x) * ratio,
        y2: cur.y + (next.y - cur.y) * ratio,
        alpha,
      },
    );
  }
  return segments;
}

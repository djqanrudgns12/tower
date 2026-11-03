import type { MapConfig } from '../contracts/maps';
import { artRect, resolvePlacements, seedOf, type MapLayout } from './layouts';

// 살아 있는 분위기(구름 그림자·나비·잔물결·시간 흐름)의 값과 식. Phaser를 모르는 순수 함수라 단위 시험이 같은 식을 쓴다.
// 원칙: 적·타워·길의 가독성이 먼저다. 모든 효과는 은은하게(알파 낮게, 번쩍임·빛 번짐 없음), 개체 수는 적게(크롬북).

/** 결정론적 난수(mulberry32). 맵 id에서 시드를 만들어 새로고침해도 같은 자리에서 시작한다. 도메인 PRNG와 무관한 시각 전용이다. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ambientSeed = (mapId: string, salt: string) => seedOf(`${mapId}:${salt}`);

// ── 시간 흐름: 아침 → 노을 → 밤 ───────────────────────────────────────────────────────────────

export interface Tint { color: number; alpha: number }

/** 하루가 도는 웨이브 수. 웨이브 1이 아침, 9가 노을, 17이 밤이고 25(=1)에 다시 아침이다. 판이 길어져도 같은 하루가 되풀이된다. */
export const DAY_WAVES = 24;
/** 색조 층의 최대 알파(월드 전체 위에 얹히므로 가독성을 해치지 않게 낮게 묶는다). */
export const TINT_ALPHA_MAX = 0.12;
const DAY: ReadonlyArray<readonly [number, Tint]> = [
  [1, { color: 0xffe9b0, alpha: 0.05 }],
  [9, { color: 0xff8f4a, alpha: 0.08 }],
  [17, { color: 0x22306e, alpha: 0.11 }],
  [1 + DAY_WAVES, { color: 0xffe9b0, alpha: 0.05 }],
];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpColor = (a: number, b: number, k: number) =>
  (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));

/** 웨이브(1부터)의 하루 중 색조. 키 사이는 색·알파를 직선으로 잇는다. */
export function timeOfDay(wave: number): Tint {
  const w = 1 + ((((Math.max(1, Math.floor(wave)) - 1) % DAY_WAVES) + DAY_WAVES) % DAY_WAVES);
  for (let i = 1; i < DAY.length; i++) {
    const [w1, t1] = DAY[i]!, [w0, t0] = DAY[i - 1]!;
    if (w <= w1) {
      const k = (w - w0) / (w1 - w0);
      return { color: lerpColor(t0.color, t1.color, k), alpha: lerp(t0.alpha, t1.alpha, k) };
    }
  }
  return DAY[0]![1];
}

// ── 구름 그림자 ────────────────────────────────────────────────────────────────────────────────

export interface CloudSpec { x: number; y: number; w: number; h: number; speed: number }

/** 구름 그림자 셋: 크고 느리다(월드 px/초). 지면 위(타워·적 아래)에만 드리우고 서로 다른 높이로 지나간다. */
export const CLOUD_ALPHA = 0.18;
export function cloudSpecs(mapId: string, worldW: number, worldH: number, cellPx: number): CloudSpec[] {
  const r = rng(ambientSeed(mapId, 'cloud'));
  const rows = [0.22, 0.52, 0.82];
  return rows.map((row, i) => {
    const w = (5.2 + r() * 3) * cellPx;
    return { x: r() * (worldW + w) - w / 2, y: worldH * row + (r() - 0.5) * cellPx, w, h: w * (0.38 + r() * 0.12), speed: (0.09 + 0.05 * r() + 0.02 * i) * cellPx };
  });
}

/** 구름 그림자를 dtSec만큼 오른쪽으로 보내고, 완전히 나가면 반대편 밖에서 다시 들어오게 한다. */
export function cloudStep(c: CloudSpec, dtSec: number, worldW: number): CloudSpec {
  const x = c.x + c.speed * dtSec;
  return { ...c, x: x - c.w / 2 > worldW ? -c.w / 2 : x };
}

// ── 나비 ────────────────────────────────────────────────────────────────────────────────────────

export interface Wanderer { x: number; y: number; tx: number; ty: number; speed: number; rest: number }
export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export const BUTTERFLY_COUNT = 3;
/** 나비가 다니는 범위: 세계 가장자리에서 1칸 안쪽. */
export const butterflyBounds = (worldW: number, worldH: number, cellPx: number): Bounds => ({ x0: cellPx, y0: cellPx, x1: worldW - cellPx, y1: worldH - cellPx });

const pick = (r: () => number, b: Bounds) => ({ tx: b.x0 + r() * (b.x1 - b.x0), ty: b.y0 + r() * (b.y1 - b.y0) });

export function butterflySpecs(mapId: string, b: Bounds, cellPx: number): Wanderer[] {
  const r = rng(ambientSeed(mapId, 'butterfly'));
  return Array.from({ length: BUTTERFLY_COUNT }, () => {
    const at = pick(r, b), to = pick(r, b);
    return { x: at.tx, y: at.ty, ...to, speed: (0.22 + 0.12 * r()) * cellPx, rest: 0 };
  });
}

/** 한 걸음: 목표를 향해 천천히 날고, 닿으면 잠깐 앉았다가 새 목표를 고른다. 범위 밖으로 나가지 않는다. */
export function butterflyStep(w: Wanderer, dtSec: number, r: () => number, b: Bounds): Wanderer {
  if (w.rest > 0) return { ...w, rest: Math.max(0, w.rest - dtSec) };
  const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy), step = w.speed * dtSec;
  if (d <= step) return { ...w, x: w.tx, y: w.ty, ...pick(r, b), rest: 0.4 + r() * 1.2 };
  return { ...w, x: w.x + (dx / d) * step, y: w.y + (dy / d) * step };
}

// ── 잔물결 ──────────────────────────────────────────────────────────────────────────────────────

/** 물 면 타원(월드 px). */
export interface WaterSpot { x: number; y: number; rx: number; ry: number }

/** 원화에서 물 면(파란 픽셀)의 중심·반지름 비율(그림 너비·높이 대비). landmark.pond.r1.png에서 쟀다. */
export const WATER_ART: Readonly<Record<string, { cx: number; cy: number; rx: number; ry: number }>> = {
  'landmark.pond': { cx: 0.522, cy: 0.556, rx: 0.327, ry: 0.185 },
};

/** 배치표의 물 그림 위치에서 물 면을 구한다. 물이 없는 맵(배치표 없음 포함)은 빈 배열이다. sizeOf는 그림의 원본 크기다. */
export function waterSpots(layout: MapLayout | null, map: MapConfig, cellPx: number, sizeOf: (asset: string) => { width: number; height: number } | null): WaterSpot[] {
  if (!layout) return [];
  return resolvePlacements(layout, map).flatMap(p => {
    const art = WATER_ART[p.asset], size = art ? sizeOf(p.asset) : null;
    if (!art || !size) return [];
    const r = artRect(p, size.width, size.height);
    return [{ x: (r.left + art.cx * r.width) * cellPx, y: (r.top + art.cy * r.height) * cellPx, rx: art.rx * r.width * cellPx, ry: art.ry * r.height * cellPx }];
  });
}

/** 잔물결 동시에 떠 있는 고리 수와 한 고리의 수명(ms). */
export const RIPPLE_COUNT = 3;
export const RIPPLE_MS = 3600;
export const RIPPLE_ALPHA = 0.4;

export interface RippleFrame { x: number; y: number; rx: number; ry: number; alpha: number }

/**
 * k번째 고리의 지금 모습. 고리는 물 면 안 한 자리에서 퍼지며 옅어지고, 수명이 끝나면 다른 자리에서 다시 시작한다.
 * 자리·크기는 물 면의 55%·35% 안이라 물가 밖으로 나가지 않는다.
 */
export function rippleFrame(spot: WaterSpot, k: number, timeMs: number, spotIndex = 0): RippleFrame {
  const offset = (k * RIPPLE_MS) / RIPPLE_COUNT, shifted = timeMs + offset;
  const cycle = Math.floor(shifted / RIPPLE_MS), t = (shifted - cycle * RIPPLE_MS) / RIPPLE_MS;
  const r = rng(ambientSeed('ripple', `${spotIndex}:${k}:${cycle}`));
  const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * 0.55;
  const grow = 0.08 + 0.27 * (1 - (1 - t) ** 2);
  return { x: spot.x + Math.cos(ang) * dist * spot.rx, y: spot.y + Math.sin(ang) * dist * spot.ry, rx: grow * spot.rx, ry: grow * spot.ry, alpha: RIPPLE_ALPHA * (1 - t) };
}

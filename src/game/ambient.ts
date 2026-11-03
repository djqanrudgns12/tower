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
/** 색조 키: [웨이브, 색조]. 키 사이는 직선으로 잇고, 마지막 키(다음 날 아침)는 첫 키와 같은 색이다. */
export type TintTable = ReadonlyArray<readonly [number, Tint]>;

/** 하루가 도는 웨이브 수. 웨이브 1이 아침, 9가 노을, 15~19가 밤이고 25(=1)에 다시 아침이다. 판이 길어져도 같은 하루가 되풀이된다. */
export const DAY_WAVES = 24;
/** 색조 층의 최대 알파(월드 전체 위에 얹히므로 적·길·문제판 가독성을 해치지 않게 0.2 안쪽으로 묶는다). */
export const TINT_ALPHA_MAX = 0.2;
/** 밤은 15~19웨이브가 가장 깊고(푸른빛, 알파 0.2), 노을(웨이브 9)은 주황빛 알파 0.17이다. 낮(웨이브 1)은 연노랑 0.05로 낮과 밤이 한눈에 구별된다. */
export const DAY_TINTS: TintTable = [
  [1, { color: 0xffe9b0, alpha: 0.05 }],
  [9, { color: 0xff6f2e, alpha: 0.17 }],
  [15, { color: 0x1a2fb0, alpha: 0.2 }],
  [19, { color: 0x1a2fb0, alpha: 0.2 }],
  [1 + DAY_WAVES, { color: 0xffe9b0, alpha: 0.05 }],
];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpColor = (a: number, b: number, k: number) =>
  (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));

/** 웨이브(1부터)의 하루 중 색조. 키 사이는 색·알파를 직선으로 잇는다. */
export function timeOfDay(wave: number, table: TintTable = DAY_TINTS): Tint {
  const w = 1 + ((((Math.max(1, Math.floor(wave)) - 1) % DAY_WAVES) + DAY_WAVES) % DAY_WAVES);
  for (let i = 1; i < table.length; i++) {
    const [w1, t1] = table[i]!, [w0, t0] = table[i - 1]!;
    if (w <= w1) {
      const k = (w - w0) / (w1 - w0);
      return { color: lerpColor(t0.color, t1.color, k), alpha: lerp(t0.alpha, t1.alpha, k) };
    }
  }
  return table[0]![1];
}

// ── 구름 그림자 ────────────────────────────────────────────────────────────────────────────────

export interface CloudSpec { x: number; y: number; w: number; h: number; speed: number }

/** 구름 그림자 셋: 크고 느리다(월드 px/초). 지면 위(타워·적 아래)에만 드리우고 서로 다른 높이로 지나간다. */
export const CLOUD_ALPHA = 0.18;
/** 원화(fx.cloudshadow.0~2, 진한 청회색)의 표시 알파: 그림 한 장마다 0.10~0.16 안에서 조금씩 다르다. 코드 그림(옛 임시 그림)은 CLOUD_ALPHA를 쓴다. */
export const CLOUD_ART_ALPHA: readonly number[] = [0.13, 0.16, 0.1];
/** 원화는 512px 정사각 그림 안에서 구름 몸통이 너비의 약 65%이므로, 코드 그림의 상자 너비(w)보다 이만큼 크게 펴서 몸통 크기를 비슷하게 맞춘다. */
export const CLOUD_ART_SCALE = 1.1;
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

/** 정원 기본 마릿수(맵별 마릿수는 AMBIENT_SETTINGS). */
export const BUTTERFLY_COUNT = 3;
/** 나비 그림 상자 폭(칸). 원화(fx.butterfly.*, 64px 정사각)는 상자 안 여백 때문에 보이는 날개가 이보다 작다(1440 화면에서 약 30px). */
export const BUTTERFLY_CELLS = 0.4;
/** 나비가 다니는 범위: 세계 가장자리에서 1칸 안쪽. */
export const butterflyBounds = (worldW: number, worldH: number, cellPx: number): Bounds => ({ x0: cellPx, y0: cellPx, x1: worldW - cellPx, y1: worldH - cellPx });

const pick = (r: () => number, b: Bounds) => ({ tx: b.x0 + r() * (b.x1 - b.x0), ty: b.y0 + r() * (b.y1 - b.y0) });

export function butterflySpecs(mapId: string, b: Bounds, cellPx: number, count = BUTTERFLY_COUNT): Wanderer[] {
  const r = rng(ambientSeed(mapId, 'butterfly'));
  return Array.from({ length: count }, () => {
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

/** 원화 안 물 면 타원: 중심·반지름을 그림 너비·높이에 대한 비율로 쟀다(파란 픽셀 분포). */
export interface WaterEllipse { cx: number; cy: number; rx: number; ry: number }
/** 그림 id → 그 그림 안의 물 면들(배·다리·바위를 피해 맑은 물 위에만 둔다). */
export type WaterArtTable = Readonly<Record<string, readonly WaterEllipse[]>>;

/** 정원 연못(landmark.pond.r1.png에서 쟀다). */
export const WATER_ART: WaterArtTable = {
  'landmark.pond': [{ cx: 0.522, cy: 0.556, rx: 0.327, ry: 0.185 }],
};

/** 배치표의 물 그림 위치에서 물 면을 구한다. 물이 없는 맵(배치표 없음 포함)은 빈 배열이다. sizeOf는 그림의 원본 크기다. */
export function waterSpots(layout: MapLayout | null, map: MapConfig, cellPx: number, sizeOf: (asset: string) => { width: number; height: number } | null, water: WaterArtTable = WATER_ART): WaterSpot[] {
  if (!layout) return [];
  return resolvePlacements(layout, map).flatMap(p => {
    const arts = water[p.asset], size = arts ? sizeOf(p.asset) : null;
    if (!arts || !size) return [];
    const r = artRect(p, size.width, size.height);
    return arts.map(a => ({ x: (r.left + a.cx * r.width) * cellPx, y: (r.top + a.cy * r.height) * cellPx, rx: a.rx * r.width * cellPx, ry: a.ry * r.height * cellPx }));
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

// ── 흩날리는 입자(꽃잎·눈송이) ───────────────────────────────────────────────────────────────────

export type DriftKind = 'petal' | 'snow';

/** 하늘에서 천천히 내려오는 입자 하나. 속도는 월드 px/초이고, 좌우 흔들림은 그리는 쪽이 시계와 phase로 더한다. */
export interface Drifter { x: number; y: number; vx: number; vy: number; phase: number; size: number; spin: number; rot: number }

/** 입자가 세계 밖에서 다시 들어오는 여백(월드 px). */
export const DRIFT_MARGIN = 12;
/** 입자 종류별 속도·크기 범위(월드 px). 꽃잎은 바람에 실려 비스듬히, 눈송이는 거의 곧게 천천히 내린다. 둘 다 적·길을 가리지 않게 작다. */
export const DRIFT_LOOK: Readonly<Record<DriftKind, { vx: readonly [number, number]; vy: readonly [number, number]; size: readonly [number, number]; alpha: number }>> = {
  petal: { vx: [12, 22], vy: [11, 19], size: [6, 8.5], alpha: 0.85 },
  snow: { vx: [2, 8], vy: [15, 27], size: [2.6, 4.4], alpha: 0.8 },
};

/** 맵 id로 정해지는 시작 자리·속도. 새로고침해도 같은 자리에서 시작한다. */
export function driftSpecs(mapId: string, kind: DriftKind, count: number, worldW: number, worldH: number): Drifter[] {
  const r = rng(ambientSeed(mapId, `drift:${kind}`)), look = DRIFT_LOOK[kind];
  const between = ([a, b]: readonly [number, number]) => a + (b - a) * r();
  return Array.from({ length: count }, () => ({
    x: r() * worldW, y: r() * worldH, vx: between(look.vx), vy: between(look.vy), phase: r() * Math.PI * 2, size: between(look.size), spin: (r() - 0.5) * 2.4, rot: r() * Math.PI * 2,
  }));
}

/** 한 걸음: 바람을 따라 흐르다가 아래·오른쪽 밖으로 나가면 위·왼쪽 밖의 새 자리에서 다시 들어온다. */
export function driftStep(d: Drifter, dtSec: number, r: () => number, worldW: number, worldH: number): Drifter {
  let { x, y } = d;
  x += d.vx * dtSec; y += d.vy * dtSec;
  if (y > worldH + DRIFT_MARGIN) { y = -DRIFT_MARGIN; x = r() * (worldW + 2 * DRIFT_MARGIN) - DRIFT_MARGIN; }
  if (x > worldW + DRIFT_MARGIN) x = -DRIFT_MARGIN;
  return { ...d, x, y, rot: d.rot + d.spin * dtSec };
}

// ── 맵별 분위기 설정 ──────────────────────────────────────────────────────────────────────────────

export type ButterflyColor = 'yellow' | 'white';

/** 한 맵의 분위기 요소. 표에 없는 요소는 그리지 않는다. */
export interface AmbientSettings {
  /** 구름 그림자(셋). */
  clouds: boolean;
  /** 나비 색 순서. 마릿수는 길이다. */
  butterflies: readonly ButterflyColor[];
  /** 잔물결이 일어나는 물 그림(그림 id → 물 면). 배치표에 그 그림이 있어야 한다. */
  water: WaterArtTable;
  /** 흩날리는 입자(코드로 그린 작은 꽃잎·눈송이). */
  drift: { kind: DriftKind; count: number } | null;
  /** 하루의 색조 표. */
  tint: TintTable;
}

/**
 * 맵 id별 설정. 정원은 나비·연못 잔물결, 강가는 나비(잠자리 대신)·물레방아와 나루 위 물비늘, 궁궐 뜰은 흩날리는 꽃잎,
 * 설원은 눈송이(언 연못은 물결이 없다)다. 모든 개체는 적게(크롬북), 가독성이 먼저다.
 */
export const AMBIENT_SETTINGS: Readonly<Record<string, AmbientSettings>> = {
  garden_u: { clouds: true, butterflies: ['yellow', 'white', 'yellow'], water: WATER_ART, drift: null, tint: DAY_TINTS },
  river_z: {
    clouds: true, butterflies: ['white', 'yellow', 'white'], drift: null, tint: DAY_TINTS,
    water: {
      // 나루: 다리·배를 피한 맑은 물 세 곳. 물레방아: 바퀴 아래 개울 두 곳(원화에서 쟀다).
      'map.river_z.landmark.ferry': [{ cx: 0.703, cy: 0.391, rx: 0.088, ry: 0.044 }, { cx: 0.703, cy: 0.766, rx: 0.082, ry: 0.04 }, { cx: 0.422, cy: 0.375, rx: 0.07, ry: 0.034 }],
      'map.river_z.landmark.watermill': [{ cx: 0.484, cy: 0.766, rx: 0.089, ry: 0.022 }, { cx: 0.344, cy: 0.836, rx: 0.078, ry: 0.02 }],
    },
  },
  courtyard: { clouds: true, butterflies: [], water: {}, drift: { kind: 'petal', count: 12 }, tint: DAY_TINTS },
  snow_step: { clouds: true, butterflies: [], water: {}, drift: { kind: 'snow', count: 24 }, tint: DAY_TINTS },
};

/** 표에 없는 맵(새 맵·시험용)은 정원과 같은 요소를 쓴다. */
export const ambientSettings = (mapId: string): AmbientSettings => AMBIENT_SETTINGS[mapId] ?? AMBIENT_SETTINGS.garden_u!;

// ── 원화 고르기 ──────────────────────────────────────────────────────────────────────────────────

export const CLOUD_ART_KEYS = ['fx.cloudshadow.0', 'fx.cloudshadow.1', 'fx.cloudshadow.2'] as const;
export const butterflyArtKeys = (color: ButterflyColor): readonly [string, string] => [`fx.butterfly.${color}.0`, `fx.butterfly.${color}.1`];

/** 구름 그림자 원화 세 장이 모두 실렸으면 그 키들, 하나라도 없으면 null(이때 코드 그림을 쓴다). has는 텍스처 존재 여부(Phaser textures.exists)다. */
export const cloudArt = (has: (key: string) => boolean): readonly string[] | null => (CLOUD_ART_KEYS.every(has) ? CLOUD_ART_KEYS : null);

/** 나비 한 색의 날갯짓 두 프레임(0 펼침, 1 접음)이 모두 실렸으면 그 키, 아니면 null(코드 그림). */
export const butterflyArt = (color: ButterflyColor, has: (key: string) => boolean): readonly [string, string] | null => {
  const keys = butterflyArtKeys(color);
  return keys.every(has) ? keys : null;
};

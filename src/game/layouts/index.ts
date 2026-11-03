import { z } from 'zod';
import type { MapConfig } from '../../contracts/maps';
import gardenU from './garden_u.layout.json';
import courtyard from './courtyard.layout.json';
import riverZ from './river_z.layout.json';
import snowStep from './snow_step.layout.json';

export { GROUND_KITS, groundKitFor, type GroundKit } from './kits';

// 맵별 손 배치표(art-bible-v2 §2). 배치표가 있는 맵만 새 지면 조립(layoutGround.ts)을 쓰고(재료는 kits.ts의 맵별 묶음),
// 없는 맵은 기존 composeGroundArt/drawGround로 그린다. 정원은 ART-R1·R2, 강가·궁궐 뜰·설원은 R3 P3 재료다.
// 이 파일은 Phaser를 모른다. 단위 시험이 같은 기하(배치 위치·길 중심선·풀 마스크)를 그대로 쓴다.

export const PLACEMENT_KINDS = ['meadow', 'landmark', 'rock', 'prop', 'pathEdge', 'edge', 'grove'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

const num = z.number().finite();
const placementSchema = z.object({
  key: z.string().min(1),
  /**
   * meadow: 길 아래 지면 얼룩 · landmark·rock·prop·pathEdge: 길 위 지면에 굽는다 ·
   * edge: 맵 가장자리 숲·덤불, grove: 안쪽 작은 숲 덩이(둘 다 깊이 정렬 이미지, grove는 발밑을 그늘 풀로 덮는다).
   */
  kind: z.enum(PLACEMENT_KINDS),
  asset: z.string().min(1),
  /** 표시 너비(칸). 높이는 그림 비율을 따른다. */
  w: num.positive(),
  x: num.optional(),
  y: num.optional(),
  origin: z.tuple([num, num]).optional(),
  decorationIds: z.array(z.string().min(1)).min(1).optional(),
  offset: z.tuple([num, num]).optional(),
  /** 같은 무리. 장식 칸을 맡은 배치와 같은 무리의 소품은 그 장식을 꾸미는 것이라 장식 칸에 겹쳐도 된다. */
  group: z.string().optional(),
}).strict().refine(p => p.decorationIds !== undefined || (p.x !== undefined && p.y !== undefined), '좌표나 장식 칸이 필요하다');

export const mapLayoutSchema = z.object({
  schemaVersion: z.literal('1'),
  mapId: z.string().min(1),
  source: z.string(),
  coordinateConvention: z.string(),
  notes: z.array(z.string()).optional(),
  /** 굽이 바퀴 자국: [칸 단위 타원 상자 x0,y0,x1,y1], 시작 각도, 끝 각도(도, 3시 방향에서 시계 방향). */
  wheelRuts: z.array(z.tuple([z.tuple([num, num, num, num]), num, num])),
  placements: z.array(placementSchema).min(1),
}).strict();

export type MapLayout = z.infer<typeof mapLayoutSchema>;
export type LayoutPlacement = MapLayout['placements'][number];

/** 배치표 원본(시험이 형식 오류를 잡도록 그대로 내보낸다). */
export const RAW_LAYOUTS: Record<string, unknown> = { garden_u: gardenU, river_z: riverZ, courtyard, snow_step: snowStep };

const LAYOUTS = new Map<string, MapLayout>();
for (const [id, raw] of Object.entries(RAW_LAYOUTS)) {
  const parsed = mapLayoutSchema.safeParse(raw);
  // 형식이 깨진 배치표는 쓰지 않고 기존 지면으로 되돌아간다(시험이 실패를 알린다).
  if (parsed.success && parsed.data.mapId === id) LAYOUTS.set(id, parsed.data);
}

export const layoutFor = (mapId: string): MapLayout | null => LAYOUTS.get(mapId) ?? null;

/** 비석(deco.stele)의 기준점 세로 비율(그림 높이 대비). 칸 위로 솟게 두되, 맨 윗줄 칸이면 위·새김 글자가 잘리지 않게 낮춘다. 그리는 쪽(GroundLayer)과 가림 시험이 같은 값을 쓴다. */
export const steleOriginY = (cellY: number) => (cellY === 0 ? 0.55 : 0.85);

/** 배치표가 맡은 장식 id. 이 장식 칸에는 기본 나무·바위를 세우지 않는다. */
export const claimedDecorations = (layout: MapLayout) => new Set(layout.placements.flatMap(p => p.decorationIds ?? []));

/** 칸 좌표로 풀어 놓은 배치. cx·cy는 기준점(칸), w는 표시 너비(칸), ox·oy는 그림 안 기준점 비율. */
export interface PlacedArt {
  key: string;
  kind: PlacementKind;
  asset: string;
  cx: number;
  cy: number;
  w: number;
  ox: number;
  oy: number;
}

export function resolvePlacements(layout: MapLayout, map: MapConfig): PlacedArt[] {
  const decor = new Map(map.decorations.map(d => [d.id, d.cells]));
  const out: PlacedArt[] = [];
  for (const p of layout.placements) {
    let x = p.x, y = p.y;
    if (p.decorationIds) {
      const cells = p.decorationIds.flatMap(id => decor.get(id) ?? []);
      if (cells.length === 0) continue;
      const [dx, dy] = p.offset ?? [0, 0];
      x = cells.reduce((s, c) => s + c[0], 0) / cells.length + dx;
      y = cells.reduce((s, c) => s + c[1], 0) / cells.length + dy;
    }
    if (x === undefined || y === undefined) continue;
    const [ox, oy] = p.origin ?? [0.5, 0.5];
    out.push({ key: p.key, kind: p.kind, asset: p.asset, cx: x + 0.5, cy: y + 0.5, w: p.w, ox, oy });
  }
  return out;
}

/** 배치 그림이 차지하는 사각형(칸). 그리는 쪽(layoutGround)과 가림 시험이 같은 식을 쓴다. */
export function artRect(p: PlacedArt, imageWidth: number, imageHeight: number) {
  const w = p.w, h = (w * imageHeight) / imageWidth;
  return { left: p.cx - p.ox * w, top: p.cy - p.oy * h, width: w, height: h };
}

/**
 * 길 중심선의 꺾임점(칸 좌표). 논리 중심선은 칸 중심을 지난다. 입구는 맵 밖으로 한 칸 늘리고,
 * 출구가 맵 가장자리에 있으면 출구도 밖으로 한 칸 늘려 길이 화면 밖으로 이어지게 한다.
 */
export function pathPolyline(map: MapConfig): Array<[number, number]> {
  const cells = map.pathCells;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!, prev = cells[i - 1], next = cells[i + 1];
    const turn = !prev || !next || (c[0] - prev[0] !== next[0] - c[0]) || (c[1] - prev[1] !== next[1] - c[1]);
    if (turn) pts.push([c[0] + 0.5, c[1] + 0.5]);
  }
  const [a, b] = [cells[0]!, cells[1]!];
  pts.unshift([a[0] + 0.5 + Math.sign(a[0] - b[0]), a[1] + 0.5 + Math.sign(a[1] - b[1])]);
  const [z, y] = [cells[cells.length - 1]!, cells[cells.length - 2]!];
  const onEdge = z[0] === 0 || z[1] === 0 || z[0] === map.gridWidth - 1 || z[1] === map.gridHeight - 1;
  if (onEdge) pts.push([z[0] + 0.5 + Math.sign(z[0] - y[0]), z[1] + 0.5 + Math.sign(z[1] - y[1])]);
  return pts;
}

/** 점과 꺾은선 사이 최단 거리(칸). */
export function distanceToPolyline(px: number, py: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!;
    const vx = bx - ax, vy = by - ay, len = vx * vx + vy * vy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len));
    best = Math.min(best, Math.hypot(px - (ax + t * vx), py - (ay + t * vy)));
  }
  return best;
}

/** 문자열 시드(FNV-1a 32비트). 맵 id가 같으면 지면 무늬도 같다. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

const lattice = (x: number, y: number, seed: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** 값 잡음: 격자 꼭짓점 난수를 5차 곡선으로 부드럽게 잇는다(0..1). */
function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const u = fade(x - ix), v = fade(y - iy);
  const a = lattice(ix, iy, seed), b = lattice(ix + 1, iy, seed), c = lattice(ix, iy + 1, seed), d = lattice(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 덩어리 주기(칸). 첫째는 4.4칸, 둘째는 비스듬히 돌린 3.2칸이라 두 격자 방향이 겹쳐 보이지 않는다. */
const FIELD_PERIODS = [4.4, 3.2] as const;

/** 맵 id로 정해지는 저주파 장(0..1). 칸 3~5개 크기의 부드러운 덩어리를 만든다. */
export function lowFrequencyField(mapId: string): (x: number, y: number) => number {
  const seed = seedOf(mapId);
  const r = (k: number) => lattice(k, 7919, seed);
  const [p1, p2] = FIELD_PERIODS;
  const ox1 = r(1) * 97, oy1 = r(2) * 97, ox2 = r(3) * 97, oy2 = r(4) * 97;
  const angle = 0.45 + r(5) * 0.5, ca = Math.cos(angle), sa = Math.sin(angle);
  const seed2 = (seed ^ 0x9e3779b9) >>> 0;
  return (x, y) => {
    const n1 = valueNoise(x / p1 + ox1, y / p1 + oy1, seed);
    const n2 = valueNoise((x * ca - y * sa) / p2 + ox2, (x * sa + y * ca) / p2 + oy2, seed2);
    return 0.62 * n1 + 0.38 * n2;
  };
}

const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 그늘 웅덩이: 숲 덩이 발밑을 그늘 풀로 덮는 타원(칸). 가장자리는 부드럽게 0으로 줄어든다. */
export interface ShadePool { x: number; y: number; rx: number; ry: number }

/**
 * 풀 3톤 섞기 마스크. 표본 한 개가 1/samplesPerCell칸이다. 장의 하위 30%는 그늘, 상위 30%는 밝은 풀,
 * 가운데는 기본 풀이다. 경계는 분위수 ±0.12 구간(약 1칸 폭)에서 부드럽게 바뀐다. 그늘 웅덩이 안은 그늘로 덮고 볕을 지운다.
 * 값은 0..1(최대 세기는 그리는 쪽이 정한다).
 */
export function grassMasks(mapId: string, cols: number, rows: number, samplesPerCell: number, pools: readonly ShadePool[] = []) {
  const field = lowFrequencyField(mapId);
  const n = cols * rows * samplesPerCell * samplesPerCell;
  const w = cols * samplesPerCell, h = rows * samplesPerCell;
  const raw = new Float32Array(n);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) raw[j * w + i] = field((i + 0.5) / samplesPerCell, (j + 0.5) / samplesPerCell);
  const sorted = Float32Array.from(raw).sort();
  const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * n))]!;
  const lo = q(0.3), hi = q(0.7), band = 0.12;
  const light = new Float32Array(n), shade = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const v = raw[k]!;
    let pool = 0;
    if (pools.length) {
      const x = ((k % w) + 0.5) / samplesPerCell, y = (Math.floor(k / w) + 0.5) / samplesPerCell;
      for (const p of pools) pool = Math.max(pool, 1 - smooth(0.45, 1, Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry)));
    }
    shade[k] = Math.max(1 - smooth(lo - band, lo + band, v), pool);
    light[k] = smooth(hi - band, hi + band, v) * (1 - pool);
  }
  return { width: w, height: h, light, shade };
}

/** 둥근 굽이를 넣은 길 중심선 표본. s는 시작점부터의 길이(칸). 굽이는 반지름 corner칸의 원호(캔버스 arcTo와 같은 모양). */
export function pathCenterline(map: MapConfig, corner: number, step: number): Array<{ x: number; y: number; s: number }> {
  const pts = pathPolyline(map);
  // 직선 구간과 원호를 차례로 모은다.
  const parts: Array<(t: number) => [number, number]> = [], lens: number[] = [];
  let cur: [number, number] = pts[0]!;
  const line = (to: [number, number]) => {
    const from = cur, len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (len > 1e-9) { parts.push(t => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]); lens.push(len); }
    cur = to;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!, p = pts[i]!, b = pts[i + 1]!;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ua = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], ub = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
    const cos = ua[0]! * ub[0]! + ua[1]! * ub[1]!;
    if (cos < -0.999) { line(p); continue; }
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
    const r = Math.min(corner, (Math.min(la, lb) / 2) * Math.tan(half));
    const d = r / Math.tan(half);
    const t1: [number, number] = [p[0] + ua[0]! * d, p[1] + ua[1]! * d], t2: [number, number] = [p[0] + ub[0]! * d, p[1] + ub[1]! * d];
    const bis = [ua[0]! + ub[0]!, ua[1]! + ub[1]!], bl = Math.hypot(bis[0]!, bis[1]!);
    const c = [p[0] + (bis[0]! / bl) * (r / Math.sin(half)), p[1] + (bis[1]! / bl) * (r / Math.sin(half))];
    line(t1);
    const a1 = Math.atan2(t1[1] - c[1]!, t1[0] - c[0]!);
    let sweep = Math.atan2(t2[1] - c[1]!, t2[0] - c[0]!) - a1;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    parts.push(t => [c[0]! + r * Math.cos(a1 + sweep * t), c[1]! + r * Math.sin(a1 + sweep * t)]);
    lens.push(Math.abs(sweep) * r);
    cur = t2;
  }
  line(pts[pts.length - 1]!);
  const total = lens.reduce((a, b) => a + b, 0);
  const out: Array<{ x: number; y: number; s: number }> = [];
  let k = 0, start = 0;
  for (let s = 0; s <= total + 1e-9; s += step) {
    while (k < lens.length - 1 && s > start + lens[k]!) { start += lens[k]!; k++; }
    const [x, y] = parts[k]!(Math.min(1, (s - start) / lens[k]!));
    out.push({ x, y, s });
  }
  return out;
}

/** 길이(칸)를 따라 부드럽게 변하는 1차원 잡음(-1..1). 길 폭·가장자리 띠의 결정론적 흔들림에 쓴다. */
export function lineNoise(mapId: string, salt: number, period: number): (s: number) => number {
  const seed = (seedOf(mapId) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  return s => {
    const t = s / period, i = Math.floor(t), f = fade(t - i);
    const a = lattice(i, 0, seed), b = lattice(i + 1, 0, seed);
    return (a + (b - a) * f) * 2 - 1;
  };
}

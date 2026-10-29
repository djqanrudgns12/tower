import Phaser from 'phaser';
import type { EnemyKind, TowerId } from '../contracts/balance';
import type { MapConfig } from '../contracts/maps';
import { ASSETS, CELL_PX, TEX } from './assets';

// 41번 화풍(밝은 풀색·황토 길·둥근 실루엣·좌상단 광원·3단 이하 명암)의 임시 그림.
// Codex 원화가 인수되면 같은 키의 PNG가 이 그림을 대신한다(art 대체는 BattleScene.preload에서 판단).
export const PALETTE = {
  outline: 0x3a291e,
  grass: 0x7cbc4c, grassDark: 0x64a23e, grassLight: 0x98cd63,
  dirt: 0xdcb878, dirtEdge: 0xb38a55, dirtLight: 0xe8cd95,
  stone: 0xb3ada3, stoneDark: 0x857e74, stoneLight: 0xd4cec3,
  wood: 0x8c5a33, woodDark: 0x5f3b1f, woodLight: 0xb07b48,
  leaf: 0x3f8f3a, leafDark: 0x2f6e2f, leafLight: 0x62ad4d,
  bronze: 0xb88a3c, iron: 0x3b3f46, ironLight: 0x5d636c,
  ice: 0x8fd3f0, iceDark: 0x4fa3d6, iceLight: 0xe6f7ff,
  flowerA: 0xf4d35e, flowerB: 0xf29a8a, cream: 0xf5ebd4,
} as const;

const C = CELL_PX * TEX;
const hash = (x: number, y: number, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
/** 셀 좌표로 정해지는 시각 난수(도메인 PRNG와 무관). */
export const rand01 = (x: number, y: number, k = 0) => hash(x, y, k) / 4294967296;
/** 영구 자연 장식 칸이 나무인지 바위인지(drawGround와 BattleScene이 같은 규칙을 쓴다). */
export const isTreeCell = (x: number, y: number) => rand01(x, y, 3) > 0.35;

function blob(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill: number, outline = true) {
  if (outline) { g.fillStyle(PALETTE.outline, 1); g.fillCircle(x, y, r + 3); }
  g.fillStyle(fill, 1); g.fillCircle(x, y, r);
}

function tree(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) {
  g.fillStyle(PALETTE.outline, 0.18); g.fillEllipse(cx + 6 * s, cy + 40 * s, 84 * s, 26 * s);
  g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(cx - 9 * s, cy + 4 * s, 18 * s, 38 * s, 6 * s);
  g.fillStyle(PALETTE.woodDark, 1); g.fillRoundedRect(cx - 6 * s, cy + 6 * s, 12 * s, 34 * s, 5 * s);
  blob(g, cx, cy - 10 * s, 36 * s, PALETTE.leafDark);
  g.fillStyle(PALETTE.leaf, 1); g.fillCircle(cx - 6 * s, cy - 16 * s, 30 * s);
  g.fillStyle(PALETTE.leafLight, 1); g.fillCircle(cx - 14 * s, cy - 26 * s, 14 * s);
}

function rock(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) {
  g.fillStyle(PALETTE.outline, 0.16); g.fillEllipse(cx + 4 * s, cy + 16 * s, 70 * s, 18 * s);
  g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(cx - 30 * s, cy - 22 * s, 60 * s, 42 * s, 16 * s);
  g.fillStyle(PALETTE.stoneDark, 1); g.fillRoundedRect(cx - 27 * s, cy - 19 * s, 54 * s, 36 * s, 14 * s);
  g.fillStyle(PALETTE.stone, 1); g.fillRoundedRect(cx - 27 * s, cy - 19 * s, 46 * s, 26 * s, 12 * s);
  g.fillStyle(PALETTE.stoneLight, 1); g.fillRoundedRect(cx - 20 * s, cy - 15 * s, 18 * s, 9 * s, 4 * s);
}

function bush(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, flowers: boolean) {
  blob(g, cx - 12 * s, cy, 15 * s, PALETTE.leafDark);
  blob(g, cx + 10 * s, cy + 2 * s, 13 * s, PALETTE.leafDark);
  g.fillStyle(PALETTE.leaf, 1); g.fillCircle(cx - 13 * s, cy - 3 * s, 11 * s); g.fillCircle(cx + 9 * s, cy - 1 * s, 9 * s);
  if (flowers) {
    g.fillStyle(PALETTE.flowerA, 1); g.fillCircle(cx - 16 * s, cy - 6 * s, 3.5 * s); g.fillCircle(cx + 6 * s, cy - 4 * s, 3.5 * s);
    g.fillStyle(PALETTE.flowerB, 1); g.fillCircle(cx - 4 * s, cy + 4 * s, 3.5 * s);
  }
}

function stele(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
  g.fillStyle(PALETTE.outline, 0.18); g.fillEllipse(cx + 6, cy + 44, 96, 22);
  g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(cx - 40, cy + 22, 80, 24, 6);
  g.fillStyle(PALETTE.stoneDark, 1); g.fillRoundedRect(cx - 37, cy + 25, 74, 18, 5);
  g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(cx - 28, cy - 46, 56, 74, { tl: 24, tr: 24, bl: 4, br: 4 });
  g.fillStyle(PALETTE.stone, 1); g.fillRoundedRect(cx - 25, cy - 43, 50, 68, { tl: 21, tr: 21, bl: 3, br: 3 });
  g.fillStyle(PALETTE.stoneLight, 1); g.fillRoundedRect(cx - 20, cy - 38, 12, 40, 6);
  bush(g, cx - 42, cy + 30, 0.7, true);
  bush(g, cx + 44, cy + 32, 0.6, true);
}

/** 지면 기본판: 풀·길·설치 받침·고정 장식·성문. 길과 슬롯은 데이터에서 그린다(PRD §6.2). */
export interface GroundSkip { gate: boolean; tree: boolean; stele: boolean; rock: boolean }

/** ART-002 바닥 재료 ID. 같은 ID의 PNG가 인수되면 BattleScene.preload가 싣는다. */
export const GROUND_ART = {
  grass: 'ground.grass', dirt: 'ground.dirt', patches: ['ground.patch.0', 'ground.patch.1'], slot: 'slot.base',
  small: ['deco.bush.1', 'deco.bush.0', 'deco.pebble', 'deco.flowers'], entry: 'map.entry',
} as const;
/** 길 시각 폭(칸): 흙과 가장자리 띠. 논리 중심선은 셀 중심이다(PRD §6.1 0.70~0.86). */
const PATH_WIDTH = 0.76, PATH_EDGE = 0.86;

/**
 * 인수된 바닥 재료로 지면 기본판을 조립한다(ART-002 요청서 ‘이번 방식’). 풀·흙 질감이 없으면 false를 돌려
 * 임시 그림(drawGround)을 쓰게 한다. 나무·비석·바위·성문은 BattleScene이 이미지로 세우므로 여기서 그리지 않는다.
 */
export function composeGroundArt(scene: Phaser.Scene, map: MapConfig): boolean {
  const has = (key: string) => scene.textures.exists(key);
  if (!has(GROUND_ART.grass) || !has(GROUND_ART.dirt)) return false;
  const W = 15 * C, H = 9 * C;
  const tex = scene.textures.createCanvas(ASSETS.ground.key, W, H);
  if (!tex) return false;
  const ctx = tex.getContext();
  const src = (key: string) => scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const key = (x: number, y: number) => `${x},${y}`;
  const path = new Set(map.pathCells.map(([x, y]) => key(x, y)));
  const taken = new Set([...path, ...map.slots.map(s => key(s.x, s.y)), ...map.decorations.flatMap(d => d.cells.map(([x, y]) => key(x, y)))]);
  /** 원본 비율을 지키며 cells칸 너비로 찍는다. 기준점은 manifest와 같은 비율 좌표다. */
  const stamp = (k: string, cx: number, cy: number, cells: number, originY = 0.5) => {
    const img = src(k), w = cells * C, h = (w * img.height) / img.width;
    ctx.drawImage(img, cx - w / 2, cy - originY * h, w, h);
  };

  // 질감은 칸당 128px(TEX=2)로 납품되므로 원본 크기 그대로 반복한다. 얼룩은 셀 난수로 흩뿌려 2칸 반복을 깬다.
  ctx.fillStyle = ctx.createPattern(src(GROUND_ART.grass), 'repeat')!;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
    const r = rand01(x, y, 21), patch = GROUND_ART.patches[r < 0.12 ? 0 : 1];
    if (r < 0.24 && has(patch) && !path.has(key(x, y))) stamp(patch, (x + 0.3 + rand01(x, y, 22) * 0.4) * C, (y + 0.3 + rand01(x, y, 23) * 0.4) * C, 1.5);
  }

  // 길: 셀 중심선을 둥근 이음으로 잇는다. 입구는 맵 끝에 있으므로 바깥으로 한 칸 더 그려 끊겨 보이지 않게 한다.
  const pts = map.pathCells.map(([x, y]) => [(x + 0.5) * C, (y + 0.5) * C] as const);
  const [p0, p1] = [pts[0]!, pts[1]!];
  const start = [p0[0] + Math.sign(p0[0] - p1[0]) * C, p0[1] + Math.sign(p0[1] - p1[1]) * C] as const;
  const stroke = (cells: number, style: string | CanvasPattern) => {
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    for (const [px, py] of pts) ctx.lineTo(px, py);
    ctx.lineWidth = cells * C; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = style;
    ctx.stroke();
  };
  stroke(PATH_EDGE, `#${PALETTE.dirtEdge.toString(16).padStart(6, '0')}`);
  stroke(PATH_WIDTH, ctx.createPattern(src(GROUND_ART.dirt), 'repeat')!);

  // 설치 받침: 원본 192px가 한 칸, 기준점은 칸 중심이다.
  for (const s of map.slots) {
    const cx = (s.x + 0.5) * C, cy = (s.y + 0.5) * C;
    if (has(GROUND_ART.slot)) { stamp(GROUND_ART.slot, cx, cy, 1); continue; }
    ctx.fillStyle = `#${PALETTE.stoneDark.toString(16)}`;
    ctx.beginPath(); ctx.roundRect(cx - 0.4 * C, cy - 0.38 * C, 0.8 * C, 0.8 * C, 0.12 * C); ctx.fill();
  }

  // 설치 불가 지면은 작은 덤불·돌·들꽃으로 채운다(PRD §6.2). 1칸 이하이고 점유 데이터가 아니다.
  const smallCells = [0.6, 0.6, 0.5, 0.5];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
    if (taken.has(key(x, y))) continue;
    const r = rand01(x, y, 5), i = [0.17, 0.34, 0.46, 0.58].findIndex(t => r < t);
    const k = i < 0 ? null : GROUND_ART.small[i]!;
    if (k && has(k)) stamp(k, (x + 0.5 + (rand01(x, y, 6) - 0.5) * 0.4) * C, (y + 0.62 + (rand01(x, y, 7) - 0.5) * 0.3) * C, smallCells[i]!, i === 3 ? 0.7 : 0.8);
  }

  // 입구 표시: 입구 칸 위 가장자리에 작게 세운다(이웃 설치 칸을 덜 가리게 0.6칸).
  const [ex, ey] = map.entryCell;
  if (has(GROUND_ART.entry)) stamp(GROUND_ART.entry, (ex + 0.18) * C, (ey + 0.14) * C, 0.6, 0.85);
  tex.refresh();
  return true;
}

export function drawGround(scene: Phaser.Scene, map: MapConfig, skip: GroundSkip = { gate: false, tree: false, stele: false, rock: false }): void {
  const g = scene.add.graphics();
  const W = 15 * C, H = 9 * C;
  g.fillStyle(PALETTE.grass, 1); g.fillRect(0, 0, W, H);
  const key = (x: number, y: number) => `${x},${y}`;
  const path = new Set(map.pathCells.map(([x, y]) => key(x, y)));
  const slots = new Set(map.slots.map(s => key(s.x, s.y)));
  const decor = new Map<string, 'culture' | 'nature'>();
  for (const d of map.decorations) for (const [x, y] of d.cells) decor.set(key(x, y), d.kind);

  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
    for (let k = 0; k < 3; k++) {
      const r = rand01(x, y, k);
      g.fillStyle(r > 0.5 ? PALETTE.grassDark : PALETTE.grassLight, 0.55);
      g.fillEllipse(x * C + rand01(x, y, k + 9) * C, y * C + rand01(x, y, k + 17) * C, 26 + r * 18, 10 + r * 6);
    }
  }

  // 길: 가장자리 → 흙 → 밝은 면. 시각 폭 0.84/0.74셀, 논리 중심선은 셀 중심(PRD §6.1).
  const cells = map.pathCells;
  const drawPath = (width: number, color: number) => {
    g.fillStyle(color, 1);
    cells.forEach(([x, y], i) => {
      const cx = x * C + C / 2, cy = y * C + C / 2;
      g.fillCircle(cx, cy, width / 2);
      const n = cells[i + 1];
      if (n) {
        const nx = n[0] * C + C / 2, ny = n[1] * C + C / 2;
        g.fillRect(Math.min(cx, nx) - (nx === cx ? width / 2 : 0), Math.min(cy, ny) - (ny === cy ? width / 2 : 0), Math.abs(nx - cx) || width, Math.abs(ny - cy) || width);
      }
    });
  };
  drawPath(C * 0.84, PALETTE.dirtEdge);
  drawPath(C * 0.74, PALETTE.dirt);
  for (const [x, y] of cells) {
    for (let k = 0; k < 2; k++) {
      g.fillStyle(rand01(x, y, 40 + k) > 0.5 ? PALETTE.dirtLight : PALETTE.dirtEdge, 0.5);
      g.fillCircle(x * C + 30 + rand01(x, y, 50 + k) * (C - 60), y * C + 30 + rand01(x, y, 60 + k) * (C - 60), 4 + rand01(x, y, 70 + k) * 4);
    }
  }

  // 입구 표시: 길 시작 칸 바깥쪽 깃발.
  const [ex, ey] = map.entryCell;
  g.fillStyle(PALETTE.woodDark, 1); g.fillRect(ex * C + 10, ey * C - 34, 8, 70);
  g.fillStyle(0x245b88, 1); g.fillTriangle(ex * C + 18, ey * C - 34, ex * C + 58, ey * C - 22, ex * C + 18, ey * C - 10);

  // 설치 받침: 낮은 돌 받침. 영구 장식과 모양을 확실히 다르게 한다.
  for (const s of map.slots) {
    const x = s.x * C, y = s.y * C;
    g.fillStyle(PALETTE.outline, 0.22); g.fillRoundedRect(x + 14, y + 22, C - 22, C - 26, 16);
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(x + 10, y + 12, C - 20, C - 20, 16);
    g.fillStyle(PALETTE.stoneDark, 1); g.fillRoundedRect(x + 13, y + 15, C - 26, C - 26, 13);
    g.fillStyle(PALETTE.stone, 1); g.fillRoundedRect(x + 13, y + 15, C - 26, C - 34, 13);
    g.fillStyle(PALETTE.stoneLight, 1); g.fillRoundedRect(x + 20, y + 20, C - 70, 10, 5);
  }

  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
    const k = key(x, y);
    const cx = x * C + C / 2, cy = y * C + C / 2;
    const kind = decor.get(k);
    if (kind === 'culture') { if (!skip.stele) stele(g, cx, cy); }
    else if (kind === 'nature') { if (isTreeCell(x, y)) { if (!skip.tree) tree(g, cx, cy, 1.05); } else if (!skip.rock) rock(g, cx, cy + 10, 1.1); }
    else if (!path.has(k) && !slots.has(k)) {
      // 설치 불가 지면은 작은 덤불·꽃·돌로 채워 빈 잔디로 보이지 않게 한다(PRD §6.2). 1셀 이하 크기.
      const r = rand01(x, y, 5);
      if (r < 0.34) bush(g, cx + (rand01(x, y, 6) - 0.5) * 30, cy + (rand01(x, y, 7) - 0.5) * 30, 0.9, r < 0.17);
      else if (r < 0.48) rock(g, cx, cy + 12, 0.55);
      else if (r < 0.62) tree(g, cx, cy, 0.72);
      else { g.fillStyle(PALETTE.flowerA, 0.9); g.fillCircle(cx - 14, cy + 8, 4); g.fillStyle(PALETTE.cream, 0.9); g.fillCircle(cx + 12, cy - 6, 4); }
    }
  }

  if (!skip.gate) drawGate(g, map);
  g.generateTexture(ASSETS.ground.key, W, H);
  g.destroy();
}

function drawGate(g: Phaser.GameObjects.Graphics, map: MapConfig) {
  const [x, y] = map.exitCell;
  const last = map.pathCells[map.pathCells.length - 2]!;
  const horizontal = last[1] === y;
  const cx = x * C + C / 2, cy = y * C + C / 2;
  const w = horizontal ? 0.5 * C : 1.3 * C, h = horizontal ? 1.3 * C : 0.5 * C;
  g.fillStyle(PALETTE.outline, 0.2); g.fillEllipse(cx + 8, cy + h / 2, w + 40, 30);
  g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 12);
  g.fillStyle(PALETTE.wood, 1); g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  g.fillStyle(PALETTE.woodLight, 1);
  if (horizontal) for (let i = 0; i < 4; i++) g.fillRect(cx - w / 2 + 8, cy - h / 2 + 10 + i * (h / 4), w - 16, 6);
  else for (let i = 0; i < 4; i++) g.fillRect(cx - w / 2 + 10 + i * (w / 4), cy - h / 2 + 8, 6, h - 16);
  for (const [px, py] of horizontal ? [[cx, cy - h / 2], [cx, cy + h / 2]] : [[cx - w / 2, cy], [cx + w / 2, cy]]) {
    blob(g, px!, py!, 24, PALETTE.stoneDark);
    g.fillStyle(PALETTE.stone, 1); g.fillCircle(px! - 3, py! - 3, 18);
    g.fillStyle(0x245b88, 1); g.fillTriangle(px! - 6, py! - 46, px! + 26, py! - 36, px! - 6, py! - 26);
    g.fillStyle(PALETTE.woodDark, 1); g.fillRect(px! - 9, py! - 50, 5, 34);
  }
}

/** 타워 몸체·무기, 적 2프레임, 투사체·표식 텍스처. */
export function drawSprites(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  // 인수된 원화가 이미 실린 키는 건너뛴다(같은 ID 대체).
  const gen = (key: string, w: number, h: number, draw: () => void) => { if (scene.textures.exists(key)) return; g.clear(); draw(); g.generateTexture(key, w, h); };

  gen('tower.archer', 128, 160, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(26, 62, 76, 80, 10);
    g.fillStyle(PALETTE.wood, 1); g.fillRoundedRect(30, 66, 68, 72, 8);
    g.fillStyle(PALETTE.woodLight, 1); g.fillRect(34, 70, 14, 64);
    g.fillStyle(PALETTE.woodDark, 1); for (let i = 0; i < 3; i++) g.fillRect(30, 86 + i * 18, 68, 4);
    g.fillStyle(PALETTE.outline, 1); g.fillTriangle(14, 70, 64, 18, 114, 70);
    g.fillStyle(0x3d7d3a, 1); g.fillTriangle(22, 66, 64, 26, 106, 66);
    g.fillStyle(0x5aa04f, 1); g.fillTriangle(30, 64, 64, 32, 64, 64);
  });
  gen('tower.archer.weapon', 96, 96, () => {
    g.lineStyle(9, PALETTE.outline, 1); g.beginPath(); g.arc(40, 48, 30, -1.2, 1.2); g.strokePath();
    g.lineStyle(5, PALETTE.woodLight, 1); g.beginPath(); g.arc(40, 48, 30, -1.2, 1.2); g.strokePath();
    g.lineStyle(2, PALETTE.cream, 1); g.lineBetween(51, 20, 51, 76);
    g.fillStyle(PALETTE.outline, 1); g.fillRect(36, 45, 50, 6);
    g.fillStyle(PALETTE.cream, 1); g.fillTriangle(86, 41, 96, 48, 86, 55);
  });
  gen('tower.cannon', 128, 160, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillEllipse(64, 118, 104, 52);
    g.fillStyle(PALETTE.stoneDark, 1); g.fillEllipse(64, 116, 96, 44);
    g.fillStyle(PALETTE.stone, 1); g.fillEllipse(62, 110, 88, 34);
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(36, 70, 56, 46, 10);
    g.fillStyle(PALETTE.wood, 1); g.fillRoundedRect(40, 74, 48, 38, 8);
    g.fillStyle(PALETTE.woodLight, 1); g.fillRect(44, 78, 12, 30);
  });
  gen('tower.cannon.weapon', 96, 96, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(22, 32, 70, 32, 12);
    g.fillStyle(PALETTE.iron, 1); g.fillRoundedRect(25, 35, 64, 26, 10);
    g.fillStyle(PALETTE.ironLight, 1); g.fillRoundedRect(29, 38, 50, 8, 4);
    g.fillStyle(PALETTE.bronze, 1); g.fillRect(70, 34, 8, 28);
    blob(g, 30, 48, 16, PALETTE.iron);
  });
  gen('tower.frost', 128, 160, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(28, 92, 72, 50, 12);
    g.fillStyle(PALETTE.stoneLight, 1); g.fillRoundedRect(32, 96, 64, 42, 10);
    g.fillStyle(PALETTE.stone, 1); g.fillRect(32, 120, 64, 18);
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(44, 70, 40, 28, 8);
    g.fillStyle(PALETTE.stoneDark, 1); g.fillRoundedRect(48, 74, 32, 22, 6);
  });
  gen('tower.frost.weapon', 96, 96, () => {
    const pts = (s: number, dx = 0) => [new Phaser.Math.Vector2(48 + dx, 48 - 40 * s), new Phaser.Math.Vector2(48 + 18 * s + dx, 48), new Phaser.Math.Vector2(48 + dx, 48 + 34 * s), new Phaser.Math.Vector2(48 - 18 * s + dx, 48)];
    g.fillStyle(PALETTE.outline, 1); g.fillPoints(pts(1.12), true);
    g.fillStyle(PALETTE.iceDark, 1); g.fillPoints(pts(1), true);
    g.fillStyle(PALETTE.ice, 1); g.fillPoints(pts(0.78, -3), true);
    g.fillStyle(PALETTE.iceLight, 1); g.fillPoints(pts(0.34, -7), true);
  });

  // P2 타워 임시 그림(ART-003 원화가 인수되면 같은 키로 대체된다). 돌 받침 위 역할 색 몸체, 무기는 오른쪽을 향한 막대.
  const p2: Array<[TowerId, number]> = [['crossbow', PALETTE.wood], ['mage', 0x6b4fa0], ['lightning', PALETTE.bronze], ['flame', 0xa3352b], ['spear', PALETTE.woodDark], ['guardian', PALETTE.ironLight], ['banner', 0x245b88]];
  for (const [id, color] of p2) {
    gen(`tower.${id}`, 128, 160, () => {
      g.fillStyle(PALETTE.outline, 1); g.fillEllipse(64, 124, 100, 40);
      g.fillStyle(PALETTE.stone, 1); g.fillEllipse(64, 120, 92, 32);
      if (id === 'banner') {
        g.fillStyle(PALETTE.outline, 1); g.fillRect(58, 30, 12, 92);
        g.fillStyle(PALETTE.wood, 1); g.fillRect(61, 33, 6, 86);
        g.fillStyle(PALETTE.outline, 1); g.fillTriangle(67, 30, 118, 50, 67, 74);
        g.fillStyle(color, 1); g.fillTriangle(70, 36, 110, 50, 70, 68);
        return;
      }
      g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(34, 66, 60, 56, 12);
      g.fillStyle(color, 1); g.fillRoundedRect(38, 70, 52, 48, 10);
    });
    if (id !== 'banner') gen(`tower.${id}.weapon`, 96, 96, () => {
      g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(28, 40, 64, 16, 6);
      g.fillStyle(color, 1); g.fillRoundedRect(31, 43, 58, 10, 4);
      blob(g, 34, 48, 12, color);
    });
  }

  const kinds: EnemyKind[] = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm', 'boss'];
  for (const kind of kinds) for (const frame of [0, 1] as const) {
    const spec = ASSETS.enemy(kind, frame);
    gen(spec.key, spec.width, spec.height, () => drawEnemy(g, kind, frame, spec.width));
  }

  gen(ASSETS.projectile.arrow, 48, 12, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillRect(2, 4, 38, 4);
    g.fillStyle(PALETTE.cream, 1); g.fillTriangle(38, 0, 48, 6, 38, 12);
    g.fillStyle(0xd9534f, 1); g.fillTriangle(0, 1, 9, 6, 0, 11);
  });
  gen(ASSETS.projectile.ball, 28, 28, () => { blob(g, 14, 14, 10, PALETTE.iron); g.fillStyle(PALETTE.ironLight, 1); g.fillCircle(10, 10, 4); });
  gen(ASSETS.projectile.shard, 28, 28, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillPoints([new Phaser.Math.Vector2(14, 0), new Phaser.Math.Vector2(26, 14), new Phaser.Math.Vector2(14, 28), new Phaser.Math.Vector2(2, 14)], true);
    g.fillStyle(PALETTE.ice, 1); g.fillPoints([new Phaser.Math.Vector2(14, 4), new Phaser.Math.Vector2(22, 14), new Phaser.Math.Vector2(14, 24), new Phaser.Math.Vector2(6, 14)], true);
  });
  gen(ASSETS.projectile.spark, 32, 32, () => {
    g.fillStyle(0xffffff, 1); g.fillPoints([new Phaser.Math.Vector2(16, 0), new Phaser.Math.Vector2(20, 12), new Phaser.Math.Vector2(32, 16), new Phaser.Math.Vector2(20, 20), new Phaser.Math.Vector2(16, 32), new Phaser.Math.Vector2(12, 20), new Phaser.Math.Vector2(0, 16), new Phaser.Math.Vector2(12, 12)], true);
  });
  gen(ASSETS.projectile.puff, 32, 32, () => { g.fillStyle(PALETTE.cream, 1); g.fillCircle(16, 16, 14); });
  gen(ASSETS.badge.armored, 28, 32, () => {
    g.fillStyle(PALETTE.outline, 1); g.fillRoundedRect(2, 2, 24, 28, { tl: 6, tr: 6, bl: 12, br: 12 });
    g.fillStyle(PALETTE.stoneLight, 1); g.fillRoundedRect(5, 5, 18, 22, { tl: 4, tr: 4, bl: 9, br: 9 });
    g.fillStyle(PALETTE.stoneDark, 1); g.fillRect(12, 7, 4, 18);
  });
  gen(ASSETS.badge.swift, 32, 24, () => {
    g.lineStyle(5, PALETTE.outline, 1); for (let i = 0; i < 3; i++) g.lineBetween(2 + i * 4, 4 + i * 8, 30, 4 + i * 8);
    g.lineStyle(3, PALETTE.cream, 1); for (let i = 0; i < 3; i++) g.lineBetween(4 + i * 4, 4 + i * 8, 28, 4 + i * 8);
  });
  g.destroy();
}

function drawEnemy(g: Phaser.GameObjects.Graphics, kind: EnemyKind, frame: 0 | 1, size: number) {
  const s = size / 128;
  const cx = 64 * s, base = 100 * s;
  const step = frame === 0 ? 1 : -1;
  const feet = (color: number, spread = 14, y = base) => {
    g.fillStyle(PALETTE.outline, 1);
    g.fillEllipse(cx - spread * s + step * 5 * s, y - (step > 0 ? 4 : 0) * s, 18 * s, 12 * s);
    g.fillEllipse(cx + spread * s - step * 5 * s, y - (step < 0 ? 4 : 0) * s, 18 * s, 12 * s);
    g.fillStyle(color, 1);
    g.fillEllipse(cx - spread * s + step * 5 * s, y - 1 * s - (step > 0 ? 4 : 0) * s, 13 * s, 8 * s);
    g.fillEllipse(cx + spread * s - step * 5 * s, y - 1 * s - (step < 0 ? 4 : 0) * s, 13 * s, 8 * s);
  };
  const eyes = (y: number, dx = 9, r = 4) => {
    g.fillStyle(PALETTE.cream, 1); g.fillCircle(cx - dx * s + 4 * s, y, r * s); g.fillCircle(cx + dx * s + 4 * s, y, r * s);
    g.fillStyle(PALETTE.outline, 1); g.fillCircle(cx - dx * s + 6 * s, y, r * 0.5 * s); g.fillCircle(cx + dx * s + 6 * s, y, r * 0.5 * s);
  };
  g.fillStyle(PALETTE.outline, 0.22); g.fillEllipse(cx, base + 4 * s, 64 * s, 16 * s);
  switch (kind) {
    case 'walker': {
      feet(0x7a3a2a);
      blob(g, cx, 70 * s, 24 * s, 0xc9573f);
      g.fillStyle(0xe07a5c, 1); g.fillCircle(cx - 7 * s, 63 * s, 10 * s);
      g.fillStyle(PALETTE.outline, 1); g.fillTriangle(cx - 26 * s, 52 * s, cx - 14 * s, 60 * s, cx - 36 * s, 66 * s); g.fillTriangle(cx + 26 * s, 52 * s, cx + 14 * s, 60 * s, cx + 36 * s, 66 * s);
      eyes(64 * s);
      g.fillStyle(PALETTE.woodDark, 1); g.fillRect(cx + 22 * s, 40 * s, 5 * s, 52 * s);
      g.fillStyle(PALETTE.stoneLight, 1); g.fillTriangle(cx + 19 * s, 42 * s, cx + 24.5 * s, 28 * s, cx + 30 * s, 42 * s);
      break;
    }
    case 'runner': {
      feet(0x8a4b1d, 10);
      blob(g, cx, 72 * s, 19 * s, 0xe08a35);
      g.fillStyle(0xf2ad5e, 1); g.fillCircle(cx - 6 * s, 66 * s, 8 * s);
      g.lineStyle(4 * s, PALETTE.cream, 0.9); g.lineBetween(cx - 46 * s, 64 * s, cx - 26 * s, 64 * s); g.lineBetween(cx - 42 * s, 76 * s, cx - 24 * s, 76 * s);
      eyes(68 * s, 7, 3.5);
      break;
    }
    case 'brute': {
      feet(0x4e3a2c, 20, base + 2 * s);
      blob(g, cx, 66 * s, 32 * s, 0x8a6a55);
      g.fillStyle(0xa58670, 1); g.fillCircle(cx - 10 * s, 56 * s, 15 * s);
      g.fillStyle(0x6e5442, 1); g.fillRect(cx - 30 * s, 40 * s, 60 * s, 8 * s);
      g.fillStyle(PALETTE.cream, 1); g.fillTriangle(cx + 18 * s, 76 * s, cx + 30 * s, 70 * s, cx + 34 * s, 86 * s); g.fillTriangle(cx - 6 * s, 78 * s, cx + 6 * s, 72 * s, cx + 8 * s, 88 * s);
      eyes(62 * s, 12, 4);
      break;
    }
    case 'shell': {
      feet(0x3f6a35, 18);
      g.fillStyle(PALETTE.outline, 1); g.fillEllipse(cx, 68 * s, 70 * s, 56 * s);
      g.fillStyle(0x5f8d4e, 1); g.fillEllipse(cx, 66 * s, 62 * s, 48 * s);
      g.fillStyle(0xa7c06a, 1); g.fillEllipse(cx - 2 * s, 60 * s, 36 * s, 24 * s);
      g.lineStyle(3 * s, 0x3f6a35, 1); g.strokeEllipse(cx - 2 * s, 60 * s, 36 * s, 24 * s);
      blob(g, cx + 30 * s, 70 * s, 11 * s, 0x86b06a);
      g.fillStyle(PALETTE.outline, 1); g.fillCircle(cx + 34 * s, 67 * s, 2.5 * s);
      break;
    }
    case 'wisp': {
      const float = frame === 0 ? 0 : -4;
      g.fillStyle(PALETTE.outline, 1); g.fillCircle(cx, (60 + float) * s, 25 * s); g.fillTriangle(cx - 25 * s, (62 + float) * s, cx + 25 * s, (62 + float) * s, cx + step * 6 * s, (98 + float) * s);
      g.fillStyle(0x9b6fd1, 1); g.fillCircle(cx, (60 + float) * s, 22 * s); g.fillTriangle(cx - 21 * s, (62 + float) * s, cx + 21 * s, (62 + float) * s, cx + step * 6 * s, (93 + float) * s);
      g.fillStyle(0xc9a9f0, 1); g.fillCircle(cx - 7 * s, (52 + float) * s, 9 * s);
      eyes((58 + float) * s, 8, 4);
      break;
    }
    case 'swarm': {
      for (const [dx, dy] of [[-16, 6], [14, 0], [0, -12]] as const) {
        const ox = cx + dx * s, oy = 78 * s + dy * s;
        g.fillStyle(PALETTE.outline, 1); g.fillEllipse(ox, oy, 26 * s, 20 * s);
        g.fillStyle(0xd9b23a, 1); g.fillEllipse(ox, oy - 1 * s, 21 * s, 15 * s);
        g.fillStyle(PALETTE.outline, 1); g.fillRect(ox - 1 * s, oy - 8 * s, 2 * s, 14 * s);
        g.lineStyle(2 * s, PALETTE.outline, 1); g.lineBetween(ox - 8 * s + step * 2 * s, oy + 8 * s, ox - 12 * s, oy + 12 * s); g.lineBetween(ox + 8 * s - step * 2 * s, oy + 8 * s, ox + 12 * s, oy + 12 * s);
      }
      break;
    }
    case 'boss': {
      feet(0x3b2350, 22);
      blob(g, cx, 66 * s, 34 * s, 0x6b3f8f);
      g.fillStyle(0x8c5fb0, 1); g.fillCircle(cx - 10 * s, 56 * s, 16 * s);
      g.fillStyle(PALETTE.outline, 1); g.fillTriangle(cx - 30 * s, 40 * s, cx - 18 * s, 18 * s, cx - 10 * s, 38 * s); g.fillTriangle(cx + 30 * s, 40 * s, cx + 18 * s, 18 * s, cx + 10 * s, 38 * s);
      g.fillStyle(0xf0e2c0, 1); g.fillTriangle(cx - 27 * s, 38 * s, cx - 18 * s, 23 * s, cx - 13 * s, 37 * s); g.fillTriangle(cx + 27 * s, 38 * s, cx + 18 * s, 23 * s, cx + 13 * s, 37 * s);
      g.fillStyle(PALETTE.bronze, 1); g.fillRect(cx - 16 * s, 36 * s, 32 * s, 8 * s);
      eyes(60 * s, 12, 5);
      break;
    }
  }
}

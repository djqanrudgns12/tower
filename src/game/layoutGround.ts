import type Phaser from 'phaser';
import type { MapConfig } from '../contracts/maps';
import { ASSETS, CELL_PX, TEX } from './assets';
import { artRect, grassMasks, pathPolyline, resolvePlacements, type MapLayout, type PlacedArt } from './layouts';

// 배치표가 있는 맵의 지면 조립(art-bible-v2 §2, ART-R1 재료).
// 풀 3톤은 맵 id로 정해지는 저주파 마스크로 섞고, 길은 한 번의 둥근 획으로 그려 이음매가 없다.
// 소품은 손 배치표대로만 둔다. 격자 난수 흩뿌리기는 쓰지 않는다.

const C = CELL_PX * TEX;

/** 배치표 맵의 지면 재료 ID. 풀 기본·흙이 없으면 조립하지 않고 기존 지면으로 되돌아간다. */
export const LAYOUT_GROUND = {
  base: 'ground.grass.base', light: 'ground.grass.light', shade: 'ground.grass.shade', dirt: 'path.dirt',
  pads: ['slot.pad.0', 'slot.pad.1'], fallbackPad: 'slot.base', entry: 'map.entry',
} as const;

/** 길 시각 폭(칸): 가장자리 띠·흙. 굽이는 중심선 반지름 0.6칸으로 둥글린다. 논리 중심선은 칸 중심이다(PRD §6.1). */
const PATH = { edge: 0.84, dirt: 0.75, corner: 0.6, edgeColor: '#9a7447' } as const;
/** 설치 받침 표시 크기(칸). 기존 slot.base(1칸)보다 작고 낮은 대비다. */
export const PAD_CELLS = 0.8;
/** 풀 마스크 표본 밀도(칸당). 8px마다 한 표본을 계산해 부드럽게 늘린다. */
const MASK_SAMPLES = 16;

type Ctx = CanvasRenderingContext2D;

/** 배치표대로 지면을 조립한다. 재료가 없으면 false(호출하는 쪽이 기존 composeGroundArt/drawGround를 쓴다). */
export function composeLayoutGround(scene: Phaser.Scene, map: MapConfig, layout: MapLayout): boolean {
  const t = scene.textures;
  if (!t.exists(LAYOUT_GROUND.base) || !t.exists(LAYOUT_GROUND.dirt)) return false;
  const W = map.gridWidth * C, H = map.gridHeight * C;
  const tex = t.createCanvas(ASSETS.ground.key, W, H);
  if (!tex) return false;
  const ctx = tex.getContext();
  const img = (key: string) => t.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const temps: HTMLCanvasElement[] = [];
  const layer = (w = W, h = H): [HTMLCanvasElement, Ctx] => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h; temps.push(c);
    return [c, c.getContext('2d')!];
  };
  const fillPattern = (g: Ctx, key: string, shiftX = 0, shiftY = 0) => {
    const pat = g.createPattern(img(key), 'repeat')!;
    pat.setTransform(new DOMMatrix().translate(shiftX, shiftY));
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
  };
  const stamp = (g: Ctx, p: PlacedArt) => {
    if (!t.exists(p.asset)) return;
    const im = img(p.asset), r = artRect(p, im.width, im.height);
    g.drawImage(im, r.left * C, r.top * C, r.width * C, r.height * C);
  };
  const placed = resolvePlacements(layout, map);

  // 1. 풀: 기본 질감 위에 밝은 풀·그늘 풀을 큰 저주파 마스크로 섞는다. 질감을 서로 어긋나게 깔아 2칸 반복도 끊는다.
  fillPattern(ctx, LAYOUT_GROUND.base);
  const masks = grassMasks(map.id, map.gridWidth, map.gridHeight, MASK_SAMPLES);
  const blend = (key: string, values: Float32Array, strength: number, shiftX: number, shiftY: number) => {
    if (!t.exists(key)) return;
    const [m, mg] = layer(masks.width, masks.height);
    const data = mg.createImageData(masks.width, masks.height);
    for (let k = 0; k < values.length; k++) data.data[k * 4 + 3] = Math.round(values[k]! * strength * 255);
    mg.putImageData(data, 0, 0);
    const [c, g] = layer();
    fillPattern(g, key, shiftX, shiftY);
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(m, 0, 0, W, H);
    ctx.drawImage(c, 0, 0);
  };
  blend(LAYOUT_GROUND.shade, masks.shade, 0.9, 83, 151);
  blend(LAYOUT_GROUND.light, masks.light, 0.85, 173, 59);
  for (const p of placed) if (p.kind === 'meadow') stamp(ctx, p);

  // 2. 길: 꺾임점만 이어 둥근 굽이로 한 번에 긋는다(칸마다 그리지 않아 이음매·혹이 없다).
  const pts = pathPolyline(map).map(([x, y]) => [x * C, y * C] as const);
  const trace = (g: Ctx) => {
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1]!, [px, py] = pts[i]!, [bx, by] = pts[i + 1]!;
      const r = Math.min(PATH.corner * C, Math.hypot(px - ax, py - ay) / 2, Math.hypot(bx - px, by - py) / 2);
      g.arcTo(px, py, bx, by, r);
    }
    g.lineTo(pts[pts.length - 1]![0], pts[pts.length - 1]![1]);
  };
  const stroke = (g: Ctx, cells: number, style: string | CanvasPattern) => {
    trace(g);
    g.lineWidth = cells * C; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = style;
    g.stroke();
  };
  // 가장자리 띠와 그 바깥의 부드러운 풀 그늘(그림자 흐림 한 번).
  ctx.save();
  ctx.shadowColor = 'rgba(38, 58, 18, 0.42)'; ctx.shadowBlur = 16;
  stroke(ctx, PATH.edge, PATH.edgeColor);
  ctx.restore();
  const dirt = ctx.createPattern(img(LAYOUT_GROUND.dirt), 'repeat')!;
  stroke(ctx, PATH.dirt, dirt);
  // 길 안쪽 가장자리 그늘: 길 밖을 채운 판의 그림자를 길 안에만 남긴다(좌상단 광원이라 위·왼쪽 가장자리가 조금 더 어둡다).
  const [outside, og] = layer();
  og.fillStyle = '#000'; og.fillRect(0, 0, W, H);
  og.globalCompositeOperation = 'destination-out';
  stroke(og, PATH.dirt, '#000');
  const [rim, rg] = layer();
  rg.save();
  rg.shadowColor = 'rgba(96, 64, 30, 0.5)'; rg.shadowBlur = 14; rg.shadowOffsetX = 3; rg.shadowOffsetY = 4;
  rg.drawImage(outside, 0, 0);
  rg.restore();
  // 굽이 바퀴 자국(배치표). 안쪽 그늘과 같은 판에 그려 길 밖으로 새지 않게 한다.
  rg.lineCap = 'round';
  for (const [[x0, y0, x1, y1], from, to] of layout.wheelRuts) {
    const arc = (inset: number, d: number, width: number, alpha: number) => {
      rg.beginPath();
      rg.ellipse(((x0 + x1) / 2) * C, ((y0 + y1) / 2) * C, ((x1 - x0) / 2) * C - inset, ((y1 - y0) / 2) * C - inset, 0, ((from + d) * Math.PI) / 180, ((to - d) * Math.PI) / 180);
      rg.lineWidth = width; rg.strokeStyle = `rgba(150, 112, 66, ${alpha})`; rg.stroke();
    };
    arc(0, 0, 3, 0.28);
    arc(9, 8, 2, 0.2);
  }
  rg.globalCompositeOperation = 'destination-in';
  stroke(rg, PATH.dirt, '#000');
  ctx.drawImage(rim, 0, 0);

  // 3. 설치 받침: 0.8칸 낮은 돌 기단 두 종을 자리 순서대로 번갈아 쓴다.
  map.slots.forEach((s, i) => {
    const key = [LAYOUT_GROUND.pads[i % 2]!, LAYOUT_GROUND.fallbackPad].find(k => t.exists(k));
    if (!key) return;
    const cells = key === LAYOUT_GROUND.fallbackPad ? 1 : PAD_CELLS;
    stamp(ctx, { key: s.id, kind: 'prop', asset: key, cx: s.x + 0.5, cy: s.y + 0.5, w: cells, ox: 0.5, oy: 0.5 });
  });

  // 4. 랜드마크 → 길 가장자리 풀 술·자갈 → 소품·바위. 아래쪽(발 위치가 큰) 것이 위에 겹친다.
  for (const p of placed) if (p.kind === 'landmark') stamp(ctx, p);
  const foot = (p: PlacedArt) => {
    const im = t.exists(p.asset) ? img(p.asset) : null;
    return im ? (r => r.top + r.height)(artRect(p, im.width, im.height)) : p.cy;
  };
  const props = placed.filter(p => p.kind === 'pathEdge' || p.kind === 'prop' || p.kind === 'rock').sort((a, b) => foot(a) - foot(b));
  for (const p of props) stamp(ctx, p);

  // 5. 입구 표시: 입구 칸 위 가장자리에 작게 세운다(composeGroundArt와 같은 자리).
  const [ex, ey] = map.entryCell;
  if (t.exists(LAYOUT_GROUND.entry)) stamp(ctx, { key: 'entry', kind: 'prop', asset: LAYOUT_GROUND.entry, cx: ex + 0.18, cy: ey + 0.14, w: 0.6, ox: 0.5, oy: 0.85 });

  tex.refresh();
  for (const c of temps) { c.width = 0; c.height = 0; }
  return true;
}

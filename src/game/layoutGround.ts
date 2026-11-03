import type Phaser from 'phaser';
import type { MapConfig } from '../contracts/maps';
import { ASSETS, CELL_PX, TEX } from './assets';
import { artRect, grassMasks, groundKitFor, lineNoise, pathCenterline, resolvePlacements, type GroundKit, type MapLayout, type PlacedArt, type ShadePool } from './layouts';

// 배치표가 있는 맵의 지면 조립(art-bible-v2 §2, ART-R1 재료). 재료 id와 색은 맵별 묶음(layouts/kits.ts GroundKit)이 정한다.
// 바닥 3톤은 맵 id로 정해지는 저주파 마스크로 섞고, 길은 둥근 중심선을 따라 폭이 조금씩 흔들리는 부드러운 띠로 그린다.
// 소품은 손 배치표대로만 둔다. 격자 난수 흩뿌리기는 쓰지 않는다.

const C = CELL_PX * TEX;

/**
 * 길 모양(칸). 흙 반폭은 0.375칸을 중심으로 ±0.04칸 흔들리고(두 주기의 결정론적 잡음), 바깥 흙빛 띠는 0.03~0.07칸으로 흐리게 번진다.
 * 굽이는 중심선 반지름 0.6칸. 논리 중심선은 칸 중심이다(PRD §6.1).
 */
const PATH = { half: 0.375, wobble: [0.028, 0.012], fringe: [0.03, 0.04], corner: 0.6, step: 0.04 } as const;
/** 설치 받침의 보이는 크기(칸): 그림의 알파 경계 상자 너비를 이 값에 맞춘다. 두 종이 같은 크기로 보인다. */
export const PAD_CELLS = 0.8;
/** 풀 마스크 표본 밀도(칸당). 8px마다 한 표본을 계산해 부드럽게 늘린다. */
const MASK_SAMPLES = 16;
/** 바닥 3톤 대비: 그늘·볕 질감을 섞는 세기. 그 위에 얹는 색조(곱하기 그늘·밝게 볕)는 맵별 묶음이 정한다. 타워·적보다 눈에 띄지 않게 낮게 둔다. */
const TONE = { shade: 1, light: 1 } as const;

type Ctx = CanvasRenderingContext2D;

/** 그림의 알파 128 이상 경계 상자(원본 px). */
function alphaBox(im: HTMLImageElement | HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0);
  const a = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (a[(y * c.width + x) * 4 + 3]! >= 128) {
    if (x < x0) x0 = x; if (x + 1 > x1) x1 = x + 1; if (y < y0) y0 = y; if (y + 1 > y1) y1 = y + 1;
  }
  c.width = 0;
  return x1 > x0 ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: im.width, y1: im.height };
}

/** 설치 받침 이미지 한 장의 배치(월드 px). 기준점은 알파 상자 가운데, scale은 월드 px당 텍스처 px 배율이다. */
export interface PadSprite { slotId: string; key: string; x: number; y: number; scale: number; originX: number; originY: number }

/**
 * 설치 받침 배치: 낮은 돌 기단 두 종(맵별 묶음)을 자리 순서대로 번갈아 쓴다. 알파 경계 상자 너비를 PAD_CELLS칸에 맞추고 상자 가운데를 칸 가운데에 둔다.
 * 받침 재료가 하나도 없으면 빈 배열(지면 쪽에 구운 받침을 쓰는 경로)이다.
 */
export function padSprites(scene: Phaser.Scene, map: MapConfig): PadSprite[] {
  const kit = groundKitFor(map.id);
  if (!kit) return [];
  const t = scene.textures;
  const boxes = new Map<string, ReturnType<typeof alphaBox>>();
  const out: PadSprite[] = [];
  map.slots.forEach((s, i) => {
    const key = [kit.pads[i % 2]!, kit.fallbackPad].find(k => t.exists(k));
    if (!key) return;
    const im = t.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (!boxes.has(key)) boxes.set(key, alphaBox(im));
    const b = boxes.get(key)!;
    out.push({ slotId: s.id, key, x: (s.x + 0.5) * CELL_PX, y: (s.y + 0.5) * CELL_PX, scale: (PAD_CELLS * CELL_PX) / (b.x1 - b.x0), originX: (b.x0 + b.x1) / 2 / im.width, originY: (b.y0 + b.y1) / 2 / im.height });
  });
  return out;
}

/** 배치표대로 지면을 조립한다. 맵별 재료 묶음이 없거나 바닥·길 재료가 없으면 false(호출하는 쪽이 기존 composeGroundArt/drawGround를 쓴다). */
export function composeLayoutGround(scene: Phaser.Scene, map: MapConfig, layout: MapLayout): boolean {
  const t = scene.textures;
  const kit: GroundKit | null = groundKitFor(map.id);
  if (!kit || !t.exists(kit.base) || !t.exists(kit.dirt)) return false;
  const W = map.gridWidth * C, H = map.gridHeight * C;
  const tex = t.createCanvas(ASSETS.ground.key, W, H);
  if (!tex) return false;
  const ctx = tex.getContext();
  const img = (key: string) => t.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const layer = (w = W, h = H): [HTMLCanvasElement, Ctx] => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')!];
  };
  const free = (...cs: HTMLCanvasElement[]) => { for (const c of cs) { c.width = 0; c.height = 0; } };
  const fillPattern = (g: Ctx, key: string, shiftX = 0, shiftY = 0) => {
    const pat = g.createPattern(img(key), 'repeat')!;
    pat.setTransform(new DOMMatrix().translate(shiftX, shiftY));
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
  };
  /** paint로 칠한 판을 mask의 알파만큼 지면에 얹는다. */
  const masked = (mask: HTMLCanvasElement, paint: (g: Ctx) => void, alpha = 1, op: GlobalCompositeOperation = 'source-over') => {
    const [c, g] = layer();
    paint(g);
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(mask, 0, 0, W, H);
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op; ctx.drawImage(c, 0, 0); ctx.restore();
    free(c);
  };
  const stamp = (g: Ctx, p: PlacedArt) => {
    if (!t.exists(p.asset)) return;
    const im = img(p.asset), r = artRect(p, im.width, im.height);
    g.drawImage(im, r.left * C, r.top * C, r.width * C, r.height * C);
  };
  const placed = resolvePlacements(layout, map);

  // 1. 풀: 기본 질감 위에 그늘·볕 질감을 큰 저주파 마스크로 섞고 색조를 조금 얹는다. 숲 덩이 발밑은 그늘 웅덩이로 덮는다.
  fillPattern(ctx, kit.base);
  const pools: ShadePool[] = placed.filter(p => p.kind === 'grove').map(p => {
    const im = t.exists(p.asset) ? img(p.asset) : null;
    const r = im ? artRect(p, im.width, im.height) : { left: p.cx - p.w / 2, top: p.cy - p.w, width: p.w, height: p.w };
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.85, rx: r.width * 0.95, ry: r.height * 0.55 };
  });
  const masks = grassMasks(map.id, map.gridWidth, map.gridHeight, MASK_SAMPLES, pools);
  const maskCanvas = (values: Float32Array) => {
    const [m, mg] = layer(masks.width, masks.height);
    const data = mg.createImageData(masks.width, masks.height);
    for (let k = 0; k < values.length; k++) data.data[k * 4 + 3] = Math.round(values[k]! * 255);
    mg.putImageData(data, 0, 0);
    return m;
  };
  const shadeMask = maskCanvas(masks.shade), lightMask = maskCanvas(masks.light);
  if (t.exists(kit.shade)) masked(shadeMask, g => fillPattern(g, kit.shade, 83, 151), TONE.shade);
  if (t.exists(kit.light)) masked(lightMask, g => fillPattern(g, kit.light, 173, 59), TONE.light);
  masked(shadeMask, g => { g.fillStyle = kit.tone.shade[0]; g.fillRect(0, 0, W, H); }, kit.tone.shade[1], 'multiply');
  masked(lightMask, g => { g.fillStyle = kit.tone.light[0]; g.fillRect(0, 0, W, H); }, kit.tone.light[1], 'soft-light');
  free(shadeMask, lightMask);
  for (const p of placed) if (p.kind === 'meadow') stamp(ctx, p);

  // 2. 길: 둥근 중심선을 따라 원을 이어 찍어 폭이 조금씩 흔들리는 띠를 만든다(칸마다 끊기지 않아 이음매·혹이 없다).
  //    가장자리는 선이 아니라 흐린 흙빛 번짐과 풀 그늘로 처리한다.
  const line = pathCenterline(map, PATH.corner, PATH.step);
  const n1 = lineNoise(map.id, 1, 1.7), n2 = lineNoise(map.id, 2, 0.45), n3 = lineNoise(map.id, 3, 1.1);
  const half = line.map(p => PATH.half + PATH.wobble[0] * n1(p.s) + PATH.wobble[1] * n2(p.s));
  const fringe = line.map(p => PATH.fringe[0] + PATH.fringe[1] * (n3(p.s) * 0.5 + 0.5));
  /**
   * 원 띠 마스크. 도형을 판 밖(왼쪽으로 판 너비 세 배)에 그리고 그림자만 판 안에 떨어뜨려 흐림을 준다(캔버스 filter 없이 모든 브라우저에서 같다).
   * 출구 쪽 길은 판 오른쪽 밖까지 이어지므로 한 배만 밀면 도형이 판 왼쪽에 다시 들어온다.
   */
  const band = (radius: (i: number) => number, blur: number) => {
    const [c, g] = layer();
    const shift = 3 * W;
    g.shadowColor = '#fff'; g.shadowBlur = blur; g.shadowOffsetX = shift;
    g.fillStyle = '#fff';
    g.beginPath();
    line.forEach((p, i) => { const r = radius(i) * C; g.moveTo((p.x * C) - shift + r, p.y * C); g.arc((p.x * C) - shift, p.y * C, r, 0, Math.PI * 2); });
    g.fill();
    return c;
  };
  const halo = band(i => half[i]! + fringe[i]! + 0.07, 18);
  masked(halo, g => { g.fillStyle = kit.path.halo; g.fillRect(0, 0, W, H); }, 0.22);
  const edge = band(i => half[i]! + fringe[i]!, 7);
  masked(edge, g => { g.fillStyle = kit.path.fringe; g.fillRect(0, 0, W, H); }, 0.9);
  const dirtMask = band(i => half[i]!, 2);
  masked(dirtMask, g => fillPattern(g, kit.dirt));
  free(halo, edge);
  // 길 안쪽 그늘: 길 밖을 채운 판의 그림자를 길 안에만 남긴다(좌상단 광원이라 위·왼쪽 가장자리가 조금 더 어둡다).
  const [outside, og] = layer();
  og.fillStyle = '#000'; og.fillRect(0, 0, W, H);
  og.globalCompositeOperation = 'destination-out';
  og.drawImage(dirtMask, 0, 0);
  const [rim, rg] = layer();
  rg.save();
  rg.shadowColor = kit.path.rim; rg.shadowBlur = 14; rg.shadowOffsetX = 3; rg.shadowOffsetY = 4;
  rg.drawImage(outside, 0, 0);
  rg.restore();
  // 굽이 바퀴 자국(배치표). 안쪽 그늘과 같은 판에 그려 길 밖으로 새지 않게 한다.
  rg.lineCap = 'round';
  for (const [[x0, y0, x1, y1], from, to] of layout.wheelRuts) {
    const arc = (inset: number, d: number, width: number, alpha: number) => {
      rg.beginPath();
      rg.ellipse(((x0 + x1) / 2) * C, ((y0 + y1) / 2) * C, ((x1 - x0) / 2) * C - inset, ((y1 - y0) / 2) * C - inset, 0, ((from + d) * Math.PI) / 180, ((to - d) * Math.PI) / 180);
      rg.lineWidth = width; rg.strokeStyle = `rgba(${kit.path.rut}, ${alpha})`; rg.stroke();
    };
    arc(0, 0, 3, 0.28);
    arc(9, 8, 2, 0.2);
  }
  rg.globalCompositeOperation = 'destination-in';
  rg.drawImage(dirtMask, 0, 0);
  ctx.drawImage(rim, 0, 0);
  free(outside, rim, dirtMask);

  // 3. 설치 받침은 지면에 굽지 않는다. GroundLayer가 padSprites 배치로 따로 세워 투명도를 바꾼다(평소 흐리게, 설치 중 밝게).

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
  if (t.exists(kit.entry)) stamp(ctx, { key: 'entry', kind: 'prop', asset: kit.entry, cx: ex + 0.18, cy: ey + 0.14, w: 0.6, ox: 0.5, oy: 0.85 });

  tex.refresh();
  return true;
}

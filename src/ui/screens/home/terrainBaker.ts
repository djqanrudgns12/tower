import type { SpriteMap } from './canvasAssets';

export interface TonePool {
  x: number;
  y: number;
  rx: number;
  ry: number;
  str: number;
}

export interface SplineSample {
  x: number;
  y: number;
  t: number;
  nx: number;
  ny: number;
}

export interface ArcSample {
  x: number;
  y: number;
  dist: number;
}

/** 결정론 2D 해시 (0..1, Math.random 미사용). */
export function hash2d(ix: number, iy: number, salt: number): number {
  let h = (Math.imul(ix + 37, 374761393) + Math.imul(iy + 91, 668265263) + Math.imul(salt + 13, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade5(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** 저주파 2D 값 노이즈 (0..1). */
export function lowFreqNoise(u: number, v: number, cellsX: number, cellsY: number, salt: number): number {
  const gx = u * cellsX;
  const gy = v * cellsY;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = fade5(gx - x0);
  const ty = fade5(gy - y0);
  const n00 = hash2d(x0, y0, salt);
  const n10 = hash2d(x0 + 1, y0, salt);
  const n01 = hash2d(x0, y0 + 1, salt);
  const n11 = hash2d(x0 + 1, y0 + 1, salt);
  const nx0 = n00 + (n10 - n00) * tx;
  const nx1 = n01 + (n11 - n01) * tx;
  return nx0 + (nx1 - nx0) * ty;
}

/** 가장자리 흔들림용 1D 연속 노이즈 (-1..1). */
export function lineNoise1d(t: number, freq: number, salt: number): number {
  const g = t * freq;
  const i0 = Math.floor(g);
  const f = fade5(g - i0);
  const a = hash2d(i0, 0, salt) * 2 - 1;
  const b = hash2d(i0 + 1, 0, salt) * 2 - 1;
  return a + (b - a) * f;
}

/** Catmull-Rom 곡선 샘플러 (DOM 비의존 순수 함수 — 단위 검증 호환). */
export function sampleSpline(ctrlPts: readonly (readonly [number, number])[], samples: number): SplineSample[] {
  const out: SplineSample[] = [];
  const n = ctrlPts.length;
  if (n === 0) return out;
  if (n === 1) {
    const only = ctrlPts[0]!;
    return [{ x: only[0], y: only[1], t: 0, nx: 0, ny: 1 }];
  }

  for (let s = 0; s <= samples; s++) {
    const tGlobal = (s / samples) * (n - 1);
    const idx = Math.min(n - 2, Math.floor(tGlobal));
    const t = tGlobal - idx;
    const p0 = ctrlPts[Math.max(0, idx - 1)]!;
    const p1 = ctrlPts[idx]!;
    const p2 = ctrlPts[idx + 1]!;
    const p3 = ctrlPts[Math.min(n - 1, idx + 2)]!;
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const y =
      0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    out.push({ x, y, t: s / samples, nx: 0, ny: 1 });
  }

  for (let i = 0; i < out.length; i++) {
    const prev = out[Math.max(0, i - 1)]!;
    const next = out[Math.min(out.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    out[i]!.nx = -dy / len;
    out[i]!.ny = dx / len;
  }
  return out;
}

/** 등속 이동을 위한 누적 호 길이 테이블 생성 (DOM 비의존 순수 함수). */
export function buildArcTable(spine: readonly SplineSample[]): { table: ArcSample[]; totalDist: number } {
  if (spine.length === 0) return { table: [], totalDist: 0 };
  const first = spine[0]!;
  const table: ArcSample[] = [{ x: first.x, y: first.y, dist: 0 }];
  let totalDist = 0;
  for (let i = 1; i < spine.length; i++) {
    const prev = spine[i - 1]!;
    const cur = spine[i]!;
    totalDist += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    table.push({ x: cur.x, y: cur.y, dist: totalDist });
  }
  return { table, totalDist };
}

/** 누적 호 길이 테이블에서 진행률(0..1)의 등속 좌표를 이진 탐색으로 보간한다. */
export function sampleArcTable(table: readonly ArcSample[], totalDist: number, progress01: number): { x: number; y: number } {
  if (table.length === 0) return { x: 0, y: 0 };
  if (totalDist <= 0 || table.length === 1) {
    const f = table[0]!;
    return { x: f.x, y: f.y };
  }
  const target = Math.max(0, Math.min(1, progress01)) * totalDist;
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if ((table[mid]?.dist ?? 0) <= target) lo = mid;
    else hi = mid;
  }
  const a = table[lo]!;
  const b = table[hi]!;
  const span = b.dist - a.dist;
  const t = span > 0 ? (target - a.dist) / span : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function traceBandPolygon(
  ctx: CanvasRenderingContext2D,
  spine: readonly SplineSample[],
  halfWidthFn: (t: number, side: 1 | -1) => number,
  ox: number,
  oy: number,
): void {
  if (spine.length === 0) return;
  ctx.beginPath();
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i]!;
    const hw = halfWidthFn(p.t, 1);
    const px = p.x + p.nx * hw + ox;
    const py = p.y + p.ny * hw + oy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = spine.length - 1; i >= 0; i--) {
    const p = spine[i]!;
    const hw = halfWidthFn(p.t, -1);
    ctx.lineTo(p.x - p.nx * hw + ox, p.y - p.ny * hw + oy);
  }
  ctx.closePath();
}

/**
 * 본게임 src/game/layoutGround.ts 원리를 이식한 3톤 저주파 잔디 언덕 베이커.
 * 타일 격자 반복감 없이 숲 발밑 그늘(shadePools)과 양지 언덕(lightPools)을 부드럽게 합성한다.
 */
export function bakeThreeToneGrass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: SpriteMap,
  shadePools: readonly TonePool[],
  lightPools: readonly TonePool[],
  salt: number,
): void {
  ctx.fillStyle = '#75a448';
  ctx.fillRect(0, 0, w, h);

  const baseImg = sprites.get('ground.grass.base')?.img ?? sprites.get('ground.grass')?.img;
  if (baseImg && baseImg.width > 0) {
    const pat = ctx.createPattern(baseImg, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }
  }

  if (typeof document === 'undefined') return;

  const mw = 136;
  const mh = 96;
  const maskCvs = document.createElement('canvas');
  maskCvs.width = mw;
  maskCvs.height = mh;
  const mctx = maskCvs.getContext('2d');

  const texCvs = document.createElement('canvas');
  texCvs.width = Math.max(1, Math.round(w));
  texCvs.height = Math.max(1, Math.round(h));
  const tctx = texCvs.getContext('2d');

  if (!mctx || !tctx) {
    maskCvs.width = 0;
    texCvs.width = 0;
    return;
  }

  // 1) 숲 그늘 마스크 + ShadePools (multiply)
  const shadeData = mctx.createImageData(mw, mh);
  for (let py = 0; py < mh; py++) {
    const v = py / (mh - 1);
    for (let px = 0; px < mw; px++) {
      const u = px / (mw - 1);
      const val = lowFreqNoise(u, v, 4.2, 3.4, salt) * 0.68 + lowFreqNoise(u, v, 8.5, 6.8, salt + 7) * 0.32;
      let poolBoost = 0;
      for (let i = 0; i < shadePools.length; i++) {
        const p = shadePools[i]!;
        const dx = (u * w - p.x) / p.rx;
        const dy = (v * h - p.y) / p.ry;
        const d2 = dx * dx + dy * dy;
        if (d2 < 3.2) poolBoost += p.str * Math.exp(-d2 * 1.15);
      }
      const a = Math.max(0, Math.min(1, (val - 0.36) * 1.25 + poolBoost));
      const idx = (py * mw + px) * 4;
      shadeData.data[idx] = 255;
      shadeData.data[idx + 1] = 255;
      shadeData.data[idx + 2] = 255;
      shadeData.data[idx + 3] = Math.round(a * 235);
    }
  }
  mctx.putImageData(shadeData, 0, 0);

  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.drawImage(maskCvs, 0, 0, w, h);
  tctx.globalCompositeOperation = 'source-in';
  const shadeImg = sprites.get('ground.grass.shade')?.img;
  if (shadeImg && shadeImg.width > 0) {
    const pat = tctx.createPattern(shadeImg, 'repeat');
    tctx.fillStyle = pat ?? '#49702b';
  } else {
    tctx.fillStyle = '#49702b';
  }
  tctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.56;
  ctx.drawImage(texCvs, 0, 0, w, h);
  ctx.restore();

  // 2) 햇살 언덕 마스크 + LightPools
  const lightData = mctx.createImageData(mw, mh);
  for (let py = 0; py < mh; py++) {
    const v = py / (mh - 1);
    for (let px = 0; px < mw; px++) {
      const u = px / (mw - 1);
      const val = lowFreqNoise(u, v, 3.6, 2.8, salt + 31);
      let sunBoost = 0;
      for (let i = 0; i < lightPools.length; i++) {
        const p = lightPools[i]!;
        const dx = (u * w - p.x) / p.rx;
        const dy = (v * h - p.y) / p.ry;
        const d2 = dx * dx + dy * dy;
        if (d2 < 3.0) sunBoost += p.str * Math.exp(-d2);
      }
      const a = Math.max(0, Math.min(1, (val - 0.42) * 1.3 + sunBoost));
      const idx = (py * mw + px) * 4;
      lightData.data[idx] = 255;
      lightData.data[idx + 1] = 255;
      lightData.data[idx + 2] = 255;
      lightData.data[idx + 3] = Math.round(a * 220);
    }
  }
  mctx.putImageData(lightData, 0, 0);

  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.drawImage(maskCvs, 0, 0, w, h);
  tctx.globalCompositeOperation = 'source-in';
  const lightImg = sprites.get('ground.grass.light')?.img;
  if (lightImg && lightImg.width > 0) {
    const pat = tctx.createPattern(lightImg, 'repeat');
    tctx.fillStyle = pat ?? '#a4d165';
  } else {
    tctx.fillStyle = '#a4d165';
  }
  tctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.46;
  ctx.drawImage(texCvs, 0, 0, w, h);
  ctx.restore();

  maskCvs.width = 0;
  maskCvs.height = 0;
  texCvs.width = 0;
  texCvs.height = 0;
}

/**
 * 본게임 5겹 입체 흙길 렌더러 (halo -> fringe -> path.dirt -> 좌상단 광원 evenodd 턱그늘 rim -> 수레바퀴 자국).
 * highContrast가 켜지면 진한 호두나무 테두리와 밝은 안내 테를 바깥에 둘러 가독성을 높인다.
 */
export function drawNaturalRoad(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteMap,
  ctrlPts: readonly (readonly [number, number])[],
  baseHalfW: number,
  salt: number,
  highContrast = false,
): SplineSample[] {
  const spine = sampleSpline(ctrlPts, 96);
  if (spine.length < 2) return spine;

  const hwCore = (t: number, side: 1 | -1) =>
    baseHalfW * (1 + 0.1 * lineNoise1d(t, 9, salt + (side > 0 ? 3 : 19)));
  const hwFringe = (t: number, side: 1 | -1) =>
    hwCore(t, side) + baseHalfW * (0.17 + 0.06 * lineNoise1d(t, 15, salt + 41 + side));
  const hwHalo = (t: number, side: 1 | -1) => hwFringe(t, side) + baseHalfW * 0.28;

  // 1) 바깥 풀그늘 halo
  ctx.save();
  traceBandPolygon(ctx, spine, hwHalo, 0, 0);
  ctx.fillStyle = 'rgba(38, 58, 20, 0.24)';
  ctx.fill();
  ctx.restore();

  if (highContrast) {
    ctx.save();
    traceBandPolygon(ctx, spine, (t, side) => hwCore(t, side) + 5, 0, 0);
    ctx.fillStyle = '#261c14';
    ctx.fill();
    traceBandPolygon(ctx, spine, (t, side) => hwCore(t, side) + 2.4, 0, 0);
    ctx.fillStyle = '#fff6d8';
    ctx.fill();
    ctx.restore();
  } else {
    // 2) 자연 흙번짐 fringe
    ctx.save();
    traceBandPolygon(ctx, spine, hwFringe, 0, 0);
    ctx.fillStyle = '#8b6a40';
    ctx.fill();
    ctx.restore();
  }

  // 3) 본체 path.dirt 패턴
  ctx.save();
  traceBandPolygon(ctx, spine, hwCore, 0, 0);
  const dirtImg = sprites.get('path.dirt')?.img;
  const pat = dirtImg && dirtImg.width > 0 ? ctx.createPattern(dirtImg, 'repeat') : null;
  ctx.fillStyle = pat ?? '#cfa972';
  ctx.fill();

  // 4) 좌상단 광원 흙턱 안쪽 그늘 rim (clip 후 역방향 오프셋 evenodd)
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-300, -300, 5000, 4000);
  const rimOffX = Math.max(1.6, baseHalfW * 0.14);
  const rimOffY = Math.max(2.0, baseHalfW * 0.18);
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i]!;
    const hw = hwCore(p.t, 1);
    const px = p.x + p.nx * hw + rimOffX;
    const py = p.y + p.ny * hw + rimOffY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = spine.length - 1; i >= 0; i--) {
    const p = spine[i]!;
    const hw = hwCore(p.t, -1);
    ctx.lineTo(p.x - p.nx * hw + rimOffX, p.y - p.ny * hw + rimOffY);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(58, 37, 17, 0.30)';
  ctx.fill('evenodd');

  // 5) 은은한 수레바퀴 두 줄 흔적
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    for (let i = 4; i < spine.length - 4; i++) {
      const p = spine[i]!;
      const off = baseHalfW * 0.36 * side;
      const rx = p.x + p.nx * off;
      const ry = p.y + p.ny * off;
      if (i === 4) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.strokeStyle = 'rgba(84, 56, 28, 0.18)';
    ctx.lineWidth = Math.max(1.2, baseHalfW * 0.11);
    ctx.setLineDash([baseHalfW * 0.9, baseHalfW * 0.45]);
    ctx.stroke();
  }
  ctx.restore();

  return spine;
}

/** 맑은 시냇물 5겹 렌더러 (풀그늘 halo -> 모래톱 -> 맑은 여울 -> 깊은 물골 -> 좌상단 물턱 그늘). */
export function drawNaturalBrook(
  ctx: CanvasRenderingContext2D,
  ctrlPts: readonly (readonly [number, number])[],
  baseHalfW: number,
  salt: number,
): SplineSample[] {
  const spine = sampleSpline(ctrlPts, 90);
  if (spine.length < 2) return spine;

  const hwWater = (t: number, side: 1 | -1) =>
    baseHalfW * (1 + 0.13 * lineNoise1d(t, 7, salt + (side > 0 ? 5 : 23)));
  const hwBank = (t: number, side: 1 | -1) => hwWater(t, side) + baseHalfW * 0.22;
  const hwHalo = (t: number, side: 1 | -1) => hwBank(t, side) + baseHalfW * 0.28;
  const hwDeep = (t: number, side: 1 | -1) => hwWater(t, side) * 0.56;

  ctx.save();
  traceBandPolygon(ctx, spine, hwHalo, 0, 0);
  ctx.fillStyle = 'rgba(36, 62, 26, 0.22)';
  ctx.fill();

  traceBandPolygon(ctx, spine, hwBank, 0, 0);
  ctx.fillStyle = '#dec38e';
  ctx.fill();

  traceBandPolygon(ctx, spine, hwWater, 0, 0);
  ctx.fillStyle = '#4a9cc2';
  ctx.fill();

  traceBandPolygon(ctx, spine, hwDeep, 0, 0);
  ctx.fillStyle = '#337ea3';
  ctx.fill();

  ctx.save();
  traceBandPolygon(ctx, spine, hwWater, 0, 0);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-300, -300, 5000, 4000);
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i]!;
    const hw = hwWater(p.t, 1);
    if (i === 0) ctx.moveTo(p.x + p.nx * hw + 2.2, p.y + p.ny * hw + 2.8);
    else ctx.lineTo(p.x + p.nx * hw + 2.2, p.y + p.ny * hw + 2.8);
  }
  for (let i = spine.length - 1; i >= 0; i--) {
    const p = spine[i]!;
    const hw = hwWater(p.t, -1);
    ctx.lineTo(p.x - p.nx * hw + 2.2, p.y - p.ny * hw + 2.8);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(20, 54, 74, 0.28)';
  ctx.fill('evenodd');
  ctx.restore();

  ctx.restore();
  return spine;
}

/** 오브젝트 발밑에 부드러운 단색 접지 타원 그림자를 깔고 원화를 그린다 (좌우반전 없음). */
export function drawSpriteGrounded(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteMap,
  key: string,
  footX: number,
  footY: number,
  drawW: number,
  drawH: number,
  shadowAlpha = 0.22,
): boolean {
  const img = sprites.get(key)?.img;
  if (!img || img.width <= 0) return false;
  if (shadowAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(32, 46, 18, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(footX, footY - drawH * 0.05, drawW * 0.36, drawH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(img, footX - drawW * 0.5, footY - drawH * 0.92, drawW, drawH);
  return true;
}

import { useEffect, useRef } from 'react';
import type { MotionMode } from '../../../application/session';
import { rand01, useLobbySprites, type SpriteMap } from './canvasAssets';
import {
  bakeThreeToneGrass,
  buildArcTable,
  drawNaturalRoad,
  drawSpriteGrounded,
  sampleArcTable,
  sampleSpline,
  type ArcSample,
  type TonePool,
} from './terrainBaker';

interface Props {
  motionMode: MotionMode;
  highContrastMap: boolean;
  paused: boolean;
  className?: string | undefined;
}

const FRAME_MS = 1000 / 30;
const LOOP_MS = 11000;
const ACTIVE_SPAN = 0.84;
const STATIC_CYCLE = 0.18;
const STATIC_TIME_MS = 2000;
/** 그림(타워·적·연못·비석)이 잘리지 않는 최소 설계 높이(css px). 크롬북 등 낮은 무대에서는 이 비율로 축소해 구도를 그대로 유지한다. */
const MIN_DESIGN_H = 156;
const BASE_W = 540;
const BASE_H = 190;
const MAX_SCALE = 1.45;

const STAGE_CTRL_NORM: readonly (readonly [number, number])[] = [
  [-0.06, 0.64],
  [0.16, 0.63],
  [0.31, 0.38],
  [0.53, 0.37],
  [0.68, 0.69],
  [0.89, 0.68],
];

const DEFEAT_PROGRESS: readonly [number, number, number, number, number] = [0.76, 0.7, 0.82, 0.73, 0.89];

const ACORN_BY_SLOT: readonly string[] = [
  'acorn.runner',
  'acorn.shell',
  'acorn.brute',
  'acorn.wisp',
  'acorn.boss5',
];

const TOWER_DEFS: readonly {
  x: number;
  y: number;
  id: 'archer' | 'frost' | 'cannon';
  pad: 'slot.pad.0' | 'slot.pad.1';
  fixed?: boolean;
}[] = [
  { x: 0.26, y: 0.8, id: 'archer', pad: 'slot.pad.0' },
  { x: 0.46, y: 0.62, id: 'frost', pad: 'slot.pad.1', fixed: true },
  { x: 0.69, y: 0.41, id: 'cannon', pad: 'slot.pad.0' },
];

export interface DemoEnemy {
  slot: number;
  kind: 'walker' | 'boss';
  x: number;
  y: number;
  rawP: number;
  march01: number;
  hpRatio: number;
  alpha: number;
  hit: boolean;
  frameIdx: number;
  bob: number;
}

export interface DemoProjectile {
  towerId: 'archer' | 'frost' | 'cannon';
  x: number;
  y: number;
  vx: number;
  vy: number;
  flying: boolean;
  impactT: number | null;
  targetX: number;
  targetY: number;
}

export interface StageDemoSnapshot {
  enemies: DemoEnemy[];
  towerAngles: number[];
  towerRecoils: number[];
  projectiles: DemoProjectile[];
}

interface PathArcMemo {
  w: number;
  h: number;
  table: ArcSample[];
  totalDist: number;
}

let pathMemo: PathArcMemo | null = null;

function sampleStagePath(progress01: number, w: number, h: number): { x: number; y: number } {
  if (!pathMemo || pathMemo.w !== w || pathMemo.h !== h) {
    const ctrlPts = STAGE_CTRL_NORM.map(([nx, ny]): readonly [number, number] => [nx * w, ny * h]);
    const spine = sampleSpline(ctrlPts, 96);
    const { table, totalDist } = buildArcTable(spine);
    pathMemo = { w, h, table, totalDist };
  }
  return sampleArcTable(pathMemo.table, pathMemo.totalDist, progress01);
}

function unitStateAt(slot: number, timeMs: number, w: number, h: number, animateCombat: boolean) {
  const baseT = animateCombat ? timeMs / LOOP_MS : STATIC_CYCLE;
  const unitCycle = (((baseT - slot * 0.2) % 1) + 1) % 1;
  if (unitCycle >= ACTIVE_SPAN) return null;
  const kind: 'walker' | 'boss' = slot === 4 ? 'boss' : 'walker';
  const march01 = unitCycle / ACTIVE_SPAN;
  const defeatP = DEFEAT_PROGRESS[slot] ?? 0.76;
  const rawP = march01 * defeatP;
  const pos = sampleStagePath(rawP, w, h);
  const hpRatio = march01 < 0.92 ? Math.max(0.06, 1 - (march01 / 0.92) * 0.94) : 0;
  const alpha = march01 < 0.92 ? 1 : Math.max(0, 1 - (march01 - 0.92) / 0.08);
  return { slot, kind, x: pos.x, y: pos.y, rawP, march01, hpRatio, alpha };
}

/** 5웨이브 미니 시연의 시간별 결정론 상태를 계산한다(단위 검증 겸용 — DOM 비의존). */
export function sampleStageDemo(w: number, h: number, timeMs: number, animateCombat: boolean): StageDemoSnapshot {
  const bySlot = new Map<number, DemoEnemy>();
  for (let slot = 0; slot < 5; slot++) {
    const u = unitStateAt(slot, timeMs, w, h, animateCombat);
    if (!u || u.alpha <= 0.01) continue;
    const frameCount = u.kind === 'boss' ? 2 : 4;
    const frameIdx = animateCombat ? Math.floor(((timeMs / 150 + slot * 1.7) % frameCount + frameCount) % frameCount) : 0;
    const bob = animateCombat ? Math.abs(Math.sin(timeMs * 0.011 + slot * 1.3)) * 2.2 : 0;
    bySlot.set(slot, { ...u, hit: false, frameIdx, bob });
  }

  const towerAngles: number[] = [];
  const towerRecoils: number[] = [];
  const projectiles: DemoProjectile[] = [];

  for (let ti = 0; ti < TOWER_DEFS.length; ti++) {
    const td = TOWER_DEFS[ti]!;
    const tx = td.x * w;
    const ty = td.y * h;
    const shotPeriod = 620 + ti * 140;
    const phaseOffset = rand01(ti, 71) * shotPeriod;
    const shotClock = timeMs + phaseOffset;
    const shotSeq = Math.floor(shotClock / shotPeriod);
    const shotPhase = (((shotClock % shotPeriod) + shotPeriod) % shotPeriod) / shotPeriod;
    const tStart = shotSeq * shotPeriod - phaseOffset;

    let lockedSlot = -1;
    let bestDist = Infinity;
    for (let slot = 0; slot < 5; slot++) {
      const startState = unitStateAt(slot, animateCombat ? tStart : timeMs, w, h, animateCombat);
      if (!startState || startState.march01 >= 0.82 || startState.rawP < 0.02) continue;
      if (!bySlot.has(slot)) continue;
      const dist = Math.hypot(startState.x - tx, startState.y - ty);
      if (dist < bestDist) {
        bestDist = dist;
        lockedSlot = slot;
      }
    }

    if (lockedSlot < 0) {
      for (const [slot, enemy] of bySlot) {
        if (enemy.hpRatio <= 0) continue;
        const dist = Math.hypot(enemy.x - tx, enemy.y - ty);
        if (dist < bestDist) {
          bestDist = dist;
          lockedSlot = slot;
        }
      }
    }

    const target = lockedSlot >= 0 ? bySlot.get(lockedSlot) : undefined;
    const angle = target ? Math.atan2(target.y - (ty - 16), target.x - tx) : -0.6;
    const recoil = animateCombat && target && shotPhase < 0.16 ? (1 - shotPhase / 0.16) * 2.2 : 0;
    towerAngles.push(angle);
    towerRecoils.push(recoil);

    if (animateCombat && target) {
      const muzzleDist = td.fixed ? 0 : 12;
      const sx0 = tx + Math.cos(angle) * muzzleDist;
      const sy0 = ty - 18 + Math.sin(angle) * muzzleDist;
      const txEnd = target.x;
      const tyEnd = target.y - 10;
      const flying = shotPhase <= 0.86;
      const flightT = Math.min(1, shotPhase / 0.86);
      const arc = td.id === 'cannon' ? Math.sin(flightT * Math.PI) * 18 : 0;
      const dArc = td.id === 'cannon' ? Math.cos(flightT * Math.PI) * Math.PI * 18 : 0;
      const px = sx0 + (txEnd - sx0) * flightT;
      const py = sy0 + (tyEnd - sy0) * flightT - arc;
      const vx = txEnd - sx0;
      const vy = tyEnd - sy0 - dArc;
      const impactT = shotPhase >= 0.82 ? Math.min(1, (shotPhase - 0.82) / 0.18) : null;
      if (impactT !== null && target.hpRatio > 0) {
        target.hit = true;
      }
      projectiles.push({
        towerId: td.id,
        x: px,
        y: py,
        vx,
        vy,
        flying,
        impactT,
        targetX: txEnd,
        targetY: tyEnd,
      });
    }
  }

  const enemies = [...bySlot.values()].sort((a, b) => a.y - b.y);
  return { enemies, towerAngles, towerRecoils, projectiles };
}

interface StageTerrainCache {
  key: string;
  canvas: HTMLCanvasElement;
}

function ensureStageBaked(
  cacheRef: { current: StageTerrainCache | null },
  w: number,
  h: number,
  pxScale: number,
  sprites: SpriteMap,
  highContrastMap: boolean,
): StageTerrainCache {
  const cacheKey = `${Math.round(w)}x${Math.round(h)}@${pxScale.toFixed(3)}@hc${highContrastMap ? 1 : 0}@sp${sprites.size}`;
  if (cacheRef.current && cacheRef.current.key === cacheKey) {
    return cacheRef.current;
  }

  if (cacheRef.current) {
    cacheRef.current.canvas.width = 0;
    cacheRef.current.canvas.height = 0;
  }

  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * pxScale));
  off.height = Math.max(1, Math.round(h * pxScale));
  const ctx = off.getContext('2d');
  if (!ctx) {
    const empty: StageTerrainCache = { key: cacheKey, canvas: off };
    cacheRef.current = empty;
    return empty;
  }

  ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);

  const shadePools: TonePool[] = [
    { x: w * 0.08, y: h * 0.18, rx: 95, ry: 65, str: 0.38 },
    { x: w * 0.92, y: h * 0.22, rx: 95, ry: 65, str: 0.36 },
    { x: w * 0.84, y: h * 0.44, rx: 70, ry: 55, str: 0.26 },
    { x: w * 0.16, y: h * 0.82, rx: 80, ry: 52, str: 0.24 },
  ];
  const lightPools: TonePool[] = [
    { x: w * 0.44, y: h * 0.48, rx: 165, ry: 90, str: 0.38 },
    { x: w * 0.68, y: h * 0.56, rx: 120, ry: 75, str: 0.28 },
  ];

  // 1) 3톤 저주파 잔디 언덕
  bakeThreeToneGrass(ctx, w, h, sprites, shadePools, lightPools, 109);

  // 2) 들꽃 군락 패치
  const m0 = sprites.get('ground.meadow.0')?.img;
  const m1 = sprites.get('ground.meadow.1')?.img;
  const m2 = sprites.get('ground.meadow.2')?.img;
  ctx.save();
  ctx.globalAlpha = 0.8;
  if (m0) ctx.drawImage(m0, w * 0.03, h * 0.66, 92, 62);
  if (m1) ctx.drawImage(m1, w * 0.51, h * 0.72, 94, 64);
  if (m2) ctx.drawImage(m2, w * 0.56, h * 0.06, 86, 56);
  ctx.restore();

  // 3) 본게임 5겹 S자 입체 흙길 (고대비 설정 반영)
  const ctrlPts = STAGE_CTRL_NORM.map(([nx, ny]): readonly [number, number] => [nx * w, ny * h]);
  drawNaturalRoad(ctx, sprites, ctrlPts, 14.2, 211, highContrastMap);

  // 길가 자갈 & 풀술 디테일
  const roadDetails: readonly { key: string; x: number; y: number; w: number; h: number }[] = [
    { key: 'path.pebbles.0', x: w * 0.12, y: h * 0.55, w: 17, h: 13 },
    { key: 'path.pebbles.1', x: w * 0.39, y: h * 0.31, w: 16, h: 12 },
    { key: 'path.pebbles.2', x: w * 0.62, y: h * 0.53, w: 16, h: 12 },
    { key: 'path.pebbles.0', x: w * 0.78, y: h * 0.64, w: 17, h: 13 },
    { key: 'path.tuft.0', x: w * 0.19, y: h * 0.64, w: 18, h: 14 },
    { key: 'path.tuft.1', x: w * 0.54, y: h * 0.41, w: 17, h: 13 },
    { key: 'path.tuft.2', x: w * 0.72, y: h * 0.74, w: 18, h: 14 },
  ];
  for (const d of roadDetails) {
    const img = sprites.get(d.key)?.img;
    if (img) ctx.drawImage(img, d.x, d.y, d.w, d.h);
  }

  // 4) 연못 & 설치 이끼 기단 (상단 오버레이 배지와 겹치지 않도록 여유 확보)
  const pond = sprites.get('landmark.pond')?.img;
  if (pond) {
    ctx.drawImage(pond, w * 0.062, h * 0.245, 84, 46);
  }

  const pad0 = sprites.get('slot.pad.0')?.img ?? sprites.get('slot.base')?.img;
  const pad1 = sprites.get('slot.pad.1')?.img ?? pad0;
  const emptyPads: readonly [number, number][] = [
    [w * 0.38, h * 0.81],
    [w * 0.59, h * 0.19],
  ];
  if (pad1) {
    ctx.drawImage(pad1, emptyPads[0]![0] - 19, emptyPads[0]![1] - 14, 38, 28);
  }
  if (pad0) {
    ctx.drawImage(pad0, emptyPads[1]![0] - 19, emptyPads[1]![1] - 14, 38, 28);
  }

  for (const td of TOWER_DEFS) {
    const tx = td.x * w;
    const ty = td.y * h;
    if (highContrastMap) {
      ctx.strokeStyle = '#261c14';
      ctx.lineWidth = 3;
      ctx.strokeRect(tx - 22, ty - 15, 44, 30);
      ctx.strokeStyle = '#fff6d8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx - 20, ty - 13, 40, 26);
    }
    const padImg = sprites.get(td.pad)?.img ?? pad0;
    if (padImg) ctx.drawImage(padImg, tx - 23, ty - 16, 46, 35);
  }

  // 5) 정원 풍경 프롭 (뒤쪽 레이어 Y-정렬, 상단 좌·우 배지 회피 구도)
  const staticProps: { key: string; x: number; y: number; w: number; h: number; sh: number }[] = [
    { key: 'edge.forest.0', x: 34, y: 38, w: 108, h: 68, sh: 0 },
    { key: 'edge.forest.1', x: w - 34, y: 38, w: 108, h: 68, sh: 0 },
    { key: 'prop.fence.h', x: w * 0.37, y: h * 0.19, w: 46, h: 25, sh: 0.14 },
    { key: 'deco.rock', x: w * 0.43, y: h * 0.22, w: 28, h: 22, sh: 0.16 },
    { key: 'map.courtyard.prop.flowerpot', x: w * 0.53, y: h * 0.23, w: 26, h: 26, sh: 0.16 },
    { key: 'map.river_z.prop.reeds', x: w * 0.225, y: h * 0.38, w: 35, h: 33, sh: 0.1 },
    { key: 'map.courtyard.tree.0', x: w * 0.032, y: h * 0.51, w: 54, h: 54, sh: 0.22 },
    { key: 'map.entry', x: w * 0.072, y: h * 0.56, w: 28, h: 30, sh: 0.18 },
    { key: 'edge.hedge.0', x: w * 0.95, y: h * 0.52, w: 66, h: 44, sh: 0.16 },
    { key: 'tower.banner.A1', x: w * 0.81, y: h * 0.52, w: 50, h: 50, sh: 0.24 },
    { key: 'prop.flowerbed', x: w * 0.12, y: h * 0.87, w: 48, h: 35, sh: 0.14 },
    { key: 'prop.mushrooms', x: w * 0.56, y: h * 0.85, w: 27, h: 23, sh: 0.14 },
    { key: 'prop.stump', x: w * 0.64, y: h * 0.89, w: 30, h: 26, sh: 0.18 },
    { key: 'prop.log', x: w * 0.75, y: h * 0.91, w: 38, h: 25, sh: 0.16 },
    { key: 'edge.hedge.1', x: w * 0.94, y: h * 0.94, w: 72, h: 48, sh: 0.16 },
  ];

  staticProps.sort((a, b) => a.y - b.y);
  for (const p of staticProps) {
    drawSpriteGrounded(ctx, sprites, p.key, p.x, p.y, p.w, p.h, p.sh);
  }

  // 상단 중앙 한글 돌조각 ('한' 각인)
  const sw = 44;
  const sx = w * 0.48;
  const sy = h * 0.24;
  if (drawSpriteGrounded(ctx, sprites, 'deco.stele', sx, sy + sw * 0.12, sw, sw, 0.2)) {
    ctx.fillStyle = '#3f342c';
    ctx.font = '800 12px "Pretendard Variable", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('한', sx, sy - sw * 0.34);
  }

  const built: StageTerrainCache = { key: cacheKey, canvas: off };
  cacheRef.current = built;
  return built;
}

type StageRenderable =
  | { kind: 'gate'; y: number }
  | {
      kind: 'tower';
      y: number;
      ti: number;
      tx: number;
      ty: number;
      td: (typeof TOWER_DEFS)[number];
      angle: number;
      recoil: number;
    }
  | { kind: 'enemy'; y: number; enemy: DemoEnemy };

function drawStageFrame(
  ctx: CanvasRenderingContext2D,
  cacheRef: { current: StageTerrainCache | null },
  w: number,
  h: number,
  pxScale: number,
  sprites: SpriteMap,
  timeMs: number,
  animateCombat: boolean,
  highContrastMap: boolean,
): void {
  const baked = ensureStageBaked(cacheRef, w, h, pxScale, sprites, highContrastMap);
  if (baked.canvas.width > 0 && baked.canvas.height > 0) {
    ctx.drawImage(baked.canvas, 0, 0, w, h);
  }

  // 서리 타워 주위 은은한 냉기 오라 링
  const frostPulse = ((animateCombat ? timeMs : STATIC_TIME_MS) % 2400) / 2400;
  ctx.save();
  ctx.strokeStyle = `rgba(155, 232, 255, ${(1 - frostPulse) * 0.42})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(w * 0.46, h * 0.6, 18 + frostPulse * 28, 11 + frostPulse * 17, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const demo = sampleStageDemo(w, h, timeMs, animateCombat);

  // 타워 + 성문 + 도토리 적군 통합 Y-정렬 렌더 큐
  const renderables: StageRenderable[] = [{ kind: 'gate', y: h * 0.7 }];
  for (let ti = 0; ti < TOWER_DEFS.length; ti++) {
    const td = TOWER_DEFS[ti]!;
    const tx = td.x * w;
    const ty = td.y * h;
    renderables.push({
      kind: 'tower',
      y: ty,
      ti,
      tx,
      ty,
      td,
      angle: demo.towerAngles[ti] ?? -0.6,
      recoil: demo.towerRecoils[ti] ?? 0,
    });
  }
  for (const enemy of demo.enemies) {
    renderables.push({ kind: 'enemy', y: enemy.y, enemy });
  }
  renderables.sort((a, b) => a.y - b.y);

  for (const item of renderables) {
    if (item.kind === 'gate') {
      const gx = w * 0.9;
      const gy = h * 0.72;
      if (!drawSpriteGrounded(ctx, sprites, 'map.gate', gx, gy, 76, 76, 0.24)) {
        ctx.fillStyle = '#754b2d';
        ctx.fillRect(gx - 22, gy - 44, 44, 46);
      }
      continue;
    }

    if (item.kind === 'tower') {
      const { ti, tx, ty, td, angle, recoil } = item;
      const bodyImg = sprites.get(`tower.${td.id}`)?.img;
      const weaponImg = sprites.get(`tower.${td.id}.weapon`)?.img;
      if (bodyImg) {
        ctx.drawImage(bodyImg, tx - 26, ty - 42, 52, 52);
      } else {
        ctx.fillStyle = '#6c5a49';
        ctx.beginPath();
        ctx.arc(tx, ty - 8, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      if (weaponImg) {
        ctx.save();
        const hoverY = td.fixed && animateCombat ? Math.sin(timeMs * 0.004 + ti) * 2.1 : 0;
        const rx = td.fixed ? 0 : -Math.cos(angle) * recoil;
        const ry = td.fixed ? 0 : -Math.sin(angle) * recoil;
        ctx.translate(tx + rx, ty - 18 + hoverY + ry);
        if (!td.fixed) ctx.rotate(angle);
        ctx.drawImage(weaponImg, -17, -17, 34, 34);
        ctx.restore();
      }
      continue;
    }

    const e = item.enemy;
    const acornKey = ACORN_BY_SLOT[e.slot] ?? 'acorn.runner';
    const acornSprite = sprites.get(acornKey)?.img;
    const hitSprite = e.hit ? sprites.get(`enemy.${e.kind}.hit`)?.img : null;
    const walkSprite =
      acornSprite ??
      hitSprite ??
      sprites.get(`enemy.${e.kind}.${e.frameIdx}`)?.img ??
      sprites.get(`enemy.${e.kind}.0`)?.img;
    const size = e.kind === 'boss' ? 48 : 35;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = 'rgba(34, 24, 14, 0.28)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y - 2, size * 0.3, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (walkSprite) {
      ctx.drawImage(walkSprite, e.x - size / 2, e.y - size * 0.84 - e.bob, size, size);
    } else {
      ctx.fillStyle = e.kind === 'boss' ? '#7a2520' : '#4a6b3b';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 8 - e.bob, e.kind === 'boss' ? 13 : 9, 0, Math.PI * 2);
      ctx.fill();
    }

    if (e.hpRatio > 0) {
      const barW = e.kind === 'boss' ? 34 : 22;
      const bx = e.x - barW / 2;
      const by = e.y - size * 0.86 - 5;
      ctx.fillStyle = '#261c14';
      ctx.fillRect(bx - 1, by - 1, barW + 2, 5);
      ctx.fillStyle = e.kind === 'boss' ? '#e0533c' : '#58c24c';
      ctx.fillRect(bx, by, Math.max(2, barW * e.hpRatio), 3);
    }
    ctx.restore();
  }

  // 투사체 연출 및 탄착 파문 (타워 유형별 공예 디테일 적용)
  for (const p of demo.projectiles) {
    if (p.flying) {
      ctx.save();
      const ang = Math.atan2(p.vy, p.vx);
      if (p.towerId === 'cannon') {
        // 불꽃 심지 꼬리 + 반사광이 맺힌 무쇠 대포알
        const tailX = p.x - Math.cos(ang) * 5.2;
        const tailY = p.y - Math.sin(ang) * 5.2;
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath();
        ctx.arc(tailX, tailY, 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3f352f';
        ctx.strokeStyle = '#1f1712';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#cfc3b8';
        ctx.beginPath();
        ctx.arc(p.x - 1.3, p.y - 1.3, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.towerId === 'frost') {
        // 하늘빛 얼음 결정 마름모
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#9be8ff';
        ctx.strokeStyle = '#245875';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(0, 3.4);
        ctx.lineTo(-4.5, 0);
        ctx.lineTo(0, -3.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // 궁수 깃화살
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#261c14';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-5.5, 0);
        ctx.lineTo(4.5, 0);
        ctx.stroke();
        ctx.strokeStyle = '#ffe999';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(4, 0);
        ctx.stroke();
        ctx.fillStyle = '#fff7d1';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(2, -2.5);
        ctx.lineTo(2, 2.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    if (p.impactT !== null) {
      ctx.save();
      ctx.globalAlpha = (1 - p.impactT) * 0.85;
      ctx.strokeStyle = p.towerId === 'frost' ? '#b8f0ff' : p.towerId === 'cannon' ? '#f4a24c' : '#fff6c4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.targetX, p.targetY, 3.5 + p.impactT * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 구름 그림자 & 연못가 나비 (전체 연출에서는 실시간 이동, 정지에서는 결정론 고정)
  if (animateCombat) {
    const cloud = sprites.get('fx.cloudshadow.0')?.img;
    if (cloud) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.11;
      const cx = ((timeMs * 0.012) % (w + 220)) - 110;
      ctx.drawImage(cloud, cx, -10, 190, 110);
      ctx.restore();
    }
  }
  const bfKey = animateCombat && Math.floor(timeMs / 220) % 2 === 1 ? 'fx.butterfly.yellow.1' : 'fx.butterfly.yellow.0';
  const bf = sprites.get(bfKey)?.img;
  if (bf) {
    const tClock = animateCombat ? timeMs : STATIC_TIME_MS;
    const bx = w * 0.17 + Math.sin(tClock * 0.0018) * 11;
    const by = h * 0.25 + Math.cos(tClock * 0.0023) * 5;
    ctx.drawImage(bf, bx, by, 16, 16);
  }
}

export function MiniStageCanvas({ motionMode, highContrastMap, paused, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<StageTerrainCache | null>(null);
  const sprites = useLobbySprites();

  useEffect(() => {
    return () => {
      if (cacheRef.current) {
        cacheRef.current.canvas.width = 0;
        cacheRef.current.canvas.height = 0;
        cacheRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 480;
    let height = 162;
    let pxScale = 1;
    let raf = 0;
    let lastDraw = -Infinity;
    const animateCombat = motionMode === 'full' && !paused;

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = Math.max(180, Math.round(rect.width || 480));
      const cssH = Math.max(60, Math.round(rect.height || 162));
      const k =
        cssH < MIN_DESIGN_H
          ? cssH / MIN_DESIGN_H
          : Math.min(MAX_SCALE, Math.max(1, Math.min(cssW / BASE_W, cssH / BASE_H)));
      width = cssW / k;
      height = cssH / k;
      pxScale = dpr * k;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
      drawStageFrame(
        ctx,
        cacheRef,
        width,
        height,
        pxScale,
        sprites,
        animateCombat ? performance.now() : STATIC_TIME_MS,
        animateCombat,
        highContrastMap,
      );
    };

    syncSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    ro?.observe(canvas);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastDraw = -Infinity;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const loop = (now: number) => {
      if (!animateCombat) return;
      raf = requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;
      if (now >= lastDraw && now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      drawStageFrame(ctx, cacheRef, width, height, pxScale, sprites, now, true, highContrastMap);
    };

    if (animateCombat) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [motionMode, highContrastMap, paused, sprites]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

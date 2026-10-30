import { useEffect, useRef } from 'react';
import type { MotionMode } from '../../../application/session';
import { rand01, useLobbySprites, type SpriteMap } from './canvasAssets';

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
const STELE_FACE_Y = 0.41;

const WAYPOINTS: readonly [number, number][] = [
  [-0.06, 0.56],
  [0.2, 0.56],
  [0.32, 0.34],
  [0.54, 0.34],
  [0.66, 0.66],
  [0.86, 0.66],
];

const DEFEAT_PROGRESS: readonly [number, number, number, number, number] = [0.74, 0.68, 0.8, 0.71, 0.88];

const TOWER_DEFS: readonly { x: number; y: number; id: 'archer' | 'frost' | 'cannon'; fixed?: boolean }[] = [
  { x: 0.25, y: 0.72, id: 'archer' },
  { x: 0.46, y: 0.56, id: 'frost', fixed: true },
  { x: 0.69, y: 0.41, id: 'cannon' },
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

function samplePath(progress01: number, w: number, h: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, progress01));
  const segCount = WAYPOINTS.length - 1;
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < segCount; i++) {
    const [x0, y0] = WAYPOINTS[i]!;
    const [x1, y1] = WAYPOINTS[i + 1]!;
    const len = Math.hypot((x1 - x0) * w, (y1 - y0) * h);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen <= 0) {
    const [fx, fy] = WAYPOINTS[0]!;
    return { x: fx * w, y: fy * h };
  }
  const targetDist = clamped * totalLen;
  let acc = 0;
  for (let i = 0; i < segCount; i++) {
    const segLen = segLens[i]!;
    if (acc + segLen >= targetDist || i === segCount - 1) {
      const localT = segLen > 0 ? Math.max(0, Math.min(1, (targetDist - acc) / segLen)) : 0;
      const [x0, y0] = WAYPOINTS[i]!;
      const [x1, y1] = WAYPOINTS[i + 1]!;
      return { x: (x0 + (x1 - x0) * localT) * w, y: (y0 + (y1 - y0) * localT) * h };
    }
    acc += segLen;
  }
  const [lx, ly] = WAYPOINTS[segCount]!;
  return { x: lx * w, y: ly * h };
}

function unitStateAt(slot: number, timeMs: number, w: number, h: number, animateCombat: boolean) {
  const baseT = animateCombat ? timeMs / LOOP_MS : STATIC_CYCLE;
  const unitCycle = (((baseT - slot * 0.2) % 1) + 1) % 1;
  if (unitCycle >= ACTIVE_SPAN) return null;
  const kind: 'walker' | 'boss' = slot === 4 ? 'boss' : 'walker';
  const march01 = unitCycle / ACTIVE_SPAN;
  const defeatP = DEFEAT_PROGRESS[slot] ?? 0.74;
  const rawP = march01 * defeatP;
  const pos = samplePath(rawP, w, h);
  const hpRatio = march01 < 0.92 ? Math.max(0.05, 1 - (march01 / 0.92) * 0.95) : 0;
  const alpha = march01 < 0.92 ? 1 : Math.max(0, 1 - (march01 - 0.92) / 0.08);
  return { slot, kind, x: pos.x, y: pos.y, rawP, march01, hpRatio, alpha };
}

/** 5웨이브 수비전 미니 시연의 시간별 결정론 상태를 계산한다(단위 검증 겸용). */
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

    // 발사 시점에 살아 있고 탄착 때까지 전장에 남아 있을 가장 가까운 적 슬롯을 고정 추적한다.
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
      const px = sx0 + (txEnd - sx0) * flightT;
      const py = sy0 + (tyEnd - sy0) * flightT - arc;
      const impactT = shotPhase >= 0.82 ? Math.min(1, (shotPhase - 0.82) / 0.18) : null;
      if (impactT !== null && target.hpRatio > 0) {
        target.hit = true;
      }
      projectiles.push({
        towerId: td.id,
        x: px,
        y: py,
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

function drawStageFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: SpriteMap,
  timeMs: number,
  animateCombat: boolean,
  highContrastMap: boolean,
) {
  ctx.fillStyle = '#6f9c44';
  ctx.fillRect(0, 0, w, h);

  const grass = sprites.get('ground.grass')?.img;
  if (grass && grass.width > 0) {
    const tile = 112;
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) ctx.drawImage(grass, x, y, tile + 1, tile + 1);
    }
  }

  // S자 수비 도로(고대비 설정 켜짐 시 진한 윤곽선 + 밝은 안내선 추가)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const traceRoad = () => {
    ctx.beginPath();
    for (let i = 0; i < WAYPOINTS.length; i++) {
      const [nx, ny] = WAYPOINTS[i]!;
      if (i === 0) ctx.moveTo(nx * w, ny * h);
      else ctx.lineTo(nx * w, ny * h);
    }
  };

  if (highContrastMap) {
    traceRoad();
    ctx.strokeStyle = '#261c14';
    ctx.lineWidth = 38;
    ctx.stroke();
    traceRoad();
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = 33;
    ctx.stroke();
  } else {
    traceRoad();
    ctx.strokeStyle = '#7b5933';
    ctx.lineWidth = 32;
    ctx.stroke();
  }

  traceRoad();
  ctx.strokeStyle = '#d9b577';
  ctx.lineWidth = 26;
  ctx.stroke();

  // 배경 소품(나무·꽃·바위)
  const tree = sprites.get('deco.tree')?.img;
  const rock = sprites.get('deco.rock')?.img;
  const flowers = sprites.get('deco.flowers')?.img;
  if (flowers) {
    ctx.drawImage(flowers, w * 0.14, h * 0.72, 28, 28);
    ctx.drawImage(flowers, w * 0.74, h * 0.2, 26, 26);
  }
  if (rock) ctx.drawImage(rock, w * 0.44, h * 0.73, 34, 34);
  if (tree) {
    ctx.drawImage(tree, w * 0.03, h * 0.04, 58, 58);
    ctx.drawImage(tree, w * 0.89, h * 0.03, 56, 56);
  }

  // 상단 중앙 수호 비석 원화 + 첫 글자 각인(좌측 상단 배지와 겹치지 않는 열린 잔디 위치)
  const stele = sprites.get('deco.stele')?.img;
  const sx = w * 0.43;
  const sy = h * 0.27;
  if (stele) {
    const sw = 50;
    const sh = 50;
    ctx.drawImage(stele, sx - sw / 2, sy - sh * 0.85, sw, sh);
    const glyphY = sy - (0.85 - STELE_FACE_Y) * sh;
    ctx.fillStyle = '#463c35';
    ctx.font = '700 12px "Pretendard Variable", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('한', sx, glyphY);
  }

  // 우측 왕국 성문
  const gate = sprites.get('map.gate')?.img;
  const gx = w * 0.89;
  const gy = h * 0.67;
  if (gate) {
    ctx.drawImage(gate, gx - 42, gy - 66, 84, 84);
  } else {
    ctx.fillStyle = '#754b2d';
    ctx.fillRect(gx - 22, gy - 36, 44, 48);
  }

  const demo = sampleStageDemo(w, h, timeMs, animateCombat);

  // 타워 3기(궁수·서리·대포)
  const slotImg = sprites.get('slot.base')?.img;
  for (let ti = 0; ti < TOWER_DEFS.length; ti++) {
    const td = TOWER_DEFS[ti]!;
    const tx = td.x * w;
    const ty = td.y * h;
    if (highContrastMap) {
      ctx.strokeStyle = '#261c14';
      ctx.lineWidth = 3;
      ctx.strokeRect(tx - 21, ty - 14, 42, 28);
      ctx.strokeStyle = '#f5d98e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx - 19, ty - 12, 38, 24);
    }
    if (slotImg) ctx.drawImage(slotImg, tx - 22, ty - 18, 44, 44);

    const bodyImg = sprites.get(`tower.${td.id}`)?.img;
    const weaponImg = sprites.get(`tower.${td.id}.weapon`)?.img;
    if (bodyImg) {
      ctx.drawImage(bodyImg, tx - 27, ty - 42, 54, 54);
    } else {
      ctx.fillStyle = '#6c5a49';
      ctx.beginPath();
      ctx.arc(tx, ty - 6, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    const angle = demo.towerAngles[ti] ?? -0.6;
    const recoil = demo.towerRecoils[ti] ?? 0;
    if (weaponImg) {
      ctx.save();
      const hoverY = td.fixed && animateCombat ? Math.sin(timeMs * 0.004 + ti) * 2 : 0;
      const rx = td.fixed ? 0 : -Math.cos(angle) * recoil;
      const ry = td.fixed ? 0 : -Math.sin(angle) * recoil;
      ctx.translate(tx + rx, ty - 18 + hoverY + ry);
      if (!td.fixed) ctx.rotate(angle);
      ctx.drawImage(weaponImg, -18, -18, 36, 36);
      ctx.restore();
    }
  }

  // 적 스프라이트 및 체력 막대
  for (const e of demo.enemies) {
    const hitSprite = e.hit ? sprites.get(`enemy.${e.kind}.hit`)?.img : null;
    const walkSprite =
      hitSprite ??
      sprites.get(`enemy.${e.kind}.${e.frameIdx}`)?.img ??
      sprites.get(`enemy.${e.kind}.0`)?.img;
    const size = e.kind === 'boss' ? 50 : 36;
    ctx.save();
    ctx.globalAlpha = e.alpha;
    if (walkSprite) {
      ctx.drawImage(walkSprite, e.x - size / 2, e.y - size * 0.78 - e.bob, size, size);
    } else {
      ctx.fillStyle = e.kind === 'boss' ? '#7a2520' : '#4a6b3b';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 8 - e.bob, e.kind === 'boss' ? 13 : 9, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.hpRatio > 0) {
      const barW = e.kind === 'boss' ? 34 : 24;
      const bx = e.x - barW / 2;
      const by = e.y - size * 0.76 - 6;
      ctx.fillStyle = '#261c14';
      ctx.fillRect(bx - 1, by - 1, barW + 2, 5);
      ctx.fillStyle = '#d94f3d';
      ctx.fillRect(bx, by, Math.max(2, barW * e.hpRatio), 3);
    }
    ctx.restore();
  }

  // 투사체 연출(화살·서리탄·포탄) 및 탄착 파문
  for (const p of demo.projectiles) {
    if (p.flying) {
      ctx.fillStyle = p.towerId === 'frost' ? '#8de4ff' : p.towerId === 'cannon' ? '#2c2520' : '#fff0a6';
      ctx.strokeStyle = '#261c14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.towerId === 'cannon' ? 4.4 : 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
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
}

export function MiniStageCanvas({ motionMode, highContrastMap, paused, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprites = useLobbySprites();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 320;
    let height = 160;
    let raf = 0;
    let lastDraw = -Infinity;
    const animateCombat = motionMode === 'full' && !paused;

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(180, Math.round(rect.width || 480));
      height = Math.max(110, Math.round(rect.height || 176));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStageFrame(ctx, width, height, sprites, performance.now(), animateCombat, highContrastMap);
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
      drawStageFrame(ctx, width, height, sprites, now, true, highContrastMap);
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

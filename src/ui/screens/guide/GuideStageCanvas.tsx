import { useEffect, useRef } from 'react';
import type { MotionMode } from '../../../application/session';
import type { TowerId } from '../../../contracts/balance';
import { useLobbySprites, type SpriteMap } from '../home/canvasAssets';
import {
  GUIDE_ROAD_WAYPOINTS,
  sampleGuideWaveLoop,
  samplePolyline,
  type GuideWaveBeatId,
} from './guideModel';

type Props =
  | {
      mode: 'wave_loop';
      motionMode: MotionMode;
      highContrastMap: boolean;
      pinnedBeat: GuideWaveBeatId | null;
      className?: string | undefined;
    }
  | {
      mode: 'range_demo';
      motionMode: MotionMode;
      highContrastMap: boolean;
      towerId: TowerId;
      rangeMilli: number;
      className?: string | undefined;
    };

const FRAME_MS = 1000 / 30;

const RANGE_DEMO_WAYPOINTS: readonly [number, number][] = [
  [0.12, 0.24],
  [0.74, 0.24],
  [0.74, 0.76],
  [0.14, 0.76],
];

function drawRoad(
  ctx: CanvasRenderingContext2D,
  waypoints: readonly [number, number][],
  w: number,
  h: number,
  highContrastMap: boolean,
  roadWidth = 22,
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => {
    ctx.beginPath();
    for (let i = 0; i < waypoints.length; i++) {
      const [nx, ny] = waypoints[i]!;
      if (i === 0) ctx.moveTo(nx * w, ny * h);
      else ctx.lineTo(nx * w, ny * h);
    }
  };

  if (highContrastMap) {
    trace();
    ctx.strokeStyle = '#261c14';
    ctx.lineWidth = roadWidth + 10;
    ctx.stroke();
    trace();
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = roadWidth + 5;
    ctx.stroke();
  } else {
    trace();
    ctx.strokeStyle = '#7b5933';
    ctx.lineWidth = roadWidth + 5;
    ctx.stroke();
  }

  trace();
  ctx.strokeStyle = '#d9b577';
  ctx.lineWidth = roadWidth;
  ctx.stroke();
}

function drawBrightPathInRange(
  ctx: CanvasRenderingContext2D,
  waypoints: readonly [number, number][],
  w: number,
  h: number,
  cx: number,
  cy: number,
  radiusPx: number,
): number {
  let litCount = 0;
  const samples = 18;
  for (let i = 0; i <= samples; i++) {
    const pt = samplePolyline(waypoints, i / samples, w, h);
    if (Math.hypot(pt.x - cx, pt.y - cy) <= radiusPx) {
      litCount++;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 246, 216, 0.48)';
      ctx.strokeStyle = 'rgba(255, 246, 216, 0.88)';
      ctx.lineWidth = 1.3;
      ctx.fillRect(pt.x - 8, pt.y - 8, 16, 16);
      ctx.strokeRect(pt.x - 8, pt.y - 8, 16, 16);
      ctx.restore();
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245, 235, 212, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 246, 216, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  return litCount;
}

function drawGrassBackground(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: SpriteMap) {
  ctx.fillStyle = '#6f9c44';
  ctx.fillRect(0, 0, w, h);
  const grass = sprites.get('ground.grass')?.img;
  if (grass && grass.width > 0) {
    const tile = 96;
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        ctx.drawImage(grass, x, y, tile + 1, tile + 1);
      }
    }
  }
}

function drawPedestalAndTower(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteMap,
  tx: number,
  ty: number,
  towerId: TowerId | null,
  angle: number,
  recoil: number,
  highContrastMap: boolean,
) {
  if (highContrastMap) {
    ctx.strokeStyle = '#261c14';
    ctx.lineWidth = 3;
    ctx.strokeRect(tx - 18, ty - 12, 36, 24);
    ctx.strokeStyle = '#f5d98e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx - 16, ty - 10, 32, 20);
  }
  const slotImg = sprites.get('slot.base')?.img;
  if (slotImg) {
    ctx.drawImage(slotImg, tx - 18, ty - 15, 36, 36);
  } else {
    ctx.fillStyle = '#b3ada3';
    ctx.strokeStyle = '#362419';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(tx, ty + 2, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (!towerId) return;

  const bodyImg = sprites.get(`tower.${towerId}`)?.img;
  const weaponImg = sprites.get(`tower.${towerId}.weapon`)?.img;
  if (bodyImg) {
    ctx.drawImage(bodyImg, tx - 22, ty - 34, 44, 44);
  } else {
    ctx.fillStyle = '#6b4225';
    ctx.beginPath();
    ctx.arc(tx, ty - 6, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  if (weaponImg) {
    const fixedUp = towerId === 'frost' || towerId === 'lightning';
    ctx.save();
    const rx = fixedUp ? 0 : -Math.cos(angle) * recoil;
    const ry = fixedUp ? 0 : -Math.sin(angle) * recoil;
    ctx.translate(tx + rx, ty - 14 + ry);
    if (!fixedUp) ctx.rotate(angle);
    ctx.drawImage(weaponImg, -14, -14, 28, 28);
    ctx.restore();
  }
}

function drawWaveLoopFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: SpriteMap,
  timeMs: number,
  animate: boolean,
  pinnedBeat: GuideWaveBeatId | null,
  highContrastMap: boolean,
) {
  drawGrassBackground(ctx, w, h, sprites);
  drawRoad(ctx, GUIDE_ROAD_WAYPOINTS, w, h, highContrastMap, 22);

  const snap = sampleGuideWaveLoop(w, h, timeMs, animate, pinnedBeat);
  const archerX = w * 0.31;
  const archerY = h * 0.67;
  const frostX = w * 0.56;
  const frostY = h * 0.58;

  if (snap.showRangeOverlay) {
    drawBrightPathInRange(
      ctx,
      GUIDE_ROAD_WAYPOINTS,
      w,
      h,
      archerX,
      archerY,
      Math.min(w * 0.25, h * 0.56),
    );
  }

  // 우측 왕국 성문 및 4단계 회복 반짝임
  const gate = sprites.get('map.gate')?.img;
  const gx = w * 0.89;
  const gy = h * 0.63;
  if (gate) {
    ctx.drawImage(gate, gx - 32, gy - 50, 64, 64);
  } else {
    ctx.fillStyle = '#754b2d';
    ctx.fillRect(gx - 16, gy - 28, 32, 36);
  }

  if (snap.gateSparkle01 > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.35 + snap.gateSparkle01 * 0.5;
    ctx.strokeStyle = '#b9ff99';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(gx, gy - 14, 20 + snap.gateSparkle01 * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawPedestalAndTower(
    ctx,
    sprites,
    archerX,
    archerY,
    snap.towersBuilt ? 'archer' : null,
    snap.archerAngle,
    snap.archerRecoil,
    highContrastMap,
  );
  drawPedestalAndTower(
    ctx,
    sprites,
    frostX,
    frostY,
    snap.towersBuilt ? 'frost' : null,
    -0.5,
    0,
    highContrastMap,
  );

  for (const e of snap.enemies) {
    const hitSprite = e.hit ? sprites.get(`enemy.${e.kind}.hit`)?.img : null;
    const walkSprite =
      hitSprite ??
      sprites.get(`enemy.${e.kind}.${e.frameIdx}`)?.img ??
      sprites.get(`enemy.${e.kind}.0`)?.img;
    const size = e.kind === 'boss' ? 40 : 28;
    if (walkSprite) {
      ctx.drawImage(walkSprite, e.x - size / 2, e.y - size * 0.78, size, size);
    } else {
      ctx.fillStyle = e.kind === 'boss' ? '#7a2520' : '#a3352b';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 6, e.kind === 'boss' ? 10 : 7, 0, Math.PI * 2);
      ctx.fill();
    }
    const barW = e.kind === 'boss' ? 28 : 20;
    const bx = e.x - barW / 2;
    const by = e.y - size * 0.78 - 5;
    ctx.fillStyle = '#261c14';
    ctx.fillRect(bx - 1, by - 1, barW + 2, 4);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(bx, by, Math.max(2, barW * e.hpRatio), 2.5);
  }

  for (const p of snap.projectiles) {
    ctx.fillStyle = p.towerId === 'frost' ? '#8de4ff' : '#fff0a6';
    ctx.strokeStyle = '#261c14';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawRangeDemoFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: SpriteMap,
  towerId: TowerId,
  rangeMilli: number,
  timeMs: number,
  animate: boolean,
  highContrastMap: boolean,
) {
  drawGrassBackground(ctx, w, h, sprites);
  drawRoad(ctx, RANGE_DEMO_WAYPOINTS, w, h, highContrastMap, 20);

  const cx = w * 0.44;
  const cy = h * 0.5;
  const baseScale = Math.min(w * 0.145, h * 0.215);
  const pulse = animate ? 1 + 0.025 * Math.sin(timeMs * 0.004) : 1;
  const radiusPx = (rangeMilli / 1000) * baseScale * pulse;

  drawBrightPathInRange(ctx, RANGE_DEMO_WAYPOINTS, w, h, cx, cy, radiusPx);
  const aimAngle = animate ? -0.4 + Math.sin(timeMs * 0.0025) * 0.45 : -0.35;
  drawPedestalAndTower(ctx, sprites, cx, cy + 4, towerId, aimAngle, 0, highContrastMap);
}

export function GuideStageCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprites = useLobbySprites();
  const { mode, motionMode, highContrastMap, className } = props;
  const pinnedBeat = mode === 'wave_loop' ? props.pinnedBeat : null;
  const towerId = mode === 'range_demo' ? props.towerId : 'archer';
  const rangeMilli = mode === 'range_demo' ? props.rangeMilli : 2500;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 320;
    let height = 100;
    let raf = 0;
    let lastDraw = -Infinity;
    const animate = motionMode === 'full';

    const renderAt = (now: number) => {
      if (mode === 'wave_loop') {
        drawWaveLoopFrame(ctx, width, height, sprites, now, animate, pinnedBeat, highContrastMap);
      } else {
        drawRangeDemoFrame(ctx, width, height, sprites, towerId, rangeMilli, now, animate, highContrastMap);
      }
    };

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(160, Math.round(rect.width || 320));
      height = Math.max(72, Math.round(rect.height || 100));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderAt(performance.now());
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
      if (!animate) return;
      raf = requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;
      if (now >= lastDraw && now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      renderAt(now);
    };

    if (animate) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode, motionMode, highContrastMap, pinnedBeat, towerId, rangeMilli, sprites]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

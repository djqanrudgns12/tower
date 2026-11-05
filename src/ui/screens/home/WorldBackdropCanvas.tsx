import { useEffect, useRef } from 'react';
import type { MotionMode } from '../../../application/session';
import { useLobbySprites, type SpriteMap } from './canvasAssets';
import {
  bakeThreeToneGrass,
  drawNaturalBrook,
  drawNaturalRoad,
  drawSpriteGrounded,
  type SplineSample,
  type TonePool,
} from './terrainBaker';

interface Props {
  motionMode: MotionMode;
  className?: string | undefined;
}

interface WorldTerrainCache {
  key: string;
  canvas: HTMLCanvasElement;
  leftSpine: SplineSample[] | null;
  sideMargin: number;
}

const FRAME_MS = 1000 / 30;
const STATIC_TIME_MS = 2100;

function ensureWorldBaked(
  cacheRef: { current: WorldTerrainCache | null },
  w: number,
  h: number,
  dpr: number,
  sprites: SpriteMap,
): WorldTerrainCache {
  const cacheKey = `${w}x${h}@${dpr}@sp${sprites.size}`;
  if (cacheRef.current && cacheRef.current.key === cacheKey) {
    return cacheRef.current;
  }

  if (cacheRef.current) {
    cacheRef.current.canvas.width = 0;
    cacheRef.current.canvas.height = 0;
  }

  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext('2d');
  if (!ctx) {
    const empty: WorldTerrainCache = { key: cacheKey, canvas: off, leftSpine: null, sideMargin: 0 };
    cacheRef.current = empty;
    return empty;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const boardW = Math.min(1128, w - 40);
  const sideMargin = Math.max(80, (w - boardW) * 0.5);
  const lx = sideMargin * 0.48;
  const rx = w - sideMargin * 0.48;

  const shadePools: TonePool[] = [
    { x: 40, y: 40, rx: 160, ry: 120, str: 0.42 },
    { x: w - 40, y: 40, rx: 160, ry: 120, str: 0.42 },
    { x: lx, y: h * 0.22, rx: 110, ry: 90, str: 0.3 },
    { x: lx, y: h * 0.82, rx: 120, ry: 95, str: 0.34 },
    { x: rx, y: h * 0.28, rx: 125, ry: 95, str: 0.32 },
    { x: rx, y: h * 0.8, rx: 130, ry: 100, str: 0.34 },
  ];
  const lightPools: TonePool[] = [
    { x: sideMargin * 0.72, y: h * 0.46, rx: 160, ry: 150, str: 0.36 },
    { x: w - sideMargin * 0.72, y: h * 0.44, rx: 160, ry: 150, str: 0.34 },
    { x: w * 0.5, y: h * 0.5, rx: 420, ry: 300, str: 0.16 },
  ];

  // 1) 3톤 벨벳 잔디 언덕 + 숲 발밑 그늘 베이킹
  bakeThreeToneGrass(ctx, w, h, sprites, shadePools, lightPools, 17);

  // 2) 들꽃 군락 패치
  const m0 = sprites.get('ground.meadow.0')?.img;
  const m1 = sprites.get('ground.meadow.1')?.img;
  const m2 = sprites.get('ground.meadow.2')?.img;
  ctx.save();
  ctx.globalAlpha = 0.82;
  if (m0) {
    ctx.drawImage(m0, lx - 56, h * 0.4, 128, 92);
    ctx.drawImage(m0, rx - 68, h * 0.54, 128, 92);
  }
  if (m1) {
    ctx.drawImage(m1, lx - 48, h * 0.66, 124, 88);
    ctx.drawImage(m1, rx - 62, h * 0.14, 124, 88);
  }
  if (m2) {
    ctx.drawImage(m2, sideMargin * 0.55, h * 0.86, 118, 84);
    ctx.drawImage(m2, w - sideMargin * 0.55 - 110, h * 0.86, 118, 84);
  }
  ctx.restore();

  let leftSpine: SplineSample[] | null = null;
  if (w >= 1040) {
    const sc = Math.min(1.2, Math.max(0.76, sideMargin / 160));
    const wideMeadow = sideMargin >= 240;

    // 좌측 시냇물 계곡 물길
    leftSpine = drawNaturalBrook(
      ctx,
      [
        [lx - 24 * sc, -28],
        [lx + 14 * sc, h * 0.24],
        [lx + 4 * sc, h * 0.43],
        [lx - 14 * sc, h * 0.63],
        [lx + 16 * sc, h * 0.84],
        [lx - 6 * sc, h + 32],
      ],
      16 * sc,
      53,
    );

    // 우측 기와 정자 앞마당에서 산책 오솔길로 이어지는 아담한 정원 마당길 지선
    drawNaturalRoad(
      ctx,
      sprites,
      [
        [rx - 4 * sc, h * 0.35],
        [rx - 10 * sc, h * 0.43],
        [rx - 16 * sc, h * 0.51],
      ],
      10.5 * sc,
      137,
      false,
    );

    // 우측 정자 동산을 지나 중앙 보드 뒤로 이어지는 5겹 오솔길 본선
    const roadSpine = drawNaturalRoad(
      ctx,
      sprites,
      [
        [w + 32, h * 0.7],
        [rx + 20 * sc, h * 0.6],
        [rx - 18 * sc, h * 0.51],
        [w - sideMargin - 56, h * 0.49],
      ],
      15.5 * sc,
      89,
      false,
    );

    // 오솔길 자갈·풀술 디테일
    const peb0 = sprites.get('path.pebbles.0')?.img;
    const peb1 = sprites.get('path.pebbles.1')?.img;
    const tuft0 = sprites.get('path.tuft.0')?.img;
    if (peb0 && roadSpine[22]) {
      ctx.drawImage(peb0, roadSpine[22].x - 9, roadSpine[22].y - 5, 18 * sc, 14 * sc);
    }
    if (peb1 && roadSpine[52]) {
      ctx.drawImage(peb1, roadSpine[52].x - 8, roadSpine[52].y + 4, 17 * sc, 13 * sc);
    }
    if (tuft0 && roadSpine[38]) {
      ctx.drawImage(tuft0, roadSpine[38].x - 10, roadSpine[38].y - 16 * sc, 18 * sc, 14 * sc);
    }

    // 좌측 시냇물 위 징검다리
    const stepstones = sprites.get('map.river_z.prop.stepstones')?.img;
    if (stepstones) {
      ctx.drawImage(stepstones, lx - 34 * sc, h * 0.58 - 18 * sc, 64 * sc, 38 * sc);
    }

    // Y-정렬 풍경 오브젝트 목록 (좌상단 광원 보호: 원화 반전 없음)
    const props: { key: string; x: number; y: number; w: number; h: number; sh: number }[] = [
      { key: 'edge.forest.0', x: 58 * sc, y: 78 * sc, w: 184 * sc, h: 126 * sc, sh: 0 },
      { key: 'edge.forest.1', x: w - 58 * sc, y: 80 * sc, w: 188 * sc, h: 128 * sc, sh: 0 },

      // 좌측 수변 계곡 테마: 봄꽃나무 + 강변 물레방아 오두막 + 꽃밭 + 나무 울타리 + 갈대 + 수양버들
      { key: 'map.courtyard.tree.0', x: lx - 24 * sc, y: h * 0.23, w: 92 * sc, h: 92 * sc, sh: 0.24 },
      { key: 'prop.flowerbed', x: lx + 36 * sc, y: h * 0.25, w: 54 * sc, h: 40 * sc, sh: 0.14 },
      { key: 'map.river_z.landmark.watermill', x: lx - 14 * sc, y: h * 0.41, w: 124 * sc, h: 124 * sc, sh: 0.18 },
      { key: 'prop.fence.h', x: lx + 36 * sc, y: h * 0.53, w: 58 * sc, h: 32 * sc, sh: 0.16 },
      { key: 'map.river_z.prop.reeds', x: lx + 26 * sc, y: h * 0.63, w: 54 * sc, h: 50 * sc, sh: 0.12 },
      { key: 'prop.flowerbed', x: lx - 30 * sc, y: h * 0.69, w: 56 * sc, h: 42 * sc, sh: 0.14 },
      { key: 'map.river_z.tree.0', x: lx - 18 * sc, y: h * 0.83, w: 98 * sc, h: 98 * sc, sh: 0.24 },
      { key: 'prop.mushrooms', x: lx + 34 * sc, y: h * 0.85, w: 34 * sc, h: 30 * sc, sh: 0.14 },
      { key: 'edge.rocks.0', x: 48 * sc, y: h + 8, w: 128 * sc, h: 92 * sc, sh: 0 },

      // 우측 정원 오솔길 테마: 분재 소나무 + 기와 정자 + 꽃화분 + 꽃밭 + 울타리 + 참나무
      { key: 'map.courtyard.tree.1', x: rx + 30 * sc, y: h * 0.24, w: 88 * sc, h: 88 * sc, sh: 0.22 },
      { key: 'map.courtyard.landmark.pavilion', x: rx - 4 * sc, y: h * 0.36, w: 122 * sc, h: 122 * sc, sh: 0.2 },
      { key: 'map.courtyard.prop.flowerpot', x: rx - 46 * sc, y: h * 0.4, w: 36 * sc, h: 36 * sc, sh: 0.16 },
      { key: 'prop.flowerbed', x: rx + 34 * sc, y: h * 0.44, w: 54 * sc, h: 40 * sc, sh: 0.14 },
      { key: 'prop.fence.h', x: rx - 28 * sc, y: h * 0.67, w: 58 * sc, h: 32 * sc, sh: 0.16 },
      { key: 'prop.stump', x: rx + 26 * sc, y: h * 0.72, w: 36 * sc, h: 32 * sc, sh: 0.18 },
      { key: 'prop.flowerbed', x: rx - 26 * sc, y: h * 0.78, w: 56 * sc, h: 42 * sc, sh: 0.14 },
      { key: 'deco.tree', x: rx + 20 * sc, y: h * 0.87, w: 98 * sc, h: 98 * sc, sh: 0.24 },
      { key: 'prop.mushrooms', x: rx - 22 * sc, y: h * 0.89, w: 32 * sc, h: 28 * sc, sh: 0.14 },
      { key: 'edge.rocks.1', x: w - 48 * sc, y: h + 8, w: 126 * sc, h: 90 * sc, sh: 0 },
      ...(wideMeadow
        ? [
            { key: 'deco.tree', x: 64, y: h * 0.56, w: 94 * sc, h: 94 * sc, sh: 0.24 },
            { key: 'prop.flowerbed', x: sideMargin * 0.78, y: h * 0.36, w: 56 * sc, h: 40 * sc, sh: 0.14 },
            { key: 'deco.rock', x: sideMargin * 0.76, y: h * 0.75, w: 34 * sc, h: 26 * sc, sh: 0.16 },
            { key: 'map.courtyard.tree.0', x: w - 66, y: h * 0.48, w: 92 * sc, h: 92 * sc, sh: 0.24 },
            { key: 'prop.flowerbed', x: w - sideMargin * 0.78, y: h * 0.29, w: 56 * sc, h: 40 * sc, sh: 0.14 },
            { key: 'deco.rock', x: w - sideMargin * 0.76, y: h * 0.8, w: 34 * sc, h: 26 * sc, sh: 0.16 },
          ]
        : []),
    ];

    props.sort((a, b) => a.y - b.y);
    for (const p of props) {
      const ok = drawSpriteGrounded(ctx, sprites, p.key, p.x, p.y, p.w, p.h, p.sh);
      if (!ok && p.key.includes('tree')) {
        ctx.save();
        ctx.fillStyle = '#3c6b29';
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.h * 0.42, p.w * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 화사함을 살리는 얇은 단색 온도 베일 (그라데이션 없음)
  ctx.fillStyle = 'rgba(36, 24, 12, 0.05)';
  ctx.fillRect(0, 0, w, h);

  const built: WorldTerrainCache = { key: cacheKey, canvas: off, leftSpine, sideMargin };
  cacheRef.current = built;
  return built;
}

function drawBackdropFrame(
  ctx: CanvasRenderingContext2D,
  cacheRef: { current: WorldTerrainCache | null },
  w: number,
  h: number,
  dpr: number,
  sprites: SpriteMap,
  timeMs: number,
  animate: boolean,
): void {
  const baked = ensureWorldBaked(cacheRef, w, h, dpr, sprites);
  if (baked.canvas.width > 0 && baked.canvas.height > 0) {
    ctx.drawImage(baked.canvas, 0, 0, w, h);
  }

  if (w >= 1040 && baked.leftSpine && baked.leftSpine.length > 12) {
    // 1) 시냇물 잔물결 윤슬 하이라이트
    ctx.save();
    ctx.strokeStyle = 'rgba(225, 248, 255, 0.52)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    const sp = baked.leftSpine;
    const tClock = animate ? timeMs : STATIC_TIME_MS;
    for (let k = 0; k < 5; k++) {
      const baseIdx = Math.floor((((tClock * 0.00009 + k * 0.2) % 1) * (sp.length - 10))) + 3;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const pt = sp[Math.min(sp.length - 1, baseIdx + j)]!;
        const off = Math.sin(k * 2.1 + j * 0.6) * 3.5;
        if (j === 0) ctx.moveTo(pt.x + pt.nx * off, pt.y + pt.ny * off);
        else ctx.lineTo(pt.x + pt.nx * off, pt.y + pt.ny * off);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 2) 하늘 위 구름 그림자 드리프트 (전체 연출에서만 이동)
    if (animate) {
      const cloud = sprites.get('fx.cloudshadow.0')?.img;
      if (cloud) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.13;
        const cx1 = ((timeMs * 0.008) % (w + 420)) - 210;
        const cy1 = h * 0.18 + Math.sin(timeMs * 0.0003) * 20;
        ctx.drawImage(cloud, cx1, cy1, 340, 210);
        ctx.restore();
      }
    }

    // 3) 꽃나무·정자 주변 나비 2마리
    const lx = baked.sideMargin * 0.48;
    const rx = w - baked.sideMargin * 0.48;
    const bfYKey = animate && Math.floor(timeMs / 240) % 2 === 1 ? 'fx.butterfly.yellow.1' : 'fx.butterfly.yellow.0';
    const bfWKey = animate && Math.floor(timeMs / 260) % 2 === 1 ? 'fx.butterfly.white.1' : 'fx.butterfly.white.0';
    const bfY = sprites.get(bfYKey)?.img;
    const bfW = sprites.get(bfWKey)?.img;
    if (bfY) {
      ctx.drawImage(
        bfY,
        lx + 12 + Math.sin(tClock * 0.0013) * 14,
        h * 0.2 + Math.cos(tClock * 0.0018) * 9,
        19,
        19,
      );
    }
    if (bfW) {
      ctx.drawImage(
        bfW,
        rx - 28 + Math.cos(tClock * 0.0012) * 14,
        h * 0.36 + Math.sin(tClock * 0.0016) * 8,
        18,
        18,
      );
    }
  }
}

export function WorldBackdropCanvas({ motionMode, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<WorldTerrainCache | null>(null);
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

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let lastDraw = -Infinity;
    const animate = motionMode === 'full';

    const syncSize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdropFrame(ctx, cacheRef, width, height, dpr, sprites, animate ? performance.now() : STATIC_TIME_MS, animate);
    };

    syncSize();
    window.addEventListener('resize', syncSize);

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
      drawBackdropFrame(ctx, cacheRef, width, height, dpr, sprites, now, true);
    };

    if (animate) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', syncSize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [motionMode, sprites]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

import { useEffect, useRef } from 'react';
import type { MotionMode } from '../../../application/session';
import { rand01, useLobbySprites, type SpriteMap } from './canvasAssets';

interface Props {
  motionMode: MotionMode;
  className?: string | undefined;
}

const FRAME_MS = 1000 / 30;

function drawBackdropFrame(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: SpriteMap, timeMs: number, animate: boolean) {
  ctx.fillStyle = '#678d3e';
  ctx.fillRect(0, 0, w, h);

  const grass = sprites.get('ground.grass')?.img;
  if (grass && grass.width > 0) {
    const tile = 160;
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        ctx.drawImage(grass, x, y, tile + 1, tile + 1);
      }
    }
  } else {
    ctx.fillStyle = '#5e8438';
    for (let i = 0; i < 18; i++) {
      const px = rand01(i, 3) * w;
      const py = rand01(i, 7) * h;
      ctx.beginPath();
      ctx.ellipse(px, py, 90, 42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const patch0 = sprites.get('ground.patch.0')?.img;
  const patch1 = sprites.get('ground.patch.1')?.img;
  for (let i = 0; i < 8; i++) {
    const img = i % 2 === 0 ? patch0 : patch1;
    if (!img) continue;
    const sideX = i % 2 === 0 ? rand01(i, 11) * 0.16 : 0.84 + rand01(i, 11) * 0.14;
    const py = 0.08 + rand01(i, 13) * 0.84;
    ctx.globalAlpha = 0.72;
    ctx.drawImage(img, sideX * w - 48, py * h - 48, 96, 96);
  }
  ctx.globalAlpha = 1;

  const flowers = sprites.get('deco.flowers')?.img;
  const rock = sprites.get('deco.rock')?.img;
  const bush = sprites.get('deco.bush.0')?.img;
  for (let i = 0; i < 10; i++) {
    const lx = i < 5 ? 0.02 + rand01(i, 21) * 0.11 : 0.87 + rand01(i, 21) * 0.11;
    const ly = 0.12 + rand01(i, 29) * 0.78;
    const pick = i % 3 === 0 ? rock : i % 3 === 1 ? flowers : bush;
    if (pick) ctx.drawImage(pick, lx * w - 26, ly * h - 26, 52, 52);
  }

  const tree = sprites.get('deco.tree')?.img;
  const treeSpots: readonly [number, number, number][] = [
    [0.04, 0.18, 1.05],
    [0.08, 0.46, 0.92],
    [0.03, 0.76, 1.12],
    [0.11, 0.9, 0.88],
    [0.96, 0.16, 1.08],
    [0.92, 0.44, 0.94],
    [0.97, 0.74, 1.14],
    [0.89, 0.91, 0.9],
  ];
  for (let i = 0; i < treeSpots.length; i++) {
    const [nx, ny, sc] = treeSpots[i]!;
    const tx = nx * w;
    const ty = ny * h;
    const sway = animate ? Math.sin(timeMs * 0.0014 + rand01(i, 41) * Math.PI * 2) * 0.028 : 0;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(sway);
    if (tree) {
      const sz = 108 * sc;
      ctx.drawImage(tree, -sz * 0.5, -sz * 0.85, sz, sz);
    } else {
      ctx.fillStyle = '#3c6b29';
      ctx.beginPath();
      ctx.arc(0, -34 * sc, 30 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 바람에 흩날리는 나뭇잎 입자(단색 타원, 그라디언트 없음)
  if (animate) {
    for (let i = 0; i < 14; i++) {
      const speed = 0.016 + rand01(i, 53) * 0.014;
      const prog = ((timeMs * speed * 0.001) + rand01(i, 59)) % 1;
      const lx = ((rand01(i, 61) + prog * 0.35) % 1) * w;
      const ly = prog * h;
      const rot = timeMs * 0.002 + i;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.fillStyle = i % 3 === 0 ? '#d8a24a' : '#8ab648';
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 작전 보드 테두리 대비를 살리는 얇은 단색 베일(PRD §12.8: 그라디언트 0)
  ctx.fillStyle = 'rgba(36, 24, 14, 0.14)';
  ctx.fillRect(0, 0, w, h);
}

export function WorldBackdropCanvas({ motionMode, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprites = useLobbySprites();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let raf = 0;
    let lastDraw = -Infinity;
    const animate = motionMode !== 'minimal';

    const syncSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdropFrame(ctx, width, height, sprites, performance.now(), animate);
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
      drawBackdropFrame(ctx, width, height, sprites, now, true);
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

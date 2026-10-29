import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { EnemyKind } from '../../src/contracts/balance';
import { BALANCE, MAPS } from '../../src/content';
import { GAITS } from '../../src/game/animation/gait';
import { acceptsHit, enemyPose, HIT_MS, type PoseInput } from '../../src/game/animation/pose';
import { ASSETS, CELL_PX, ENEMY_DISPLAY } from '../../src/game/assets';

// 납품 PNG(8bit RGBA, 비인터레이스)의 알파만 읽는다.
function alphaOf(file: string) {
  const buf = readFileSync(new URL(`../../public/assets/${file}`, import.meta.url));
  let pos = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); expect([data[8], data[9], data[12]]).toEqual([8, 6, 0]); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const stride = w * 4, raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4]! : 0, b = y > 0 ? px[(y - 1) * stride + x]! : 0, c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4]! : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]!;
      px[y * stride + x] = (raw[y * (stride + 1) + 1 + x]! + pred) & 255;
    }
  }
  return { w, h, solid: (x: number, y: number) => px[(y * w + x) * 4 + 3]! >= 128 };
}

/** 가장 아래 불투명 행과, 바닥 4행에서 아래 2행까지 닿은 신발 덩어리의 x 중심. */
function feet(file: string) {
  const { w, h, solid } = alphaOf(file);
  let bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) bottom = y;
  const blobs: { x0: number; x1: number; low: number }[] = [];
  for (let x = 0; x < w; x++) {
    let low = -1;
    for (let y = bottom - 3; y <= bottom; y++) if (solid(x, y)) low = y;
    if (low < 0) continue;
    const last = blobs.at(-1);
    if (last && last.x1 === x - 1) { last.x1 = x; last.low = Math.max(last.low, low); } else blobs.push({ x0: x, x1: x, low });
  }
  return { bottom, grounded: blobs.filter(b => b.low >= bottom - 1).map(b => (b.x0 + b.x1) / 2) };
}

const manifest = JSON.parse(readFileSync(new URL('../../public/assets/manifest.json', import.meta.url), 'utf8')) as {
  assets: { id: string; file: string; height: number; originY: number; status: string }[];
};
const walkerFrames = manifest.assets.filter(a => /^enemy\.walker\.\d+$/.test(a.id) && a.status === 'integrated_pass');
const walkerHit = manifest.assets.find(a => a.id === 'enemy.walker.hit')!;
const gait = GAITS.walker!;
const scale = (ENEMY_DISPLAY.walker * CELL_PX) / gait.width;
const walk = (over: Partial<PoseInput>) => enemyPose({ kind: 'walker', phase: 0, time: 0, speedBP: 10000, moving: true, frames: 4, reducedMotion: false, ...over });

/** 프레임이 바뀔 때마다, 앞 프레임 시작에 디딘 발과 다음 프레임 시작의 그 발 사이 월드 거리. 0이면 미끄러지지 않는다. */
function footSlips(samples: { at: number; pose: number }[]) {
  const starts = samples.filter((s, i) => i === 0 || s.pose !== samples[i - 1]!.pose);
  const slips: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const a = starts[i - 1]!, b = starts[i]!;
    expect(b.pose).toBe((a.pose + 1) % gait.grounded.length);
    const planted = a.at + (Math.max(...gait.grounded[a.pose]!) - gait.width / 2) * scale;
    const carried = b.at + (Math.min(...gait.grounded[b.pose]!) - gait.width / 2) * scale;
    slips.push(Math.abs(carried - planted));
  }
  return slips;
}

describe('고블린 원화(enemy.walker.*)', () => {
  it('걷기 4프레임과 피격 프레임의 바닥선이 같고 manifest 기준점(64,96)에 놓인다', () => {
    expect(walkerFrames.map(a => a.id)).toEqual(['enemy.walker.0', 'enemy.walker.1', 'enemy.walker.2', 'enemy.walker.3']);
    for (const a of [...walkerFrames, walkerHit]) {
      expect(feet(a.file).bottom + 1, a.id).toBe(a.originY * a.height);
    }
  });

  it('보행표의 디딤발 위치가 납품 원화와 1.5px 안에서 맞는다', () => {
    expect(gait.grounded.length).toBe(walkerFrames.length);
    walkerFrames.forEach((a, k) => {
      const measured = feet(a.file).grounded;
      expect(measured.length, a.id).toBe(gait.grounded[k]!.length);
      measured.forEach((x, i) => expect(Math.abs(x - gait.grounded[k]![i]!), a.id).toBeLessThanOrEqual(1.5));
    });
  });
});

describe('고블린 보행', () => {
  it('렌더러가 이동 거리를 주면 프레임이 0→1→2→3 차례로 돌고 디딘 발이 미끄러지지 않는다', () => {
    const samples = Array.from({ length: 4000 }, (_, i) => ({ at: i * 0.05, pose: walk({ distance: i * 0.05 }).frame }));
    const slips = footSlips(samples);
    expect(slips.length).toBeGreaterThanOrEqual(8);
    for (const s of slips) expect(s).toBeLessThanOrEqual(0.1);
    expect(walk({ distance: 0, phase: 0.5 }).frame).not.toBe(walk({ distance: 0, phase: 0 }).frame);
  });

  it('지금 렌더러 계약(시간·speedBP)에서도 3학년 맵 이동 속도에 걸음이 맞는다', () => {
    const map = MAPS.find(m => m.grade === 3)!;
    for (const speedBP of [7500, 10000, 12000]) {
      const pxPerSec = ((map.pathLength * BALANCE.units.tickHz) / BALANCE.waves.baseTravelTicks) * CELL_PX * (speedBP / 10000);
      const samples = Array.from({ length: 3000 }, (_, i) => ({ at: (i / 1000) * pxPerSec, pose: walk({ time: i / 1000, speedBP }).frame }));
      for (const s of footSlips(samples)) expect(s, `speedBP ${speedBP}`).toBeLessThanOrEqual(0.3);
    }
  });

  it('발 있는 적은 걷는 동안 몸을 띄우지 않고, 발 기준 눌림은 4% 안이다', () => {
    const kinds: EnemyKind[] = ['walker', 'runner', 'brute', 'shell', 'swarm', 'boss'];
    const footY: number[] = [];
    for (const kind of kinds) for (let i = 0; i < 300; i++) {
      const p = enemyPose({ kind, phase: 0.3, time: i / 120, speedBP: 10000, moving: true, frames: kind === 'walker' ? 4 : 2, reducedMotion: false });
      expect(p.bob, kind).toBe(0);
      expect(p.squashY, kind).toBeGreaterThanOrEqual(0.96);
      expect(p.squashY, kind).toBeLessThanOrEqual(1);
      if (kind === 'walker') footY.push((96 - ASSETS.enemy('walker', 0).originY * 128) * scale * p.squashY - p.bob);
    }
    expect(Math.max(...footY) - Math.min(...footY)).toBeLessThan(0.1);
  });
});

describe('고블린 피격', () => {
  it(`${HIT_MS}ms 동안 피격 그림을 쓰고 바닥을 고정한 채 눌렸다가 돌아온다`, () => {
    expect(HIT_MS).toBeGreaterThanOrEqual(80);
    expect(HIT_MS).toBeLessThanOrEqual(120);
    const during = [0, 0.03, 0.06, 0.099].map(hitAge => walk({ hitAge, time: 0.4 }));
    for (const p of during) { expect(p.hit).toBe(true); expect(p.bob).toBe(0); }
    expect(during[0]!.squashY).toBeLessThan(0.9);
    for (let i = 1; i < during.length; i++) expect(during[i]!.squashY).toBeGreaterThan(during[i - 1]!.squashY);
    expect(walk({ hitAge: HIT_MS / 1000, time: 0.4 })).toEqual(walk({ time: 0.4 }));
    expect(walk({ time: 0.4 }).hit).toBe(false);
  });

  it('같은 적의 피격 효과는 120ms 안에 다시 시작하지 않는다', () => {
    expect(acceptsHit(null, 0)).toBe(true);
    expect(acceptsHit(1000, 1119)).toBe(false);
    expect(acceptsHit(1000, 1120)).toBe(true);
  });

  it('정지·감소된 모션에서는 걷기·피격 모두 bob 0, squashY 1이고 피격 그림만 바뀐다', () => {
    for (const over of [{ moving: false }, { reducedMotion: true }, { moving: false, reducedMotion: true }]) {
      for (const hitAge of [undefined, 0, 0.05]) {
        const p = walk({ ...over, time: 0.37, ...(hitAge === undefined ? {} : { hitAge }) });
        expect(p).toMatchObject({ bob: 0, squashY: 1, hit: hitAge !== undefined });
        if (over.moving === false) expect(p.frame).toBe(0);
      }
    }
  });
});

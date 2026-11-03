import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/content';
import {
  ambientSeed, BUTTERFLY_COUNT, butterflyBounds, butterflySpecs, butterflyStep, CLOUD_ALPHA, cloudSpecs, cloudStep, DAY_WAVES, rippleFrame, RIPPLE_ALPHA, RIPPLE_COUNT, RIPPLE_MS,
  rng, timeOfDay, TINT_ALPHA_MAX, waterSpots, WATER_ART,
} from '../../src/game/ambient';
import { CELL_PX, WORLD_H, WORLD_W } from '../../src/game/assets';
import { layoutFor } from '../../src/game/layouts';

// 살아 있는 분위기(src/game/ambient.ts): 가독성이 먼저라서 알파·개체 수·움직임 범위를 식으로 묶어 둔다.

const garden = MAPS.find(m => m.id === 'garden_u')!;
const channels = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('시간 흐름(아침 → 노을 → 밤)', () => {
  it('웨이브 1은 아침, 9는 노을(주황), 17은 밤(남색)이고, 알파는 늘 약하다', () => {
    const [m, d, n] = [timeOfDay(1), timeOfDay(9), timeOfDay(17)];
    const [mr, , mb] = channels(m.color), [dr, , db] = channels(d.color), [nr, , nb] = channels(n.color);
    expect(mr).toBeGreaterThan(mb); // 아침: 따뜻한 연노랑(빨강 > 파랑)
    expect(dr).toBeGreaterThan(db + 80); // 노을: 주황
    expect(nb).toBeGreaterThan(nr + 40); // 밤: 남색
    expect(n.alpha).toBeGreaterThan(d.alpha);
    expect(d.alpha).toBeGreaterThan(m.alpha);
    for (let w = 1; w <= 3 * DAY_WAVES; w++) {
      const t = timeOfDay(w);
      expect(t.alpha).toBeGreaterThan(0);
      expect(t.alpha).toBeLessThanOrEqual(TINT_ALPHA_MAX);
    }
  });

  it('하루는 24웨이브마다 되풀이되고, 웨이브 사이 색 변화는 부드럽다(한 웨이브에 한 채널이 40을 넘게 뛰지 않는다)', () => {
    expect(timeOfDay(1)).toEqual(timeOfDay(1 + DAY_WAVES));
    expect(timeOfDay(9)).toEqual(timeOfDay(9 + 2 * DAY_WAVES));
    for (let w = 1; w <= DAY_WAVES; w++) {
      const a = channels(timeOfDay(w).color), b = channels(timeOfDay(w + 1).color);
      for (let i = 0; i < 3; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThanOrEqual(40);
    }
    // 이상한 입력(0·음수·소수)도 1웨이브 값으로 읽는다.
    expect(timeOfDay(0)).toEqual(timeOfDay(1));
    expect(timeOfDay(-5)).toEqual(timeOfDay(1));
  });
});

describe('구름 그림자', () => {
  it('셋이고 은은하며(알파 낮음), 같은 맵은 항상 같은 자리·크기로 시작한다', () => {
    const a = cloudSpecs('garden_u', WORLD_W, WORLD_H, CELL_PX), b = cloudSpecs('garden_u', WORLD_W, WORLD_H, CELL_PX);
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    expect(cloudSpecs('river_z', WORLD_W, WORLD_H, CELL_PX)).not.toEqual(a);
    expect(CLOUD_ALPHA).toBeLessThanOrEqual(0.2);
    // 느리다: 초당 0.2칸 이하, 한 번 건너는 데 1분 이상.
    for (const c of a) { expect(c.speed).toBeLessThanOrEqual(0.2 * CELL_PX); expect(WORLD_W / c.speed).toBeGreaterThan(60); }
  });

  it('오른쪽 밖으로 완전히 나가면 왼쪽 밖에서 다시 들어온다', () => {
    const c = cloudSpecs('garden_u', WORLD_W, WORLD_H, CELL_PX)[0]!;
    const out = cloudStep({ ...c, x: WORLD_W + c.w / 2 - 0.1 }, 1, WORLD_W);
    expect(out.x).toBe(-c.w / 2);
    expect(cloudStep({ ...c, x: 100 }, 2, WORLD_W).x).toBeCloseTo(100 + 2 * c.speed, 9);
  });
});

describe('나비', () => {
  it('2~4마리이고, 오래 날아도 세계 가장자리 1칸 안쪽 범위를 벗어나지 않는다', () => {
    expect(BUTTERFLY_COUNT).toBeGreaterThanOrEqual(2);
    expect(BUTTERFLY_COUNT).toBeLessThanOrEqual(4);
    const bounds = butterflyBounds(WORLD_W, WORLD_H, CELL_PX), r = rng(ambientSeed('garden_u', 'flight'));
    const flies = butterflySpecs('garden_u', bounds, CELL_PX);
    expect(flies).toHaveLength(BUTTERFLY_COUNT);
    for (let i = 0; i < flies.length; i++) for (let step = 0; step < 20_000; step++) {
      flies[i] = butterflyStep(flies[i]!, 1 / 60, r, bounds);
      const { x, y } = flies[i]!;
      expect(x).toBeGreaterThanOrEqual(bounds.x0 - 1e-6); expect(x).toBeLessThanOrEqual(bounds.x1 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(bounds.y0 - 1e-6); expect(y).toBeLessThanOrEqual(bounds.y1 + 1e-6);
    }
  });

  it('목표에 닿으면 잠깐 앉았다가 새 목표로 떠난다. 천천히 난다(초당 0.4칸 이하)', () => {
    const bounds = butterflyBounds(WORLD_W, WORLD_H, CELL_PX), r = rng(1);
    const w0 = { x: 200, y: 200, tx: 200.5, ty: 200, speed: 20, rest: 0 };
    const landed = butterflyStep(w0, 1, r, bounds);
    expect([landed.x, landed.y]).toEqual([200.5, 200]);
    expect(landed.rest).toBeGreaterThan(0);
    expect(butterflyStep(landed, 0.1, r, bounds).x).toBe(200.5);
    for (const f of butterflySpecs('garden_u', bounds, CELL_PX)) expect(f.speed).toBeLessThanOrEqual(0.4 * CELL_PX);
  });
});

describe('잔물결', () => {
  it('정원 연못 한 곳만 물 면이 되고, 배치표 없는 맵·물 그림이 없으면 물이 없다', () => {
    const sizeOf = (asset: string) => (asset === 'landmark.pond' ? { width: 384, height: 192 } : null);
    const spots = waterSpots(layoutFor('garden_u'), garden, CELL_PX, sizeOf);
    expect(Object.keys(WATER_ART)).toEqual(['landmark.pond']);
    expect(spots).toHaveLength(1);
    const s = spots[0]!;
    // 연못은 왼쪽 위 길 안쪽: 세계 안에 들고, 가로로 긴 타원이다(대략 (5.6칸, 2.8칸)).
    expect(s.x / CELL_PX).toBeGreaterThan(5); expect(s.x / CELL_PX).toBeLessThan(6.2);
    expect(s.y / CELL_PX).toBeGreaterThan(2.4); expect(s.y / CELL_PX).toBeLessThan(3.1);
    expect(s.rx).toBeGreaterThan(s.ry * 2);
    expect(waterSpots(null, garden, CELL_PX, sizeOf)).toEqual([]);
    expect(waterSpots(layoutFor('garden_u'), garden, CELL_PX, () => null)).toEqual([]);
  });

  it('고리는 늘 물 면 타원 안에 머물고, 퍼지며 옅어지며, 동시에 RIPPLE_COUNT개다', () => {
    const spot = { x: 360, y: 180, rx: 60, ry: 17 };
    expect(RIPPLE_COUNT).toBeLessThanOrEqual(4);
    for (let t = 0; t < 3 * RIPPLE_MS; t += 97) for (let k = 0; k < RIPPLE_COUNT; k++) {
      const f = rippleFrame(spot, k, t);
      // 고리 가장자리(위·아래·좌·우)가 모두 타원(반지름 1.0배) 안이다.
      for (const [dx, dy] of [[f.rx, 0], [-f.rx, 0], [0, f.ry], [0, -f.ry]] as const) {
        const nx = (f.x + dx - spot.x) / spot.rx, ny = (f.y + dy - spot.y) / spot.ry;
        expect(nx * nx + ny * ny).toBeLessThanOrEqual(1.0001);
      }
      expect(f.alpha).toBeLessThanOrEqual(RIPPLE_ALPHA);
      expect(f.alpha).toBeGreaterThanOrEqual(0);
    }
    // 같은 고리는 수명 안에서 커지고 옅어진다.
    const early = rippleFrame(spot, 0, 100), late = rippleFrame(spot, 0, RIPPLE_MS - 100);
    expect(late.rx).toBeGreaterThan(early.rx);
    expect(late.alpha).toBeLessThan(early.alpha);
  });
});

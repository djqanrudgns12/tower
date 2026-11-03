import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/content';
import {
  AMBIENT_SETTINGS, ambientSeed, ambientSettings, BUTTERFLY_COUNT, butterflyArt, butterflyBounds, butterflySpecs, butterflyStep, CLOUD_ALPHA, CLOUD_ART_ALPHA, CLOUD_ART_KEYS, cloudArt, cloudSpecs, cloudStep,
  DAY_TINTS, DAY_WAVES, DRIFT_LOOK, DRIFT_MARGIN, driftSpecs, driftStep, rippleFrame, RIPPLE_ALPHA, RIPPLE_COUNT, RIPPLE_MS, rng, timeOfDay, TINT_ALPHA_MAX, waterSpots, WATER_ART,
} from '../../src/game/ambient';
import { CELL_PX, WORLD_H, WORLD_W } from '../../src/game/assets';
import { AmbientLayer } from '../../src/game/layers/AmbientLayer';
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

  it('밤은 낮과 한눈에 구별된다: 푸른빛이고 알파 0.2 안쪽에서 아침보다 3배 이상 짙으며, 15~19웨이브 내내 깊다', () => {
    expect(TINT_ALPHA_MAX).toBe(0.2);
    const morning = timeOfDay(1), dusk = timeOfDay(9), night = timeOfDay(17);
    expect(night.alpha).toBeGreaterThanOrEqual(0.18);
    expect(night.alpha).toBeLessThanOrEqual(0.2);
    expect(night.alpha).toBeGreaterThanOrEqual(3 * morning.alpha);
    expect(dusk.alpha).toBeGreaterThanOrEqual(0.12);
    const [nr, ng, nb] = channels(night.color);
    expect(nb).toBeGreaterThan(nr + 100); // 푸른빛
    expect(nb).toBeGreaterThan(ng + 60);
    for (const w of [15, 16, 17, 18, 19]) expect(timeOfDay(w)).toEqual(night);
    // 풀(146,179,90)에 얹었을 때 아침 대비 밤의 색 차이(합성 후 RGB 거리)가 지난 판(약 10%)보다 뚜렷하다.
    const grass: [number, number, number] = [146, 179, 90];
    const over = (t: { color: number; alpha: number }) => channels(t.color).map((c, i) => grass[i]! * (1 - t.alpha) + c * t.alpha) as [number, number, number];
    const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    expect(dist(over(night), over(morning))).toBeGreaterThan(30);
    expect(dist(over(dusk), over(morning))).toBeGreaterThan(14);
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
    const spots = waterSpots(layoutFor('garden_u'), garden, CELL_PX, sizeOf, ambientSettings('garden_u').water);
    expect(Object.keys(WATER_ART)).toEqual(['landmark.pond']);
    expect(ambientSettings('garden_u').water).toBe(WATER_ART);
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

describe('원화 고르기와 코드 그림으로 되돌리기', () => {
  const all = () => true, none = () => false;

  it('구름 그림자 원화 세 장이 모두 실렸을 때만 원화를 쓰고, 하나라도 없으면 코드 그림(null)이다', () => {
    expect(cloudArt(all)).toEqual(CLOUD_ART_KEYS);
    expect(cloudArt(none)).toBeNull();
    expect(cloudArt(key => key !== 'fx.cloudshadow.1')).toBeNull();
    // 원화 알파는 0.10~0.16 안이고 서로 조금씩 다르다.
    for (const a of CLOUD_ART_ALPHA) { expect(a).toBeGreaterThanOrEqual(0.1); expect(a).toBeLessThanOrEqual(0.16); }
    expect(new Set(CLOUD_ART_ALPHA).size).toBeGreaterThan(1);
  });

  it('나비는 색마다 날갯짓 두 프레임이 모두 실렸을 때만 원화를 쓴다', () => {
    expect(butterflyArt('yellow', all)).toEqual(['fx.butterfly.yellow.0', 'fx.butterfly.yellow.1']);
    expect(butterflyArt('white', none)).toBeNull();
    expect(butterflyArt('yellow', key => key !== 'fx.butterfly.yellow.1')).toBeNull();
    // 흰 나비만 실렸으면 노란 나비는 코드 그림이다.
    const onlyWhite = (key: string) => key.startsWith('fx.butterfly.white.');
    expect(butterflyArt('white', onlyWhite)).not.toBeNull();
    expect(butterflyArt('yellow', onlyWhite)).toBeNull();
  });

  /** Phaser 없이 층을 만들어 보는 가짜 장면: 어떤 텍스처 키가 쓰였고 어떤 임시 그림(캔버스)이 만들어졌는지만 기록한다. */
  function build(mapId: string, preloaded: string[]) {
    const keys = new Set(preloaded), canvases: string[] = [], used: string[] = [];
    const proxy = <T extends object>(target: T): T => new Proxy(target, { get: (t, p) => (p in t ? (t as Record<string | symbol, unknown>)[p] : () => proxy(t)) });
    const ctx2d = new Proxy({}, { get: () => () => ({ addColorStop: () => undefined }) });
    const image = (_x: number, _y: number, key: string) => {
      used.push(key);
      const o: Record<string, unknown> = { width: 64, height: 64, texture: { key } };
      o.setTexture = (k: string) => { (o.texture as { key: string }).key = k; return o; };
      return proxy(o);
    };
    const scene = {
      textures: {
        exists: (k: string) => keys.has(k),
        createCanvas: (k: string) => { keys.add(k); canvases.push(k); return { getContext: () => ctx2d, refresh: () => undefined }; },
        get: () => ({ getSourceImage: () => ({ width: 384, height: 192 }) }),
      },
      add: { image, graphics: () => proxy({}), rectangle: () => proxy({}) },
    };
    const map = MAPS.find(m => m.id === mapId)!;
    const bridge = { controller: { ctx: { map }, state: { wave: 1, pause: [] } }, reducedMotion: false };
    const layer = new AmbientLayer({ scene, bridge } as never);
    layer.update(16);
    return { used, canvases };
  }

  const ART = [...CLOUD_ART_KEYS, 'fx.butterfly.yellow.0', 'fx.butterfly.yellow.1', 'fx.butterfly.white.0', 'fx.butterfly.white.1'];

  it('원화가 실렸으면 정원의 구름 셋·나비 셋이 원화를 쓰고 임시 그림은 만들지 않는다', () => {
    const { used, canvases } = build('garden_u', ART);
    expect(canvases).toEqual([]);
    expect(used.filter(k => k.startsWith('fx.cloudshadow.'))).toHaveLength(3);
    expect(used.filter(k => k.startsWith('fx.butterfly.'))).toHaveLength(BUTTERFLY_COUNT);
  });

  it('원화가 하나도 안 실렸으면 지금의 코드 그림(구름·나비 임시 텍스처)으로 돌아간다', () => {
    const { used, canvases } = build('garden_u', []);
    expect(canvases.sort()).toEqual(['ambient.butterfly', 'ambient.cloud']);
    expect(used.filter(k => k === 'ambient.cloud')).toHaveLength(3);
    expect(used.filter(k => k === 'ambient.butterfly')).toHaveLength(BUTTERFLY_COUNT);
    expect(used.some(k => k.startsWith('fx.'))).toBe(false);
  });

  it('구름 원화 한 장이라도 빠지면 구름만 코드 그림이고 나비는 원화를 그대로 쓴다', () => {
    const { used, canvases } = build('garden_u', ART.filter(k => k !== 'fx.cloudshadow.2'));
    expect(canvases).toEqual(['ambient.cloud']);
    expect(used.filter(k => k === 'ambient.cloud')).toHaveLength(3);
    expect(used.filter(k => k.startsWith('fx.butterfly.'))).toHaveLength(BUTTERFLY_COUNT);
  });
});

describe('맵별 분위기 설정 표', () => {
  it('네 맵이 모두 표에 있고, 표에 없는 맵은 정원 설정을 쓴다', () => {
    expect(Object.keys(AMBIENT_SETTINGS).sort()).toEqual(['courtyard', 'garden_u', 'river_z', 'snow_step']);
    for (const m of MAPS) expect(AMBIENT_SETTINGS[m.id], m.id).toBeDefined();
    expect(ambientSettings('unknown_map')).toBe(AMBIENT_SETTINGS.garden_u);
    for (const s of Object.values(AMBIENT_SETTINGS)) expect(s.tint).toBe(DAY_TINTS);
  });

  it('요소가 맵 분위기와 맞고 개체 수는 적다(나비 3마리 이하, 입자 30개 이하)', () => {
    expect(AMBIENT_SETTINGS.garden_u!.butterflies).toHaveLength(3);
    expect(AMBIENT_SETTINGS.river_z!.butterflies.length).toBeGreaterThanOrEqual(2); // 잠자리 대신 나비
    expect(AMBIENT_SETTINGS.river_z!.drift).toBeNull();
    expect(Object.keys(AMBIENT_SETTINGS.river_z!.water).sort()).toEqual(['map.river_z.landmark.ferry', 'map.river_z.landmark.watermill']);
    expect(AMBIENT_SETTINGS.courtyard!.drift?.kind).toBe('petal');
    expect(AMBIENT_SETTINGS.courtyard!.butterflies).toEqual([]);
    expect(AMBIENT_SETTINGS.snow_step!.drift?.kind).toBe('snow');
    expect(Object.keys(AMBIENT_SETTINGS.snow_step!.water)).toEqual([]); // 언 연못은 물결이 없다
    for (const s of Object.values(AMBIENT_SETTINGS)) {
      expect(s.butterflies.length).toBeLessThanOrEqual(3);
      expect(s.drift?.count ?? 0).toBeLessThanOrEqual(30);
      for (const spots of Object.values(s.water)) for (const e of spots) {
        // 물 면 타원은 그림 안에 든다.
        expect(e.cx - e.rx).toBeGreaterThan(0); expect(e.cx + e.rx).toBeLessThan(1);
        expect(e.cy - e.ry).toBeGreaterThan(0); expect(e.cy + e.ry).toBeLessThan(1);
      }
    }
  });
});

describe('흩날리는 꽃잎·눈송이', () => {
  it('같은 맵은 같은 자리·속도로 시작하고, 속도·크기는 종류별 범위 안이며 느리다', () => {
    for (const kind of ['petal', 'snow'] as const) {
      const a = driftSpecs('courtyard', kind, 12, WORLD_W, WORLD_H), b = driftSpecs('courtyard', kind, 12, WORLD_W, WORLD_H);
      expect(a).toEqual(b);
      expect(a).toHaveLength(12);
      expect(driftSpecs('snow_step', kind, 12, WORLD_W, WORLD_H)).not.toEqual(a);
      const look = DRIFT_LOOK[kind];
      for (const d of a) {
        expect(d.vx).toBeGreaterThanOrEqual(look.vx[0]); expect(d.vx).toBeLessThanOrEqual(look.vx[1]);
        expect(d.vy).toBeGreaterThanOrEqual(look.vy[0]); expect(d.vy).toBeLessThanOrEqual(look.vy[1]);
        expect(d.size).toBeGreaterThanOrEqual(look.size[0]); expect(d.size).toBeLessThanOrEqual(look.size[1]);
        expect(Math.hypot(d.vx, d.vy)).toBeLessThanOrEqual(0.5 * CELL_PX); // 초당 0.5칸 이하
      }
      expect(look.alpha).toBeLessThanOrEqual(0.9);
    }
  });

  it('오래 흘러도 세계 안팎의 좁은 여백 안에 머물고, 나가면 위·왼쪽에서 다시 들어온다', () => {
    const r = rng(7);
    for (const kind of ['petal', 'snow'] as const) {
      const flakes = driftSpecs('snow_step', kind, 24, WORLD_W, WORLD_H);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < flakes.length; i++) for (let step = 0; step < 6_000; step++) {
        flakes[i] = driftStep(flakes[i]!, 1 / 30, r, WORLD_W, WORLD_H);
        const { x, y } = flakes[i]!;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      expect(x0).toBeGreaterThanOrEqual(-DRIFT_MARGIN - 1e-6); expect(x1).toBeLessThanOrEqual(WORLD_W + DRIFT_MARGIN + 1e-6);
      expect(y0).toBeGreaterThanOrEqual(-DRIFT_MARGIN - 1e-6); expect(y1).toBeLessThanOrEqual(WORLD_H + DRIFT_MARGIN + 1e-6);
    }
    const d = driftSpecs('snow_step', 'snow', 1, WORLD_W, WORLD_H)[0]!;
    const out = driftStep({ ...d, y: WORLD_H + DRIFT_MARGIN - 0.001, vy: 100 }, 1, rng(3), WORLD_W, WORLD_H);
    expect(out.y).toBe(-DRIFT_MARGIN);
    expect(driftStep({ ...d, x: WORLD_W + DRIFT_MARGIN - 0.001, vx: 100, y: 10 }, 1, rng(3), WORLD_W, WORLD_H).x).toBe(-DRIFT_MARGIN);
  });
});

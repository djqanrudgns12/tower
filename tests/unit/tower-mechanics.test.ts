import { describe, expect, it } from 'vitest';
import { FORM_IDS, TOWER_IDS, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { towerStats } from '../../src/domain/towers';
import type { Enemy, RunState, Tower } from '../../src/domain/types';
import { finishPrep, newRun, ok, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// 신규 타워·2차형 메커니즘(docs/renewal/catalog/towers.md §2·§4). 정원 맵 1행 길: 진행도 p 적은 (p+500, 1500), (8,2) 칸 중심은 (8500, 2500).
const slotAt = (ctx: GameContext, x: number, y: number) => ctx.map.slots.find(s => s.x === x && s.y === y)!.id;

function arena(towers: Array<[TowerId, number, number, number?, FormId?]>) {
  const { ctx, s } = newRun('Normal', 7);
  finishPrep(ctx, s);
  s.config.availableTowers = [...TOWER_IDS];
  s.owned = [...TOWER_IDS];
  s.gold = 1_000_000;
  for (const [type, x, y, level, form] of towers) {
    ok(ctx, s, { type: 'build', slotId: slotAt(ctx, x, y), tower: type });
    const t = s.towers.at(-1)!;
    t.level = level ?? 1; t.form = form ?? 'base';
  }
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  for (const t of s.towers) if (t.nextAttackTick !== null) t.nextAttackTick = s.tick + 1;
  return { ctx, s };
}

/** 움직이지 않게 기절시켜 위치를 고정한다(id 100부터). */
function place(s: RunState, list: Array<Partial<Enemy> & { progress: number }>) {
  s.enemies = list.map((o, i) => enemy({ id: 100 + i, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, ...o }));
}
const hits = (ev: DomainEvent[]) => ev.flatMap(e => (e.type === 'hit' ? [[e.enemyId, e.damage] as [number, number]] : []));
const dmg = (type: TowerId, level = 1, form: FormId = 'base') => towerStats(BALANCE, type, level, form).damage;
const only = (s: RunState, type: TowerId): Tower => s.towers.find(t => t.type === type)!;
const stopOthers = (s: RunState, keep: Tower) => { for (const t of s.towers) if (t !== keep) t.nextAttackTick = null; };

describe('모든 타워·형태', () => {
  it('20종 × 7형태 × Lv1~12 수치가 안전 정수이고, 모두 한 판에서 짓고 쏠 수 있다', () => {
    for (const type of TOWER_IDS) {
      if (type === 'banner') continue;
      for (const form of FORM_IDS) for (let level = 1; level <= 12; level++) {
        const st = towerStats(BALANCE, type, level, form);
        expect(Number.isSafeInteger(st.damage) && st.range > 0 && st.maxTargets >= 1, `${type} ${form} Lv${level}`).toBe(true);
      }
    }
    // 진화형마다 20종을 두 무리로 나눠 판을 돌려 본다: 던지지 않고 결정론(같은 입력 같은 사건)이다.
    const slots: Array<[number, number]> = [[8, 2], [8, 0], [2, 2], [0, 2], [6, 0], [11, 0], [10, 4], [5, 4], [3, 0], [13, 1]];
    const kinds = ['walker', 'flyer', 'splitter', 'shell', 'boss'] as const;
    for (const form of FORM_IDS) for (const group of [TOWER_IDS.slice(0, 10), TOWER_IDS.slice(10)]) {
      const runOnce = () => {
        const level = form === 'base' ? 2 : form.length === 1 ? 5 : 8;
        const { ctx, s } = arena(group.map((t, i) => [t, slots[i]![0], slots[i]![1], level, form] as [TowerId, number, number, number, FormId]));
        s.enemies = [];
        s.battle!.spawnList = Array.from({ length: 30 }, (_, i) => ({ kind: kinds[i % 5]!, elite: i % 7 === 0 ? 'armored' as const : null }));
        s.battle!.spawnIndex = 0;
        s.battle!.intervalTicks = 8;
        return JSON.stringify(ticks(ctx, s, 600).map(e => e.type + ('enemyId' in e ? e.enemyId : '')));
      };
      expect(runOnce()).toBe(runOnce());
    }
  });
});

describe('도넛 사거리(§4-2 박격포)', () => {
  it('최소 사거리 1.6칸 안의 적은 노리지 않고, 밖의 적을 노린다', () => {
    const { ctx, s } = arena([['mortar', 8, 2]]);
    place(s, [{ progress: 8000 }]);
    expect(ticks(ctx, s, 5).filter(e => e.type === 'fire')).toHaveLength(0);
    place(s, [{ progress: 8000 }, { progress: 10000 }]);
    const fire = ticks(ctx, s, 1).find(e => e.type === 'fire');
    expect(fire).toBeDefined();
    expect(s.projectiles[0]).toMatchObject({ targetId: null, toX: 10500, toY: 1500 });
  });
});

describe('도탄(§4-3 투석)', () => {
  it('맞힌 자리 둘레 1.2칸의 다른 적에게 70%로 한 번 튀고, 맞은 적에게 다시 튀지 않는다', () => {
    const { ctx, s } = arena([['sling', 8, 2]]);
    place(s, [{ progress: 7000 }, { progress: 8000 }]);
    const got: Array<[number, number]> = [];
    for (let i = 0; i < 90; i++) got.push(...hits(ticks(ctx, s, 1)));
    const base = dmg('sling');
    expect(got.slice(0, 2)).toEqual([[101, base], [100, Math.floor((base * 7000) / 10000)]]);
  });
});

describe('시차 다연발(§4-4 화차)', () => {
  it('주 공격 뒤 3틱마다 다시 조준해 모두 4발을 쏜다', () => {
    const { ctx, s } = arena([['hwacha', 8, 2]]);
    place(s, [{ progress: 8000 }]);
    const fires: number[] = [];
    for (let i = 0; i < 20; i++) for (const e of ticks(ctx, s, 1)) if (e.type === 'fire') fires.push(s.tick);
    expect(fires.map(t => t - fires[0]!)).toEqual([0, 3, 6, 9]);
  });

  it('공격 주기(§4-9 궁수 A1): 세 번째 공격마다 4틱 뒤 80% 화살 한 발을 더 쏜다', () => {
    const { ctx, s } = arena([['archer', 8, 2, 7, 'A1']]);
    place(s, [{ progress: 8000 }]);
    const fires: number[] = [];
    for (let i = 0; i < 100; i++) for (const e of ticks(ctx, s, 1)) if (e.type === 'fire') fires.push(s.tick);
    const gaps = fires.slice(1).map((t, i) => t - fires[i]!);
    const interval = gaps[0]!;
    // 1·2·3번째 공격 → 3번째 뒤 4틱에 덧화살 → 4번째 공격.
    expect(gaps.slice(0, 4)).toEqual([interval, interval, 4, interval - 4]);
  });
});

describe('밀치기(§4-5 바람)', () => {
  it('지상 0.22칸·비행 0.35칸 뒤로, 대장은 밀리지 않고 느려진다, 평생 3칸까지', () => {
    const { ctx, s } = arena([['wind', 8, 2]]);
    place(s, [{ progress: 9000 }, { progress: 8800, kind: 'flyer', flying: true }, { progress: 8600, kind: 'boss' }]);
    ticks(ctx, s, 1);
    expect(s.enemies.map(e => e.progress)).toEqual([9000 - 220, 8800 - 350, 8600]);
    expect(s.enemies[2]!.slows[0]?.bp).toBe(2000);
    s.enemies[0]!.knockbackUsed = 2900;
    s.towers[0]!.nextAttackTick = s.tick + 1;
    ticks(ctx, s, 1);
    expect(s.enemies[0]!.progress).toBe(9000 - 220 - 100);
  });

  it('하강 기류(바람 A2): 맞은 비행 적은 3초 동안 지상 전용 포탑도 맞힌다', () => {
    const { ctx, s } = arena([['wind', 8, 2, 7, 'A2'], ['cannon', 8, 0]]);
    stopOthers(s, only(s, 'wind'));
    place(s, [{ progress: 8800, kind: 'flyer', flying: true }]);
    ticks(ctx, s, 1);
    expect(s.enemies[0]!.groundedUntilTick).toBe(s.tick + 90);
    only(s, 'cannon').nextAttackTick = s.tick + 1;
    let hit = false;
    for (let i = 0; i < 40 && !hit; i++) hit = hits(ticks(ctx, s, 1)).some(([id]) => id === 100);
    expect(hit).toBe(true);
  });
});

describe('취약·저항 차감(§4-6)', () => {
  it('종각 고리: 사거리 안 전방위 최대 5명(비행 포함)에 취약 12%, 다음 타격이 1.12배', () => {
    const { ctx, s } = arena([['bell', 8, 2], ['archer', 8, 0]]);
    stopOthers(s, only(s, 'bell'));
    place(s, [{ progress: 7000 }, { progress: 8000, kind: 'flyer', flying: true }, { progress: 9000 }]);
    const first = hits(ticks(ctx, s, 1));
    expect(first.map(h => h[0]).sort()).toEqual([100, 101, 102]);
    expect(s.enemies.every(e => e.vulns[0]?.bp === 1200)).toBe(true);
    only(s, 'bell').nextAttackTick = null;
    only(s, 'archer').nextAttackTick = s.tick + 1;
    let got: Array<[number, number]> = [];
    for (let i = 0; i < 30 && got.length === 0; i++) got = hits(ticks(ctx, s, 1));
    expect(got[0]![1]).toBe(Math.floor((dmg('archer') * 11200) / 10000));
  });

  it('창병 B1 갑옷 틈새: 물리 저항 35%를 25%p 깎아 다음 찌르기가 저항 10%로 들어간다', () => {
    const { ctx, s } = arena([['spear', 8, 2, 7, 'B1']]);
    place(s, [{ progress: 8000, kind: 'shell', physicalResistBP: 3500 }]);
    const st = towerStats(BALANCE, 'spear', 7, 'B1');
    const first = hits(ticks(ctx, s, 1))[0]![1];
    // 첫 찌르기: 저항 3500에 무시 50% → 1750.
    expect(first).toBe(Math.floor((st.damage * (10000 - 1750)) / 10000));
    s.towers[0]!.nextAttackTick = s.tick + 1;
    const second = hits(ticks(ctx, s, 1))[0]![1];
    // 차감 뒤 1000에 무시 50% → 500.
    expect(second).toBe(Math.floor((st.damage * (10000 - 500)) / 10000));
  });

  it('취약 상한 35%: 여러 출처라도 가장 큰 값 하나, 상한까지', () => {
    const { ctx, s } = arena([['archer', 8, 2]]);
    place(s, [{ progress: 8000, vulns: [{ source: 90, bp: 2000, untilTick: 10_000_000 }, { source: 91, bp: 5000, untilTick: 10_000_000 }] }]);
    let got: Array<[number, number]> = [];
    for (let i = 0; i < 30 && got.length === 0; i++) got = hits(ticks(ctx, s, 1));
    expect(got[0]![1]).toBe(Math.floor((dmg('archer') * 13500) / 10000));
  });
});

describe('형태별 고유 능력', () => {
  it('궁수 A2 갈래 화살: 서로 다른 셋에게 75%씩', () => {
    const { ctx, s } = arena([['archer', 8, 2, 7, 'A2']]);
    place(s, [{ progress: 7000 }, { progress: 8000 }, { progress: 9000 }, { progress: 9500 }]);
    ticks(ctx, s, 1);
    expect(s.projectiles.map(p => p.targetId)).toEqual([103, 102, 101]);
    expect(s.projectiles[0]!.damage).toBe(towerStats(BALANCE, 'archer', 7, 'A2').damage);
  });

  it('통나무: 첫 표적에서 입구 쪽 2.6칸 안의 지상 적만, 진행도↓로 최대 5', () => {
    const { ctx, s } = arena([['roller', 8, 2]]);
    place(s, [{ progress: 9000 }, { progress: 7500 }, { progress: 6000 }, { progress: 8500, kind: 'flyer', flying: true }]);
    expect(hits(ticks(ctx, s, 1)).map(h => h[0])).toEqual([100, 101]);
  });

  it('번개 A2: 마지막 연쇄 대상 둘레 0.8칸에 60% 스파크(그 대상은 빼고)', () => {
    const { ctx, s } = arena([['lightning', 8, 2, 7, 'A2']]);
    // 연쇄 5명 한도 밖에 둔 적(진행도 4500)이 마지막 대상(5000) 둘레에서 스파크를 맞는다.
    place(s, [{ progress: 9000 }, { progress: 8000 }, { progress: 7000 }, { progress: 6000 }, { progress: 5000 }, { progress: 4500 }]);
    const ev = hits(ticks(ctx, s, 1));
    const st = towerStats(BALANCE, 'lightning', 7, 'A2');
    expect(ev.at(-1)).toEqual([105, Math.floor((st.damage * 6000) / 10000)]);
  });

  it('서리 B2 깨지는 얼음꽃: 이 탑 감속이 걸린 적이 쓰러지면 둘레에 200% 파편 + 감속을 옮긴다', () => {
    const { ctx, s } = arena([['frost', 8, 2, 7, 'B2'], ['archer', 8, 0]]);
    stopOthers(s, only(s, 'frost'));
    const frost = only(s, 'frost');
    place(s, [{ progress: 8300, hp: 1, slows: [{ source: frost.id, bp: 2000, untilTick: 10_000_000 }] }, { progress: 8000 }]);
    only(s, 'archer').nextAttackTick = s.tick + 1;
    frost.nextAttackTick = null;
    let ev: DomainEvent[] = [];
    for (let i = 0; i < 30 && !ev.some(e => e.type === 'kill'); i++) ev = ticks(ctx, s, 1);
    const shard = hits(ev).find(([id]) => id === 101);
    expect(shard?.[1]).toBe(Math.floor((towerStats(BALANCE, 'frost', 7, 'B2').damage * 20000) / 10000));
    expect(s.enemies.find(e => e.id === 101)!.slows.some(x => x.source === frost.id)).toBe(true);
  });

  it('마법 A1 비전 집중포: 같은 적을 이어 치면 +15%씩, 최대 +45%', () => {
    const { ctx, s } = arena([['mage', 8, 2, 7, 'A1']]);
    place(s, [{ progress: 8000 }]);
    const got: number[] = [];
    for (let i = 0; i < 5; i++) { s.towers[0]!.nextAttackTick = s.tick + 1; got.push(hits(ticks(ctx, s, 1))[0]![1]); }
    const d = towerStats(BALANCE, 'mage', 7, 'A1').damage;
    expect(got).toEqual([10000, 11500, 13000, 14500, 14500].map(bp => Math.floor((d * bp) / 10000)));
  });

  it('수호기사 A2 불굴의 맹세: 성문이 가득이면 +10%, 절반이면 +12%', () => {
    const { ctx, s } = arena([['guardian', 8, 2, 7, 'A2']]);
    const d = towerStats(BALANCE, 'guardian', 7, 'A2').damage;
    place(s, [{ progress: 8000 }]);
    expect(hits(ticks(ctx, s, 1))[0]![1]).toBe(Math.floor((d * 11000) / 10000));
    s.gateHp = Math.floor(s.gateMaxHp / 2);
    const lost = Math.floor(((s.gateMaxHp - s.gateHp) * 10000) / s.gateMaxHp);
    s.towers[0]!.nextAttackTick = s.tick + 1;
    expect(hits(ticks(ctx, s, 1))[0]![1]).toBe(Math.floor((d * (10000 + Math.max(1000, Math.floor((2500 * lost) / 10000)))) / 10000));
  });

  it('수호기사 B2 철벽 수호진: 1.8칸 안 지상 적은 쏘지 않아도 25% 느려지고, 비행 적은 아니다', () => {
    const { ctx, s } = arena([['guardian', 8, 2, 7, 'B2']]);
    s.towers[0]!.nextAttackTick = null;
    place(s, [{ progress: 8000 }, { progress: 8100, kind: 'flyer', flying: true }, { progress: 3000 }]);
    ticks(ctx, s, 1);
    expect(s.enemies.map(e => e.slows.length)).toEqual([1, 0, 0]);
  });

  it('바람 B2 순풍 응원: 쏠 때마다 2.3칸 안 공격 타워(최대 2기)의 다음 공격을 6틱 당긴다', () => {
    const { ctx, s } = arena([['wind', 8, 2, 7, 'B2'], ['archer', 8, 0], ['mage', 2, 2]]);
    place(s, [{ progress: 8000 }]);
    for (const t of s.towers) if (t.type !== 'wind') t.nextAttackTick = s.tick + 100;
    ticks(ctx, s, 1);
    const next = Object.fromEntries(s.towers.map(t => [t.type, t.nextAttackTick! - s.tick]));
    expect([next.archer, next.mage]).toEqual([93, 99]);
  });

  it('종각 B 맑은 종소리: 2칸 안 공격 타워 사거리 +0.25칸(궁수 2.5 → 2.75칸)', () => {
    const { ctx, s } = arena([['bell', 8, 2, 4, 'B'], ['archer', 8, 0]]);
    only(s, 'bell').nextAttackTick = null;
    // 궁수(8.5, 0.5)에서 (10.9, 1.5)는 거리 √(2.4²+1²) = 2.6칸 → 오라로 안, (11.2, 1.5)는 ≈ 2.88칸 → 밖. 종각은 2칸 떨어져 있다.
    place(s, [{ progress: 10400 }]);
    expect(ticks(ctx, s, 1).some(e => e.type === 'fire')).toBe(true);
    place(s, [{ progress: 10700 }]);
    only(s, 'archer').nextAttackTick = s.tick + 1;
    expect(ticks(ctx, s, 1).some(e => e.type === 'fire')).toBe(false);
  });

  it('깃발 A2 승리의 나팔: 오라 안 타워가 5번 처치할 때마다 2골드, 웨이브당 10골드까지', () => {
    const { ctx, s } = arena([['banner', 8, 2, 7, 'A2'], ['lightning', 8, 0, 7, 'A1']]);
    const gold0 = s.gold;
    let bonus = 0;
    for (let round = 0; round < 8; round++) {
      // 멀리 둔 적 하나가 웨이브를 끝나지 않게 붙잡는다.
      place(s, [...Array.from({ length: 7 }, (_, i) => ({ progress: 6000 + i * 500, hp: 1 })), { progress: 30000 }]);
      only(s, 'lightning').nextAttackTick = s.tick + 1;
      for (const e of ticks(ctx, s, 1)) if (e.type === 'auraGold') bonus += e.gold;
    }
    expect(bonus).toBe(10);
    expect(s.gold - gold0).toBe(56 * ctx.difficulty.killGold.regular + 10);
  });

  it('궁수 B2 급소 화살: 체력 40% 이하 적에게 1.5배, 서리 A2 고드름: 감속 중인 적에게 3배', () => {
    const a = arena([['archer', 8, 2, 7, 'B2']]);
    place(a.s, [{ progress: 8000, hp: 800_000 }]);
    let got: Array<[number, number]> = [];
    for (let i = 0; i < 30 && got.length === 0; i++) got = hits(ticks(a.ctx, a.s, 1));
    expect(got[0]![1]).toBe(Math.floor((towerStats(BALANCE, 'archer', 7, 'B2').damage * 15000) / 10000));
    const f = arena([['frost', 8, 2, 7, 'A2']]);
    place(f.s, [{ progress: 8000, slows: [{ source: 99, bp: 1000, untilTick: 10_000_000 }] }]);
    got = [];
    for (let i = 0; i < 30 && got.length === 0; i++) got = hits(ticks(f.ctx, f.s, 1));
    expect(got[0]![1]).toBe(Math.floor((towerStats(BALANCE, 'frost', 7, 'A2').damage * 30000) / 10000));
  });
});

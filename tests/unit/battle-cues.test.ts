import { describe, expect, it } from 'vitest';
import type { BossTier } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { DomainEvent } from '../../src/domain/events';
import { msToTicks } from '../../src/domain/num';
import type { Enemy, Projectile, RunState, SpawnEntry } from '../../src/domain/types';
import {
  bossCue, bossStatus, FLYER_LIFT_CELLS, flyerLift, INTRO_MS, introFrame, spawnIntros, SPLIT_LABEL_RAISE_CELLS,
} from '../../src/game/layers/cues';
import { finishPrep, newRun, ok, ticks } from './helpers';

// 전장 연출 고르기(src/game/layers/cues.ts): 대장 기믹·비행·분열을 실제 판정 사건과 상태로 고른다.

function battle(entries: SpawnEntry[]) {
  const { ctx, s } = newRun('Normal', 21);
  finishPrep(ctx, s);
  ok(ctx, s, { type: 'startBattle' });
  s.gateHp = s.gateMaxHp = 1000;
  s.battle!.spawnList = entries;
  s.battle!.spawnIndex = 0;
  s.battle!.nextSpawnTick = s.tick + 1;
  s.battle!.intervalTicks = 1;
  ticks(ctx, s, entries.length);
  return { ctx, s };
}
const boss = (faction: string, bossTier: BossTier): SpawnEntry => ({ kind: 'boss', elite: null, faction, bossTier });
const freeze = (e: Enemy) => { e.stunUntilTick = 10_000_000; };

/** 다음 틱에 damage(milli-HP)를 주는 물리 투사체. */
function shot(s: RunState, e: Enemy, damage: number) {
  const p: Projectile = {
    id: 900 + s.projectiles.length, towerId: 999, towerType: 'archer', fromX: 0, fromY: 0, targetId: e.id, toX: 0, toY: 0, firedTick: s.tick, arrivalTick: s.tick + 1,
    damage, damageType: 'physical', splashRadius: 0, maxTargets: 1, slowBP: 0, slowTicks: 0, physicalResistIgnoreBP: 0, bonusBP: 0, eliteBossDamageBP: 10000, canHitFlyer: true, flyerDamageBP: 10000,
  };
  s.projectiles.push(p);
}
const skillEvents = (ev: DomainEvent[]) => ev.filter((e): e is Extract<DomainEvent, { type: 'bossSkill' }> => e.type === 'bossSkill');

describe('대장 기믹 표시(정원 5·10·15·20웨이브 대장과 강가 겹방패·회복)', () => {
  it('방어 태세: 체력이 절반 아래로 처음 내려가는 사건에 발밑 고리, 태세가 끝나면 상시 고리도 사라진다', () => {
    const { ctx, s } = battle([boss('acorn_goblin', 1)]);
    const e = s.enemies[0]!;
    freeze(e);
    expect(bossStatus(BALANCE, e, s.tick)).toEqual({ stance: false, wardDots: 0, dash: false, rallyMilli: 0 });
    shot(s, e, e.hp - Math.floor(e.maxHp / 2) + 1);
    const ev = skillEvents(ticks(ctx, s, 1));
    expect(ev.map(x => x.skill)).toEqual(['iron_stance']);
    expect(bossCue(BALANCE, e, 'iron_stance')).toEqual({ kind: 'ring' });
    expect(bossStatus(BALANCE, e, s.tick)!.stance).toBe(true);
    ticks(ctx, s, msToTicks(3000));
    expect(bossStatus(BALANCE, e, s.tick)!.stance).toBe(false);
  });

  it('박차 행진: 이동이 빨라지는 틱에만 먼지 줄, 기절 중에는 없다', () => {
    const { ctx, s } = battle([boss('acorn_goblin', 2)]);
    const e = s.enemies[0]!;
    // 다음 틱의 표시와 그 틱의 실제 이동량을 맞춰 본다: 먼지 줄이 보이는 틱만 기본 속도보다 더 간다.
    const dashMoves: number[] = [], walkMoves: number[] = [];
    for (let i = 0; i < msToTicks(4000); i++) {
      const dash = bossStatus(BALANCE, e, s.tick + 1)!.dash;
      const before = e.progress;
      ticks(ctx, s, 1);
      (dash ? dashMoves : walkMoves).push(e.progress - before);
    }
    expect(dashMoves).toHaveLength(msToTicks(1200));
    expect(Math.min(...dashMoves)).toBeGreaterThan(Math.max(...walkMoves));
    freeze(e);
    const dashTick = Array.from({ length: msToTicks(4000) }, (_, i) => s.tick + i).find(t => bossStatus(BALANCE, { ...e, stunUntilTick: 0 }, t)!.dash)!;
    expect(bossStatus(BALANCE, e, dashTick)!.dash).toBe(false);
  });

  it('호위 호출: 대장 옆 먼지와 함께 같은 묶음의 호위병 둘이 나타난다(분열과 섞이지 않는다)', () => {
    const { ctx, s } = battle([boss('acorn_goblin', 3)]);
    const e = s.enemies[0]!;
    freeze(e);
    shot(s, e, e.hp - Math.floor(e.maxHp / 2) + 1);
    const ev = ticks(ctx, s, 1);
    expect(skillEvents(ev).map(x => x.skill)).toEqual(['call_escort']);
    expect(bossCue(BALANCE, e, 'call_escort')).toEqual({ kind: 'dust' });
    const escorts = s.enemies.filter(x => x.derived).map(x => x.id);
    expect(escorts).toHaveLength(2);
    expect(spawnIntros(BALANCE, ev)).toEqual([
      { enemyId: escorts[0], style: 'escort', from: null, side: -1 },
      { enemyId: escorts[1], style: 'escort', from: null, side: 1 },
    ]);
  });

  it('진군 북소리: 반경 원을 상시로, 사건 없는 기믹은 순간 연출을 고르지 않는다', () => {
    const { s } = battle([boss('acorn_goblin', 4)]);
    const e = s.enemies[0]!;
    expect(bossStatus(BALANCE, e, s.tick)!.rallyMilli).toBe(1800);
    expect(bossCue(BALANCE, e, 'rally_haste')).toBeNull();
    // 사건의 기믹이 그 대장의 기믹과 다르거나 대장이 이미 없으면 그리지 않는다.
    expect(bossCue(BALANCE, e, 'iron_stance')).toBeNull();
    expect(bossCue(BALANCE, undefined, 'rally_haste')).toBeNull();
  });

  it('겹방패: 남은 겹 수만큼 점, 한 겹 벗겨지면 벗겨진 점 자리(줄 끝)에서 튄다', () => {
    const { ctx, s } = battle([boss('river_rafter', 2)]);
    const e = s.enemies[0]!;
    freeze(e);
    expect(bossStatus(BALANCE, e, s.tick)!.wardDots).toBe(4);
    shot(s, e, e.maxHp);
    expect(skillEvents(ticks(ctx, s, 1)).map(x => x.skill)).toEqual(['ward_layers']);
    expect(bossStatus(BALANCE, e, s.tick)!.wardDots).toBe(3);
    expect(bossCue(BALANCE, e, 'ward_layers')).toEqual({ kind: 'wardPop', index: 3, of: 4 });
  });

  it('새참 회복: 회복량을 화면 HP 단위(milli-HP ÷ 1000)로 보인다', () => {
    const { ctx, s } = battle([boss('river_rafter', 3)]);
    const e = s.enemies[0]!;
    e.hp = Math.floor(e.maxHp / 2);
    const before = e.hp;
    const ev = ticks(ctx, s, msToTicks(3000));
    expect(skillEvents(ev).map(x => x.skill)).toEqual(['snack_mend']);
    expect(bossCue(BALANCE, e, 'snack_mend')).toEqual({ kind: 'heal', hp: Math.round((e.hp - before) / 1000) });
  });
});

describe('분열 등장 연출', () => {
  it('분열 적이 쓰러진 지점에서 파생체 둘이 왼쪽·오른쪽으로 튀어나온다. 일반 생성은 연출하지 않는다', () => {
    const { ctx, s } = battle([{ kind: 'splitter', elite: null }, { kind: 'walker', elite: null }]);
    const sp = s.enemies.find(x => x.kind === 'splitter')!;
    shot(s, sp, sp.hp);
    const ev = ticks(ctx, s, 1);
    const kill = ev.find((x): x is Extract<DomainEvent, { type: 'kill' }> => x.type === 'kill')!;
    const kids = s.enemies.filter(x => x.kind === 'splitling').map(x => x.id);
    expect(kids).toHaveLength(2);
    expect(spawnIntros(BALANCE, ev)).toEqual(kids.map((enemyId, i) => ({ enemyId, style: 'split', from: { x: kill.x, y: kill.y }, side: i === 0 ? -1 : 1 })));
    expect(spawnIntros(BALANCE, [{ type: 'spawn', enemyId: 1, kind: 'walker', faction: 'acorn_goblin', art: 'enemy.walker' }])).toEqual([]);
  });

  it('300ms 안에 처치 지점에서 제자리로 가고, 움직임 줄이기면 제자리에서 투명도만 바뀐다', () => {
    const split = { style: 'split' as const, side: 1 };
    expect(introFrame(split, 0, false)).toMatchObject({ t: 0, lift: 0, sway: 0, alpha: 1 });
    // 한가운데에서 연기 덩이(반지름 약 0.3칸) 밖으로 옆으로 튀어 있고, 높이는 처치 보상 표찰을 올린 높이보다 낮다.
    const mid = introFrame(split, INTRO_MS / 2, false)!;
    expect(mid.sway).toBeGreaterThanOrEqual(0.35);
    expect(mid.lift).toBeGreaterThan(0);
    expect(mid.lift).toBeLessThan(SPLIT_LABEL_RAISE_CELLS);
    expect(introFrame(split, INTRO_MS, false)).toBeNull();
    expect(introFrame(split, INTRO_MS / 2, true)).toEqual({ t: 1, lift: 0, sway: 0, alpha: 0.5, scale: 1 });
  });
});

describe('비행 적', () => {
  it('떠 있으면 몸을 0.25칸 띄우고, 끌어내려진 동안은 땅에 둔다', () => {
    expect(flyerLift({ flying: true, groundedUntilTick: 0 }, 10)).toBe(FLYER_LIFT_CELLS);
    expect(flyerLift({ flying: true, groundedUntilTick: 20 }, 10)).toBe(0);
    expect(flyerLift({ flying: false, groundedUntilTick: 0 }, 10)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { towerStats } from '../../src/domain/towers';
import type { Enemy, RunState } from '../../src/domain/types';
import { enemyMaxHp } from '../../src/domain/waves';
import { finishPrep, newRun, ok, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// 비행·분열·대공(monsters.md §0-1, towers.md §4-1). 정원 맵 (8,2) 칸 둘레: 1행 길의 진행도 p 적은 (p+500, 1500)에 있다.
const slotAt = (ctx: GameContext, x: number, y: number) => ctx.map.slots.find(s => s.x === x && s.y === y)!.id;

function arena(towers: Array<[TowerId, number, number]>, ctxOverride?: (ctx: GameContext) => GameContext) {
  const run = newRun('Normal', 7);
  const ctx = ctxOverride ? ctxOverride(run.ctx) : run.ctx;
  const s = run.s;
  finishPrep(ctx, s);
  s.config.availableTowers = [...TOWER_IDS];
  s.owned = [...TOWER_IDS];
  s.gold = 100000;
  for (const [type, x, y] of towers) ok(ctx, s, { type: 'build', slotId: slotAt(ctx, x, y), tower: type });
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  for (const t of s.towers) if (t.nextAttackTick !== null) t.nextAttackTick = s.tick + 1;
  return { ctx, s };
}

/** 움직이지 않게 기절시켜 위치를 고정한다. */
function place(s: RunState, list: Array<Partial<Enemy> & { progress: number }>) {
  s.enemies = list.map((o, i) => enemy({ id: 100 + i, hp: 200000, maxHp: 200000, stunUntilTick: 10_000_000, ...o }));
}
const flyer = (progress: number, o: Partial<Enemy> = {}) => ({ progress, kind: 'flyer' as const, flying: true, ...o });
const hits = (ev: DomainEvent[]) => ev.flatMap(e => (e.type === 'hit' ? [[e.enemyId, e.damage]] : []));
const run = (ctx: GameContext, s: RunState, n: number) => ticks(ctx, s, n);

describe('대공(towers.md §4-1)', () => {
  it('타워마다 대공 여부가 있다(towers.md §1: 대공 11종, 지상 전용 8종, 깃발은 공격 없음)', () => {
    const air = TOWER_IDS.filter(t => t !== 'banner' && towerStats(BALANCE, t, 1, 'base').canHitFlyer);
    expect(air.sort()).toEqual(['archer', 'ballista', 'bell', 'crossbow', 'falcon', 'frost', 'hwacha', 'lightning', 'mage', 'sling', 'wind']);
    expect(TOWER_IDS.filter(t => t !== 'banner' && !air.includes(t)).sort()).toEqual(['alchemist', 'cannon', 'flame', 'guardian', 'mortar', 'roller', 'spear', 'trap']);
    // 2차 진화에서 대공을 연다: 화염 A2 용오름 불기둥·수호기사 B1 황금 검풍.
    expect(towerStats(BALANCE, 'flame', 7, 'A2').canHitFlyer).toBe(true);
    expect(towerStats(BALANCE, 'guardian', 7, 'B1').canHitFlyer).toBe(true);
    expect(towerStats(BALANCE, 'flame', 7, 'A1').canHitFlyer).toBe(false);
  });

  it('지상 전용 포탑은 떠 있는 비행 적만 있으면 쏘지 않고, 뒤의 지상 적을 노리며 착탄 범위에서도 비행 적을 뺀다', () => {
    const alone = arena([['cannon', 8, 2]]);
    place(alone.s, [flyer(8000)]);
    expect(run(alone.ctx, alone.s, 60).filter(e => e.type === 'fire')).toHaveLength(0);

    const { ctx, s } = arena([['cannon', 8, 2]]);
    place(s, [{ progress: 7800 }, flyer(8000)]);
    const ev = run(ctx, s, 60);
    expect(hits(ev).map(h => h[0])).toEqual([100]);
  });

  it('궁수는 비행 적을 맞힌다(진행도가 높은 비행 적이 표적)', () => {
    const { ctx, s } = arena([['archer', 8, 2]]);
    place(s, [{ progress: 7800 }, flyer(8000)]);
    expect(hits(run(ctx, s, 60))[0]?.[0]).toBe(101);
  });

  it('끌어내린(grounded) 동안은 지상 전용 타워도 맞히고, 다시 떠오르면 날아가던 단일 투사체도 빗나간다', () => {
    const { ctx, s } = arena([['cannon', 8, 2]]);
    place(s, [flyer(8000, { groundedUntilTick: 10_000_000 })]);
    expect(hits(run(ctx, s, 60)).map(h => h[0])).toEqual([100]);

    const two = arena([]);
    place(two.s, [flyer(8000, { groundedUntilTick: two.s.tick + 1 })]);
    two.s.projectiles.push({ id: 999, towerId: 1, towerType: 'cannon', fromX: 0, fromY: 0, targetId: 100, toX: 0, toY: 0, firedTick: two.s.tick, arrivalTick: two.s.tick + 2, damage: 5000, damageType: 'physical', splashRadius: 0, maxTargets: 1, slowBP: 0, slowTicks: 0, physicalResistIgnoreBP: 0, bonusBP: 0, eliteBossDamageBP: 10000, canHitFlyer: false, flyerDamageBP: 10000 });
    expect(hits(run(two.ctx, two.s, 3))).toEqual([]);
  });

  it('preferFlyer는 사거리 안 비행 적을 먼저, flyerDamageBP는 비행 적에게만 곱한다', () => {
    const tuned = (ctx: GameContext): GameContext => {
      const balance = structuredClone(ctx.balance);
      balance.towers.archer.preferFlyer = true;
      balance.towers.archer.flyerDamageBP = 15000;
      return { ...ctx, balance };
    };
    const { ctx, s } = arena([['archer', 8, 2]], tuned);
    place(s, [flyer(7600), { progress: 8200 }]);
    expect(hits(run(ctx, s, 60))[0]).toEqual([100, 12000]);
    s.enemies = s.enemies.filter(e => e.id !== 100);
    s.towers[0]!.nextAttackTick = s.tick + 1;
    expect(hits(run(ctx, s, 60))[0]).toEqual([101, 8000]);
  });

  it('화염 A2는 비행 적을 태우고 기본형은 지나친다', () => {
    const base = arena([['flame', 8, 2]]);
    place(base.s, [flyer(8000)]);
    expect(hits(run(base.ctx, base.s, 3))).toEqual([]);
    const a2 = arena([['flame', 8, 2]]);
    a2.s.towers[0]!.level = 7; a2.s.towers[0]!.form = 'A2';
    place(a2.s, [flyer(8000)]);
    const dealt = hits(run(a2.ctx, a2.s, 3));
    const st = towerStats(BALANCE, 'flame', 7, 'A2');
    expect(dealt).toEqual([[100, Math.floor((st.damage * 13000) / 10000)]]);
  });
});

describe('분열(monsters.md §1.2 splitter)', () => {
  it('처치되면 ±120 milli에 파생체 2기, 같은 종족, 체력 30%, 처치 골드·PT 0, 누출 피해 1', () => {
    const { ctx, s } = arena([['archer', 8, 2]]);
    place(s, [{ progress: 8000, kind: 'splitter', faction: 'acorn_goblin', hp: 1 }]);
    const gold = s.gold;
    // 갈라진 틱에서 멈춘다(파생체는 움직이므로 그 자리를 바로 본다).
    const ev: DomainEvent[] = [];
    while (!ev.some(e => e.type === 'kill')) ev.push(...run(ctx, s, 1));
    const kill = ev.find(e => e.type === 'kill' && e.kind === 'splitter');
    expect(kill?.type === 'kill' && kill.gold).toBe(ctx.difficulty.killGold.regular);
    const kids = s.enemies.filter(e => e.kind === 'splitling');
    // 처치 지점 8000 ±120에 놓인 뒤 같은 틱 이동을 한 번 한다(진행 = 칸 수×1000×속도/기준 이동 틱).
    const step = Math.floor((ctx.path.cells * 1000 * BALANCE.enemies.splitling.speedBP * 10000) / (BALANCE.waves.baseTravelTicks * 10000 * 10000));
    expect(kids.map(e => e.progress).sort((a, b) => a - b)).toEqual([7880 + step, 8120 + step]);
    expect(kids.every(e => e.derived && e.faction === 'acorn_goblin' && !e.flying)).toBe(true);
    expect(kids[0]!.maxHp).toBe(enemyMaxHp(BALANCE, ctx.difficulty, s.battle!.hpBaseMilli, 'splitling', null));
    expect(ev.filter(e => e.type === 'spawn').map(e => e.type === 'spawn' && e.art)).toEqual(['acorn.swarm', 'acorn.swarm']);
    expect(s.gold).toBe(gold + ctx.difficulty.killGold.regular);

    for (const k of kids) { k.hp = 1; k.stunUntilTick = 10_000_000; }
    s.towers[0]!.nextAttackTick = s.tick + 1;
    const after = run(ctx, s, 200).filter(e => e.type === 'kill');
    expect(after.map(e => e.type === 'kill' && [e.kind, e.gold, e.pt])).toEqual([['splitling', 0, 0], ['splitling', 0, 0]]);
    expect(s.gold).toBe(gold + ctx.difficulty.killGold.regular);
  });

  it('성문 앞에서 갈라지면 파생체는 경로 안에 놓이고, 다음 이동에서 누출 피해 1씩을 준다', () => {
    const { ctx, s } = arena([['archer', 8, 2]]);
    s.towers = [];
    place(s, [{ progress: ctx.path.length - 50, kind: 'splitter', hp: 1, stunUntilTick: 0 }]);
    // 화살 대신 투사체를 직접 놓아 같은 틱에 처치한다.
    s.projectiles.push({ id: 999, towerId: 1, towerType: 'archer', fromX: 0, fromY: 0, targetId: 100, toX: 0, toY: 0, firedTick: s.tick, arrivalTick: s.tick + 1, damage: 5000, damageType: 'physical', splashRadius: 0, maxTargets: 1, slowBP: 0, slowTicks: 0, physicalResistIgnoreBP: 0, bonusBP: 0, eliteBossDamageBP: 10000, canHitFlyer: true, flyerDamageBP: 10000 });
    const gate = s.gateHp;
    const ev = run(ctx, s, 1);
    const spawned = ev.filter(e => e.type === 'spawn').length;
    expect(spawned).toBe(2);
    const leaks = [...ev, ...run(ctx, s, 5)].filter(e => e.type === 'leak');
    expect(leaks.map(e => e.type === 'leak' && e.damage)).toEqual([1, 1]);
    // 두 기가 모두 나가면 웨이브가 끝나 성문이 회복되므로 사건의 성문 값으로 본다.
    expect(leaks.map(e => e.type === 'leak' && e.gateHp)).toEqual([gate - 1, gate - 2]);
  });

  it('파생체가 남아 있으면 웨이브가 끝나지 않는다', () => {
    const { ctx, s } = arena([]);
    place(s, [{ progress: 1000, kind: 'splitling', derived: true, stunUntilTick: 0 }]);
    run(ctx, s, 3);
    expect(s.phase).toBe('BATTLE');
  });
});

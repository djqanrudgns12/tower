import { describe, expect, it } from 'vitest';
import { BOSS_RANKS, BOSS_SKILL_KINDS, type BossTier } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { DomainEvent } from '../../src/domain/events';
import { bossDef } from '../../src/domain/factions';
import type { Enemy, Projectile, RunState, SpawnEntry } from '../../src/domain/types';
import { enemyMaxHp } from '../../src/domain/waves';
import { finishPrep, newRun, ok, ticks } from './helpers';

// 대장 기믹 프리미티브 6종(docs/renewal/catalog/monsters.md §2.0)과 체력 보정(§0-4).

/** 성문을 넉넉히 두고 생성 줄의 적을 한 틱에 하나씩 낸다. */
function battle(entries: SpawnEntry[]) {
  const { ctx, s } = newRun('Normal', 11);
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

/** 다음 틱에 정확히 damage(milli-HP, 저항 전)를 주는 물리 투사체. */
function shot(s: RunState, e: Enemy, damage: number, type: 'physical' | 'magic' = 'physical') {
  const p: Projectile = {
    id: 900 + s.projectiles.length, towerId: 999, towerType: 'archer', fromX: 0, fromY: 0, targetId: e.id, toX: 0, toY: 0, firedTick: s.tick, arrivalTick: s.tick + 1,
    damage, damageType: type, splashRadius: 0, maxTargets: 1, slowBP: 0, slowTicks: 0, physicalResistIgnoreBP: 0, bonusBP: 0, eliteBossDamageBP: 10000, canHitFlyer: true, flyerDamageBP: 10000,
  };
  s.projectiles.push(p);
}
const dealt = (ev: DomainEvent[]) => ev.flatMap(e => (e.type === 'hit' ? [e.damage] : []));
const skills = (ev: DomainEvent[]) => ev.flatMap(e => (e.type === 'bossSkill' ? [e.skill] : []));
const freeze = (e: Enemy) => { e.stunUntilTick = 10_000_000; };

describe('종족 팩의 대장 정의', () => {
  it('8종족 × 4단 대장이 모두 기믹 하나를 갖고, 6종 프리미티브를 모두 쓴다. 생존형(겹방패·회복)은 체력 85%로 시작한다', () => {
    const used = new Set<string>();
    for (const [id, f] of Object.entries(BALANCE.factions)) {
      for (const rank of BOSS_RANKS) {
        const def = f.bosses?.[rank];
        expect(def, `${id} ${rank}`).toBeDefined();
        used.add(def!.skill.kind);
        const survival = def!.skill.kind === 'ward_layers' || def!.skill.kind === 'snack_mend';
        expect(def!.hpScaleBP ?? 10000, `${id} ${rank}`).toBe(survival ? 8500 : 10000);
      }
    }
    expect([...used].sort()).toEqual([...BOSS_SKILL_KINDS].sort());
  });

  it('대장 체력에 기믹 보정을 곱한다(강가 W10 겹방패 85%)', () => {
    const { ctx, s } = battle([boss('river_rafter', 2)]);
    const e = s.enemies[0]!;
    expect(e.maxHp).toBe(enemyMaxHp(BALANCE, ctx.difficulty, s.battle!.hpBaseMilli, 'boss', null, 8500));
    expect(e.boss).toMatchObject({ wardLeft: 4, mends: 0, escortStep: 0 });
    expect(bossDef(BALANCE, { kind: 'walker', faction: 'river_rafter', bossTier: null })).toBeNull();
  });
});

describe('기믹 6종', () => {
  it('방어 태세(정원 W5): 체력 50% 이하가 처음 되면 3초 동안 물리 저항 +35%, 한 번만', () => {
    const { ctx, s } = battle([boss('acorn_goblin', 1)]);
    const e = s.enemies[0]!; freeze(e);
    // 대장 체력 배율과 무관하게 네 발을 다 받아 내도록 체력을 넉넉히 둔다(맞은 양은 남은 체력을 넘지 않는다).
    e.maxHp = 1_000_000;
    e.hp = Math.floor(e.maxHp / 2) + 1000;
    shot(s, e, 2000);
    expect(skills(ticks(ctx, s, 1))).toEqual(['iron_stance']);
    expect(e.boss!.stance).toMatchObject({ physicalBP: 3500, untilTick: s.tick + 90 });
    shot(s, e, 10000);
    expect(dealt(ticks(ctx, s, 1))).toEqual([6500]);
    shot(s, e, 10000, 'magic');
    expect(dealt(ticks(ctx, s, 1))).toEqual([10000]);
    ticks(ctx, s, 90);
    shot(s, e, 10000);
    const after = ticks(ctx, s, 1);
    expect(dealt(after)).toEqual([10000]);
    expect(skills(after)).toEqual([]);
  });

  it('박차 행진(정원 W10): 4초 주기의 마지막 1.2초 동안 속도 115%로 달린다', () => {
    const { ctx, s } = battle([boss('acorn_goblin', 2)]);
    const e = s.enemies[0]!;
    const born = e.boss!.bornTick;
    const steps: number[] = [];
    for (let i = 0; i < 120; i++) { const p = e.progress; ticks(ctx, s, 1); steps.push(e.progress - p); }
    // 등장 뒤 1틱째부터 잰다: 주기 안 84틱(=120−36)부터 돌진.
    const fast = steps.map((d, i) => ({ d, phase: (born + 1 + i - born) % 120 }));
    const slowAvg = fast.filter(x => x.phase < 84).reduce((a, x) => a + x.d, 0) / fast.filter(x => x.phase < 84).length;
    const dashAvg = fast.filter(x => x.phase >= 84).reduce((a, x) => a + x.d, 0) / fast.filter(x => x.phase >= 84).length;
    expect(dashAvg / slowAvg).toBeCloseTo(11500 / BALANCE.enemies.boss.speedBP, 1);
  });

  it('진군 북소리(정원 W20): 1.8칸 안 일반 적 속도 +18%, 밖은 그대로, 대장 자신은 아니다', () => {
    const { ctx, s } = battle([boss('acorn_goblin', 4), { kind: 'walker', elite: null }, { kind: 'walker', elite: null }]);
    const [b, near, far] = s.enemies as [Enemy, Enemy, Enemy];
    freeze(b);
    // 가까운 적은 대장 뒤 0.4칸에서 출발해 20틱 동안(약 1.3칸) 반경 1.8칸 안에 머문다.
    b.progress = 8000; near.progress = 7600; far.progress = 3000;
    const p0 = [near.progress, far.progress];
    ticks(ctx, s, 20);
    const moved = [near.progress - p0[0]!, far.progress - p0[1]!];
    expect(moved[0]! / moved[1]!).toBeCloseTo(11800 / 10000, 1);
  });

  it('겹방패(강가 W10): 4겹 동안 한 번에 최대 체력 12%까지만 받고, 겹이 다하면 그대로 받는다', () => {
    const { ctx, s } = battle([boss('river_rafter', 2)]);
    const e = s.enemies[0]!; freeze(e);
    const cap = Math.floor((e.maxHp * 1200) / 10000);
    const big = e.maxHp; // 한 방에 끝낼 피해
    for (let i = 0; i < 4; i++) { shot(s, e, Math.floor(big / 4)); expect(dealt(ticks(ctx, s, 1))).toEqual([cap]); }
    expect(e.boss!.wardLeft).toBe(0);
    shot(s, e, 5000);
    expect(dealt(ticks(ctx, s, 1))).toEqual([5000]);
  });

  it('새참 회복(강가 W15): 3초마다 6% 회복, 기절 중이면 그 주기는 건너뛰고, 최대 4번', () => {
    const { ctx, s } = battle([boss('river_rafter', 3)]);
    const e = s.enemies[0]!;
    e.hp = Math.floor(e.maxHp / 2);
    const heal = Math.floor((e.maxHp * 600) / 10000);
    let ev = ticks(ctx, s, 90);
    expect(skills(ev)).toEqual(['snack_mend']);
    expect(e.hp).toBe(Math.floor(e.maxHp / 2) + heal);
    e.stunUntilTick = s.tick + 95; // 다음 주기 틱에 기절
    ev = ticks(ctx, s, 90);
    expect(skills(ev)).toEqual([]);
    ev = ticks(ctx, s, 90 * 6);
    expect(skills(ev)).toEqual(['snack_mend', 'snack_mend', 'snack_mend']);
    expect(e.boss!.mends).toBe(4);
  });

  it('호위 호출(강가 W20): 66%·33%를 처음 지날 때마다 같은 종족 질주 2기(파생체)를 ±0.25칸에', () => {
    const { ctx, s } = battle([boss('river_rafter', 4)]);
    const e = s.enemies[0]!; freeze(e);
    e.progress = 10000;
    shot(s, e, Math.ceil(e.maxHp * 0.4));
    const ev = ticks(ctx, s, 1);
    expect(skills(ev)).toEqual(['call_escort']);
    const escorts = s.enemies.filter(x => x.kind === 'runner');
    expect(escorts.map(x => [x.faction, x.derived])).toEqual([['river_rafter', true], ['river_rafter', true]]);
    expect(ev.filter(x => x.type === 'spawn').map(x => x.type === 'spawn' && x.art)).toEqual(['river.runner', 'river.runner']);
    shot(s, e, 1000);
    expect(skills(ticks(ctx, s, 1))).toEqual([]);
    shot(s, e, Math.ceil(e.maxHp * 0.3));
    expect(skills(ticks(ctx, s, 1))).toEqual(['call_escort']);
    expect(s.enemies.filter(x => x.kind === 'runner')).toHaveLength(4);
  });
});

describe('웨이브의 대장', () => {
  it('정원 W5~W20 대장은 기믹이 다르고, 침입 대장(W25 꿀벌레 2단 겹방패)도 같은 방식으로 돈다', () => {
    const kinds = ([1, 2, 3, 4] as const).map(t => bossDef(BALANCE, { kind: 'boss', faction: 'acorn_goblin', bossTier: t })!.skill.kind);
    expect(kinds).toEqual(['iron_stance', 'burst_march', 'call_escort', 'rally_haste']);
    expect(bossDef(BALANCE, { kind: 'boss', faction: 'honey_beetle', bossTier: 2 })!.skill.kind).toBe('ward_layers');
  });
});

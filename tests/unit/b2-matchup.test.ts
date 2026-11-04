import { describe, expect, it } from 'vitest';
import { FOE_TAGS, TOWER_IDS } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { Enemy, Projectile, SpawnEntry } from '../../src/domain/types';
import { attacks, countersOf, foeTags, matchupBP, matchupOf } from '../../src/domain/towers';
import { finishPrep, newRun, ok, ticks } from './helpers';

// R4 B2 상성(prd-r4 §7.2 D): 타워·형태의 strongVs·weakVs가 화면 아이콘과 피해 배율을 함께 정한다.

describe('상성 표(strongVs·weakVs)', () => {
  it('궁수(기준)·깃발(공격 없음)을 뺀 모든 공격 타워는 기본형에 잘 잡는 적·약한 적이 하나 이상이고 서로 겹치지 않는다', () => {
    for (const t of TOWER_IDS) {
      const { strongVs, weakVs } = matchupOf(BALANCE, t, 'base');
      for (const tag of [...strongVs, ...weakVs]) expect(FOE_TAGS).toContain(tag);
      expect(strongVs.filter(x => weakVs.includes(x)), t).toEqual([]);
      if (t === 'archer' || !attacks(BALANCE, t)) { expect([strongVs, weakVs], t).toEqual([[], []]); continue; }
      expect(strongVs.length, t).toBeGreaterThan(0);
      expect(weakVs.length, t).toBeGreaterThan(0);
    }
  });

  it('대공이 안 되는 타워는 형태가 대공을 주지 않는 한 약한 적에 비행을 적는다(화면 경고와 같은 뜻)', () => {
    for (const t of TOWER_IDS) {
      if (!attacks(BALANCE, t) || BALANCE.towers[t].canHitFlyer !== false) continue;
      expect(matchupOf(BALANCE, t, 'base').weakVs, t).toContain('flyer');
    }
  });

  it('PRD 표의 핵심 줄: 석궁은 떼·빠름에 약하고, 창병·매사냥은 빠름에 강하고, 화차는 흙 보호막(B3)에 강하다', () => {
    expect(matchupOf(BALANCE, 'crossbow', 'base')).toEqual({ strongVs: ['shell', 'boss', 'elite'], weakVs: ['swarm', 'runner'] });
    expect(matchupOf(BALANCE, 'spear', 'base').strongVs).toContain('runner');
    expect(matchupOf(BALANCE, 'falcon', 'base').strongVs).toEqual(['flyer', 'runner']);
    expect(matchupOf(BALANCE, 'hwacha', 'base').strongVs).toContain('clay');
    // 형태가 상성을 바꾼다: 화차 A2(하늘 쏘기)는 비행에도 강하고, 2차형은 1차형 값을 물려받는다.
    expect(matchupOf(BALANCE, 'hwacha', 'A2').strongVs).toEqual(['clay', 'flyer']);
    expect(matchupOf(BALANCE, 'spear', 'B1').strongVs).toEqual(matchupOf(BALANCE, 'spear', 'B').strongVs);
  });

  it('적의 표지: 역할, 분열 조각은 분열, 정예면 elite', () => {
    expect(foeTags({ kind: 'runner', elite: null })).toEqual(['runner']);
    expect(foeTags({ kind: 'splitling', elite: null })).toEqual(['splitter']);
    expect(foeTags({ kind: 'brute', elite: 'armored' })).toEqual(['brute', 'elite']);
    expect(foeTags({ kind: 'boss', elite: null })).toEqual(['boss']);
  });

  it('배율: 강점 ×1.3, 약점 ×0.7, 표지마다 한 번씩(내림)', () => {
    expect(BALANCE.matchup).toEqual({ strongBP: 13000, weakBP: 7000 });
    expect(matchupBP(BALANCE, 'crossbow', 'base', { kind: 'shell', elite: null })).toBe(13000);
    expect(matchupBP(BALANCE, 'crossbow', 'base', { kind: 'swarm', elite: null })).toBe(7000);
    expect(matchupBP(BALANCE, 'crossbow', 'base', { kind: 'runner', elite: 'swift' })).toBe(9100);
    expect(matchupBP(BALANCE, 'crossbow', 'base', { kind: 'shell', elite: 'armored' })).toBe(16900);
    expect(matchupBP(BALANCE, 'archer', 'base', { kind: 'flyer', elite: null })).toBe(10000);
    expect(matchupBP({ ...BALANCE, matchup: undefined }, 'crossbow', 'base', { kind: 'shell', elite: null })).toBe(10000);
  });

  it('대응 보장은 기본형 strongVs를 읽는다', () => {
    expect(countersOf(BALANCE, 'runner')).toEqual(['frost', 'spear', 'falcon', 'trap']);
    // B3: 흙 보호막은 화차(막 깎기)·투석·노포(강타), 땅굴은 덫·약병·박격포(바닥 공격)가 잘 잡는다(prd-r4 §7.2 E).
    expect(countersOf(BALANCE, 'clay')).toEqual(['sling', 'ballista', 'hwacha']);
    expect(countersOf(BALANCE, 'burrow')).toEqual(['mortar', 'alchemist', 'trap']);
  });
});

describe('전투에서 상성 배율', () => {
  /** 성문을 넉넉히 두고 생성 줄의 적을 한 틱에 하나씩 낸다. */
  function battle(entries: SpawnEntry[]) {
    const { ctx, s } = newRun('Normal', 21);
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.gateHp = s.gateMaxHp = 1000;
    s.battle!.spawnList = entries;
    s.battle!.spawnIndex = 0;
    s.battle!.nextSpawnTick = s.tick + 1;
    s.battle!.intervalTicks = 1;
    s.battle!.hpBaseMilli = 1_000_000;
    ticks(ctx, s, entries.length);
    for (const e of s.enemies) e.stunUntilTick = 10_000_000;
    return { ctx, s };
  }
  const shot = (s: ReturnType<typeof battle>['s'], e: Enemy, towerType: Projectile['towerType'], towerForm: Projectile['towerForm']): void => {
    s.projectiles.push({
      id: 900 + s.projectiles.length, towerId: 999, towerType, ...(towerForm ? { towerForm } : {}), fromX: 0, fromY: 0, targetId: e.id, toX: 0, toY: 0, firedTick: s.tick, arrivalTick: s.tick + 1,
      damage: 10000, damageType: 'physical', splashRadius: 0, maxTargets: 1, slowBP: 0, slowTicks: 0, physicalResistIgnoreBP: 0, bonusBP: 0, eliteBossDamageBP: 10000, canHitFlyer: true, flyerDamageBP: 10000,
    });
  };
  it('창병의 같은 타격이 빠른 적 13, 보병 10, 대장 7(HP)이고, 쏜 순간 형태(B: 껍질에도 강함)를 따른다', () => {
    const { ctx, s } = battle([{ kind: 'runner', elite: null }, { kind: 'walker', elite: null }, { kind: 'boss', elite: null }, { kind: 'shell', elite: null }, { kind: 'shell', elite: null }]);
    const [runner, walker, boss, shellA, shellB] = s.enemies as [Enemy, Enemy, Enemy, Enemy, Enemy];
    shot(s, runner, 'spear', 'base'); shot(s, walker, 'spear', 'base'); shot(s, boss, 'spear', undefined);
    shot(s, shellA, 'spear', 'base'); shot(s, shellB, 'spear', 'B');
    const hits = new Map(ticks(ctx, s, 1).flatMap(e => (e.type === 'hit' ? [[e.enemyId, e.damage] as const] : [])));
    expect([hits.get(runner.id), hits.get(walker.id), hits.get(boss.id)]).toEqual([13000, 10000, 7000]);
    // 껍질은 물리 35% 감소: 기본형 10000 → 6500, B형(강점) 13000 → 8450.
    expect([hits.get(shellA.id), hits.get(shellB.id)]).toEqual([6500, 8450]);
  });
});

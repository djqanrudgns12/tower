import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type TowerId } from '../../src/contracts/balance';
import type { GameContext } from '../../src/domain/context';
import { chainDamage, effectiveResistBP, mitigated } from '../../src/domain/combat';
import type { DomainEvent } from '../../src/domain/events';
import { applyCommand } from '../../src/domain/run';
import { auraDamageBonusBP } from '../../src/domain/towers';
import type { Enemy, RunState } from '../../src/domain/types';
import { finishPrep, newRun, ok, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// P2 공격 프로필(PRD §7.1, §20.2~20.3). 정원 맵에서 (8,2) 칸 둘레에 적을 정확히 놓고 판정을 확인한다.
// 1행 길은 x=0.5칸부터 오른쪽으로 가므로 진행도 p(milli)인 적의 위치는 (p+500, 1500)이다.
const slotAt = (ctx: GameContext, x: number, y: number) => ctx.map.slots.find(s => s.x === x && s.y === y)!.id;

function arena(towers: Array<[TowerId, number, number]>) {
  const { ctx, s } = newRun('Normal', 7);
  finishPrep(ctx, s);
  s.config.availableTowers = [...TOWER_IDS];
  s.gold = 100000;
  for (const [type, x, y] of towers) ok(ctx, s, { type: 'build', slotId: slotAt(ctx, x, y), tower: type });
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  // 전투 문항은 판정과 무관하므로 그대로 두고, 모든 타워가 바로 쏘게 한다.
  for (const t of s.towers) if (t.nextAttackTick !== null) t.nextAttackTick = s.tick + 1;
  return { ctx, s };
}

/** 진행도 순서대로 적을 놓는다. 움직이지 않게 기절시켜 위치를 고정한다. */
function place(s: RunState, list: Array<Partial<Enemy> & { progress: number }>) {
  s.enemies = list.map((o, i) => enemy({ id: 100 + i, hp: 200000, maxHp: 200000, stunUntilTick: 10_000_000, ...o }));
}

const hits = (ev: DomainEvent[]) => ev.flatMap(e => (e.type === 'hit' ? [[e.enemyId, e.damage]] : []));

describe('번개 연쇄(PRD §20.3)', () => {
  it('첫 표적 뒤 직전 대상 반경 1.8칸 안의 가장 가까운 적으로 이어 가고, 피해는 최초 기준에 0.7의 거듭제곱이다', () => {
    const { ctx, s } = arena([['lightning', 8, 2]]);
    // 진행도 9500(x=10.0칸)이 첫 표적. 거기서 8000(1.5칸) → 7000(1.0칸)으로 잇는다.
    place(s, [{ progress: 7000 }, { progress: 8000 }, { progress: 9500 }]);
    const ev = ticks(ctx, s, 1);
    const strike = ev.find(e => e.type === 'strike');
    expect(strike?.type === 'strike' && strike.targets.map(t => t.enemyId)).toEqual([102, 101, 100]);
    expect(hits(ev)).toEqual([[102, 12000], [101, 8400], [100, 5880]]);
  });

  it('반경 안에 아직 맞지 않은 적이 없으면 거기서 끝나고, 같은 적을 두 번 맞히지 않는다', () => {
    const { ctx, s } = arena([['lightning', 8, 2]]);
    place(s, [{ progress: 8000 }, { progress: 9500 }]);
    expect(hits(ticks(ctx, s, 1)).map(h => h[0])).toEqual([101, 100]);
    expect(chainDamage(12000, 7000, 4)).toBe(Math.floor(12000 * 0.7 ** 4));
  });
});

describe('화염 부채꼴과 화상(PRD §20.2~20.3)', () => {
  it('기본 표적 방향 총각 90도: 경계(45도)는 포함하고 그 밖은 제외하며, 진행도 내림차순으로 고른다', () => {
    const { ctx, s } = arena([['flame', 8, 2]]);
    // 타워 (8.5, 2.5)칸, 표적 (9.5, 1.5)칸. (8.5, 1.5)는 정확히 45도 경계, (7.5, 1.5)는 축과 90도.
    place(s, [{ progress: 7000 }, { progress: 8000 }, { progress: 9000 }]);
    expect(hits(ticks(ctx, s, 1))).toEqual([[102, 8000], [101, 8000]]);
  });

  it('표적 반대쪽(dot < 0)의 적은 사거리 안이어도 맞지 않는다', () => {
    const { ctx, s } = arena([['flame', 8, 2]]);
    // 3행 (8.5, 3.5)칸이 진행도가 가장 높은 표적이고, 1행 (8.5, 1.5)칸은 정반대쪽이다.
    place(s, [{ progress: 8000 }, { progress: 12000 + 2000 + 4000 }]);
    expect(hits(ticks(ctx, s, 1))).toEqual([[101, 8000]]);
  });

  it('화상은 적용 틱에는 피해가 없고 15틱마다 총피해를 4등분해 4번 지급한 뒤 끝난다', () => {
    const { ctx, s } = arena([['flame', 8, 2]]);
    place(s, [{ progress: 8000 }]);
    const applied = s.tick + 1;
    ticks(ctx, s, 1);
    s.towers[0]!.nextAttackTick = 10_000_000;
    const burns: Array<[number, number]> = [];
    for (let i = 0; i < 80; i++) for (const e of ticks(ctx, s, 1)) if (e.type === 'burn') burns.push([s.tick - applied, e.damage]);
    expect(burns).toEqual([[15, 1000], [30, 1000], [45, 1000], [60, 1000]]);
    expect(s.enemies[0]!.burnNextTick).toBeNull();
  });

  it('재적중은 다음 피해 시각을 미루지 않고, 여러 출처 가운데 가장 강한 화상 하나만 준다', () => {
    const { ctx, s } = arena([['flame', 8, 2], ['flame', 8, 0]]);
    s.towers[1]!.level = 3; // 레벨 배율 1.7 → 화상 총피해 6800
    place(s, [{ progress: 8000 }]);
    s.towers[1]!.nextAttackTick = 10_000_000;
    const applied = s.tick + 1;
    ticks(ctx, s, 1);
    s.towers[0]!.nextAttackTick = s.tick + 10; // 10틱 뒤 약한 출처가 다시 맞힌다
    s.towers[1]!.nextAttackTick = s.tick + 5; // 5틱 뒤 강한 출처가 맞힌다
    const burns: Array<[number, number]> = [];
    for (let i = 0; i < 20; i++) for (const e of ticks(ctx, s, 1)) if (e.type === 'burn') burns.push([s.tick - applied, e.damage]);
    expect(burns[0]).toEqual([15, 1700]);
  });
});

describe('물리 저항 무시·근접·수호기사·깃발(PRD §7.1, §20.2)', () => {
  it('석궁은 껍질형의 물리 저항 35%를 절반만 받는다(마법 저항에는 쓰지 않는다)', () => {
    const shell = { physicalResistBP: 3500, magicResistBP: 3500 };
    expect(effectiveResistBP(shell, 'physical', 5000)).toBe(1750);
    expect(effectiveResistBP(shell, 'magic', 5000)).toBe(3500);
    expect(mitigated(24000, effectiveResistBP(shell, 'physical', 5000))).toBe(19800);
  });

  it('수호기사는 전장에 동시에 한 기만 둘 수 있다', () => {
    const { ctx, s } = arena([['guardian', 8, 2]]);
    s.phase = 'BUILD';
    expect(applyCommand(ctx, s, { type: 'build', slotId: slotAt(ctx, 8, 0), tower: 'guardian' })).toEqual({ ok: false, error: 'TOWER_LIMIT' });
  });

  it('즉발 공격에 처치된 적은 같은 틱 다음 타워의 후보에서 빠진다', () => {
    const { ctx, s } = arena([['spear', 8, 2], ['spear', 8, 0]]);
    place(s, [{ progress: 7800, hp: 1000 }, { progress: 8000, hp: 1000 }]);
    const ev = ticks(ctx, s, 1);
    expect(ev.filter(e => e.type === 'kill').map(e => e.type === 'kill' && e.enemyId).sort()).toEqual([100, 101]);
  });

  it('깃발은 2.0칸 안(경계 포함) 공격 타워의 직접 피해를 올리고, 여러 깃발은 최고값만, 깃발끼리는 받지 않는다', () => {
    const near = arena([['archer', 8, 2], ['banner', 8, 0]]);
    expect(near.s.towers.find(t => t.type === 'banner')!.nextAttackTick).toBeNull();
    place(near.s, [{ progress: 8000 }]);
    ticks(near.ctx, near.s, 1);
    expect(near.s.projectiles[0]!.damage).toBe(8800);

    const far = arena([['archer', 8, 2], ['banner', 10, 4]]);
    place(far.s, [{ progress: 8000 }]);
    ticks(far.ctx, far.s, 1);
    expect(far.s.projectiles[0]!.damage).toBe(8000);

    // (0,2) 칸은 (0,0)·(0,4) 두 깃발 자리와 정확히 2칸 떨어져 있다. Lv1 10%와 Lv2 12% 가운데 12%만 준다.
    const two = arena([['archer', 0, 2], ['banner', 0, 0], ['banner', 0, 4]]);
    two.s.towers.find(t => t.slotId === slotAt(two.ctx, 0, 4))!.level = 2;
    place(two.s, [{ progress: 1000 }]);
    ticks(two.ctx, two.s, 1);
    expect(two.s.projectiles[0]!.damage).toBe(8960);
    const banner = two.s.towers.find(t => t.type === 'banner')!;
    expect(auraDamageBonusBP(two.ctx.balance, two.s.towers, banner)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type TowerId } from '../../src/contracts/balance';
import type { GameContext } from '../../src/domain/context';
import { positionAt } from '../../src/domain/geometry';
import type { FieldHazard, RunState } from '../../src/domain/types';
import {
  hazardEndCue, hazardLook, ROLLER_FADE_MS, rollerHeading, TRAP_CLOSE_MS, TRAP_CLOSE_SCALE, TRAP_DIAMETER_CELLS, trapCloseCue, ZONE_FADE_MS, ZONE_FLATTEN,
} from '../../src/game/layers/cues';
import { finishPrep, newRun, ok, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// 장판·덫·굴림체 표시 고르기(src/game/layers/cues.ts hazardLook 등): 실제 엔진이 만든 상태로 무엇을 그릴지 고른다.
// 정원 맵: 1행 길은 진행도 p 적이 (p+500, 1500). (8,2) 칸에서 길이 닿는다(field-hazards.test.ts와 같은 배치).
const slotAt = (ctx: GameContext, x: number, y: number) => ctx.map.slots.find(s => s.x === x && s.y === y)!.id;

function arena(type: TowerId, progresses: number[]) {
  const { ctx, s } = newRun('Normal', 7);
  finishPrep(ctx, s);
  s.config.availableTowers = [...TOWER_IDS];
  s.owned = [...TOWER_IDS];
  s.gold = 1_000_000;
  ok(ctx, s, { type: 'build', slotId: slotAt(ctx, 8, 2), tower: type });
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  s.towers[0]!.nextAttackTick = s.tick + 1;
  s.enemies = progresses.map((progress, i) => enemy({ id: 100 + i, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress }));
  return { ctx, s };
}
const firstHazard = (s: RunState, kind: FieldHazard['kind']) => s.hazards.find(h => h.kind === kind)!;

describe('장판·덫·굴림체 표시 고르기', () => {
  it('상태에 장판·덫·굴림체가 없으면 그릴 것이 없다', () => {
    const { s } = arena('alchemist', [8800]);
    expect(s.hazards).toEqual([]);
    expect(s.hazards.map(h => hazardLook(h))).toEqual([]);
  });

  it('약병 장판: 규칙 반경(0.75칸)의 타원이고, 세로는 ZONE_FLATTEN만큼 눌린다', () => {
    const { ctx, s } = arena('alchemist', [8800]);
    // 약병은 날아가 착탄해야 장판이 된다.
    for (let i = 0; i < 80 && s.hazards.length === 0; i++) ticks(ctx, s, 1);
    const zone = firstHazard(s, 'zone');
    expect(hazardLook(zone)).toEqual({ kind: 'zone', rx: 0.75, ry: 0.75 * ZONE_FLATTEN });
    // 한 번 터지고 사라지는 지연 폭발은 땅에 남는 것이 아니라서 그리지 않는다.
    expect(hazardLook({ ...(zone as Extract<FieldHazard, { kind: 'zone' }>), blast: true })).toBeNull();
  });

  it('덫: 지름 0.3칸 원판', () => {
    const { ctx, s } = arena('trap', []);
    ticks(ctx, s, 3);
    expect(hazardLook(firstHazard(s, 'trap'))).toEqual({ kind: 'trap', diameter: TRAP_DIAMETER_CELLS });
    expect(TRAP_DIAMETER_CELLS).toBe(0.3);
  });

  it('굴림체: 상태의 진행도에서 틱 사이 alpha만큼 입구 쪽으로 더 굴러가고, 끝점을 넘지 않으며, 길 위의 방향을 따른다', () => {
    const { ctx, s } = arena('roller', [9000, 8000]);
    ticks(ctx, s, 2);
    const roller = firstHazard(s, 'roller') as Extract<FieldHazard, { kind: 'roller' }>;
    expect(roller.stepMilli).toBe(300);
    expect(hazardLook(roller, 0)).toEqual({ kind: 'roller', progress: roller.progress });
    expect(hazardLook(roller, 0.5)).toEqual({ kind: 'roller', progress: roller.progress - 150 });
    expect(hazardLook(roller, 3)).toEqual({ kind: 'roller', progress: roller.progress - 300 });
    expect(hazardLook({ ...roller, progress: roller.endProgress + 100 }, 1)).toEqual({ kind: 'roller', progress: roller.endProgress });
    // 1행 길은 오른쪽으로 가는 길이라, 입구 쪽(진행도 감소)은 왼쪽(π)을 향한다.
    const here = positionAt(ctx.path, roller.progress);
    expect(here.y).toBe(1500);
    expect(Math.abs(rollerHeading(ctx.path, roller.progress))).toBeCloseTo(Math.PI, 6);
    expect(rollerHeading({ points: [{ x: 0, y: 0, at: 0 }] } as never, 100)).toBe(0);
  });

  it('사라지는 연출은 600ms 이하이고, 움직임 줄이기면 크기는 그대로 투명도만 바뀐다', () => {
    expect(hazardEndCue('zone', false)).toEqual({ ms: ZONE_FADE_MS, scale: 1 });
    expect(ZONE_FADE_MS).toBe(200);
    expect(hazardEndCue('trap', false)).toEqual({ ms: TRAP_CLOSE_MS, scale: TRAP_CLOSE_SCALE });
    expect(hazardEndCue('roller', false)).toEqual({ ms: ROLLER_FADE_MS, scale: 1 });
    expect(hazardEndCue('trap', true).scale).toBe(1);
    expect(trapCloseCue(false)).toEqual({ ms: 150, scale: TRAP_CLOSE_SCALE, alpha: 1 });
    expect(trapCloseCue(true).scale).toBe(1);
    expect(trapCloseCue(true).alpha).toBeLessThan(1);
    for (const ms of [ZONE_FADE_MS, TRAP_CLOSE_MS * 2, ROLLER_FADE_MS]) expect(ms).toBeLessThanOrEqual(600);
  });
});

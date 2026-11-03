import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { DomainEvent } from '../../src/domain/events';
import { towerStats } from '../../src/domain/towers';
import type { GameContext } from '../../src/domain/context';
import { positionAt } from '../../src/domain/geometry';
import type { FieldHazard, RunState } from '../../src/domain/types';
import {
  BLAST_BURST_MS, blastCharge, blastLook, formBlastRadius, fusePuffCount, hazardBlastRadius, hazardEndCue, hazardLook, ROLLER_FADE_MS, rollerHeading, TRAP_CLOSE_MS, TRAP_CLOSE_SCALE, TRAP_DIAMETER_CELLS, trapCloseCue, ZONE_FADE_MS, ZONE_FLATTEN,
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

// ── 지연 폭발(덫 B1 2차 폭죽·노포 B2 도화선) 대기 표시: 엔진이 만든 실제 사건·상태로 고른다 ──
function blastArena(type: TowerId, form: FormId, x: number, y: number) {
  const { ctx, s } = newRun('Normal', 7);
  finishPrep(ctx, s);
  s.config.availableTowers = [...TOWER_IDS];
  s.owned = [...TOWER_IDS];
  s.gold = 1_000_000;
  ok(ctx, s, { type: 'build', slotId: slotAt(ctx, x, y), tower: type });
  s.towers[0]!.level = 7; s.towers[0]!.form = form;
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  s.towers[0]!.nextAttackTick = s.tick + 1;
  return { ctx, s };
}
const eventsOf = <T extends DomainEvent['type']>(ev: DomainEvent[], type: T) => ev.filter((e): e is Extract<DomainEvent, { type: T }> => e.type === type);

describe('지연 폭발 표시 고르기', () => {
  it('노포 B2 도화선: 직선 모양(실제 폭·사거리·방향)이고, 상태 장판은 땅에 남는 그림(hazardLook)이 아니라 대기 표시로만 그린다', () => {
    const { ctx, s } = blastArena('ballista', 'B2', 8, 2);
    s.enemies = Array.from({ length: 4 }, (_, i) => enemy({ id: 100 + i, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 9500 - i * 400 }));
    let placed: Extract<DomainEvent, { type: 'hazardPlaced' }> | undefined;
    for (let i = 0; i < 6 && !placed; i++) placed = eventsOf(ticks(ctx, s, 1), 'hazardPlaced')[0];
    const h = s.hazards.find(x => x.kind === 'zone' && x.blast)!;
    expect(placed).toBeDefined();
    expect(hazardLook(h)).toBeNull();
    const st = towerStats(BALANCE, 'ballista', 7, 'B2');
    const look = blastLook(h as Extract<typeof h, { kind: 'zone' }>);
    expect(look).toEqual({ kind: 'fuse', length: st.range / 1000, width: st.lineWidth / 1000, heading: Math.atan2(-1000, 1500) });
    // 사건으로 읽어도 상태와 같은 모양이다(이어하기로 사건을 놓쳐도 상태만으로 그린다).
    expect(blastLook(placed!)).toEqual(look);
    // 찬 정도: 놓은 틱 0 → 터지는 틱(발사 18틱 뒤) 1, 틱 사이는 alpha만큼 더 간 값.
    expect(h.expiresTick! - h.createdTick).toBe(18);
    expect(blastCharge(h, h.createdTick)).toBe(0);
    expect(blastCharge(h, h.createdTick + 9)).toBeCloseTo(0.5, 9);
    expect(blastCharge(h, h.createdTick + 8, 0.5)).toBeCloseTo(8.5 / 18, 9);
    expect(blastCharge(h, h.expiresTick! + 5)).toBe(1);
    expect(blastCharge({ createdTick: 3, expiresTick: null }, 4)).toBe(1);
    // 연기 덩이는 선분 길이를 따라 3개 이상.
    expect(fusePuffCount(0.5)).toBe(3);
    expect(fusePuffCount((look as { length: number }).length)).toBeGreaterThanOrEqual(3);
  });

  it('덫 B1 2차 폭죽: 폭발 반경 0.8칸 고리이고, 밟힌 12틱 뒤 터진다', () => {
    const { ctx, s } = blastArena('trap', 'B1', 8, 2);
    s.enemies = [enemy({ id: 100, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 100 })];
    ticks(ctx, s, 1);
    s.enemies = [enemy({ id: 101, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 19900 })];
    let trig: Extract<DomainEvent, { type: 'hazardTriggered' }> | undefined;
    for (let i = 0; i < 20 && !trig; i++) trig = eventsOf(ticks(ctx, s, 1), 'hazardTriggered').find(e => e.kind === 'trap');
    expect(trig).toBeDefined();
    const h = s.hazards.find(x => x.kind === 'zone' && x.blast)!;
    expect(blastLook(h as Extract<typeof h, { kind: 'zone' }>)).toEqual({ kind: 'ring', radius: towerStats(BALANCE, 'trap', 7, 'B1').splashRadius / 1000 });
    expect(h.expiresTick! - h.createdTick).toBe(12);
    expect(blastCharge(h, s.tick)).toBe(0);
    // 터지는 틱의 hazardTriggered(blast, kind zone)가 폭발 연출 신호다.
    const burst = eventsOf(ticks(ctx, s, 12), 'hazardTriggered').find(e => e.kind === 'zone');
    expect(burst).toMatchObject({ blast: true, hazardId: h.id });
    expect(BLAST_BURST_MS).toBeLessThanOrEqual(600);
  });
});

describe('둘레 폭발 표시 고르기(통나무 B 화약 술통·덫 범위 폭발)', () => {
  it('화약 술통: 살아 있는 굴림체에서 폭발 반경(B 0.95칸·B1 1.25칸)을 읽고, 터지는 틱의 hazardTriggered(roller, blast)가 연출 신호다', () => {
    for (const [form, radius] of [['B', 0.95], ['B1', 1.25]] as const) {
      const { ctx, s } = blastArena('roller', form, 8, 2);
      s.enemies = [enemy({ id: 100, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 9000 })];
      let read: number | null = null;
      let boom: Extract<DomainEvent, { type: 'hazardTriggered' }> | undefined;
      for (let i = 0; i < 80 && !boom; i++) {
        const ev = ticks(ctx, s, 1);
        const roller = s.hazards.find(h => h.kind === 'roller');
        if (roller) read = hazardBlastRadius(roller);
        boom = eventsOf(ev, 'hazardTriggered').find(e => e.kind === 'roller' && e.blast);
      }
      expect(boom, `${form} 화약 술통이 터져야 한다`).toBeDefined();
      expect(read).toBe(radius);
      // 터진 굴림체는 같은 틱에 상태에서 사라진다(그래서 반경을 살아 있을 때 읽어 둔다).
      expect(s.hazards.some(h => h.id === boom!.hazardId)).toBe(false);
      expect(formBlastRadius(BALANCE, { type: 'roller', form }, 'roller')).toBe(radius);
    }
  });

  it('화약 술통이 아닌 통나무(A 계열)는 폭발 반경이 없고, blast 사건도 없다', () => {
    const { ctx, s } = blastArena('roller', 'A', 8, 2);
    s.enemies = [enemy({ id: 100, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 9000 })];
    const all: DomainEvent[] = [];
    for (let i = 0; i < 80; i++) {
      all.push(...ticks(ctx, s, 1));
      const roller = s.hazards.find(h => h.kind === 'roller');
      if (roller) expect(hazardBlastRadius(roller)).toBeNull();
    }
    expect(eventsOf(all, 'hazardTriggered').some(e => e.blast)).toBe(false);
    expect(formBlastRadius(BALANCE, { type: 'roller', form: 'A' }, 'roller')).toBeNull();
  });

  it('범위 덫: 폭죽 발판 B는 0.8칸 폭발이고, 밟히면 hazardTriggered(trap, blast)가 연출 신호이며 덫은 같은 틱에 사라진다', () => {
    const { ctx, s } = blastArena('trap', 'B', 8, 2);
    s.enemies = [enemy({ id: 100, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 100 })];
    ticks(ctx, s, 1);
    const trap = firstHazard(s, 'trap');
    expect(hazardBlastRadius(trap)).toBe(towerStats(BALANCE, 'trap', 7, 'B').splashRadius / 1000);
    expect(hazardBlastRadius(trap)).toBe(0.8);
    s.enemies = [enemy({ id: 101, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: (trap as Extract<FieldHazard, { kind: 'trap' }>).progress })];
    const boom = eventsOf(ticks(ctx, s, 1), 'hazardTriggered').find(e => e.kind === 'trap');
    expect(boom).toMatchObject({ blast: true, hazardId: trap.id, x: trap.x, y: trap.y });
    expect(s.hazards.some(h => h.id === trap.id)).toBe(false);
  });

  it('단일 대상 덫(A)은 폭발이 없고, 형태 규칙의 폭발 반경은 B 0.8·A2 0.75·B2 0.7칸', () => {
    const { ctx, s } = blastArena('trap', 'A', 8, 2);
    s.enemies = [enemy({ id: 100, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: 100 })];
    ticks(ctx, s, 1);
    const trap = firstHazard(s, 'trap') as Extract<FieldHazard, { kind: 'trap' }>;
    expect(hazardBlastRadius(trap)).toBeNull();
    s.enemies = [enemy({ id: 101, hp: 2_000_000, maxHp: 2_000_000, stunUntilTick: 10_000_000, progress: trap.progress })];
    const boom = eventsOf(ticks(ctx, s, 1), 'hazardTriggered').find(e => e.kind === 'trap');
    expect(boom).toMatchObject({ blast: false });
    expect((['A', 'B', 'A2', 'B2'] as FormId[]).map(form => formBlastRadius(BALANCE, { type: 'trap', form }, 'trap'))).toEqual([null, 0.8, 0.75, 0.7]);
  });
});

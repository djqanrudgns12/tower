import { describe, expect, it } from 'vitest';
import type { BossTier } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { DomainEvent } from '../../src/domain/events';
import { msToTicks } from '../../src/domain/num';
import type { Enemy, Projectile, RunState, SpawnEntry } from '../../src/domain/types';
import {
  bossCue, bossStatus, FLYER_LIFT_CELLS, flyerLift, INTRO_MS, introFrame, isPlacing, PAD_ALPHA_REST, padAlpha, spawnIntros, SPLIT_LABEL_RAISE_CELLS, TOP_FIT, topFit, WIND_SPIN, windSpinStep,
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

describe('설치 받침 밝기', () => {
  const idle = { previewType: null, slotId: null };
  it('타워를 먼저 골랐거나(자리는 아직) 끌고 있을 때만, 설치·전투 단계에서 놓을 자리를 밝힌다', () => {
    expect(isPlacing('BUILD', idle, false)).toBe(false);
    expect(isPlacing('BUILD', { previewType: 'archer', slotId: null }, false)).toBe(true);
    expect(isPlacing('BATTLE', idle, true)).toBe(true);
    // 자리를 이미 골랐으면(그 자리 옆 메뉴) 다른 자리를 모두 밝히지 않는다.
    expect(isPlacing('BUILD', { previewType: 'archer', slotId: 'garden_u-s01' }, false)).toBe(false);
    // 준비 문제 중에는 설치하지 않으므로 밝히지 않는다.
    expect(isPlacing('PREP_QUIZ', { previewType: 'archer', slotId: null }, true)).toBe(false);
  });

  it('빈 받침은 평소 흐리게(0.4), 놓는 중·선택·키보드 커서·고대비·타워가 선 자리는 밝게(1)', () => {
    const rest = { occupied: false, placing: false, focused: false, highContrast: false };
    expect(PAD_ALPHA_REST).toBe(0.4);
    expect(padAlpha(rest)).toBe(PAD_ALPHA_REST);
    for (const k of ['occupied', 'placing', 'focused', 'highContrast'] as const) expect(padAlpha({ ...rest, [k]: true })).toBe(1);
  });
});

describe('맨 윗줄 타워의 세계 위쪽 경계 맞춤', () => {
  const CELL = 64, foot = 0.82 * CELL;

  it('경계 안에 드는 타워(위쪽 줄)는 그대로다', () => {
    expect(topFit(foot + CELL, 65, CELL)).toEqual({ drop: 0, scale: 1 });
    expect(topFit(foot, foot - TOP_FIT.marginPx, CELL)).toEqual({ drop: 0, scale: 1 });
  });

  it('맨 윗줄에서 모자라면 발판을 최대 0.08칸 내리고, 남은 만큼 줄여 윗변이 경계 안에 든다', () => {
    const fit = topFit(foot, 65, CELL);
    expect(fit.drop).toBeCloseTo(TOP_FIT.dropCells * CELL, 6);
    expect(fit.scale).toBeLessThan(1);
    // 줄인 키가 (발판 − 여유)에 정확히 맞는다.
    expect(65 * fit.scale).toBeCloseTo(foot + fit.drop - TOP_FIT.marginPx, 6);
    // 조금 모자란 정도는 내리기만 하고 줄이지 않는다.
    expect(topFit(foot, foot + 3, CELL)).toEqual({ drop: 4, scale: 1 });
  });

  it('아무리 높아도 배율은 minScale 아래로 내려가지 않는다', () => {
    expect(topFit(foot, 400, CELL).scale).toBe(TOP_FIT.minScale);
  });
});

describe('바람개비탑 날개 회전', () => {
  it('평소에는 느리게(한 바퀴 20초 이상), 움직임 줄이기면 돌지 않는다', () => {
    const idle = windSpinStep(0, 1000, false);
    expect(idle).toEqual({ turn: WIND_SPIN.idle, boost: 0 });
    expect((2 * Math.PI) / idle.turn).toBeGreaterThan(20);
    expect(windSpinStep(WIND_SPIN.boost, 1000, true)).toEqual({ turn: 0, boost: 0 });
  });

  it('공격 순간 빨라졌다가 0.6초 안에 평소 속도로 돌아오고, 프레임 길이와 상관없이 같은 모양이다', () => {
    // 같은 1초를 한 번에 가든 16ms씩 가든 회전량과 남은 가속이 같다.
    const once = windSpinStep(WIND_SPIN.boost, 1000, false);
    let turn = 0, boost: number = WIND_SPIN.boost;
    for (let i = 0; i < 1000 / 8; i++) { const s = windSpinStep(boost, 8, false); turn += s.turn; boost = s.boost; }
    expect(turn).toBeCloseTo(once.turn, 9);
    expect(boost).toBeCloseTo(once.boost, 9);
    // 첫 0.1초 회전 속도는 평소의 수십 배, 0.6초 뒤에는 가속이 5% 이하로 줄어 평소 속도에 가깝다.
    expect(windSpinStep(WIND_SPIN.boost, 100, false).turn / 0.1).toBeGreaterThan(WIND_SPIN.idle * 20);
    expect(windSpinStep(WIND_SPIN.boost, 600, false).boost).toBeLessThan(WIND_SPIN.boost * 0.06);
    // 60fps 한 프레임(16ms)에 도는 각도는 45도 미만이라 헛바퀴(역회전처럼 보임)가 없다.
    expect(windSpinStep(WIND_SPIN.boost, 16, false).turn).toBeLessThan(Math.PI / 4);
  });
});

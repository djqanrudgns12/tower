import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { trapSpot } from '../../src/domain/hazards';
import { towerStats } from '../../src/domain/towers';
import type { Enemy, RunState } from '../../src/domain/types';
import { finishPrep, newRun, ok, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// 장판·덫·굴림체(towers.md §4-7 fieldHazards)와 처치 유발 판정 순서(§4-8).
// 정원 맵: 1행 길은 진행도 p 적이 (p+500, 1500), 3행 길은 진행도 p(14000~24000)가 (12500-(p-14000), 3500). (8,2) 칸 중심은 (8500, 2500).
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
const of = <T extends DomainEvent['type']>(ev: DomainEvent[], type: T) => ev.filter((e): e is Extract<DomainEvent, { type: T }> => e.type === type);

/** 틱마다 사건을 모은다: [틱, 사건 목록]. */
function record(ctx: GameContext, s: RunState, n: number): Array<[number, DomainEvent[]]> {
  const out: Array<[number, DomainEvent[]]> = [];
  for (let i = 0; i < n; i++) out.push([s.tick + 1, ticks(ctx, s, 1)]);
  return out;
}
const flat = (log: Array<[number, DomainEvent[]]>) => log.flatMap(([, ev]) => ev);

describe('장판(§4-7 zone, 약병투척소)', () => {
  it('착탄 틱부터 15틱마다 4번, 반경 0.75칸 안 지상 적을 가까운 순으로 친다. 착탄 피해는 없고 60틱 뒤 사라진다', () => {
    const { ctx, s } = arena([['alchemist', 8, 2]]);
    // 표적(진행도 최대 지상 적) 8800 → 장판 중심 (9300, 1500). 8300·8100은 0.5·0.7칸, 7900은 0.9칸(밖), 비행 적은 대공이 안 돼 빠진다.
    place(s, [{ progress: 8800 }, { progress: 8300 }, { progress: 8100 }, { progress: 7900 }, { progress: 8700, kind: 'flyer', flying: true }]);
    const log = record(ctx, s, 1);
    s.towers[0]!.nextAttackTick = null; // 한 번만 던진다.
    log.push(...record(ctx, s, 80));
    const placed = of(flat(log), 'hazardPlaced');
    expect(placed).toEqual([expect.objectContaining({ kind: 'zone', x: 9300, y: 1500, radius: 750, progress: null, blast: false })]);
    const landed = log.find(([, ev]) => ev.some(e => e.type === 'hazardPlaced'))![0];
    expect(placed[0]!.expiresTick).toBe(landed + 60);
    const pulses = log.filter(([, ev]) => hits(ev).length > 0);
    expect(pulses.map(([t]) => t - landed)).toEqual([0, 15, 30, 45]);
    for (const [, ev] of pulses) expect(hits(ev)).toEqual([[100, dmg('alchemist')], [101, dmg('alchemist')], [102, dmg('alchemist')]]);
    const gone = log.find(([, ev]) => ev.some(e => e.type === 'hazardExpired'))!;
    expect(gone[0]).toBe(landed + 60);
    expect(of(gone[1], 'hazardExpired')).toEqual([expect.objectContaining({ kind: 'zone', reason: 'time' })]);
    expect(s.hazards).toEqual([]);
  });

  it('A1 호박 설탕늪: 한 번 타격에 최대 7명, 장판 위 적만 감속 45%(21틱, 15틱마다 갱신), 3초 동안 6번 친다', () => {
    const { ctx, s } = arena([['alchemist', 8, 2, 7, 'A1']]);
    place(s, Array.from({ length: 9 }, (_, i) => ({ progress: 8800 - i * 100 })));
    ticks(ctx, s, 1);
    s.towers[0]!.nextAttackTick = null;
    const log = record(ctx, s, 1);
    while (!log.some(([, ev]) => hits(ev).length > 0)) log.push(...record(ctx, s, 1));
    // 첫 타격 직후: 가까운 7명(A1 최대 대상)만 감속 45%, 21틱(장판 간격 15틱마다 갱신).
    const slowed = s.enemies.filter(e => e.slows.some(x => x.source === s.towers[0]!.id));
    expect(slowed.map(e => e.id)).toEqual([100, 101, 102, 103, 104, 105, 106]);
    expect(slowed[0]!.slows[0]).toEqual({ source: s.towers[0]!.id, bp: 4500, untilTick: s.tick + 21 });
    log.push(...record(ctx, s, 120));
    const pulses = log.filter(([, ev]) => hits(ev).length > 0);
    expect(pulses).toHaveLength(6);
    expect(towerStats(BALANCE, 'alchemist', 7, 'A1').maxTargets).toBe(7);
    expect(pulses.every(([, ev]) => hits(ev).length === 7)).toBe(true);
  });

  it('B2 삼색 플라스크: 표적 진행도와 그 앞뒤 0.5칸에 반경 0.6칸 장판 셋', () => {
    const { ctx, s } = arena([['alchemist', 8, 2, 7, 'B2']]);
    place(s, [{ progress: 8800 }]);
    const placed = of(ticks(ctx, s, 10), 'hazardPlaced');
    expect(placed.map(p => [p.x, p.y, p.radius])).toEqual([[8800, 1500, 600], [9300, 1500, 600], [9800, 1500, 600]]);
  });

  it('B1 갑옷 녹이기: 장판 타격이 물리·마법 저항을 25%p 깎는다(30틱)', () => {
    const { ctx, s } = arena([['alchemist', 8, 2, 7, 'B1']]);
    place(s, [{ progress: 8800, magicResistBP: 3000 }]);
    const first = log1(ctx, s);
    const st = towerStats(BALANCE, 'alchemist', 7, 'B1');
    expect(first).toBe(Math.floor((st.damage * 7000) / 10000));
    // 다음 타격은 저항 30% − 25%p = 5%.
    const next = hits(ticks(ctx, s, 15))[0]![1];
    expect(next).toBe(Math.floor((st.damage * 9500) / 10000));
  });
});

/** 첫 피해가 나올 때까지 진행해 그 피해를 돌려준다. */
function log1(ctx: GameContext, s: RunState): number {
  for (let i = 0; i < 60; i++) { const h = hits(ticks(ctx, s, 1)); if (h.length) return h[0]![1]; }
  throw new Error('피해 없음');
}

describe('바닥 덫(§4-7 trap, 덫공방초소)', () => {
  it('적이 없어도 54틱마다 사거리 안 성문 쪽 빈자리에 덫을 놓고(서로 0.7칸 이상), 3개면 기다린다', () => {
    const { ctx, s } = arena([['trap', 8, 2]]);
    place(s, [{ progress: 100 }]); // 사거리 밖에서 웨이브만 붙잡는다.
    const log = record(ctx, s, 54 * 4 + 5);
    const placed = of(flat(log), 'hazardPlaced');
    // (8,2) 둘레 2칸: 1행 진행도 6268~9732, 3행 진행도 16268~19732. 성문 쪽(3행 끝)부터 0.7칸 간격.
    expect(placed.map(p => p.progress)).toEqual([19732, 19032, 18332]);
    expect(placed.map(p => p.expiresTick)).toEqual([null, null, null]);
    const at = log.filter(([, ev]) => ev.some(e => e.type === 'hazardPlaced')).map(([t]) => t);
    expect(at.slice(1).map((t, i) => t - at[i]!)).toEqual([54, 54]);
    expect(s.towers[0]!.undoUntilTick).toBeNull();
  });

  it('진행도 ±0.35칸 안의 지상 적이 밟으면 발동(피해 + 감속 35%), 덫은 사라지고 비행 적은 밟지 않는다', () => {
    const { ctx, s } = arena([['trap', 8, 2]]);
    place(s, [{ progress: 100 }]);
    ticks(ctx, s, 1);
    expect(s.hazards.map(h => h.kind === 'trap' && h.progress)).toEqual([19732]);
    place(s, [{ progress: 100 }, { progress: 19500, kind: 'flyer', flying: true }, { progress: 19300 }]);
    expect(of(ticks(ctx, s, 1), 'hazardTriggered')).toEqual([]);
    s.enemies[2]!.progress = 19400;
    const ev = ticks(ctx, s, 1);
    expect(of(ev, 'hazardTriggered')).toEqual([expect.objectContaining({ kind: 'trap', blast: false, targets: [expect.objectContaining({ enemyId: 102 })] })]);
    expect(hits(ev)).toEqual([[102, dmg('trap')]]);
    expect(s.enemies[2]!.slows).toEqual([{ source: s.towers[0]!.id, bp: 3500, untilTick: s.tick + 45 }]);
    expect(of(ev, 'hazardExpired')).toEqual([expect.objectContaining({ kind: 'trap', reason: 'spent' })]);
    expect(s.hazards).toEqual([]);
  });

  it('B1 도토리 연쇄덫: 밟은 적과 둘레 0.8칸 최대 4명, 12틱 뒤 같은 자리 80% 2차 폭죽(피해만)', () => {
    const { ctx, s } = arena([['trap', 8, 2, 7, 'B1']]);
    place(s, [{ progress: 100 }]);
    ticks(ctx, s, 1);
    place(s, [{ progress: 100 }, { progress: 19400 }, { progress: 19900 }, { progress: 19000 }, { progress: 19300 }, { progress: 19200 }, { progress: 18500 }]);
    const log = record(ctx, s, 14);
    const trig = of(flat(log), 'hazardTriggered');
    const st = towerStats(BALANCE, 'trap', 7, 'B1');
    // 밟은 적(가장 앞선 19900) 먼저, 나머지는 덫(19732) 둘레 거리순 최대 4명.
    expect(trig[0]!.targets.map(t => t.enemyId)).toEqual([102, 101, 104, 105]);
    expect(trig[0]!.blast).toBe(true);
    const first = log.find(([, ev]) => ev.some(e => e.type === 'hazardTriggered'))![0];
    const second = log.find(([t, ev]) => t > first && ev.some(e => e.type === 'hazardTriggered'))!;
    expect(second[0] - first).toBe(12);
    expect(hits(second[1]).every(([, d]) => d === Math.floor((st.damage * 8000) / 10000))).toBe(true);
    expect(of(second[1], 'hazardExpired')).toEqual([expect.objectContaining({ kind: 'zone', reason: 'spent' })]);
  });

  it('웨이브가 끝나면 덫은 타워마다 성문 쪽 2개만 넘어가고 나머지와 장판은 사라진다. 다음 웨이브에서 그대로 발동한다', () => {
    const { ctx, s } = arena([['trap', 8, 2]]);
    place(s, [{ progress: 100 }]);
    ticks(ctx, s, 54 * 2 + 2);
    expect(s.hazards.map(h => h.kind === 'trap' && h.progress)).toEqual([19732, 19032, 18332]);
    s.enemies = [];
    const ev = ticks(ctx, s, 1);
    expect(s.phase).not.toBe('BATTLE');
    expect(of(ev, 'hazardExpired')).toEqual([expect.objectContaining({ kind: 'trap', reason: 'wave' })]);
    expect(s.hazards.map(h => h.kind === 'trap' && h.progress)).toEqual([19732, 19032]);
    // 저장 스냅샷(JSON)으로 넘어가도 같은 상태다.
    expect(JSON.parse(JSON.stringify(s.hazards))).toEqual(s.hazards);
  });

  it('웨이브 끝에 남아 있던 장판·굴림체는 모두 사라지고(wave) 덫만 남는다', () => {
    const { ctx, s } = arena([['trap', 8, 2], ['alchemist', 11, 0], ['roller', 8, 0]]);
    place(s, [{ progress: 9400 }]); // 통나무(8,0)·약병(11,0) 사거리 안 한 점(9900, 1500).
    for (let i = 0; i < 40 && !(['zone', 'roller', 'trap'] as const).every(k => s.hazards.some(h => h.kind === k)); i++) ticks(ctx, s, 1);
    expect(new Set(s.hazards.map(h => h.kind))).toEqual(new Set(['zone', 'roller', 'trap']));
    s.enemies = [];
    const ev = ticks(ctx, s, 1);
    expect(s.phase).not.toBe('BATTLE');
    // 덫은 하나뿐이라(이월 상한 2 안) 그대로 넘어가고, 장판·굴림체만 웨이브 끝 사건으로 사라진다.
    expect(of(ev, 'hazardExpired').map(e => [e.kind, e.reason]).sort()).toEqual([['roller', 'wave'], ['zone', 'wave']]);
    expect(s.hazards.map(h => h.kind)).toEqual(['trap']);
  });

  it('타워를 팔면 그 타워의 덫도 사라진다', () => {
    const { ctx, s } = arena([['trap', 8, 2]]);
    place(s, [{ progress: 100 }]);
    ticks(ctx, s, 1);
    const ev = ok(ctx, s, { type: 'sell', towerId: s.towers[0]!.id });
    expect(of(ev, 'hazardExpired')).toEqual([expect.objectContaining({ kind: 'trap', reason: 'sold' })]);
    expect(s.hazards).toEqual([]);
  });

  it('덫 자리: 빈자리가 없으면 null, 구간 끝과 이미 놓인 덫 앞자리 가운데 가장 성문 쪽', () => {
    const { ctx } = newRun('Normal', 7);
    expect(trapSpot(ctx.path, 8500, 2500, 2000, [], 700)).toBe(19732);
    expect(trapSpot(ctx.path, 8500, 2500, 2000, [19732, 19032, 18332, 17632, 16932], 700)).toBe(9732);
    expect(trapSpot(ctx.path, 8500, 2500, 900, [], 700)).toBeNull();
  });
});

describe('굴림체(§4-7 roller, 통나무굴림대)', () => {
  it('첫 표적 자리에서 입구 쪽으로 틱당 0.3칸씩 2.6칸 굴러가며, 스친 지상 적을 차례로 한 번씩 친다', () => {
    const { ctx, s } = arena([['roller', 8, 2]]);
    place(s, [{ progress: 9000 }, { progress: 8000 }, { progress: 7000 }, { progress: 6000 }, { progress: 8500, kind: 'flyer', flying: true }]);
    const log = record(ctx, s, 15);
    const placed = of(flat(log), 'hazardPlaced');
    expect(placed).toEqual([expect.objectContaining({ kind: 'roller', progress: 9000, radius: 300 })]);
    const t0 = log.find(([, ev]) => ev.some(e => e.type === 'hazardPlaced'))![0];
    const got = log.flatMap(([t, ev]) => hits(ev).map(([id, d]) => [t - t0, id, d]));
    // 9000 → 8700(1틱, 8400~9300 구간) … 끝 6400(9틱). 6000은 굴림 끝 반쪽 폭(6100) 밖이다.
    expect(got).toEqual([[1, 100, dmg('roller')], [3, 101, dmg('roller')], [6, 102, dmg('roller')]]);
    const end = log.find(([, ev]) => ev.some(e => e.type === 'hazardExpired'))!;
    expect(end[0] - t0).toBe(9);
    expect(of(end[1], 'hazardExpired')).toEqual([expect.objectContaining({ kind: 'roller', reason: 'end' })]);
  });

  it('최대 5명까지 치고 멈춘다', () => {
    const { ctx, s } = arena([['roller', 8, 2]]);
    place(s, Array.from({ length: 8 }, (_, i) => ({ progress: 9000 - i * 50 })));
    const ev = ticks(ctx, s, 6);
    expect(hits(ev).map(h => h[0])).toEqual([100, 101, 102, 103, 104]);
    expect(of(ev, 'hazardExpired')).toEqual([expect.objectContaining({ reason: 'spent' })]);
  });

  it('B 화약 술통: 정예와 부딪히면 그 자리에서 바로 반경 0.95칸 최대 5명 145% 폭발, 아니면 3번째 충돌·굴림 끝에서', () => {
    const { ctx, s } = arena([['roller', 8, 2, 4, 'B']]);
    // 9000(표적) → 3틱째 8100 자리에서 8000의 정예와 부딪혀 터진다. 둘레 0.95칸: 101(0.1칸)·102(0.7칸)·100(0.9칸), 103(1.7칸)은 밖.
    place(s, [{ progress: 9000 }, { progress: 8000, elite: 'armored' }, { progress: 7400 }, { progress: 9800 }]);
    const ev = ticks(ctx, s, 6);
    const st = towerStats(BALANCE, 'roller', 4, 'B');
    const blast = of(ev, 'hazardTriggered').find(e => e.blast)!;
    expect(blast.targets.map(t => t.enemyId)).toEqual([101, 102, 100]);
    const boom = Math.floor((st.damage * 14500) / 10000);
    expect(hits(ev).slice(-3).map(h => h[0])).toEqual([101, 102, 100]);
    expect(hits(ev).filter(([id]) => id === 102)[0]![1]).toBe(boom);
    expect(of(ev, 'hazardExpired')).toEqual([expect.objectContaining({ reason: 'spent' })]);
    // 아무도 없으면 굴림 끝에서 터진다.
    const lone = arena([['roller', 8, 2, 4, 'B']]);
    place(lone.s, [{ progress: 9000 }]);
    const ev2 = ticks(lone.ctx, lone.s, 12);
    expect(of(ev2, 'hazardTriggered').filter(e => e.blast)).toHaveLength(1);
    expect(of(ev2, 'hazardExpired')).toEqual([expect.objectContaining({ reason: 'end' })]);
  });

  it('A2 쌍둥이 통나무: 15틱 뒤 65% 두 번째 통나무가 다시 굴러간다', () => {
    const { ctx, s } = arena([['roller', 8, 2, 7, 'A2']]);
    place(s, [{ progress: 9000 }]);
    const log = record(ctx, s, 20);
    const at = log.filter(([, ev]) => ev.some(e => e.type === 'hazardPlaced')).map(([t]) => t);
    expect(at[1]! - at[0]!).toBe(15);
    const second = s.hazards.find(h => h.kind === 'roller')!;
    expect(second.strike.damage).toBe(Math.floor((dmg('roller', 7, 'A2') * 6500) / 10000));
  });
});

describe('지연 폭발(노포 B2 불꽃 도화선)', () => {
  it('발사 18틱 뒤 같은 직선 궤적 위 적 최대 5명에게 피해 55% 2차 폭발(피해만)', () => {
    const { ctx, s } = arena([['ballista', 8, 2, 7, 'B2']]);
    place(s, Array.from({ length: 7 }, (_, i) => ({ progress: 9500 - i * 400 })));
    const log = record(ctx, s, 25);
    const fired = log.find(([, ev]) => ev.some(e => e.type === 'strike'))![0];
    const placed = of(flat(log), 'hazardPlaced')[0]!;
    expect(placed).toMatchObject({ kind: 'zone', blast: true, x: 8500, y: 2500, line: { dx: 1500, dy: -1000, width: 350 } });
    const blast = log.find(([, ev]) => ev.some(e => e.type === 'hazardTriggered'))!;
    expect(blast[0] - fired).toBe(18);
    const st = towerStats(BALANCE, 'ballista', 7, 'B2');
    const h = hits(blast[1]);
    expect(h.length).toBeGreaterThan(0);
    expect(h.length).toBeLessThanOrEqual(5);
    expect(h.every(([, d]) => d === Math.floor((st.damage * 5500) / 10000))).toBe(true);
  });
});

describe('처치 유발 판정 순서(§4-8): 분열 파생체 생성 → 같은 틱 처치 효과, 연쇄 깊이 1', () => {
  it('서리 B2: 감속 걸린 분열체가 쓰러지면 파생체 2기가 먼저 생기고, 같은 틱 얼음꽃 파편이 파생체까지 맞힌다', () => {
    const { ctx, s } = arena([['frost', 8, 2, 7, 'B2'], ['archer', 8, 0]]);
    const frost = s.towers.find(t => t.type === 'frost')!;
    frost.nextAttackTick = null;
    place(s, [{ progress: 8300, kind: 'splitter', hp: 1, slows: [{ source: frost.id, bp: 2000, untilTick: 10_000_000 }] }]);
    let ev: DomainEvent[] = [];
    for (let i = 0; i < 40 && !ev.some(e => e.type === 'kill'); i++) ev = ticks(ctx, s, 1);
    const order = ev.flatMap(e => (e.type === 'kill' || e.type === 'spawn' ? [`${e.type}:${e.enemyId}`] : e.type === 'strike' ? [`strike:${e.towerType}`] : []));
    const kids = of(ev, 'spawn').filter(e => e.kind === 'splitling').map(e => e.enemyId);
    expect(kids).toHaveLength(2);
    expect(order.slice(0, 4)).toEqual(['kill:100', `spawn:${kids[0]}`, `spawn:${kids[1]}`, 'strike:frost']);
    const shard = Math.floor((towerStats(BALANCE, 'frost', 7, 'B2').damage * 20000) / 10000);
    const kidHits = hits(ev).filter(([id]) => kids.includes(id));
    expect(kidHits.map(([, d]) => d).every(d => d > 0 && d <= shard)).toBe(true);
    expect(kidHits).toHaveLength(2);
  });

  it('깊이 1: 파편에 쓰러진 적은 감속이 걸려 있어도 다시 터지지 않는다', () => {
    const { ctx, s } = arena([['frost', 8, 2, 7, 'B2'], ['archer', 8, 0]]);
    const frost = s.towers.find(t => t.type === 'frost')!;
    frost.nextAttackTick = null;
    const mark = [{ source: frost.id, bp: 2000, untilTick: 10_000_000 }];
    // 100(첫 처치) → 0.3칸 옆 101(파편에 쓰러짐, 감속 걸림) → 101에서 0.7칸, 100에서 1.0칸인 102는 파편 반경(0.75칸) 밖.
    place(s, [{ progress: 8300, hp: 1, slows: mark }, { progress: 8000, hp: 1, slows: mark }, { progress: 7300, slows: mark }]);
    let ev: DomainEvent[] = [];
    for (let i = 0; i < 40 && !ev.some(e => e.type === 'kill'); i++) ev = ticks(ctx, s, 1);
    expect(of(ev, 'kill').map(e => e.enemyId)).toEqual([100, 101]);
    expect(of(ev, 'strike').filter(e => e.towerType === 'frost')).toHaveLength(1);
    expect(hits(ev).some(([id]) => id === 102)).toBe(false);
  });

  it('약병 A2 거품방울: 장판 위에서 쓰러진 분열체 둘레 0.8칸 최대 4명에게 장판 피해 180% 폭발, 방금 생긴 파생체 포함', () => {
    const { ctx, s } = arena([['alchemist', 8, 2, 7, 'A2']]);
    place(s, [{ progress: 8800, kind: 'splitter', hp: 1 }, { progress: 8300 }]);
    let ev: DomainEvent[] = [];
    for (let i = 0; i < 40 && !ev.some(e => e.type === 'kill'); i++) ev = ticks(ctx, s, 1);
    const kids = of(ev, 'spawn').filter(e => e.kind === 'splitling').map(e => e.enemyId);
    expect(kids).toHaveLength(2);
    const st = towerStats(BALANCE, 'alchemist', 7, 'A2');
    const bubble = of(ev, 'strike').find(e => e.towerType === 'alchemist')!;
    expect(bubble.targets.map(t => t.enemyId).sort()).toEqual([...kids, 101].sort());
    const kill = ev.findIndex(e => e.type === 'kill');
    expect(ev.findIndex(e => e.type === 'spawn')).toBeGreaterThan(kill);
    expect(ev.indexOf(bubble)).toBeGreaterThan(ev.findIndex(e => e.type === 'spawn' && e.enemyId === kids[1]));
    expect(hits(ev).filter(([id]) => id === 101).map(h => h[1])).toContain(Math.floor((st.damage * 18000) / 10000));
  });

  it('장판 위를 떠서 지나가던 비행 적이 다른 타워에 쓰러지면 거품방울은 터지지 않는다(바닥 장판 위가 아니다)', () => {
    const { ctx, s } = arena([['alchemist', 8, 2, 7, 'A2'], ['archer', 8, 0]]);
    const alchemist = s.towers.find(t => t.type === 'alchemist')!;
    // 지상 표적(8800)으로 장판을 깐 뒤 던지기를 멈추고, 장판 중심 옆 비행 적(8850, 가장 앞선 적)을 궁수가 쓰러뜨리게 한다.
    place(s, [{ progress: 8800 }]);
    for (let i = 0; i < 40 && s.hazards.length === 0; i++) ticks(ctx, s, 1);
    alchemist.nextAttackTick = null;
    expect(s.hazards).toEqual([expect.objectContaining({ kind: 'zone', x: 9300, y: 1500 })]);
    s.enemies.push(enemy({ id: 200, progress: 8850, hp: 1, maxHp: 2_000_000, kind: 'flyer', flying: true, stunUntilTick: 10_000_000 }));
    let ev: DomainEvent[] = [];
    for (let i = 0; i < 40 && !ev.some(e => e.type === 'kill'); i++) ev = ticks(ctx, s, 1);
    expect(of(ev, 'kill').map(e => e.enemyId)).toEqual([200]);
    expect(of(ev, 'strike').filter(e => e.towerType === 'alchemist')).toEqual([]);
  });

  it('장판 밖에서 쓰러지면 거품방울은 터지지 않는다', () => {
    const { ctx, s } = arena([['alchemist', 8, 2, 7, 'A2'], ['archer', 8, 0]]);
    s.towers.find(t => t.type === 'alchemist')!.nextAttackTick = null;
    place(s, [{ progress: 8800, hp: 1 }, { progress: 8600 }]);
    let ev: DomainEvent[] = [];
    for (let i = 0; i < 40 && !ev.some(e => e.type === 'kill'); i++) ev = ticks(ctx, s, 1);
    expect(of(ev, 'strike').filter(e => e.towerType === 'alchemist')).toEqual([]);
  });
});

describe('결정론·저장', () => {
  it('장판·덫·굴림체가 도는 중 JSON으로 저장했다 되살려도 같은 사건이 이어진다', () => {
    const towers: Array<[TowerId, number, number, number, FormId]> = [['alchemist', 8, 2, 7, 'A2'], ['trap', 8, 0, 7, 'B1'], ['roller', 10, 4, 4, 'B'], ['ballista', 2, 2, 7, 'B2']];
    const make = () => {
      const { ctx, s } = arena(towers);
      s.enemies = [];
      s.battle!.spawnList = Array.from({ length: 20 }, (_, i) => ({ kind: (['walker', 'splitter', 'flyer', 'brute'] as const)[i % 4]!, elite: i % 5 === 0 ? 'armored' as const : null }));
      s.battle!.spawnIndex = 0;
      s.battle!.intervalTicks = 10;
      return { ctx, s };
    };
    const a = make();
    ticks(a.ctx, a.s, 200);
    expect(a.s.hazards.length).toBeGreaterThan(0);
    const saved = JSON.parse(JSON.stringify(a.s)) as RunState;
    const after = (x: { ctx: GameContext; s: RunState }) => JSON.stringify(ticks(x.ctx, x.s, 400));
    const b = { ctx: a.ctx, s: saved };
    expect(after(b)).toBe(after(a));
    expect(JSON.stringify(b.s)).toBe(JSON.stringify(a.s));
  });
});

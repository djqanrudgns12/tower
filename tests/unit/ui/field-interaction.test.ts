import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../src/content';
import { applyCommand } from '../../../src/domain/run';
import { evolutionChoices, formInfo, formTier, towerForm, upgradeCommand } from '../../../src/ui/game/evolution';
import { cellRect, FULL_VIEW, snapSlot, toWorldPoint, WORLD_CELL } from '../../../src/ui/game/fieldGeometry';
import { currentCoach, type CoachMark } from '../../../src/ui/game/firstRunCoach';
import { formDeltas, SEGMENTS, statBars } from '../../../src/ui/game/statBars';
import { finishPrep, newRun, ok } from '../helpers';

const slots = [
  { id: 'a', x: 2, y: 2 },
  { id: 'b', x: 4, y: 2 },
  { id: 'c', x: 2, y: 5 },
] as const;

describe('끌어 놓기 자석(ui-rules-v2 §4)', () => {
  const center = (x: number, y: number) => ({ x: (x + 0.5) * WORLD_CELL, y: (y + 0.5) * WORLD_CELL });

  it('칸 바깥 반 칸까지는 그 자리로 붙고, 더 멀면 붙지 않는다', () => {
    const a = center(2, 2);
    expect(snapSlot(slots, new Set(), a.x + WORLD_CELL * 0.9, a.y)).toBe('a');
    expect(snapSlot(slots, new Set(), a.x, a.y - WORLD_CELL * 0.99)).toBe('a');
    expect(snapSlot(slots, new Set(), a.x - WORLD_CELL * 1.2, a.y)).toBeNull();
  });

  it('두 자리 사이에서는 가까운 빈 자리, 찬 자리는 건너뛴다', () => {
    const between = { x: (center(2, 2).x + center(4, 2).x) / 2 + 4, y: center(2, 2).y };
    expect(snapSlot(slots, new Set(), between.x, between.y)).toBe('b');
    expect(snapSlot(slots, new Set(['b']), between.x, between.y)).toBeNull();
    expect(snapSlot(slots, new Set(['b']), center(2, 2).x + WORLD_CELL * 0.6, center(2, 2).y)).toBe('a');
  });
});

describe('전장 DOM 겹층 좌표', () => {
  it('전체 보기에서 칸 크기는 상자 너비/15이고, 화면점→세계점은 역변환이다', () => {
    const r = cellRect(FULL_VIEW, 1086, 651.6, 8, 2);
    expect(r.size).toBeCloseTo(1086 / 15, 5);
    expect(r.left).toBeCloseTo(8 * (1086 / 15), 5);
    const w = toWorldPoint(FULL_VIEW, 1086, 651.6, r.left + r.size / 2, r.top + r.size / 2);
    expect(w.x).toBeCloseTo(8.5 * WORLD_CELL, 3);
    expect(w.y).toBeCloseTo(2.5 * WORLD_CELL, 3);
  });

  it('확대 보기(카메라가 일부만 보일 때)에서도 칸 위치와 크기가 카메라를 따른다', () => {
    const view = { x: 320, y: 64, width: 240, height: 144 };
    const r = cellRect(view, 374, 224.4, 6, 2);
    expect(r.size).toBeCloseTo((374 / 240) * WORLD_CELL, 3);
    expect(r.left).toBeCloseTo(((6 * WORLD_CELL - 320) * 374) / 240, 3);
  });
});

describe('진화 API 어댑터(progression.md §5)', () => {
  it('형태 단계와 현재 형태를 돌려준다', () => {
    expect([formTier('base'), formTier('A'), formTier('B2')]).toEqual([0, 1, 2]);
    expect(towerForm({ branch: null })).toBe('base');
    expect(towerForm({ branch: 'B' })).toBe('B');
  });

  it('진화 레벨 직전에만 두 형태를 고를 수 있고, 고른 형태 명령은 엔진이 받아들인다', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    const slot = ctx.map.slots[8]!.id;
    s.gold = 5000;
    ok(ctx, s, { type: 'build', slotId: slot, tower: 'archer' });
    const tower = () => s.towers[0]!;
    const before = BALANCE.levels.branchAtLevel - 1;
    while (tower().level < before - 1) ok(ctx, s, upgradeCommand(tower().id));
    expect(evolutionChoices(ctx.balance, tower())).toBeNull();
    ok(ctx, s, upgradeCommand(tower().id));
    expect(tower().level).toBe(before);
    const choices = evolutionChoices(ctx.balance, tower());
    expect(choices).toEqual(['A', 'B']);
    expect(applyCommand(ctx, s, upgradeCommand(tower().id)).ok).toBe(false);
    ok(ctx, s, upgradeCommand(tower().id, 'B'));
    expect(towerForm(tower())).toBe('B');
    expect(formInfo(ctx.balance, 'archer', 'B').label).toBe(ctx.balance.branches.archer!.B.label);
  });
});

describe('능력치 막대', () => {
  it('막대는 1~5칸이고, 강화하면 공격력 막대의 다음 칸 수가 지금 이상이다', () => {
    for (const type of ['archer', 'cannon', 'frost'] as const) {
      const bars = statBars(BALANCE, type, 1, 'base', { level: 2, form: 'base' });
      for (const bar of bars) {
        expect(bar.filled).toBeGreaterThanOrEqual(1);
        expect(bar.filled).toBeLessThanOrEqual(SEGMENTS);
      }
      const power = bars.find(b => b.key === 'power')!;
      expect(power.next!).toBeGreaterThanOrEqual(power.filled);
    }
  });

  it('진화 카드에는 바뀌는 수치를 최대 두 개만 적는다', () => {
    for (const form of ['A', 'B'] as const) {
      const lines = formDeltas(BALANCE, 'archer', 2, 'base', 3, form);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('첫 판 코치 마크', () => {
  const view = (phase: 'BUILD' | 'BATTLE', towers: number) => ({ phase, towers: Array.from({ length: towers }, (_, i) => ({ id: i, type: 'archer' as const, slotId: `s${i}`, level: 1, branch: null, invested: 60 })) });
  it('준비 단계에서 놓기 → 시작 순서로 한 번씩만 보인다', () => {
    const none = new Set<CoachMark>();
    expect(currentCoach(view('BUILD', 0), none)).toBe('place');
    expect(currentCoach(view('BUILD', 1), none)).toBe('start');
    expect(currentCoach(view('BATTLE', 1), none)).toBeNull();
    expect(currentCoach(view('BUILD', 0), new Set<CoachMark>(['place']))).toBeNull();
    expect(currentCoach(view('BUILD', 2), new Set<CoachMark>(['place', 'start']))).toBeNull();
  });
});

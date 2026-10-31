import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../src/content';
import { applyCommand } from '../../../src/domain/run';
import { evolutionChoices, formInfo, formTier, previewForm, previewMarker, towerForm, undoBuildCommand, upgradeCommand } from '../../../src/ui/game/evolution';
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
    expect(towerForm({ form: 'base' })).toBe('base');
    expect(towerForm({ form: 'B1' })).toBe('B1');
  });

  it('진화 레벨 직전에만 두 형태를 고를 수 있고, 고른 형태 명령은 엔진이 받아들인다(Lv4 A/B → Lv7 두 갈래)', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    const slot = ctx.map.slots[8]!.id;
    s.gold = 50000;
    ok(ctx, s, { type: 'build', slotId: slot, tower: 'archer' });
    const tower = () => s.towers[0]!;
    const [first, second] = BALANCE.levels.evolveAt;
    while (tower().level < first - 2) ok(ctx, s, upgradeCommand(tower().id));
    expect(evolutionChoices(ctx.balance, tower())).toBeNull();
    ok(ctx, s, upgradeCommand(tower().id));
    expect(tower().level).toBe(first - 1);
    expect(evolutionChoices(ctx.balance, tower())).toEqual(['A', 'B']);
    const missing = applyCommand(ctx, s, upgradeCommand(tower().id));
    expect(missing.ok ? null : missing.error).toBe('FORM_REQUIRED');
    const wrong = applyCommand(ctx, s, upgradeCommand(tower().id, 'A1'));
    expect(wrong.ok ? null : wrong.error).toBe('INVALID_FORM');
    ok(ctx, s, upgradeCommand(tower().id, 'B'));
    expect(towerForm(tower())).toBe('B');
    expect(formInfo(ctx.balance, 'archer', 'B').label).toBe(ctx.balance.forms.archer.B.label);
    while (tower().level < second - 1) ok(ctx, s, upgradeCommand(tower().id));
    expect(evolutionChoices(ctx.balance, tower())).toEqual(['B1', 'B2']);
    ok(ctx, s, upgradeCommand(tower().id, 'B2'));
    expect(towerForm(tower())).toBe('B2');
    expect(formTier(towerForm(tower()))).toBe(2);
  });

  it('장면 미리보기 표식은 두 선택지의 첫째·둘째이고, 형태로 되돌릴 수 있다', () => {
    const lv3 = { type: 'archer' as const, level: BALANCE.levels.evolveAt[0] - 1, form: 'base' as const };
    const lv6 = { type: 'archer' as const, level: BALANCE.levels.evolveAt[1] - 1, form: 'A' as const };
    expect([previewMarker(BALANCE, lv3, 'A'), previewMarker(BALANCE, lv3, 'B'), previewMarker(BALANCE, lv3, 'A1')]).toEqual(['A', 'B', null]);
    expect([previewMarker(BALANCE, lv6, 'A1'), previewMarker(BALANCE, lv6, 'A2')]).toEqual(['A', 'B']);
    expect([previewForm(BALANCE, lv6, 'A'), previewForm(BALANCE, lv6, 'B'), previewForm(BALANCE, lv6, null)]).toEqual(['A1', 'A2', null]);
  });

  it('설치 직후 되돌리기는 전액 환불하고, 강화한 뒤에는 거절한다(UNDO_EXPIRED)', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    s.gold = 1000;
    const gold0 = s.gold;
    ok(ctx, s, { type: 'build', slotId: ctx.map.slots[3]!.id, tower: 'archer' });
    ok(ctx, s, undoBuildCommand(s.towers[0]!.id));
    expect(s.towers).toHaveLength(0);
    expect(s.gold).toBe(gold0);
    ok(ctx, s, { type: 'build', slotId: ctx.map.slots[3]!.id, tower: 'archer' });
    ok(ctx, s, upgradeCommand(s.towers[0]!.id));
    const late = applyCommand(ctx, s, undoBuildCommand(s.towers[0]!.id));
    expect(late.ok ? null : late.error).toBe('UNDO_EXPIRED');
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
      const lv = BALANCE.levels.evolveAt[0];
      const lines = formDeltas(BALANCE, 'archer', lv - 1, 'base', lv, form);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('첫 판 코치 마크', () => {
  const view = (phase: 'BUILD' | 'BATTLE', towers: number) => ({ phase, towers: Array.from({ length: towers }, (_, i) => ({ id: i, type: 'archer' as const, slotId: `s${i}`, level: 1, form: 'base' as const, branch: null, invested: 60, undoable: false })) });
  it('준비 단계에서 놓기 → 시작 순서로 한 번씩만 보인다', () => {
    const none = new Set<CoachMark>();
    expect(currentCoach(view('BUILD', 0), none)).toBe('place');
    expect(currentCoach(view('BUILD', 1), none)).toBe('start');
    expect(currentCoach(view('BATTLE', 1), none)).toBeNull();
    expect(currentCoach(view('BUILD', 0), new Set<CoachMark>(['place']))).toBeNull();
    expect(currentCoach(view('BUILD', 2), new Set<CoachMark>(['place', 'start']))).toBeNull();
  });
});

describe('준비판 다음 웨이브 미리보기', () => {
  it('종류별 마릿수와 대장 여부가 실제 전투 편성과 같다', async () => {
    const { wavePreview } = await import('../../../src/ui/game/wavePreview');
    for (const wave of [1, 3, 5]) {
      const { ctx, s } = newRun('Normal', 777 + wave);
      finishPrep(ctx, s);
      s.wave = wave;
      ok(ctx, s, { type: 'startBattle' });
      const real = new Map<string, number>();
      for (const e of s.battle!.spawnList) real.set(e.kind, (real.get(e.kind) ?? 0) + 1);
      const preview = wavePreview(ctx.balance, wave);
      expect(preview.total).toBe(s.battle!.spawnList.length);
      expect(preview.boss).toBe(real.has('boss'));
      for (const k of preview.kinds) expect(real.get(k.kind)).toBe(k.count);
    }
  });
});

describe('버닝 표시(PRD §5)', () => {
  it('연속 정답 보석은 조건 수마다 한 바퀴 돌고 버닝 중엔 가득 찬다', async () => {
    const { streakGems } = await import('../../../src/ui/game/Hud');
    const rule = { streak: BALANCE.burning.streak };
    expect(streakGems({ burningSecondsLeft: 0, battleStreak: 0 }, rule)).toEqual({ burning: false, lit: 0 });
    expect(streakGems({ burningSecondsLeft: 0, battleStreak: rule.streak - 1 }, rule).lit).toBe(rule.streak - 1);
    expect(streakGems({ burningSecondsLeft: 0, battleStreak: rule.streak + 1 }, rule).lit).toBe(1);
    expect(streakGems({ burningSecondsLeft: 5, battleStreak: rule.streak }, rule)).toEqual({ burning: true, lit: rule.streak });
  });
});

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../src/content';
import { applyCommand } from '../../../src/domain/run';
import { evolutionChoices, formBodyUrl, formInfo, formTier, previewForm, previewMarker, towerForm, undoBuildCommand, upgradeCommand } from '../../../src/ui/game/evolution';
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

describe('진화 카드 형태 그림', () => {
  const only = (ids: string[]) => (id: string) => (ids.includes(id) ? `/${id}.png` : undefined);

  it('형태 본체 → 부모 형태 순으로 고르고, 없거나 기본형이면 undefined(기본형 초상화)', () => {
    expect(formBodyUrl('archer', 'A', only(['tower.archer.A', 'tower.archer.B']))).toBe('/tower.archer.A.png');
    expect(formBodyUrl('archer', 'B', only(['tower.archer.A', 'tower.archer.B']))).toBe('/tower.archer.B.png');
    expect(formBodyUrl('archer', 'B2', only(['tower.archer.B2', 'tower.archer.B']))).toBe('/tower.archer.B2.png');
    expect(formBodyUrl('archer', 'B2', only(['tower.archer.B']))).toBe('/tower.archer.B.png');
    expect(formBodyUrl('archer', 'A', only([]))).toBeUndefined();
    expect(formBodyUrl('archer', 'base', only(['tower.archer']))).toBeUndefined();
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
      const preview = wavePreview(ctx.balance, ctx.map.id, wave);
      expect(preview.total).toBe(s.battle!.spawnList.length);
      expect(preview.boss).toBe(real.has('boss'));
      for (const k of preview.kinds) expect(real.get(k.kind)).toBe(k.count);
    }
  });

  it('그림 종족은 실제 편성에서 그 역할이 가장 많은 종족이고, 대장은 실제 대장의 종족·단계다', async () => {
    const { wavePreview } = await import('../../../src/ui/game/wavePreview');
    // 20웨이브 안은 주력 종족뿐이고, 61웨이브는 침입 종족이 섞인다(대장 웨이브 5의 배수: 5, 10, 20).
    for (const wave of [1, 5, 10, 20, 23, 61]) {
      const { ctx, s } = newRun('Normal', 4000 + wave);
      finishPrep(ctx, s);
      s.wave = wave;
      ok(ctx, s, { type: 'startBattle' });
      const preview = wavePreview(ctx.balance, ctx.map.id, wave);
      for (const k of preview.kinds) {
        const byFaction = new Map<string, number>();
        for (const e of s.battle!.spawnList) if (e.kind === k.kind) byFaction.set(e.faction!, (byFaction.get(e.faction!) ?? 0) + 1);
        expect(byFaction.get(k.faction)).toBe(Math.max(...byFaction.values()));
        expect(k.bossTier).toBeNull();
      }
      const boss = s.battle!.spawnList.find(e => e.kind === 'boss');
      expect(preview.bossFoe).toEqual(boss ? { kind: 'boss', count: 1, faction: boss.faction, bossTier: boss.bossTier } : null);
    }
  });

  it('미리보기 그림은 종족 그림(프레임 묶음 → 한 장) → 옛 그림 순으로 고른다', async () => {
    const { foeIconUrl } = await import('../../../src/ui/game/wavePreview');
    const foe = { kind: 'runner', count: 2, faction: 'acorn_goblin', bossTier: null } as const;
    const boss = { kind: 'boss', count: 1, faction: 'acorn_goblin', bossTier: 2 } as const;
    const only = (ids: string[]) => (id: string) => (ids.includes(id) ? `/${id}.png` : undefined);
    expect(foeIconUrl(BALANCE, foe, only(['acorn.runner', 'acorn.runner.0']), '/old.png')).toBe('/acorn.runner.0.png');
    expect(foeIconUrl(BALANCE, foe, only(['acorn.runner']), '/old.png')).toBe('/acorn.runner.png');
    expect(foeIconUrl(BALANCE, boss, only(['acorn.boss10']), '/old.png')).toBe('/acorn.boss10.png');
    expect(foeIconUrl(BALANCE, foe, only([]), '/old.png')).toBe('/old.png');
    expect(foeIconUrl(BALANCE, { ...foe, faction: 'no_such_faction' }, only(['acorn.runner']), '/old.png')).toBe('/old.png');
    // 정원 보병은 별칭(artAlias)이 가리키는 기존 그림을 쓴다.
    expect(foeIconUrl(BALANCE, { ...foe, kind: 'walker' }, only(['enemy.walker.0']), '/old.png')).toBe('/enemy.walker.0.png');
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

describe('압축 레일 능력치·역할 요약(크롬북 1366×650)', () => {
  it('압축이면 막대 대신 역할 낱말과 아이콘+숫자 칩 세 개, 아니면 막대 세 줄이고 역할은 없다', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { TowerDetail } = await import('../../../src/ui/game/TowerDetail');
    const { ROLE_LABEL, TOWER_ROLE_GROUP } = await import('../../../src/ui/game/towerRoles');
    const props = { balance: BALANCE, type: 'frost' as const, level: 1, form: 'base' as const, icons: {}, next: { level: 2, form: 'base' as const } };
    const role = ROLE_LABEL[TOWER_ROLE_GROUP.frost];
    const compact = renderToStaticMarkup(createElement(TowerDetail, { ...props, compact: true }));
    const full = renderToStaticMarkup(createElement(TowerDetail, props));
    const bars = statBars(BALANCE, 'frost', 1, 'base', { level: 2, form: 'base' });
    expect(compact).toContain(role);
    expect(compact.match(/<li /g)).toHaveLength(bars.length);
    for (const bar of bars) expect(compact).toContain(`${bar.label} ${bar.value}`);
    expect(compact).not.toContain('<dl');
    expect(full).not.toContain(role);
    expect(full.match(/<dt /g)).toHaveLength(bars.length);
  });
});

describe('징집 화면(towers.md §0-2, 엔진 domain/draft)', () => {
  // fixture: 모든 타워를 쓸 수 있는 판(앱은 아직 시범 3종이라 징집이 열리지 않는다)에서 3웨이브를 지켜 징집이 열린 상태.
  async function draftOpen() {
    const { TOWER_IDS } = await import('../../../src/contracts/balance');
    const { createRun } = await import('../../../src/domain/run');
    const { answerCurrent, ticks } = await import('../helpers');
    const { ctx } = newRun('Normal', 21);
    const s = createRun(ctx, {
      runId: 'ui-draft', playerId: 'p1', nickname: '시험', grade: 3, difficulty: 'Normal', mapId: ctx.map.id, seed: 21,
      bankId: 'g3-dev', bankVersion: '0.1.0-dev', contentMode: 'development', availableTowers: [...TOWER_IDS],
      rankingEligibility: 'personal', createdAt: '2026-10-31T00:00:00.000Z',
    });
    while (s.draft === null) {
      finishPrep(ctx, s);
      ok(ctx, s, { type: 'startBattle' });
      s.battle!.spawnIndex = s.battle!.spawnList.length;
      s.enemies = [];
      ticks(ctx, s, 1);
      if (s.draft === null) while (s.phase === 'WAVE_WRAPUP') answerCurrent(ctx, s, 'correct');
    }
    return { ctx, s };
  }

  it('웨이브 사이(정리·준비·배치)에만 띄우고, 전투 중이거나 멈추면 숨긴다', async () => {
    const { selectView } = await import('../../../src/application/view');
    const { recruitOffer, showRecruit } = await import('../../../src/ui/game/recruit');
    const { ctx, s } = await draftOpen();
    expect(s.completedWave).toBe(BALANCE.draft.afterWaves[0]);
    const v = selectView(ctx, s);
    expect(recruitOffer(v)).toHaveLength(BALANCE.draft.offerCount);
    expect(v.owned).toEqual(BALANCE.draft.startTowers);
    for (const phase of ['WAVE_WRAPUP', 'PREP_QUIZ', 'BUILD'] as const) expect(showRecruit({ ...v, phase })).toBe(true);
    expect(showRecruit({ ...v, phase: 'BATTLE' })).toBe(false);
    expect(showRecruit({ ...v, pause: ['USER'] })).toBe(false);
    expect(showRecruit({ ...v, draft: null })).toBe(false);
  });

  it('카드 3장(그림·이름·역할 한 줄·상성 아이콘, 능력치 막대 없음) 전체가 고르기 버튼 하나, 막 위 창이고 닫기 없이 꼭 고른다(R4 PRD §9.2)', async () => {
    const { selectView } = await import('../../../src/application/view');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { RecruitCard } = await import('../../../src/ui/game/RecruitCard');
    const { recruitOffer } = await import('../../../src/ui/game/recruit');
    const { TOWER_COPY } = await import('../../../src/ui/copy');
    const { ctx, s } = await draftOpen();
    const choices = recruitOffer(selectView(ctx, s))!;
    const html = renderToStaticMarkup(createElement(RecruitCard, { balance: BALANCE, choices, icons: {}, onPick: () => {} }));
    // 라디오 + 공통 확정 단추 대신 카드마다 ‘고르기’ 한 번(R4 PRD §9.2). 막(--scrim) 위 창이라 문제 카드까지 덮는다.
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toContain('role="radio"');
    for (const type of choices) {
      expect(html).toContain(BALANCE.towers[type].label);
      expect(html).toContain(TOWER_COPY[type].role);
      expect(html).toContain(`aria-label="${BALANCE.towers[type].label} 고르기"`);
    }
    // 새 타워 카드는 능력치 막대를 두지 않는다(막대는 진화 카드와 상황 카드의 몫). 하늘·땅 표시 줄도 없다.
    expect(html).not.toContain('<dl');
    expect(html).not.toContain('하늘 적 공격');
    expect(html).not.toContain('땅 적만');
    // 카드 전체가 누르는 단추 하나(카드를 덮는 투명 단추)뿐이고(닫기 없음) 모두 바로 누를 수 있다.
    const buttons = html.match(/<button[^>]*>/g)!;
    expect(buttons).toHaveLength(choices.length);
    expect(buttons.every(b => b.includes('data-choice') && !b.includes('disabled'))).toBe(true);
  });

  it('비행 적 표시는 엔진 대공 값을 따른다(궁수·서리는 하늘, 포탑·창병은 땅만, 깃발은 표시 없음)', async () => {
    const { recruitCardInfo } = await import('../../../src/ui/game/recruit');
    expect(['archer', 'frost', 'cannon', 'spear', 'banner'].map(t => recruitCardInfo(BALANCE, t as 'archer').air)).toEqual([true, true, false, false, null]);
  });

  it('고르면 장착함(장착 홈)에 들어오고 후보가 닫힌다', async () => {
    const { selectView } = await import('../../../src/application/view');
    const { recruitCommand, recruitOffer } = await import('../../../src/ui/game/recruit');
    const { ctx, s } = await draftOpen();
    const pick = recruitOffer(selectView(ctx, s))![1]!;
    ok(ctx, s, recruitCommand(pick));
    const v = selectView(ctx, s);
    expect(v.owned).toEqual([...BALANCE.draft.startTowers, pick]);
    expect(recruitOffer(v)).toBeNull();
    const again = applyCommand(ctx, s, recruitCommand(pick));
    expect(again.ok ? null : again.error).toBe('NO_DRAFT');
  });
});

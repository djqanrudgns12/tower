import { describe, expect, it } from 'vitest';
import { FORM_IDS, TOWER_IDS, type Balance, type FormId, type TowerId } from '../../src/contracts/balance';
import { resumeBlocker } from '../../src/application/session';
import { BALANCE, gradeContent } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import { round5Bp } from '../../src/domain/num';
import { advanceTick, applyCommand, type Command, type CommandError } from '../../src/domain/run';
import {
  attacks, auraReaches, bannerAura, evolutionChoices, formBranch, formConfig, formInfo, formTier, levelDamageBP, reachMilli, towerStats, upgradeCost,
} from '../../src/domain/towers';
import { RUN_STATE_VERSION, type RunState } from '../../src/domain/types';
import { answerCurrent, correctChoice, finishPrep, nearestSlots, newRun, ok, stateHash, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// 타워 성장·진화(docs/renewal/progression.md §1~§6). JSON 수치는 다른 세션이 조정 중이라,
// 레벨 배율·비용·숙련 성장 기대값은 시험 안에서 고정한 표(§3·§4 후보)로 손 계산한다.
function fixed(max: number | null = null): Balance {
  const b = structuredClone(BALANCE);
  b.levels = {
    max, evolveAt: [4, 7],
    damageMultiplierBP: [10000, 13000, 16500, 23000, 27500, 32500, 44000, 51000, 59000],
    upgradeCostOfBaseBP: [6500, 10000, 15000, 14000, 18000, 26000, 24000, 30000],
    beyond: { damageGrowthBP: 11000, costGrowthBP: 12200 },
  };
  b.run.undoBuildMs = 3000;
  b.run.correctFeedbackMs = 1000;
  return b;
}

const slotAt = (ctx: GameContext, x: number, y: number) => ctx.map.slots.find(s => s.x === x && s.y === y)!.id;

/** 고정 표를 쓰는 판의 배치 단계(모든 타워 허용, 골드 넉넉히). */
function buildPhase(b = fixed()) {
  const run = newRun('Normal', 7);
  const ctx: GameContext = { ...run.ctx, balance: b };
  finishPrep(ctx, run.s);
  run.s.config.availableTowers = [...TOWER_IDS];
  run.s.owned = [...TOWER_IDS];
  run.s.gold = 100000;
  return { ctx, s: run.s };
}

const build = (ctx: GameContext, s: RunState, type: TowerId, x: number, y: number) => {
  ok(ctx, s, { type: 'build', slotId: slotAt(ctx, x, y), tower: type });
  return s.towers.at(-1)!;
};
const upgradeCmd = (towerId: number, form?: FormId): Command => ({ type: 'upgrade', towerId, ...(form ? { form } : {}) });

/** 거절된 명령은 상태를 하나도 바꾸지 않는다. */
function rejects(ctx: GameContext, s: RunState, cmd: Command, error: CommandError) {
  const before = structuredClone(s);
  expect(applyCommand(ctx, s, cmd)).toEqual({ ok: false, error });
  expect(s).toEqual(before);
}

describe('진화 선택지·형태 단계(progression.md §1·§5)', () => {
  it('Lv3 기본형만 A·B, Lv6은 고른 길의 두 갈래, 그 밖 레벨·맞지 않는 형태는 null', () => {
    const b = fixed();
    const ch = (level: number, form: FormId) => evolutionChoices(b, { type: 'archer', level, form });
    expect(ch(3, 'base')).toEqual(['A', 'B']);
    expect([ch(1, 'base'), ch(2, 'base'), ch(4, 'A'), ch(5, 'A'), ch(4, 'B'), ch(5, 'B')]).toEqual([null, null, null, null, null, null]);
    expect(ch(6, 'A')).toEqual(['A1', 'A2']);
    expect(ch(6, 'B')).toEqual(['B1', 'B2']);
    for (const form of ['A1', 'A2', 'B1', 'B2'] as const) for (const level of [7, 8, 9, 10, 30]) expect(ch(level, form)).toBeNull();
    expect([ch(3, 'A'), ch(6, 'base'), ch(6, 'A1')]).toEqual([null, null, null]);
    for (const type of TOWER_IDS) expect(evolutionChoices(b, { type, level: 3, form: 'base' })).toEqual(['A', 'B']);
  });

  it('levels.max 레벨에서는 진화도 비용도 없고, 그 아래 진화는 그대로다', () => {
    const b5 = fixed(5);
    expect(evolutionChoices(b5, { type: 'archer', level: 5, form: 'A' })).toBeNull();
    expect(upgradeCost(b5, 'archer', 5)).toBeNull();
    expect(upgradeCost(b5, 'archer', 4)).toBe(85); // 60×1.4 = 84 → round5 85
    expect(evolutionChoices(b5, { type: 'archer', level: 3, form: 'base' })).toEqual(['A', 'B']);
    expect(evolutionChoices(fixed(6), { type: 'archer', level: 6, form: 'A' })).toBeNull();
    expect(evolutionChoices(fixed(3), { type: 'archer', level: 3, form: 'base' })).toBeNull();
  });

  it('formTier·formBranch, formInfo: 기본형은 타워 이름, 1차형 단계 1, 2차형 이름은 카탈로그를 옮긴 대공 형태(화염 A2·수호기사 B1) 말고는 ‘임시’로 시작', () => {
    expect(FORM_IDS.map(f => formTier(f))).toEqual([0, 1, 1, 2, 2, 2, 2]);
    expect(FORM_IDS.map(f => formBranch(f))).toEqual([null, 'A', 'B', 'A', 'A', 'B', 'B']);
    for (const type of TOWER_IDS) {
      expect(formInfo(BALANCE, type, 'base')).toEqual({ label: BALANCE.towers[type].label, summary: '기본형', tier: 0 });
      for (const form of ['A', 'B'] as const) expect(formInfo(BALANCE, type, form)).toEqual({ label: BALANCE.forms[type][form].label, summary: BALANCE.forms[type][form].summary, tier: 1 });
      for (const form of ['A1', 'A2', 'B1', 'B2'] as const) {
        const info = formInfo(BALANCE, type, form);
        expect(info.tier).toBe(2);
        const catalog = (type === 'flame' && form === 'A2') || (type === 'guardian' && form === 'B1');
        expect(info.label, `${type} ${form}`).toMatch(catalog ? /^[^임]/ : /^임시/);
      }
    }
  });
});

describe('강화·진화 명령(progression.md §5)', () => {
  it('B 길: Lv3→4 B, Lv6→7 B2로 오르며 궁수 비용은 40·60·90·85·110·155', () => {
    const { ctx, s } = buildPhase();
    s.gold = 1000;
    const t = build(ctx, s, 'archer', 8, 2);
    const paid: number[] = [];
    const up = (form?: FormId) => { for (const e of ok(ctx, s, upgradeCmd(t.id, form))) if (e.type === 'towerUpgraded') paid.push(-e.gold); };
    up(); up(); up('B');
    expect(t).toMatchObject({ level: 4, form: 'B' });
    up(); up(); up('B2');
    // 비용 = round5(60 × 배율): 39→40, 60, 90, 84→85, 108→110, 156→155. 투자액 60+40+60+90+85+110+155 = 600.
    expect(paid).toEqual([40, 60, 90, 85, 110, 155]);
    expect(t).toMatchObject({ level: 7, form: 'B2', invested: 600, undoUntilTick: null });
    expect(s.gold).toBe(400);
    expect(evolutionChoices(ctx.balance, t)).toBeNull();
  });

  it('형태 누락(FORM_REQUIRED)·다른 길(INVALID_FORM)·진화 아닌 레벨의 형태(INVALID_FORM)는 상태를 바꾸지 않는다', () => {
    const { ctx, s } = buildPhase();
    const t = build(ctx, s, 'archer', 8, 2);
    rejects(ctx, s, upgradeCmd(t.id, 'A'), 'INVALID_FORM'); // Lv1→2는 진화가 아니다
    ok(ctx, s, upgradeCmd(t.id));
    ok(ctx, s, upgradeCmd(t.id));
    rejects(ctx, s, upgradeCmd(t.id), 'FORM_REQUIRED');
    rejects(ctx, s, upgradeCmd(t.id, 'A1'), 'INVALID_FORM'); // 1차를 건너뛸 수 없다
    rejects(ctx, s, upgradeCmd(t.id, 'base'), 'INVALID_FORM');
    ok(ctx, s, upgradeCmd(t.id, 'B'));
    rejects(ctx, s, upgradeCmd(t.id, 'B'), 'INVALID_FORM'); // Lv4→5: 같은 형태라도 보내면 거절
    ok(ctx, s, upgradeCmd(t.id));
    ok(ctx, s, upgradeCmd(t.id));
    rejects(ctx, s, upgradeCmd(t.id), 'FORM_REQUIRED');
    for (const wrong of ['A1', 'A2', 'A', 'B'] as const) rejects(ctx, s, upgradeCmd(t.id, wrong), 'INVALID_FORM'); // 다른 부모·1차형
    s.gold = 0;
    rejects(ctx, s, upgradeCmd(t.id, 'B1'), 'NOT_ENOUGH_GOLD');
    expect(t).toMatchObject({ level: 6, form: 'B' });
  });

  it('정수 상한: max=5면 Lv5에서, max=3이면 진화 레벨 Lv3에서 형태를 보내도 MAX_LEVEL이고 상태가 그대로다', () => {
    const five = buildPhase(fixed(5));
    const t = build(five.ctx, five.s, 'archer', 8, 2);
    for (const form of [undefined, undefined, 'A', undefined] as const) ok(five.ctx, five.s, upgradeCmd(t.id, form));
    expect(t).toMatchObject({ level: 5, form: 'A' });
    rejects(five.ctx, five.s, upgradeCmd(t.id), 'MAX_LEVEL');

    const three = buildPhase(fixed(3));
    const u = build(three.ctx, three.s, 'cannon', 8, 2);
    ok(three.ctx, three.s, upgradeCmd(u.id));
    ok(three.ctx, three.s, upgradeCmd(u.id));
    rejects(three.ctx, three.s, upgradeCmd(u.id), 'MAX_LEVEL');
    rejects(three.ctx, three.s, upgradeCmd(u.id, 'A'), 'MAX_LEVEL');
  });
});

describe('2차형 상속(progression.md §3)', () => {
  it('A2는 A의 범위·대상 수를 물려받아 감속을 더하고, A1의 같은 필드는 덮어쓰며, B 값은 A 길에 섞이지 않는다', () => {
    const b = fixed();
    const f = b.forms.cannon;
    f.A = { label: '확산', summary: '넓게', splashRadiusMilli: 1050, maxTargets: 6 };
    f.B = { label: '중포', summary: '세게', damageBP: 16000 };
    f.A1 = { parent: 'A', label: '집속', summary: '아주 넓게', splashRadiusMilli: 1300 };
    f.A2 = { parent: 'A', label: '끈끈이', summary: '느리게', slowBP: 2000, slowMs: 1500 };
    f.B2 = { parent: 'B', label: '철갑', summary: '단단한 적', physicalResistIgnoreBP: 6000 };
    // 포탑 피해 18, Lv7 배율 4.4 → 18000×44000/10000 = 79200. 감속 1500ms×30/1000 = 45틱.
    expect(towerStats(b, 'cannon', 7, 'A2')).toMatchObject({ damage: 79200, splashRadius: 1050, maxTargets: 6, slowBP: 2000, slowTicks: 45, intervalBP: 10000 });
    expect(towerStats(b, 'cannon', 7, 'A1')).toMatchObject({ damage: 79200, splashRadius: 1300, maxTargets: 6, slowBP: 0, slowTicks: 0 });
    // B2는 B의 피해 배율을 물려받는다: floor(79200×1.6) = 126720. 범위·대상 수는 포탑 기본(750, 4).
    expect(towerStats(b, 'cannon', 7, 'B2')).toMatchObject({ damage: 126720, splashRadius: 750, maxTargets: 4, physicalResistIgnoreBP: 6000 });
    // 1차형 A Lv4: 18000×2.3 = 41400.
    expect(towerStats(b, 'cannon', 4, 'A')).toMatchObject({ damage: 41400, splashRadius: 1050, maxTargets: 6, slowBP: 0 });
    expect(formConfig(b, 'cannon', 'A2')).toEqual({ parent: 'A', label: '끈끈이', summary: '느리게', splashRadiusMilli: 1050, maxTargets: 6, slowBP: 2000, slowMs: 1500 });
    expect(formConfig(b, 'cannon', 'base')).toBeNull();
    expect(formInfo(b, 'cannon', 'A2')).toEqual({ label: '끈끈이', summary: '느리게', tier: 2 });
    expect(f.A).toEqual({ label: '확산', summary: '넓게', splashRadiusMilli: 1050, maxTargets: 6 }); // 부모 설정은 그대로
  });
});

describe('숙련 성장 Lv10+(progression.md §3)', () => {
  it('피해 배율: 표 끝 Lv9 59000, 그 뒤 한 레벨마다 ×1.1 내림', () => {
    const b = fixed();
    b.forms.archer.A = { label: '속사', summary: '빠르게', intervalBP: 8000 };
    b.forms.archer.A1 = { parent: 'A', label: '연사', summary: '아주 빠르게', intervalBP: 6500 };
    // Lv10 = floor(59000×11000/10000) = 64900, Lv11 = floor(64900×1.1) = 71390, Lv12 = floor(71390×1.1) = 78529.
    expect([1, 4, 7, 9, 10, 11, 12].map(l => levelDamageBP(b, l))).toEqual([10000, 23000, 44000, 59000, 64900, 71390, 78529]);
    // 궁수 피해 8 → 8000×64900/10000 = 51920(A1은 피해 배율 없음).
    expect(towerStats(b, 'archer', 10, 'A1')).toMatchObject({ damage: 51920, intervalBP: 6500 });
  });

  it('궁수 강화 비용: 표 안은 round5(60×배율), Lv8→9 180, 그 뒤 비용 배율 ×1.22 내림에 round5', () => {
    const b = fixed();
    // 60×0.65=39→40, 60, 90, 84→85, 108→110, 156→155, 144→145, 60×3.0=180.
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(l => upgradeCost(b, 'archer', l))).toEqual([40, 60, 90, 85, 110, 155, 145, 180]);
    // Lv9→10: floor(30000×1.22)=36600 → 60×3.66 = 219.6 → 5×floor(43.92+0.5) = 220
    // Lv10→11: floor(36600×1.22)=44652 → 267.912 → 5×floor(53.58+0.5) = 270
    // Lv11→12: floor(44652×1.22)=54475 → 326.85 → 5×floor(65.37+0.5) = 325
    expect([9, 10, 11].map(l => upgradeCost(b, 'archer', l))).toEqual([220, 270, 325]);
  });

  it('round5 = 5×floor(x/5 + 0.5): x가 정확히 2.5면 올리고, 그보다 조금 작으면 내린다', () => {
    expect(round5Bp(1, 25000)).toBe(5); // x = 2.5
    expect(round5Bp(1, 24999)).toBe(0); // x = 2.4999
    expect(round5Bp(125, 1000)).toBe(15); // x = 12.5 → 5×floor(3.0)
    expect(round5Bp(60, 26000)).toBe(155); // x = 156 → 5×floor(31.7)
  });
});

const PATHS: Array<[FormId, FormId]> = [['A', 'A1'], ['A', 'A2'], ['B', 'B1'], ['B', 'B2']];
const formAt = (b: Balance, level: number, [t1, t2]: [FormId, FormId]): FormId =>
  level < b.levels.evolveAt[0] ? 'base' : level < b.levels.evolveAt[1] ? t1 : t2;

/** Lv1..200 강화 비용: 처음 null인 레벨, 그 레벨까지 드는 골드(설치비 포함), 규칙 위반. */
function costScan(b: Balance, type: TowerId) {
  const bad: string[] = [];
  let first: number | null = null;
  let gold = b.towers[type].cost;
  for (let lv = 1; lv <= 200; lv++) {
    const c = upgradeCost(b, type, lv);
    if (c === null) { first ??= lv; continue; }
    if (first !== null) bad.push(`Lv${lv}: null 뒤에 비용 ${c}`);
    else gold += c;
    if (!Number.isSafeInteger(c)) bad.push(`Lv${lv}: ${c}`);
  }
  return { first, gold, bad };
}

/** Lv1..ceiling, 네 갈래 길의 단계별 형태로 수치를 계산해 안전 정수가 아닌 값·예외를 모은다. */
function statsScan(b: Balance, type: TowerId, ceiling: number) {
  const bad: string[] = [];
  const check = (where: string, v: number) => { if (!Number.isSafeInteger(v)) bad.push(`${where}=${v}`); };
  for (let lv = 1; lv <= ceiling; lv++) for (const path of PATHS) {
    const form = formAt(b, lv, path);
    const at = `${type} Lv${lv} ${form}`;
    try {
      if (attacks(b, type)) {
        const st = towerStats(b, type, lv, form);
        for (const [k, v] of Object.entries(st)) if (typeof v === 'number') check(`${at} ${k}`, v);
        check(`${at} damage×100000`, st.damage * 100000);
      } else {
        const aura = bannerAura(b, { type, level: lv, form });
        check(`${at} aura.damageBP`, aura.damageBP);
        check(`${at} aura.speedBP`, aura.speedBP);
      }
      check(`${at} reach`, reachMilli(b, type, lv, form));
    } catch (e) { bad.push(`${at}: ${String(e)}`); }
  }
  return bad;
}

describe('Lv200 안전 정수(progression.md §2·§6)', () => {
  it('고정 표(무제한): 10종 모두 Lv95→96부터 비용이 null이고, Lv95까지 드는 골드는 1e10을 넘는다', () => {
    // 비용 배율 v(Lv8)=30000에서 레벨마다 ×1.22 내림. 곱하기 전 v > floor(MAX_SAFE/12200) = 738295020880 이면 null.
    // v(Lv93) ≈ 30000×1.22^85 ≈ 6.6e11 ≤ 7.38e11 이라 Lv94→95 비용은 있고, v(Lv94) ≈ 30000×1.22^86 ≈ 8.0e11 > 7.38e11 이라 Lv95부터 null.
    // (기본가 ≤ 180이라 floor(MAX_SAFE/기본가) ≥ 5e13 검사는 먼저 걸리지 않는다.)
    // 가장 싼 궁수도 Lv94→95 한 번이 60×8.0e11/1e4 ≈ 4.8e9골드, 합계 ≈ 2.7e10. 1e10골드는 1초에 1000골드씩 벌어도 115일 넘게 걸린다.
    const b = fixed();
    for (const type of TOWER_IDS) {
      const { first, gold } = costScan(b, type);
      expect(first, type).toBe(95);
      expect(gold, type).toBeGreaterThan(1e10);
    }
  });

  for (const [name, b] of [['고정 표', fixed()], ['현재 JSON', BALANCE]] as const) {
    it(`${name}: Lv1~200 비용은 null이거나 안전 정수이고 null은 되돌아오지 않으며, 그 상한까지 모든 형태 수치·피해×100000이 안전 정수`, () => {
      let top = 1;
      for (const type of TOWER_IDS) {
        const { first, gold, bad } = costScan(b, type);
        expect(bad, type).toEqual([]);
        if (first !== null) expect(gold, type).toBeGreaterThan(1e10);
        const ceiling = first ?? 200;
        top = Math.max(top, ceiling);
        expect(statsScan(b, type, ceiling), type).toEqual([]);
      }
      const bps = Array.from({ length: top }, (_, i) => levelDamageBP(b, i + 1));
      expect(bps.filter((v, i) => !Number.isSafeInteger(v) || (i > 0 && v < bps[i - 1]!))).toEqual([]);
      expect(() => towerStats(b, 'banner', 1, 'base')).toThrow();
    });
  }

  it('정수 상한 12: Lv11→12 비용은 있고 Lv12부터는 null', () => {
    const b = fixed(12);
    // Lv11→12: floor(44652×1.22) = 54475 → 60×5.4475 = 326.85 → 325
    expect(upgradeCost(b, 'archer', 11)).toBe(325);
    expect([12, 13, 200].map(l => upgradeCost(b, 'archer', l))).toEqual([null, null, null]);
    for (const type of TOWER_IDS) {
      expect(typeof upgradeCost(b, type, 11), type).toBe('number');
      expect(upgradeCost(b, type, 12), type).toBeNull();
    }
  });
});

describe('깃발 오라 형태별(progression.md §1, PRD §7.3)', () => {
  function bannerBalance() {
    const b = fixed();
    b.towers.banner.auraDamageBPByLevel = [1000, 1200];
    b.towers.banner.rangeMilli = 2000;
    const f = b.forms.banner;
    f.A = { label: '용기', summary: '세게', auraDamageBPByLevel: [1800, 2100, 2400] };
    f.B = { label: '신속', summary: '빠르게', auraSpeedBPByLevel: [800, 1000, 1200] };
    f.A1 = { parent: 'A', label: '큰 용기', summary: '훨씬 세게', auraDamageBPByLevel: [2700, 3000, 3300] };
    f.A2 = { parent: 'A', label: '넓은 용기', summary: '넓게', auraDamageBPByLevel: [2400, 2600, 2800], rangeAddMilli: 700 };
    f.B1 = { parent: 'B', label: '큰 신속', summary: '훨씬 빠르게', auraSpeedBPByLevel: [1500, 1700, 1900] };
    f.B2 = { parent: 'B', label: '넓은 신속', summary: '넓게 빠르게', auraSpeedBPByLevel: [1200, 1300, 1400], rangeAddMilli: 700 };
    return b;
  }

  it('기본형은 레벨 표(끝은 마지막 값), 진화형은 그 형태 첫 레벨부터 제 표(끝은 마지막 값), B 계열은 피해 0·속도만', () => {
    const b = bannerBalance();
    const aura = (level: number, form: FormId) => bannerAura(b, { type: 'banner', level, form });
    const dmg = (damageBP: number) => ({ damageBP, speedBP: 0 });
    const spd = (speedBP: number) => ({ damageBP: 0, speedBP });
    expect([1, 2, 3].map(l => aura(l, 'base'))).toEqual([dmg(1000), dmg(1200), dmg(1200)]);
    expect([4, 5, 6].map(l => aura(l, 'A'))).toEqual([dmg(1800), dmg(2100), dmg(2400)]);
    expect([7, 8, 9, 12].map(l => aura(l, 'A1'))).toEqual([dmg(2700), dmg(3000), dmg(3300), dmg(3300)]);
    expect([7, 9].map(l => aura(l, 'A2'))).toEqual([dmg(2400), dmg(2800)]);
    expect([4, 5, 6].map(l => aura(l, 'B'))).toEqual([spd(800), spd(1000), spd(1200)]);
    expect([7, 9, 15].map(l => aura(l, 'B1'))).toEqual([spd(1500), spd(1900), spd(1900)]);
    expect(aura(8, 'B2')).toEqual(spd(1300));
    expect(bannerAura(b, { type: 'archer', level: 7, form: 'A1' })).toEqual({ damageBP: 0, speedBP: 0 });
    // 제 표가 없는 2차형은 부모 표를 Lv4부터 이어 센다: Lv7은 B 표의 넷째(없음) → 마지막 1200. Lv6 값보다 떨어지지 않는다.
    delete b.forms.banner.B1.auraSpeedBPByLevel;
    expect([7, 10].map(l => aura(l, 'B1'))).toEqual([spd(1200), spd(1200)]);
  });

  it('A2·B2의 사거리 보정은 오라 반경과 범위 원을 2000 → 2700으로 넓힌다(경계 포함)', () => {
    const b = bannerBalance();
    expect([reachMilli(b, 'banner', 4, 'A'), reachMilli(b, 'banner', 7, 'A1'), reachMilli(b, 'banner', 7, 'A2'), reachMilli(b, 'banner', 7, 'B2')]).toEqual([2000, 2000, 2700, 2700]);
    const at = (form: FormId) => ({ type: 'banner' as const, form, x: 500, y: 500 });
    expect(auraReaches(b, at('A'), { x: 2500, y: 500 })).toBe(true);
    expect(auraReaches(b, at('A'), { x: 2501, y: 500 })).toBe(false);
    expect(auraReaches(b, at('A2'), { x: 3200, y: 500 })).toBe(true);
    expect(auraReaches(b, at('A2'), { x: 3201, y: 500 })).toBe(false);
    // 대각선 (1600, 1900): 거리² 2,560,000+3,610,000 = 6,170,000. 2000² = 4,000,000 < 이 값 ≤ 2700² = 7,290,000.
    expect([auraReaches(b, at('A1'), { x: 2100, y: 2400 }), auraReaches(b, at('A2'), { x: 2100, y: 2400 })]).toEqual([false, true]);
  });
});

describe('설치 취소 undoBuild(run.undoBuildMs = 3000ms = 90틱)', () => {
  it('설치 뒤 89틱이면 설치비 전액 환불·타워 제거·판매 사건 하나, 같은 타워를 두 번 취소할 수 없다', () => {
    const { ctx, s } = buildPhase();
    const gold = s.gold;
    const t = build(ctx, s, 'archer', 8, 2);
    expect(t.undoUntilTick).toBe(s.tick + 90); // 3000×30/1000 = 90
    ticks(ctx, s, 89);
    expect(s.phase).toBe('BUILD');
    expect(applyCommand(ctx, s, { type: 'undoBuild', towerId: t.id })).toEqual({ ok: true, events: [{ type: 'towerSold', towerId: t.id, slotId: t.slotId, gold: 60 }] });
    expect(s.gold).toBe(gold);
    expect(s.towers).toEqual([]);
    rejects(ctx, s, { type: 'undoBuild', towerId: t.id }, 'UNKNOWN_TOWER');
    ok(ctx, s, { type: 'build', slotId: t.slotId, tower: 'archer' });
  });

  it('정확히 undoUntilTick부터, 그리고 강화한 뒤에는 창 안이어도 UNDO_EXPIRED', () => {
    const { ctx, s } = buildPhase();
    const a = build(ctx, s, 'archer', 8, 2);
    const c = build(ctx, s, 'cannon', 8, 0);
    ok(ctx, s, upgradeCmd(c.id));
    expect(c.undoUntilTick).toBeNull();
    rejects(ctx, s, { type: 'undoBuild', towerId: c.id }, 'UNDO_EXPIRED');
    ticks(ctx, s, 90);
    expect(s.tick).toBe(a.undoUntilTick);
    rejects(ctx, s, { type: 'undoBuild', towerId: a.id }, 'UNDO_EXPIRED');
    ticks(ctx, s, 500);
    rejects(ctx, s, { type: 'undoBuild', towerId: a.id }, 'UNDO_EXPIRED');
  });

  it('전투에서 쏜 타워와 그 공격에 오라를 준 깃발은 창 안이어도 만료, 오라 밖 깃발은 전투 중에도 취소된다', () => {
    const { ctx, s } = buildPhase();
    const archer = build(ctx, s, 'archer', 8, 2);
    const near = build(ctx, s, 'banner', 8, 0); // 궁수와 정확히 2.0칸: 오라 반경 경계 안
    const far = build(ctx, s, 'banner', 10, 4); // 2000²+2000² > 2000²: 오라 밖
    const built = s.tick;
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnIndex = s.battle!.spawnList.length;
    archer.nextAttackTick = s.tick + 1;
    // 진행도 8000 = (8500, 1500): 궁수 (8500, 2500)에서 1칸. 기절시켜 위치를 고정한다.
    s.enemies = [enemy({ id: 100, hp: 200000, maxHp: 200000, progress: 8000, stunUntilTick: 10_000_000 })];
    expect([archer, near, far].map(t => t.undoUntilTick)).toEqual([built + 90, built + 90, built + 90]);
    const ev = ticks(ctx, s, 1);
    expect(ev.some(e => e.type === 'fire' && e.towerId === archer.id)).toBe(true);
    expect(s.tick).toBeLessThan(built + 90);
    rejects(ctx, s, { type: 'undoBuild', towerId: archer.id }, 'UNDO_EXPIRED');
    rejects(ctx, s, { type: 'undoBuild', towerId: near.id }, 'UNDO_EXPIRED');
    const gold = s.gold;
    expect(applyCommand(ctx, s, { type: 'undoBuild', towerId: far.id })).toEqual({ ok: true, events: [{ type: 'towerSold', towerId: far.id, slotId: far.slotId, gold: 100 }] });
    expect(s.gold).toBe(gold + 100);
    expect(s.towers.map(t => t.id)).toEqual([archer.id, near.id]);
  });

  it('창은 단계와 상관없이 틱으로 흐른다: 다음 준비 문항 중에는 WRONG_PHASE, 그동안 창이 지나면 다음 배치에서 UNDO_EXPIRED', () => {
    const prep = newRun();
    rejects(prep.ctx, prep.s, { type: 'undoBuild', towerId: 1 }, 'WRONG_PHASE');
    const { ctx, s } = buildPhase();
    const t = build(ctx, s, 'archer', 8, 2);
    rejects(ctx, s, { type: 'undoBuild', towerId: 999 }, 'UNKNOWN_TOWER');
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [];
    ticks(ctx, s, 1); // 적이 없어 바로 완료 → 마무리 문항
    answerCurrent(ctx, s, 'correct'); // 정답 1000ms = 30틱 뒤 2웨이브 준비
    expect(s.phase).toBe('PREP_QUIZ');
    expect(s.tick).toBeLessThan(t.undoUntilTick!);
    rejects(ctx, s, { type: 'undoBuild', towerId: t.id }, 'WRONG_PHASE');
    ticks(ctx, s, 90);
    finishPrep(ctx, s);
    expect(s.phase).toBe('BUILD');
    rejects(ctx, s, { type: 'undoBuild', towerId: t.id }, 'UNDO_EXPIRED');
  });
});

describe('저장 버전(progression.md §4) — 실제 이어하기 판정(session.resumeBlocker, WP-SAVE)', () => {
  /** 저장소에서 읽은 판과 같은 모양. 은행은 그 학년 공개 은행으로 맞춘다(이어하기는 시작 때 은행 버전이 그대로여야 한다). */
  function saved(state: unknown) {
    return { kind: 'ok' as const, state: state as RunState, seq: 1, savedAt: '2026-10-31T00:00:00.000Z' };
  }
  function current() {
    const { s } = newRun();
    const { bank } = gradeContent(3);
    s.config.bankId = bank!.bankId;
    s.config.bankVersion = bank!.bankVersion;
    return s;
  }

  it('지금 저장 버전(v3) 판은 이어하고, v1(branch 타워)·v2(종족 없는 적) 스냅샷은 던지지 않고 ‘이어할 수 없어요’로 막는다', () => {
    expect(RUN_STATE_VERSION).toBe(3);
    const s = current();
    expect(s.v).toBe(3);
    expect(s.config.balanceVersion).toBe(BALANCE.balanceVersion);
    expect(resumeBlocker(saved(JSON.parse(JSON.stringify(s))))).toBeNull();
    const v1 = { ...structuredClone(s), v: 1, towers: [{ id: 1, type: 'archer', slotId: 's1', x: 8500, y: 2500, level: 4, branch: 'A', invested: 250, nextAttackTick: null }] };
    expect(() => resumeBlocker(saved(v1))).not.toThrow();
    expect(resumeBlocker(saved(v1))).toMatch(/이어할 수 없어요/);
    const v2 = { ...structuredClone(s), v: 2, enemies: [{ id: 1, kind: 'walker', elite: null, hp: 1, maxHp: 1, progress: 0 }] };
    expect(() => resumeBlocker(saved(v2 as never))).not.toThrow();
    expect(resumeBlocker(saved(v2 as never))).toMatch(/이어할 수 없어요/);
    // 리뉴얼 전 밸런스(0.4.2)로 시작한 판도 같은 안내로 막는다.
    expect(resumeBlocker(saved({ ...structuredClone(s), config: { ...s.config, balanceVersion: '0.4.2-candidate' } }))).toMatch(/이어할 수 없어요/);
  });
});

describe('결정론(progression.md §6)', () => {
  /** 배치 → 설치 취소 → 강화, 전투 중 궁수를 Lv4(A) → Lv7(A1)로 진화시키며 정답만 내고 여러 웨이브를 돈다. */
  function scripted(seed: number) {
    const { ctx, s } = newRun('Normal', seed);
    finishPrep(ctx, s);
    s.gold = 5000;
    const [a, c, f] = nearestSlots(ctx, 3);
    ok(ctx, s, { type: 'build', slotId: a!, tower: 'archer' });
    ok(ctx, s, { type: 'build', slotId: c!, tower: 'cannon' });
    ok(ctx, s, { type: 'build', slotId: f!, tower: 'frost' });
    const [archer, cannon, frost] = s.towers.map(t => t.id) as [number, number, number];
    ok(ctx, s, { type: 'undoBuild', towerId: frost });
    for (const [id, form] of [[archer], [archer], [cannon], [cannon], [cannon, 'B']] as Array<[number, FormId?]>) ok(ctx, s, upgradeCmd(id, form));
    ok(ctx, s, { type: 'startBattle' });
    const start = s.tick;
    const plan = new Map<number, Array<[number, FormId?]>>([[start + 30, [[archer, 'A']]], [start + 60, [[archer], [archer]]], [start + 90, [[archer, 'A1']]]]);
    for (let i = 0; i < 30 * 120 && s.phase !== 'GAME_OVER'; i++) {
      for (const [id, form] of plan.get(s.tick) ?? []) ok(ctx, s, upgradeCmd(id, form));
      const enc = s.quiz.current;
      if (enc && !enc.answer && s.tick % 45 === 0) ok(ctx, s, { type: 'answer', encounterId: enc.id, choice: correctChoice(ctx, s) });
      if (s.phase === 'BUILD') ok(ctx, s, { type: 'startBattle' });
      advanceTick(ctx, s);
    }
    return s;
  }

  it('같은 seed·같은 명령으로 Lv7까지 진화한 판은 상태 해시와 타워가 같다', () => {
    const x = scripted(4242);
    const y = scripted(4242);
    expect(x.towers.find(t => t.type === 'archer')).toMatchObject({ level: 7, form: 'A1', undoUntilTick: null });
    expect(x.towers.find(t => t.type === 'cannon')).toMatchObject({ level: 4, form: 'B' });
    expect(x.towers.some(t => t.type === 'frost')).toBe(false);
    expect(x.stats.kills).toBeGreaterThan(0);
    expect(x.wave).toBeGreaterThanOrEqual(2);
    expect(y.towers).toEqual(x.towers);
    expect(stateHash(y)).toBe(stateHash(x));
  });
});

import { TOWER_IDS, type Balance, type BranchId, type EliteId, type EnemyKind, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import { msToTicks } from '../../src/domain/num';
import { advanceTick, applyCommand, createRun } from '../../src/domain/run';
import { buildCost, upgradeCost } from '../../src/domain/towers';
import { simContext } from './balanceSim';

// S11 타워 효율(PRD §7.5 수용 기준 ①): 각 타워가 ‘의도한 상황’에서 같은 골드의 궁수보다 15% 이상 효율이 높은가.
// 제품 domain 엔진으로, 죽지 않는 적 줄을 정한 간격으로 한 번 통과시키며 타워(묶음)가 준 피해(직접+화상)를 골드로 나눈다.
// 적이 죽지 않으므로 처치 보상·표적 바뀜이 섞이지 않고, 같은 줄을 다른 타워에 똑같이 보낸다.

export interface Placement { type: TowerId; slot: [number, number]; level?: number; branch?: BranchId | null }
export interface Stream { kind: EnemyKind; elite: EliteId | null; count: number; spacingMs: number }

export const STREAMS = {
  /** 보통 간격의 기본형 줄. */
  line: { kind: 'walker', elite: null, count: 24, spacingMs: 950 },
  /** 촘촘한 밀집(포탑·화염·번개의 의도). */
  dense: { kind: 'walker', elite: null, count: 40, spacingMs: 300 },
  /** 물리 저항 35% 껍질형(마법탑의 의도). */
  shell: { kind: 'shell', elite: null, count: 24, spacingMs: 950 },
  /** 물리 저항이 더해진 단단한 정예(마법탑·석궁의 의도). */
  armored: { kind: 'walker', elite: 'armored', count: 24, spacingMs: 950 },
} satisfies Record<string, Stream>;

/** 놓인 타워 묶음이 줄 하나에 준 총피해(milli-HP)와 들인 골드. */
export function measure(placements: Placement[], stream: Stream, balance: Balance = BALANCE, mapId = 'garden_u'): { damage: number; gold: number } {
  const ctx = simContext(mapId, 'Normal', balance);
  const s = createRun(ctx, {
    runId: 'eff', playerId: 'sim', nickname: '효율', grade: 3, difficulty: 'Normal', mapId: ctx.map.id, seed: 1,
    bankId: 'sim', bankVersion: 'sim', contentMode: 'development', availableTowers: [...TOWER_IDS], rankingEligibility: 'personal', createdAt: '2026-10-29T00:00:00.000Z',
  });
  // 문항 흐름은 효율과 무관하므로 건너뛰고 거래 단계에서 시작한다. 성문이 무너지지 않게 한다.
  s.phase = 'BUILD'; s.quiz.current = null; s.quiz.feedback = null;
  s.gold = 1_000_000_000; s.gateHp = s.gateMaxHp = 1_000_000_000;
  let gold = 0;
  for (const p of placements) {
    const slot = ctx.map.slots.find(x => x.x === p.slot[0] && x.y === p.slot[1]);
    if (!slot) throw new Error(`없는 설치 칸: ${p.slot.join(',')}`);
    const r = applyCommand(ctx, s, { type: 'build', slotId: slot.id, tower: p.type });
    if (!r.ok) throw new Error(`설치 실패 ${p.type}: ${r.error}`);
    const t = s.towers[s.towers.length - 1]!;
    gold += buildCost(ctx.balance, p.type);
    for (let lv = 1; lv < (p.level ?? 1); lv++) gold += upgradeCost(ctx.balance, p.type, lv)!;
    t.level = p.level ?? 1;
    t.branch = p.branch ?? null;
  }
  const r = applyCommand(ctx, s, { type: 'startBattle' });
  if (!r.ok) throw new Error(`전투 시작 실패: ${r.error}`);
  const battle = s.battle!;
  battle.spawnList = Array.from({ length: stream.count }, () => ({ kind: stream.kind, elite: stream.elite }));
  battle.intervalTicks = msToTicks(stream.spacingMs);
  battle.hpBaseMilli = 1_000_000_000;
  let damage = 0;
  // 전투가 끝나면(모든 적이 지나가면) 멈춘다. 위에서 BUILD로 둔 단언이 좁혀지지 않게 함수로 읽는다.
  const fighting = () => s.phase === 'BATTLE';
  for (let i = 0; i < 30 * 60 * 10 && fighting(); i++) {
    for (const e of advanceTick(ctx, s)) if (e.type === 'hit' || e.type === 'burn') damage += e.damage;
  }
  return { damage, gold };
}

/** shared가 있으면 그 묶음 위에 subject·baseline을 더했을 때 늘어난 피해를 더한 골드로 나눠 비교한다(깃발처럼 혼자서는 피해가 없는 타워). */
export interface Comparison { id: string; intent: string; stream: keyof typeof STREAMS; subject: Placement[]; baseline: Placement[]; shared?: Placement[]; required: boolean }

const at = (slot: [number, number]) => slot;
/** (8,2) 칸은 1행·3행 길을 모두 1칸 거리에서 덮는 길목이다. 같은 칸에서 같은 줄로 비교한다. */
const C: [number, number] = at([8, 2]);

/**
 * 비교 목록. required는 PRD §7.5 ①이 이름을 든 의도(마법=껍질·단단한 정예, 포탑·화염=밀집, 창병=길목, 깃발=강화 묶음)이고,
 * 나머지는 참고값이다. 깃발은 같은 골드로 궁수를 하나 더(Lv2) 놓은 묶음과 비교한다.
 */
export const COMPARISONS: Comparison[] = [
  { id: 'mage-shell', intent: '마법탑 · 껍질형', stream: 'shell', subject: [{ type: 'mage', slot: C }], baseline: [{ type: 'archer', slot: C }], required: true },
  { id: 'mage-armored', intent: '마법탑 · 단단한 정예', stream: 'armored', subject: [{ type: 'mage', slot: C }], baseline: [{ type: 'archer', slot: C }], required: true },
  { id: 'cannon-dense', intent: '포탑 · 밀집', stream: 'dense', subject: [{ type: 'cannon', slot: C }], baseline: [{ type: 'archer', slot: C }], required: true },
  { id: 'flame-dense', intent: '화염탑 · 밀집', stream: 'dense', subject: [{ type: 'flame', slot: C }], baseline: [{ type: 'archer', slot: C }], required: true },
  { id: 'spear-choke', intent: '창병초소 · 길목', stream: 'line', subject: [{ type: 'spear', slot: C }], baseline: [{ type: 'archer', slot: C }], required: true },
  {
    // 정원 맵에서 2칸 안에 타워 셋을 둘 수 있는 가장 큰 묶음: (0,2) 칸 둘레 (0,0)·(0,4)·(2,2).
    id: 'banner-group', intent: '깃발초소 · 강화 궁수 셋 묶음(더한 골드당)', stream: 'line', required: true,
    shared: [{ type: 'archer', slot: [0, 0], level: 3, branch: 'A' }, { type: 'archer', slot: [0, 4], level: 3, branch: 'A' }, { type: 'archer', slot: [2, 2], level: 3, branch: 'A' }],
    subject: [{ type: 'banner', slot: [0, 2] }],
    baseline: [{ type: 'archer', slot: [0, 2] }],
  },
  { id: 'crossbow-armored', intent: '석궁탑 · 단단한 정예', stream: 'armored', subject: [{ type: 'crossbow', slot: C }], baseline: [{ type: 'archer', slot: C }], required: false },
  { id: 'lightning-dense', intent: '번개탑 · 밀집', stream: 'dense', subject: [{ type: 'lightning', slot: C }], baseline: [{ type: 'archer', slot: C }], required: false },
  { id: 'guardian-line', intent: '수호기사 · 기본 줄', stream: 'line', subject: [{ type: 'guardian', slot: C }], baseline: [{ type: 'archer', slot: C }], required: false },
  { id: 'frost-line', intent: '서리탑 · 기본 줄(보조, 직접 피해만)', stream: 'line', subject: [{ type: 'frost', slot: C }], baseline: [{ type: 'archer', slot: C }], required: false },
];

/** 15% 기준(PRD §7.5 ①). */
export const REQUIRED_RATIO = 1.15;

export function runComparisons(list: Comparison[] = COMPARISONS, balance: Balance = BALANCE) {
  return list.map(c => {
    const stream = STREAMS[c.stream];
    const base = c.shared ? measure(c.shared, stream, balance) : { damage: 0, gold: 0 };
    const total = (p: Placement[]) => { const m = measure([...(c.shared ?? []), ...p], stream, balance); return { damage: m.damage - base.damage, gold: m.gold - base.gold }; };
    const a = total(c.subject);
    const b = total(c.baseline);
    // 더한 골드 100당 늘어난 피해를 같은 상황의 궁수와 비교한다.
    const ratio = (a.damage / a.gold) / (b.damage / b.gold);
    return { id: c.id, intent: c.intent, required: c.required, subjectPer100: Math.round((a.damage / a.gold) * 100 / 1000), baselinePer100: Math.round((b.damage / b.gold) * 100 / 1000), gold: [a.gold, b.gold], ratio: Math.round(ratio * 100) / 100, pass: ratio >= REQUIRED_RATIO };
  });
}

import { TOWER_IDS, type Balance, type EliteId, type EnemyKind, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import { msToTicks } from '../../src/domain/num';
import { advanceTick, applyCommand, createRun } from '../../src/domain/run';
import { buildCost, upgradeCost } from '../../src/domain/towers';
import { coverage, simContext } from './balanceSim';

// S11 타워 효율(PRD §7.5 수용 기준 ①): 각 타워가 ‘의도한 상황’에서 같은 골드의 궁수보다 15% 이상 효율이 높은가.
// 제품 domain 엔진으로, 죽지 않는 적 줄을 정한 간격으로 한 번 통과시키며 타워(묶음)가 준 피해(직접+화상)를 골드로 나눈다.
// 적이 죽지 않으므로 처치 보상·표적 바뀜이 섞이지 않고, 같은 줄을 다른 타워에 똑같이 보낸다.

export interface Placement { type: TowerId; slot: [number, number]; level?: number; form?: FormId }
export interface Stream {
  kind: EnemyKind; elite: EliteId | null; count: number; spacingMs: number;
  /** 있으면 이 순서를 되풀이해 줄을 만든다(분열 몸통 + 새끼처럼 섞인 줄). kind·elite는 대표값이다. */
  pattern?: ReadonlyArray<{ kind: EnemyKind; elite: EliteId | null }>;
}

export const STREAMS = {
  /** 보통 간격의 기본형 줄. */
  line: { kind: 'walker', elite: null, count: 24, spacingMs: 950 },
  /** 촘촘한 밀집(포탑·화염·번개의 의도). */
  dense: { kind: 'walker', elite: null, count: 40, spacingMs: 300 },
  /** 물리 저항 35% 껍질형(마법탑의 의도). */
  shell: { kind: 'shell', elite: null, count: 24, spacingMs: 950 },
  /** 물리 저항이 더해진 단단한 정예(마법탑·석궁의 의도). */
  armored: { kind: 'walker', elite: 'armored', count: 24, spacingMs: 950 },
  /** 드문 대장(정예·대장 배율 형태의 의도). */
  boss: { kind: 'boss', elite: null, count: 6, spacingMs: 2500 },
  /** 비행 줄(리뉴얼 flyer: 대공·비행 배율 형태의 의도). 지상 전용 타워는 0이다. */
  air: { kind: 'flyer', elite: null, count: 24, spacingMs: 950 },
  /** B0 상성표용 역할 줄: 빠름·튼튼·마법저항·떼·분열. 기본 간격 950ms(떼는 촘촘한 300ms, 40기). */
  runner: { kind: 'runner', elite: null, count: 24, spacingMs: 950 },
  brute: { kind: 'brute', elite: null, count: 24, spacingMs: 950 },
  wisp: { kind: 'wisp', elite: null, count: 24, spacingMs: 950 },
  swarm: { kind: 'swarm', elite: null, count: 40, spacingMs: 300 },
  /** 분열: 몸통 하나 뒤에 새끼 둘이 따라온다(죽지 않는 줄이라 실제 분열은 일어나지 않아, 분열 뒤의 떼를 이렇게 흉내 낸다). */
  splitter: { kind: 'splitter', elite: null, count: 36, spacingMs: 400, pattern: [{ kind: 'splitter', elite: null }, { kind: 'splitling', elite: null }, { kind: 'splitling', elite: null }] },
  /** 빠른 정예(swift). */
  swift: { kind: 'walker', elite: 'swift', count: 24, spacingMs: 950 },
} satisfies Record<string, Stream>;

export type StreamName = keyof typeof STREAMS;

/** 적 역할 9종(PRD §7.1 상성표 열)과 그 역할을 재는 줄. 종족 특성 열은 B3에서 더한다. */
export const ROLE_STREAMS = {
  walker: 'line', runner: 'runner', brute: 'brute', shell: 'shell', swarm: 'swarm', wisp: 'wisp', flyer: 'air', splitter: 'splitter', boss: 'boss',
} as const satisfies Record<string, StreamName>;
export const ROLES = Object.keys(ROLE_STREAMS) as Array<keyof typeof ROLE_STREAMS>;
/** 유틸 타워 6종(PRD §7.1): 직접 피해보다 남을 돕는 몫으로 판정한다. */
export const UTILITY_TOWERS: readonly TowerId[] = ['frost', 'wind', 'bell', 'banner', 'alchemist', 'guardian'];

/** 놓인 타워 묶음이 줄 하나에 준 총피해(milli-HP)와 들인 골드. */
export function measure(placements: Placement[], stream: Stream, balance: Balance = BALANCE, mapId = 'garden_u'): { damage: number; gold: number } {
  const ctx = simContext(mapId, 'Normal', balance);
  const s = createRun(ctx, {
    runId: 'eff', playerId: 'sim', nickname: '효율', grade: 3, difficulty: 'Normal', mapId: ctx.map.id, seed: 1,
    bankId: 'sim', bankVersion: 'sim', contentMode: 'development', availableTowers: [...TOWER_IDS], rankingEligibility: 'personal', createdAt: '2026-10-29T00:00:00.000Z',
  });
  // 문항 흐름은 효율과 무관하므로 건너뛰고 거래 단계에서 시작한다. 성문이 무너지지 않게 한다.
  s.phase = 'BUILD'; s.quiz.current = null; s.quiz.feedback = null;
  s.owned = [...TOWER_IDS];
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
    t.form = p.form ?? 'base';
  }
  const r = applyCommand(ctx, s, { type: 'startBattle' });
  if (!r.ok) throw new Error(`전투 시작 실패: ${r.error}`);
  const battle = s.battle!;
  battle.spawnList = Array.from({ length: stream.count }, (_, i) => (stream.pattern ? { ...stream.pattern[i % stream.pattern.length]! } : { kind: stream.kind, elite: stream.elite }));
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

/** 15% 기준(PRD §7.5 ①). 유틸이 아닌 공격 타워는 적어도 한 역할에서 같은 골드의 궁수보다 이만큼 이상 세야 한다. */
export const REQUIRED_RATIO = 1.15;

/**
 * 맵의 기준 칸: 정원 맵의 (8,2) 길목(두 길을 1칸 거리에서 덮는 칸, 사거리 1.3·1.8·2.5칸 안 경로 길이 3.4·5.8·9.0칸)과 가장 닮은 칸.
 * 정원 맵은 예전 표와 견주려고 (8,2)로 못 박는다. 같은 칸에서 같은 줄로 견준다.
 */
export function referenceSlot(mapId: string, balance: Balance = BALANCE): [number, number] {
  if (mapId === 'garden_u') return [8, 2];
  const ctx = simContext(mapId, 'Normal', balance);
  const cache = new Map<string, number>();
  const distance = (id: string) => Math.abs(coverage(ctx, id, 1300, cache) - 3.4) + Math.abs(coverage(ctx, id, 1800, cache) - 5.8) + Math.abs(coverage(ctx, id, 2500, cache) - 9);
  const best = [...ctx.map.slots].sort((a, b) => distance(a.id) - distance(b.id) || a.id.localeCompare(b.id))[0]!;
  return [best.x, best.y];
}

export interface MatrixRow {
  tower: TowerId;
  /** 100골드당 준 피해(HP). 직접 공격이 없는 타워(깃발)는 0이다. */
  per100: Record<Role, number>;
  /** 같은 줄·같은 칸의 궁수 대비. */
  ratio: Record<Role, number>;
  best: { role: Role; ratio: number };
  worst: { role: Role; ratio: number };
  attacks: boolean;
  utility: boolean;
  /** 판정 대상(유틸이 아닌 궁수 외 공격 타워)이면 best ≥ REQUIRED_RATIO, 아니면 null. */
  pass: boolean | null;
}
export type Role = (typeof ROLES)[number];

/**
 * 상성표(PRD §7.3 B0): 타워 20종 하나씩을 Lv1 기본형으로 맵의 기준 칸에 놓고 적 역할 9종 줄을 한 번씩 통과시켜,
 * 100골드당 준 피해를 같은 칸 궁수와 견준다. 예전의 손으로 고른 10종 비교(필수 5·참고 5)를 대신한다.
 * level·form을 주면 그 단계 타워로 잰다(형태 비교용).
 */
export function runMatrix(balance: Balance = BALANCE, o: { mapId?: string; towers?: readonly TowerId[]; level?: number; form?: FormId } = {}): MatrixRow[] {
  const mapId = o.mapId ?? 'garden_u';
  const slot = referenceSlot(mapId, balance);
  const per100Of = (type: TowerId, stream: Stream) => {
    const m = measure([{ type, slot, ...(o.level ? { level: o.level } : {}), ...(o.form ? { form: o.form } : {}) }], stream, balance, mapId);
    return (m.damage / m.gold) * 100 / 1000;
  };
  const archer = Object.fromEntries(ROLES.map(r => [r, per100Of('archer', STREAMS[ROLE_STREAMS[r]])])) as Record<Role, number>;
  return (o.towers ?? TOWER_IDS).map(tower => {
    const attacks = balance.towers[tower].damageType !== 'none';
    const per100 = Object.fromEntries(ROLES.map(r => [r, attacks ? per100Of(tower, STREAMS[ROLE_STREAMS[r]]) : 0])) as Record<Role, number>;
    const ratio = Object.fromEntries(ROLES.map(r => [r, archer[r] > 0 ? per100[r] / archer[r] : 0])) as Record<Role, number>;
    const ranked = [...ROLES].sort((x, y) => ratio[y] - ratio[x]);
    const best = { role: ranked[0]!, ratio: ratio[ranked[0]!] };
    const worst = { role: ranked.at(-1)!, ratio: ratio[ranked.at(-1)!] };
    const utility = UTILITY_TOWERS.includes(tower);
    return { tower, per100, ratio, best, worst, attacks, utility, pass: tower === 'archer' || utility || !attacks ? null : best.ratio >= REQUIRED_RATIO };
  });
}

/** 형태 비교의 기준 칸: 정원 맵 (8,2) 길목(1행·3행 길을 모두 1칸 거리에서 덮는다). 옆 칸 (8,0)에 같은 단계 궁수를 둔다. */
const C: [number, number] = [8, 2];

/** 형태 비교에 쓰는 줄(progression.md §6 ③). */
export const FORM_STREAMS = ['line', 'dense', 'shell', 'armored', 'boss', 'air'] as const satisfies ReadonlyArray<keyof typeof STREAMS>;
/** 같은 단계 형태가 모든 줄에서 형제 형태보다 이만큼 이상 세면 ‘압도’로 본다. */
export const DOMINANCE_RATIO = 1.1;

const TIERS = [
  { tier: 1, level: 4, forms: ['A', 'B'] },
  { tier: 2, level: 7, forms: ['A1', 'A2', 'B1', 'B2'] },
] as const satisfies ReadonlyArray<{ tier: number; level: number; forms: readonly FormId[] }>;

/**
 * 형태 하나가 줄 하나에 더한 피해(milli-HP). 깃발은 같은 단계 궁수 셋 묶음 위에, 그 밖은 (8,2) 길목에 두고 옆 칸 (8,0)의 같은 단계 궁수
 * 하나 위에 더해 늘어난 피해를 잰다. 감속·밀치기(궁수 사거리 안 체류), 취약·저항 차감, 사거리·속도 오라처럼 남을 돕는 몫까지 들어간다.
 */
function formDamage(type: TowerId, level: number, form: FormId, stream: Stream, balance: Balance): number {
  const archer = (slot: [number, number]): Placement => ({ type: 'archer', slot, level, form: form.length === 1 ? 'A' : 'A1' });
  const shared = type === 'banner' ? [archer([0, 0]), archer([0, 4]), archer([2, 2])] : [archer([8, 0])];
  const subject: Placement = { type, slot: type === 'banner' ? [0, 2] : C, level, form };
  const base = shared.length ? measure(shared, stream, balance).damage : 0;
  return measure([...shared, subject], stream, balance).damage - base;
}

/**
 * 타워마다 1차형(Lv4 A·B)과 2차형(Lv7 A1~B2)을 같은 줄들에 견준다. 같은 단계는 비용이 같아 피해를 그대로 견준다.
 * 압도: 모든 줄에서 같은 단계의 다른 형태 모두보다 DOMINANCE_RATIO배 이상인 형태. 열세(참고): 모든 줄에서 어떤 형제보다 그만큼 약한 형태.
 */
export function runFormComparisons(balance: Balance = BALANCE, towers: readonly TowerId[] = TOWER_IDS) {
  return towers.flatMap(type => TIERS.map(({ tier, level, forms }) => {
    const damage = Object.fromEntries(forms.map(f => [f, FORM_STREAMS.map(st => formDamage(type, level, f, STREAMS[st], balance))])) as Record<string, number[]>;
    const beats = (a: string, b: string) => FORM_STREAMS.every((_, i) => damage[a]![i]! >= DOMINANCE_RATIO * damage[b]![i]!);
    const dominant = forms.filter(f => forms.every(o => o === f || beats(f, o)));
    const weak = forms.filter(f => forms.some(o => o !== f && beats(o, f)));
    // 줄마다 그 단계 최고 형태 대비 비율의 평균(1이면 모든 줄에서 최고).
    const best = FORM_STREAMS.map((_, i) => Math.max(...forms.map(f => damage[f]![i]!)));
    const score = Object.fromEntries(forms.map(f => [f, Math.round((FORM_STREAMS.reduce((a, _, i) => a + (best[i]! > 0 ? damage[f]![i]! / best[i]! : 1), 0) / FORM_STREAMS.length) * 100) / 100]));
    return { type, tier, level, score, damage, dominant, weak, pass: dominant.length === 0 };
  }));
}

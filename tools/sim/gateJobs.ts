import { FORM_IDS, TOWER_IDS, type Balance, type DifficultyId, type FormId, type TowerId } from '../../src/contracts/balance';
import { BALANCE, MAPS } from '../../src/content';
import { upgradeCost } from '../../src/domain/towers';
import { withOverrides } from './balanceSim';
import { CORE4, FAST_TUNING, FULL_TUNING, runBot, type BotName, type RunSpec, type RunSummary } from './bots';
import { measure, referenceSlot, runMatrix, STREAMS, UTILITY_TOWERS, type MatrixRow } from './towerEfficiency';

// 관문(simulate:gate) 작업 목록과 실행. 작업은 JSON으로 주고받아 워커 스레드에 나눠 돌린다. 모든 작업이 seed로 결정적이다.

export type GateMode = 'fast' | 'full';

export const MAP_IDS: readonly string[] = MAPS.map(m => m.id);
export const ACCURACIES = [0.5, 0.6, 0.8, 0.95] as const;
export const UTILITY_SYNERGY: readonly TowerId[] = UTILITY_TOWERS;
/** 단일 타워 판 대상: 20종 모두(깃발은 공격하지 않아 W1에 지는 것이 정상이라 판정에서 뺀다). */
export const MONO_TOWERS: readonly TowerId[] = TOWER_IDS;

export type GateJob =
  | { kind: 'run'; spec: RunSpec }
  | { kind: 'matrix'; mapId: string }
  | { kind: 'efficiency'; tower: TowerId };

export type GateResult =
  | { kind: 'run'; summary: RunSummary }
  | { kind: 'matrix'; mapId: string; rows: MatrixRow[] }
  | { kind: 'efficiency'; row: EfficiencyRow };

export interface PlanOptions { mode: GateMode; seeds: number; maps?: readonly string[] }

/** 작업 목록. 무거운 것(최적화형)을 앞에 둬서 워커가 고르게 끝나게 한다. */
export function planJobs(o: PlanOptions): GateJob[] {
  const maps = o.maps ?? MAP_IDS;
  const tuning = o.mode === 'full' ? FULL_TUNING : FAST_TUNING;
  const jobs: GateJob[] = [];
  const cells = (bot: BotName, difficulty: DifficultyId, accs: readonly number[], extra: Partial<RunSpec> = {}) => {
    for (const acc of accs) for (const map of maps) for (let seed = 1; seed <= o.seeds; seed++) jobs.push({ kind: 'run', spec: { bot, map, difficulty, acc, seed, tuning, ...extra } });
  };
  // 최적화형(가장 무겁다): 빠른 모드는 80·95%만, 전체 모드는 네 정답률 모두.
  cells('optimizer', 'Normal', o.mode === 'full' ? ACCURACIES : [0.8, 0.95]);
  cells('novice', 'Normal', ACCURACIES);
  cells('balanced', 'Normal', ACCURACIES);
  cells('counter', 'Normal', ACCURACIES);
  cells('focused', 'Normal', [0.8]);
  for (const t of MONO_TOWERS) cells(`mono-${t}`, 'Normal', o.mode === 'full' ? [0.6, 0.8, 0.95] : [0.8]);
  cells('core4', 'Normal', [0.8]);
  for (const u of UTILITY_SYNERGY) cells(`core4+${u}`, 'Normal', [0.8]);
  // 난이도 간격: 균형형 80%, 어려움·아주 어려움 초보형 60%의 1웨이브 패배.
  for (const d of ['Easy', 'Hard', 'Crazy'] as const) cells('balanced', d, [0.8]);
  for (const d of ['Hard', 'Crazy'] as const) cells('novice', d, [0.6]);
  cells('novice', 'Easy', [0.5]);
  if (o.mode === 'full') { cells('novice', 'Easy', [0.6, 0.8]); for (const d of ['Easy', 'Hard', 'Crazy'] as const) cells('balanced', d, [0.6, 0.95]); }
  for (const mapId of maps) jobs.push({ kind: 'matrix', mapId });
  for (const tower of TOWER_IDS) jobs.push({ kind: 'efficiency', tower });
  return jobs;
}

export function runJob(job: GateJob, balance: Balance = BALANCE): GateResult {
  switch (job.kind) {
    case 'run': return { kind: 'run', summary: runBot({ ...job.spec, balance }) };
    case 'matrix': return { kind: 'matrix', mapId: job.mapId, rows: runMatrix(balance, { mapId: job.mapId }) };
    case 'efficiency': return { kind: 'efficiency', row: upgradeEfficiency(balance, job.tower) };
  }
}

// ── 강화 효율 ──────────────────────────────────────────────────────────────────────────────

export interface EfficiencyRow {
  tower: TowerId;
  /** 고른 2차형(갈래). 직접 공격이 없으면 null. */
  path: FormId | null;
  /** Lv n → n+1(n = 1..9)의 강화 1골드당 늘어난 피해 ÷ 새 Lv1 설치 1골드당 피해. 계산 못 하면 null. */
  ratios: Array<number | null>;
  /** 누적 비율: Lv1→6 전체(강화 비용 합 대비 늘어난 피해 ÷ 새 Lv1 설치 1골드당 피해)와 Lv7→9. 진화 도약을 포함한 판정용 값. */
  span: { early: number | null; late: number | null };
  /** 새 Lv1 설치의 피해(HP, 기준 줄 평균). */
  baseDamage: number;
  note?: string;
}

/** 강화 효율에 쓰는 줄: 일반 줄·밀집·껍질형의 평균(특정 상황 전문 타워가 한쪽에 쏠려 보이지 않게). */
const EFFICIENCY_STREAMS = ['line', 'dense', 'shell'] as const;
const MAX_TRANSITION = 9;

/** 레벨 level에서 쓰는 형태: 3 이하 기본형, 4~6 1차형, 7 이상 2차형(leaf). */
function formAt(level: number, leaf: FormId): FormId {
  if (level < BALANCE.levels.evolveAt[0]) return 'base';
  if (level < BALANCE.levels.evolveAt[1]) return leaf[0] as FormId;
  return leaf;
}

export function upgradeEfficiency(balance: Balance, tower: TowerId): EfficiencyRow {
  const empty = (note: string): EfficiencyRow => ({ tower, path: null, ratios: Array.from({ length: MAX_TRANSITION }, () => null), span: { early: null, late: null }, baseDamage: 0, note });
  if (balance.towers[tower].damageType === 'none') return empty('직접 공격 없음');
  const slot = referenceSlot('garden_u', balance);
  const damage = (level: number, form: FormId) => EFFICIENCY_STREAMS.reduce((a, st) => a + measure([{ type: tower, slot, level, form }], STREAMS[st], balance).damage, 0) / EFFICIENCY_STREAMS.length;
  const leaves = (['A1', 'A2', 'B1', 'B2'] as const).filter(f => FORM_IDS.includes(f));
  // 대표 갈래: Lv7에서 가장 센 2차형(최적화형이 고를 만한 길).
  const leaf = leaves.reduce((best, f) => (damage(balance.levels.evolveAt[1], f) > damage(balance.levels.evolveAt[1], best) ? f : best));
  const d1 = damage(1, 'base');
  if (d1 <= 0) return empty('Lv1 피해 0');
  const buildGold = balance.towers[tower].cost;
  const fresh = d1 / buildGold;
  const ratios: Array<number | null> = [];
  const dmg = new Map<number, number>();
  const damageAt = (level: number) => { if (!dmg.has(level)) dmg.set(level, damage(level, formAt(level, leaf))); return dmg.get(level)!; };
  for (let n = 1; n <= MAX_TRANSITION; n++) {
    const cost = upgradeCost(balance, tower, n);
    if (cost === null) { ratios.push(null); continue; }
    ratios.push((damageAt(n + 1) - damageAt(n)) / cost / fresh);
  }
  // 누적: 레벨 구간 전체를 올리는 데 든 강화비 합 한 골드당 늘어난 피해를 새 설치와 견준다(진화 도약 포함).
  const span = (from: number, to: number) => {
    let cost = 0;
    for (let n = from; n < to; n++) { const c = upgradeCost(balance, tower, n); if (c === null) return null; cost += c; }
    return (damageAt(to) - damageAt(from)) / cost / fresh;
  };
  return { tower, path: leaf, ratios, span: { early: span(1, 6), late: span(7, 9) }, baseDamage: Math.round(d1 / 1000) };
}
export { CORE4, withOverrides };

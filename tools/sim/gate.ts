import { TOWER_IDS, type DifficultyId, type FormId, type TowerId } from '../../src/contracts/balance';
import type { RunSummary } from './bots';
import type { EfficiencyRow } from './gateJobs';
import { ROLES, UTILITY_TOWERS, type MatrixRow, type Role } from './towerEfficiency';

// 관문(PRD §7.1) 집계와 판정. 실행(워커)과 분리된 순수 함수라서 시험이 가짜 지표로 줄별 판정을 확인할 수 있다.
// 가상 플레이어 기준이며 학생 실측이 아니다. "4개 맵 평균"은 맵마다 중앙값을 구해 평균한 값(mapAvg)이다.

export type Status = 'PASS' | 'FAIL' | 'N/A';
export interface GateRow { id: string; group: string; label: string; target: string; measured: string; status: Status; value: number | null }

export interface Dataset {
  runs: RunSummary[];
  /** 맵마다 상성표(Lv1 기본형, 100골드당 피해 비). */
  matrix: Record<string, MatrixRow[]>;
  efficiency: EfficiencyRow[];
}

// ── 통계 도우미 ─────────────────────────────────────────────────────────────────────────────

export const median = (a: readonly number[]): number | null => {
  if (!a.length) return null;
  const v = [...a].sort((x, y) => x - y);
  return v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2;
};
export const mean = (a: readonly number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
/** 선형 보간 분위수(q는 0~1). */
export const quantile = (a: readonly number[], q: number): number | null => {
  if (!a.length) return null;
  const v = [...a].sort((x, y) => x - y);
  const at = q * (v.length - 1);
  const lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo]! + (v[hi]! - v[lo]!) * (at - lo);
};
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
const round = (x: number | null, d = 2) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

export const cellKey = (difficulty: DifficultyId, bot: string, acc: number) => `${difficulty}|${bot}|${acc}`;

export interface Index { cells: Map<string, RunSummary[]>; errors: number; total: number }

/** 셀(난이도·봇·정답률)별로 묶는다. 엔진 수치 한계로 끊긴 판은 제외하고 개수만 센다. */
export function indexRuns(runs: readonly RunSummary[]): Index {
  const cells = new Map<string, RunSummary[]>();
  let errors = 0;
  for (const r of runs) {
    if (r.engineError) { errors++; continue; }
    const k = cellKey(r.difficulty, r.bot, r.acc);
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(r);
  }
  return { cells, errors, total: runs.length };
}

const get = (ix: Index, d: DifficultyId, bot: string, acc: number): RunSummary[] => ix.cells.get(cellKey(d, bot, acc)) ?? [];

/** 맵마다 도달 웨이브 중앙값을 구해 평균한 값(PRD "4개 맵 평균"). */
export function mapAvg(runs: readonly RunSummary[]): { avg: number | null; byMap: Record<string, number> } {
  const maps = [...new Set(runs.map(r => r.map))];
  const byMap = Object.fromEntries(maps.map(m => [m, median(runs.filter(r => r.map === m).map(r => r.completedWave))!]));
  return { avg: mean(Object.values(byMap)), byMap };
}

const gateFrac = (r: RunSummary, wave: number) => Math.min(1, (r.waves[wave - 1]?.[0] ?? 0) / r.gateMax);

// ── 지표 ───────────────────────────────────────────────────────────────────────────────────

export interface CellStat {
  n: number;
  mapAvg: number | null;
  byMap: Record<string, number>;
  median: number | null;
  p10: number | null;
  p90: number | null;
  /** 웨이브 w를 지킨 판의 비율(w = 1..). */
  survival: number[];
  capped: number;
  minutes: number | null;
  waveMinutes: number | null;
}

export function cellStat(runs: readonly RunSummary[], cap = 60): CellStat {
  const waves = runs.map(r => r.completedWave);
  const m = mapAvg(runs);
  const top = Math.min(cap, Math.max(0, ...waves));
  const survival = Array.from({ length: top }, (_, i) => (runs.length ? waves.filter(w => w >= i + 1).length / runs.length : 0));
  // 웨이브 1개 길이: 끝낸 웨이브들의 걸린 분(준비 문제 포함)을 판마다 평균한 값의 평균.
  const perRun = runs.map(r => mean(r.waves.filter(w => w[8] === 1).map(w => w[7]))).filter((x): x is number => x !== null);
  return { n: runs.length, mapAvg: m.avg, byMap: m.byMap, median: median(waves), p10: quantile(waves, 0.1), p90: quantile(waves, 0.9), survival, capped: runs.filter(r => r.endReason === 'WAVE_CAP').length, minutes: median(runs.map(r => r.minutes)), waveMinutes: mean(perRun) };
}

/** W1~upTo 웨이브에서 패배한 판의 비율(웨이브 upTo 안에서 졌으면 도달 웨이브가 upTo-1 이하). */
export const lossBy = (runs: readonly RunSummary[], upTo: number): number | null =>
  runs.length ? runs.filter(r => r.endReason === 'DEFEAT' && r.completedWave < upTo).length / runs.length : null;

/** W1~upTo 평균 성문 피해(최대 체력 대비, 판마다 치른 웨이브의 평균을 다시 평균). */
export function gateEarly(runs: readonly RunSummary[], upTo = 8): number | null {
  const per = runs.map(r => mean(Array.from({ length: Math.min(upTo, r.waves.length) }, (_, i) => gateFrac(r, i + 1)))).filter((x): x is number => x !== null);
  return mean(per);
}

/** 패배한 판 중 직전 2웨이브(패배 웨이브 바로 앞 두 웨이브) 가운데 하나가 성문 50% 이상이었던 비율. 직전 2웨이브가 없는 판(W2 이전 패배)은 뺀다. */
export function gradualDeath(runs: readonly RunSummary[]): { share: number | null; defeats: number } {
  const lost = runs.filter(r => r.endReason === 'DEFEAT' && r.completedWave >= 2);
  const hit = lost.filter(r => Math.max(gateFrac(r, r.completedWave), gateFrac(r, r.completedWave - 1)) >= 0.5).length;
  return { share: lost.length ? hit / lost.length : null, defeats: lost.length };
}

/** 사망 웨이브(=도달+1)가 보스 웨이브인 패배의 비율. */
export function bossDeathShare(runs: readonly RunSummary[], every = 5): { share: number | null; defeats: number } {
  const lost = runs.filter(r => r.endReason === 'DEFEAT');
  return { share: lost.length ? lost.filter(r => (r.completedWave + 1) % every === 0).length / lost.length : null, defeats: lost.length };
}

/** 보스 웨이브 w의 처치율. reached: 그 웨이브에 들어선 판 중 보스를 잡은 비율(보스가 나오기 전에 진 판은 실패). event: 보스가 나온 판 중 잡은 비율. */
export function bossKill(runs: readonly RunSummary[], wave: number): { reached: number | null; event: number | null; n: number } {
  const entered = runs.filter(r => r.completedWave >= wave - 1);
  const killed = entered.filter(r => r.bosses.some(b => b[0] === wave && b[1] === 1)).length;
  const seen = entered.filter(r => r.bosses.some(b => b[0] === wave));
  return {
    reached: entered.length ? killed / entered.length : null,
    event: seen.length ? seen.filter(r => r.bosses.some(b => b[0] === wave && b[1] === 1)).length / seen.length : null,
    n: entered.length,
  };
}

export interface Income { answer: number; kill: number; boss: number; milestone: number; aura: number; total: number; answerShare: number | null; perWave: number | null }
/** W1~upTo 수입 구성(시작 골드 제외). */
export function income(runs: readonly RunSummary[], upTo = 20): Income {
  const rows = runs.flatMap(r => r.waves.slice(0, upTo));
  const col = (i: number) => sum(rows.map(w => w[i]!));
  const answer = col(2), kill = col(3), boss = col(4), milestone = col(5), aura = col(6);
  const total = answer + kill + boss + milestone + aura;
  return { answer, kill, boss, milestone, aura, total, answerShare: total > 0 ? answer / total : null, perWave: rows.length ? total / rows.length : null };
}

export const firstEvoMedian = (runs: readonly RunSummary[]): number | null => median(runs.map(r => r.firstEvoWave ?? 99));

// ── 지표 묶음 ──────────────────────────────────────────────────────────────────────────────

export interface BranchRate { tower: TowerId; branch: 'Lv4' | 'Lv7-A' | 'Lv7-B'; shares: Record<string, number>; n: number; ok: boolean }
export interface UtilityRow {
  tower: TowerId; waveDelta: number | null; gateDelta: number | null; pass: boolean | null; n: number;
  coreWaves: number | null; withWaves: number | null; coreGate: number | null; withGate: number | null;
}
export interface TowerRoleRow { tower: TowerId; strongRole: Role; strong: number; weakRole: Role; weak: number; ok: boolean }

export interface Metrics {
  seeds: number;
  engineErrors: number;
  runs: number;
  // 보통 곡선
  novice60: number | null; balanced80: number | null; optimizer95: number | null; optimizer80: number | null; balanced60: number | null; balanced95: number | null; monoArcher80: number | null;
  monoWaves: Partial<Record<TowerId, number>>;
  balanced80Spread: { p10: number | null; p90: number | null; width: number | null };
  mapSpread: number | null;
  novice50Early: number | null;
  gateEarly: number | null;
  gradual: { share: number | null; defeats: number };
  /** 모든 전략(초보·균형·상성·최적화·궁수 집중) × 정답률 60·80·95% 패배를 합친 값(PRD §1.3의 37%와 같은 정의). */
  bossDeath: { share: number | null; defeats: number; balanced80: number | null };
  bossKill: Record<number, { reached: number | null; event: number | null; n: number }>;
  waveMinutes: number | null;
  answerShare: number | null;
  // 난이도 간격
  diffWaves: Partial<Record<DifficultyId, number>>;
  w1Loss: Partial<Record<DifficultyId, number | null>>;
  // 성장
  firstEvo: number | null;
  w20: { lv7: number | null; n: number; source: string };
  effEarly: number | null; effLate: number | null;
  branches: BranchRate[]; branchLowN: number;
  // 타워 균형
  counterStrong: Record<Role, { count: number; towers: TowerId[] }>;
  towerRoles: TowerRoleRow[];
  pickShare: Partial<Record<TowerId, number>>; pickRuns: number;
  /** 징집 선택률(측정 정의 보정 B2): 최적화형 판에서 후보로 나온 횟수와 그때 고른 횟수. 시작 타워는 후보에 안 나와 없다. */
  draftPicks: Partial<Record<TowerId, { offered: number; picked: number }>>;
  utility: UtilityRow[];
  /** 유틸 시너지의 성문 피해를 재는 웨이브 창(1~이 값). */
  utilityWindow: number;
}

export const BRANCH_MIN_N = 10;
/** 징집 선택률을 판정할 최소 후보 횟수(그보다 적으면 표본 부족으로 뺀다). */
export const DRAFT_MIN_N = 10;
/** 상성표(한 번 지나가는 줄) 대신 실제 판 지표로만 보는 타워: 덫은 미리 깔린 덫·웨이브 이월을 상성표가 못 본다(측정 정의 보정 B2). */
export const MATRIX_EXEMPT: readonly TowerId[] = ['trap'];
/** 유틸 시너지 판정: 웨이브 +1.5 이상 또는 성문 피해 -25% 이상. */
export const UTILITY_WAVE_GAIN = 1.5;
export const UTILITY_GATE_DROP = -0.25;
export const STRONG_COUNTER = 1.4;
export const STRONG_ROLE = 1.35;
export const WEAK_ROLE = 0.8;

export function computeMetrics(data: Dataset, seeds: number): Metrics {
  const ix = indexRuns(data.runs);
  const N = (bot: string, acc: number, d: DifficultyId = 'Normal') => get(ix, d, bot, acc);
  const wavesOf = (runs: readonly RunSummary[]) => mapAvg(runs).avg;

  const bal80 = N('balanced', 0.8);
  const monoWaves: Partial<Record<TowerId, number>> = {};
  for (const t of TOWER_IDS) { const w = wavesOf(N(`mono-${t}`, 0.8)); if (w !== null) monoWaves[t] = w; }

  const diffWaves: Partial<Record<DifficultyId, number>> = {};
  for (const d of ['Easy', 'Normal', 'Hard', 'Crazy'] as const) { const w = wavesOf(get(ix, d, 'balanced', 0.8)); if (w !== null) diffWaves[d] = w; }

  // W20 판: 최적화형 95%에서 20웨이브를 지킨 판. 모자라면 정답률 80% 이상의 모든 보통 판.
  const pool = (runs: readonly RunSummary[]) => runs.filter(r => r.snap20);
  let w20Runs = pool(N('optimizer', 0.95)), w20Source = '최적화형 95%';
  if (w20Runs.length < 5) { w20Runs = pool(data.runs.filter(r => r.difficulty === 'Normal' && r.acc >= 0.8 && !r.engineError && !r.bot.startsWith('mono-'))); w20Source = '보통·정답률 80% 이상 모든 봇(단일 타워 제외)'; }
  const w20 = { lv7: median(w20Runs.map(r => r.snap20!.filter(t => t[1] >= 7).length)), n: w20Runs.length, source: w20Source };

  // 강화 효율: 공격 타워마다 Lv1→6·Lv7→9 구간 전체의 누적 비율(진화 도약 포함)을 구해 타워 중앙값.
  const effOf = (key: 'early' | 'late') => median(data.efficiency.filter(e => e.path !== null).map(e => e.span[key]).filter((x): x is number => x !== null));

  // 최적화형 갈래 선택률(옛 사용 기록은 모든 최적화형 셀을 합친다).
  const optRuns = data.runs.filter(r => r.bot === 'optimizer' && r.difficulty === 'Normal' && !r.engineError);
  const branches: BranchRate[] = [];
  let branchLowN = 0;
  for (const tower of TOWER_IDS) {
    const picks = optRuns.flatMap(r => r.upgrades.filter(u => u[0] === tower && u[2] !== null).map(u => u[2] as FormId));
    const count = (f: FormId) => picks.filter(x => x === f).length;
    const groups: Array<[BranchRate['branch'], FormId[]]> = [['Lv4', ['A', 'B']], ['Lv7-A', ['A1', 'A2']], ['Lv7-B', ['B1', 'B2']]];
    for (const [branch, forms] of groups) {
      const total = sum(forms.map(count));
      if (total < BRANCH_MIN_N) { branchLowN++; continue; }
      const shares = Object.fromEntries(forms.map(f => [f, count(f) / total]));
      branches.push({ tower, branch, shares, n: total, ok: forms.every(f => shares[f]! >= 0.35 && shares[f]! <= 0.65) });
    }
  }

  // 상성표: 맵 평균 비율.
  const maps = Object.keys(data.matrix);
  const ratio = (tower: TowerId, role: Role) => mean(maps.map(m => data.matrix[m]!.find(r => r.tower === tower)?.ratio[role]).filter((x): x is number => x !== undefined)) ?? 0;
  const attackers = TOWER_IDS.filter(t => t !== 'archer' && !MATRIX_EXEMPT.includes(t) && maps.length > 0 && data.matrix[maps[0]!]!.find(r => r.tower === t)?.attacks);
  const counterStrong = Object.fromEntries(ROLES.map(role => {
    const towers = attackers.filter(t => ratio(t, role) >= STRONG_COUNTER);
    return [role, { count: towers.length, towers }];
  })) as Metrics['counterStrong'];
  // 강점·약점 줄은 공격 타워만 본다: 유틸 6종은 유틸 시너지 줄로만 판정한다(측정 정의 보정 B2).
  const towerRoles: TowerRoleRow[] = attackers.filter(t => !UTILITY_TOWERS.includes(t)).map(tower => {
    const ranked = [...ROLES].sort((a, b) => ratio(tower, b) - ratio(tower, a));
    const strongRole = ranked[0]!, weakRole = ranked.at(-1)!;
    return { tower, strongRole, strong: ratio(tower, strongRole), weakRole, weak: ratio(tower, weakRole), ok: ratio(tower, strongRole) >= STRONG_ROLE && ratio(tower, weakRole) <= WEAK_ROLE };
  });

  // 최적화형 선택률: 설치 횟수 점유율.
  const builds: Partial<Record<TowerId, number>> = {};
  for (const r of optRuns) for (const [t, n] of Object.entries(r.builds)) builds[t as TowerId] = (builds[t as TowerId] ?? 0) + (n ?? 0);
  const buildTotal = sum(Object.values(builds));
  const pickShare = Object.fromEntries(TOWER_IDS.map(t => [t, buildTotal ? (builds[t] ?? 0) / buildTotal : 0])) as Partial<Record<TowerId, number>>;
  // 징집 선택률(조건부): 후보로 나왔을 때 고른 비율. 설치 점유는 징집이 4번뿐이라 징집 타워가 구조적으로 낮아 판정에 쓰지 않는다.
  const draftPicks: Metrics['draftPicks'] = {};
  for (const r of optRuns) for (const d of r.drafts) {
    for (const t of d.offers) { const row = (draftPicks[t] ??= { offered: 0, picked: 0 }); row.offered++; if (d.picked === t) row.picked++; }
  }

  // 유틸 시너지(핵심 4종 + 유틸 하나, 정답률 80%). 성문 피해는 핵심 4종 판이 끝까지 가는 구간(W1~핵심 중앙값-1)에서 판마다 평균한다.
  const core = N('core4', 0.8);
  const coreWave = wavesOf(core);
  const gateWindow = Math.max(1, Math.floor(median(core.map(r => r.completedWave)) ?? 8) - 1);
  const coreGate = gateEarly(core, gateWindow);
  const utility: UtilityRow[] = (['frost', 'wind', 'bell', 'banner', 'alchemist', 'guardian'] as const).map(tower => {
    const withRuns = N(`core4+${tower}`, 0.8);
    const w = wavesOf(withRuns), g = gateEarly(withRuns, gateWindow);
    const waveDelta = w !== null && coreWave !== null ? w - coreWave : null;
    const gateDelta = g !== null && coreGate !== null && coreGate > 0 ? (g - coreGate) / coreGate : null;
    const pass = waveDelta === null && gateDelta === null ? null : (waveDelta ?? -Infinity) >= UTILITY_WAVE_GAIN || (gateDelta ?? Infinity) <= UTILITY_GATE_DROP;
    return { tower, waveDelta, gateDelta, pass, n: withRuns.length, coreWaves: coreWave, withWaves: w, coreGate, withGate: g };
  });

  const bal80Stat = cellStat(bal80);
  const mapMedians = Object.values(bal80Stat.byMap);
  return {
    seeds, engineErrors: ix.errors, runs: ix.total,
    novice60: wavesOf(N('novice', 0.6)), balanced80: wavesOf(bal80), optimizer95: wavesOf(N('optimizer', 0.95)), optimizer80: wavesOf(N('optimizer', 0.8)),
    balanced60: wavesOf(N('balanced', 0.6)), balanced95: wavesOf(N('balanced', 0.95)), monoArcher80: wavesOf(N('mono-archer', 0.8)),
    monoWaves,
    balanced80Spread: { p10: bal80Stat.p10, p90: bal80Stat.p90, width: bal80Stat.p10 !== null && bal80Stat.p90 !== null ? bal80Stat.p90 - bal80Stat.p10 : null },
    mapSpread: bal80Stat.mapAvg !== null && mapMedians.length ? Math.max(...mapMedians.map(m => Math.abs(m - bal80Stat.mapAvg!))) : null,
    novice50Early: Math.max(lossBy(N('novice', 0.5), 5) ?? 0, lossBy(get(ix, 'Easy', 'novice', 0.5), 5) ?? 0),
    gateEarly: gateEarly(bal80, 8),
    gradual: gradualDeath(bal80),
    bossDeath: { ...bossDeathShare(['novice', 'balanced', 'counter', 'optimizer', 'focused'].flatMap(b => [0.6, 0.8, 0.95].flatMap(a => N(b, a)))), balanced80: bossDeathShare(bal80).share },
    bossKill: Object.fromEntries([5, 10, 15, 20].map(w => [w, bossKill(bal80, w)])),
    waveMinutes: bal80Stat.waveMinutes,
    answerShare: income(bal80, 20).answerShare,
    diffWaves,
    w1Loss: { Hard: lossBy(get(ix, 'Hard', 'novice', 0.6), 1), Crazy: lossBy(get(ix, 'Crazy', 'novice', 0.6), 1) },
    firstEvo: firstEvoMedian(bal80),
    w20,
    effEarly: effOf('early'), effLate: effOf('late'),
    branches, branchLowN,
    counterStrong, towerRoles,
    pickShare, pickRuns: optRuns.length, draftPicks,
    utility, utilityWindow: gateWindow,
  };
}

// ── 줄별 판정 ──────────────────────────────────────────────────────────────────────────────

const f1 = (x: number | null) => (x === null ? '-' : String(round(x, 1)));
const pct = (x: number | null, d = 0) => (x === null ? '-' : `${round(x * 100, d)}%`);

type Check = { status: Status; measured: string; value: number | null };
const na = (measured = '자료 없음'): Check => ({ status: 'N/A', measured, value: null });
const range = (v: number | null, lo: number, hi: number, fmt: (x: number) => string = x => String(round(x, 1))): Check => (v === null ? na() : { status: v >= lo && v <= hi ? 'PASS' : 'FAIL', measured: fmt(v), value: v });
const atLeast = (v: number | null, lo: number, fmt: (x: number) => string = x => String(round(x, 2))): Check => (v === null ? na() : { status: v >= lo ? 'PASS' : 'FAIL', measured: fmt(v), value: v });
const atMost = (v: number | null, hi: number, fmt: (x: number) => string = x => String(round(x, 2))): Check => (v === null ? na() : { status: v <= hi ? 'PASS' : 'FAIL', measured: fmt(v), value: v });
const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

interface RowDef { id: string; group: string; label: string; target: string; check: (m: Metrics) => Check }

export const ROWS: RowDef[] = [
  // 보통 난이도 곡선
  { id: 'curve.novice60', group: '보통 곡선', label: '초보형 정답률 60% 중앙값', target: '10~12', check: m => range(m.novice60, 10, 12, x => `${f1(x)}`) },
  { id: 'curve.balanced80', group: '보통 곡선', label: '균형형 80% 중앙값', target: '14~17', check: m => range(m.balanced80, 14, 17, x => `${f1(x)}`) },
  { id: 'curve.optimizer95', group: '보통 곡선', label: '최적화형 95% 중앙값', target: '22~26', check: m => range(m.optimizer95, 22, 26, x => `${f1(x)}`) },
  { id: 'curve.skillGap', group: '보통 곡선', label: '초보형 60% → 최적화형 95% 차이', target: '≥ 12', check: m => atLeast(diff(m.optimizer95, m.novice60), 12, x => `${f1(x)}웨이브`) },
  { id: 'curve.accEffect', group: '보통 곡선', label: '정답률 효과(균형형 60% → 95%)', target: '≥ 5', check: m => atLeast(diff(m.balanced95, m.balanced60), 5, x => `${f1(x)}웨이브`) },
  { id: 'curve.strategyEffect', group: '보통 곡선', label: '전략 효과(궁수만 → 최적화형, 80%)', target: '≥ 6', check: m => atLeast(diff(m.optimizer80, m.monoArcher80), 6, x => `${f1(x)}웨이브`) },
  {
    id: 'curve.bestMono', group: '보통 곡선', label: '가장 좋은 단일 타워 판(80%)', target: '≤ 균형형 − 3',
    check: m => {
      const best = Object.entries(m.monoWaves).filter(([t]) => t !== 'banner').sort((a, b) => b[1] - a[1])[0];
      if (!best || m.balanced80 === null) return na();
      return { status: best[1] <= m.balanced80 - 3 ? 'PASS' : 'FAIL', measured: `${best[0]} ${f1(best[1])} (균형형 ${f1(m.balanced80)}, 차 ${f1(m.balanced80 - best[1])})`, value: best[1] };
    },
  },
  { id: 'curve.deathSpread', group: '보통 곡선', label: '균형형 사망 웨이브 폭(p10~p90)', target: '≥ 5', check: m => atLeast(m.balanced80Spread.width, 5, x => `${f1(m.balanced80Spread.p10)}~${f1(m.balanced80Spread.p90)} (폭 ${f1(x)})`) },
  { id: 'curve.mapSpread', group: '보통 곡선', label: '맵 사이 균형형 중앙값 차(맵 평균 대비)', target: '± 2 이내', check: m => atMost(m.mapSpread, 2, x => `최대 ${f1(x)}`) },
  { id: 'curve.early50', group: '보통 곡선', label: '정답률 50% 초보형 W1~5 패배율(쉬움·보통 중 큰 값)', target: '0%', check: m => atMost(m.novice50Early, 0, x => pct(x, 1)) },
  { id: 'curve.gateEarly', group: '보통 곡선', label: '균형형 80% W1~8 평균 성문 피해', target: '≤ 15%', check: m => atMost(m.gateEarly, 0.15, x => pct(x, 1)) },
  { id: 'curve.gradual', group: '보통 곡선', label: '균형형 패배 중 직전 2웨이브에 성문 50%↑ 있는 판', target: '≥ 60%', check: m => atLeast(m.gradual.share, 0.6, x => `${pct(x)} (패배 ${m.gradual.defeats}판)`) },
  { id: 'curve.bossDeath', group: '보통 곡선', label: '보스 웨이브 사망 비율(전 전략 × 정답률 60·80·95% 합산)', target: '≤ 35%', check: m => atMost(m.bossDeath.share, 0.35, x => `${pct(x)} (패배 ${m.bossDeath.defeats}판, 균형형 80%만 ${pct(m.bossDeath.balanced80)})`) },
  { id: 'curve.bossKill5', group: '보통 곡선', label: '보스 처치율 W5(균형형 80%)', target: '≥ 0.95', check: m => atLeast(m.bossKill[5]?.reached ?? null, 0.95, x => `${round(x, 2)} (n=${m.bossKill[5]?.n})`) },
  { id: 'curve.bossKill10', group: '보통 곡선', label: '보스 처치율 W10(균형형 80%)', target: '≥ 0.85', check: m => atLeast(m.bossKill[10]?.reached ?? null, 0.85, x => `${round(x, 2)} (n=${m.bossKill[10]?.n})`) },
  { id: 'curve.bossKill15', group: '보통 곡선', label: '보스 처치율 W15(균형형 80%)', target: '≥ 0.70', check: m => atLeast(m.bossKill[15]?.reached ?? null, 0.7, x => `${round(x, 2)} (n=${m.bossKill[15]?.n})`) },
  { id: 'curve.waveMinutes', group: '보통 곡선', label: '웨이브 1개 길이(준비 문제 포함, 균형형 80%)', target: '≤ 1.4분', check: m => atMost(m.waveMinutes, 1.4, x => `${round(x, 2)}분`) },
  { id: 'curve.answerShare', group: '보통 곡선', label: '정답 골드가 수입에서 차지하는 몫(W1~20, 균형형 80%)', target: '≥ 55%', check: m => atLeast(m.answerShare, 0.55, x => pct(x, 1)) },
  // 난이도 간격
  { id: 'diff.easy', group: '난이도 간격', label: '쉬움 − 보통(균형형 80%)', target: '+4 ~ +6', check: m => range(diff(m.diffWaves.Easy ?? null, m.diffWaves.Normal ?? null), 4, 6, x => `${x >= 0 ? '+' : ''}${f1(x)}`) },
  { id: 'diff.hard', group: '난이도 간격', label: '어려움 − 보통(균형형 80%)', target: '−5 ~ −3', check: m => range(diff(m.diffWaves.Hard ?? null, m.diffWaves.Normal ?? null), -5, -3, x => `${x >= 0 ? '+' : ''}${f1(x)}`) },
  { id: 'diff.crazy', group: '난이도 간격', label: '아주 어려움 − 보통(균형형 80%)', target: '−8 ~ −6', check: m => range(diff(m.diffWaves.Crazy ?? null, m.diffWaves.Normal ?? null), -8, -6, x => `${x >= 0 ? '+' : ''}${f1(x)}`) },
  { id: 'diff.hardW1', group: '난이도 간격', label: '어려움 초보형 60% W1 패배', target: '≤ 5%', check: m => atMost(m.w1Loss.Hard ?? null, 0.05, x => pct(x, 1)) },
  { id: 'diff.crazyW1', group: '난이도 간격', label: '아주 어려움 초보형 60% W1 패배', target: '≤ 15%', check: m => atMost(m.w1Loss.Crazy ?? null, 0.15, x => pct(x, 1)) },
  // 성장·진화
  { id: 'grow.firstEvo', group: '성장·진화', label: '첫 진화(Lv4) 웨이브(균형형 80% 중앙값)', target: '≤ W7', check: m => atMost(m.firstEvo, 7, x => `W${f1(x)}`) },
  { id: 'grow.w20', group: '성장·진화', label: 'W20 판 Lv7 이상 타워 수(주력 2~3기)', target: '2 ~ 3기', check: m => (m.w20.n < 3 ? na(`표본 ${m.w20.n}판 (${m.w20.source})`) : range(m.w20.lv7, 2, 3, x => `${f1(x)}기 (n=${m.w20.n}, ${m.w20.source})`)) },
  { id: 'grow.effEarly', group: '성장·진화', label: '강화 1골드당 DPS / 새 설치, Lv1→6', target: '0.8 ~ 1.1', check: m => range(m.effEarly, 0.8, 1.1, x => String(round(x, 2))) },
  { id: 'grow.effLate', group: '성장·진화', label: '강화 1골드당 DPS / 새 설치, Lv7→9', target: '0.6 ~ 0.9', check: m => range(m.effLate, 0.6, 0.9, x => String(round(x, 2))) },
  {
    id: 'grow.branch', group: '성장·진화', label: '형태 A/B 선택률(최적화형) 모든 갈래', target: '35 ~ 65%',
    check: m => {
      if (!m.branches.length) return na(`표본 부족(갈래당 ${BRANCH_MIN_N}회 미만)`);
      const bad = m.branches.filter(b => !b.ok);
      return { status: bad.length === 0 ? 'PASS' : 'FAIL', measured: `${m.branches.length}갈래 중 벗어난 ${bad.length}${bad.length ? ` (${bad.slice(0, 4).map(b => `${b.tower}:${b.branch}`).join(',')}…)` : ''}, 표본 부족 ${m.branchLowN}`, value: bad.length };
    },
  },
  // 타워 균형
  {
    id: 'tower.counter2', group: '타워 균형', label: '적 역할마다 100골드당 궁수 대비 1.4배↑ 타워 수', target: '역할마다 ≥ 2종',
    check: m => {
      const roles = Object.entries(m.counterStrong);
      if (!roles.length) return na();
      const bad = roles.filter(([, v]) => v.count < 2);
      return { status: bad.length === 0 ? 'PASS' : 'FAIL', measured: `${roles.length}역할 중 미달 ${bad.length}${bad.length ? ` (${bad.map(([r, v]) => `${r}:${v.count}`).join(',')})` : ''}`, value: bad.length };
    },
  },
  {
    id: 'tower.strengthWeakness', group: '타워 균형', label: '궁수·유틸 6종·덫 외 공격 타워마다 강점(≥1.35배) 1개↑·약점(≤0.8배) 1개↑', target: '위반 0종',
    check: m => {
      if (!m.towerRoles.length) return na();
      const bad = m.towerRoles.filter(t => !t.ok);
      return { status: bad.length === 0 ? 'PASS' : 'FAIL', measured: `${m.towerRoles.length}종 중 위반 ${bad.length}${bad.length ? ` (${bad.map(t => t.tower).join(',')})` : ''}`, value: bad.length };
    },
  },
  {
    id: 'tower.pickRate', group: '타워 균형', label: '최적화형 징집 선택률(후보로 나왔을 때 고른 비율)', target: '모두 ≥ 10%, ≤ 60%',
    check: m => {
      if (!m.pickRuns) return na();
      const all = Object.entries(m.draftPicks) as Array<[TowerId, { offered: number; picked: number }]>;
      const entries = all.filter(([, v]) => v.offered >= DRAFT_MIN_N).map(([t, v]) => [t, v.picked / v.offered] as const);
      if (!entries.length) return na(`표본 부족(후보 ${DRAFT_MIN_N}회 미만)`);
      const low = entries.filter(([, v]) => v < 0.1), high = entries.filter(([, v]) => v > 0.6);
      return { status: low.length === 0 && high.length === 0 ? 'PASS' : 'FAIL', measured: `${entries.length}종 중 10% 미만 ${low.length}${low.length ? ` (${low.map(([t, v]) => `${t} ${pct(v)}`).join(',')})` : ''}, 60% 초과 ${high.length}${high.length ? ` (${high.map(([t, v]) => `${t} ${pct(v)}`).join(',')})` : ''}, 표본 부족 ${all.length - entries.length}`, value: low.length + high.length };
    },
  },
  {
    id: 'tower.monoMin', group: '타워 균형', label: '단일 타워 판(유틸 6종을 뺀 공격 타워 14종, 80%) 모두', target: '≥ W6',
    check: m => {
      const entries = Object.entries(m.monoWaves).filter(([t]) => !UTILITY_TOWERS.includes(t as TowerId));
      if (!entries.length) return na();
      const bad = entries.filter(([, w]) => w < 6);
      const worst = [...entries].sort((a, b) => a[1] - b[1])[0]!;
      return { status: bad.length === 0 ? 'PASS' : 'FAIL', measured: `최저 ${worst[0]} W${f1(worst[1])}, W6 미만 ${bad.length}종${bad.length ? ` (${bad.map(([t, w]) => `${t} ${f1(w)}`).join(',')})` : ''}`, value: worst[1] };
    },
  },
  {
    id: 'tower.utility', group: '타워 균형', label: '유틸 6종: 표준 4종에 하나 더하면', target: '+1.5웨이브 또는 성문 피해 −25%',
    check: m => {
      const rated = m.utility.filter(u => u.pass !== null);
      if (!rated.length) return na();
      const bad = rated.filter(u => !u.pass);
      return { status: bad.length === 0 && rated.length === m.utility.length ? 'PASS' : 'FAIL', measured: `통과 ${rated.length - bad.length}/${m.utility.length}${bad.length ? ` (미달: ${bad.map(u => u.tower).join(',')})` : ''}`, value: rated.length - bad.length };
    },
  },
  { id: 'tower.relics', group: '타워 균형', label: '원정 보물 12개 선택률 ≥ 5%, 평균 +3웨이브 이하', target: '≥ 5% · ≤ +3', check: () => na('보물 미구현(B3)') },
  { id: 'tower.traits', group: '타워 균형', label: '종족 특성 4종별 강점 타워(상성표 열)', target: '특성마다 ≥ 2종', check: () => na('특성 미구현(B3)') },
];

export function evaluateGate(m: Metrics): GateRow[] {
  return ROWS.map(r => {
    const c = r.check(m);
    return { id: r.id, group: r.group, label: r.label, target: r.target, measured: c.measured, status: c.status, value: c.value };
  });
}

export const summarize = (rows: readonly GateRow[]) => ({ pass: rows.filter(r => r.status === 'PASS').length, fail: rows.filter(r => r.status === 'FAIL').length, na: rows.filter(r => r.status === 'N/A').length, total: rows.length });

export function formatRows(rows: readonly GateRow[]): string {
  const out: string[] = [];
  let group = '';
  for (const r of rows) {
    if (r.group !== group) { group = r.group; out.push(`\n[${group}]`); }
    out.push(`  ${r.status.padEnd(4)} ${r.label}  |  목표 ${r.target}  |  측정 ${r.measured}`);
  }
  const s = summarize(rows);
  out.push(`\n요약: PASS ${s.pass} · FAIL ${s.fail} · N/A ${s.na} (전체 ${s.total}줄)`);
  return out.join('\n');
}

export function markdownRows(rows: readonly GateRow[]): string {
  const out = ['| 판정 | 분류 | 지표 | 목표 | 측정 |', '|---|---|---|---|---|'];
  for (const r of rows) out.push(`| ${r.status} | ${r.group} | ${r.label} | ${r.target} | ${r.measured.replace(/\|/g, '/')} |`);
  return out.join('\n');
}

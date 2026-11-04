import { TOWER_IDS, type DifficultyId, type FormId, type TowerId } from '../../src/contracts/balance';
import type { RunSummary } from './bots';
import {
  bossDeathShare, bossKill, cellKey, cellStat, firstEvoMedian, gateEarly, gradualDeath, income, indexRuns, lossBy, markdownRows, mean, median, summarize,
  type CellStat, type Dataset, type GateRow, type Income, type Metrics,
} from './gate';
import { ROLES, type Role } from './towerEfficiency';

// 관문 보고서: 같은 자료로 JSON(reportData)과 읽는 글(fullReport, 마크다운)을 만든다. 숫자는 모두 가상 플레이어 판에서 나온다.

const r2 = (x: number | null | undefined, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '-' : String(Math.round(x * 10 ** d) / 10 ** d));
const pct = (x: number | null | undefined, d = 0) => (x === null || x === undefined ? '-' : `${r2(x * 100, d)}%`);
const SHOW_WAVES = [3, 5, 8, 10, 12, 14, 15, 16, 17, 18, 20, 22, 24, 26, 30];

export interface CellReport {
  difficulty: DifficultyId; bot: string; acc: number; n: number;
  stat: Omit<CellStat, 'survival'>;
  survival: Record<number, number>;
  /** 웨이브 w를 지킨 판의 비율(인덱스 0 = 웨이브 1). 보고서 JSON용 전체 곡선. */
  survivalFull: number[];
  gateEarly: number | null; early5Loss: number | null; w1Loss: number | null;
  bossDeath: number | null; gradual: number | null;
  firstEvo: number | null; maxLevelAtEnd: number | null; lv7AtEnd: number | null;
  income: Income;
  answerShareByBand: Record<string, number | null>;
  bossKill: Record<number, number | null>;
  /** 패배 k웨이브 전 평균 성문 피해(k = 4,3,2,1). */
  beforeDeath: Record<number, number | null>;
}

export interface ReportData {
  cells: CellReport[];
  mono: Array<{ tower: TowerId; n: number; mapAvg: number | null; median: number | null; p10: number | null; p90: number | null; bossKill10: number | null; minutes: number | null }>;
  matrix: Array<{ tower: TowerId; ratio: Record<Role, number>; per100: Record<Role, number>; attacks: boolean }>;
  efficiency: Dataset['efficiency'];
  picks: Array<{ tower: TowerId; buildShare: number; damageShare: number; ownedShare: number; offered: number; picked: number; pickRate: number | null }>;
  w20Levels: Record<string, number>;
  engineErrors: Array<{ bot: string; map: string; seed: number; acc: number; message: string }>;
}

function cellReport(difficulty: DifficultyId, bot: string, acc: number, runs: readonly RunSummary[]): CellReport {
  const stat = cellStat(runs);
  const { survival, ...rest } = stat;
  const bands: Array<[string, number, number]> = [['W1-5', 0, 5], ['W6-10', 5, 10], ['W11-15', 10, 15], ['W16-20', 15, 20]];
  const lost = runs.filter(r => r.endReason === 'DEFEAT');
  const before = (k: number) => mean(lost.filter(r => r.completedWave + 1 - k >= 1).map(r => Math.min(1, (r.waves[r.completedWave - k]?.[0] ?? 0) / r.gateMax)));
  return {
    difficulty, bot, acc, n: runs.length, stat: rest,
    survival: Object.fromEntries(SHOW_WAVES.map(w => [w, survival[w - 1] ?? 0])),
    survivalFull: survival.map(x => Math.round(x * 1000) / 1000),
    gateEarly: gateEarly(runs, 8), early5Loss: lossBy(runs, 5), w1Loss: lossBy(runs, 1),
    bossDeath: bossDeathShare(runs).share, gradual: gradualDeath(runs).share,
    firstEvo: firstEvoMedian(runs),
    maxLevelAtEnd: median(runs.map(r => Math.max(0, ...r.finalTowers.map(t => t[1])))),
    lv7AtEnd: median(runs.map(r => r.finalTowers.filter(t => t[1] >= 7).length)),
    income: income(runs, 20),
    answerShareByBand: Object.fromEntries(bands.map(([name, a, b]) => {
      const rows = runs.flatMap(r => r.waves.slice(a, b));
      const total = rows.reduce((x, w) => x + w[2]! + w[3]! + w[4]! + w[5]! + w[6]!, 0);
      return [name, total > 0 ? rows.reduce((x, w) => x + w[2]!, 0) / total : null];
    })),
    bossKill: Object.fromEntries([5, 10, 15, 20].map(w => [w, bossKill(runs, w).reached])),
    beforeDeath: Object.fromEntries([4, 3, 2, 1].map(k => [k, before(k)])),
  };
}

export function reportData(data: Dataset): ReportData {
  const ix = indexRuns(data.runs);
  const cells: CellReport[] = [];
  const order = (k: string) => { const [d, b, a] = k.split('|'); return `${['Normal', 'Easy', 'Hard', 'Crazy'].indexOf(d!)}|${b!.startsWith('mono-') || b!.startsWith('core4') ? 'z' : 'a'}${b}|${a}`; };
  for (const key of [...ix.cells.keys()].sort((a, b) => order(a).localeCompare(order(b)))) {
    const [d, bot, acc] = key.split('|');
    cells.push(cellReport(d as DifficultyId, bot!, Number(acc), ix.cells.get(key)!));
  }

  const mono = TOWER_IDS.map(tower => {
    const runs = ix.cells.get(cellKey('Normal', `mono-${tower}`, 0.8)) ?? [];
    const s = cellStat(runs);
    return { tower, n: runs.length, mapAvg: s.mapAvg, median: s.median, p10: s.p10, p90: s.p90, bossKill10: runs.length ? bossKill(runs, 10).reached : null, minutes: s.minutes };
  });

  const maps = Object.keys(data.matrix);
  const matrix = TOWER_IDS.map(tower => {
    const rows = maps.map(m => data.matrix[m]!.find(r => r.tower === tower)).filter((x): x is NonNullable<typeof x> => !!x);
    const avg = (key: 'ratio' | 'per100') => Object.fromEntries(ROLES.map(role => [role, mean(rows.map(r => r[key][role])) ?? 0])) as Record<Role, number>;
    return { tower, ratio: avg('ratio'), per100: avg('per100'), attacks: rows[0]?.attacks ?? false };
  });

  const opt = data.runs.filter(r => r.bot === 'optimizer' && r.difficulty === 'Normal' && !r.engineError);
  const builds: Partial<Record<TowerId, number>> = {};
  const damage: Partial<Record<TowerId, number>> = {};
  const offered: Partial<Record<TowerId, number>> = {};
  const picked: Partial<Record<TowerId, number>> = {};
  const owned: Partial<Record<TowerId, number>> = {};
  for (const r of opt) {
    for (const [t, n] of Object.entries(r.builds)) builds[t as TowerId] = (builds[t as TowerId] ?? 0) + (n ?? 0);
    for (const [t, n] of Object.entries(r.damage)) damage[t as TowerId] = (damage[t as TowerId] ?? 0) + (n ?? 0);
    for (const d of r.drafts) { for (const t of d.offers) offered[t] = (offered[t] ?? 0) + 1; if (d.picked) picked[d.picked] = (picked[d.picked] ?? 0) + 1; }
    for (const t of new Set(r.finalTowers.map(x => x[0]).concat(Object.keys(r.builds) as TowerId[]))) owned[t] = (owned[t] ?? 0) + 1;
  }
  const sumOf = (o: Partial<Record<TowerId, number>>) => Object.values(o).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const picks = TOWER_IDS.map(tower => ({
    tower, buildShare: (builds[tower] ?? 0) / sumOf(builds), damageShare: (damage[tower] ?? 0) / sumOf(damage),
    ownedShare: opt.length ? (owned[tower] ?? 0) / opt.length : 0, offered: offered[tower] ?? 0, picked: picked[tower] ?? 0,
    pickRate: offered[tower] ? (picked[tower] ?? 0) / offered[tower]! : null,
  }));

  const w20Levels: Record<string, number> = {};
  for (const r of data.runs.filter(x => x.snap20 && x.difficulty === 'Normal' && !x.engineError && x.bot === 'optimizer' && x.acc === 0.95)) for (const t of r.snap20!) w20Levels[`Lv${Math.min(t[1], 10)}${t[1] >= 10 ? '+' : ''}`] = (w20Levels[`Lv${Math.min(t[1], 10)}${t[1] >= 10 ? '+' : ''}`] ?? 0) + 1;

  const engineErrors = data.runs.filter(r => r.engineError).map(r => ({ bot: r.bot, map: r.map, seed: r.seed, acc: r.acc, message: r.engineError! }));
  return { cells, mono, matrix, efficiency: data.efficiency, picks, w20Levels, engineErrors };
}

const table = (headers: string[], rows: Array<Array<string | number>>) => [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');

export function fullReport(data: Dataset, m: Metrics, rows: readonly GateRow[], meta: { mode: string; seeds: number; workers: number; sets: string[]; wallSeconds: number; runs: number; generatedAt: string }): string {
  const d = reportData(data);
  const s = summarize(rows);
  const out: string[] = [];
  const h = (t: string) => out.push(`\n## ${t}\n`);
  out.push(`# 밸런스 관문 보고서 (${meta.mode} 모드)`);
  out.push(`가상 플레이어 판정이며 학생 실측이 아니다. seed ${meta.seeds} · 맵 ${[...new Set(data.runs.map(r => r.map))].join('·')} · 판 ${meta.runs}개 · 워커 ${meta.workers} · 소요 ${meta.wallSeconds}초${meta.sets.length ? ` · 조정 ${meta.sets.join(' ')}` : ''} · 엔진 수치 한계로 제외한 판 ${m.engineErrors}개`);
  out.push(`\n요약: **PASS ${s.pass} · FAIL ${s.fail} · N/A ${s.na}** (전체 ${s.total}줄)`);

  h('1. 관문 판정 (PRD §7.1)');
  out.push(markdownRows(rows));

  h('2. 생존 곡선과 도달 웨이브 (보통 난이도)');
  out.push('도달 웨이브 = 마지막으로 지킨 웨이브. 평균 = 맵마다 중앙값을 구해 평균한 값. 생존 열 = 그 웨이브를 지킨 판의 비율.');
  const main = d.cells.filter(c => c.difficulty === 'Normal' && !c.bot.startsWith('mono-') && !c.bot.startsWith('core4'));
  out.push(table(['봇', '정답률', 'n', '맵 평균', '중앙', 'p10', 'p90', ...SHOW_WAVES.map(w => `≥W${w}`)],
    main.map(c => [c.bot, pct(c.acc), c.n, r2(c.stat.mapAvg, 1), r2(c.stat.median, 1), r2(c.stat.p10, 1), r2(c.stat.p90, 1), ...SHOW_WAVES.map(w => pct(c.survival[w]))])));

  h('3. 맵별 도달 웨이브 중앙값');
  const maps = [...new Set(data.runs.map(r => r.map))];
  out.push(table(['봇', '정답률', ...maps], main.map(c => [c.bot, pct(c.acc), ...maps.map(mp => r2(c.stat.byMap[mp], 1))])));

  h('4. 성문 피해 · 판 길이 · 수입');
  out.push('성문 피해는 성문 최대 체력 대비 비율. 사망 k웨이브 전 = 패배한 판에서 패배 웨이브 k개 앞 웨이브의 피해.');
  out.push(table(['봇', '정답률', 'W1~8 평균', '사망 4전', '3전', '2전', '1전', '직전2 50%↑', 'W1~5 패배', 'W1 패배', '보스 사망', '판 길이(분)', '웨이브(분)'],
    main.map(c => [c.bot, pct(c.acc), pct(c.gateEarly, 1), pct(c.beforeDeath[4]), pct(c.beforeDeath[3]), pct(c.beforeDeath[2]), pct(c.beforeDeath[1]), pct(c.gradual), pct(c.early5Loss), pct(c.w1Loss), pct(c.bossDeath), r2(c.stat.minutes, 1), r2(c.stat.waveMinutes, 2)])));
  out.push('\n수입 구성(W1~20, 웨이브당 평균 골드; 시작 골드 제외)');
  out.push(table(['봇', '정답률', '정답', '처치', '보스', '생존 보너스', '오라', '합계/웨이브', '정답 몫 W1~20', 'W1~5', 'W6~10', 'W11~15', 'W16~20'],
    main.map(c => {
      const w = c.income.total > 0 ? (c.income.perWave ?? 0) / c.income.total : 0;
      return [c.bot, pct(c.acc), r2(c.income.answer * w), r2(c.income.kill * w), r2(c.income.boss * w), r2(c.income.milestone * w), r2(c.income.aura * w), r2(c.income.perWave, 1), pct(c.income.answerShare, 1), ...['W1-5', 'W6-10', 'W11-15', 'W16-20'].map(b => pct(c.answerShareByBand[b]))];
    })));

  h('5. 보스 처치율 (웨이브에 들어선 판 중 보스를 잡은 비율)');
  out.push(table(['봇', '정답률', 'W5', 'W10', 'W15', 'W20'], main.map(c => [c.bot, pct(c.acc), ...[5, 10, 15, 20].map(w => r2(c.bossKill[w]))])));

  h('6. 성장: 첫 진화와 판 끝 레벨');
  out.push(table(['봇', '정답률', '첫 Lv4 웨이브(중앙)', '판 끝 최고 Lv', '판 끝 Lv7↑ 수'], main.map(c => [c.bot, pct(c.acc), r2(c.firstEvo, 1), r2(c.maxLevelAtEnd, 1), r2(c.lv7AtEnd, 1)])));
  out.push(`\nW20 판(최적화형 95%) 타워 레벨 분포: ${Object.entries(d.w20Levels).sort().map(([k, v]) => `${k} ${v}기`).join(' · ') || '없음(W20 도달 판 없음)'}`);

  h('7. 난이도 간격과 다른 난이도 셀');
  out.push(table(['난이도', '봇', '정답률', 'n', '맵 평균', '중앙', 'p10', 'p90', 'W1 패배'],
    d.cells.filter(c => c.difficulty !== 'Normal').map(c => [c.difficulty, c.bot, pct(c.acc), c.n, r2(c.stat.mapAvg, 1), r2(c.stat.median, 1), r2(c.stat.p10, 1), r2(c.stat.p90, 1), pct(c.w1Loss)])));

  h('8. 강화 효율 (Lv n→n+1 강화 1골드당 늘어난 피해 ÷ 새 Lv1 설치 1골드당 피해)');
  out.push(table(['타워', '대표 갈래', ...Array.from({ length: 9 }, (_, i) => `${i + 1}→${i + 2}`), 'Lv1→6 누적', 'Lv7→9 누적'],
    d.efficiency.map(e => [e.tower, e.path ?? '-', ...e.ratios.map(x => r2(x)), r2(e.span.early), r2(e.span.late)])));
  out.push(`\n누적 = 구간 강화비 합 1골드당 늘어난 피해 ÷ 새 Lv1 1골드당 피해(진화 도약 포함). 공격 타워 중앙값: Lv1→6 ${r2(m.effEarly)} · Lv7→9 ${r2(m.effLate)} (관문 판정값)`);

  h('9. 상성표 (Lv1 기본형, 100골드당 피해 ÷ 같은 칸 궁수, 4개 맵 평균)');
  out.push(`열: 적 역할 9종. 종족 특성 4종(딱정벌레 등껍질·가마 흙 보호막·두더지 땅굴·하늘유랑 비행 비율)은 B3 구현 전이라 N/A.`);
  out.push(table(['타워', ...ROLES, '특성 ×4'], d.matrix.map(x => [x.tower, ...ROLES.map(r => (x.attacks ? r2(x.ratio[r]) : '-')), 'N/A'])));
  out.push(`\n궁수 100골드당 피해(HP): ${ROLES.map(r => `${r} ${r2(d.matrix.find(x => x.tower === 'archer')?.per100[r], 0)}`).join(' · ')}`);
  out.push('\n역할마다 1.4배↑ 타워: ' + Object.entries(m.counterStrong).map(([r, v]) => `${r} ${v.count}종(${v.towers.join(',') || '-'})`).join(' · '));
  out.push('\n강점·약점(최고·최저 비): ' + m.towerRoles.map(t => `${t.tower} ${t.strongRole}×${r2(t.strong)}/${t.weakRole}×${r2(t.weak)}${t.ok ? '' : '✗'}`).join(' · '));

  h('10. 단일 타워 판 (정답률 80%, 보통)');
  out.push(table(['타워', 'n', '맵 평균', '중앙', 'p10', 'p90', '보스 W10 처치', '판 길이(분)'], [...d.mono].sort((a, b) => (b.mapAvg ?? 0) - (a.mapAvg ?? 0)).map(x => [x.tower, x.n, r2(x.mapAvg, 1), r2(x.median, 1), r2(x.p10, 1), r2(x.p90, 1), r2(x.bossKill10), r2(x.minutes, 1)])));

  h('11. 최적화형 선택률과 피해 몫 (보통, 모든 정답률 합)');
  out.push('설치 점유 = 전체 설치 명령 중 그 타워 비율. 징집 선택률 = 후보로 나온 횟수 대비 고른 횟수(시작 4종은 후보에 안 나옴). 보유 = 한 번이라도 지은 판의 비율.');
  out.push(table(['타워', '설치 점유', '피해 몫', '보유', '징집 후보', '징집 선택', '징집 선택률'], d.picks.map(x => [x.tower, pct(x.buildShare, 1), pct(x.damageShare, 1), pct(x.ownedShare), x.offered, x.picked, pct(x.pickRate)])));

  h('12. 진화 갈래 선택률 (최적화형)');
  out.push(m.branches.length ? table(['타워', '단계', '선택률', 'n', '35~65%'], m.branches.map(b => [b.tower, b.branch, Object.entries(b.shares).map(([f, v]) => `${f} ${pct(v)}`).join(' / '), b.n, b.ok ? 'O' : 'X'])) : '표본이 갈래당 8회에 못 미쳐 판정할 수 없다.');
  out.push(`\n표본 부족 갈래 ${m.branchLowN}개는 제외했다.`);

  h('13. 유틸 시너지 (핵심 4종 = 궁수·석궁·포탑·마법, 80%)');
  out.push(`성문 피해는 W1~${m.utilityWindow}(핵심 4종 판이 지키는 구간) 판마다 평균. 변화 = (더한 뒤 − 핵심만) ÷ 핵심만.`);
  out.push(table(['추가 타워', '핵심만 맵 평균', '더한 뒤', '웨이브 차이', '핵심만 성문 피해', '더한 뒤', '변화', '판정(+1.5 또는 −25%)'],
    m.utility.map(u => [u.tower, r2(u.coreWaves, 1), r2(u.withWaves, 1), r2(u.waveDelta, 1), pct(u.coreGate, 1), pct(u.withGate, 1), u.gateDelta === null ? '-' : pct(u.gateDelta), u.pass === null ? 'N/A' : u.pass ? 'PASS' : 'FAIL'])));

  h('14. 아직 측정하지 않는 것 (N/A)');
  out.push('- 원정 보물 12개 선택률·상승폭: 보물 미구현(B3)\n- 종족 특성 4종 상성표 열: 특성 미구현(B3)\n- 다음 웨이브 특성 아이콘·경고: 화면 미구현');

  if (d.engineErrors.length) {
    h('15. 엔진 수치 한계로 끊긴 판');
    out.push(d.engineErrors.slice(0, 20).map(e => `- ${e.bot} ${e.map} seed ${e.seed} 정답률 ${e.acc}: ${e.message}`).join('\n'));
  }
  return out.join('\n') + '\n';
}

export { type FormId };

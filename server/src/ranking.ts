/**
 * Postgres get_leaderboard_slice의 best/grouped → ranked 단계를 그대로 옮긴 순수 함수.
 * D1은 정렬·창 함수가 임시 표를 훑는 만큼 읽기 행으로 세므로(창 함수 하나에 행마다 약 3번), SQL은 집계표를
 * 기본 키 범위로 한 번만 읽고 순위는 여기서 매긴다(행마다 읽기 약 1번).
 */
export type RankingTab = 'single_score' | 'best_wave' | 'honor_points';

export interface StandingRow {
  player_hash: string;
  nickname: string;
  grade: number;
  difficulty: string;
  val: number;
  secondary: number;
  correct: number;
  achieved_at: number;
  run_id: string | null;
}

export interface RankedPlayer {
  rank: number;
  hash: string;
  nickname: string;
  grade: number;
  difficulty: string;
  val: number;
  secondary: number;
  correct: number;
  achievedAt: number;
  runId: string | null;
}

const compareHash = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 한 기기의 여러 집계 행(승인 조건이 여럿일 때) 가운데 최고 판: 값·보조값·정답 수가 크고 받은 시각이 이른 순. */
const betterRun = (a: StandingRow, b: StandingRow) =>
  b.val - a.val || b.secondary - a.secondary || b.correct - a.correct || a.achieved_at - b.achieved_at;

export function rankStandings(rows: readonly StandingRow[], tab: RankingTab): RankedPlayer[] {
  const byPlayer = new Map<string, StandingRow[]>();
  for (const row of rows) {
    const list = byPlayer.get(row.player_hash);
    if (list) list.push(row);
    else byPlayer.set(row.player_hash, [row]);
  }
  const players: Omit<RankedPlayer, 'rank'>[] = [];
  for (const [hash, list] of byPlayer) {
    if (tab === 'honor_points') {
      // 명예점: 합계·판 수를 더하고, 별명은 마지막으로 받은 판의 것, 학년은 가장 높은 학년(Postgres max(grade)).
      let latest = list[0]!;
      let val = 0;
      let secondary = 0;
      let grade = 0;
      for (const row of list) {
        val += row.val;
        secondary += row.secondary;
        grade = Math.max(grade, row.grade);
        if (row.achieved_at > latest.achieved_at) latest = row;
      }
      players.push({ hash, nickname: latest.nickname, grade, difficulty: 'Normal', val, secondary, correct: 0, achievedAt: latest.achieved_at, runId: null });
    } else {
      const best = list.reduce((a, b) => (betterRun(a, b) <= 0 ? a : b));
      players.push({
        hash, nickname: best.nickname, grade: best.grade, difficulty: best.difficulty, val: best.val, secondary: best.secondary,
        correct: best.correct, achievedAt: best.achieved_at, runId: best.run_id,
      });
    }
  }
  players.sort((a, b) => b.val - a.val
    || (tab === 'honor_points' ? a.secondary - b.secondary : b.secondary - a.secondary)
    || b.correct - a.correct || a.achievedAt - b.achievedAt || compareHash(a.hash, b.hash));
  return players.map((p, i) => ({ ...p, rank: i + 1 }));
}

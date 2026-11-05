/**
 * 요청마다 D1에 보낼 SQL. 한 요청은 보통 batch 한 번(제출은 두 번)으로 끝나도록 읽기·쓰기를 묶었다.
 * 판단(재채점·시간 검사)은 handlers.ts가 하고, 여기서는 SQL 모양만 정한다.
 */
import { sql, type SqlStatement } from './db';
import { DAY_MS, kstDateKey, kstDateKeyDaysAgo, utcMinuteKey } from './time';

export const VERIFIED_LEVEL = 'question_regraded_combat_bounded';

export interface RateLimit {
  minute: number;
  day: number;
}

/** 기기별 (분당, 하루) 한도. Postgres allow_lobby_rpc 호출과 같은 값이다. */
export const DEVICE_RATE_LIMITS = {
  visit: { minute: 60, day: 2000 },
  start: { minute: 3, day: 200 },
  submit: { minute: 6, day: 100 },
  ranking: { minute: 120, day: 10000 },
} as const satisfies Record<string, RateLimit>;
export type RateAction = keyof typeof DEVICE_RATE_LIMITS;

/**
 * IP별 (분당, 하루) 한도. 기기를 여러 개 받아 기기별 한도를 우회해도 한 IP가 D1 쓰기 한도(하루 10만 행)를
 * 혼자 다 쓰지 못하게, 그러면서도 학교 IP 하나 뒤에 학생 1,000명이 하루 3판(3,000판)을 해도 막히지 않게 정했다.
 *   start·submit 4,000/일: 3,000판 + 중간에 그만둔 판·재전송 여유. 분당 300: 300명이 한꺼번에 시작.
 *   visit 10,000/일: 판마다 홈 2~3번(9,000). 분당 600.
 *   ranking 20,000/일: 판마다 랭킹 2~5번(최대 15,000). 분당 1,200.
 *   device 2,000/일: 학생 1,000명 × 저장소를 지우는 공용 기기에서 하루 두 번 새로 받기. 분당 120: 네 반이 한꺼번에.
 */
export const IP_RATE_LIMITS = {
  visit: { minute: 600, day: 10000 },
  start: { minute: 300, day: 4000 },
  submit: { minute: 300, day: 4000 },
  ranking: { minute: 1200, day: 20000 },
  device: { minute: 120, day: 2000 },
} as const satisfies Record<RateAction | 'device', RateLimit>;

/**
 * 한도를 넘으면 CHECK(rate_limited)가 실패해 같은 batch의 다른 문장도 모두 되돌아간다.
 * 분·일 키는 앞으로만 간다: 더 새 키가 오면 1부터 다시 세고, 늦게 도착한 요청(옛 키)은 지금 칸에 더한다.
 * 키를 그대로 덮어쓰면 늦게 온 요청 하나가 최신 칸을 1로 되돌려 한도를 풀어 버린다.
 */
export function rateLimitStatement(subject: string, action: string, limit: RateLimit, nowMs: number): SqlStatement {
  return sql(
    `INSERT INTO rate_limits (subject, action, minute_key, minute_calls, minute_limit, day_key, day_calls, day_limit)
     VALUES (?1, ?2, ?3, 1, ?4, ?5, 1, ?6)
     ON CONFLICT (subject, action) DO UPDATE SET
       minute_calls = CASE WHEN excluded.minute_key > rate_limits.minute_key THEN 1 ELSE rate_limits.minute_calls + 1 END,
       day_calls = CASE WHEN excluded.day_key > rate_limits.day_key THEN 1 ELSE rate_limits.day_calls + 1 END,
       minute_key = max(rate_limits.minute_key, excluded.minute_key),
       day_key = max(rate_limits.day_key, excluded.day_key),
       minute_limit = excluded.minute_limit, day_limit = excluded.day_limit`,
    subject, action, utcMinuteKey(nowMs), limit.minute, kstDateKey(new Date(nowMs)), limit.day,
  );
}

export const rateLimitState = (subject: string, action: string) =>
  sql('SELECT day_key, day_calls, day_limit FROM rate_limits WHERE subject = ?1 AND action = ?2', subject, action);

/** 접속 기록은 마지막 기록 뒤 60초가 지났을 때만 고친다(홈을 자주 열어도 쓰기 행이 늘지 않게). */
export const PRESENCE_REFRESH_MS = 60_000;
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

/**
 * 홈 방문: 오늘 첫 방문이면 트리거가 지표를 올린다. 최근 5분 방문 기기 수를 함께 읽는다.
 * 접속 기록을 60초에 한 번만 고치므로 "최근 5분"은 실제로 최근 4~5분 사이에서 1분만큼 흔들린다.
 */
export function visitStatements(hash: string, nowMs: number): SqlStatement[] {
  const today = kstDateKey(new Date(nowMs));
  return [
    sql('INSERT INTO daily_visitor_hashes (kst_date, visitor_hash, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING', today, hash, nowMs),
    sql(
      `INSERT INTO lobby_presence (visitor_hash, seen_at) VALUES (?1, ?2)
       ON CONFLICT (visitor_hash) DO UPDATE SET seen_at = excluded.seen_at WHERE excluded.seen_at >= lobby_presence.seen_at + ?3`,
      hash, nowMs, PRESENCE_REFRESH_MS,
    ),
    sql(
      `SELECT coalesce((SELECT plays FROM daily_metrics WHERE kst_date = ?1), 0) AS today_plays,
              total_visitors, total_plays,
              (SELECT count(*) FROM lobby_presence WHERE seen_at > ?2) AS recent_visitors
         FROM global_metrics WHERE row_id = 1`,
      today, nowMs - PRESENCE_WINDOW_MS,
    ),
  ];
}

/**
 * 판 시작: 최근 60초 시작 수, 다른 소유자 여부를 먼저 읽고, 둘 다 괜찮을 때만 넣는다(같은 batch라 사이에 끼어들 수 없다).
 * 처음 들어간 행이면 트리거가 판 수를 올린다.
 */
export function startStatements(runId: string, hash: string, nowMs: number): SqlStatement[] {
  const since = nowMs - 60_000;
  return [
    sql('SELECT count(*) AS recent FROM run_start_dedup WHERE player_hash = ?1 AND started_at > ?2', hash, since),
    sql('SELECT EXISTS (SELECT 1 FROM run_start_dedup WHERE run_id = ?1 AND player_hash <> ?2) AS owner_conflict', runId, hash),
    sql(
      `INSERT INTO run_start_dedup (run_id, player_hash, kst_date, started_at)
       SELECT ?1, ?2, ?3, ?4
        WHERE (SELECT count(*) FROM run_start_dedup WHERE player_hash = ?2 AND started_at > ?5) < 3
          AND NOT EXISTS (SELECT 1 FROM run_start_dedup WHERE run_id = ?1 AND player_hash <> ?2)
       ON CONFLICT (run_id) DO NOTHING
       RETURNING run_id`,
      runId, hash, kstDateKey(new Date(nowMs)), nowMs, since,
    ),
  ];
}

export interface SubmitLookupInput {
  runId: string;
  hash: string;
  grade: number;
  difficulty: string;
  balanceVersion: string | null;
  bankVersion: string | null;
  mapId: string | null;
  questionIds: readonly string[];
}

/** 제출 판정에 필요한 읽기(승인 조건, 검증 규칙, 기존 기록, 시작 기록, 정답 키). */
export function submitLookupStatements(input: SubmitLookupInput): SqlStatement[] {
  return [
    sql(
      'SELECT 1 AS ok FROM approved_run_conditions WHERE bank_version = ?1 AND grade = ?2 AND balance_version = ?3 AND map_id = ?4 AND active = 1',
      input.bankVersion, input.grade, input.balanceVersion, input.mapId,
    ),
    sql('SELECT rules FROM run_verification_rules WHERE balance_version = ?1 AND difficulty = ?2', input.balanceVersion, input.difficulty),
    sql('SELECT player_hash, payload_hash, verification_level FROM completed_runs WHERE run_id = ?1', input.runId),
    sql('SELECT started_at FROM run_start_dedup WHERE run_id = ?1 AND player_hash = ?2', input.runId, input.hash),
    sql(
      `SELECT question_id, revision, correct_option FROM question_keys
        WHERE bank_version = ?1 AND grade = ?2 AND question_id IN (SELECT value FROM json_each(?3))`,
      input.bankVersion, input.grade, JSON.stringify(input.questionIds),
    ),
  ];
}

export const existingRunStatement = (runId: string) =>
  sql('SELECT player_hash, payload_hash, verification_level FROM completed_runs WHERE run_id = ?1', runId);

export interface CompletedRunRow {
  runId: string;
  hash: string;
  nickname: string;
  grade: number;
  difficulty: string;
  pt: number;
  honorPt: number;
  completedWave: number;
  correct: number;
  wrong: number;
  skipped: number;
  balanceVersion: string;
  bankVersion: string;
  mapId: string;
  weekKey: string;
  kstDate: string;
  localEndedAt: number;
  endedAt: number;
  receivedAt: number;
  payloadHash: string;
}

/** 완주 기록을 넣는다. 랭킹 집계표는 트리거(completed_runs_standings)가 같은 트랜잭션에서 고친다. */
export function insertCompletedRunStatement(r: CompletedRunRow): SqlStatement {
  return sql(
    `INSERT INTO completed_runs (run_id, player_hash, public_tag, nickname, grade, difficulty, pt, honor_pt, completed_wave,
       correct, wrong, skipped, content_mode, balance_version, bank_version, map_id, season_id, week_key, kst_date,
       local_ended_at, ended_at, received_at, verification_level, payload_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'published', ?13, ?14, ?15, 'season1', ?16, ?17, ?18, ?19, ?20, ?21, ?22)`,
    r.runId, r.hash, r.hash.slice(0, 16), r.nickname, r.grade, r.difficulty, r.pt, r.honorPt, r.completedWave,
    r.correct, r.wrong, r.skipped, r.balanceVersion, r.bankVersion, r.mapId, r.weekKey, r.kstDate,
    r.localEndedAt, r.endedAt, r.receivedAt, VERIFIED_LEVEL, r.payloadHash,
  );
}

const ACTIVE_CONDITION = `(bank_version, grade, balance_version, map_id) IN
  (SELECT bank_version, grade, balance_version, map_id FROM approved_run_conditions WHERE active = 1)`;

export interface LeaderboardScope {
  tab: 'single_score' | 'best_wave' | 'honor_points';
  period: string; // 'all' 또는 'week:YYYY-Www'
  grade: number; // 0이면 모든 학년
  difficulty: string;
}

/** 학년 0(전체)이면 조건을 빼서, 특정 학년이면 집계표 기본 키 앞부분(kind, period, grade, difficulty)을 그대로 타게 한다. */
const gradeClause = (grade: number) => (grade === 0 ? '' : `AND grade = ${Math.trunc(grade)}`);

/**
 * Postgres get_leaderboard_slice의 eligible 단계: 승인 조건이 켜진 집계 행만 기본 키 범위로 한 번 읽는다.
 * 순위(best/grouped → ranked)는 ranking.ts가 매긴다. 승인 조건 IN은 임시 색인을 한 번 만들 뿐이라 읽기가 거의 늘지 않는다.
 */
export function leaderboardRowsStatement(s: LeaderboardScope): SqlStatement {
  return sql(
    `SELECT player_hash, nickname, grade, difficulty, val, secondary, correct, achieved_at, run_id FROM standings
      WHERE kind = ?1 AND period = ?2 ${gradeClause(s.grade)} AND difficulty = ?3 AND ${ACTIVE_CONDITION}`,
    s.tab, s.period, s.tab === 'honor_points' ? '*' : s.difficulty,
  );
}

/** 명예점 탭에서 내 항목의 runIds(범위 안 모든 내 기록). Postgres array_agg(run_id)와 같은 집합이다. */
export function myHonorRunIdsStatement(me: string, grade: number, weekKey: string | null): SqlStatement {
  return sql(
    `SELECT run_id FROM completed_runs
      WHERE player_hash = ?1 AND verification_level = '${VERIFIED_LEVEL}' AND completed_wave >= 1
        ${gradeClause(grade)} AND (?2 IS NULL OR week_key = ?2) AND ${ACTIVE_CONDITION}
      ORDER BY received_at`,
    me, weekKey,
  );
}

/** Postgres cleanup_ephemeral_lobby_hashes를 옮긴 하루 한 번 정리(scheduled). */
export function cleanupStatements(nowMs: number): SqlStatement[] {
  const weekAgo = kstDateKeyDaysAgo(nowMs, 7);
  return [
    sql('DELETE FROM daily_visitor_hashes WHERE kst_date < ?1', weekAgo),
    sql('DELETE FROM run_start_dedup WHERE kst_date < ?1', weekAgo),
    // Postgres는 마지막 호출 2일 뒤(expires_at) 지웠다. 여기서는 어제보다 오래된 일 단위 키를 지운다.
    sql('DELETE FROM rate_limits WHERE day_key < ?1', kstDateKeyDaysAgo(nowMs, 1)),
    sql('DELETE FROM lobby_presence WHERE seen_at < ?1', nowMs - DAY_MS),
  ];
}

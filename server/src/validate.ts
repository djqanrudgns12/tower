import type { SubmittedAnswer } from '../../src/contracts/lobby';
import { UUID_PATTERN } from './crypto';

/**
 * 요청 값 판정. 필드 이름은 지금 RPC 인자(p_*)를 그대로 쓴다(단계 5에서 앱 쪽 변경을 줄이려고).
 * Postgres 타입 범위(smallint·integer·bigint)를 그대로 지킨다.
 */
const SMALLINT = { min: -32768, max: 32767 } as const;
const INTEGER = { min: -2147483648, max: 2147483647 } as const;
const MAX_ACTIVE_TICKS = 9007199254740991;
/** Postgres regrade_run_answers의 octet_length(p_answers::text) 상한. */
export const MAX_ANSWERS_JSON_BYTES = 262144;
export const MAX_ANSWERS = 1600;

const encoder = new TextEncoder();

function intIn(value: unknown, range: { min: number; max: number }): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max ? value : null;
}

const asText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Postgres uuid 입력은 대소문자를 가리지 않는다. 저장은 소문자로 한다. */
export function parseRunId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  return UUID_PATTERN.test(lower) ? lower : null;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)$/i;

/** timestamptz로 받던 p_ended_at. 시간대가 적힌 ISO 8601만 받는다. */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export interface SubmitClaim {
  runId: string;
  grade: number;
  difficulty: string;
  pt: number;
  completedWave: number;
  correct: number;
  wrong: number;
  skipped: number;
  endedAtMs: number;
  endedAtWave: number;
  activeTicks: number;
  balanceVersion: string | null;
  bankVersion: string | null;
  mapId: string | null;
  answers: unknown;
}

/** Postgres PLAUSIBILITY_REJECTED 조건(빈 값·범위·웨이브 관계). 통과하지 못하면 null. */
export function parseSubmitClaim(body: Record<string, unknown>): SubmitClaim | null {
  const runId = parseRunId(body.p_run_id);
  const grade = intIn(body.p_grade, SMALLINT);
  const difficulty = asText(body.p_difficulty);
  const pt = intIn(body.p_pt, INTEGER);
  const completedWave = intIn(body.p_completed_wave, SMALLINT);
  const correct = intIn(body.p_correct, SMALLINT);
  const wrong = intIn(body.p_wrong, SMALLINT);
  const skipped = intIn(body.p_skipped, SMALLINT);
  const endedAtMs = parseTimestamp(body.p_ended_at);
  const endedAtWave = intIn(body.p_ended_at_wave, SMALLINT);
  const activeTicks = intIn(body.p_active_ticks, { min: -MAX_ACTIVE_TICKS, max: MAX_ACTIVE_TICKS });
  if (runId === null || grade === null || difficulty === null || pt === null || completedWave === null || correct === null
    || wrong === null || skipped === null || endedAtMs === null || endedAtWave === null || activeTicks === null) return null;
  if (completedWave < 1 || endedAtWave < completedWave || endedAtWave > completedWave + 1
    || correct < 0 || wrong < 0 || skipped < 0 || activeTicks < 0) return null;
  return {
    runId, grade, difficulty, pt, completedWave, correct, wrong, skipped, endedAtMs, endedAtWave, activeTicks,
    balanceVersion: asText(body.p_balance_version),
    bankVersion: asText(body.p_bank_version),
    mapId: asText(body.p_map_id),
    answers: body.p_answers ?? null,
  };
}

const ANSWER_KEYS = ['encounterId', 'questionId', 'revision', 'choice', 'phase', 'wave'] as const;
const nonNegativeInt32 = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= INTEGER.max;

/**
 * Postgres regrade_run_answers의 입력 검사(배열·개수·크기·필드 타입). 통과하면 재채점 함수에 넘길 배열을 돌려준다.
 * 선택지·단계 값과 순서 규칙은 계약의 regradeRunAnswers가 본다.
 */
export function parseAnswers(value: unknown): SubmittedAnswer[] | null {
  if (!Array.isArray(value) || value.length > MAX_ANSWERS) return null;
  if (encoder.encode(JSON.stringify(value)).length > MAX_ANSWERS_JSON_BYTES) return null;
  const answers: SubmittedAnswer[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
    const a = item as Record<string, unknown>;
    if (!ANSWER_KEYS.every(key => key in a)) return null;
    if (!nonNegativeInt32(a.encounterId) || !nonNegativeInt32(a.revision) || !nonNegativeInt32(a.wave)) return null;
    if (typeof a.questionId !== 'string' || typeof a.phase !== 'string' || typeof a.choice !== 'string') return null;
    answers.push(a as unknown as SubmittedAnswer);
  }
  return answers;
}

/** 정답 키 조회에 쓸 문항 ID 목록(중복 제거). 답안 모양이 틀려도 문자열만 골라 낸다. */
export function questionIdsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const item of value) {
    const id = (item as { questionId?: unknown } | null)?.questionId;
    if (typeof id === 'string') ids.add(id);
  }
  return [...ids];
}

/** 같은 제출인지 가리는 해시의 입력. 객체 키를 정렬해 Postgres jsonb처럼 키 순서와 무관하게 만든다. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export const RANKING_TABS = ['single_score', 'best_wave', 'honor_points'] as const;
export type RankingTab = (typeof RANKING_TABS)[number];
const GRADES = [0, 3, 4, 5, 6];
const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Crazy'];
const PERIODS = ['weekly', 'season1', 'all_time'];

export interface RankingParams {
  tab: RankingTab;
  grade: number;
  difficulty: string;
  period: 'weekly' | 'season1' | 'all_time';
  limit: number;
  offset: number;
}

function queryInt(params: URLSearchParams, name: string, fallback: number): number | null {
  const raw = params.get(name);
  if (raw === null) return fallback;
  return /^-?\d{1,6}$/.test(raw) ? Number(raw) : null;
}

/** Postgres get_leaderboard_slice의 INVALID_QUERY 조건. p_limit·p_offset을 빼면 기본값 8·0(RPC 기본값과 같다). */
export function parseRankingParams(params: URLSearchParams): RankingParams | null {
  const tab = params.get('p_tab');
  const gradeText = params.get('p_grade');
  const difficulty = params.get('p_difficulty');
  const period = params.get('p_period');
  const limit = queryInt(params, 'p_limit', 8);
  const offset = queryInt(params, 'p_offset', 0);
  if (tab === null || gradeText === null || difficulty === null || period === null || limit === null || offset === null) return null;
  const grade = /^\d$/.test(gradeText) ? Number(gradeText) : NaN;
  if (!(RANKING_TABS as readonly string[]).includes(tab) || !GRADES.includes(grade) || !DIFFICULTIES.includes(difficulty)
    || !PERIODS.includes(period) || limit < 1 || limit > 50 || offset < 0 || offset > 10000) return null;
  return { tab: tab as RankingTab, grade, difficulty, period: period as RankingParams['period'], limit, offset };
}

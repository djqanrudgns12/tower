/**
 * 엔드포인트 판단. 검사 순서는 Postgres 함수(supabase/migrations 네 번째 판)와 같다:
 * 속도 제한 → 입력 검사 → 승인 조건 → 중복 → 시작 기록 → 시간 → 재채점 → 점수 → 기록.
 */
import { computeHonorPoints, matchesRegradedRun, regradeRunAnswers } from '../../src/contracts/lobby';
import { ipHash, sha256Hex, signDeviceToken, type ServerKeys } from './crypto';
import { isConstraintError, type SqlDatabase, type SqlRow, type SqlStatement } from './db';
import { BODY_LIMIT_SMALL, BODY_LIMIT_SUBMIT, HttpError, json, readJsonObject } from './http';
import { cleanServerNickname } from './nickname';
import { minimumDurationMs, parseVerificationRules } from './rules';
import { rankStandings, type RankedPlayer, type StandingRow } from './ranking';
import {
  existingRunStatement, insertCompletedRunStatement, leaderboardRowsStatement, myHonorRunIdsStatement,
  RATE_LIMITS, rateLimitState, rateLimitStatement, startStatements, submitLookupStatements, VERIFIED_LEVEL, visitStatements,
  type LeaderboardScope, type RateAction,
} from './store';
import { DAY_MS, isoSeconds, kstDateKey, kstIsoWeekKey, secondsUntilKstMidnight, secondsUntilNextMinute } from './time';
import { canonicalJson, parseAnswers, parseRankingParams, parseRunId, parseSubmitClaim, questionIdsOf } from './validate';

export interface Context {
  request: Request;
  url: URL;
  db: SqlDatabase;
  keys: ServerKeys;
  /** 요청 하나에서 같은 시각을 쓴다(Postgres now()가 트랜잭션 시작 시각인 것과 같다). */
  now: number;
}

/** Postgres lobby_retry_after: 일 한도에 닿았으면 다음 한국 자정까지, 아니면 다음 분까지. */
async function rateLimitedError(ctx: Context, subject: string, action: RateAction): Promise<HttpError> {
  const [rows = []] = await ctx.db.batch([rateLimitState(subject, action)]);
  const row = rows[0];
  const dayFull = row !== undefined && row.day_key === kstDateKey(new Date(ctx.now)) && Number(row.day_calls) >= RATE_LIMITS[action].day;
  return new HttpError(429, 'RATE_LIMITED', dayFull ? secondsUntilKstMidnight(ctx.now) : secondsUntilNextMinute(ctx.now));
}

/** 속도 제한 증가와 나머지 문장을 한 batch로 보낸다. 한도를 넘으면 전부 되돌아가고 429가 된다. */
async function limited(ctx: Context, subject: string, action: RateAction, statements: SqlStatement[] = []): Promise<SqlRow[][]> {
  try {
    const [, ...rest] = await ctx.db.batch([rateLimitStatement(subject, action, ctx.now), ...statements]);
    return rest;
  } catch (error) {
    if (isConstraintError(error, 'rate_limited')) throw await rateLimitedError(ctx, subject, action);
    throw error;
  }
}

/** POST /v1/device: 기기 ID와 서명 토큰. 학교 IP 하나에 한 반이 몰려도 막히지 않을 만큼 IP 한도를 넉넉히 둔다. */
export async function issueDevice(ctx: Context): Promise<Response> {
  await readJsonObject(ctx.request, BODY_LIMIT_SMALL);
  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  await limited(ctx, `ip:${await ipHash(ctx.keys, ip)}`, 'device');
  const deviceId = crypto.randomUUID();
  return json({ deviceId, token: await signDeviceToken(ctx.keys, deviceId) });
}

/** POST /v1/lobby-visit: record_lobby_visit + 최근 5분 방문 기기 수. */
export async function recordLobbyVisit(ctx: Context, hash: string): Promise<Response> {
  await readJsonObject(ctx.request, BODY_LIMIT_SMALL);
  const [, , metrics = []] = await limited(ctx, hash, 'visit', visitStatements(hash, ctx.now));
  const m = metrics[0] ?? {};
  return json({
    todayPlays: Number(m.today_plays ?? 0),
    totalVisitors: Number(m.total_visitors ?? 0),
    totalPlays: Number(m.total_plays ?? 0),
    updatedAtIso: isoSeconds(ctx.now),
    recentVisitors: Number(m.recent_visitors ?? 0),
  });
}

/** POST /v1/runs/start: record_run_start. */
export async function recordRunStart(ctx: Context, hash: string): Promise<Response> {
  const body = await readJsonObject(ctx.request, BODY_LIMIT_SMALL);
  const runId = parseRunId(body.p_run_id);
  if (runId === null) {
    await limited(ctx, hash, 'start');
    throw new HttpError(422, 'INVALID_RUN_ID');
  }
  const [recent = [], owner = [], inserted = []] = await limited(ctx, hash, 'start', startStatements(runId, hash, ctx.now));
  if (Number(recent[0]?.recent ?? 0) >= 3) throw await rateLimitedError(ctx, hash, 'start');
  if (Number(owner[0]?.owner_conflict ?? 0) === 1) throw new HttpError(403, 'OWNER_REJECTED');
  return json({ counted: inserted.length > 0 });
}

function duplicateOutcome(existing: SqlRow, hash: string, payloadHash: string): Response {
  if (existing.player_hash === hash && existing.payload_hash === payloadHash) {
    return json({ ok: true, status: 'already_recorded', verificationLevel: existing.verification_level });
  }
  throw new HttpError(409, 'DUPLICATE_RUN_REJECTED');
}

/** POST /v1/runs/submit: submit_completed_run(서버 재채점). */
export async function submitCompletedRun(ctx: Context, hash: string): Promise<Response> {
  const body = await readJsonObject(ctx.request, BODY_LIMIT_SUBMIT);
  const reject = async (status: number, code: string): Promise<never> => {
    await limited(ctx, hash, 'submit');
    throw new HttpError(status, code);
  };
  if (body.p_content_mode !== 'published') {
    await limited(ctx, hash, 'submit');
    return json({ ok: true, status: 'dev_mode_skipped' });
  }
  const nickname = cleanServerNickname(body.p_nickname);
  if (nickname === null) return reject(422, 'NICKNAME_REJECTED');
  const claim = parseSubmitClaim(body);
  if (claim === null) return reject(422, 'PLAUSIBILITY_REJECTED');

  const [conditions = [], ruleRows = [], existingRows = [], startRows = [], keyRows = []] = await limited(ctx, hash, 'submit',
    submitLookupStatements({ ...claim, hash, questionIds: questionIdsOf(claim.answers) }));
  const ruleText = ruleRows[0]?.rules;
  if (conditions.length === 0 || claim.balanceVersion === null || claim.bankVersion === null || claim.mapId === null || typeof ruleText !== 'string') {
    throw new HttpError(422, 'VERSION_REJECTED');
  }
  const rules = parseVerificationRules(ruleText);

  const payloadHash = await sha256Hex(canonicalJson([
    claim.runId, nickname, claim.grade, claim.difficulty, claim.pt, claim.completedWave, claim.correct, claim.wrong, claim.skipped,
    claim.balanceVersion, claim.bankVersion, claim.mapId, new Date(claim.endedAtMs).toISOString(), claim.endedAtWave, claim.answers, claim.activeTicks,
  ]));
  if (existingRows[0]) return duplicateOutcome(existingRows[0], hash, payloadHash);

  const startedAt = startRows[0]?.started_at;
  if (typeof startedAt !== 'number') throw new HttpError(422, 'START_REQUIRED');
  const elapsedMs = ctx.now - startedAt;
  const minMs = minimumDurationMs(rules, claim.completedWave);
  if (elapsedMs < minMs || Math.trunc((claim.activeTicks * 1000) / 30) < minMs || claim.activeTicks > Math.ceil((elapsedMs * 30) / 1000) + 300) {
    throw new HttpError(422, 'DURATION_REJECTED');
  }
  if (Array.isArray(claim.answers) && claim.answers.length > Math.trunc(claim.activeTicks / 30) + 1) throw new HttpError(422, 'ANSWER_MISMATCH');

  const answers = parseAnswers(claim.answers);
  const keys = new Map(keyRows.map(row => [`${String(row.question_id)}@${Number(row.revision)}`, String(row.correct_option)]));
  const score = answers ? regradeRunAnswers(answers, keys, rules, claim.completedWave, claim.endedAtWave) : null;
  if (!score || score.correct !== claim.correct || score.wrong !== claim.wrong || score.skipped !== claim.skipped) {
    throw new HttpError(422, 'ANSWER_MISMATCH');
  }
  const scoreClaim = { pt: claim.pt, correct: claim.correct, wrong: claim.wrong, skipped: claim.skipped, endedWave: claim.endedAtWave };
  if (!matchesRegradedRun(scoreClaim, score, rules)) throw new HttpError(422, 'PT_MISMATCH');

  // 주간 계산용 종료 시각은 최근 7일 안으로 묶고, 기기가 보낸 원본은 local_ended_at에 따로 둔다.
  const endedAt = Math.max(ctx.now - 7 * DAY_MS, Math.min(claim.endedAtMs, ctx.now));
  const row = {
    runId: claim.runId, hash, nickname, grade: claim.grade, difficulty: claim.difficulty, pt: claim.pt,
    honorPt: computeHonorPoints({ pt: claim.pt, difficulty: claim.difficulty, completedWave: claim.completedWave, correct: claim.correct }),
    completedWave: claim.completedWave, correct: claim.correct, wrong: claim.wrong, skipped: claim.skipped,
    balanceVersion: claim.balanceVersion, bankVersion: claim.bankVersion, mapId: claim.mapId,
    weekKey: kstIsoWeekKey(new Date(endedAt)), kstDate: kstDateKey(new Date(endedAt)),
    localEndedAt: claim.endedAtMs, endedAt, receivedAt: ctx.now, payloadHash,
  };
  try {
    await ctx.db.batch([insertCompletedRunStatement(row)]);
  } catch (error) {
    // 같은 판이 동시에 두 번 들어온 경우(Postgres는 advisory lock으로 줄 세웠다). 먼저 들어간 기록과 비교한다.
    if (isConstraintError(error, 'completed_runs.run_id')) {
      const [rows = []] = await ctx.db.batch([existingRunStatement(claim.runId)]);
      if (rows[0]) return duplicateOutcome(rows[0], hash, payloadHash);
    }
    throw error;
  }
  return json({ ok: true, status: 'recorded', verificationLevel: VERIFIED_LEVEL });
}

function secondaryLabel(tab: LeaderboardScope['tab'], secondary: number): string {
  if (tab === 'honor_points') return `완주 ${secondary}판`;
  if (tab === 'best_wave') return `${secondary}점`;
  return `${secondary}웨이브`;
}

/** GET /v1/leaderboard: get_leaderboard_slice. */
export async function getLeaderboard(ctx: Context, hash: string): Promise<Response> {
  const params = parseRankingParams(ctx.url.searchParams);
  if (params === null) {
    await limited(ctx, hash, 'ranking');
    throw new HttpError(422, 'INVALID_QUERY');
  }
  const weekKey = params.period === 'weekly' ? kstIsoWeekKey(new Date(ctx.now)) : null;
  const scope: LeaderboardScope = { tab: params.tab, period: weekKey ? `week:${weekKey}` : 'all', grade: params.grade, difficulty: params.difficulty };
  const statements = [leaderboardRowsStatement(scope)];
  if (params.tab === 'honor_points') statements.push(myHonorRunIdsStatement(hash, params.grade, weekKey));
  const [standingRows = [], myRunRows = []] = await limited(ctx, hash, 'ranking', statements);
  const ranked = rankStandings(standingRows as unknown as StandingRow[], params.tab);
  const myHonorRunIds = myRunRows.map(r => String(r.run_id));
  const toEntry = (p: RankedPlayer) => {
    const isMe = p.hash === hash;
    return {
      rank: p.rank,
      playerIdHash: p.hash.slice(0, 16),
      isMe,
      runIds: isMe ? (params.tab === 'honor_points' ? myHonorRunIds : [String(p.runId)]) : [],
      nickname: p.nickname,
      grade: p.grade,
      difficulty: p.difficulty,
      primaryValue: p.val,
      secondaryLabel: secondaryLabel(params.tab, p.secondary),
      achievedAtIso: new Date(p.achievedAt).toISOString(),
    };
  };
  const mine = ranked.find(p => p.hash === hash);
  return json({
    entries: ranked.slice(params.offset, params.offset + params.limit).map(toEntry),
    totalCount: ranked.length,
    myEntry: mine ? toEntry(mine) : null,
  });
}

/**
 * 엔드포인트 판단. 검사 순서는 Postgres 함수(docs/archive/supabase/migrations 네 번째 판)와 같다:
 * 속도 제한 → 입력 검사 → 승인 조건 → 중복 → 시작 기록 → 시간 → 재채점 → 점수 → 기록.
 */
import { cleanPublicSchoolName, computeHonorPoints, matchesRegradedRun, regradeRunAnswers } from '../../src/contracts/lobby';
import { sha256Hex, signDeviceToken, type ServerKeys } from './crypto';
import { isConstraintError, type SqlDatabase, type SqlRow, type SqlStatement } from './db';
import { BODY_LIMIT_SMALL, BODY_LIMIT_SUBMIT, HttpError, json, readJsonObject } from './http';
import { cleanServerNickname } from './nickname';
import { minimumDurationMs, parseVerificationRules } from './rules';
import { rankStandings, type RankedPlayer, type StandingRow } from './ranking';
import type { CacheLike, RankingCache } from './ranking-cache';
import {
  existingRunStatement, insertCompletedRunStatement, leaderboardRowsStatement, myHonorRunIdsStatement,
  DEVICE_RATE_LIMITS, IP_RATE_LIMITS, rateLimitState, rateLimitStatement, startStatements, submitLookupStatements, VERIFIED_LEVEL,
  visitStatements, type LeaderboardScope, type RateAction, type RateLimit,
} from './store';
import { DAY_MS, isoSeconds, kstDateKey, kstIsoWeekKey, secondsUntilKstMidnight, secondsUntilNextMinute } from './time';
import { canonicalJson, parseAnswers, parseRankingParams, parseRunId, parseSubmitClaim, questionIdsOf } from './validate';

export interface Context {
  request: Request;
  url: URL;
  db: SqlDatabase;
  keys: ServerKeys;
  /** 속도 제한에 쓰는 IP 식별자(`ip:<HMAC>`). IP 원문은 저장하지 않는다. */
  ipSubject: string;
  clock(): number;
  /**
   * 요청 하나에서 같은 시각을 쓴다(Postgres now()가 트랜잭션 시작 시각인 것과 같다).
   * 본문이 있는 요청은 본문을 다 받은 뒤 다시 정한다(readBody). 느리게 올라온 본문이 옛 시각으로 세지지 않게.
   */
  now: number;
  /** 랭킹 응답 캐시. workers.dev·로컬 Node·RANKING_CACHE_SECONDS=0이면 null. */
  rankingCache: RankingCache | null;
  /** 거점 공용 캐시(학교 명부 검색 24시간 캐시 겸용). */
  edgeCache: CacheLike | null;
  /** 선택적 NEIS 인증키. 없어도 공개 기본 한도로 조회한다. */
  neisApiKey?: string | undefined;
}

/** 본문을 크기 제한 안에서 읽고, 다 받은 시각을 이 요청의 시각으로 삼는다. */
async function readBody(ctx: Context, limit: number): Promise<Record<string, unknown>> {
  const body = await readJsonObject(ctx.request, limit);
  ctx.now = ctx.clock();
  return body;
}

interface Bucket {
  subject: string;
  action: string;
  limit: RateLimit;
}

type LimitAction = RateAction | 'device' | 'schools';

/** 기기 칸(Postgres allow_lobby_rpc)과 IP 칸. 기기 발급·학교 검색은 IP 칸만 본다. */
function buckets(ctx: Context, hash: string | null, action: LimitAction): Bucket[] {
  const list: Bucket[] = [{ subject: ctx.ipSubject, action, limit: IP_RATE_LIMITS[action] }];
  if (hash !== null && action !== 'device' && action !== 'schools') {
    list.unshift({ subject: hash, action, limit: DEVICE_RATE_LIMITS[action] });
  }
  return list;
}

/** Postgres lobby_retry_after: 어느 칸이든 일 한도에 닿았으면 다음 한국 자정까지, 아니면 다음 분까지. */
async function rateLimitedError(ctx: Context, list: Bucket[]): Promise<HttpError> {
  const states = await ctx.db.batch(list.map(b => rateLimitState(b.subject, b.action)));
  const today = kstDateKey(new Date(ctx.now));
  const dayFull = states.some(rows => rows.some(row => row.day_key === today && Number(row.day_calls) >= Number(row.day_limit)));
  return new HttpError(429, 'RATE_LIMITED', dayFull ? secondsUntilKstMidnight(ctx.now) : secondsUntilNextMinute(ctx.now));
}

/**
 * 기기 칸·IP 칸 증가와 나머지 문장을 한 batch로 보낸다. 어느 칸이든 한도를 넘으면 전부 되돌아가고 429가 된다.
 * 기기 칸은 Postgres allow_lobby_rpc와 같고, IP 칸은 기기를 여러 개 받아 우회하는 것을 막는다.
 */
async function limited(ctx: Context, hash: string | null, action: LimitAction, statements: SqlStatement[] = []): Promise<SqlRow[][]> {
  const list = buckets(ctx, hash, action);
  const checks = list.map(b => rateLimitStatement(b.subject, b.action, b.limit, ctx.now));
  try {
    return (await ctx.db.batch([...checks, ...statements])).slice(checks.length);
  } catch (error) {
    if (isConstraintError(error, 'rate_limited')) throw await rateLimitedError(ctx, list);
    throw error;
  }
}

/** GET /v1/health: D1을 건드리지 않고 Worker·비밀값 준비 상태를 확인한다. */
export async function healthCheck(): Promise<Response> {
  return json({ ok: true });
}

interface SchoolDirectoryItem {
  schoolCode: string;
  schoolName: string;
  officeCode: string;
  officeName: string;
  locationName: string;
  schoolKind: string;
  roadAddress: string;
}

const SCHOOLS_CACHE_PATH = '/__schools-cache/v1';
const SCHOOLS_CACHE_TTL_SECONDS = 86_400;

/**
 * GET /v1/schools?q=...: 학교 와이파이 방화벽이 open.neis.go.kr 직접 접근을 막아도
 * 같은 API 도메인으로 학교 목록을 조회할 수 있게 하는 캐시 프록시.
 * 거점 캐시에 있으면 속도 제한 D1 쓰기도 생략한다.
 */
export async function searchSchools(ctx: Context): Promise<Response> {
  const rawQuery = (ctx.url.searchParams.get('q') ?? '').trim();
  if (rawQuery.length < 2) {
    return json({ schools: [] });
  }
  const query = cleanPublicSchoolName(rawQuery);
  if (!query) {
    await limited(ctx, null, 'schools');
    throw new HttpError(422, 'INVALID_QUERY');
  }

  const cacheReq = new Request(`${ctx.url.origin}${SCHOOLS_CACHE_PATH}/${encodeURIComponent(query)}`);
  if (ctx.edgeCache) {
    try {
      const hit = await ctx.edgeCache.match(cacheReq);
      if (hit) {
        const cached = (await hit.json()) as { schools?: unknown };
        if (Array.isArray(cached?.schools)) {
          return json({ schools: cached.schools }, 200, { 'Cache-Control': `public, max-age=${SCHOOLS_CACHE_TTL_SECONDS}` });
        }
      }
    } catch {
      // 캐시 읽기 실패는 무시하고 원본 조회로 간다.
    }
  }

  await limited(ctx, null, 'schools');

  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: '15',
    SCHUL_NM: query,
  });
  if (ctx.neisApiKey) params.set('KEY', ctx.neisApiKey);

  let upstream: Response;
  try {
    upstream = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`, {
      signal: AbortSignal.timeout(4500),
    });
  } catch {
    throw new HttpError(502, 'UPSTREAM_UNAVAILABLE');
  }
  if (!upstream.ok) throw new HttpError(502, 'UPSTREAM_UNAVAILABLE');

  let data: {
    schoolInfo?: [{ head?: unknown[] }, { row?: Array<Record<string, unknown>> }];
    RESULT?: { CODE?: string };
  };
  try {
    data = (await upstream.json()) as typeof data;
  } catch {
    throw new HttpError(502, 'UPSTREAM_UNAVAILABLE');
  }

  const seen = new Set<string>();
  const schools: SchoolDirectoryItem[] = [];
  if (data.RESULT?.CODE !== 'INFO-200') {
    const rows = data.schoolInfo?.[1]?.row;
    if (!Array.isArray(rows)) throw new HttpError(502, 'UPSTREAM_UNAVAILABLE');
    for (const r of rows) {
      const schoolCode = String(r.SD_SCHUL_CODE ?? '').trim();
      const schoolName = String(r.SCHUL_NM ?? '').trim();
      if (!schoolCode || !schoolName || seen.has(schoolCode)) continue;
      seen.add(schoolCode);
      schools.push({
        schoolCode,
        schoolName,
        officeCode: String(r.ATPT_OFCDC_SC_CODE ?? '').trim(),
        officeName: String(r.ATPT_OFCDC_SC_NM ?? '').trim(),
        locationName: String(r.LCTN_SC_NM ?? '').trim(),
        schoolKind: String(r.SCHUL_KND_SC_NM ?? '').trim(),
        roadAddress: String(r.ORG_RDNMA ?? '').trim(),
      });
    }
    schools.sort((a, b) => {
      const aElem = a.schoolKind.includes('초등학교') ? 0 : 1;
      const bElem = b.schoolKind.includes('초등학교') ? 0 : 1;
      return aElem - bElem;
    });
  }

  const payload = { schools };
  if (ctx.edgeCache) {
    await ctx.edgeCache.put(cacheReq, new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${SCHOOLS_CACHE_TTL_SECONDS}` },
    })).catch(() => undefined);
  }
  return json(payload, 200, { 'Cache-Control': `public, max-age=${SCHOOLS_CACHE_TTL_SECONDS}` });
}

/** POST /v1/device: 기기 ID와 서명 토큰. 학교 IP 하나에 한 학년이 몰려도 막히지 않을 만큼 IP 한도를 넉넉히 둔다. */
export async function issueDevice(ctx: Context): Promise<Response> {
  await readBody(ctx, BODY_LIMIT_SMALL);
  await limited(ctx, null, 'device');
  const deviceId = crypto.randomUUID();
  return json({ deviceId, token: await signDeviceToken(ctx.keys, deviceId) });
}

/** POST /v1/lobby-visit: record_lobby_visit + 최근 5분 방문 기기 수. */
export async function recordLobbyVisit(ctx: Context, hash: string): Promise<Response> {
  await readBody(ctx, BODY_LIMIT_SMALL);
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
  const body = await readBody(ctx, BODY_LIMIT_SMALL);
  const runId = parseRunId(body.p_run_id);
  if (runId === null) {
    await limited(ctx, hash, 'start');
    throw new HttpError(422, 'INVALID_RUN_ID');
  }
  const [recent = [], owner = [], inserted = []] = await limited(ctx, hash, 'start', startStatements(runId, hash, ctx.now));
  if (Number(recent[0]?.recent ?? 0) >= 3) throw await rateLimitedError(ctx, buckets(ctx, hash, 'start'));
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
  const body = await readBody(ctx, BODY_LIMIT_SUBMIT);
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
    schoolCode: claim.schoolCode, schoolName: claim.schoolName,
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
  // 새 기록이 바꾸는 랭킹 범위를 이 거점 캐시에서 지운다(제출한 학생이 홈으로 돌아가 바로 보게).
  await ctx.rankingCache?.purgeForRun({
    grade: row.grade,
    difficulty: row.difficulty,
    weekKey: row.weekKey,
    ...(row.schoolCode ? { schoolCode: row.schoolCode } : {}),
    ...(row.schoolName ? { schoolName: row.schoolName } : {}),
  });
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
  const scope: LeaderboardScope = {
    tab: params.tab,
    period: weekKey ? `week:${weekKey}` : 'all',
    grade: params.grade,
    difficulty: params.difficulty,
    ...(params.schoolCode ? { schoolCode: params.schoolCode } : params.schoolName ? { schoolName: params.schoolName } : {}),
  };
  // 캐시 적중이면 속도 제한 칸을 쓰지 않는다: 적중은 D1 행을 쓰지 않으므로 아낄 것이 없고, 칸을 세면 그것만으로 쓰기 2행이 든다.
  let ranked = await ctx.rankingCache?.get(scope) ?? null;
  let myRunRows: SqlRow[] = [];
  if (ranked) {
    if (params.tab === 'honor_points' && ranked.some(p => p.hash === hash)) {
      [myRunRows = []] = await ctx.db.batch([myHonorRunIdsStatement(hash, scope, weekKey)]);
    }
  } else {
    const statements = [leaderboardRowsStatement(scope)];
    if (params.tab === 'honor_points') statements.push(myHonorRunIdsStatement(hash, scope, weekKey));
    const [standingRows = [], mine = []] = await limited(ctx, hash, 'ranking', statements);
    ranked = rankStandings(standingRows as unknown as StandingRow[], params.tab);
    myRunRows = mine;
    await ctx.rankingCache?.put(scope, ranked);
  }
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
      ...(p.schoolName ? { schoolName: p.schoolName } : {}),
    };
  };
  const mine = ranked.find(p => p.hash === hash);
  return json({
    entries: ranked.slice(params.offset, params.offset + params.limit).map(toEntry),
    totalCount: ranked.length,
    myEntry: mine ? toEntry(mine) : null,
  });
}

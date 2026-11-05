import { z } from 'zod';
import { getAccessToken, readApiEnv, rejectAccessToken, setPublicRecordNotice, type ApiEnv } from './auth';
import { isRecordSharingEnabled } from './settings';
import type { DifficultyId } from '../contracts/balance';
import {
  cleanPublicNickname,
  computeHonorPoints,
  kstDateKey,
  kstIsoWeekKey,
  lobbyVisitResponseSchema,
  rankingSliceResponseSchema,
  type RankingEntry,
  type RankingQuery,
  type RankingResponse,
  type TelemetrySnapshot,
} from '../contracts/lobby';
import {
  deferPendingRunSync,
  enqueueRunSync,
  getPendingRunSync,
  listPendingRunSyncs,
  listRecords,
  removePendingRunSync,
  type RunRecord,
} from './db';

const VISIT_DAY_KEY = 'vocabulary-td.visitDay';
const RPC_TIMEOUT_MS = 4500;

/** 홈 방문 응답: 지금 RPC 결과 4개 + 서버가 세는 최근 5분 방문 기기 수(실시간 접속 웹소켓 대체). */
const lobbyVisitWithRecentSchema = lobbyVisitResponseSchema.extend({ recentVisitors: z.number().int().min(0) });

class PermanentRpcError extends Error {
  constructor(readonly reason?: string) { super('RPC_REJECTED'); }
}
class RetryableRpcError extends Error {
  constructor(readonly retryAfterMs = 30_000) { super('RETRY_LATER'); }
}

function retryAfterMs(response: Response): number {
  const header = response.headers.get('Retry-After')?.trim();
  if (!header) return 30_000;
  const delay = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(delay) ? Math.max(30_000, Math.min(delay, Number.MAX_SAFE_INTEGER - Date.now())) : 30_000;
}

/**
 * 기록·랭킹 서버 호출. 401은 토큰을 버리고 다음에 새로 받으며, 408·429·5xx·연결 실패는 나중에 다시 보낸다.
 * 그 밖의 4xx는 서버가 판정해 거부한 것이므로 다시 보내지 않는다.
 */
async function callApi<T>(env: ApiEnv, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, canSend?: () => Promise<boolean>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const token = await getAccessToken(env);
    if (!token || (canSend && !await canSend()) || !isRecordSharingEnabled()) return null;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${env.base}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 401) rejectAccessToken(env);
      if (res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status)) {
        const detail = await res.json().catch(() => null) as { error?: unknown } | null;
        throw new PermanentRpcError(typeof detail?.error === 'string' ? detail.error : undefined);
      }
      throw new RetryableRpcError(retryAfterMs(res));
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof PermanentRpcError || error instanceof RetryableRpcError) throw error;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeGradeValue(g: number): 3 | 4 | 5 | 6 {
  return g === 4 || g === 5 || g === 6 ? g : 3;
}

function normalizeDifficultyValue(d: string): DifficultyId {
  return d === 'Easy' || d === 'Normal' || d === 'Hard' || d === 'Crazy' ? d : 'Normal';
}

/** 로컬 IndexedDB 기록으로부터 4대 분류 순위표를 계산한다(오프라인 폴백 및 ‘내 기기 기록’ 탭 겸용). */
export async function buildLocalRanking(
  query: RankingQuery,
  currentNickname: string,
  now: Date = new Date(),
): Promise<RankingResponse> {
  let records: RunRecord[];
  try {
    records = await listRecords();
  } catch {
    records = [];
  }

  const cleanNick = currentNickname.trim();
  const curWeek = kstIsoWeekKey(now);

  if (query.tab === 'local_device') {
    const filtered = records.filter(r => query.grade === 'all' || r.grade === query.grade);
    const sorted = [...filtered].sort((a, b) => b.pt - a.pt || b.completedWave - a.completedWave || a.endedAt.localeCompare(b.endedAt));
    const entries: RankingEntry[] = sorted.slice(query.offset, query.offset + query.limit).map((r, idx) => {
      const totalQ = r.correct + r.wrong + r.skipped;
      const acc = totalQ > 0 ? Math.round((r.correct * 100) / totalQ) : 0;
      return {
        rank: query.offset + idx + 1,
        playerIdHash: r.runId.slice(0, 16),
        isMe: cleanNick ? r.nickname === cleanNick : true,
        nickname: r.nickname,
        grade: normalizeGradeValue(r.grade),
        difficulty: normalizeDifficultyValue(r.difficulty),
        primaryValue: r.pt,
        secondaryLabel: `${r.grade}학년 · ${r.completedWave}웨이브 · 정답 ${acc}%`,
        achievedAtIso: r.endedAt,
      };
    });
    const myTop = sorted.find(r => !cleanNick || r.nickname === cleanNick) ?? null;
    const myIdx = myTop ? sorted.indexOf(myTop) : -1;
    const myEntry: RankingEntry | null = myTop
      ? {
          rank: myIdx + 1,
          playerIdHash: myTop.runId.slice(0, 16),
          isMe: true,
          nickname: myTop.nickname,
          grade: normalizeGradeValue(myTop.grade),
          difficulty: normalizeDifficultyValue(myTop.difficulty),
          primaryValue: myTop.pt,
          secondaryLabel: `${myTop.grade}학년 · ${myTop.completedWave}웨이브`,
          achievedAtIso: myTop.endedAt,
        }
      : null;
    return { source: 'local_fallback', entries, totalCount: sorted.length, myEntry };
  }

  if (query.tab === 'honor_points') {
    const periodFiltered = records.filter(r => {
      if (r.completedWave < 1) return false;
      if (query.grade !== 'all' && r.grade !== query.grade) return false;
      if (query.period === 'weekly') return kstIsoWeekKey(new Date(r.endedAt)) === curWeek;
      return true;
    });
    const byNick = new Map<string, { nickname: string; grade: 3 | 4 | 5 | 6; sum: number; count: number; lastAt: string }>();
    for (const r of periodFiltered) {
      const pts = computeHonorPoints(r);
      if (pts <= 0) continue;
      const key = r.nickname || '익명 대원';
      const prev = byNick.get(key);
      if (!prev) {
        byNick.set(key, { nickname: key, grade: normalizeGradeValue(r.grade), sum: pts, count: 1, lastAt: r.endedAt });
      } else {
        prev.sum += pts;
        prev.count += 1;
        if (r.endedAt > prev.lastAt) prev.lastAt = r.endedAt;
      }
    }
    const ranked = [...byNick.values()].sort((a, b) => b.sum - a.sum || a.count - b.count || a.lastAt.localeCompare(b.lastAt));
    const allEntries: RankingEntry[] = ranked.map((item, i) => ({
      rank: i + 1,
      playerIdHash: `local-${i + 1}`,
      isMe: cleanNick ? item.nickname === cleanNick : i === 0,
      nickname: item.nickname,
      grade: query.grade === 'all' ? item.grade : query.grade,
      difficulty: 'Normal',
      primaryValue: item.sum,
      secondaryLabel: `완주 ${item.count}판 · ${query.grade === 'all' ? '전체 학년' : `${query.grade}학년`}`,
      achievedAtIso: item.lastAt,
    }));
    const myEntry = (cleanNick ? allEntries.find(e => e.nickname === cleanNick) : allEntries[0]) ?? null;
    return {
      source: 'local_fallback',
      entries: allEntries.slice(query.offset, query.offset + query.limit),
      totalCount: allEntries.length,
      myEntry,
    };
  }

  const targetGrade = query.grade === 'all' ? 3 : query.grade;
  const league = records.filter(r => r.grade === targetGrade && r.difficulty === query.difficulty);
  const byNick = new Map<string, RunRecord>();
  for (const r of league) {
    const key = r.nickname || '익명 대원';
    const prev = byNick.get(key);
    if (!prev) {
      byNick.set(key, r);
      continue;
    }
    if (query.tab === 'single_score') {
      if (r.pt > prev.pt || (r.pt === prev.pt && r.completedWave > prev.completedWave)) byNick.set(key, r);
    } else if (r.completedWave > prev.completedWave || (r.completedWave === prev.completedWave && r.pt > prev.pt)) {
      byNick.set(key, r);
    }
  }
  const sorted = [...byNick.values()].sort((a, b) =>
    query.tab === 'single_score'
      ? b.pt - a.pt || b.completedWave - a.completedWave || a.endedAt.localeCompare(b.endedAt)
      : b.completedWave - a.completedWave || b.pt - a.pt || a.endedAt.localeCompare(b.endedAt),
  );
  const allEntries: RankingEntry[] = sorted.map((r, i) => {
    const totalQ = r.correct + r.wrong + r.skipped;
    const acc = totalQ > 0 ? Math.round((r.correct * 100) / totalQ) : 0;
    return {
      rank: i + 1,
      playerIdHash: r.runId.slice(0, 16),
      isMe: cleanNick ? r.nickname === cleanNick : i === 0,
      nickname: r.nickname,
      grade: normalizeGradeValue(r.grade),
      difficulty: normalizeDifficultyValue(r.difficulty),
      primaryValue: query.tab === 'single_score' ? r.pt : r.completedWave,
      secondaryLabel: query.tab === 'single_score' ? `${r.completedWave}웨이브 · 정답 ${acc}%` : `${r.pt.toLocaleString('ko-KR')}점 · 정답 ${acc}%`,
      achievedAtIso: r.endedAt,
    };
  });
  const myEntry = (cleanNick ? allEntries.find(e => e.nickname === cleanNick) : allEntries[0]) ?? null;
  return {
    source: 'local_fallback',
    entries: allEntries.slice(query.offset, query.offset + query.limit),
    totalCount: allEntries.length,
    myEntry,
  };
}

/** 서버 연결 시 원격 조회를 우선하고, 미설정·오프라인·타임아웃 시 로컬 폴백으로 즉시 전환한다. */
export async function fetchRanking(query: RankingQuery, _playerId: string, currentNickname: string): Promise<RankingResponse> {
  if (query.tab === 'local_device') {
    return buildLocalRanking(query, currentNickname);
  }
  const env = readApiEnv();
  if (env) {
    const params = new URLSearchParams({
      p_tab: query.tab,
      p_grade: String(query.grade === 'all' ? 0 : query.grade),
      p_difficulty: query.difficulty,
      p_period: query.period,
      p_limit: String(query.limit),
      p_offset: String(query.offset),
    });
    const raw = await callApi<unknown>(env, 'GET', `/v1/leaderboard?${params}`).catch(() => null);
    const parsed = rankingSliceResponseSchema.safeParse(raw);
    if (parsed.success) {
      const deviceRunIds = new Set((await listRecords().catch(() => [])).map(r => r.runId));
      const markDeviceOwner = (entry: RankingEntry): RankingEntry => ({ ...entry, isMe: entry.isMe && (entry.runIds?.some(id => deviceRunIds.has(id)) ?? false) });
      const mine = parsed.data.myEntry ? markDeviceOwner(parsed.data.myEntry) : null;
      return {
        source: 'remote',
        entries: parsed.data.entries.map(markDeviceOwner),
        totalCount: parsed.data.totalCount,
        myEntry: mine?.isMe ? mine : null,
      };
    }
  }
  return buildLocalRanking(query, currentNickname);
}

/** 로컬 기록 기준 오늘(KST) 플레이 수와 누적 플레이 수를 집계한다. */
export async function computeLocalPlayCounts(now: Date = new Date()): Promise<{ todayPlays: number; totalPlays: number }> {
  try {
    const records = await listRecords();
    const today = kstDateKey(now);
    let todayPlays = 0;
    for (const r of records) {
      if (kstDateKey(new Date(r.endedAt)) === today) todayPlays++;
    }
    return { todayPlays, totalPlays: records.length };
  } catch {
    return { todayPlays: 0, totalPlays: 0 };
  }
}

/** 로비 방문 기록 및 누적·일일 지표, 최근 5분 홈 방문 기기 수(onlineNow)를 가져온다. */
export async function fetchInitialTelemetry(playerId: string): Promise<TelemetrySnapshot> {
  void playerId;
  const local = await computeLocalPlayCounts();
  const offline = (status: TelemetrySnapshot['status']): TelemetrySnapshot => ({
    status,
    onlineNow: null,
    todayPlays: local.todayPlays,
    totalVisitors: null,
    totalPlays: local.totalPlays,
    updatedAtIso: new Date().toISOString(),
  });
  const env = readApiEnv();
  if (!env) return offline(isRecordSharingEnabled() ? 'offline' : 'disabled');
  const raw = await callApi<unknown>(env, 'POST', '/v1/lobby-visit', {}).catch(() => null);
  const parsed = lobbyVisitWithRecentSchema.safeParse(raw);
  if (!parsed.success) return offline('offline');
  try {
    localStorage.setItem(VISIT_DAY_KEY, kstDateKey());
  } catch { /* 저장소 차단 무시 */ }
  return {
    status: 'live',
    onlineNow: parsed.data.recentVisitors,
    todayPlays: parsed.data.todayPlays,
    totalVisitors: parsed.data.totalVisitors,
    totalPlays: parsed.data.totalPlays,
    updatedAtIso: parsed.data.updatedAtIso,
  };
}

/** 정규 판 시작 시 일일·누적 플레이 카운트를 비동기로 알린다(연습 판 제외). */
export async function reportRunStarted(runId: string, playerId: string): Promise<void> {
  void playerId;
  const env = readApiEnv();
  if (!env) return;
  await callApi(env, 'POST', '/v1/runs/start', { p_run_id: runId }).catch(() => null);
}

/** 정규 판 종료 시 동기화 큐에 적재하고 가능한 즉시 서버에 전송한다. */
export async function queueAndFlushCompletedRun(record: RunRecord, playerId: string): Promise<void> {
  if (!isRecordSharingEnabled() || record.contentMode !== 'published' || record.completedWave < 1) return;
  try {
    await enqueueRunSync(record, playerId);
  } catch {
    return;
  }
  await flushPendingRunSyncs();
}

function reportSubmissionRejection(runId: string, reason?: string): void {
  const detail = reason === 'NICKNAME_REJECTED' ? '별명 규칙을 확인해 주세요.'
    : reason === 'VERSION_REJECTED' ? '이 판의 게임 자료는 공개 등록을 지원하지 않아요.'
    : reason === 'START_REQUIRED' ? '시작할 때 연결되지 않아 공개 등록할 수 없어요.'
    : '공개 기록 확인을 통과하지 못했어요.';
  setPublicRecordNotice({ kind: 'submission_rejected', runId, message: `${detail} 이 기기 기록은 그대로 있어요.` });
}

let flushing = false;
export async function flushPendingRunSyncs(): Promise<void> {
  if (flushing) return;
  const env = readApiEnv();
  if (!env) return;
  flushing = true;
  try {
    // 각 전송 뒤 저장소를 다시 읽어 삭제된 항목과 새로 들어온 항목을 반영한다.
    while (true) {
      if (!isRecordSharingEnabled()) break;
      const item = (await listPendingRunSyncs())[0];
      if (!item) break;
      if (item.retryAt && item.retryAt > Date.now()) break;
      const r = item.record;
      if (r.contentMode !== 'published' || r.completedWave < 1) { await removePendingRunSync(item.runId); continue; }
      const isStillQueued = async () => (await getPendingRunSync(item.runId))?.queuedAt === item.queuedAt;
      try {
        const res = await callApi<{ ok?: boolean; status?: string; error?: string }>(env, 'POST', '/v1/runs/submit', {
          p_run_id: r.runId,
          p_nickname: cleanPublicNickname(r.nickname).value,
          p_grade: r.grade,
          p_difficulty: r.difficulty,
          p_pt: r.pt,
          p_completed_wave: r.completedWave,
          p_correct: r.correct,
          p_wrong: r.wrong,
          p_skipped: r.skipped,
          p_content_mode: r.contentMode,
          p_balance_version: r.balanceVersion,
          p_bank_version: r.bankVersion,
          p_map_id: r.mapId,
          p_ended_at: r.endedAt,
          p_ended_at_wave: r.endedAtWave,
          p_answers: r.answers ?? [],
          p_active_ticks: r.activeTicks ?? 0,
        }, isStillQueued);
        if (!await isStillQueued()) continue;
        if (res?.ok === true) {
          await removePendingRunSync(item.runId);
        } else if (res?.error && res.error !== 'RATE_LIMITED') {
          reportSubmissionRejection(item.runId, res.error);
          await removePendingRunSync(item.runId);
        } else {
          await deferPendingRunSync(item.runId);
          break;
        }
      } catch (error) {
        if (!await isStillQueued()) continue;
        if (error instanceof PermanentRpcError) { reportSubmissionRejection(item.runId, error.reason); await removePendingRunSync(item.runId); }
        else { await deferPendingRunSync(item.runId, error instanceof RetryableRpcError ? error.retryAfterMs : undefined); break; }
      }
    }
  } catch {
    // 네트워크 실패 시 다음 로비 진입 때 재시도한다.
  } finally {
    flushing = false;
  }
}

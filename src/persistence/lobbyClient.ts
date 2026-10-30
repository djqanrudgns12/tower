import { expireAccessToken, getAccessToken, readSupabaseEnv, setPublicRecordNotice, type SupabaseEnv } from './auth';
import { isRecordSharingEnabled, SETTINGS_CHANGED_EVENT } from './settings';
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
const PRESENCE_TIMEOUT_MS = 4000;

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

async function callRpc<T>(env: SupabaseEnv, fnName: string, body: Record<string, unknown>, canSend?: () => Promise<boolean>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const token = await getAccessToken(env);
    if (!token || (canSend && !await canSend()) || !isRecordSharingEnabled()) return null;
    const res = await fetch(`${env.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 401) expireAccessToken(env);
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
  const env = readSupabaseEnv();
  if (env) {
    const raw = await callRpc<unknown>(env, 'get_leaderboard_slice', {
      p_tab: query.tab,
      p_grade: query.grade === 'all' ? 0 : query.grade,
      p_difficulty: query.difficulty,
      p_period: query.period,
      p_limit: query.limit,
      p_offset: query.offset,
    }).catch(() => null);
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

/** 로비 초기 방문 기록 및 누적·일일 지표 스냅샷을 가져온다. */
export async function fetchInitialTelemetry(playerId: string): Promise<Omit<TelemetrySnapshot, 'onlineNow'>> {
  void playerId;
  const local = await computeLocalPlayCounts();
  const env = readSupabaseEnv();
  if (!env) {
    return {
      status: isRecordSharingEnabled() ? 'offline' : 'disabled',
      todayPlays: local.todayPlays,
      totalVisitors: null,
      totalPlays: local.totalPlays,
      updatedAtIso: new Date().toISOString(),
    };
  }
  const raw = await callRpc<unknown>(env, 'record_lobby_visit', {}).catch(() => null);
  const parsed = lobbyVisitResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'offline',
      todayPlays: local.todayPlays,
      totalVisitors: null,
      totalPlays: local.totalPlays,
      updatedAtIso: new Date().toISOString(),
    };
  }
  try {
    localStorage.setItem(VISIT_DAY_KEY, kstDateKey());
  } catch { /* 저장소 차단 무시 */ }
  return {
    status: 'live',
    todayPlays: parsed.data.todayPlays,
    totalVisitors: parsed.data.totalVisitors,
    totalPlays: parsed.data.totalPlays,
    updatedAtIso: parsed.data.updatedAtIso,
  };
}

/** 정규 판 시작 시 일일·누적 플레이 카운트를 비동기로 알린다(연습 판 제외). */
export async function reportRunStarted(runId: string, playerId: string): Promise<void> {
  void playerId;
  const env = readSupabaseEnv();
  if (!env) return;
  await callRpc(env, 'record_run_start', { p_run_id: runId }).catch(() => null);
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
  const env = readSupabaseEnv();
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
        const res = await callRpc<{ ok?: boolean; status?: string; error?: string }>(env, 'submit_completed_run', {
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

/**
 * Supabase Realtime Phoenix WebSocket 경량 Presence 연결기.
 * 외부 패키지 없이 동작하며, 4초 내 연결되지 않거나 방화벽에 막히면 조용히 닫고 null을 알린다.
 */
export function connectPresenceChannel(
  _playerId: string,
  onOnlineCount: (count: number | null) => void,
): () => void {
  const env = readSupabaseEnv();
  if (!env || typeof WebSocket === 'undefined') {
    onOnlineCount(null);
    return () => undefined;
  }

  let closed = false;
  let seq = 1;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const presenceKeys = new Map<string, Set<string>>();
  const presenceKey = crypto.randomUUID();
  const wsBase = env.url.replace(/^http/i, 'ws');
  const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(env.anonKey)}&vsn=1.0.0`;

  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(wsUrl);
  } catch {
    onOnlineCount(null);
    return () => undefined;
  }

  const timeout = setTimeout(() => {
    if (ws && ws.readyState !== WebSocket.OPEN) {
      try { ws.close(); } catch { /* ignore */ }
      if (!closed) onOnlineCount(null);
    }
  }, PRESENCE_TIMEOUT_MS);

  const send = (topic: string, event: string, payload: Record<string, unknown>) => {
    if (!isRecordSharingEnabled() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ topic, event, payload, ref: String(seq++) }));
  };

  ws.addEventListener('open', () => {
    clearTimeout(timeout);
    if (closed) { ws?.close(); return; }
    send('realtime:lobby:presence', 'phx_join', {
      config: { broadcast: { self: false }, presence: { key: presenceKey } },
    });
    send('realtime:lobby:presence', 'presence', {
      type: 'presence',
      event: 'track',
      payload: { state: 'lobby', joinedAt: Date.now() },
    });
    heartbeat = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
  });

  ws.addEventListener('message', ev => {
    if (closed || !isRecordSharingEnabled() || typeof ev.data !== 'string') return;
    try {
      const msg = JSON.parse(ev.data) as { event?: string; payload?: Record<string, unknown> };
      if (msg.event === 'presence_state' && msg.payload && typeof msg.payload === 'object') {
        presenceKeys.clear();
        for (const [key, value] of Object.entries(msg.payload)) {
          const metas = (value as { metas?: { phx_ref?: string }[] }).metas ?? [];
          presenceKeys.set(key, new Set(metas.map(m => m.phx_ref ?? 'unknown')));
        }
        onOnlineCount(Math.max(1, presenceKeys.size));
      } else if (msg.event === 'presence_diff' && msg.payload) {
        const joins = msg.payload.joins as Record<string, unknown> | undefined;
        const leaves = msg.payload.leaves as Record<string, unknown> | undefined;
        if (joins) for (const [key, value] of Object.entries(joins)) {
          const refs = presenceKeys.get(key) ?? new Set<string>();
          for (const meta of (value as { metas?: { phx_ref?: string }[] }).metas ?? []) refs.add(meta.phx_ref ?? 'unknown');
          presenceKeys.set(key, refs);
        }
        if (leaves) for (const [key, value] of Object.entries(leaves)) {
          const refs = presenceKeys.get(key);
          for (const meta of (value as { metas?: { phx_ref?: string }[] }).metas ?? []) refs?.delete(meta.phx_ref ?? 'unknown');
          if (!refs?.size) presenceKeys.delete(key);
        }
        onOnlineCount(Math.max(1, presenceKeys.size));
      }
    } catch {
      // 비정상 프레임 무시
    }
  });

  const handleClose = () => {
    clearTimeout(timeout);
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    if (!closed) onOnlineCount(null);
  };

  ws.addEventListener('error', handleClose);
  ws.addEventListener('close', handleClose);

  const onSettingsChange = () => { if (!isRecordSharingEnabled()) { closed = true; if (heartbeat) clearInterval(heartbeat); clearTimeout(timeout); ws?.close(); onOnlineCount(null); } };
  if (typeof window !== 'undefined') { window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChange); window.addEventListener('storage', onSettingsChange); }
  return () => {
    if (typeof window !== 'undefined') { window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChange); window.removeEventListener('storage', onSettingsChange); }
    closed = true;
    clearTimeout(timeout);
    if (heartbeat) clearInterval(heartbeat);
    try { ws?.close(); } catch { /* ignore */ }
  };
}

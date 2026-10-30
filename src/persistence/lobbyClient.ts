import type { DifficultyId } from '../contracts/balance';
import {
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
  bumpPendingRunSyncAttempt,
  enqueueRunSync,
  listPendingRunSyncs,
  listRecords,
  removePendingRunSync,
  type RunRecord,
} from './db';

const VISIT_DAY_KEY = 'vocabulary-td.visitDay';
const RPC_TIMEOUT_MS = 4500;
const PRESENCE_TIMEOUT_MS = 4000;

interface SupabaseEnv {
  url: string;
  anonKey: string;
}

function readSupabaseEnv(): SupabaseEnv | null {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const url = meta.env?.VITE_SUPABASE_URL?.trim();
  const anonKey = meta.env?.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

async function callRpc<T>(env: SupabaseEnv, fnName: string, body: Record<string, unknown>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
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
    const myTop = sorted.find(r => !cleanNick || r.nickname === cleanNick) ?? sorted[0] ?? null;
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
export async function fetchRanking(query: RankingQuery, playerId: string, currentNickname: string): Promise<RankingResponse> {
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
      p_player_id: playerId,
    });
    const parsed = rankingSliceResponseSchema.safeParse(raw);
    if (parsed.success) {
      return {
        source: 'remote',
        entries: parsed.data.entries,
        totalCount: parsed.data.totalCount,
        myEntry: parsed.data.myEntry,
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
  const local = await computeLocalPlayCounts();
  const env = readSupabaseEnv();
  if (!env) {
    return {
      status: 'offline',
      todayPlays: local.todayPlays,
      totalVisitors: null,
      totalPlays: local.totalPlays,
      updatedAtIso: new Date().toISOString(),
    };
  }
  const raw = await callRpc<unknown>(env, 'record_lobby_visit', { p_player_id: playerId });
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
  const env = readSupabaseEnv();
  if (!env) return;
  await callRpc(env, 'record_run_start', { p_run_id: runId, p_player_id: playerId });
}

/** 정규 판 종료 시 동기화 큐에 적재하고 가능한 즉시 서버에 전송한다. */
export async function queueAndFlushCompletedRun(record: RunRecord, playerId: string): Promise<void> {
  try {
    await enqueueRunSync(record, playerId);
  } catch {
    return;
  }
  await flushPendingRunSyncs();
}

let flushing = false;
export async function flushPendingRunSyncs(): Promise<void> {
  if (flushing) return;
  const env = readSupabaseEnv();
  if (!env) return;
  flushing = true;
  try {
    const pending = await listPendingRunSyncs();
    for (const item of pending) {
      const r = item.record;
      const res = await callRpc<{ ok?: boolean; status?: string; error?: string }>(env, 'submit_completed_run', {
        p_run_id: r.runId,
        p_player_id: item.playerId,
        p_nickname: r.nickname,
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
      });
      if (res && (res.ok === true || res.error === 'PLAUSIBILITY_REJECTED' || res.error === 'NICKNAME_REJECTED')) {
        await removePendingRunSync(item.runId);
      } else {
        await bumpPendingRunSyncAttempt(item.runId);
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
  playerId: string,
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
  const presenceKeys = new Set<string>();
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
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ topic, event, payload, ref: String(seq++) }));
  };

  ws.addEventListener('open', () => {
    clearTimeout(timeout);
    if (closed) { ws?.close(); return; }
    send('realtime:lobby:presence', 'phx_join', {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });
    send('realtime:lobby:presence', 'presence', {
      type: 'presence',
      event: 'track',
      payload: { state: 'lobby', joinedAt: Date.now() },
    });
    heartbeat = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
  });

  ws.addEventListener('message', ev => {
    if (closed || typeof ev.data !== 'string') return;
    try {
      const msg = JSON.parse(ev.data) as { event?: string; payload?: Record<string, unknown> };
      if (msg.event === 'presence_state' && msg.payload && typeof msg.payload === 'object') {
        presenceKeys.clear();
        for (const k of Object.keys(msg.payload)) presenceKeys.add(k);
        onOnlineCount(Math.max(1, presenceKeys.size));
      } else if (msg.event === 'presence_diff' && msg.payload) {
        const joins = msg.payload.joins as Record<string, unknown> | undefined;
        const leaves = msg.payload.leaves as Record<string, unknown> | undefined;
        if (joins) for (const k of Object.keys(joins)) presenceKeys.add(k);
        if (leaves) for (const k of Object.keys(leaves)) presenceKeys.delete(k);
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

  return () => {
    closed = true;
    clearTimeout(timeout);
    if (heartbeat) clearInterval(heartbeat);
    try { ws?.close(); } catch { /* ignore */ }
  };
}

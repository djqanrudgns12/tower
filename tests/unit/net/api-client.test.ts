import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicRecordNotice, setPublicRecordNotice } from '../../../src/persistence/auth';
import { clearLocalHistory, resetDbConnection } from '../../../src/persistence/db';
import { fetchInitialTelemetry, fetchRanking, reportRunStarted } from '../../../src/persistence/lobbyClient';

/** 단계 5: 앱이 새 서버(server/, Workers + D1)의 경로·헤더·응답 모양을 쓰는지. */
const API = 'https://api.example';
const DEVICE = '459d7cbc-0b34-4e94-82a5-26fe45038796';
const TOKEN = `v1.${DEVICE}.${'A'.repeat(43)}`;

function memoryStorage() {
  const store = new Map<string, string>();
  return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; } };
}

describe('새 서버 연결(VITE_API_BASE)', () => {
  beforeEach(async () => {
    setPublicRecordNotice(null);
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true }));
    localStorage.setItem(`vocabulary-td.device:${API}`, JSON.stringify({ deviceId: DEVICE, token: TOKEN }));
    vi.stubEnv('VITE_API_BASE', `${API}/`);
    await resetDbConnection();
    await clearLocalHistory();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('홈 방문은 POST /v1/lobby-visit, 최근 5분 방문 기기 수를 접속 수(onlineNow)로 준다', async () => {
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => {
      void url; void init;
      return new Response(JSON.stringify({ todayPlays: 3, totalVisitors: 40, totalPlays: 90, updatedAtIso: '2026-11-05T00:15:08Z', recentVisitors: 5 }));
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(await fetchInitialTelemetry('local')).toEqual({ status: 'live', onlineNow: 5, todayPlays: 3, totalVisitors: 40, totalPlays: 90, updatedAtIso: '2026-11-05T00:15:08Z' });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`${API}/v1/lobby-visit`);
    expect(init).toMatchObject({ method: 'POST', body: '{}', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } });
    expect(init.headers).not.toHaveProperty('apikey');
  });

  it('서버가 꺼졌거나 5xx·옛 응답 모양이면 이 기기 기록 수치로 돌아가고 접속 수는 비운다', async () => {
    for (const reply of [
      () => Promise.reject(new TypeError('offline')),
      () => Promise.resolve(new Response('{}', { status: 503 })),
      () => Promise.resolve(new Response(JSON.stringify({ todayPlays: 1, totalVisitors: 1, totalPlays: 1, updatedAtIso: 'x' }))),
    ]) {
      vi.stubGlobal('fetch', vi.fn(reply));
      expect(await fetchInitialTelemetry('local')).toMatchObject({ status: 'offline', onlineNow: null, totalVisitors: null });
    }
  });

  it('판 시작은 POST /v1/runs/start { p_run_id }', async () => {
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => { void url; void init; return new Response('{"counted":true}'); });
    vi.stubGlobal('fetch', fetchSpy);
    await reportRunStarted('55555555-5555-4555-8555-555555555555', 'local');
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(`${API}/v1/runs/start`);
    expect(JSON.parse(fetchSpy.mock.calls[0]?.[1].body as string)).toEqual({ p_run_id: '55555555-5555-4555-8555-555555555555' });
  });

  it('랭킹은 GET /v1/leaderboard 쿼리(p_*)로 묻고, 전체 학년은 p_grade=0', async () => {
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => { void url; void init; return new Response(JSON.stringify({ entries: [], totalCount: 0, myEntry: null })); });
    vi.stubGlobal('fetch', fetchSpy);
    const result = await fetchRanking({ tab: 'honor_points', grade: 'all', difficulty: 'Hard', period: 'weekly', limit: 50, offset: 0 }, 'local', '솔방울');
    expect(result.source).toBe('remote');
    const [url, init] = fetchSpy.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(`${API}/v1/leaderboard`);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ p_tab: 'honor_points', p_grade: '0', p_difficulty: 'Hard', p_period: 'weekly', p_limit: '50', p_offset: '0' });
    expect(init).toMatchObject({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(init.body).toBeUndefined();
  });

  it('랭킹 요청이 429·실패면 이 기기 기록 랭킹으로 바로 바꾼다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"RATE_LIMITED"}', { status: 429, headers: { 'Retry-After': '30' } })));
    const result = await fetchRanking({ tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0 }, 'local', '솔방울');
    expect(result.source).toBe('local_fallback');
  });

  it('토큰을 거부(401)당하면 저장한 토큰을 버리고 다음 요청에서 기기를 새로 받는다', async () => {
    const other = '11111111-1111-4111-8111-111111111111';
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => {
      void init;
      if (url.endsWith('/v1/device')) return new Response(JSON.stringify({ deviceId: other, token: `v1.${other}.${'B'.repeat(43)}` }));
      return new Response('{"error":"AUTH_REQUIRED"}', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect((await fetchInitialTelemetry('local')).status).toBe('offline');
    expect(getPublicRecordNotice()?.kind).toBe('auth_expired');
    expect(localStorage.getItem(`vocabulary-td.device:${API}`)).toBeNull();
    await fetchInitialTelemetry('local');
    const calls = fetchSpy.mock.calls.map(([url, init]) => [url, (init.headers as Record<string, string>).Authorization ?? null]);
    expect(calls).toEqual([
      [`${API}/v1/lobby-visit`, `Bearer ${TOKEN}`],
      [`${API}/v1/device`, null],
      [`${API}/v1/lobby-visit`, `Bearer v1.${other}.${'B'.repeat(43)}`],
    ]);
  });
});

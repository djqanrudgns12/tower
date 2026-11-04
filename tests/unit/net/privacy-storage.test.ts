import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addRecord, clearLocalHistory, db, enqueueRunSync, listPendingRunSyncs, listRecords, resetDbConnection, type RunRecord } from '../../../src/persistence/db';
import { buildLocalRanking, connectPresenceChannel, fetchInitialTelemetry, fetchRanking, flushPendingRunSyncs, reportRunStarted } from '../../../src/persistence/lobbyClient';
import { getPublicRecordNotice, setPublicRecordNotice } from '../../../src/persistence/auth';
import { loadSettings } from '../../../src/persistence/settings';

const record = (runId: string): RunRecord => ({ runId, nickname: '솔방울', grade: 3, difficulty: 'Normal', mapId: 'garden_u', pt: 30, completedWave: 1, endedAtWave: 1, correct: 2, wrong: 0, skipped: 0, endedAt: '2026-10-30T01:00:00Z', endReason: 'QUIT', contentMode: 'published', balanceVersion: 'test', bankVersion: 'test' });

describe('공개 동의·저장 회귀', () => {
  beforeEach(async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    await resetDbConnection();
    await clearLocalHistory();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('IndexedDB 열기 실패 뒤에는 차단 원인이 풀리면 실제로 다시 연다', async () => {
    await resetDbConnection();
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vocabulary-td', 4);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    upgraded.close();
    await expect(db()).rejects.toMatchObject({ name: 'VersionError' });
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('vocabulary-td');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    expect((await db()).version).toBe(3);
  });

  it('v3 업그레이드는 옛 진행 중 판 저장소(run)를 지우고 기록·대기 큐는 남긴다(이어하기 없음)', async () => {
    await resetDbConnection();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('vocabulary-td');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    // 버전 2 기기: 스냅샷 슬롯·끝난 판 기록·대기 큐가 있다.
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vocabulary-td', 2);
      request.onupgradeneeded = () => {
        const d = request.result;
        d.createObjectStore('run', { keyPath: 'slot' }).put({ slot: 'A', seq: 1, savedAt: '2026-11-01T00:00:00Z', hash: 'x', json: '{}' });
        d.createObjectStore('records', { keyPath: 'runId' }).createIndex('endedAt', 'endedAt');
        d.createObjectStore('syncQueue', { keyPath: 'runId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = old.transaction(['records', 'syncQueue'], 'readwrite');
      tx.objectStore('records').put(record('kept-run'));
      tx.objectStore('syncQueue').put({ runId: 'kept-run', record: record('kept-run'), playerId: 'local', attempts: 0, queuedAt: '2026-11-01T00:00:00Z' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    old.close();
    const upgraded = await db();
    expect(upgraded.version).toBe(3);
    expect([...upgraded.objectStoreNames].sort()).toEqual(['records', 'syncQueue']);
    expect((await listRecords()).map(r => r.runId)).toEqual(['kept-run']);
    expect((await listPendingRunSyncs()).map(r => r.runId)).toEqual(['kept-run']);
  });

  it('동기화 큐는 runId 대신 queuedAt 오래된 순으로 읽는다', async () => {
    await enqueueRunSync(record('a-new'), 'local');
    await enqueueRunSync(record('z-old'), 'local');
    const database = await db();
    const old = await database.get('syncQueue', 'z-old');
    await database.put('syncQueue', { ...old!, queuedAt: '2000-01-01T00:00:00Z' });
    expect((await listPendingRunSyncs()).map(r => r.runId)).toEqual(['z-old', 'a-new']);
  });

  it('사용자가 저장한 움직임 선택은 customized 표시가 없어도 보존한다', () => {
    localStorage.setItem('vocabulary-td.settings', JSON.stringify({ motionMode: 'simple', reducedMotion: false }));
    expect(loadSettings().motionMode).toBe('simple');
  });

  it('신규 설정은 OS의 줄인 움직임을 따른다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(loadSettings().reducedMotion).toBe(true);
  });

  it('공개 동의가 없으면 로비·시작·제출·랭킹·Presence에서 fetch와 WebSocket을 쓰지 않는다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    const wsSpy = vi.fn(function () { return { addEventListener: vi.fn(), close: vi.fn() }; });
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', wsSpy);
    await enqueueRunSync(record('pending'), 'local');
    await fetchInitialTelemetry('local');
    await reportRunStarted('run', 'local');
    await fetchRanking({ tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0 }, 'local', '솔방울');
    await flushPendingRunSyncs();
    const disconnect = connectPresenceChannel('local', vi.fn());
    disconnect();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(wsSpy).toHaveBeenCalledTimes(0);
  });

  it('현재 별명의 기록이 없어도 다른 별명의 최고 기록을 내 기록으로 대체하지 않는다', async () => {
    await addRecord(record('local-run'));
    const ranking = await buildLocalRanking({ tab: 'local_device', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0 }, '새별명');
    expect(ranking.myEntry).toBeNull();
  });
});

describe('일시 장애 동기화 보존', () => {
  beforeEach(async () => {
    const store = new Map<string,string>();
    vi.stubGlobal('localStorage', { getItem:(k:string)=>store.get(k)??null, setItem:(k:string,v:string)=>store.set(k,v) });
    localStorage.setItem('vocabulary-td.settings', JSON.stringify({shareRecords:true}));
    localStorage.setItem('vocabulary-td.anonymousSession:https://example.supabase.co', JSON.stringify({access_token:'user-token',refresh_token:'refresh-token',expires_at:Date.now()/1000+3600}));
    vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY','public-key');
    await resetDbConnection(); await clearLocalHistory();
  });
  afterEach(()=>{ vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each([408,429,500,503])('HTTP %s 응답을 반복해도 큐와 시도 횟수를 보존하며 사용자 JWT로 보낸다', async status => {
    const fetchSpy=vi.fn(async (url: string, init: RequestInit)=>{ void url; void init; return new Response('{}',{status}); }); vi.stubGlobal('fetch',fetchSpy);
    await enqueueRunSync(record('pending'), 'local-device-id');
    for(let i=0;i<7;i++) {
      const database=await db(); const item=await database.get('syncQueue','pending');
      await database.put('syncQueue',{...item!,retryAt:0});
      await flushPendingRunSyncs();
    }
    const pending=await listPendingRunSyncs();
    expect(pending).toHaveLength(1); expect(pending[0]?.attempts).toBe(0); expect(pending[0]?.retryAt).toBeGreaterThan(Date.now());
    const init=fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({Authorization:'Bearer user-token'});
    expect(JSON.parse(init?.body as string)).not.toHaveProperty('p_player_id');
  });
  it('공개 내 기록은 별명 대신 이 기기의 runId와 인증 소유권을 함께 확인한다', async () => {
    await addRecord(record('owned-run'));
    const entry={rank:1,playerIdHash:'opaque',isMe:true,nickname:'솔방울',grade:3,difficulty:'Normal',primaryValue:67,secondaryLabel:'1웨이브',achievedAtIso:'2026-10-30T01:00:00Z',runIds:['other-device-run']};
    const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({entries:[entry],totalCount:1,myEntry:entry})));
    vi.stubGlobal('fetch',fetchSpy);
    const query={tab:'single_score',grade:3,difficulty:'Normal',period:'all_time',limit:8,offset:0} as const;
    const other=await fetchRanking(query,'local','솔방울');
    expect(other.myEntry).toBeNull(); expect(other.entries[0]?.isMe).toBe(false);
    entry.runIds=['owned-run']; entry.nickname='예전별명';
    const own=await fetchRanking(query,'local','새별명');
    expect(own.myEntry?.nickname).toBe('예전별명'); expect(own.entries[0]?.isMe).toBe(true);
  });
  it('429 Retry-After가 기본 백오프보다 길면 서버가 지정한 시간을 기다린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '7200' } })));
    await enqueueRunSync(record('wait-for-limit'), 'local');
    const before = Date.now(); await flushPendingRunSyncs();
    const pending = await listPendingRunSyncs();
    expect(pending[0]?.retryAt).toBeGreaterThanOrEqual(before + 7_200_000);
    expect(pending[0]?.attempts).toBe(0);
  });
  it('서버가 영구 거부해도 기기 기록을 유지하고 등록 실패 사유를 알린다', async () => {
    setPublicRecordNotice(null);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'START_REQUIRED' }))));
    await addRecord(record('rejected')); await enqueueRunSync(record('rejected'), 'local');
    await flushPendingRunSyncs();
    expect(await listPendingRunSyncs()).toHaveLength(0);
    expect(getPublicRecordNotice()).toMatchObject({ kind: 'submission_rejected', runId: 'rejected' });
    expect(getPublicRecordNotice()?.message).toContain('시작할 때 연결되지 않아');
    expect((await listRecords()).map(r => r.runId)).toEqual(['rejected']);
  });
  it('HTTP 422 검증 거부의 사유도 기기 기록 보존 안내에 연결한다', async () => {
    setPublicRecordNotice(null);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'START_REQUIRED' }), { status: 422 })));
    await addRecord(record('http-rejected')); await enqueueRunSync(record('http-rejected'), 'local');
    await flushPendingRunSyncs();
    expect(await listPendingRunSyncs()).toHaveLength(0);
    expect(getPublicRecordNotice()?.message).toContain('시작할 때 연결되지 않아');
    expect((await listRecords()).map(r => r.runId)).toEqual(['http-rejected']);
  });
  it('전송 중 로컬 기록을 정리하면 아직 보내지 않은 큐 항목을 제출하지 않는다', async () => {
    let reply!: (response: Response) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    const firstReply = new Promise<Response>(resolve => { reply = resolve; });
    let requests = 0;
    const fetchSpy = vi.fn(() => {
      requests++;
      started();
      return requests === 1 ? firstReply : Promise.resolve(new Response('{"ok":true}'));
    });
    vi.stubGlobal('fetch', fetchSpy);
    await enqueueRunSync(record('first'), 'local');
    await enqueueRunSync(record('second'), 'local');
    const flushing = flushPendingRunSyncs();
    await requestStarted;
    await clearLocalHistory();
    reply(new Response('{"ok":true}'));
    await flushing;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await listPendingRunSyncs()).toEqual([]);
  });

  it('인증 갱신 대기 중 로컬 기록을 정리하면 갱신 뒤 삭제한 기록을 보내지 않는다', async () => {
    localStorage.setItem('vocabulary-td.anonymousSession:https://example.supabase.co', JSON.stringify({ access_token: 'expired', refresh_token: 'refresh-token', expires_at: 0 }));
    let reply!: (response: Response) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    const authReply = new Promise<Response>(resolve => { reply = resolve; });
    const fetchSpy = vi.fn((url: string) => {
      if (url.includes('/auth/v1/')) { started(); return authReply; }
      return Promise.resolve(new Response('{"ok":true}'));
    });
    vi.stubGlobal('fetch', fetchSpy);
    await enqueueRunSync(record('removed-during-auth'), 'local');
    const flushing = flushPendingRunSyncs();
    await requestStarted;
    await clearLocalHistory();
    reply(new Response(JSON.stringify({ access_token: 'renewed', refresh_token: 'renewed-refresh', expires_in: 3600 })));
    await flushing;
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['https://example.supabase.co/auth/v1/token?grant_type=refresh_token']);
    expect(await listPendingRunSyncs()).toEqual([]);
  });

  it('동기화 도중 추가한 기록도 현재 전송이 끝나면 오래된 순서대로 비운다', async () => {
    let reply!: (response: Response) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    const firstReply = new Promise<Response>(resolve => { reply = resolve; });
    let requests = 0;
    const fetchSpy = vi.fn((url: string, init: RequestInit) => {
      void url; void init;
      requests++;
      started();
      return requests === 1 ? firstReply : Promise.resolve(new Response('{"ok":true}'));
    });
    vi.stubGlobal('fetch', fetchSpy);
    await enqueueRunSync(record('first'), 'local');
    const flushing = flushPendingRunSyncs();
    await requestStarted;
    await enqueueRunSync(record('second'), 'local');
    await flushPendingRunSyncs();
    reply(new Response('{"ok":true}'));
    await flushing;
    expect(fetchSpy.mock.calls.map(([, init]) => JSON.parse(init.body as string).p_run_id)).toEqual(['first', 'second']);
    expect(await listPendingRunSyncs()).toEqual([]);
  });

  it('영구 HTTP 거부만 큐에서 제거한다', async () => {
    vi.stubGlobal('fetch',vi.fn(async ()=>new Response('{}',{status:422})));
    await enqueueRunSync(record('permanent'),'local'); await flushPendingRunSyncs();
    expect(await listPendingRunSyncs()).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetrySnapshot } from '../../../src/contracts/lobby';

vi.mock('../../../src/persistence/lobbyClient', () => ({
  connectPresenceChannel: vi.fn(() => () => undefined),
  fetchInitialTelemetry: vi.fn(),
  fetchRanking: vi.fn(),
  flushPendingRunSyncs: vi.fn(async () => undefined),
}));

import { createLobbyTelemetryStore } from '../../../src/application/lobby';
import { fetchInitialTelemetry } from '../../../src/persistence/lobbyClient';

type Counts = Omit<TelemetrySnapshot, 'onlineNow'>;
const live: Counts = { status: 'live', todayPlays: 100, totalVisitors: 200, totalPlays: 300, updatedAtIso: '2026-10-30T13:00:00Z' };
const local: Counts = { status: 'offline', todayPlays: 2, totalVisitors: null, totalPlays: 3, updatedAtIso: '2026-10-30T13:01:00Z' };

function deferredCounts() {
  let resolve!: (counts: Counts) => void;
  const promise = new Promise<Counts>(done => { resolve = done; });
  return { promise, resolve };
}

describe('로비 통계 응답 순서', () => {
  let sharing = true;
  beforeEach(() => {
    sharing = true;
    vi.clearAllMocks();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ shareRecords: sharing }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('이전 성공 응답이 늦게 와도 최신 RPC 실패를 live로 바꾸지 않는다', async () => {
    const earlier = deferredCounts();
    vi.mocked(fetchInitialTelemetry).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce(local);
    const store = createLobbyTelemetryStore();
    const pending = store.refreshCounts('local');
    await store.refreshCounts('local');
    earlier.resolve(live);
    await pending;
    expect(store.getSnapshot()).toMatchObject(local);
  });

  it('공유 해제 뒤 로컬 통계를 표시했다면 이전 연결의 원격 수치를 무시한다', async () => {
    const earlier = deferredCounts();
    vi.mocked(fetchInitialTelemetry).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce({ ...local, status: 'disabled' });
    const store = createLobbyTelemetryStore();
    const stop = store.start('local');
    stop();
    sharing = false;
    await store.refreshCounts('local');
    earlier.resolve(live);
    await earlier.promise;
    expect(store.getSnapshot()).toMatchObject({ ...local, status: 'disabled' });
  });

  it('로비 연결을 종료한 뒤 도착한 통계로 구독자에게 알리지 않는다', async () => {
    const earlier = deferredCounts();
    vi.mocked(fetchInitialTelemetry).mockReturnValueOnce(earlier.promise);
    const store = createLobbyTelemetryStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const stop = store.start('local');
    stop();
    listener.mockClear();
    earlier.resolve(live);
    await earlier.promise;
    expect(listener).toHaveBeenCalledTimes(0);
  });
});

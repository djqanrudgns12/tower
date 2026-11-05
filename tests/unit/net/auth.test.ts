import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, getPublicRecordNotice, rejectAccessToken, setPublicRecordNotice } from '../../../src/persistence/auth';

const DEVICE = '459d7cbc-0b34-4e94-82a5-26fe45038796';
const OTHER = '11111111-1111-4111-8111-111111111111';
const token = (id: string, sig = 'A') => `v1.${id}.${sig.repeat(43)}`;
const issued = (id = DEVICE, sig = 'A') => new Response(JSON.stringify({ deviceId: id, token: token(id, sig) }));

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

describe('기기 토큰(POST /v1/device)', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    setPublicRecordNotice(null);
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('처음 한 번만 발급받고 저장한 토큰을 다시 쓴다(동시에 불러도 한 번)', async () => {
    const env = { base: 'https://api.example' };
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => { expect(init.method).toBe('POST'); void url; return issued(); });
    vi.stubGlobal('fetch', fetchSpy);
    expect(await Promise.all([getAccessToken(env), getAccessToken(env)])).toEqual([token(DEVICE), token(DEVICE)]);
    expect(await getAccessToken(env)).toBe(token(DEVICE));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.example/v1/device');
    expect(JSON.parse(storage.store.get('vocabulary-td.device:https://api.example')!)).toEqual({ deviceId: DEVICE, token: token(DEVICE) });
  });

  it('옛 Supabase 익명 세션 저장값은 쓰지 않고 지운다', async () => {
    const env = { base: 'https://legacy.example' };
    localStorage.setItem('vocabulary-td.anonymousSession:https://x.supabase.co', JSON.stringify({ access_token: 'jwt', refresh_token: 'r', expires_at: 9e9 }));
    const fetchSpy = vi.fn(async () => issued());
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getAccessToken(env)).toBe(token(DEVICE));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect([...storage.store.keys()].some(k => k.startsWith('vocabulary-td.anonymousSession:'))).toBe(false);
  });

  it('토큰 저장이 차단되어도 같은 화면의 다음 요청은 같은 기기를 쓴다', async () => {
    const env = { base: 'https://quota.example' };
    vi.stubGlobal('localStorage', { ...storage, getItem: storage.getItem, setItem: (k: string, v: string) => { if (k.startsWith('vocabulary-td.device')) throw new DOMException('quota', 'QuotaExceededError'); storage.setItem(k, v); } });
    const fetchSpy = vi.fn(async () => issued());
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getAccessToken(env)).toBe(token(DEVICE));
    expect(await getAccessToken(env)).toBe(token(DEVICE));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('발급 실패(429·5xx·모양이 틀린 응답)는 저장하지 않고 다음에 다시 받는다', async () => {
    const env = { base: 'https://flaky.example' };
    const replies = [new Response('{}', { status: 429 }), new Response('{}', { status: 503 }), new Response('{"deviceId":"x","token":"y"}'), issued()];
    const fetchSpy = vi.fn(async () => replies.shift()!);
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getAccessToken(env)).toBeNull();
    expect(await getAccessToken(env)).toBeNull();
    expect(await getAccessToken(env)).toBeNull();
    expect(await getAccessToken(env)).toBe(token(DEVICE));
    expect(getPublicRecordNotice()).toBeNull();
  });

  it('서버가 토큰을 거부(401)하면 버리고 한 번만 새로 받는다. 새 토큰도 거부되면 이 화면에서는 더 받지 않는다', async () => {
    const env = { base: 'https://rotated.example' };
    const fetchSpy = vi.fn(async () => issued(OTHER, 'B'));
    vi.stubGlobal('fetch', fetchSpy);
    localStorage.setItem('vocabulary-td.device:https://rotated.example', JSON.stringify({ deviceId: DEVICE, token: token(DEVICE) }));
    expect(await getAccessToken(env)).toBe(token(DEVICE));
    rejectAccessToken(env);
    expect(getPublicRecordNotice()?.kind).toBe('auth_expired');
    expect(getPublicRecordNotice()?.message).toContain('이 기기 기록');
    expect(await getAccessToken(env)).toBe(token(OTHER, 'B'));
    expect(getPublicRecordNotice()).toBeNull();
    rejectAccessToken(env);
    expect(await getAccessToken(env)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('공개 기록을 끄면 발급 요청을 보내지 않는다', async () => {
    localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: false }));
    const fetchSpy = vi.fn(async () => issued());
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getAccessToken({ base: 'https://off.example' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

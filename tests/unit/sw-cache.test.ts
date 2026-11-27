import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

const worker = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://game.example';

test.each([
  ['navigate', '/?grade=4', 'text/html'],
  ['cors', '/assets/board.webp', 'image/webp'],
])('캐시 저장 실패 뒤에도 %s 요청에 받은 응답을 돌려준다', async (mode, pathname, contentType) => {
  const request = { method: 'GET', mode, url: `${origin}${pathname}` };
  const fresh = {
    ok: true,
    type: 'basic',
    headers: new Headers({ 'content-type': contentType }),
    clone: vi.fn(() => ({ body: 'fresh' })),
  };
  const stale = { body: 'stale' };
  const match = vi.fn().mockResolvedValue(mode === 'navigate' ? stale : undefined);
  const put = vi.fn().mockRejectedValue(new Error('QuotaExceededError'));
  const fetch = vi.fn().mockResolvedValue(fresh);
  const listeners = new Map<string, (event: unknown) => void>();
  runInNewContext(worker, {
    self: {
      location: { origin },
      registration: { scope: `${origin}/` },
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    },
    caches: { match, open: async () => ({ match, put }) },
    fetch,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
  });

  const respondWith = vi.fn<(result: Promise<unknown>) => void>();
  listeners.get('fetch')!({ request, respondWith });
  expect(respondWith).toHaveBeenCalledOnce();
  await expect(respondWith.mock.calls[0]![0]).resolves.toBe(fresh);
  expect(fetch).toHaveBeenCalledOnce();
  expect(put).toHaveBeenCalledExactlyOnceWith(mode === 'navigate' ? `${origin}/` : request, { body: 'fresh' });
});

test('WP-C2-07: 오프라인 폴백 시 캐시 응답을 돌려주고 clients 알림을 안전하게 보낸다', async () => {
  const postMessage = vi.fn();
  const cached = { body: 'offline-shell' };
  const listeners = new Map<string, (event: unknown) => void>();
  runInNewContext(worker, {
    self: {
      location: { origin },
      registration: { scope: `${origin}/` },
      clients: { matchAll: vi.fn().mockResolvedValue([{ postMessage }]) },
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    },
    caches: { match: vi.fn().mockResolvedValue(cached), open: async () => ({ match: vi.fn(), put: vi.fn() }) },
    fetch: vi.fn().mockRejectedValue(new Error('offline')),
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
  });

  const respondWith = vi.fn<(result: Promise<unknown>) => void>();
  listeners.get('fetch')!({ request: { method: 'GET', mode: 'navigate', url: `${origin}/` }, respondWith });
  await expect(respondWith.mock.calls[0]![0]).resolves.toBe(cached);
  expect(postMessage).toHaveBeenCalledWith({ type: 'vocabulary-td.offlineFallback' });
});

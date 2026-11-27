/* global self, caches, fetch, URL, AbortController, setTimeout, clearTimeout */
/* 어휘력 타워 디펜스 런타임 캐시 서비스워커 (HOSTING_IMPL_PLAN §3 단계 8 + 학교 와이파이 내성).
 * - 동일 출처 정적 자산(/assets/**)은 Cache-First로 돌려 GitHub Pages 10분 캐시 만료 뒤 재검증 폭주를 막는다.
 * - 캡티브 포털(text/html 위장 응답)은 정적 자산 캐시에 절대 저장하지 않는다.
 * - 문서 진입(navigate)은 Network-First(4초 제한) 뒤 캐시된 index.html로 폴백해 교실 공유기 순간 끊김에도 열리게 한다.
 * - 기록·랭킹 API(/v1/*, 외부 도메인)는 가로채지 않는다.
 */
const CACHE_PREFIX = 'voca-td-';
const BUILD_VERSION = '__VOCA_SW_BUILD__';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isSafeStaticResponse(response) {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  // 학교 와이파이 인증 포털이 정적 자산 경로에 text/html을 돌려주는 경우 캐시 오염을 차단한다.
  if (contentType.includes('text/html')) return false;
  return true;
}

function isSafeDocumentResponse(response) {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('text/html');
}

async function notifyOfflineFallback() {
  try {
    if (!self.clients || typeof self.clients.matchAll !== 'function') return;
    const list = await self.clients.matchAll({ type: 'window' });
    for (const client of list) {
      client.postMessage?.({ type: 'vocabulary-td.offlineFallback' });
    }
  } catch {
    // 클라이언트 알림 실패는 무시하고 캐시 응답만 돌려준다.
  }
}

async function cacheResponse(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // 저장 공간이 부족하거나 캐시에 접근할 수 없어도 네트워크 응답을 돌려준다.
  }
}

async function fetchWithTimeout(request, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/__')) return;

  if (request.mode === 'navigate') {
    const shellUrl = new URL('./', self.registration.scope).href;
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
          if (isSafeDocumentResponse(fresh)) {
            await cacheResponse(shellUrl, fresh);
          }
          return fresh;
        } catch {
          const cached = await caches.match(shellUrl, { cacheName: CACHE_NAME }).catch(() => undefined);
          if (cached) {
            void notifyOfflineFallback();
            return cached;
          }
          return fetch(request);
        }
      })(),
    );
    return;
  }

  const scopePath = new URL('./', self.registration.scope).pathname;
  const assetsPrefix = `${scopePath.endsWith('/') ? scopePath : `${scopePath}/`}assets/`;
  if (!url.pathname.startsWith(assetsPrefix)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { cacheName: CACHE_NAME }).catch(() => undefined);
      if (cached) return cached;
      const fresh = await fetch(request);
      if (isSafeStaticResponse(fresh)) {
        await cacheResponse(request, fresh);
      }
      return fresh;
    })(),
  );
});

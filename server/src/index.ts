/**
 * 어휘력 타워 디펜스 기록·랭킹 서버(Cloudflare Workers + D1).
 * 엔드포인트: POST /v1/device, POST /v1/lobby-visit, POST /v1/runs/start, POST /v1/runs/submit, GET /v1/leaderboard
 */
import { handleRequest, runScheduledCleanup, type Env } from './app';
import type { CacheLike } from './ranking-cache';

export type { Env };

/** Workers의 caches.default. 표준 CacheStorage 타입에는 default가 없어 모양만 적는다. */
const edgeCache = (): CacheLike | null => (globalThis as { caches?: { default?: CacheLike } }).caches?.default ?? null;

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, { now: () => Date.now(), cache: edgeCache() });
  },
  async scheduled(controller: { scheduledTime: number }, env: Env): Promise<void> {
    await runScheduledCleanup(env, controller.scheduledTime);
  },
};

import { deriveKeys, isUsableSalt, playerHash, verifyDeviceToken } from './crypto';
import { d1Database, type D1DatabaseLike, type SqlStats } from './db';
import { getLeaderboard, issueDevice, recordLobbyVisit, recordRunStart, submitCompletedRun, type Context } from './handlers';
import { bearerToken, errorResponse, HttpError, parseAllowedOrigins, preflight, withCors } from './http';
import { cleanupStatements } from './store';

export interface Env {
  DB: D1DatabaseLike;
  /** 사용자가 `wrangler secret put PLAYER_SALT`로 넣는 유일한 비밀값. */
  PLAYER_SALT?: string;
  /** 쉼표로 나눈 허용 출처 목록(예: https://voca.example.com). */
  ALLOWED_ORIGINS?: string;
}

export interface Deps {
  now(): number;
  /** 시험에서 D1 읽기·쓰기 행 수를 잴 때만 쓴다. */
  stats?: SqlStats;
}

type Handler = (ctx: Context, hash: string) => Promise<Response>;
interface Route { method: 'GET' | 'POST'; auth: boolean; handler: Handler }

const ROUTES: Record<string, Route> = {
  '/v1/device': { method: 'POST', auth: false, handler: ctx => issueDevice(ctx) },
  '/v1/lobby-visit': { method: 'POST', auth: true, handler: recordLobbyVisit },
  '/v1/runs/start': { method: 'POST', auth: true, handler: recordRunStart },
  '/v1/runs/submit': { method: 'POST', auth: true, handler: submitCompletedRun },
  '/v1/leaderboard': { method: 'GET', auth: true, handler: getLeaderboard },
};

async function route(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const target = Object.hasOwn(ROUTES, url.pathname) ? ROUTES[url.pathname] : undefined;
  if (!target) throw new HttpError(404, 'NOT_FOUND');
  if (request.method !== target.method) throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  // Postgres private_player_hash가 PT503으로 막던 경우. 토큰 서명 키도 이 값에서 나오므로 가장 먼저 본다.
  if (!isUsableSalt(env.PLAYER_SALT)) throw new HttpError(503, 'PLAYER_SALT_REQUIRED');
  const keys = await deriveKeys(env.PLAYER_SALT);
  const ctx: Context = { request, url, db: d1Database(env.DB, deps.stats), keys, now: deps.now() };
  let hash = '';
  if (target.auth) {
    const token = bearerToken(request);
    const deviceId = token ? await verifyDeviceToken(keys, token) : null;
    if (!deviceId) throw new HttpError(401, 'AUTH_REQUIRED');
    hash = await playerHash(keys, deviceId);
  }
  return target.handler(ctx, hash);
}

export async function handleRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== null && !parseAllowedOrigins(env.ALLOWED_ORIGINS).has(origin)) {
    return errorResponse(new HttpError(403, 'ORIGIN_REJECTED'));
  }
  if (request.method === 'OPTIONS') {
    return origin ? preflight(origin) : new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
  }
  let response: Response;
  try {
    response = await route(request, env, deps);
  } catch (error) {
    if (error instanceof HttpError) {
      response = errorResponse(error);
    } else {
      console.error('요청 처리 실패', error instanceof Error ? error.message : error);
      response = errorResponse(new HttpError(500, 'INTERNAL'));
    }
  }
  return withCors(response, origin);
}

/** 하루 한 번(wrangler.toml [triggers]) 지난 방문 해시·시작 기록·속도 제한·접속 기록을 지운다. */
export async function runScheduledCleanup(env: Env, nowMs: number, stats?: SqlStats): Promise<void> {
  await d1Database(env.DB, stats).batch(cleanupStatements(nowMs));
}

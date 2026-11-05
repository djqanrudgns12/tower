/** 응답 모양·CORS·요청 본문 크기 제한. 실패 응답은 Postgres lobby_rpc_failure처럼 `{ "error": "코드" }`다. */

export const BODY_LIMIT_SMALL = 4 * 1024;
/** 답안 JSON 상한(256 KiB)에 나머지 필드 여유를 더한 값. */
export const BODY_LIMIT_SUBMIT = 320 * 1024;
export const PREFLIGHT_MAX_AGE_SECONDS = 86400;

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfterSeconds?: number) {
    super(code);
  }
}

export function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean));
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(BASE_HEADERS);
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(error: HttpError): Response {
  const extra: Record<string, string> = {};
  if (error.retryAfterSeconds !== undefined) extra['Retry-After'] = String(error.retryAfterSeconds);
  if (error.status === 405) extra.Allow = 'GET, POST, OPTIONS';
  return json({ error: error.code }, error.status, extra);
}

/** 허용 출처면 CORS 헤더를 붙인다. Origin이 없는 요청(curl·서버)은 그대로 둔다. */
export function withCors(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Expose-Headers', 'Retry-After');
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

export function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_SECONDS),
      Vary: 'Origin',
    },
  });
}

/** 본문을 limit 바이트까지만 읽어 JSON 객체로 바꾼다. 빈 본문은 {}로 본다(지금 RPC 호출은 본문 {}를 보낸다). */
export async function readJsonObject(request: Request, limit: number): Promise<Record<string, unknown>> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && Number(declared) > limit) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  }
  if (size === 0) return {};
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'INVALID_JSON');
  return parsed as Record<string, unknown>;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header.trim()) : null;
  return match ? match[1]! : null;
}

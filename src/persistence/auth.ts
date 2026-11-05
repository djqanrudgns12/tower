import { isRecordSharingEnabled } from './settings';

/** 기록·랭킹 서버(server/, Cloudflare Workers) 주소. VITE_API_BASE 하나로 정한다. */
export interface ApiEnv { base: string }
interface DeviceSession { deviceId: string; token: string }

const DEVICE_KEY = 'vocabulary-td.device';
/** Supabase 시절 익명 세션 저장값. 새 서버는 읽지 않으므로 지운다. */
const LEGACY_SESSION_PREFIX = 'vocabulary-td.anonymousSession:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/;

let pending: Promise<string | null> | null = null;
// 저장 공간 부족 등으로 토큰을 저장하지 못해도 현재 화면의 소유자는 유지한다.
const volatileSessions = new Map<string, DeviceSession>();
// 서버가 토큰을 거부(401)해 새로 받은 뒤에도 또 거부하면, 같은 화면에서는 더 받지 않는다(신원이 계속 바뀌지 않게).
const rejectedAfterReissue = new Set<string>();
const reissued = new Set<string>();

const storageKey = (env: ApiEnv) => `${DEVICE_KEY}:${env.base}`;

function isDeviceSession(value: unknown): value is DeviceSession {
  const v = value as Partial<DeviceSession> | null;
  return typeof v?.deviceId === 'string' && UUID.test(v.deviceId) && typeof v.token === 'string' && TOKEN.test(v.token);
}

function readSession(env: ApiEnv): DeviceSession | null {
  const volatile = volatileSessions.get(env.base);
  if (volatile) return volatile;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(env)) ?? 'null');
    return isDeviceSession(saved) ? saved : null;
  } catch { return null; }
}

function saveSession(env: ApiEnv, session: DeviceSession): void {
  try {
    localStorage.setItem(storageKey(env), JSON.stringify(session));
    volatileSessions.delete(env.base);
  } catch { volatileSessions.set(env.base, session); }
}

function forgetSession(env: ApiEnv): void {
  volatileSessions.delete(env.base);
  try { localStorage.removeItem(storageKey(env)); } catch { /* 저장소 차단 무시 */ }
}

/** 옛 Supabase 익명 세션(access_token·refresh_token)을 지운다. 새 서버에서는 쓸모가 없다. 기기를 새로 받을 때만 부른다. */
function clearLegacySessions(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_SESSION_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch { /* 저장소 차단·시험용 가짜 저장소 */ }
}

export interface PublicRecordNotice {
  kind: 'auth_expired' | 'submission_rejected';
  message: string;
  runId?: string;
}
let publicRecordNotice: PublicRecordNotice | null = null;
const noticeListeners = new Set<() => void>();
export const getPublicRecordNotice = (): PublicRecordNotice | null => publicRecordNotice;
export function subscribePublicRecordNotice(listener: () => void): () => void {
  noticeListeners.add(listener);
  return () => { noticeListeners.delete(listener); };
}
export function setPublicRecordNotice(notice: PublicRecordNotice | null): void {
  publicRecordNotice = notice;
  for (const listener of noticeListeners) listener();
}

/**
 * 서버가 토큰을 거부(401)했을 때 부른다. 토큰은 만료가 없으므로 401은 서버 비밀값이 바뀌었거나 토큰이 망가진 경우뿐이고,
 * 옛 신원은 되살릴 수 없다. 저장한 토큰을 버리고 다음 요청에서 기기를 한 번 새로 받는다.
 */
export function rejectAccessToken(env: ApiEnv): void {
  forgetSession(env);
  if (reissued.has(env.base)) rejectedAfterReissue.add(env.base);
  reissued.add(env.base);
  setPublicRecordNotice({ kind: 'auth_expired', message: '공개 기록 연결이 만료됐어요. 이 기기 기록은 그대로 있어요.' });
}

export function readApiEnv(): ApiEnv | null {
  if (!isRecordSharingEnabled()) return null;
  const base = import.meta.env.VITE_API_BASE?.trim();
  return base ? { base: base.replace(/\/+$/, '') } : null;
}

/** 기기 토큰. 처음 한 번만 POST /v1/device로 받고 저장해 다시 쓴다. 기기 ID는 랭킹 신원이 아니라 서버가 해시로만 쓴다. */
export async function getAccessToken(env: ApiEnv): Promise<string | null> {
  if (!isRecordSharingEnabled()) return null;
  if (pending) return pending;
  pending = (async () => {
    const saved = readSession(env);
    if (saved) return saved.token;
    if (rejectedAfterReissue.has(env.base)) return null;
    clearLegacySessions();
    try {
      if (!isRecordSharingEnabled()) return null;
      const response = await fetch(`${env.base}/v1/device`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(4500),
      });
      // 429·5xx·연결 실패는 다음 기회에 다시 받는다. 그동안 게임은 이 기기 기록으로 돈다.
      if (!response.ok) return null;
      const raw: unknown = await response.json();
      if (!isDeviceSession(raw)) return null;
      const session = { deviceId: raw.deviceId, token: raw.token };
      if (publicRecordNotice?.kind === 'auth_expired') setPublicRecordNotice(null);
      saveSession(env, session);
      return isRecordSharingEnabled() ? session.token : null;
    } catch { return null; }
  })();
  try { return await pending; } finally { pending = null; }
}

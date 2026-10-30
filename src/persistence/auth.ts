import { isRecordSharingEnabled } from './settings';

export interface SupabaseEnv { url: string; anonKey: string }
interface AnonymousSession { access_token: string; refresh_token: string; expires_at: number }
const SESSION_KEY = 'vocabulary-td.anonymousSession';
let pending: Promise<string | null> | null = null;
// 저장 공간 부족 등으로 토큰을 저장하지 못해도 현재 화면의 소유자는 유지한다.
const volatileSessions = new Map<string, AnonymousSession>();

function readSession(env: SupabaseEnv): AnonymousSession | null {
  const volatile = volatileSessions.get(env.url);
  if (volatile) return volatile;
  try { return JSON.parse(localStorage.getItem(`${SESSION_KEY}:${env.url}`) ?? 'null') as AnonymousSession | null; } catch { return null; }
}

function saveSession(env: SupabaseEnv, session: AnonymousSession): void {
  try {
    localStorage.setItem(`${SESSION_KEY}:${env.url}`, JSON.stringify(session));
    volatileSessions.delete(env.url);
  } catch { volatileSessions.set(env.url, session); }
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

/** 401 이후 다음 동기화에서 같은 소유자의 refresh_token으로 갱신한다. */
export function expireAccessToken(env: SupabaseEnv): void {
  const saved = readSession(env);
  if (saved) saveSession(env, { ...saved, expires_at: 0 });
}

export function readSupabaseEnv(): SupabaseEnv | null {
  if (!isRecordSharingEnabled()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
}

/** 익명 인증도 authenticated 역할의 사용자 토큰을 쓴다. 기기 ID는 인증 정보가 아니다. */
export async function getAccessToken(env: SupabaseEnv): Promise<string | null> {
  if (!isRecordSharingEnabled()) return null;
  if (pending) return pending;
  pending = (async () => {
    const saved = readSession(env);
    if (saved?.access_token && saved.expires_at > Date.now() / 1000 + 60) return saved.access_token;
    const refresh = saved?.refresh_token;
    try {
      if (!isRecordSharingEnabled()) return null;
      const response = await fetch(`${env.url}/auth/v1/${refresh ? 'token?grant_type=refresh_token' : 'signup'}`, {
        method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(refresh ? { refresh_token: refresh } : {}), signal: AbortSignal.timeout(4500),
      });
      if (!response.ok) {
        if (refresh && [400, 401, 403].includes(response.status)) {
          setPublicRecordNotice({ kind: 'auth_expired', message: '공개 기록 연결이 만료됐어요. 이 기기 기록은 그대로 있어요.' });
        }
        // 일시 장애에서는 토큰을 보존한다. 만료된 갱신 토큰을 새 소유자로 자동 대체하지 않는다.
        return null;
      }
      const raw = await response.json() as Partial<AnonymousSession> & { expires_in?: number };
      if (!raw.access_token || !raw.refresh_token) return null;
      const session: AnonymousSession = { access_token: raw.access_token, refresh_token: raw.refresh_token, expires_at: raw.expires_at ?? Date.now() / 1000 + (raw.expires_in ?? 3600) };
      if (publicRecordNotice?.kind === 'auth_expired') setPublicRecordNotice(null);
      saveSession(env, session);
      return isRecordSharingEnabled() ? session.access_token : null;
    } catch { return null; }
  })();
  try { return await pending; } finally { pending = null; }
}

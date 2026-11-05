/**
 * 비밀값은 PLAYER_SALT 하나다. 용도별 키는 이 값에서 고정 라벨 HMAC으로 따로 파생한다.
 * 같은 키를 두 용도에 쓰지 않으므로 토큰 서명으로 플레이어 해시를 짐작할 수 없다.
 */
const encoder = new TextEncoder();

export const KEY_LABELS = {
  token: 'vocabulary-td/device-token/v1',
  player: 'vocabulary-td/player-hash/v1',
  ip: 'vocabulary-td/ip-hash/v1',
} as const;

/** 서명 키를 짐작으로 찾을 수 없게 최소 길이를 둔다(계획서 §6 C는 `openssl rand -base64 48`, 64자). */
export const MIN_SALT_LENGTH = 32;

export interface ServerKeys {
  token: CryptoKey;
  player: CryptoKey;
  ip: CryptoKey;
}

const HMAC = { name: 'HMAC', hash: 'SHA-256' } as const;

async function hmacBytes(key: CryptoKey, message: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

let cached: { salt: string; keys: Promise<ServerKeys> } | null = null;

export function isUsableSalt(salt: string | undefined): salt is string {
  return typeof salt === 'string' && salt.length >= MIN_SALT_LENGTH;
}

export function deriveKeys(salt: string): Promise<ServerKeys> {
  if (cached?.salt === salt) return cached.keys;
  const keys = (async () => {
    const root = await crypto.subtle.importKey('raw', encoder.encode(salt), HMAC, false, ['sign']);
    const derive = async (label: string, usages: KeyUsage[]) =>
      crypto.subtle.importKey('raw', await hmacBytes(root, label), HMAC, false, usages);
    return {
      token: await derive(KEY_LABELS.token, ['sign', 'verify']),
      player: await derive(KEY_LABELS.player, ['sign']),
      ip: await derive(KEY_LABELS.ip, ['sign']),
    };
  })();
  cached = { salt, keys };
  return keys;
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

/** 기기 토큰: `v1.<기기 ID>.<HMAC 서명>`. 서버는 기기 표를 두지 않고 서명만 확인한다. */
export async function signDeviceToken(keys: ServerKeys, deviceId: string): Promise<string> {
  return `v1.${deviceId}.${toBase64Url(await hmacBytes(keys.token, `v1.${deviceId}`))}`;
}

/** 서명이 맞으면 기기 ID를, 아니면 null을 돌려준다. 비교는 crypto.subtle.verify(상수 시간)가 한다. */
export async function verifyDeviceToken(keys: ServerKeys, token: string): Promise<string | null> {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const deviceId = match[1]!;
  const signature = fromBase64Url(match[2]!);
  if (!signature || signature.length !== 32) return null;
  const ok = await crypto.subtle.verify('HMAC', keys.token, signature, encoder.encode(`v1.${deviceId}`));
  return ok ? deviceId : null;
}

/** Postgres private_player_hash와 같은 꼴(64자리 16진수). 앞 16자리가 공개 태그다. */
export async function playerHash(keys: ServerKeys, deviceId: string): Promise<string> {
  return toHex(await hmacBytes(keys.player, deviceId));
}

/** 속도 제한에만 쓰는 IP 식별자. IP 원문은 저장하지 않는다. */
export async function ipHash(keys: ServerKeys, ip: string): Promise<string> {
  return toHex(await hmacBytes(keys.ip, ip)).slice(0, 32);
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
}

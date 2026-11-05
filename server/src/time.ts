import { kstDateKey, kstIsoWeekKey } from '../../src/contracts/lobby';

export { kstDateKey, kstIsoWeekKey };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Postgres 'minute:' || to_char(now() at time zone 'UTC','YYYYMMDDHH24MI')와 같은 분 단위 키. */
export function utcMinuteKey(nowMs: number): string {
  const d = new Date(nowMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

/** 다음 한국 자정까지 남은 초(올림, 최소 1). Postgres lobby_retry_after의 일 한도 분기. */
export function secondsUntilKstMidnight(nowMs: number): number {
  const kstMs = nowMs + KST_OFFSET_MS;
  const nextMidnightKst = Math.floor(kstMs / DAY_MS) * DAY_MS + DAY_MS;
  return Math.max(1, Math.ceil((nextMidnightKst - kstMs) / 1000));
}

/** 다음 분 경계까지 남은 초(올림, 최소 1). Postgres lobby_retry_after의 분 한도 분기. */
export function secondsUntilNextMinute(nowMs: number): number {
  const next = Math.floor(nowMs / 60_000) * 60_000 + 60_000;
  return Math.max(1, Math.ceil((next - nowMs) / 1000));
}

/** Postgres to_char(... 'YYYY-MM-DD"T"HH24:MI:SS"Z"') 꼴(밀리초 없음). */
export function isoSeconds(nowMs: number): string {
  return new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** 한국 날짜 키에서 days일 뺀 날짜 키. */
export function kstDateKeyDaysAgo(nowMs: number, days: number): string {
  return kstDateKey(new Date(nowMs - days * DAY_MS));
}

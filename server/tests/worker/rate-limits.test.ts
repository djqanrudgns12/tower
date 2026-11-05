/**
 * Codex 독립 검토(단계 3) P1 두 건의 회귀 시험.
 * 1) 늦게 도착한 요청(옛 분·일 키)이 최신 속도 제한 칸을 1로 되돌리지 않는다. 시각은 본문을 다 받은 뒤 정한다.
 * 2) 한 IP가 기기를 여러 개 받아도 IP별 한도에 걸린다. 홈을 자주 열어도 접속 기록 쓰기가 늘지 않는다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveKeys, ipHash, playerHash } from '../../src/crypto';
import { DEVICE_RATE_LIMITS, IP_RATE_LIMITS } from '../../src/store';
import { utcMinuteKey } from '../../src/time';
import { DAY, exec, newStats, rows, startServer, TEST_SALT, type Device, type TestServer } from '../support/harness';

let t: TestServer;
beforeAll(async () => {
  t = await startServer();
});
afterAll(() => t.close());

const hashOf = async (device: Device) => playerHash(await deriveKeys(TEST_SALT), device.deviceId);
const ipSubject = async (ip: string) => `ip:${await ipHash(await deriveKeys(TEST_SALT), ip)}`;

/** 개발 모드 제출은 속도 제한만 거치는 가장 짧은 길이다. */
const devSubmit = (device: Device, now: number) =>
  t.direct('/v1/runs/submit', { token: device.token, body: { p_content_mode: 'development' }, now });

describe('늦게 도착한 요청이 속도 제한을 풀지 않는다', () => {
  // 00:00:59에 시각을 정한 요청 A가, 00:01:01에 6번 제출해 429가 난 뒤에야 끝나는 경우.
  const T1 = Date.parse('2026-11-05T00:01:01Z');
  const T0 = Date.parse('2026-11-05T00:00:59Z');

  it('분 키: 옛 분 요청은 지금 칸에 더해지고, 같은 분의 다음 요청도 계속 429', async () => {
    const device = await t.newDevice();
    const hash = await hashOf(device);
    for (let i = 0; i < DEVICE_RATE_LIMITS.submit.minute; i++) expect((await devSubmit(device, T1)).status).toBe(200);
    expect((await devSubmit(device, T1)).status).toBe(429);
    const late = await devSubmit(device, T0);
    expect(late.status).toBe(429);
    for (let i = 0; i < 6; i++) expect((await devSubmit(device, T1 + 500 + i)).status).toBe(429);
    const [bucket] = await rows(t.db, "SELECT minute_key, minute_calls FROM rate_limits WHERE subject = ?1 AND action = 'submit'", hash);
    expect(bucket).toEqual({ minute_key: utcMinuteKey(T1), minute_calls: DEVICE_RATE_LIMITS.submit.minute });
    expect((await devSubmit(device, T1 + 60_000)).status).toBe(200);
  });

  it('분 키: 한도 안에서 늦게 온 요청도 0이 아니라 지금 칸에 더한다', async () => {
    const device = await t.newDevice();
    const hash = await hashOf(device);
    for (let i = 0; i < 3; i++) await devSubmit(device, T1);
    expect((await devSubmit(device, T0)).status).toBe(200);
    const [bucket] = await rows(t.db, "SELECT minute_key, minute_calls FROM rate_limits WHERE subject = ?1 AND action = 'submit'", hash);
    expect(bucket).toEqual({ minute_key: utcMinuteKey(T1), minute_calls: 4 });
    expect((await devSubmit(device, T1)).status).toBe(200);
    expect((await devSubmit(device, T1)).status).toBe(200);
    expect((await devSubmit(device, T1)).status).toBe(429);
  });

  it('일 키: 어제 날짜로 늦게 온 요청이 오늘 일 한도를 풀지 않는다', async () => {
    const device = await t.newDevice();
    const hash = await hashOf(device);
    expect((await devSubmit(device, T1)).status).toBe(200);
    await exec(t.db, "UPDATE rate_limits SET day_calls = day_limit WHERE subject = ?1 AND action = 'submit'", hash);
    const late = await devSubmit(device, T1 - DAY);
    expect(late.status).toBe(429);
    expect((await devSubmit(device, T1 + 120_000)).status).toBe(429);
    const [bucket] = await rows(t.db, "SELECT day_key, day_calls FROM rate_limits WHERE subject = ?1 AND action = 'submit'", hash);
    expect(bucket).toEqual({ day_key: '2026-11-05', day_calls: DEVICE_RATE_LIMITS.submit.day });
  });

  it('요청 시각은 본문을 다 받은 뒤 정한다(본문이 늦게 올라와도 옛 분으로 세지 않는다)', async () => {
    const device = await t.newDevice();
    const hash = await hashOf(device);
    let current = T0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        current = T1; // 본문이 도착하는 동안 시계가 다음 분으로 넘어갔다.
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ p_content_mode: 'development' })));
        controller.close();
      },
    });
    const r = await t.direct('/v1/runs/submit', { token: device.token, stream, headers: { 'Content-Type': 'application/json' }, now: () => current });
    expect(r.status).toBe(200);
    const [bucket] = await rows(t.db, "SELECT minute_key FROM rate_limits WHERE subject = ?1 AND action = 'submit'", hash);
    expect(bucket!.minute_key).toBe(utcMinuteKey(T1));
  });
});

describe('IP별 한도(기기를 여러 개 받아 우회하기)', () => {
  it('같은 IP의 다른 기기도 IP 칸에 함께 걸리고, 다른 IP는 영향이 없다', async () => {
    const schoolIp = '198.51.100.1';
    const a = await t.newDevice(schoolIp);
    const b = await t.newDevice(schoolIp);
    const elsewhere = await t.newDevice('198.51.100.2');
    const visit = (device: Device, ip: string) => t.call('/v1/lobby-visit', { token: device.token, body: {}, headers: { 'CF-Connecting-IP': ip } });
    expect((await visit(a, schoolIp)).status).toBe(200);
    const subject = await ipSubject(schoolIp);
    const [bucket] = await rows(t.db, "SELECT minute_calls, minute_limit, day_limit FROM rate_limits WHERE subject = ?1 AND action = 'visit'", subject);
    expect(bucket).toEqual({ minute_calls: 1, minute_limit: IP_RATE_LIMITS.visit.minute, day_limit: IP_RATE_LIMITS.visit.day });

    await exec(t.db, "UPDATE rate_limits SET minute_calls = minute_limit WHERE subject = ?1 AND action = 'visit'", subject);
    const blocked = await visit(b, schoolIp);
    expect([blocked.status, blocked.body.error]).toEqual([429, 'RATE_LIMITED']);
    expect(Number(blocked.headers.get('Retry-After'))).toBeLessThanOrEqual(60);
    expect((await visit(elsewhere, '198.51.100.2')).status).toBe(200);
    // 거부된 요청은 b의 기기 칸에도 세지 않는다(같은 batch가 되돌아간다).
    expect(await rows(t.db, "SELECT * FROM rate_limits WHERE subject = ?1 AND action = 'visit'", await hashOf(b))).toEqual([]);

    await exec(t.db, "UPDATE rate_limits SET minute_calls = 0, day_calls = day_limit WHERE subject = ?1 AND action = 'visit'", subject);
    const day = await visit(a, schoolIp);
    expect(day.status).toBe(429);
    expect(Number(day.headers.get('Retry-After'))).toBeGreaterThan(60);
  });

  it('학교 규모(학생 1,000명 × 하루 3판)를 막지 않는 값이다', () => {
    const runs = 1000 * 3;
    expect(IP_RATE_LIMITS.start.day).toBeGreaterThanOrEqual(runs);
    expect(IP_RATE_LIMITS.submit.day).toBeGreaterThanOrEqual(runs);
    expect(IP_RATE_LIMITS.visit.day).toBeGreaterThanOrEqual(runs * 3);
    expect(IP_RATE_LIMITS.ranking.day).toBeGreaterThanOrEqual(runs * 5);
    expect(IP_RATE_LIMITS.device.day).toBeGreaterThanOrEqual(1000 * 2);
  });
});

describe('홈 방문 쓰기 줄이기', () => {
  it('접속 기록은 60초가 지났을 때만 고치고, 그 사이 방문은 속도 제한 두 칸만 쓴다', async () => {
    const issued = await t.direct('/v1/device', { body: {}, now: Date.now() });
    const device = issued.body as unknown as Device;
    const hash = await hashOf(device);
    const N = Date.now();
    const visit = async (now: number) => {
      const stats = newStats();
      const r = await t.direct('/v1/lobby-visit', { token: device.token, body: {}, now, stats });
      expect(r.status).toBe(200);
      const [presence] = await rows(t.db, 'SELECT seen_at FROM lobby_presence WHERE visitor_hash = ?1', hash);
      return { written: stats.rowsWritten, seenAt: presence!.seen_at, recent: r.body.recentVisitors };
    };
    const first = await visit(N);
    expect(first.seenAt).toBe(N);
    const soon = await visit(N + 30_000);
    expect(soon).toMatchObject({ seenAt: N, written: 2 });
    expect(soon.recent).toBeGreaterThanOrEqual(1);
    const later = await visit(N + 61_000);
    expect(later.seenAt).toBe(N + 61_000);
  });
});

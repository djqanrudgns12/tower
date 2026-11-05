/**
 * supabase/tests/http-failures.sql의 경우를 옮기고, 새 서버가 직접 맡게 된 HTTP 경계(CORS·본문 크기·경로)를 더했다.
 * 논리적 실패를 HTTP 성공으로 돌려주지 않는다(PRD §16.3).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveKeys, ipHash, playerHash } from '../../src/crypto';
import { IP_RATE_LIMITS } from '../../src/store';
import { avoidMinuteBoundary, exec, rows, startServer, TEST_ORIGIN, TEST_SALT, type Device, type TestServer } from '../support/harness';

let t: TestServer;
let device: Device;
let hash: string;

beforeAll(async () => {
  t = await startServer();
  device = await t.newDevice();
  hash = await playerHash(await deriveKeys(TEST_SALT), device.deviceId);
});
afterAll(() => t.close());

const RANKING = '/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time';

/** 행동마다 SQL 시험과 같은 호출(빈 인자 제출 포함). */
const ACTION_CALLS = {
  visit: () => t.call('/v1/lobby-visit', { token: device.token, body: {}, headers: { Origin: TEST_ORIGIN } }),
  start: () => t.call('/v1/runs/start', { token: device.token, body: { p_run_id: '55555555-5555-4555-8555-555555555555' }, headers: { Origin: TEST_ORIGIN } }),
  submit: () => t.call('/v1/runs/submit', { token: device.token, body: {}, headers: { Origin: TEST_ORIGIN } }),
  ranking: () => t.call(RANKING, { token: device.token, headers: { Origin: TEST_ORIGIN } }),
} as const;

function secondsUntilKstMidnight(nowMs: number): number {
  const kst = nowMs + 9 * 3600_000;
  return Math.max(1, Math.ceil((Math.floor(kst / 86_400_000) * 86_400_000 + 86_400_000 - kst) / 1000));
}

describe('429와 Retry-After', () => {
  for (const action of Object.keys(ACTION_CALLS) as (keyof typeof ACTION_CALLS)[]) {
    it(`${action}: 분당 상한이면 429, Retry-After 1~60초를 다른 출처에서도 읽을 수 있다`, async () => {
      await avoidMinuteBoundary();
      await exec(t.db, 'DELETE FROM rate_limits');
      await ACTION_CALLS[action]();
      await exec(t.db, 'UPDATE rate_limits SET minute_calls = minute_limit WHERE subject = ?1 AND action = ?2', hash, action);
      const r = await ACTION_CALLS[action]();
      expect([r.status, r.body.error]).toEqual([429, 'RATE_LIMITED']);
      expect(r.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(TEST_ORIGIN);
      const retry = Number(r.headers.get('Retry-After'));
      expect(retry).toBeGreaterThanOrEqual(1);
      expect(retry).toBeLessThanOrEqual(60);
    });
  }

  it('일 상한이면 다음 한국 자정까지 기다리게 한다', async () => {
    await avoidMinuteBoundary();
    await exec(t.db, 'DELETE FROM rate_limits');
    await ACTION_CALLS.visit();
    await exec(t.db, "UPDATE rate_limits SET day_calls = day_limit WHERE subject = ?1 AND action = 'visit'", hash);
    const before = Date.now();
    const r = await ACTION_CALLS.visit();
    const after = Date.now();
    expect(r.status).toBe(429);
    const retry = Number(r.headers.get('Retry-After'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(86400);
    expect(retry).toBeLessThanOrEqual(secondsUntilKstMidnight(before));
    expect(retry).toBeGreaterThanOrEqual(secondsUntilKstMidnight(after));
  });

  it('최근 60초에 시작이 3번이면 분 경계가 바뀌어도 429(record_run_start의 60초 창)', async () => {
    await exec(t.db, 'DELETE FROM rate_limits');
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await exec(t.db, 'INSERT INTO run_start_dedup (run_id, player_hash, kst_date, started_at) VALUES (?1, ?2, ?3, ?4)', crypto.randomUUID(), hash, '2026-01-01', now - 10_000);
    }
    const r = await t.call('/v1/runs/start', { token: device.token, body: { p_run_id: crypto.randomUUID() } });
    expect([r.status, r.body.error]).toEqual([429, 'RATE_LIMITED']);
    expect(Number(r.headers.get('Retry-After'))).toBeLessThanOrEqual(60);
    await exec(t.db, 'DELETE FROM run_start_dedup WHERE player_hash = ?1', hash);
  });

  it('기기 발급은 IP별로 센다(학교 IP 하나에 한 반이 몰려도 막지 않는 넉넉한 한도)', async () => {
    expect(IP_RATE_LIMITS.device.minute).toBeGreaterThanOrEqual(60);
    await avoidMinuteBoundary();
    await exec(t.db, 'DELETE FROM rate_limits');
    for (let i = 0; i < 30; i++) await t.newDevice('203.0.113.7');
    const subject = `ip:${await ipHash(await deriveKeys(TEST_SALT), '203.0.113.7')}`;
    const [bucket] = await rows(t.db, "SELECT minute_calls FROM rate_limits WHERE subject = ?1 AND action = 'device'", subject);
    expect(bucket!.minute_calls).toBe(30);
    // IP 원문은 저장하지 않는다.
    expect(JSON.stringify(await rows(t.db, 'SELECT * FROM rate_limits'))).not.toContain('203.0.113.7');
    await exec(t.db, "UPDATE rate_limits SET minute_calls = minute_limit WHERE subject = ?1 AND action = 'device'", subject);
    const blocked = await t.call('/v1/device', { body: {}, headers: { 'CF-Connecting-IP': '203.0.113.7' } });
    expect([blocked.status, blocked.body.error]).toEqual([429, 'RATE_LIMITED']);
    expect((await t.call('/v1/device', { body: {}, headers: { 'CF-Connecting-IP': '203.0.113.8' } })).status).toBe(200);
  });
});

describe('422 입력 오류', () => {
  it('판 ID가 없거나 형식이 틀리면 INVALID_RUN_ID', async () => {
    await exec(t.db, 'DELETE FROM rate_limits');
    for (const body of [{}, { p_run_id: null }, { p_run_id: 'not-a-uuid' }]) {
      const r = await t.call('/v1/runs/start', { token: device.token, body });
      expect([r.status, r.body.error]).toEqual([422, 'INVALID_RUN_ID']);
    }
  });

  it('랭킹 조건이 틀리면 INVALID_QUERY', async () => {
    for (const query of [
      'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=&p_offset=0',
      'p_tab=local_device&p_grade=3&p_difficulty=Normal&p_period=all_time',
      'p_tab=single_score&p_grade=7&p_difficulty=Normal&p_period=all_time',
      'p_tab=single_score&p_grade=3&p_difficulty=Easy2&p_period=all_time',
      'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=monthly',
      'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=51',
      'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_offset=10001',
      'p_tab=single_score&p_difficulty=Normal&p_period=all_time',
    ]) {
      const r = await t.call(`/v1/leaderboard?${query}`, { token: device.token });
      expect([r.status, r.body.error], query).toEqual([422, 'INVALID_QUERY']);
    }
  });

  it('제출 검사 순서: 개발 모드 → 별명 → 값 범위 → 승인 조건', async () => {
    await exec(t.db, 'DELETE FROM rate_limits');
    const submit = (body: Record<string, unknown>) => t.call('/v1/runs/submit', { token: device.token, body });
    expect((await submit({ p_content_mode: 'development' })).body).toEqual({ ok: true, status: 'dev_mode_skipped' });
    expect((await submit({ p_content_mode: 'published', p_nickname: 'a' })).body.error).toBe('NICKNAME_REJECTED');
    expect((await submit({ p_content_mode: 'published', p_nickname: '솔방울' })).body.error).toBe('PLAUSIBILITY_REJECTED');
    const plausible = {
      p_content_mode: 'published', p_nickname: '솔방울', p_run_id: crypto.randomUUID(), p_grade: 3, p_difficulty: 'Normal', p_pt: 0,
      p_completed_wave: 1, p_correct: 0, p_wrong: 0, p_skipped: 0, p_ended_at: new Date().toISOString(), p_ended_at_wave: 1, p_active_ticks: 0,
    };
    expect((await submit({ ...plausible, p_completed_wave: 0 })).body.error).toBe('PLAUSIBILITY_REJECTED');
    expect((await submit({ ...plausible, p_ended_at_wave: 3 })).body.error).toBe('PLAUSIBILITY_REJECTED');
    expect((await submit({ ...plausible, p_completed_wave: 40000 })).body.error).toBe('PLAUSIBILITY_REJECTED');
    await exec(t.db, 'DELETE FROM rate_limits');
    expect((await submit({ ...plausible, p_ended_at: 'yesterday' })).body.error).toBe('PLAUSIBILITY_REJECTED');
    const version = await submit({ ...plausible, p_bank_version: 'test-bank', p_balance_version: 'test-balance', p_map_id: 'other_map' });
    expect([version.status, version.body.error]).toEqual([422, 'VERSION_REJECTED']);
    const difficulty = await submit({ ...plausible, p_difficulty: 'Ultra', p_bank_version: 'test-bank', p_balance_version: 'test-balance', p_map_id: 'garden_u' });
    expect(difficulty.body.error).toBe('VERSION_REJECTED');
  });
});

describe('HTTP 경계', () => {
  it('허용 출처의 사전 요청(preflight)에 CORS 헤더로 답한다', async () => {
    const r = await t.call('/v1/runs/submit', { method: 'OPTIONS', headers: { Origin: TEST_ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(TEST_ORIGIN);
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(Number(r.headers.get('Access-Control-Max-Age'))).toBeGreaterThan(0);
  });

  it('허용하지 않은 출처는 DB에 닿기 전에 403', async () => {
    await exec(t.db, 'DELETE FROM rate_limits');
    for (const options of [
      { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } },
      { body: {}, headers: { Origin: 'https://evil.example' } },
    ]) {
      const r = await t.call('/v1/device', options);
      expect([r.status, r.body.error]).toEqual([403, 'ORIGIN_REJECTED']);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
    expect(await rows(t.db, 'SELECT * FROM rate_limits')).toEqual([]);
  });

  it('본문 크기를 제한한다(작은 요청 4 KiB, 제출 320 KiB)', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(5000) });
    expect((await t.call('/v1/lobby-visit', { token: device.token, rawBody: big })).status).toBe(413);
    expect((await t.call('/v1/device', { rawBody: big })).status).toBe(413);
    const huge = JSON.stringify({ p_content_mode: 'published', pad: 'x'.repeat(330 * 1024) });
    const r = await t.call('/v1/runs/submit', { token: device.token, rawBody: huge });
    expect([r.status, r.body.error]).toEqual([413, 'PAYLOAD_TOO_LARGE']);
  });

  it('JSON이 아니면 400, 없는 경로는 404, 맞지 않는 방법은 405', async () => {
    expect((await t.call('/v1/lobby-visit', { token: device.token, rawBody: '{oops' })).body.error).toBe('INVALID_JSON');
    expect((await t.call('/v1/lobby-visit', { token: device.token, rawBody: '[1]' })).status).toBe(400);
    expect((await t.call('/rest/v1/rpc/lobby_rpc_failure', { body: {} })).status).toBe(404);
    expect((await t.call('/v1/leaderboard', { body: {}, token: device.token })).status).toBe(405);
    expect((await t.call('/v1/device')).status).toBe(405);
  });
});

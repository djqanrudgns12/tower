/**
 * 랭킹 응답 캐시(Workers Cache API). 로컬 workerd의 실제 caches.default로 확인한다.
 * 적중하면 속도 제한 칸·D1 행을 쓰지 않고, 기기마다 다른 부분(isMe·runIds·myEntry)은 섞이지 않으며, 새 기록은 바로 보인다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveKeys, playerHash } from '../../src/crypto';
import { exec, memoryCache, MINUTE, newStats, rows, startServer, submitBody, TEST_SALT, type Device, type TestServer } from '../support/harness';

let t: TestServer;
let alice: Device;
let bob: Device;
const hashOf = async (device: Device) => playerHash(await deriveKeys(TEST_SALT), device.deviceId);
const SINGLE = 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time';
const HONOR = 'p_tab=honor_points&p_grade=0&p_difficulty=Normal&p_period=all_time';

async function playRun(device: Device, overrides: Record<string, unknown> = {}) {
  const runId = crypto.randomUUID();
  expect((await t.call('/v1/runs/start', { token: device.token, body: { p_run_id: runId } })).status).toBe(200);
  await exec(t.db, 'UPDATE run_start_dedup SET started_at = ?1 WHERE run_id = ?2', Date.now() - 2 * MINUTE, runId);
  const r = await t.call('/v1/runs/submit', { token: device.token, body: submitBody(runId, { p_ended_at: new Date().toISOString(), ...overrides }) });
  expect(r.body.status).toBe('recorded');
  return runId;
}
const rankingCalls = async (device: Device) =>
  Number((await rows(t.db, "SELECT minute_calls FROM rate_limits WHERE subject = ?1 AND action = 'ranking'", await hashOf(device)))[0]?.minute_calls ?? 0);

beforeAll(async () => {
  t = await startServer({ rankingCacheSeconds: 60 });
  alice = await t.newDevice();
  bob = await t.newDevice();
});
afterAll(() => t.close());

describe('랭킹 응답 캐시', () => {
  it('적중하면 속도 제한 칸을 세지 않고 D1을 읽지 않으며, 쪽이 달라도 같은 범위의 캐시를 쓴다', async () => {
    const aliceRun = await playRun(alice);
    const miss = await t.call(`/v1/leaderboard?${SINGLE}`, { token: alice.token });
    expect(miss.body.myEntry).toMatchObject({ isMe: true, runIds: [aliceRun], primaryValue: 67 });
    expect(await rankingCalls(alice)).toBe(1);

    // DB를 몰래 바꿔도 적중이면 그대로다(= D1을 읽지 않았다).
    await exec(t.db, "UPDATE standings SET nickname = '몰래바꿈' WHERE kind = 'single_score'");
    const hit = await t.call(`/v1/leaderboard?${SINGLE}&p_limit=1&p_offset=0`, { token: alice.token });
    expect(hit.body.myEntry).toMatchObject({ nickname: '솔방울', isMe: true, runIds: [aliceRun] });
    expect(await rankingCalls(alice)).toBe(1);
  });

  it('다른 기기의 적중 응답에는 남의 isMe·runIds가 섞이지 않는다', async () => {
    const r = await t.call(`/v1/leaderboard?${SINGLE}`, { token: bob.token });
    expect(r.body.myEntry).toBeNull();
    expect(r.body.entries).toMatchObject([{ isMe: false, runIds: [] }]);
    expect(await rankingCalls(bob)).toBe(0);
  });

  it('제출이 기록되면 그 범위를 지워 새 기록이 바로 보인다', async () => {
    const bobRun = await playRun(bob, { p_pt: 60 });
    const r = await t.call(`/v1/leaderboard?${SINGLE}`, { token: bob.token });
    expect(r.body.totalCount).toBe(2);
    expect(r.body.myEntry).toMatchObject({ rank: 2, isMe: true, runIds: [bobRun] });
    expect(await rankingCalls(bob)).toBe(1);
    // 몰래 바꾼 별명은 다시 읽은 뒤에야 보인다.
    expect((r.body.entries as { nickname: string }[])[0]!.nickname).toBe('몰래바꿈');
    await exec(t.db, "UPDATE standings SET nickname = '솔방울' WHERE kind = 'single_score'");
  });

  it('명예점 적중에서도 내 runIds는 내 기록에서 읽어 준다(쓰기 없이)', async () => {
    const first = await t.call(`/v1/leaderboard?${HONOR}`, { token: alice.token });
    const before = await rankingCalls(alice);
    const hit = await t.call(`/v1/leaderboard?${HONOR}`, { token: alice.token });
    expect(hit.body).toEqual(first.body);
    expect((hit.body.myEntry as { runIds: string[] }).runIds).toHaveLength(1);
    expect(await rankingCalls(alice)).toBe(before);
  });
});

describe('적중 때 D1 행 수(같은 처리기, 메모리 캐시)', () => {
  it('점수 탭 적중은 읽기·쓰기 0행, 명예점 적중은 내 기록 읽기만', async () => {
    const cache = memoryCache();
    const now = Date.now();
    const measure = async (query: string) => {
      const stats = newStats();
      const r = await t.direct(`/v1/leaderboard?${query}`, { token: alice.token, now, cache, stats });
      expect(r.status).toBe(200);
      return stats;
    };
    expect((await measure(SINGLE)).rowsWritten).toBeGreaterThan(0);
    expect(await measure(SINGLE)).toMatchObject({ batches: 0, rowsRead: 0, rowsWritten: 0 });
    await measure(HONOR);
    const honorHit = await measure(HONOR);
    expect(honorHit).toMatchObject({ batches: 1, rowsWritten: 0 });
    expect(honorHit.rowsRead).toBeLessThan(10);
    expect(cache.keys().every(k => k.includes('/__ranking-cache/v1/'))).toBe(true);
  });

  it('캐시 열쇠 경로는 Worker가 응답하지 않는다(밖에서 꺼낼 수 없다)', async () => {
    const r = await t.call('/__ranking-cache/v1/single_score/all/3/Normal');
    expect(r.status).toBe(404);
  });
});

/**
 * 실제 요청 흐름: 기기 발급 → 홈 방문 → 판 시작 → 제출(재채점) → 랭킹. 응답 모양은 지금 RPC 결과와 같아야 한다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lobbyVisitResponseSchema, rankingSliceResponseSchema } from '../../../src/contracts/lobby';
import { deriveKeys, playerHash } from '../../src/crypto';
import { DAY, exec, MINUTE, rows, startServer, submitBody, TEST_SALT, type Device, type TestServer } from '../support/harness';

let t: TestServer;
let alice: Device;
let bob: Device;

beforeAll(async () => {
  t = await startServer();
  alice = await t.newDevice();
  bob = await t.newDevice();
});
afterAll(() => t.close());

async function playRun(device: Device, overrides: Record<string, unknown> = {}) {
  const runId = crypto.randomUUID();
  const started = await t.call('/v1/runs/start', { token: device.token, body: { p_run_id: runId } });
  expect(started.body).toEqual({ counted: true });
  await exec(t.db, 'UPDATE run_start_dedup SET started_at = ?1 WHERE run_id = ?2', Date.now() - 2 * MINUTE, runId);
  await exec(t.db, "DELETE FROM rate_limits WHERE action IN ('start', 'submit')");
  const submitted = await t.call('/v1/runs/submit', { token: device.token, body: submitBody(runId, { p_ended_at: new Date().toISOString(), ...overrides }) });
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
  return runId;
}

const ranking = (device: Device, query: string) => t.call(`/v1/leaderboard?${query}`, { token: device.token });

describe('기기 발급', () => {
  it('기기 ID(UUID)와 서명 토큰을 준다', async () => {
    const r = await t.call('/v1/device', { body: {} });
    expect(r.status).toBe(200);
    expect(r.body.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(r.body.token).toBe(`v1.${String(r.body.deviceId)}.${String(r.body.token).split('.')[2]}`);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('홈 방문(record_lobby_visit)', () => {
  it('오늘 처음 온 기기만 방문 수에 더하고, 최근 5분 방문 기기 수를 함께 준다', async () => {
    const first = await t.call('/v1/lobby-visit', { token: alice.token, body: {} });
    expect(first.status).toBe(200);
    expect(lobbyVisitResponseSchema.safeParse(first.body).success).toBe(true);
    expect(first.body).toMatchObject({ todayPlays: 0, totalVisitors: 1, totalPlays: 0, recentVisitors: 1 });
    expect(first.body.updatedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    expect((await t.call('/v1/lobby-visit', { token: alice.token, body: {} })).body).toMatchObject({ totalVisitors: 1, recentVisitors: 1 });
    expect((await t.call('/v1/lobby-visit', { token: bob.token, body: {} })).body).toMatchObject({ totalVisitors: 2, recentVisitors: 2 });

    const aliceHash = await playerHash(await deriveKeys(TEST_SALT), alice.deviceId);
    await exec(t.db, 'UPDATE lobby_presence SET seen_at = ?1 WHERE visitor_hash = ?2', Date.now() - 5 * MINUTE - 1000, aliceHash);
    expect((await t.call('/v1/lobby-visit', { token: bob.token, body: {} })).body).toMatchObject({ totalVisitors: 2, recentVisitors: 1 });
    const [daily] = await rows(t.db, 'SELECT unique_visitors FROM daily_metrics');
    expect(daily!.unique_visitors).toBe(2);
  });
});

describe('판 시작(record_run_start)', () => {
  it('처음 시작만 판 수에 더하고, 같은 판 다시 시작은 counted:false, 남의 판 ID는 403', async () => {
    const runId = crypto.randomUUID();
    expect((await t.call('/v1/runs/start', { token: alice.token, body: { p_run_id: runId } })).body).toEqual({ counted: true });
    expect((await t.call('/v1/runs/start', { token: alice.token, body: { p_run_id: runId } })).body).toEqual({ counted: false });
    const stolen = await t.call('/v1/runs/start', { token: bob.token, body: { p_run_id: runId } });
    expect([stolen.status, stolen.body.error]).toEqual([403, 'OWNER_REJECTED']);
    expect((await t.call('/v1/lobby-visit', { token: alice.token, body: {} })).body).toMatchObject({ todayPlays: 1, totalPlays: 1 });
    await exec(t.db, 'DELETE FROM rate_limits');
  });
});

describe('제출 → 랭킹', () => {
  it('세 분류 모두 지금 RPC 결과와 같은 모양으로 내 기록을 보여 준다', async () => {
    const runId = await playRun(alice);
    const single = await ranking(alice, 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0');
    expect(rankingSliceResponseSchema.safeParse(single.body).success).toBe(true);
    const aliceTag = (await playerHash(await deriveKeys(TEST_SALT), alice.deviceId)).slice(0, 16);
    const expectedEntry = {
      rank: 1, playerIdHash: aliceTag, isMe: true, runIds: [runId], nickname: '솔방울', grade: 3, difficulty: 'Normal',
      primaryValue: 67, secondaryLabel: '1웨이브',
    };
    expect(single.body).toMatchObject({ totalCount: 1, entries: [expectedEntry], myEntry: expectedEntry });
    expect((single.body.myEntry as { achievedAtIso: string }).achievedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const wave = await ranking(alice, 'p_tab=best_wave&p_grade=3&p_difficulty=Normal&p_period=season1');
    expect(wave.body.myEntry).toMatchObject({ primaryValue: 1, secondaryLabel: '67점', runIds: [runId] });

    const honor = await ranking(alice, 'p_tab=honor_points&p_grade=0&p_difficulty=Easy&p_period=weekly');
    expect(honor.body.myEntry).toMatchObject({ primaryValue: 67 + 15 + 6, secondaryLabel: '완주 1판', grade: 3, difficulty: 'Normal', runIds: [runId] });

    // 다른 난이도·학년 리그에는 나오지 않는다.
    expect((await ranking(alice, 'p_tab=single_score&p_grade=3&p_difficulty=Hard&p_period=all_time')).body).toEqual({ entries: [], totalCount: 0, myEntry: null });
    expect((await ranking(alice, 'p_tab=honor_points&p_grade=4&p_difficulty=Normal&p_period=all_time')).body.totalCount).toBe(0);
  });

  it('최고 판만 남기고, 명예점은 판마다 더하며 마지막 별명을 쓴다', async () => {
    const weaker = await playRun(alice, { p_pt: 50, p_nickname: '도토리' });
    const single = await ranking(alice, 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time');
    expect(single.body.myEntry).toMatchObject({ primaryValue: 67, nickname: '솔방울' });
    expect((single.body.myEntry as { runIds: string[] }).runIds).not.toContain(weaker);
    const honor = await ranking(alice, 'p_tab=honor_points&p_grade=3&p_difficulty=Normal&p_period=all_time');
    expect(honor.body.myEntry).toMatchObject({ primaryValue: 88 + (50 + 15 + 6), secondaryLabel: '완주 2판', nickname: '도토리' });
    expect((honor.body.myEntry as { runIds: string[] }).runIds).toHaveLength(2);
  });

  it('남의 항목에는 runIds를 주지 않고, 순위·쪽 나누기·전체 수가 맞다', async () => {
    await playRun(bob, { p_pt: 60 });
    const page1 = await ranking(bob, 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=1&p_offset=0');
    expect(page1.body.totalCount).toBe(2);
    expect(page1.body.entries).toMatchObject([{ rank: 1, isMe: false, runIds: [], primaryValue: 67 }]);
    expect(page1.body.myEntry).toMatchObject({ rank: 2, isMe: true, primaryValue: 60 });
    const beyond = await ranking(bob, 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=5');
    expect(beyond.body.entries).toEqual([]);
    expect(beyond.body.totalCount).toBe(2);
    expect(beyond.body.myEntry).toMatchObject({ rank: 2 });
  });

  it('지난주에 끝난 판은 주간 랭킹에 없고 전체 랭킹에는 있다(종료 시각 7일 묶기)', async () => {
    const carol = await t.newDevice();
    await playRun(carol, { p_ended_at: new Date(Date.now() - 8 * DAY).toISOString(), p_pt: 40 });
    const [run] = await rows(t.db, 'SELECT week_key FROM completed_runs WHERE pt = 40');
    const weekly = await ranking(carol, 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=weekly');
    const allTime = await ranking(carol, 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time');
    expect(allTime.body.myEntry).toMatchObject({ primaryValue: 40 });
    const thisWeek = (await rows(t.db, 'SELECT week_key FROM completed_runs WHERE pt = 67'))[0]!.week_key;
    expect(weekly.body.myEntry === null).toBe(run!.week_key !== thisWeek);
  });

  it('승인 조건을 끄면 그 조건의 기록이 랭킹에서 빠지고, 다시 켜면 돌아온다', async () => {
    const q = 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time';
    await exec(t.db, "UPDATE approved_run_conditions SET active = 0 WHERE bank_version = 'test-bank'");
    expect((await ranking(alice, q)).body).toEqual({ entries: [], totalCount: 0, myEntry: null });
    await exec(t.db, "UPDATE approved_run_conditions SET active = 1 WHERE bank_version = 'test-bank'");
    expect((await ranking(alice, q)).body.totalCount).toBe(3);
  });
});

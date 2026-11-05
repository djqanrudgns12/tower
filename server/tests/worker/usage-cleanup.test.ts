/**
 * 1) 요청마다 D1 읽기·쓰기 행 수(무료 한도 계산의 근거). 같은 로컬 D1에서 같은 처리기를 Node로 불러 D1 meta를 모은다.
 * 2) 하루 한 번 정리(scheduled)가 Postgres cleanup_ephemeral_lobby_hashes와 같은 것을 지운다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { kstDateKey } from '../../../src/contracts/lobby';
import { deriveKeys, playerHash } from '../../src/crypto';
import { DAY, exec, MINUTE, newStats, rows, startServer, submitBody, TEST_SALT, type Device, type TestServer } from '../support/harness';

let t: TestServer;
beforeAll(async () => {
  t = await startServer();
});
afterAll(() => t.close());

async function measure(path: string, options: Parameters<TestServer['direct']>[1]) {
  const stats = newStats();
  const result = await t.direct(path, { ...options, stats });
  return { status: result.status, body: result.body, ...stats };
}

describe('요청당 D1 행 수', () => {
  it('한 판(발급·방문·시작·제출·랭킹)과 기록이 쌓인 뒤 랭킹 조회', async () => {
    const table: Record<string, { batches: number; rowsRead: number; rowsWritten: number }> = {};
    const keep = (name: string, m: { status: number; batches: number; rowsRead: number; rowsWritten: number }) => {
      expect(m.status, name).toBe(200);
      table[name] = { batches: m.batches, rowsRead: m.rowsRead, rowsWritten: m.rowsWritten };
    };
    const now = Date.now();
    const issued = await measure('/v1/device', { body: {}, now });
    keep('POST /v1/device', issued);
    const device = issued.body as unknown as Device;
    keep('POST /v1/lobby-visit (오늘 처음)', await measure('/v1/lobby-visit', { token: device.token, body: {}, now }));
    keep('POST /v1/lobby-visit (60초 안에 다시)', await measure('/v1/lobby-visit', { token: device.token, body: {}, now: now + 1000 }));
    keep('POST /v1/lobby-visit (60초 뒤 다시)', await measure('/v1/lobby-visit', { token: device.token, body: {}, now: now + 61_000 }));
    const runId = crypto.randomUUID();
    keep('POST /v1/runs/start', await measure('/v1/runs/start', { token: device.token, body: { p_run_id: runId }, now }));
    const submitAt = now + 2 * MINUTE;
    keep('POST /v1/runs/submit (첫 기록)', await measure('/v1/runs/submit', { token: device.token, body: submitBody(runId, { p_ended_at: new Date(now).toISOString() }), now: submitAt }));
    const second = crypto.randomUUID();
    await measure('/v1/runs/start', { token: device.token, body: { p_run_id: second }, now: now + 10_000 });
    keep('POST /v1/runs/submit (최고 기록 못 넘음)', await measure('/v1/runs/submit', { token: device.token, body: submitBody(second, { p_pt: 50, p_ended_at: new Date(now).toISOString() }), now: submitAt + 1000 }));
    const single = 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0';
    const honor = 'p_tab=honor_points&p_grade=0&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0';
    keep('GET /v1/leaderboard 점수 (기기 1)', await measure(`/v1/leaderboard?${single}`, { token: device.token, now: submitAt }));

    // 기기 300대가 한 판씩(3학년 Normal 리그) 기록한 뒤
    const statements = [];
    for (let i = 0; i < 300; i++) {
      const hash = i.toString(16).padStart(64, '0');
      statements.push(t.db.prepare(
        `INSERT INTO completed_runs (run_id, player_hash, public_tag, nickname, grade, difficulty, pt, honor_pt, completed_wave, correct, wrong, skipped,
           content_mode, balance_version, bank_version, map_id, week_key, kst_date, local_ended_at, ended_at, received_at, verification_level, payload_hash)
         SELECT ?1, ?2, substr(?2, 1, 16), '다람쥐', 3, 'Normal', ?3, 100, 1, 3, 0, 0, 'published', 'test-balance', 'test-bank', 'garden_u',
                week_key, kst_date, ?4, ?4, ?4, 'question_regraded_combat_bounded', 'x' FROM completed_runs LIMIT 1`,
      ).bind(crypto.randomUUID(), hash, 40 + (i % 50), now + i));
    }
    for (let i = 0; i < statements.length; i += 50) await t.db.batch(statements.slice(i, i + 50));
    await exec(t.db, 'DELETE FROM rate_limits');
    keep('GET /v1/leaderboard 점수 (기기 301)', await measure(`/v1/leaderboard?${single}`, { token: device.token, now: submitAt }));
    keep('GET /v1/leaderboard 명예점 전체 학년 (기기 301)', await measure(`/v1/leaderboard?${honor}`, { token: device.token, now: submitAt }));

    console.log('요청당 D1 행 수(로컬 D1 meta)\n' + Object.entries(table).map(([k, v]) => `  ${k}: batch ${v.batches}, 읽기 ${v.rowsRead}, 쓰기 ${v.rowsWritten}`).join('\n'));

    // 무료 한도 계산이 기대는 상한. 넘으면 설계가 바뀐 것이므로 계산을 다시 한다.
    // 속도 제한 칸(기기 1 + IP 1)이 쓰는 행도 들어 있다.
    expect(table['POST /v1/device']!.rowsWritten).toBeLessThanOrEqual(1);
    expect(table['POST /v1/lobby-visit (오늘 처음)']!.rowsWritten).toBeLessThanOrEqual(8);
    expect(table['POST /v1/lobby-visit (60초 안에 다시)']!.rowsWritten).toBeLessThanOrEqual(2);
    expect(table['POST /v1/runs/start']!.rowsWritten).toBeLessThanOrEqual(7);
    expect(table['POST /v1/runs/submit (첫 기록)']!.rowsWritten).toBeLessThanOrEqual(12);
    expect(table['GET /v1/leaderboard 점수 (기기 301)']!.rowsWritten).toBeLessThanOrEqual(2);
    // 랭킹 읽기는 기록 수가 아니라 리그에 든 기기 수에 비례한다.
    expect(table['GET /v1/leaderboard 점수 (기기 301)']!.rowsRead).toBeLessThan(2000);
    for (const v of Object.values(table)) expect(v.batches).toBeLessThanOrEqual(2);
  }, 60_000);
});

describe('하루 한 번 정리(cleanup_ephemeral_lobby_hashes)', () => {
  it('7일 지난 방문 해시·시작 기록, 지난 속도 제한, 하루 지난 접속 기록을 지우고 최근 것은 남긴다', async () => {
    const now = Date.now();
    const hash = await playerHash(await deriveKeys(TEST_SALT), crypto.randomUUID());
    const old = kstDateKey(new Date(now - 8 * DAY));
    const recent = kstDateKey(new Date(now - 6 * DAY));
    await t.db.batch([
      t.db.prepare('DELETE FROM daily_visitor_hashes'), t.db.prepare('DELETE FROM run_start_dedup'), t.db.prepare('DELETE FROM rate_limits'), t.db.prepare('DELETE FROM lobby_presence'),
      t.db.prepare('INSERT INTO daily_visitor_hashes VALUES (?1, ?2, 0)').bind(old, hash),
      t.db.prepare('INSERT INTO daily_visitor_hashes VALUES (?1, ?2, 0)').bind(recent, hash),
      t.db.prepare("INSERT INTO run_start_dedup VALUES ('old-run', ?1, ?2, 0)").bind(hash, old),
      t.db.prepare("INSERT INTO run_start_dedup VALUES ('recent-run', ?1, ?2, 0)").bind(hash, recent),
      t.db.prepare("INSERT INTO rate_limits VALUES ('old', 'visit', 'x', 1, 60, ?1, 1, 2000)").bind(kstDateKey(new Date(now - 3 * DAY))),
      t.db.prepare("INSERT INTO rate_limits VALUES ('today', 'visit', 'x', 1, 60, ?1, 1, 2000)").bind(kstDateKey(new Date(now))),
      t.db.prepare('INSERT INTO lobby_presence VALUES (?1, ?2)').bind(hash, now - 2 * DAY),
      t.db.prepare('INSERT INTO lobby_presence VALUES (?1, ?2)').bind(hash.replace(/^./, 'f') === hash ? hash.replace(/^./, 'e') : hash.replace(/^./, 'f'), now - MINUTE),
    ]);
    await t.scheduled(now);
    expect((await rows(t.db, 'SELECT kst_date FROM daily_visitor_hashes')).map(r => r.kst_date)).toEqual([recent]);
    expect((await rows(t.db, 'SELECT run_id FROM run_start_dedup')).map(r => r.run_id)).toEqual(['recent-run']);
    expect((await rows(t.db, 'SELECT subject FROM rate_limits')).map(r => r.subject)).toEqual(['today']);
    expect(await rows(t.db, 'SELECT * FROM lobby_presence')).toHaveLength(1);
  });
});

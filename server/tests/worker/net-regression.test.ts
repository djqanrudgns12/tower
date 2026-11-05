/**
 * supabase/tests/net-regression.sql의 경우를 로컬 D1 Worker로 옮겼다.
 * 소유권·권한·별명·시간·재채점·멱등·접수 시각·종료 시각 묶기·소금값.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveKeys, playerHash, signDeviceToken } from '../../src/crypto';
import { avoidMinuteBoundary, DAY, exec, MINUTE, rows, startServer, submitBody, TEST_SALT, type Device, type TestServer } from '../support/harness';

let t: TestServer;
let owner: Device;
let other: Device;
const RUN = '22222222-2222-4222-8222-222222222222';

const hashOf = async (device: Device) => playerHash(await deriveKeys(TEST_SALT), device.deviceId);

beforeAll(async () => {
  t = await startServer();
  owner = await t.newDevice();
  other = await t.newDevice();
});
afterAll(() => t.close());

describe('익명 기기 신원', () => {
  it('토큰 없이는 어떤 기록 요청도 받지 않는다(anonymous RPC privilege)', async () => {
    for (const path of ['/v1/lobby-visit', '/v1/runs/start', '/v1/runs/submit']) {
      const r = await t.call(path, { body: {} });
      expect(r.status, path).toBe(401);
      expect(r.body.error).toBe('AUTH_REQUIRED');
    }
    const ranking = await t.call('/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time');
    expect(ranking.status).toBe(401);
  });

  it('남의 기기 ID로 토큰을 꾸미거나 본문에 ID를 넣어도 소유자가 바뀌지 않는다(legacy spoofable signature)', async () => {
    const forged = `v1.${other.deviceId}.${owner.token.split('.')[2]}`;
    expect((await t.call('/v1/lobby-visit', { token: forged, body: {} })).status).toBe(401);
    const otherSaltToken = await signDeviceToken(await deriveKeys('another-salt-of-sufficient-length-000000'), owner.deviceId);
    expect((await t.call('/v1/lobby-visit', { token: otherSaltToken, body: {} })).status).toBe(401);

    const visit = await t.call('/v1/lobby-visit', { token: owner.token, body: { p_player_id: other.deviceId } });
    expect(visit.status).toBe(200);
    const visitors = await rows(t.db, 'SELECT visitor_hash FROM daily_visitor_hashes');
    expect(visitors.map(v => v.visitor_hash)).toContain(await hashOf(owner));
    expect(visitors.map(v => v.visitor_hash)).not.toContain(await hashOf(other));
  });
});

describe('완주 제출(submit_completed_run)', () => {
  it('시작 기록이 없으면 START_REQUIRED', async () => {
    const r = await t.call('/v1/runs/submit', { token: owner.token, body: submitBody(RUN) });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe('START_REQUIRED');
  });

  it('시작 직후 제출은 DURATION_REJECTED', async () => {
    expect((await t.call('/v1/runs/start', { token: owner.token, body: { p_run_id: RUN } })).body).toEqual({ counted: true });
    const r = await t.call('/v1/runs/submit', { token: owner.token, body: submitBody(RUN) });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe('DURATION_REJECTED');
  });

  it('카운터가 재채점과 다르면 ANSWER_MISMATCH, 처치 점수 상한을 넘으면 PT_MISMATCH', async () => {
    await exec(t.db, 'UPDATE run_start_dedup SET started_at = ?1 WHERE run_id = ?2', Date.now() - 2 * MINUTE, RUN);
    const counter = await t.call('/v1/runs/submit', { token: owner.token, body: submitBody(RUN, { p_correct: 4 }) });
    expect([counter.status, counter.body.error]).toEqual([422, 'ANSWER_MISMATCH']);
    const pt = await t.call('/v1/runs/submit', { token: owner.token, body: submitBody(RUN, { p_pt: 68 }) });
    expect([pt.status, pt.body.error]).toEqual([422, 'PT_MISMATCH']);
  });

  it('정상 판은 기록되고, 같은 제출은 멱등이며 접수 시각·원본 종료 시각·7일 묶기를 지킨다', async () => {
    const body = submitBody(RUN);
    const ok = await t.call('/v1/runs/submit', { token: owner.token, body });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true, status: 'recorded', verificationLevel: 'question_regraded_combat_bounded' });
    const [first] = await rows(t.db, 'SELECT * FROM completed_runs WHERE run_id = ?1', RUN);

    const again = await t.call('/v1/runs/submit', { token: owner.token, body });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ ok: true, status: 'already_recorded', verificationLevel: 'question_regraded_combat_bounded' });
    const after = await rows(t.db, 'SELECT * FROM completed_runs WHERE run_id = ?1', RUN);
    expect(after).toHaveLength(1);
    expect(after[0]!.received_at).toBe(first!.received_at);

    expect(first!.local_ended_at).toBe(Date.parse(body.p_ended_at as string));
    expect(first!.ended_at).toBe(Number(first!.received_at) - 7 * DAY);
    expect(first!.honor_pt).toBe(67 + 15 + 3 * 2);
    expect(first!.public_tag).toBe(String(first!.player_hash).slice(0, 16));
  });

  it('선택지가 null인 답안은 재채점을 통과하지 못한다(null answer)', async () => {
    const run = '22222222-2222-4222-8222-222222222223';
    await t.call('/v1/runs/start', { token: owner.token, body: { p_run_id: run } });
    await exec(t.db, 'UPDATE run_start_dedup SET started_at = ?1 WHERE run_id = ?2', Date.now() - 2 * MINUTE, run);
    // 앞 시험들이 이 기기의 분당 제출 6회를 다 썼다. SQL 원본은 이 경우를 재채점 함수로 직접 불렀다.
    await exec(t.db, "DELETE FROM rate_limits WHERE action = 'submit'");
    const answers = (submitBody(run).p_answers as Record<string, unknown>[]).map((a, i) => (i === 0 ? { ...a, choice: null } : a));
    const r = await t.call('/v1/runs/submit', { token: owner.token, body: submitBody(run, { p_answers: answers }) });
    expect([r.status, r.body.error]).toEqual([422, 'ANSWER_MISMATCH']);
  });

  it('다른 기기가 같은 판 ID로 내면 DUPLICATE_RUN_REJECTED, 랭킹에서 남의 기록을 내 것으로 표시하지 않는다(spoofed owner)', async () => {
    const r = await t.call('/v1/runs/submit', { token: other.token, body: submitBody(RUN) });
    expect([r.status, r.body.error]).toEqual([409, 'DUPLICATE_RUN_REJECTED']);
    const ranking = await t.call('/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0', { token: other.token });
    expect(ranking.status).toBe(200);
    expect(ranking.body.myEntry).toBeNull();
    const entries = ranking.body.entries as { isMe: boolean; runIds: string[] }[];
    expect(entries).toHaveLength(1);
    expect(entries[0]!.isMe).toBe(false);
    expect(entries[0]!.runIds).toEqual([]);
  });
});

describe('별명(clean_public_nickname)', () => {
  const submitWithNickname = async (nickname: string) => {
    const run = crypto.randomUUID();
    await t.call('/v1/runs/start', { token: owner.token, body: { p_run_id: run } });
    await exec(t.db, 'UPDATE run_start_dedup SET started_at = ?1 WHERE run_id = ?2', Date.now() - 2 * MINUTE, run);
    await exec(t.db, "DELETE FROM rate_limits WHERE action IN ('start', 'submit')");
    const r = await t.call('/v1/runs/submit', { token: owner.token, body: submitBody(run, { p_nickname: nickname }) });
    const stored = await rows(t.db, 'SELECT nickname FROM completed_runs WHERE run_id = ?1', run);
    return { r, stored: stored[0]?.nickname };
  };

  it('긴 숫자·이메일·주소는 NICKNAME_REJECTED(nickname privacy)', async () => {
    for (const nickname of ['１２３４５６', 'a@b.kr', 'a.com', '010-1234-5678']) {
      const { r } = await submitWithNickname(nickname);
      expect([r.status, r.body.error], nickname).toEqual([422, 'NICKNAME_REJECTED']);
    }
  });

  it('전각 숫자를 정규화하고 제어 문자·가장자리 공백을 지운다(normalization, controls and trimming)', async () => {
    expect((await submitWithNickname('친구１２')).stored).toBe('친구12');
    expect((await submitWithNickname('﻿솔\u0085방울 ')).stored).toBe('솔방울');
  });

  it('결합 이모지는 한 글자로 세어 2~12자만 받는다(grapheme bounds)', async () => {
    const family = '👨‍👩‍👧‍👦';
    expect((await submitWithNickname(family.repeat(2))).r.status).toBe(200);
    expect((await submitWithNickname(family.repeat(12))).r.status).toBe(200);
    expect((await submitWithNickname(family)).r.body.error).toBe('NICKNAME_REJECTED');
    expect((await submitWithNickname(family.repeat(13))).r.body.error).toBe('NICKNAME_REJECTED');
  });
});

describe('기기별 속도 제한(allow_lobby_rpc)', () => {
  it('분당·일당 상한을 따로 보고 다른 기기는 영향을 받지 않는다', async () => {
    const a = await t.newDevice();
    const b = await t.newDevice();
    const hashA = await hashOf(a);
    const ranking = '/v1/leaderboard?p_tab=honor_points&p_grade=0&p_difficulty=Normal&p_period=weekly';
    await avoidMinuteBoundary();
    expect((await t.call(ranking, { token: a.token })).status).toBe(200);
    await exec(t.db, "UPDATE rate_limits SET minute_calls = minute_limit WHERE subject = ?1 AND action = 'ranking'", hashA);
    expect((await t.call(ranking, { token: a.token })).status).toBe(429);
    expect((await t.call(ranking, { token: b.token })).status).toBe(200);

    await exec(t.db, "UPDATE rate_limits SET minute_calls = 0, day_calls = day_limit WHERE subject = ?1 AND action = 'ranking'", hashA);
    const day = await t.call(ranking, { token: a.token });
    expect(day.status).toBe(429);
    expect(Number(day.headers.get('Retry-After'))).toBeGreaterThan(60);
    expect((await t.call(ranking, { token: b.token })).status).toBe(200);
    // 거부된 호출은 세지 않는다.
    const [bucket] = await rows(t.db, "SELECT day_calls, day_limit FROM rate_limits WHERE subject = ?1 AND action = 'ranking'", hashA);
    expect(bucket!.day_calls).toBe(bucket!.day_limit);
  });

  it('p_limit이 비어 있으면 INVALID_QUERY(null limit)', async () => {
    const r = await t.call('/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=&p_offset=0', { token: owner.token });
    expect([r.status, r.body.error]).toEqual([422, 'INVALID_QUERY']);
  });
});

describe('소금값(app.player_salt)', () => {
  it('PLAYER_SALT가 없거나 너무 짧으면 모든 요청을 503으로 막는다(missing salt)', async () => {
    for (const salt of ['', 'short-salt']) {
      const unsalted = await startServer({ salt, seed: false });
      try {
        for (const [path, options] of [['/v1/device', { body: {} }], ['/v1/lobby-visit', { body: {}, token: owner.token }]] as const) {
          const r = await unsalted.call(path, options);
          expect([r.status, r.body.error], `${salt}:${path}`).toEqual([503, 'PLAYER_SALT_REQUIRED']);
        }
      } finally {
        await unsalted.close();
      }
    }
  });
});

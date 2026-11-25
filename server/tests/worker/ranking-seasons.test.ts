import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import balance from '../../../docs/contracts/balance.v2.json';
import { balanceV2Schema } from '../../../src/contracts/balanceV2';
import { createWaveSequence } from '../../../src/domain/r6Mixer';
import { minimumDurationMs, parseVerificationRules } from '../../src/rules';
import { exec, memoryCache, MINUTE, rows, runSqlLines, startServer, submitBody, type TestServer } from '../support/harness';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({ seed: false });
  await runSqlLines(server.db, await readFile(new URL('../../seed/question_keys.sql', import.meta.url), 'utf8'));
});
afterAll(() => server.close());

describe('공개 은행의 시즌 전환', () => {
  it('새 시즌은 네 학년 모두 초원 고원이고, 같은 시드의 혼합 편성 수·보스 주기·시간 하한이 D1 규칙과 맞는다', async () => {
    const conditions = await rows(server.db, 'SELECT grade, map_id FROM approved_run_conditions WHERE balance_version = ? AND active=1 ORDER BY grade', '2.0.0');
    expect(conditions).toEqual([3, 4, 5, 6].map(grade => ({ grade, map_id: 'garden_u' })));
    const v = balanceV2Schema.parse(balance);
    const sequence = createWaveSequence(v, 'garden_u', 1);
    const stored = await rows(server.db, 'SELECT rules FROM run_verification_rules WHERE balance_version=? AND difficulty=?', '2.0.0', 'Normal');
    const rules = parseVerificationRules(String(stored[0]!.rules));
    let elapsed = 0;
    for (let wave = 1; wave <= 21; wave++) {
      const list = sequence();
      expect(list.filter(enemy => enemy.lineage === 'boss')).toHaveLength(Number(wave % rules.bossEvery === 0));
      const interval = v.waves.spawnIntervalMs;
      elapsed += (list.length - 1) * (interval.overrides[String(wave)] ?? Math.max(interval.min, interval.base + (wave - 1) * interval.perWave));
      expect(minimumDurationMs(rules, wave)).toBe(elapsed);
      if (wave === 20) {
        const digest = createHash('sha256').update(JSON.stringify(list.map(e => [e.id, e.elite]))).digest('hex');
        expect(digest.slice(0, 16)).toBe('8b48daa15fa90894');
      }
    }
  });

  it('같은 학생의 두 시즌 제출·재전송·학교·캐시·내 기록과 점수·시간 경계를 분리한다', async () => {
    const { token } = await server.newDevice();
    const cache = memoryCache();
    const now = Date.now();
    const school = '7010057';
    const [question] = await rows(server.db, `SELECT q.* FROM question_keys q JOIN approved_run_conditions c USING(bank_version,grade)
      WHERE grade=4 AND c.balance_version='2.0.0' AND active=1 LIMIT 1`);
    const play = async (version: string, mapId: string, score: number) => {
      const runId = crypto.randomUUID();
      const body = submitBody(runId, {
        p_grade: 4, p_map_id: mapId, p_balance_version: version, p_bank_version: question!.bank_version,
        p_school_code: school, p_school_name: '초원학교', p_correct: 5, p_wrong: 0, p_skipped: 0,
        p_answers: Array.from({ length: 5 }, (_, i) => ({ encounterId: i + 1, questionId: question!.question_id,
          revision: question!.revision, choice: question!.correct_option, phase: 'prep', wave: 1 })),
        p_pt: score, p_ended_at: new Date(now).toISOString(),
      });
      expect((await server.direct('/v1/runs/start', { token, now: now - 2 * MINUTE, body: { p_run_id: runId } })).status).toBe(200);
      const submit = (overrides = {}) => server.direct('/v1/runs/submit', { token, now, cache, body: { ...body, ...overrides } });
      return { runId, submit };
    };
    const ranking = async (period: string, tab = 'honor_points') => {
      const response = await server.direct(`/v1/leaderboard?p_tab=${tab}&p_period=${period}&p_grade=4&p_difficulty=Normal&p_school_code=${school}`, { token, now, cache });
      expect(response.status).toBe(200);
      return response.body.myEntry;
    };
    const old = await play('1.0.0', 'river_z', 78);
    expect((await old.submit()).body.status).toBe('recorded');
    expect(await ranking('season2')).toBeNull();
    const fresh = await play('2.0.0', 'garden_u', 105);
    expect((await fresh.submit({ p_map_id: 'river_z' })).body.error).toBe('VERSION_REJECTED');
    expect((await fresh.submit({ p_pt: 106 })).body.error).toBe('PT_MISMATCH');
    expect((await fresh.submit({ p_ended_at_wave: 3 })).body.error).toBe('PLAUSIBILITY_REJECTED');
    expect((await fresh.submit({ p_active_ticks: 1000 })).body.error).toBe('DURATION_REJECTED');
    await exec(server.db, "DELETE FROM rate_limits WHERE action='submit'");
    expect((await fresh.submit({ p_active_ticks: 1001 })).body.status).toBe('recorded');
    for (const period of ['weekly', 'all_time', 'season2']) {
      expect(await ranking(period)).toMatchObject({ primaryValue: 130, runIds: [fresh.runId] });
    }
    expect(await ranking('season1')).toMatchObject({ primaryValue: 103, runIds: [old.runId] });
    expect(await ranking('season1', 'single_score')).toMatchObject({ primaryValue: 78 });
    expect(await ranking('season2', 'best_wave')).toMatchObject({ runIds: [fresh.runId] });
    expect(await rows(server.db, 'SELECT season_id FROM completed_runs ORDER BY balance_version')).toEqual([{ season_id: 'season1' }, { season_id: 'season2' }]);
    await exec(server.db, "UPDATE ranking_seasons SET submissions_open=0 WHERE season_id='season1'");
    expect((await old.submit()).body.status).toBe('already_recorded');
    const late = await play('1.0.0', 'river_z', 80);
    expect((await late.submit()).status).toBe(503);
    expect(await ranking('season1', 'best_wave')).toMatchObject({ runIds: [old.runId] });
  });
});

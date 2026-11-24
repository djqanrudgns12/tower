/**
 * 교실 와이파이 대응 서버 기능 검증:
 * 1) GET /v1/health 무인증·무쿼리 상태 확인
 * 2) GET /v1/schools 24시간 엣지 캐시 히트 시 D1 쓰기 0건 및 초등학교 우선 정렬
 * 3) POST /v1/runs/submit · GET /v1/leaderboard 학교 코드·이름 분리 집계 및 rebuild-standings.sql 일치
 */
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { exec, memoryCache, MINUTE, newStats, startServer, submitBody, type Device, type TestServer } from '../support/harness';

let t: TestServer;
let garakStudent: Device;
let busanStudent: Device;

beforeAll(async () => {
  t = await startServer();
  garakStudent = await t.newDevice('203.0.113.10');
  busanStudent = await t.newDevice('203.0.113.10'); // 같은 학교 공유기 공인 IP도 정상 허용
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => t.close());

async function playSchoolRun(device: Device, overrides: Record<string, unknown>) {
  const runId = crypto.randomUUID();
  const started = await t.call('/v1/runs/start', { token: device.token, body: { p_run_id: runId } });
  expect(started.status).toBe(200);
  await exec(t.db, 'UPDATE run_start_dedup SET started_at = ?1 WHERE run_id = ?2', Date.now() - 2 * MINUTE, runId);
  await exec(t.db, "DELETE FROM rate_limits WHERE action IN ('start', 'submit')");
  const submitted = await t.call('/v1/runs/submit', {
    token: device.token,
    body: submitBody(runId, { p_ended_at: new Date().toISOString(), ...overrides }),
  });
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
  return runId;
}

describe('상태 점검(/v1/health) 및 학교 검색 캐시 프록시(/v1/schools)', () => {
  it('GET /v1/health는 인증·D1 접근 없이 200 { ok: true }를 반환한다', async () => {
    const stats = newStats();
    const r = await t.direct('/v1/health', { now: Date.now(), stats });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(stats.rowsRead).toBe(0);
    expect(stats.rowsWritten).toBe(0);
  });

  it('GET /v1/schools는 초등학교를 먼저 정렬해 24시간 캐시하며, 캐시 적중 시 D1 쓰기가 0건이다', async () => {
    const cache = memoryCache();
    const now = Date.now();

    // 2자 미만 검색어는 외부 호출·D1 쓰기 없이 빈 배열 반환
    const shortStats = newStats();
    const shortRes = await t.direct('/v1/schools?q=서', { now, cache, stats: shortStats });
    expect(shortRes.status).toBe(200);
    expect(shortRes.body).toEqual({ schools: [] });
    expect(shortStats.rowsWritten).toBe(0);

    const upstreamSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schoolInfo: [
            { head: [{ list_total_count: 2 }] },
            {
              row: [
                {
                  SD_SCHUL_CODE: '7010999',
                  SCHUL_NM: '가락고등학교',
                  ATPT_OFCDC_SC_CODE: 'B10',
                  ATPT_OFCDC_SC_NM: '서울특별시교육청',
                  LCTN_SC_NM: '서울특별시',
                  SCHUL_KND_SC_NM: '고등학교',
                  ORG_RDNMA: '서울특별시 송파구',
                },
                {
                  SD_SCHUL_CODE: '7010057',
                  SCHUL_NM: '서울가락초등학교',
                  ATPT_OFCDC_SC_CODE: 'B10',
                  ATPT_OFCDC_SC_NM: '서울특별시교육청',
                  LCTN_SC_NM: '서울특별시',
                  SCHUL_KND_SC_NM: '초등학교',
                  ORG_RDNMA: '서울특별시 송파구 송이로 42',
                },
                // 중복 학교코드는 제거되어야 한다
                {
                  SD_SCHUL_CODE: '7010057',
                  SCHUL_NM: '서울가락초등학교',
                  ATPT_OFCDC_SC_CODE: 'B10',
                  ATPT_OFCDC_SC_NM: '서울특별시교육청',
                  LCTN_SC_NM: '서울특별시',
                  SCHUL_KND_SC_NM: '초등학교',
                  ORG_RDNMA: '서울특별시 송파구 송이로 42',
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const missStats = newStats();
    const first = await t.direct('/v1/schools?q=%EA%B0%80%EB%9D%BD', { now, cache, stats: missStats });
    expect(first.status).toBe(200);
    const schools = first.body.schools as Array<{ schoolCode: string; schoolName: string }>;
    expect(schools.map(s => s.schoolName)).toEqual(['서울가락초등학교', '가락고등학교']);
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
    expect(missStats.rowsWritten).toBe(1);

    // 같은 학교 다른 학생의 동일 검색어 조회: 캐시 적중으로 외부 호출 0건 · D1 쓰기 0건
    const hitStats = newStats();
    const second = await t.direct('/v1/schools?q=%EA%B0%80%EB%9D%BD', { now: now + 1000, cache, stats: hitStats });
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
    expect(hitStats.rowsRead).toBe(0);
    expect(hitStats.rowsWritten).toBe(0);
  });
});

describe('학교별 랭킹 필터 및 standings 재구축 정합성', () => {
  it('전체 랭킹과 학교 필터(p_school_code·p_school_name)가 각각 정확한 순위를 반환하고 rebuild-standings 뒤에도 일치한다', async () => {
    await playSchoolRun(garakStudent, {
      p_nickname: '가락다람쥐',
      p_pt: 55,
      p_school_code: '7010057',
      p_school_name: '서울가락초등학교',
    });
    await playSchoolRun(busanStudent, {
      p_nickname: '해운대솔방울',
      p_pt: 67,
      p_school_code: '7150111',
      p_school_name: '부산해운대초등학교',
    });

    const allRes = await t.call(
      '/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0',
      { token: garakStudent.token },
    );
    expect(allRes.status).toBe(200);
    expect(allRes.body.totalCount).toBe(2);
    expect((allRes.body.entries as Array<{ nickname: string; schoolName?: string }>).map(e => [e.nickname, e.schoolName])).toEqual([
      ['해운대솔방울', '부산해운대초등학교'],
      ['가락다람쥐', '서울가락초등학교'],
    ]);
    expect((allRes.body.myEntry as { rank: number; schoolName?: string }).rank).toBe(2);

    // 우리 학교(코드 기준) 필터 시 가락다람쥐가 1위(총 1명)가 된다
    const garakByCode = await t.call(
      '/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0&p_school_code=7010057&p_school_name=%EC%84%9C%EC%9A%B8%EA%B0%80%EB%9D%BD%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90',
      { token: garakStudent.token },
    );
    expect(garakByCode.status).toBe(200);
    expect(garakByCode.body.totalCount).toBe(1);
    expect((garakByCode.body.myEntry as { rank: number; nickname: string })).toMatchObject({
      rank: 1,
      nickname: '가락다람쥐',
    });

    // rebuild-standings.sql 실행 후에도 동일한 결과가 유지된다
    const rebuildSql = await readFile(new URL('../../sql/rebuild-standings.sql', import.meta.url), 'utf8');
    const statements = rebuildSql
      .split(/;\s*\n/)
      .map(s => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
    await t.db.batch(statements.map(s => t.db.prepare(s)));

    await exec(t.db, 'DELETE FROM rate_limits');
    const garakAfterRebuild = await t.call(
      '/v1/leaderboard?p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time&p_limit=8&p_offset=0&p_school_code=7010057',
      { token: garakStudent.token },
    );
    expect(garakAfterRebuild.body).toEqual(garakByCode.body);
  });

  it('전학·직접 입력·학교 해제 후에도 명예점과 내 판 ID는 제출 당시 학교에 남는다', async () => {
    const device = await t.newDevice();
    const submit = (pt: number, code: string, name: string) =>
      playSchoolRun(device, { p_pt: pt, p_school_code: code, p_school_name: name });
    const a1 = await submit(50, '7010100', '가람초');
    const a2 = await submit(51, '7010100', '새가람초');
    const b = await submit(52, '7010200', '나루초');
    const cache = memoryCache();
    async function check(filter: Record<string, string>, points: number, ids: string[], period = 'all_time') {
      const query = new URLSearchParams({ p_tab: 'honor_points', p_grade: '3', p_difficulty: 'Normal', p_period: period, ...filter });
      const result = await t.direct('/v1/leaderboard?' + query, { token: device.token, now: Date.now(), cache });
      expect(result.status).toBe(200);
      expect(result.body.myEntry).toMatchObject({
        primaryValue: points, secondaryLabel: `완주 ${ids.length}판`, runIds: ids,
      });
    }
    await check({ p_school_code: '7010100' }, 143, [a1, a2]);
    await check({ p_school_code: '7010200' }, 73, [b]);
    await check({}, 216, [a1, a2, b]);
    const named = await submit(53, '', '  가람초 ');
    const cleared = await submit(54, '', '');

    // 이름만 조회하면 그 이름으로 제출했던 판을 모은다. 코드 조회는 이름 변경과 무관하다.
    await check({ p_school_name: '가람초' }, 145, [a1, named]);
    await check({ p_school_code: '7010100' }, 143, [a1, a2]); // 캐시 적중 시에도 같은 범위의 내 판만 반환
    await check({ p_school_code: '7010200' }, 73, [b], 'weekly');
    await check({}, 365, [a1, a2, b, named, cleared], 'weekly');
  });
});

/**
 * 랭킹 집계표가 Postgres get_leaderboard_slice와 같은 답을 내는지 대조한다.
 * 기준 구현(oracle)은 Postgres 질의(completed_runs 전체를 훑어 eligible → best/grouped → ranked)를 JS로 그대로 옮긴 것이다.
 * 같은 기록 집합에서 모든 분류·학년·난이도·기간·쪽 조합의 응답이 같아야 한다.
 */
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeHonorPoints, kstIsoWeekKey } from '../../../src/contracts/lobby';
import { deriveKeys, playerHash } from '../../src/crypto';
import { DAY, exec, rows, startServer, TEST_SALT, type Device, type TestServer } from '../support/harness';

const VERIFIED = 'question_regraded_combat_bounded';
const NOW = Date.parse('2026-11-04T03:00:00Z');

interface Run {
  run_id: string; player_hash: string; nickname: string; grade: number; difficulty: string; pt: number; honor_pt: number;
  completed_wave: number; correct: number; bank_version: string; balance_version: string; map_id: string;
  week_key: string; received_at: number; verification_level: string;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

let t: TestServer;
const devices: { device: Device; hash: string }[] = [];

function oracle(runs: Run[], active: Set<string>, q: { tab: string; grade: number; difficulty: string; period: string; limit: number; offset: number }, me: string) {
  const currentWeek = kstIsoWeekKey(new Date(NOW));
  const eligible = runs.filter(r => r.verification_level === VERIFIED && r.completed_wave >= 1
    && active.has(`${r.bank_version}|${r.grade}|${r.balance_version}|${r.map_id}`)
    && (q.grade === 0 || r.grade === q.grade) && (q.tab === 'honor_points' || r.difficulty === q.difficulty)
    && (q.period !== 'weekly' || r.week_key === currentWeek));
  type Item = { hash: string; nickname: string; grade: number; difficulty: string; val: number; secondary: number; correct: number; achieved: number; runIds: string[] };
  const items: Item[] = [];
  const byPlayer = new Map<string, Run[]>();
  for (const r of eligible) byPlayer.set(r.player_hash, [...(byPlayer.get(r.player_hash) ?? []), r]);
  for (const [hash, list] of byPlayer) {
    if (q.tab === 'honor_points') {
      const latest = [...list].sort((a, b) => b.received_at - a.received_at)[0]!;
      items.push({
        hash, nickname: latest.nickname, grade: Math.max(...list.map(r => r.grade)), difficulty: 'Normal',
        val: list.reduce((s, r) => s + r.honor_pt, 0), secondary: list.length, correct: 0,
        achieved: Math.max(...list.map(r => r.received_at)), runIds: [...list].sort((a, b) => a.received_at - b.received_at).map(r => r.run_id),
      });
    } else {
      const primary = (r: Run) => (q.tab === 'best_wave' ? r.completed_wave : r.pt);
      const secondary = (r: Run) => (q.tab === 'best_wave' ? r.pt : r.completed_wave);
      const best = [...list].sort((a, b) => primary(b) - primary(a) || secondary(b) - secondary(a) || b.correct - a.correct || a.received_at - b.received_at)[0]!;
      items.push({
        hash, nickname: best.nickname, grade: best.grade, difficulty: best.difficulty, val: primary(best), secondary: secondary(best),
        correct: best.correct, achieved: best.received_at, runIds: [best.run_id],
      });
    }
  }
  items.sort((a, b) => b.val - a.val || (q.tab === 'honor_points' ? a.secondary - b.secondary : b.secondary - a.secondary)
    || b.correct - a.correct || a.achieved - b.achieved || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  const label = (s: number) => (q.tab === 'honor_points' ? `완주 ${s}판` : q.tab === 'best_wave' ? `${s}점` : `${s}웨이브`);
  const entry = (item: Item, index: number) => ({
    rank: index + 1, playerIdHash: item.hash.slice(0, 16), isMe: item.hash === me, runIds: item.hash === me ? item.runIds : [],
    nickname: item.nickname, grade: item.grade, difficulty: item.difficulty, primaryValue: item.val, secondaryLabel: label(item.secondary),
    achievedAtIso: new Date(item.achieved).toISOString(),
  });
  const all = items.map(entry);
  return { entries: all.slice(q.offset, q.offset + q.limit), totalCount: all.length, myEntry: all.find(e => e.isMe) ?? null };
}

async function insertRandomRuns(count: number) {
  const random = mulberry32(20261105);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
  const fakeHashes = Array.from({ length: 10 }, (_, i) => (i.toString(16).repeat(64)).slice(0, 64));
  const players = [...devices.map(d => d.hash), ...fakeHashes];
  const weeks = [NOW, NOW - 7 * DAY, NOW - 14 * DAY].map(ms => kstIsoWeekKey(new Date(ms)));
  let received = NOW - 30 * DAY;
  const statements = [];
  for (let i = 0; i < count; i++) {
    const grade = pick([3, 3, 4]);
    const bank = grade === 4 ? 'test-bank-4' : pick(['test-bank', 'test-bank', 'test-bank', 'old-bank']);
    const difficulty = pick(['Normal', 'Normal', 'Hard']);
    const completedWave = pick([1, 1, 2, 3, 0]);
    const correct = Math.floor(random() * 4);
    const pt = pick([40, 60, 60, 75, 90, 120]);
    received += 1 + Math.floor(random() * 3_600_000);
    const verification = random() < 0.06 ? 'legacy_unverified' : VERIFIED;
    const honor = computeHonorPoints({ pt, difficulty, completedWave, correct });
    statements.push(t.db.prepare(
      `INSERT INTO completed_runs (run_id, player_hash, public_tag, nickname, grade, difficulty, pt, honor_pt, completed_wave, correct, wrong, skipped,
         content_mode, balance_version, bank_version, map_id, week_key, kst_date, local_ended_at, ended_at, received_at, verification_level, payload_hash)
       VALUES (?1, ?2, substr(?2, 1, 16), ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 0, 'published', 'test-balance', ?10, 'garden_u', ?11, '2026-11-01', ?12, ?12, ?12, ?13, 'x')`,
    ).bind(crypto.randomUUID(), pick(players), pick(['솔방울', '도토리', '은행잎', '다람쥐']), grade, difficulty, pt, honor, completedWave, correct,
      bank, pick(weeks), received, verification));
  }
  for (let i = 0; i < statements.length; i += 40) await t.db.batch(statements.slice(i, i + 40));
}

beforeAll(async () => {
  t = await startServer();
  const keys = await deriveKeys(TEST_SALT);
  for (let i = 0; i < 4; i++) {
    const device = await t.newDevice();
    devices.push({ device, hash: await playerHash(keys, device.deviceId) });
  }
  await exec(t.db, "INSERT INTO approved_run_conditions (bank_version, grade, balance_version, map_id, active) VALUES ('old-bank', 3, 'test-balance', 'garden_u', 0)");
  await insertRandomRuns(260);
}, 120_000);
afterAll(() => t.close());

async function compareAll() {
  const runs = (await rows(t.db, 'SELECT * FROM completed_runs')) as unknown as Run[];
  const active = new Set((await rows(t.db, 'SELECT * FROM approved_run_conditions WHERE active = 1'))
    .map(c => `${String(c.bank_version)}|${String(c.grade)}|${String(c.balance_version)}|${String(c.map_id)}`));
  let compared = 0;
  let nonEmpty = 0;
  let withMine = 0;
  // 기기 4대가 돌아가며 부르므로 기기당 분당 랭킹 한도(120) 안에 든다.
  await exec(t.db, 'DELETE FROM rate_limits');
  for (const tab of ['single_score', 'best_wave', 'honor_points']) {
    for (const grade of [0, 3, 4]) {
      for (const difficulty of ['Normal', 'Hard']) {
        for (const period of ['weekly', 'season1', 'all_time']) {
          for (const [limit, offset] of [[8, 0], [5, 3], [50, 0]] as const) {
            const { device, hash } = devices[compared % devices.length]!;
            const query = `p_tab=${tab}&p_grade=${grade}&p_difficulty=${difficulty}&p_period=${period}&p_limit=${limit}&p_offset=${offset}`;
            const response = await t.direct(`/v1/leaderboard?${query}`, { token: device.token, now: NOW });
            expect(response.status, query).toBe(200);
            expect(response.body, query).toEqual(oracle(runs, active, { tab, grade, difficulty, period, limit, offset }, hash));
            compared++;
            if ((response.body.entries as unknown[]).length > 0) nonEmpty++;
            if (response.body.myEntry) withMine++;
          }
        }
      }
    }
  }
  // 빈 결과끼리만 같아서 통과하는 일이 없게, 실제로 내용이 있는 비교가 충분한지도 본다.
  expect(nonEmpty).toBeGreaterThan(100);
  expect(withMine).toBeGreaterThan(50);
  return compared;
}

describe('랭킹 집계표 = Postgres 질의', () => {
  it('모든 분류·학년·난이도·기간·쪽 조합에서 기준 구현과 같다', async () => {
    expect(await compareAll()).toBe(162);
  }, 120_000);

  it('승인 조건이 바뀌어도(이전 은행 다시 켜기) 같다', async () => {
    await exec(t.db, "UPDATE approved_run_conditions SET active = 1 WHERE bank_version = 'old-bank'");
    await exec(t.db, "UPDATE approved_run_conditions SET active = 0 WHERE bank_version = 'test-bank-4'");
    expect(await compareAll()).toBe(162);
  }, 120_000);

  it('rebuild-standings.sql로 다시 만든 집계표가 트리거로 쌓은 집계표와 같다', async () => {
    const snapshot = () => rows(t.db, 'SELECT * FROM standings ORDER BY kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash');
    const before = await snapshot();
    expect(before.length).toBeGreaterThan(50);
    const text = await readFile(new URL('../../sql/rebuild-standings.sql', import.meta.url), 'utf8');
    const statements = text.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(3);
    await t.db.batch(statements.map(s => t.db.prepare(s)));
    expect(await snapshot()).toEqual(before);
  });
});

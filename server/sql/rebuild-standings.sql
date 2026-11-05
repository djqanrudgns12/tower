-- 랭킹 집계표(standings)를 completed_runs에서 다시 만든다.
-- 평소에는 쓸 일이 없다(트리거가 기록마다 고친다). 관리자가 completed_runs를 손으로 지우거나 고쳤을 때만 실행한다.
--   npx wrangler d1 execute DB --config server/wrangler.toml --file server/sql/rebuild-standings.sql (--local 또는 --remote)
-- 규칙은 server/migrations/0001_init.sql의 completed_runs_standings 트리거와 같다.
DELETE FROM standings;

WITH expanded AS (
  SELECT CASE w.weekly WHEN 0 THEN 'all' ELSE 'week:' || r.week_key END AS period, r.*
    FROM completed_runs r CROSS JOIN (SELECT 0 AS weekly UNION ALL SELECT 1) w
   WHERE r.verification_level = 'question_regraded_combat_bounded' AND r.completed_wave >= 1
), candidates AS (
  SELECT k.kind, e.period, e.grade, e.difficulty, e.bank_version, e.balance_version, e.map_id, e.player_hash, e.nickname,
         CASE k.kind WHEN 'single_score' THEN e.pt ELSE e.completed_wave END AS val,
         CASE k.kind WHEN 'single_score' THEN e.completed_wave ELSE e.pt END AS secondary,
         e.correct, e.received_at AS achieved_at, e.run_id
    FROM expanded e CROSS JOIN (SELECT 'single_score' AS kind UNION ALL SELECT 'best_wave') k
), ranked AS (
  SELECT *, row_number() OVER (
           PARTITION BY kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash
           ORDER BY val DESC, secondary DESC, correct DESC, achieved_at ASC) AS pick
    FROM candidates
)
INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
SELECT kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id
  FROM ranked WHERE pick = 1;

WITH expanded AS (
  SELECT CASE w.weekly WHEN 0 THEN 'all' ELSE 'week:' || r.week_key END AS period, r.*
    FROM completed_runs r CROSS JOIN (SELECT 0 AS weekly UNION ALL SELECT 1) w
   WHERE r.verification_level = 'question_regraded_combat_bounded' AND r.completed_wave >= 1
), grouped AS (
  SELECT period, grade, bank_version, balance_version, map_id, player_hash, nickname,
         row_number() OVER (PARTITION BY period, grade, bank_version, balance_version, map_id, player_hash ORDER BY received_at DESC) AS pick,
         sum(honor_pt) OVER (PARTITION BY period, grade, bank_version, balance_version, map_id, player_hash) AS val,
         count(*) OVER (PARTITION BY period, grade, bank_version, balance_version, map_id, player_hash) AS secondary,
         max(received_at) OVER (PARTITION BY period, grade, bank_version, balance_version, map_id, player_hash) AS achieved_at
    FROM expanded
)
INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
SELECT 'honor_points', period, grade, '*', bank_version, balance_version, map_id, player_hash, nickname, val, secondary, 0, achieved_at, NULL
  FROM grouped WHERE pick = 1;

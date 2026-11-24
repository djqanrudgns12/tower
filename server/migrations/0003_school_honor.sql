-- 원본 completed_runs는 그대로 두고 파생 집계표의 기본 키만 교체한다.
DROP TRIGGER completed_runs_standings;
ALTER TABLE standings RENAME TO standings_before_0003;

CREATE TABLE standings (
  kind TEXT NOT NULL CHECK (kind IN ('single_score', 'best_wave', 'honor_points')),
  period TEXT NOT NULL,
  grade INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  bank_version TEXT NOT NULL,
  balance_version TEXT NOT NULL,
  map_id TEXT NOT NULL,
  player_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  val INTEGER NOT NULL,
  secondary INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  run_id TEXT,
  school_code TEXT NOT NULL DEFAULT '',
  school_name TEXT NOT NULL DEFAULT '',
  -- 최고 판은 기존처럼 기기당 한 행이다. 명예점은 제출 당시의 코드와 이름을 함께 보존해
  -- 코드 필터는 개명 전후를 합치고, 이름만 지정하면 당시 그 이름이던 판만 합친다.
  school_bucket TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, school_bucket)
) STRICT, WITHOUT ROWID;

INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash,
                       nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
SELECT kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash,
       nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name
  FROM standings_before_0003 WHERE kind <> 'honor_points';
DROP TABLE standings_before_0003;

-- 마이그레이션과 관리용 재구축이 같은 원본과 그룹 기준을 사용한다.
CREATE VIEW honor_standings_from_runs AS
WITH expanded AS (
  SELECT CASE w.weekly WHEN 0 THEN 'all' ELSE 'week:' || r.week_key END AS period, r.*
    FROM completed_runs r CROSS JOIN (SELECT 0 AS weekly UNION ALL SELECT 1) w
   WHERE r.verification_level = 'question_regraded_combat_bounded' AND r.completed_wave >= 1
), grouped AS (
  SELECT *, row_number() OVER (bucket ORDER BY received_at DESC, run_id DESC) AS pick,
         sum(honor_pt) OVER bucket AS val, count(*) OVER bucket AS secondary
    FROM expanded
  WINDOW bucket AS (PARTITION BY period, grade, bank_version, balance_version, map_id, player_hash, school_code, school_name)
)
SELECT 'honor_points' AS kind, period, grade, '*' AS difficulty, bank_version, balance_version, map_id, player_hash,
       nickname, val, secondary, 0 AS correct, received_at AS achieved_at, run_id, school_code, school_name,
       json_array(school_code, school_name) AS school_bucket
  FROM grouped WHERE pick = 1;

INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash,
                       nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name, school_bucket)
SELECT * FROM honor_standings_from_runs;

CREATE TRIGGER completed_runs_standings AFTER INSERT ON completed_runs
WHEN NEW.verification_level = 'question_regraded_combat_bounded' AND NEW.completed_wave >= 1
BEGIN
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash,
                         nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
  SELECT k.kind, p.period, NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash,
         NEW.nickname, CASE k.kind WHEN 'single_score' THEN NEW.pt ELSE NEW.completed_wave END,
         CASE k.kind WHEN 'single_score' THEN NEW.completed_wave ELSE NEW.pt END,
         NEW.correct, NEW.received_at, NEW.run_id, NEW.school_code, NEW.school_name
    FROM (SELECT 'single_score' AS kind UNION ALL SELECT 'best_wave') k
   CROSS JOIN (SELECT 'all' AS period UNION ALL SELECT 'week:' || NEW.week_key) p
   WHERE true
  ON CONFLICT DO UPDATE SET
    nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct,
    achieved_at = excluded.achieved_at, run_id = excluded.run_id, school_code = excluded.school_code, school_name = excluded.school_name
  WHERE (excluded.val, excluded.secondary, excluded.correct) > (standings.val, standings.secondary, standings.correct)
     OR ((excluded.val, excluded.secondary, excluded.correct) = (standings.val, standings.secondary, standings.correct)
         AND excluded.achieved_at < standings.achieved_at);

  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash,
                         nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name, school_bucket)
  SELECT 'honor_points', p.period, NEW.grade, '*', NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash,
         NEW.nickname, NEW.honor_pt, 1, 0, NEW.received_at, NEW.run_id, NEW.school_code, NEW.school_name,
         json_array(NEW.school_code, NEW.school_name)
    FROM (SELECT 'all' AS period UNION ALL SELECT 'week:' || NEW.week_key) p
   WHERE true
  ON CONFLICT DO UPDATE SET
    val = standings.val + excluded.val, secondary = standings.secondary + 1,
    nickname = CASE WHEN (excluded.achieved_at, excluded.run_id) > (standings.achieved_at, standings.run_id)
                    THEN excluded.nickname ELSE standings.nickname END,
    run_id = CASE WHEN (excluded.achieved_at, excluded.run_id) > (standings.achieved_at, standings.run_id)
                  THEN excluded.run_id ELSE standings.run_id END,
    achieved_at = max(standings.achieved_at, excluded.achieved_at);
END;

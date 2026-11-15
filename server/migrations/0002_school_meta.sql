-- 학교 소속 선택 기록(school_code, school_name)을 완주 기록과 랭킹 집계표에 추가한다.
-- 보조 색인은 두지 않아 제출 시 D1 쓰기 행 수(최대 10행)가 늘지 않는다.
ALTER TABLE completed_runs ADD COLUMN school_code TEXT NOT NULL DEFAULT '';
ALTER TABLE completed_runs ADD COLUMN school_name TEXT NOT NULL DEFAULT '';
ALTER TABLE standings ADD COLUMN school_code TEXT NOT NULL DEFAULT '';
ALTER TABLE standings ADD COLUMN school_name TEXT NOT NULL DEFAULT '';

DROP TRIGGER completed_runs_standings;

CREATE TRIGGER completed_runs_standings AFTER INSERT ON completed_runs
WHEN NEW.verification_level = 'question_regraded_combat_bounded' AND NEW.completed_wave >= 1
BEGIN
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
    VALUES ('single_score', 'all', NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.pt, NEW.completed_wave, NEW.correct, NEW.received_at, NEW.run_id, NEW.school_code, NEW.school_name)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct,
      achieved_at = excluded.achieved_at, run_id = excluded.run_id, school_code = excluded.school_code, school_name = excluded.school_name
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
    VALUES ('single_score', 'week:' || NEW.week_key, NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.pt, NEW.completed_wave, NEW.correct, NEW.received_at, NEW.run_id, NEW.school_code, NEW.school_name)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct,
      achieved_at = excluded.achieved_at, run_id = excluded.run_id, school_code = excluded.school_code, school_name = excluded.school_name
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
    VALUES ('best_wave', 'all', NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.completed_wave, NEW.pt, NEW.correct, NEW.received_at, NEW.run_id, NEW.school_code, NEW.school_name)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct,
      achieved_at = excluded.achieved_at, run_id = excluded.run_id, school_code = excluded.school_code, school_name = excluded.school_name
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
    VALUES ('best_wave', 'week:' || NEW.week_key, NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.completed_wave, NEW.pt, NEW.correct, NEW.received_at, NEW.run_id, NEW.school_code, NEW.school_name)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct,
      achieved_at = excluded.achieved_at, run_id = excluded.run_id, school_code = excluded.school_code, school_name = excluded.school_name
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
    VALUES ('honor_points', 'all', NEW.grade, '*', NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.honor_pt, 1, 0, NEW.received_at, NULL, NEW.school_code, NEW.school_name)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      val = standings.val + excluded.val, secondary = standings.secondary + 1,
      nickname = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.nickname ELSE standings.nickname END,
      school_code = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.school_code ELSE standings.school_code END,
      school_name = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.school_name ELSE standings.school_name END,
      achieved_at = max(standings.achieved_at, excluded.achieved_at);
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id, school_code, school_name)
    VALUES ('honor_points', 'week:' || NEW.week_key, NEW.grade, '*', NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.honor_pt, 1, 0, NEW.received_at, NULL, NEW.school_code, NEW.school_name)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      val = standings.val + excluded.val, secondary = standings.secondary + 1,
      nickname = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.nickname ELSE standings.nickname END,
      school_code = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.school_code ELSE standings.school_code END,
      school_name = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.school_name ELSE standings.school_name END,
      achieved_at = max(standings.achieved_at, excluded.achieved_at);
END;

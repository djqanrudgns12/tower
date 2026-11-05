-- 어휘력 타워 디펜스 기록·랭킹 서버(Cloudflare D1, SQLite) 표 정의.
-- 기준: supabase/migrations/*.sql 4개(Postgres)를 같은 의미로 옮겼다.
-- 시각은 모두 UTC 기준 epoch 밀리초 정수, 한국 날짜(kst_date)는 'YYYY-MM-DD', 주차(week_key)는 'YYYY-Www'다.
-- 쓰기 행 수를 줄이려고 기본 키가 곧 표인 WITHOUT ROWID를 쓰고, 보조 색인은 조회에 꼭 필요한 것만 둔다.
-- Postgres의 leaderboard_best·leaderboard_honor는 두 번째 마이그레이션부터 아무도 읽거나 쓰지 않아 옮기지 않았다.

-- 누적 지표(행 하나).
CREATE TABLE global_metrics (
  row_id INTEGER PRIMARY KEY CHECK (row_id = 1),
  total_visitors INTEGER NOT NULL DEFAULT 0 CHECK (total_visitors >= 0),
  total_plays INTEGER NOT NULL DEFAULT 0 CHECK (total_plays >= 0),
  updated_at INTEGER NOT NULL
) STRICT;
INSERT INTO global_metrics (row_id, updated_at) VALUES (1, unixepoch() * 1000);

-- 한국 날짜별 방문 기기 수·판 수.
CREATE TABLE daily_metrics (
  kst_date TEXT PRIMARY KEY,
  unique_visitors INTEGER NOT NULL DEFAULT 0 CHECK (unique_visitors >= 0),
  plays INTEGER NOT NULL DEFAULT 0 CHECK (plays >= 0),
  updated_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

-- 오늘 처음 온 기기인지 가리는 표. 7일 뒤 지운다(scheduled 정리).
CREATE TABLE daily_visitor_hashes (
  kst_date TEXT NOT NULL,
  visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (kst_date, visitor_hash)
) STRICT, WITHOUT ROWID;

-- 처음 들어간 행에서만 방문 수를 올린다(Postgres의 "inserted > 0이면 +1"과 같은 뜻).
CREATE TRIGGER daily_visitor_hashes_counted AFTER INSERT ON daily_visitor_hashes
BEGIN
  INSERT INTO daily_metrics (kst_date, unique_visitors, plays, updated_at) VALUES (NEW.kst_date, 1, 0, NEW.created_at)
    ON CONFLICT (kst_date) DO UPDATE SET unique_visitors = daily_metrics.unique_visitors + 1, updated_at = excluded.updated_at;
  UPDATE global_metrics SET total_visitors = total_visitors + 1, updated_at = NEW.created_at WHERE row_id = 1;
END;

-- 최근 5분 안에 홈을 연 기기 수(실시간 접속 웹소켓 대체). 하루 지난 행은 지운다.
CREATE TABLE lobby_presence (
  visitor_hash TEXT PRIMARY KEY CHECK (length(visitor_hash) = 64),
  seen_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
CREATE INDEX lobby_presence_seen ON lobby_presence (seen_at);

-- 판 시작 기록. 제출 때 시작 시각·소유자를 확인한다. 7일 뒤 지운다.
CREATE TABLE run_start_dedup (
  run_id TEXT PRIMARY KEY,
  player_hash TEXT NOT NULL CHECK (length(player_hash) = 64),
  kst_date TEXT NOT NULL,
  started_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
CREATE INDEX run_start_dedup_rate ON run_start_dedup (player_hash, started_at);

CREATE TRIGGER run_start_dedup_counted AFTER INSERT ON run_start_dedup
BEGIN
  INSERT INTO daily_metrics (kst_date, unique_visitors, plays, updated_at) VALUES (NEW.kst_date, 0, 1, NEW.started_at)
    ON CONFLICT (kst_date) DO UPDATE SET plays = daily_metrics.plays + 1, updated_at = excluded.updated_at;
  UPDATE global_metrics SET total_plays = total_plays + 1, updated_at = NEW.started_at WHERE row_id = 1;
END;

-- 공개 은행 정답 키·검증 규칙·승인 조건(server/seed/question_keys.sql로 채운다).
CREATE TABLE question_keys (
  bank_version TEXT NOT NULL,
  question_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 3 AND 6),
  PRIMARY KEY (bank_version, question_id, revision)
) STRICT, WITHOUT ROWID;

CREATE TABLE run_verification_rules (
  balance_version TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  rules TEXT NOT NULL CHECK (json_valid(rules)),
  PRIMARY KEY (balance_version, difficulty)
) STRICT, WITHOUT ROWID;

CREATE TABLE approved_run_conditions (
  bank_version TEXT NOT NULL,
  grade INTEGER NOT NULL,
  balance_version TEXT NOT NULL,
  map_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  PRIMARY KEY (bank_version, grade, balance_version, map_id)
) STRICT, WITHOUT ROWID;

-- 재채점을 통과한 완주 기록. 서버가 받은 시각(received_at)과 7일로 묶은 종료 시각(ended_at),
-- 기기가 보낸 종료 시각 원본(local_ended_at)을 따로 둔다.
CREATE TABLE completed_runs (
  run_id TEXT PRIMARY KEY,
  player_hash TEXT NOT NULL CHECK (length(player_hash) = 64),
  public_tag TEXT NOT NULL CHECK (length(public_tag) = 16),
  nickname TEXT NOT NULL CHECK (length(CAST(nickname AS BLOB)) <= 4096),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 3 AND 6),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Normal', 'Hard', 'Crazy')),
  pt INTEGER NOT NULL,
  honor_pt INTEGER NOT NULL CHECK (honor_pt BETWEEN 0 AND 5000),
  completed_wave INTEGER NOT NULL,
  correct INTEGER NOT NULL CHECK (correct >= 0),
  wrong INTEGER NOT NULL CHECK (wrong >= 0),
  skipped INTEGER NOT NULL CHECK (skipped >= 0),
  content_mode TEXT NOT NULL CHECK (content_mode IN ('published', 'development')),
  balance_version TEXT NOT NULL,
  bank_version TEXT NOT NULL,
  map_id TEXT NOT NULL,
  season_id TEXT NOT NULL DEFAULT 'season1',
  week_key TEXT NOT NULL,
  kst_date TEXT NOT NULL,
  local_ended_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  verification_level TEXT NOT NULL DEFAULT 'legacy_unverified',
  payload_hash TEXT NOT NULL
) STRICT, WITHOUT ROWID;
CREATE INDEX completed_runs_owner_received ON completed_runs (player_hash, received_at);

-- 랭킹 집계표. Postgres는 랭킹을 부를 때마다 completed_runs 전체를 훑었지만, D1 무료 읽기 한도(하루 500만 행)
-- 안에 들도록 (분류, 기간, 학년, 난이도, 승인 조건, 기기)마다 한 행으로 미리 모은다. 랭킹 조회는 이 표만 읽고,
-- 승인 조건(active)은 조회 때 거르므로 은행이 바뀌어도 다시 계산할 필요가 없다.
--   kind: single_score(최고 점수 판), best_wave(최고 웨이브 판), honor_points(명예점 합)
--   period: 'all'(season1·all_time 공용) 또는 'week:YYYY-Www'(판의 week_key)
--   difficulty: 명예점은 난이도를 가리지 않으므로 '*'
--   val·secondary·correct: single_score는 pt·completed_wave·correct, best_wave는 completed_wave·pt·correct,
--                          honor_points는 명예점 합·판 수·0
--   achieved_at: 최고 판을 받은 시각, 명예점은 마지막으로 받은 시각
--   nickname: 최고 판의 별명, 명예점은 마지막 판의 별명
-- 손으로 completed_runs를 고치거나 지웠으면 server/sql/rebuild-standings.sql로 다시 만든다.
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
  PRIMARY KEY (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash)
) STRICT, WITHOUT ROWID;

-- 새 완주 기록을 집계표에 반영한다. 최고 판은 (값, 보조값, 정답 수가 크고, 받은 시각이 이른) 순서로 더 나을 때만 바꾼다.
CREATE TRIGGER completed_runs_standings AFTER INSERT ON completed_runs
WHEN NEW.verification_level = 'question_regraded_combat_bounded' AND NEW.completed_wave >= 1
BEGIN
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
    VALUES ('single_score', 'all', NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.pt, NEW.completed_wave, NEW.correct, NEW.received_at, NEW.run_id)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct, achieved_at = excluded.achieved_at, run_id = excluded.run_id
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
    VALUES ('single_score', 'week:' || NEW.week_key, NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.pt, NEW.completed_wave, NEW.correct, NEW.received_at, NEW.run_id)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct, achieved_at = excluded.achieved_at, run_id = excluded.run_id
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
    VALUES ('best_wave', 'all', NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.completed_wave, NEW.pt, NEW.correct, NEW.received_at, NEW.run_id)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct, achieved_at = excluded.achieved_at, run_id = excluded.run_id
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
    VALUES ('best_wave', 'week:' || NEW.week_key, NEW.grade, NEW.difficulty, NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.completed_wave, NEW.pt, NEW.correct, NEW.received_at, NEW.run_id)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      nickname = excluded.nickname, val = excluded.val, secondary = excluded.secondary, correct = excluded.correct, achieved_at = excluded.achieved_at, run_id = excluded.run_id
    WHERE excluded.val > standings.val
       OR (excluded.val = standings.val AND (excluded.secondary > standings.secondary
       OR (excluded.secondary = standings.secondary AND (excluded.correct > standings.correct
       OR (excluded.correct = standings.correct AND excluded.achieved_at < standings.achieved_at)))));
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
    VALUES ('honor_points', 'all', NEW.grade, '*', NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.honor_pt, 1, 0, NEW.received_at, NULL)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      val = standings.val + excluded.val, secondary = standings.secondary + 1,
      nickname = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.nickname ELSE standings.nickname END,
      achieved_at = max(standings.achieved_at, excluded.achieved_at);
  INSERT INTO standings (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash, nickname, val, secondary, correct, achieved_at, run_id)
    VALUES ('honor_points', 'week:' || NEW.week_key, NEW.grade, '*', NEW.bank_version, NEW.balance_version, NEW.map_id, NEW.player_hash, NEW.nickname, NEW.honor_pt, 1, 0, NEW.received_at, NULL)
    ON CONFLICT (kind, period, grade, difficulty, bank_version, balance_version, map_id, player_hash) DO UPDATE SET
      val = standings.val + excluded.val, secondary = standings.secondary + 1,
      nickname = CASE WHEN excluded.achieved_at >= standings.achieved_at THEN excluded.nickname ELSE standings.nickname END,
      achieved_at = max(standings.achieved_at, excluded.achieved_at);
END;

-- 기기·IP별 속도 제한(분 단위는 UTC 분, 일 단위는 한국 날짜). Postgres rpc_rate_buckets의 두 행을 한 행으로 합쳤다.
-- 한도를 넘는 증가는 CHECK가 막아 batch 전체가 되돌아간다(거부된 호출은 세지 않는다는 Postgres allow_lobby_rpc와 같다).
CREATE TABLE rate_limits (
  subject TEXT NOT NULL,
  action TEXT NOT NULL,
  minute_key TEXT NOT NULL,
  minute_calls INTEGER NOT NULL,
  minute_limit INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  day_calls INTEGER NOT NULL,
  day_limit INTEGER NOT NULL,
  PRIMARY KEY (subject, action),
  CONSTRAINT rate_limited CHECK (minute_calls <= minute_limit AND day_calls <= day_limit)
) STRICT, WITHOUT ROWID;

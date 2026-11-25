-- 은행·지도 조합의 승인과 별도로 시즌 제출을 닫아도 과거 순위는 계속 조회한다.
CREATE TABLE ranking_seasons (
  balance_version TEXT PRIMARY KEY,
  season_id TEXT NOT NULL UNIQUE,
  submissions_open INTEGER NOT NULL DEFAULT 1 CHECK (submissions_open IN (0, 1))
) STRICT, WITHOUT ROWID;

INSERT INTO ranking_seasons (balance_version, season_id) VALUES ('1.0.0', 'season1'), ('2.0.0', 'season2');

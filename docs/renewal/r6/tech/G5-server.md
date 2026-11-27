# G5 랭킹 시즌 2 운영 반영

총괄은 G5 통합 시험과 실기기 확인을 마친 뒤 사용자 승인을 받아 실행한다. 아래 시간은 운영 실측 전 예상치다. 수업이 끝난 뒤 최소 30분을 확보하고, GitHub Actions 대기 시간은 별도로 잡는다. 기존 시즌 1의 판은 원래 학년별 맵으로 계속 제출할 수 있다. 시즌 2는 네 학년 모두 `garden_u`를 쓴다.

## 1. 이용 상황과 복구 지점 기록 · 약 5분

승인한 릴리스 SHA의 저장소 루트에서 실행한다. `R6_SHA`에는 승인한 전체 SHA를 넣는다. 진행 중인 수업이 있거나 아래 수치가 남아 있으면 시간을 옮긴다. 최근 홈 방문 기기와 최근 한 시간 안에 시작해 아직 제출되지 않은 판은 접속의 대리 지표다. 오프라인 수업과 한 시간 이상 진행 중인 판은 놓칠 수 있으므로 담당 교사의 수업 일정도 확인한다.

```sh
test "$(git rev-parse HEAD)" = "$R6_SHA"
cfg=server/wrangler.toml
d1() { npx wrangler d1 execute DB --remote --config "$cfg" --command "$1"; }
d1 "SELECT (SELECT count(*) FROM lobby_presence WHERE seen_at >= (unixepoch()-300)*1000) AS recent_home_devices, (SELECT count(*) FROM run_start_dedup s WHERE s.started_at >= (unixepoch()-3600)*1000 AND NOT EXISTS (SELECT 1 FROM completed_runs c WHERE c.run_id=s.run_id)) AS recent_unfinished_runs"
npx wrangler d1 time-travel info vocabulary-td --config "$cfg"
npx wrangler deployments list --config "$cfg"
gh run list --workflow pages.yml --branch main --status success --limit 5 --json databaseId,headSha,createdAt
npx wrangler d1 migrations list DB --remote --config "$cfg"
d1 "SELECT bank_version,grade,balance_version,map_id FROM approved_run_conditions WHERE active=1 ORDER BY balance_version,grade"
d1 "SELECT balance_version, count(*) AS runs FROM completed_runs GROUP BY balance_version"
```

현재 D1 북마크와 시각, Worker 버전 ID, 실제 서비스 중인 Pages 실행 ID와 SHA, 승인 조합과 판 수를 배포 기록에 남긴다. 아래 최초 전환은 1.0.0 승인 4개, 2.0.0 승인·기록 0개를 기준으로 한다. 이미 새 시즌을 열었거나 예상 밖 마이그레이션이 대기 중이면 해당 지점부터 상태를 대조한다.

## 2. 학교별 집계와 시즌 표 적용 · 약 1~5분

```sh
npm run server:db:remote
npx wrangler d1 migrations list DB --remote --config "$cfg"
d1 "SELECT balance_version,season_id,submissions_open FROM ranking_seasons ORDER BY balance_version"
```

`0003_school_honor.sql`이 학교별 명예점 집계를 다시 만들고 `0004_ranking_seasons.sql`이 판과 시즌을 연결한다. 대기 목록이 비고 시즌당 한 행이 있어야 한다. 시드 직전까지는 기존 Worker가 요청을 받는다.

## 3. 정답 키와 시즌 2 규칙 등록 · 약 1~3분

첫 반영 때만 아래처럼 2.0.0 승인 조합을 등록한 뒤 같은 D1 파일 가져오기 안에서 닫아 둔다. 기존 Worker가 새 판을 시즌 1로 접수하는 시간대를 없앤다. 세션을 중단했다가 이어갈 때는 1절의 판 수와 활성 조합을 다시 확인한다.

```sh
(
  set -e
  stage_sql=$(mktemp)
  trap 'rm -f "$stage_sql"' EXIT
  cat server/seed/question_keys.sql > "$stage_sql"
  echo "UPDATE approved_run_conditions SET active=0 WHERE balance_version='2.0.0';" >> "$stage_sql"
  npx wrangler d1 execute DB --remote --config "$cfg" --file "$stage_sql"
)
d1 "SELECT balance_version, grade, map_id, active FROM approved_run_conditions WHERE balance_version='2.0.0' ORDER BY grade"
d1 "SELECT balance_version, difficulty FROM run_verification_rules ORDER BY balance_version,difficulty"
```

3~6학년의 `garden_u` 4개가 비활성이고 두 판에 네 난이도씩 있어야 한다. 같은 판 번호의 기존 규칙과 생성 규칙이 다르면 시드가 실패한다. 이 경우 기존 규칙과 승인한 계약을 대조한 뒤 진행한다.

## 4. Worker 배포와 승인 조합 열기 · 약 1~3분

```sh
npm run server:deploy
curl -fsS https://voca-api.ssamuniverse.com/v1/health
npm run server:seed:remote
d1 "SELECT balance_version,grade,bank_version,map_id FROM approved_run_conditions WHERE active=1 ORDER BY balance_version,grade"
d1 "SELECT balance_version,season_id,submissions_open FROM ranking_seasons ORDER BY balance_version"
```

배포 출력의 Worker 버전 ID를 남긴다. 상태 응답은 Worker 확인이며 뒤의 SQL이 실제 D1 상태를 확인한다. 승인 행은 시즌별 4개, 제출 상태는 둘 다 1이어야 한다. 운영 중 승인 은행 변경은 일반 시드 명령을 쓴다. 캐시 경로에 시즌이 들어가며 새 Worker는 이전 캐시를 읽지 않는다.

## 5. Pages 배포와 확인 · 약 5~15분 + CI 대기

사용자 승인 뒤 총괄이 원격 `main`을 갱신한다. 아래 명령은 검증한 SHA로 빠른 전진이 가능할 때만 사용한다. 공유 이력이 갈라져 있으면 릴리스 PR에서 합칠 결과를 먼저 검증한다.

```sh
git fetch origin main
git merge-base --is-ancestor origin/main "$R6_SHA" && git push origin "$R6_SHA:refs/heads/main"
gh run list --workflow pages.yml --branch main --commit "$R6_SHA" --json databaseId,headSha,status,conclusion
gh run watch "$PAGES_RUN_ID" --exit-status
```

`PAGES_RUN_ID`는 앞 명령이 표시한 해당 SHA의 실행 ID다. 검사·빌드·배포 성공 후 학생 화면에서 새 게임 한 판을 정상 종료해 시즌 2의 점수·웨이브·학교 필터와 내 기록을 확인한다. 같은 기록이 시즌 1에 보이면 전환을 중단한다. 과거 시즌의 알려진 기록 한 건도 대조한다. `weekly`와 `all_time`은 시즌 2, `season1`과 `season2`는 각각 지정한 시즌이다. 오프라인 기기 집계에는 현재 시즌 필터가 없으므로 이 확인은 서버 연결 상태에서 한다.

완료 요청에 전투 시드·개체 목록·타워 레벨은 들어 있지 않다. Worker는 답안을 재채점하고 웨이브 관계, 준비 문항 수, 활동 틱·서버 경과 시간과 점수 상한을 검사한다. 혼합기의 고정 시드 재현은 로컬 시험에서 확인한다.

## 되돌리기

- **화면 문제**. GitHub Actions에서 기록해 둔 이전 Pages 실행의 승인 SHA를 확인하고 `gh run rerun "$OLD_PAGES_RUN_ID"`, `gh run watch "$OLD_PAGES_RUN_ID" --exit-status`로 이전 게임을 다시 배포한다. 실행 보존 기간이 지났다면 `main`에서 해당 릴리스 변경만 되돌리는 PR을 검증·병합해 Pages 워크플로를 실행한다. 이전 실행을 다시 배포한 경우에도 다음 `main` 배포 전에는 수정 또는 되돌림 커밋을 반영한다. 시즌 인식 Worker는 유지하여 이미 접수된 두 시즌 기록을 보존한다. 예전 화면의 누적·주간도 새 Worker의 현재 시즌을 조회한다.
- **시즌 2 신규 제출을 일시 중지할 때**. `d1 "UPDATE ranking_seasons SET submissions_open=0 WHERE balance_version='2.0.0'"`를 실행한다. 신규 제출은 503으로 재시도되고, 기존 제출의 동일한 재전송과 시즌별 조회는 계속된다. 복구 후 같은 조건에서 1로 되돌린다.
- **Worker 자체를 되돌려야 할 때**. 이전 Pages 복구 후 2.0.0의 활성 조합을 기록하고 `d1 "UPDATE approved_run_conditions SET active=0 WHERE balance_version='2.0.0'"`로 닫은 뒤 `npx wrangler rollback "$OLD_WORKER_VERSION_ID" --config "$cfg"`를 실행한다. 이전 Worker는 시즌 표를 읽지 않는다. 이 동안 2.0.0 기록은 보관되고 공개 순위에서 빠지며, 이전 Worker는 늦은 2.0.0 제출을 영구 거절할 수 있다. 가능하면 시즌 인식 Worker에서 수정한다. 재개는 4절부터 진행한다. [Worker 버전 되돌리기](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- **데이터 손상 시에만**. 현재 북마크와 반영 후 접수 건수를 먼저 기록한다. 북마크 이후의 정상 기록도 되감기므로 서비스 쓰기를 멈추고 별도 복원 승인을 받은 뒤 `npx wrangler d1 time-travel restore vocabulary-td --bookmark="$PRE_RELEASE_BOOKMARK" --config "$cfg"`를 실행한다. 출력의 역복원 북마크를 보관하고 대응하는 Worker·Pages 버전과 표·집계 수를 확인한다. [D1 북마크와 복원](https://developers.cloudflare.com/d1/reference/time-travel/)

## 실행 기록 · 2026-11-27 (총괄, 사용자 승인 뒤)

| 단계 | 시각(KST) | 결과 |
| --- | --- | --- |
| 1. 복구 지점 | 09:10 | 최근 홈 기기 0 · 미제출 판 0. 릴리스 SHA `1a7fe4eb45a877c357d60831a5fa8eaf39819c67`. D1 북마크 `00000024-00000000-00005130-19adfc843890b40d3f4d0bde3eec5f3e`. 이전 Worker `34198413-2cd3-4f04-bc20-48c8932aa759`. 이전 Pages 실행 `43746879229`(`8e02afec`). 1.0.0 승인 4개 · 2.0.0 0개 · 기록 0판 |
| 2. 마이그레이션 | 09:10 | `0003_school_honor.sql`·`0004_ranking_seasons.sql` 적용, 대기 0. 시즌 표 `season1`·`season2` 각 1행 |
| 3. 시드(닫힌 채) | 09:11 | 2.0.0 `garden_u` 3~6학년 4개 `active=0`, 검증 규칙 1.0.0·2.0.0 각 4난이도 |
| 4. Worker | 09:11 | 새 버전 `7bfc8f40-6c71-4151-be4a-8c5f12a5d661`, `/v1/health` `{"ok":true}`. 시드 뒤 활성 조합 시즌별 4개, 제출 상태 둘 다 1 |
| 5. Pages | 09:11~09:16 | `main` 빠른 전진 `8e02afec..1a7fe4eb`, 실행 `45915342315` 성공(검사·서버 시험 3분 19초, 빌드, 배포). 운영 홈 200, R6 홈·시즌 2 탭 표시, 콘솔 오류 0, R6 아틀라스·초상 크기 저장소와 일치 |

남은 확인: 학생 화면에서 새 게임 한 판을 정상 종료해 시즌 2의 점수·웨이브·학교 필터와 내 기록을 본다. 실제 순위에 기록이 남는 일이라 담당 교사가 한다. 같은 기록이 시즌 1에 보이면 위 "되돌리기"의 시즌 2 제출 일시 중지부터 한다.

# R6 G5 통합 검증 및 운영 준비 점검표

- 작성: 2026-11-27
- 대상 판: R6 대개편 (`balanceVersion: 2.0.0`, 초원 고원 `garden_u`, 타워 6종·Lv20, 몬스터 5종족×20, 시즌 2)
- 기준 문서: [PRD-r6.md](../PRD-r6.md), [G5-perf.md](./G5-perf.md), [G5-server.md](./G5-server.md), [G4-monsters-notes.md](../review/G4-monsters-notes.md)

## (가) 자동 검증 결과 표

| 검사 항목 | 실행 명령 | 결과 | 기준 커밋 | 핵심 수치 / 비고 |
| --- | --- | --- | --- | --- |
| 프로덕션 빌드 | `/Users/bodyking/.local/bin/resource-guard run --profile build --wait-seconds 900 -- npm run build` | **통과** | `ae889b19` | `tsc -p tsconfig.json && vite build`, 398모듈 변환, 623ms |
| 저장소 대표 검증 | `/Users/bodyking/.local/bin/resource-guard run --profile test --wait-seconds 900 -- npm run verify` | **통과** | `ae889b19` | `typecheck` · `lint` · 단위 시험 111파일 1,892개 · `validate:plan` 49/49 · `validate:content` 604/604 · `wiki:lint` 23페이지 오류 0·경고 0 |
| 서버 시험 | `/Users/bodyking/.local/bin/resource-guard run --profile test --wait-seconds 900 -- npm run test:server` | **통과** | `ae889b19` | 서버 타입 검사 + Vitest 12파일 76개 통과 (7.88s) |
| 전체 E2E (1회 통주) | `/Users/bodyking/.local/bin/resource-guard run --profile test --wait-seconds 1800 -- npx playwright test --workers=1` | **일부 실패** (54 통과 / 9 건너뜀 / 25 실패) | `ae889b19` | `home`·`guide`·`note`·`r6-battlefield`·`r6-vfx`·`school-entry` 등 54개 통과. `api-connected`(5)·`school-entry` 1건·`r6-full-run`(1)·`r6-perf` 통주(2)는 환경 변수 미설정으로 건너뜀. 실패 25건 중 R6 결함 2건·타이밍 1건은 아래 수정 후 재검증 통과, 22건은 구 R4/R5 미갱신 스펙((라) 참조) |
| R6 E2E 수정 재검증 | `npx playwright test tests/e2e/r6-perf.spec.ts tests/e2e/r6-towers.spec.ts --workers=1` / `tests/e2e/play.spec.ts --grep '접근성' --workers=1` | **통과** | `d78e9563` | `가벼운 화면`(.2x 비동기 회수 `expect.poll`) 통과(1.8s), `r6-towers` 단독 통과(12.6s), `Armory.tsx` axe `label-content-name-mismatch` 해소 후 `접근성` 통과(2.9s) |
| W20 성능 통주 · CPU 6배 | `E2E_PORT=5197 VITE_API_BASE='' ... npm run test:r6-perf -- --grep 'CPU 6배 · W1~W20'` | **통과** | `d78e9563` | W20 완주(905.0초, 성문 15/15), 평균 **59.35fps**, 최저(1초 창) **50.97fps**(W6), 품질 0 유지, 자동 정지 0회, W15·W20 보스 등장, 오류 0건 |
| W20 성능 통주 · CPU 1배 | `E2E_PORT=5197 VITE_API_BASE='' ... npm run test:r6-perf -- --grep 'CPU 1배 · W1~W20'` | **통과** | `d78e9563` | W20 완주(904.8초, 성문 15/15), 평균 **59.98fps**, 최저(1초 창) **56.95fps**(W15), 품질 0 유지, 자동 정지 0회, W15·W20 보스 등장, 오류 0건 |
| 밸런스 v2 관문 (이전 기록) | `node tools/sim-gate.mjs --v2 --seeds 8` | **재사용** | 이전 커밋([sim-notes.md](../spec/sim-notes.md)) | 이번 세션 미실행. 기존 2차 조정 결과(보통 초보 11 · 균형 15 · 최적화 23, 쉬움 20 · 어려움 12 · 아주 어려움 9) 인용 |
| W1~W15 실제 게임 E2E 통주 | `TOWER_R6_FULL_RUN=1 npx playwright test tests/e2e/r6-full-run.spec.ts` | **미실행** | - | 이번 세션 미실행(W20 성능 통주와 별도) |

## (나) 실기기 확인 항목 (학교 크롬북 1366×768 · 교실 프로젝터)

운영 반영 전 학교 크롬북(1366×768)과 교실 프로젝터(명암·색재현이 낮은 환경)에서 아래 화면을 직접 확인한다.

| 화면 | 실기기(크롬북 1366×768 · 교실 프로젝터)에서 확인할 항목 |
| --- | --- |
| **홈** | 오늘의 낱말 초상 30장 구별감, 학습 카드 선 아이콘 대비, 닉네임·시작·랭킹 메뉴 글자 크기와 첫 화면 세로 잘림 유무 |
| **튜토리얼** | 단계 안내 문구 가독성, 다음·건너뛰기 버튼 터치/클릭 영역 크기, 프로젝터 투사 시 배경과 본문 대비 |
| **전투 W1** | 초원 고원 등고선·길(`#4A5563`)·빈 설치 칸 경계 구분, 초기 적 시인성, 문제판 밝은 고대비 면과 글자 크기('밝은 화면' 전환 포함) |
| **전투 W5** | 첫 보스(`*-boss-t1`) 머리 위 앰버 삼각형·44px 체력 막대 식별, 길 대비 1.5배 미만 44개체 중 초반 개체가 프로젝터에서 길에 묻히지 않는지 |
| **전투 W15** | 5종족 혼합 밀집 시 몬스터 혼잡도, 비행체 이중 테두리 그림자와 지상 유닛 구분, 보스 기술 표시, 대형 타워 뒤 몬스터 가림 체감 |
| **전투 W20** | 최고 밀집·T3~T4·최종 보스 혼잡도, 길 대비 미달 44개체(원색 보존 + 바깥 1px 은회 테두리)의 프로젝터 판독성, 실기기 프레임과 '가벼운 화면' 동작 |
| **결과** | 최종 점수·도달 웨이브·오답 요약 표 글자 크기, 프로젝터 대비, 다시 하기·홈 버튼 배치 및 가로 넘침 없음 |
| **랭킹** | 시즌 1 / 시즌 2 전환 탭, 우리 학교 필터, 순위 표 행간·글자 크기, 1366×768 창에서 표 가로 잘림 없음 |

### 중점 확인 3가지
1. **길 대비 미달 44개체(G4 이월)**: 원색 보존과 바깥 1px 은회(`#B8C0C8`) 테두리를 적용했으나 길(`#4A5563`) 대비 1.5배 미만인 44개체(특히 `insect-special-t1`, `stone-runner-t1`, `elf-armored-t3`, `elf-special-t1`)가 교실 프로젝터에서 배경과 분리돼 보이는지 확인한다.
2. **W15·W20 몬스터 혼잡도와 가림**: 최대 동시 적 20~22기 구간에서 겹침 판독이 가능한지, 발밑 Y순 정렬로 대형 타워 뒤에 적이 가려질 때 체력 막대만으로 위치 파악이 되는지 확인한다.
3. **1366×768·프로젝터 글자 크기**: 보조 캡션(`--fs-caption`, 12px)과 문제 보기·HUD 숫자가 교실 뒷자리에서도 읽히는지, 밝은 교실에서 설정의 '밝은 화면'이 충분한 대비를 주는지 확인한다.

## (다) 운영 반영 순서 요약

실기기 확인을 마친 뒤 **사용자 승인을 받아** 총괄이 수업 외 시간(최소 30분 + GitHub Actions 대기)에 [G5-server.md](./G5-server.md) 절차대로 실행한다. 비밀값·토큰은 어떤 문서·명령 기록에도 남기지 않는다.

| 단계 | 예상 시간 | 사람이 할 일 ([G5-server.md](./G5-server.md)) | 확인 기준 |
| --- | --- | --- | --- |
| **1. 현황·복구 지점 기록** | 약 5분 | `R6_SHA` 확인, `lobby_presence`·`run_start_dedup` 접속 대리 지표와 교사 수업 일정 확인, D1 Time Travel 북마크·Worker 버전 ID·Pages 실행 ID·승인 행·판 수 기록 | 진행 중인 수업·최근 미완료 판 없음, 북마크·이전 버전 ID 기록 완료 |
| **2. 마이그레이션·시즌 표** | 약 1~5분 | `npm run server:db:remote` 실행(`0003_school_honor.sql`, `0004_ranking_seasons.sql` 적용) | 대기 마이그레이션 목록 비어 있음, `ranking_seasons`에 `1.0.0`·`2.0.0` 각 1행 존재 |
| **3. 정답 키·비활성 시드** | 약 1~3분 | `server/seed/question_keys.sql`에 `balance_version='2.0.0'` `active=0` 업데이트를 묶어 원격 D1 반영 | 3~6학년 `garden_u` 4행 `active=0`, `run_verification_rules`에 두 판 각 4난이도 존재 |
| **4. Worker 배포·조합 열기** | 약 1~3분 | `npm run server:deploy` → `/v1/health` 확인 → `npm run server:seed:remote` 실행 | 새 Worker 버전 ID 기록, `/v1/health` 정상, 시즌별 활성 조합 4행·`submissions_open=1` |
| **5. Pages 배포·실확인** | 약 5~15분 | 사용자 승인 후 원격 `main`을 `R6_SHA`로 전진(`git push origin "$R6_SHA:refs/heads/main"`) → `pages.yml` 완료 대기 → 실제 한 판 종료 확인 | 배포 성공 후 새 판이 시즌 2(`weekly`·`all_time`·`season2`)에만 보이고 `season1` 기존 기록은 그대로 유지됨 |

### 되돌리기 ([G5-server.md](./G5-server.md#되돌리기))
- **화면 문제**: 이전 `OLD_PAGES_RUN_ID` 재실행(`gh run rerun`) 또는 `main` 되돌림 PR 병합(시즌 인식 Worker는 유지해 두 시즌 기록 보존).
- **시즌 2 신규 제출 일시 중지**: `ranking_seasons`에서 `balance_version='2.0.0'`의 `submissions_open=0` 갱신(503 재시도 응답, 기존 조회·재전송 유지).
- **Worker 자체 복구**: 이전 Pages 복구 후 `2.0.0` 활성 조합을 `active=0`으로 닫고 `wrangler rollback "$OLD_WORKER_VERSION_ID"` 실행.
- **데이터 손상 시에만**: 서비스 쓰기 중지 및 별도 복원 승인 후 `PRE_RELEASE_BOOKMARK`로 D1 Time Travel 복원 실행.

## (라) 알려진 한계와 미실행 항목

1. **실기기·교실 환경 미실행**: 본 검증의 성능·레이아웃 측정은 Mac(Apple M6, ANGLE Metal, Chromium CDP CPU 6배 감속) 기준이며, 학교 크롬북(1366×768) 실제 CPU/GPU·발열과 교실 프로젝터 색감·투사 시인성은 **미실행**이다.
2. **G4 이월 시각 관찰 항목**: 길 대비 1.5배 미만 44개체(원색 보존 결정), 종족 간 색 판독 B 91쌍 동시 등장 시 구분, 발밑 Y정렬 이후 대형 타워 뒤 몬스터 일시 가림(52~74% 구간 존재)은 실기기에서 확인이 필요하다.
3. **구 R4/R5 미갱신 E2E 스펙 22건**: `layout.spec.ts`(12건), `play.spec.ts`(9건 — `접근성` 제외), `stage-animation.spec.ts`(1건)가 R6 기본값(`2.0.0`)·R04 전술 UI 기준과 어긋나 실패 상태로 남아 있다(기대값 변조 없이 원인만 분리 기록).
   - **v1 명칭·구성 잔존**: `궁수탑`·`서리탑`·`5. 새 타워와 적 특성`·홈 `전장 미리보기 canvas`(R6에서 `<img>`로 변경) 대기 타임아웃.
   - **R04 UI 레이아웃·스타일 차이**: `layout.spec.ts` 수직선 Δ(4.5~188px), `1366×650` HUD 2행·칸 크기(39.2px < 44px), `1440×900` 칸 크기(68.73px ≤ 70px), R5 문제판 3D 키 그림자(`boxShadow` `"none"`), R5 준비 바 무한 애니메이션(`0`), 일시정지 끝내기 확인 높이 차(80px), 키보드 `설치 자리 목록`과 상황 카드 위치 차.
   - **모바일·소형 글자 관찰**: `390×844` S 모드 오답 제출 시 문서 세로 넘침(+77px)과 `820×1060`·`390×844` 최소 글자 12px(`tokens.css` `--fs-caption`이 12px, 기존 `layout.spec.ts` 하한 13px 미만). 운영 반영 자체를 막지는 않으나 후속 UI 정리 또는 R6 E2E 정비 대상이다.
4. **기타 미실행 항목**: `TOWER_R6_FULL_RUN=1`(`r6-full-run.spec.ts` W1~W15 실제 기록 저장 통주), `api-connected` 원격/로컬 서버 연동 E2E 5건, 운영 D1·Workers·GitHub Pages 반영(사용자 승인 후 총괄 실행 대상).

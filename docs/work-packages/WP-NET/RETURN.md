STATUS: PARTIAL

# WP-NET 6회차 최종 인계

기준 HEAD `3cf3229ea96a1eb14b9f3f47db72e34c1af8e136`. Codex가 담당 구현을 보존하고 **소유 밖 통합 변경 세 건을 실제 파일 수정 없이 적용 가능한 패치로 준비**했다. 이번 회차 제품·시험 코드 변경은 없다. **이번 회차 문서·로그 9개 파일 변경, 누적 명시적 수합 대상 60개**다. 정확한 목록은 `CHANGED_FILES.json::round6ChangedFiles`와 `sourceFiles`/`handoffAndEvidenceFiles`에 있다. 5회차 인계 원문과 시작 파일 해시는 `round6-baseline.json`에 보존했다.

다른 작업 폴더 접근·소유 밖 파일 쓰기·commit·push·branch 조작·패키지 설치·원격 DB 변경·다른 에이전트 호출은 하지 않았다. 담당 밖 세 파일은 읽기만 했으며 시작 해시와 종료 해시가 같다.

## 요청 항목 1~10

| 항목 | 상태 | 근거 |
|---|---|---|
| 1 소유권 | 완료 | `auth.ts` 익명 signup/refresh·JWT, SQL `auth.uid()` 소유권·`p_player_id` 제거·salt 필수. 임의 Presence 접속 키·metas 유지. 저장 실패 시 현재 화면 메모리 인증 유지. |
| 2 서버 재채점 | 완료 | `runRecord.ts` 최초 선택/activeTicks, 승인 question_keys, SQL 재채점/PT/처치 상한/준비 수/단계/revision/시간/소유권 검사. 같은 payload 최초 접수 유지, 변조 중복 거부. seed 후보·철회·중복 검사. |
| 3 속도·시각 | 완료 | SQL 사용자별 원자적 분/일 한도. `local_ended_at`·제한된 `ended_at`·최초 `received_at` 구별. HTTP 429와 분 경계/KST 자정 기준 Retry-After. |
| 4 별명 | 부분 | `src/contracts/lobby.ts::cleanPublicNickname`·SQL 정규화/개인정보/2~12 사용자 인식 문자 규칙, SettingsModal 안내 완료. 소유 밖 `src/ui/copy.ts::cleanNickname` 홈 연결이 남아 있다. 제안 패치 준비. |
| 5 동의 | 완료 | shareRecords 기본 false, 꺼짐에서 인증/RPC/Presence 네트워크 0회. 공개 항목 안내·TelemetryStrip 꺼짐 표시·다른 탭 해제 시 Presence 종료·이전 동의 상태 늦은 통계 무시. |
| 6 저장 | 완료 | FIFO·일시 장애/408/429/5xx 무포기 백오프·Retry-After·영구 거부만 제거/안내. 삭제 실패/blocked 안내·versionchange 닫기·인증+기기 runId 소유 판정. 매 전송 및 인증 대기 뒤 현재 큐를 재확인한다. |
| 7 모션 | 부분 | settings.ts OS 기본값·저장 선택 보존 및 단위/e2e 기대값 수정 완료. 소유 밖 App.tsx 두 강제 full 복구가 남아 화면 통합 미완. 제안 패치 준비. |
| 8 소리 | 완료 | `sound.ts`: 미리듣기 뒤 설정 변경으로 BGM이 시작되지 않으며 실제 unlock에서만 허용. |
| 9 오늘의 낱말 | 부분 | 선호 학년·KST 날짜 고정, 랜덤도 같은 학년, 공개 은행만 사용. 소유 밖 gradeContent의 후보 우선 선택 때문에 화면은 빈 안내. 제안 패치와 콘텐츠 시험 충돌의 조정 방향 준비. |
| 10 라디오 | 완료 | SettingsModal 모든 radiogroup 방향키/Home/End 및 roving tabindex. |

위 완료는 담당 구현 범위의 판정이며, 실제 Supabase 서비스 연결·배포·실기기 승인을 뜻하지 않는다.

## 이번 회차 결과

- `INTEGRATION.patch`: App.tsx·copy.ts·content/index.ts의 최소 변경안. 현재 원문 기준 **`git apply --check` 종료 0**. 패치를 실제로 적용하지 않았으며 적용 후 컴파일·시험·화면은 미검증이다.
- `INTEGRATION.md`: 담당자별 적용 순서, 아래 콘텐츠 시험 충돌, 수합 뒤 한 번 실행할 검사와 SQL 경계를 기록했다.
- **새로 확인한 통합 충돌:** 소유 밖 `tests/unit/difficulty-quiz.test.ts`의 `3~6학년 실제 런타임 은행이 각 학년 1,000문항을 초과하고 4단계 난이도 회전을 정상 수행한다`는 시험이 `gradeContent()`에 후보 은행 노출을 요구한다. 공개 은행 전용 계약과 충돌한다. 총괄이 후보 fixture 직접 검사와 실제 런타임 공개 경계 검사로 나눠야 한다. 기존 수량·난이도 회전 단언을 낮추거나 지워 해결하면 안 된다.
- 기존 구현과 seed 입력은 바꾸지 않았다. 공개 3학년 51문항/seed 키, 4개 승인 규칙은 그대로다.
- 이전 회차의 소유 밖 의존 문제가 그대로이므로 모션 e2e 실패를 반복 실행하지 않았다.

## 시험과 실제 출력

6회차에는 새 시험을 추가하거나 기대값을 바꾸지 않았다. 기존 회귀는 이번 전체 시험에 포함돼 통과했다. 누적 주요 시험은 다음 파일에 있다.

- `tests/unit/net/auth.test.ts`: 익명 signup/JWT 재사용, 저장 실패 중 소유권 유지, refresh 실패에서 새 소유자 생성 방지.
- `tests/unit/net/privacy-storage.test.ts`: 큐 FIFO, 동의 없음 fetch/WebSocket 0회, 일시 장애 무포기, 인증+기기 runId, Retry-After, 영구 거부 안내, 전송/인증 대기 중 삭제와 전송 중 추가 경합.
- `tests/unit/net/presence.test.ts`, `telemetry.test.ts`: 임의 접속 키·metas와 RPC 실패 live 오표시·동의 변경 늦은 응답 회귀.
- `tests/unit/net/server-scoring.test.ts`, `question-seed.test.ts`: 재채점 불일치, 최초 선택/범위, 후보·철회·중복 seed 거부.
- `tests/unit/stage-animation.test.ts`, `tests/unit/lobby.test.ts`: OS/저장 선택 보존, 소리 미리듣기, KST·선호 학년·공개 낱말, 별명/설정 계약.

| 검사 | 결과 |
|---|---|
| `npm run typecheck` | **실행**, 종료 0. 앱/시험 tsconfig 모두 통과. `round6-typecheck.log`. |
| `npm run lint` | **실행**, 종료 0. `round6-lint.log`. |
| `npm test` | **실행**, 종료 0. **36 files / 549 tests passed, 4.16초**, 시작 22:40:19 KST. `round6-test.log`. |
| `git apply --check docs/work-packages/WP-NET/INTEGRATION.patch` | **실행**, 종료 0. 적용 가능성만 확인; 실제 적용하지 않음. |
| `git diff --check` | **실행**, 종료 0. |
| SQL 실행 | **이번 미실행**. SQL/seed 무변경. **3회차 PostgreSQL 17.11 결과 재사용**: 네 migration → seed 및 HTTP failure regression PASS / SQL regression PASS. `round3-sql-bootstrap.log`, `round3-sql.log`. |
| Unicode 17 전체 자료 | **재사용**: 2회차 692건 통과, NUL 포함 74건 제외. 관련 코드·자료 무변경. |
| 설정 라디오 e2e | **재사용**: 1회차 1 passed(5.3초). 관련 UI 무변경. |
| 모션 e2e | **이번 미실행**. 1회차 1 failed의 원인인 App.tsx 강제 full 코드가 그대로다. |
| 통합 패치 적용 후 시험·build·전체 e2e·실기기·실제 JWT/refresh/Realtime·PostgREST HTTP | **미실행**. 현재 체크아웃 전체 단위 시험 통과와 미적용 패치의 통합 성공을 구별한다. |

3회차 `auth.uid()`는 `request.jwt.claim.sub`를 읽는 fixture였다. SQL 로직 통과는 실제 게이트웨이/JWT 검증이 아니다. 필수 세 검사는 요청서가 이번 회차 직접 실행을 지정해 각각 한 번 실행했다.

## 남은 일과 다음 첫 단계

1. **총괄/WP-SAVE가 `INTEGRATION.md`를 읽고 세 소유 파일의 패치를 수합한다.** `INTEGRATION.patch`는 현재 원문에 적용 가능하다. 해당 파일이 변했으면 강제 적용하지 않는다.
2. 총괄이 `tests/unit/difficulty-quiz.test.ts`의 후보 수량/회전 시험을 후보 fixture 검사로 분리하고 공개 전용 런타임 경계 시험을 보탠다. 이 파일은 WP-NET 소유 밖이라 수정하지 않았다.
3. 수합 후 관련 단위 시험 → 필수 세 검사 → 충돌 없는 포트에서 `tests/e2e/stage-animation.spec.ts`를 한 번 실행한다.
4. 공개 은행/철회가 바뀌었을 때만 seed를 다시 만든다. 이번에는 무변경이다.
5. 실제 Supabase의 익명 인증·salt·migration/seed·JWT/refresh/Realtime·HTTP를 배포 담당이 확인한다.

## 배포 순서·남은 위험

- 사람이 Supabase Anonymous Sign-Ins를 켜고 비어 있지 않은 안전한 서버 `app.player_salt`를 설정한다. 서버 salt는 클라이언트에 넣지 않는다.
- `20261030000001` → `20261030000002` → `20261030131722` → `20261030132649` migration → `question_keys.seed.sql` 순서다. `bootstrap-local.sql`은 시험 전용이다.
- 기존 첫 migration은 hmac을 public에서 찾는다. 배포 담당은 기존 적용 여부와 pgcrypto 스키마를 확인해야 한다. 새 함수의 public/extensions 탐색은 과거 migration 최초 적용 문제를 소급 해결하지 않는다.
- 실제 JWT/refresh/RLS/Presence/다중 탭·429/Retry-After/CORS는 미검증이다. PostgreSQL fixture 시험은 실제 HTTP 수신 증거가 아니다.
- 로컬 기록 정리는 이미 발송한 RPC의 서버 반영을 취소하거나 원격 공개 기록을 삭제하지 않는다.
- 토큰 저장 실패 시 메모리 소유권은 현재 화면에서만 유지된다. 처치 점수는 범위 검증이며 전투 재생 검증은 아니다.
- local_ended_at 과거 행의 원본 복원은 불가하다. 서버 Unicode 17과 오래된 브라우저 Intl.Segmenter 차이는 별도 확인 대상이다.
- 운영 요금·남용 방지·보존 스케줄·원격 배포는 이 작업에서 적용하지 않았다.

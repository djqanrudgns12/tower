# CR-1000 인수인계 — Claude 총괄 → Codex 메인 세션

작성 2026-11-06 · 작성 Claude Opus 5.5(총괄) · 받는 쪽 Codex(메인 세션)
같이 읽을 것: [계획서 CONTENT_REVIEW_PLAN.md](CONTENT_REVIEW_PLAN.md)(기준 문서), [AGENTS.md](../AGENTS.md)

### 완료 답장 추가 복구·005 반영 대기 (Codex, 2026-11-06 13:23 KST)

- 시간 초과한 세 번째 S3 호출의 원래 입력과 완료 대화를 대조해 **12개 수정안 추가 복구**, 앞서 36개와 합계 **48개**를 확보했다. 새 모델 호출은 **0**이다. 기존 추적 초안 기준 76개 대상·정확한 프롬프트·대화 UUID·완료 상태·로그/답장 해시를 확인했다. 근거 `.orchestrate/recovery/g4-s3-partials/{transcript-inventory,timeout-recovery}.json`; 원본 대화·프롬프트·답장도 같은 폴더에 보존했다. 같은 S3 호출을 다시 시도하지 않았다.
- 추가 staging은 002의 8개(앞선 7개 불변), 003의 4개다. 003은 기존 엄격 검사 보정으로 별도 1문항의 보기 순서도 바뀌어 **전체 revision 변경은 49문항**이다. 해당 문항은 보기 문구별 정답·오답 이유 대응과 나머지 필드 불변, revision 1회 증가를 확인했다. 001의 기존 Claude 통과 12개는 그대로다. 이들은 아직 **추적 반영·S1 재판정·재검수 전**이며 공개 승인으로 세지 않는다.
- **005 Codex 검수 50개 완료: 앞단 21통과·29결함.** 메인이 보고서 스키마·현재 revision/본문 해시·blind/reveal의 gpt-6-astra/high 설정·판정 대응·원래 보고서 보관본을 직접 확인했다(`.orchestrate/g4-005-pending.audit.json`). 잠금 반영 중 서버 시험이 자원 대기 600초 후 미실행으로 끝나 잠금은 해제됐지만, `.orchestrate/commit.pending.json`과 미커밋 보고서·레지스트리·후보 은행은 보존됐다. **005를 먼저 잠금 재개해야 한다.** 다른 보호 작업 PID 61118이 실행 중이며 종료·우회하지 않았다.
- `.orchestrate/apply-pilot-results.mjs`는 확인한 005 pending만 우선 재개하고, 복구 001~003 → 5학년 시범 → 6학년 시범 → 새 낱말 목록 순으로 반영하도록 준비했다. pending/manifest가 확인 기록과 다르면 중단한다. 이번에는 **구문 확인만 했고 실행하지 않았다**. 기존 PID 55822·25037과 동시에 콘텐츠를 반영하지 않는다.
- 새 4학년 목록 161통과의 운영 사본과 **5문항 사전 준비 5통과·0반려**를 직접 대조했다. `.orchestrate/produce-pilots/g4-r2-preflight/{summary,audit}.json`, 운영 목록 `.orchestrate/produce/g4-production-list-r2.json`. 검수 staging과 사본의 동일 SHA, 기존 사전 index 3개와 원문 9파일, 실제 선택 후보와 모든 `prepare` 통과를 확인했다. 2개는 검수된 사전 항목 ID를 지정한다. 새 조회/모델 호출은 0이며 **문항 제작 전**이다. 5학년 제작과 대기 중인 6학년 시범이 끝난 뒤 `Q50-G4-028` 5문항 시범을 실행한다.
- 5학년 감독 PID 78689는 023 제작 중, 6학년 PID 91819는 제작 잠금 대기다. 제품 코드 변경·제품 시험 재실행은 없으며 `503059c` 검증 결과를 재사용한다. 관련 없는 `docs/contracts/prd_v0_5_validation.json` 변경은 보존했다.

### 추가 낱말 보정 검수 완료 (Codex, 2026-11-06 13:10 KST)

- PID 94475·95753이 정상 종료했다. 보정 세 번째 묶음은 Argon **18제안·4보류**, Codex **17통과·1반려**다. 메인이 이 묶음의 근거 66파일 해시·모든 유형의 지정 사전 항목·뜻 번호·독립 판정 대응을 직접 확인했다. 첫 두 묶음의 검사 기록은 재사용했다.
- 최종 목록 **180개 중 161통과·19반려**. 기존 통과 106개는 필드 전체가 그대로이며, 보정으로 **55개 추가 통과**했다. 최종 staging의 파일 해시·원래 목록과 보정 결과의 대응·표제어 중복 없음까지 확인했다. 현재 제작 가능 칸 **291개**. 이는 문항 생성·공개 승인 수가 아니다.
- 최종 staging `.orchestrate/staging/wordlist-g4-r2/20261106T040732029Z-95753/`, 메인 확인 `corrections/codex/staging.audit.json`, 세 번째 검사 기록 `corrections/codex/check/chunk3/audit.json`(앞 경로는 모두 `.orchestrate/wordlists/g4-r2/` 아래). 앞서 만든 106통과 목록 staging도 보존했다. 두 run은 시간순으로 같은 목록 파일에 반영하며, 실행기는 두 manifest 모두 확인 기록과 일치할 때만 허용하도록 갱신했다. 새 미확인 run이 생기면 중단한다.
- 다음 제작은 이 최종 검수 목록을 별도 운영 목록으로 보존한 뒤 5문항 시범 → 확인 후 보충 배치 확대다. **제작 잠금은 현재 5학년 감독 PID 78689가 사용 중이며, 종료 후 6학년 5문항 시범 PID 91819가 기다리고 있다.** 두 작업과 ID 예약을 경합하지 않게 종료 상태를 먼저 확인한다. 기존 제작기를 재시작하거나 잠금을 지우지 않는다.
- 원래 4학년 앞단은 다른 배치를 계속하며, 실패한 001~003을 새로 재요청하지 않았다. 복구한 36문항·시범·새 목록의 실제 잠금 반영은 자원 대기다. 이번에는 제품 코드 변경이나 제품 시험 재실행이 없다.

### S3 3회 실패·부분 답장 36문항 복구 (Codex, 2026-11-06 13:08 KST)

- 4학년 **001~003 S3의 세 번째 시간 초과가 04:02:46Z에 확정**됐다. 해당 작업은 실패 종료로 표시됐고 같은 S3를 새로 호출하지 않았다. PID 55822 자체는 다른 배치의 Codex 검수(005 등)를 계속한다. 실패 단계 기록은 `.orchestrate/recovery/g4-s3-partials/failed-attempts.json`, 이전 두 차례 기록은 `.orchestrate/g4-s3-attempts.audit.json`이다.
- 보존된 부분 답장 11개를 현재 초안·수정 대상으로 대조했다. 2개는 JSON 형식 오류이며 사용하지 않았다. 나머지에서 기존 `parseRevisions`를 통과한 **서로 다른 36개**를 확인해, 현재 초안 해시·원본 답장 해시가 그대로인지 다시 확인한 뒤 기존 `revise.apply`로 staging을 복구했다. **새 모델 호출 0**이다. 001은 29수정·기존 Claude 통과 12개 완전 보존, 002는 7수정이다. 추가 보기 재배열·버림은 없고, 각 revision/앞단 회차가 정확히 한 번 증가했다. 6파일 manifest SHA·스키마·자체 반박도 확인했다.
- 복구 근거 `.orchestrate/recovery/g4-s3-partials/{inventory,recovery}.json`. staging은 각 배치의 `20261106T040528…-99479-…` run이다(정확한 경로는 recovery.json). **추적 반영·S1 재판정·재검수 전**이다. 나머지 40개와 시간 초과 대화의 완료 답장은 추가 복구 대조 대상이며, 처음부터 76개를 다시 요청하지 않는다.
- `.orchestrate/apply-pilot-results.mjs`는 이 복구 2배치를 먼저 반영하도록 준비했다. 새 보정 목록 staging이 생기면 자동 반영하지 않도록, 확인한 목록 run 이외의 추가 run을 발견하면 중단한다. 보정 목록을 모두 직접 확인한 뒤 반영 대상을 갱신해야 한다. 이 실행기는 이번에는 **구문 확인만 했으며 실행하지 않았다**. 다른 보호 작업 때문에 실제 반영은 계속 대기다.
- 보정 두 번째 묶음은 **21제안 중 Codex 20통과·1반려**, Argon 보류 1개다. 메인이 57개 근거 파일 해시·지정 항목·뜻 번호·모든 추천 유형·판정 외 원본 불변을 확인했다(`corrections/codex/check/chunk2/audit.json`). 첫 두 묶음에서 **추가 38후보 통과**, 아직 목록 반영/문항 승인은 아니다. PID 94475는 마지막 제안 묶음, PID 95753은 그 답장 대기다. 부족한 메모리에서는 검수 호출을 대기했고 6.3GiB 확인 후 두 번째 묶음만 실행했다.
- 제품 코드 변경·제품 시험 재실행은 없으며 `503059c` 검증을 재사용한다. 5학년 023 제작과 6학년 시범 대기, 원래 통과 106개 목록 staging도 보존 중이다.

### 보정 독립 검수 시작·기존 S3 내부 실패 확인 (Codex, 2026-11-06 12:54 KST)

- **PID 95753** `.orchestrate/wordlists/g4-r2/review-corrections.mjs`가 Argon 보정 답장을 순서대로 Codex O-C5에 넘긴다. 상태 `corrections/codex/summary.json`, 로그 `review-corrections.out`. 한 번에 한 묶음이며 메모리 여유·압력을 확인한 뒤 호출한다. 기존 검사 실행기를 실제 입력 개수(1~60개)에 맞춰 재사용하되 응답 개수·표제어·인덱스·출처 불확정 승인 차단은 그대로 유지한다. 자동 콘텐츠 반영은 하지 않는다.
- 첫 22개 보정 제안은 **Codex 18통과·4반려**다. 메인이 제안/검수 입력·답장 해시, 사전 근거 **74파일** 해시, 모든 추천 유형의 제공자·항목 ID·표제어·품사·뜻 번호 일치, 판정 필드 외 원본 불변을 직접 확인했다. `corrections/codex/check/chunk1/audit.json` 참조. 기존 통과 106개는 그대로이며 추가 18개도 아직 목록 반영·문항 제작·공개 승인이 아니다.
- Argon PID 94475는 두 번째 보정 묶음 진행 중, Codex 조정기는 그 답장 대기다. 모두 끝나면 기존 통과 106개 불변을 확인해 두 번째 목록 staging을 만들고 `awaiting-main-audit`에서 멈춘다. 보정 전 목록도 `corrections/codex/baseline.json`에 해시와 함께 보존했다. 먼저 만든 staging을 임의로 삭제하거나 덮어쓰지 않는다.
- **기존 4학년 S3는 오류가 없었던 것이 아니다.** 최상위 `error`가 아직 없지만 단계별 기록에는 시간 초과 **2회**(02:28Z·02:48Z 종료)가 있다. 현재 세 번째 시도가 실행 중이다. 확인 기록 `.orchestrate/g4-s3-attempts.audit.json`. 재개 시 최상위 상태뿐 아니라 각 `stages[].error`도 확인한다. 세 번째 결과를 확인하기 전 추가로 같은 S3를 실행하지 않는다. 실패하면 보존된 완료 답장과 부분 결과부터 대조하고, 같은 호출을 새로 반복하지 않는다.
- 이번에는 운영 실행기·검수 결과·인계만 갱신했다. 제품 코드 시험은 재실행하지 않았으며 `503059c`의 31시험·타입·린트 결과를 재사용한다. 5학년 023 제작, 6학년 시범 제작 대기, 자원 차단으로 보존한 시범·목록 staging은 유지한다.

### 추가 목록 전체 검수·사전 항목 지정 보완 (Codex, 2026-11-06 12:44 KST)

- 후보 생성 PID 79448과 순차 검사 PID 90493 모두 정상 종료했다. 세 번째 묶음은 **29통과·31반려**, 전체 **180개 중 106통과·74반려**다. 반려는 출처 불확정 55개·뜻/학년 근거/유형 등 의미 문제 19개다. 메인이 세 묶음의 생성·검수 프롬프트/답장/원본 스냅샷과 **사전 근거 426파일 SHA-256**, 기존 `prepare` 판정, 항목별 대응, 판정 외 원본 불변을 직접 대조했다. 현재 초안·staging·모든 기존 학년 목록과 표제어 중복은 0개다.
- 목록 staging: `.orchestrate/staging/wordlist-g4-r2/20261106T033204509Z-90493/`. `g4-r2.json` 한 파일이며 통과·반려 항목 모두 보존한다. 메인 확인 기록 `.orchestrate/wordlists/g4-r2/check/staging.audit.json`. 통과 후보의 현재 제작 가능 칸은 **194개**다. 아직 추적 반영·문항 제작·공개 승인이 아니다.
- 출처 불확정 55개를 다시 분류하니 **동음이의어 모호성 47·일치 항목 없음 8**이었다(`check/source-rejection-analysis.json`). 목록에 특정 사전 항목을 지정할 방법이 없어 동음이의어가 무조건 반려되는 한계를 보완했다. `sourceEntry:{provider,entryId}`를 선택적으로 받아 기존 표제어·품사·뜻 번호 필터와 함께 대조한다. 미지정이면 기존 판정 그대로, 잘못 지정한 ID/제공자는 유일한 다른 항목으로 대체하지 않고 거절한다. 지정 후 중복·원문 해시 오류도 계속 거절한다.
- **기존 반려를 승인으로 바꾸지 않았다.** 후속은 사전 조회 결과를 보여 주고 Argon O-A1이 항목 지정/메타데이터 수정을 제안 → Codex O-C5가 뜻·학년 적합성을 독립 확인하는 순서다. ID 자체는 승인 근거가 아니며 계획서 지시문에도 명시했다. 코드 커밋 **`503059c` push 완료**. 실행 중인 제작기는 이전 모듈을 계속 사용한다.
- 여유 메모리 6.6GiB·정상 압력 확인 후, 종료한 후보 생성 작업 자리에 **PID 94475**로 반려 **66개(모호성 47·의미 문제 19)**의 보정 제안을 시작했다. `.orchestrate/wordlists/g4-r2/correct.mjs`, 상태 `corrections/summary.json`, 로그 `corrections-run.out`. 22개씩 순차 3묶음, Argon High 제한 호출이며 명령·파일 쓰기 금지다. 선택 ID는 제공된 사전 항목이어야 하고 모든 추천 유형에 기존 `prepare` 검사를 적용한다. 아직 첫 묶음이며 보정 완료/승인 수는 없다. 끝나면 **`awaiting-codex-review`**, 기존 106통과 목록·staging·추적 파일은 그대로다. 일치 항목이 없던 8개는 이번 요청에 넣지 않았다.
- 검증: 새 회귀의 수정 전 **7실패** 확인 → produce **31시험 통과**, 시험 타입·변경 범위 린트·전체 린트 1회 통과. 전체 단위시험·verify·e2e·실제 서버 시험은 미실행이다. 다른 세션의 `playwright.config.ts`, `vite.config.ts`, `docs/contracts/prd_v0_5_validation.json` 변경은 건드리지 않았다.
- `.orchestrate/apply-pilot-results.mjs`에 검증된 목록을 세 번째 반영 대상으로 연결했다(5학년 시범 → 6학년 시범 → 새 목록). 자원 보호 PID 93266의 600초 대기는 **종료 75, 반영 실행 안 됨**으로 끝났다. 로그 `.orchestrate/pilot-results-apply-20261106T0334.out`, 결과 같은 이름의 `.wait.json`. 반영 summary와 pending은 생성되지 않았으며 모든 staging을 보존했다. 즉시 재시도하지 않는다.
- 5학년 보충 **022는 41생성·9반려**, Argon 6회로 완료했고 PID 78689는 023 제작 중이다. 메인이 **171파일** 해시·경로·초안/sidecar 스키마·정답만 fits·배치 엄격 검사·전역 ID 충돌 0을 확인했다. 새 낱말 문항은 35/41개다. 사전 근거 반려 9개와 운영 목록 제외 증거도 원래 index·백업 목록·기존 `prepare`로 대조했다. 기록 `.orchestrate/g5-supplement.staging-audit.json`. 4학년 S3 PID 55822, 보충 반영 대기 PID 25037, 6학년 시범 제작 대기 PID 91819는 유지한다.

### 후보 두 묶음 검수·6학년 보충 시범 준비 (Codex, 2026-11-06 12:28 KST)

- 추가 후보 두 번째 60개도 O-C5 완료: **37통과·23반려**. 메인이 원본 답장·후보 스냅샷·입력/답장/근거 index 해시, 항목별 대응과 판정 필드 외 원본 불변을 직접 확인했다. 반려는 출처 불확정 18개, 뜻·학년 근거·유형·혼동 짝 문제 5개다. 첫 묶음과 합계 **120검사·77통과·43반려**이며 문항 승인 수가 아니다. 근거 `.orchestrate/wordlists/g4-r2/check/chunk2/audit.json`.
- 후보 생성 PID 79448은 마지막 60개를 진행 중이고, 순차 검사 PID 90493은 세 번째 묶음 생성 대기다. 앞 절의 첫/두 번째 묶음 진행 중 표시는 이 결과로 대체한다. 끝나면 목록 staging을 만들고 총괄 검수 대기에서 멈추는 동작은 같다.
- 6학년 보충 시범의 후보 10개를 사전 조회·기존 `prepare`로 대조해 **8개 근거 확인·2개 불확정**을 기록했다. 확인된 후보 중 5개만 시범 목록으로 골랐다. 원래 추적 목록은 그대로이며 `.orchestrate/produce-pilots/g6-preflight/`에 입력·원문·해시·선택 결과를 보존했다. 불확정 두 후보는 이번 시범에 넣지 않는다.
- **PID 91819** `.orchestrate/run-g6-produce-pilot.mjs`: 상태 `.orchestrate/g6-produce-pilot.summary.json`, 로그 `.orchestrate/g6-produce-pilot.out`. 현재 `awaiting-g5-producer`, **모델 호출 0**이다. PID 78689의 5학년 여섯 배치 제작이 정상 종료한 뒤에만 제작 잠금 부재·입력/근거 해시·실제 선택 후보를 다시 확인하고 5문항을 제작한다. 5학년 비정상 종료 또는 12시간 대기 상한이면 기록하고 멈춘다. 완료 후 `awaiting-pilot-review`이며 자동 6배치 확대·콘텐츠 반영·Claude 호출은 하지 않는다.
- 이번 변경은 운영 준비와 기록이다. 제품 코드 변경·제품 시험 재실행은 없으며, 이전 `6271f5e`의 검증 결과를 재사용한다. 4학년 앞단 PID 55822, 4학년 보충 반영 대기 PID 25037, 5학년 제작 PID 78689는 살아 있다.

### 추가 낱말 독립 검수·잠금 경로 보완 (Codex, 2026-11-06 12:20 KST)

- 추가 후보 첫 60개의 생성 답장 SHA-256과 후보 목록 일치를 확인하고 `.orchestrate/wordlists/g4-r2/check/chunk1/`에 별도 스냅샷을 보존했다. 총괄 도구의 사전 조회·기존 `prepare` 대조에서 **42개 근거 일치·18개 불확정**이다. 생성기가 쓰는 원본 `candidates.json`은 변경하지 않았다.
- PID **81879**의 `gpt-6-astra/high` O-C5 검수가 완료됐다. **40통과·20반려**이며 출처 불확정 18개 외에 실제 뜻/방언 지역 불일치 2개를 반려했다. 메인이 입력·답장·근거 index 해시와 60개 전 항목의 대응, `checked`·`reason` 이외 원본 불변, 출처 불확정 후보의 승인 차단을 직접 대조했다. 결과 `checked-items.json`, 확인 기록 `audit.json`을 같은 폴더에 보존했다. 이 수치는 낱말 후보 수이며 문항 생성·공개 승인 수가 아니다.
- 생성은 **120후보 완료·마지막 60개 진행 중**이다. PID **90493**의 `.orchestrate/wordlists/g4-r2/check/run.mjs`가 생성 완료 묶음을 차례로 사전 조회·독립 검사한다. 현재 두 번째 60개를 Codex 검수 중(PID 90518)이며 사전 일치 42·불확정 18이다. 상태는 `check/summary.json`, 로그는 `check/run.log`. 모두 끝나면 180개 원본 대응·판정·해시를 확인해 전용 목록 staging을 만들고 **`awaiting-main-audit`에서 멈춘다. 자동 콘텐츠 반영·제작·Claude 호출은 하지 않는다.** 후보 생성·검수에 오류가 나면 기록하고 멈추며 같은 호출을 자동 반복하지 않는다.
- 기존 commit-lock은 낱말 목록 경로를 전부 거절해 잠금 반영이 불가능했다. `wordlist-g<3~6>-r<라운드>` 작업 ID가 **같은 이름의 `content-source/wordlists/*.json` 한 파일만** 소유하도록 보완했다. 다른 학년·라운드·일반 배치의 목록 쓰기는 계속 거절한다. 목록 반영 때도 기존 해시 검사·잠금·은행 생성·서버 시험·경로 한정 커밋 절차를 그대로 거친다.
- 검증: 새 정상 반영 회귀의 수정 전 실패 확인 후 commit-lock **21시험**, 시험 타입 검사·변경 범위 린트·전체 린트 1회 통과. 코드 커밋 **`6271f5e` push 완료**. 전체 시험·verify·e2e·실제 서버 시험은 미실행이다. 실제 목록은 아직 staging·추적 반영하지 않았다. 기존 PID 55822·25037은 이전 모듈을 사용하므로 목록 반영은 새 실행기의 해당 작업 ID만 지정한다.
- 자원 보호는 다른 보호 작업 실행 중으로 잠금 반영 대기 상태다. 기존 4학년 앞단·보충 대기, 5학년 보충 제작과 추가 후보 생성은 유지한다. **S4 대량 확대는 보류하되, G1 최종 판정은 S0 세 배치의 S5까지 완료한 결과로 한다.** 첫 21문항의 57.1%는 중간 결과이며 시범 수정·재검수 완료 수율이 아니다.

### 4학년 추가 낱말 후보 생성 시작 (Codex, 2026-11-06 12:06 KST)

- 현재 목록으로 낱말 다양성 목표를 채울 수 없어 O-A1 보충 2라운드 후보 **180개를 60개씩 3묶음**으로 요청했다. PID **79448**, 실행기 `.orchestrate/generate-g4-r2-wordlist.mjs`, 상태 `.orchestrate/wordlists/g4-r2/summary.json`, 로그 같은 폴더의 `run.out`. 기록 시점에는 첫 묶음·Argon 1회 호출 진행 중이다.
- 모든 학년의 기존 초안·완성 staging·기존 낱말 목록에서 **2,308개 표제어**를 제외했다. 각 묶음의 입력·답장·SHA-256을 남기고, 개수·중복·형식·정본 성취기준 코드 검사를 통과한 후보만 합친다. 제한된 `agy` 호출이며 명령 실행·파일 쓰기를 금지했다. 출력은 `.orchestrate/wordlists/g4-r2/candidates.json`, **`checked:null`의 미검수 후보**다.
- 다음 단계는 **Codex O-C5 독립 검사와 사전 근거 확인**이다. 후보가 생성됐다는 이유로 제작용 `checked:true`나 공개 승인으로 세지 않는다. 추적 낱말 목록·콘텐츠는 아직 변경하지 않았다.
- 4학년 S3 PID 55822, 기존 앞단 종료 대기 PID 25037, 5학년 보충 제작 PID 78689는 계속 실행 중이다. 자원 보호 상태는 다른 보호 작업 실행 중이며, 5·6학년 기존 시범 잠금 반영은 보류 상태다. 이번에는 새 후보 생성 요청·실행기 구문 확인만 했고 제품 시험은 미실행이다.

### 4학년 보충 1라운드 제작 완료·5학년 확대 (Codex, 2026-11-06 11:55 KST)

- **022~027 여섯 배치 제작 완료: 172생성·128반려.** 반려는 사전 근거 불확정 120, 학년 근거 형식/정본 오류 7, 기타 1이다. 027은 24생성·26반려, Argon 3회였다. 메인이 027의 76파일을 새로 확인했고 이전 5배치 검사는 재사용했다. 누계 **1,067파일**의 무결성·ID 중복·초안/sidecar 수 대조를 마쳤다. 기록 `.orchestrate/g4-supplement.staging-audit.json`. 아직 콘텐츠 반영·공동검수 완료는 아니다.
- PID **25037**은 `awaiting-original-front`: PID 55822가 끝난 뒤 여섯 배치를 잠금 반영하고 새 배치 앞단을 실행하도록 기다린다. PID 55822는 S3 수정 진행 중이다. 기존 프로세스는 재시작하지 않았다.
- 027의 반려 26개도 같은 근거로 재확인해 제작용 목록에서 제외했다(19개 출처·7개 학년 근거, 누적 제외 **73개**). 현재 운영 목록은 **128·78개**, 선택 가능한 남은 칸은 **130개**다. 원래 추적 낱말 목록은 그대로이며 백업·근거는 `source-exclusions/`에 보존했다.
- 보충 172문항의 고유 새 낱말은 **120개**, 낱말당 최대 2문항이다. 기존 4학년 366개와 합계 **486개**이며, 남은 목록의 미사용 낱말은 56개다. 모두 써도 542개이므로 계획의 560개 목표에는 **추가 새 낱말 목록이 필요**하다. 이는 공개분이 아닌 초안 기준 상한이다. `.orchestrate/g4-supplement.diversity.json` 참조.
- 5학년 보충 시범 `Q50-G5-022`는 **5생성·반려 0**, Argon 2회로 완료됐다(PID 76211 종료). 메인이 15파일 해시·스키마·4보기 자체 반박(정답만 fits)·배치 엄격 검사를 직접 확인했다. `.orchestrate/g5-produce-pilot.review.json` 참조. 시범은 `.orchestrate/produce-pilots/Q50-G5-022/20261106T024031625Z-76211-4576f1/`에 보관했으며 본 제작 수에 중복 계산하지 않는다.
- 그 뒤 PID **78689**로 5학년 보충 **022~027 각 50개 요청**을 시작했다. 현재 022 제작 중이다. 실행기 `.orchestrate/run-g5-supplement.mjs`, 상태 `.orchestrate/g5-supplement.summary.json`, 로그 `.orchestrate/g5-supplement.out`. 사전 준비에서 반려된 후보는 해당 배치의 근거와 기존 `prepare`로 다시 확인하고, 같은 출처/학년 근거 오류가 재현될 때만 운영 목록에서 제외해 다음 배치의 반복 반려를 막는다. 입력 백업·제외 기록을 보존한다. 여섯 배치 완료 후에는 staging을 보존하고 멈추며, 공용 gate summary·추적 콘텐츠·Claude 관문은 자동 실행하지 않는다.
- 5·6학년 기존 시범 반영을 자원 보호 도구에서 추가로 최대 600초 대기했으나 **종료 75, 실행 안 됨**이다. `.orchestrate/pilot-results-apply.wait.json`에 기록했다. `.orchestrate/apply-pilot-results.mjs`는 자원 허용 시 두 배치를 차례로 잠금 반영하는 준비된 실행기다. 이번에는 제품 코드를 고치거나 시험을 재실행하지 않았다.

### 6학년 시범 복구 완료·W2f 후속 수정 (Codex, 2026-11-06 11:32 KST)

- PID 72343은 Argon CLI 시간 초과로 종료했다. 단일 대화에 DONE 답장이 남아 있었지만, **`measuredAgyCall`의 별도 실행기가 `AGY_TIMEOUT` 오류 코드를 빠뜨려 복구 진입 자체가 누락**됐다. `review.mjs`의 그 경로를 고쳤다. 실제 타이머·자식 close 경로의 신규 회귀가 수정 전 실패하고 수정 후 통과했다. 관련 3파일 **47시험**, 시험 타입, 변경 범위·전체 린트 통과. 전체 단위시험·verify·e2e·서버 시험은 미실행이다.
- 기존 Argon·Codex 본 판정은 원래 입력 전문·현재 대상·스키마·모델 설정을 대조해 **2회분 모두 재사용**했다. 누락된 Codex 표본 **2문항만 1회** 호출했고, 8문항의 수준 판정 staging이 완료됐다. 복구 PID 75243도 정상 종료했다. 자동 복구가 실제 호출에서 성공한 것으로 보고하지 않는다(이번 결과는 검증 후 명시적 재사용).
- 원본·해시·실행 결과·직접 검사: `.orchestrate/recovery/g6-pilot-level/{archive,summary,audit}.json` 및 같은 폴더의 transcript/log/Codex 답장. 새 staging은 `.orchestrate/staging/Q50-G6-001/20261106T023044775Z-75243-d33c1a1a-1d89-4d0b-a59e-ff385322d183/`. 2파일 SHA-256과 본문 해시 불변을 확인했고 **staging 기준 최신 48문항의 수준 판정 대기 0**이다.
- 자원 보호 상태는 여전히 다른 보호 작업 실행 중이다. **5·6학년 모두 잠금 반영·서버 시험 대기**이며 모델을 다시 호출하지 않는다. 6학년 결과는 수준 판정 파일/초안만 바꿔 W1b의 새 검수 `run` 필드와 무관하므로, 자원이 허용되면 기존 4학년 루프 종료 전에도 잠금 반영할 수 있다. 4학년 기존 실행은 중지·재시작하지 않았다.

### 보충 5배치·6학년 시범 재개 (Codex, 2026-11-06 11:16 KST)

- 보충 026은 **24생성·26반려**, Argon 4회로 완료했다. 반려 26건은 모두 사전 근거 불확정이다. 022~026 누계 **148생성·102반려**이며, PID 25037은 마지막 027을 제작 중이다.
- 026의 151파일을 새로 대조했고 이전 4배치 검사는 manifest 해시가 그대로여서 재사용했다. 누계 **991파일·148문항**의 무결성 확인 기록은 `.orchestrate/g4-supplement.staging-audit.json`에 있다. 027의 실제 사전 조회 입력 50개에서 누적 제외 후보 47개와 겹침이 **0개**임을 확인했다. 생성 수는 공동검수 승인 수가 아니다.
- 6학년 시범 `Q50-G6-001`은 현재 초안 48문항 중 수준 판정 대기 8문항만 실행했다. PID **72343**, `.orchestrate/run-g6-pilot-level.mjs`, 상태 `.orchestrate/g6-pilot-level.summary.json`, 로그 `.orchestrate/g6-pilot-level.out`. Argon High·Codex gpt-6-astra/high 각 1회 호출, Codex 답장은 도착했고 Argon 응답 대기 중이다. 별도 staging만 만들며 자동 잠금 반영·S2·Claude 호출은 하지 않는다.
- PID 55822의 4학년 S3는 계속 실행 중이다. 5학년 시범 staging은 이전 자원 보류 상태로 보존돼 있다. 이번에는 생성물·입력 목록만 확인했으며 제품 시험은 재실행하지 않았다.

### W1b 출처 기록·보충 목록 보완 (Codex, 2026-11-06 11:05 KST)

- 5학년 결과 확인 중 계획의 W1b 항목별 출처가 실제 구현에는 빠져 있음을 확인해 보완했다. 새 독립 검수 항목과 Claude 해설 대조 항목에 `run:{id,model,effort}`를 기록하며, `id`는 해당 staging manifest의 실행 ID다. 기존 항목·아카이브는 다시 쓰거나 추정 출처를 채우지 않는다. 계약은 선택 필드로 받아 옛 보고서를 계속 읽는다.
- 검증: 신규 2시험의 수정 전 실패 확인 → 설정/묶음 43시험 + 콘텐츠/은행 재계산 386시험 통과(**429개**). 앱·시험 타입 검사와 전체 린트 1회 통과. 전체 단위시험·verify·e2e·서버 시험은 미실행이다. 자세한 기록은 `.orchestrate/wp/W1b.md`.
- **실행 중인 PID 55822·25037은 이전 코드/계약을 적재한 상태다.** 재시작하지 않는다. 새 `run` 필드가 있는 staging은 두 기존 실행이 끝난 뒤 반영한다(이전 strict 스키마의 읽기 실패 방지). 5학년 시범의 보존된 staging은 이 변경 전 형식이므로 자원만 허용되면 그대로 반영할 수 있다. 재검수해서 출처를 채우지 않는다.
- 026의 이미 수집된 근거를 기존 `prepare`로 대조해 추가 근거 불확정 후보 **18개**를 확인했다. 제작용 목록은 152·80개로 줄였고, 027부터 적용한다. 누적 제외는 **47개**이며 원래 추적 목록·근거·진행 중인 026은 그대로다. 기록과 입력 백업: `.orchestrate/produce/source-exclusions/g4-026-preflight.json` 및 같은 폴더. 새 모델 호출은 없었다.

### 5학년 시범 앞단 선행 (Codex, 2026-11-06 10:58 KST)

- 4학년 Argon 수정·제작이 진행되는 동안, 별도 시범 `Q50-G5-001`의 S2 Codex 검수를 단일 작업으로 완료했다. **gpt-6-astra/high, 50문항, 독립 풀이·공개 대조 각 1회, 재시도 0**이다. 현재 보고서로 앞단을 계산하면 **36통과·14결함**, 배치 단위 결함은 없다. Claude 관문·공개 승인은 아직 아니다.
- Codex 메인이 staging 2파일 SHA-256, 50문항의 현재 revision·내용 해시, 양쪽 단계의 모델/effort 설정, 기존 보고서 아카이브의 바이트 일치를 직접 확인했다. 기록은 `.orchestrate/g5-pilot-codex.{summary,audit}.json`, 실행기는 `.orchestrate/run-g5-pilot-codex.mjs`다. 검수 프로세스 PID 66632는 정상 종료했다.
- 잠금 반영은 `resource-guard run --profile test --wait-seconds 180`에서 **종료 75**로 보류됐다. 다른 프로젝트의 보호 작업이 진행 중이라 반영·은행 빌드·서버 시험은 **미실행**이며, 이는 시험 실패가 아니다. `.orchestrate/staging/Q50-G5-001/20261106T015324064Z-66632-8d416aaf-6aba-495a-ad9e-7091ce5adf45/`를 보존했다. 자원이 허용될 때 기존 commit-lock CLI로 이 배치부터 반영하며, 모델 검수를 다시 호출하지 않는다.
- 4학년 PID 55822·25037은 계속 실행 중이다. 새 gate 실행으로 공용 `.orchestrate/content-loop.summary.json`을 덮어쓰지 않았다. S4 확대 보류는 유지한다.

### 후속 준비 (Codex, 2026-11-06 10:43 KST 갱신)

- 보충 022~024의 사전 근거 반려 46건은 서로 다른 낱말 21개에서 나왔다. 이 중 10개는 세 배치 모두에서 다시 선택돼 반려됐다. `selectItems`는 수록된 초안만 사용 이력으로 세므로, 제작 전 반려 항목은 다음 배치에 다시 들어가는 구조다.
- 기존 근거 index·원문으로 `prepare`를 재실행해 같은 표제어·품사·뜻 번호의 불확정을 확인했다. 현재 제작용 `.orchestrate/produce/g4-production-list-{1,2}.json`에서 해당 21항목만 제외했다(199·80 → 178·80). 원래 목록·근거·기존 결과는 보존했고 새 모델 호출은 없었다. 제외 기록·입력 백업은 `.orchestrate/produce/source-exclusions/`에 있다.
- 변경 시점에 025는 이미 입력을 읽고 제작 중이므로 그 작업은 그대로 둔다. 026·027부터 새 제작용 목록을 읽는다. 그 시점의 읽기 전용 선택 결과는 남은 274칸으로, 아직 생성·검수된 수가 아니다. 다음 학년에서도 첫 배치 반려가 다음 배치에서 반복되는지 확인한다.
- 이어 완료된 025는 **21생성·29반려**다. 보충 022~025 합계는 **124생성·76반려**, 026 제작 중이다. 025의 사전 근거 반려에서 추가 후보 8개를 같은 방식으로 확인해 제작용 목록을 170·80개로 줄였다(누적 제외 29개). 026은 이미 입력을 읽었으므로 이번 제외는 027부터 적용된다. 근거·목록 백업·판정 기록은 위 `source-exclusions/`에 보존했다.
- 완료된 4배치의 manifest 소유 경로·파일 SHA-256·초안/sidecar 수·문항 ID 중복을 직접 대조했다. **840파일·124문항**이며 모두 기존 은행에 없는 낱말의 문항이다. `.orchestrate/g4-supplement.staging-audit.json`에 기록했다. 이전 3배치 해시 검사는 manifest 해시가 그대로여서 재사용했고, 이번에는 025의 210파일을 새로 확인했다. 이는 생성물 무결성 확인이며 공동검수 승인이 아니다.
- W8의 선행 조사를 완료했다: [출제·풀이 이력 조사](CR1000_W8_RESEARCH.md). 현재 최근 30문항·8뜻 및 복습 뜻당 2회가 새 판 전체 반복 규칙과 충돌한다. 고칠 파일·결정성·저장소/시험 범위를 정리했으며 **구현은 W5 → W6 뒤**, 현재 제품 코드는 변경하지 않았다. 문서만 바뀌어 시험은 미실행이다.

PID 55822의 S3 수정과 PID 25037의 026 제작은 생존 확인했다. S4 확대 보류·공개 승인 12문항 상태는 그대로다. 이번 변경은 운영 목록·인계 기록뿐이며 제품 코드 시험은 미실행이다.

### 최신 재개 결과 (Codex, 2026-11-06 10:22 KST)

- 기존 앞단 PID 22002는 09:37에 종료했다. 종료를 확인한 뒤 002·003·004의 Codex 보고서와 017·018·021의 수준 판정을 잠금 반영했다(`4dd5a15`, `09e911e`, `7111f4b`, `f48f84a`, `90f474a`, `0b6b3e2`).
- **시간 초과 8배치(006·007·010·011·013·016·019·020) 모두 완료 답장이 남아 있었다.** 각 CLI 로그의 대화 ID에 연결된 `transcript_full.jsonl`에서 DONE 답장을 찾았고, 원래 입력 전문과 현재 입력의 일치·모델 설정·대상/스키마를 기존 `runLevels`/`parseReply`로 검증했다. 400문항의 Argon·Codex 판정 16회분을 재사용했으며 새로 전수 판정하지 않았다. 누락된 Codex 표본 판정 22문항만 실제 **8회** 호출(형식 재요청 포함)했고 모두 잠금·서버 시험을 거쳐 커밋했다. 마지막 복구 커밋 `3da6754`.
- 현재 스냅샷으로 **21배치·1,050문항의 최신 수준 판정 대기 0**을 확인했다. 이는 S1 완료 수이지 공개 승인 수가 아니다. 공개 승인은 이전 12문항, 공개 은행 0 상태다.
- 새 실행 PID **55822**: `.orchestrate/run-g4-front-recovery.mjs`가 복구 종료 후 21배치 `--plan`을 확인하고 `--until S3 --pool-after 3 --codex 1 --argon 1`로 앞단을 재개했다. 001·002·003의 앞단 통과는 21·35·18, 결함은 29·15·32로 **76문항 수정 진행 중**이다. S4 확대 보류는 유지한다.
- `.orchestrate/g4-front.run.json`은 새 PID를 가리킨다. 보충 실행 PID 25037은 제작 완료 후 이 실행의 종료를 기다리므로 두 gate가 같은 summary를 동시에 쓰지 않는다. 기존 실행 정보는 `.orchestrate/content-loop-history/front-run-22002.json`에 보존했다.
- 보충 022·023·024: 각각 **39·35·29생성**, 합계 **103생성·47반려**. 46건은 사전 근거 불확정, 1건은 학년 부적합 어휘다. 025 제작 중이며 6배치 완료·공동검수 승인이 아니다.
- `e37df3e`: 앞으로의 agy 호출은 개별 로그를 남기고, 시간 초과 시 해당 단일 대화의 DONE 답장만 입력 전문·대상 검사 후 복구하며 SHA-256 기록을 남긴다. 미완·다른 입력·스키마 불일치·인증 오류는 복구하지 않는다. 진행 중인 프로세스는 이전 모듈을 사용하며 재시작하지 않았다. 실제 CLI 종료 지연의 내부 원인은 미확정이다.
- 검증: 수정 전 회귀 실패 확인 후 agy **16시험**·시험 타입·변경 파일 린트 통과. 전체 린트 1회에서 기존 `wordlist-extract.mjs`의 빈 catch 2건을 발견해 의도 설명만 추가하고 그 파일 린트로 해소했다(전체 재실행 없음). 콘텐츠 반영마다 서버 시험 통과. 전체 단위시험·verify·e2e는 미실행이다.

재개할 때: PID 55822·25037 생존 여부를 먼저 확인한다. 새 실행 상태는 `.orchestrate/g4-front-recovery.summary.json`, 앞단 상세는 `.orchestrate/content-loop.summary.json`, 복구 증거는 `.orchestrate/recovery/level-timeouts/{index,summary,live.summary}.json`이다. 아래 과거의 22002 실행 중·시간 초과 미복구 기록은 이 결과로 대체됐다.

### 최신 실행 결과 (Codex, 2026-11-06 09:00 KST 이후)

- 사용자 지정 계정 연결 확인 뒤 계속 진행 지시에 따라 **Q50-G4-001 앞단 통과 21문항**의 S4를 Opus 5.5/xhigh로 실행했다. 독립 풀이·해설 대조 각 1회, 총 2회 호출, 재시도 0, 6분 27초다. 계정 연결뿐 아니라 실제 관문 호출도 성공했다.
- **12통과·9지적(57.1%)**로 G1 중단 기준 60%에 미달했다. **S4 확대를 보류한다.** 문장 7건(실패 5·불확실 2), 해설 2건(실패 1·불확실 1), 학년 불확실 1건이며 중복이 있다. 공개 기준이나 수정 한도를 낮추지 않는다. 시범 3배치와 S5를 완료한 결과는 아니다.
- `2800b5c`: Claude 보고서·해설 대조를 잠금 반영했다. 4학년 공동검수 승인 레지스트리는 **12문항**, 공개 은행은 **0문항**이다. 최소 공개 수는 `MIN_PUBLISHED=30`이므로 아직 4학년이 열리지 않는다. 3학년 공개 51, 5·6학년 공개 0은 그대로다.
- 자원 대기했던 005는 `37f1a84`, 보존된 008·009·012 판정은 `439684a`·`8142b00`·`37769ac`으로 복구했다. 각 반영은 resource-guard(test)·commit-lock 안에서 은행/키 생성과 서버 시험을 통과한 뒤 커밋했다. 전체 verify·e2e는 미실행이며 이전 도구 변경의 범위 시험 결과는 재사용한다.
- 이어 도착한 014·015도 같은 잠금·서버 시험을 거쳐 `9e46066`·`9fbe797`으로 반영했다. 기존 실행의 summary에 남은 resource blocked 표시는 당시 기록이며 복구 커밋이 현재 반영 상태다.
- 보충 022는 **39생성·11반려**, Argon 5회 호출로 완료됐고 staging에 보존돼 있다. 023 제작 중이며 6배치 전체 완료가 아니다. 생성 수를 공동검수 승인으로 세지 않는다.
- 기존 앞단 PID 22002는 계속 실행 중이나 최초 자원 차단 오류가 유지돼 후속 결과를 자동 반영하지 못한다. 006·007·010·011에서 각각 Argon 1회 호출의 20분 시간 초과가 확인됐다. 이 실패 묶음은 재호출하지 않았다. 성공 결과는 staging에서 잠금 반영해 재사용한다. 실행 중인 기존 작업은 중지·재시작하지 않았다.

다음 작업: S4 확대는 낮은 시범 통과율로 보류한 상태를 유지하고, 기존 S1~S3 및 보충 실행 결과를 확인한다. 기존 앞단 종료 후에는 남은 staging을 먼저 반영하고 실패 원인을 검토한다. 상태 파일은 `.orchestrate/g4-pilot-gate.summary.json`, `.orchestrate/content-loop.summary.json`, `.orchestrate/g4-supplement.summary.json`이다. 아래 08:37 이전 기록의 “S4 미시작”, “005 pending”, “022 완료 0”은 이 결과로 대체됐다.

### 최신 추가 갱신 (Codex, 2026-11-06 08:37 KST)

- 사용자 지정 전환 계정과 CLI 계정의 일치를 확인했다. `loggedIn=true`, `authMethod=claude.ai`, 구독은 **Pro**다. 실제 `claude-sonnet-5-5` 요청도 `OK`로 성공했다. 계정 식별자·인증값은 저장소에 적지 않는다. 로컬 확인 기록: `.orchestrate/claude-auth-check.json`. 남은 사용량 전체를 조회한 것은 아니다.
- 사용자 최신 Claude 배정: **어려운 작업 Opus 5.5/xhigh**, **적당한 작업 Opus 5.5/high**, **잡다한 작업 Sonnet 5.5/xhigh**. `agent-bridge tiers`도 deep / standard / trivial·light 순으로 이 설정과 일치함을 확인했다. S4 공동검수는 어려운 작업으로 분류한다. 이전 Sonnet/high 관문 방침은 대체됐다.
- `c2715da`: 반영 차단 뒤 큐의 신규 모델 호출과 하위 실행기의 후속 호출을 막고, 형식 오류로 감싸져도 최초 자원 차단 사유를 보존한다. 신규 회귀 3건의 수정 전 실패 확인 후 관련 35시험·시험 타입·린트 통과. 진행 중인 PID 22002·25037은 이전 코드를 사용하며 중지·재시작하지 않았다.
- 4학년 002~004의 수준 판정은 커밋 완료. 005는 서버 시험의 자원 대기로 pending을 보존하고 있다. 보충 022는 제작 진행 중이다. 5·6학년 각 21배치 plan도 확인했다(5학년 다음 S1 1,000문항 + S2 50문항, 6학년 다음 S1 1,008문항). 이 숫자는 승인 수가 아니다.

연결 점검 이후 S4 대량 실행은 아직 시작하지 않았다. 실제 실행 상태 파일을 확인한 뒤 재개하며, 계정 연결 확인과 학년별 공개 완료를 구별한다.

### Codex 인계 후 갱신 (2026-11-06)

- W2e 구현: `--gate --until S3`, 인증 실패 즉시 `blocked`(재시도 없음), produce 린트 2건 수정. 첫 판·배치 간 수정·재시작 모두 S4/S5를 실행하지 않는 시험 포함.
- 병렬 제작 준비: produce 근거 조회도 `.orchestrate`에 쓰고 원문·index·초안을 함께 staging한다. 추적 콘텐츠 반영은 commit-lock만 한다.
- 실제 gate의 잠금 반영은 서버 시험을 resource-guard(test)·worker 1로 실행한다. 종료 75는 시험 실패가 아닌 자원 대기다. 독립 commit-lock CLI 반영은 `resource-guard run --profile test -- node tools/orchestrate/commit-lock.mjs apply …`로 보호한다.
- 직접 검증: 관련 5파일의 95시험 통과(마지막 잠금·관문 37시험 재실행, 나머지 58시험 결과 재사용), 시험 타입 검사·변경 파일 린트 통과. 전체 verify·실제 서버 시험·e2e는 미실행이다.
- 기존 시범 루프 PID 826은 S4 실행 금지 지시에 맞춰 중지했다. 기록은 `.orchestrate/content-loop-history/pre-w2e-20261105T224948Z/`에 보존했다. 기존 고부하 작업은 변경하지 않았다.
- 4학년 21배치 plan 확인: 001은 S3 29문항, 002~021은 S1 각 50문항. 실제 실행 결과는 아래 원래 계획과 구분해 후속 기록한다.
- 좁은 단위 시험에는 전체 시험용 자원 대기를 잘못 적용했던 것을 바로잡았다. 전체 시험·e2e·제품 빌드에는 자원 보호를 계속 적용한다.

이 갱신 아래의 Claude 인계 내용은 당시 기록이며, 이미 완료된 W2e를 다시 구현하지 않는다. S4는 사용자 로그인·사용량 회복 통지 전까지 실행 금지다.

#### 실제 실행 상태 (Codex, 2026-11-06)

| 항목 | 확인한 상태 |
|---|---|
| 코드 | `832f2fc` 커밋·push 완료 |
| 4학년 기존 21배치 | PID 22002, `--gate --until S3` 실행 중. 실행 정보 `.orchestrate/g4-front.run.json`, 로그 `.orchestrate/g4-front.out`, 결과 `.orchestrate/content-loop.summary.json` |
| 제작 시범 | 5개 요청 → 4개 생성, 1개(정돈하다)는 사전 근거 불확정으로 제작 전 제외. manifest 24파일 해시를 Codex가 확인. 공개 승인 수가 아님 |
| 시범 기록 | `.orchestrate/g4-produce-pilot.json`, `.orchestrate/g4-produce-pilot.review.json`, 원본 보존 `.orchestrate/produce-pilots/Q50-G4-022/20261105T230134629Z-22003-e701ab/` |
| 보충 6배치 | PID 25037, `Q50-G4-022~027` 각 50개 요청을 순차 실행 중. 실행기 `.orchestrate/run-g4-supplement.mjs`, 상태 `.orchestrate/g4-supplement.summary.json`, PID·로그 `.orchestrate/g4-supplement.run.json`. 기록 시점에는 022 제작 중, 완료 배치 0 |
| 이후 자동 순서 | 6배치 제작 → 기존 앞단 종료 대기(최대 24시간) → 미완 pending 반영 → 새 배치별 잠금 반영 → 새 배치 S1~S3. 오류 시 기록·staging을 보존하고 중지 |

시범의 사전 근거 불확정 1건은 제외한 채 인계서의 3~5문항 시범 범위에서 제작 확대를 판단했다. 원래 낱말 목록은 고치지 않고 `.orchestrate/produce/g4-production-list-{1,2}.json`에서 해당 낱말만 제외했다. 생성 수·공개 승인 수를 구별하고, 배치 완료 수는 실행 상태 파일을 다시 읽어 보고한다. 5·6학년과 3학년 확대, S4 및 최종 공개는 아직 남았다.

Claude 사용량이 바닥나 메인 세션을 Codex로 옮긴다. 이 문서만 읽고 이어서 일할 수 있게 썼다. 계획서와 이 문서가 다르면 **이 문서의 "현재 상태·방침"이 최신**이다.

---

## 1. 목표 한 줄

4·5·6학년(그다음 3학년) 공개 문제은행을 **학년마다 자기 학년 공동검수 승인 1,000문항 이상**으로 만든다. 지금은 4~6학년 공개 승인이 0이라 게임에서 "문제 준비 중"으로 잠겨 있다.

---

## 2. 사용자 결정과 지시 (반드시 지킨다)

| 항목 | 내용 | 언제 |
|---|---|---|
| 수량 | 학년마다 1,000문항 이상, 가능한 한 많이. 학년·수준이 겹쳐도 되고 같은 낱말로 여러 문항도 허용(중복 허용) | 11-05 |
| 분류 | 난이도·수준을 세심한 기준으로 분류(계획서 §3 루브릭 `lv1`) | 11-05 |
| 위임 | Antigravity(Argon High)·Codex(gpt-6-astra high)에 무거운 일을 몰아주고 Claude 사용은 최소로 | 11-05 |
| D1 | 최신 사용자 난이도별 배정에 따라 S4는 Claude Opus 5.5, effort xhigh | 11-06 갱신 |
| D2 | 학년 띠 공유는 학년별 자기 문항 1,000을 넘긴 뒤 켠다. 공유분은 "출제 풀"로 따로 센다 | 11-06 |
| D3 | 기존 Codex rev 1 검수(사전 뜻풀이가 들어가 블라인드가 약했음)는 다시 한다(`--recheck-codex`) | 11-06 |
| D4 | 3학년도 포함. 순서 4 → 5 → 6 → 3 | 11-06 |
| D5 | 아래 학년 공유는 2단계로 미룬다 | 11-06 |
| 공개 규칙 | Argon 자체 반박 + Codex·Claude 독립 풀이 일치 + **Claude 해설 대조**가 모두 있어야 공개(`tools/content/bankBuild.ts` `RULE`). 기준을 낮춰 수를 채우지 않는다 | PRD §9.3 |
| 배포 | 배포·운영 서버 seed 적용은 **사용자 확인 뒤**. `git push`는 묻지 않고 한다 | AGENTS·메모리 |
| 출력 | 사용자에게 보이는 말은 한국어 | 전역 규칙 |

사용자가 따로 바꾼 설정(건드리지 않는다): 2026-11-06 07:09부터 `~/.agents/bridge/config.json`의 `args.antigravity`가 `--mode accept-edits --dangerously-skip-permissions`다(다른 프로젝트용). 브리지로 부르는 Antigravity는 저장소를 읽고 쓸 수 있다. 되돌리기 명령은 사용자만 쓴다.

---

## 3. 저장소 규칙 요약 (AGENTS.md + 이번 작업)

- 작업 폴더는 이 저장소 하나. worktree·복사본 금지.
- 커밋은 자기 파일만 경로 지정: `git add -- <경로> && git commit --only -m "…" -- <경로>`. `git add -A`·`git commit -a`·`git stash`·`git checkout -- .`·`git reset --hard`·`git clean` 금지.
- 남의 미커밋 변경을 건드리지 않는다. 지금 작업 트리에는 다른 세션의 홈 화면·e2e·그림 변경(`src/ui/screens/home/**`, `tests/e2e/home.spec.ts`, `tests/unit/webp-assets.test.ts`, `asset-source/renewal/ART-STUDY1/`, `docs/contracts/prd_v0_5_validation.json`)이 있다.
- `server/**`·`src/persistence/**`·`src/contracts/lobby.ts`를 바꾼 커밋 전에는 `npm run test:server`.
- 콘텐츠 추적 파일(`content-source/**`, `src/content/questions/**`, `server/seed/question_keys.sql`)은 **루프의 잠금(commit-lock) 안에서만** 쓴다. 도구는 `.orchestrate/staging/`에 쌓고 잠금이 반영·빌드·커밋한다(계획서 §8). 예외: 새 배치의 `evidence/`, `content-source/wordlists/**`, `content-source/reference/**`(잠금 허용 경로 또는 직접 커밋).
- 검증 예산: 작업 중에는 바뀐 범위 시험만, 넓은 검사(verify·e2e)는 커밋·인계 직전 한 번. 같은 실패 3회면 멈추고 보고. 기대값을 바꿔 통과시키지 않는다.

---

## 4. 지금 상태 (2026-11-06 07:50 기준)

### 4.1 막혀 있는 것 — 사용자 할 일

**이전 Claude CLI 로그인 만료 기록(현재 해결).** 시범 4학년 배치가 Claude 관문(S4)에서 4번 모두 실패했다.
`.orchestrate/review/claude/Q50-G4-001/chunk0/blind.reply1.md`: `실행 실패: Failed to authenticate: OAuth session expired and could not be refreshed`
- **2026-11-06 사용자가 다시 로그인했다**(`claude auth login` 성공, `auth status`가 `loggedIn: true`). 검수 도구가 부르는 CLI는 `~/Library/Application Support/Claude/claude-code/<가장 새 판>/<hash>/claude.app/Contents/MacOS/claude`다(셸 PATH에는 `claude`가 없다). 다시 만료되면 사용자가 그 파일로 `auth login`을 실행한다(비밀값이라 에이전트가 하지 않는다).
- 08:36 사용자 지정 새 계정(Pro)으로 전환 완료, 실제 Sonnet 요청 성공. 이전 계정의 사용량 소진을 새 계정의 현재 상태로 해석하지 않는다. 정확한 잔여 사용량은 미확인이다.
- **S4가 막혀 있는 동안 공개 승인은 늘지 않는다.** 그 사이 S1~S3(수준 판정·Codex 검수·Argon 수정)와 S6(보충 제작)은 계속 돌릴 수 있다. 이것이 당장의 운영 방식이다(§6 1단계).

### 4.2 시범 루프 — 끝남(마지막 커밋 `4e54fb0`)

- 시범 루프는 끝났다(돌고 있는 프로세스 없음). 마지막 `--plan` 결과: 4학년 001은 S3 수정 29문항, 5학년 001은 S2 Codex 검수 50문항, 6학년 001은 S1 재판정 8문항부터 이어 간다. 4학년 001은 S4까지 갔다가 Claude 인증 실패 4회로 멈췄다.
- **`--plan`을 포함한 모든 `content-loop` 실행에 모델 옵션과 `--recheck-codex`를 붙인다.** 빼면 기본 모델(gpt-6.1-sol)로 보고 이미 gpt-6-astra로 만든 보고서나 예전 "GPT-6 (Codex)" 보고서와 섞지 않으려고 W1a 안전장치가 오류를 낸다(정상 동작).
  `--recheck-codex --claude-model claude-opus-5-5 --claude-effort xhigh --codex-model gpt-6-astra --codex-effort high`

### 4.3 끝난 도구 (모두 커밋, 시험 통과는 Claude가 직접 실행해 확인)

| 조각 | 커밋 | 하는 일 |
|---|---|---|
| W1a | `ab25717` | 검수자별 모델·effort 설정(`--claude-model` 등), 다른 모델 보고서 섞임 거절, `--archive-existing` |
| W4a | `4ba5f3f` | 수준 계약(`src/contracts/levels.ts`)·계산(`tools/content/levels.ts`)·`lintGradeBasisUnit`·`tools/content/coverage-report.mjs` |
| W7 / W7b | `1701824` / `ff0979a` | 보충 제작 `tools/orchestrate/produce.mjs`(낱말×유형 칸, 같은 낱말 학년당 최대 4·다의어 5, 같은 뜻 최대 2) |
| W2a | `5013436` | 앞단 판정 `tools/content/frontGate.ts`, `revise.mjs` 회차 기록(`revise-log.json`, 앞단 2·관문 2) |
| W4b | `6dcc333`·`e0893b5` | 수준 판정 실행기 `tools/orchestrate/level.mjs` |
| W2b | `8d6c809` | 잠금 반영·배치 커밋 `tools/orchestrate/commit-lock.mjs` |
| W2c-1 | `0d43ec2` | `content-loop.mjs --gate`(S1→S2→S3→S4→S5), `--plan`, `--recheck-codex` |
| W9 | `ef5e60e` | 한국어기초사전 등급 조회 `tools/fetch-krdict-grade.mjs` |
| W2d | `c0bebd9` | Antigravity를 브리지 대신 `agy` 직접·제한 권한(봉인 폴더 읽기만, plan 모드, 쓰기 거절 확인)으로 호출 `tools/orchestrate/agy.mjs`, 시간당 40회 상한, 잠금 오염 검사, 커밋 공동 작성자 옵션 |
| W2c-2 | `058e1b6` | 재검수·재판정·수정을 배치를 넘어 묶음(50/12), 모델 호출 실측 |
| Claude 수정 | `87fb38b`·`0282bd2`·`b5bb5a1`·`57f1d01` | 은행 빌드 3~6학년 고정·기준 미달 삭제, 잠금 허용 경로(krdict), Codex CLI 경로 탐색(`codexCliPath()`), fixBatchStrict 범위·관용구 불투명도 표시 |

인계서(git 제외): `.orchestrate/wp/<조각>.md`. 지시서 원본: `.orchestrate/handoff/orders/`.

### 4.4 데이터

| 무엇 | 상태 |
|---|---|
| 4~6학년 기존 초안 | 1,050문항씩(`Q50-G{4,5,6}-001~021`). 공개 승인 0 |
| 3학년 | 공개 51(`grade3.json`), Q50 1,000문항 미공개 |
| 새 낱말 목록 | `content-source/wordlists/g{4,5,6}-r1.json`(200개씩)·`-r1b.json`(80개씩), Codex 검사 완료(`eecc56c`·`8e61270`). 통과 낱말 4학년 250·5학년 266·6학년 241, 유형 칸 415·439·396 |
| 성취기준 정본 | `content-source/reference/curriculum-2022.json` 64개, 공식 PDF와 원문 대조 일치(`b918355`). 기억으로 쓴 코드는 틀린다(예: `[4국04-03]`은 문장의 짜임) |
| 한국어기초사전 등급 | `content-source/reference/krdict-grade.json` 45개만(`3b167af`). 사이트가 지금 접속 시간 초과(차단 추정). 자주 두드리지 않는다 |
| 시범 3배치 | 4학년 001: S1·S2 완료, 앞단 결함 29/50(대부분 Codex 지적: 학년 불확실 16, 문장 11, 해설 11) → 수정 진행, S4에서 인증 실패. 6학년 001: S1·S2·1차 수정 완료, 앞단 통과 40. 5학년 001: S1 진행 중 |

### 4.5 알려진 문제·주의

1. **Codex 쪽 자원 보호(resource-guard) 종료 코드 75**: 그동안 Codex가 조각을 만들 때 시험을 자주 못 돌렸다. 메인 세션에서는 바뀐 범위 시험을 직접 돌려 확인한다.
2. **Antigravity 출력 한도**: 긴 답(낱말 200개 등)은 "exceeded the output token limit"로 이어 쓰고 브리지는 실패(exit 1)로 표시하지만 마지막 완결 JSON 블록이 들어 있다. `node tools/orchestrate/wordlist-extract.mjs <답장> <학년> <제외 낱말>`로 꺼낸다. 도구 안의 호출은 `agy.mjs`가 처리한다.
3. **브리지 Antigravity 전체 권한**: 메인 세션이 브리지로 Antigravity에 직접 일을 시킬 때는 "명령 실행·파일 쓰기 금지, 답장에 JSON"을 붙이고, 끝나면 `git status`로 무단 변경이 없는지 본다. 블라인드 검수는 반드시 도구(`agy.mjs` 제한 호출)로만 한다.
4. **브리지 상한**: 동시 6건·시간당 40회, 다른 프로젝트 세션과 공유. `agy.mjs`는 자체 시간당 40회 상한(`.orchestrate/agy-rate.json`, `--argon-per-hour`).
5. **Codex gpt-6-astra는 예전 모델보다 엄격**하다. 앞단 결함률이 높아도(4학년 001에서 58%) 지적이 실제 품질 문제라 수정 회차가 처리할 일이다. 지적 기준을 낮추지 않는다.
6. **ChatGPT 앱 위치**: `~/Desktop/Developer Tools/ChatGPT.app`. `review.mjs` `codexCliPath()`가 찾는다.
7. 잠금 커밋 메시지의 공동 작성자는 `--co-author` 또는 `COMMIT_CO_AUTHOR`로 실행 주체를 적는다(기본은 Claude). Codex가 돌리면 `COMMIT_CO_AUTHOR="Codex <noreply@openai.com>"`.
8. `produce.mjs`에 기존 ESLint 오류 2건이 남아 있다(W2d 인계 참고). verify 전에 고친다.
9. Claude가 쓰던 `wp/WP-CORE` 브랜치(10/31 중단분)는 쓰지 않는다(AGENTS.md 폐기 절차).

---

## 5. 운영 방침

1. **역할**: Codex 메인 세션 = 총괄(지시·도구 실행·확인·커밋). 무거운 문항 일은 도구가 Antigravity(Argon High, `agy` 제한 호출)·Codex(`codex exec` gpt-6-astra high)·Claude(Sonnet, 관문만)에 나눠 보낸다. 메인 세션은 문항 본문을 읽지 않고 요약(`.orchestrate/content-loop.summary.json`, 커밋 메시지, `coverage-report`)만 본다.
2. **Claude 사용**: 관문(S4·S5의 Claude 재검수)과 D5 학년 확인에만 쓴다. 브리지로 Claude에게 잡일을 맡기지 않는다. 사용량이 회복될 때 관문을 몰아서 돌린다.
3. **Antigravity에 몰아줄 일**: 새 낱말 목록, 보충 문항 제작, 수준 1차 판정, 모든 수정, 성취기준·자료 정리, 두 번째 의견.
4. **확인 의무**: 다른 에이전트(하위 Codex 포함)의 보고는 커밋·diff·시험 실행으로 직접 확인한 뒤 사용자에게 보고하고, 누가 무엇을 했는지 적는다. 수치를 지어내지 않는다.
5. **과검수 금지**: 재판정은 반려된 문항만. 문항 수정은 앞단 2회 + 관문 2회가 끝, 그 뒤 버림 → 보충 대체.
6. **사용자 보고**: 단계(관문)마다 짧게, 표 + "남은 일" 목록. 사용자 결정이 필요한 것만 묻는다. 단계가 끝나면 묻지 말고 다음 단계로 간다(무한 루프·과검수는 금지).

---

## 6. 다음 할 일 (순서대로)

### 1단계 — Claude 없이 앞단을 계속 돌리게 만들기 (지금 바로)

작은 코드 조각 **W2e**(Codex가 직접 해도 되는 크기):
- `content-loop.mjs`에 `--until S3`(또는 `--stages S1,S2,S3`): Claude 관문 앞에서 멈추고 다음 배치로.
- `review.mjs` `claudeCli`: `Failed to authenticate`·`OAuth`·`not logged in`은 형식 오류가 아니라 **인증 차단**으로 분류해 재시도를 쓰지 않고 그 배치의 S4를 "blocked"로 남긴 뒤 멈춘다(사용량 한도는 지금처럼 기다렸다 재시도).
- 시험: 위 두 경로. 그리고 `produce.mjs` 린트 오류 2건.

그다음 4학년 21배치 앞단 가동:

```bash
COMMIT_CO_AUTHOR="Codex <noreply@openai.com>" node tools/orchestrate/content-loop.mjs --root . --gate --until S3 --batches $(ls content-source/batches | grep '^Q50-G4-' | paste -sd, -) --recheck-codex --codex-model gpt-6-astra --codex-effort high --codex 3 --argon 3 --commit > .orchestrate/g4-front.out 2>&1
```

(`--until`은 W2e 이후 이름. 실행 전 `--plan`으로 대상 수를 먼저 본다.)

### 2단계 — 보충 제작 1라운드 (1단계와 병렬)

학년마다 6배치(`Q50-G{N}-022`~`027`). 목록이 여러 개면 함께 넘긴다.

```bash
node tools/orchestrate/produce.mjs run --root . --wordlist content-source/wordlists/g4-r1.json,content-source/wordlists/g4-r1b.json --batch Q50-G4-022 --grade 4 --count 50
```

- 처음 1배치는 3~5문항으로 시범(`--count 5`) 뒤 늘린다. 근거 조회(`fetch-evidence`, 표준국어대사전)는 정상 접속된다.
- 결과는 staging → `node tools/orchestrate/commit-lock.mjs apply --root . --batch Q50-G4-022`.
- 만든 배치도 `content-loop --gate`에 넣는다(새 문항은 S2에서 Argon 새 문맥 검수 1회 포함).

### 3단계 — 사용자가 Claude 로그인·사용량 회복하면 관문

```bash
COMMIT_CO_AUTHOR="Codex <noreply@openai.com>" node tools/orchestrate/content-loop.mjs --root . --gate --batches <앞단 끝난 배치들> --claude-model claude-opus-5-5 --claude-effort xhigh --codex-model gpt-6-astra --codex-effort high --claude 2 --codex 3 --argon 3 --commit
```

- **G1(시범 판정)**: 최신 정책의 Opus 5.5/xhigh로 시범 3배치 S4를 평가한다. 이전 Sonnet 지적률 15% 대조 조건은 현재 배정에는 적용하지 않는다. 단계별 통과율·실측 호출 수로 계획서 §2·§9 숫자를 고친다. 관문 통과율이 0.6 밑이면 멈추고 사용자에게 보고.
- 학년별 공개 승인이 30을 넘는 순간 로컬 게임에서 그 학년이 열린다.

### 4단계 — 학년별 마무리와 그 뒤

1. G2·G3: 학년별 자기 승인 수 확정. 1,000 밑이면 보충 2라운드(새 낱말 목록 O-A1 → Codex 검사 O-C5 → 제작). 목록 지시서 원본은 `.orchestrate/handoff/orders/OA1*.txt`, 제외 낱말 갱신은 `.orchestrate/handoff/oa1-inputs.mjs` 방식.
2. 3학년(D4): Q50-G3 1,000문항을 같은 공정으로. 보충 6배치.
3. 남은 코드 조각(계획서 §6.1): W5(학년 띠 공유, 자기 1,000 뒤·루프 정지 지점에서), W6(학년별 지연 적재 — 홈 화면 파일의 남의 변경이 커밋된 뒤), W8(한 판 반복 규칙), W1b(항목별 출처, 모델을 섞을 때만), W3(선택).
4. S8 공개 전 검사: `npm run build:bank` → `node tools/build-question-keys.mjs` → `node tools/content/coverage-report.mjs --enforce` → `npm run verify` 1회 → `npm run test:server` 1회 → 로컬 서버 seed 적용 뒤 4·5·6학년 한 판 끝까지 + 기록 제출 재채점 확인 → `EXECUTION_BOARD.md`·`HANDOFF.md` 갱신 → 커밋·push. **배포는 사용자 확인 뒤.**

---

## 7. 자주 쓰는 명령

```bash
pgrep -fl content-loop.mjs
```

```bash
node tools/orchestrate/content-loop.mjs --root . --gate --plan --recheck-codex --batches Q50-G4-001,Q50-G5-001,Q50-G6-001 --claude-model claude-opus-5-5 --claude-effort xhigh --codex-model gpt-6-astra --codex-effort high
```

```bash
node -e 'const r=require("./content-source/approvals/registry.json");const by={};for(const e of r.entries){const k=e.questionId.slice(0,2)+":"+e.decision;by[k]=(by[k]||0)+1}console.log(by)'
```

```bash
node tools/content/coverage-report.mjs
```

```bash
node .orchestrate/handoff/front-reasons.mjs "$PWD" Q50-G4-001
```

```bash
npx vitest run tests/unit/content-loop-gate.test.ts tests/unit/content-loop-pool.test.ts tests/unit/commit-lock.test.ts tests/unit/front-gate.test.ts tests/unit/level-runner.test.ts tests/unit/produce.test.ts tests/unit/agy.test.ts tests/unit/orchestrate-config.test.ts
```

---

## 8. 사용자에게 물어야 할 것 (그 외에는 묻지 않고 진행)

- Claude 로그인 재설정(사용자만 가능)과 관문을 돌릴 시점.
- Sonnet 관문이 너무 너그럽다고 판단될 때 Opus 전환(사용량 2~3배).
- 브리지 시간당 상한(`maxRunsPerHour` 40) 상향 여부 — 일정 병목일 때.
- 한국어기초사전 공개 API 키 발급(사이트 차단이 계속되면).
- 배포·운영 서버 seed 적용.

---

## 9. Codex 메인 세션에 줄 첫 프롬프트

```text
너는 이제 towerdeffense 저장소(/Users/bodyking/Desktop/Architecture/towerdeffense)의 CR-1000 메인 세션(총괄)이다. Claude 총괄에게서 인계받는다.
사용자에게 보이는 말은 한국어로 쓴다.

먼저 읽어라(이 순서):
1) docs/CR1000_HANDOFF.md — 현재 상태·방침·다음 할 일(최신 기준)
2) AGENTS.md — 저장소 공통 규칙(단일 폴더, 커밋은 git commit --only, 남의 변경 보호)
3) docs/CONTENT_REVIEW_PLAN.md — 계획서(루브릭 §3, 공정 §4, 지시서 §6, 잠금·커밋 §8)
4) .orchestrate/wp/*.md — 도구 조각 인계서(필요한 것만)

목표: 4·5·6학년(그다음 3학년) 공개 문제은행을 학년마다 자기 학년 공동검수 승인 1,000문항 이상으로. 공개 규칙(Argon 자체 반박 + Codex·Claude 독립 풀이 + Claude 해설 대조)은 낮추지 않는다.

지금 할 일:
1) git status·git log -15·pgrep -fl content-loop.mjs로 상태를 확인한다. 남의 미커밋 변경(홈 화면·e2e·그림)은 건드리지 않는다.
2) 인계서 §6 1단계 W2e(--until S3, Claude 인증 실패를 '차단'으로 분류, produce.mjs 린트 2건)를 구현하고 바뀐 범위 시험을 직접 돌린 뒤 커밋한다.
3) 4학년 21배치 앞단(S1~S3)을 --plan으로 확인하고 백그라운드로 돌린다. 동시에 보충 제작(인계서 §6 2단계)을 5문항 시범 → 6배치로.
4) Claude 관문(S4)은 사용자가 Claude 로그인과 사용량을 회복했다고 알려 줄 때 돌린다. 그 전에는 S4를 돌리지 않는다.

방침:
- 무거운 문항 일은 도구로 Antigravity(Argon High, agy 제한 호출)와 codex exec(gpt-6-astra high)에 보낸다. Claude는 관문에만 쓴다.
- 브리지로 Antigravity에 직접 일을 줄 때는 "명령 실행·파일 쓰기 금지, 답장에 JSON"을 붙이고 끝나면 git status로 확인한다(브리지 Antigravity는 지금 전체 권한이다. 사용자 설정이니 바꾸지 않는다).
- 콘텐츠 추적 파일은 commit-lock 잠금 안에서만 쓴다. 잠금 커밋은 COMMIT_CO_AUTHOR="Codex <noreply@openai.com>".
- 다른 에이전트 보고는 커밋·diff·시험으로 직접 확인한 뒤 보고한다. 수치를 지어내지 않는다.
- 검증 예산: 바뀐 범위 시험만, 넓은 검사는 커밋·인계 직전 한 번. 같은 실패 3회면 멈추고 보고. 기대값을 바꿔 통과시키지 않는다.
- 단계가 끝나면 묻지 말고 다음 단계로 간다. 사용자에게는 인계서 §8의 것만 묻는다. 배포는 사용자 확인 뒤, push는 묻지 않고.
- 보고는 짧은 표 + "남은 일" 목록.
```

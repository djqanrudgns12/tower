# CR-1000 현재 인계

갱신: 2026-11-07 00:21 KST · 총괄 Codex · 작업 폴더 `/Users/bodyking/Desktop/Architecture/towerdeffense` · 브랜치 `p1/intake-round1`

이 문서가 현재 실행 기준이다. 과거 진행 기록과 이전 명령은 [원문 보관](CR1000_HANDOFF_HISTORY_20261107.md)에 **바이트 그대로** 보존했다. 보관본의 Claude 호출·완료된 작업 재실행 지시는 사용하지 않는다. 규칙은 [AGENTS.md](../AGENTS.md), 세부 설계는 [계획서](CONTENT_REVIEW_PLAN.md), 도구 조각은 `.orchestrate/wp/`를 필요한 범위만 읽는다.

## 1. 전체 목표

4·5·6학년, 그다음 3학년 **자기 학년 공개 승인 각각 1,000개 이상**. 공유 유입으로 이 하한을 채우지 않는다. 난이도별 출제 바닥·Normal 심화 바닥, W5 공유 → W6 지연 적재 → W8 반복 규칙, 최종 로컬 게임/서버 재채점 확인까지 남아 있다. 배포는 별도 사용자 확인 대상이다.

## 2. 최신 사용자 결정

- **Claude 역할 제외. 새 Claude 호출/로그인/모델 전환 질문을 하지 않는다.** 사용자가 이후 명시적으로 바꾸기 전까지 Codex·Argon만 쓴다.
- 새 공개 정책 `codex-argon-v1`: 현 판 Argon 자체 반박 + 강한 Codex 독립 풀이 + 현 본문/해설 해시의 Codex 대조. 기존 결함·해시·사전 근거·자연스러운 한국어 조건은 유지한다. 어투 취향만으로 반려하거나 중복 과정을 추가하지 않는다. 실제 조건은 `bankBuild.ts`의 `decide`가 결정한다.
- 무거운 문항 판단은 제한된 `agy`(Argon High), `codex exec`(`gpt-6-astra`, `high`)에 맡긴다. 메인은 문항 본문을 읽어 대신 판정하지 않고, ID/해시/원본 응답 대응/실제 판정 결과를 확인한다.
- Antigravity **브리지 직접 요청**에는 “명령 실행·파일 쓰기 금지, 답장에 JSON”을 붙이고 종료 뒤 git status를 확인한다. 브리지 전체 권한 설정은 바꾸지 않는다.
- Argon 시간당 상한 **40회** 유지. 80회 상향 질문은 이미 보냈으나 답이 없으므로 재질문·임의 변경하지 않는다.
- 단계 완료 뒤 묻지 않고 다음 단계로 간다. 자원 정리를 이유로 진행 중 작업을 종료/재시작하지 않는다. 새 동시 실행을 늘리지 않고 실제 종료한 자리만 이어받는다.
- 남의 미커밋 변경 보호, 단일 폴더, `git commit --only -- <자기 경로>`. 콘텐츠 추적 경로는 `commit-lock` 안에서만 쓰며 `COMMIT_CO_AUTHOR="Codex <noreply@openai.com>"`를 준다.
- 검증은 바뀐 범위만. 통과한 동일 검사를 반복하지 않는다. 같은 실패 3회면 멈추고 증거를 보고한다. 전체/제품 빌드/서버 등 고부하 검사는 resource-guard, worker1. 실패 기대값을 약하게 만들지 않는다.

## 3. 현재 승인 수

`src/content/questions/gradeN.json`의 published·원학년 일치 문항 직접 집계. **운영 배포 수가 아니다.** 최신 계산은 `.orchestrate/cr1000-published-progress.json`.

| 학년 | 최종 승인 | 남은 문항 | 목표 | 문항 진척 | Normal advanced / 최소120 |
|---|---:|---:|---:|---:|---:|
| 4 | 1,156 | 0 | 1,000 | 100% | 122 |
| 5 | 1,021 | 0 | 1,000 | 100% | 68 |
| 6 | 790 | 210 | 1,000 | 79.0% | 16 |
| 3 | 51 | 949 | 1,000 | 5.1% | 0 |
| 합계 | 3,018 | 1,159 | 4,000 | 71.0% | — |

4학년 초과156개·5학년 초과21개는 다른 학년 목표에 합산하지 않는다. 목표에 반영한 수는2,841/4,000이다. staging의 생성/앞단/최종 검수 수를 이 표에 섞지 않는다. 나머지 난이도별 바닥은 최종 coverage에서 별도로 확인한다.

## 4. 실행 소유권

PID는 기록값이므로 `ps`로 실제 생존과 실행 파일을 확인한다. 요약 파일만 보고 종료로 판단하거나 재시작하지 않는다. agy 자식의 전체 command에는 문항 본문이 있으므로 출력하지 않는다.

| 실행 | 확인한 PID | 현재 범위·다음 연결 | 상태 파일 |
|---|---:|---|---|
| 5학년 후반 완료 | 44425 종료 확인 | 016~021 전체289개 반영. 자기 수량1,021개 달성 | `g5-gate-resume-b.summary.json` |
| 6학년 후반 | 16557 | 017~021 S1/S2 진행. 012~016 반영됨 | `g6-gate-fast-b.summary.json` |
| 4→5학년 보충 검수 | 25440 / 조정24838 | 4학년025/027 43개 반영, 026 재검수 중. 종료 뒤5학년022~027 223개 자동 연결 | `supplement-gates.run.json`, `g4-supplement-gate.summary.json` |
| 6학년 보충 제작 | 48074 | 마지막027 제작. 022~026 182생성·메인 audit 완료 | `g6-supplement.summary.json`, `g6-supplement.staging-audit.json` |
| 6학년 보충 검수 예약 | 29054 | 16557/48074 실제 종료 + 022~027 audit6개 뒤 시작 | `g6-supplement-gate-queue.run.json` |
| Normal 심화 시범 예약 | 55045 | 48074 정상 종료 뒤G5-028 → G6-028 각5개 제작 | `normal-advanced-pilots.run.json` |
| Normal 심화 후보 목록 | 조정59577 | 5학년120 → 6학년180 후보. Argon 생성/Codex 독립 확인을60개 묶음으로 겹쳐 진행 | `normal-advanced-wordlists.run.json`, `wordlists/gN-normal-advanced/{summary.json,check/summary.json}` |
| 3학년 예약 | 61279 | 4·5·6 자기 승인 각1000 + 기존 자리/자원 확보 뒤004~023 20배치 | `g3-next-phase.run.json`, `g3-next-phase.plan.json` |

위 상태 경로는 모두 `.orchestrate/` 아래다. 3학년은 아직 **waiting-for-own-1000**, 모델 호출0이다. 6학년210개가 수량 조건에 남았다. 새5학년 낱말 첫60개는 Codex 독립 확인34통과·26제외(출처18/내용8). 메인이 원본/158사전파일/해시/현재 checked 항목 대응을 확인했다. `wordlists/g5-normal-advanced/check/chunk1/audit.json`에 보존했으며, 목록 전체 반영/문항 승인은 아직 아니다. W5 선행 구현 PID60559는 정상 종료했고 그 자리는3학년 예약이 승계한다. 옛 43390/43407 및 front/final-tail 실패 예약은 다시 시작하지 않는다. 원본/실패 기록은 보존했다.

## 5. 완료한 코드와 검증

- W2e·새 정책·현재 판 출처·staging 새 제작분 연결·선택 배치 잠금 반영을 구현했다. S1은 새 실행부터 모델별 자리를 따로 반환한다. Argon 한도 대기는 새 코드에서 다음 예약 만료 시점에 맞춘다. **기존 살아 있는 실행은 이전 코드를 유지하며 재시작하지 않는다.**
- `produce --normal-advanced`: standard/polysemy, 짧은 상황 판단 목표, 실제 전투 읽기 상한 초과 시 재작성1회 뒤 제외. 잠정 tier/점수를 강제하지 않는다. 제작34·staging2시험/린트/시험 타입 통과(`82e2d1e`).
- W5 오답 노트 `(bankId,senseKey)`·저장소v2/이전·졸업/상한 범위 적용. 오답노트25·서버70시험/린트/시험 타입 통과(`0763502`).
- W5 순수 선택 `tools/content/gradeSharing.ts`: 최신 승인 입력에서 자기1000/상한24%, 현 수준 평가·자동 합의·위로1학년 확인, 원 ID/학년 보존. **아직 은행 연결 안 됨**. Codex 작성 후 메인이 코드/단언/명령 성공 출력을 확인했다. 28시험/린트/시험 타입 통과(`5288682`), 기록 `w5-sharing-helper/run.json`.
- 직전 반영 **5학년017~021 242개**: `c14ae2135c3837080b196aba51d621fc6b9e960a`, 38 manifest, 은행/키 생성·서버 시험 통과. 이어 bank-build/question-seed17시험 통과. 실제 현 판 미검수0·결함0·승인 전부 일치 확인.
- 5학년 마무리 반영 **016 47개**: `e38a44be0f654485c17b1d18c2ce123513fddc12`, 17 manifest, 은행/키 생성·서버 시험 통과. 반영 후 bank-build/question-seed17시험 통과. 부모 PID44425의 실제 종료도 확인했다. 5학년 수량 목표는 달성했고 Normal 심화는68/120이라 보충을 계속한다.
- 최신 반영 **4학년025/027 43개(20·23)**: `d1f3eac68017a778d5e44d4ecbd55cdaee985c1e`, 18 manifest, 은행/키 생성·서버 시험 통과, 반영 후 관련17시험 통과. 현재 공개3,018개이나 4학년 초과분 증가라 목표 진척은71.0% 그대로다.
- 직전347개 반영: 6학년008~011 199개 `923e7dc`, 5학년009~011 148개 `254646d`; 각각 잠금/서버·관련17시험 통과. 이전 반영 증거는 `content-loop-history/incremental-apply-<commit>.json`, 최신은 `two-model-incremental-apply.json`.
- 전체 검증 기준 기록 `cr1000-publish-verify.json/.log`: 타입/전체 린트 통과, 최초 단위1395통과3실패. 오래된 fixture 가정3곳 수정 뒤 해당80시험 통과, 나머지 결과 재사용. 제품 변경 없는 콘텐츠 반영마다 전체 검사를 반복하지 않는다. 최종 W5/W6/W8 통합 뒤 필요한 대표 검사는 별도다.
- 현재 남의 변경 `docs/contracts/prd_v0_5_validation.json`은 커밋 제외. 이전 validate:plan이 시간/해시를 갱신했으므로 원래와 바이트 동일하다고 주장하지 않는다. 홈/e2e/그림 등 새 변경이 생기면 다시 소유권 확인.

## 6. 다음 작업

1. 완료 배치만 현재 판 증거를 확인해 선반영한다. 부모의 다른 배치가 진행 중이어도 해당 배치의 `firstPassComplete`, 오류 없음, 모든 단계 종료, native 다음단계 반영대기/대상0, snapshot 미검수/결함0, 실제 `bank.decide` 전부approved면 가능하다. 살아 있는 부모/잠금을 변경하지 않는다.
2. 6학년027 제작 완료 시 기존 audit 방식으로 원본/manifest/해시/스키마/자체반박/ID 충돌을 확인한다. audit6개가 모여야 예약 검수가 열린다.
3. Normal 시범 G5/G6-028 결과는 `normal-advanced/gN/pilot.json`. 제작만으로 승인/심화로 세지 말고 메인 구조 확인 → 실제 S1/독립/최종 검수 후 수율에 따라 확대한다. 새 목록은 `wordlist-g5-r2`/`wordlist-g6-r2` staging을 감사하고 잠금 반영해야 한다. 사전 미확정/독립 반려는 유지한다.
4. 5·6학년 심화 부족을 실제 S1 분포로 채운다. 3학년은 수량 조건을 만족하면 예약이 자동 시작하며, 실제 수율에 따라 보충한다. 3학년 예약은48시간 상한이다.
5. 루프 정지 지점에서 W5 계약/빌드/받는 학년 검사/버전/서버키/철회를 통합한다. 자기1000 전 공유 비활성, 위로1학년/24%, ID·원학년 보존, 받는 학년 tier·버전. 아래 공유D5는 후속 단계로 남긴다. Claude 확인으로 되돌리지 않는다.
6. W5 커밋 → W6 학년별 지연 적재 → W8 한 판 반복 규칙. [W8 조사](CR1000_W8_RESEARCH.md) 참조. 관련 파일의 타인 변경 확인 후 순서대로 진행한다.
7. 최종 은행/키 생성·coverage `--enforce`·대표 verify·서버 시험, 로컬 seed 뒤4·5·6학년 게임 완주/기록 제출 재채점, EXECUTION_BOARD/HANDOFF 갱신·커밋·push. 새 검증은 바뀐 범위·필요 증거로 제한한다. 운영 배포/운영 seed는 사용자 확인 뒤.

## 7. 이어받는 명령과 증거

```bash
git status --short
git log -15 --format='%h %s'
pgrep -fl content-loop.mjs
node .orchestrate/find-completed-batches.mjs
node .orchestrate/published-progress.mjs
```

완료 배치 도구는 알려진 원래/보충/3학년 summary에서 메타데이터와 실제 판정만 확인한다. `.orchestrate/incremental-ready-candidates.json`은 후보 목록이며 반영기가 한 번 더 재확인한다. 반영 대상은 **현재 ready 목록에서 명시적으로 골라** `CONTENT_APPLY_TARGETS`에 `{배치ID: summary파일의 .summary.json 앞 이름}` JSON으로 넣는다. 과거 manifest/준비 JSON으로 다시 apply하지 않는다.

```bash
COMMIT_CO_AUTHOR="Codex <noreply@openai.com>" resource-guard run --profile test -- node .orchestrate/apply-completed-batches.mjs
AUDIT_CONTENT_BATCH=Q50-G6-027 node .orchestrate/audit-g6-supplement.mjs
node .orchestrate/wordlists/normal-advanced/audit.mjs 5
node tools/content/coverage-report.mjs
```

새 검수의 native `--plan`에도 `--without-claude --recheck-codex --codex-model gpt-6-astra --codex-effort high`를 명시한다. 현재 실행의 실제 인자는 각 run/plan JSON을 재사용한다. 새 문항은 기존 예약의 fresh Argon 설정을 유지한다. 메인 보고는 짧은 표(최종 승인/남은/목표/%)와 남은 일로 쓴다.

## 8. 사용자에게 물을 것

- 배포·운영 서버 seed 적용.
- 시간당 상한 상향은 이미 답변 대기이므로 다시 묻지 않는다. 40 유지.
- 사전 사이트 차단이 지속돼 공식 API 키가 꼭 필요할 때만 발급 요청.
- 그 외 승인된 작업·단계 연결·push는 묻지 않고 진행한다. Claude 관련 질문은 불필요하다.

# CR-1000 인수인계 — Claude 총괄 → Codex 메인 세션

작성 2026-11-06 · 작성 Claude Opus 5.5(총괄) · 받는 쪽 Codex(메인 세션)
같이 읽을 것: [계획서 CONTENT_REVIEW_PLAN.md](CONTENT_REVIEW_PLAN.md)(기준 문서), [AGENTS.md](../AGENTS.md)

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
| D1 | Claude 관문(S4)은 Claude Sonnet 5.5, effort high | 11-06 승인 |
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

**Claude CLI 로그인 만료.** 시범 4학년 배치가 Claude 관문(S4)에서 4번 모두 실패했다.
`.orchestrate/review/claude/Q50-G4-001/chunk0/blind.reply1.md`: `실행 실패: Failed to authenticate: OAuth session expired and could not be refreshed`
- 사용자가 터미널에서 `claude`를 실행해 다시 로그인해야 한다(비밀값이라 에이전트가 하지 않는다).
- Claude 사용량도 거의 소진됐다. 로그인 뒤에도 사용량이 회복될 때까지 S4는 한도 대기에 걸린다.
- **S4가 막혀 있는 동안 공개 승인은 늘지 않는다.** 그 사이 S1~S3(수준 판정·Codex 검수·Argon 수정)와 S6(보충 제작)은 계속 돌릴 수 있다. 이것이 당장의 운영 방식이다(§6 1단계).

### 4.2 시범 루프 — 끝남(마지막 커밋 `4e54fb0`)

- 시범 루프는 끝났다(돌고 있는 프로세스 없음). 마지막 `--plan` 결과: 4학년 001은 S3 수정 29문항, 5학년 001은 S2 Codex 검수 50문항, 6학년 001은 S1 재판정 8문항부터 이어 간다. 4학년 001은 S4까지 갔다가 Claude 인증 실패 4회로 멈췄다.
- **`--plan`을 포함한 모든 `content-loop` 실행에 모델 옵션과 `--recheck-codex`를 붙인다.** 빼면 기본 모델(gpt-6.1-sol)로 보고 이미 gpt-6-astra로 만든 보고서나 예전 "GPT-6 (Codex)" 보고서와 섞지 않으려고 W1a 안전장치가 오류를 낸다(정상 동작).
  `--recheck-codex --claude-model claude-sonnet-5-5 --claude-effort high --codex-model gpt-6-astra --codex-effort high`

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
COMMIT_CO_AUTHOR="Codex <noreply@openai.com>" node tools/orchestrate/content-loop.mjs --root . --gate --batches <앞단 끝난 배치들> --claude-model claude-sonnet-5-5 --claude-effort high --codex-model gpt-6-astra --codex-effort high --claude 2 --codex 3 --argon 3 --commit
```

- **G1(시범 판정)**: 시범 3배치의 S4 결과로 Sonnet 지적률을 본다. 15% 미만이면 Opus 5.5로 20문항을 따로 풀려 관대함을 대조(D1). 단계별 통과율·실측 호출 수로 계획서 §2·§9 숫자를 고친다. 관문 통과율이 0.6 밑이면 멈추고 사용자에게 보고.
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
node tools/orchestrate/content-loop.mjs --root . --gate --plan --recheck-codex --batches Q50-G4-001,Q50-G5-001,Q50-G6-001 --claude-model claude-sonnet-5-5 --claude-effort high --codex-model gpt-6-astra --codex-effort high
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

# 현재 작업 게시판

기준일: 2026-10-31 · 현재 구간: **5b5977a 검수 결과를 PRD대로 복구한 통합 브랜치 `integrate/prd-recovery`(로컬, push 안 함) + Q50 83배치 3주체 공동검수 자동 루프 가동 중.** 게임은 공개 은행만 싣는다(3학년 공개 문항은 공동검수가 끝나는 대로 늘어난다. 4~6학년은 공개 은행이 생길 때까지 '문제 준비 중'). 후보 은행은 게임에 싣지 않는다(PRD §9.3) · 총괄: Claude Opus 5.5 · 다른 컴퓨터로 옮길 때는 [인계서](HANDOFF.md) §1·§2·§5

기준: 브랜치 `p1/intake-round1`(origin에 push함, `main`에는 아직 병합 안 함). 1차 수합은 `bc3ee07`, 밸런스 `0.4-candidate`는 `ea7ffe4`. 2차(QR-001·QR-002·RIG-001)는 집 Mac 작업 폴더(`bc3ee07`)에서 돌았고 2026-10-29 수합했다. 3차 ART-002는 `ea7ffe4`를 `baseCommit`으로 요청서를 쓰고 집 Mac에 작업 폴더를 만들었다(요청서는 2차 수합 커밋에 들어갔고, 작업 폴더에는 복사본을 둠). 붙여 넣을 프롬프트는 [발행용 프롬프트](work-packages/DISPATCH.md)에 있다.

| jobId | 상태 | 담당 | 소유 범위 | 선행 |
|---|---|---|---|---|
| CORE-P1 | 구현됨 · 독립 검토 반영 | 총괄 Claude | `src/domain/**`, `src/application/**`, `src/persistence/**`, 공유 계약 | — |
| [REVIEW-CORE-001](work-packages/REVIEW-CORE-001/RETURN.md) | **ACCEPTED** — 결함 10건 수정, 시험은 `tests/unit/review-core/` | Codex(검토 문맥) | `tests/review/**` | — |
| [UI-AUDIT-001](work-packages/UI-AUDIT-001/RETURN.md) | **ACCEPTED** — CSS 들임, 계약 변경 7건 반영(휴대폰 트레이 한 행은 §12.4대로 되돌림) | Argon 4 | `src/ui/**/*.module.css`(공통 제외) | — |
| [ART-SAMPLE-001](work-packages/ART-SAMPLE-001/RETURN.md) | **ACCEPTED** — 13장 `integrated_pass`, 대장 2·피격 1은 `visual_pass` 보류 | Codex 이미지 | `asset-source/incoming/ART-SAMPLE-001/**` | — |
| [Q20-001](work-packages/Q20-001/RETURN.md) | **RETURNED · 공동검수 대기** — 검사 통과, 정답 없는 입력 생성됨 | Argon 4 | `content-source/batches/Q20-001/**` | — |
| [QR-001/QR-002](work-packages/QR-001/REQUEST.md) | **ACCEPTED** — 독립 풀이 40/40이 정답과 같음. 총괄 해설 대조를 더해 승인 14·격리 6(`content-source/approvals/registry.json`, PRD §18.4) | Codex·Claude 새 문맥 | `content-source/reviews/Q20-001/*` | Q20-001 반환 ✓ |
| [RIG-001](work-packages/RIG-001/RETURN.md) | **ACCEPTED** — 3파일 들임, 렌더러 연결 4건은 총괄이 반영, `enemy.walker.hit` `integrated_pass`(1440×900 전투 캡처로 확인) | Claude 새 문맥 또는 Codex | `src/game/animation/**` | ART-SAMPLE-001 인수 ✓ |
| [Q20-002](work-packages/Q20-002/RETURN.md) | **ACCEPTED** — 20문항 중 승인 17(새 14 전부, 고친 판 0011·0013·0017), 격리 3(고친 판 0004·0006·0015: Codex language·grade uncertain) | Argon 4 | `content-source/batches/Q20-002/**` — 격리 6문항 revision 2 + 새 문항 14개. 공개 은행에 승인 16문항 이상이 더 필요 | QR 수합 ✓ |
| [QR-003/QR-004](work-packages/QR-003/RETURN.md) | **ACCEPTED** — 독립 풀이 40/40 정답과 같음. Codex fail 0·uncertain 3, Claude fail 0·uncertain 0. 총괄 해설 대조 20/20 pass. 결과: **승인 31 → 첫 공개 은행 `src/content/questions/grade3.json`(`pub-b95a56e39f57`)** | Codex·Claude | `content-source/reviews/Q20-002/{codex,claude}.json` | Q20-002 수합 ✓ |
| [Q20-003](work-packages/Q20-003/RETURN.md) | **ACCEPTED** — 20문항 모두 승인(마지막 수정 3 + 새 17). Argon은 브리지로 두 번, 셸 없이 파일만 썼고(근거는 총괄 `fetch-evidence`), 검사는 총괄이 돌림 | Argon 4 | `content-source/batches/Q20-003/**` | QR-003 ✓ |
| [QR-005/QR-006](work-packages/QR-005/RETURN.md) | **ACCEPTED** — 독립 풀이 40/40 정답과 같음, Codex·Claude 모두 fail·uncertain 0. 총괄 해설 대조 20/20. **공개 은행 51문항(`pub-965fc76be294`)** | Codex·Claude | `content-source/reviews/Q20-003/{codex,claude}.json` | Q20-003 수합 ✓ |
| P1-REST | **완료** — A26 철회 목록·설치 자리 목록·문맥 손실 복구·첫 연습 판에 이어 소리(2026-10-29, WebAudio 합성, `src/ui/audio/sound.ts`) | 총괄 | 제작 음원으로 바꾸는 일은 공개 전 별도 작업 | — |
| QR-PRACTICE | **완료**(2026-10-30) | Codex·Claude 검토 | 연습 전용 4문항 공동검수 통과(QP-001 3문항, QP-002 1문항 수정본). `practice.json`은 공개본 `pub-c5d049f5a4f3` | 공개 전 |
| [ART-002](work-packages/ART-002/RETURN.md) | **ACCEPTED** — 11장 HOLD 0, 실제 전투(1440×900)에서 지면 조립으로 확인해 모두 `integrated_pass`. 총괄이 agent-bridge로 Codex에 세 번 나눠 전달(15분 상한) | Codex 이미지 | `asset-source/incoming/ART-002/**` — 정원 지면 질감·설치 받침·작은 장식 11장 | ART-SAMPLE-001 ✓ |
| CORE-P2 | **진행 중**(2026-10-29) — P2-1 엔진, P2-2 분기 14개, P2-3 렌더러 기반, P2-4 S11 타워 효율(`npm run simulate:towers`) 완료. 밸런스 `0.4.2-candidate`(마법탑 95골드·16, 창병 70골드·7). **깃발은 PRD §7.5 ① 미달(0.30) — 사용자 결정 대기**. S11 기준 ②(10종 전략) 네 난이도 통과(2026-10-30, 가상 플레이어 수정). ART-003 `visual_pass` 인수. 남은 것: P2 타워 게임에서 열기·전투 확인 뒤 `integrated_pass` | 총괄 | `src/domain/**`, `src/game/**`, `src/ui/game/**`, `tools/sim/**` | G2 ✓(실기기 제외) |
| [QP-001](work-packages/QP-001/RETURN.md) / [QP-002](work-packages/QP-002/RETURN.md) | **ACCEPTED**(2026-10-30) — 4/4 승인. QP-001 0001~0003, QP-002에서 0004(빠르다)를 바른 사용 유형으로 고친 판이 QR-009(Codex)·QR-010(Claude)과 총괄 해설 대조를 통과. 연습 은행 공개본 `pub-c5d049f5a4f3` | Argon 4·Codex·Claude | `content-source/batches/QP-00{1,2}/**` | — |
| [ART-003](work-packages/ART-003/RETURN.md) | **수합(visual_pass)** — P2 타워 7종 13장, HOLD 0, 10종 비교판에서 실루엣 구별. P2 타워를 게임에서 열 때 전투로 확인해 `integrated_pass`로 올린다(지금은 게임이 싣지 않음) | Codex 이미지 | `asset-source/incoming/ART-003/**` | ART-002 ✓ |
| Q50-G3~G6(83배치) | **ACCEPTED(후보 은행 4,139문항)** — 3학년 20배치(`Q50-G3-002`~`021`) + 4·5·6학년 각 21배치(`Q50-G{4,5,6}-001`~`021`) 총 4,150문항 제작. 표준국어대사전 실증 근거 해시·4단계 심화도(`basic`/`core`/`advanced`/`challenge`)·유형 태그(`standard`/`polysemy`/`confusable`/`idiom_proverb`/`dialect`) 반영 | Antigravity(Argon) | `content-source/batches/Q50-*/**` | — |
| QR-CODEX-Q50 | **반영 완료**(2026-10-30) — 외부 GPT-6(Codex) 83배치·4,150문항 전수 블라인드 검수(`content-source/reviews/Q50-*/codex.json`, 원본 무수정 보존). 양쪽 통과 `rev: 1` 2,695문항 유지 + 지적된 1,455문항 `rev: 2`(및 5·6학년 113문항 `rev: 3`) 전면 보완·새 문맥 블라인드 재검증 완료. `build:bank`가 `src/content/questions/grade{3,4,5,6}.candidate.json` 구축(**3학년 1,035 · 4학년 1,017 · 5학년 1,043 · 6학년 1,044**, 합계 4,139문항; Claude 공동검수 추가 전 `verified_candidate` 등급) | Codex · Antigravity(새 문맥 블라인드) | `content-source/reviews/Q50-*/{codex,argon-blind}.json`, `content-source/approvals/Q50-*.explanation.json`, `src/content/questions/grade{3,4,5,6}.candidate.json` | Q50-G3~G6 ✓ |

Q20-002의 소유 경로(`content-source/batches/Q20-002/**`)는 ART-002와 겹치지 않는다. 반환되면 QR(Codex·Claude)을 다시 돌린다. ART-002의 소유 경로(`asset-source/incoming/ART-002/**`)는 2차 수합 대상(`src/game/animation/**`, `content-source/reviews/**`)이나 총괄이 수합 때 고칠 렌더러(`src/game/**`)와 겹치지 않는다. QR-001·QR-002는 정답 키가 있는 `content-source/batches/**`를 뺀 작업 폴더에서 돌린다(발행용 프롬프트의 sparse checkout). 총괄만 공유 schema/package/lockfile/전역 토큰/라우터/인덱스를 수정한다. ACCEPTED는 총괄이 검사 후 부여한다.

1차 작업 폴더와 `wp/*` 브랜치는 반환물이 본 저장소와 같음을 확인한 뒤 지웠다. UI-AUDIT-001의 전후 캡처와 원래 CSS 패치는 [UI-AUDIT-001 폴더](work-packages/UI-AUDIT-001/)의 `shots/`·`returned-css.patch`로 보존했다. RIG-001이 도는 동안 총괄은 `src/game/animation/**`를 고치지 않는다.

측정된 성과(2026-10-30, 집 Mac): `npm run verify`(타입·ESLint, 단위·속성 시험 25파일 142개, PRD 검산, 문항·에셋 manifest 검사, 승인 레지스트리 재계산 대조), Playwright e2e 8개(실제 원화·저장 이어하기·키보드·문맥 손실·연습 판 포함), `npm run build` 성공(JS gzip 약 522KB), S11 기준 ② 네 난이도 통과. 1440×900 실제 전투 연속 캡처(보행·피격·감속)는 2026-10-29. 실기기·장시간 성능·학생 실측·배포는 미실행. 최신 결과는 [인계서](HANDOFF.md) §8을 따른다. 집 Mac의 작업 폴더 `../tower-wp/*` 7곳은 반환물이 본 저장소와 같음을 확인했고, 사용자 확인 뒤 지운다.

## PRD 복구 통합(2026-10-31, 총괄 Claude Opus 5.5)

5b5977a(문항 4,139개·로비·UI v3) 검수에서 나온 PRD 위반을 작업 패키지 네 개로 나눠 고쳤다. 각 패키지는 전용 worktree(`../tower-wp/<id>`)에서 돌았고, 소유 경로 밖 변경은 수합기가 기계적으로 거부한다. 통합 브랜치에는 네 패키지가 모두 병합되어 있다.

<!-- orchestrate:begin -->
| 작업 | 담당 | 상태 | 회차 | 검사 | 범위 위반 | 내용 |
|---|---|---|---:|---|---:|---|
| WP-NET | codex | ACCEPTED | 6 | 3/3 | 0 | 공개 기록·로비를 PRD §15·§16에 맞춤(익명 인증 소유권, 서버 재채점, 동의, 저장 계층 결함) |
| WP-SAVE | subagent | ACCEPTED | 0 | 3/3 | 0 | 저장·이어하기(PRD §14)와 첫 연습 판(§12.2) 복구 |
| WP-UI | subagent | ACCEPTED | 0 | 4/4 | 0 | UI 결함 수정(제출 흔들림, 버닝 표시, 모달 포커스, 13px·44px 하한, 레이아웃 계약화) |
| WP-CORE | commander | INTAKE_FAIL | 0 | 3/4 | 0 | 출제·은행·공동검수 게이트를 PRD §9에 맞춤(공개 은행만 출제, 난이도 게이트, 후보 판정, 블라인드 입력, 검수 자동화) |

자동 생성: 2026-10-30T21:37:15.091Z · `node tools/orchestrate/wp.mjs board --write`
<!-- orchestrate:end -->

- **WP-NET(Codex, 6회차):** Supabase 익명 인증으로 소유권(`auth.uid()`), 서버 재채점(`question_keys`), 공개 기록 동의(기본 꺼짐 → 네트워크 0회), 별명 개인정보 차단, 동기화 큐 FIFO·일시 장애 무포기, 움직임 줄이기 OS 기본값. SQL은 로컬 PostgreSQL 17로 회귀 시험(3회차). 실제 Supabase 연결·배포는 미검증.
- **WP-SAVE(Claude 서브에이전트):** 2슬롯 자동 저장·저장 후 나가기·이어하기(§14), 첫 연습 판 진입(§12.2), 거래 뒤 Enter 오작동 제거.
- **WP-UI(Claude 서브에이전트):** 제출 흔들림 32.32px → 0.00px(5개 화면 × 정답·오답·모르겠어요), 모달 포커스, 홈·설명서·순위표 13px·44px, 레이아웃 상수 계약화. 버닝 보석 표시(Hud)와 크롬북 compactRail 요약은 리뉴얼 R1로 넘겼다.
- **WP-CORE(총괄):** 공개 은행만 출제, 쉬움·보통에서 도전·관용구·속담·혼동·방언 제외(계약 `difficultyGate`), 한 바퀴 뒤 섞기, `RULES_VERSION 0.5.1-candidate`, 후보 판정에 같은 revision 외부 검수 요구(1,393문항 격리), 공개 판정의 해설 대조는 Claude만 인정, 블라인드 입력에서 사전 뜻풀이 제거.
- **통합 검사(integrate/prd-recovery `f4a069f`):** typecheck·lint 통과, 단위 568, validate:content 366, validate:plan 49/0, e2e 19개 중 18개 통과 + 실패 1건 고친 뒤 단독 재실행 통과, layout.spec 11개 재실행 통과. e2e는 worktree의 node_modules 링크 때문에 대체 글꼴로 돌았다.
- **본 브랜치 병합 대기:** 메인 체크아웃에 사용자 본인의 NEIS 학교 검색 작업(커밋 전)이 `settings.ts`·`App.tsx`·`HomeScreen.tsx`·`SettingsModal.tsx`·`LaunchDeck.tsx`·`home.module.css`·e2e·`lobby.test.ts`에 걸쳐 있어 통합 브랜치와 겹친다. 사용자가 그 작업을 커밋한 뒤 병합하고 충돌을 푼다. 학교 정보는 PRD §2.1("초기 필수 입력으로 수집하지 않는다")에 맞춰 선택 항목으로 둔다.
- **리뉴얼과의 소유권:** 리뉴얼 세션(`docs/renewal/**`, `renewal/*` 브랜치)이 `src/ui/game/**`·`global.css`·`kit.module.css`·`BattleScene.ts`·`useLayout.ts`, 밸런스·타워·웨이브·전투 도메인, `run.ts`·`types.ts`(RULES_VERSION 줄 제외)를 맡는다. R1 수용 시험은 `tests/e2e/layout.spec.ts`. 2×2 보기 기준 200px(코드)과 160px(PRD 계약)의 차이는 R1이 정한다.

### 공동검수 자동 루프

Q50 83배치(4,150문항)는 Argon이 작성하고 자체 반박했지만, Claude 검수와 Claude 총괄 해설 대조가 한 번도 없었다(해설 대조 파일 83개 모두 Argon). 아래 도구로 공동검수 절차 3~6단계를 자동으로 돌린다. 모든 단계는 아직 안 한 것만 처리하므로, 멈춰도 다시 실행하면 이어 간다.

| 도구 | 하는 일 |
|---|---|
| `tools/orchestrate/review.mjs` | 1단계 블라인드(정답·해설·뜻풀이 숨김) → 2단계 공개 대조. Claude는 파일·명령·웹 도구를 막은 CLI로 직접 실행해 블라인드를 권한으로 보장하고, Codex는 `codex exec` 읽기 전용으로 실행한다. 답장 형식 검사 뒤 `reviews/<batch>/<claude|codex>.json`과 Claude 총괄 해설 대조(`approvals/<batch>.explanation.json`, 옛 Argon 대조는 `approvals/archive/`)에 병합한다. |
| `tools/orchestrate/revise.mjs` | 결함 문항을 Argon(브리지, 읽기 전용)에게 돌려 revision을 올린다. 대상 낱말·근거는 못 바꾸고, 스키마·의미 검사·자체 반박을 통과한 답만 반영한다. 고칠 수 없으면 drop으로 `sidecar.rejected`에 남긴다. |
| `tools/orchestrate/content-loop.mjs` | 배치마다 Claude·Codex 검수 → Argon 수정 → 재검수(최대 2회) → `build-bank`. 에이전트 종류별 동시 실행 상한이 있고, 계정 사용량 한도에 걸리면 20분 기다렸다 이어 간다. |

- 시범(2배치): Q50-G3-004는 Claude 블라인드 풀이가 정답 키와 50/50 일치, 지적 20 → Argon 16문항 고침·4문항 버림 → 재검수를 거쳐 3학년 공개 은행 51 → 92문항(`pub-baf804f103a3`, WP-CORE 작업 폴더).
- 본 가동: 2026-10-31 `node tools/orchestrate/content-loop.mjs --root ../tower-wp/WP-CORE --all --claude 2 --codex 2 --argon 2`(nohup). 진행은 `../tower-wp/WP-CORE/.orchestrate/content-loop.log`, 끝나면 `content-loop.summary.json`. 끝난 뒤 WP-CORE 작업 폴더를 수합기로 검사하고 통합 브랜치에 병합한다.
- 남는 위험: Codex rev 1 검수 2,695건은 사전 뜻풀이가 들어간 입력으로 했다(블라인드 약화). Claude 블라인드가 이를 보완한다. 2×2 기준·다의어 태그 관행 차이·보기 길이 단서(가장 긴 보기 정답 약 47%)는 lint 기준이 아직 못 잡는다.

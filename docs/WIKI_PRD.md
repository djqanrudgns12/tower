# 어휘력 타워 디펜스 LLM Wiki 및 문서 자동 갱신 시스템 PRD (WIKI_PRD v1.0)

> 버전 1.0 · 2026-11-16 · 문서 ID: `TD-WIKI-PRD`
> 대상 저장소: `towerdeffense` (어휘력 타워 디펜스 · `vocabulary-tower-defense` 1.0.0)
> 참조 선례: `../rollingthunder` (옵시디언/Karpathy 3계층 LLM Wiki + 코드 실체 판정 + Git Hook 무비용 갱신), `../classlearning` (`wiki/SCHEMA.md` · 초경량 라우터 · 결정적 레지스트리 · `wiki:query` · `wiki:lint` · 무충돌 교훈 델타), 외부 표준(`agentsmd/agents.md`, `llmstxt.org` v2, Diataxis, Progressive Disclosure)

---

## 1. 배경 및 문제 진단

### 1.1 현행 문서 현황 실측 (2026-11-16 기준)

현재 `towerdeffense` 저장소에는 **147개의 마크다운 문서(총 약 2.41MB, 한국어 환산 약 0.65토큰/자 기준 약 156만 토큰)**가 여러 세대에 걸쳐 누적되어 있다.

| 구분 | 파일 수 | 용량 합계 | 주요 병목 및 문제점 |
| --- | ---: | ---: | --- |
| 루트 진입 및 세대별 PRD (`AGENTS.md`, `CLAUDE.md`, `README.md`, `vocabulary_td_prd_*.md`) | 7개 | 약 591KB | 루트에만 PRD 4개 판(v0.1·v0.3·v0.4·v0.5)이 공존. `README.md`가 11월 초 상태("3학년 공개 은행 51문항, P1 첫 구현")에서 멈춰 현행 운영 실체(전 학년 출제 풀 6,583문항, 타워 20종, Workers/D1 운영)와 심각하게 괴리됨 |
| 핵심 운영·리뉴얼·검수 문서 (`docs/*.md`, `docs/renewal/**`, `docs/contracts/**`, `docs/balance/**`) | 48개 | 약 1,090KB | `docs/README.md` 부재. `docs/READ_FIRST.md`가 "실제 게임·콘텐츠 검증 미실행"이라는 구식 문구를 유지 중이며, 리뉴얼 헌장(`docs/renewal/` > PRD v0.5), 호스팅 전환(`DEPLOY.md`), CR-1000 완료(`CR1000_HANDOFF.md`)의 우선순위 관계가 한눈에 보이지 않음 |
| 과거 작업 패키지·보관·원화 검수 (`docs/work-packages/**`, `docs/archive/**`, `asset-source/**`, `content-source/**`) | 92개 | 약 731KB | 2026-11-04 폐기된 `tower-wp` 절차 문서와 과거 라운드 반납서(`REQUEST.md`/`RETURN.md`)가 활성 문서와 섞여 에이전트의 탐색 토큰을 낭비하고 잘못된 절차를 유도함 |

### 1.2 해결해야 할 핵심 문제 4가지

1. **진입 문서 노후화 및 맥락 오염 (Context Rot & Misdirection)**: 새로운 에이전트가 `README.md`나 `docs/READ_FIRST.md`를 읽으면 이미 완료된 P1 초기 단계나 폐기된 Supabase/worktree 절차를 현재 기준으로 오해하거나, 현행 실체를 찾으려고 수십만 바이트의 PRD·인계서를 통째로 읽으며 컨텍스트 창을 소진한다.
2. **검산 도구(`validate-plan.mjs`) 및 코드 경로 고정 제약**:
   - `tools/validate-plan.mjs`가 `vocabulary_td_prd_claude_v0_1.md`, `vocabulary_td_prd_v0_3.md`, `vocabulary_td_prd_v0_4.md`, `docs/assets/design-41-kingdom-expedition.png` 4개 파일의 **SHA-256 해시를 고정 검증**하고, `README.md`·`docs/READ_FIRST.md`·`docs/HANDOFF.md`의 `vocabulary_td_prd_v0_5.md` 링크 포함 여부와 9개 핵심 문서의 로컬 링크·코드 펜스를 검사한다.
   - `tests/unit/*.test.ts`와 `tools/**/*.mjs`가 `docs/renewal/**`, `docs/ui_ux_refinement_p1_v3_prd.md`, `docs/model_work_orders_v0_5.md`, `docs/HOSTING_IMPL_PLAN.md` 등을 직접 참조하므로 **기존 문서의 경로 이동·이름 변경은 금지**되어야 한다.
3. **살아있는 수치·계약의 수동 관리 한계 (Code-Doc Drift)**: 학년별 공개 은행 문항 수(`manifest.json`), 타워 20종·적 10역할·난이도 수치(`balance.candidate.v0.4.json`), 맵 4종(`maps.candidate.v0.4.json`), 서버 API·D1 테이블(`server/`), 원화 에셋(`public/assets/manifest.json`)은 코드·계약 JSON이 바뀔 때 수동 요약 문서가 즉시 낡는다.
4. **다중 에이전트 단일 폴더 작업 충돌**: 이 저장소는 단일 작업 폴더(`AGENTS.md`)에서 `git commit --only -- <경로>`와 `tools/orchestrate/commit-lock.mjs`를 사용한다. 남의 미커밋 변경(예: `docs/contracts/prd_v0_5_validation.json`)이나 `commit-lock` 배치를 침범하지 않는 안전한 자동 갱신·교훈 기록 체계가 필수적이다.

---

## 2. 벤치마킹 및 외부 아키텍처 조사 요약

| 출처 | 채택한 핵심 메커니즘 | 타워디펜스(`towerdeffense`) 맞춤 고도화 |
| --- | --- | --- |
| **롤린썬더 (`../rollingthunder`)** | Karpathy 3계층(원천 보존 · `wiki/` AI 정제 · 규약), `concepts`·`entities`·`projects`·`decisions` 분류, **"문서 헤더가 아니라 코드 실체로 상태 판정"**, Git Hook 기반 **API 비용 0원** 자동 갱신 | 외부 LLM/유료 API 없이 Node 24 표준 라이브러리만으로 코드·JSON 계약·SQL을 정적 분석해 1초 안에 결정적으로 문서를 갱신 |
| **쌤유니버스 (`../classlearning`)** | `wiki/SCHEMA.md`, 초경량 `wiki/index.md` 라우터, 결정적 `wiki:gen` 레지스트리, 절 발췌 `wiki:query`, 결정적 `wiki:lint`(스키마·링크·앵커·예산·출처 SHA-256 해시·명령 실재), ACE식 무충돌 교훈 델타(`wiki/_inbox/`) | 타워 20종·적 역할·맵·문제은행·서버 API/D1 스키마를 즉시 뽑는 `contracts.md` 및 `--tower`/`--enemy`/`--map`/`--bank` 전용 질의 CLI 추가, `validate-plan.mjs` 보존 불변식 읽기 전용 검사(`W09`) 통합 |
| **GitHub / Reddit / 최신 표준** | Linux Foundation `agentsmd/agents.md` 경량 진입점, `llmstxt.org` v2(`llms.txt`), **Diataxis** 4분류 × 생애주기(`docs/README.md`), **Progressive Disclosure**(Hot → Warm → Cold), 마커 블록(`<!-- WIKI-AUTO -->`) 부분 동기화 | 기존 147개 문서를 이동 없이 `docs/README.md`와 `wiki/docs-catalog.md`에서 권위·생애주기·보존 잠금별로 구조화하고, `README.md`·`llms.txt`·`docs/README.md`·`wiki/index.md`의 핵심 수치를 마커 블록으로 자동 갱신 |

---

## 3. 목표 및 설계 원칙

### 3.1 정량 목표

- **탐색 시작 토큰 95% 이상 절감**: 에이전트가 세션 시작 후 작업 대상 원본과 현행 계약을 파악하기까지 읽는 문서를 **≤ 6,000자(약 4K 토큰)** 이내(`AGENTS.md` → `wiki/index.md` → 도메인 허브 1개)로 제한한다.
- **대형 원본 전체 열람 0회**: 20KB 초과 문서(`vocabulary_td_prd_v0_5.md` 241KB, `CR1000_HANDOFF.md` 107KB, `CONTENT_REVIEW_PLAN.md` 61KB, `towers.md` 65KB 등)는 `npm run wiki:query`로 목차와 필요한 절만 발췌한다.
- **자동 갱신 1초 이내 · 외부 비용 0원**: `npm run wiki:sync`는 새 npm 의존성이나 네트워크 호출 없이 Node 24 내장 모듈만으로 1초 이내에 결정적(바이트 멱등) 결과를 생성한다.
- **기존 파일·검산 호환성 100%**: 기존 문서 이동·삭제 0건, 보존 해시 파일 훼손 0건, 남의 미커밋 파일(`docs/contracts/prd_v0_5_validation.json`) 침범 0건.

### 3.2 핵심 설계 원칙

1. **코드와 계약 JSON이 현재 사실의 최상위이며, 위키는 컴파일된 지도다 (`P1`)**: 문서의 옛 상태 표기보다 실제 코드(`src/`, `server/`)와 계약(`docs/contracts/*.json`, `src/content/questions/manifest.json`)이 우선한다. 위키는 사실을 재정의하지 않고 반드시 `sources` 경로로 근거를 연결한다.
2. **계산 가능한 사실은 사람이 손으로 적지 않는다 (`P2`)**: 학년별 문항 수, 타워·적·난이도·맵 스펙, 서버 라우트·D1 테이블, npm 명령, 모듈 지도, 문서 카탈로그는 `tools/wiki/gen.mjs`가 자동 생성한다.
3. **점진적 공개(Progressive Disclosure)를 강제한다 (`P3`)**: Hot(`AGENTS.md`, `llms.txt`, `wiki/index.md`) → Warm(`docs/README.md`, `wiki/concepts/*`, `wiki/contracts.md`, `wiki/codemap.md`) → Cold(`wiki:query` 원본 절 발췌) 3단계를 따른다.
4. **단일 폴더·부분 커밋·잠금 규칙을 침범하지 않는다 (`P4`)**: Git Hook과 동기화 도구는 unstaged 타인 변경이나 `.orchestrate/commit.lock` 실행을 절대 덮어쓰지 않으며, `content-source/**`·`src/content/questions/**`·`server/seed/question_keys.sql`은 읽기 전용으로만 참조한다.

---

## 4. 기능 요구사항 (Functional Requirements)

| 요구 ID | 기능명 | 필수 명세 |
| --- | --- | --- |
| `TD-WIKI-01` | **3단 진입점 및 `llms.txt` v2 표준화** | 루트 `llms.txt`(`llmstxt.org` v2 규격), 현행 실체로 갱신된 루트 `README.md` 및 `docs/READ_FIRST.md`, Diataxis + 권위/생애주기 허브 `docs/README.md`, 1홉 라우터 `wiki/index.md`를 구축하고 `AGENTS.md`에서 연결한다. |
| `TD-WIKI-02` | **3계층 LLM Wiki 지식 구조** | `wiki/SCHEMA.md`(규약·권위 사슬), `wiki/concepts/`(6대 핵심 도메인 허브), `wiki/entities/`(제품·기술스택), `wiki/projects/`(단계 계보 및 코드 실체 판정), `wiki/glossary.md`(고유 용어·약어 사전), `wiki/lessons/`(실제 사고·재발 방지 교훈 원장)를 구축한다. |
| `TD-WIKI-03` | **코드·계약·문서 레지스트리 자동 생성 (`gen`)** | 5종의 결정적 레지스트리(`wiki/commands.md`, `wiki/codemap.md`, `wiki/contracts.md`, `wiki/decisions-index.md`, `wiki/docs-catalog.md`)를 코드와 JSON 계약·SQL·마크다운에서 자동 추출한다. |
| `TD-WIKI-04` | **마커 블록 부분 자동 갱신 (`WIKI-AUTO`)** | `README.md`, `llms.txt`, `docs/README.md`, `wiki/index.md`, `wiki/entities/tech-stack.md` 내부의 `<!-- WIKI-AUTO:START:<id> -->` ~ `<!-- WIKI-AUTO:END:<id> -->` 구간만 최신 실측 수치·표로 안전하게 치환한다. |
| `TD-WIKI-05` | **3중 자동 동기화 (`sync` · `watch` · `hooks`)** | ① 배치 동기화 `npm run wiki:sync`, ② 파일 감시 `npm run wiki:watch`, ③ `git commit --only` 및 `commit-lock.mjs`와 안전하게 공존하는 Git Hook(`pre-commit`, `post-commit`, `post-merge`, `post-checkout`) 설치기 `npm run wiki:hooks:install`을 제공한다. |
| `TD-WIKI-06` | **토큰 절약형 정밀 조회 CLI (`wiki:query`)** | `--toc`, `--section`, `--tower`, `--enemy`, `--map`, `--bank`, `--route`, `--table`, `--decision`, `--lessons`, `--glossary`, `--grep` 옵션을 제공하여 대형 문서 열람 없이 즉시 필요한 절과 계약을 반환한다. |
| `TD-WIKI-07` | **결정적 무결성·보존 검사기 (`wiki:lint` · `wiki:check`)** | frontmatter·ID 유일성(W01), 로컬 링크·앵커 실재(W02), 고아 페이지(W03), 글자 예산(W04), `sources` SHA-256 드리프트(W05), `npm run` 명령 실재(W06), 생성본·마커 최신성(W07), 교훈 불변식(W08), **`validate-plan.mjs` 비파괴 보존 불변식 읽기 전용 검사(W09)**를 수행한다. |
| `TD-WIKI-08` | **출처 해시 스탬프 (`wiki:stamp`)** | 큐레이션 페이지가 인용하는 원본 파일의 SHA-256 해시와 검증 커밋·날짜를 frontmatter에 기록하여 원본 수정 시 재검증 대상을 자동 감지한다. |
| `TD-WIKI-09` | **무충돌 교훈 델타 파이프라인 (`delta` · `curate`)** | 다중 에이전트가 공유 원장을 직접 고치지 않고 `npm run wiki:delta`로 `wiki/_inbox/`에 단일 파일을 추가하며, `npm run wiki:curate`가 중복 검사와 영구 ID(`L-TD-NNN`) 부여로 병합한다. |
| `TD-WIKI-10` | **도구 중립 에이전트 스킬 (`.agents/skills/wiki-maintain`)** | Claude Code, Codex, Antigravity가 공통으로 따르는 위키 탐색·갱신·교훈 기록 절차를 `.agents/skills/wiki-maintain/SKILL.md`에 제공한다. |

---

## 5. 비기능 요구사항 및 제약 준수

1. **외부 패키지 추가 0건**: Node 24 표준 모듈(`node:fs`, `node:path`, `node:crypto`, `node:child_process`)만 사용한다.
2. **바이트 단위 결정성 (Deterministic Idempotency)**: 생성 레지스트리와 `WIKI-AUTO` 블록에는 실행 시각 타임스탬프를 넣지 않아, 원천이 같으면 언제 실행해도 100% 동일한 바이트를 출력한다.
3. **CI(`pages.yml`) 및 `validate-plan.mjs` 완벽 호환**:
   - `README.md`, `docs/READ_FIRST.md`, `docs/HANDOFF.md`의 `vocabulary_td_prd_v0_5.md` 링크 포함 규칙과 보존 파일 4종의 해시를 철저히 유지한다.
   - 루트 `verify` 스크립트에 `npm run wiki:lint`를 연결하여 깨진 링크·스키마 오류·보존 위반은 CI에서 즉시 차단하되, 원천 변경에 따른 W05/W07 드리프트는 기본 `lint`에서 경고(`[warn]`)로 처리하고 `npm run wiki:check`에서 엄격 차단(`--strict`)하여 긴급 문항 배치 배포를 막지 않도록 설계한다.
4. **비밀값·임시 경로 격리**: `.env*`, `server/.dev.vars*`, `server/.wrangler/`, `.orchestrate/`, `node_modules/`, `dist/`, `test-results/`는 스캔·색인 대상에서 원천 차단한다.

---

## 6. 완료 기준 (Acceptance Criteria)

1. 기존 `vocabulary_td_prd_*.md`, `docs/**/*.md`, `asset-source/**/*.md` 이동·삭제 0건 및 보존 해시 4종 100% 일치, 타인 미커밋 파일(`docs/contracts/prd_v0_5_validation.json`) 무변경 보존.
2. `npm run wiki:sync` 실행 후 `npm run wiki:sync -- --check` 재실행 시 변경 사항 0건(완전 멱등).
3. `npm run wiki:query`의 모든 조회 플래그(`--toc`, `--section`, `--tower`, `--enemy`, `--map`, `--bank`, `--route`, `--table`, `--decision`, `--lessons`, `--glossary`, `--grep`) 정상 동작.
4. `npm run wiki:check`, `npm run typecheck`, `npm run lint`, 위키 단위 시험(`tests/unit/wiki.test.ts`) 종료 코드 `0` 통과.
5. `npm run wiki:hooks:install` 실행으로 Git 자동 동기화 훅 설치 및 동작 검증 완료.

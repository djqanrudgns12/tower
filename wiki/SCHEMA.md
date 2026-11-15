---
id: wiki-schema
type: schema
title: LLM Wiki 최고 규약
status: active
updated: 2026-11-16
verified: { commit: b9b024bd, date: 2026-11-16 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: docs/WIKI_PRD.md
    sha256: "1a7374c37a8fb46415551acedecca46276cbb84d618ebf223e42a03d934d9cc5"
  - path: docs/WIKI_PLAN.md
    sha256: "6cd1a4f2766b60ec3b05a18e3ed01c3c161d8f0869be27198860b1d17aa6776b"
---

# LLM Wiki 최고 규약 (`SCHEMA`)

이 위키는 Claude·Codex·Antigravity와 서브에이전트가 **최소 토큰(≤ 6,000자)으로 현재 코드 실체·확정 규칙·원본 위치를 즉시 찾게 하는 컴파일된 지도**다. 설계 요구와 세부 구조는 [WIKI_PRD](../docs/WIKI_PRD.md)와 [WIKI_PLAN](../docs/WIKI_PLAN.md)을 따른다.

## 1. 권위 사슬 (Authority Chain)

문서끼리 어긋날 때는 아래 순서를 따른다. **단, "지금 코드가 어떻게 동작하는가"라는 사실 판정은 실제 코드(`src/`, `server/`)와 런타임 계약 JSON(`docs/contracts/*.json`, `src/content/questions/manifest.json`)이 최상위다.**

1. **사용자의 최신 직접 지시** 및 전역 작업 방식
2. **[AGENTS.md](../AGENTS.md)** — 단일 폴더·부분 커밋·WebP·서버 시험·잠금 규칙
3. **영역별 현행 우선 문서**
   - 게임 디자인·타워 20종·진화·몬스터·UI 완화: **[docs/renewal/README.md](../docs/renewal/README.md)** 및 하위 문서 (`vocabulary_td_prd_v0_5.md`보다 우선)
   - 호스팅·배포·운영: **[docs/DEPLOY.md](../docs/DEPLOY.md)** · **[docs/HOSTING_IMPL_PLAN.md](../docs/HOSTING_IMPL_PLAN.md)**
   - 문제은행 1,000+ 공동검수: **[docs/CR1000_HANDOFF.md](../docs/CR1000_HANDOFF.md)** · **[docs/CR1000_REVIEW_POLICY.md](../docs/CR1000_REVIEW_POLICY.md)**
4. **런타임 데이터 계약**: `docs/contracts/{balance.candidate.v0.4,maps.candidate.v0.4,product.defaults.v0.5}.json`
5. **기본 제품 명세**: **[vocabulary_td_prd_v0_5.md](../vocabulary_td_prd_v0_5.md)**
6. **컴파일 지식 계층 (`wiki/**`)**: 위 원본들을 압축·연결한 네비게이터 (원본과 어긋나면 위키를 고친다)
7. **보관·이력 (`docs/archive/**`, `vocabulary_td_prd_v0_1~0_4.md`, `docs/work-packages/**`)**: 참조 전용, 현재 절차로 쓰지 않음

## 2. 3계층 구조와 경로 보존 불변식

| 계층 | 경로 | 편집 주체 | 핵심 불변식 |
| --- | --- | --- | --- |
| **원천 (Cold)** | `vocabulary_td_prd_*.md`, `docs/**`, `asset-source/**`, `content-source/**` | 각 소유 규칙 | 기존 파일 **이동·삭제·이름 변경 금지**. `v0.1·v0.3·v0.4` 및 41번 PNG는 해시 고정(`W09`). 콘텐츠 경로는 `commit-lock.mjs` 안에서만 수정 |
| **위키 (Warm)** | `wiki/**` | 큐레이션 + `tools/wiki/gen.mjs` | `registry` 파일은 손으로 고치지 않고 `npm run wiki:sync`로만 갱신. 교훈은 `npm run wiki:delta`로 제출 |
| **진입·규약 (Hot)** | `AGENTS.md`, `CLAUDE.md`, `README.md`, `llms.txt`, `docs/README.md`, `wiki/index.md` | 에이전트 + `WIKI-AUTO` 마커 | `README.md`·`docs/READ_FIRST.md`·`docs/HANDOFF.md`는 반드시 `vocabulary_td_prd_v0_5.md` 링크를 유지(`W09`) |

## 3. 페이지 스키마 및 글자 예산 (`W01` · `W04`)

모든 `wiki/` 마크다운은 YAML frontmatter를 가진다:
- 필수 키: `id`(전역 유일), `type`, `title`, `status`(`draft | active | superseded | archived`), 그리고 큐레이션 페이지는 `updated`(`YYYY-MM-DD`), 생성 페이지는 `generated_by`.
- 원본을 요약한 큐레이션 페이지는 `sources`에 파일 경로를 적고 수정 후 `npm run wiki:stamp`로 SHA-256 해시를 기록한다(`W05`).

| `type` | 글자 상한 | 역할 |
| --- | ---: | --- |
| `index` | 3,800자 | 1홉 에이전트 라우터 ([index.md](index.md)) |
| `schema` | 8,000자 | 위키 규약 (본 문서) |
| `hub` | 6,500자 | 6대 도메인 개념 허브 (`wiki/concepts/*.md`) |
| `entity` | 4,500자 | 고유명사·기술스택 진실원 (`wiki/entities/*.md`) |
| `project` | 6,500자 | 단계 계보 및 코드 실체 상태 (`wiki/projects/*.md`) |
| `lessons` / `glossary` | 항목당 750자 | 교훈 원장(`L-TD-NNN`) · 용어 사전 ([glossary.md](glossary.md)) |
| `registry` | 제한 없음 | 자동 생성 파일 (`commands`, `codemap`, `contracts`, `decisions-index`, `docs-catalog`) |
| `template` / `log` | 3,000자 / 무제한 | 작성 틀 ([lesson.md](templates/lesson.md), [hub.md](templates/hub.md)) · 연산 기록 ([log.md](log.md)) |

## 4. 점진적 조회 및 자동 갱신 흐름

1. **탐색 (Query)**: 대형 원본을 통째로 열지 않는다. [index.md](index.md) → 해당 도메인 허브 또는 [contracts.md](contracts.md) → 세부 절은 `npm run wiki:query -- --toc <파일>` 뒤 `--section <파일> <절>`로 발췌한다.
2. **동기화 (Sync)**: 코드·계약 JSON·SQL·문서를 고쳤으면 커밋 전에 `npm run wiki:sync`를 실행한다(Git Hook 설치 시 일반 커밋에서 자동 실행, `--only` 커밋 직후 `post-commit`에서 워킹 트리 자동 정렬).
3. **스탬프 (Stamp)**: `sources`로 인용한 원본을 수정했고 위키 본문도 대조해 맞췄다면 `npm run wiki:stamp`로 해시를 갱신한다.
4. **검사 (Lint & Check)**: `npm run wiki:lint`는 `npm run verify`에 포함되어 깨진 링크(`W02`), 고아 페이지(`W03`), 예산 초과(`W04`), 없는 명령(`W06`), 보존 해시 훼손(`W09`)을 차단한다. 위키 작업 완료 직전에는 `npm run wiki:check`(`sync --check` + `lint --strict`)를 실행한다.

## 5. 다중 에이전트 무충돌 교훈 원장 (`L0` ~ `L4`)

| 단계 | 형태 | 작동 시점 |
| --- | --- | --- |
| `L0` | `wiki/lessons/*.md` 원장 기록 | `npm run wiki:query -- --lessons` 조회 시 |
| `L1` | `.agents/skills/` 체크리스트 반영 | 관련 스킬 로드 시 |
| `L2` | `AGENTS.md` 상시 불변 규칙 승격 | 모든 세션 시작 시 |
| `L3` | 단위 시험 · ESLint · `wiki:lint` 자동 검사 | `npm run verify` 실행 시 |
| `L4` | Git Hook · `commit-lock` · `resource-guard` 차단 | 명령/커밋 실행 시 |

- 작업 에이전트는 원장을 직접 편집하지 않고 `npm run wiki:delta -- --area <engineering|ui|ops> --title ... --when ... --rule ... --why ... --tags ... --source ...`로 `wiki/_inbox/`에 단일 파일만 추가한다.
- 병합은 `npm run wiki:curate` 현황 확인 후 `npm run wiki:curate -- --apply <파일> --new`(또는 `--merge <ID>`, `--drop "<사유>"`)로 수행한다. 발급된 영구 ID(`wiki/_data/lesson-ids.json`)는 절대 삭제하지 않는다(`W08`).

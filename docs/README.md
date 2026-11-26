# `docs/` 문서 네비게이션 허브 (Diataxis × 권위 생애주기)

> **에이전트 탐색 수칙**: 150여 개 마크다운을 무작정 열지 마세요.
> 1. 먼저 **[../wiki/index.md](../wiki/index.md)**(1홉 라우터)와 **[../wiki/contracts.md](../wiki/contracts.md)**(실시간 코드·데이터 계약)에서 현행 실체를 확인합니다.
> 2. 세부 원천 규정이 필요할 때만 아래 **권위 순서**에 맞는 문서를 고르고, 긴 문서는 `npm run wiki:query -- --toc <파일>` 뒤 `--section <파일> <절>`로 필요한 절만 발췌합니다.
> 3. **이동·삭제 금지**: 기존 문서는 `tools/validate-plan.mjs` 해시·링크 검사와 시험 코드가 직접 참조하므로 경로를 바꾸거나 지우지 않습니다.

## 1. 문서 권위 우선순위 (충돌 시 판정 기준)

| 순위 | 문서 / 경로 | 관할 범위 및 판정 원칙 |
| ---: | --- | --- |
| **0** | 실제 코드(`src/`, `server/`) · 계약 JSON([contracts/](contracts/README.md)) | **현재 동작 사실의 최상위 근거** (`manifest.json` 등) |
| **1** | [../AGENTS.md](../AGENTS.md) | 단일 폴더 · `--only` 부분 커밋 · WebP · `test:server` · `commit-lock` |
| **2** | [renewal/README.md](renewal/README.md) 및 `docs/renewal/**` | **타워 20종·진화·종족 몬스터·전투 UI 완화** (`PRD v0.5`보다 우선) |
| **3** | [DEPLOY.md](DEPLOY.md) · [HOSTING_IMPL_PLAN.md](HOSTING_IMPL_PLAN.md) | **운영 호스팅(`voca` / `voca-api`)·DNS·D1 배포·WebP 기준** |
| **4** | [CR1000_HANDOFF.md](CR1000_HANDOFF.md) · [CR1000_REVIEW_POLICY.md](CR1000_REVIEW_POLICY.md) | **3~6학년 문제은행 1,000+ 공동검수 및 유지보수 기준** |
| **5** | [../vocabulary_td_prd_v0_5.md](../vocabulary_td_prd_v0_5.md) · [style-lock-v1.md](style-lock-v1.md) | 기본 제품 명세 · 41번 「왕국 원정대」 화풍 잠금 |
| **6** | 보관·이력 (`archive/**`, `work-packages/**`, `HANDOFF.md`, `v0.1~v0.4`) | **과거 제작 기록 전용** (현행 절차나 문항 수 근거로 사용 금지) |

## 2. Diataxis 4분류 핵심 문서 지도

### A. 시작 · 개요 (Tutorials & Onboarding)
- [../wiki/index.md](../wiki/index.md) — 에이전트 1홉 라우터 및 작업별 바로가기
- [READ_FIRST.md](READ_FIRST.md) — 저장소 입문 요약 및 기준 문서 연결 (`validate-plan` 보호 대상)
- [../README.md](../README.md) — 로컬 실행·검증·계층 요약

### B. 작업 절차서 (How-to Guides)
- [DEPLOY.md](DEPLOY.md) — GitHub Pages 자동 배포, Cloudflare 회색 구름 DNS, Workers/D1 이관·시드·배포 절차
- [CR1000_HANDOFF.md](CR1000_HANDOFF.md) · [CONTENT_REVIEW_PLAN.md](CONTENT_REVIEW_PLAN.md) — 문제은행 공동검수 루프 및 원격 반영 절차
- [../.agents/skills/wiki-maintain/SKILL.md](../.agents/skills/wiki-maintain/SKILL.md) — 위키 조회·동기화·스탬프·교훈 델타 운영법

### C. 정밀 명세 · 카탈로그 (Reference)
- [../wiki/contracts.md](../wiki/contracts.md) · [../wiki/codemap.md](../wiki/codemap.md) · [../wiki/commands.md](../wiki/commands.md) — 코드·JSON·SQL에서 자동 생성되는 실시간 레지스트리
- [renewal/catalog/towers.md](renewal/catalog/towers.md) · [renewal/catalog/monsters.md](renewal/catalog/monsters.md) · [renewal/progression.md](renewal/progression.md) — 타워 20종 진화 및 몬스터 카탈로그
- [contracts/README.md](contracts/README.md) — `balance.candidate.v0.4.json`, `maps.candidate.v0.4.json`, `product.defaults.v0.5.json` 계약 해설
- [style-lock-v1.md](style-lock-v1.md) · [ui_ux_refinement_p1_v3_prd.md](ui_ux_refinement_p1_v3_prd.md) · [renewal/ui-rules-v4.md](renewal/ui-rules-v4.md) — 화풍 잠금 및 R/S 화면 규칙
- [../vocabulary_td_prd_v0_5.md](../vocabulary_td_prd_v0_5.md) — 기본 제작 PRD v0.5

### D. 배경 설계 · 실험 근거 (Explanation & Architecture)
- [HOSTING_IMPL_PLAN.md](HOSTING_IMPL_PLAN.md) · [HOSTING_PLAN.md](HOSTING_PLAN.md) — 정적 웹 + Workers/D1 분리 설계 및 WebP 전환 근거
- [balance/r4-final.md](balance/r4-final.md) — R4 전 학년·난이도 밸런스 및 징집 선택률 튜닝 기준선
- [WIKI_PRD.md](WIKI_PRD.md) · [WIKI_PLAN.md](WIKI_PLAN.md) — 본 LLM Wiki 및 자동 갱신 아키텍처 설계서
- [../wiki/decisions-index.md](../wiki/decisions-index.md) — 핵심 의사결정(`DEC-01`~`DEC-10`) 색인

## 3. 보관 · 폐기 이력 구역 (오독 주의)

- **해시 고정 원본 (`1바이트 수정 금지`)**: `../vocabulary_td_prd_claude_v0_1.md`, `../vocabulary_td_prd_v0_3.md`, `../vocabulary_td_prd_v0_4.md`, `assets/design-41-kingdom-expedition.png`
- **초기 P1 기록 (`worktree 절차 폐기됨`)**: [HANDOFF.md](HANDOFF.md), [EXECUTION_BOARD.md](EXECUTION_BOARD.md), [prd_v0_5_review.md](prd_v0_5_review.md), [model_work_orders_v0_5.md](model_work_orders_v0_5.md), `work-packages/**`, `archive/**` — 현행 작업 폴더 및 문항 수 상태는 [../wiki/projects/roadmap-and-status.md](../wiki/projects/roadmap-and-status.md)를 따릅니다.

## 4. 전체 문서 분포 요약 (`WIKI-AUTO`)

전체 파일별 생애주기·보호 잠금 표는 [../wiki/docs-catalog.md](../wiki/docs-catalog.md)에서 확인합니다.

<!-- WIKI-AUTO:START:docs-overview -->
| 분류 | 파일 수 | 총 글자 수 | 추정 토큰 |
| --- | ---: | ---: | ---: |
| 01. 진입·규약 및 LLM Wiki | 34 | 169,075 | 109,915 |
| 02. 리뉴얼 현행 기준 (PRD보다 우선) | 79 | 587,456 | 381,884 |
| 03. 호스팅·배포·운영 기준 | 3 | 36,412 | 23,669 |
| 04. 문제은행 CR-1000 공동검수 | 6 | 201,954 | 131,272 |
| 05. 제작 PRD v0.5 및 계약 기준 | 6 | 143,424 | 93,229 |
| 06. 밸런스 시뮬레이션 실험 기록 | 8 | 106,819 | 69,436 |
| 07. 구판 PRD·초기 인계·아카이브 | 22 | 332,532 | 216,158 |
| 08. 과거 작업 패키지 및 원화·배치 검수 이력 | 99 | 389,991 | 253,538 |
| **전체 합계** | **257** | **1,967,663** | **1,279,101** |
<!-- WIKI-AUTO:END:docs-overview -->

---
id: wiki-index
type: index
title: 어휘력 타워 디펜스 에이전트 위키 색인
status: active
updated: 2026-11-25
verified: { commit: "12d66348", date: 2026-11-28 }
sources:
  - path: AGENTS.md
    sha256: "6a114bb3e7c1c01e63f75603742e3aa7811719234dc84c2471b0d045fbb26bf4"
  - path: package.json
    sha256: "438e5fc906d190ae6ff3e75af936f686e94d883375aff3ab996bcf06cd749d08"
  - path: docs/renewal/r6/PRD-r6.md
    sha256: "2ebe8c0d3e6c29822e5a15714f0a0a8b7a93ba5ce2e22031f83a3a7519be17b3"
  - path: docs/renewal/r6/PRD-r6-v2.md
    sha256: "1bf6d3c15f279414b1c11d52ec0c5e00e66b9973a010af4f1c839c466dfe331f"
---

# 어휘력 타워 디펜스 LLM Wiki (`index`)

> 1홉 라우터: [SCHEMA.md](SCHEMA.md) · R6 V2 [PRD-r6-v2.md](../docs/renewal/r6/PRD-r6-v2.md) ([V1](../docs/renewal/r6/PRD-r6.md)) · [docs/README.md](../docs/README.md) · [llms.txt](../llms.txt)

## 1. 실시간 저장소 지표 (`WIKI-AUTO`)

<!-- WIKI-AUTO:START:repo-stats -->
- **제품·밸런스 판**: `v1.0.0` (30Hz 고정 틱 · 화풍 `design-41-kingdom-expedition` · WebP 원화 `378`장)
- **게임 규모**: 학년별 맵 `4`종(3~6학년, 15×9 격자·슬롯 20칸) · 타워 `20`종(Lv4/Lv7 3단 진화) · 적 역할 `10`종 × 종족 `8`종 · 원정 보물 `12`종
- **공개 문제은행**: 3~6학년 자기 학년 승인 **5,547문항** · 공유 포함 총 출제 풀 **6,583문항** (3학년 1140 · 4학년 1563 · 5학년 1869 · 6학년 2011)
- **서버·인프라**: 정적 게임 `https://voca.ssamuniverse.com` (GitHub Pages) · 기록/랭킹 API `https://voca-api.ssamuniverse.com` (Cloudflare Workers 라우트 `7`종 + D1 테이블 `12`종)
- **지식 베이스**: 전체 마크다운 `222`개 · 핵심 의사결정 `10`건 · 루트 npm 명령 `36`개
<!-- WIKI-AUTO:END:repo-stats -->

> 운영 v1(`1.0.0`) 지표. 코드 기본값은 R6(`2.0.0`), `?balance=v1`로 v1 실행.

## 2. 1홉 바로가기

| 영역 | 위키 허브 | 자동 레지스트리 / 조회 |
| --- | --- | --- |
| 아키텍처·RunController | [아키텍처·계층 경계](concepts/architecture-and-layers.md) | [codemap.md](codemap.md) |
| 타워·몬스터·밸런스 | [전투·타워·밸런스](concepts/combat-towers-and-balance.md) | [contracts.md](contracts.md) · `wiki:query -- --tower` |
| UI·맵·아트·시안 A V2 | [화면·전장·제작 공정](concepts/ui-phaser-and-assets.md) | `wiki:query -- --map` · [PRD-r6-v2 §7~11](../docs/renewal/r6/PRD-r6-v2.md) |
| 문제은행·CR-1000 | [문제은행·공동검수](concepts/question-bank-and-cr1000.md) | `wiki:query -- --bank` |
| 저장·오답·랭킹 서버 | [로컬 저장·랭킹 서버](concepts/persistence-and-ranking-server.md) | `wiki:query -- --route` · `--table` |
| 배포·시즌·검증 | [배포·검증·운영](concepts/deploy-and-verification.md) | [commands.md](commands.md) |
| R6 V2 로드맵·현황 | [로드맵·현행 실체 상태](projects/roadmap-and-status.md) | [decisions-index.md](decisions-index.md) |
| 제품·기술스택 | [제품 개요](entities/vocabulary-td.md) · [기술스택](entities/tech-stack.md) | [docs-catalog.md](docs-catalog.md) |

## 3. 자동 레지스트리 (`npm run wiki:sync`)

- [commands.md](commands.md) · [codemap.md](codemap.md) · [contracts.md](contracts.md) · [decisions-index.md](decisions-index.md) · [docs-catalog.md](docs-catalog.md)

## 4. 교훈 · 사전 · 도구

- **교훈**: [엔지니어링·콘텐츠](lessons/engineering-and-content.md) · [UI·아트·밸런스](lessons/ui-art-and-balance.md) · [운영·워크플로](lessons/ops-and-workflow.md)
- **사전·틀**: [용어 사전](glossary.md) · [연산 기록](log.md) · [교훈](templates/lesson.md) · [허브](templates/hub.md)
- **스킬·CLI**: [.agents/skills/wiki-maintain/SKILL.md](../.agents/skills/wiki-maintain/SKILL.md) · `wiki:query` · `wiki:sync` · `wiki:check`

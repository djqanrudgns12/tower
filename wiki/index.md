---
id: wiki-index
type: index
title: 어휘력 타워 디펜스 에이전트 위키 색인
status: active
updated: 2026-11-25
verified: { commit: fa75c724, date: 2026-11-27 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: package.json
    sha256: "438e5fc906d190ae6ff3e75af936f686e94d883375aff3ab996bcf06cd749d08"
  - path: docs/renewal/r6/PRD-r6.md
    sha256: a4bae91b43a1c2adb3a549c47b6f4250a1d6d1f45010b3facc530fdd3a7d9175
---

# 어휘력 타워 디펜스 LLM Wiki (`index`)

> 에이전트가 최소 토큰으로 현행 규칙·살아있는 계약·원본 절을 찾는 **1홉 라우터**입니다. 규약과 권위 순서는 [SCHEMA.md](SCHEMA.md), R6 단일 기준은 [PRD-r6.md](../docs/renewal/r6/PRD-r6.md), 문서 전체 지도는 [docs/README.md](../docs/README.md), 사이트맵은 [llms.txt](../llms.txt)를 참조하세요.

## 1. 실시간 저장소 지표 (`WIKI-AUTO`)

<!-- WIKI-AUTO:START:repo-stats -->
- **제품·밸런스 판**: `v1.0.0` (30Hz 고정 틱 · 화풍 `design-41-kingdom-expedition` · WebP 원화 `378`장)
- **게임 규모**: 학년별 맵 `4`종(3~6학년, 15×9 격자·슬롯 20칸) · 타워 `20`종(Lv4/Lv7 3단 진화) · 적 역할 `10`종 × 종족 `8`종 · 원정 보물 `12`종
- **공개 문제은행**: 3~6학년 자기 학년 승인 **5,547문항** · 공유 포함 총 출제 풀 **6,583문항** (3학년 1140 · 4학년 1563 · 5학년 1869 · 6학년 2011)
- **서버·인프라**: 정적 게임 `https://voca.ssamuniverse.com` (GitHub Pages) · 기록/랭킹 API `https://voca-api.ssamuniverse.com` (Cloudflare Workers 라우트 `7`종 + D1 테이블 `12`종)
- **지식 베이스**: 전체 마크다운 `259`개 · 핵심 의사결정 `10`건 · 루트 npm 명령 `36`개
<!-- WIKI-AUTO:END:repo-stats -->

> 위 지표는 운영 v1(`1.0.0`) 기준이다. 코드 기본값은 R6(`2.0.0`, 운영 미반영)이고 `?balance=v1`로 이전 판을 연다.

## 2. 작업별 1홉 바로가기

| 하려는 작업 | 먼저 읽을 위키 허브 | 자동 레지스트리 / 정밀 조회 |
| --- | --- | --- |
| **계층 규칙·RunController·계약 선택·자동 화질** | [아키텍처·계층 경계](concepts/architecture-and-layers.md) | [codemap.md](codemap.md) |
| **R6 타워 6종(Lv20)·몬스터 100·밸런스 v2** | [전투·타워·밸런스](concepts/combat-towers-and-balance.md) | [contracts.md](contracts.md) · `npm run wiki:query -- --tower` |
| **R04 UI·초원 고원·Blender/Spine 제작 공정** | [화면·전장·제작 공정](concepts/ui-phaser-and-assets.md) | `npm run wiki:query -- --map` |
| **3~6학년 문제은행·CR-1000·commit-lock** | [문제은행·공동검수](concepts/question-bank-and-cr1000.md) | `npm run wiki:query -- --bank` |
| **IndexedDB·오답 노트·시즌 2 랭킹 서버** | [로컬 저장·랭킹 서버](concepts/persistence-and-ranking-server.md) | `npm run wiki:query -- --route` · `--table` |
| **배포·시즌 전환·보존 잠금·검증 예산** | [배포·검증·운영](concepts/deploy-and-verification.md) | [commands.md](commands.md) |
| **R6 단계·관문 현황과 남은 작업** | [로드맵·현행 실체 상태](projects/roadmap-and-status.md) | [decisions-index.md](decisions-index.md) |
| **제품 정의·도메인·기술스택 고정 버전** | [제품 개요](entities/vocabulary-td.md) · [기술스택](entities/tech-stack.md) | [docs-catalog.md](docs-catalog.md) |

## 3. 자동 생성 레지스트리 5종 (`npm run wiki:sync`)

- [commands.md](commands.md): 전체 `npm run` 스크립트(`test:r6-perf` 포함) · `tools/` CLI · `resource-guard`
- [codemap.md](codemap.md): `src/` 7계층 · `server/` · `tools/` · ESLint 금지 의존성 지도
- [contracts.md](contracts.md): 공개 은행 · v1 계약 요약 · 서버 API 7종 · D1 테이블 12종
- [decisions-index.md](decisions-index.md): 분산된 확정 결정(`DEC-01`~`DEC-10`)과 원본 줄 번호
- [docs-catalog.md](docs-catalog.md): 전체 마크다운 생애주기 · Diataxis 분류 · `validate-plan` 잠금

## 4. 교훈 원장 · 용어 · 운영 도구

- **교훈 원장**: [엔지니어링·콘텐츠](lessons/engineering-and-content.md) · [UI·아트·밸런스](lessons/ui-art-and-balance.md) · [운영·워크플로](lessons/ops-and-workflow.md)
- **사전·이력·틀**: [용어 사전](glossary.md) · [연산 기록](log.md) · 틀([교훈](templates/lesson.md), [허브](templates/hub.md))
- **공용 스킬**: [.agents/skills/wiki-maintain/SKILL.md](../.agents/skills/wiki-maintain/SKILL.md)
- **필수 명령**: 조회 `npm run wiki:query -- --help` · 동기화 `npm run wiki:sync` · 엄격 검사 `npm run wiki:check`

---
id: wiki-log
type: log
title: 위키 연산 기록
status: active
updated: 2026-11-25
---

# 위키 연산 기록 (`log`)

> 위키의 구조 개편·대규모 수집(Ingest)·교훈 병합(Curate) 이력을 아래에 시간순(append-only)으로 기록합니다.

## [2026-11-16] INIT | 타워디펜스 LLM Wiki 및 자동 갱신 시스템 v1.0 구축 | Antigravity

- 설계 기준: [docs/WIKI_PRD.md](../docs/WIKI_PRD.md) (`TD-WIKI-01`~`TD-WIKI-10`), [docs/WIKI_PLAN.md](../docs/WIKI_PLAN.md).
- 선례 통합: `rollingthunder`(3계층 지식 구조 · 코드 실체 판정 · Git Hook 무비용 갱신) + `classlearning`(`SCHEMA.md` · 1홉 라우터 · 결정적 레지스트리 · `wiki:query` · `wiki:lint` · 무충돌 교훈 델타) + 외부 표준(`agents.md`, `llms.txt` v2, Diataxis, Progressive Disclosure, `WIKI-AUTO` 마커 블록).
- 구축 범위:
  - 엔진: `tools/wiki/` (5대 자동 레지스트리 생성기, `sync`·`watch`·`query`·`lint` `W01~W09`·`stamp`·`budget`·`delta`·`curate`, `commit-lock`·`--only` 호환 Git 훅).
  - 지식 계층: `wiki/` (`index`, `SCHEMA`, `glossary`, `entities` 2종, `concepts` 6종, `projects` 1종, `lessons` 3종·초기 핵심 교훈 10건, `templates` 2종).
  - 진입점 정비: `llms.txt`, `docs/README.md` 신설 및 `README.md`, `docs/READ_FIRST.md`, `AGENTS.md` 현행 1.0.0 실체 동기화 (`validate-plan.mjs` 보존 불변식 100% 유지).

## [2026-11-25] UPDATE | R6 대개편 위키 현행화 및 교훈 델타 제출 | Antigravity

- 단일 기준: [docs/renewal/r6/PRD-r6.md](../docs/renewal/r6/PRD-r6.md) 및 `docs/renewal/r6/{map-spec,spec/engine-changes,spec/sim-notes,tech/*,review/G4-towers-fix,ui/system}.md`.
- 갱신 범위: `wiki/index.md`, `wiki/SCHEMA.md`, `wiki/concepts/{architecture-and-layers,combat-towers-and-balance,ui-phaser-and-assets,question-bank-and-cr1000,persistence-and-ranking-server,deploy-and-verification}.md`, `wiki/entities/{tech-stack,vocabulary-td}.md`, `wiki/projects/roadmap-and-status.md`, `wiki/glossary.md`, `wiki/_data/command-notes.json`.
- 반영 내용: 밸런스 v2(타워 6종 Lv20·무기 I~IV·순차 해금, 몬스터 5종족×20, 시드 혼합, `2.0.0`·시즌 2), 계약 선택(`?balance=v1`), 초원 고원 3/4 맵·16방향 포두·Spine Mesh2D·종족 지연 적재·자동 화질 3단계, R04 토큰·선 아이콘 54종·밝은/가벼운 화면, Blender/Spine 제작 공정·파츠 안내판, 서버 시즌 2 준비(운영 미반영)·`test:r6-perf`, R6 단계·관문 현황(G0~G5), v1 보존 요약.
- 교훈 델타: `npm run wiki:delta`로 `wiki/_inbox/`에 R6 제작·운영 교훈 제출(원장 직접 수정 없음).

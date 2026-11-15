---
id: wiki-log
type: log
title: 위키 연산 기록
status: active
updated: 2026-11-16
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

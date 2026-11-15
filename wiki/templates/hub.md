---
id: template-hub
type: template
title: 도메인 개념 허브 작성 틀
status: draft
updated: 2026-11-16
sources:
  - AGENTS.md
---

# 도메인 제목 (`template: hub`)

> 상한 **6,500자** 이내로 핵심 불변식·진입 파일·대표 명령만 압축합니다. 긴 수치 표는 [contracts.md](../contracts.md)로 위임하고, 세부 절은 `npm run wiki:query -- --section <파일> <절>`로 조회하게 안내하세요.

## 1. 한눈에 보는 책임과 권위 원본

- **핵심 책임**: 이 도메인이 해결하는 문제 한두 줄 요약
- **권위 원본**: 기준 문서 링크와 런타임 계약 경로

## 2. 핵심 아키텍처 · 불변식

1. 절대 깨뜨리면 안 되는 규칙 1
2. 절대 깨뜨리면 안 되는 규칙 2

## 3. 주요 진입 코드 및 파일

| 경로 | 역할 |
| --- | --- |
| `src/...` | 핵심 모듈 설명 |

## 4. 자주 쓰는 조회 · 검증 명령

- 계약 조회: `npm run wiki:query -- --help`
- 범위 검증: `npm run test`
- 스탬프 갱신: 원본 수정 대조 후 `npm run wiki:stamp`

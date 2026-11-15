---
id: hub-question-bank-and-cr1000
type: hub
title: "3~6학년 문제은행 및 CR-1000 공동검수"
status: active
updated: 2026-11-16
verified: { commit: e22ff57f, date: 2026-11-16 }
sources:
  - path: src/content/questions/manifest.json
    sha256: a450a6db9097bba40c7c11c6ee806700816c4d7526564c1cffd837905bfbcfe0
  - path: src/content/gradeLoader.ts
    sha256: a2cf13e25538dadcd26fe3e13e0393e284dc24a75839bb9cdd0bd6a05aedac08
  - path: tools/build-bank.mjs
    sha256: "2d93c6ccc2c6de30eb4d90a9d64c22d6574618cc01e4b2d584916fde3d61e5fb"
  - path: tools/build-question-keys.mjs
    sha256: "6cf5d19fe99c61555644b704fc16879134465ae4ea64f1f546e7e1e9990e5e80"
  - path: tools/content/gradeSharing.ts
    sha256: "41e7a7accbb709f6ca5722eef56db6b10910818ff0d8dea1d0031bf8ab49f37e"
  - path: tools/orchestrate/commit-lock.mjs
    sha256: "1cd0d9ddc70648d3a93047f0aad6330c256659c1e69400c9591f182a729a6cc4"
  - path: docs/CR1000_HANDOFF.md
    sha256: c3c01581eceead622afc236790d68ce0c3f6f600317b819d9f549176dbb1707c
  - path: docs/CR1000_REVIEW_POLICY.md
    sha256: "74e68ba1f4f4cbeefa6e23e6032aaad1830f3c9434d192e9646cb9fafdbfa68f"
---

# 3~6학년 문제은행 및 CR-1000 공동검수 (`question-bank-and-cr1000`)

출제 문항은 어휘 정확성·교육과정 적합성·복수 정답 방지를 위해 **다중 모델 블라인드 공동검수(CR-1000)**를 통과한 승인 문항만 공개 은행(`src/content/questions/grade<N>.json`)에 수록된다. 실시간 학년별 문항 수와 판(`bankVersion`)은 [contracts.md](../contracts.md) 및 `npm run wiki:query -- --bank`로 확인한다.

## 1. 공개 문제은행 구조와 학년 띠 공유

- **현행 규모** ([manifest.json](../../src/content/questions/manifest.json)):
  - 3학년(`1,140`) · 4학년(`1,563`: 자기 `1,261`+공유 `302`) · 5학년(`1,869`: 자기 `1,508`+공유 `361`) · 6학년(`2,011`: 자기 `1,638`+공유 `373`)
  - **자기 학년 승인 합계 `5,547`문항 · 공유 포함 총 출제 풀 `6,583`문항** (연습 `4`문항, 철회 `0`건)
- **학년 띠 공유** ([gradeSharing.ts](../../tools/content/gradeSharing.ts)): 인접 하위 학년의 검증된 문항 중 난이도·어휘 수준이 적합한 문항을 상위 학년 복습 풀로 안전하게 유입해 반복 노출을 낮춘다.
- **지연 적재 및 철회 필터**: [gradeLoader.ts](../../src/content/gradeLoader.ts)가 선택한 학년 JSON만 동적 적재하며, 사후 결함 발견 시 재빌드 전에도 `src/content/retractions.json`으로 즉시 출제를 차단한다.

## 2. CR-1000 블라인드 공동검수 정책 (`DEC-09`)

- **기준 문서**: [CR1000_HANDOFF.md](../../docs/CR1000_HANDOFF.md) · [CR1000_REVIEW_POLICY.md](../../docs/CR1000_REVIEW_POLICY.md) · [CONTENT_REVIEW_PLAN.md](../../docs/CONTENT_REVIEW_PLAN.md)
- **검수 파이프라인**:
  1. 사전 근거 수집(`npm run fetch-evidence`) 및 초안 생성(`content-source/drafts/`)
  2. Argon 자체 반박 + 블라인드 입력(`npm run blind-input`) 기반 독립 모델 검토(`codex-argon-v1` 또는 `claude-argon-v1`)
  3. 해설·정답 일치 및 의미 린트([lint.ts](../../src/content/lint.ts)) 통과분에 한해 `content-source/approvals/registry.json`에 해시 고정 등록
- **주요 품질 규칙**: 반의어·유의어 문항이라도 비석 예문 빈칸에는 지문 끝 낱말이 아닌 **실제 정답 선택지**가 자연스럽게 들어가야 한다(`L-TD-004`).

## 3. `commit-lock` 원자적 반영 불변식 (`L-TD-001` · `L-TD-002`)

1. **잠금 밖 수동 편집 절대 금지**:
   - `content-source/**`, `src/content/questions/**`, `server/seed/question_keys.sql`은 반드시 [commit-lock.mjs](../../tools/orchestrate/commit-lock.mjs) 잠금 안에서만 갱신한다.
   - 잠금 밖에서 일부 파일만 고치면 초안·검토 보고서·`registry.json` 해시가 어긋나 `bank-build.test`가 깨진다(과거 `wp/WP-CORE` 격리 보관 사유).
2. **은행 빌드와 서버 정답 키 동기화**:
   - `npm run build:bank`([build-bank.mjs](../../tools/build-bank.mjs))가 공개 은행 JSON을 다시 만들면, [build-question-keys.mjs](../../tools/build-question-keys.mjs)가 서버 재채점용 `server/seed/question_keys.sql`을 함께 생성한다.
   - 운영 반영 시에는 정적 은행 배포 전에 원격 D1에 `npm run server:seed:remote`를 먼저 적용해야 신규 문항 판이 서버 재채점에서 거부되지 않는다.

## 4. 자주 쓰는 조회 · 검증 명령

- 문제은행 현황 조회: `npm run wiki:query -- --bank`
- 문항 스키마·의미·매니페스트 검사: `npm run validate:content`
- 학년·유형·난이도 분포 점검: `node tools/content/coverage-report.mjs`

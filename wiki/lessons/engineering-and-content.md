---
id: lessons-engineering-and-content
type: lessons
title: 엔지니어링·콘텐츠 교훈 원장
status: active
updated: 2026-11-16
verified: { commit: e22ff57f, date: 2026-11-16 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: docs/CR1000_HANDOFF.md
    sha256: c3c01581eceead622afc236790d68ce0c3f6f600317b819d9f549176dbb1707c
  - path: tools/orchestrate/commit-lock.mjs
    sha256: "1cd0d9ddc70648d3a93047f0aad6330c256659c1e69400c9591f182a729a6cc4"
---

# 엔지니어링·콘텐츠 교훈 원장 (`001` ~ `099`)

> 새 교훈이나 위반 카운터는 직접 편집하지 않고 `npm run wiki:delta`로 제출한 뒤 `npm run wiki:curate`로 병합합니다.

## 수록 교훈

### L-TD-001 · 문제은행·검수 산출물은 반드시 `commit-lock` 안에서만 수정
- **언제**: `content-source/**`, `src/content/questions/**`, `server/seed/question_keys.sql`을 생성·수정·커밋할 때
- **규칙**: 잠금 밖에서 개별 파일을 손으로 고치거나 부분 커밋하지 않고 반드시 `tools/orchestrate/commit-lock.mjs` 절차를 거친다.
- **왜**: 중단된 검수 묶음(`wp/WP-CORE`)에서 초안·검토 보고서·승인 레지스트리 해시가 서로 어긋나 `bank-build.test` 7건이 깨지고 병합 불가 상태가 되었다.
- **검사**: `npm run validate:content` 및 `tools/orchestrate/commit-lock.mjs` 잠금 검사
- **단계**: L4 (잠금 스크립트 및 Git 훅 우회 보호)
- **카운터**: 적중 3 · 위반 1 · 오탐 0
- **날짜**: 최초 2026-11-04 · 확인 2026-11-16
- **태그**: `content`, `cr1000`, `commit-lock`
- **근거**: [AGENTS.md](../../AGENTS.md)

### L-TD-002 · 대용량 SQL·은행 자식 프로세스 실행 시 `maxBuffer` 여유 확보
- **언제**: `server/seed/question_keys.sql`이나 전 학년 공개 은행을 `spawnSync`·`execFileSync`로 다루는 스크립트를 작성할 때
- **규칙**: Node 기본 버퍼(1MiB)에 의존하지 않고 `maxBuffer`를 최소 16~64MiB 이상으로 명시하거나 파일 스트림 인자(`--file`)로 전달한다.
- **왜**: CR-1000 5,500+ 문항 달성 이후 `question_keys.sql` 크기가 1MiB를 넘기면서 기본 `spawnSync` 호출이 `ENOBUFS`로 중단된 사례가 발생했다.
- **검사**: `npm run build:bank` 및 `tools/build-question-keys.mjs` 실행 확인
- **단계**: L3 (빌드 도구 반영 완료)
- **카운터**: 적중 2 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-08 · 확인 2026-11-16
- **태그**: `content`, `server`, `d1`
- **근거**: [CR1000_HANDOFF.md](../../docs/CR1000_HANDOFF.md)

### L-TD-003 · 공개 은행이 후보 본을 따라잡았을 때 `candidate.json` 부재 허용
- **언제**: 문제은행 승격·비교 스크립트나 학년별 은행 검증 도구를 수정할 때
- **규칙**: 모든 승격이 끝나 별도 `candidate.json`이 없는 정상 수렴 상태를 오류로 처리하지 않고 현행 공개 은행(`grade<N>.json`)을 기준으로 삼는다.
- **왜**: 후보분이 전량 공개분으로 병합된 직후 후보 파일 존재만 가정하던 보조 스크립트가 거짓 실패를 낸 적이 있다.
- **검사**: `npm run validate:content`
- **단계**: L3 (은행 검증 로직 반영)
- **카운터**: 적중 1 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-09 · 확인 2026-11-16
- **태그**: `content`, `cr1000`, `verification`
- **근거**: [CR1000_HANDOFF.md](../../docs/CR1000_HANDOFF.md)

### L-TD-004 · 반의어·유의어 문항의 비석 예문 빈칸에는 반드시 실제 정답 어휘 삽입
- **언제**: 반의어·유의어 유형 어휘 문항을 출제하거나 검수·수정할 때
- **규칙**: 비석 예문 빈칸을 채울 때 지문에 적힌 기준 낱말이 아니라 학생이 고르는 **실제 정답 선택지**가 문맥상 자연스럽게 들어가도록 작성한다.
- **왜**: 기준 낱말을 빈칸에 넣으면 정답을 끼웠을 때 문장 뜻이 정반대가 되어 공동검수와 문항 의미 린트에서 대량 반려된다.
- **검사**: `npm run validate:content` (`src/content/lint.ts`)
- **단계**: L3 (문항 린트 및 공동검수 정책 강제)
- **카운터**: 적중 4 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-07 · 확인 2026-11-16
- **태그**: `content`, `cr1000`
- **근거**: [CR1000_REVIEW_POLICY.md](../../docs/CR1000_REVIEW_POLICY.md)

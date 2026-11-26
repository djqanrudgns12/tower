---
id: lessons-ui-art-and-balance
type: lessons
title: UI·아트·밸런스 교훈 원장
status: active
updated: 2026-11-16
verified: { commit: b231561f, date: 2026-11-26 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: docs/HOSTING_IMPL_PLAN.md
    sha256: "79f1f85a62652e420cf36b3a1a0f058656fb8685fb5f179d825f5570caed6701"
  - path: docs/balance/r4-final.md
    sha256: "3ce50ccc026b07b67ea0cb9d8702a8f43a353d656da97d6fabfc0774da752716"
  - path: src/game/layoutGround.ts
    sha256: "49abf04cbf479f9c81fbe39e666ed74b2906709851468ad8616d5e911064a9a6"
---

# UI·아트·밸런스 교훈 원장 (`101` ~ `199`)

> 새 교훈이나 위반 카운터는 직접 편집하지 않고 `npm run wiki:delta`로 제출한 뒤 `npm run wiki:curate`로 병합합니다.

## 수록 교훈

### L-TD-101 · 사용자가 다듬은 화면·기능은 확인 없이 통째로 교체·삭제 금지
- **언제**: 홈 랜딩(통합 수호 랭킹), 전투 HUD, 결과 화면 등을 리뉴얼하거나 레이아웃을 개편할 때
- **규칙**: 기존 화면이나 핵심 기능을 통째로 걷어내거나 다른 시안으로 덮어쓰는 변경은 반드시 사용자 확인을 먼저 받는다.
- **왜**: 2026-11-04 R4 리뉴얼 작업 중 사용자가 직접 다듬어 둔 홈 랜딩(통합 수호 랭킹)을 확인 없이 지워 복구 커밋을 수행한 사고가 있었다.
- **검사**: 화면 구조 변경 전 `git log` 이력 확인 및 사용자 사전 승인
- **단계**: L2 (`AGENTS.md` 상시 불변 규칙)
- **카운터**: 적중 2 · 위반 1 · 오탐 0
- **날짜**: 최초 2026-11-04 · 확인 2026-11-16
- **태그**: `ui`, `git`
- **근거**: [AGENTS.md](../../AGENTS.md)

### L-TD-102 · WebP 원화 변환 시 투명 여백(알파 경계 상자) 임의 크롭 금지
- **언제**: `public/assets/**`에 새 타워·몬스터·장식·지면 그림을 `tools/assets/to-webp.mjs`로 변환해 등록할 때
- **규칙**: 원본 PNG의 캔버스 크기와 알파 경계 상자 위치를 그대로 보존해 WebP(`-q 85 -alpha_q 100 -m 6`)로 변환하며 여백 자동 자르기(`trim`)를 쓰지 않는다.
- **왜**: `src/game/layoutGround.ts`와 타워 발판 정렬이 원본 캔버스 중심·여백 비율을 기준으로 계산하므로 여백을 자르면 전장 배치가 틀어진다.
- **검사**: `npm run validate:assets` 및 `tools/assets/webp-compare.mjs` 시각 대조
- **단계**: L3 (변환 스크립트 및 매니페스트 시험 고정)
- **카운터**: 적중 2 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-05 · 확인 2026-11-16
- **태그**: `assets`, `webp`, `phaser`
- **근거**: [HOSTING_IMPL_PLAN.md](../../docs/HOSTING_IMPL_PLAN.md)

### L-TD-103 · 특정 타워·진화 수치 상향 시 징집 선택률 60% 독점 연쇄 확인
- **언제**: `docs/contracts/balance.candidate.v0.4.json`에서 개별 타워나 Lv4/Lv7 진화 갈래 피해량·사거리를 조정할 때
- **규칙**: 단일 승률만 보지 않고 `npm run simulate:towers`와 `npm run simulate:gate`로 타워별 징집 선택률 편중(60% 상한 돌파 여부)을 함께 확인한다.
- **왜**: R4 튜닝 당시 한 갈래의 가성비를 소폭 올렸을 때 봇 징집 선택률이 한 타워로 쏠리며 다른 19종 조합 다양성을 무너뜨린 현상이 확인되었다.
- **검사**: `npm run simulate:towers` · `npm run simulate:gate`
- **단계**: L3 (시뮬레이션 관문 평가 기준 포함)
- **카운터**: 적중 2 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-04 · 확인 2026-11-16
- **태그**: `balance`, `towers`, `verification`
- **근거**: [r4-final.md](../../docs/balance/r4-final.md)

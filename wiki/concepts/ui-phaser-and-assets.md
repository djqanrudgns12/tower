---
id: hub-ui-phaser-and-assets
type: hub
title: 화면(React)·전장(Phaser)·원화 에셋
status: active
updated: 2026-11-16
verified: { commit: e22ff57f, date: 2026-11-16 }
sources:
  - path: src/game/bridge.ts
    sha256: dfcd4ce7f82ee8543aaa73de8b0e080d6c215f58d2c0b1edaa0a000c2e577896
  - path: src/game/layoutGround.ts
    sha256: "49abf04cbf479f9c81fbe39e666ed74b2906709851468ad8616d5e911064a9a6"
  - path: public/assets/manifest.json
    sha256: "8fde19024d32e38c3463cbec763a7a7b2c1d8bf45ba758a6772d0acf243924ef"
  - path: tools/assets/to-webp.mjs
    sha256: "1b1bd3cc65918039f813a88a414d05dd5186d03fe41583bcd49d8c3f0a6480f0"
  - path: docs/style-lock-v1.md
    sha256: "9cef3809c446c28e77316ca8c4ac3b2fc3f2f09e14f1c82539e7dfe604471ceb"
  - path: docs/ui_ux_refinement_p1_v3_prd.md
    sha256: "6d39f346d5c078716ad390ad02ab96ac7a1e78067a9388c84a34ba737354c299"
  - path: docs/HOSTING_IMPL_PLAN.md
    sha256: fedb202fc04bc7c0e31497678fdbcabfc2cec34b2d8a3aa2cd5f841e9d825836
---

# 화면(React)·전장(Phaser)·원화 에셋 (`ui-phaser-and-assets`)

플레이어 경험은 **React 19 오버레이·화면 계층(`src/ui/`)**과 **Phaser 4 전장 캔버스(`src/game/`)**의 이중 구조로 이루어진다. 두 계층은 직접 참조하지 않고 [bridge.ts](../../src/game/bridge.ts)와 `RunController` 스냅샷만으로 통신한다.

## 1. 화면 구조와 UI 보존 원칙

- **반응형 R / S 레이아웃**: 데스크톱·크롬북 가로형(`R` 모드)과 모바일·좁은 뷰포트(`S` 모드) 규칙은 [ui_ux_refinement_p1_v3_prd.md](../../docs/ui_ux_refinement_p1_v3_prd.md) 및 [ui-rules-v4.md](../../docs/renewal/ui-rules-v4.md)를 따른다.
- **바로 설치 UX**: 슬롯 클릭 시 불필요한 중간 단계를 줄이고 설치·강화·진화(Lv4/Lv7) 패널로 즉시 진입한다.
- **화면 용어 계약**: 학생 노출 문구는 한국어 표시 규칙(`쉬움/보통/어려움/아주 어려움`, 내부 개발 용어 노출 금지)을 따르며 `tests/unit/terms.test.ts`가 검증한다.
- **사용자 다듬은 화면 보존 (`DEC-10` · `L-TD-101`)**: 홈 랜딩의 **통합 수호 랭킹** 등 사용자가 직접 다듬은 화면·기능을 통째로 교체하거나 걷어낼 때는 반드시 사용자 확인을 먼저 거친다.

## 2. Phaser 4 전장 렌더링 (`src/game/`)

- **6겹 레이어 조립**: 지면(`layoutGround.ts`) → 경로·장식 → 설치 슬롯·타워 → 몬스터·보행 자세 → 투사체·효과 → 선택 표식·미니맵 순으로 정렬한다.
- **데이터 기반 지면 합성**: 맵 통째 배경 그림 대신 [maps.candidate.v0.4.json](../../docs/contracts/maps.candidate.v0.4.json)의 경로·장식 좌표를 읽어 풀·흙길·받침·바위·비석 타일을 조립한다.
- **선택 맵 지연 적재**: 첫 전투 진입 전 전송량을 약 3MB 안팎으로 유지하기 위해 선택된 학년 맵과 등장 종족 에셋만 우선 적재한다([HOSTING_IMPL_PLAN.md](../../docs/HOSTING_IMPL_PLAN.md)).

## 3. 41번 화풍 잠금과 WebP 파이프라인 (`DEC-03` · `DEC-06`)

1. **41번 「왕국 원정대」 화풍 잠금**:
   - 기준 원화 `docs/assets/design-41-kingdom-expedition.png`는 SHA-256 해시가 고정되어 있다([style-lock-v1.md](../../docs/style-lock-v1.md)). 32/48/64px 축소 가독성과 외곽선 일관성을 해치는 이질적 AI 화풍을 금지한다.
2. **인게임 에셋 전면 WebP 규칙** ([to-webp.mjs](../../tools/assets/to-webp.mjs)):
   - `public/assets/**` 등록 에셋(현행 WebP 378장, [manifest.json](../../public/assets/manifest.json))은 `cwebp -q 85 -alpha_q 100 -m 6`(투명도 무손실)으로 변환한다.
   - 뭉개짐 발생 시 `q92` → 무손실 WebP 순으로 올리고, 예외 PNG는 `tools/assets/webp-exceptions.json`에 사유를 기록한다. 생성 원본(`asset-source/**`)과 QA 기준 캡처는 PNG 그대로 보존한다.
3. **알파 경계 상자 보존 필수 (`L-TD-102`)**:
   - [layoutGround.ts](../../src/game/layoutGround.ts)와 타워·장식 정렬은 원본 텍스처의 투명 여백을 포함한 캔버스 규격과 알파 경계를 기준으로 삼는다. 변환 과정에서 임의로 여백을 잘라내면(`trim`) 전장 좌표가 어긋난다.

## 4. 관련 검증 명령

- 에셋 매니페스트 및 해시 정합성 검사: `npm run validate:assets`
- 실브라우저 화면·접근성 점검: `npm run test:e2e` (포트 충돌 시 `E2E_PORT=5175`)

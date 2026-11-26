---
id: hub-ui-phaser-and-assets
type: hub
title: 화면(R04 UI)·전장(Phaser/Spine)·제작 공정
status: active
updated: 2026-11-26
verified: { commit: a3838293, date: 2026-11-27 }
sources:
  - path: src/game/bridge.ts
    sha256: d174fb7ea5c85ad93424afe0eb92a90508cb3488d66537edda17251254c868f8
  - path: src/game/r6/manifest.ts
    sha256: "9c09e539b001571173004021b1bdb90fe4c367179672def27eed3580214fd13d"
  - path: docs/renewal/r6/map-spec.md
    sha256: "6d3c6ced8eb2a555ed6376d562ce3fd37d7d2e6c98e7e450ae726dcb08b5e594"
  - path: docs/renewal/r6/tech/G2-spike.md
    sha256: "741013a9c3f010dafe49b23789095f6f36116d69412428d6ef1b4048aa76ef01"
  - path: docs/renewal/r6/tech/monster-pipeline.md
    sha256: "4ddd88e111db9d790eebe00a810a65de4dd35aaccdf0314357eaa90d24207603"
  - path: docs/renewal/r6/tech/G5-perf.md
    sha256: "16b0d22d3fe0532d0cfa718fb55e71e4b9fa7b650ca7ea5bdb5549b69914e452"
  - path: docs/renewal/r6/ui/system.md
    sha256: ec6f8ab15b65cf07cb475170c52201b190ba9c4d10258ce19191324ef0e4d7ab
  - path: public/assets/manifest.json
    sha256: "8fde19024d32e38c3463cbec763a7a7b2c1d8bf45ba758a6772d0acf243924ef"
  - path: tools/assets/to-webp.mjs
    sha256: "1b1bd3cc65918039f813a88a414d05dd5186d03fe41583bcd49d8c3f0a6480f0"
---

# 화면(R04 UI)·전장(Phaser/Spine)·제작 공정 (`ui-phaser-and-assets`)

플레이어 화면은 **React 19 UI(`src/ui/`)**와 **Phaser 4 전장(`src/game/`)**으로 분리되며 [bridge.ts](../../src/game/bridge.ts)(`FieldView.projected` 포함)와 `RunController` 스냅샷으로만 통신한다. R6의 시각 기준은 **3차 R04 "전술 지도 + 전술 UI"**(`docs/renewal/r6/round3/concepts/R04/`)다.

## 1. R6 UI/UX (R04 토큰 · 선 아이콘 54종 · 밝은 화면)

- **토큰과 형태** ([system.md](../../docs/renewal/r6/ui/system.md)):
  - 무광 6색: `#12161B`(카본), `#1D242C`(슬레이트), `#4A5563`(선), `#B8C0C8`(은회), `#E69F24`(앰버), `#2FB5A3`(틸). 반짝이·무지개·광택·빛 번짐 금지.
  - 1px 헤어라인, 45° 모따기(`clip-path`), 고정폭 숫자(`tabular-nums`), 글꼴 IBM Plex Sans KR + SUIT(자체 호스팅 전제). 나무 9-slice 틀은 CSS로 대체했다.
- **선 아이콘 SVG 54종**: `status` 8 · `traits` 8 · `relics` 12 · `hud` 26종(`24×24`, `stroke-width="1.75"`, 각진 선화)을 전 화면 13종(홈·새 게임·전투 HUD·타워 상세·해금·보물·일시정지·결과·오답 노트·설명서·설정·랭킹·교실 QR)에 적용했다.
- **교실 대비 · 설정**: 전투 화면이 어두운 테마여도 **문제 패널은 항상 밝은 고대비 면**을 유지한다. 환경설정에서 **밝은 화면(`lightTheme`, `data-theme="light"`)**과 **가벼운 화면(`lightGraphics`, 즉시 화질 3단계)**을 켤 수 있다. 말투는 평이한 한국어만 쓴다.

## 2. R6 전장 (초원 고원 3/4 · 16방향 포두 · Spine Mesh2D · 자동 화질)

- **첫 맵 "초원 고원"과 맵 규격** ([map-spec.md](../../docs/renewal/r6/map-spec.md)):
  - 기존 `garden_u` 좌표(15×9 격자, 길 41칸, 설치대 20개)를 재사용하고 3/4 직교 카메라 `(6.1, −8.2, 6.05)` 등고선 지형으로 굽는다(`src/game/r6/mapProjection.json`). React 오버레이와 드래그 입력은 `projectField` / `unprojectField`로 변환한다.
  - 배경 `meadow-plateau.webp` **26,052B**(예산 ≤150KB), 육각 설치대 시트 `meadow-pads.webp` **2,610B**.
- **타워 렌더·전투 효과**: [manifest.ts](../../src/game/r6/manifest.ts)(`public/assets/r6/manifest-v2.json`)가 타워 6종 11형태의 고정 몸체 + **16방향 포두** + 8프레임 공격 시트(기본 192px / 고해상도 384px)를 관리하며, `src/game/r6/CombatVfx.ts`가 타워별 예광선·포탄·냉기 파동·연쇄 광선·드론 비행·방벽 파동을 그린다.
- **몬스터 Spine Mesh2D 및 종족 지연 적재**: `@esotericsoftware/spine-phaser-v4@4.3.13` 공식 Mesh2D 백엔드(Phaser 4.2.1 WebGL)로 재생한다. 다섯 종족 100개체에 전용 스킨을 연결했다. 현재·다음 웨이브에 등장하는 종족의 아틀라스(`public/assets/r6/monsters/<종족>/`, WebP 768KiB 이내)를 지연 적재하고, 전송에 실패하면 기본 보행체를 사용한다. 초원 고원에서는 큰 적의 표시 높이를 줄이고(`enemyDisplay.ts`, 계통 안 T1→T4 단조) 받침·적·타워를 발밑 Y순으로 그린다. 같은 Y에서는 타워를 적 앞에 두고, 타워가 놓이지 않고 앞쪽 적에게 50% 넘게 가려진 빈 설치 칸만 위층의 짧은 1px R04 모서리 표식으로 표시한다(`padOutline.ts`). 런타임에서는 `enemyDisplay.ts`가 슬롯 `Mesh2D`를 뒤쪽 실루엣 `TintModes.FILL`로 먼저 제출해 아틀라스 원본 색(내부 화소 ΔE76 ≤ 2.68)을 보존한 채 실루엣 바깥 1px 은회(`#B8C0C8`) 테두리를 두른다. 비행 개체(`elf-special`·`machine-special`·`insect-runner`)는 고도(`0.16~0.22칸`)만큼 띄워 절제된 1px 카본/틸 이중 테두리 타원 그림자를, 지상 적은 작고 옅은 카본 접지 그림자를 그린다.
- **자동 화질 3단계** ([G5-perf.md](../../docs/renewal/r6/tech/G5-perf.md)): 5초 평균 30fps 미만 시 단계 하향, 20초 연속 45fps 이상 시 상향.
  - `0단계`: 기본(고해상도 384px) → `1단계`: 192px 시트·연기/비행 그림자 생략 → `2단계`: 원거리 100ms/근거리 50ms Spine 자세 갱신(보스·이동은 매 프레임)·배경 움직임 생략 → `3단계`: 캔버스 내부 해상도 0.75배.

## 3. R6 제작 공정 (Blender 헤드리스 · 레시피 · Spine 양산)

- **타워 공정** ([G2-spike.md](../../docs/renewal/r6/tech/G2-spike.md)): AI 생성은 콘셉트 시트까지만 쓰고, 양산은 **Blender 5.2 LTS 헤드리스 파이썬**(`tools/r6/blender/`, `.blend` 부품 키트) + 진화 레시피 6종(`tools/r6/recipes/*.json`)으로 자동 조립·렌더한다(three.js는 제작 미사용). `tools/r6/qa/check.py`가 48px 실루엣 겹침(타 계열 IoU < 0.55), R04 팔레트, WebP 매니페스트 해시를 검사한다. **6종 66형태 전장 교체 완료**(165쌍 최대 IoU `0.5488`).
- **몬스터 공정** ([monster-pipeline.md](../../docs/renewal/r6/tech/monster-pipeline.md)): 3/4 우향 분해 시트(`1536×1024`)와 조립 그림 한 쌍을 계통별 **파츠 안내판**(`asset-source/r6/monsters/_guides/*.{png,json}`) 규격으로 제작 → `tools/r6/spine/cut_parts.py` 자동 절단 → `monsters.py` + Spine Pro 4.3 CLI(종족당 일반 4뼈대×T1~T4 스킨 + 보스 4뼈대, 총 40뼈대·100개체, 원본 색 유지) → `check-runtime.mjs`·`rig_audit.py`(33자세 접합 0/100 미달)·`review.py` + `contrast.py`(32px 인접 IoU < 0.92, 종족 간 < 0.55, 색 판독, 보스·일반 320쌍 0건, 바깥 1px 테두리 기준 바닥 대비·내부 ΔE76 ≤ 3)·`capture-playwright.mjs` 검수. 일괄 양산은 `tools/r6/spine/batch.py`(조립 IoU 0.70 이상 100/100개체).
- **WebP 규칙 (`DEC-06`)**: `public/assets/**`는 WebP(기본 `cwebp -q 85 -alpha_q 100 -m 6`, 무손실 필요 시 상향)로 싣고 탈락 시안·생성 원본 PNG는 커밋하지 않는다.

## 4. 이전 판(v1) 보존 요약

- 41번 「왕국 원정대」 화풍(`docs/assets/design-41-kingdom-expedition.png` 해시 고정, `W09`), `public/assets/manifest.json` WebP 378장(알파 경계 상자 보존 `L-TD-102`, [to-webp.mjs](../../tools/assets/to-webp.mjs)), 학년별 맵 4종 타일 조립(`layoutGround.ts`)과 반응형 R/S 규칙은 `?balance=v1` 및 보존 기준선으로 유지한다.

## 5. 관련 검증 명령

- 매니페스트 검사: `npm run validate:assets`
- R6 전장·VFX·성능 E2E: `npm run test:e2e -- tests/e2e/r6-battlefield.spec.ts tests/e2e/r6-vfx.spec.ts` · `npm run test:r6-perf`

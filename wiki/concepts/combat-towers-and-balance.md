---
id: hub-combat-towers-and-balance
type: hub
title: 전투·타워 20종·밸런스 시스템
status: active
updated: 2026-11-16
verified: { commit: b9b024bd, date: 2026-11-16 }
sources:
  - path: docs/contracts/balance.candidate.v0.4.json
    sha256: e58e062f13209b1c955a5a6f46a5f4d6b861bc915ad3f8c6cee3904d9c76e486
  - path: docs/contracts/maps.candidate.v0.4.json
    sha256: "70c7d2d30d35c72e36264064a0e60fdc9a602cc07951d8520cd13f88c0ea29a1"
  - path: docs/renewal/README.md
    sha256: "7230e4d3bab99c364914af07ae0292643bf009590a8b63051ff7f97a80842e4c"
  - path: docs/renewal/progression.md
    sha256: "364fb91a3c66626c64bdc6f119c9f10b8a517380a2b6bd953d225856300d8c12"
  - path: docs/balance/r4-final.md
    sha256: "3ce50ccc026b07b67ea0cb9d8702a8f43a353d656da97d6fabfc0774da752716"
---

# 전투·타워 20종·밸런스 시스템 (`combat-towers-and-balance`)

전투·성장·몬스터 설계의 현행 권위 기준은 **[리뉴얼 헌장](../../docs/renewal/README.md)** 및 하위 카탈로그([타워](../../docs/renewal/catalog/towers.md), [몬스터](../../docs/renewal/catalog/monsters.md), [성장·진화](../../docs/renewal/progression.md))이며, 실제 런타임 수치의 단일 진실원은 [balance.candidate.v0.4.json](../../docs/contracts/balance.candidate.v0.4.json)이다. 모든 최신 수치 요약표는 [contracts.md](../contracts.md)에서 확인한다.

## 1. 타워 20종과 Lv4 / Lv7 갈래 진화

- **타워 20종 전체 구현**: 기본 4종(`archer`, `cannon`, `frost`, `mage`) + 징집 해금 16종(`crossbow`, `lightning`, `flame`, `spear`, `guardian`, `banner`, `sling`, `ballista`, `falcon`, `mortar`, `hwacha`, `roller`, `alchemist`, `wind`, `trap`, `bell`).
- **3단 성장·진화 체계** ([progression.md](../../docs/renewal/progression.md)):
  - `Lv1 ~ Lv3`: 기본 스탯 선형 강화
  - `Lv4 (1차 갈래)`: **A / B** 두 역할 중 하나로 분기
  - `Lv7 (최종 특화)`: 선택한 갈래 안에서 **A1 / A2** 또는 **B1 / B2**로 최종 진화 (타워당 6개 진화 정의 보유)
- **판 안 징집(`draft`)과 원정 보물(`relic`)**:
  - 판 시작 시 기본 4종으로 출발하며, 웨이브 **3 · 6 · 9 · 12** 클리어 직후 미보유 타워 3종 중 1종을 골라 장착함(최대 **8칸**)을 넓힌다.
  - 원정 보물 12종 가운데 한 번에 3종을 제안한다. 보물은 공격·경제·속성 시너지를 부여한다. [relics.ts](../../src/domain/relics.ts)

## 2. 종족 8종 × 역할 10종 몬스터와 맵 4종

- **적 구성**: 역할 10종(`walker`, `runner`, `brute`, `shell`, `wisp`, `swarm`, `flyer`, `splitter`, `splitling`, `boss`)이 학년·웨이브 테마에 맞춰 8개 종족(`acorn_goblin`, `river_rafter`, `moon_dokkaebi`, `hearth_yeti`, `brass_mole`, `honey_beetle`, `kiln_pottery`, `breeze_corsair`) 외형과 특성으로 등장한다([factions.ts](../../src/domain/factions.ts)).
- **학년별 맵 4종** ([maps.candidate.v0.4.json](../../docs/contracts/maps.candidate.v0.4.json)): 3학년 `garden_u`(40칸), 4학년 `river_z`(37칸), 5학년 `courtyard`(48칸), 6학년 `snow_step`(38칸) — 모두 **15×9 격자 · 설치 슬롯 20칸**으로 통일되어 있다.

## 3. 확정 경제·전투 규칙 및 밸런스 기준선

- **확정 규칙 (`DEC-04`)**: 난이도 4종(`Easy` 쉬움 / `Normal` 보통 / `Hard` 어려움 / `Crazy` 아주 어려움), **전투 배속 없음**, **웨이브 HP 성장률 115%**, **‘모르겠어요’ `0 PT · 0 골드`**, 웨이브 생존 고비 보상(`milestoneSurvivalGold`).
- **R4 최종 튜닝 기준선**: [r4-final.md](../../docs/balance/r4-final.md)가 전 학년·난이도 승률과 타워 징집 선택률 상한(단일 타워 독점 방지, 교훈 `L-TD-103`) 기준을 기록한다.

## 4. 시뮬레이션 및 조회 명령

- 타워·적·맵 즉시 조회:
  - `npm run wiki:query -- --tower [이름/ID]`
  - `npm run wiki:query -- --enemy [ID]` · `npm run wiki:query -- --map [학년/ID]`
- 밸런스 시뮬레이터 (계약 파일을 덮어쓰지 않고 후보 수치 실험 가능):
  - 가상 플레이어 승률 측정: `npm run simulate:balance -- --diffs Normal --strats novice`
  - 타워·진화 효율 측정: `npm run simulate:towers`
  - 밸런스 관문 통과 검증: `npm run simulate:gate` (`resource-guard --profile test` 권장)

---
id: hub-combat-towers-and-balance
type: hub
title: 전투·타워 6종(Lv20)·몬스터 100개체·밸런스 v2
status: active
updated: 2026-11-25
verified: { commit: e71cac75, date: 2026-11-28 }
sources:
  - path: docs/contracts/balance.v2.json
    sha256: bc3651292280f50ee9c5a73e422b69258453783ae69ed2ff4443a1947598c256
  - path: docs/renewal/r6/PRD-r6.md
    sha256: "2ebe8c0d3e6c29822e5a15714f0a0a8b7a93ba5ce2e22031f83a3a7519be17b3"
  - path: docs/renewal/r6/spec/engine-changes.md
    sha256: "70cf9e197cf0b2ebf68e75d5b68500d588d1f57e2764e457d8c88d3a5d2e8f85"
  - path: docs/renewal/r6/spec/sim-notes.md
    sha256: "0e04303a8ae1faac9de3c34b7c9e3ae2d1f1cf455a40564396f2ed0768ba20b5"
  - path: docs/contracts/balance.candidate.v0.4.json
    sha256: e58e062f13209b1c955a5a6f46a5f4d6b861bc915ad3f8c6cee3904d9c76e486
  - path: docs/contracts/maps.candidate.v0.4.json
    sha256: "70c7d2d30d35c72e36264064a0e60fdc9a602cc07951d8520cd13f88c0ea29a1"
---

# 전투·타워 6종(Lv20)·몬스터 100개체·밸런스 v2 (`combat-towers-and-balance`)

R6 전투·성장·적 설계의 단일 기준은 **[R6 PRD](../../docs/renewal/r6/PRD-r6.md)**와 **[엔진 변경 명세](../../docs/renewal/r6/spec/engine-changes.md)**이며, 런타임 수치 진실원은 **[balance.v2.json](../../docs/contracts/balance.v2.json)**(`balanceVersion: 2.0.0`, 랭킹 시즌 2)이다. 표시 이름은 계약에서 분리해 [r6.ko.json](../../src/content/theme/r6.ko.json)에 둔다.

## 1. 타워 6종 · Lv20 · 무기 I~IV · 순차 해금

- **타워 6종 (모두 무인 전술 기계 장치, 사람·동물형 금지)**:
  | ID | 이름 | 역할 | 무기 I → II(Lv6) → III(Lv12) → IV(Lv18) 핵심 판정 |
  | --- | --- | --- | --- |
  | `rail` | 레일 포탑 | 단일 고속 | 즉발 1발 → 4틱 간격 2발 → 3발 → 가속 단발(피해 2배 + 직선 뒤 추가 1기 65% 관통) |
  | `mortar` | 곡사 포대 | 범위 폭발 | 지상 원형 최대 4기 → 최대 5기·반경 확대 → 지연 착탄 추가 → 착탄·지연 후 장판 2회 |
  | `cryo` | 냉각 중계탑 | 감속·제어 | 원형 파동 감속 1→2→3→4기(미감속·잔여 짧음 우선). IV는 300ms 후 30% 추가 파동 |
  | `prism` | 프리즘 탑 | 연쇄·관통 | 즉발 연쇄 2→3→4→5기(매 연결 감쇠 BP). IV는 마법 저항 1500BP 차감(하한 0) |
  | `hangar` | 드론 격납고 | 대공·추적 | 주기당 드론 1→2→3→4기(비행·미배정 표적 우선, 후속 드론 `followDamageBP`) |
  | `bastion` | 방벽 기지 | 지원·근접 | 근접 지상 1→2→3→4기 밀치기(보스 0) + 이웃 타워 공격력 강화(III부터 공속 추가) |
- **순차 해금과 보물**: 시작 3종(`rail·mortar·cryo`)으로 출발하고 W3·W6·W9 **완료 뒤** `prism`·`hangar`·`bastion`이 순서대로 자동 해금된다(설치 시 골드 소모). 보물 12종(`relics`)은 유지하며 `evolve_stone`은 무기 II·III·IV 전환 거래(Lv5→6·11→12·17→18)에 적용한다.
- **11형태·4재질 진화**: 레벨 상한 Lv20, 형태 단계 `floor(L/2)`로 Lv1·2·4…20까지 **11형태**(6종×11 = **66형태**). 재질은 강철(Lv1~5) → 합금(Lv6~11) → 세라믹 장갑(Lv12~17) → 금테 완성형(Lv18~20)으로 바뀌며, 레벨별 `tools/r6/recipes/<id>.json`이 렌더와 능력치를 연결한다.

## 2. 몬스터 5종족×20개체 (100개체)와 시드 혼합

- **5종족**: `elf`(숲 엘프, 비행 특수)·`human`(철갑 인간, 공성 수레)·`machine`(기계 군단, 분열 1조각)·`insect`(군체 벌레, 분열 2조각)·`stone`(바위 거인, 3초마다 최대 3회 3% 재생). 피·공포·치비·밈·음식 금지.
- **종족당 20개체**: 일반 4계통(`infantry` 보병·`runner` 질주·`armored` 중장갑·`special` 특수) × `T1~T4` 16개체 + 보스 4종(`boss-t1~t4`, 5·10·15·20웨이브급). 정규 ID는 `<종족>-<계통>-t<1~4>`로 통일한다.
- **시드 웨이브 혼합 (`r6-mix-1`)**: W1~3(무작위 2종족·T1) → W4~6(3종족·T1~T2) → W7~10(4종족·T2~T3) → W11~15(5종족 교대·T2~T3) → W16~20(5종족 혼성·T3~T4) → W21+(무한·정예 확률 상승). 결정적 시드로 예고·스폰·시뮬레이터가 같은 편성을 공유한다.

## 3. 계약 선택 · 공통 규칙 · v2 밸런스 실측

- **계약 선택**: 기본은 `2.0.0`(전 학년 `garden_u` 초원 고원 맵 + 학년별 문제은행), 개발 환경에서 `?balance=v1`으로 `1.0.0`을 연다.
- **유지된 규칙 (`DEC-04`)**: 난이도 4종(`Easy` 쉬움 / `Normal` 보통 / `Hard` 어려움 / `Crazy` 아주 어려움), 전투 배속 없음, 웨이브 HP 115% 성장, ‘모르겠어요’ `0 PT · 0 골드`, 고비 생존 보상.
- **v2 시뮬레이션 2차 조정 결과** ([sim-notes.md](../../docs/renewal/r6/spec/sim-notes.md), `node tools/sim-gate.mjs --v2 --seeds 8`):
  - 보통 초보(60%) **11웨이브**(목표 10~12), 보통 균형(80%) **15웨이브**(14~17), 보통 최적화(95%) **23웨이브**(22~26), 초보↔최적화 **12웨이브**(≥12).
  - 난이도 간격(보통 대비): 쉬움 **+5**, 어려움 **−3**, 아주 어려움 **−6** 모두 목표 충족. 정답 골드 몫 **73.2%**(≥55%), 웨이브당 평균 1.424분.

## 4. 이전 판(v1, `balanceVersion: 1.0.0`) 보존 요약

- 계약: [balance.candidate.v0.4.json](../../docs/contracts/balance.candidate.v0.4.json) · [maps.candidate.v0.4.json](../../docs/contracts/maps.candidate.v0.4.json) · 기준선 [r4-final.md](../../docs/balance/r4-final.md).
- 구성: 타워 20종(기본 4종 + W3·6·9·12 3지선다 선택 해금 `draft` 최대 8칸, Lv4 A/B·Lv7 A1/A2/B1/B2 갈래 진화), 적 역할 10종×종족 8종, 학년별 맵 4종(`garden_u`, `river_z`, `courtyard`, `snow_step`). 현재 운영 중인 시즌 1과 개발용 `?balance=v1`을 위해 지우지 않고 보존한다.

## 5. 시뮬레이션 및 조회 명령

- R6 v2 관문·비교: `npm run simulate:gate -- --v2 --seeds 8` · `npm run simulate:balance -- --v2 --diffs Normal --strats mono-rail,balanced --acc 0.8`
- v1 계약 즉시 조회: `npm run wiki:query -- --tower [이름/ID]` · `--enemy [ID]` · `--map [학년/ID]`
- v1 시뮬레이터: `npm run simulate:balance -- --diffs Normal --strats novice` · `npm run simulate:towers` · `npm run simulate:gate`

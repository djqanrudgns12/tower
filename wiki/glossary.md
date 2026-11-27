---
id: wiki-glossary
type: glossary
title: 용어 및 약어 사전
status: active
updated: 2026-11-25
verified: { commit: c5001fd9, date: 2026-11-27 }
sources:
  - path: vocabulary_td_prd_v0_5.md
    sha256: "0ffd7049c672ae427f1b59b2ef80222ea745b24911b13e78d1ee5680a7902cf5"
  - path: docs/renewal/README.md
    sha256: "7230e4d3bab99c364914af07ae0292643bf009590a8b63051ff7f97a80842e4c"
  - path: docs/renewal/r6/PRD-r6.md
    sha256: "2ebe8c0d3e6c29822e5a15714f0a0a8b7a93ba5ce2e22031f83a3a7519be17b3"
  - path: docs/renewal/r6/map-spec.md
    sha256: "9b36b9d3b65f57ae8c17d1995e36e642a91d520f42cce302699089f9ae2e46f5"
  - path: docs/renewal/r6/tech/G5-perf.md
    sha256: "16b0d22d3fe0532d0cfa718fb55e71e4b9fa7b650ca7ea5bdb5549b69914e452"
  - path: docs/renewal/r6/tech/G5-server.md
    sha256: a4dde2850b32b8b9153902259fd7a54a3d157f08e526b8e4dba0116b2a073036
  - path: docs/CR1000_HANDOFF.md
    sha256: c3c01581eceead622afc236790d68ce0c3f6f600317b819d9f549176dbb1707c
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
---

# 용어 및 약어 사전 (`glossary`)

> 추측으로 약어를 해석하지 않는다. 새 약어가 도입되면 이 표에 먼저 정의한다. 조회: `npm run wiki:query -- --glossary <키워드>`.

| 용어 / 약어 | 분류 | 뜻 | 근거 |
| --- | --- | --- | --- |
| `PT` | 게임 규칙 | 한 판에서 획득하는 점수 단위. 정답·처치·고비 생존으로 얻고 오답 시 감점되며 ‘모르겠어요’는 0점이다. | [vocabulary_td_prd_v0_5.md](../vocabulary_td_prd_v0_5.md) |
| `honor_pt` (랭킹 점수) | 랭킹·점수 | 1웨이브 이상 지킨 정규 판에서 난이도 배율(80/100/125/150%)과 정수 산식으로 계산하는 누적 점수(상한 5,000). | [src/contracts/lobby.ts](../src/contracts/lobby.ts) |
| `BP` (Basis Points) | 도메인 단위 | 부동소수점 오차를 없애기 위한 만분율 정수 단위 (`10000 BP = 1.0`, `100 BP = 1%`). | [balance.v2.json](../docs/contracts/balance.v2.json) |
| `milli` | 도메인 단위 | 천분율 정수 단위 (`1000 milli-HP = 1 HP`, `1000 milli-cells = 1칸`). | [balance.v2.json](../docs/contracts/balance.v2.json) |
| `30Hz 고정 틱` | 도메인 엔진 | `RunController`가 1초를 30틱(`33.33ms`)으로 고정해 전투·이동을 결정적으로 계산하는 시뮬레이션 주기. | [RunController.ts](../src/application/RunController.ts) |
| `R6` / `R04 전술 UI` | R6 대개편 | 2026-11-25 확정된 대개편 판(`balanceVersion: 2.0.0`). 무광 6색(`#12161B`·`#1D242C`·`#4A5563`·`#B8C0C8`·`#E69F24`·`#2FB5A3`), 1px 선, 45° 모따기, 평이한 말투를 기준으로 한다. | [PRD-r6.md](../docs/renewal/r6/PRD-r6.md) |
| `밸런스 v2 (2.0.0)` | R6 계약 | 타워 6종 Lv20·무기 I~IV·순차 해금, 몬스터 5종족×20, 시드 혼합기(`r6-mix-1`)를 정의하는 계약. 개발 환경 `?balance=v1`으로 `1.0.0` 전환 가능. | [balance.v2.json](../docs/contracts/balance.v2.json) |
| `무기 단계 I~IV · 11형태` | R6 타워 | `floor(L/2)`로 Lv1·2·4…20까지 11형태로 진화하고 Lv1/6/12/18마다 무기 단계와 재질(강철→합금→세라믹→금테)이 바뀌는 성장 체계. | [PRD-r6.md](../docs/renewal/r6/PRD-r6.md) |
| `진화 레시피` | R6 제작 공정 | `tools/r6/recipes/<id>.json`에 11단계 부품 슬롯·재질·무기 파라미터를 담아 Blender 자동 렌더와 게임 수치를 동기화하는 규격. | [G2-spike.md](../docs/renewal/r6/tech/G2-spike.md) |
| `초원 고원` (`garden_u`) | R6 전장 | 기존 `garden_u`(15×9·길 41칸·설치대 20개) 좌표 위에 3/4 직교 등고선 지형과 육각 설치대를 올린 R6 2.0.0 기준 맵. V2(2.1.0 예정)는 초기맵 `meadow_easy`(45칸·24설치대)부터 학년×난이도 16전장으로 확장한다. | [map-spec.md](../docs/renewal/r6/map-spec.md) |
| `spine-phaser-v4` Mesh2D | R6 렌더링 | Phaser 4.2.1 WebGL에서 Spine 4.3 뼈대·스킨(T1~T4)을 직접 그리는 공식 플러그인 백엔드. 종족 아틀라스 지연 적재와 함께 쓴다. | [G2-spike.md](../docs/renewal/r6/tech/G2-spike.md) |
| `자동 화질 3단계` | R6 성능 | `RenderQuality`가 5초 평균 FPS를 재어 `0→1→2→3` 단계로 해상도·효과·Spine 갱신 간격을 자동 조절하고 3단계 15fps 미만 10초 시 정지하는 장치. | [G5-perf.md](../docs/renewal/r6/tech/G5-perf.md) |
| `ranking_seasons` | 시즌 2 서버 | `balance_version`(`1.0.0`/`2.0.0`)과 `season_id`(`season1`/`season2`), `submissions_open`을 연결하는 D1 표. 2026-11-27 운영 반영. | [G5-server.md](../docs/renewal/r6/tech/G5-server.md) |
| `고비 (Milestone)` | 게임 규칙 | 5·10·15·20…웨이브마다 보스가 등장하고 생존 시 난이도별 추가 골드·PT를 지급하는 구간. | [product.defaults.v0.5.json](../docs/contracts/product.defaults.v0.5.json) |
| `보물 (Relic)` | 전투 강화 | 판 안 특정 시점에 3종 중 1종을 골라 타워·경제에 지속 효과를 주는 강화 카드 12종. | [balance.v2.json](../docs/contracts/balance.v2.json) |
| `R 모드` / `S 모드` | 반응형 화면 | 가로 여유가 충분해 우측 패널을 두는 `R 모드`와, 좁은 화면·폰에서 상하 배치하는 `S 모드`. | [vocabulary_td_prd_v0_5.md](../vocabulary_td_prd_v0_5.md) |
| `이전 판(v1) 선택 해금(draft)` | 이전 판(v1) | v1(`1.0.0`)에서 기본 4종으로 시작해 W3·6·9·12 후 20종 중 3지선다로 장착함(최대 8칸)을 넓히던 규칙. | [towers.md](../docs/renewal/catalog/towers.md) |
| `Lv4 A/B · Lv7 A1/A2/B1/B2` | 이전 판(v1) | v1(`1.0.0`) 타워 20종의 Lv4 1차 갈래·Lv7 2차 특화 진화 체계. | [progression.md](../docs/renewal/progression.md) |
| `41번 화풍` (`style-41`) | 이전 판(v1) | v1 기준 원화 `docs/assets/design-41-kingdom-expedition.png`의 카툰 화풍(SHA-256 해시 고정 보존). | [style-lock-v1.md](../docs/style-lock-v1.md) |
| `CR-1000` | 문제은행 공정 | 초등 3~6학년 자기 학년 공개 승인 문항을 각 1,000개 이상(합계 5,547개 달성) 확보하기 위한 다중 모델 블라인드 공동검수. | [CR1000_HANDOFF.md](../docs/CR1000_HANDOFF.md) |
| `학년 띠 공유` (`sharedCount`) | 문제은행 | 수준 합의된 문항을 인접 상위 학년 출제 풀에 함께 수록하는 방식. 자기 학년 하한 집계에서는 제외한다. | [CONTENT_REVIEW_PLAN.md](../docs/CONTENT_REVIEW_PLAN.md) |
| `commit-lock` | 동시성 제어 | `content-source/**`, `src/content/questions/**`, `server/seed/question_keys.sql`을 원자적으로 검증·커밋하는 단일 잠금 도구. | [commit-lock.mjs](../tools/orchestrate/commit-lock.mjs) |
| `question_regraded_combat_bounded` | 서버 검증 | 완주 기록의 답안을 D1 `question_keys`로 재채점하고 전투 수치 상한을 통과했음을 뜻하는 검증 등급. | [0001_init.sql](../server/migrations/0001_init.sql) |
| `standings` | D1 랭킹 표 | D1 읽기 한도 보호를 위해 최고 점수·최고 웨이브·랭킹 점수 순위를 미리 집계해 두는 `WITHOUT ROWID` 테이블. | [0001_init.sql](../server/migrations/0001_init.sql) |
| `회색 구름 (DNS only)` | 네트워크 운영 | `voca.ssamuniverse.com`에서 KT 학교망이 미국 거점을 우회하지 않도록 Cloudflare 프록시를 끈 설정. | [DEPLOY.md](../docs/DEPLOY.md) |

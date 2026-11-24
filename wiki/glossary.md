---
id: wiki-glossary
type: glossary
title: 용어 및 약어 사전
status: active
updated: 2026-11-16
verified: { commit: a402d63f, date: 2026-11-24 }
sources:
  - path: vocabulary_td_prd_v0_5.md
    sha256: "0ffd7049c672ae427f1b59b2ef80222ea745b24911b13e78d1ee5680a7902cf5"
  - path: docs/renewal/README.md
    sha256: "7230e4d3bab99c364914af07ae0292643bf009590a8b63051ff7f97a80842e4c"
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
| `honor_pt` (원정 명예점) | 랭킹·점수 | 1웨이브 이상 수호한 정규 판에서 난이도 배율(80/100/125/150%)과 정수 산식으로 계산하는 누적 명예 점수(상한 5,000). | [src/contracts/lobby.ts](../src/contracts/lobby.ts) |
| `BP` (Basis Points) | 도메인 단위 | 부동소수점 오차를 없애기 위한 만분율 정수 단위 (`10000 BP = 1.0`, `100 BP = 1%`). | [balance.candidate.v0.4.json](../docs/contracts/balance.candidate.v0.4.json) |
| `milli` | 도메인 단위 | 천분율 정수 단위 (`1000 milli-HP = 1 HP`, `1000 milli-cells = 1칸`). | [balance.candidate.v0.4.json](../docs/contracts/balance.candidate.v0.4.json) |
| `30Hz 고정 틱` | 도메인 엔진 | `RunController`가 1초를 30틱(`33.33ms`)으로 고정해 전투·이동을 결정적으로 계산하는 시뮬레이션 주기. | [RunController.ts](../src/application/RunController.ts) |
| `R 모드` / `S 모드` | 반응형 화면 | 가로 여유가 충분해 우측 관리 레일(`Rail`)을 두는 `R 모드`와, 좁은 화면·폰에서 상하 적층(`Stack`)으로 배치하는 `S 모드`. | [vocabulary_td_prd_v0_5.md](../vocabulary_td_prd_v0_5.md) |
| `고비 (Milestone)` | 게임 규칙 | 5·10·15·20…웨이브마다 강한 대장이 등장하고 생존 시 난이도별 추가 골드·PT를 지급하는 구간. | [product.defaults.v0.5.json](../docs/contracts/product.defaults.v0.5.json) |
| `징집 (Draft)` | 타워 시스템 | 기본 4종 타워로 시작해 W3·W6·W9·W12 클리어 직후 3종 후보 중 1종을 골라 장착함(최대 8칸)을 넓히는 규칙. | [towers.md](../docs/renewal/catalog/towers.md) |
| `원정 보물 (Relic)` | 전투 강화 | 판 안 특정 시점에 선택해 전체 타워·경제에 지속 효과를 주는 유물 카드. | [prd-r4-ui-learning.md](../docs/renewal/prd-r4-ui-learning.md) |
| `Lv4 A/B · Lv7 A1/A2/B1/B2` | 타워 진화 | Lv1~3 기본형 이후 Lv4에서 1차 갈래(`A`/`B`), Lv7에서 각 갈래별 2차 진화(`A1`/`A2`/`B1`/`B2`)로 분기하는 3단 성장 체계. | [progression.md](../docs/renewal/progression.md) |
| `종족 × 역할 (Faction × Role)` | 몬스터 체계 | 물리/이동 능력은 10개 `역할`(`walker`, `runner`, `flyer` 등)이 맡고, 외형과 지역 연출은 8개 `종족`(`acorn_goblin` 등)이 맡는 분리 구조. | [monsters.md](../docs/renewal/catalog/monsters.md) |
| `41번 화풍` (`style-41`) | 아트 기준 | 확정된 기준 원화 `docs/assets/design-41-kingdom-expedition.png`의 따뜻한 왕국 원정대 카툰 화풍(SHA-256 해시 고정). | [style-lock-v1.md](../docs/style-lock-v1.md) |
| `R1 ~ R5` | 리뉴얼 단계 | 2026-10-30 이후 진행된 게임 디자인·타워 20종·전투 UI·밸런스·참나무(Oak v2) 전면 고도화 단계. PRD v0.5보다 우선한다. | [docs/renewal/README.md](../docs/renewal/README.md) |
| `CR-1000` | 문제은행 공정 | 초등 3~6학년 자기 학년 공개 승인 문항을 각 1,000개 이상(합계 5,547개 달성) 확보하기 위한 다중 모델 블라인드 공동검수 사업. | [CR1000_HANDOFF.md](../docs/CR1000_HANDOFF.md) |
| `codex-argon-v1` / `claude-argon-v1` | 검수 정책 | Argon 자체 반박 + Codex(또는 사용량 소진 시 Claude Opus) 블라인드 독립 풀이·해설 대조로 공개 승인을 판정하는 정책. | [CR1000_REVIEW_POLICY.md](../docs/CR1000_REVIEW_POLICY.md) |
| `학년 띠 공유` (`sharedCount`) | 문제은행 | 수준 합의된 문항을 인접 상위 학년 출제 풀에 함께 수록하는 방식. 자기 학년 1,000문항 하한 집계에서는 제외하고 출제 풀에만 더한다. | [CONTENT_REVIEW_PLAN.md](../docs/CONTENT_REVIEW_PLAN.md) |
| `commit-lock` | 동시성 제어 | `content-source/**`, `src/content/questions/**`, `server/seed/question_keys.sql`을 원자적으로 검증·커밋하는 단일 잠금 도구. | [commit-lock.mjs](../tools/orchestrate/commit-lock.mjs) |
| `question_regraded_combat_bounded` | 서버 검증 | 클라이언트가 제출한 완주 기록의 문항 답안을 D1 `question_keys`로 재채점하고 전투 수치 상한을 통과했음을 뜻하는 검증 등급. | [0001_init.sql](../server/migrations/0001_init.sql) |
| `standings` | D1 랭킹 표 | D1 무료 읽기 한도(일 500만 행) 보호를 위해 최고 점수·최고 웨이브·명예점 순위를 미리 집계해 두는 `WITHOUT ROWID` 테이블. | [0001_init.sql](../server/migrations/0001_init.sql) |
| `회색 구름 (DNS only)` | 네트워크 운영 | `voca.ssamuniverse.com`에서 KT 학교망이 미국 거점을 우회하지 않고 서울 GitHub Pages CDN으로 직결되도록 Cloudflare 프록시를 끈 설정. | [DEPLOY.md](../docs/DEPLOY.md) |

---
id: wiki-contracts
type: registry
title: 살아있는 코드·데이터 계약
status: active
generated_by: tools/wiki/gen.mjs
---

# 살아있는 코드·데이터 계약 (`contracts`)

> 이 파일은 `npm run wiki:sync` (`tools/wiki/gen.mjs`)가 코드·계약 JSON·SQL에서 결정적으로 자동 생성합니다. 직접 수정하지 마세요.

## 1. 버전 및 에셋 개요

| 항목 | 값 | 원본 |
| --- | --- | --- |
| 앱·규칙·밸런스 버전 | `1.0.0` / `0.5-candidate` / `1.0.0` | [package.json](../package.json), [balance.candidate.v0.4.json](../docs/contracts/balance.candidate.v0.4.json) |
| 맵 버전 / 화풍 ID | `0.4-candidate` / `design-41-kingdom-expedition` | [product.defaults.v0.5.json](../docs/contracts/product.defaults.v0.5.json) |
| 고정 틱 / 단위 체계 | `30Hz`, `10000 BP = 1.0`, `1000 milli = 1` | [balance.candidate.v0.4.json](../docs/contracts/balance.candidate.v0.4.json) |
| 등록 원화 에셋 / PNG 예외 | WebP `378`장 / PNG 예외 `0`건 | [public/assets/manifest.json](../public/assets/manifest.json) |

## 2. 공개 문제은행 현황 (`src/content/questions/manifest.json`)

| 학년 | 은행 ID | 은행 판 (`bankVersion`) | 자기 학년 문항 | 공유 유입 문항 | 총 출제 풀 |
| ---: | --- | --- | ---: | ---: | ---: |
| 3학년 | `g3` | `pub-g3-bb3755cc2e06` | 1,140 | 0 | **1,140** |
| 4학년 | `g4` | `pub-g4-85e64d1e76b4` | 1,261 | 302 | **1,563** |
| 5학년 | `g5` | `pub-g5-061017459d44` | 1,508 | 361 | **1,869** |
| 6학년 | `g6` | `pub-g6-19ead5b7ab8d` | 1,638 | 373 | **2,011** |
| **합계** | - | 연습 `4`문항 · 철회 `0`건 | **5,547** | 1,036 | **6,583** |

## 3. 난이도 4단계 수치 (`balance.candidate.v0.4.json`)

| ID | 표시 | 성문 HP | 적 HP 배율 | 정답 PT | 오답 PT | 모르겠어요 PT | 정답 골드 | 처치 골드(일반/정예/보스) | 고비 골드 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Easy` | 쉬움 | 20 | ×0.60 | +10 | -5 | 0 | 17G | 1/3/60G | 30G |
| `Normal` | 보통 | 15 | ×1.00 | +15 | -8 | 0 | 19G | 1/4/75G | 40G |
| `Hard` | 어려움 | 10 | ×1.90 | +20 | -10 | 0 | 22G | 2/6/90G | 50G |
| `Crazy` | 아주 어려움 | 7 | ×3.60 | +30 | -15 | 0 | 25G | 3/8/105G | 60G |

## 4. 학년별 맵 4종 (`maps.candidate.v0.4.json`)

| 맵 ID | 학년 | 격자 | 경로 길이 | 기본 이동 틱 | 입구 → 출구 | 설치 슬롯 | 장식 수 |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: |
| `garden_u` | 3학년 | 15×9 | 40칸 | 720틱 | `(0,1)` → `(14,7)` | 20칸 | 5개 |
| `river_z` | 4학년 | 15×9 | 37칸 | 720틱 | `(0,1)` → `(14,6)` | 20칸 | 5개 |
| `courtyard` | 5학년 | 15×9 | 48칸 | 720틱 | `(0,1)` → `(8,5)` | 20칸 | 5개 |
| `snow_step` | 6학년 | 15×9 | 38칸 | 720틱 | `(0,1)` → `(14,7)` | 20칸 | 5개 |

## 5. 타워 20종 기본 스펙 (`balance.candidate.v0.4.json`)

- 판 안 징집(`draft`): 시작 기본 `4`종(`archer, cannon, frost, mage`), 웨이브 `3·6·9·12` 직후 `3`종 중 택1, 장착함 최대 `8`칸 · 원정 보물 `12`종.

| 타워 ID | 이름 | 비용 | 속성 | 기본 피해 | 공격 간격 | 사거리(칸) | 동시 표적 | 대공 | 진화 형태 수 |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | :---: | ---: |
| `archer` | 궁수탑 | 60G | 물리 | 8 | 1000ms | 2.5 | 1 | O | 6 |
| `crossbow` | 석궁탑 | 100G | 물리 | 25 | 2000ms | 3.2 | 1 | O | 6 |
| `cannon` | 포탑 | 100G | 물리 | 18 | 2000ms | 2.4 | 4 | X | 6 |
| `mage` | 마법탑 | 95G | 마법 | 16 | 1400ms | 2.4 | 1 | O | 6 |
| `frost` | 서리탑 | 60G | 마법 | 5 | 900ms | 2 | 1 | O | 6 |
| `lightning` | 번개탑 | 150G | 마법 | 14 | 1500ms | 2.5 | 3 | O | 6 |
| `flame` | 화염탑 | 130G | 마법 | 8 | 750ms | 1.7 | 3 | X | 6 |
| `spear` | 창병초소 | 70G | 물리 | 7 | 480ms | 1.3 | 1 | X | 6 |
| `guardian` | 수호기사 | 180G | 물리 | 30 | 1400ms | 1.8 | 1 | X | 6 |
| `banner` | 깃발초소 | 85G | 물리 | 0 | 0ms | 3 | 1 | X | 6 |
| `sling` | 투석초소 | 65G | 물리 | 8 | 1100ms | 2.3 | 1 | O | 6 |
| `ballista` | 거대노포 | 125G | 물리 | 35 | 2400ms | 3.8 | 4 | O | 6 |
| `falcon` | 매사냥대 | 100G | 물리 | 16 | 1200ms | 3.4 | 1 | O | 6 |
| `mortar` | 박격포대 | 135G | 물리 | 26 | 2800ms | 4.6 | 5 | X | 6 |
| `hwacha` | 화차대 | 130G | 물리 | 10 | 2500ms | 3.1 | 2 | O | 6 |
| `roller` | 통나무굴림대 | 95G | 물리 | 15 | 2200ms | 1.8 | 5 | X | 6 |
| `alchemist` | 약병투척소 | 90G | 마법 | 5 | 1800ms | 2.3 | 5 | X | 6 |
| `wind` | 바람개비탑 | 90G | 마법 | 7 | 1400ms | 2.4 | 4 | O | 6 |
| `trap` | 덫공방초소 | 85G | 물리 | 16 | 2200ms | 2 | 1 | X | 6 |
| `bell` | 종각초소 | 120G | 마법 | 9 | 2000ms | 2.3 | 5 | O | 6 |

## 6. 적 역할 10종 및 종족 8종

- 등록 종족(`factions`): `acorn_goblin`(들숲 새참 도적단), `river_rafter`(여울목 통발 패거리), `moon_dokkaebi`(달빛 장터 도깨비단), `hearth_yeti`(화톳불 털복숭이 유목단), `brass_mole`(태엽 등불 두더지단), `honey_beetle`(호박꿀 딱정벌레 기사단), `kiln_pottery`(가마터 토기 정령단), `breeze_corsair`(솔바람 하늘유랑단)

| 역할 ID | HP 배율 | 이동속도 배율 | 특성·저항 |
| --- | ---: | ---: | --- |
| `walker` | ×1.00 | ×1.00 | 기본 지상 |
| `runner` | ×0.70 | ×1.35 | 기본 지상 |
| `brute` | ×1.80 | ×0.75 | 기본 지상 |
| `shell` | ×1.15 | ×0.90 | 물리저항 35% |
| `wisp` | ×1.00 | ×1.10 | 마법저항 35% |
| `swarm` | ×0.55 | ×1.10 | 기본 지상 |
| `flyer` | ×0.85 | ×1.15 | 비행, 성문피해 2 |
| `splitter` | ×1.10 | ×0.95 | 분열→splitling×2 |
| `splitling` | ×0.30 | ×1.25 | 기본 지상 |
| `boss` | ×2.10 | ×0.65 | 기본 지상 |

## 7. 기록·랭킹 서버 API 및 Cloudflare D1 스키마 (`server/`)

- Worker: `vocabulary-td-api` · 도메인: `https://voca-api.ssamuniverse.com` · 허용 출처: `https://voca.ssamuniverse.com` · 랭킹 캐시: `60초` · D1: `vocabulary-td` · 정리 Cron: `0 19 * * *`

### 7.1 HTTP 엔드포인트 (`server/src/app.ts`)

| 메서드 | 경로 | 기기 토큰 인증 | 핸들러 | 위치 |
| --- | --- | :---: | --- | --- |
| `GET` | `/v1/health` | 불필요 | `healthCheck` | [server/src/app.ts#L32](../server/src/app.ts#L32) |
| `GET` | `/v1/schools` | 불필요 | `searchSchools` | [server/src/app.ts#L33](../server/src/app.ts#L33) |
| `POST` | `/v1/device` | 불필요 | `issueDevice` | [server/src/app.ts#L34](../server/src/app.ts#L34) |
| `POST` | `/v1/lobby-visit` | 필수(`Bearer`) | `recordLobbyVisit` | [server/src/app.ts#L35](../server/src/app.ts#L35) |
| `POST` | `/v1/runs/start` | 필수(`Bearer`) | `recordRunStart` | [server/src/app.ts#L36](../server/src/app.ts#L36) |
| `POST` | `/v1/runs/submit` | 필수(`Bearer`) | `submitCompletedRun` | [server/src/app.ts#L37](../server/src/app.ts#L37) |
| `GET` | `/v1/leaderboard` | 필수(`Bearer`) | `getLeaderboard` | [server/src/app.ts#L38](../server/src/app.ts#L38) |

### 7.2 D1 SQLite 테이블 (`server/migrations/0001_init.sql`)

| 테이블명 | 열 수 | `WITHOUT ROWID` | 역할 요약 | 위치 |
| --- | ---: | :---: | --- | --- |
| `global_metrics` | 4 | - | 누적 지표(행 하나). | [server/migrations/0001_init.sql#L8](../server/migrations/0001_init.sql#L8) |
| `daily_metrics` | 4 | O | 한국 날짜별 방문 기기 수·판 수. | [server/migrations/0001_init.sql#L17](../server/migrations/0001_init.sql#L17) |
| `daily_visitor_hashes` | 3 | O | 오늘 처음 온 기기인지 가리는 표. 7일 뒤 지운다(scheduled 정리). | [server/migrations/0001_init.sql#L25](../server/migrations/0001_init.sql#L25) |
| `lobby_presence` | 2 | O | 최근 5분 안에 홈을 연 기기 수(실시간 접속 웹소켓 대체). 하루 지난 행은 지운다. | [server/migrations/0001_init.sql#L41](../server/migrations/0001_init.sql#L41) |
| `run_start_dedup` | 4 | O | 판 시작 기록. 제출 때 시작 시각·소유자를 확인한다. 7일 뒤 지운다. | [server/migrations/0001_init.sql#L48](../server/migrations/0001_init.sql#L48) |
| `question_keys` | 5 | O | 공개 은행 정답 키·검증 규칙·승인 조건(server/seed/question_keys.sql로 채운다). | [server/migrations/0001_init.sql#L64](../server/migrations/0001_init.sql#L64) |
| `run_verification_rules` | 3 | O | - | [server/migrations/0001_init.sql#L73](../server/migrations/0001_init.sql#L73) |
| `approved_run_conditions` | 5 | O | - | [server/migrations/0001_init.sql#L80](../server/migrations/0001_init.sql#L80) |
| `completed_runs` | 26 | O | 기기가 보낸 종료 시각 원본(local_ended_at)을 따로 둔다. | [server/migrations/0001_init.sql#L91](../server/migrations/0001_init.sql#L91) |
| `rate_limits` | 8 | O | 한도를 넘는 증가는 CHECK가 막아 batch 전체가 되돌아간다(거부된 호출은 세지 않는다는 Postgres allow_lobby_rpc와 같다). | [server/migrations/0001_init.sql#L200](../server/migrations/0001_init.sql#L200) |
| `standings` | 17 | O | - | [server/migrations/0003_school_honor.sql#L5](../server/migrations/0003_school_honor.sql#L5) |
| `ranking_seasons` | 3 | O | 은행·지도 조합의 승인과 별도로 시즌 제출을 닫아도 과거 순위는 계속 조회한다. | [server/migrations/0004_ranking_seasons.sql#L2](../server/migrations/0004_ranking_seasons.sql#L2) |

### 7.3 SQLite 트리거

| 트리거명 | 조건 | 위치 |
| --- | --- | --- |
| `daily_visitor_hashes_counted` | `AFTER INSERT ON daily_visitor_hashes` | [server/migrations/0001_init.sql#L33](../server/migrations/0001_init.sql#L33) |
| `run_start_dedup_counted` | `AFTER INSERT ON run_start_dedup` | [server/migrations/0001_init.sql#L56](../server/migrations/0001_init.sql#L56) |
| `completed_runs_standings` | `AFTER INSERT ON completed_runs` | [server/migrations/0003_school_honor.sql#L56](../server/migrations/0003_school_honor.sql#L56) |

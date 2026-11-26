---
id: hub-persistence-and-ranking-server
type: hub
title: 로컬 저장(IndexedDB) 및 기록·랭킹 서버(Workers/D1)
status: active
updated: 2026-11-25
verified: { commit: a3838293, date: 2026-11-27 }
sources:
  - path: src/persistence/reviewNote.ts
    sha256: "729abb95daffa0b758340070f97fd326647b7e00f7d23f1e0eb34734e6fcad41"
  - path: server/wrangler.toml
    sha256: "630d680192e27718f41a94011e16707eaa30f36a976a4bc482aeb881b4f0271a"
  - path: server/migrations/0001_init.sql
    sha256: "071a8e211e35bc76c762b12986cf7b0e8f1c5a4fb9411e2830125bf50e881cc2"
  - path: server/migrations/0004_ranking_seasons.sql
    sha256: "2bea38c01b19b172d79a76fee8ee4781306314d083519f6a1a3d86d7a5dc7b2c"
  - path: docs/renewal/r6/tech/G5-server.md
    sha256: "895f648cac4edc29c8eadafdd6bcced05880e8b8609c5f49d33099f832099dae"
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: docs/HOSTING_IMPL_PLAN.md
    sha256: "79f1f85a62652e420cf36b3a1a0f058656fb8685fb5f179d825f5570caed6701"
---

# 로컬 저장(IndexedDB) 및 기록·랭킹 서버 (`persistence-and-ranking-server`)

학습 이력과 완주 기록은 **로컬 우선(Local-First) IndexedDB**에 즉시 보존되고, 온라인 환경에서는 **Cloudflare Workers + D1 에지 서버**가 서버 측 재채점을 거쳐 전국·학교 통합 랭킹을 집계한다. 서버 라우트 7종과 D1 테이블 12종 명세는 [contracts.md](../contracts.md)에 자동 추출된다.

## 1. 클라이언트 영속 계층 (`src/persistence/`)

- **IndexedDB 저장소** ([db.ts](../../src/persistence/db.ts)): 최고 기록, 판별 요약(`balanceVersion` 포함), 설정([settings.ts](../../src/persistence/settings.ts): `lightTheme`·`lightGraphics` 포함), 미전송 제출 큐를 영속화한다.
- **오답 노트** ([reviewNote.ts](../../src/persistence/reviewNote.ts)): 판 도중 틀렸거나 ‘모르겠어요’를 선택한 문항을 누적 기록해 홈 오답 노트에서 복습한다.
- **오프라인 시즌 분리 및 폴백** ([lobbyClient.ts](../../src/persistence/lobbyClient.ts), [lobby.ts](../../src/contracts/lobby.ts)): API 오류·단절 시 로컬 모드로 자동 전환하며, 오프라인 랭킹과 내 기록도 `balanceVersion` 기준으로 시즌 1(`1.0.0`)과 시즌 2(`2.0.0`)를 나눠 표시한다(`7d3ef54a`).

## 2. 기록·랭킹 서버 아키텍처 (`server/` · `DEC-08`)

- **단일 도메인 및 비밀값 분리** ([wrangler.toml](../../server/wrangler.toml)):
  - 운영 주소는 `https://voca-api.ssamuniverse.com` 하나뿐이며, WAF·거점 캐시 우회를 막기 위해 `workers_dev = false`로 고정한다(`L-TD-202`).
  - 유일한 비밀값 `PLAYER_SALT`는 기기 토큰 HMAC 서명에만 쓰며 저장소·대화·시험 코드에 절대 적지 않는다(로컬은 `server/.dev.vars`).
- **HTTP 엔드포인트 7종** ([app.ts](../../server/src/app.ts)):
  1. `GET /v1/health` (무인증, 상태 확인) · 2. `GET /v1/schools` (무인증, NEIS 학교 검색) · 3. `POST /v1/device` (익명 기기 ID·`Bearer` 토큰 발급) · 4. `POST /v1/lobby-visit` (로비 방문·접속 수) · 5. `POST /v1/runs/start` (판 시작 티켓 발급) · 6. `POST /v1/runs/submit` (`question_keys` 대조 **서버 재채점 `question_regraded_combat_bounded`**) · 7. `GET /v1/leaderboard` (학년·통합·학교 필터·시즌별 랭킹 조회, 거점 캐시 60초).
- **D1 SQLite 스키마 (12개 테이블)**: [0001_init.sql](../../server/migrations/0001_init.sql)의 `completed_runs`, `standings`, `question_keys`, `approved_run_conditions`, `run_verification_rules` 등에 `0003_school_honor.sql`(학교별 명예점 집계)과 [0004_ranking_seasons.sql](../../server/migrations/0004_ranking_seasons.sql)의 `ranking_seasons`가 추가되었다. 매일 `19:00 UTC` Cron이 만료 행을 정리한다.

## 3. R6 시즌 2 서버 준비 상태 (아직 운영 미반영)

- **시즌 매핑 표 (`ranking_seasons`)**: `1.0.0 → season1`, `2.0.0 → season2`로 연결하고 `submissions_open`으로 신규 제출 개폐를 과거 조회와 분리한다.
- **2.0.0 승인 조건·검증 규칙**: 3~6학년 공개 은행 × `2.0.0` × `garden_u` 4개 승인 조합과 4난이도 검증 규칙을 `server/seed/question_keys.sql`에 함께 생성한다(기존 `1.0.0` 학년별 맵 4개도 계속 제출·조회 가능).
- **기간 조회**: 서버는 `weekly`·`season1`·`season2`·`all_time`을 지원한다. `weekly`와 `all_time`(화면 표기 "시즌 2")은 현재 시즌(`season2`), `season1`은 과거 v1 기록을 조회하며 캐시 키에도 시즌이 포함된다.
- **운영 반영 시점**: 위 변경은 **로컬·시험까지 준비 완료되었으나 운영 D1/Worker/Pages에는 아직 미반영**이다. G5 통합·실기기 확인 뒤 사용자 승인을 받아 [G5-server.md](../../docs/renewal/r6/tech/G5-server.md) 절차로 반영한다.

## 4. 수정 시 필수 검증 규칙 (`AGENTS.md`)

- `server/**`, `src/persistence/**`, `src/contracts/lobby.ts` 수정 커밋 전에는 반드시 **`npm run test:server`**를 실행한다(`npm run verify`는 서버 타입 검사만 포함).
- 빠른 조회: `npm run wiki:query -- --route` · `npm run wiki:query -- --table`

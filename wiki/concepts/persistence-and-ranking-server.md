---
id: hub-persistence-and-ranking-server
type: hub
title: 로컬 저장(IndexedDB) 및 기록·랭킹 서버(Workers/D1)
status: active
updated: 2026-11-16
verified: { commit: a402d63f, date: 2026-11-24 }
sources:
  - path: src/persistence/reviewNote.ts
    sha256: "729abb95daffa0b758340070f97fd326647b7e00f7d23f1e0eb34734e6fcad41"
  - path: server/wrangler.toml
    sha256: "630d680192e27718f41a94011e16707eaa30f36a976a4bc482aeb881b4f0271a"
  - path: server/migrations/0001_init.sql
    sha256: "071a8e211e35bc76c762b12986cf7b0e8f1c5a4fb9411e2830125bf50e881cc2"
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: docs/HOSTING_IMPL_PLAN.md
    sha256: "79f1f85a62652e420cf36b3a1a0f058656fb8685fb5f179d825f5570caed6701"
---

# 로컬 저장(IndexedDB) 및 기록·랭킹 서버 (`persistence-and-ranking-server`)

학습 이력과 완주 기록은 **로컬 우선(Local-First) IndexedDB**에 즉시 보존되고, 온라인 환경에서는 **Cloudflare Workers + D1 에지 서버**가 서버 측 재채점을 거쳐 전국 통합 수호 랭킹을 집계한다. 서버 라우트 7종과 D1 테이블 11종 명세는 [contracts.md](../contracts.md)에 자동 추출된다.

## 1. 클라이언트 영속 계층 (`src/persistence/`)

- **IndexedDB 저장소** ([db.ts](../../src/persistence/db.ts)): 최고 기록, 판별 요약, 설정(`settings.ts`), 미전송 제출 큐를 브라우저에 영속화한다.
- **오답 노트** ([reviewNote.ts](../../src/persistence/reviewNote.ts)): 판 도중 틀렸거나 ‘모르겠어요’를 선택한 문항을 누적 기록해 홈 화면 오답 노트에서 언제든 복습할 수 있게 한다.
- **로비 클라이언트 및 오프라인 내성** ([lobbyClient.ts](../../src/persistence/lobbyClient.ts), [lobby.ts](../../src/contracts/lobby.ts)): API 타임아웃이나 네트워크 단절 시에도 전투·학습 흐름을 막지 않고 로컬 모드로 자동 폴백한다.

## 2. 기록·랭킹 서버 아키텍처 (`server/` · `DEC-08`)

- **단일 도메인 및 비밀값 분리** ([wrangler.toml](../../server/wrangler.toml)):
  - 운영 주소는 `https://voca-api.ssamuniverse.com` 하나뿐이며, WAF·거점 캐시 우회를 막기 위해 `workers_dev = false`로 고정한다(`L-TD-202`).
  - 유일한 비밀값 `PLAYER_SALT`는 기기 토큰 HMAC 서명에만 쓰며 저장소·대화·시험 코드에 절대 적지 않는다(로컬은 `server/.dev.vars` 사용).
- **HTTP 엔드포인트 7종**. [app.ts](../../server/src/app.ts)
  1. `GET /v1/health`로 서버 상태를 확인한다(무인증).
  2. `GET /v1/schools`로 NEIS 학교 정보를 조회한다(무인증).
  3. `POST /v1/device`로 익명 기기 ID와 `Bearer` 서명 토큰을 발급한다.
  4. `POST /v1/lobby-visit`으로 로비 방문과 활성 기기 수를 기록한다.
  5. `POST /v1/runs/start`로 판 시작 티켓(`runToken`)을 발급한다.
  6. `POST /v1/runs/submit`으로 판 종료 기록을 제출하고 `question_keys`와 대조해 **서버 재채점(`question_regraded_combat_bounded`)**을 수행한다.
  7. `GET /v1/leaderboard`로 학년·통합 수호 랭킹을 조회한다. 학교 필터를 지원하며 거점 캐시는 60초다.
- **D1 SQLite 스키마 및 사전 집계** ([0001_init.sql](../../server/migrations/0001_init.sql)):
  - `completed_runs`, `standings`, `question_keys`, `rate_limits` 등 11개 테이블과 3개 활성 트리거로 구성된다.
  - 리더보드 조회 시 전체 `runs`를 스캔하지 않고 기기·부문별 최고점 사전 집계표인 `standings`만 읽어 D1 읽기 행 비용을 최소화한다. 매일 `19:00 UTC`(한국 새벽 4시) Cron이 만료 티켓·속도 제한 행을 정리한다.

## 3. 수정 시 필수 검증 규칙 (`AGENTS.md`)

- `server/**`, `src/persistence/**`, `src/contracts/lobby.ts` 중 하나라도 수정한 커밋 전에는 반드시 **`npm run test:server`**를 실행한다 (`npm run verify`에는 서버 타입 검사만 포함되어 있고 Workers/D1 단위 시험은 `test:server`가 담당한다).
- API·테이블 빠른 조회: `npm run wiki:query -- --route` · `npm run wiki:query -- --table`

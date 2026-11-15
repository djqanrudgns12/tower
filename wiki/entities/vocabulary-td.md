---
id: entity-vocabulary-td
type: entity
title: 어휘력 타워 디펜스 제품 정의
status: active
updated: 2026-11-16
verified: { commit: e22ff57f, date: 2026-11-16 }
sources:
  - path: package.json
    sha256: a30c5cbd4a9e080a26987cc63f28b2a5dc928c404a7f96f392bc94209d441fe6
  - path: docs/DEPLOY.md
    sha256: "4697485dc76d7c4e3b7ba2b00bedd31373fd3d13892905314a0bc294db9d43d1"
  - path: docs/contracts/product.defaults.v0.5.json
    sha256: c06bd5dc1132a2cf2b401bcbf8ea25d4b0dfa29f67614ffab7bc7dde214a8cdf
  - path: docs/contracts/balance.candidate.v0.4.json
    sha256: e58e062f13209b1c955a5a6f46a5f4d6b861bc915ad3f8c6cee3904d9c76e486
---

# 어휘력 타워 디펜스 (`vocabulary-tower-defense`)

초등 3~6학년 학생이 한국어 어휘 문제를 풀어 골드와 학습 점수(PT)를 얻고, 20종의 타워를 설치·진화시켜 성문을 지키는 웹 타워 디펜스 게임이다.

## 1. 제품 정체성과 핵심 루프

- **대상 학년**: 초등 3·4·5·6학년 (학년별 고유 맵 4종 및 학년별 공개 문제은행 분리 적재)
- **핵심 루프**:
  1. **전투 준비·웨이브 진행**: 15×9 격자 전장의 설치 슬롯(20칸)에 타워를 바로 설치하고 강화·진화한다.
  2. **어휘 문제 풀이**: 전투 중 문제 카드를 열어 4지선다 어휘 문제를 푼다. 정답 시 골드와 PT를 얻고, **‘모르겠어요’는 감점 없는 `0 PT · 0 골드`**로 즉시 해설과 학습 카드에 연결된다(`DEC-04`).
  3. **징집과 보물**: 기본 4종(`archer`, `cannon`, `frost`, `mage`)으로 시작해 웨이브 `3·6·9·12` 직후 3종 중 1종을 추가 징집(최대 8칸)하며, 원정 보물(`relic`)로 판마다 다른 조합을 만든다.
  4. **완주·패배 기록 및 오답 복습**: 성문 HP가 유지된 채 최종 웨이브를 넘기면 승리한다. 판이 끝날 때만 로컬 IndexedDB에 기록·오답 노트를 저장하고, 온라인이면 서버 재채점을 거쳐 통합 수호 랭킹에 반영한다(**진행 중 이어하기 없음**, `DEC-05`).

## 2. 운영 환경 및 엔드포인트

| 구분 | 주소 / 포트 | 인프라 | 핵심 설정 및 근거 |
| --- | --- | --- | --- |
| **운영 웹게임** | `https://voca.ssamuniverse.com` | GitHub Pages (`.github/workflows/pages.yml`) | KT 학교망 미국 우회 방지를 위해 Cloudflare **회색 구름(DNS only)** 고정 ([DEPLOY.md](../../docs/DEPLOY.md)) |
| **운영 기록·랭킹 API** | `https://voca-api.ssamuniverse.com` | Cloudflare Workers (`vocabulary-td-api`) + D1 (`vocabulary-td`, APAC) | `workers_dev = false` 단일 도메인 강제, 랭킹 캐시 60초 ([wrangler.toml](../../server/wrangler.toml)) |
| **로컬 웹 개발** | `http://localhost:5173` | Vite (`npm run dev`) | E2E 충돌 시 `E2E_PORT=5175 npm run test:e2e`로 분리 |
| **로컬 API 개발** | `http://localhost:8787` | Wrangler (`npm run server:dev`) | 로컬 D1 이관·시드는 `npm run server:db:local`, 비밀값은 `server/.dev.vars` |

## 3. 오프라인 폴백 보장

- 기록·랭킹 서버가 응답하지 않거나 학교망 방화벽에 막혀도 **게임 플레이·문제 풀이·오답 노트·로컬 최고 기록은 IndexedDB만으로 100% 동작**한다.
- 서버 전송 실패 기록은 로컬 동기화 큐에 보관했다가 다음 연결 시 재전송하며, 로비 랭킹 영역은 안내 문구와 함께 로컬 모드로 우아하게 전환된다([persistence-and-ranking-server](../concepts/persistence-and-ranking-server.md)).

## 4. 연결 허브

- 전체 색인: [index.md](../index.md) · 실시간 수치 계약: [contracts.md](../contracts.md)
- 도메인별 상세: [아키텍처](../concepts/architecture-and-layers.md) · [전투·타워·밸런스](../concepts/combat-towers-and-balance.md) · [화면·전장·에셋](../concepts/ui-phaser-and-assets.md) · [문제은행](../concepts/question-bank-and-cr1000.md)

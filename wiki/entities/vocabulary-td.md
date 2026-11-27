---
id: entity-vocabulary-td
type: entity
title: 어휘력 타워 디펜스 제품 정의
status: active
updated: 2026-11-25
verified: { commit: "8c5c3d25", date: 2026-11-27 }
sources:
  - path: package.json
    sha256: "438e5fc906d190ae6ff3e75af936f686e94d883375aff3ab996bcf06cd749d08"
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: docs/contracts/product.defaults.v0.5.json
    sha256: c06bd5dc1132a2cf2b401bcbf8ea25d4b0dfa29f67614ffab7bc7dde214a8cdf
  - path: docs/contracts/balance.v2.json
    sha256: bc3651292280f50ee9c5a73e422b69258453783ae69ed2ff4443a1947598c256
  - path: docs/contracts/balance.candidate.v0.4.json
    sha256: e58e062f13209b1c955a5a6f46a5f4d6b861bc915ad3f8c6cee3904d9c76e486
  - path: docs/renewal/r6/PRD-r6.md
    sha256: "2ebe8c0d3e6c29822e5a15714f0a0a8b7a93ba5ce2e22031f83a3a7519be17b3"
---

# 어휘력 타워 디펜스 (`vocabulary-tower-defense`)

초등 3~6학년 학생이 한국어 어휘 문제를 풀어 골드와 점수(PT)를 얻고, 전술 기계 타워를 설치·강화해 길을 따라 몰려오는 여러 세계의 적 무리로부터 기지와 성문을 지키는 웹 타워 디펜스 게임이다.

## 1. 제품 정체성과 핵심 루프 (R6 현행 · `balanceVersion: 2.0.0`)

- **세계관과 말투**: "지도 위 기지를 지키는 지휘관. 여러 세계에서 넘어온 무리가 길을 따라 몰려온다." 화면과 문서는 평이한 말만 쓴다(기지, 성문, 타워, 적, 웨이브, 강화).
- **대상 학년과 맵**: 초등 3·4·5·6학년 각 학년 공개 문제은행을 지연 적재하며, R6는 네 학년 모두 프로토타입 맵 **초원 고원**(`garden_u`, 15×9 격자·설치대 20칸)에서 시작한다.
- **핵심 루프**:
  1. **타워 6종 · Lv20 · 무기 I~IV**: 시작 3종(`rail`·`mortar`·`cryo`)으로 출발해 W3·6·9 완료 뒤 `prism`·`hangar`·`bastion`이 순차 해금된다. 2레벨마다 모양이 진화(11형태)하고 Lv6·12·18에 무기 단계와 공격 방식이 바뀐다.
  2. **어휘 문제 풀이**: 교실 프로젝터에서도 선명한 밝은 고대비 문제 패널에서 4지선다 어휘 문제를 푼다. **‘모르겠어요’는 감점 없는 `0 PT · 0 골드`**로 해설을 보여 준다(`DEC-04`).
  3. **5종족×20개체 시드 혼합 · 보물**: 숲 엘프·철갑 인간·기계 군단·군체 벌레·바위 거인 100개체가 웨이브 단계에 따라 결정적 시드로 섞여 등장하며, 보물 12종으로 조합을 바꾼다.
  4. **완주·패배 기록과 시즌 랭킹**: 판이 끝날 때만 로컬 IndexedDB에 기록·오답 노트를 저장하고, 온라인이면 서버 재채점을 거쳐 시즌 2(현재 코드 준비 완료, 운영 미반영) 랭킹에 반영한다(**진행 중 이어하기 없음**, `DEC-05`).
- **이전 판(v1, `1.0.0`) 보존**: 현재 운영 중인 1.0.0(타워 20종·Lv4/Lv7 갈래 진화·학년별 맵 4종·41번 화풍)은 개발 환경 `?balance=v1`과 랭킹 시즌 1 조회용으로 보존한다.

## 2. 운영 환경 및 엔드포인트

| 구분 | 주소 / 포트 | 인프라 | 핵심 설정 및 근거 |
| --- | --- | --- | --- |
| **운영 웹게임** | `https://voca.ssamuniverse.com` | GitHub Pages (`.github/workflows/pages.yml`) | Cloudflare **회색 구름(DNS only)** 고정 ([DEPLOY.md](../../docs/DEPLOY.md)). 현재 v1 운영 중(R6 미반영) |
| **운영 기록·랭킹 API** | `https://voca-api.ssamuniverse.com` | Cloudflare Workers (`vocabulary-td-api`) + D1 (`vocabulary-td`, APAC) | `workers_dev = false`, 랭킹 캐시 60초 ([wrangler.toml](../../server/wrangler.toml)). 시즌 2 미반영 |
| **로컬 웹 개발** | `http://localhost:5173` | Vite (`npm run dev`) | 기본 R6(`2.0.0`), `?balance=v1`으로 `1.0.0` 확인. E2E 분리 시 `E2E_PORT=5175` |
| **로컬 API 개발** | `http://localhost:8787` | Wrangler (`npm run server:dev`) | 로컬 이관·시드 `npm run server:db:local`, 비밀값 `server/.dev.vars` |

## 3. 오프라인 폴백 보장

- 서버가 응답하지 않거나 학교망에 막혀도 **게임 플레이·문제 풀이·오답 노트·시즌별 로컬 최고 기록은 IndexedDB만으로 100% 동작**한다.
- 미전송 기록은 동기화 큐에 보관했다가 연결 시 재전송하며, 로비 랭킹은 로컬 모드로 전환된다([persistence-and-ranking-server](../concepts/persistence-and-ranking-server.md)).

## 4. 연결 허브

- 전체 색인: [index.md](../index.md) · 실시간 계약: [contracts.md](../contracts.md) · R6 기준: [PRD-r6.md](../../docs/renewal/r6/PRD-r6.md)
- 도메인별 상세: [아키텍처](../concepts/architecture-and-layers.md) · [전투·타워·밸런스](../concepts/combat-towers-and-balance.md) · [화면·전장·제작 공정](../concepts/ui-phaser-and-assets.md) · [문제은행](../concepts/question-bank-and-cr1000.md)

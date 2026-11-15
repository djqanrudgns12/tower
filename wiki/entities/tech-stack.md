---
id: entity-tech-stack
type: entity
title: 기술스택 및 고정 의존성
status: active
updated: 2026-11-16
verified: { commit: b9b024bd, date: 2026-11-16 }
sources:
  - path: package.json
    sha256: a30c5cbd4a9e080a26987cc63f28b2a5dc928c404a7f96f392bc94209d441fe6
  - path: tsconfig.json
    sha256: "782c53129e65d07acefd18d5f606559a1293347daeea4375b8504263a445d154"
  - path: eslint.config.js
    sha256: "3cb849e76e6f4df521f96362db3c371fb788638f4381a8ddcc62668a09f96179"
  - path: server/wrangler.toml
    sha256: "630d680192e27718f41a94011e16707eaa30f36a976a4bc482aeb881b4f0271a"
---

# 기술스택 및 고정 의존성 (`tech-stack`)

저장소는 프런트엔드 정적 웹앱(Vite + React 19 + Phaser 4)과 에지 기록·랭킹 서버(Cloudflare Workers + D1 SQLite), 그리고 외부 의존성 없는 Node 24 스크립트 도구 체인으로 구성된다.

## 1. 계층별 핵심 기술 선택

| 영역 | 채택 기술 | 선택 이유 및 운용 원칙 |
| --- | --- | --- |
| **런타임·언어** | Node `>=24.0.0` (`.node-version`), TypeScript 6 (`strict`) | 앱(`tsconfig.json`), 시험(`tsconfig.test.json`), 서버(`server/tsconfig.json`) 3중 분리 타입 검사 |
| **UI 셸·화면** | React 19 + CSS Modules + Pretendard | 홈·통합 랭킹·문제 카드·오답 노트·정지 모달 담당. 전장 캔버스 내부 상태와 분리 |
| **전장 렌더링** | Phaser 4 (`BattleScene`, 레이어 6종) | 15×9 격자 지면 조립, 타워·몬스터 자세 애니메이션, 미니맵·확대 지원 ([ui-phaser-and-assets](../concepts/ui-phaser-and-assets.md)) |
| **계약·로컬 저장** | Zod 4 + `idb` (IndexedDB) | 모든 JSON 계약과 API 입출력을 런타임 검증하고 오프라인 기록·오답 노트를 영속화 |
| **기록·랭킹 서버** | Cloudflare Workers + D1 (SQLite) | 외부 프레임워크 없이 순수 Fetch 라우터(`server/src/app.ts`)와 `standings` 사전 집계표로 저지연 운영 |
| **품질·검증** | ESLint 10 + Vitest 5 + `fast-check` + Playwright | 계층 침범(`no-restricted-imports`), `Math.random` 금지, 결정적 시뮬레이션·접근성(`axe-core`) 검증 |
| **빌드·위키 도구** | `tools/**/*.mjs` (Node 내장 `fs`·`crypto` 전용) | 외부 파서 패키지 추가 없이 은행 빌드·WebP 변환·위키 레지스트리 생성(`npm run wiki:sync`) 수행 |

## 2. 고정 버전 표 (`package.json` 자동 추출)

<!-- WIKI-AUTO:START:tech-stack-versions -->
| 패키지 / 런타임 | 고정 버전 | 구분 |
| --- | --- | --- |
| `node (engines)` | `>=24.0.0` | 런타임 |
| `idb` | `8.0.4` | 앱 의존성 |
| `phaser` | `4.2.1` | 앱 의존성 |
| `pretendard` | `1.3.9` | 앱 의존성 |
| `react` | `19.3.1` | 앱 의존성 |
| `react-dom` | `19.3.1` | 앱 의존성 |
| `zod` | `4.6.7` | 앱 의존성 |
| `@axe-core/playwright` | `4.14.0` | 개발·시험 도구 |
| `@eslint/js` | `10.0.1` | 개발·시험 도구 |
| `@playwright/test` | `1.64.1` | 개발·시험 도구 |
| `@types/node` | `24.19.2` | 개발·시험 도구 |
| `@types/react` | `19.3.0` | 개발·시험 도구 |
| `@types/react-dom` | `19.3.0` | 개발·시험 도구 |
| `@vitejs/plugin-react` | `6.1.2` | 개발·시험 도구 |
| `eslint` | `10.13.0` | 개발·시험 도구 |
| `eslint-plugin-react-hooks` | `7.1.1` | 개발·시험 도구 |
| `fake-indexeddb` | `6.2.6` | 개발·시험 도구 |
| `fast-check` | `4.10.2` | 개발·시험 도구 |
| `globals` | `17.13.0` | 개발·시험 도구 |
| `typescript` | `6.0.3` | 개발·시험 도구 |
| `typescript-eslint` | `8.72.1` | 개발·시험 도구 |
| `vite` | `8.3.5` | 개발·시험 도구 |
| `vitest` | `5.0.5` | 개발·시험 도구 |
| `wrangler` | `4.151.3` | 개발·시험 도구 |
<!-- WIKI-AUTO:END:tech-stack-versions -->

## 3. 의존성 추가·변경 원칙

1. **정확한 버전 고정**: `package.json`은 캐럿(`^`) 없는 고정 버전을 기본으로 유지해 재현 가능한 빌드를 보장한다.
2. **도구 체인 경량 유지**: `tools/` 아래 스크립트는 Node 24 표준 라이브러리만으로 동작하도록 작성해 CI와 로컬 부트스트랩 비용을 최소화한다.
3. **동기화 필수**: `package.json`의 버전이나 스크립트를 수정하면 `npm run wiki:sync`가 위 표와 [commands.md](../commands.md)를 자동으로 갱신한다.

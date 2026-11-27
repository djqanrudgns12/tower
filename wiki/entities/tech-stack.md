---
id: entity-tech-stack
type: entity
title: 기술스택 및 고정 의존성
status: active
updated: 2026-11-25
verified: { commit: e71cac75, date: 2026-11-28 }
sources:
  - path: package.json
    sha256: "438e5fc906d190ae6ff3e75af936f686e94d883375aff3ab996bcf06cd749d08"
  - path: tsconfig.json
    sha256: "782c53129e65d07acefd18d5f606559a1293347daeea4375b8504263a445d154"
  - path: eslint.config.js
    sha256: c31e0b81c328afa95f60c55519946283ed1101feb66424f0009d0a19a87cf4aa
  - path: server/wrangler.toml
    sha256: "630d680192e27718f41a94011e16707eaa30f36a976a4bc482aeb881b4f0271a"
  - path: docs/renewal/r6/tech/G2-spike.md
    sha256: "741013a9c3f010dafe49b23789095f6f36116d69412428d6ef1b4048aa76ef01"
---

# 기술스택 및 고정 의존성 (`tech-stack`)

저장소는 정적 웹앱(Vite + React 19 + Phaser 4 + Spine Mesh2D), 에지 기록·랭킹 서버(Cloudflare Workers + D1 SQLite), Node 24 스크립트 도구, 그리고 R6 오프라인 에셋 제작 공정(Blender 5.2 LTS + Spine Pro 4.3 + Python Pillow/NumPy)으로 구성된다.

## 1. 계층별 핵심 기술 선택

| 영역 | 채택 기술 | 선택 이유 및 운용 원칙 |
| --- | --- | --- |
| **런타임·언어** | Node `>=24.0.0` (`.node-version`), TypeScript 6 (`strict`) | 앱(`tsconfig.json`), 시험(`tsconfig.test.json`), 서버(`server/tsconfig.json`) 3중 분리 타입 검사 |
| **UI 셸·화면** | React 19 + CSS Modules + R04 토큰 + 선 아이콘 SVG 54종 | 어두운 기본/밝은 화면 전환, 프로젝터용 밝은 문제 패널, 1px 선·45° 모따기·고정폭 숫자. 글꼴은 IBM Plex Sans KR·SUIT(자체 호스팅 전제, 기존 `pretendard` 공존) |
| **전장 렌더링** | Phaser 4 (`4.2.1`) + `@esotericsoftware/spine-phaser-v4@4.3.13` | R6 초원 고원 3/4 투영, 미리 렌더한 WebP 타워 시트(몸체+16방향 포두), Spine Mesh2D 보행·피격 재생, 자동 화질 3단계 ([ui-phaser-and-assets](../concepts/ui-phaser-and-assets.md)) |
| **오프라인 제작 공정** | Blender 5.2 LTS(헤드리스 파이썬) · Spine Pro 4.3 CLI · Pillow/NumPy | 타워 66형태·맵 배경은 Blender로 사전 렌더(three.js는 제작 미사용), 몬스터 100개체는 파츠 절단·Spine 스킨 양산, `tools/r6/qa/`로 IoU·팔레트 자동 검수 |
| **계약·로컬 저장** | Zod 4 + `idb` (IndexedDB) | `balance.v2.json`·v1 계약·API 입출력을 런타임 검증하고 오프라인 시즌별 기록·오답 노트 영속화 |
| **기록·랭킹 서버** | Cloudflare Workers + D1 (SQLite) | 순수 Fetch 라우터(`server/src/app.ts`), `standings` 사전 집계표, `ranking_seasons` 시즌 분기 |
| **품질·검증** | ESLint 10 + Vitest 5 + `fast-check` + Playwright | 계층 경계(`no-restricted-imports`, `docs/**/*.{js,mjs,cjs}` 제외), `Math.random` 금지, `test:r6-perf` 저사양 측정·접근성(`axe-core`) 검증 |
| **빌드·위키 도구** | `tools/**/*.mjs` (Node 내장 모듈 중심) | 외부 파서 추가 없이 은행 빌드·WebP 변환·위키 동기화(`npm run wiki:sync`) 수행 |

## 2. 고정 버전 표 (`package.json` 자동 추출)

<!-- WIKI-AUTO:START:tech-stack-versions -->
| 패키지 / 런타임 | 고정 버전 | 구분 |
| --- | --- | --- |
| `node (engines)` | `>=24.0.0` | 런타임 |
| `@esotericsoftware/spine-phaser-v4` | `4.3.13` | 앱 의존성 |
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

1. **정확한 버전 고정**: `package.json`은 캐럿(`^`) 없는 고정 버전을 유지한다(`spine-phaser-v4@4.3.13`은 `phaser@^4.2.1` 요구).
2. **런타임 경량 유지**: 무거운 3D 계산은 제작 때 Blender에서만 수행하고, 크롬북 브라우저에는 WebP 스프라이트와 Spine Mesh2D만 싣는다.
3. **동기화 필수**: `package.json` 버전·스크립트를 바꾸면 `npm run wiki:sync`로 위 표와 [commands.md](../commands.md)를 맞춘다.

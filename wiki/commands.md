---
id: wiki-commands
type: registry
title: 명령 사전
status: active
generated_by: tools/wiki/gen.mjs
---

# 명령 사전 (`commands`)

> 이 파일은 `npm run wiki:sync` (`tools/wiki/gen.mjs`)가 코드·계약 JSON·SQL에서 결정적으로 자동 생성합니다. 직접 수정하지 마세요.

## 1. 루트 `npm run` 스크립트

| 명령 | 분류 | `resource-guard` | 실행 본문 | 비고 |
| --- | --- | --- | --- | --- |
| `npm run dev` | 개발·빌드 | - | `vite` | 로컬 Vite 개발 서버 실행 (기본 http://localhost:5173) |
| `npm run build` | 개발·빌드 | `--profile build` | `tsc -p tsconfig.json && vite build` | TypeScript 검사 후 운영 정적 번들(dist/) 생성 (resource-guard --profile build 권장) |
| `npm run preview` | 개발·빌드 | - | `vite preview` | 빌드된 dist/ 번들 로컬 미리보기 |
| `npm run typecheck` | 검증·정적검사 | - | `tsc -p tsconfig.json && tsc -p tsconfig.test.json && tsc -p server/tsconfig.json` | 앱(tsconfig) · 시험/도구(tsconfig.test) · 서버(server/tsconfig) 전체 타입 검사 |
| `npm run lint` | 검증·정적검사 | - | `eslint .` | ESLint 실행 (PRD §13.2 계층 경계 및 Math.random 금지 포함) |
| `npm run test` | 단위·통합·E2E 시험 | `--profile test` | `vitest run tests/unit` | Vitest 단위·속성 시험 실행 (resource-guard --profile test -- --maxWorkers=1 권장) |
| `npm run test:e2e` | 단위·통합·E2E 시험 | `--profile test` | `playwright test` | Playwright 브라우저 종단 시험 (E2E_PORT로 포트 분리 가능) |
| `npm run test:api-connected` | 단위·통합·E2E 시험 | `--profile test` | `node tools/qa/api-connected.mjs` | 로컬 wrangler dev + 앱 연결 재채점 검증 (3~6학년) |
| `npm run test:server` | 단위·통합·E2E 시험 | `--profile test` | `tsc -p server/tsconfig.json && tsc -p server/tsconfig.test.json && vitest run --config server/vitest.config.ts` | server/**, src/persistence/**, src/contracts/lobby.ts 수정 시 커밋 전 필수 |
| `npm run server:dev` | 기록·랭킹 서버(Workers/D1) | - | `wrangler dev --config server/wrangler.toml --local` | 로컬 Cloudflare Workers + D1 실행 (http://127.0.0.1:8787) |
| `npm run server:db:local` | 기록·랭킹 서버(Workers/D1) | - | `wrangler d1 migrations apply DB --local --config server/wrangler.toml && wrangler d1 execute DB --local --config server/wrangler.toml --file server/seed/question_keys.sql` | 로컬 D1 마이그레이션 및 정답 키 seed 적용 |
| `npm run server:db:remote` | 기록·랭킹 서버(Workers/D1) | - | `wrangler d1 migrations apply DB --remote --config server/wrangler.toml` | 운영 D1 마이그레이션 적용 (배포 전 선행) |
| `npm run server:seed:remote` | 기록·랭킹 서버(Workers/D1) | - | `wrangler d1 execute DB --remote --config server/wrangler.toml --file server/seed/question_keys.sql` | 운영 D1에 공개 정답 키·검증 규칙(question_keys.sql) 반영 |
| `npm run server:deploy` | 기록·랭킹 서버(Workers/D1) | - | `wrangler deploy --config server/wrangler.toml` | 운영 Cloudflare Worker 수동 배포 (voca-api.ssamuniverse.com) |
| `npm run validate:plan` | 검증·정적검사 | - | `node tools/validate-plan.mjs` | PRD v0.5와 계약 JSON·보존 해시 대조 (실행 시 prd_v0_5_validation.json을 갱신함) |
| `npm run validate:content` | 검증·정적검사 | - | `vitest run tests/unit/content.test.ts` | 문제은행 런타임 계약·의미 검사 단위 시험 |
| `npm run validate:assets` | 검증·정적검사 | - | `vitest run tests/unit/content.test.ts -t manifest` | 원화 manifest 일치 검사 |
| `npm run simulate:balance` | 밸런스 시뮬레이션 | - | `node tools/balance-sim.mjs` | 제품 엔진 기반 가상 플레이어 밸런스 시뮬레이션 |
| `npm run simulate:towers` | 밸런스 시뮬레이션 | - | `node tools/tower-efficiency.mjs` | 타워별 효율·역할 시뮬레이션 |
| `npm run simulate:gate` | 밸런스 시뮬레이션 | `--profile test` | `node tools/sim-gate.mjs` | 전체 밸런스 관문 평가 (4맵·1,952판, 부분 실행은 -- --bots core4) |
| `npm run build:bank` | 문제은행·콘텐츠 도구 | - | `node tools/build-bank.mjs` | 공동검수 승인 레지스트리 조인 및 학년별 공개 은행(grade3~6.json) 컴파일 |
| `npm run fetch-evidence` | 문제은행·콘텐츠 도구 | - | `node --use-system-ca tools/fetch-evidence.mjs` | 표준국어대사전 API 근거 수집 |
| `npm run verify` | 검증·정적검사 | `--profile test` | `npm run typecheck && npm run lint && npm run test && npm run validate:plan && npm run validate:content && npm run wiki:lint` | 타입·린트·단위시험·PRD검산·문항검사·위키린트 통합 검증 |
| `npm run blind-input` | 문제은행·콘텐츠 도구 | - | `node tools/make-blind-input.mjs` | 독립 검수용 정답 제거 블라인드 입력 생성 |
| `npm run wiki:sync` | 위키·문서 | - | `node tools/wiki/sync.mjs` | 5대 레지스트리 및 WIKI-AUTO 마커 블록 결정적 자동 갱신 (--check로 멱등성 확인) |
| `npm run wiki:gen` | 위키·문서 | - | `node tools/wiki/gen.mjs` | 위키 자동 생성기 단독 실행 |
| `npm run wiki:watch` | 위키·문서 | - | `node tools/wiki/watch.mjs` | 코드·계약·문서 변경 디바운스 감시 및 실시간 자동 동기화 |
| `npm run wiki:query` | 위키·문서 | - | `node tools/wiki/query.mjs` | 대형 문서 목차/절 발췌 및 타워·적·맵·은행·API·테이블·교훈 정밀 조회 |
| `npm run wiki:lint` | 위키·문서 | - | `node tools/wiki/lint.mjs` | 위키 스키마·링크·고아·글자예산·명령실재·validate-plan 보존 불변식 검사 |
| `npm run wiki:check` | 위키·문서 | - | `node tools/wiki/sync.mjs --check && node tools/wiki/lint.mjs --strict` | wiki:sync --check + wiki:lint --strict 엄격 무결성 검증 |
| `npm run wiki:stamp` | 위키·문서 | - | `node tools/wiki/stamp.mjs` | 큐레이션 페이지 sources의 SHA-256 해시 및 검증 커밋 갱신 |
| `npm run wiki:budget` | 위키·문서 | - | `node tools/wiki/budget.mjs` | Hot/Warm/Cold 계층별 글자·토큰 예산 및 절감률 측정 |
| `npm run wiki:delta` | 위키·문서 | - | `node tools/wiki/delta.mjs` | 다중 에이전트 무충돌 교훈 델타 파일 생성 (wiki/_inbox/) |
| `npm run wiki:curate` | 위키·문서 | - | `node tools/wiki/curate.mjs` | 교훈 수신함 현황 보고 및 원장 병합 (--apply) |
| `npm run wiki:hooks:install` | 위키·문서 | - | `node tools/wiki/hooks/install.mjs` | Git pre-commit / post-commit / post-merge / post-checkout 자동 동기화 훅 설치 |

## 2. `tools/` 주요 독립 CLI 스크립트

| 경로 | 줄 수 | 역할 요약 |
| --- | ---: | --- |
| [tools/build-question-keys.mjs](../tools/build-question-keys.mjs) | 86 | 내부 실행 도구 |
| [tools/assets/to-webp.mjs](../tools/assets/to-webp.mjs) | 171 | PNG → WebP 변환 도구 (docs/HOSTING_IMPL_PLAN.md §2). |
| [tools/assets/webp-compare.mjs](../tools/assets/webp-compare.mjs) | 174 | PNG\|WebP 비교판(접촉판)과 화질 수치를 만든다 |
| [tools/content/coverage-report.mjs](../tools/content/coverage-report.mjs) | 76 | 내부 실행 도구 |
| [tools/orchestrate/commit-lock.mjs](../tools/orchestrate/commit-lock.mjs) | 281 | 추적 콘텐츠 쓰기·빌드·서버 시험·경로 한정 커밋을 하나의 잠금으로 묶는다. |
| [tools/orchestrate/content-loop.mjs](../tools/orchestrate/content-loop.mjs) | 678 | 문항 공동검수 전체 자동 루프(공동검수 절차 3~6단계, PRD §9.3). |
| [tools/qa/perf.mjs](../tools/qa/perf.mjs) | 120 | global window, document, requestAnimationFrame, cancelAnimationFrame -- page.evaluate 안에서 도는 코드 |
| [tools/qa/scenes.mjs](../tools/qa/scenes.mjs) | 273 | global window, document, getComputedStyle -- page.evaluate 안에서 도는 코드가 쓰는 브라우저 전역이다 |

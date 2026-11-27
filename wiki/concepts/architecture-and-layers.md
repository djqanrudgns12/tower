---
id: hub-architecture-and-layers
type: hub
title: 아키텍처 및 7계층 경계
status: active
updated: 2026-11-25
verified: { commit: e71cac75, date: 2026-11-28 }
sources:
  - path: eslint.config.js
    sha256: c31e0b81c328afa95f60c55519946283ed1101feb66424f0009d0a19a87cf4aa
  - path: src/application/RunController.ts
    sha256: a2b1bda03708ef9052c7377222c24f2f9a5e51d061009bbd1e41d0e0576f1433
  - path: src/application/balanceSession.ts
    sha256: "51e2b3b59418037e0efd6b360a6cd455050b42eac715528db50b4f09cb10a6b7"
  - path: src/application/renderQuality.ts
    sha256: "8b57ff280c4744f750ce900edb6eb4834fed1e2b0b995c3a27b8e8a74d8ac8be"
  - path: src/domain/rng.ts
    sha256: "1baa7ac4eef91939d99c1002e55c417eb648ace55854898729293ab4547d120e"
  - path: src/domain/num.ts
    sha256: "2104511d7ae25266ebd661df10625f2314f49576be4c98a9e2adc1e5d940185f"
  - path: src/domain/run.ts
    sha256: cb15467cf3b070236a46ab2b6efaedc8b338893f345d844b58a0bb233c62c24c
---

# 아키텍처 및 7계층 경계 (`architecture-and-layers`)

프런트엔드 앱(`src/`)은 순수 결정적 도메인과 렌더링·UI·저장소를 엄격히 분리한 **7계층 단방향 구조**를 따르며, 모든 의존성 경계는 [eslint.config.js](../../eslint.config.js)가 빌드·검증 시점에 강제한다(`docs/**/*.{js,mjs,cjs}` 시안 스크립트는 검사 제외). 전체 파일·줄 수·금지 규칙 표는 [codemap.md](../codemap.md)에서 자동 갱신된다.

## 1. `src/` 7계층 책임과 의존성 방향

| 계층 | 경로 | 핵심 책임 | 절대 가져오면 안 되는 대상 (`no-restricted-imports`) |
| --- | --- | --- | --- |
| **1. Contracts** | `src/contracts/` | 밸런스 v2(`balanceV2.ts`)·v1·맵·문제은행·로비·원화 manifest의 Zod 스키마 | `domain`, `content`, `application`, `persistence`, `game`, `ui`, `react`, `phaser` |
| **2. Domain** | `src/domain/` | 30Hz 고정 틱 전투·경제·R6 타워/혼합(`r6Balance`, `r6Towers`, `r6Mixer`)·보물·퀴즈·시드 PRNG 순수 함수 | `content`, `application`, `persistence`, `game`, `ui`, `react`, `phaser`, `idb` |
| **3. Content** | `src/content/` | 학년별 은행 지연 적재(`gradeLoader.ts`), R6 한국어 테마(`theme/r6.ko.json`), 문항 의미 검사·철회 필터 | `application`, `persistence`, `game`, `ui`, `react`, `phaser` |
| **4. Persistence** | `src/persistence/` | IndexedDB(`db.ts`), 오답 노트, 설정(`lightTheme`·`lightGraphics`), 기기 토큰, 시즌별 동기화 큐 | `domain` 전투 변경, `game`, `ui`, `react`, `phaser` |
| **5. Application** | `src/application/` | [RunController.ts](../../src/application/RunController.ts)(유일한 상태 작성자), 계약 선택([balanceSession.ts](../../src/application/balanceSession.ts)), 자동 화질([renderQuality.ts](../../src/application/renderQuality.ts)) | `phaser`, `react`, `src/ui/**`, `src/game/**` |
| **6. Game** | `src/game/` | Phaser 4 `BattleScene`, R6 3/4 투영·타워 시트·`R6CombatVfx`·Spine Mesh2D·종족 지연 적재 | `src/ui/**`, `src/persistence/**`, 직접 보상 판정 |
| **7. UI** | `src/ui/` | React 19 화면(R04 전술 UI 13종·밝은 문제 패널·선 아이콘 54종) 및 효과음 | `phaser`, `src/game/**` 내부 구현, `src/persistence/**` 직접 호출 |

## 2. 계약 선택(`2.0.0` 기본 · 개발용 `?balance=v1`)

- **단일 진입점**: [balanceSession.ts](../../src/application/balanceSession.ts)의 `localBalanceSession(version, grade, difficulty, input)`이 학년별 문제은행은 유지한 채 밸런스 판별로 지도·규칙·타워 집합을 선택한다.
  - **`2.0.0` (R6 기본)**: `docs/contracts/balance.v2.json`을 `compileR6Balance`로 적재하고 전 학년에 초원 고원(`garden_u`)과 R6 타워 6종(`rail·mortar·cryo` 시작 → W3·6·9 완료 후 `prism·hangar·bastion` 순차 해금), 시드 혼합기(`r6-mix-1`)를 연결한다.
  - **`1.0.0` (이전 판 v1)**: 개발 환경(`import.meta.env.DEV`)에서 URL 쿼리 `?balance=v1`일 때만 선택한다(`src/ui/App.tsx`). 학년별 맵 4종과 타워 20종·Lv4/Lv7 진화·선택 해금(`draft`)을 보존한다.

## 3. 핵심 도메인·실행 불변식 (`DEC-05`)

1. **유일한 상태 작성자 (`RunController`)**:
   - 전투·퀴즈 상태는 오직 [RunController.ts](../../src/application/RunController.ts)가 [run.ts](../../src/domain/run.ts)의 도메인 명령(`build`, `upgrade`, `sell`, `undoBuild`, `answer`, `skip`, `relicPick`, `draftPick` 등)을 틱 경계에서 반영해서만 바뀐다.
   - R6(`adaptiveRender = true`)에서는 질문·남은 적 수 등 표시값이 바뀐 틱에만 React 스냅샷을 갱신해 불필요한 재렌더를 막는다.
2. **30Hz 고정 틱 · 안전 정수 · 자동 화질 3단계**:
   - 시뮬레이션은 `tickHz = 30`(프레임당 최대 5틱)과 `10000 BP = 1.0`·`1000 milli = 1` 안전 정수 연산([num.ts](../../src/domain/num.ts))을 유지한다.
   - R6은 [renderQuality.ts](../../src/application/renderQuality.ts)로 5초 평균 FPS를 측정해 30fps 미만이면 화질 단계를 `0 → 1 → 2 → 3`으로 낮추고, 45fps 이상을 20초 유지하면 올린다. 3단계에서 15fps 미만이 10초 연속되면 `PERFORMANCE` 정지한다(이전 판 v1은 250ms 초과 5초 내 3회 끊김 시 정지).
3. **`Math.random` 전면 금지 및 시드 PRNG 전용**:
   - ESLint `no-restricted-syntax`가 `Math.random` 호출을 차단하며, 출제·전투·R6 웨이브 혼합 모두 시드 PRNG([rng.ts](../../src/domain/rng.ts))로 재현한다.
4. **진행 중 이어하기 없음**:
   - 판 도중 탭을 닫으면 기록 없이 폐기되고, 판 종료 시에만 로컬 저장·오답 노트·시즌별 제출 큐에 기록한다.

## 4. 자주 쓰는 탐색 · 검증 명령

- 계층 코드맵 및 금지 규칙 확인: [codemap.md](../codemap.md)
- 타입 및 계층 경계 정적 검사: `npm run typecheck` · `npm run lint`
- 도메인 단위·속성 시험 실행: `npm run test`

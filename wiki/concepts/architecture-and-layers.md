---
id: hub-architecture-and-layers
type: hub
title: 아키텍처 및 7계층 경계
status: active
updated: 2026-11-16
verified: { commit: b9b024bd, date: 2026-11-16 }
sources:
  - path: eslint.config.js
    sha256: "3cb849e76e6f4df521f96362db3c371fb788638f4381a8ddcc62668a09f96179"
  - path: src/application/RunController.ts
    sha256: ec54afecc7c1b3bbbfaf043a04aa37c14e1bc0d8d931578d0303c6e8bf0a4e0c
  - path: src/domain/rng.ts
    sha256: "1baa7ac4eef91939d99c1002e55c417eb648ace55854898729293ab4547d120e"
  - path: src/domain/num.ts
    sha256: "2104511d7ae25266ebd661df10625f2314f49576be4c98a9e2adc1e5d940185f"
  - path: src/domain/run.ts
    sha256: "1ffdefd52785a4db8e3fb0bf28e520a7afbbb28c8794324acec49a13567e6123"
---

# 아키텍처 및 7계층 경계 (`architecture-and-layers`)

프런트엔드 앱(`src/`)은 순수 결정적 도메인과 렌더링·UI·저장소를 엄격히 분리한 **7계층 단방향 구조**를 따르며, 모든 의존성 경계는 [eslint.config.js](../../eslint.config.js)가 빌드·검증 시점에 강제한다. 전체 파일·줄 수·금지 규칙 표는 [codemap.md](../codemap.md)에서 자동 갱신된다.

## 1. `src/` 7계층 책임과 의존성 방향

| 계층 | 경로 | 핵심 책임 | 절대 가져오면 안 되는 대상 (`no-restricted-imports`) |
| --- | --- | --- | --- |
| **1. Contracts** | `src/contracts/` | 밸런스·맵·문제은행·로비·원화 manifest의 Zod 스키마 | `domain`, `content`, `application`, `persistence`, `game`, `ui`, `react`, `phaser` |
| **2. Domain** | `src/domain/` | 30Hz 고정 틱 전투·경제·징집·보물·퀴즈·시드 PRNG 순수 함수 | `content`, `application`, `persistence`, `game`, `ui`, `react`, `phaser`, `idb` |
| **3. Content** | `src/content/` | 학년별 은행 지연 적재(`gradeLoader.ts`), 문항 의미 검사, 철회 필터 | `application`, `persistence`, `game`, `ui`, `react`, `phaser` |
| **4. Persistence** | `src/persistence/` | IndexedDB(`db.ts`), 오답 노트, 기기 토큰 발급, 서버 동기화 큐 | `domain` 전투 변경, `game`, `ui`, `react`, `phaser` |
| **5. Application** | `src/application/` | [RunController.ts](../../src/application/RunController.ts)(유일한 상태 작성자), 세션·로비 조합 | `phaser`, `react`, `src/ui/**`, `src/game/**` |
| **6. Game** | `src/game/` | Phaser 4 `BattleScene`, 지면 조립, 보행·자세 연출, 미니맵 | `src/ui/**`, `src/persistence/**`, 직접 보상 판정 |
| **7. UI** | `src/ui/` | React 19 화면(홈·랭킹·전투 카드·오답 노트·정지 모달) 및 효과음 | `phaser`, `src/game/**` 내부 구현, `src/persistence/**` 직접 호출 |

## 2. 핵심 도메인 불변식 (`DEC-05`)

1. **유일한 상태 작성자 (`RunController`)**:
   - 전투·퀴즈 상태는 오직 [RunController.ts](../../src/application/RunController.ts)가 도메인 명령(`placeTower`, `upgradeTower`, `evolveTower`, `submitAnswer`, `pickDraft`, `pickRelic` 등)을 디스패치해서만 갱신한다.
   - React UI와 Phaser 전장은 읽기 전용 스냅샷·브리지 이벤트를 구독하고 사용자 의도만 전달한다.
2. **30Hz 고정 틱과 안전 정수 연산**:
   - 프레임률(`requestAnimationFrame`)이 흔들려도 시뮬레이션은 `tickHz = 30`(약 `33.33ms` 누적기) 단위로 결정적으로 전진한다.
   - 부동소수점 오차를 막기 위해 비율은 베이시스 포인트(`10000 BP = 1.0`), 거리·시간은 밀리 단위(`1000 milli = 1`) 안전 정수 연산([num.ts](../../src/domain/num.ts))을 사용한다.
3. **`Math.random` 전면 금지 및 시드 PRNG 전용**:
   - ESLint `no-restricted-properties`가 `src/domain/**` 안의 `Math.random` 호출을 차단한다.
   - 모든 출제 순서·치명타·징집 후보 추첨은 시드 기반 결정적 난수 생성기([rng.ts](../../src/domain/rng.ts))만 사용해 밸런스 봇 재현성과 속성 시험을 보장한다.
4. **진행 중 이어하기 없음**:
   - 판 도중 새로고침하거나 탭을 닫으면 해당 판은 저장 없이 폐기된다. 오직 **승리(완주) 또는 패배(성문 HP 0)** 시점에만 로컬 기록·오답 노트 저장과 서버 제출이 일어난다.

## 3. 자주 쓰는 탐색 · 검증 명령

- 계층 코드맵 및 금지 규칙 확인: [codemap.md](../codemap.md)
- 타입 및 계층 경계 정적 검사: `npm run typecheck` · `npm run lint`
- 도메인 단위·속성 시험 실행: `npm run test`

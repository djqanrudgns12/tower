# tower — 어휘력 타워 디펜스

초등 3~6학년이 한국어 어휘 문제를 풀어 골드를 모으고, 타워로 성문을 지키는 웹게임입니다.
**현재 기준은 PRD v0.5이고, P1 첫 구현(3학년·정원 맵·타워 3종)이 끝났습니다.** 원화는 같은 규격의 임시 그림이고, 문항은 검수 전 개발용입니다.

## 실행

Node 24(`.node-version`)에서 실행합니다.

```sh
npm ci
```

```sh
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다.

## 검사

```sh
npm run verify
```

타입 검사(앱·시험) → ESLint(계층 경계 포함) → 단위·속성 시험 → PRD 문서 검산 → 문항 검사를 한 번에 돌립니다. 실제 브라우저 흐름은 따로 돌립니다(처음 한 번 `npx playwright install chromium`).

```sh
npm run test:e2e
```

캡처는 `test-results/shots/`에 남습니다. `npm run simulate:balance`는 PRD 수치의 **근사** 모델이며 엔진 시뮬레이터가 생기면 폐기합니다.

## 구조

| 경로 | 책임 | 의존하지 않는 것 |
|---|---|---|
| `src/domain/` | 30Hz 고정 틱 전투·경제·문항 흐름·명령(순수 함수, 안전 정수) | React·Phaser·저장소 |
| `src/contracts/` | Zod 런타임 계약(밸런스·맵·문제은행·초안·검토·에셋 manifest) | 화면 |
| `src/content/` | `docs/contracts/*.json`과 문제은행을 검사해 싣기, 문항 의미 검사 | 화면 |
| `src/application/` | `RunController`(유일한 상태 작성자, 루프·저장·정지), 세션 서비스 | 특정 DB 세부 |
| `src/persistence/` | IndexedDB 2슬롯 스냅샷·기록, Web Locks, 설정 | 전투 규칙 |
| `src/game/` | Phaser 전장(임시 그림·manifest 원화 대체·확대·미니맵), 보행 자세 | 보상 판정 |
| `src/ui/` | React 화면·문제판·관리 패널·정지층 | Phaser·저장소 직접 호출 |

밸런스 수치의 원본은 `docs/contracts/balance.candidate.v0.3.json` 하나이며 PRD 표와 `npm run validate:plan`이 대조합니다.

## 문서

- [제작 PRD v0.5](vocabulary_td_prd_v0_5.md) — §18.4에 P1 구현 기록
- [v0.5 점검 근거](docs/prd_v0_5_review.md), [인계서](docs/HANDOFF.md), [작업 게시판](docs/EXECUTION_BOARD.md)
- [작업 패키지](docs/work-packages/README.md) — Codex 원화·Argon 문항·UI 점검·독립 검토 지시서
- [확정 화풍](docs/style-lock-v1.md), [데이터 계약](docs/contracts/README.md)

원문 v0.1·v0.3·v0.4·41번 PNG는 보존하며 검산 도구가 해시를 확인합니다. `tools/build-plan.mjs --legacy-v0.3`은 이력 재생성 전용입니다.

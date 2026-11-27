# tower — 어휘력 타워 디펜스

초등 3~6학년이 한국어 어휘 문제를 풀어 골드를 모으고, 20종의 타워를 설치·진화시켜 성문을 지키는 웹게임입니다.
현재 운영 버전(`v1.0.0`)은 리뉴얼(R1~R5), WebP 원화 전환, GitHub Pages 정적 호스팅(`https://voca.ssamuniverse.com`)과 Cloudflare Workers + D1 기록·랭킹 서버(`https://voca-api.ssamuniverse.com`), 그리고 3~6학년 CR-1000 공동검수 공개 문제은행까지 개통된 상태입니다. 에이전트와 기여자는 **[LLM Wiki 색인](wiki/index.md)** · **[문서 허브](docs/README.md)** · **[llms.txt](llms.txt)**에서 최신 구조와 실시간 계약을 바로 확인할 수 있습니다.

<!-- WIKI-AUTO:START:repo-stats -->
- **제품·밸런스 판**: `v1.0.0` (30Hz 고정 틱 · 화풍 `design-41-kingdom-expedition` · WebP 원화 `378`장)
- **게임 규모**: 학년별 맵 `4`종(3~6학년, 15×9 격자·슬롯 20칸) · 타워 `20`종(Lv4/Lv7 3단 진화) · 적 역할 `10`종 × 종족 `8`종 · 원정 보물 `12`종
- **공개 문제은행**: 3~6학년 자기 학년 승인 **5,547문항** · 공유 포함 총 출제 풀 **6,583문항** (3학년 1140 · 4학년 1563 · 5학년 1869 · 6학년 2011)
- **서버·인프라**: 정적 게임 `https://voca.ssamuniverse.com` (GitHub Pages) · 기록/랭킹 API `https://voca-api.ssamuniverse.com` (Cloudflare Workers 라우트 `7`종 + D1 테이블 `12`종)
- **지식 베이스**: 전체 마크다운 `221`개 · 핵심 의사결정 `10`건 · 루트 npm 명령 `36`개
<!-- WIKI-AUTO:END:repo-stats -->

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

캡처는 `test-results/shots/`에 남습니다. 5173 포트에 다른 작업 폴더의 서버가 떠 있으면 그 서버를 재사용하므로 `E2E_PORT=5175 npm run test:e2e`처럼 포트를 나눕니다. `npm run simulate:balance`는 제품 엔진으로 가상 플레이어를 돌리는 밸런스 시뮬레이터(S11)입니다. `--diffs Normal --strats novice --set 경로=값`으로 조건과 후보 수치를 바꿔 잴 수 있고, 계약 파일은 바꾸지 않습니다. 학생 실측이 아닙니다. `npm run build:bank`는 문항 초안·Argon 자체 반박·Codex/Claude 독립 검토·총괄 해설 대조를 조인해 승인 레지스트리(`content-source/approvals/registry.json`)를 다시 쓰고, 학년별 승인 문항이 30개 이상이면 공개 은행(`src/content/questions/grade<N>.json`)을 만듭니다.

## 구조

| 경로 | 책임 | 의존하지 않는 것 |
|---|---|---|
| `src/domain/` | 30Hz 고정 틱 전투·경제·문항 흐름·명령(순수 함수, 안전 정수) | React·Phaser·저장소 |
| `src/contracts/` | Zod 런타임 계약(밸런스·맵·문제은행·초안·검토·에셋 manifest) | 화면 |
| `src/content/` | `docs/contracts/*.json`과 문제은행을 검사해 싣기, 문항 의미 검사 | 화면 |
| `src/application/` | `RunController`(유일한 상태 작성자, 루프·정지·판 끝 기록), 세션 서비스 | 특정 DB 세부 |
| `src/persistence/` | IndexedDB 기록·동기화 큐, 오답 노트, 설정 | 전투 규칙 |
| `src/game/` | Phaser 전장(임시 그림·manifest 원화 대체·확대·미니맵), 보행 자세 | 보상 판정 |
| `src/ui/` | React 화면·문제판·관리 패널·정지층 | Phaser·저장소 직접 호출 |

밸런스 수치의 원본은 `docs/contracts/balance.candidate.v0.4.json` 하나이며 PRD 표와 `npm run validate:plan`이 대조합니다.

## 문서

- [제작 PRD v0.5](vocabulary_td_prd_v0_5.md) — §18.4에 P1 구현 기록
- [v0.5 점검 근거](docs/prd_v0_5_review.md), [인계서](docs/HANDOFF.md), [작업 게시판](docs/EXECUTION_BOARD.md)
- [작업 패키지](docs/work-packages/README.md) — Codex 원화·Argon 문항·UI 점검·독립 검토 지시서
- [확정 화풍](docs/style-lock-v1.md), [데이터 계약](docs/contracts/README.md)

원문 v0.1·v0.3·v0.4·41번 PNG는 보존하며 검산 도구가 해시를 확인합니다. `tools/build-plan.mjs --legacy-v0.3`은 이력 재생성 전용입니다.

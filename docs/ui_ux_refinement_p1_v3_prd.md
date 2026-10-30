# 어휘력 타워 디펜스 UI/UX 고도화 PRD — 시안 1 (왕국 원정대 정통 공방 v3)

- **문서 상태**: 세부 실행 계획 확정 및 코드 반영본 (`v3.1`)
- **상위 기준 문서**: [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md) (`§9`~`§13`), [스타일 잠금 v1](style-lock-v1.md), [PRD v0.3 추가 결정](prd_v0_3_additions.md)

## 1. 목적 및 5대 고도화 원칙

본 문서는 채택된 **시안 1 (왕국 원정대 정통 공방)**의 목공·양피지 재료감을 상용 수준으로 정교화하면서 시선 분산과 미세 라벨, 상·하단 경계 어긋남을 해소하기 위한 구현 규격 및 세부 실행 계획이다. 기존 도메인 판정(`src/domain/`)과 저장 포맷(`RUN_STATE_VERSION = 1`), 원본 PRD 검증 스크립트(`tools/validate-plan.mjs`) 계약은 변경하지 않는다.

1. **시선 분산 제거 (`Dark-Surface Singularity`)**: 짙은 월넛 암색(`#4a2d18` / `#2e1b10`)은 상단 HUD 금고에만 한정하고, 우측 관리 패널과 하단 문항 보조 영역은 차분한 음각 샌드스톤(`#e7d9bc`)과 양피지(`#f6edd9`)로 통일한다. 상시 초록 상태 배너는 두지 않고 실제 거래 잠금 시에만 잠금 배너를 노출한다.
2. **가독성 및 글자 크기 위계 (`13px` 하한선 잠금)**: `10~12px` 미세 캡션을 전면 폐지하고 전 기기 최소 글자 크기를 `13px` 이상으로 고정한다(`18px` 지문·보기, `20px` 주 재화 수치, `16~17px` 패널·타워 제목, `14.5~15px` 버튼·능력치).
3. **수직·수평 정렬선 `0.0px` 잠금 (`Seam-Lock Grid`)**: 모드 `R`에서 상단 `[전장 | 12px | 우측 관리 레일]`과 하단 `[문항 주 영역 | 12px | 답안 보조함]`의 수직 분할선이 정확히 일치하도록 `.modeR` 폭을 `mapW + 12 + railW`로 묶고 하단 내부 열을 `1fr calc(var(--rail-w) - 16px)`로 설계한다.
4. **전장 칸 크기를 해치지 않는 가변 레일 폭 (`308~346px`)**: 높이가 먼저 제한되는 `1440×900`(`72.4px/칸`), `1366×650` 크롬북(`44.6px/칸`)에서 전장 크기는 유지한 채 남는 가로 여백을 우측 관리 레일(`308~346px`, `1160px` 미만 소형 태블릿은 `272px`)로 배분한다. 크롬북(`mapH <= 460px`)에서는 2행 압축 HUD로 전환해 타워 소켓 잘림을 막는다.
5. **목공 마감 및 PRD `§12.8` 완전 준수**: CSS 그라데이션·`backdrop-filter` `0`, 모서리 반경 `4px/8px`(칩 1종 `999px` 예외), 간격 `4px` 배수(`4/8/12/16/24`), 서체 굵기 `400/700`, `1:1` 정방형 방패 초상화, 보기 우측 `36px` 인장 공간 사전 확보(`0px` 줄바꿈 흔들림), 이모지·영어 단독 라벨 `0건`을 지킨다.

## 2. 패널 치수 및 레이아웃 수식 (`src/ui/useLayout.ts`)

- `effW = Math.min(W, 1560)`, `pad = W < 600 ? 8 : 16`, `innerW = effW - 2 * pad`, `innerH = H - 2 * pad`
- `minRailW = W < 1160 ? 272 : 308`
- `cR = Math.min((innerW - minRailW - 12) / 15, (innerH - 8 - q) / 9)`
- `railW = mode === 'R' ? Math.max(minRailW, Math.min(346, innerW - mapW - 12)) : innerW`
- `compactRail = mode === 'R' && mapH <= 460`

| 표준 뷰포트 | 모드 | 전장 (`mapW×mapH`) | 칸 (`cell`) | 레일 (`railW`) | 검증 조건 |
|---|---|---|---:|---:|---|
| `1600×960` | `R` | `1186×711` | `79.1px` | `330px` | 최대 프레임 `1528px` 중앙 정렬 |
| `1440×900` | `R` | `1086×651` | `72.4px` | `310px` | `cell > 70px` 통과, 좌우 유휴 여백 `0px` |
| `1366×650` | `R` | `669×401` | `44.6px` | `346px` | `cell >= 44px` 통과, `compactRail` 활성, L자 돌출 `0px` |
| `1024×690` | `R` | `708×424` | `47.2px` | `272px` | 터치 확대 없이 즉시 선택 가능 (`>= 40px`) |
| `820×1060` | `S` | `788×472` | `52.5px` | `788px` | 상단 바 HUD + 전장 + 관리 트레이 + 문제판 |
| `390×844` | `S` | `374×224` | `24.9px` | `374px` | 선택 시 `48px` 확대 + `90×54` 미니맵, 가로 넘침 `0px` |

## 3. 단계별 세부 작업 계획 (WP-1 ~ WP-7)

1. **WP-1 (`src/application/view.ts`)**: `GameView`에 `battleStreak`, `waveKillPtGranted`, `waveKillPtCap`, `stakes`(`correctGold`, `correctPt`, `wrongPt`) 읽기 전용 필드를 추가하고 `viewKey`에 반영한다.
2. **WP-2 (`src/ui/styles/global.css`, `src/ui/kit.module.css`, `src/ui/useLayout.ts`, `src/ui/icons/GameIcons.tsx`)**: 기존 홈 화면 `--oak-*` 토큰을 보존하며 공방 색상 토큰을 추가하고, `.board` `4px` 목재 테두리 규격화, 가변 레일 수식, 단일 선 두께(`1.6px`) 문장형 SVG 아이콘 및 `1:1` 방패 초상화 컴포넌트를 구축한다.
3. **WP-3 (`src/ui/game/Hud.tsx`, `Hud.module.css`)**: 상단 월넛 듀얼 금고(보유 골드·점수 문제/처치 분해·최근 변화 배지), 연속 정답 3보석 버닝 램프, 크롬북 2행 압축 HUD, 모드 `S` 반응형 바를 구현한다 (`role="meter"`, `aria-label="골드 N"` 보존).
4. **WP-4 (`src/ui/game/ManagementPanel.tsx`, `ManagementPanel.module.css`, `SlotList.tsx`)**: 음각 샌드스톤 장착 홈 소켓 행, `1:1` 방패 초상화, `idle/slot/tower/branch/sell` 5모드 마감, 거래 잠금 시에만 보이는 잠금 배너, 하단 설치 자리 목록 요약 바를 구현한다 (`role="listbox"` / `role="option"` 및 첫 옵션 자동 포커스 보존).
5. **WP-5 (`src/ui/game/QuestionPanel.tsx`, `QuestionPanel.module.css`, `GameScreen.tsx`, `GameScreen.module.css`)**: 상·하단 수직 분할선 `0.0px` 일치 그리드, 미제출 상태 DOM 오염 없는 우측 `36px` 인장 사전 예약 키캡, 보상 요약 스트립 및 고대비 한지 오답 해설 카드, `BUILD` 단계 2열 브리핑 데크를 구현한다.
6. **WP-6 (`src/game/BattleScene.ts`)**: 적 처치(`kill` 이벤트) 시 월드 좌표 위에 `+{gold}골드 · +{pt}점` 플로팅 콜아웃을 표시한다(`reducedMotion` 대응 및 미니맵 카메라 제외).
7. **WP-7 (`tests/unit/layout-v3.test.ts` 및 전체 검증)**: 레이아웃 수식 단위 테스트 추가 후 `typecheck`, `lint`, `validate:plan`, `build`, Playwright E2E(`home.spec.ts`, `play.spec.ts`), `axe-core` 및 `§12.8` 스타일 검사를 모두 통과시킨다.

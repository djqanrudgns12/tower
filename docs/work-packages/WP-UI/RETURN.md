STATUS: PARTIAL

# WP-UI RETURN — 화면 결함 수정

- **범위 조정**: 총괄 지시에 따라 항목 2·5는 리뉴얼 R1로 이관했다. 같은 이유로 항목 6·7 중 게임 화면 부분(`Hud.module.css` 포커스 고리, `ManagementPanel.module.css` 36px 탭·칩)도 손대지 않았다.
- **PARTIAL인 이유**: 위 이관분 말고는 조정된 범위를 모두 끝냈다. 요청서 항목 일부가 남았으므로 DONE으로 적지 않는다.
- **기준 커밋**: 3cf3229. 브랜치 `wp/WP-UI`이고 커밋하지 않았다.
- **담당**
  - WP-UI 담당 Claude: 항목 1·9·10·11, 설명서 키캡 44px 보정, 전체 통합·검사.
  - 서브에이전트 A(Claude): 항목 3·4·8 구현과 e2e 조각. 조각은 내가 다듬어 `layout.spec.ts`에 넣었다.
  - 서브에이전트 B(Claude): 항목 7(홈·설명서·랭킹·새 게임)과 항목 6의 홈 쪽.
  - 서브에이전트 결과는 diff를 읽고 아래 검사로 확인했다.

## 항목별 결과

### 1. 문제판 제출 흔들림 0 — 완료

**원인**: 총괄 측정은 1440×900에서 보기가 32.32px 이동한 것이다. 해설 카드가 커지면 문제판 행 높이가 늘었고, `_main`(space-between)이 보기를 아래로 밀었다.

**수정** (`src/ui/game/QuestionPanel.tsx`·`.module.css`)
- **해설 카드**: 내용을 절대 위치 몸체(`.feedbackBody`)로 옮겼다. 이제 카드는 문제판 높이에 끼어들지 않는다.
- **두 칸 구획(R·S 와이드)**
  - 문제판 `min-height`는 `useLayout`의 `q`(`--q-budget`)다.
  - 높이는 지문·보기 칸이 정한다. 해설은 카드 안 `wrongText`만 스크롤한다(`tabIndex=0`, `role=region`, 이름 `해설`).
  - '다음 문제' 단추는 카드 아래에 늘 보인다.
- **세로 적층(휴대폰)**: 해설 카드 자리를 제출 전에 정한다(`narrowFeedbackHeight`).
  - 상한은 두 칸과 같은 카드 예산(`qWide` − 문제판 테두리·여백)이다.
  - 화면에 남는 세로 공간만큼만 쓴다.
  - 모자라면 대기 내용+터치 44px을 최소로 지킨다.
- **정답 굵게**
  - 보기 글자를 모두 굵게 그린 상태(`data-measure="bold"`)로 2×2/1열과 줄 수를 잰다.
  - 그 높이를 `--option-text-h`로 미리 잡는다. 그래서 정답이 굵어져도 줄바꿈·높이가 바뀌지 않는다.
- **회전 R↔S**: 측정 열쇠에 모드·전장폭·레일폭·글자 크기를 넣었다. 제출 뒤에도 다시 잰다. 굵게 재므로 제출 전후 결과가 같다.
- **크롬북(`compactRail`)**: 보기 함 안쪽 여백을 8→4px로 줄여(`data-tight`) 두 줄 보기도 예산 208px 안에 넣었다.
  - 이것이 없으면 1366×650에서 두 줄 보기 문항이 7px 넘쳤다. 제출과 무관하게 제출 전부터 넘쳤다.

**실측** (`tests/e2e/layout.spec.ts`, 오답→정답→모르겠어요, 문서 좌표)

| 뷰포트 | 모드 | 보기 Δ(위치·크기 최대) | 문제판 Δ(높이+위치) | 문제판 높이 | 세로 넘침 전/후 | 가로 넘침 |
|---|---|---:|---:|---:|---|---|
| 1440×900 | R | 0.00px | 0.00px | 208.00 | 0/0 | 0 |
| 1366×650 | R | 0.00px | 0.00px | 208.00 | 0/0 | 0 |
| 1024×690 | R | 0.00px | 0.00px | 208.00(두 줄 보기 61px 포함) | 0/0 | 0 |
| 820×1060 | S 와이드 | 0.00px | 0.00px | 215.97 | 0/0 | 0 |
| 390×844 | S 세로 | 0.00px | 0.00px | 471.52 | 0/0 | 0 |

- **회전 시험**: 1024×690 R에서 제출한 뒤 820×1060 S로 바꿨다. 보기를 다시 쟀고, 글자 넘침이 없으며 네 보기의 크기가 같다. 1024×690으로 돌아오면 보기 Δ ≤0.5px이고 열 수도 같다.
- **세로 넘침 판정**: 시험은 세로 넘침 0을 요구한다. 단, 제출 전 문제판이 예산 q(208px)를 넘는 경우는 예외로 둔다.
  - 이 예외는 지문·보기 글이 길 때로, PRD §12.5가 허용한다. 이때도 그 초과분만큼만 허용한다.
  - 제출로 넘침이 늘면 실패다(`after.overflowY <= before.overflowY`).
  - 마지막 실행에서는 예산 초과 문항이 없어 이 예외가 쓰이지 않았다.

### 2. 버닝 표시 — 리뉴얼 R1 이관(미착수)

### 3. 모달 포커스(ModalShell) — 완료 (서브에이전트 A)
- 최신 `onClose`는 `useEffectEvent`로 부른다. 효과는 연 버튼 기준으로 한 번만 돈다.
- 연 버튼은 첫 렌더에 잡는다. 열 때 Tab 순서의 첫 요소(`닫기`)에 한 번 포커스를 주고, 언마운트 때 연 버튼으로 되돌린다.
- Tab 가두기는 `tabIndex=-1` 요소를 뺀다.
- e2e `모달 포커스`: 설정에서 키보드로 '글자 크게'를 고른다. `data-font=large`로 다시 렌더된 뒤에도 포커스가 그 라디오에 남는다. Esc로 닫으면 `#settingsBtn`으로, 상세 순위표의 닫기는 연 버튼으로 돌아간다. 통과.

### 4. 처치 보상 말풍선(BattleScene) — 구현, 화면 실측 미실행 (서브에이전트 A)
- **글자 크기**: 월드 글자 = `max(13, ceil(13 / (카메라 zoom × scale.zoom)))`이다. `scale.zoom`은 1/dpr이다. 확대 모드에서는 생성 시점의 카메라 배율을 쓴다.
- **여백·외곽선·떠오름 거리**: 같은 배율로 키웠다. 가장자리 제한은 표찰의 실제 크기로 계산한다.
- **reducedMotion**: 이동 없이 제자리에서 440ms 보인 뒤 240ms 동안 투명도만 줄어든다.
- **미니맵**: 기존 `callouts` 무시 처리를 그대로 지킨다.
- 캔버스 글자라 DOM 실측 시험은 없다. 화면에서 13px 이상인지는 아직 확인하지 않았다.

### 5. 압축 레일 능력치 요약 — 리뉴얼 R1 이관(미착수)

### 6. 포커스 고리 대비 — 부분 완료 (서브에이전트 B)
- **토큰**: `global.css`에 `--focus`, `--focus-on-dark: #8fd0ff`를 추가했다.
- **적용한 곳**: 홈 헤더 판(`.plaqueInner :focus-visible`), 설명서 키캡 줄(`.keycapBar :focus-visible`)에 2px 고리+2px 간격으로 넣었다.
- **대비**(WCAG 상대휘도, 불투명 색)
  - `#8fd0ff`: `#3b2719` 위 8.48:1, `#2b1c11` 위 9.89:1.
  - 기존 `--blue`: 1.88:1, 2.20:1로 미달이었다.
- **미완**: HUD 금고(`Hud.module.css`)는 항목 2 파일이라 R1로 넘겼다. R1에서 같은 토큰을 쓰면 된다.

### 7. 13px·44px 하한 — 부분 완료 (서브에이전트 B, 키캡은 WP-UI 담당)
- **글자**: `home.module.css` 6곳, `GuideScreen.module.css` 11.5~12.5px 전부, `MiniStageCanvas` 캔버스 글자 12px를 13px로 올렸다.
- **누름 영역**: `.smallBtn`·`.tabBtn`·`.filterBtn`·`.chapterTabBtn`·`.stageSwitchBtn`에 투명한 `::after` 히트 영역(44px)을 넣었다. 보이는 크기는 그대로다.
- **설명서 4장 키캡**: 폭을 26→32px, 간격을 4→12px로 바꾸고 히트 영역을 좌우 6px+테두리 보정해 44px로 했다.
  - 4px 간격 그대로는 30px밖에 나오지 않아 배치를 조금 바꿨다.
- **실측**(1366×650, `elementFromPoint`로 잰 실제 누름 영역)

| 화면 | 최소 글자 | 최소 누름 영역 |
|---|---|---|
| 홈 | 13px | 44px |
| 새 게임 | 13px | 44px |
| 상세 순위표 | 13px | 44px |
| 설명서 1~4장 | 13px | 44px |

  - 설명서 1~4장은 대화상자 안 스크롤이 0이다.
- **미완**: 게임 화면 `ManagementPanel.module.css`의 36px 범위 탭·역할 칩은 R1로 넘겼다.

### 8. 키보드 위젯 — 완료 (서브에이전트 A)
- **RankingModal**: ←/→/Home/End, roving tabindex, `aria-controls`·`tabpanel`(`rank-modal-*`)을 넣었다. e2e 통과.
- **GuideScreen**
  - window 전역 keydown을 없앴다. ModalShell의 새 선택 속성 `onDialogKeyDown`으로 대화상자 안에서만 받는다.
  - 입력 칸이나 방향키를 쓰는 위젯(radiogroup·listbox 등) 안에서 누른 키는 그 위젯에 맡긴다.
  - 기존 `home.spec` G01~G16이 통과했다. 전용 시험은 없다.
- **NewGameScreen**: 학년·난이도 radiogroup에 ←/→/↑/↓/Home/End를 넣었다. 비활성 항목은 건너뛰고, roving tabindex를 쓴다. e2e 통과.

### 9. 레이아웃 상수 계약화 — 완료

**계약 `layout` 블록** (`questionSelection` 등 다른 블록은 그대로)
- `frameMaxPx` 1440→1560.
- `modes.R.railWidthPx`(224)를 `modes.R.rail` `{minPx 308, tabletMinPx 272, tabletBelowWidthPx 1160, maxPx 346, compactMapHeightMaxPx 460}`으로 바꿨다.
- 최상위 `railWidthPx` 224를 지웠다.
- `optionGrid.twoByTwoMinCellWidthPx` 160→200.
- 대체된 PRD v0.5 값은 `prdV05Superseded`(by v3 문서)에 남겼다.

**읽는 쪽**
- `useLayout.ts`는 위 값을 모두 계약에서 읽는다. 시작할 때 `:root`에 `--frame-max`, `--rail-min`을 넣는다.
- `GameScreen.module.css`의 `max-width: 1560px`와 `var(--rail-w, 308px)`을 변수로 바꿨다. `QuestionPanel.module.css`도 같다.
- `QuestionPanel`의 2×2 기준 200px과 2줄 기준은 계약 `optionGrid`에서 읽는다.

**validate-plan** (레이아웃 키 검사만)
- PRD 대조는 `prdV05Superseded`(1440/224/160)로 한다.
- 새 검사 '시안 1 v3 문서와 레이아웃 계약 일치'를 넣었다. `effW = Math.min(W, 1560)`, `minRailW = W < 1160 ? 272 : 308`, `Math.min(346, …)`, `` `308~346px` ``, `mapH <= 460`을 v3 문서와 대조한다.
- **2×2 200px은 어느 문서에도 적혀 있지 않다**(PRD는 160px). 그래서 160 이상인지만 확인한다.

**남은 숨은 상수**(요청 목록 밖, 손대지 않음)
- `QuestionPanel.module.css`의 S 와이드 보조 칸 248px. 계약 `questionSideColumnPx`는 240이라 서로 다르다.
- `useLayout`의 휴대폰 `q = 300`. 계약은 `"content"`다.

### 10. 보조 정리 — 완료
- `GameView.waveKillPtGranted`·`waveKillPtCap`을 지웠다. 화면에서 쓰지 않았고 `viewKey`에도 없었다.
- 레일 최소폭을 `minRailWidth(W) = clamp(W − 852, 272, 308)`로 이었다. 기울기 1이라 1124~1160px 사이에서 칸 크기가 평평하고, 1159→1160px에서 칸이 줄던 불연속이 없어졌다.
  - 예: 높이 900에서 56.2→53.8px로 떨어지던 것이 사라졌다.
  - v3 표의 1024·1366·1440·1600 행 값은 바뀌지 않았다.

### 11. 시험이 주장을 실제로 검증 — 완료

**`tests/e2e/layout.spec.ts`** (11개 시험)
- 5개 뷰포트 × 오답·정답·모르겠어요 제출 전후 DOM 실측: 보기 위치·크기, 문제판 높이·위치, 세로·가로 넘침, R 모드 수직선(전장 오른쪽+12 = 레일 왼쪽 = 해설 카드 왼쪽, 전장 오른쪽 = 문제 주 칸 오른쪽).
- 1366×650 압축 HUD 2줄과 가로 넘침.
- 제출 뒤 회전.
- 모달 포커스, 순위표 탭, 새 게임 radiogroup.
- 13px·44px 하한.
- 정답 판별은 3학년 은행 전체의 보기 묶음으로 한다. 1,065묶음이고 겹침이 0임을 확인했다.

**`tests/unit/layout-v3.test.ts`**: 동어반복 단언(같은 식을 다시 계산)을 지웠다. 기대값은 다음에서 읽는다.
- v3 문서 §2 표를 직접 파싱한 6행: 모드·전장·칸·레일.
- 계약 `layout` 값.
- 연속성 시험: 900~1700px에서 칸이 줄지 않고, 레일 최소폭 점프가 1px 이하다.
- `waveKillPt*`가 없는지.

**문서 오기 2건**: 시험에 `DOC_ERRATA`로 명시하고 정확한 값을 단언한다.
- S 모드 폭 제한 두 행(820×1060의 788, 390×844의 374)은 내림하지 않은 안쪽 폭으로 적혀 있다.
- 표 자신의 칸 값으로 계산하면 787·373이다. 코드는 원래부터 787·373을 냈다.

## REQUESTED_CONTRACT_CHANGE

1. **PRD v0.5 본문 갱신(총괄)**
   - 고칠 곳: §12.1 '앱 프레임 최대 1440px', '레일224', V01 '관리224px', §12.5 '폭이 160px 이상'.
   - v3 값: 1560, 308~346(1160 미만 272), 200.
   - 2×2 200px은 문서 근거가 없다. 200이 맞는지 아니면 PRD의 160으로 돌릴지 결정이 필요하다.
   - 휴대폰은 보기 칸이 약 163px이라 200 기준에서는 늘 1열이다.
   - 본문을 고치면 계약의 `prdV05Superseded`와 validate-plan의 해당 대조를 지운다.
2. **v3 문서 §2(총괄)**
   - 표 오기: 820×1060 전장 788→787, 390×844 374→373.
   - `minRailW` 식을 연속 경사(`clamp(W − 852, 272, 308)`)로 갱신한다.
   - 문자열 `minRailW = W < 1160 ? 272 : 308`은 validate-plan이 대조하므로, 바꿀 때 검사도 같이 고친다.
3. **GameScreen.tsx(WP-SAVE·R1)**
   - 문제 도중 `WAVE_WRAPUP`으로 바뀌면 문제판 위에 '전투가 끝났어요…' 줄(20px+간격 4px)이 끼어든다. 그만큼 문제판과 보기가 아래로 밀린다. 연습 판 안내 줄(`coachLine('question')`)도 같다.
   - QuestionPanel 밖이라 고치지 않았다. 예산 안 고정 줄로 바꾸거나 겹쳐 보이게 해야 한다.
4. **R1 이관 목록**
   - 항목 2(Hud 버닝 보석·`balance.burning`).
   - 항목 5(압축 레일 능력치 요약).
   - 항목 6의 HUD 금고 포커스 고리(`var(--focus-on-dark)` 사용).
   - 항목 7의 `ManagementPanel.module.css` 36px 탭·칩.
5. **크롬북 문제판 예산**
   - 1366×650은 바닥 여유가 209px로 빠듯하다. 두 줄 지문과 두 줄 보기가 겹치면 문제판이 약 233px가 되어 제출 전부터 약 24px 넘친다.
   - PRD는 '긴 문제는 R→S 전환 가능'이라 했지만 구현되어 있지 않다. 이번 수정으로 생기거나 커진 문제는 아니다.
6. **`docs/contracts/prd_v0_5_validation.json`**
   - `validate:plan`이 실행할 때마다 다시 쓰는 보고서이고 WP-UI 소유가 아니다. 그래서 실행 뒤 기준본으로 되돌렸다.
   - 수합 뒤 총괄이 `npm run validate:plan`을 한 번 돌려 해시를 갱신해야 한다.

## 검사 실제 출력 요약 (같은 작업 트리 최종본)

| 검사 | 결과 |
|---|---|
| `npm run typecheck` | exit 0, 출력 오류 없음 |
| `npm run lint` | exit 0, 경고·오류 없음 |
| `npm test` | Test Files 30 passed (30), Tests 507 passed (507) |
| `npm run validate:plan` | exit 0, `passed 49, failed 0`, localLinksChecked 72. 보고서 파일은 되돌림(위 6) |
| `E2E_PORT=5182 npx playwright test tests/e2e/layout.spec.ts --workers=1` | 11 passed (1.4m) |
| 추가 회귀: `E2E_PORT=5182 npx playwright test tests/e2e/home.spec.ts tests/e2e/play.spec.ts --workers=1` | 13 passed (2.4m). axe·§12.8 검사 포함 |

**실측 환경 주의**
- 이 worktree의 `node_modules`는 본 저장소로 가는 심볼릭 링크다. 그래서 Vite가 Pretendard woff2를 허용 목록 밖이라 거절했고, e2e는 대체 글꼴로 돌았다.
- 열 수·줄바꿈은 실제 렌더 측정이라 글꼴이 바뀌어도 같은 규칙으로 정해진다. 다만 픽셀 수치(문제판 215.97, 471.52 등)는 Pretendard에서 다를 수 있다.
- 문항은 판마다 무작위다. 실행마다 문제판 높이(208~215.97)와 두 줄 보기 여부가 달라진다.

## 바뀐 파일
- `docs/contracts/product.defaults.v0.5.json`(layout만)
- `src/application/view.ts`
- `src/game/BattleScene.ts`
- `src/ui/game/GameScreen.module.css`
- `src/ui/game/QuestionPanel.module.css`
- `src/ui/game/QuestionPanel.tsx`
- `src/ui/screens/GuideScreen.module.css`
- `src/ui/screens/GuideScreen.tsx`
- `src/ui/screens/NewGameScreen.tsx`
- `src/ui/screens/home/MiniStageCanvas.tsx`
- `src/ui/screens/home/ModalShell.tsx`
- `src/ui/screens/home/RankingModal.tsx`
- `src/ui/screens/home/home.module.css`
- `src/ui/styles/global.css`
- `src/ui/useLayout.ts`
- `tests/unit/layout-v3.test.ts`
- `tools/validate-plan.mjs`
- `tests/e2e/layout.spec.ts`(새 파일)
- `docs/work-packages/WP-UI/RETURN.md`

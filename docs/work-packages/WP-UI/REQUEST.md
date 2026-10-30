---
jobId: WP-UI
owner: Claude 서브에이전트(총괄 지휘)
issuedBy: 총괄 Claude Opus 5.5
issuedAt: 2026-10-30
baseCommit: 작업 폴더의 HEAD(자동 기록: .orchestrate/state/WP-UI.json)
---

# WP-UI — 화면 결함을 PRD·v3 규격대로 고친다

근거:
- 5b5977a·c201e2d 검수(UI 코드 검수 15건)
- 총괄의 브라우저 측정: 1440×900 R 모드에서 오답 제출 시 보기가 32.3px 아래로 밀린다. 화면 높이가 873→905px로 늘어 900px 창을 넘고 해설 카드가 잘린다. 973×900 S 모드도 같다.

기준 문서:
- `vocabulary_td_prd_v0_5.md` §12(화면 모드·HUD·문제판·접근성)·§12.8
- `docs/ui_ux_refinement_p1_v3_prd.md`(13px 하한, 0.0px 수직선, 36px 인장 자리)
- `docs/style-lock-v1.md`

## 바꿀 수 있는 곳

`tools/orchestrate/jobs.json`의 WP-UI owns 목록만 쓴다.
- `docs/contracts/product.defaults.v0.5.json`은 `layout` 블록만 고친다. `questionSelection`은 총괄이 고친다.
- `tools/validate-plan.mjs`는 레이아웃 키 검사만 고친다.
- 다른 작업 소유 파일은 열어 보기만 한다.
  - `GameScreen.tsx`·`PauseOverlay`·`HomeScreen.tsx`·`LaunchDeck`·`App.tsx`(WP-SAVE)
  - SettingsModal·`settings.ts`·TelemetryStrip·SteleStudyPanel(WP-NET)

## 할 일

1. **문제판 제출 흔들림 0(v3 §1-5, PRD §12.4).**
   - 제출 전후로 보기 네 개의 위치·크기와 문제판 전체 높이가 바뀌지 않아야 한다. R·S 모드 모두, 정답·오답·모르겠어요 모두 해당한다.
   - 해설 카드는 문제판 높이 예산(`useLayout`의 q) 안에 들어가야 한다. 넘치면 카드 안에서만 스크롤한다.
   - 정답 보기를 굵게 바꿀 때 줄바꿈이 생기지 않게 한다.
   - 제출 뒤 화면 회전으로 R↔S가 바뀌면 배치를 다시 계산한다.
2. **버닝 표시(PRD §5).**
   - 연속 정답 보석은 `battleStreak % balance.burning.streak`이고, 버닝 중에는 가득 찬 상태로 보인다.
   - 조건 수(3)와 공격 속도 증가(+25%)는 `balance.burning`에서 읽는다. 하드코딩하지 않는다.
3. **모달 포커스(ModalShell).**
   - `onClose`가 렌더마다 바뀌어도 효과가 다시 돌지 않게 한다(ref).
   - 열 때 한 번만 첫 요소에 포커스를 주고, 닫을 때 연 버튼으로 되돌린다.
   - 설정에서 키보드로 항목을 바꿔도 포커스가 그 자리에 남아야 한다.
4. **처치 보상 말풍선(BattleScene).** 화면에서 13px 이상이어야 한다(카메라 배율로 글자 크기를 보정). reducedMotion이면 이동 없이 보인다.
5. **압축 레일(compactRail).** 크롬북(1366×650)에서도 고른 타워의 능력치·역할 요약이 보여야 한다(PRD §12.3). 줄여서 보이게 한다.
6. **포커스 고리 대비.** 짙은 배경(HUD 금고, 홈 헤더 판) 위에서도 3:1 이상이어야 한다. 밝은 바깥 고리를 쓰거나 표면별 토큰을 둔다.
7. **13px·44px 하한(v3 §1-2, 계약 touchMinPx).**
   - 사용 설명서·홈 모달·랭킹의 11~12px 글자를 13px 이상으로 올린다.
   - 26~36px 터치 영역을 44px 이상으로 키운다.
8. **키보드 위젯.**
   - RankingModal tablist에 방향키와 roving tabindex를 넣어 RankingBoard와 같게 한다.
   - GuideScreen의 ←/→/Home/End는 설명서 대화상자 안에서만 받는다(window 전체 가로채기 금지).
   - NewGameScreen의 학년·난이도 radiogroup에 방향키 이동을 넣는다.
9. **레이아웃 상수 계약화.**
   - `useLayout.ts`·`QuestionPanel.tsx`·`GameScreen.module.css`의 숨은 상수를 계약 `layout` 블록에서 읽는다(CSS는 변수로 주입).
   - 해당 상수: 1560, 272/308/346, 1160, 2×2 기준 200px.
   - 계약의 옛 값(frameMaxPx 1440, railWidthPx 224, twoByTwoMinCellWidthPx 160)과 v3 값이 충돌하면 v3 값으로 계약을 갱신한다. `validate-plan`이 그 키를 문서와 대조하면 문서 쪽 표기도 확인한다.
10. **보조 정리.** `view.ts`의 쓰지 않는 필드(`waveKillPt*`)를 화면에서 쓰거나 지운다. 1159→1160px에서 같은 높이인데 칸이 줄어드는 불연속을 없앤다(레일 최소폭 전환을 연속으로).
11. **시험이 주장을 실제로 검증하게 한다.**
    - `tests/e2e/layout.spec.ts`에서 DOM 실측으로 확인한다.
      - 1440×900·1366×650·1024×690·820×1060·390×844 각각에서 제출 전후 보기 위치 차이 ≤0.5px, 문서 세로 넘침 0
      - R 모드 수직선(전장 오른쪽+12px = 레일 왼쪽 = 하단 오른쪽 열 왼쪽) 차이 ≤0.5px
      - 1366×650 압축 HUD 2줄
      - 가로 넘침 0
    - `layout-v3.test.ts`의 동어반복 단언(같은 식을 다시 쓴 것)을 계약 표 값 대조로 바꾼다.
    - e2e는 전용 포트로 돌린다: `E2E_PORT=5182 npx playwright test tests/e2e/layout.spec.ts --workers=1`. 새게임 진입은 별명 칸(`출정 별명`) 입력 → 새 게임 → 시작하기 순서다.

## 검사

끝내기 전에 `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:plan`과 위 e2e를 돌린다.

## RETURN.md

첫 줄 `STATUS: DONE|PARTIAL`. 항목 1~11의 완료 여부와 근거, 실측 수치(제출 전후 Δ, 수직선 Δ, 글자·터치 최소값), 검사 출력 요약을 적는다.

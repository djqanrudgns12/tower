# R5 세션 C 브리프 — P3 새 게임·결과·설정·오답 노트·홈

메인 세션(총괄)이 쓴다. 세션 C는 이 문서를 먼저 끝까지 읽고 시작한다. 사용자에게 보이는 출력과 보고는 한국어로 쓴다. 같은 폴더에서 세션 A(전투)·B(설명서)가 동시에 일한다.

## 먼저 읽을 것
1. [`AGENTS.md`](../../../AGENTS.md)·[`CLAUDE.md`](../../../CLAUDE.md): 단일 폴더 규칙. worktree·폴더 복사 금지. `git add -A`·`stash`·`reset`·`checkout -- .`·`restore .`·`clean` 금지. **사용자가 다듬은 홈을 통째로 바꾸지 않는다**(2026-11-04에 확인 없이 지운 일이 있었다).
2. [R5 계획서](../prd-r5-oak-v2.md) §0~§4, **§5.4(N1~N3, R1·R2, S1·S2, O1, H1)**, §6 P3, §7(소유표·커밋·검사 예산), §8 관문.
3. [UI 규정 v4](../ui-rules-v4.md): **구현 기준.** 머리의 홈 예외와 총괄 결정 1~14, §3 재질, §4 부품, §5.3 글자 3층, §6 용어, §7.1 밀도, 부록 B "P2 뒤 넘겨받을 것".
4. P2 결과(세션 K, `47f76fb`·`172aec8`·`ef2b5e8`): kit 부품이 참나무 옷을 입었다. 창은 kit `Modal`(호두나무 테 + 양피지 + 구분선, `initialFocus`), Toggle에 켜짐·꺼짐 글자가 붙었다. 홈 토큰은 `global.css`로 올라갔다.
5. 눈 기준: 홈은 [`qa/landing-baseline/`](../qa/landing-baseline/)과 같은 모습(홈 예외). 나머지는 [`qa/pre-r4/`](../qa/pre-r4/)(새 게임·결과·설정의 옛 모습), [`qa/r5-baseline/`](../qa/r5-baseline/)(P2 전 지금 화면). P2 뒤 캡처는 `test-results/r5-k*/`.

## 할 일(체크리스트 ID — 완료 기준은 계획서 §5.4 표)
- **N1** 새 게임 창에 "닉네임 ○○ · 바꾸기" 한 줄(누르면 창을 닫고 홈 입력칸에 포커스). 닉네임이 비면 이유가 보인다.
- **N2** 좁고 낮은 화면에서 시작 줄을 창 아래에 고정. 390×844·1366×650에서 스크롤 없이 시작이 보인다.
- **N3** 고른 난이도 설명 + 판독 한 줄. 판독 함수는 세션 B가 G5에서 `src/ui/screens/guide/`에 만들어 export한다. 이름·위치는 메인이 알려 준다. 그 전에는 N1·N2·다른 일을 먼저 한다.
- **R1** 결과: R4 구성(큰 웨이브·새 기록·3지표) 위에 "이번 판 기록" 접기(푼 문제·모르겠어요·만난 낱말). 퍼센트·숙련도는 보이지 않는다(PRD §20.5). 결과 판은 지금 `Card float`라 창 틀이 다르다(P2 눈 관문 메모) — kit `Modal`과 같은 호두나무 테(`frame.sm`) + 구분선(`rule`)으로 창 재질을 한 벌로 맞춘다. 3지표 칸은 `Card sunk`.
- **R2** 만점 판 칭찬 한 줄, 웨이브 숫자 올라가기·새 기록 팝(움직임 줄이기면 투명도만).
- **S1** 설정: 한 목록 + 소제목 3개(소리 / 화면·글자 / 기록), 900px 이상은 2열. 1366×650 창 안 스크롤 0.
- **S2** 움직임·고대비 한 줄 설명, '(기본)' 표식, Toggle 켜짐·꺼짐 글자(P2 kit에 있음).
- **O1** 오답 노트를 양피지 공책 화면으로(격자 카드, 빈 상태 그림). 넓은 화면에서 빈 공간이 작다. 빈 상태 그림은 Antigravity가 그린다(ART-OAK2, 메인이 요청). 그림이 오기 전에는 자리만 잡는다.
- **H1** 홈 용어·글자 크기 규칙 적용, 머리판 「내 기록」은 랭킹 '내 기록' 탭 바로가기로 유지. **landing-baseline과 같은 모습**.

## P2에서 넘겨받은 것(v4 부록 B)
- `home.module.css` 안 쓰는 클래스 15개(`modalScrim`·`modalDialog`·`modalDialogWide`·`modalBody`·`modalHeader`·`modalTitle`·`modalActions`·`settingsTabs`·`settingSection`·`settingRow`·`segmentedRow`·`segBtn`·`fontPreviewBox`·`inheritedNickBar`·`choiceGrid2`)를 `css.<이름>` 사용처 0을 확인하고 지운다.
- `home.module.css` 직접 색(`#ffffff` 8곳 등 6곳 남음)을 토큰으로. 맞는 토큰이 없으면 메인에 요청한다.
- 오늘의 낱말 뜻·예문(`SteleStudyPanel.tsx`)에 읽는 글 표시 `data-content`를 단다(밀도 셈에서 상시 문장 3→5로 세어지는 것을 바로잡음).
- 학교 목록 글자 11px·12px(`.schoolItemBadge`·`.schoolItemAddress`, 13px 하한 미달) — v4 부록 B.
- 마우스를 올렸을 때 깔리는 바탕은 `--parch-3`(v4 총괄 결정 14). `--line`(`--oak-2`)은 글 바탕이 아니다.
- `RankingModal.tsx`는 P2 동안 K가 kit `Modal`로 옮겼다(첫 포커스 = 닫기, v4 결정 9). 이제 C 소유다.

## 그림·원화
- 재질 원화: `public/assets/ui/oak/*.webp`. 쓰는 법은 [`asset-source/renewal/ART-OAK1/manifest.json`](../../../asset-source/renewal/ART-OAK1/manifest.json)·`preview.html`. 원화 파일은 만들거나 고치지 않는다. 새 그림이 필요하면 메인에 요청한다.

## 소유(이 경로만 고친다)
- `src/ui/screens/NewGameScreen.tsx`, `ResultScreen.tsx`·`ResultScreen.module.css`, `SettingsModal.tsx`·`SettingsModal.module.css`, `NoteScreen.tsx`·`NoteScreen.module.css`, `HomeScreen.tsx`, `src/ui/screens/home/**`(`RankingModal.tsx`·`home.module.css` 포함), `tests/e2e/home.spec.ts`·`note.spec.ts`.
- 새 문구는 `src/ui/screens/home/homeCopy.ts` 같은 자기 폴더 파일에 둔다(`copy.ts`는 메인 소유). `tests/unit/terms.test.ts` 금지어를 지킨다(평이한 말: 랭킹 점수·시작·새 게임·홈·이번 판 기록 …).
- **고치지 않는 것**: `src/ui/kit/**`·`global.css`·`icons/**`(부품 변경이 필요하면 메인에 요청 — 메인이 세션 K에 넘긴다), `src/ui/App.tsx`, `layout.spec.ts`·계약 JSON·`copy.ts`·`docs/**`·`tools/qa/**`(메인), 다른 화면 파일(A·B). `src/ui/screens/home/canvasAssets`는 B가 읽어 쓰니 바꾸면 메인에 알린다.

## 검사(자기 범위만, verification-budget)
- 단위: `npx vitest run tests/unit/ui tests/unit/lobby.test.ts tests/unit/review-note.test.ts tests/unit/terms.test.ts` (+ 새로 쓴 시험)
- e2e: `E2E_PORT=5431 npx playwright test tests/e2e/home.spec.ts tests/e2e/note.spec.ts tests/e2e/layout.spec.ts --output test-results/e2e-c` (`layout.spec.ts`는 돌리기만, 고치지 않는다)
- 캡처: `node tools/qa/scenes.mjs --out test-results/r5-c --scenes 01-home,01-newgame,10b,12b,12c,12d,12e,12f --port 5431 --no-montage`, 글자 크기 `--font large`·`--font xlarge`도 한 번씩. 홈은 `qa/landing-baseline/`, 나머지는 `qa/pre-r4/`·`qa/r5-baseline/`과 나란히 본다.
- 커밋 전 `npx tsc --noEmit -p tsconfig.json`과 `npm run lint`.
- 같은 실패 3번이면 멈추고 시도·가설·증거를 보고한다. 기대값·단언을 약하게 바꿔 통과시키지 않는다. `layout.spec.ts` 단언 변경이 필요하면 메인에 요청한다.

## 관문(P3 C 완료 기준)
- N1~N3, R1·R2, S1·S2, O1, H1 각 완료 기준(계획서 §5.4).
- 홈이 landing-baseline과 같은 모습.
- 13px·44px 하한, 가로 넘침 0, 1366×650 홈 세로 스크롤 0·설정 창 안 스크롤 0 — 글자 크기 3단계 모두.
- 그라데이션·블러·글자 그림자 0, 움직임 줄이기에서 움직임 0, 퍼센트·숙련도 비노출.
- 흰 종이 카드 0, 창 재질 한 벌(kit `Modal`).
- 위 검사 통과.

## 커밋·보고
- 작업 단위마다 `git commit --only -- <내 경로>`(새 파일은 먼저 `git add -- <파일>`, 삭제는 `git rm -- <파일>`). 시작할 때와 커밋 전 `git status`로 남의 변경을 확인하고 건드리지 않는다. 메시지에 체크리스트 ID(예: `feat(ui): R5 S1 설정 한 목록`)와 끝줄 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`(실제 모델 이름으로). **push는 하지 않는다.**
- 끝나면 보고: 커밋 SHA 목록, ID별 완료·남은 것, 바꾼 시험 단언, 검사 결과(실행/재사용/미실행), 캡처 비교에서 본 차이, 메인에 요청할 것(토큰·그림·`layout.spec`·kit).

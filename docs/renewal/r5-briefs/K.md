# R5 세션 K 브리프 — P2 공용 부품 참나무 옷

메인 세션(총괄)이 쓴다. 세션 K는 이 문서를 먼저 끝까지 읽고 시작한다. 사용자에게 보이는 출력과 보고는 한국어로 쓴다.

## 먼저 읽을 것
1. [`AGENTS.md`](../../../AGENTS.md)·[`CLAUDE.md`](../../../CLAUDE.md): 단일 폴더 규칙. worktree·폴더 복사 금지. `git add -A`·`stash`·`reset`·`checkout -- .`·`clean` 금지.
2. [R5 계획서](../prd-r5-oak-v2.md) §0~§4, §5.1(C1~C6), §6 P2, §7(소유표·커밋·검사 예산), §8 관문.
3. [UI 규정 v4](../ui-rules-v4.md): 토큰 이름·값, 재질 4단, 부품별 규칙, 글자 크기 3층. **이 문서가 구현 기준이다.** 문서와 다르게 해야 하면 고치기 전에 메인에 이유를 보고한다.
4. 눈 기준: [`qa/pre-r4/`](../qa/pre-r4/)(이전 나무 화면), [`qa/landing-baseline/`](../qa/landing-baseline/)(복원한 홈), [`qa/r5-baseline/`](../qa/r5-baseline/)(지금 화면, 비교 기준).

## 할 일(체크리스트 ID)
- **C1** 전역 토큰 v4를 `src/ui/styles/global.css`에 둔다. 홈 `.lobbyRoot`의 옛 토큰(`--oak-*`, `--edge`, `--shadow-board` 등)을 공식 토큰으로 올리고, v3 이름(`--bg`·`--paper`·`--line`·`--ink`·`--green`·`--amber`·`--red` …)을 참나무 값으로 다시 매핑한다. 홈 화면 모습은 [`qa/landing-baseline/`](../qa/landing-baseline/)과 같아야 한다(픽셀 비교, 움직이는 캔버스 제외).
- **C2** kit 9종(`src/ui/kit/index.tsx`·`ui.module.css`: Button·IconButton·Card·Segmented·Toggle·Stat·ArtIcon·Badge·Modal)과 `ChoiceCard`에 참나무 옷을 입힌다(v4 §부품별 규칙). R4 구조(크기 단계·포커스 링·키보드·roving·첫 포커스)는 바꾸지 않는다. Toggle에 켜짐·꺼짐 글자를 붙인다.
- **C3** 랭킹 전체 보기 창을 kit `Modal`로 옮기고 `src/ui/screens/home/ModalShell.tsx`를 지운다. 옛 `ModalShell` 모양(호두나무 테 + 양피지 면, 제목 줄 아래 구분선, 닫기)은 `Modal`이 이어받는다.
- **C5** 글자 크기 3층: 문제 글 `--q-font` 18/21/24px(지금 그대로), 읽는 글 `--read-font` 기본/+1/+2px, 조작 글 고정. 복원 홈의 "본문 15/16/17px 전체 확대"(`home.module.css` `.foreground, .modalScrim`)를 이 규칙으로 바꾼다. `--read-font`를 실제로 쓰는 화면 반영은 P3 트랙이 하고, K는 토큰과 kit·홈·랭킹 창에 적용한다.
- **움직임 줄이기 공통 길**: 설정 `motionMode: 'minimal'`을 `src/ui/App.tsx`에서 `<html data-motion="minimal">`로 달고, kit·global.css의 반복 움직임이 OS `prefers-reduced-motion`과 함께 이것도 따르게 한다(v4 §7.3).
- **반경·누름**: 반경 토큰을 4·8px로 되돌린다(v4 총괄 결정 2). kit `Button` 누름의 `translateY`는 문제판 안에서 꺼질 수 있게 선택(예: prop 또는 `data-` 속성)을 둔다(v4 §7.4, 실제 적용은 A).
- **C6(일부)** `src/ui/icons/GameIcons.tsx`의 쓰이지 않는 아이콘을 지우고(`grep`으로 사용처 0 확인), 도구 키 아이콘을 2px 선 세트로 맞춘다. 날아가는 금화(`src/ui/game/CoinFlight.tsx`)는 세션 A가 B8과 함께 한다.

## 재질 원화
- 메인이 Antigravity로 ART-OAK1 12장을 만들고 처리해 `public/assets/ui/oak/*.webp`와 `asset-source/renewal/ART-OAK1/manifest.json`(9-slice 값)을 커밋한다. 요청서: [`asset-source/renewal/ART-OAK1/REQUEST.md`](../../../asset-source/renewal/ART-OAK1/REQUEST.md).
- **원화가 오기 전에는 v4 토큰의 단색 대체값으로 자리를 잡는다.** 원화가 커밋되면 메인이 알린다. 그때 `border-image`·타일로 바꾼다. 원화 파일을 직접 만들거나 고치지 않는다.

## 소유(이 경로만 고친다)
- `src/ui/kit/**`, `src/ui/styles/global.css`, `src/ui/icons/**`
- `src/ui/screens/home/ModalShell.tsx`(삭제)·`RankingModal.tsx`
- P2 동안만: `src/ui/screens/home/home.module.css`(토큰 블록과 글자 크기 규칙), `src/ui/game/ChoiceCard.tsx`·`ChoiceCard.module.css`, `src/ui/App.tsx`(`<html data-motion>`만)
- 그 밖의 파일(화면 TSX, e2e 시험, `copy.ts`, `docs/**`)은 고치지 않는다. 필요하면 메인에 요청한다. 화면 문구를 새로 쓰면 `tests/unit/terms.test.ts` 금지어를 지킨다.

## 검사(자기 범위만, verification-budget)
- 단위: `npx vitest run tests/unit/ui tests/unit/terms.test.ts`
- e2e: `E2E_PORT=5401 npx playwright test tests/e2e/layout.spec.ts tests/e2e/home.spec.ts --output test-results/e2e-k`
- 캡처: `node tools/qa/scenes.mjs --out test-results/r5-k --scenes 01,02,03,04,10a,10b,11,12 --port 5401 --no-montage` → `docs/renewal/qa/r5-baseline/`와 나란히 본다.
- 커밋 전 `npx tsc --noEmit -p tsconfig.json`.
- 같은 실패 3번이면 멈추고 시도·가설·증거를 보고한다. 기대값을 바꿔 통과시키지 않는다. e2e 단언 변경이 필요하면 메인에 요청한다.

## 관문(P2 완료 기준)
- 모든 장면 캡처에서 흰 종이 카드 0, 창 재질 한 벌(kit `Modal` 하나).
- 홈이 landing-baseline과 같은 모습(C1).
- 글자 13px·누름 44px 하한, 가로 넘침 0, 1366×650 홈·전투 세로 스크롤 0, 글자 크기 3단계 모두.
- 그라데이션·블러·글자 그림자 0, 움직임 줄이기에서 움직임 0, 답안 키 수직선 잠금(Δ≤0.5px) 유지.
- 위 검사 통과.

## 커밋·보고
- 작업 단위마다 `git commit --only -- <내 경로>`(새 파일은 먼저 `git add -- <파일>`). 메시지에 체크리스트 ID(예: `feat(ui): R5 C1 전역 토큰 v4`)와 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **push는 하지 않는다**(메인이 관문 뒤에 한다).
- 끝나면 보고: 커밋 SHA 목록, ID별 완료·남은 것, 검사 결과(실행/재사용/미실행), 캡처 비교에서 본 차이, 메인에 요청할 것.

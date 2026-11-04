# R5 세션 A 브리프 — P3 전투 화면

메인 세션(총괄)이 쓴다. 세션 A는 이 문서를 먼저 끝까지 읽고 시작한다. 사용자에게 보이는 출력과 보고는 한국어로 쓴다. 같은 폴더에서 세션 B(설명서)·C(창·결과·노트·홈)가 동시에 일한다.

## 먼저 읽을 것
1. [`AGENTS.md`](../../../AGENTS.md)·[`CLAUDE.md`](../../../CLAUDE.md): 단일 폴더 규칙. worktree·폴더 복사 금지. `git add -A`·`stash`·`reset`·`checkout -- .`·`restore .`·`clean` 금지.
2. [R5 계획서](../prd-r5-oak-v2.md) §0~§4, **§5.2(B1~B15)**, §6 P3, §7(소유표·커밋·검사 예산), §8 관문.
3. [UI 규정 v4](../ui-rules-v4.md): **구현 기준.** 특히 머리의 총괄 결정 1~14(2026-11-05 결정 6~14는 P2 결과), §3 재질, §4 부품, §5.3 글자 3층, §7.3 움직임, §7.4 transform 금지 영역, 부록 B "P2 뒤 넘겨받을 것".
4. P2 결과(세션 K, `47f76fb`·`172aec8`·`ef2b5e8`): kit 부품(`src/ui/kit/index.tsx`·`ui.module.css`)이 참나무 옷을 입었다. 키 원화는 `::before`, 끄는 법은 `--key: none; --art-clip: initial; --art-shadow: initial`. 누름 이동은 `Button still` 또는 조상 `--btn-press-y: 0px`. 창은 kit `Modal`(호두나무 테 + 양피지 + 구분선), `initialFocus`.
5. 눈 기준: [`qa/pre-r4/`](../qa/pre-r4/)(이전 나무 전투 — 되살릴 느낌), [`qa/r5-baseline/`](../qa/r5-baseline/)(P2 전 지금 화면). P2 뒤 캡처는 `test-results/r5-k*/`.

## 할 일(체크리스트 ID — 완료 기준은 계획서 §5.2 표)
- **B1** 전장·옆판·문제판을 호두나무 틀 하나로(옛 한 판 구성). 1440·1366은 옛 구성과 같은 덩어리, 폰은 R4 풀블리드. `frame.lg` 원화는 표시 폭 24px 이상에서만(얇으면 `frame.sm`). 바깥 여백이 바뀌면 레이아웃 계약(`docs/contracts/product.defaults.v0.5.json` `layout`)과 `tests/e2e/layout.spec.ts` 변경을 **메인에 요청**한다(둘 다 메인 소유).
- **B2** 정답 보상 미리보기 "+N 골드"(`view.stakes.correctGold`). 오답 −점수 칩은 되살리지 않는다.
- **B3** 오답 뒤 "왜 그 보기가 아닌지" 한 줄(`chosenRationale`) + 잠금 중 "해설을 읽어 주세요 · N초".
- **B4** 복습 문제 배지(책 아이콘 + "복습", `view.question.isReview`).
- **B5** 준비 바: 다음 적 칩 + 놋쇠 「전투 시작」(`primary lg`) + 타워 1개 이상일 때 은은한 대기 움직임(무한 반복 1개, 움직임 줄이기면 정지).
- **B6** 연속 정답 보너스 켜짐 강조(칸 묶음에 호박 면 + 남은 초), 켜지는 순간 1회 팝.
- **B7** 보스 웨이브 띠를 붉은 면 + 밝은 글자로.
- **B8** 웨이브 생존·보스 처치 보상에 금화 비행(`CoinFlight.tsx`) 재사용(토스트 부활 아님). C6 중 금화 비행도 A 몫.
- **B9** 진화 카드: 막대 + 바뀌는 수치 칩 2개(줄어드는 능력은 붉은 윤곽).
- **B10** 정답 키는 떠오르고(바닥 6px), 오답 키는 눌린 채(바닥 0). **transform 금지**(수직선 잠금 Δ≤0.5px).
- **B11** 첫 판 'place' 안내를 전장 쪽지로(조작 옆 한 문장), 고르거나 끌면 숨김.
- **B12** 잠긴 칸에 풀리는 웨이브 숫자 배지(터치에서도 보이게).
- **B13** 새 타워 창 카드 사이 ←→ 이동(키보드 e2e).
- **B14** '모르겠어요' 키 옆 판돈 영역 정리(+N 골드 + 모르겠어요), 문제판 오른쪽 빈 공간 0.
- **B15** 일시정지 창을 kit `Modal`로 + "잠시 멈췄어요" 한 줄 + Segmented·Toggle(R4). 지금은 `Card`라 창 재질이 두 벌로 보인다.

## P2에서 넘겨받은 것(v4 부록 B)
- **답안 키**: 지금 키 원화(알약)로 그려져 2~3줄 키에서 끝이 길쭉하고, 휴대폰에서 번호 '1'이 왼쪽 리벳에 붙는다. 답안 키는 원화를 끄고 B10(바닥 0·4·6px)으로 그리거나 `groove` 안 양피지 카드로 그린다. 문제판 누름 이동은 끈다.
- **아주 크게 넘침**: 1366×650 아주 크게 첫 준비(`01-first-prep-cb`)가 세로 4px 넘친다(그 판 문제·보기 각 2줄). 아주 크게로 다시 재고, 모자라면 메인에 계약 변경을 요청한다.
- `ChoiceCard`(`src/ui/game/ChoiceCard.*`)는 P2 동안 K가 옷을 입혔다(옛 징집 카드 모양). 이제 A 소유다.
- 화면 CSS의 반복 움직임은 OS `prefers-reduced-motion`과 `<html data-motion="minimal">` 둘 다를 따르게 한다.

## 그림·원화
- 원화: `public/assets/ui/oak/*.webp` 12장. 쓰는 법은 [`asset-source/renewal/ART-OAK1/manifest.json`](../../../asset-source/renewal/ART-OAK1/manifest.json)·`preview.html`. `board`는 메인이 밝기를 보정했다(`a1e0adb`). 판 위 글은 `--ink`만.
- 원화 파일은 만들거나 고치지 않는다. 새 그림이 필요하면 메인에 요청한다(Antigravity가 그린다).

## 소유(이 경로만 고친다)
- `src/ui/game/**`(PauseOverlay·ChoiceCard·CoinFlight 포함), `src/application/view.ts`·`RunController.ts`(B8), `tests/e2e/play.spec.ts`, `tests/e2e/stage-animation.spec.ts`, 전투 단위 시험(`tests/unit/` 중 전투 화면 시험, 새로 만들면 `tests/unit/r5-battle*.test.ts`).
- 새 문구는 `src/ui/game/gameCopy.ts`에 둔다(`copy.ts`는 메인 소유). `tests/unit/terms.test.ts` 금지어를 지킨다(평이한 말: 보스·골드·연속 정답 보너스·새 타워 …).
- **고치지 않는 것**: `src/ui/kit/**`·`global.css`·`icons/**`(부품 변경이 필요하면 메인에 요청 — 메인이 세션 K에 넘긴다), `layout.spec.ts`·계약 JSON·`copy.ts`·`docs/**`(메인), 다른 화면 파일(B·C).

## 검사(자기 범위만, verification-budget)
- 단위: `npx vitest run <내 시험> tests/unit/ui tests/unit/terms.test.ts`
- e2e: `E2E_PORT=5411 npx playwright test tests/e2e/play.spec.ts tests/e2e/stage-animation.spec.ts tests/e2e/layout.spec.ts --output test-results/e2e-a` (`layout.spec.ts`는 돌리기만, 고치지 않는다)
- 캡처: `node tools/qa/scenes.mjs --out test-results/r5-a --scenes 01-first-prep,02,03,04,04b,06a,06b,10a,11 --port 5411 --no-montage`, 글자 크기 `--font large`·`--font xlarge`도 한 번씩. `qa/pre-r4/`·`qa/r5-baseline/`과 나란히 본다.
- 커밋 전 `npx tsc --noEmit -p tsconfig.json`과 `npm run lint`.
- 같은 실패 3번이면 멈추고 시도·가설·증거를 보고한다. 기대값·단언을 바꿔 통과시키지 않는다.

## 관문(P3 A 완료 기준)
- B1~B15 각 완료 기준(계획서 §5.2).
- 13px·44px 하한, 가로 넘침 0, 1366×650 전투 세로 스크롤 0 — 글자 크기 3단계 모두.
- 그라데이션·블러·글자 그림자 0, 무한 반복 화면당 1개 이하, 움직임 줄이기에서 0, 답안 키 수직선 잠금 Δ≤0.5px.
- 흰 종이 카드 0, 창 재질 한 벌(일시정지도 kit `Modal`).
- 위 검사 통과.

## 커밋·보고
- 작업 단위마다 `git commit --only -- <내 경로>`(새 파일은 먼저 `git add -- <파일>`, 삭제는 `git rm -- <파일>`). 시작할 때와 커밋 전 `git status`로 남의 변경을 확인하고 건드리지 않는다. 메시지에 체크리스트 ID(예: `feat(ui): R5 B10 답안 키 물성`)와 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **push는 하지 않는다.**
- 끝나면 보고: 커밋 SHA 목록, ID별 완료·남은 것, 검사 결과(실행/재사용/미실행), 캡처 비교에서 본 차이, 메인에 요청할 것(계약·`layout.spec`·kit·문구·그림).

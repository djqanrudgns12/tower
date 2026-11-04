# R5 세션 B 브리프 — P3 사용 설명서

메인 세션(총괄)이 쓴다. 세션 B는 이 문서를 먼저 끝까지 읽고 시작한다. 사용자에게 보이는 출력과 보고는 한국어로 쓴다. 같은 폴더에서 세션 A(전투)·C(창·결과·노트·홈)가 동시에 일한다.

## 먼저 읽을 것
1. [`AGENTS.md`](../../../AGENTS.md)·[`CLAUDE.md`](../../../CLAUDE.md): 단일 폴더 규칙. worktree·폴더 복사 금지. `git add -A`·`stash`·`reset`·`checkout -- .`·`restore .`·`clean` 금지.
2. [R5 계획서](../prd-r5-oak-v2.md) §0~§4, **§5.3(G1~G9)**, §6 P3, §7(소유표·커밋·검사 예산), §8 관문.
3. [UI 규정 v4](../ui-rules-v4.md): **구현 기준.** 머리의 총괄 결정 1~14, §3 재질, §4 부품, §5.3 글자 3층(설명서 본문은 읽는 글 `--read-font`), §6 용어, §7.1 밀도, §7.3 움직임.
4. P2 결과(세션 K, `47f76fb`·`172aec8`·`ef2b5e8`): kit 부품이 참나무 옷을 입었다. 창은 kit `Modal`(호두나무 테 + 양피지 + 구분선), 키는 원화(`::before`).
5. 이전 설명서: `git show 2db26f4:src/ui/screens/guide/GuideStageCanvas.tsx`(388줄), `git show 2db26f4:src/ui/screens/guide/GuideVisualStages.tsx`(329줄), 그때의 `GuideScreen.tsx`. 눈 기준: [`qa/pre-r4/`](../qa/pre-r4/)의 설명서 4장, [`qa/r5-baseline/`](../qa/r5-baseline/) `12a-guide*`.

## 할 일(체크리스트 ID — 완료 기준은 계획서 §5.3 표)
- **G1** 첫 화면은 R4 그림 카드 격자(목차). 카드를 누르면 옛 장 화면이 열리고 ‹ 이전 장 · n/N · 다음 장 ›와 ←→·Home·End 이동. 1366×650에서 장 화면 무스크롤.
- **G2** 1장 시연: 실제 그림 수비 캔버스(준비·설치·전투·회복 4박 고정 버튼, 정답 +N골드 배지). 옛 `GuideStageCanvas`를 되살려 kit 위로 옮긴다. 움직임 '정지'·고대비 반영, 무한 반복 1개.
- **G3** 2장 시연: 정답·오답·모르겠어요·연속 정답 버튼 → 골드·점수 변화와 성문 메모, 2.4초 자동 순환. 수치는 balance 0.10 계약에서 계산(`buildQuizOutcomeSpecs`). 단위 시험으로 계약 값과 일치.
- **G4** 3장 시연: 타워 3종 사거리(밝은 흙길), 비용·사거리 배지, A/B 진화 요약. 시작 4종 중심.
- **G5** 4장 시연: 난이도별 성문 HP·정답 골드·어휘 범위 판독 + 1~4 키캡이 실제 키에 반응. **같은 판독 한 줄을 새 게임 창(C의 N3)도 쓴다** — 판독 함수는 `src/ui/screens/guide/`에 두고 export해 C가 가져다 쓰게 한다. 이름과 위치를 정하면 바로 메인에 알린다(메인이 C에 전달).
- **G6** 5장 새로: 새 타워 고르기(3·6·9·12웨이브), 보물(10웨이브~), 적 특성, 최고 기록, 오답 노트, 끌어 놓기·3초 되돌리기. 장 수 5. 그림 1장은 Antigravity가 그린다(ART-OAK2, 메인이 요청). 그림이 오기 전에는 자리만 잡는다.
- **G7** 타워 상성: 계약 `strongVs`에서 자동 생성 + 적 특성 아이콘(20종 기준).
- **G8** 장 머리띠("제N장 · 제목" + 한 줄 요지), 행 아이콘·단계 배지. 행 3개·행당 95자 이하·느낌표·이모지·영문 0(G05·G15).
- **G9** 문구를 지금 규칙으로(이어하기·저장 행 삭제, v4 §6 용어). `tests/unit/guide.test.ts` 통과.
- **G14 반경 좁히기**: `tests/e2e/guide.spec.ts` G14 허용 반경을 0/4/8/999px로 좁힌다(v4 총괄 결정 2). 지금은 전환용 0/4/8/14/999px.

## 시험 바꾸기
- `tests/e2e/guide.spec.ts`는 B 소유다. G1(목차 → 장 화면)으로 "카드 5장·탭 0개" 같은 단언이 바뀌면 새 구조에 맞는 단언을 **같이** 쓴다. 기대값을 지워서 통과시키지 않는다. 바꾼 단언은 보고에 한 줄씩 적는다.
- `tests/e2e/play.spec.ts`의 "사용 설명서 완독 후 새 게임 시작"(A 소유)이 설명서 구조에 닿으면 메인에 알린다.
- `tests/e2e/layout.spec.ts`(메인 소유)의 "13px·44px 하한: … 사용 설명서(접힘·펼침)" 단언이 바뀌어야 하면 메인에 요청한다.

## 그림·원화
- 재질 원화: `public/assets/ui/oak/*.webp`. 쓰는 법은 [`asset-source/renewal/ART-OAK1/manifest.json`](../../../asset-source/renewal/ART-OAK1/manifest.json)·`preview.html`. 원화 파일은 만들거나 고치지 않는다.
- 설명서 그림: `public/assets/guide/*.png`(지금 4장). 5장 그림(G6)은 메인이 Antigravity에 맡겨 `public/assets/guide/`로 넣어 준다.
- 캔버스 스프라이트는 홈 미니 전장과 같은 `src/ui/screens/home/canvasAssets`를 읽기만 한다(C 소유, 고치지 않는다).

## 소유(이 경로만 고친다)
- `src/ui/screens/GuideScreen.tsx`·`GuideScreen.module.css`, `src/ui/screens/guide/**`, `public/assets/guide/**`(메인이 넣어 준 그림 연결만), `tests/unit/guide.test.ts`, `tests/e2e/guide.spec.ts`.
- 새 문구는 `src/ui/screens/guide/guideCopy.ts` 또는 `guideModel.ts`에 둔다(`copy.ts`는 메인 소유). `tests/unit/terms.test.ts` 금지어를 지킨다.
- **고치지 않는 것**: `src/ui/kit/**`·`global.css`·`icons/**`(부품 변경이 필요하면 메인에 요청 — 메인이 세션 K에 넘긴다), `layout.spec.ts`·계약 JSON·`copy.ts`·`docs/**`(메인), 다른 화면 파일(A·C).

## 검사(자기 범위만, verification-budget)
- 단위: `npx vitest run tests/unit/guide.test.ts tests/unit/ui tests/unit/terms.test.ts` (+ 새로 쓴 시험)
- e2e: `E2E_PORT=5421 npx playwright test tests/e2e/guide.spec.ts --output test-results/e2e-b`
- 캡처: `node tools/qa/scenes.mjs --out test-results/r5-b --scenes 12a --port 5421 --no-montage`, 글자 크기 `--font large`·`--font xlarge`도 한 번씩. 장 화면을 여는 장면이 필요하면 메인에 요청한다(`tools/qa/**`는 메인 소유).
- 커밋 전 `npx tsc --noEmit -p tsconfig.json`과 `npm run lint`.
- 같은 실패 3번이면 멈추고 시도·가설·증거를 보고한다. 기대값·단언을 약하게 바꿔 통과시키지 않는다.

## 관문(P3 B 완료 기준)
- G1~G9 각 완료 기준(계획서 §5.3), G14 반경 0/4/8/999px.
- 13px·44px 하한, 가로 넘침 0, 1366×650 장 화면 무스크롤 — 글자 크기 3단계 모두.
- 그라데이션·블러·글자 그림자 0, 무한 반복 화면당 1개 이하, 움직임 줄이기·고대비에서 정지.
- 흰 종이 카드 0, 창 재질 한 벌(kit `Modal`).
- 위 검사 통과.

## 커밋·보고
- 작업 단위마다 `git commit --only -- <내 경로>`(새 파일은 먼저 `git add -- <파일>`, 삭제는 `git rm -- <파일>`). 시작할 때와 커밋 전 `git status`로 남의 변경을 확인하고 건드리지 않는다. 메시지에 체크리스트 ID(예: `feat(guide): R5 G2 1장 수비 시연 복원`)와 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **push는 하지 않는다.**
- 끝나면 보고: 커밋 SHA 목록, ID별 완료·남은 것, 바꾼 시험 단언, 검사 결과(실행/재사용/미실행), 캡처 비교에서 본 차이, 메인에 요청할 것(그림·`layout.spec`·kit·QA 장면).

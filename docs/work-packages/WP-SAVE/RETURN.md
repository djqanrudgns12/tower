STATUS: DONE

# WP-SAVE 반환 — 저장·이어하기(PRD §14)와 첫 연습 판(§12.2) 복구

- 작업 폴더: `/Users/bodyking/Desktop/vibecoding/tower-wp/WP-SAVE` (기준 3cf3229, 커밋하지 않음)
- 구현: Claude 서브에이전트(WP-SAVE 담당). 다른 에이전트에 맡긴 조각 없음.
- 바꾼 파일은 모두 `jobs.json` WP-SAVE owns 안이다.
  - `src/application/RunController.ts`, `src/application/session.ts`, `src/ui/App.tsx`, `src/ui/screens/HomeScreen.tsx`, `src/ui/screens/home/LaunchDeck.tsx`, `src/ui/game/GameScreen.tsx`, `src/ui/game/PauseOverlay.tsx`, `src/ui/screens/guide/guideModel.ts`
  - `tests/unit/guide.test.ts`, `tests/unit/save/run-controller-save.test.ts`(새), `tests/unit/save/session-resume.test.ts`(새), `tests/e2e/play.spec.ts`, `tests/e2e/home.spec.ts`
- `db.ts`·`ownership.ts`·`lobbyClient.ts`·`runRecord.ts`·`view.ts`·`copy.ts`·도메인은 고치지 않았다.

## 항목별 결과

### 1. RunController(§14.1) — 완료
근거: `src/application/RunController.ts`

- **저장 시점**
  - 명령 직후: `apply()`에서 resume을 뺀 모든 명령 뒤에 저장한다. 채점·건너뛰기·다음·설치·강화·판매·전투 시작·정지가 여기에 든다.
  - 틱 진행: `step()`에서 `phase`·`waveComplete`·`answered` 사건이 나면 바로 저장한다.
  - 전투 중: `PERIODIC_SAVE_TICKS = 60`마다 저장한다.
  - 숨김·`pagehide`: 정지 저장에 strict 저장을 더 요청한다.
- **직렬화**
  - `requestSave` → `drain` 한 갈래로만 쓴다.
  - 쓰는 동안 들어온 요청은 `dirty`로 합쳐, 끝난 뒤 최신 상태 하나만 쓴다(strict 요청은 OR로 남긴다).
  - 79754f0의 재귀 `flush`가 microtask 순서에 기대던 부분을 반복문으로 바꿨다.
- **실패 정지**
  - 쓰기가 실패하면 순번을 올리지 않는다.
  - `saveStatus='error'`로 두고 `halt('STORAGE')`로 정지한다. 같은 틱에 쌓인 명령은 취소하고 메모리 상태는 그대로 둔다.
  - STORAGE 정지 중에는 자동 저장을 멈춘다.
- **재시도 `retrySave(): Promise<boolean>`**
  - 같은 순번으로 메모리 최신 상태를 다시 쓴다. 채점·골드·회복은 다시 실행하지 않는다.
  - 성공하면 STORAGE를 풀고 USER 정지를 남긴다. 학생이 ‘계속’을 눌러야 다시 흐른다(§14 "자동 복구 후에도 수동 재개").
- **`saveAndExit()`**: USER로 정지한 뒤 strict 저장을 요청하고, 합쳐진 쓰기까지 모두 끝나야 true를 돌려준다. 실패하면 false와 STORAGE 정지다.
- **종료 순서**
  - `finish()`는 진행 중인 쓰기를 `settle()`로 먼저 기다린다.
  - 그다음 `buildRunRecord` → `addRecord` → `clearSnapshot` → `queueAndFlushCompletedRun` 순서다(5b5977a 경로 유지).
  - 늦게 끝난 쓰기가 끝난 판의 스냅샷을 되살리지 않는다. GAME_OVER 뒤에는 저장하지 않는다.
- **`dispose()`**: 진행 중인 쓰기가 끝난 뒤 Web Lock을 놓는다. 다음 판의 저장과 섞이지 않게 하기 위해서다.
- **옵션·공개 API**
  - 생성자 옵션은 기존 `{ saveSeq?, ownership, recordOnFinish? }`를 그대로 받고 `autosave?`를 더했다.
  - `persist`는 소유권이 있고 `autosave`가 켜졌을 때만 참이다.
  - 연습 판(`recordOnFinish:false`, 소유권 없음)은 저장·기록이 없다.
  - 새 공개 API: `saveAndExit`, `retrySave`, `settle`, `savedSeq`, `PERIODIC_SAVE_TICKS`.

### 2. session.ts(§14.2) — 완료
근거: `src/application/session.ts`

- **`loadSaved()`·`LoadResult`**를 내보낸다.
- **`resumeBlocker(saved)`**: 아래 중 하나라도 다르면 이어하지 않고 이유를 돌려준다.
  - Web Locks 지원 여부
  - `v`(RUN_STATE_VERSION)
  - `rulesVersion`·`balanceVersion`·`mapVersion`
  - 은행 `bankId`·`bankVersion`
  - 문항 철회 여부
- **`resumeRun`**
  - 지난 세션의 정지 이유(USER·HIDDEN·STORAGE 등)는 버리고 `['RESTORED']`로 시작한다. NUMERIC_LIMIT만 남긴다.
  - 불러온 `seq`를 이어 받아 슬롯을 교대한다.
- **Web Locks가 없을 때**
  - `saveSupported()=false`면 홈이 시작 전에 `NO_SAVE_NOTICE`("이 브라우저에서는 저장되지 않아요. 창을 닫으면 처음부터 해야 해요.")를 보이고 이어하기를 끈다.
  - 게임 안 `warning`에도 같은 문구가 나온다.
  - 이때 판은 저장하지 않고, 개인 기록만 끝날 때 남긴다.
- **`startNewRun`**
  - 이제 `async`다.
  - 저장된 판이 있으면 `replaceSaved: true` 없이는 거부한다. 조용히 지우지 않는다.
  - 학생이 홈에서 새 게임을 고른 경우(App)에만 `replaceSaved: true`로 부른다.
  - 기존 저장은 Web Lock을 얻은 **뒤**에만 비운다. 3cf3229는 잠금 전에 지워서, 다른 탭이 쥔 판의 저장을 지울 수 있었다.
  - 비우기에 실패하면 저장 차단으로 보고 자동 저장 없이 연다. `NO_SAVE_NOTICE`도 함께 보인다(§16.2).
- **`reportRunStarted` 호출**은 유지했다.

### 3. 홈(§12.2) — 완료
근거: `src/ui/App.tsx`, `src/ui/screens/HomeScreen.tsx`, `src/ui/screens/home/LaunchDeck.tsx`

- **이어하기 우선**
  - 활성 저장이 있으면 LaunchDeck의 CTA 묶음 맨 위에 `이어하기 · 별명 · N웨이브`(primaryCta)를 둔다.
  - 이때 ‘새 게임’은 secondaryCta로 내리고 아래에 "새 게임을 시작하면 저장된 판은 이어할 수 없어요."를 붙인다(`aria-describedby`).
- **이어할 수 없는 저장**: 이어하기 단추 대신 이유 한 줄만 보이고, 저장을 지우지 않는다.
  - 손상: "저장된 판이 손상되어 이어할 수 없어요…"
  - 버전 변경: "게임이 바뀌어서 저장된 판은 이어할 수 없어요…"
  - 저장 불가 브라우저: `NO_SAVE_NOTICE`
- **연습 단추**
  - 처음 온 학생(`practiceSeen=false`이고 이어할 판 없음)에게는 ‘처음이라면 연습부터’를 보인다.
  - 그 밖에는 ‘연습하기’다. 단추는 새 게임 아래 secondaryCta로 넣었다.
  - 로비 배치와 `home.module.css`는 그대로이고, 기존 클래스만 썼다.
- **연습 판의 성격**: 기록·스냅샷·소유권·`reportRunStarted`가 없고, 고정 시드를 쓴다. 게임 안 ‘연습 건너뛰기’로 홈에 돌아온다.
- **연습 뒤 ‘새 게임 시작’**: 이어할 판이 있으면 새 게임 창을 바로 열지 않고 홈에서 고르게 한다. 연습 뒤에 저장이 바뀌는 일을 막기 위해서다.

### 4. 일시정지(PauseOverlay) — 완료
근거: `src/ui/game/PauseOverlay.tsx`, `src/ui/game/GameScreen.tsx`

- **일반 정지**: 계속하기·글자 크기·소리·저장하고 나가기(`controller.persist`일 때)·이번 판 끝내기를 둔다.
- **저장 후 나가기 실패**: "아직 저장되지 않았어요. 다시 눌러 주세요."를 보인다.
- **STORAGE 정지**
  - ‘다시 저장하기’를 두고, 재시도가 실패하면 "아직 저장되지 않았어요. 잠시 뒤 다시 눌러 주세요."를 보인다.
  - ‘저장하지 않고 나가기’와 "마지막으로 저장된 곳까지만 이어할 수 있어요" 안내를 둔다.
- **포커스**: 정지층이 열린 채 STORAGE로 바뀌면 누른 단추가 사라진다. 이때 새 첫 단추로 포커스를 옮긴다.
- **우회 캐스트 제거**: GameScreen의 `'saveAndExit' in controller` 캐스트를 지웠다.
  - 이제 `controller.saveAndExit()`과 `controller.retrySave()`를 직접 부른다.
  - `onExit`는 `'saved' | 'over' | 'abandon'`을 받는다.

### 5. GameScreen 키보드 — 완료
근거: `src/ui/game/GameScreen.tsx`

- **전역 Enter 제거**: 전역 Enter → `onStart` 리스너를 지웠다. 전투는 ‘전투 시작’ 단추로만 시작하고, 캡션은 ‘출격 준비함’으로 바꿨다.
- **`refocus`**: 포커스가 body로 떨어졌을 때만 동작한다.
  - 설치·강화·진화·판매 확인 전환 뒤에는 관리 패널 묶음(`role="group"`, 이름 ‘선택한 칸과 타워 정보’, `tabIndex=-1`)으로 옮긴다.
  - 판매·선택 해제·S 모드 설치 뒤에는 ‘전투 시작’으로 옮긴다.
  - 둘 다 없으면 전장으로 옮긴다.
- **타워 없이 시작 확인 상자**: 열릴 때 ‘취소’로 포커스를 옮긴다(Enter를 반복해 눌러도 바로 시작하지 않게). 취소하면 ‘전투 시작’으로 돌아간다.

### 6. App.tsx — 완료
근거: `src/ui/App.tsx`

- 렌더 중 reducedMotion·motionMode를 `full`로 덮어쓰던 두 곳을 지웠다. `settings` 파생과 `update` 안의 `base` 계산이다.
- 이제 `update`는 `normalizeSettings(prev, patch)`만 쓴다.
- `loadSettings` 안의 강제 `full`(`persistence/settings.ts`)은 WP-NET 소유라 손대지 않았다.

### 7. 사용 설명서 문구 — 완료
근거: `src/ui/screens/guide/guideModel.ts`, `tests/unit/guide.test.ts`

- 4장의 두 행을 바꿨다. 두 행 모두 95자 이내다.
  - ‘연습·조작 / 연습 판과 단축키’: 처음이라면 홈의 짧은 연습 판으로 먼저 익혀요… (63자)
  - ‘정지·저장 / 저장하고 이어하기’: ‘저장하고 나가기’ 뒤 홈의 ‘이어하기’로 그 자리부터 하고, ‘이번 판 끝내기’로 점수를 기록해요 (79자)
- 연습 판 수치는 하드코딩하지 않았다.
- G03은 폐기 문구 금지에서 필수 문구 검사로 바꿨다. `저장하고 나가기`·`이어하기`·`연습 판`을 포함해야 하고, `이번 판 끝내기` 검사는 G05에 그대로 있다.
- 같은 취지로 `home.spec.ts` G01~G16의 `not.toContainText(/저장하고 나가기|이어하/)` 두 줄을 지우고, 4장에 필수 문구 단언 3개를 넣었다.
- GuideScreen(소유 밖)의 ‘연습 판 해 보기’ 단추는 되살리지 않았다. 설명서 화면 단추 없음 단언도 그대로 두었다.

### 8. 시험 — 완료

**되살린 e2e** (`tests/e2e/play.spec.ts`, 79754f0 기준을 지금 화면에 맞춤)
- `저장하고 나가기 → 새로고침 → 이어하기: 정지 상태로 같은 골드·성문·타워에서 이어진다(PRD §14)`
- `첫 연습 판: 문제 1개 → 궁수 설치 → 적 3마리 → 회복, 안내는 조작 옆 한 문장(PRD §12.2)`
  - 지금 화면에 맞춰 추가로 확인하는 것: 별명 칸 포커스 안내, ‘연습하기’로 바뀜, IDB `records`·`run` 0건, ‘연습 건너뛰기’.

**새 e2e**
- `자동 저장: 저장하고 나가기 없이 새로고침해도 마지막 저장에서 이어 한다(PRD §14.1)`
- `키보드: 설치·판매로 단추가 사라져도 포커스가 body로 떨어지지 않고, Enter가 전투를 몰래 시작하지 않는다(PRD §12.4)`
- `home.spec.ts` `L02·L03: 활성 저장이 있으면 이어하기를 새 게임 앞에 두고, 손상 저장은 조용히 지우지 않고 복구 안내를 한다(PRD §12.2, §14.1)`
  - 이어하기 단추가 새 게임 위에 오는지, axe 위반이 0건인지 본다.
  - 두 슬롯 해시를 깨뜨린 뒤 복구 안내가 뜨는지, 이어하기 단추가 없는지, 슬롯이 남아 있는지 본다.

**고친 e2e**
- `play.spec.ts`: ‘일시정지 및 새로고침: 이어하기·저장하고 나가기 없이…’(이어하기 0개 단언)를 지우고, 위의 되살린 시험으로 바꿨다. 설명서 시험은 제목만 다듬었다.
- `home.spec.ts` L01: ‘연습 권유 0개’ 대신, 처음 온 학생에게 ‘처음이라면 연습부터’가 보이고 저장이 없으니 이어하기는 0개인지 확인한다.
- `home.spec.ts` L09: 상관없는 ‘이어하기 0개’ 단언을 지웠다.

**새 단위 시험** `tests/unit/save/run-controller-save.test.ts` (fake-indexeddb + `writeSnapshot` 감싸개, 9개)
- 채점 직후 저장·슬롯 교대·순번 증가, 재개는 저장하지 않음
- 쓰기 하나씩(동시 최대 1)·밀린 요청 세 개를 최신 상태 하나로 합침
- 실패 → 메모리 보존 STORAGE 정지, 정지 중 자동 저장·명령·계속·저장 후 나가기 거부
- 재시도는 같은 순번, 재실패 시 순번 유지, 성공 시 수동 재개 대기, 골드·점수 재지급 없음
- 저장 후 나가기는 밀린 쓰기 완료 후에만 true, 실패 시 false+STORAGE
- 종료 순서: `writeSnapshot` < `addRecord` < `clearSnapshot` < `queueAndFlushCompletedRun`, 늦은 쓰기가 스냅샷을 되살리지 않음
- 소유권은 쓰기 완료 뒤 해제
- 소유권 없음·자동 저장 끔이면 쓰지 않음(연습 판 기록 0)
- 전투 중 60틱 주기 저장

**새 단위 시험** `tests/unit/save/session-resume.test.ts` (10개)
- 같은 상태·RESTORED로 이어하기, 다음 순번 저장
- 지난 정지 이유 버림
- 규칙·밸런스·맵·문제은행 버전 변경 시 거부하고 저장을 보존(4개)
- `startNewRun`이 저장을 조용히 지우지 않고, `replaceSaved`일 때만 바꾸며, 새 판 첫 저장이 seq 1
- 다른 창이 잠금을 쥐면 거부하고 저장 보존
- Web Locks가 없으면 `NO_SAVE_NOTICE`·이어하기 거부·저장 안 함
- 연습 판은 기록·저장을 남기지 않음

**`g2.test.ts` 저장 왕복**: 고치지 않았고, 아래 `npm test`에서 통과했다.

## 검사 실제 출력 요약(같은 작업 트리, 최종 실행)

| 검사 | 결과 |
|---|---|
| `npm run typecheck` | exit 0. `tsc -p tsconfig.json && tsc -p tsconfig.test.json`, 오류 0 |
| `npm run lint` | exit 0. `eslint .`, 오류 0 |
| `npm test` | exit 0. `Test Files 32 passed (32)`, `Tests 528 passed (528)`. g2·guide·save 포함 |
| e2e: `E2E_PORT=5181 npx playwright test tests/e2e/play.spec.ts tests/e2e/home.spec.ts --workers=1` | 실행함. `17 passed (3.7m)`. home 5개, play 12개, 실패·flaky 0 |

- e2e는 5181 포트가 비어 있는 것을 확인한 뒤 Playwright가 직접 띄운 vite로 돌렸다. 끝난 뒤 포트는 닫혔다.
- 실행 로그에 pretendard woff2 경로가 "Vite serving allow list 밖"이라는 경고가 반복된다. `node_modules` 심볼릭 링크가 본 저장소를 가리켜서 생기는 환경 경고이고, 시험 결과와는 무관하다.
- 같은 실패가 3회 반복된 경우는 없었다. 단위 시험 1건(주기 저장 시험의 반복 조건 오류)을 1회 고쳤다.

## 수합 때 볼 점

- **WP-NET과의 경계**
  - `RunController`는 `queueAndFlushCompletedRun(record, playerId)`, `session`은 `reportRunStarted(runId, playerId)`를 그대로 부른다.
  - WP-NET이 `p_player_id` 인자를 지우면 수합 때 두 호출의 인자만 맞추면 된다.
- **WP-UI와의 경계**
  - GameScreen에서 관리 패널 래퍼에 `tabIndex=-1`·`role="group"`·`aria-label`을 붙였고, 전투 시작·확인 취소 단추에 ref를 달았다.
  - ManagementPanel·CSS는 건드리지 않았다.
- **스냅샷의 STORAGE**: 재시도로 쓴 스냅샷의 `pause`에는 STORAGE가 남는다. 이어하기 때 `resumeRun`이 정리하므로 막히지 않는다.
- **이번 패키지 밖(79754f0에도 없음)**
  - PRD §14의 `lastCommandSeq`·run generation 기록
  - `RENDER_WAIT`의 "저장하고 나간 뒤 다시 열어 주세요" 문구 복원(`copy.ts`)
  - 연습 판 정지 화면의 ‘이번 판 끝내기’ 확인 문구("점수가 기록돼요")는 연습에서도 그대로 보인다.
- **1366×650 화면**: 이어하기가 있으면 왼쪽 열이 길어져 문서가 세로로 스크롤된다(§12.7 단일 문서 스크롤 허용 범위). 저장이 없을 때 ‘새 게임’이 첫 화면 안에 드는지는 L20에서 통과했다.

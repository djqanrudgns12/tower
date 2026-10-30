---
jobId: WP-SAVE
owner: Claude 서브에이전트(총괄 지휘)
issuedBy: 총괄 Claude Opus 5.5
issuedAt: 2026-10-30
baseCommit: 작업 폴더의 HEAD(자동 기록: .orchestrate/state/WP-SAVE.json)
---

# WP-SAVE — 저장·이어하기와 첫 연습 판을 PRD대로 되살린다

5b5977a에서 PRD 근거 없이 다음이 빠졌다.
- 자동 저장(2슬롯 스냅샷)
- 저장 후 나가기, 저장 실패 재시도
- 이어하기(`resumeRun`)
- 첫 연습 판 진입
- 브라우저 저장 불가 안내

PRD v0.5는 그대로 이것들을 요구한다.
- §14.1 저장 시점·직렬화·실패 정지
- §14.2 버전 고정 이어하기
- §12.2 홈 "활성 저장 있으면 이어하기 우선"과 최초 연습
- §3.6 재개는 정지 상태로 시작
- §16.2 실패 표

79754f0의 구현과 시험이 PRD를 만족했으므로, 그것을 기준으로 되살리되 5b5977a에서 새로 생긴 것은 지킨다. 새로 생긴 것은 홈 로비, `recordOnFinish`, 종료 때 공개 제출 큐(`queueAndFlushCompletedRun`), `buildRunRecord`다.

## 바꿀 수 있는 곳

`tools/orchestrate/jobs.json`의 WP-SAVE owns 목록만 쓴다. 다른 작업이 동시에 고치는 파일은 열어 보기만 한다.
- `src/persistence/**`·SettingsModal(WP-NET)
- `src/ui/game/` 나머지·ModalShell·`useLayout`·`view.ts`(WP-UI)
- `src/domain/**`·`src/content/**`(총괄)

`db.ts`의 `writeSnapshot`·`loadSnapshot`·`clearSnapshot`은 그대로 있으니 쓰기만 한다. `RULES_VERSION`은 총괄이 올린다.

## 할 일

1. **RunController(§14.1).**
   - 저장 시점: 중요한 명령(채점·거래·웨이브 전이) 직후, 전투 중 60틱마다, 정지·숨김 때.
   - 쓰기는 하나씩 직렬화하고, 밀린 저장은 최신 하나로 합친다.
   - 실패하면 메모리 최신 상태를 보존한 채 `STORAGE`로 정지하고 같은 순번 재시도를 제공한다.
   - `saveAndExit`은 저장이 끝나야 성공이다.
   - 끝난 판은 `buildRunRecord` → `addRecord` → `clearSnapshot` → 공개 제출 큐 순서를 지킨다.
   - 79754f0의 `RunController.ts`와 비교해 빠진 부분을 되살린다.
2. **session.ts(§14.2).**
   - `resumeRun`은 규칙·밸런스·맵·은행 버전이 같을 때만 이어 하고, `RESTORED` 정지로 시작한다.
   - `loadSaved`를 내보낸다.
   - Web Locks가 없으면 "이 브라우저에서는 저장되지 않아요"를 시작 전에 알린다.
   - `startNewRun`이 기존 스냅샷을 조용히 지우지 않는다. 활성 저장이 있으면 홈에서 이어하기·새 게임 중 고르게 한다.
3. **홈(§12.2).**
   - 활성 저장이 있으면 "이어하기 · 별명 · N웨이브"를 새 게임보다 앞에 둔다.
   - 손상 저장은 복구 안내를 하고, 조용히 초기화하지 않는다.
   - 처음 온 학생에게는 "처음이라면 연습부터", 이미 해 본 학생에게는 "연습하기"를 보인다.
   - 연습은 기록·점수·정규 시드에 영향이 없고 건너뛸 수 있다.
   - 홈 로비 배치(LaunchDeck)를 크게 바꾸지 않고 자리만 넣는다.
4. **일시정지(PauseOverlay).**
   - 계속·글자 크기·소리·저장 후 나가기·이번 판 끝내기를 둔다.
   - 저장 실패 때는 재시도와 "아직 저장되지 않았어요" 안내를 둔다.
   - GameScreen의 `'saveAndExit' in controller` 같은 우회 캐스트는 실제 메서드 호출로 바꾼다.
5. **GameScreen 키보드.**
   - 설치·판매·선택 해제로 누른 버튼이 사라져 포커스가 body로 떨어진 뒤 Enter를 누르면 전투가 시작되는 문제를 고친다.
   - 전역 Enter로 시작하지 말고, 거래 뒤 포커스를 알맞은 요소로 옮긴다(예: 그 칸의 타워 정보나 전투 시작 버튼).
6. **App.tsx.** reducedMotion을 덮어쓰는 중복 코드(약 28~31, 39~42줄)를 지운다. 설정 기본값은 WP-NET이 OS 설정을 따르게 바꾼다.
7. **사용 설명서 문구(guideModel).** 저장·이어하기·연습 판 안내를 PRD대로 되살린다. `tests/unit/guide.test.ts` G03의 "이어하 금지"를 PRD에 맞게 바꾼다(폐기 문구 검사 → 필수 문구 검사).
8. **시험.**
   - 79754f0의 e2e를 지금 화면에 맞게 되살린다.
     - `저장하고 나가기 → 새로고침 → 이어하기`: 정지 상태로 같은 골드·성문·타워에서 이어진다.
     - `첫 연습 판`
   - `home.spec.ts`의 "이어하기 0개" 단언을 고친다.
   - RunController 저장 직렬화·실패 정지·재시도의 단위 시험을 `tests/unit/save/**`에 둔다(fake-indexeddb 사용).
   - `g2.test.ts`의 저장 왕복 시험이 계속 통과하는지 확인한다.

## 검사

- 끝내기 전: `npm run typecheck`, `npm run lint`, `npm test`.
- e2e는 이 작업 전용 포트로 돌린다: `E2E_PORT=5181 npx playwright test tests/e2e/play.spec.ts tests/e2e/home.spec.ts --workers=1`. 다른 포트(5173·5174·5182)는 다른 작업이 쓴다.

## RETURN.md

첫 줄 `STATUS: DONE|PARTIAL`. 항목 1~8의 완료 여부와 근거, 되살린 시험 이름, 검사 출력 요약, e2e 실행 여부를 적는다.

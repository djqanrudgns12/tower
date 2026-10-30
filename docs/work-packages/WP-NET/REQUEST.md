---
jobId: WP-NET
owner: Codex (agent-bridge, 회차당 15분)
issuedBy: 총괄 Claude Opus 5.5
issuedAt: 2026-10-30
baseCommit: 작업 폴더의 HEAD(자동 기록: .orchestrate/state/WP-NET.json)
---

# WP-NET — 공개 기록·로비를 PRD에 맞춘다

근거: 5b5977a 검수(Codex 보안 검수 14건, 총괄 대조). 기준 문서는 `vocabulary_td_prd_v0_5.md` §2.1, §15.1~15.3, §16.3~16.4, §14.1이다. 이 요청서와 PRD가 다르면 PRD가 우선이다.

## 바꿀 수 있는 곳

`jobs.json`의 owns 목록만 쓴다. 다른 작업이 동시에 고치는 파일: `RunController.ts`·`session.ts`·`App.tsx`·`HomeScreen.tsx`·`GameScreen.tsx`(WP-SAVE), `src/ui/game/**` UI·`ModalShell`·`RankingBoard`·`RankingModal`·`product.defaults`(WP-UI), `src/content/**`·`src/domain/**`·`tools/content/**`(총괄). 이 파일들은 열어 보기만 한다.

경계 계약:
- `src/application/runRecord.ts`의 `buildRunRecord(state)`가 끝난 판의 기록을 만든다. `RunController`는 이것만 부른다. 공개 제출에 답안이 필요하면 이 함수와 `RunRecord`(db.ts)를 넓힌다. `RunController` 쪽 호출 모양(`buildRunRecord(s)` → `addRecord(record)` → `queueAndFlushCompletedRun(record, playerId)`)은 바꾸지 않는다.
- 출제 은행은 총괄이 `published`만 싣도록 바꾼다. 그러면 `gradeContent(g).bank`는 공개 은행이거나 `null`이다.

## 할 일(순서대로, 회차마다 PROGRESS.md 갱신)

1. **소유권(§15.3 "닉네임을 인증 수단으로 쓰지 않는다", "서버 발급 세션 또는 익명 인증").**
   - Supabase 익명 인증(`/auth/v1/signup` 익명 가입, 토큰 저장·갱신)을 `src/persistence/auth.ts`에 둔다. 모든 RPC는 `auth.uid()`로 소유자를 정하고, 클라이언트가 보낸 `p_player_id`를 믿지 않는다(인자 삭제).
   - Presence 키는 접속마다 새로 만든 임의 값이다. 영구 `playerId`를 다른 사람에게 보내지 않는다. 여러 탭 집계는 `metas`가 남아 있으면 사람을 지우지 않는다.
   - 새 마이그레이션 파일로 고친다(기존 파일은 이미 적용됐을 수 있으니 고치지 말고 뒤에 덧붙인다).
   - `private_player_hash`의 기본 salt 대체값을 없애고, salt가 없으면 함수가 실패하게 한다.
2. **서버 재채점(§15.2 "클라이언트가 보낸 최종 PT나 정답 횟수만 받아 저장하지 않는다").**
   - `question_keys(bank_version, question_id, revision, correct_option)` 표와, 공개 은행(`src/content/questions/grade[3-6].json`, `status: published`)에서 그 표의 seed SQL을 만드는 `tools/build-question-keys.mjs`를 둔다.
   - 제출 RPC는 판의 문항별 최초 선택(`state.quiz.history`의 questionId·revision·choice·phase·wave)을 받는다. 서버가 정답·오답·모르겠어요 수와 문항 PT를 다시 계산하고, 클라이언트 값과 다르면 거부한다. 처치 PT는 웨이브별 상한(밸런스 계약)으로 범위만 본다. 결과에 `verification_level`을 남긴다.
   - 시작 기록 없이 온 결과, 웨이브 수에 비해 너무 짧은 경과 시간, 중복 runId는 거부한다.
   - 공개 대상은 최소 1웨이브 완료(§15.1). `content_mode`가 `published`가 아니면 기존처럼 건너뛴다.
3. **속도 제한·시각.** `auth.uid()` 기준 분당·일당 상한(방문·시작·제출 모두). 로컬 종료 시각(`endedAt`)과 서버 최초 접수 시각을 따로 저장하고, 주간·일일 구분은 `endedAt`을 접수 시각 기준 7일 안으로 묶어 쓴다. 정렬은 §15.1 그대로.
4. **별명(§2.1).**
   - 클라이언트(`src/contracts/lobby.ts`)와 서버 SQL이 같은 규칙을 쓴다: NFC → NFKC 숫자 정규화(전각 숫자 포함), 2~12자, 제어문자 제거, 전화번호·연속 숫자 6자리 이상·이메일·URL 차단.
   - 별명 입력 옆에 "실명 대신 별명을 써요" 안내가 이미 있는지 확인하고, 없으면 SettingsModal 쪽 공개 기록 안내에 넣는다(홈 입력란은 WP-SAVE 소유라 건드리지 않는다).
5. **동의.**
   - `settings.shareRecords`(기본 `false`)를 두고, 끄면 로비·랭킹·제출이 네트워크를 전혀 쓰지 않는다(내 기기 기록만).
   - SettingsModal에 아이가 읽을 수 있는 한 문장 설명과 켜고 끄는 항목을 둔다. 켤 때 무엇이 공개되는지(별명·학년·난이도·점수·웨이브)를 보여 준다.
   - TelemetryStrip은 꺼져 있으면 "공개 기록 꺼짐"을 보인다.
6. **저장 계층(§14.1, §16.4).**
   - 동기화 큐는 `queuedAt` 오래된 순으로 비운다.
   - 일시 장애(네트워크·5xx·408·429)는 시도 횟수를 올리지 않고 백오프한다. 영구 거부(4xx)만 포기한다.
   - 기록 삭제 실패를 성공으로 안내하지 않는다(SettingsModal).
   - IndexedDB 판 올리기에서 `blocked`면 안내하고, 기존 연결은 `versionchange`에서 닫는다.
   - 같은 별명 기록이 없을 때 남의 최고 기록을 "내 기록"으로 보이지 않는다. 이 기기에서 끝낸 runId로 판별한다.
   - RPC가 실패하고 Presence만 살아 있으면 상태를 `live`로 보이지 않는다.
7. **움직임 줄이기.**
   - `reducedMotion` 기본값은 OS `prefers-reduced-motion`을 따른다.
   - 사용자가 직접 고른 값은 절대 덮어쓰지 않는다. 저장본을 강제로 `full`로 되돌리는 코드는 지운다.
   - Windows 오탐 우려는 "사용자가 설정에서 바꿀 수 있다"로 해결한다.
   - `tests/unit/stage-animation.test.ts`·`tests/e2e/stage-animation.spec.ts`의 "OS가 reduce여도 재생" 기대값을 PRD에 맞게 고친다.
8. **소리.** 설정의 미리듣기 뒤 다른 설정을 바꿔도 배경 음악이 켜지지 않게 한다(`sound.ts`).
9. **오늘의 낱말.**
   - `selectDailySteleCards`·`SteleStudyPanel`이 KST 날짜와 선호 학년으로 정해진 카드를 보이게 한다. 새로고침해도 같아야 한다. "랜덤"은 그 학년 안에서만 고른다.
   - 공개 은행만 쓴다(`gradeContent`).
10. **설정 라디오.** SettingsModal의 radiogroup에 방향키 이동과 roving tabindex를 넣는다.

## 시험

- 위 항목마다 단위 시험을 `tests/unit/net/**` 또는 `tests/unit/lobby.test.ts`에 둔다. 다음 회귀 시험을 꼭 넣는다.
  - 큐 순서
  - 일시 장애에서 버리지 않기
  - 설정 이주에서 사용자 선택 보존
  - 동의 꺼짐에서 `fetch`·`WebSocket` 0회
  - 별명 규칙(전각 숫자·이메일)
  - 재채점 불일치 거부(SQL 함수의 판정 로직을 TS로 같이 두고 그 둘을 시험한다)
- SQL을 실제 Postgres에서 돌릴 수 없으면 RETURN.md에 "SQL 실행 미검증"으로 적는다. 돌릴 수 있는 로컬 도구가 이미 설치돼 있으면 쓰되, 새로 설치하지 않는다.
- 끝내기 전 검사: `npm run typecheck`, `npm run lint`, `npm test`.

## RETURN.md에 쓸 것

첫 줄 `STATUS: DONE|PARTIAL`. 항목 1~10 각각 완료/부분/미완과 근거 파일, 추가한 시험 이름, 검사 출력 요약, SQL 실행 여부, 배포 때 사람이 해야 할 일(익명 인증 켜기, salt 설정, seed 적용 순서).

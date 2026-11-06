# CR-1000 W8 출제·풀이 이력 조사

2026-11-06 조사 · 2026-11-07 전역 이력 저장 부분 구현. 아래 구조 표는 최초 조사 당시 기록이다.
기준: [계획서 §3.7·§6.1](CONTENT_REVIEW_PLAN.md). 구현 순서는 W5 → W6 → W8이며, W5는 자기 학년 승인 1,000문항 이후 루프 정지 지점에서 통합한다.

## 확인한 현재 구조

| 영역 | 현재 동작 | 근거 |
|---|---|---|
| 출제 큐 | `questionIds`를 정렬해 문맥에 넣고, 판의 question RNG로 섞는다. 커서가 끝나면 다시 섞는다 | `src/domain/context.ts:createContext`, `src/domain/quiz.ts:pickQuestion` |
| 반복 제한 | 최근 30문항·8뜻만 기억한다. 풀 부족 시 읽기량 → 오래된 뜻 → 오래된 문항 순으로 완화한다 | `quiz.ts:RECENT_QUESTIONS`, `RECENT_SENSES`, `pickQuestion` |
| 복습 출제 | 준비 문제에서 오답 노트의 다른 문항을 우선한다. 뜻 하나를 복습으로 판당 2회까지 허용한다 | `quiz.ts:pickReview`, `REVIEW_MAX_PER_SENSE=2` |
| 판 내 상태 | 전체 제출 이력 `quiz.history`와 현재 문항, 최근 문항·뜻 배열을 갖는다. 전체 판의 낱말 횟수·마지막 출제 위치·공유 수는 없다 | `src/domain/types.ts:QuizState`, `quiz.ts:createEncounter` |
| 판 시작 입력 | 동기 `startNewRun`에서 오답 노트를 한 번 읽어 `reviewSenses`로 복사한다. 판 안에서는 저장소를 읽지 않는다 | `src/application/session.ts:startNewRun`, `src/domain/run.ts:createRun` |
| 완료 기록 | `RunRecord.answers`에 questionId·revision·선택·단계·웨이브를 담는다. 정답과 오답 모두 포함된다 | `src/application/runRecord.ts:buildRunRecord` |
| 기록 저장 | IndexedDB `vocabulary-td`, DB 버전 3. `records`는 학년 공통 저장소지만 최근 100판만 보존한다. 별도 전역 문항 이력은 없다 | `src/persistence/db.ts:addRecord`, `MAX_RECORDS` |
| 기록 시점 | 끝내기·패배 때 `RunController.finish`에서 저장한다. 연습·미리보기와 창을 닫아 미완료된 판은 저장하지 않는다 | `src/application/RunController.ts:finish` |
| 오답 노트 | localStorage의 뜻별 항목과 bankId로 복습 후보를 고른다. 모든 풀이 문항을 담는 전역 이력이 아니다 | `src/persistence/reviewNote.ts:applyRunToNote`, `reviewSensesForRun` |
| 결정성 | question RNG와 option RNG를 분리한다. 같은 시드·같은 오답 노트 복사본·같은 명령 입력에 대한 재현 시험이 이미 있다 | `src/domain/rng.ts`, `tests/unit/run.test.ts` A18 |

## 새 규칙과 차이

계획서 §3.7은 한 판에서 문항 ID 1회, senseKey 1회, Easy·Normal의 낱말 1회, Hard·Crazy의 낱말 2회(8문항 간격), 위로 공유 문항 30% 이하를 요구한다.

- 최근 이력 배열을 늘리는 것만으로는 해결되지 않는다. 큐 재순환·완화·복습 경로 모두 동일한 판 전체 제한을 적용해야 한다.
- 기존 복습의 뜻당 2회는 새 뜻당 1회 규칙과 충돌한다. 복습 선택의 우선순위는 남길 수 있지만, 이미 이 판에서 나온 뜻은 복습에서도 제외해야 한다.
- `createEncounter`에서 출제 즉시 사용을 기록해야 한다. 제출 뒤 `history`만 세면 아직 제출하지 않은 문항이나 직접 encounter 생성 경로에서 중복이 생길 수 있다.
- 공유 여부는 `q.grade`와 선택한 판의 학년으로 계산해야 한다. W5는 원래 `q.grade`·문항 ID를 유지하므로 받는 은행에 들어갔다고 자기 문항으로 세면 안 된다.
- 현재 `records`는 학년 공통이므로 이를 읽어 시작할 수 있지만, 100판 정리 뒤 오래된 문항을 잊는다. 문항 ID 전체 이력을 유지하려면 완료 기록과 별도인 전역 ID 저장소가 필요하다. 오답 노트를 전용하면 정답 문항을 빠뜨린다.

## 권장 구현 범위

| 묶음 | 파일 | 할 일 |
|---|---|---|
| 판 내 반복 | `src/domain/{quiz,types,run,context}.ts` | 출제된 ID·뜻·낱말 횟수/위치·공유 수를 직렬화 가능한 상태로 두고 일반/복습/재순환 선택 모두에 적용. 공유 기준 학년 전달 |
| 전역 풀이 이력 | `src/persistence/db.ts` 또는 별도 문항 이력 모듈 | questionId 기준 lastSeen 이력. 기존 records.answers에서 초기 이관, 완료 기록과 함께 갱신, 사용자의 로컬 기록 정리 때 함께 정리 |
| 시작 경계 | `src/application/session.ts` 및 W6에서 확정되는 비동기 시작 호출부 | 전역 이력을 판 시작 때 한 번 읽고 정렬된 복사본을 입력. 판 안에서 IndexedDB·현재 시각을 읽지 않음 |
| 완료 경계 | `src/application/{RunController,runRecord}.ts` | 정답·오답·모르겠어요의 제출 문항을 이력에 남김. 기록 실패 시 결과 화면을 막지 않는 기존 동작 유지 |
| 상태 버전 | `src/domain/types.ts`, `src/application/qaRun.ts` 관련 시험 | 새 상태 필드가 들어가면 상태 버전과 규칙 버전의 변경 범위를 검토. 옛 QA 상태를 잘못 해석하지 않음 |

이력은 학년·bankId·revision별 다른 문항으로 분리하지 않고 원래 questionId로 조회한다. 이미 푼 문항은 판 사이에서 **후순위**로 두며 영구 제외하지 않는다. 동일한 시드뿐 아니라 동일한 시작 이력 복사본과 명령 입력에서 재현되는지 확인한다. 이는 기존 오답 노트 복사본을 포함한 A18의 조건과 같다.

구현 전에 확정할 세부 경계는 작은 개발/연습 풀의 소진 처리, 철회 뒤 남은 풀이 부족할 때의 종료·안내 경로, 공유 30% 계산의 초기 몇 문항 처리다. 기존 fallback으로 반복 금지를 조용히 풀거나 문항을 은행에서 삭제하는 방식은 쓰지 않는다. W5·W6 구현 결과를 읽고 이 경계를 정한다.

## 필요한 검증

- `tests/unit/difficulty-quiz.test.ts`: 같은 문항/뜻의 판 전체 재출제 금지, 난이도별 낱말 횟수·간격, 공유 상한. 목표 tier와 읽기량 규칙이 여전히 함께 작동하는지 확인.
- `tests/unit/review-note.test.ts`: 일반·복습 경로를 합쳐 뜻당 1회. 과거 뜻당 2회 시험은 새 명세에 맞는 실패 사례를 먼저 만든 뒤 대체하며 단언을 느슨하게 하지 않음.
- `tests/unit/run.test.ts`, `tests/unit/qa-run.test.ts`: A18 재현, JSON 왕복, 상태 버전 경계.
- `tests/unit/{run-lifetime,lobby}.test.ts`, `tests/unit/net/privacy-storage.test.ts`: 학년 변경 시 전역 ID 재사용, 레거시 answers 없는 기록, 이관·정리·저장 실패·중복 완료 저장.
- persistence 변경 커밋에는 AGENTS 규칙대로 `test:server` 필수. W6 뒤 시작 API를 바꾸면 그 API의 화면 호출부와 관련 e2e 한 개도 확인.

이번 조사는 파일·함수·기존 시험의 정적 확인이다. 실행 결과나 W8 구현 완료로 보고하지 않는다.

## 2026-11-07 구현 경계

전역 저장 부분은 DB v4로 구현했다. `listQuestionHistory()`는 questionId 순으로 `{questionId,lastSeenAt}`를 반환한다. 현재 남은 완료 기록을 이관하고, 이후 완료 기록과 함께 원자적으로 갱신하며, 기록100판 정리와 별개로 보존한다. 사용자 로컬 기록 정리는 이력도 비운다. `startNewRun`과 출제 큐는 아직 연결하지 않았다.

다음 구현은 아래 경계를 사용한다.

- 전역 이력은 판 시작 때 한 번 읽고 정렬된 복사본으로 넣는다. 저장소 오류는 기존 기록 실패 처리처럼 빈 복사본으로 게임을 계속한다. 렌더 중이나 출제 도중DB를 읽지 않는다.
- 일반·복습·큐 재순환 모두 같은 판 전체 제한을 적용한다. 공유30%는 각 출제 시점까지의 비율로 검사하여 처음3문항은 자기 학년, 4번째부터 공유 가능하다.
- Hard/Crazy에서 같은 낱말을 다시 낼 때 두 출제 사이에 다른8문항을 둔다. 뜻은 달라야 하며 낱말 최대2회는 유지한다.
- 남은 문항으로 이 조건을 지킬 수 없으면 반복 제한을 풀지 않고 판을 정상 마친다. 문항 소진은 별도 종료 사유로 다루고 완료 기록을 보존한다. 상태·규칙 판 번호와 결과 화면·이벤트 타입도 함께 연결한다.
- 맵 미리보기는3학년 은행을 다른 맵에서 사용하므로 출제 기준 학년을 맵 표시 학년과 구분한다. 연습·개발 풀도 같은 반복 제한을 지키고 소진 시 정상 종료한다.

저장 부분 검증: 하위 에이전트25시험 통과 결과 재사용, 총괄 게임 수명/랭킹10시험·서버70시험·브라우저H1 1개·시험 타입·범위 린트 직접 통과. 아직 출제 제한의 동작 완료를 뜻하지 않는다.

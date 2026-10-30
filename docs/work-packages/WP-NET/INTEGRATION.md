# 총괄/WP-SAVE 통합 대기 사항 — 6회차

현재 HEAD는 `3cf3229ea96a1eb14b9f3f47db72e34c1af8e136`이다. 이 문서는 다른 담당 소유 파일의 **제안**이며 실제 파일은 변경하지 않았다. `INTEGRATION.patch`는 이 체크아웃 원문에서 생성했고 `git apply --check docs/work-packages/WP-NET/INTEGRATION.patch`가 종료 0이었다. 이 확인은 패치 적용 가능성만 증명하며, 적용 후 동작·컴파일·시험 통과를 뜻하지 않는다.

## 먼저 적용할 세 변경

1. WP-SAVE: `src/ui/App.tsx`에서 렌더 초기값과 설정 갱신 시의 강제 `full` 복구 두 곳을 제거한다. `loadSettings()`와 `normalizeSettings(prev, patch)`를 그대로 쓴다. `motionCustomized`가 없어도 저장한 `minimal`·`simple`을 보존해야 한다.
2. WP-SAVE: `src/ui/copy.ts::cleanNickname`이 `cleanPublicNickname`에 위임하도록 한다. 그러면 홈/새 게임의 별명 검사도 서버와 같은 개인정보 규칙을 쓴다.
3. 총괄: `src/content/index.ts`에서 실제 `banks` 선택에 `published`만 넣는다. 후보/개발 fixture는 `gradeContent()`에서 반환하지 않고, 공개 은행이 없는 학년은 `null`이다. 제작용 `VERIFIED_GRADE_BANKS`는 기존대로 보존하는 최소 패치다.

총괄이 위 소유 변경을 승인·수합할 때만 패치를 적용한다. WP-NET은 자신의 소유 밖 세 파일을 직접 고치지 않았다. 실제 적용 전 그 작업 트리에서 다시 `git apply --check`를 실행한다. 파일이 변했으면 패치를 강제 적용하지 말고 의도만 수동 수합한다.

## 콘텐츠 시험도 함께 조정해야 한다

`tests/unit/difficulty-quiz.test.ts`의 `3~6학년 실제 런타임 은행이 각 학년 1,000문항을 초과하고 4단계 난이도 회전을 정상 수행한다`는 시험은 후보 파일이 모두 존재하면 `gradeContent(grade).bank`가 학년마다 1,000문항을 넘도록 요구한다. 이는 공개 은행 전용 런타임 계약과 정면으로 충돌한다. 현재 공개 은행은 3학년 51문항이며 4~6학년은 후보만 있으므로 위 세 파일 패치만 적용한 뒤 전체 시험이 그대로 통과한다고 보장할 수 없다.

총괄이 이 시험을 소유해 다음처럼 분리한다. 수량 기준·난이도 회전 단언을 낮추거나 지우지 않는다.

- 후보 수량/회전 시험: `grade<N>.candidate.json`을 명시적으로 읽고 `bankFileSchema`로 검사한 후보 fixture에서 `createContext`를 만들어 기존 1,000문항·표제어 340개·난이도/읽기량·300회 회전 단언을 유지한다. 제품의 `gradeContent`로 후보를 노출해서 이 시험을 만족시키지 않는다.
- 실제 런타임 경계 시험: 각 학년의 `gradeContent().bank`는 해당 공개 파일의 `published` 은행 또는 `null`이며 후보/개발 fixture를 반환하지 않는다고 별도로 확인한다. 공개 자료가 없는 학년의 `contextFor()`는 `ContentUnavailableError`여야 한다.

## 수합 후 한 번 실행할 검사

1. 콘텐츠 관련 단위 시험과 `tests/unit/lobby.test.ts`, `tests/unit/stage-animation.test.ts`, `tests/unit/net/**`로 경계를 확인한다.
2. `npm run typecheck`, `npm run lint`, `npm test`를 한 번 실행한다.
3. 다른 작업 트리와 겹치지 않는 `E2E_PORT`를 정하고 기존 `tests/e2e/stage-animation.spec.ts`를 실행한다. 모션 시험은 강제 full 복구가 남은 현재 코드에서 이미 실패한 원인이 확인돼 이번 회차에 반복하지 않았다.
4. 공개 은행/철회가 바뀐 경우에만 `tools/build-question-keys.mjs`의 기존 사용법에 따라 seed를 다시 만든다. 이번 회차에는 입력과 seed를 모두 보존했다.

SQL migration·seed와 실제 Supabase JWT/Realtime/HTTP 검증은 별도다. 이번 회차는 SQL을 변경하거나 실행하지 않았다. 배포 순서와 운영 전 확인은 RETURN.md를 따른다.

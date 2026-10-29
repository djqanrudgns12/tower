# QR-009 반환서

- reviewId: QR-009 / jobId: QP-002
- 검토 모델: GPT-6 (Codex; 런타임의 세부 모델 식별자는 제공되지 않음)
- 새 문맥 독립 검토: true. 정답 키·다른 검토자의 결과 미열람.
- 시작 확인: HEAD `324405c79781bf7e07a7bf565081639e49b336a4`, `content-source/batches` 없음, 계약 해시 3개 요청서와 일치.

## 사전 조회 전 독립 풀이

- g3-practice-0004 / revision 3
- blindChoice: c
- 걸음에는 움직이는 속도가 있으므로 ‘걸음이 빨라요’가 자연스럽다. 단맛·모양·색깔에는 이 문맥에서 빠르다는 속성을 붙일 수 없다.
- 이 선택은 사전을 조회하기 전에 기록했다.

## 사전 확인·최종 판정

- 판정: source pass / uniqueness pass / grade pass / language pass / explanation uncertain.
- source: [표준국어대사전 빠르다](https://stdict.korean.go.kr/search/searchView.do?word_no=157226&searchKeywordTo=3)의 형용사 뜻 1, `senseExample517894`를 직접 확인했다. 동작에 걸리는 시간이 짧다는 뜻과 걸음에 관한 용례가 일치한다.
- 확인 방법: 웹 도구의 URL 열기는 Internal Error로 실패했다. Python urllib로 같은 공식 URL의 HTML을 읽고, 페이지가 사용하는 `https://stdict.korean.go.kr/search/contentViewOne.do`에 `word_no=157226`을 POST하여 뜻 번호·의미 식별자·용례·활용을 확인했다. 외부 응답은 별도 파일로 저장하지 않았다.
- language: 공식 사전 `searchResult.do?searchKeyword=...`에서 단-맛(413185), 색-깔(177134), 목-도리(117269), 지우-개(488823)의 표제어를 확인했다. 붙임표는 단어 내부 구성이며 표기는 붙여 쓴다. 빠르다의 활용 ‘빨라’와 조사·어미·띄어쓰기도 적절하다. 의미상 부적절한 오답은 용법 판별 문항의 의도에 해당한다.
- uniqueness: 걸음은 속도를 가질 수 있지만 단맛·모양·색깔은 해당 문장에서 ‘빠르다’와 어울리지 않는다. 문장에 없는 동작·상황을 보태지 않으면 답은 하나다.
- grade: 모든 보기의 낱말이 구체적이고 친숙하며 같은 짧은 문장 구조다. 3학년의 첫 연습 문항으로 충분히 쉽다. gradeBasis의 저학년 경험 표현 단원은 내용상 타당하나 교과서 원문과 정확한 단원 수록 여부는 미확인이다.
- 단서: 모든 보기가 같은 말투와 어미를 사용한다. 정답 보기에만 지문 낱말을 되풀이하는 단서도 없다.
- explanation: 해설 미제공으로 uncertain 유지. 총괄의 원본 대조가 필요하다.

## 검사

실행: `npx vitest run tests/unit/content.test.ts` (1회, 종료 코드 0)

```text
RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-009
Test Files  1 passed (1)
Tests  10 passed | 1 skipped (11)
Start at  21:01:01
Duration  803ms (transform 51%, import 40%, tests 9%, worker 1%)
```

- 위 시험은 형식·내용 처리 검사 결과이며 총괄의 정답·해설 대조나 최종 승인을 대신하지 않는다. skipped 1건은 통과로 계산하지 않았다.
- 재사용한 검사: 없음. 전체 시험·빌드·브라우저 검사: 미실행(요청 범위 밖).
- 수정 파일: `content-source/reviews/QP-002/codex.json`, `docs/work-packages/QR-009/RETURN.md`만 작성했다. commit·push·다른 에이전트 호출 없음.
- 집계: fail 0, uncertain 0(explanation 제외), multiple 0, none 0.


### 추가 검사 제한

- 실행: `node --experimental-strip-types --input-type=module`로 `blindReviewSchema`를 직접 import하여 결과 JSON을 검사하려 했으나, Node ESM이 기존 코드의 확장자 없는 `./questions` import를 해석하지 못해 실행되지 않았다.
- 실제 오류: `ERR_MODULE_NOT_FOUND: Cannot find module '/Users/bodyking/Desktop/vibecoding/tower-wp/QR-009/src/contracts/questions' imported from .../src/contracts/questionDraft.ts` (Node.js v24.21.0).
- 이 오류는 JSON 판정 결과가 아니라 검사 실행 환경의 모듈 해석 오류다. 소스 수정이나 같은 명령 재실행은 하지 않았다. 지정된 Vitest 검사 10 passed / 1 skipped 결과는 그대로 유효하다. 결과 JSON의 필드·enum·해시는 제공된 스키마와 입력에 맞춰 작성했으나 독립적인 직접 스키마 실행 성공은 주장하지 않는다.

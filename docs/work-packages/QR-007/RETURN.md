# QR-007 반환서 — QP-001 첫 연습 판 독립 검토

- 작업일: 2026-10-29 (Asia/Seoul)
- 검토자: GPT-6 기반 Codex. 실행 문맥에 세부 모델 식별자가 제공되지 않아 그 이상의 모델명은 단정하지 않는다.
- 도구: Codex `functions.exec`·`exec_command`·Python 표준 라이브러리 HTTPS 조회·`web.run`.
- `freshContext: true`. 이번 독립 검토에서 정답 키, 다른 검토자의 판정, 제작 원본, 게임 은행, git 이력을 열지 않았다. 이전 검토 메모리는 조회하지 않았다.
- 결과: `content-source/reviews/QP-001/codex.json`.
- 수정 파일: 결과 JSON과 이 반환서만. 패키지 설치·commit·push·다른 에이전트 호출 없음.
- 절차 지침: 상위 실행 지침에 따라 전역 `verification-budget/SKILL.md`만 절차용으로 읽었다. 프로젝트 자료는 허용된 요청서·계약·PRD §9·blind-input으로 한정했다.

## 시작 조건

실행 결과:

```text
git rev-parse HEAD
7e1d4551beff9396cc27edc3eda48362071e96eb

git status --short
?? docs/work-packages/QR-007/

content-source/batches ABSENT

npm ls --depth=0
vocabulary-tower-defense@0.1.0 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-007
종료 코드 0 (설치된 최상위 의존성 목록 정상 출력)

node tools/contract-hash.mjs QR-007
jobId: QR-007
generatedAt: 2026-10-29T11:44:55.943Z
gitHead: unknown
contractHashes:
  content-source/reviews/QP-001/blind-input.json: 5def003f424bb81bc22845058b75a8cbd02bb72ab1de08fdee3d755cd4f5e8a3
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: 052347538f28eb187f8d97f16a5624428928909e3cb878c5c6ffd74815646e96
```

해시 3개 모두 QR-007 REQUEST 머리말과 일치했다. 해시 도구의 `gitHead: unknown`과 별도로 실제 `git rev-parse HEAD`가 지정 SHA와 일치함을 확인했다.

## 문항별 판정

사전 페이지·검색 결과를 열기 전에 네 문항을 직접 풀고 결과 JSON에 blindChoice를 기록했다. 사전 조회 후 선택을 변경하지 않았다.

| 문항 | revision | blindChoice | source | uniqueness | grade | language | explanation |
|---|---|---|---|---|---|---|---|
| g3-practice-0001 | 2 | b | pass | pass | pass | pass | uncertain |
| g3-practice-0002 | 2 | d | pass | pass | pass | pass | uncertain |
| g3-practice-0003 | 2 | a | pass | pass | pass | pass | uncertain |
| g3-practice-0004 | 2 | c | pass | pass | uncertain | pass | uncertain |

- fail: 0문항·0판정.
- uncertain(explanation 제외): 1문항·1판정, `g3-practice-0004.grade`.
- multiple: 0, none: 0.
- explanation: 해설이 없는 입력이므로 4문항 모두 uncertain으로 남겼다.

`g3-practice-0004`의 ‘날쌔요’는 달리는 토끼 문맥에서 뜻은 맞지만 ‘빠르다’보다 낯설 수 있다. 첫 연습을 3학년 누구나 바로 풀 수 있어야 한다는 추가 기준에서는 보류가 필요하다. 이는 검토자의 읽기 부담 판단이며 학년별 어휘 빈도 조사 결과는 아니다. 제시된 교과서 단원의 존재만으로 ‘날쌔다’의 선행 학습을 입증할 수 없다. 더 쉬운 표현 또는 즉시 이해 가능성을 뒷받침하는 구체적 자료가 필요하다.

나머지는 생활 어휘와 짧은 문장으로 판단했다. 네 보기 모두 의미를 대입했고, 빈칸 문항은 조사 ‘을’까지 붙였다. ‘우산·신발·김밥·창문’은 모두 받침이 있어 조사로 정답이 드러나지 않는다. 정답 보기에만 지문의 낱말이 반복되거나 종결 방식이 달라지는 단서는 발견하지 못했다.

## 사전 확인 방법과 근거

1. `web.run`으로 입력의 표준국어대사전 URL 네 개를 직접 열었다. 기쁘다는 외곽 화면만 추출됐고 나머지 세 URL은 도구 접근 오류가 났다. 이를 뜻 확인 성공으로 간주하지 않았다.
2. Python `urllib.request`로 같은 공식 페이지의 HTML을 조회했다. 페이지의 `fnContentView`가 `/search/contentViewOne.do`에 `word_no`를 POST하여 본문을 표시함을 확인했다.
3. 이 공식 본문 경로에 각 `word_no`를 보내 표제어·품사·첫 뜻·용례와 `senseExample{ID}`를 직접 확인했다. 응답은 메모리에서 처리했으며 별도 파일로 저장하지 않았다.
4. 보기 검토를 위해 공식 `searchResult.do?searchKeyword=...`로 즐겁다·슬프다·춥다·아프다·날쌔다·몸집·신발·김밥·창문을 확인했다. 날쌔다는 본문과 활용도 추가 확인했다. 단어 경계·활용 근거와 실제 문장의 띄어쓰기를 함께 검토했다.

| 공식 페이지 | 입력 의미 ID / 순서 | 확인 내용 |
|---|---|---|
| [기쁘다](https://stdict.korean.go.kr/search/searchView.do?word_no=405464&searchKeywordTo=3) | 107077 / 1 | 유일 뜻, 욕구 충족에 따른 긍정적 감정 |
| [크다](https://stdict.korean.go.kr/search/searchView.do?word_no=492996&searchKeywordTo=3) | 331050 / 1 | 형용사 첫 뜻, 외형 크기 및 반대말 작다 |
| [우산](https://stdict.korean.go.kr/search/searchView.do?word_no=251182&searchKeywordTo=3) | 357670 / 1 | 유일 뜻, 비를 가리는 물건 및 ‘우산을 쓰다’ 용례 |
| [빠르다](https://stdict.korean.go.kr/search/searchView.do?word_no=157226&searchKeywordTo=3) | 517894 / 1 | 첫 뜻, 동작에 걸리는 시간이 짧음 |
| [날쌔다](https://stdict.korean.go.kr/search/searchView.do?word_no=407096&searchKeywordTo=3) | 보기 보조 확인 | 동작이 재빠르다는 의미 및 활용 날쌔어/날쌔 |

학년 근거의 단원명은 [울산교육청 자료](https://use.go.kr/et/user/bbs/BD_selectBbs.do?q_bbsDocNo=20240829143118750&q_bbsSn=2143), [미래엔 국어 2-1(가) 차례](https://e.m-teacher.co.kr/pages/ele/textbook/textbookDetail.mrn?gradeCode=02&masterSeq=1376&revisionCode=2022&tabType=classTab&termCode=01), [인천교육청 도서관 교과 연계 목록](https://lib.ice.go.kr/data/menuResources/h8/40/202601190916_k1zLKRL.pdf)의 공개 검색 자료와 부합했다. 교과서 본문에 각 표제어·보기가 실제 수록되어 있는지는 미확인이다. 입력의 `gradeBasis.reviewed: true`를 독립 검증 완료로 받아들이지 않았다.

## 검사 출력

실행 — 계약 파일의 `sha` 정의와 `blindReviewSchema` 구간을 그대로 가져와 Node VM에서 Zod로 결과 JSON을 검사했다. 이어 입력과 4문항의 questionId·revision·contentHash를 대조했다. 파일로 검사 스크립트를 추가하지 않았다.

```text
blindReviewSchema PASS; 4/4 questionId·revision·contentHash 일치
종료 코드 0
```

실행 — 지정된 시험을 1회 실행했다.

```text
npx vitest run tests/unit/content.test.ts

 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-007

 Test Files  1 passed (1)
      Tests  10 passed | 1 skipped (11)
   Start at  20:46:57
   Duration  261ms (transform 59%, import 24%, tests 15%, worker 2%)
종료 코드 0
```

skip 1건의 상세 이유는 이 실행 출력에 없으며 시험 파일을 추가로 열지 않았다. 건너뛴 검사를 통과로 보고하지 않는다. 전체 시험·빌드·e2e는 미실행이며, 정답 키 대조와 해설 검토는 총괄의 남은 일이다. 통과한 검사는 반복 실행하지 않았다.

# RETURN — QR-010(QP-002 첫 연습 판 1문항 독립 검토, Claude)

- 검토자: Claude Opus 5.5(모델 ID `claude-opus-5-5`). Claude Code에서 총괄이 띄운 독립 하위 에이전트로, 총괄 대화를 물려받지 않은 새 문맥이다.
- 날짜: 2026-10-29
- 작업 폴더: `/Users/bodyking/Desktop/vibecoding/tower-wp/QR-010`
- 결과 파일: `content-source/reviews/QP-002/claude.json`
- 정답 키·해설·이전 판정은 보지 않았다. `src/content/questions/**`, 다른 tower-wp 폴더, git 이력의 파일 내용도 열지 않았다.

## 1. 시작 확인(출력 원문)

```text
$ git rev-parse HEAD
324405c79781bf7e07a7bf565081639e49b336a4

$ ls -d content-source/batches
ls: content-source/batches: No such file or directory

$ node tools/contract-hash.mjs QR-009
jobId: QR-009
generatedAt: 2026-10-29T11:59:50.975Z
gitHead: unknown
contractHashes:
  content-source/reviews/QP-002/blind-input.json: f3497e66cad6dd4b73ee9701a775d7c9eefb81a56653e2428123bbd086b0237d
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: 03259a4072847d690ae9f29c5e34ac4d30093e50a220cc2959ac07d5ddf41a43
```

세 해시는 모두 `docs/work-packages/QR-009/REQUEST.md` 머리말의 `contractHash`와 같다.

## 2. 판정

사전을 보기 전에 직접 풀어 blindChoice를 정했다.

| questionId | rev | blindChoice | source | uniqueness | grade | language | explanation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| g3-practice-0004 | 3 | c | pass | pass | pass | pass | uncertain(규정) |

- fail 0개, uncertain 0개(explanation 제외), multiple/none 0개.
- 근거
  - **uniqueness**: a(단맛)·b(모양)·d(색깔)는 '빠르다'의 어느 뜻(1「1」 동작, 1「2」 일이 이루어지거나 지나는 시간, 2 【…보다】 시간 순서상 앞섬, 3 【-기에】 아직 이름)으로도 성립하지 않는다. 그래서 정답은 하나다.
  - **grade**: 모든 낱말이 저학년 기초 어휘이고, 표제어보다 어려운 한자어가 없다. 네 보기가 같은 문형이라 첫 연습 문항으로 바로 풀 만큼 쉽다. gradeBasis의 교과서 단원(2022 개정 국어 2-1(가) '3. 겪은 일을 나타내요')은 원문으로 확인하지 못했다(미확인).
  - **language**: '빨라요'는 르 불규칙 활용으로 맞다. '단맛'은 한 낱말이라 붙여 쓴다. 조사도 자연스럽다.
  - **(참고)**
    - 표제어 활용형이 네 보기에 고루 들어가 있어 정답만 드러나는 단서가 없다. 말투도 네 보기가 같다.
    - d '색깔이 빨라요'는 '빨개요'(빨갛다)와 비슷해 잘못 읽힐 수 있다. 그래도 두 번째 정답은 생기지 않는다.

## 3. 사전 확인 방법

1. **빠르다**: 아래 요청을 보냈다(HTTP 200, 20457 bytes).

   ```text
   curl -X POST https://stdict.korean.go.kr/search/contentViewOne.do \
     -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
     --data 'word_no=157226&searchKeywordTo=3'
   ```

   - 응답의 `senseExample` ID는 517894, 521409, 534267, 534268 네 개다.
   - `<ul id="senseExample517894">`는 '빠르다「형용사」' 1「1」 '어떤 동작을 하는 데 걸리는 시간이 짧다.' 바로 아래에 있다. 첫 용례는 '걸음이 빠르다.'이다.
   - 따라서 senseId 517894와 senseOrder 1이 이 뜻과 맞고, 정답 후보 c와 같은 뜻이다.
   - 나머지 ID의 뜻은 다음과 같다.
     - 521409: 1「2」
     - 534267: 2 【…보다】
     - 534268: 3 【-기에】
   - 활용란에 '빨라'가 있다.
2. **단맛(띄어쓰기)**: `searchResult.do?searchKeyword=단맛`으로 word_no=413185를 찾았다. 같은 방식으로 POST했더니 표제어가 '단-맛「명사」'였다. 따라서 '단맛'은 붙여 쓴다.

## 4. 검사

```text
$ npx vitest run tests/unit/content.test.ts

 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-010

 Test Files  1 passed (1)
      Tests  10 passed | 1 skipped (11)
   Start at  21:01:26
   Duration  720ms (transform 56%, import 31%, tests 12%, worker 1%)
```

- 실행했고 통과했다.
- 이 검사의 '독립 검토 보고서 형식'(blindReviewSchema)은 `content-source/reviews/*/*.json` 전체를 대상으로 하므로 `claude.json`도 검사했다.
- 건너뛴 1개는 contentHash 대조 시험이다. 작업 폴더에 `content-source/batches`가 없어서 건너뛰었다.

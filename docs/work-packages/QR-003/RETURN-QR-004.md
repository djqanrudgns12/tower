# QR-004 RETURN — Q20-002 독립 검토(Claude, 정답 키 없음)

```yaml
reviewId: QR-004
jobId: Q20-002
status: RETURNED
model: claude-opus-5-5 (Claude Opus 5.5)
tool: Claude Code(총괄이 띄운 독립 하위 에이전트), 새 문맥(freshContext: true)
workDate: 2026-10-29
workDir: /Users/bodyking/Desktop/vibecoding/tower-wp/QR-004
output: content-source/reviews/Q20-002/claude.json
```

## 1. 시작 확인 출력

```text
$ git -C /Users/bodyking/Desktop/vibecoding/tower-wp/QR-004 rev-parse HEAD
0ed9f449e99feb2a868b24cc0a398635a6bbe29f

$ ls content-source/
reviews
$ ls content-source/batches
ls: content-source/batches: No such file or directory

$ node tools/contract-hash.mjs QR-003
jobId: QR-003
generatedAt: 2026-10-29T10:17:53.168Z
gitHead: unknown
contractHashes:
  content-source/reviews/Q20-002/blind-input.json: 51e4165cb5b1e347db20ab9ae84e35954309ce08f6b5227e97842af6547dad64
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: b4df7985def6717f618e5ed801e4775eca5dec07ad50276e3f168c53daaa29a5
```

- HEAD가 요청값과 같다.
- content-source/batches가 없다.
- 해시 3개가 docs/work-packages/QR-003/REQUEST.md 머리말 contractHash와 모두 같다.

## 2. 문항별 blindChoice

사전 페이지를 열기 전에 20문항을 먼저 풀어 정했다. 사전을 확인한 뒤에도 바뀐 답은 없다.

| questionId | rev | 유형 | 표제어 | blindChoice |
|---|---:|---|---|---|
| g3-argon-0004 | 2 | definition | 짐작하다 | d |
| g3-argon-0006 | 2 | definition | 끈기 | b |
| g3-argon-0011 | 2 | cloze | 흐뭇하다 | c |
| g3-argon-0013 | 2 | synonym_context | 망설이다 | a |
| g3-argon-0015 | 2 | synonym_context | 소중하다 | c |
| g3-argon-0017 | 2 | antonym_context | 익숙하다 | a |
| g3-argon-0021 | 1 | definition | 엉뚱하다 | b |
| g3-argon-0022 | 1 | definition | 간추리다 | d |
| g3-argon-0023 | 1 | definition | 당황하다 | c |
| g3-argon-0024 | 1 | definition | 흉내 | a |
| g3-argon-0025 | 1 | cloze | 또박또박 | a |
| g3-argon-0026 | 1 | cloze | 주렁주렁 | d |
| g3-argon-0027 | 1 | cloze | 궁금하다 | b |
| g3-argon-0028 | 1 | cloze | 약속 | c |
| g3-argon-0029 | 1 | synonym_context | 까닭 | d |
| g3-argon-0030 | 1 | synonym_context | 차근차근 | b |
| g3-argon-0031 | 1 | antonym_context | 칭찬하다 | c |
| g3-argon-0032 | 1 | antonym_context | 떠올리다 | b |
| g3-argon-0033 | 1 | usage | 솔직하다 | d |
| g3-argon-0034 | 1 | usage | 성큼성큼 | a |

multiple 0, none 0.

## 3. fail·uncertain 목록(explanation 제외)

- fail: 없음
- uncertain: 없음
- explanation: 입력에 해설이 없어 20문항 모두 uncertain이다(요청서 지시).

판정에는 영향이 없지만 findings에 적은 내용:

- (참고, 단서) g3-argon-0030: 정답만 지문 ‘차근차근’과 첫 음절 ‘차’가 같고 ‘차○차○’ 꼴이 같다. 소리 연상으로 고를 수 있다. 사전이 차근차근 ≒ 차곡차곡으로 적어 정답 자체는 타당하다.
- (참고, 단서) g3-argon-0033: 오답 셋은 몸이나 동작(배·걸음·두 팔)에 ‘솔직해요’를 붙였고 정답만 사람의 태도를 말한다. 그래서 문장 짜임만 보고 고를 수 있다. 정답의 ‘거짓 없이’는 사전 뜻풀이를 거의 그대로 옮긴 말이다.
- (참고, 길이) g3-argon-0015: 정답 ‘귀해요’만 3음절이고 나머지는 4음절이다.
- (참고, 약한 단서) g3-argon-0006: 지문 ‘해냈어요’와 정답 ‘견디어 내는’에 ‘내다’가 겹친다.
- (참고, 약한 단서) g3-argon-0021: 오답 셋은 감정을 나타내고 정답만 생각과 다름을 나타낸다.
- (권고) g3-argon-0004: 오답 a ‘한 잘못을 미안하다고 말하다’는 ‘한’이 수량(하나)으로도 읽힌다. ‘자기가 한 잘못을’이나 ‘잘못한 일을’이 더 자연스럽다. 문법상 틀리지 않아 language는 pass로 두었다.
- (확인) g3-argon-0013: 오답 d ‘인사드렸어요’는 사전에 ‘인사드리다’ 표제어가 없다. 다만 접사 ‘-드리다7’(몇몇 명사 뒤에 붙어 공손한 행위를 나타냄)이 있어 붙여 쓴 것으로 보았다.
- grade 판정은 지문·보기의 낱말이 쉬운지를 기준으로 했다. gradeBasis(교과서·단원)는 실물 교과서로 따로 대조하지 않았다.

## 4. 사전 확인 방법

1. 요청서가 안내한 대로 각 문항의 `source.url`(`https://stdict.korean.go.kr/search/searchView.do?word_no=…`)을 curl로 열었다. 받은 페이지에는 뼈대만 있고, 본문은 페이지 스크립트(`fnContentView`)가 같은 사이트의 `/search/contentViewOne.do`에 `word_no`를 POST해 채운다. 그래서 20개 `word_no`마다 같은 호출로 본문 HTML을 받았다.
2. 본문 HTML에서 뜻 블록의 `id="senseExample<senseId>"`를 찾았다. 그 앞의 뜻 번호(「n」)와 뜻풀이를 뽑아 `senseOrder`·`senseId`가 같은 뜻을 가리키는지 확인했다. 20문항 모두 senseId가 페이지에 있었고 senseOrder 번째 뜻과 맞았다. 뜻이 하나뿐인 표제어는 번호 없이 그 뜻 하나가 senseId였다.
   - 뜻이 여러 개인 표제어: 끈기 「2」, 익숙하다 1「1」, 엉뚱하다 「1」, 간추리다 「2」, 또박또박1 「1」, 주렁주렁 「1」, 떠올리다 「1」. 모두 지문이 묻는 뜻과 같았다.
3. 보기 낱말의 뜻과 띄어쓰기는 `https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=<낱말>` 검색 결과로 확인했다. 필요한 표제어는 1번과 같은 방법으로 본문도 받았다.
   - 붙여 쓰는 표제어로 확인함: 잊어버리다, 걸어가다, 방울토마토, 깨어나다, 되돌아보다, 찾아보다, 찾아내다, 잘되다, 돌아다니다, 들어가다, 이야기하다, 잃어버리다, 속마음, 줄넘기, 비좁다, 서투르다(서툴다는 준말).
   - 표제어가 없어 띄어 쓰는 것이 맞다고 확인함: 거짓 없이, 따라 하다, 소리 내다, 귀 기울이다, 견디어 내다.
   - 0건: 인사드리다. 접사 ‘-드리다7’은 있음.
   - 뜻 확인: 귀하다 「3」 ‘아주 보배롭고 소중하다’, 차곡차곡 「2」 ‘=차근차근’, 머뭇거리다 ‘…자꾸 망설이다’, 꾸짖다, 느긋하다, 꾸벅꾸벅1·2, 대충대충, 보슬보슬, 모락모락, 뚜벅뚜벅, 와글와글, 엉금엉금, 빙글빙글.
4. 받은 파일은 세션 임시 폴더에만 두었고 작업 폴더에는 넣지 않았다.

## 5. 검사 실제 출력

```text
$ npx vitest run tests/unit/content.test.ts --reporter=verbose

 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-004

 ✓ tests/unit/content.test.ts > 런타임 문제은행 > 은행 파일이 하나 이상 있다 1ms
 ✓ tests/unit/content.test.ts > 런타임 문제은행 > /src/content/questions/grade3.dev.json: 스키마·의미 검사·전투 읽기 부담 3ms
 ✓ tests/unit/content.test.ts > 런타임 문제은행 > /src/content/questions/practice.json: 스키마·의미 검사·전투 읽기 부담 0ms
 ✓ tests/unit/content.test.ts > 런타임 문제은행 > 의미 검사는 정답만 긴 보기·빈칸 누락·긴 해설을 잡는다 0ms
 ✓ tests/unit/content.test.ts > 독립 검토 보고서 > /content-source/reviews/Q20-002/claude.json: 형식 1ms
 ↓ tests/unit/content.test.ts > 독립 검토 보고서 > /content-source/reviews/Q20-002/blind-input.json: tools/make-blind-input.mjs의 해시가 TS 정규화와 같다
 ✓ tests/unit/content.test.ts > 독립 검토 보고서 > contentHash 입력은 보기 순서와 무관하게 같다 4ms
 ✓ tests/unit/content.test.ts > 에셋 manifest(validate:assets) > /asset-source/incoming/ART-SAMPLE-001/manifest.json: 형식·PNG 크기·알파·해시 3ms
 ✓ tests/unit/content.test.ts > 에셋 manifest(validate:assets) > /public/assets/manifest.json: 형식·PNG 크기·알파·해시 1ms

 Test Files  1 passed (1)
      Tests  8 passed | 1 skipped (9)
   Start at  19:25:02
   Duration  136ms (import 43%, transform 36%, tests 18%, worker 2%)
```

- 건너뛴 1건은 작업 폴더에 정답 원본(batches)이 없어서 해시 대조를 건너뛴 것이다. 검사 파일에 적힌 의도와 같다.
- 검사 대상 파일 중 src/content/questions/**는 검사 도구가 읽은 것이다. 검토자는 그 파일을 열지 않았다.

## 6. 바꾼 파일

- content-source/reviews/Q20-002/claude.json (새 파일)
- docs/work-packages/QR-003/RETURN-QR-004.md (이 파일)

패키지 설치, git commit, push는 하지 않았다.

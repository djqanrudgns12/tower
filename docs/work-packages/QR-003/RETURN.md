# QR-003 반환서 — Q20-002 독립 검토

- 검토 모델: GPT-6 (Codex). 작업일: 2026-10-29 (Asia/Seoul).
- 작업 폴더: `/Users/bodyking/Desktop/vibecoding/tower-wp/QR-003`.
- 두 번에 나누어 실행했다. 1/2의 1~10번 결과를 재사용하고, 이번 2/2에서 11~20번을 추가했다. 남은 문항은 없다.
- 산출물: `content-source/reviews/Q20-002/codex.json`(20문항), 이 반환서.

## 시작 확인 및 독립성

- 재사용: 기존 `codex.json`의 1~10번 독립 풀이·사전 확인·판정과 `freshContext=true`, 모델·작업일 기록. 이전 실행의 도구 로그나 별도 시작 확인서는 제공되지 않아 그 실행의 HEAD·검사 여부를 추가로 단정하지 않았다.
- 이번 실행: 새 문맥에서 허용된 요청서, `blindReviewSchema`, PRD §9, 입력 11~20번과 기존 결과를 읽었다. 정답 키, 다른 검토자 결과, 본 저장소·다른 작업 폴더·git 이력의 파일·`src/content/questions/**`는 열지 않았다. 프로젝트 외 기억 파일도 조회하지 않았다.
- 이번 실행: 11~20번 선택을 사전 조회 전에 `codex.json`에 먼저 저장하고 이후 바꾸지 않았다. 사전 확인 후 같은 항목의 판정·근거만 완성했다.
- 이번 실행에서 확인한 HEAD: `0ed9f449e99feb2a868b24cc0a398635a6bbe29f` — QR-003 요청서 기준과 일치한다. git 이력의 파일 내용은 열지 않았다.
- 이번 실행에서 확인한 계약 해시 3개는 요청서와 일치한다(아래 실제 출력). 1~10번 항목은 시작·완료 시 정규화 JSON SHA-256이 같아 내용 보존을 확인했다.
- 수신함 시작 확인: 새 메시지 없음. 다른 에이전트 호출·상의 없음. 수정은 허용된 두 산출물에만 했다. 설치·commit·push 없음.

## 문항별 결과

`explanation`은 입력에 없으므로 20개 모두 `uncertain`이다. 아래 fail·uncertain 열에서는 제외했다. 1~10번은 재사용이며 그 판정은 이번 실행에서 수정하지 않았다.

| 순번 | questionId | blindChoice | fail | uncertain |
|---:|---|:---:|---|---|
| 1 | g3-argon-0004 | d | 없음 | language |
| 2 | g3-argon-0006 | b | 없음 | language |
| 3 | g3-argon-0011 | c | 없음 | 없음 |
| 4 | g3-argon-0013 | a | 없음 | 없음 |
| 5 | g3-argon-0015 | c | 없음 | grade |
| 6 | g3-argon-0017 | a | 없음 | 없음 |
| 7 | g3-argon-0021 | b | 없음 | 없음 |
| 8 | g3-argon-0022 | d | 없음 | 없음 |
| 9 | g3-argon-0023 | c | 없음 | 없음 |
| 10 | g3-argon-0024 | a | 없음 | 없음 |
| 11 | g3-argon-0025 | a | 없음 | 없음 |
| 12 | g3-argon-0026 | d | 없음 | 없음 |
| 13 | g3-argon-0027 | b | 없음 | 없음 |
| 14 | g3-argon-0028 | c | 없음 | 없음 |
| 15 | g3-argon-0029 | d | 없음 | 없음 |
| 16 | g3-argon-0030 | b | 없음 | 없음 |
| 17 | g3-argon-0031 | c | 없음 | 없음 |
| 18 | g3-argon-0032 | b | 없음 | 없음 |
| 19 | g3-argon-0033 | d | 없음 | 없음 |
| 20 | g3-argon-0034 | a | 없음 | 없음 |

- 20문항 합계: fail 0건(0문항), uncertain 3건(3문항), multiple 0문항, none 0문항. 네 기준 80개 판정 중 pass 77건이다.
- 남은 uncertain: `g3-argon-0004` language(잘못을 미안하다고 말하다의 연결), `g3-argon-0006` language(친해짐·잠 깸을 기운으로 묶은 표현), `g3-argon-0015` grade(귀하다의 추상적 뜻과 보기 읽기 수준). 모두 1/2 결과의 재사용이다.
- 이번 11~20번: source·uniqueness·grade·language 모두 pass. `차곡차곡` 제2뜻과 `차근차근`의 대응 및 `꾸벅꾸벅`의 동형어까지 대조했다. 교과서 원문·학생 대상 난이도 검증은 미실행이며 grade는 입력의 단원 연계와 독립적인 읽기 수준 판단이다.
- 정답 보기에만 지문 낱말이 반복되거나 정답만 종결말투가 다른 `(참고)` 사유는 이번 11~20번에서 발견하지 못했다.

## 사전 확인 방법

입력에 명시된 표준국어대사전 URL 10개를 먼저 열었다. web.run은 8개에서 접근 오류, 2개에서 뜻풀이가 빠진 동적 화면만 반환했다. 이어서 같은 공식 사이트 `https://stdict.korean.go.kr/search/contentViewOne.do`에 각 `word_no`를 POST하여 실제 뜻풀이 HTML을 읽었다. 10개 모두 뜻 순서 1과 `senseExample{senseId}`를 대조했다. 오류를 뜻 확인 성공으로 처리하지 않았다.

| 순번 | 표제어 | word_no | 확인한 senseId |
|---:|---|---:|---:|
| 11 | [또박또박](https://stdict.korean.go.kr/search/searchView.do?word_no=419911&searchKeywordTo=3) | 419911 | 2055 |
| 12 | [주렁주렁](https://stdict.korean.go.kr/search/searchView.do?word_no=482362&searchKeywordTo=3) | 482362 | 22837 |
| 13 | [궁금하다](https://stdict.korean.go.kr/search/searchView.do?word_no=403568&searchKeywordTo=3) | 403568 | 562363 |
| 14 | [약속](https://stdict.korean.go.kr/search/searchView.do?word_no=457820&searchKeywordTo=3) | 457820 | 539192 |
| 15 | [까닭](https://stdict.korean.go.kr/search/searchView.do?word_no=52927&searchKeywordTo=3) | 52927 | 107531 |
| 16 | [차근차근](https://stdict.korean.go.kr/search/searchView.do?word_no=485818&searchKeywordTo=3) | 485818 | 287339 |
| 17 | [칭찬하다](https://stdict.korean.go.kr/search/searchView.do?word_no=342293&searchKeywordTo=3) | 342293 | 297032 |
| 18 | [떠올리다](https://stdict.korean.go.kr/search/searchView.do?word_no=417200&searchKeywordTo=3) | 417200 | 551325 |
| 19 | [솔직하다](https://stdict.korean.go.kr/search/searchView.do?word_no=449133&searchKeywordTo=3) | 449133 | 199961 |
| 20 | [성큼성큼](https://stdict.korean.go.kr/search/searchView.do?word_no=190832&searchKeywordTo=3) | 190832 | 198765 |

보기의 기본형은 공식 `searchResult.do?searchKeyword=...&searchKeywordTo=3`로 검색하여 표제어·한 단어 여부를 확인했다. 필요한 `차곡차곡`(483940), `꾸벅꾸벅`(57903), `잊어버리다`(274278), `알아보다`(456671)는 동적 전체 뜻풀이도 열었다. `걸어가다`(394972) 등 합성어와 조사·어미·의존 명사를 구별해 표기를 판정했다. 개별 결과의 findings에 조회한 word_no와 판단을 남겼다. `들어 있다`는 [국립국어원 온라인가나다](https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&qna_seq=326082)도 보조 확인했다.

## 검사 — 실제 실행과 출력

`verification-budget` 스킬을 적용했다. 내용·보존 검사 1회와 요청된 Vitest 1회를 실행했다. 이미 통과한 검사를 반복하지 않았다. 이전 실행의 시험 결과는 재사용하지 않았다.

인라인 Python으로 입력 순서·revision·contentHash·20개 수량·1~10번 보존·해설 상태 및 집계를 확인했다(종료 코드 0).

```text
PASS: 20 items; input order/revision/contentHash match; first 10 preserved; explanation all uncertain
FIRST10_SHA256 0c0cae03e43e9f1273cba94206b4cfe9dd998abac99cf603d5eb0f8b75435c5d
VERDICT_COUNTS_EXCLUDING_EXPLANATION {'pass': 77, 'uncertain': 3}
MULTIPLE_NONE 0
51e4165cb5b1e347db20ab9ae84e35954309ce08f6b5227e97842af6547dad64 content-source/reviews/Q20-002/blind-input.json
de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8 src/contracts/questionDraft.ts
b4df7985def6717f618e5ed801e4775eca5dec07ad50276e3f168c53daaa29a5 vocabulary_td_prd_v0_5.md
```

설치된 실행 파일 존재를 확인한 뒤 `npx vitest run tests/unit/content.test.ts`를 실행했다(종료 코드 0). 출력은 다음과 같다.

```text
 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-003

 Test Files  1 passed (1)
      Tests  8 passed | 1 skipped (9)
   Start at  19:25:16
   Duration  186ms (import 48%, transform 33%, tests 16%, worker 2%)
```

1개 skipped는 통과로 세지 않았다. 출력에 생략된 시험 이름은 추정하지 않았다. 정답 키·해설 대조, 전체 시험·빌드·게시 승인·학생 검증은 미실행이다. 독립 검토 완료와 최종 승인·게시를 구별한다.

## 남은 일

총괄이 기존 uncertain 3건을 처리하고 정답·해설을 대조해야 한다. 독립 검토자에게 남은 문항은 없다.

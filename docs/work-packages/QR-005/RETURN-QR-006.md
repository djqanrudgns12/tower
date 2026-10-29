# QR-006 회신 — Q20-003 독립 검토(Claude, 정답 키 없음)

- 모델: `claude-opus-5-5` (Claude Opus 5.5)
- 도구: Claude Code(총괄이 띄운 독립 하위 에이전트), 새 문맥(freshContext=true)
- 작업일: 2026-10-29
- 작업 폴더: `/Users/bodyking/Desktop/vibecoding/tower-wp/QR-006`
- 결과 파일: `content-source/reviews/Q20-003/claude.json` (20문항)

## 1. 시작 확인 출력

```text
$ git rev-parse HEAD
f18d76524a191a40359d51c67565f40d4668ad67

$ ls content-source/ ; ls content-source/batches
reviews
ls: content-source/batches: No such file or directory

$ node tools/contract-hash.mjs QR-005
jobId: QR-005
generatedAt: 2026-10-29T11:10:08.107Z
gitHead: unknown
contractHashes:
  content-source/reviews/Q20-003/blind-input.json: 27e33a08983b6242f59aa8ee5a076768189a998e9c5f12c13d8ccad7af242338
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: 29efc06c360860cbb5bbf97c196b9a651a45c5e51cfedaf0dd869566255de4dc
```

세 해시가 `docs/work-packages/QR-005/REQUEST.md` 머리말 contractHash와 같다. 정답 원본·이전 판정·문제은행 파일은 열지 않았고, git 이력의 파일도 열지 않았다.

## 2. 문항별 blindChoice

사전 페이지를 열기 전에 20문항을 먼저 풀었다. 사전을 확인한 뒤에도 바뀐 답은 없다.

| questionId | rev | 유형 | 표제어 | blindChoice |
|---|---:|---|---|---|
| g3-argon-0004 | 3 | definition | 짐작하다 | d |
| g3-argon-0006 | 3 | definition | 끈기 | b |
| g3-argon-0015 | 3 | cloze | 소중하다 | c |
| g3-argon-0035 | 1 | definition | 맞장구 | b |
| g3-argon-0036 | 1 | definition | 살피다 | a |
| g3-argon-0037 | 1 | cloze | 데굴데굴 | c |
| g3-argon-0038 | 1 | cloze | 속상하다 | a |
| g3-argon-0039 | 1 | synonym_context | 아쉽다 | d |
| g3-argon-0040 | 1 | antonym_context | 부끄럽다 | b |
| g3-argon-0041 | 1 | usage | 깡충깡충 | c |
| g3-argon-0042 | 1 | definition | 어리둥절하다 | d |
| g3-argon-0043 | 1 | definition | 실망하다 | c |
| g3-argon-0044 | 1 | definition | 용기 | a |
| g3-argon-0045 | 1 | cloze | 꾸준하다 | d |
| g3-argon-0046 | 1 | cloze | 살랑살랑 | b |
| g3-argon-0047 | 1 | cloze | 반짝반짝 | a |
| g3-argon-0048 | 1 | synonym_context | 쑥스럽다 | c |
| g3-argon-0049 | 1 | synonym_context | 반갑다 | b |
| g3-argon-0050 | 1 | antonym_context | 차분하다 | d |
| g3-argon-0051 | 1 | usage | 조심스럽다 | a |

multiple 0, none 0이다.

## 3. fail·uncertain 목록(explanation 제외)

- **fail:** 없음
- **uncertain:** 없음
- explanation은 입력에 해설이 없어 20문항 모두 uncertain이다(총괄 해설 대조 몫).

판정을 바꾸지는 않았지만 총괄이 볼 만한 지적이다. 자세한 내용은 claude.json findings에 있다.

- g3-argon-0035(맞장구): (참고) 정답 b에만 표제어의 ‘맞’이 ‘맞다고’로 되풀이되고, 지문의 ‘친구 말에’가 b의 ‘남의 말에’로 이어진다. 그래서 뜻을 몰라도 겉모양으로 b를 고를 수 있다. 정답 보기의 한자어 ‘동의’는 교실 토의에서 흔히 쓰는 말이고 ‘맞다고’가 뜻을 받쳐 주어 grade는 pass로 두었다. 더 엄격하게 보면 uncertain 후보다.
- g3-argon-0037(데굴데굴): (참고) 지문 ‘굴러갔어요’의 ‘굴’이 정답 ‘데굴데굴’에만 들어 있다. 빈칸 문항에서 자연스러운 짝이라 결함으로 보지 않았다.
- g3-argon-0043(실망하다): (참고) 정답 c만 13음절이고 나머지는 11음절이다. 마음을 나타내는 보기도 c 하나뿐이다. 길이 차이가 작아 결함으로 보지 않았다.
- g3-argon-0044(용기): (참고, 약함) 지문의 ‘내어’와 정답의 ‘내지’가 같은 동사 ‘내다’다.
- g3-argon-0040(부끄럽다): 정답 ‘떳떳하다’는 표제어보다 조금 높은 말이다. 다만 고유어이고, 나머지 보기가 반대말이 아니어서 소거로도 풀 수 있어 grade는 pass로 두었다.

## 4. 사전 확인 방법

1. **뜻(source).** 문항의 `word_no`마다 다음과 같이 요청했다.
   `curl -X POST https://stdict.korean.go.kr/search/contentViewOne.do -d 'word_no=<번호>&searchKeywordTo=3'`
   - 20개 모두 HTTP 200으로 본문을 받았다.
   - 응답에서 품사(`tit_noun`), 뜻 문단(`p.t_number`, 「n」 번호), 뜻별 용례 목록(`ul#senseExample<ID>`)을 차례대로 뽑았다. 뜻 순서와 목록 id를 문항의 senseOrder·senseId와 맞춰 보았다.
   - 20개 모두 senseOrder 자리의 목록 id가 senseId와 같았다. 그 뜻도 문항이 묻는 뜻과 같았다.
   - 다의어는 다음 다섯 개다. 끈기 「2」 36129, 맞장구 「1」 404460, 살피다 「1」 332165, 아쉽다 「2」 335842, 부끄럽다 「1」 11693이다. 살랑살랑 「1」 12992와 반짝반짝 「1」 1002는 용례가 없는 뜻이 중간에 있어도 순서가 맞는지 확인했다.
   - 동의·반의 문항은 사전 풀이 안에 정답 낱말이 들어 있는지도 확인했다. 아쉽다→서운하다, 부끄럽다→떳떳하지 못하다, 쑥스럽다→어색하다, 반갑다→기쁘다가 그렇다. 차분하다(가라앉아 조용하다)↔들뜨다는 뜻이 반대다.
2. **띄어쓰기·표기(language).** `GET https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=<낱말>`로 표제어 여부를 확인했다.
   - **한 낱말 표제어:** 속-마음, 양-옆, 줄-넘기, 비탈-길, 밤-하늘, 창-가, 그만-두다, 굴러-가다, 잃어-버리다, 달려-가다, 찾아-가다, 시냇-물, 풀-밭, 몸-짓, 떳떳-하다, 들-뜨다, 서운-하다, 어색-하다, 눈-부시다, 길쭉-하다, 넉넉-하다, 비-좁다, 선선-하다. 흉내말 보기 10개도 모두 표제어로 있다.
   - **표제어가 없어 띄어 쓰는 것이 맞는 말:** ‘하루종일’, ‘귀기울이다’가 없다. ‘방안’은 방안(方案) 같은 다른 낱말뿐이다. 그래서 지문의 ‘하루 종일’, ‘귀 기울여’, ‘방 안’은 띄어 쓴 것이 맞다.
   - 보조 용언(지켜 주는, 켜 두어)과 의존 명사(바꿀 수, 읽을 만큼)는 띄어쓰기 원칙에 맞다.
3. 받은 응답은 내 임시 작업 폴더에만 두었다. 작업 폴더에는 결과 파일 두 개 말고 아무것도 쓰지 않았다.

## 5. 검사 실제 출력

```text
$ npx vitest run tests/unit/content.test.ts

 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-006


 Test Files  1 passed (1)
      Tests  10 passed | 1 skipped (11)
   Start at  20:15:31
   Duration  473ms (transform 55%, import 32%, tests 12%, worker 1%)
```

`--reporter=verbose`로 보면 다음과 같다.

- `/content-source/reviews/Q20-003/claude.json: 형식`이 통과했다(blindReviewSchema).
- 건너뛴 1건은 `blind-input.json: tools/make-blind-input.mjs의 해시가 TS 정규화와 같다`이다. 정답 원본 배치가 작업 폴더에 없어서 `skipIf`로 건너뛰었다.

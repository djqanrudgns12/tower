# QR-002 — Q20-001 독립 검토 반환(Claude)

- 검토자: `claude-opus-5-5`(Claude Opus 5.5), Claude Code 데스크톱 앱. 총괄 세션과 다른 새 대화이고 정답 키를 보지 않았다(`reviewer.freshContext: true`).
- 작업일: 2026-10-28 (Asia/Seoul)
- 작업 폴더: `/Users/bodyking/Desktop/vibecoding/tower-wp/QR-002`(macOS. DISPATCH의 Windows 경로 대신 이 폴더에서 돌렸다)
- 결과 파일: `content-source/reviews/Q20-001/claude.json`(20문항)
- 결과: **blindChoice 20개 모두 단일 답(multiple 0, none 0). fail 1(0013 language), uncertain 2(0004 grade, 0015 grade). explanation은 지시대로 20개 모두 uncertain.**

## 시작 확인

| 항목 | 결과 |
|---|---|
| `git rev-parse HEAD` | `bc3ee0720912d33ff2b96602c365cfdd38e37521` — REQUEST `baseCommit`과 같다 |
| `content-source/batches` | 없다(`ls: content-source/batches: No such file or directory`). sparse checkout 목록은 `/*`, `!/content-source/batches/`, `!/docs/work-packages/Q20-001/RETURN.md` |
| `npm ci` | 성공, `found 0 vulnerabilities` |
| `node tools/contract-hash.mjs QR-001` | 입력 파일 3개 SHA-256이 REQUEST 머리말과 모두 같다(blind-input `08c958c8…`, questionDraft.ts `2eb60700…`, PRD v0.5 `17d72f08…`). 도구의 `gitHead: unknown`과 별개로 HEAD는 위 명령으로 확인했다 |
| 시작 시 `git status --short` | ` M docs/work-packages/QR-001/REQUEST.md`(총괄이 채워 넣은 REQUEST. 손대지 않았다) |

이 작업 폴더 밖(본 저장소, 다른 tower-wp 폴더)은 열지 않았다.

## 방법

1. **먼저 풀기.** 사전을 열기 전에 blind-input의 문항만 보고 20문항을 풀었다. 빈칸·비슷한말·반대말·바른 사용 문항은 네 보기를 모두 문장에 넣어 보고, 조사·어미가 맞는지와 다른 보기가 말이 되는지를 따졌다.
2. **사전 대조(source).** 앱 안 브라우저로 각 문항의 `stdict.korean.go.kr/search/searchView.do?word_no=…` 페이지를 실제로 열었다. 같은 출처에서 그 페이지가 본문을 불러오는 `/search/contentViewOne.do`(word_no)를 호출해 뜻풀이를 읽었다. 뜻이 여럿인 표제어(0003·0006·0008·0012·0017·0018·0019)는 본문의 `senseExample<ID>` 순서로 blind-input `senseId`가 몇 번째 뜻인지 확인했고, 20개 모두 `senseOrder`와 맞았다. 동형어가 있는 표제어도 맞는 동형어 번호다(정성11 精誠, 배려2 配慮, 차례2 次例, 씩씩하다2).
3. **표기 확인.** 띄어쓰기가 의심되는 보기는 표준국어대사전 검색으로 확인했다(‘받아적다’ 0개, ‘받아쓰다’ 1개, 접사 ‘-드리다’ 있음).
4. **grade·language.** 낱말과 문장을 3학년이 읽을 수 있는지, PRD §9.2 읽기 수준 규칙(보기에 학년보다 어려운 낱말 금지)에 비추어 판단했다.

## 문항별 결과

S=source, U=uniqueness, G=grade, L=language(E=explanation은 모두 uncertain). ✓=pass, ✗=fail, ?=uncertain.

| 문항 | 유형 | 목표어 | blindChoice | 사전 뜻(번호) | S | U | G | L |
|---|---|---|---|---|---|---|---|---|
| 0001 | definition | 꼼꼼하다 | a | 단일 뜻 ‘빈틈이 없이 차분하고 조심스럽다’ | ✓ | ✓ | ✓ | ✓ |
| 0002 | definition | 정성 | b | 정성11 단일 뜻 ‘온갖 힘을 다하려는 참되고 성실한 마음’ | ✓ | ✓ | ✓ | ✓ |
| 0003 | definition | 뿌듯하다 | c | 「2」 ‘기쁨이나 감격이 마음에 가득 차서 벅차다’ | ✓ | ✓ | ✓ | ✓ |
| 0004 | definition | 짐작하다 | d | 단일 뜻 ‘사정이나 형편 따위를 어림잡아 헤아리다’ | ✓ | ✓ | ? | ✓ |
| 0005 | definition | 의젓하다 | a | 단일 뜻 ‘말이나 행동 따위가 점잖고 무게가 있다’ | ✓ | ✓ | ✓ | ✓ |
| 0006 | definition | 끈기 | b | 「2」 ‘쉽게 단념하지 아니하고 끈질기게 견디어 나가는 기운’ | ✓ | ✓ | ✓ | ✓ |
| 0007 | cloze | 배려 | c | 배려2 단일 뜻 ‘도와주거나 보살펴 주려고 마음을 씀’ | ✓ | ✓ | ✓ | ✓ |
| 0008 | cloze | 설레다 | d | 1 ‘마음이 가라앉지 아니하고 들떠서 두근거리다’ | ✓ | ✓ | ✓ | ✓ |
| 0009 | cloze | 허둥지둥 | a | 단일 뜻 ‘…갈팡질팡하며 다급하게 서두르는 모양’ | ✓ | ✓ | ✓ | ✓ |
| 0010 | cloze | 살금살금 | b | 단일 뜻 ‘남이 알아차리지 못하도록 눈치를 살펴 가면서 살며시 행동하는 모양’ | ✓ | ✓ | ✓ | ✓ |
| 0011 | cloze | 흐뭇하다 | c | 단일 뜻 ‘마음에 흡족하여 매우 만족스럽다’ | ✓ | ✓ | ✓ | ✓ |
| 0012 | cloze | 차례 | d | 차례2 「1」 ‘순서 있게 구분하여 벌여 나가는 관계…’ | ✓ | ✓ | ✓ | ✓ |
| 0013 | synonym_context | 망설이다 | a | 단일 뜻 ‘이리저리 생각만 하고 태도를 결정하지 못하다’ | ✓ | ✓ | ✓ | ✗ |
| 0014 | synonym_context | 서운하다 | b | 단일 뜻 ‘마음에 모자라 아쉽거나 섭섭한 느낌이 있다’ | ✓ | ✓ | ✓ | ✓ |
| 0015 | synonym_context | 소중하다 | c | 단일 뜻 ‘매우 귀중하다’ | ✓ | ✓ | ? | ✓ |
| 0016 | antonym_context | 부지런하다 | d | 단일 뜻, 「반대말」 게으르다 | ✓ | ✓ | ✓ | ✓ |
| 0017 | antonym_context | 익숙하다 | a | 1「1」 ‘어떤 일을 여러 번 하여 서투르지 않은 상태에 있다’ | ✓ | ✓ | ✓ | ✓ |
| 0018 | usage | 다듬다 | b | 「4」 ‘글 따위를 매끄럽고 짜임새 있게 고치다’ | ✓ | ✓ | ✓ | ✓ |
| 0019 | usage | 너그럽다 | c | 「1」 ‘마음이 넓고 아량이 있다’ | ✓ | ✓ | ✓ | ✓ |
| 0020 | usage | 씩씩하다 | d | 씩씩하다2 단일 뜻 ‘굳세고 위엄스럽다’ | ✓ | ✓ | ✓ | ✓ |

## fail · uncertain 목록

- **g3-argon-0013 language = fail.** 보기 c ‘받아적었어요’는 띄어쓰기 오류다. 표준국어대사전에 ‘받아적다’가 없고(‘받아쓰다’만 있음) 본용언 두 개가 이어진 말이므로 ‘받아 적었어요’로 써야 한다. 보기 넷을 여섯 글자로 맞추려고 띄어쓰기를 지운 것으로 보인다. 정답(a 머뭇거렸어요)과 유일성에는 영향이 없다. d ‘인사드렸어요’는 접사 ‘-드리다’에 따라 붙여 쓰는 것이 맞다.
- **g3-argon-0004 grade = uncertain.** 정답 보기 ‘사정이나 형편을 헤아리다’의 ‘사정·형편·헤아리다’가 목표어 ‘짐작하다’와 비슷하거나 더 어려워서, 3학년에게 뜻풀이 구실을 하는지 확신하지 못한다(§9.2 읽기 수준 규칙).
- **g3-argon-0015 grade = uncertain.** 정답 보기 ‘귀중해요’(한자어 ‘귀중하다’)가 목표어 ‘소중하다’보다 3학년에게 덜 익숙할 수 있다. 사전 뜻풀이 ‘매우 귀중하다’를 그대로 정답으로 쓴 것으로 보인다. ‘귀해요’처럼 쉬운 말을 검토할 만하다.
- **20문항 explanation = uncertain**(지시대로. blind-input에 해설이 없다).

## 통과했지만 총괄이 볼 만한 점

판정을 바꿀 정도는 아니어서 `findings`에 `(참고)`로만 적었다.

- **보기 문체나 글자가 힌트가 된다.** 0004는 정답만 사전식 추상 뜻풀이이고 오답은 구체 행동이다. 0018은 지문의 ‘글을 고치는’과 이어지는 ‘문장’이 b에만 있다. 0019는 지문의 ‘마음씨’가 c에만 그대로 나온다. 셋 다 낱말을 몰라도 고를 수 있다(PRD §9.2 ‘답의 힌트가 되지 않게’의 취지).
- **정답 위치가 규칙적이다(배치 전체).** 내 blindChoice를 문항 번호 순으로 늘어놓으면 a·b·c·d가 다섯 번 그대로 되풀이된다(0001 a, 0002 b, 0003 c, 0004 d, 0005 a …). 정답 키는 보지 않았으므로 내 풀이 기준이다. 게임이 보기를 저장 순서대로 보여 주고 같은 묶음이 연달아 나오면, 정답 위치가 힌트가 될 수 있다(§9.2 ‘정답 위치가 답의 힌트가 되지 않게’). 출제할 때 보기를 섞는지 확인할 만하다.
- **오답의 변별력이 낮다.** 0007은 소리·무게·높이가 문맥과 전혀 이어지지 않는다.
- **어색한 표현.** 0010 ‘잠든 아기가 깨지 않도록 눈치를 살피며’는 사전 뜻풀이를 옮긴 듯해 조금 어색하다. 0017 정답을 지문에 넣으면 ‘손에 서툴러요’가 되어 어색하지만, 반대말 문항이라 대입이 필요하지는 않다.

## 확인하지 못한 것

- **gradeBasis의 교과서 단원.** 2022 개정 국어 3-1·3-2 교과서와 지도서 원문을 볼 수 없어서, 단원명이 실제와 같은지와 그 단원에 목표어가 나오는지는 확인하지 않았다(웹 검색으로도 공식 목차를 찾지 못했다). grade 판정은 낱말·문장이 3학년에게 익숙한지와 단원명이 그럴듯한지로만 했다.
- **explanation.** 원본 대조 단계의 일이라 판정하지 않았다.
- **contentHash.** 정답 원본이 없어 해시를 다시 계산하지 않았다. blind-input 값을 그대로 옮겼다(시험의 해시 대조 항목도 이 폴더에서는 건너뛴다).

## 검사

`npx vitest run tests/unit/content.test.ts --reporter=verbose` 실제 출력(색상 코드 제거):

```text
 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/QR-002
 ✓ tests/unit/content.test.ts > 런타임 문제은행 > 은행 파일이 하나 이상 있다 1ms
 ✓ tests/unit/content.test.ts > 런타임 문제은행 > /src/content/questions/grade3.dev.json: 스키마·의미 검사·전투 읽기 부담 5ms
 ✓ tests/unit/content.test.ts > 런타임 문제은행 > 의미 검사는 정답만 긴 보기·빈칸 누락·긴 해설을 잡는다 0ms
 ✓ tests/unit/content.test.ts > 독립 검토 보고서 > /content-source/reviews/Q20-001/claude.json: 형식 2ms
 ↓ tests/unit/content.test.ts > 독립 검토 보고서 > /content-source/reviews/Q20-001/blind-input.json: tools/make-blind-input.mjs의 해시가 TS 정규화와 같다
 ✓ tests/unit/content.test.ts > 독립 검토 보고서 > contentHash 입력은 보기 순서와 무관하게 같다 7ms
 ✓ tests/unit/content.test.ts > 에셋 manifest(validate:assets) > /asset-source/incoming/ART-SAMPLE-001/manifest.json: 형식·PNG 크기·알파·해시 8ms
 ✓ tests/unit/content.test.ts > 에셋 manifest(validate:assets) > /public/assets/manifest.json: 형식·PNG 크기·알파·해시 4ms
 Test Files  1 passed (1)
      Tests  7 passed | 1 skipped (8)
```

건너뛴 1개는 정답 원본(batches)이 있어야 도는 해시 대조 시험이다.

## 변경 범위

새로 만든 파일은 [내 몫]의 두 개뿐이다(`content-source/reviews/Q20-001/claude.json`, 이 문서). 다른 파일 수정, 패키지 설치·업그레이드(`npm ci` 제외), commit, push는 하지 않았다. 앞에 보이는 `REQUEST.md` 변경은 시작할 때부터 있던 총괄의 변경이다.

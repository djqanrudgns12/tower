---
jobId: Q20-002
owner: Argon 4
model: Gemini 4 Argon (High)
tool: Antigravity
date: 2026-10-29
baseCommit: e98ae95024529a2ac54f71b96503d9e2c993248f
status: RETURNED
---

# Q20-002 작업 반환서 (RETURN)

## 1. 작업 정보 및 상태
- **jobId**: `Q20-002`
- **실제 작업자·모델·도구**: `Argon 4` / `Gemini 4 Argon (High)` / `Antigravity`
- **작업일(완료일)**: `2026-10-29`
- **상태**: `RETURNED` (최종 `ACCEPTED`는 총괄 부여)

## 2. 입력 `baseCommit` · `contractHash` · 사용 원본 해시
- **`baseCommit`**: `e98ae95024529a2ac54f71b96503d9e2c993248f`
- **`contractHash` (`node tools/contract-hash.mjs Q20-002` 일치 확인 완료)**:
  - `vocabulary_td_prd_v0_5.md`: `b4df7985def6717f618e5ed801e4775eca5dec07ad50276e3f168c53daaa29a5`
  - `docs/contracts/question-draft.schema.json`: `68fc9985ebcdd333aeb36457c612a2a406b9f7d32d7feec7494258e30375f097`
  - `src/contracts/questionDraft.ts`: `de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8`
  - `src/content/lint.ts`: `b5df964bf9b5c66b26639a211a5a7cb6e888d4d42514881c0dc6fab4ceeadd5c`
  - `content-source/batches/Q20-001/drafts.json`: `7b51fe71369d9c6f79a7b8cd9650dba45268183eae2d605bfc405ce490a38a82`
  - `content-source/batches/Q20-001/sidecar.json`: `a28b211b45d900c240e8fc3dc6d201b5bd043b5bbb02a602a79119fc88f8f310`
  - `content-source/approvals/registry.json`: `9c7c87a332d0f0673f207fb7c5a157eb7f90f5fd76ff9cd5d7e7ac1f80e39214`
  - `content-source/approvals/Q20-001.explanation.json`: `acc6e8130343843c00c9408fe43df2cf7736ff68f6d284d71e03f6f231c65100`
  - `content-source/reviews/Q20-001/codex.json`: `571c311abd6813d20348167b5e17f5664cfbcdb4e6fc5ec09391f676fbad3c0c`
  - `content-source/reviews/Q20-001/claude.json`: `15813ebfba47ff3e75935db9996b19a69c4370754003060af80d911472a00b82`

## 3. 변경 파일 및 산출물 SHA-256 해시
- `content-source/batches/Q20-002/drafts.json`: 격리 6문항(`revision: 2`) + 새 문항 14개(`revision: 1`) 총 20개 초안 (`c6fb8f1e64774991c30edf46339cb3a55ec81631d063dbfc5e954724d4c723b3`)
- `content-source/batches/Q20-002/sidecar.json`: 제작자 정보(`producer`), 20문항 자체 반박(`selfRefutation`)·유일성 메모·교과서 학년 근거, 미채택 후보 21개 사유(`rejected`) (`0de6578e3191da54f856458762b8b5d4caa6042846bb17fa377e7665717d4bdf`)
- `content-source/batches/Q20-002/evidence/*.txt` (20개):
  - **Q20-001 무수정 복사 6개 (뜻번호 동일, 원본 해시 100% 일치)**:
    - `g3-argon-0004.txt`: `16a96b463dc139e7b8988e75210367cc8d85af34287ba7de8f6b618f80f1ead1`
    - `g3-argon-0006.txt`: `bb05c9ebbf8816f2d42699d14f84516b9d33e2f76a28c3f6ceae5096407110ef`
    - `g3-argon-0011.txt`: `78f9cc6435a3552e30f85c66d3d363a33902aa51ee0ecd839b0c841f2c526a7d`
    - `g3-argon-0013.txt`: `332003ec1fd86b2da999cf5ceaf28593dae6cc8a24f88791174c43320f86ed06`
    - `g3-argon-0015.txt`: `a6fe58cc78dc1b24bb51d9e66e4193ffa973f3b1eb3d7dd783a86b3cc7f7f2ff`
    - `g3-argon-0017.txt`: `a2057eaa36be088347117001b56328a4dfcc141b67c14217fb89076451aa26d1`
  - **표준국어대사전 신규 실조회 생성 14개 (뜻풀이만 수록, 용례 미복제)**:
    - `g3-argon-0021.txt` (`엉뚱하다`, `word_no=228742`, `sense_no=17367`): `ebb2d7b98938be728cd1db8a40b660b949a0c1a9d114fff598b7f602192a989f`
    - `g3-argon-0022.txt` (`간추리다`, `word_no=390247`, `sense_no=334267`): `7cf2edffb74e075422d23973d42fde0a410bfe84f2d1b5548a5253eebe17baba`
    - `g3-argon-0023.txt` (`당황하다`, `word_no=76900`, `sense_no=126421`): `a2c5197f35e60016ca47836a5e901956afe4d73fe0798e051bc6a895ddf71a27`
    - `g3-argon-0024.txt` (`흉내`, `word_no=386476`, `sense_no=330060`): `36105e1e023df3e4552a66e735dfe3353ba050685827b0cf7da8086eb5f60dca`
    - `g3-argon-0025.txt` (`또박또박`, `word_no=419911`, `sense_no=2055`): `6f1deffeb8c67f51f8dfb4f80c046cc97f5c8c93bc2b6b7a72b9b6e34cef4050`
    - `g3-argon-0026.txt` (`주렁주렁`, `word_no=482362`, `sense_no=22837`): `0f56dd7f66ac6a37c3cb2e93120c7c40b73915c12df1c6787ccfaf2d3de95ecf`
    - `g3-argon-0027.txt` (`궁금하다`, `word_no=403568`, `sense_no=562363`): `a1aa5a358109a96c6588f5d40de6aa8f9e827fd35c015a8bea43d48e18fe3874`
    - `g3-argon-0028.txt` (`약속`, `word_no=457820`, `sense_no=539192`): `7dab2b3bcd1faa4be14747009f35e2d1f8bc870555d6eaa3381872ea4a913b73`
    - `g3-argon-0029.txt` (`까닭`, `word_no=52927`, `sense_no=107531`): `bc738a1a24d746dad93bb151fe3ea8c4d4cb4add3741e47f9266140de7146da0`
    - `g3-argon-0030.txt` (`차근차근`, `word_no=485818`, `sense_no=287339`): `80151993f3d63811b7c5e7b6705404f3371394d048f7ce6664c4d76aa2f5674f`
    - `g3-argon-0031.txt` (`칭찬하다`, `word_no=342293`, `sense_no=297032`): `7db910ae142409968b789f410a022986e04a65d0e1d28686eeb81cf93e36d183`
    - `g3-argon-0032.txt` (`떠올리다`, `word_no=417200`, `sense_no=551325`): `0936ca0ccf5926337b9ae063f6ff04bd8d6db86565a37e38710e7d49cb5cc7e6`
    - `g3-argon-0033.txt` (`솔직하다`, `word_no=449133`, `sense_no=199961`): `1afaef5149481d7887780b3a186aad5b501d91433739f877f32b1077b1390aba`
    - `g3-argon-0034.txt` (`성큼성큼`, `word_no=190832`, `sense_no=198765`): `4c7ee0ab8126284091840bdeca875ebac39bf2b3cea080ac2c97b66ff12963de`
- `docs/work-packages/Q20-002/RETURN.md`: 본 작업 반환서

---

## 4. 고친 판 (`revision: 2`, 격리 6문항 전후 비교)

| ID (`낱말`) | 격리 사유 요약 | 고치기 전 (`Q20-001`, rev 1) | 고친 뒤 (`Q20-002`, rev 2) |
| --- | --- | --- | --- |
| `g3-argon-0004` (`짐작하다`) | 정답 보기·해설의 `사정·형편·어림잡다·헤아리다`가 어렵고, 정답만 사전식 뜻풀이·오답은 구체 행동이라 문체로 구별됨 | - 보기 `a`: `약속 시간을 잊고서 늦다`<br>- 보기 `b`: `책상 위 물건을 바르게 놓다`<br>- 보기 `c`: `멀리 있는 친구를 부르다`<br>- 보기 `d`: `사정이나 형편을 헤아리다`<br>- 해설: `‘짐작하다’는 사정이나 형편을 어림잡아 헤아린다는 뜻이에요.` | - 보기 `a`: `한 잘못을 미안하다고 말하다`<br>- 보기 `b`: `남의 말을 귀 기울여 잘 듣다`<br>- 보기 `c`: `힘든 일을 끝까지 참고 견디다`<br>- 보기 `d`: `모르는 일을 대강 생각해 알다`<br>- 해설: `‘짐작하다’는 잘 모르는 일을 대강 생각해 알아낸다는 뜻이에요.`<br>*(오답 이유 `a·b·c`도 새 보기에 맞춰 쉬운 말로 갱신)* |
| `g3-argon-0006` (`끈기`) | 오답 이유 `c`의 `사교성`이 3학년보다 어려움 | - 오답 이유 `c`: `‘낯선 사람과 금방 친해지는 기운’은 사교성을 뜻해요.` | - 오답 이유 `c`: `‘낯선 사람과 금방 친해지는 기운’은 남과 잘 어울리는 성격이에요.`<br>*(지문·보기·정답·해설은 승인 판정 그대로 유지)* |
| `g3-argon-0011` (`흐뭇하다`) | 해설의 `흡족하다`가 표제어보다 어려움 | - 해설: `‘흐뭇하다’는 마음에 흡족하여 매우 만족스럽다는 뜻이에요.` | - 해설: `‘흐뭇하다’는 마음에 꼭 들어 기분이 참 좋다는 뜻이에요.`<br>*(지문·보기·오답 이유는 그대로 유지)* |
| `g3-argon-0013` (`망설이다`) | 보기 `c` 및 오답 이유 `c`의 `받아적었어요` 띄어쓰기 오류(`받아 적었어요`) | - 보기 `c`: `받아적었어요`<br>- 오답 이유 `c`: `‘받아적었어요’는 말을 글자로 적어 두었다는 뜻이라 관계가 없어요.` | - 보기 `c`: `서둘렀어요` *(단일어 반대 태도 매력 오답으로 교체, 띄어쓰기 훼손 없음)*<br>- 오답 이유 `c`: `‘서둘렀어요’는 일을 급하게 빨리 했다는 뜻이라 반대에 가까워요.` |
| `g3-argon-0015` (`소중하다`) | 정답 보기 `귀중해요`가 표제어보다 어려울 수 있음 | - 지문: `‘가족과 함께 보낸 주말은 나에게 무척 소중해요’에서 ‘소중해요’와 뜻이 가장 비슷한 것은?`<br>- 보기 `c`: `귀중해요`<br>- 해설: `‘소중하다’와 ‘귀중하다’는 모두 매우 귀하고 중요하다는 뜻이에요.` | - 지문: `‘가족과 함께 보낸 시간은 나에게 무척 소중해요’에서 ‘소중해요’와 뜻이 가장 비슷한 것은?`<br>- 보기 `c`: `귀해요` *(표준국어대사전 `귀하다` 뜻 3: “아주 보배롭고 소중하다.” 확인, 문장 대입 자연스러움 확보)*<br>- 해설: `‘소중하다’와 ‘귀하다’는 모두 무엇과도 바꿀 수 없이 중요하다는 뜻이에요.` |
| `g3-argon-0017` (`익숙하다`) | 지문 `줄넘기가 손에 익숙해요` 문형 어색함, 해설의 `능숙하다`가 표제어보다 어려움 | - 지문: `‘여러 번 연습해서 이제 줄넘기가 손에 익숙해요’에서 ‘익숙해요’와 뜻이 반대인 것은?`<br>- 해설: `‘익숙하다’는 여러 번 해서 능숙하다는 뜻이라 ‘서투르다’와 반대예요.` | - 지문: `‘여러 번 연습해서 나는 이제 줄넘기에 익숙해요’에서 ‘익숙해요’와 뜻이 반대인 것은?` *(표준 문형 `【…에】` 적용)*<br>- 해설: `‘익숙하다’는 여러 번 해 보아 서투르지 않다는 뜻이라 ‘서투르다’와 반대예요.` |

---

## 5. 수량 · 유형별 분포 · 정답 위치 분포 · 뺀 낱말

### 5.1 수량 요약
- **배치 총 문항 수**: **20개** (격리 수정 `revision: 2` **6개** + 신규 제작 `revision: 1` **14개**)
- **Q20-001 목표 낱말 20개 및 `grade3.dev.json` 36문항과의 신규 표제어 중복**: **0건**
- **전투 읽기 부담(`readingLoad`)**: 20문항 모두 **31~70음절** (3학년 전투 출제 상한 70음절 초과 **0건**)

### 5.2 유형별 문항 수
- **새 문항 14개 (`g3-argon-0021`~`0034`) — 요청서 배분 목표 100% 일치**:
  - `definition` (뜻): **4개** (`0021` 엉뚱하다, `0022` 간추리다, `0023` 당황하다, `0024` 흉내)
  - `cloze` (빈칸): **4개** (`0025` 또박또박, `0026` 주렁주렁, `0027` 궁금하다, `0028` 약속)
  - `synonym_context` (비슷한말): **2개** (`0029` 까닭, `0030` 차근차근)
  - `antonym_context` (반대말): **2개** (`0031` 칭찬하다, `0032` 떠올리다)
  - `usage` (바른 사용): **2개** (`0033` 솔직하다, `0034` 성큼성큼)
- **배치 전체 20개 합계**: `definition` 6개, `cloze` 5개, `synonym_context` 4개, `antonym_context` 3개, `usage` 2개

### 5.3 정답 위치(`correctOptionId`) 분포
- **분포**: `a` **5번**, `b` **5번**, `c` **5번**, `d` **5번** (요청서 기준 각 글자 4~6번 충족)
- **문항 순서별 정답 시퀀스**: `d, b, c, a, c, a, b, d, c, a, a, d, b, c, d, b, c, b, d, a` (`a→b→c→d` 순환 패턴 배제, 유형 내에서도 편중 없음)

### 5.4 뺀 후보 낱말(21개)과 사유 (`sidecar.json` `rejected` 동일 기록)
1. **교과서 특정 단원 직접 수록 근거를 새로 확정하지 못해 제외한 낱말 (7개)**:
   - `아끼다`, `정돈하다`, `북적이다`, `달래다`, `신중하다`, `협동`, `알뜰하다`: 현행 2022 개정 3-1·3-2 국어·국어 활동 교과서의 특정 단원 핵심 학습 어휘 직접 수록 근거를 새로 확정하지 못해 요청서 원칙에 따라 제외함.
2. **사전 뜻풀이 구조상 제외한 낱말 (1개)**:
   - `알록달록`: 표준국어대사전에서 독자적 뜻풀이 없이 `‘알로록달로록’의 준말.`로만 등재되어 제외함.
3. **배치 내 의미·단서 중복 방지 및 유형별 정원(14개) 충족으로 제외한 낱말 (13개)**:
   - `견디다` (`0006` 끈기 정답·해설 핵심어와 겹침), `어울리다` (`0006` 오답 이유와 겹침 및 다의어 분화), `조심스럽다` (`0001` 꼼꼼하다 뜻풀이와 겹침), `꾸준하다` (`0006` 끈기·`0016` 부지런하다와 겹침), `어리둥절하다` (`0023` 당황하다와 인접), `엉금엉금` (`0034` 성큼성큼과 이동 부사 중복 방지를 위해 `0026` 오답 보기로만 활용), `반갑다` (`0021` 오답 뜻풀이로 활용), `대견하다`·`기특하다` (`0031` 칭찬하다 및 기존 성품 어휘와 인접), `용기` (`grade3.dev.json` 예시 존재 및 명사 정원 충족), `쑥스럽다`·`속상하다`·`실망하다` (감정 어휘 정원 충족).

---

## 6. 제작 주의 1~7 문항별 확인 내역
1. **정답 위치 비순환 무작위 배정**: 격리 6문항(`d,b,c,a,c,a`)과 새 14문항(`b,d,c,a,a,d,b,c,d,b,c,b,d,a`) 모두 순환 없이 배정했으며 `a:5, b:5, c:5, d:5`로 균형을 확인함.
2. **지문 단서 낱말의 정답 보기 단독 반복 금지**:
   - `definition` 6문항(`0004, 0006, 0021~0024`): 지문 속 상황 단서(`표정·속마음`, `구름`, `읽은 글·공책`, `발표할 말`, `동생·언니`)를 정답 보기에 되풀이하지 않음.
   - `usage` 2문항(`0033` 솔직하다, `0034` 성큼성큼): Q20-001의 `0018·0019`와 달리 단일 의미어를 선정해 지문을 `‘…’를(을) 알맞게 쓴 문장은?`으로만 제시함으로써 지문 단서 노출을 원천 제거함.
3. **네 보기의 말투·구조 통일**:
   - `0004`(`~말하다/듣다/견디다/알다` 11~12음절 뜻풀이), `0021`(11~13음절 형용사 뜻풀이), `0022`(11~13음절 학습 행동 뜻풀이), `0023`(11~13음절 동사 뜻풀이), `0024`(12음절 `~는 일` 명사구 뜻풀이), `0033`·`0034`(13~15음절 해요체 완결문) 등 전 문항에서 네 보기의 종결 어미와 추상도를 일치시킴.
4. **지문·보기·해설·오답 이유 전반의 어려운 한자어 배제**:
   - 기존 지적 어휘(`사교성·흡족하다·능숙하다·귀중하다·사정·형편·어림잡다`)를 전량 제거했고, 신규 문항에서도 사전 원문의 어려운 한자어·고어(`상식적`, `간략하게`, `다급하여 어찌할 바를`, `흐리터분하지 않고 조리 있고`, `높이 평가하다`, `보폭` 등)를 모두 3학년 수준 고유어·기초어로 풀어 씀.
5. **띄어쓰기 사전 실조회 확인**:
   - 표준국어대사전(`stdict.korean.go.kr`) 검색으로 합성 동사·접사 결합어(`머뭇거리다, 돌아다니다, 인사드리다, 알아내다, 찾아보다, 찾아내다, 되돌아보다, 걸어가다, 기어가다, 피어오르다, 되살리다, 잊어버리다, 기억하다, 이야기하다, 들려주다, 잘되다`)와 띄어 쓰는 구(`귀 기울여, 소리 내어, 따라 하는, 정해 두는, 알려 주셨다는, 해 보아, 거짓 없이, 어쩔 줄 모르다`)를 전수 대조함. 보기 길이를 맞추기 위한 띄어쓰기 삭제 0건.
6. **소리 내어 읽기 및 문형 호응 확인**:
   - `0017`을 `나는 이제 줄넘기에 익숙해요`(`【…에】`)로 교정했고, `0015`도 `귀해요`와 자연스럽게 어울리도록 `가족과 함께 보낸 시간은 나에게 무척 소중해요`로 다듬었으며, `0027`(`무엇이 들어 있는지 무척 궁금해요`, `【-ㄴ지】`), `0032`(`즐거운 일을 떠올렸어요` ↔ `잊어버렸어요`) 등 20문항 전체의 연어·문형 자연스러움을 확인함.
7. **변별력 있는 오답 구성 및 자체 반박**:
   - 반대 태도·인접 의미장 오답(`0013` 서둘렀어요, `0022` 책·글 관련 활동 셋, `0025` 대충대충, `0026` 와글와글, `0028` 질문·대답·자랑, `0030` 대충대충, `0031` 자랑하셨어요, `0032` 기억했어요)을 배치하고 `sidecar.json`의 4개 보기 대입 반박으로 복수 정답이 없음을 검증함.

---

## 7. 검사 결과
### 7.1 실행 검사 (`npm run validate:content`)
- **명령**: `npm run validate:content` (`vitest run tests/unit/content.test.ts`)
- **환경**: macOS, Node v24+, 작업 폴더 `/Users/bodyking/Desktop/vibecoding/tower-wp/Q20-002`
- **결과**: exit code `0` (`1 passed`, `12 passed`)
- **실제 출력**:
```text
> vocabulary-tower-defense@0.1.0 validate:content
> vitest run tests/unit/content.test.ts


 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/Q20-002

 ✓ tests/unit/content.test.ts (12 tests) 51ms
   ✓ 런타임 문제은행 (4)
     ✓ 은행 파일이 하나 이상 있다 2ms
     ✓ /src/content/questions/grade3.dev.json: 스키마·의미 검사·전투 읽기 부담 7ms
     ✓ /src/content/questions/practice.json: 스키마·의미 검사·전투 읽기 부담 0ms
     ✓ 의미 검사는 정답만 긴 보기·빈칸 누락·긴 해설을 잡는다 0ms
   ✓ 제작 초안 배치(content-source) (2)
     ✓ /content-source/batches/Q20-001: 초안 스키마·의미 검사·sidecar·근거 해시 16ms
     ✓ /content-source/batches/Q20-002: 초안 스키마·의미 검사·sidecar·근거 해시 4ms
   ✓ 독립 검토 보고서 (4)
     ✓ /content-source/reviews/Q20-001/claude.json: 형식 1ms
     ✓ /content-source/reviews/Q20-001/codex.json: 형식 0ms
     ✓ /content-source/reviews/Q20-001/blind-input.json: tools/make-blind-input.mjs의 해시가 TS 정규화와 같다 6ms
     ✓ contentHash 입력은 보기 순서와 무관하게 같다 1ms
   ✓ 에셋 manifest(validate:assets) (2)
     ✓ /asset-source/incoming/ART-SAMPLE-001/manifest.json: 형식·PNG 크기·알파·해시 8ms
     ✓ /public/assets/manifest.json: 형식·PNG 크기·알파·해시 4ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  19:06:34
   Duration  351ms (import 42%, transform 35%, tests 21%, worker 1%)
```

### 7.2 재사용 검사 및 미실행 검사
- **재사용 검사**: 시작 확인 시 실행한 `npm ci` 및 `node tools/contract-hash.mjs Q20-002` 결과(계약 파일 10개 무변경 상태 동일).
- **미실행 검사**:
  - `npm run build:bank`: 미실행 (`REQUEST.md` 금지 사항 — 허용 경로 밖 `content-source/approvals/registry.json` 수정 방지).
  - `npm run typecheck` / `npm run lint` / `npm run test:e2e`: 미실행 (`src/**`, `tests/**` 코드 변경이 없는 JSON·텍스트 문항 배치 작업이며 요청서 지정 검사는 `npm run validate:content`임).

---

## 8. 알려진 결함 및 계약 변경 요청
- **알려진 결함**: 없음
- **`REQUESTED_CONTRACT_CHANGE`**: 없음

## 9. 통합 방법 및 다음 첫 행동
- **통합 방법**: `content-source/batches/Q20-002/**` 디렉터리 전체와 `docs/work-packages/Q20-002/RETURN.md`를 총괄 수합 브랜치에 그대로 복사·반영한다. 기존 `Q20-001` 및 승인·검토 파일과 경로 충돌이 없으며, 롤백 시 `content-source/batches/Q20-002/` 삭제만으로 복구된다.
- **다음 첫 행동**: 총괄이 `node tools/make-blind-input.mjs Q20-002`를 실행해 정답 키·해설이 제거된 블라인드 검토 입력을 생성하고 Codex·Claude 독립 검토 작업 패키지를 발행한다.

# 4~6학년 공개 문항 1,000+ 공동검수 계획 (CR-1000)

기준일 2026-11-05 · 작성 Claude(총괄) · 상태: **사용자 승인 2026-11-06, D1~D5 권장안으로 진행 중**
입력: 현황 측정(이 문서 §1, 부록 A), Codex 코드 영향 조사(`.orchestrate/plan-input/codex-code-scope.md`, git 제외), Antigravity 수준 기준 의견(§3에 반영), Codex 계획 검토(`.orchestrate/plan-input/codex-plan-review.md`, 지적 14건 반영)
관련: [공동검수 절차](joint_review_protocol_v0_2.md) · [실행 게시판](EXECUTION_BOARD.md) · `tools/content/bankBuild.ts` · `tools/orchestrate/*.mjs`

**2026-11-06 추가 사용자 지시(우선):** 처리량을 높이고 취향 중심 반려·중복 검수를 줄인다. [실용 검수 정책](CR1000_REVIEW_POLICY.md)의 오류/권고 구분, AI SLOP 금지, staging 자동 진행 및 선택적 보조 검사 생략을 적용한다. 공개 승인에 필요한 독립 풀이·자체 반박·Claude 해설 대조는 유지한다. 아래의 원래 공정 설명 중 해당 정책과 충돌하는 부분은 최신 정책을 따른다.

**2026-11-06 최신 사용자 배정:** Claude 어려운 작업은 Opus 5.5/xhigh, 적당한 작업은 Opus 5.5/high, 잡다한 작업은 Sonnet 5.5/xhigh로 보낸다. S4 공동검수는 어려운 작업으로 분류해 Opus 5.5/xhigh를 쓴다. 아래의 이전 Sonnet/high 배정과 Sonnet 관대함 대조 조건은 이 결정으로 대체된다. §9 사용량은 이전 배정의 추정치이므로 새 모델 실측과 구별한다. 공개 승인 규칙·수정 한도·통과율 중단 기준은 유지한다.

---

## 0. 한눈에

### 0.1 목표

| 구분 | 학년마다 | 세는 법 |
|---|---:|---|
| **하한(필수)** | 자기 학년 공개 승인 **1,000문항 이상** | `grade<N>.json`(published) 가운데 `q.grade === N`인 문항. 다른 학년에서 빌려 온 문항은 세지 않는다 |
| 2차 목표 | 자기 학년 공개 승인 1,200문항 | 보충 2라운드(§4 S6)까지 돌렸을 때 |
| 출제 풀 목표 | 약 1,300~1,400문항 | 학년 띠 공유(§3.4, 위로 ≤ 24%·아래로 ≤ 7%)로 인접 학년 문항까지 합친 수. 하한과 따로 보고한다 |
| 난이도별 바닥 | Easy 출제 가능 ≥ 550, Normal ≥ 750, Hard·Crazy ≥ 700 | 게이트(`questionSelection.difficultyGate`)를 통과하는 자기 학년 문항 수 |

학년 순서: **4 → 5 → 6 → 3**. 3학년은 지금 공개 51문항으로 게임이 열려 있어 마지막에 같은 공정을 탄다(D4).

### 0.2 원칙

1. **공개 규칙은 그대로 둔다.** Argon 자체 반박 + Codex·Claude 독립 풀이 일치 + Claude 해설 대조(PRD §9.3, `bankBuild.ts` `RULE`). 기준을 낮춰 수를 채우지 않는다.
2. **Claude는 마지막 관문 한 번만 쓴다.** 앞단(수준 판정·Codex 블라인드·Argon 새 문맥 검수·수정)에서 걸러진 문항만 Claude가 본다. 떨어질 문항에 Claude 사용량을 쓰지 않는다.
3. **무거운 일은 Antigravity(Argon High)와 Codex(gpt-6-astra high)가 맡는다.** 제작·수정·수준 판정·학년 근거는 Argon, 블라인드 재검수·수준 2차 판정·도구 코드는 Codex. 총괄 Claude는 지시·실행·통합·커밋만 하고 문항 본문을 읽지 않는다.
4. **블라인드를 지키고, 지키는 수준을 사실대로 적는다.** Claude 검수는 도구를 막은 CLI라 권한으로 보장된다. Codex 검수는 새 세션·정답 없는 입력·쓰기 금지(`codex exec -s read-only`)지만 파일 읽기는 막지 못해 프롬프트 기반이다. Antigravity는 읽기 전용 브리지다. 권한을 넓혀 정답 키를 읽을 수 있게 하지 않는다.
5. **추적 파일은 한 잠금 안에서 쓰고 바로 커밋한다.** 10/31 자동 루프가 중간에 끊겨 초안·보고서·해시가 서로 맞지 않는 상태를 남긴 일(`wp/WP-CORE`)을 되풀이하지 않는다(§8).

### 0.3 흐름

```text
 S0 도구 준비·시범(3배치)
   │
 S1 수준 판정·학년 근거 보강 ── Argon·Codex 각각 판정 → 합의 → tier 확정(본문 해시 불변)
   │
 S2 앞단 검수 ──────────────── Codex 블라인드(astra high) 전수 + Argon 새 문맥 검수(새로 만든 문항만)
   │
 S3 앞단 수정 루프 ─────────── 앞단 판정 실패 → Argon 수정(revision+1) → S1 재판정 → Codex 재검수, 최대 2회
   │                           (두 번 고쳐도 안 되면 버림 → S6 대체 목록)
 S4 Claude 관문 ────────────── 앞단 통과분만. 블라인드 → 공개 대조(=총괄 해설 대조)
   │
 S5 관문 수정 루프 ─────────── Claude 지적 → Argon 수정 → S1 재판정 → Codex·Claude 재검수(고친 것만), 최대 2회
   │
 S7 학년 띠 공유(D2) ───────── 수준 합의 문항만 인접 학년 은행에 수록
   │
 S8 빌드·검증·공개

 S6 보충 제작(첫날부터 병렬) ─ 새 낱말 목록 → 사전 근거 수집 → Argon 초안 → S1로 합류
```

### 0.4 사용자 결정 (말씀 없으면 권장안으로 진행)

| # | 결정 | 권장안 | 다른 안 |
|---|---|---|---|
| D1 | Claude 관문 모델 | **Claude Sonnet 5.5(effort high)** 전부. 시범 배치에서 Sonnet 지적률이 15% 미만이면 Opus 5.5로 20문항을 따로 풀려 관대함을 확인 | Opus 5.5 전부(사용량 약 2~3배) |
| D2 | 학년 띠 공유 | **수준 판정은 지금 전 문항에 하고, 공유 수록(W5 코드)은 학년별 자기 문항 1,000을 넘긴 뒤 켠다.** 공유분은 "출제 풀"로 따로 센다 | 처음부터 공유로 1,000을 채움(하한 정의가 흐려짐) |
| D3 | Codex rev 1 검수 1,878건 재검수 | **다시 한다.** 그때 입력에 사전 뜻풀이가 들어가 블라인드가 약했다(EXECUTION_BOARD "남는 위험") | 기존 검수 인정(Codex 사용량 절약, 품질 근거 약함) |
| D4 | 3학년 포함 | **포함.** 4~6학년이 S4에 들어간 뒤 같은 공정으로 3학년 Q50 1,000문항을 돌린다 | 4~6학년만 |
| D5 | 아래로 공유(윗학년 경계어 문항을 아랫학년 challenge로, §3.4 조건) | **2단계로 미룬다.** 할 때는 후보마다 Claude 학년 단독 확인(짧은 Sonnet 호출)을 붙인다 | 위로 공유만 영구히 |

---

## 1. 지금 상태 (2026-11-05 측정)

| 학년 | 초안(최신 revision) | 낱말 / 뜻 | revision 1·2·3 | 같은 revision Codex 검수 | Argon 새 문맥 통과 | Claude 검수 | 공개 | 후보 |
|---|---:|---|---|---:|---:|---:|---:|---:|
| 3 (Q50+Q20) | 1,060(고유 ID 1,051) | 416 / 624 (Q50) | 868·189·3 | 877 | 984/1,000 | 3배치(Q20) | **51** | 868 |
| 4 | 1,050 | 366 / 507 | 693·357·0 | 693 | 1,017/1,050 | **0** | **0** | 693 |
| 5 | 1,050 | 411 / 512 | 590·401·59 | 590 | 1,043/1,050 | **0** | **0** | 590 |
| 6 | 1,050 | 405 / 474 | 595·401·54 | 595 | 1,044/1,050 | **0** | **0** | 595 |

4~6학년 난이도별 출제 가능 문항(현재 태그 기준): Easy 597·637·608, Normal 805·808·800, Hard·Crazy 777.

### 1.1 문제 목록

| # | 문제 | 영향 | 다루는 단계 |
|---|---|---|---|
| P1 | 4~6학년 Claude 독립 검토 0건, 해설 대조 63개 모두 Gemini 4 Argon | 공개 승인 0 → 학년 잠김 | S4 |
| P2 | revision 2·3 문항 1,272개(357·460·455)가 Codex 검수 없이 남음 | 앞단 근거 없음 | S2 |
| P3 | Codex rev 1 검수는 사전 뜻풀이가 들어간 입력으로 함 | 블라인드 약화 | S2(D3) |
| P4 | 낱말 쏠림: 학년당 366~411낱말, 한 낱말에 최대 8~15문항 | 반복 노출, 1,000+의 질 저하 | S6, §3.6 |
| P5 | `gradeBasis.reference`가 전부 "2022 개정 국어과 교육과정" 한 줄, 단원 없음 | 학년 근거 약함 | S1 |
| P6 | 전투 읽기량 상한(70·80·90·100음절) 초과 142~230개/학년 | 준비 문제에만 나옴(정상), 전투 풀 축소 | §3.6 분포 목표 |
| P7 | 10/31 루프가 WP-CORE 작업 폴더에서 끊겨 `wp/WP-CORE`에 맞지 않는 보고서가 남음 | 재사용 불가 | §8 배치 단위 커밋 |
| P8 | 시범(Q50-G3-004, Opus): Claude 1차 지적 20/50(40%) → Argon 16 고침·4 버림 → 41/50 승인 | 수율 추정의 근거 | §2 |

Claude 시범에서 블라인드 정답은 50/50 일치했다. 지적은 정답이 아니라 학년 어휘·문장·해설 쪽이었다. 그래서 앞단(S1~S3)에서 학년 어휘와 해설을 먼저 다듬으면 Claude 지적률을 낮출 수 있다고 본다.

---

## 2. 목표 수량과 셈법

### 2.1 수율 가정 (시범 S0에서 실측해 고친다)

| 단계 | 가정 통과율 | 근거 |
|---|---:|---|
| S2·S3 앞단(Codex·Argon, 수정 2회 포함) | 0.97 | Codex 과거 통과 99%, Argon 새 문맥 97~99% |
| S4·S5 Claude 관문(수정 2회 포함) | 0.85 | 시범 0.82, 앞단 정리로 약간 오른다고 봄 |
| 새로 만든 문항 전체 | 0.80 | 첫 검수 전이라 보수적으로 |

**2026-11-06 시범 중간 실측:** Q50-G4-001의 앞단 통과 21문항만 Opus 5.5/xhigh로 S4를 실행했다. 12통과·9지적, 첫 관문 통과율 **57.1%**로 G1의 60% 중단 기준에 미달해 관문 확대를 보류했다. 문장 판정 7건(실패 5·불확실 2), 해설 2건(실패 1·불확실 1), 학년 1건(불확실)이 지적됐으며 항목 간 중복이 있다. 출처·정답 유일성은 각 21건 pass다. 앞단 결함 29문항과 관문 수정은 아직 처리 전이므로 이 값을 수정 2회 포함 최종 수율이나 전체 학년 수율로 대입하지 않는다. 위 가정은 미확정이며 시범 세 배치 완료 뒤 다시 산정한다.

### 2.2 학년당 필요량

| 학년 | 기존 초안 | 기존 기대 승인(×0.97×0.85) | 보충 1라운드(필수) | 보충 기대 승인 | 합계 기대 | 2라운드(선택) |
|---|---:|---:|---:|---:|---:|---:|
| 4 | 1,050 | 약 865 | 6배치·300문항 | 약 240 | **약 1,105** | +6배치 → 약 1,345 |
| 5 | 1,050 | 약 865 | 6배치·300문항 | 약 240 | **약 1,105** | 같음 |
| 6 | 1,050 | 약 865 | 6배치·300문항 | 약 240 | **약 1,105** | 같음 |
| 3 | Q50 1,000(+ Q20 공개 51 유지) | 51 + 약 825 | 6배치·300문항 | 약 240 | **약 1,115** | 같음 |

- 보충 배치 번호: `Q50-G4-022`~`027`(1라운드), `028`~`033`(2라운드). 3학년은 `Q50-G3-022`~. 3학년 Q20 공개 51문항은 이미 Claude 공동검수를 거쳐 그대로 두고, 수준 판정만 S1에서 붙인다.
- 버림 문항은 1:1로 대체 목록에 넣고 보충 배치에 섞는다. 1라운드가 끝나 자기 학년 승인이 1,000 밑이면 2라운드는 필수가 된다.
- 시범 결과가 가정보다 좋으면(관문 0.92 이상) 1라운드를 4배치로 줄인다. 호출 수·사용량은 §9.

---

## 3. 수준 분류 기준 (루브릭 `lv1`)

Antigravity(Argon High)의 설계안을 바탕으로 총괄이 네 군데를 고쳤다(§3.8). 목적은 문항마다 **자기 학년 tier**와 **함께 써도 되는 학년 띠**를 기계적으로 정하는 것이다. 겹침(한 문항을 인접 학년에도 수록, 한 낱말로 여러 문항)은 허용하되, 판정 근거를 남기고 한 판 안의 반복을 막는다.

### 3.1 판정 축 (각 0~3점)

| 축 | 보는 것 | 0 | 1 | 2 | 3 | 누가 매기나 |
|---|---|---|---|---|---|---|
| **L1** 출현·빈도 | 교과 출현 시기, 생활 노출 빈도 | 1~3학년 기초 생활어(가족·학교·신체·기초 동작) | 3~4학년 학습·동화 빈출어(감정 분화, 기초 인과) | 5학년 교과 공통 개념어, 설명·토의 문어 | 6학년 논설·비평·격식 문어, 구어 저빈도 | 판정자 |
| **L2** 어종·추상성 | 고유어/한자어 구조, 개념 추상도 | 구체 사물·감각·동작 고유어(줍다, 오솔길) | 감정·상태·태도 파생어, 투명한 생활 한자어(어리둥절하다, 약속) | 한자 형태소 결합 개념어·관계 추상어(단서, 배려, 관점) | 음훈 추론이 필요한 고추상 한자어(절충, 타당성, 함축) | 판정자 |
| **T1** 뜻 구별·오답 부담 | 목표 뜻의 거리, 오답 3개의 매력도 | 제1의미 + 오답이 모두 다른 의미장 | 중심 의미 + 오답 1~2개가 같은 의미장 | 다의어 확장·문맥 의미, 또는 오답 2~3개가 유의·반의 경계 | 추상·비유 전이 의미, 또는 고매력 혼동 오답 3개 | 판정자 |
| **T2** 과제·읽기 | `min(3, 유형 + 길이 + 추론)` | — | — | — | — | 유형·길이는 **도구**, 추론(0/1)만 판정자 |
| **T3** 변형 | `variantTag` | standard | polysemy | confusable, 또는 비유가 쉬운 관용구(손이 크다) | 불투명 관용구·속담(시치미를 떼다), dialect | 도구. 관용구의 2/3만 판정자 |

T2 세부: 유형 `definition`·`cloze` 0, `synonym_context`·`antonym_context` 1, `usage` 2 / 길이(`readingLoad`) ≤ 65음절 0, 66~85 +1, ≥ 86 +2 / 추론: 지문에 정의·대조·원인 표지나 직접 행동 단서가 있으면 0, 상황 전체를 종합해야 하면 +1.

판정자는 축 점수와 함께 **`elementaryFit`**(`pass`·`too_low`·`too_high`: 초등 범위 안인가)와 한 줄 근거를 낸다.

### 3.2 계산

```text
L = L1 + L2            (0~6)   짝수 = 학년 기저어(0→3, 2→4, 4→5, 6→6학년), 홀수 = 경계어(1: 3↔4, 3: 4↔5, 5: 5↔6)
T = T1 + T2 + T3       (0~9)
V = 2L + T             (0~21)
R(g) = V − 4(g − 3)    학년 g에서의 상대 난도
```

| R(g) | < 0 | 0~1 | 2~4 | 5~6 | 7~9 | > 9 |
|---|---|---|---|---|---|---|
| tier | 너무 쉬움 | basic | core | advanced | challenge | 너무 어려움 |

**tier 정하는 순서**: ① R로 tier → ② 변형 하한 적용(`lint.ts` 규칙과 같다: basic은 standard만, core에 관용·방언 금지, 방언은 challenge. 그래서 polysemy·confusable ≥ core, idiom_proverb ≥ advanced, dialect = challenge) → ③ basic이면 읽기량 ≤ 전투 상한+12음절(3학년 82·4학년 92·5학년 102·6학년 112, `lintBatchStrict`)인지 확인하고, 넘으면 core로 올리고 `long_basic` 표시(문항을 고치지 않고 수를 지킨다). R < 0이어도 이 순서를 그대로 탄다.

**자기 학년(초안 `grade`)에서의 처리**(문항 ID·학년은 바꾸지 않는다):

| R(자기 학년) | 처리 |
|---|---|
| 0~9 | 표대로 tier |
| < 0 | R 대신 0으로 보고 위 순서대로(대개 basic), `too_easy` 표시. 버리지 않는다(학년 적합은 S4 Claude grade 판정이 정한다). 한 학년에서 10%를 넘으면 S6 보충 배분을 고친다 |
| > 9 | `too_hard` → S3 수정 목록(낱말은 그대로, 지문·보기·해설을 그 학년 말로). 고친 뒤에도 > 9면 challenge + 표시, S4에 맡긴다 |
| 판정자 `elementaryFit ≠ pass` | S3 수정 목록. 두 번 고쳐도 안 되면 버림 |

판정 예(Antigravity 제시, 축 L1·L2 / T1·T2·T3):

| 학년 | 문항 | 점수 | V | 결과 |
|---|---|---|---|---|
| 4 | 어리둥절하다 · cloze · standard · 47음절 | 1·1 / 0·0·0 | 4 | 4학년 basic, 띠 4~4 |
| 4 | 단서 · synonym · standard · 53음절 | 1·2 / 2·1·0 | 9 | 4학년 advanced, **5학년 basic으로 위로 공유** |
| 5 | 거두다(성과를 얻다) · definition · polysemy · 82음절 | 2·2 / 2·1·1 | 12 | 5학년 core, 6학년 core(하한 적용) |
| 5 | 시치미를 떼다 · cloze · idiom · 61음절 | 2·1 / 2·0·3 | 11 | 5학년 advanced(하한), 경계어라 4학년 challenge 후보(D5) |
| 6 | 절충하다 · cloze · standard · 69음절 | 3·3 / 2·1·0 | 15 | 6학년 core, 띠 6~6 |
| 6 | 지양하다 · usage · confusable · 116음절 | 2·3 / 3·3·2 | 18 | 6학년 advanced, 116 > 100음절이라 준비 문제 전용 |

### 3.3 두 판정자 합치기 (Claude 없이)

Argon과 Codex는 서로의 판정을 보지 않고 매긴다. T2의 유형·길이와 T3 기본값은 도구가 미리 넣어 불일치 자체를 줄인다.

각 판정자의 L·T로 도구가 판정자별 띠(자기 학년 ±1 가운데 `0 ≤ R(g) ≤ 9`인 학년)를 먼저 계산한다. 아래 규칙을 **위에서부터 차례로 보고 처음 맞는 하나만** 적용한다(ΔL·ΔT는 두 판정자의 L·T 합계 차이, "축"은 L1·L2·T1·추론·관용구 불투명도).

| 순서 | 조건(A=Argon, C=Codex) | 결과 | 합치는 법 | 예상 비율 |
|---|---|---|---|---|
| 1 | 한쪽이라도 `elementaryFit ≠ pass` | 수정 표시 | `L = max`, `T = max`, 자기 학년만, 앞단 결함으로 S3 | 2~4% |
| 2 | ΔL 또는 ΔT의 절댓값 ≥ 3, 또는 두 띠의 교집합이 빔 | 공유 금지 | `L = max`, `T = max`, 자기 학년만 | 3~5% |
| 3 | 모든 축 차이 ≤ 1 이고 ΔL·ΔT의 절댓값 ≤ 1 | 자동 확정 | `L = ⌈(L_A+L_C)/2⌉`, `T = ⌈(T_A+T_C)/2⌉`(어려운 쪽으로 올림), 띠 = 두 띠의 교집합 | 80~85% |
| 4 | 그 밖의 모든 경우 | 보수 잠금 | `L = max`, `T = ⌈(T_A+T_C)/2⌉`, 자기 학년만, `spotCheck` 표시 | 10~12% |

`spotCheck` 문항은 배치당 5개를 Codex가 다시 판정해(근거 대조) 루브릭 예시 보강에 쓴다. Claude는 이 단계에 들어오지 않는다.

### 3.4 학년 띠 공유 규칙

| 방향 | 허용 | 받는 학년 tier | 조건 |
|---|---|---|---|
| 위로 1학년(3→4, 4→5, 5→6) | 허용 | `R(g+1)`로 다시 계산 + 하한 | `R(g+1) ≥ 0`, 합의 등급이 "자동 확정" |
| 아래로 1학년 | 2단계(D5) | challenge만 | 경계어(L 홀수)이고 T ≥ 5, `R(g−1) ≤ 9`, 받는 학년 절대 읽기량 상한(3학년 98·4학년 112·5학년 126음절) 이하, 저학년 금칙어(`lint.ts` `HARD_META_*`)가 지문·보기·해설·오답 이유에 없음, 근거가 `rubric_inferred`가 아님, **Claude 학년 단독 확인 pass** |
| 2학년 이상 건너뛰기 | 금지 | — | 3학년 문항을 5·6학년에 쓰면 유치하고, 6학년 문항을 4학년에 쓰면 선행학습이 된다 |

- 받는 학년 풀 상한: 위로 들어온 문항 ≤ 자기 학년 문항의 24%, 아래로 들어온 문항 ≤ 7%.
- 공유해도 문항 ID·`q.grade`는 원학년 그대로다. 받는 학년 은행에 수록하고 판 번호·서버 재채점 키는 받는 학년 기준으로 만든다(W5). 철회는 ID@revision 기준이라 모든 학년에 함께 걸린다.
- 같은 판에서 위로 공유 문항은 30% 이하(§3.7).

### 3.5 학년 근거 출처와 없을 때

| 우선 | 근거 종류(`basisType`) | 출처 | `gradeBasis.unit` 형식 |
|---|---|---|---|
| 1 | `corpus_graded` | 국립국어원 한국어기초사전 어휘 등급(초급≈3학년, 중급≈4~5학년, 고급≈5~6학년). 조회는 W9 | `krdict:중급` |
| 2 | `curriculum_explicit` | 2022 개정 국어과 교육과정 성취기준(교육부 고시 제2022-33호). 저장소의 정본 목록 `content-source/reference/curriculum-2022.json`에 있는 코드만 쓴다(O-A6·O-C6) | `[4국04-01] 단어와 단어 간의 의미 관계` |
| 3 | `stdict_structural` | 이미 받은 표준국어대사전 근거 파일의 전문 분야 표지·뜻 번호·관용구/속담 등재 | `stdict:전문어 표지 없음` |
| — | `rubric_inferred` | 위 셋이 모두 없을 때 | `rubric_inferred(L=2,T=0)` |

- 교육과정은 학년이 아니라 학년군(3~4, 5~6)으로 고시되어 있다. 군 안의 학년은 L·T로 나눈다.
- 정본 목록은 Antigravity가 공식 PDF에서 옮기고 Codex가 원문과 대조했다(64개 모두 일치, `b918355`). 기억으로 쓴 코드는 틀릴 수 있다(예: `[4국04-03]`은 의미 관계가 아니라 문장의 짜임). 판정자에게는 코드와 원문을 함께 준다.
- **교과서 단원명·쪽수를 쓰지 않는다**(확인할 수단이 없어 지어내기 쉽다). lint가 `\d+쪽`, `\d+단원` 패턴과 정본 목록에 없는 성취기준 코드를 막는다(W4a).
- `rubric_inferred`는 두 판정자의 L 차이가 1 이하일 때만 자동 확정이 되고, 아래로 공유하지 않는다. 전문 분야 표지가 있거나 한쪽이라도 초등 밖이라고 하면 S3 수정 목록으로 보낸다.
- `gradeBasis`는 본문 해시 밖이라 S1에서 고쳐도 기존 검수가 무효가 되지 않는다. S4 관문 전에 끝내고 그 뒤에는 잠근다.

### 3.6 학년별 분포 목표 (자기 학년 공개분 약 1,050 기준)

| 축 | 항목 | 목표 | 지금(4학년) |
|---|---|---|---|
| 낱말 | 서로 다른 낱말 / 뜻 | 560~650 / 730~830 | 366 / 507 |
| tier | basic · core · advanced · challenge | 25% · 35% · 24% · 16% | 26 · 31 · 22 · 21 |
| 교차 | basic은 전부 standard, 전투 읽기량 통과 ≥ 95% | — | — |
| 교차 | **Normal용 advanced(standard·polysemy, 전투 상한 이하) ≥ 150**, 120 밑이면 G3·G5 불통과 | Normal은 10칸 중 3칸이 advanced인데 변형은 standard·polysemy만 받는다. 단위 시험이 아니라 관문 보고(`coverage-report.mjs`)로, 자기 학년 공개분에만 적용한다(시범·후보·연습 은행에 걸면 처음부터 막힌다) | 측정 예정 |
| 변형 | standard · polysemy · confusable · idiom_proverb · dialect | 58~64% · 16~18% · 8~10% · 7~11% · 3~5% | 68 · 18 · 2 · 7 · 4 |
| 유형 | definition · cloze · synonym · antonym · usage | 25% · 27% · 18% · 13% · 17% | 36 · 22 · 16 · 7 · 19 |
| 읽기 | 전투 상한 이하 | ≥ 82%(4학년)·84%(5학년)·85%(6학년) | 81% |
| 난이도 바닥 | Easy · Normal · Hard·Crazy 출제 가능 | ≥ 550 · 750 · 700 | 597 · 805 · 777 |

S6 보충 제작은 이 표에서 모자란 칸을 먼저 채운다. 지금 기준으로는 **confusable(약 +70), antonym(약 +60), cloze·synonym, 새 낱말**이 우선이고, definition은 새로 거의 만들지 않는다.

### 3.7 반복 노출 (중복은 허용, 출제에서 막는다)

- **은행에서 같은 낱말 문항을 잘라내지 않는다**(사용자 지시: 중복 허용, 수량 최대).
- 새로 만드는 문항 규칙: 새 낱말 ≥ 60%, 한 학년에서 같은 낱말 최대 4문항(다의어 5), 같은 뜻은 유형을 달리해 최대 2문항.
- 한 판 안에서(W8): 같은 문항 1회, 같은 뜻(`senseKey`) 1회, 같은 낱말은 Easy·Normal 1회, Hard·Crazy 2회(8문항 간격). 위로 공유 문항 ≤ 30%.
- 풀이 이력은 학년별이 아니라 문항 ID 전체로 남겨, 학년을 바꿔도 이미 푼 공유 문항을 뒤로 미룬다(W8).

### 3.8 Antigravity 안에서 바꾼 점

| Antigravity 안 | 바꾼 것 | 이유 |
|---|---|---|
| 판정이 크게 갈리면 Claude가 근거를 대조해 최종 판정 | 공유 금지·보수값·S3 수정 목록으로 처리 | Claude 사용 최소화. 자기 학년 적합성은 어차피 S4 Claude grade 판정이 본다 |
| 빌드할 때 낱말당 4문항 초과분을 잘라냄 | 잘라내지 않고 한 판 안의 반복만 막음 | 사용자 지시(중복 허용, 최대한 많이) |
| 학년당 1,050 중 약 26%를 다른 학년 유입으로 채움 | 자기 학년 1,000 이상을 따로 채우고 공유분은 그 위에 얹음 | "학년마다 1,000"의 하한이 공유로 부풀려지지 않게 |
| `originGrade` 필드 추가 | `q.grade`를 원학년으로 두고 은행 학년 일치 검사만 띠 기반으로(Codex 조사 추천안) | 같은 사실을 두 필드에 두지 않는다 |

---

## 4. 공정 (단계별 세부)

각 단계는 "아직 안 한 것만" 처리하므로 끊겨도 다시 돌리면 이어 간다. **모델 호출은 병렬로 하되, 추적 파일 쓰기·빌드·커밋은 한 잠금 안에서 차례로 한다**(§8). 수정으로 revision이 오른 문항은 언제나 S1로 돌아가 다시 판정받는다.

### S0. 도구 준비와 시범 (1~2일)

**레인 A의 W1a·W2a·W2b, 레인 B의 W7, 레인 C의 W4a·W4b가 끝나야 S1에 들어간다(G0).** W2c·W1b·W9는 시범과 함께, W5·W6·W8은 S7·S8 전까지만 끝나면 된다.

시범: `Q50-G4-001`, `Q50-G5-001`, `Q50-G6-001` 세 배치를 S1~S5 전 과정으로 돌린다.

| 재는 것 | 판단 |
|---|---|
| 단계별 통과율(앞단·관문·수정 후) | §2 가정 고침, 보충 배치 수 확정 |
| 배치당 걸린 시간, 사용량 한도 대기 횟수, **브리지 호출 수(시간당 상한 40)** | 동시 실행 수(`--claude/--codex/--argon`)와 일정(§9) 확정 |
| Sonnet 관문 지적률 | 15% 미만이면 Opus 20문항 대조(D1) |
| 수준 판정 등급 비율(§3.3) | 자동 확정이 70% 밑이면 루브릭 예시 보강 후 재판정 |

완료 기준: 세 배치가 잠금 안에서 커밋되고, 그 커밋에서 `bank-build.test`·`content.test`·`npm run test:server`가 통과하며, 4·5·6학년 공개 은행이 각각 30문항 이상 생겨 게임에서 학년이 열린다.

### S1. 수준 판정·학년 근거 보강 (Argon·Codex, Claude 없음)

| 항목 | 내용 |
|---|---|
| 입력 | 배치의 현재 revision 문항(정답·해설·사전 근거 포함. 수준 판정은 블라인드 풀이가 아니다) |
| 하는 일 | ① 도구가 T2의 유형·길이 점수, T3 기본값, `readingLoad`, 사전 근거의 전문 분야 표지, 한국어기초사전 등급(W9, 없으면 "조회 불가"로 기록)을 미리 채운다. ② Argon이 L1·L2·T1·추론·관용구 불투명도·`elementaryFit`·근거를 낸다(O-A2). ③ Codex가 서로 모르게 따로 낸다(O-C3). ④ 도구가 §3.2·§3.3으로 자기 학년 tier와 띠를 정한다. ⑤ Argon이 `gradeBasis`를 §3.5 형식으로 보강한다(O-A5). ⑥ `too_hard`·`elementaryFit ≠ pass`는 앞단 결함으로 S3에 넘긴다 |
| 다시 판정 | S3·S5에서 revision이 오른 문항은 재검수 전에 S1을 다시 거친다. 수준 합의는 revision마다 따로다. 재판정은 배치를 넘어 50문항씩 모은다(W2c) |
| 산출물 | `content-source/levels/<batchId>.json`(판정자별 점수·합의·`levelAssessmentHash`), 초안의 `difficultyTier`·`gradeBasis` 갱신 |
| 해시 영향 | 없다. `difficultyTier`·`gradeBasis`는 `contentHashInput`과 `make-blind-input.mjs` 복제본 모두에서 해시 밖이다(Codex 확인) |
| 완료 기준 | 배치 전 문항에 현재 revision의 합의 기록 |

### S2. 앞단 검수 (Codex 전수, 새 문항만 Argon 새 문맥)

| 항목 | 내용 |
|---|---|
| Codex | 현재 revision·해시의 Codex 검수가 없는 문항 전부(P2) + D3 재검수분. `review.mjs` 2단계(블라인드 → 공개 대조), `gpt-6-astra` effort high |
| 블라인드 수준 | Codex는 새 세션(`--ephemeral`)에 정답 없는 입력만 받고 쓰기가 막힌다(`-s read-only`). **저장소 파일 읽기 자체는 막지 못하므로 "프롬프트 기반 블라인드"로 기록한다.** S1 수준 판정 세션을 재사용하지 않는다 |
| Argon 새 문맥 | S6에서 새로 만든 문항의 첫 판에만 한다. 수정판에는 다시 하지 않는다(공개 규칙에 필요 없고, 쓴 모델이 자기 수정판을 보는 것이라 독립성이 약하다. 브리지 호출을 아낀다) |
| D3 재검수 | 기존 `codex.json`은 `content-source/reviews/archive/<batch>.codex.v1.json`으로 옮기고 새로 받는다(W1b `--archive-existing codex`). 지우지 않는다 |
| 완료 기준 | 배치 전 문항에 현재 revision의 Codex 판정 |

### S3. 앞단 수정 루프

- **앞단 판정**(W2a `frontGate`): 현재 revision·해시에 대해 ① Argon 자체 반박에서 정답만 맞음 ② Codex 독립 풀이 일치 + source·uniqueness·grade·language pass ③ 현재 revision의 수준 합의(§3.3 금지 조건 없음) ④ 게시 형식·의미 검사(`lintQuestion`) ⑤ 문항별 엄격 검사(`lintBatchStrict`, basic 읽기량 포함) ⑥ Argon 새 문맥 판정이 있으면 pass. **Claude 검수·해설 대조는 요구하지 않는다.**
- 하나라도 실패한 문항은 실패 사유와 findings를 붙여 `revise.mjs`로 Argon에게 보낸다. 지금 `flagged`는 `decide` 사유만 보므로 Argon 새 문맥 실패를 놓친다(실측 62문항: 3학년 16·4학년 33·5학년 7·6학년 6). W2a가 이를 고친다. "Claude 검수 없음" 같은 미완 사유는 기존처럼 결함이 아니다.
- **수정 횟수**: 이번 작업의 앞단·관문 회차를 `content-source/batches/<batch>/revise-log.json`에 남기고 재시작해도 이어 쓴다. 기존 revision 번호로 버리지 않는다(5학년 rev 3 59문항, 6학년 54문항이 첫 지적에 바로 버려지는 것을 막는다). 한도(앞단 2회·관문 2회)는 지시문과 `parseRevisions`가 같이 강제한다.
- 고친 문항(revision+1) → S1 재판정 → Codex 재검수. 배치를 넘어 모아서 보낸다(W2c).
- **배치 엄격 검사**(Q50 배치: 정답 위치 16~34%, 같은 번호 4연속 금지, abcd 순환 금지): 수정·버림 뒤 다시 돌린다. 배치 단위 결함은 아직 Claude 관문을 통과하지 않은 문항의 보기 순서를 바꿔(revision+1, 재검수 대상) 해소한다. 전부 버린 배치는 `drafts.json`을 비우지 않고 종료 표시(`content-source/batches/<batch>/closed.json`)를 남긴다. 로더가 이를 건너뛴다(W2a).
- 수정·버림을 반영하면 `blind-input.json`을 현재 초안으로 다시 만든다(`tools/make-blind-input.mjs`). 옛 입력은 `content-source/reviews/archive/`로 옮긴다. 검수 보고서의 옛 revision 항목은 그대로 둔다.
- 앞단 2회가 끝나도 남으면 버림 → S6 대체 목록. **Claude는 이 단계에 들어오지 않는다.**

### S4. Claude 관문

| 항목 | 내용 |
|---|---|
| 입력 | 앞단 판정(S3)을 통과한 문항만. 현재 revision의 수준 합의가 있어야 한다 |
| 방식 | `review.mjs` claude 2단계. 1단계는 정답·해설·뜻풀이 없이 풀기, 2단계는 공개 대조. 2단계 해설 판정이 총괄 해설 대조(`approvals/<batch>.explanation.json`)가 된다 |
| 모델 | D1 권장: `claude-sonnet-5-5`, effort high. 파일·명령·웹 도구 차단(기존 그대로, Claude 쪽은 권한으로 블라인드) |
| 묶음 | 첫 관문은 배치 그대로(약 48문항), 재검수는 배치를 넘어 50문항씩(W2c). 입력에 해시·수준 판정·다른 검수 의견은 넣지 않는다 |
| 출처 기록 | 항목마다 실제 모델·effort·실행 ID(W1b). Sonnet 결과를 Opus로 적거나 덮어쓰지 않는다 |
| 완료 기준 | 관문 입력 전 문항에 `claude.json`·해설 대조 판정 |

### S5. 관문 수정 루프

Claude 지적 → Argon 수정(관문 회차 +1) → S1 재판정 → Codex 재검수 → 앞단 판정 → Claude 재검수. 고친 문항만, 배치를 넘어 모아서. 관문 2회가 끝나도 남으면 버림 → S6 대체 목록. 통과한 문항은 다시 보지 않는다.

### S6. 보충 제작 (첫날부터 병렬)

| 순서 | 담당 | 내용 | 산출물 |
|---|---|---|---|
| 1 | Argon(O-A1) | 학년별 새 낱말 목록. 기존 낱말 제외, §3.6 모자란 칸 우선. 관용 표현은 `kind`를 `idiom`·`proverb`로 나눠 적는다 | `content-source/wordlists/g<N>-r<라운드>.json` |
| 2 | Codex(O-C5) | 목록 검사(겹침·사전 존재·분포). 조회만 하고 근거 파일은 쓰지 않는다 | 같은 파일의 `checked` |
| 3 | 도구(W7) | `checked=true` 항목을 `[{kind, lemma}]` 배열로 바꿔 `fetch-evidence`에 넘긴다(지금 `--file`은 최상위 배열만 받고 `{"items":…}`를 넣으면 깨진다). 낱말·품사·뜻 번호와 받은 근거가 맞는지 검사 | `batches/<batch>/evidence/**` |
| 4 | Argon(O-A3, W7) | 12문항씩 초안 + 자체 반박(JSON 답장 → 도구가 스키마·의미 검사 뒤 기록) | `batches/<batch>/{drafts,sidecar}.json` |
| 5 | 도구(W7) | 50문항을 모은 뒤 **검수 전에** `lintBatchStrict`(정답 분포·연속·순환)를 맞춘다. 보기 순서 조정은 첫 검수 전이라 revision을 올리지 않는다 | 같은 파일 |
| 6 | — | S1부터 같은 공정(새 문항은 S2에서 Argon 새 문맥 1회 포함) | — |

### S7. 학년 띠 공유 (D2)

1. 학년별 자기 문항 승인이 1,000을 넘으면 루프를 멈춘 지점에서 W5를 통합한다(빌드 계약이 바뀌므로).
2. §3.4 규칙과 S1 합의 띠로 수록 후보를 고른다(도구 계산만).
3. D5를 켜면 아래로 공유 후보만 Claude 학년 단독 확인(짧은 Sonnet 호출, 50문항씩)을 받는다.
4. `build:bank`가 받는 학년 은행에 수록하고 학년별 판 번호를 만든다(대상 학년을 버전 산식에 넣어 서버 키 충돌을 막는다).

### S8. 빌드·검증·공개

| 순서 | 할 일 | 담당 |
|---|---|---|
| 1 | 루프 정지 후 `npm run build:bank` → `node tools/build-question-keys.mjs` | 총괄 |
| 2 | 분포 보고(`tools/content/coverage-report.mjs`, W4a): §3.6 표, 난이도별 바닥, Normal용 advanced ≥ 120 — **자기 학년 공개분에만** 적용 | 총괄 |
| 3 | `npm run verify` 한 번, `npm run test:server` 한 번 | 총괄 |
| 4 | 로컬 서버에 새 seed 적용 → 4·5·6학년 각각 한 판 끝까지 플레이 → 기록 제출이 서버 재채점을 통과하는지 확인(`VERSION_REJECTED`·`ANSWER_MISMATCH` 없음) | 총괄(Claude 내장 브라우저) |
| 5 | W6 학년별 지연 적재가 들어간 production build의 첫 청크·학년 청크 크기 확인 | 총괄 |
| 6 | `EXECUTION_BOARD.md`·`HANDOFF.md` 갱신, 커밋, push | 총괄 |
| 7 | 배포·운영 서버 seed 적용 | **사용자 확인 뒤** |

---

## 5. 역할과 모델 배정

| 담당 | 모델(경로) | 맡는 일 | 대략 분량(4~6학년 1라운드, §9) |
|---|---|---|---|
| **Antigravity** | Gemini 4 Argon High(브리지 `standard`/`deep`) | 새 낱말 목록, 초안 제작·자체 반박, 수준 1차 판정, 학년 근거 보강, 모든 수정, 새 문항의 새 문맥 검수, 성취기준 정본 초안 | 약 420회 호출(시간당 상한 40이라 일정의 병목) |
| **Codex** | gpt-6-astra high(검수·수준 판정은 `codex exec`, 코드는 브리지 `deep`) | 블라인드 검수 전수, 수준 2차 판정, 낱말 목록 검사, 성취기준 대조, 도구 코드, 관문 통계 보고 | 검수 약 250회 + 수준 판정 약 125회 + 코드 약 15조각 |
| **Claude 관문** | Sonnet 5.5 effort high(`claude -p`, 도구 차단) | S4·S5 블라인드·공개 대조·해설 대조, D5 학년 단독 확인 | 약 225회 호출, 약 5,500문항 × 2단계 |
| **Claude 총괄** | 이 세션 | 지시서 발송, 도구 실행(백그라운드), 관문 판정, 사용자 보고. **문항 본문은 읽지 않고 요약 보고서만 본다** | 관문마다 요약 1회 |
| Claude 서브에이전트 | Sonnet | Codex 브리지가 같은 조각에서 두 번 끊기면 그 조각을 대신 | 필요할 때만 |
| 사용자 | — | D1~D5 결정, 베타 플레이, 배포 승인 | — |

브리지 Codex는 10/31·11/3에 긴 작업이 "처리 프로세스 없음"으로 끊긴 적이 있다. 그래서 코드 조각은 **한 번에 150~200줄, 30분 안**으로 자른다. 검수·수준 판정은 브리지를 거치지 않는 `codex exec`라 해당 없고 시간당 상한도 쓰지 않는다.

---

## 6. 작업 지시서

### 6.1 코드 조각 (Codex, 브리지 `deep`)

공통 머리말(모든 조각에 붙인다):

```text
작업 폴더: /Users/bodyking/Desktop/Architecture/towerdeffense (단일 폴더, worktree 금지)
규칙: AGENTS.md를 따른다. 아래 "고칠 파일" 밖은 건드리지 않는다. 남의 미커밋 변경을 되돌리지 않는다.
계획: docs/CONTENT_REVIEW_PLAN.md의 해당 절을 먼저 읽는다.
커밋: git add -- <고칠 파일> && git commit --only -- <고칠 파일> (git add -A·git commit -a 금지)
검사: 바뀐 범위의 시험만 돌리고 결과를 보고한다. 기대값을 바꿔 통과시키지 않는다. 같은 실패 3회면 멈추고 보고.
       server/** 를 바꾸면 커밋 전에 npm run test:server.
보고: 바꾼 파일, 커밋 SHA, 돌린 시험과 결과, 남은 일. 5줄 요약 + 필요하면 .orchestrate/wp/<조각>.md에 전문.
```

| 레인 | 조각 | 고칠 파일 | 내용 | 완료 기준 |
|---|---|---|---|---|
| A-1 | **W1a** 검수자별 모델 설정 | `tools/orchestrate/review.mjs`, `tools/orchestrate/content-loop.mjs`, 새 `tests/unit/orchestrate-config.test.ts` | `--claude-model/--claude-effort/--codex-model/--codex-effort`(CLI > 환경변수 `REVIEW_*` > 기존 기본값). 해석한 설정을 blind·reveal·ingest에 같은 값으로. 역할과 모델 계열이 다르면 거절. blind와 reveal의 설정이 다르면 거절. `isCommanderModel`은 그대로(Sonnet도 통과) | 새 시험 통과, `review.mjs status` 정상 |
| A-2 | **W2a** 앞단 판정·수정 연결 | 새 `tools/content/frontGate.ts`, `tools/orchestrate/revise.mjs`, `tools/content/bankBuild.ts`(`loadBatches`가 `closed.json` 배치 건너뛰기만), 새 `tests/unit/front-gate.test.ts` | §4 S3의 앞단 판정 ①~⑥. `flagged`를 앞단 결함 기준으로(Argon 새 문맥 실패 포함). `revise-log.json` 회차 기록·이어 쓰기, 지시문과 `parseRevisions`가 같은 한도 강제(revision 번호 기준 버림 삭제). 배치 엄격 결함을 미관문 문항 보기 순서 조정으로 해소하는 함수. W4a의 `levels.ts`를 읽는다(W4a 커밋 뒤 시작) | `g4-argon-0107@2`처럼 Argon 새 문맥만 실패한 문항이 결함으로 잡히는 시험, 회차 이어 쓰기 시험 |
| A-3 | **W2b** 대기·잠금·배치 커밋 | `review.mjs`(ingest 결과를 `.orchestrate/staging/<batch>/`에 대기), `content-loop.mjs`(`--gate` 순서 S1→S2→S3→S4→S5, `--commit` 잠금), `tools/make-blind-input.mjs`(배치 하나 다시 만들기), `tests/unit/bank-build.test.ts`(4~6학년 공개·후보 생성/비생성 상태까지 대조), 새 `tests/unit/content-loop-lock.test.ts` | 잠금 안에서: 대기 결과 반영 → `blind-input.json` 재생성 → `build-bank` → `build-question-keys` → `npm run test:server` → `git add` → `git commit --only`(배치 경로·`levels`·레지스트리·`grade*.json`·삭제된 후보 파일·`server/seed/question_keys.sql`). 다른 배치의 추적 파일은 늘 커밋된 상태여야 한다 | 두 배치 결과가 엇갈려 도착해도 각 커밋의 소스만으로 레지스트리·은행이 재현되는 시험 |
| A-4 | **W2c** 배치를 넘는 묶음 | `review.mjs`, `revise.mjs`, `content-loop.mjs` | 재검수·재판정·수정 대상을 배치를 넘어 50문항(수정은 12문항)씩 모아 보내고, 결과를 questionId로 배치별 보고서에 나눠 넣는다 | 3배치 혼합 묶음 분배 시험 |
| A-5 | **W1b** 항목별 실행 출처 | `src/contracts/questionDraft.ts`(선택 필드 `run:{id,model,effort}`), `review.mjs` ingest, `tests/unit/content.test.ts` | 섞인 모델 결과를 항목 단위로 기록. 기존 보고서 호환. `--archive-existing codex`(D3) | 기존 보고서 파싱·해시 그대로 |
| A-6 | **W3** 단일 배치 로더(선택) | `bankBuild.ts`(`loadBatch`), 호출부, `bank-build.test.ts` 공통 계산, 시드 시험 `maxBuffer` | 지금 전체 빌드 1.66초라 급하지 않다. 시범에서 루프가 느리면 한다 | 레지스트리 바이트 동일 |
| B-1 | **W7** 보충 제작 실행기 | 새 `tools/orchestrate/produce.mjs`, 새 `tests/unit/produce.test.ts` | §4 S6 3~5단계. 목록 → `[{kind,lemma}]` → `fetch-evidence` → Argon 12문항씩 → 스키마·`lintQuestion`·자체 반박 검사 → 50문항 조립 → 검수 전 `lintBatchStrict` 맞춤 → W2b 대기 경로로 | 3문항 시범 배치 통과 |
| B-2 | **W9** 한국어기초사전 등급 | 새 `tools/fetch-krdict-grade.mjs`, `content-source/reference/krdict-grade.json` | 낱말마다 초급·중급·고급·없음. 웹 조회가 막히거나 약관상 안 되면 멈추고 보고(공개 API 키가 필요하면 **사용자가 발급**) | 4학년 낱말 366개 결과 |
| C-1 | **W4a** 수준 계약·계산·검사 | 새 `src/contracts/levels.ts`, 새 `tools/content/levels.ts`, `src/content/lint.ts`(`gradeBasis.unit` 형식), 새 `tests/unit/levels.test.ts`, 새 `tools/content/coverage-report.mjs` | §3.2 계산(하한·basic 읽기량 순서 포함), §3.3 우선순위 규칙, `levelAssessmentHash`(revision이 바뀌면 무효). `unit`은 정본 성취기준 코드·`krdict:`·`stdict:`·`rubric_inferred(...)`만, `\d+쪽`·`\d+단원` 금지. 분포 보고는 시험이 아니라 관문 보고용 스크립트 | §3.2 예 6개, §3.3 경계·중복·미분류 조합 시험 |
| C-2 | **W4b** 수준 판정 실행기 | 새 `tools/orchestrate/level.mjs`, 새 `tests/unit/level-runner.test.ts` | Argon(브리지 JSON, 4.4KB 넘으면 `~/.gemini/antigravity-cli/brain/<id>/`에서 전문)·Codex(`codex exec` 읽기 전용)에 50문항씩. 결과는 W2b 대기 경로로. 근거 조회 불가는 명시 기록. **W4a·W2b 커밋 뒤** | 1배치 실행 |
| D-1 | **W5** 학년 띠 공유 빌드 | `src/contracts/questions.ts`, `tools/content/bankBuild.ts`, `src/content/lint.ts`(받는 학년 기준 검사 진입점), `tools/build-bank.mjs`, `tools/build-question-keys.mjs`, `src/content/index.ts`, `src/application/lobby.ts`, `src/persistence/reviewNote.ts`(`(bankId,senseKey)` 키, v1 이전), 해당 시험 | Codex 조사 추천안: 원 ID·`q.grade` 유지, 선택 `gradeBand`, 받는 학년 은행에 빌드 때 수록, **버전 산식에 대상 학년 포함**. 서버 코드 0줄 목표. 셋으로 나눠 발송(계약·빌드 / 키 seed·서버 시험 / 오답 노트). **루프 정지 지점에서 통합** | `bank-build`·`content`·`question-seed`·`review-note`·`retraction`·`lobby` 시험, `test:server` |
| D-2 | **W6** 학년별 지연 적재 | `src/content/index.ts`, `tools/build-bank.mjs`(작은 manifest), `src/application/{session,qaRun,mapPreview,lobby}.ts`, `src/ui/App.tsx`, `NewGameScreen.tsx`, `ResultScreen.tsx`, 홈 `SteleStudyPanel.tsx`·`RankingBoard.tsx` | 학년당 1,000+면 eager 적재가 최소 JSON 3.7~6MB(gzip 0.8~1.3MB)로 커진다(Codex 추정). 선택 학년만 적재, "아직 안 불러옴"과 "미공개"를 구분. **W5 커밋 뒤, 홈 파일의 남의 미커밋 변경이 커밋된 뒤** | 관련 단위 시험, e2e 1개, 청크 크기 |
| D-3 | **W8** 한 판 반복 규칙 | [선행 조사 완료](CR1000_W8_RESEARCH.md)(2026-11-06): 출제 큐·풀이 이력 저장 위치·변경 파일 확정. W5 → W6 뒤에 §3.7 구현 | `domain/{quiz,types,run,context}`·전역 ID 이력·시작/완료 경계, 상세는 조사서 | 같은 시드·시작 이력 복사본·명령 입력의 재현성 유지 |

순서와 의존:

```text
1일차 발송:  A-1 W1a ─┐            B-1 W7 → B-2 W9          C-1 W4a
                      └→ A-2 W2a(W4a 커밋 뒤) → A-3 W2b → C-2 W4b(W2b 뒤) → G0 → 시범
시범과 함께: A-4 W2c → A-5 W1b → (필요하면) A-6 W3
시범 뒤:     D-1 W5 → D-2 W6 → D-3 W8   (겹치는 파일이 있어 반드시 차례로)
```

같은 파일을 두 레인이 동시에 고치지 않는다: `review.mjs`·`revise.mjs`·`content-loop.mjs`·`bankBuild.ts`는 레인 A만(W5는 루프 정지 뒤), `lint.ts`는 C-1 → D-1 순서, `src/content/index.ts`·`build-bank.mjs`·`lobby.ts`는 D-1 → D-2 순서.

### 6.2 문항 작업 지시 (Antigravity, 브리지 `standard` = Argon High)

Antigravity는 읽기 전용이다. **모든 지시는 "답장 본문에 JSON으로 답하라, 명령 실행·파일 쓰기 금지"로 끝낸다.** 파일은 도구(`level.mjs`·`produce.mjs`·`revise.mjs`)가 검사 뒤 쓴다. 답장이 브리지에서 약 4.4KB로 잘리면 도구가 `~/.gemini/antigravity-cli/brain/<conversation_id>/`에서 전문을 읽는다.

**O-A1 새 낱말 목록** (학년·라운드마다 1회)

```text
[새 낱말 목록 — <N>학년 보충 <R>라운드]
명령 실행·파일 쓰기 금지. 결과는 답장 본문에 JSON 하나로.
목표: 초등 <N>학년 어휘 4지선다용 새 낱말 <K>개(보충 문항 수의 0.6배 이상).
제외: 아래 "이미 쓴 낱말" 전부(모든 학년).
우선: 아래 "모자란 칸"(tier·변형·유형) 순서대로. basic standard를 15개 이상.
각 낱말: kind(word·idiom·proverb·dialect), lemma, partOfSpeech, 예상 L1·L2(루브릭 §3.1), 쓸 뜻 번호(표준국어대사전),
추천 유형 1~2개, variantTag, 학년 근거(§3.5 형식. 교과서 단원명·쪽수 금지).
같은 표제어·품사·뜻 번호의 동음이의 항목이 여러 개면, 제공된 사전 조회 결과에서 선택한
sourceEntry:{provider:"stdict"|"opendict",entryId:"양의 정수 문자열"}를 덧붙인다. ID를 추측하지 않는다.
지정한 항목의 뜻·학년 적합성은 O-C5에서 독립 확인하기 전까지 checked:true로 하지 않는다.
금지: 사전에 없는 낱말, 비속어·공포·차별 표현, 6학년보다 어려운 전문어.
{"items":[{"kind":"word","lemma":"…","partOfSpeech":"…","expectedL1":1,"expectedL2":1,"senseOrder":2,"types":["cloze"],"variantTag":"standard","gradeEvidence":"…"}]}
----- 이미 쓴 낱말 ----- (도구가 붙임)
----- 모자란 칸 ----- (도구가 붙임)
```

**O-A2 수준 1차 판정** (`level.mjs`가 50문항씩 자동 발송) — 루브릭 §3.1 전문과 §3.2 판정 예, 문항(정답·해설·사전 근거 포함), 도구가 미리 채운 값(T2 유형·길이, T3 기본값, 읽기량, 등급). 출력 `{"items":[{"questionId","revision","L1","L2","T1","inference":0,"idiomOpacity":null,"elementaryFit":"pass","basisType","unit","reason"}]}`. tier·띠·V·R은 도구가 계산하므로 묻지 않는다.

**O-A3 초안 제작** (`produce.mjs`가 12문항씩) — [작업 지시문 §5](model_work_orders_v0_5.md)의 문항 규칙 전문 + 이번 낱말·근거 전문(evidence 텍스트) + 목표 tier·유형 + "지문·보기·해설·오답 이유에 목표 낱말 외에 그 학년보다 어려운 낱말 금지, 해설 1~2문장 60자 이내, 오답 이유는 화면에 그대로 보이는 한 문장, basic은 전투 읽기량 상한+12음절 이하" + 자체 반박(4보기 모두 대입) 형식.

**O-A4 수정** — 기존 `revise.mjs` 지시문에서 버림 규칙만 W2a대로 바꾼다: "이번 작업에서 앞단 2회 또는 관문 2회를 이미 고친 문항이 또 지적되면 버린다"(revision 번호로 판단하지 않는다). 낱말·근거 변경 금지, 못 고치면 drop은 그대로.

**O-A5 학년 근거 보강** (`level.mjs`의 같은 호출에 포함) — `gradeBasis.unit`을 §3.5 형식 네 가지 가운데 하나로. 교과서 단원명·쪽수는 쓰지 않는다.

**O-A6 성취기준 정본 목록 초안** (1회, 브리지 `deep`, Aside 브라우저 읽기 허용) — 교육부 고시 제2022-33호 국어과 교육과정 원문(국가교육과정정보센터)에서 3~4학년군·5~6학년군 성취기준 코드와 원문 한 줄을 그대로 옮긴 JSON을 답장으로. 원문에서 확인하지 못한 코드는 넣지 않는다. 항목마다 출처 URL과 확인한 쪽을 단다. 도구가 `content-source/reference/curriculum-2022.json`으로 쓰고, Codex 대조(O-C6) 뒤 커밋한다.

### 6.3 검수·판정 지시 (Codex)

**O-C1 블라인드 검수**: `review.mjs` 기존 지시문(블라인드 → 공개 대조). 모델만 `gpt-6-astra`·high로(W1a). 기록에는 "프롬프트 기반 블라인드(읽기 전용 새 세션)"로 남긴다.

**O-C3 수준 2차 판정**: O-A2와 같은 루브릭·입력·형식(`level.mjs`가 `codex exec` 읽기 전용으로 50문항씩). Argon 판정은 보여 주지 않는다.

**O-C5 낱말 목록 검사** (브리지 `standard`):

```text
[낱말 목록 검사 — content-source/wordlists/g<N>-r<R>.json]
쓰기는 이 목록 파일의 checked·reason 필드만. 근거 파일(evidence)은 만들지 않는다.
1) 기존 초안(content-source/batches/**/drafts.json)의 낱말과 겹치는지 2) 다른 학년 목록과 겹치는지
3) 표준국어대사전에 그 품사·뜻 번호가 있는지(조회만, 파일 쓰기 없이) 4) §3.6 분포 칸을 얼마나 채우는지
5) kind가 idiom·proverb·dialect인 항목의 분류가 맞는지.
sourceEntry가 있으면 그 제공자·항목 ID의 실제 뜻과 후보의 품사·뜻 번호·학년 근거가 일치하는지 확인한다.
ID 지정은 조회 범위를 좁힐 뿐 승인 근거가 아니다. ID 지정 여부와 관계없이 항목을 하나로 확정하지 못하면 checked:false다.
겹치거나 사전에 없으면 checked:false와 이유. 커밋: git commit --only -- content-source/wordlists/g<N>-r<R>.json
```

**O-C6 성취기준 목록 대조** (1회, 브리지 `standard`): O-A6 결과를 같은 원문과 한 줄씩 대조해 틀린 코드·문구를 보고. 원문을 열 수 없으면 대조 불가로 보고하고 목록을 쓰지 않는다(그때 §3.5의 2순위 근거는 비워 둔다).

**O-C9 관문 통계 보고** (관문마다 `light`): `.orchestrate/content-loop.summary.json`, 레지스트리, `coverage-report.mjs` 결과로 학년별 승인·격리 사유 상위 10·분포표(§3.6)·버림 목록을 `.orchestrate/reports/<날짜>-<관문>.md`로. 총괄은 이 보고서만 읽는다.

### 6.4 Claude 관문 지시

`review.mjs`의 기존 공통·단계 지시문을 그대로 쓴다. 바꾸는 것은 모델(`claude-sonnet-5-5`)과 항목별 출처 기록뿐이다. 앞단 결과·수준 판정·다른 검수자 의견은 넣지 않는다.

---

## 7. 관문과 멈춤 규칙

| 관문 | 언제 | 통과 조건 | 못 넘으면 |
|---|---|---|---|
| G0 도구 | W1a·W2a·W2b·W4a·W4b·W7 끝 | 각 조각 완료 기준, `bank-build.test`·`content.test`·`test:server` | 실패 조각만 재지시, 같은 실패 2회면 Claude 서브에이전트로 |
| G1 시범 | S0 세 배치 끝 | 세 학년 공개 ≥ 30, 수율·시간·브리지 호출 실측 기록 | §2·§9 고친 뒤 진행. 관문 통과율 < 0.6이면 멈추고 사용자에게 보고 |
| G2 학년별 1차 | 기존 21배치 S5 끝 | 자기 학년 승인 수 확정, `test:server` | 1,000까지 모자란 수 ÷ 실측 수율로 보충 배치 수 확정 |
| G3 하한 | 보충 1라운드 끝 | 4·5·6학년 각 ≥ 1,000, `coverage-report` 바닥 조건(Normal용 advanced ≥ 120 포함) | 2라운드 필수로 전환, 모자란 칸 위주 |
| G4 공유 | W5 통합 뒤 | 출제 풀 수, 공유 비율 상한 지킴 | 공유 끔(하한은 이미 충족) |
| G5 공개 | S8 | verify·test:server·서버 재채점 포함 e2e 통과 | 고친 뒤 다시 S8 |

멈춤 규칙(과검수·무한 루프 금지):
- 재판정은 반려된 문항만. 통과 문항을 다시 보지 않는다.
- 문항 하나의 수정은 이번 작업에서 앞단 2회 + 관문 2회가 끝(`revise-log.json` 기준). 그 뒤 버림.
- 도구가 같은 묶음에서 같은 오류로 3회 실패하면 그 묶음을 건너뛰고 기록, 총괄이 하루 끝에 한 번 본다.
- 사용량 한도는 도구가 20분 기다렸다 이어 간다(기존 동작). 브리지 시간당 상한에 걸리면 같은 방식으로 기다린다.

---

## 8. 파일 소유·커밋 규칙

**잠금(임계 구역) 원칙**: 모델 호출 결과는 먼저 `.orchestrate/staging/<batch>/`에 쌓는다. 추적 파일(`content-source/**`, `src/content/questions/**`, `server/seed/question_keys.sql`)은 루프의 잠금 안에서만 쓴다. 잠금 안의 순서: 대기 결과 반영 → `blind-input.json` 재생성 → `build-bank` → `build-question-keys` → `npm run test:server`(약 20초, AGENTS.md의 `server/**` 규칙) → `git add` → `git commit --only`. 이렇게 하면 빌드가 읽는 다른 배치의 추적 파일은 늘 커밋된 상태라, 각 커밋의 소스만으로 레지스트리·은행이 재현된다.

| 경로 | 쓰는 주체 | 커밋 |
|---|---|---|
| `content-source/batches/<batch>/**`(초안·sidecar·근거·`revise-log.json`·`closed.json`) | `produce.mjs`·`revise.mjs`·`level.mjs` → 잠금 | 잠금 커밋 |
| `content-source/reviews/<batch>/**`, `content-source/reviews/archive/**` | `review.mjs`·`make-blind-input.mjs` → 잠금 | 잠금 커밋 |
| `content-source/approvals/<batch>.explanation.json` | `review.mjs`(claude) → 잠금 | 잠금 커밋 |
| `content-source/levels/<batch>.json` | `level.mjs` → 잠금 | 잠금 커밋 |
| `content-source/approvals/{registry,candidate-registry}.json`, `src/content/questions/grade*.json`(삭제 포함), `server/seed/question_keys.sql` | 잠금 안의 생성기만 | 잠금 커밋 |
| `content-source/wordlists/**`, `content-source/reference/**` | Codex(O-C5·O-C6), 도구 | 목록마다 |
| 코드 조각 파일 | §6.1 표의 담당 | 조각마다 |

**대기 형식**(W1a·W7·W4a 지시서부터 공통, 바꾸지 않는다): `.orchestrate/staging/<batchId>/<runId>/manifest.json` = `{batchId, runId, tool, model, createdAt, writes:[{path, sha256}], deletes:[path]}`, 쓸 파일의 전체 새 내용은 `.orchestrate/staging/<batchId>/<runId>/files/<저장소 상대 경로>`. `runId`는 정렬하면 시간순(예: `20261106T031500Z-<pid>`). 반영은 W2b 잠금이 `runId` 순서로 하고, sha256을 확인한 뒤 대기 폴더를 지운다. 예외: 아직 `drafts.json`이 없는 새 배치의 `evidence/`는 `fetch-evidence`가 직접 쓴다(로더가 읽지 않으므로).

- 루프가 도는 동안 위 콘텐츠 경로는 루프 전용이다. 다른 세션·에이전트는 고치지 않는다. 빌드 계약을 바꾸는 W5는 루프를 멈춘 지점에서 통합한다.
- 공개 은행이 30문항을 넘는 순간부터 그 학년이 로컬 게임에서 열리고, 커밋마다 판 번호가 바뀐다. 로컬 seed는 잠금 커밋에 함께 들어가므로 로컬 서버 시험은 맞는다. **운영 서버와 배포는 S8에서 한 번만** 한다.
- 커밋 메시지 예: `content(Q50-G4-007): S4 Claude 관문 46/48, 4학년 공개 312`.
- `.orchestrate/**`는 git 밖이다. 남길 수치는 커밋 메시지와 O-C9 보고서 요약으로 옮긴다.
- 매일 끝에 `git push`(단일 폴더 규칙대로 묻지 않고). 배포는 하지 않는다.

---

## 9. 일정과 사용량 예산 (추정, 시범 뒤 고침)

### 9.1 호출 수 셈법

가정: 배치 50문항, 앞단 지적 10%(그중 30%는 2회째), 관문 유입 97%, 관문 지적 30%(그중 30%는 2회째). 첫 판정·검수는 배치 단위(`ceil(배치 문항/50)` = 배치당 1회), 재판정·재검수·수정은 W2c로 배치를 넘어 모은다(`ceil(대상/50)`, 수정은 `ceil(대상/12)`). 2단계 검수는 ×2.

| 항목 | 4~6학년(기존 63 + 보충 18배치, 4,050문항) | 3학년 추가(기존 20 + 보충 6배치, 1,300문항) |
|---|---:|---:|
| 수정 대상 문항(앞단 + 관문 2회) | 약 2,060 | 약 660 |
| Argon 수준 판정(첫 81 + 재판정 42) | 123 | 40 |
| Codex 수준 판정 | 123 | 40 |
| Codex 블라인드(첫 162 + 재검수 84) | 246 | 79 |
| Argon 새 문맥(새 문항 18배치 × 2) | 36 | 12 |
| Argon 수정(2,060 ÷ 12) | 172 | 55 |
| Argon 제작(18배치 × ⌈50/12⌉) | 90 | 30 |
| Claude 관문(첫 162 + 재검수 62) | **224** | 72 |
| Claude 관문 문항 × 2단계 | 약 5,465 | 약 1,750 |
| **Antigravity 합계(브리지)** | **약 421** | 약 137 |

예비분(따로 잡음): 형식 오류 재시도(지금 도구는 묶음당 최대 4회), `spotCheck`(배치당 5문항, Codex), 2라운드(보충 18배치 → Antigravity 약 +200, Codex 약 +130, Claude 약 +110), D5 학년 단독 확인.

### 9.2 일정

| 기간 | 할 일 | 병렬 |
|---|---|---|
| 1일차 | A-1 W1a, B-1 W7, C-1 W4a 발송, O-A1 1라운드 낱말 목록(4·5·6학년), O-A6 성취기준 정본 초안 | 코드 3레인 + 목록 |
| 2일차 | A-2 W2a, A-3 W2b, C-2 W4b, B-2 W9, O-C5·O-C6, G0 | |
| 3일차 | 시범 S0 세 배치, A-4 W2c·A-5 W1b, G1 | |
| 4~7일차 | 4학년 21배치 S1~S5 → 5학년 → 6학년(관문 대기 중 다음 학년 S1~S3 선행), 보충 1라운드 제작 | 루프 `--claude 2 --codex 3 --argon 3` |
| 8일차 | G2·G3, 보충 1라운드 S1~S5 마무리, 레인 D 시작(W5) | |
| 9일차~ | 2라운드(필요 시), 3학년, W6·W8, S7 공유, S8 | |

**병목은 Antigravity 브리지 시간당 40회**다(`~/.agents/bridge/config.json` `maxRunsPerHour`, 다른 세션과 공유). 4~6학년 1라운드만 약 421회라 상한으로 최소 11시간, 다른 세션과 나누면 그 이상이다. 일정을 당기려면 사용자가 이 값을 올릴 수 있다(설정 변경은 사용자가 한다). Codex·Claude 검수는 브리지를 거치지 않는다.

### 9.3 Claude 사용량

최신 실측(2026-11-06): Q50-G4-001 21문항, Opus 5.5/xhigh **2회 호출**(독립 풀이 1·해설 대조 1), 재시도 0, 총 6분 27초. 사용량 잔액·전체 학년 예상 비용은 확인하지 않았다. 아래 표는 모델 변경 전 규모 추정이며 현재 계정의 사용량 보장이 아니다.

| 주체 | 규모 | 줄이는 장치 |
|---|---|---|
| Claude 관문(Sonnet) | 4~6학년 약 224회, 약 5,500문항 × 2단계(3학년 포함 약 296회) | 앞단 통과분만, 재검수는 고친 것만 묶어서, Opus 대신 Sonnet(D1) |
| Claude 총괄(이 세션) | 관문당 O-C9 요약 1회 + 잠금 커밋 확인 | 문항 본문을 읽지 않는다. 루프는 백그라운드 |

---

## 10. 위험과 대응

| 위험 | 대응 |
|---|---|
| Sonnet 관문이 Opus보다 너그러움 | 시범에서 지적률 비교(D1), 15% 미만이면 Opus 20문항 대조. 차이가 크면 Opus로 전환 |
| Codex 블라인드가 저장소의 정답 파일을 읽을 수 있음 | 사실대로 "프롬프트 기반"으로 기록. 공개에는 권한으로 막힌 Claude 블라인드가 따로 필요하다(규칙 그대로) |
| 같은 모델(Argon)이 쓰고, 고치고, 새 문맥 검수까지 함 | 공개 판정은 Codex·Claude 독립 풀이가 따로 필요하다(바뀌지 않음). Argon 새 문맥 검수는 새 문항의 첫 거름망일 뿐 승인 근거로 세지 않고, 수정판에는 하지 않는다 |
| 수준 판정 메타데이터를 고쳐 공유 범위를 몰래 넓힘 | `levelAssessmentHash`로 묶고, revision이 바뀌면 합의 무효(W4a). 공유 수록은 도구 계산만 |
| 교과서 단원 지어내기 | "미확인" 허용, Codex `unit_unverified` 표시, 단원은 승인 조건이 아님 |
| 긴 루프가 끊겨 상태 불일치 | 대기 → 잠금 반영·빌드·커밋(W2b), 회차 영속 기록, 모든 단계가 "아직 안 한 것만" 처리 |
| Antigravity 브리지 시간당 40회가 병목 | 재판정·수정을 배치를 넘어 묶음(W2c), 수정판 Argon 새 문맥 생략, 상한 조정은 사용자 판단 |
| 수정판의 수준 판정이 옛 판 그대로 쓰임 | revision마다 합의, 수정 뒤 S1 재판정을 앞단 판정 조건으로 |
| 공개 은행이 바뀌는데 서버 seed가 낡음 | 잠금 커밋마다 `build-question-keys`·`test:server`, S8에서 서버 재채점까지 e2e |
| 공개 은행이 배치마다 자라며 판 번호가 자주 바뀜 | 로컬 seed는 잠금 커밋에 함께 갱신. 운영 서버 seed·배포는 S8에서 한 번만 |
| 은행 크기로 첫 화면이 느려짐 | W6 학년별 지연 적재를 배포 전 필수로 |
| 홈 화면 파일에 남의 미커밋 변경 | W6은 그 작업이 커밋된 뒤 시작, 시작 전에 `git status` 확인 |
| 브리지 Codex 긴 작업 끊김 | 조각을 150줄·30분 안으로, 같은 조각 2회 끊기면 Claude 서브에이전트(Sonnet) |
| 같은 낱말 과다 노출 | 보충은 새 낱말 60% 이상, W8 한 판 반복 규칙, 풀이 이력 전역 기준 |
| 선행학습형 체감 어긋남(고학년 한자어가 아랫학년에) | 아래로 공유는 경계어·T ≥ 5·금칙어·읽기량·Claude 학년 확인을 모두 통과할 때만, 2학년 이상 건너뛰기 금지 |
| 고학년이 유치하다고 느낌(아랫학년 문항이 위로) | 위로 1학년만, 유입 ≤ 24%, 한 판 공유 ≤ 30% |
| Normal의 advanced 문항 부족(같은 문항 반복) | standard·polysemy advanced ≥ 150 목표, `validate:content` 120 하한 단언(W4a) |

---

## 11. 완료 정의

- [ ] `src/content/questions/grade4.json`·`grade5.json`·`grade6.json`이 `published`이고 각각 자기 학년 문항 ≥ 1,000
- [ ] 난이도별 바닥(Easy ≥ 550, Normal ≥ 750, Hard·Crazy ≥ 700)과 Normal용 advanced(standard·polysemy, 전투 상한 이하) ≥ 120 충족
- [ ] 모든 공개 문항에 같은 revision의 수준 합의 기록(`content-source/levels/**`)과 §3.5 형식의 `gradeBasis.unit`
- [ ] 모든 공개 문항에 같은 revision·해시의 Argon 자체 반박·Codex·Claude 독립 풀이·Claude 해설 대조가 있고 `bank-build.test`가 다시 계산해 일치
- [ ] Claude 관문 결과에 항목별 실제 모델·effort 기록
- [ ] `npm run verify` 1회, `npm run test:server` 1회, 로컬 서버 seed 적용 뒤 4·5·6학년 한 판 끝까지 + 기록 제출 재채점 통과
- [ ] 학년별 최종 보고: 승인 수, 출제 풀 수(공유 포함, 따로), 분포표, 버림 목록과 사유 상위
- [ ] `EXECUTION_BOARD.md`·`HANDOFF.md` 갱신, 커밋·push. 배포는 사용자 확인 뒤

---

## 부록 A. 현황 측정 명령

```bash
node -e 'const r=require("./content-source/approvals/registry.json");const by={};for(const e of r.entries){const k=e.questionId.slice(0,2)+":"+e.decision;by[k]=(by[k]||0)+1}console.log(by)'
```

```bash
npm run build:bank
```

```bash
node tools/orchestrate/review.mjs status --reviewer claude
```

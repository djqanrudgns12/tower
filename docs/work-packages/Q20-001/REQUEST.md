# Q20-001 — 3학년 문항 초안 20개(Argon 4)

```yaml
jobId: Q20-001
status: READY
owner: Argon 4
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 발행 직전 git rev-parse HEAD 값
contractHash: 발행 직전 `node tools/contract-hash.mjs Q20-001` 출력
inputFiles:
  - vocabulary_td_prd_v0_5.md
  - docs/contracts/question-draft.schema.json
  - src/contracts/questionDraft.ts
  - src/content/lint.ts
  - src/content/questions/grade3.dev.json
allowedPaths:
  - content-source/batches/Q20-001/**
forbiddenPaths:
  - src/**
  - docs/** (이 REQUEST 옆 RETURN.md만 예외)
  - package.json, package-lock.json
deliverable: drafts.json(20개 이하) + sidecar.json + evidence/ + RETURN.md
returnPath: docs/work-packages/Q20-001/RETURN.md
```

## 목적

지금 게임은 Claude가 쓴 **개발용 36문항**(`src/content/questions/grade3.dev.json`, 근거 미조회·미검수)으로 돈다. 공개 은행으로 가는 첫 묶음은 **실제 사전 근거와 학년 근거가 있는 초안**이어야 한다(PRD §9.1, §9.3). 이 작업은 초안 20개까지만 만든다. 승인은 이후 Codex·Claude의 독립 검토(QR-001/QR-002)와 이견 해소 뒤에 정해진다.

## 절차(순서대로, 건너뛰지 않는다)

1. **목표 낱말 고르기.** 아래 후보에서 20개 이하를 고른다. 후보는 제안일 뿐 근거가 아니다. 각 낱말에 대해 **현행 3학년 국어 교과서(2022 개정 교육과정 3-1·3-2, 국어·국어 활동)에 실제로 나오는 단원**을 찾아 `gradeBasis`에 적는다. 찾지 못하면 그 낱말은 쓰지 않고 sidecar `rejected`에 사유를 남긴다. 근거를 지어내지 않는다.
   후보: 꼼꼼하다, 정성, 부지런하다, 망설이다, 뿌듯하다, 짐작하다, 서운하다, 배려, 익숙하다, 의젓하다, 끈기, 설레다, 아끼다, 정돈하다, 다듬다, 허둥지둥, 살금살금, 북적이다, 달래다, 신중하다, 소중하다, 흐뭇하다, 차례, 협동, 너그럽다, 엉뚱하다, 씩씩하다, 머뭇거리다, 어림하다, 알뜰하다.
2. **사전 근거 확보.** 표준국어대사전에서 낱말의 상세 페이지를 연다. 형식은 `https://stdict.korean.go.kr/search/searchView.do?word_no=<번호>&searchKeywordTo=3`이다(2026-10-28 실제 확인, 예: 신중하다 `word_no=207121`, 뜻 「형용사」 “매우 조심스럽다.”). 문항이 묻는 **뜻 번호 하나**를 정해 `source.senseOrder`에 넣고 `source.entryId`에는 `word_no`를 넣는다.
3. **근거 파일 저장.** 그 뜻풀이 부분을 그대로 담은 텍스트를 `evidence/<artifactId>.txt`(UTF-8)로 저장하고, 그 파일의 SHA-256을 `source.evidenceHash`, 파일 이름을 `source.evidenceArtifactId`에 넣는다. 사전의 **출전 표시 용례·이미지는 복제하지 않는다**(PRD §9.5). `license`에는 “표준국어대사전 뜻풀이 근거 확인, 용례 미복제”처럼 실제 판단을 쓴다.
4. **문항 쓰기.** 유형 배분 목표: 뜻 6, 빈칸 6, 비슷한말 3, 반대말 2, 바른 사용 3(분명한 관계가 없는 낱말은 다른 유형으로 바꾼다). 규칙:
   - 보기 4개·정답 1개. 보기는 같은 품사·비슷한 길이. 정답만 길거나 자세하면 안 된다.
   - 지문은 한 문장. 빈칸은 `(    )`(괄호 안 공백 4칸)으로 쓰고, 네 보기를 **조사·어미까지 붙여 실제로 넣어 본다**.
   - 해설은 1~2문장 60자 이내, 해요체. ‘신중하다는 신중한 것이에요’처럼 표제어를 되풀이하지 않는다.
   - `distractorRationales`는 **학생이 그 보기를 골랐을 때 화면에 그대로 보이는 한 문장**(60자 이내): “‘몹시 서두르다’는 반대에 가까운 뜻이에요.”
   - 지문·보기·해설에 목표 낱말보다 어려운 낱말을 쓰지 않는다. 이중 부정·배경지식 문제·조롱·과장 칭찬 금지.
   - 다의어는 지문 문맥으로 뜻을 하나로 고정한다(예: 용기 勇氣/容器).
   - 개발용 문항과 같은 지문을 복사하지 않는다.
5. **자체 반박(sidecar).** 문항마다 네 보기를 문장에 넣은 결과(`substituted`)와 `fits/does_not_fit` 판정, 이유를 적는다. `fits`는 정답 하나여야 한다. 복수 정답 가능성을 반박 관점에서 한 번 더 따져 `uniquenessNote`에 남긴다.
6. **기계 검사.** `npm run validate:content`를 실행해 통과시킨다(스키마·의미 검사·sidecar 대응·근거 해시). 상태는 `draft` 또는 `machine_checked`만 쓴다. `joint_review_approved`를 스스로 붙이지 않는다.

## 파일 형식

- `drafts.json`: `src/contracts/questionDraft.ts`의 `draftBatchSchema`(= `question-draft.schema.json` 0.2 항목의 배열). `id`는 `g3-argon-0001`부터(가운데 토막은 영문 소문자만 — 스키마 패턴 `^g[3-6]-[a-z_-]+-[0-9]{4,}$`), `batchId`는 `Q20-001`, `review`는 `{ "reviewerId": null, "reviewedAt": null }`.
- `sidecar.json`: 같은 파일의 `draftSidecarSchema`. `producer.model`에는 실제 모델 이름, `tool`에는 실제 도구, `date`는 작업일.
- 스키마에 없는 필드를 추가하지 않는다(`additionalProperties:false`). 필요하면 RETURN에 `REQUESTED_CONTRACT_CHANGE`로 남긴다.

## 문항 작성의 검증된 기준(참고)

Haladyna·Downing·Rodriguez(2002)의 선다형 문항 작성 지침 요약을 이 작업에 맞춘 것이다: 한 문항은 한 가지 지식만 묻는다, 줄기에 핵심을 담고 보기는 짧게, 모든 오답은 그럴듯하되 분명히 틀리다, 보기 길이·문법을 맞춘다, ‘모두 맞다/없다’ 보기를 쓰지 않는다, 부정형 줄기를 피한다. 이 원칙과 PRD 규칙이 다르면 PRD를 따른다.

## RETURN.md에 쓸 것

model_work_orders_v0_5 §8 형식에 더해: 만든 수·뺀 수와 이유, 근거를 찾지 못한 낱말, 유형별 수, 중복 의심, `npm run validate:content` 실제 출력, 실제 모델명·작업일. 20개를 채우려고 근거 없는 문항을 넣지 않는다.

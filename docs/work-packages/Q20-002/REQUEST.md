# Q20-002 — 3학년 문항 2차 초안 20개: 격리 6문항 고친 판 + 새 문항 14개(Argon 4)

```yaml
jobId: Q20-002
status: READY
owner: Argon 4
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: e98ae95024529a2ac54f71b96503d9e2c993248f  # p1/intake-round1(2차 수합), 2026-10-29 발행 준비
contractHash:  # node tools/contract-hash.mjs Q20-002 — inputFiles별 SHA-256
  vocabulary_td_prd_v0_5.md: b4df7985def6717f618e5ed801e4775eca5dec07ad50276e3f168c53daaa29a5
  docs/contracts/question-draft.schema.json: 68fc9985ebcdd333aeb36457c612a2a406b9f7d32d7feec7494258e30375f097
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  src/content/lint.ts: b5df964bf9b5c66b26639a211a5a7cb6e888d4d42514881c0dc6fab4ceeadd5c
  content-source/batches/Q20-001/drafts.json: 7b51fe71369d9c6f79a7b8cd9650dba45268183eae2d605bfc405ce490a38a82
  content-source/batches/Q20-001/sidecar.json: a28b211b45d900c240e8fc3dc6d201b5bd043b5bbb02a602a79119fc88f8f310
  content-source/approvals/registry.json: 9c7c87a332d0f0673f207fb7c5a157eb7f90f5fd76ff9cd5d7e7ac1f80e39214
  content-source/approvals/Q20-001.explanation.json: acc6e8130343843c00c9408fe43df2cf7736ff68f6d284d71e03f6f231c65100
  content-source/reviews/Q20-001/codex.json: 571c311abd6813d20348167b5e17f5664cfbcdb4e6fc5ec09391f676fbad3c0c
  content-source/reviews/Q20-001/claude.json: 15813ebfba47ff3e75935db9996b19a69c4370754003060af80d911472a00b82
inputFiles:
  - vocabulary_td_prd_v0_5.md
  - docs/contracts/question-draft.schema.json
  - src/contracts/questionDraft.ts
  - src/content/lint.ts
  - content-source/batches/Q20-001/drafts.json
  - content-source/batches/Q20-001/sidecar.json
  - content-source/approvals/registry.json
  - content-source/approvals/Q20-001.explanation.json
  - content-source/reviews/Q20-001/codex.json
  - content-source/reviews/Q20-001/claude.json
allowedPaths:
  - content-source/batches/Q20-002/**
forbiddenPaths:
  - content-source/batches/Q20-001/** (읽기만. 1판은 이력으로 남긴다)
  - content-source/approvals/**, content-source/reviews/** (읽기만)
  - src/**
  - docs/** (이 REQUEST 옆 RETURN.md만 예외)
  - package.json, package-lock.json
deliverable: drafts.json(20개) + sidecar.json + evidence/ + RETURN.md
returnPath: docs/work-packages/Q20-002/RETURN.md
```

## 목적

Q20-001의 20문항은 공동검수에서 **승인 14 · 격리 6**이 되었다(`content-source/approvals/registry.json`). 사용자용 공개 은행은 승인 문항이 **30개 이상**이어야 만들 수 있으므로(PRD §9.4) 승인이 16개 이상 더 필요하다. 이번 배치는 다음 두 가지로 20문항을 채운다.

- **가. 격리 6문항의 revision 2**: 같은 ID를 유지하고 지적된 점만 고친다.
- **나. 새 문항 14개**: ID는 `g3-argon-0021`~`g3-argon-0034`다.

승인은 이번에도 Codex·Claude의 독립 검토(정답 키 없음)와 총괄 해설 대조 뒤에 정해진다.

## 가. 격리 6문항 고치기(revision 2)

- `id`는 그대로, `revision`은 `2`, `batchId`는 `Q20-002`로 쓴다.
- Q20-001 파일은 고치지 않는다. 1판은 이력으로 남는다.
- 뜻 번호를 바꾸지 않으면 Q20-001의 근거 파일을 **바꾸지 않고** `Q20-002/evidence/`로 복사한다. 해시가 같아야 한다.
- 고친 판도 자체 반박(sidecar)을 새로 쓴다.
- 이번이 첫 수정이다. 두 번 고쳐도 풀리지 않는 문항은 뺀다(QR-001 승인 규칙).

| id | 낱말 | 격리 사유 | 고칠 점 |
|---|---|---|---|
| `g3-argon-0004` | 짐작하다 | 정답 보기·해설의 ‘사정·형편·어림잡다’가 3학년에게 어렵다(Claude grade uncertain, 총괄 해설 대조 fail). 정답만 사전식 뜻풀이이고 오답 셋은 구체 행동이라 낱말을 몰라도 문체로 고를 수 있다 | 정답 보기와 해설을 쉬운 고유어로 다시 쓴다. 네 보기의 말투를 맞춘다(모두 짧은 뜻풀이 또는 모두 행동) |
| `g3-argon-0006` | 끈기 | 오답 이유 c의 ‘사교성’이 3학년보다 어렵다 | 오답 이유를 쉬운 말로(예: ‘남과 잘 어울리는 성격이에요’). 나머지는 그대로 두어도 된다 |
| `g3-argon-0011` | 흐뭇하다 | 해설의 ‘흡족하다’가 표제어보다 어렵다 | 해설을 쉬운 말로(예: ‘마음에 들어 기분이 좋다는 뜻이에요’) |
| `g3-argon-0013` | 망설이다 | 보기 c ‘받아적었어요’ 띄어쓰기 오류(‘받아 적었어요’), 오답 이유 c도 같음(Codex·Claude language fail) | 맞춤법이 맞는 다른 오답으로 바꾸거나 띄어 쓴다. 보기 길이를 맞추려고 띄어쓰기를 지우지 않는다 |
| `g3-argon-0015` | 소중하다 | 정답 보기 ‘귀중해요’가 표제어보다 어려울 수 있다(Claude grade uncertain) | 더 쉬운 비슷한말로 바꾼다(예: ‘귀해요’). 바꾼 말이 사전 뜻으로도 비슷한말인지, 지문에 넣어 자연스러운지 확인한다 |
| `g3-argon-0017` | 익숙하다 | 지문 ‘줄넘기가 손에 익숙해요’가 어색하다(Codex language fail). 해설의 ‘능숙하다’가 표제어보다 어렵다 | 지문을 자연스럽게 고친다(예: ‘이제 줄넘기에 익숙해요’). 해설에서 ‘능숙하다’를 뺀다 |

두 검토자의 자세한 지적은 `content-source/reviews/Q20-001/codex.json`·`claude.json`의 `findings`에, 총괄 지적은 `content-source/approvals/Q20-001.explanation.json`에 있다.

## 나. 새 문항 14개

절차는 Q20-001 요청서(`docs/work-packages/Q20-001/REQUEST.md`)의 1~6과 같다.

1. **교과서 근거:** 현행 3학년 국어 교과서(2022 개정 3-1·3-2, 국어·국어 활동)의 실제 단원을 찾는다. 못 찾은 낱말은 `rejected`에 사유를 적는다.
2. **사전 근거:** 표준국어대사전 상세 페이지를 열어 뜻 번호를 하나 정한다.
3. **근거 파일:** 뜻풀이만 `evidence/<artifactId>.txt`로 저장한다. 용례는 복제하지 않는다.
4. **문항 쓰기**
5. **자체 반박**
6. **`npm run validate:content` 통과**

- **유형 배분 목표:** 뜻 4, 빈칸 4, 비슷한말 2, 반대말 2, 바른 사용 2.
- **목표 낱말:** Q20-001의 목표 낱말 20개와 겹치지 않게 고른다.
- **후보:** 아래는 제안일 뿐 근거가 아니다. 교과서 근거를 찾지 못하면 쓰지 않는다.
  - 엉뚱하다, 어리둥절하다, 쑥스럽다, 속상하다, 당황하다, 대견하다, 기특하다, 궁금하다, 실망하다, 반갑다, 솔직하다, 꾸준하다, 조심스럽다
  - 차근차근, 또박또박, 성큼성큼, 엉금엉금, 주렁주렁, 알록달록
  - 까닭, 흉내, 용기, 약속
  - 떠올리다, 견디다, 간추리다, 어울리다, 칭찬하다
  - 엉뚱하다는 Q20-001에서 근거가 있었지만 수량 때문에 뺀 낱말이다. 근거가 없어 뺀 아끼다·정돈하다·북적이다·달래다·신중하다·협동·알뜰하다는 이번에 근거를 새로 찾은 경우에만 쓴다.

## 제작 주의(Q20-001 검토에서 나온 것, 20문항 모두에 적용)

1. **정답 위치를 돌리지 않는다.** Q20-001은 정답이 a→b→c→d 순서로 돌았다. 게임은 보기를 섞어 내지만 검토자가 위치로 짐작할 수 있다. 위치는 무작위로 정하고, 20문항에서 한 글자가 4~6번 나오게 한다.
2. **단서 낱말을 정답에만 되풀이하지 않는다.** 지문의 낱말이 정답 보기에만 그대로 나오면 낱말 뜻을 몰라도 풀린다. 예: 0019 ‘마음씨’, 0018 ‘글을 고치는 뜻’과 ‘문장’.
3. **네 보기의 말투를 맞춘다.** 정답만 사전식 뜻풀이이고 오답은 구체 행동이면 문체로 풀린다(0004).
4. **지문·보기·해설·오답 이유 모두에 표제어보다 어려운 낱말을 쓰지 않는다.**
   - 이번에 걸린 말: 사교성·흡족하다·능숙하다·귀중하다·사정·형편·어림잡다.
   - 사전 뜻풀이를 그대로 옮기지 말고, 3학년이 아는 고유어로 풀어 쓴다.
   - 오답 이유도 학생 화면에 그대로 나온다.
5. **띄어쓰기를 지키고 사전으로 확인한다.** 본용언끼리 이어진 말(‘받아 적다’)은 띄어 쓴다. 보기 길이를 맞추려고 띄어쓰기를 지우지 않는다.
6. **지문 문장이 자연스러운지 소리 내어 읽어 본다.** 낱말끼리 어울리는지 본다(‘손에 익숙하다’는 어색함).
7. **오답이 너무 동떨어지지 않게 한다.** 문장과 아무 관련 없는 오답만 있으면 변별력이 없다(0007 소리·무게·높이). 그럴듯하지만 문맥에서 분명히 틀린 오답을 한두 개 넣는다. 정답이 둘이 되지 않는지는 자체 반박에서 확인한다.

## 파일 형식

- `drafts.json`: `src/contracts/questionDraft.ts`의 `draftBatchSchema`로 20개다.
  - `batchId`는 `Q20-002`다.
  - 순서는 가(revision 2) 6개 다음에 나(새 문항) 14개다.
  - `review`는 `{ "reviewerId": null, "reviewedAt": null }`이다.
- `sidecar.json`: `draftSidecarSchema`다.
  - `items`는 20개 모두, `id`와 `revision`이 맞아야 한다.
  - `producer`에는 실제 모델·도구·작업일을 쓴다.
- 스키마에 없는 필드를 넣지 않는다. 필요하면 RETURN.md에 `REQUESTED_CONTRACT_CHANGE`로 적는다.
- `npm run build:bank`는 실행하지 않는다. 허용 경로 밖의 `content-source/approvals/registry.json`을 다시 쓰기 때문이다.

## RETURN.md에 쓸 것

model_work_orders_v0_5 §8 형식에 더해 아래를 쓴다.

- **고친 판:** 격리 사유별로 무엇을 어떻게 고쳤는지(고치기 전 → 고친 뒤)
- **수량:** 새 문항 수, 뺀 낱말과 사유, 유형별 수, 정답 위치 분포
- **제작 주의:** 1~7을 문항별로 어떻게 확인했는지
- **검사:** `npm run validate:content` 실제 출력
- **작업 정보:** 실제 모델명·작업일

20개를 채우려고 근거 없는 문항을 넣지 않는다.

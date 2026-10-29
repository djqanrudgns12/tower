# Q20-003 — 3학년 문항 3차 초안 20개: 격리 3문항 마지막 수정 + 새 문항 17개(Argon 4)

```yaml
jobId: Q20-003
status: READY
owner: Argon 4 (총괄이 agent-bridge로 Antigravity를 깨워 두 번에 나눠 전달)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 106d4263bf02f05f7c249bbe748fbf94501c72d6  # 첫 공개 은행 커밋. 요청서는 작업 폴더에 복사했다
contractHash:  # node tools/contract-hash.mjs Q20-003 — inputFiles별 SHA-256
  vocabulary_td_prd_v0_5.md: 0790d35e411561d96029f2a0be9a3c997e7b28129b0676cd37f9b1e7f7933b6f
  docs/contracts/question-draft.schema.json: 68fc9985ebcdd333aeb36457c612a2a406b9f7d32d7feec7494258e30375f097
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  src/content/lint.ts: b5df964bf9b5c66b26639a211a5a7cb6e888d4d42514881c0dc6fab4ceeadd5c
  content-source/batches/Q20-002/drafts.json: c6fb8f1e64774991c30edf46339cb3a55ec81631d063dbfc5e954724d4c723b3
  content-source/batches/Q20-002/sidecar.json: 0de6578e3191da54f856458762b8b5d4caa6042846bb17fa377e7665717d4bdf
  content-source/approvals/registry.json: 2ebb34917237b3786bc85de99d4593c698ec99d51c529d676956c0b67522df35
  content-source/reviews/Q20-002/codex.json: aaf8d01b0621179de560ae880da954ca2d177c7c35478b1f98d41d1eb68ed03c
  content-source/reviews/Q20-002/claude.json: e931cb30febaa5203440e85eccd9eb8d598eecdcac646e2e982e562cff9bbad9
inputFiles:
  - vocabulary_td_prd_v0_5.md
  - docs/contracts/question-draft.schema.json
  - src/contracts/questionDraft.ts
  - src/content/lint.ts
  - content-source/batches/Q20-002/drafts.json
  - content-source/batches/Q20-002/sidecar.json
  - content-source/approvals/registry.json
  - content-source/reviews/Q20-002/codex.json
  - content-source/reviews/Q20-002/claude.json
allowedPaths:
  - content-source/batches/Q20-003/**
forbiddenPaths:
  - content-source/batches/Q20-001/**, content-source/batches/Q20-002/** (읽기만)
  - content-source/approvals/**, content-source/reviews/** (읽기만)
  - src/**
  - docs/** (이 REQUEST 옆 RETURN.md만 예외)
  - package.json, package-lock.json
deliverable: drafts.json(20개) + sidecar.json + evidence/ + RETURN.md
returnPath: docs/work-packages/Q20-003/RETURN.md
```

## 목적

Q20-001·Q20-002 공동검수로 3학년 **첫 공개 은행 31문항**이 생겼다(`src/content/questions/grade3.json`). P1 목표는 한 학년 30~50문항이다(PRD §9.4). 이번 배치로 50문항 근처까지 늘린다.

- **가. 격리 3문항의 revision 3**: `g3-argon-0004`·`0006`·`0015`는 이미 한 번 고쳤는데도 Codex가 uncertain을 냈다. 이번이 **마지막 수정**이다. 이번에도 풀리지 않으면 뺀다(QR-001 승인 규칙).
- **나. 새 문항 17개**: ID는 `g3-argon-0035`~`g3-argon-0051`다.

## 가. 마지막 수정(revision 3)

- `id`는 그대로, `revision`은 `3`, `batchId`는 `Q20-003`이다.
- Q20-001·Q20-002 파일은 고치지 않는다.
- 뜻 번호가 같으면 근거 파일을 바꾸지 않고 `Q20-003/evidence/`로 복사한다.

| id | 낱말 | revision 2에 남은 지적(Codex `content-source/reviews/Q20-002/codex.json`) | 고칠 점 |
|---|---|---|---|
| `g3-argon-0004` | 짐작하다 | 오답 a ‘한 잘못을 미안하다고 말하다’의 관형절이 매끄럽지 않다(language uncertain) | 오답 a를 자연스러운 뜻풀이로 바꾼다(예: ‘잘못한 일을 사과하다’). 네 보기의 말투·길이는 지금처럼 맞춘다 |
| `g3-argon-0006` | 끈기 | 오답 c ‘낯선 사람과 금방 친해지는 기운’, d ‘아침 일찍 잠에서 깨어나는 기운’이 성향·습관을 ‘기운’으로 묶어 어색하다(language uncertain) | 네 보기를 모두 자연스러운 명사구로 다시 쓴다. ‘기운’이 어울리지 않으면 ‘마음’·‘힘’ 등으로 같은 틀을 맞춘다. 정답이 하나뿐인지 자체 반박을 다시 한다 |
| `g3-argon-0015` | 소중하다 | 정답 ‘귀해요’는 추상적 쓰임이 3학년에게 낯설 수 있다(grade uncertain). 정답만 3음절이라 길이 단서도 있다(Claude 참고) | 비슷한말 유형에서 3학년이 확실히 아는 말을 찾기 어렵다. 그러면 **유형을 뜻(definition)이나 빈칸(cloze)으로 바꿔도 된다.** 바꾼 유형에서도 정답이 하나뿐인지, 보기 길이가 고른지 확인한다 |

## 나. 새 문항 17개

절차는 Q20-001 요청서(`docs/work-packages/Q20-001/REQUEST.md`)의 1~6과 같다.

1. **교과서 근거:** 실제 단원 근거를 찾는다. 못 찾은 낱말은 `rejected`에 사유를 적는다.
2. **사전 근거:** 표준국어대사전 뜻 번호를 하나 정한다.
3. **근거 파일:** 뜻풀이만 근거 파일로 저장한다.
4. **문항 쓰기**
5. **자체 반박**
6. **`npm run validate:content` 통과**

- **유형 배분 목표:** 뜻 5, 빈칸 5, 비슷한말 3, 반대말 2, 바른 사용 2.
- **목표 낱말:** Q20-001·Q20-002의 목표 낱말 34개와 겹치지 않는다.
- **후보:** 제안일 뿐 근거가 아니다.
  - 어리둥절하다, 쑥스럽다, 속상하다, 대견하다, 기특하다, 실망하다, 반갑다, 아쉽다, 차분하다, 정직하다, 부끄럽다, 꾸준하다, 조심스럽다
  - 견디다, 어울리다, 살피다, 나누다
  - 용기, 맞장구
  - 깡충깡충, 살랑살랑, 데굴데굴, 반짝반짝
  - Q20-002에서 근거가 없어 뺀 낱말은 근거를 새로 찾은 경우에만 쓴다.

## 제작 주의

Q20-002 요청서의 1~7을 그대로 지킨다.

1. 정답 위치를 돌리지 않고 무작위로 둔다(20문항에서 한 글자가 4~6번).
2. 단서 낱말을 정답에만 되풀이하지 않는다.
3. 네 보기의 말투를 맞춘다.
4. 표제어보다 어려운 낱말을 지문·보기·해설·오답 이유 어디에도 쓰지 않는다.
5. 띄어쓰기를 지키고 사전으로 확인한다.
6. 지문이 자연스러운지 소리 내어 읽어 본다.
7. 오답이 너무 동떨어지지 않게 한다.

이번 검토(QR-003·QR-004)에서 나온 것을 더한다.

8. **오답 보기도 자연스러운 한국어여야 한다.** 주어가 빠진 관형절(‘한 잘못을 ~’)이나 어울리지 않는 낱말 묶음(‘친해지는 기운’)은 오답이어도 language 판정에서 걸린다.
9. **정답만 음절 수가 다르지 않게 한다.** 비슷한말·반대말 보기는 같은 꼴(예: 모두 4음절 ‘~해요’)로 맞춘다.
10. **오답 셋이 같은 범주이고 정답만 다른 범주면 ‘다른 하나’로 풀린다.** 예: 오답이 모두 감정이고 정답만 생각. 오답 범주를 섞는다.

## 두 번에 나눠 만든다(브리지 실행은 15분 상한)

| 실행 | 할 일 | 끝낼 때 |
|---|---|---|
| 1/2 | 가 3문항(revision 3) + 새 문항 7개(`0035`~`0041`) | `drafts.json`·`sidecar.json`에 10개 쓰고 `npm run validate:content` 통과. 남은 일을 `content-source/batches/Q20-003/PROGRESS.md`에 적는다 |
| 2/2 | 새 문항 10개(`0042`~`0051`)를 이어 붙인다 | 20개로 `validate:content` 통과. `RETURN.md`를 쓴다 |

## 파일 형식

Q20-002와 같다.

- `drafts.json`
  - `draftBatchSchema` 20개다.
  - `batchId`는 `Q20-003`이다.
  - 순서는 가 3개 다음에 새 문항 17개다.
- `sidecar.json`
  - `draftSidecarSchema` 형식이다.
  - `producer`에는 실제 모델·도구·작업일을 쓴다.
- `npm run build:bank`는 실행하지 않는다.

## RETURN.md에 쓸 것

model_work_orders_v0_5 §8 형식에 더해 아래를 쓴다.

- **마지막 수정:** 고치기 전 → 고친 뒤(유형을 바꿨다면 이유)
- **새 문항:** 수량, 뺀 낱말과 사유, 유형별 수, 정답 위치 분포
- **제작 주의:** 1~10을 어떻게 확인했는지
- **검사:** `npm run validate:content` 실제 출력
- **작업 정보:** 실제 모델명·작업일
- **나눠 만든 사실:** 두 번에 나눠 실행했다는 점

20개를 채우려고 근거 없는 문항을 넣지 않는다.

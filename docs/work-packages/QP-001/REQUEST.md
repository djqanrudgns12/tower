# QP-001 — 첫 연습 판 전용 4문항 다시 쓰기(Argon 4)

```yaml
jobId: QP-001
status: READY
owner: Argon 4 (총괄이 agent-bridge로 Antigravity를 깨워 한 번에 전달, 셸 없이 파일만 쓴다)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 6e9f7dbf733dbe58d80db2ce8ed40d8f67eb5db5  # 요청서는 작업 폴더에 복사했다
contractHash:  # node tools/contract-hash.mjs QP-001
  src/content/questions/practice.json: 1a535e8232d33c3d7188b8bb5099edff37e3d652c66110a5d0f512fca22e5df6
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  src/content/lint.ts: b5df964bf9b5c66b26639a211a5a7cb6e888d4d42514881c0dc6fab4ceeadd5c
  docs/work-packages/Q20-003/REQUEST.md: b79961a5fc1c50e344df8abd3c839e8cdff0a2257a60841db452366ec30fe3c4
inputFiles:
  - src/content/questions/practice.json
  - src/contracts/questionDraft.ts
  - src/content/lint.ts
  - docs/work-packages/Q20-003/REQUEST.md
allowedPaths:
  - content-source/batches/QP-001/** (evidence/ 안은 고치지 않는다)
  - docs/work-packages/QP-001/RETURN.md
forbiddenPaths:
  - src/**, 다른 content-source 배치, docs/**(자기 RETURN 제외), package.json
deliverable: drafts.json(4개) + sidecar.json + RETURN.md
returnPath: docs/work-packages/QP-001/RETURN.md
```

## 왜

첫 연습 판(PRD §12.2)에는 정규 은행과 따로 4문항이 있다(`src/content/questions/practice.json`, `g3-practice-0001`~`0004`). 총괄이 개발용으로 쓴 것이라 근거·공동검수가 없다. 공개 전에 Argon·Codex·Claude 공동검수를 거쳐야 한다(작업 게시판 QR-PRACTICE).

이미 걸리는 점도 있다. 0001의 정답 보기 ‘마음이 즐겁고 흐뭇하다’에서 ‘흐뭇하다’가 표제어 ‘기쁘다’보다 어렵다. Q20 배치 제작 주의 4번(표제어보다 어려운 낱말 금지)에 걸린다.

## 할 일

- 같은 ID·낱말·유형으로 4문항을 다시 쓴다.
  - `revision`은 `2`, `batchId`는 `QP-001`이다.
  - 0001 기쁘다(뜻), 0002 크다(반대말), 0003 우산(빈칸), 0004 빠르다(비슷한말)다.
- 연습 판의 첫 문항이므로 3학년 누구나 바로 풀 만큼 쉽고 짧게 쓴다(읽기 부담 40음절 안팎).
- 정답 위치는 a·b·c·d가 한 번씩 나오게 하되, 문항 순서대로 a→b→c→d로 돌리지 않는다.
- 제작 주의 1~10(Q20-003 요청서)을 그대로 지킨다.
- **근거**
  - 총괄이 `content-source/batches/QP-001/evidence/index.json`에 표준국어대사전 뜻을 넣어 두었다. 묻는 뜻 하나를 골라 source를 채운다(Q20-003과 같은 방법).
  - 근거 파일은 고치지 않는다.
- **gradeBasis**
  - 기초 낱말이라 3학년 교과서 단원이 없을 수 있다. 그러면 실제로 확인한 1~2학년 국어 교과서 단원을 쓴다.
  - 확인하지 못하면 그 문항을 sidecar `rejected`에 사유와 함께 적는다. 근거를 지어내지 않는다.
- **형식**: `draftBatchSchema`·`draftSidecarSchema`(4개). `status`는 `machine_checked`다. 스키마에 없는 필드를 넣지 않는다.
- **검사**: `npm run validate:content`는 총괄이 돌린다.

## RETURN.md에 쓸 것

- 고치기 전 → 고친 뒤(문항별)
- gradeBasis를 어떻게 확인했는지
- 정답 위치
- 실제 모델명·작업일
- 셸 없이 파일만 썼다는 사실

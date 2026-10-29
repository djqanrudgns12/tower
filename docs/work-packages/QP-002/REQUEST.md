# QP-002 — 첫 연습 판 0004(빠르다) 마지막 수정(Argon 4)

```yaml
jobId: QP-002
status: READY
owner: Argon 4 (agent-bridge, 셸 없이 파일만)
commander: Claude Opus 5.5
baseCommit: 2930e1867ee76531b79191f25b3ac4069eae09f5  # 요청서는 작업 폴더에 복사했다
contractHash:  # node tools/contract-hash.mjs QP-002
  content-source/batches/QP-001/drafts.json: c0d76ac9be08c48b7cca5416d78e70b39e7cd3a9ae85a74cf88d773e9de8f8c5
  content-source/reviews/QP-001/codex.json: 3acb3527a0e22f7e948e6f64cd8b3d47e8556c507a485818a38137ec5317001a
  content-source/reviews/QP-001/claude.json: 31d0bf4a8f967855e278e1c63c0e3e5a0ba71f4af69338dbacce75a9acfbb86d
  docs/work-packages/Q20-003/REQUEST.md: b79961a5fc1c50e344df8abd3c839e8cdff0a2257a60841db452366ec30fe3c4
inputFiles:
  - content-source/batches/QP-001/drafts.json
  - content-source/reviews/QP-001/codex.json
  - content-source/reviews/QP-001/claude.json
  - docs/work-packages/Q20-003/REQUEST.md
allowedPaths:
  - content-source/batches/QP-002/** (evidence/ 안은 고치지 않는다)
  - docs/work-packages/QP-002/RETURN.md
deliverable: drafts.json(1개) + sidecar.json + RETURN.md
returnPath: docs/work-packages/QP-002/RETURN.md
```

QP-001의 4문항 가운데 3문항은 승인되었다. `g3-practice-0004`(빠르다, 비슷한말)는 Codex·Claude 모두 grade uncertain이었다. 정답 보기 ‘날쌔요’가 표제어 ‘빠르다’보다 어려워, 연습 판 첫 문항으로 3학년 누구나 바로 풀기 어렵다는 지적이다(두 보고서의 findings 참고).

이번이 마지막 수정이다. 풀리지 않으면 이 문항은 빼고 다른 낱말로 새로 만든다.

- `id` `g3-practice-0004`, `revision` 3, `batchId` `QP-002`. 표제어는 ‘빠르다’ 그대로 둔다.
- 3학년 누구나 아는 말로만 보기를 만든다.
  - 비슷한말로 쉬운 말을 찾기 어려우면 **유형을 바꿔도 된다**(빈칸·바른 사용·뜻).
  - 반대말은 0002(크다)와 겹치므로 피한다.
- 다른 연습 문항(0001 b·0002 d·0003 a)과 정답 위치가 겹치지 않게 `c`를 정답으로 한다.
- **근거:** `content-source/batches/QP-002/evidence/index.json`의 빠르다 뜻 하나를 골라 source를 채운다. QP-001과 같은 뜻이면 그 근거 파일(`빠르다-157226-1.txt`)을 그대로 쓴다.
- **gradeBasis:** QP-001에서 확인한 단원을 써도 된다.
- **제작 주의:** 1~10(Q20-003 요청서)을 지킨다.
- **검사:** `validate:content`는 총괄이 돌린다.
- **RETURN.md:** 고치기 전 → 고친 뒤, 유형을 바꿨다면 이유, 실제 모델명·작업일을 쓴다.

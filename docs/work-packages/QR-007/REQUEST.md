# QR-007 / QR-008 — QP-001(첫 연습 판 4문항) 독립 검토(Codex·Claude 각각)

```yaml
jobId: QR-007 (Codex) / QR-008 (Claude)
status: READY  # 2026-10-29
owner: QR-007 = Codex(agent-bridge 새 실행), QR-008 = Claude(총괄 대화가 아닌 새 문맥)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 7e1d4551beff9396cc27edc3eda48362071e96eb
contractHash:  # node tools/contract-hash.mjs QR-007
  content-source/reviews/QP-001/blind-input.json: 5def003f424bb81bc22845058b75a8cbd02bb72ab1de08fdee3d755cd4f5e8a3
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: 052347538f28eb187f8d97f16a5624428928909e3cb878c5c6ffd74815646e96
inputFiles:
  - content-source/reviews/QP-001/blind-input.json
  - src/contracts/questionDraft.ts
  - vocabulary_td_prd_v0_5.md
allowedPaths:
  - content-source/reviews/QP-001/codex.json (QR-007)
  - content-source/reviews/QP-001/claude.json (QR-008)
  - docs/work-packages/QR-007/RETURN.md (QR-007)
  - docs/work-packages/QR-007/RETURN-QR-008.md (QR-008)
forbiddenPaths:
  - content-source/batches/**, content-source/approvals/**, content-source/reviews/Q20-*/** (정답·이전 판정. 작업 폴더에서 뺀다)
  - docs/work-packages/Q20-00*/, docs/work-packages/QP-001/, docs/work-packages/QR-00[1-5]/RETURN*.md (뺀다)
  - src/content/questions/** (게임 은행·연습 은행. 열지 않는다)
returnPath: docs/work-packages/QR-007/RETURN.md (QR-007), docs/work-packages/QR-007/RETURN-QR-008.md (QR-008)
```

절차·검토자 지시·덧붙인 기준·승인 규칙은 [QR-003 요청서](../QR-003/REQUEST.md)와 같다. 배치는 QP-001(첫 연습 판 전용 4문항)이다.

연습 판의 첫 문항이므로 grade는 3학년 누구나 바로 풀 만큼 쉬운지 본다. 표제어보다 어려운 낱말이 보기에 있으면 uncertain 이상이다. 네 문항이 모두 승인되어야 연습 은행이 바뀐다.

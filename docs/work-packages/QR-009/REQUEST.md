# QR-009 / QR-010 — QP-002(첫 연습 판 0004 마지막 수정) 독립 검토

```yaml
jobId: QR-009 (Codex) / QR-010 (Claude)
status: READY  # 2026-10-29
baseCommit: 324405c79781bf7e07a7bf565081639e49b336a4
contractHash:  # node tools/contract-hash.mjs QR-009
  content-source/reviews/QP-002/blind-input.json: f3497e66cad6dd4b73ee9701a775d7c9eefb81a56653e2428123bbd086b0237d
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: 03259a4072847d690ae9f29c5e34ac4d30093e50a220cc2959ac07d5ddf41a43
inputFiles:
  - content-source/reviews/QP-002/blind-input.json
  - src/contracts/questionDraft.ts
  - vocabulary_td_prd_v0_5.md
allowedPaths:
  - content-source/reviews/QP-002/codex.json (QR-009)
  - content-source/reviews/QP-002/claude.json (QR-010)
  - docs/work-packages/QR-009/RETURN.md (QR-009)
  - docs/work-packages/QR-009/RETURN-QR-010.md (QR-010)
forbiddenPaths:
  - content-source/batches/**, content-source/approvals/**, 다른 content-source/reviews/** (작업 폴더에서 뺀다)
  - docs/work-packages/Q20-00*/, docs/work-packages/QP-00*/, docs/work-packages/QR-00[1-7]/RETURN*.md (뺀다)
  - src/content/questions/** (열지 않는다)
returnPath: docs/work-packages/QR-009/RETURN.md, docs/work-packages/QR-009/RETURN-QR-010.md
```

절차·기준은 [QR-007 요청서](../QR-007/REQUEST.md)와 같다. 배치는 QP-002(1문항, 첫 연습 판)이다.

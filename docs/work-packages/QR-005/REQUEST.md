# QR-005 / QR-006 — Q20-003 독립 검토(Codex·Claude 각각)

```yaml
jobId: QR-005 (Codex) / QR-006 (Claude)
status: READY  # 2026-10-29 Q20-003 수합 뒤 발행
owner: QR-005 = Codex(agent-bridge로 깨운 새 실행, 10문항씩 두 번), QR-006 = Claude(총괄 대화가 아닌 새 문맥)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: f18d76524a191a40359d51c67565f40d4668ad67  # Q20-003 수합 커밋(blind-input 포함). 요청서는 작업 폴더에 복사했다
contractHash:  # node tools/contract-hash.mjs QR-005
  content-source/reviews/Q20-003/blind-input.json: 27e33a08983b6242f59aa8ee5a076768189a998e9c5f12c13d8ccad7af242338
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: 29efc06c360860cbb5bbf97c196b9a651a45c5e51cfedaf0dd869566255de4dc
inputFiles:
  - content-source/reviews/Q20-003/blind-input.json
  - src/contracts/questionDraft.ts
  - vocabulary_td_prd_v0_5.md
allowedPaths:
  - content-source/reviews/Q20-003/codex.json (QR-005)
  - content-source/reviews/Q20-003/claude.json (QR-006)
  - docs/work-packages/QR-005/RETURN.md (QR-005)
  - docs/work-packages/QR-005/RETURN-QR-006.md (QR-006)
forbiddenPaths:
  - content-source/batches/** (정답 키. 작업 폴더에서 sparse checkout으로 뺀다)
  - content-source/approvals/**, content-source/reviews/Q20-001/**, content-source/reviews/Q20-002/** (이전 판정·지적. 뺀다)
  - docs/work-packages/Q20-00*/RETURN.md, docs/work-packages/Q20-002/, docs/work-packages/Q20-003/ (정답 열·고친 사유. 뺀다)
  - docs/work-packages/QR-001/RETURN*.md, docs/work-packages/QR-003/RETURN*.md (이전 검토 결과. 뺀다)
  - src/**, docs/** (자기 RETURN 파일 제외)
returnPath: docs/work-packages/QR-005/RETURN.md (QR-005), docs/work-packages/QR-005/RETURN-QR-006.md (QR-006)
```

절차·검토자 지시·승인 규칙은 [QR-003 요청서](../QR-003/REQUEST.md)와 같다. 바뀌는 것은 다음뿐이다.

- 배치는 Q20-003이다.
- 결과 경로는 위 allowedPaths다.
- 작업 폴더에서 빼는 파일이 늘었다.

이번 배치에는 Q20-002에서 격리된 고친 판 3개의 마지막 수정(revision 3)이 섞여 있다. 검토자는 어느 문항인지 모르는 채 모든 문항을 똑같이 검토한다. revision 3도 격리되면 그 문항은 뺀다.

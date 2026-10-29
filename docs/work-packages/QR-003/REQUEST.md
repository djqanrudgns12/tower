# QR-003 / QR-004 — Q20-002 독립 검토(Codex·Claude 각각)

```yaml
jobId: QR-003 (Codex) / QR-004 (Claude)
status: READY  # 2026-10-29 Q20-002 수합 뒤 발행
owner: QR-003 = Codex(agent-bridge로 깨운 새 실행), QR-004 = Claude(총괄 대화가 아닌 새 문맥)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 0ed9f449e99feb2a868b24cc0a398635a6bbe29f  # 검토자 작업 폴더의 기준. blind-input은 총괄이 작업 폴더에 복사했다(Q20-002 수합 커밋 전)
contractHash:  # node tools/contract-hash.mjs QR-003 — 검토자 작업 폴더에서 잰 값
  content-source/reviews/Q20-002/blind-input.json: 51e4165cb5b1e347db20ab9ae84e35954309ce08f6b5227e97842af6547dad64
  src/contracts/questionDraft.ts: de734f28999ac8e2e1d2c0a5670ab62d622f0f195a89f951827da2d04c8ef0d8
  vocabulary_td_prd_v0_5.md: b4df7985def6717f618e5ed801e4775eca5dec07ad50276e3f168c53daaa29a5
inputFiles:
  - content-source/reviews/Q20-002/blind-input.json
  - src/contracts/questionDraft.ts
  - vocabulary_td_prd_v0_5.md
allowedPaths:
  - content-source/reviews/Q20-002/codex.json (QR-003)
  - content-source/reviews/Q20-002/claude.json (QR-004)
  - docs/work-packages/QR-003/RETURN.md (QR-003)
  - docs/work-packages/QR-003/RETURN-QR-004.md (QR-004)
forbiddenPaths:
  - content-source/batches/** (정답 키가 있는 원본. 작업 폴더에서 sparse checkout으로 뺀다)
  - content-source/approvals/**, content-source/reviews/Q20-001/** (1판 판정·지적. 뺀다)
  - docs/work-packages/Q20-001/RETURN.md, docs/work-packages/Q20-002/RETURN.md (정답 열이 있을 수 있다. 뺀다)
  - src/**, docs/** (자기 RETURN 파일 제외)
returnPath: docs/work-packages/QR-003/RETURN.md (QR-003), docs/work-packages/QR-003/RETURN-QR-004.md (QR-004)
```

## 무엇이 다른가(QR-001과 비교)

절차·판정 기준은 [QR-001 요청서](../QR-001/REQUEST.md)의 ‘검토자 지시’와 같다. 이번 배치에는 Q20-001에서 격리된 6문항의 revision 2가 섞여 있지만, 검토자는 **어느 문항이 고친 판인지, 1판에서 무엇이 지적되었는지 모른 채** 모든 문항을 똑같이 처음부터 검토한다. 그래서 1판 판정·지적 파일도 작업 폴더에서 뺀다.

## 발행 절차(총괄)

1. Q20-002를 수합하고 `npm run validate:content`가 통과하는지 확인한다.
2. `npm run blind-input -- Q20-002`로 `content-source/reviews/Q20-002/blind-input.json`을 만든다(정답·해설·오답 이유 삭제, contentHash 포함). 수합 커밋에 넣는다.
3. 검토자 작업 폴더 두 개를 sparse checkout으로 만든다. 위 forbiddenPaths의 정답·판정 파일은 작업 트리에서 뺀다.
4. QR-003은 agent-bridge로 Codex를 깨운다. 실행이 15분 상한이므로 1~10번과 11~20번 두 번으로 나눈다. 두 번째 실행은 첫 실행의 결과 파일에 이어 쓴다.
5. QR-004는 총괄 대화를 물려받지 않는 새 Claude 문맥(총괄이 띄우는 독립 하위 에이전트)에 같은 지시만 준다.

## 검토자 지시

[QR-001 요청서](../QR-001/REQUEST.md)의 ‘검토자 지시’를 그대로 쓴다. 다음을 덧붙인다.

- **읽기 수준:** grade 판정에서 지문·보기의 모든 낱말이 3학년에게 쉬운지 본다. 표제어보다 어려운 한자어(예: 사교성·흡족·능숙·귀중·형편)가 보기에 있으면 uncertain 이상으로 판정한다.
- **띄어쓰기:** language 판정에서 보기의 띄어쓰기를 사전으로 확인한다. 본용언끼리 이어진 말은 띄어 쓴다.
- **단서와 말투:**
  - 정답 보기에만 지문의 낱말이 되풀이되어 뜻을 몰라도 풀리는 경우는 findings에 ‘(참고)’로 적는다.
  - 정답만 말투가 달라 문체로 풀리는 경우도 같이 적는다.

## 승인 규칙(총괄)

QR-001과 같다. 아래 다섯 가지가 모두 통과해야 승인이고, 하나라도 어긋나면 그 revision은 격리한다.

1. Argon 자체 반박에서 정답만 맞는다.
2. Codex·Claude의 독립 풀이가 정답과 같다.
3. Codex·Claude 모두 source·uniqueness·grade·language가 pass다.
4. 총괄 해설 대조가 pass다.
5. 게시 형식·의미 검사를 통과한다.

판정은 `npm run build:bank`가 `content-source/approvals/registry.json`에 쓴다. revision 2인데도 격리되면, 두 번째 수정(revision 3)까지 하고도 풀리지 않을 때 뺀다.

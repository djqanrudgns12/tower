# QR-001 / QR-002 — Q20-001 독립 검토(Codex·Claude 각각)

```yaml
jobId: QR-001 (Codex) / QR-002 (Claude)
status: READY (Q20-001 반환·검사 통과, 2026-10-28). 수합 변경을 커밋한 뒤 발행
owner: QR-001 = Codex, QR-002 = Claude — 각각 새 대화 문맥
commander: Claude Opus 5.5 (P1 첫 구현 총괄). QR-002를 맡는 Claude 세션은 총괄 세션과 다른 새 문맥이어야 한다
baseCommit: 발행 직전 값
contractHash: 발행 직전 `node tools/contract-hash.mjs QR-001` 출력
inputFiles:
  - content-source/reviews/Q20-001/blind-input.json
  - src/contracts/questionDraft.ts
  - vocabulary_td_prd_v0_5.md
allowedPaths:
  - content-source/reviews/Q20-001/codex.json (QR-001)
  - content-source/reviews/Q20-001/claude.json (QR-002)
  - docs/work-packages/QR-001/RETURN.md (QR-001)
  - docs/work-packages/QR-001/RETURN-QR-002.md (QR-002)
forbiddenPaths:
  - content-source/batches/** (정답 키가 있는 원본. 작업 폴더에서 sparse checkout으로 빼 둔다)
  - src/**, docs/** (자기 RETURN 파일 제외)
returnPath: docs/work-packages/QR-001/RETURN.md (QR-001), docs/work-packages/QR-001/RETURN-QR-002.md (QR-002)
```

## 발행 절차(총괄)

1. Q20-001 RETURN을 받고 `npm run validate:content`가 통과하는지 확인한다.
2. `npm run blind-input -- Q20-001` → `content-source/reviews/Q20-001/blind-input.json`(정답·해설·오답 이유 삭제, contentHash 포함).
3. Codex와 Claude에게 **각각 새 문맥**으로 blind-input만 준다. 같은 문맥에서 정답을 본 뒤 ‘독립 풀이’라고 쓰지 않는다(model_work_orders §10).

## 검토자 지시

```text
너는 대한민국 초등 3학년 어휘 문항의 독립 검토자다. 정답 키를 받지 않았다.
blind-input.json의 각 문항을 직접 풀고 blindChoice를 적어라. 답이 둘 이상 가능하면 multiple, 없으면 none.
그다음 각 문항을 다섯 기준으로 pass/fail/uncertain 판정하라:
 source: 제시된 표준국어대사전 URL·뜻 번호의 뜻과 문항이 묻는 뜻이 같은가(직접 열어 확인)
 uniqueness: 네 보기를 문장에 넣었을 때 정답이 하나뿐인가
 grade: 3학년이 읽고 풀 수 있는 낱말·문장인가(gradeBasis 근거가 그럴듯한가)
 language: 자연스러운 한국어인가, 조사·어미가 맞는가
 explanation: (blind-input에는 해설이 없다) 이 항목은 원본 대조 단계에서 총괄이 채우므로 uncertain으로 둔다
의심되는 점은 findings에 구체적으로 쓴다(어느 보기를 넣으면 왜 말이 되는지 등). 다수결·설득이 아니라 근거로 판단하라.
결과는 src/contracts/questionDraft.ts의 blindReviewSchema 형식 JSON 하나로 낸다. reviewer.freshContext=true, 실제 모델명.
```

## 승인 규칙(총괄)

세 보고서(Argon 자체 반박 + Codex + Claude) 중 하나라도 fail/uncertain이면 그 revision은 격리한다. 두 번 고친 뒤에도 풀리지 않으면 뺀다. blindChoice가 정답과 다르면 자동 격리. 통과한 revision만 공개 은행 빌드 대상이며, 같은 revision의 통과 보고서는 재사용한다(PRD §9.3, §19.4).

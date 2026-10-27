# REVIEW-CORE-001 — 도메인 엔진 독립 검토(Codex)

```yaml
jobId: REVIEW-CORE-001
status: READY
owner: Codex (총괄이 아닌 검토 역할, 새 문맥)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 발행 직전 값
contractHash: 발행 직전 `node tools/contract-hash.mjs REVIEW-CORE-001` 출력
inputFiles:
  - vocabulary_td_prd_v0_5.md
  - docs/contracts/balance.candidate.v0.3.json
  - src/domain/run.ts
  - src/domain/combat.ts
  - src/domain/quiz.ts
  - src/domain/waves.ts
  - src/domain/towers.ts
  - src/domain/num.ts
  - src/domain/rng.ts
  - src/application/RunController.ts
  - tests/unit/run.test.ts
allowedPaths:
  - tests/review/**
forbiddenPaths:
  - src/** (결함을 찾아도 고치지 않는다. 고치는 것은 총괄)
  - tests/unit/** , package.json
deliverable: 결함 목록 + 결함마다 지금 실패하는 시험 1개 + RETURN.md
returnPath: docs/work-packages/REVIEW-CORE-001/RETURN.md
```

## 왜 필요한가

PRD §19.4: 도메인·저장·채점처럼 실패 비용이 큰 묶음은 다른 총괄이 게이트에서 한 번 독립 검토한다. P1 엔진은 Claude가 구현했고 단위·속성 시험 38개, e2e 4개가 통과했지만, 같은 작성자의 시험은 같은 맹점을 공유할 수 있다.

## 검토 지시

```text
PRD v0.5 §3(상태·틱 순서), §4(경제·모르겠어요 0PT), §5(버닝), §7(타워·강화·판매), §8(편성·HP·감속·안전 정수), §20(정수 단위·이동·피해 순서·편성 인덱스)을 기준으로
src/domain/**와 src/application/RunController.ts를 읽고, PRD와 다르게 동작하는 곳을 찾아라.
특히: 같은 틱 순서(처치 vs 누출, 패배 vs 완료, 피드백 만료 vs 마지막 처치), 보상 중복(encounter·처치·고비·판매),
정지 중 명령 거부, 저장 복원 후 재보상, 감속 출처별 만료, 고정 분모 이동 나머지, 단계별 floor/ceil 순서, 최대 나머지 편성과 보스 인덱스,
안전 정수 경계, 문항 선택의 유한 탐색과 완화 순서, 성능 끊김 처리(RunController.frame).
결함마다 tests/review/<짧은이름>.test.ts에 지금 실패하는 Vitest 시험을 하나 쓴다(기대값은 PRD 문장에서 온다).
처음부터 통과하는 시험은 결함 증거가 아니므로 내지 않는다. 기대값을 구현에 맞추지 않는다.
PRD 자체가 모호하거나 서로 충돌하면 결함이 아니라 ‘PRD 질문’으로 따로 적는다.
```

실행: `npx vitest run tests/review` (실패가 정상), 기존 `npm test`는 계속 통과해야 한다.

## RETURN.md

결함마다: PRD 절·문장, 재현(시험 파일·이름), 실제/기대, 영향(학생에게 보이는 결과), 심각도(공개 차단/높음/보통). PRD 질문 목록. 결함이 없으면 ‘없음’과 함께 무엇을 어떻게 확인했는지.

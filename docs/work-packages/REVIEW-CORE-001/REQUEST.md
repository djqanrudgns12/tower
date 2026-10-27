# REVIEW-CORE-001 — 도메인 엔진 독립 검토(Codex)

```yaml
jobId: REVIEW-CORE-001
status: READY
owner: Codex (총괄이 아닌 검토 역할, 새 문맥)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: ee5833846f0aa227ea3a6e2fe89257b02bae0e33  # docs/prd-v0-5, 2026-10-28 발행 준비
contractHash:  # node tools/contract-hash.mjs REVIEW-CORE-001 — inputFiles별 SHA-256
  vocabulary_td_prd_v0_5.md: 5d6f25e96aee6e07c31ea33d968cfbc210a9336ab4fb5235284db6cb0f20056a
  docs/contracts/balance.candidate.v0.3.json: b78019a76b39609353b6eb3dceabc698428fc5393cea5f30ebaa24762def0bb3
  src/domain/run.ts: 044a47f4a659e265f51e0e19ebee8de1c2d7e7d6459770d66dac9006be38a239
  src/domain/combat.ts: 61135af888fdfd3358814f466940579ea043106516b1d15e64441e5e4dc6a1be
  src/domain/quiz.ts: 57dd2d639f87d829b97af6f243bdcde3a15c7b85f8d7ca62d982c9ab14d89d6c
  src/domain/waves.ts: f26d0826acff0e83dc23e5868827a529ca958177476f869369f49ccc1aea43c2
  src/domain/towers.ts: 355faee47f292ace3699e050a8aec93bedc664d358a1315c33868122f97f24dd
  src/domain/num.ts: fc47ff06493197791599df8ce6d1864a05180d17eff96554d1fff1b7b1964046
  src/domain/rng.ts: ae349ed8cbd2367580a392bb790926b1db5907e962d6ed992d3b9d0432121fee
  src/application/RunController.ts: 234fdb756ba5232b31e98802a976714ffc6488fcecea73864f5430735f367a33
  tests/unit/run.test.ts: d773a0f620a0bf9ac4184b36f1fab0541a09b9d487c0e2c465a525541b59b320
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

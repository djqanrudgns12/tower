---
jobId: WP-CORE
owner: 총괄 Claude Opus 5.5(직접)
issuedAt: 2026-10-30
---

# WP-CORE — 출제·은행·공동검수 게이트를 PRD §9에 맞춘다

1. 런타임은 `published` 은행과 연습 은행만 싣는다(§9.3 "승인 문항만 배포", §9.4 "미승인 문항을 가져오지 않는다"). `grade<N>.candidate.json`은 번들에 넣지 않는다. `VERIFIED_GRADE_BANKS`는 이름을 유지하되 공개 은행만 담는다(로비 낱말 카드가 쓴다).
2. 난이도 게이트(§9.1): 쉬움·보통은 `challenge` 단계와 `dialect`·`idiom_proverb`·`confusable` 유형을 빼고, 어려움·아주 어려움만 이를 낸다. 계약 `questionSelection.difficultyGate`에서 읽는다.
3. 출제(§9.4): 심화 단계 우선 선택이 주기 중간에 큐를 다시 섞지 않는다(풀을 한 바퀴 쓴 뒤 섞기). `RULES_VERSION`을 올린다.
4. 은행 빌드: 후보 판정은 같은 (questionId, revision, contentHash)의 외부 블라인드 검수(codex·claude 중 하나 이상)가 없으면 격리한다. 공개 판정의 총괄 해설 대조는 작성 모델이 아닌 Claude가 한 것만 인정한다. 이 허점을 기대값으로 굳힌 시험을 PRD 문장으로 고친다.
5. 블라인드 입력에서 사전 뜻풀이(`evidenceText`)를 뺀다(공동검수 절차 3단계: 첫 풀이에는 근거를 숨긴다). 근거는 공개 단계 묶음에만 넣는다.
6. 공동검수 자동화 도구 `tools/orchestrate/review.mjs`(블라인드/공개 2단계 묶음 → 브리지 발행 → 형식 검증 → 보고서 병합 → `build:bank`).
7. `fetch-evidence`의 TLS 보안 수준 하향 플래그를 뺀다(이 기기에서 불필요함을 확인).

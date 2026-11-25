---
id: delta-2026-11-25-8f2258
type: delta
title: 브라우저 FPS·저사양 계측은 일반 우선순위(접속 0명) 조건 확인
status: draft
updated: 2026-11-25
tags: [verification, phaser]
delta_kind: new_lesson
ledger: wiki/lessons/ops-and-workflow.md
by: antigravity
---

# 교훈 초안 · 브라우저 FPS·저사양 계측은 일반 우선순위(접속 0명) 조건 확인

- **언제**: npm run test:r6-perf나 전장 통주 E2E로 평균 FPS·자동 화질 전환을 측정할 때
- **규칙**: resource-guard가 학생 접속 감지로 utility 우선순위 상한을 걸면 CPU 1배도 13fps대로 왜곡되므로, 접속 0명·일반 우선순위 여부를 로그로 확인하고 필요 시 최대 2회만 재측정한다.
- **왜**: R6 G5 저사양 측정에서 낮은 우선순위 실행은 W2에서 13.89fps로 중단됐으나 일반 우선순위 재측정은 CPU 6배에서도 W10 완료·59.49fps·정지 0회를 기록했다.
- **검사**: resource-guard status 확인 및 test:r6-perf run.json 로그 대조
- **태그**: `verification`, `phaser`
- **근거**: [docs/renewal/r6/tech/G5-perf.md](../../docs/renewal/r6/tech/G5-perf.md)

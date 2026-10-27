# RIG-001 — 보행·반동·피격 동작(Claude 또는 Codex 별도 문맥)

```yaml
jobId: RIG-001
status: HOLD (ART-SAMPLE-001의 tower.*, enemy.walker.* 가 integrated_pass가 된 뒤 READY)
owner: Claude(새 문맥) 또는 Codex 별도 세션
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
inputFiles:
  - vocabulary_td_prd_v0_5.md
  - public/assets/manifest.json
  - src/game/animation/pose.ts
  - src/game/BattleScene.ts
allowedPaths:
  - src/game/animation/**
  - tests/unit/animation*.test.ts
forbiddenPaths:
  - src/game/BattleScene.ts (연결점이 더 필요하면 REQUESTED_CONTRACT_CHANGE)
  - src/domain/**, src/application/**, src/ui/**, package.json
returnPath: docs/work-packages/RIG-001/RETURN.md
```

## 연결점

렌더러는 적마다 매 프레임 `enemyPose({ kind, phase, time, speedBP, moving, frames, reducedMotion })`를 불러 `{ frame, bob, squashY }`만 그린다(`src/game/animation/pose.ts`). 납품 프레임 수(`enemy.walker.0`~`.3`)는 렌더러가 자동으로 센다. 이 작업은 이 함수와 같은 폴더의 보조 모듈만 바꾼다.

## 인수 기준(PRD §11.3~11.4, V06·V07)

- 4포즈 보행: 발 교대가 보이고 접지 기준점(발 y)이 프레임마다 흔들리지 않는다. 미끄러짐 없이 걸음 빠르기가 `speedBP`에 맞는다.
- 개체마다 위상이 다르다(이미 `phase`로 들어온다). 정지·감소된 모션에서는 bob·squash가 0이다.
- 피격 압축 80~120ms는 지면 기준점을 고정한다. `enemy.walker.hit`을 쓰려면 렌더러 연결이 더 필요하므로 요청으로 남긴다.
- 판정·이동 진행도·보상을 애니메이션 시간으로 만들지 않는다. 전체 그림을 위아래로 흔드는 것만으로 보행을 완료하지 않는다.

## RETURN.md

바꾼 파일, 실제 크기·확대 캡처(접촉판), 프레임 시간표, 요청한 연결점 변경.

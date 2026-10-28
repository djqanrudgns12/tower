# RIG-001 — 보행·반동·피격 동작(Claude 또는 Codex 별도 문맥)

```yaml
jobId: RIG-001
status: READY (ART-SAMPLE-001 인수 2026-10-28: tower.*·enemy.walker.0~3 integrated_pass, enemy.walker.hit·enemy.boss.* visual_pass). 수합 변경을 커밋한 뒤 발행
owner: Claude(새 문맥) 또는 Codex 별도 세션
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: bc3ee0720912d33ff2b96602c365cfdd38e37521  # p1/intake-round1, 2026-10-28 발행 준비
contractHash:  # node tools/contract-hash.mjs RIG-001 — inputFiles별 SHA-256
  vocabulary_td_prd_v0_5.md: 17d72f080a43f384cacec8adbdda1c44c40abad019f98becd0d8dcf68f780f7e
  public/assets/manifest.json: 5569906e3d0241ffa176820563844be8aa7ce680f1dabe1b5d2b3fe52d0504df
  src/game/animation/pose.ts: 25878f392d5458357198e0530082e6e2161207b74b04a28995188aae04e69f88
  src/game/BattleScene.ts: 963c26a206416dfe67570ce2b1a82bafc5cc3d61ff599506c9981b39c7856194
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

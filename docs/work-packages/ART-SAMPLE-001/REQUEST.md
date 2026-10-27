# ART-SAMPLE-001 — 첫 원화 표본(Codex 이미지 생성)

```yaml
jobId: ART-SAMPLE-001
status: READY
owner: Codex (이미지 생성 전용 세션. 총괄 세션과 역할을 나눈다)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: ee5833846f0aa227ea3a6e2fe89257b02bae0e33  # docs/prd-v0-5, 2026-10-28 발행 준비
contractHash:  # node tools/contract-hash.mjs ART-SAMPLE-001 — inputFiles별 SHA-256
  docs/assets/design-41-kingdom-expedition.png: 5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13
  vocabulary_td_prd_v0_5.md: 5d6f25e96aee6e07c31ea33d968cfbc210a9336ab4fb5235284db6cb0f20056a
  src/contracts/assetManifest.ts: 7d2cf0b7aa6d50b7d63fd64765bbce56165469f6878bd45f180674b2c3f3b8e7
  src/game/assets.ts: ff2ec2c8510210ee890b41e0f955c8504635ce47cefc3a802ed067a108ae2421
  docs/archive/design-v0.7/prompts.json: 3b2c9fbeacce6537f5a2a9eac6921a9ce12f8ceb63a751ce109840882d90f00b
inputFiles:
  - docs/assets/design-41-kingdom-expedition.png
  - vocabulary_td_prd_v0_5.md
  - src/contracts/assetManifest.ts
  - src/game/assets.ts
  - docs/archive/design-v0.7/prompts.json
allowedPaths:
  - asset-source/incoming/ART-SAMPLE-001/**
forbiddenPaths:
  - src/**
  - public/**
  - docs/** (이 REQUEST 옆 RETURN.md만 예외)
  - package.json, package-lock.json
deliverable: 아래 표의 PNG 16장(표 12행, 걷기 4·대장 2포즈 포함) + manifest.json + 32/48/64px 참고판 1장 + RETURN.md
returnPath: docs/work-packages/ART-SAMPLE-001/RETURN.md
```

## 왜 지금 이 표본인가

P1 게임은 같은 에셋 ID의 **임시 그림**(Phaser 도형)으로 이미 돌아간다. 납품 PNG가 `integrated_pass`가 되면 `public/assets/manifest.json`에 올라가고, 렌더러가 코드 수정 없이 같은 ID를 PNG로 바꿔 그린다(`src/game/BattleScene.ts` preload, `src/game/assets.ts` applyManifest). 그래서 **ID·크기·기준점이 정확하면 바로 게임에서 확인**된다. 30종을 만들기 전에 이 표본으로 시점·광원·접지·소켓을 잠근다(PRD §11.3, G1).

## 화풍 잠금(41번에서 유지할 것 / 버릴 것)

유지: 밝은 모험 판타지, 둥글고 선명한 실루엣, 큰 색 면, 2~3단 명암, 좌상단 광원, 정사영에 가까운 상부 사선(앞면이 약간 보임), 목재·석재·청동 재료, 외곽선 진한 갈색(#3a291e 계열). 기준 표시 크기에서 외곽선 1.5~2px가 되도록 원본에서는 약 4~6px.

버릴 것(PRD §11.1): 글자·숫자·워터마크, 금장 과다·보석·문양, 유리·발광 효과, 형광색, 등각 격자, 정면 캐릭터, 프레임마다 다른 얼굴·장비·몸 크기, 체크무늬를 투명처럼 그린 배경, 기능 없는 장식.

## 납품 목록(정확히 이것만)

| id | 크기 px | 기준점(originX, originY) | displayCells | layer | 내용 |
|---|---|---|---|---|---|
| `tower.archer` | 192×192 | 0.5, 0.8125 (바닥 중심 96,156) | 1.10 | body | 목재 망루, 초록 지붕. 무기는 그리지 않는다 |
| `tower.archer.weapon` | 192×192 | 0.5, 0.5 (회전축) | 0.80 | weapon | 오른쪽(+x)을 보는 활과 화살. `muzzle`=화살촉 좌표 |
| `tower.cannon` | 192×192 | 0.5, 0.8125 | 1.10 | body | 둥근 석재 받침+목재 포가. 포신 없음 |
| `tower.cannon.weapon` | 192×192 | 0.5, 0.5 | 0.80 | weapon | 오른쪽을 보는 철 포신, 청동 띠. `muzzle`=포구 |
| `tower.frost` | 192×192 | 0.5, 0.8125 | 1.10 | body | 밝은 석재 받침 |
| `tower.frost.weapon` | 192×192 | 0.5, 0.5 | 0.80 | weapon | 떠 있는 얼음 결정(회전하지 않음) |
| `enemy.walker.0`~`.3` | 각 128×128 | 0.5, 0.75 (발 중심 64,96) | 0.72 | body | 붉은 고블린, 오른쪽으로 걷는 4포즈(접지→교차→반대 접지→교차). 4장 모두 같은 얼굴·크기·장비 |
| `enemy.walker.hit` | 128×128 | 0.5, 0.75 | 0.72 | body | 피격 1포즈(국소 눌림, 지면 고정) |
| `enemy.boss.0`~`.1` | 각 192×192 | 0.5, 0.75 (96,144) | 1.15 | body | 뿔과 청동 띠의 보라색 대장, 오른쪽 보행 2포즈 |
| `map.gate` | 256×256 | 0.5, 0.75 | 1.80 | decor | 목재 성문+석재 기둥 둘 |
| `deco.tree` | 192×192 | 0.5, 0.85 | 1.05 | decor | 둥근 수관 나무 |
| `deco.stele` | 192×192 | 0.5, 0.85 | 1.05 | decor | 둥근 머리 비석. **글자는 그리지 않는다**(런타임에 ‘가’를 합성) |

모든 PNG는 **실제 RGBA 알파**(PNG 색 형식 6)여야 한다. 생성 도구의 투명 배경 옵션을 쓴다. 투명 배경을 만들 수 없으면 억지로 배경을 지우지 말고 해당 ID를 HOLD로 반환한다. 몸체는 텍스처 너비의 75~85%를 채우고, 기준점(발·바닥)은 표의 좌표에 정확히 둔다. 같은 캐릭터의 프레임은 하나의 기준 이미지에서 파생해 크기·외곽선 두께를 유지한다.

## 생성 지시문 틀

공통 머리말(모든 장에 붙인다):

```text
Original 2D game sprite for a bright adventure-fantasy tower defense, matching the attached reference style
(design-41-kingdom-expedition.png): rounded bold silhouettes, large flat color areas, 2-3 shading planes,
light from top-left, near-orthographic slight top-down view with the front face slightly visible,
dark brown outline (#3a291e) about 5px at 192px size, wood/stone/bronze materials, clean and readable at 48px.
Single object only, centered, transparent background (real alpha), no text, no numbers, no watermark,
no glow, no gems, no gold filigree, no isometric grid, no ground tile, no drop shadow outside the object.
```

장별 꼬리 예: `tower.archer`는 “a small wooden watchtower with a green pitched roof, sturdy legs, NO archer and NO bow (the weapon is a separate sprite), base bottom-center at pixel (96,156)”. `enemy.walker.N`은 “the SAME red goblin (same face, same spear, same size) in walk pose N of 4 facing right: N=0 left foot planted, 1 legs crossing, 2 right foot planted, 3 legs crossing; feet touch y=96”. 무기 장은 “facing +x (right), rotation pivot at image center, muzzle at the tip”.

## manifest.json(납품 형식)

`src/contracts/assetManifest.ts`의 Zod 스키마를 그대로 따른다. 예:

```json
{ "schemaVersion": "1", "jobId": "ART-SAMPLE-001", "styleReferenceSha256": "5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13",
  "assets": [{ "id": "tower.archer.weapon", "revision": 1, "file": "tower.archer.weapon.r1.png", "width": 192, "height": 192,
    "originX": 0.5, "originY": 0.5, "displayCells": 0.8, "muzzle": { "x": 178, "y": 96 }, "layer": "weapon", "frames": 1,
    "status": "draft", "sourceHash": "<원본 sha256>", "artifactHash": "<납품 PNG sha256>", "producer": "<실제 모델·도구명>", "license": "자체 생성, 프로젝트 전용" }] }
```

`status`는 `draft`만 쓴다. `technical_pass`·`visual_pass`·`integrated_pass`는 총괄이 검수 후 올린다(PRD §11.2).

## 자체 확인(반환 전)

1. `npm run validate:assets` — 형식·PNG 크기·RGBA·해시를 검사한다. 실패 항목은 고치거나 HOLD.
2. 32/48/64px로 줄인 참고판 한 장(`contact-sheet.png`)에서 궁수·포탑·서리가 이름 없이 구별되는지, 고블린 4포즈가 같은 캐릭터인지 본다.
3. 같은 결함으로 두 번 실패하면 지시문만 바꾸지 말고 접근을 바꾼다(기준 이미지 하나에서 파생, 부품 분리 등). 세 번이면 해당 ID를 HOLD로 남기고 다음 ID를 진행한다.

## RETURN.md에 쓸 것

model_work_orders_v0_5 §8 형식. 장별 생성 방식·실제 모델명·재생성 횟수·반려 후보·HOLD 사유, `npm run validate:assets` 실제 출력, 참고판 경로. 생성 성공을 visual_pass로 적지 않는다.

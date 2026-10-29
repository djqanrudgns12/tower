# ART-002 — 정원 지면·설치 받침·작은 장식(Codex 이미지 생성)

```yaml
jobId: ART-002
status: READY
owner: Codex (이미지 생성 세션. 총괄 세션과 역할을 나눈다)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: ea7ffe4750c1f96256447e1e065bb7c2be3c8f23  # p1/intake-round1, 2026-10-29 발행 준비
contractHash:  # node tools/contract-hash.mjs ART-002 — inputFiles별 SHA-256
  docs/assets/design-41-kingdom-expedition.png: 5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13
  docs/style-lock-v1.md: 9cef3809c446c28e77316ca8c4ac3b2fc3f2f09e14f1c82539e7dfe604471ceb
  vocabulary_td_prd_v0_5.md: 01c44eddd7d7727931f6dd2c00694d4489401a73099d66c5754ba294d3a9c3cf
  src/contracts/assetManifest.ts: 7d2cf0b7aa6d50b7d63fd64765bbce56165469f6878bd45f180674b2c3f3b8e7
  src/game/assets.ts: ff2ec2c8510210ee890b41e0f955c8504635ce47cefc3a802ed067a108ae2421
  src/game/art.ts: a5aad7bd4560aa6a6af777871097d8a08c1a1d4459a80bffe5d99f37f3d9f2e5
  docs/contracts/maps.candidate.v0.4.json: 70c7d2d30d35c72e36264064a0e60fdc9a602cc07951d8520cd13f88c0ea29a1
  public/assets/manifest.json: 5569906e3d0241ffa176820563844be8aa7ce680f1dabe1b5d2b3fe52d0504df
  asset-source/incoming/ART-SAMPLE-001/contact-sheet.png: a2832f8430b8c2be652facbbd89f72c077c284e186e8ee8068b562cc68c3d05d
inputFiles:
  - docs/assets/design-41-kingdom-expedition.png
  - docs/style-lock-v1.md
  - vocabulary_td_prd_v0_5.md
  - src/contracts/assetManifest.ts
  - src/game/assets.ts
  - src/game/art.ts
  - docs/contracts/maps.candidate.v0.4.json
  - public/assets/manifest.json
  - asset-source/incoming/ART-SAMPLE-001/contact-sheet.png
allowedPaths:
  - asset-source/incoming/ART-002/**
forbiddenPaths:
  - src/**
  - public/**
  - asset-source/incoming/ART-SAMPLE-001/** (읽기만)
  - docs/** (이 REQUEST 옆 RETURN.md만 예외)
  - package.json, package-lock.json
deliverable: 아래 표의 PNG 11장 + manifest.json + tile-check.png + preview-garden_u.png + RETURN.md
returnPath: docs/work-packages/ART-002/RETURN.md
```

## 왜 지금 이 작업인가

ART-SAMPLE-001로 타워 3종·고블린·성문·나무·비석은 원화가 되었다. 하지만 그 밑의 **풀밭·흙길·설치 받침·작은 덤불은 아직 Phaser 도형으로 그린 임시 그림**(`src/game/art.ts`의 `drawGround`)이다. 그래서 전장에서 원화와 임시 그림이 섞여 보인다. 이번 작업은 3학년 정원 맵(`garden_u`)의 바닥 재료를 원화로 바꾼다.

## 이번 방식: 그림 한 장이 아니라 재료를 납품한다

맵 전체를 한 장으로 그리지 않는다. 길과 설치 칸은 데이터(`docs/contracts/maps.candidate.v0.4.json`)가 정하고, 그림에서 길을 읽지 않는다(PRD §6.2, §11.1 반려 항목). 그래서 Codex는 **이어 붙일 수 있는 질감과 낱개 소품**을 만든다. 총괄은 인수 뒤 렌더러에서 맵 데이터대로 이렇게 조립한다.

1. `ground.grass`를 2칸 간격으로 빈틈없이 깐다. 그 위에 `ground.patch.0/1`을 칸마다 정해진 난수로 흩뿌려 반복 무늬를 깬다.
2. 길은 셀 중심선을 따라 폭 0.80셀, 모서리를 둥글린 띠 모양으로 `ground.dirt` 질감을 잘라 넣는다. 가장자리 띠(폭 약 0.05셀)는 렌더러가 `#b38a55`로 그린다.
3. `slot.base`를 설치 칸 20곳의 칸 중심에 둔다. 타워는 그 위에 선다.
4. 길·설치 칸·고정 장식이 아닌 칸에는 `deco.bush.0/1`·`deco.pebble`·`deco.flowers` 중 하나 이하를 둔다. 고정 자연 장식 칸 가운데 나무가 아닌 칸에는 `deco.rock`을 둔다(정원 맵에서는 (5,8)).
5. 입구 칸 바깥쪽에 `map.entry`를 세운다.

그러므로 **크기·기준점·이음매가 정확해야** 조립이 된다. 질감의 색과 무늬가 좋아도 이음매가 보이면 반려한다.

## 화풍(ART-SAMPLE-001과 같은 세계)

- 기준: `docs/assets/design-41-kingdom-expedition.png`(41번)와 `docs/style-lock-v1.md`. 이미 인수된 원화(`public/assets/*.png`, 한눈에 보기는 `asset-source/incoming/ART-SAMPLE-001/contact-sheet.png`)와 한 화면에 놓여도 어울려야 한다.
- 유지: 밝은 모험 판타지, 둥근 실루엣, 큰 색 면, 2~3단 명암, 좌상단 광원, 정사영에 가까운 상부 사선(앞면이 약간 보임). 소품 외곽선은 진한 갈색(#3a291e 계열)이고, 128px 장은 약 3~4px, 192px 장은 약 5px다.
- **바닥 질감은 조용해야 한다.** 그 위의 길·고블린(빨강)·타워·HP 막대가 먼저 읽혀야 하므로 명도 대비를 낮게 하고, 무늬는 작은 풀 포기·작은 돌 정도로 성기게 둔다. 바닥 질감에는 외곽선을 넣지 않는다.
- 색 출발점(현재 임시 그림): 풀 평균 `#7cbc4c`(밝은 풀 `#98cd63`, 짙은 풀 `#64a23e`), 흙 평균 `#dcb878`(밝은 흙 `#e8cd95`), 길 가장자리 `#b38a55`. 평균색은 이 값에서 명도 ±8% 안에 둔다.
- 버릴 것(PRD §11.1): 글자·숫자·워터마크, 금장·보석·문양, 발광, 형광색, 등각 격자, 체크무늬를 투명처럼 그린 배경, 기능 없는 장식, 그림 안에 그린 길·격자·설치 표시.

## 납품 목록(정확히 이것만)

`displayCells`는 전장에서 보이는 너비(칸)다. 바닥 질감은 칸당 원본 128px(`TEX=2`)에 맞춘다.

| id | 크기 px | 기준점(originX, originY) | displayCells | layer | 내용 |
|---|---|---|---|---|---|
| `ground.grass` | 256×256 | 0, 0 | 2.0 | ground | 풀밭 질감. **상하·좌우 모두 이음매 없이 반복.** 불투명 |
| `ground.patch.0` | 192×192 | 0.5, 0.5 | 1.5 | ground | 조금 밝은 풀 얼룩 한 덩이. 가장자리는 둥글고 바깥은 투명 |
| `ground.patch.1` | 192×192 | 0.5, 0.5 | 1.5 | ground | 조금 짙은 풀 얼룩 한 덩이(작은 풀 포기 몇 개). 바깥은 투명 |
| `ground.dirt` | 256×256 | 0, 0 | 2.0 | ground | 흙길 질감(다져진 황토, 작은 돌 몇 개). **상하·좌우 반복.** 불투명. 길 모양·가장자리는 그리지 않는다 |
| `slot.base` | 192×192 | 0.5, 0.5 | 1.0 | ground | 설치 받침: 낮고 넓은 둥근 사각 돌판. 아래 ‘설치 받침 규격’을 따른다 |
| `deco.rock` | 192×192 | 0.5, 0.85 | 1.05 | decor | 고정 장식용 바위 무더기(큰 돌 둘·작은 돌 하나). `deco.tree`와 같은 크기 규칙 |
| `deco.bush.0` | 128×128 | 0.5, 0.8 | 0.6 | decor | 둥근 덤불 |
| `deco.bush.1` | 128×128 | 0.5, 0.8 | 0.6 | decor | 노랑·분홍 꽃이 몇 송이 핀 덤불(`deco.bush.0`과 같은 덤불 모양을 바탕으로) |
| `deco.pebble` | 128×128 | 0.5, 0.8 | 0.5 | decor | 작은 돌 둘셋 |
| `deco.flowers` | 128×128 | 0.5, 0.7 | 0.5 | decor | 땅에 낮게 핀 들꽃 한 무더기(노랑·크림색) |
| `map.entry` | 192×192 | 0.5, 0.85 | 0.8 | decor | 입구 표시: 나무 기둥에 파란 삼각 깃발(성문 깃발과 같은 파랑). 글자 없음 |

공통 규칙:

- 모든 PNG는 **RGBA**(PNG 색 형식 6)로 저장한다. 불투명 질감도 알파 255인 RGBA로 저장한다.
- 소품(`decor`와 `slot.base`, 얼룩)은 **실제 알파 배경**이어야 한다. 투명 배경을 만들 수 없으면 억지로 배경을 지우지 말고 그 ID를 HOLD로 반환한다.
- 소품의 접지점(기준점)은 표의 좌표에 정확히 둔다. 소품마다 바닥에 붙은 짧은 그림자는 몸체 안에서 끝낸다(바깥으로 번지는 그림자 금지).
- 소품은 1칸을 넘지 않는다. 이웃 설치 칸·길 위 적을 가리면 반려한다(PRD §6.2).

### 이어 붙이는 질감(`ground.grass`, `ground.dirt`)

- 생성 원본에서 질감을 얻고, 이음매·크기는 스크립트로 맞춰도 된다(예: 오프셋 반 바퀴 후 이음매 정리). 이 경우 원본과 스크립트를 `asset-source/incoming/ART-002/` 안에 남긴다.
- 2칸 간격 반복이 눈에 띄지 않게 큰 얼룩·뚜렷한 돌을 한 장에 몰지 않는다. 반복 깨기는 얼룩(`ground.patch.*`)이 맡는다.
- 측정: 질감마다 **(가) 오른쪽 끝 열과 왼쪽 첫 열**, **(나) 아래 끝 행과 위 첫 행**의 RGB 평균 절대차를 잰다. 같은 장 안쪽의 이웃한 두 열(행) 평균 절대차와 비교해 1.5배 이하여야 한다. 실제 수치를 RETURN.md에 적는다.

### 설치 받침 규격(`slot.base`)

- 원본 192px가 정확히 한 칸이고, 기준점 (96,96)이 칸 중심이다.
- 타워는 칸 중심보다 0.32칸 아래에 바닥 중심을 둔다. 즉 받침 원본에서 **(96,157)이 타워 바닥이 닿는 점**이다. 이 점이 받침 윗면 안에 들어와야 한다.
- 권장 윤곽: 윗면 x 16~176, y 44~160(평평하고 밝은 돌, 좌상단이 밝음), 앞면(두께) y 160~178. 바깥은 투명.
- 빈 받침만 보고도 ‘여기에 놓을 수 있다’가 읽혀야 하고, 고정 장식(바위·비석)과 모양이 확실히 달라야 한다. 이끼·풀 자국은 가장자리에 조금만 둔다. 문양·보석·글자는 넣지 않는다.

## manifest.json(납품 형식)

`src/contracts/assetManifest.ts`의 Zod 스키마를 그대로 따른다. 형식은 ART-SAMPLE-001과 같다.

- `jobId`는 `ART-002`, `styleReferenceSha256`은 41번 해시다.
- `revision`은 1, `frames`는 1이다.
- `status`는 `draft`만 쓴다. 검수 상태는 총괄이 올린다(PRD §11.2).
- `sourceHash`는 생성 원본 파일의, `artifactHash`는 납품 PNG의 실제 SHA-256이다.
- `producer`는 실제 모델·도구명이다. `license`는 "자체 생성, 프로젝트 전용"이다.

## 자체 확인(반환 전)

1. `npm run validate:assets`를 돌려 형식·PNG 크기·RGBA·해시를 확인한다. 실패 항목은 고치거나 HOLD로 남긴다.
2. **`tile-check.png`**: `ground.grass`와 `ground.dirt`를 각각 3×3으로 반복해 붙인 판이다. 이음매 선이나 같은 무늬 반복이 보이는지 직접 본다.
3. **`preview-garden_u.png`**: 위 ‘이번 방식’ 1~5대로 `garden_u`를 조립한 미리보기다.
   - 크기: 15×9칸, 칸당 64px(960×576)와 그 2배(1920×1152) 두 장. 파일 이름은 `preview-garden_u.png`, `preview-garden_u@2x.png`다.
   - 맵 데이터: `docs/contracts/maps.candidate.v0.4.json`의 `pathCells`·`slots`·`decorations`·`entryCell`·`exitCell`.
   - 함께 놓을 기존 원화(`public/assets/`): 설치 칸 세 곳에 `tower.archer`·`tower.cannon`·`tower.frost` 몸체(바닥 중심을 칸 중심 +0.32칸에, 1.1칸 너비로), 길 위에 `enemy.walker.0` 둘(발을 칸 중심 +0.14칸에, 0.72칸 너비로), 나무 칸에 `deco.tree`, 문화 칸에 `deco.stele`, 출구에 `map.gate`.
   - 미리보기는 조립 확인용이며 납품물이 아니다. 렌더러와 1px까지 같을 필요는 없다.
   - 볼 것: 길이 바닥과 분명히 구별되는지, 빨간 고블린·타워가 바닥 위에서 먼저 보이는지, 빈 받침이 고정 장식과 다르게 보이는지, 2칸 반복이 드러나지 않는지, 기존 원화와 색·외곽선·광원이 어긋나지 않는지.
4. 같은 결함으로 두 번 실패하면 지시문만 바꾸지 말고 접근을 바꾼다(원본 하나에서 파생, 스크립트로 이음매 정리 등). 세 번이면 그 ID를 HOLD로 남기고 다음 ID를 진행한다.

## 이번에 하지 않는 것

- 다른 맵 테마(강가·성곽 안뜰·눈) 지면. P2에서 맵별로 따로 낸다.
- 고블린·대장 추가 프레임(위/아래 방향, 보폭이 긴 걸음). RIG-001 연결 뒤 실제 화면을 보고 따로 낸다.
- 무드 색(§11.5)은 렌더러가 색층으로 입히므로 그림으로 만들지 않는다.
- UI 틀·아이콘.

## RETURN.md에 쓸 것

model_work_orders_v0_5 §8 형식으로 쓴다.

- 시작 확인 출력
- 장별 생성 방식·실제 모델명·재생성 횟수·반려 후보·HOLD 사유
- 질감 이음매 측정값
- `npm run validate:assets` 실제 출력
- `tile-check.png`·`preview-garden_u*.png` 경로와 직접 본 결과
- 총괄이 렌더러에 반영할 때 알아야 할 점(권장 얼룩 밀도, 길 폭에 대한 의견 등)

생성 성공을 visual_pass로 적지 않는다.

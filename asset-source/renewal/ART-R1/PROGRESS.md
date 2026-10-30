# ART-R1 정원 맵 고도화 키트 결과

- 담당: Codex. 생성: 내장 `image_gen.imagegen`. 41번 원화와 기존 인수 그림을 참조.
- 요청 27종 중 **24종 자체 1차 검수 통과 / draft**, 새 숲 3종 반려. 총 32회 생성, 항목당 최대 3회.
- 이 작업의 쓰기는 `asset-source/renewal/ART-R1/` 안에서만 수행. `src`·`public`·`docs`·패키지 수정 및 commit/push 없음.
- 자체 검수는 총괄 인수와 별개다. 실제 게임·브라우저·기기 검수는 미실행.

## 납품 파일

- 그림 24장: `manifest.json`의 `assets`가 정확한 목록. 상태는 모두 `draft`.
- 기본 프롬프트/재시도: `prompts.json`. 원본 32장: `sources/`. 개별 생성 기록: `logs/*.generation.json`.
- 처리/합성: `prepare.py`, `garden_u.layout.json`. 난수·좌우반전 없음.
- 접촉판: `contact-sheet-light.png`, `contact-sheet-dark.png` — 각 항목 32/48/64px와 기존 나무·비석·타워 비교.
- 이음매: `tile-check.png`. 새 받침+기존 타워: `slot-tower-check.png`.
- 합성: `garden_u.preview.empty.png`, `garden_u.preview.towers.png` — 둘 다 1920×1152.
- 증거: `measurements.json`, `layout-measurements.json`, `visual-review.json`, `logs/final-verification.json`.
- 반려 원본은 삭제하지 않았다. `rejected/index.json`은 8개 반려 시도의 원본 경로와 이유를 연결한다.
- 전체 파일 목록: `file-list.txt`.

## 항목별 상태

| id | 규격 | 선택 시도 | 상태 |
|---|---|---:|---|
| `ground.grass.base` | 256×256 | 1 | draft / 자체 1차 통과 |
| `ground.grass.light` | 256×256 | 1 | draft / 자체 1차 통과 |
| `ground.grass.shade` | 256×256 | 1 | draft / 자체 1차 통과 |
| `ground.meadow.0` | 384×384 | 2 | draft / 자체 1차 통과 |
| `ground.meadow.1` | 384×384 | 2 | draft / 자체 1차 통과 |
| `ground.meadow.2` | 384×384 | 2 | draft / 자체 1차 통과 |
| `path.dirt` | 256×256 | 1 | draft / 자체 1차 통과 |
| `path.tuft.0` | 128×128 | 1 | draft / 자체 1차 통과 |
| `path.tuft.1` | 128×128 | 1 | draft / 자체 1차 통과 |
| `path.tuft.2` | 128×128 | 1 | draft / 자체 1차 통과 |
| `path.pebbles.0` | 128×128 | 1 | draft / 자체 1차 통과 |
| `path.pebbles.1` | 128×128 | 1 | draft / 자체 1차 통과 |
| `path.pebbles.2` | 128×128 | 1 | draft / 자체 1차 통과 |
| `slot.pad.0` | 192×192 | 1 | draft / 자체 1차 통과 |
| `slot.pad.1` | 192×192 | 1 | draft / 자체 1차 통과 |
| `edge.forest.0` | 384×384 | — | 반려 / 미납품 |
| `edge.forest.1` | 384×384 | — | 반려 / 미납품 |
| `edge.forest.2` | 384×384 | — | 반려 / 미납품 |
| `edge.rocks.0` | 256×256 | 1 | draft / 자체 1차 통과 |
| `edge.rocks.1` | 256×256 | 1 | draft / 자체 1차 통과 |
| `landmark.pond` | 384×192 | 1 | draft / 자체 1차 통과 |
| `prop.flowerbed` | 192×192 | 1 | draft / 자체 1차 통과 |
| `prop.mushrooms` | 128×128 | 1 | draft / 자체 1차 통과 |
| `prop.log` | 192×128 | 1 | draft / 자체 1차 통과 |
| `prop.stump` | 128×128 | 1 | draft / 자체 1차 통과 |
| `prop.fence.h` | 256×128 | 1 | draft / 자체 1차 통과 |
| `prop.fence.v` | 128×256 | 1 | draft / 자체 1차 통과 |

## 자체 반려와 재생성

| 항목 | 시도 | 반려 이유 / 후속 |
|---|---:|---|
| edge.forest.0 | 1 | 잎 5단 이상 층과 줄기 잡질감. §5.4 |
| edge.forest.0 | 2 | 줄기는 단순해졌으나 잎의 4단 이상 명암이 남음. §5.4 |
| edge.forest.0 | 3 | 중간 명암 띠와 내부 그라데이션이 남음. 최대 3회 도달하여 중단. §5.4 |
| edge.forest.1 / edge.forest.2 | 각 1 | 잎 명암 4단 이상. 같은 생성 방식의 forest.0이 3회 실패하여 추가 반복 중단. §5.4 |
| ground.meadow.0 / 1 / 2 | 각 1 | 진한 잎·외곽선 또는 딱딱한 경계로 붙인 얼룩처럼 보임. 각 2차는 외곽선 없는 저대비·실제 알파의 부드러운 얼룩으로 교체. |

## 처리와 배치

- 지면 4종은 ART-002 방식의 평균색·16px 양축 경계 연결을 적용했다. 요청한 저대비를 위해 풀은 원본 대비 0.28, 흙은 0.6 배율로 정리했다. 줄기/소품 명암을 후처리로 덮지 않았다.
- 투명 소품은 생성 알파를 유지하고 알파 경계로 자른 뒤 비율 유지 축소·투명 여백만 적용했다. 흰색/검정색 키 제거·가짜 투명 생성 없음.
- 풀밭 얼룩은 반투명 지면이므로 완전 불투명 픽셀을 강제하지 않는다. 다른 소품은 알파 최댓값 250 이상, 모든 투명 그림은 실제 알파 0과 투명 프레임 경계를 확인했다.
- 풀 3톤은 손으로 지정한 큰 타원 마스크로 섞고, 얼룩은 길 아래에 합성했다.
- `pathCells`에서 방향 전환점을 추출해 둥근 길 중심선을 잇는다. 길 경계 띠·수동 폭 변화·굽이 바퀴 자국·풀 술·자갈을 배치했다.
- 받침 20개는 계약의 `slots`에서 가져왔다. 장식 5칸은 `decorations` id로 연결했다: 연못 d03~d05, 비석 d01, 바위 정원 d02.
- 소품은 손으로 정한 3~5개 군집이다. 길 중심 68px 및 받침 보호 영역과 불투명 소품의 가림 검출은 0건.
- 새 숲 3종이 반려되어 합성 가장자리에는 **기존 인수 `public/assets/deco.tree.r1.png`**만 3개씩 묶어 사용했다. 배치표의 `fallbackFor`로 명시했다. 이것은 새 숲 납품 성공이 아니다.
- 세로 울타리는 긴 축 2칸, 가로 폭 1칸이다. manifest의 `displayWidthCells=1`, `displayHeightCells=2`를 사용한다.

## 검증 기록

- 실행: 원본별 크기·RGBA·실제 알파·투명 프레임·해시 검사. 지면 4종의 양축 경계 오차 0.
- 재사용: 변경 없는 21종의 기존 기술 검사. 얼룩 3종 2차만 새로 처리했다.
- 실행: `uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R1/prepare.py verify` → 24종, 오류 0, 원본 32장, 시도 상한 3, 보호 영역 가림 0.
- 실행: 최종 밝은·어두운 축소 접촉판, 빈/타워 합성 2장, 새 받침+기존 타워 3종의 시각 확인.
- 미실행: 앱 빌드·e2e·실제 게임 적용·총괄 인수. 앱 코드 변경이 없는 자산 작업이므로 전체 검사는 실행하지 않았다.

## 총괄 판단 / 남은 일

1. 새 숲 3종의 재작업 방향을 정해야 한다. 현 생성 결과의 4단 이상 명암을 통과시켜서는 안 된다. 합성의 기존 나무 대체 배치는 신규 숲 인수로 세지 않는다.
2. 24개 draft의 실제 크기 화풍·작은 소품 외곽선·받침과 기존 타워 기단의 중첩을 총괄이 최종 인수해야 한다.
3. 현재 산출물은 재료와 정적 합성이다. 라이브 맵 렌더러 연결·움직임·시간대 효과는 이 요청 범위에서 미실행이다.

## 동시 작업 관측

- 실행 중 HEAD가 `bf55f41` → `0df506d`로 바뀌었고, `src/game/BattleScene.ts` 해시가 달라졌다. 별도 BattleScene 층 분리/통합 커밋이 관측되었다. 이 작업에서 해당 파일을 수정하거나 commit하지 않았다.
- `logs/scope-observation.json`과 `preservation-baseline.json`에 근거를 보존했다. 이를 되돌리지 않았다. 현재 tracked 미커밋 diff는 없다.

## 재현

```sh
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R1/prepare.py prepare
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R1/prepare.py preview
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R1/prepare.py verify
```

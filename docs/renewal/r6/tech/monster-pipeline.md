# R6 몬스터 Spine 제작 공정

[R6 PRD §4](../PRD-r6.md)와 [아트 설정표](../bible/monsters.md)를 따른다. 종족마다 일반 계통 뼈대 4개와 보스 개별 뼈대 4개를 내보낸다. 일반 계통은 같은 뼈대에 `T1`~`T4` 스킨을, 보스는 각 프로젝트에 해당 단계 스킨 하나를 넣는다. 5종족 전체는 뼈대 40개와 개체 100개다.

## Antigravity에 요청할 그림

1. **개체마다 분해 시트와 조립 그림을 한 쌍으로 준다.** 두 그림은 오른쪽을 향한 같은 3/4 시점으로 그린다. 같은 계통의 네 단계는 카메라·발밑 원점·관절 위치를 고정한다. R04 6색의 무광 면과 외곽선으로 형태를 구분한다. 밝은 빛 번짐, 광택, 피, 공포, 치비, 밈, 음식 소재를 피한다.
2. **분해 시트는 개체 하나당 1536×1024 RGBA PNG 한 장이다.** 아래의 글자 없는 PNG를 참고 이미지로 넣고 함께 있는 JSON의 `slots.<슬롯>.box`대로 배치한다. 좌표는 좌상단 기준 `[왼쪽, 위, 오른쪽, 아래]`다. 오른쪽과 아래는 포함하지 않는다. 슬롯 칸마다 부품 하나를 놓고 칸 가장자리에서 최소 12px를 비운다. 가까운쪽·먼쪽, 몸통·장갑·표식, 팔·손, 다리·발을 각각 분리한다. 관절의 숨은 면은 조립 뒤에도 3~6px 겹치도록 완성한다. 선택 슬롯은 비울 수 있다. 팔 없는 이족 단계는 별도 명세로 기록한다.
3. **조립 그림은 투명 RGBA로 개체 하나를 같은 자세에 세운다.** 발끝과 먼쪽 관절의 방향을 확인할 수 있게 그린다. 조립 그림과 분해 시트에서 같은 개체의 부품을 사용한다. 그림자는 전장에서 그린다. 두 완성 그림에는 배경, 격자, 표식용 선·점, 글자, 번호를 남기지 않는다.
4. **이름과 좌표는 JSON에만 적는다.** 피벗을 확정할 수 있으면 조립 캔버스 `256×256`, 발밑 원점 `[128,216]`, 게임 좌표 한 단위당 3px를 기준으로 뼈별 좌표를 준다. 같은 칸 안에서 붙은 두 부품, 가려진 원본 화소, 가까운쪽과 먼쪽이 바뀐 그림은 자동 판별하기 어렵다. 이 경우 분리된 파츠로 다시 받거나 수동 마스크를 쓴다.

### 안내판 선택

모든 아래 링크와 같은 위치에 동일한 이름의 `.json`이 있다. `required`는 기본 필수 슬롯, `target`은 조립 캔버스의 기본 부품 영역, `pivots`는 조립 캔버스의 뼈 좌표다. PNG 오른쪽 작은 판의 앰버 십자는 발밑 원점, 틸 점은 관절이다.

| 계통 | 안내판 PNG | 주요 부품 |
| --- | --- | --- |
| 보병 `infantry` | [이족](../../../../asset-source/r6/monsters/_guides/infantry-biped.png) | 몸통, 머리, 양쪽 팔·손·다리·발 |
| 질주 `runner` | [사족](../../../../asset-source/r6/monsters/_guides/runner-quadruped.png) | 몸통, 머리, 앞뒤·좌우 다리와 발 |
| 중장갑 `armored` | [이족](../../../../asset-source/r6/monsters/_guides/armored-biped.png) · [사족](../../../../asset-source/r6/monsters/_guides/armored-quadruped.png) | 걸음 틀의 팔다리, 별도 장갑·방패 |
| 특수 `special` | [비행](../../../../asset-source/r6/monsters/_guides/special-flying.png) · [군집](../../../../asset-source/r6/monsters/_guides/special-swarm.png) · [바퀴](../../../../asset-source/r6/monsters/_guides/special-wheeled.png) · [수정](../../../../asset-source/r6/monsters/_guides/special-crystal.png) | 엘프의 날개 두 장, 기계·벌레의 작은 개체 최대 세 개, 인간의 바퀴 두 개, 바위의 수정 두 장 |
| 보스 `boss-t1`~`boss-t4` | [이족](../../../../asset-source/r6/monsters/_guides/boss-biped.png) · [사족](../../../../asset-source/r6/monsters/_guides/boss-quadruped.png) | 큰 체급과 장비, 별도 `skill` 피벗 |

군집의 선택 다리 6개는 벌레의 뒤 단계에서 쓸 수 있다. 공용 선택 슬롯은 `armor`, `mark`, `gear`, `shadow`다. 전장의 기본 그림자를 쓰는 개체는 `shadow`를 비운다.

## 실행

저장소 루트에서 공용 Spine 4.3.26과 Pillow·NumPy, 저장소 Node 의존성, Playwright Chromium, `cwebp`를 쓴다. 신규 출력 디렉터리를 사용한다.

```sh
r6_python="$HOME/.agents/skills/spine-authoring/runtime/.venv/bin/python"
r6_source="/파츠/종족"
r6_work="$(mktemp -d)/monster"

"$r6_python" -B tools/r6/spine/monsters.py template "$r6_source" infantry
"$r6_python" -B tools/r6/spine/monsters.py prepare "$r6_source" "$r6_work"
"$HOME/.local/bin/resource-guard" status --profile avatar
"$HOME/.local/bin/resource-guard" run --profile avatar --wait-seconds 900 -- \
  "$r6_python" -B tools/r6/spine/monsters.py export "$r6_work"
node tools/r6/spine/check-runtime.mjs "$r6_work"
"$r6_python" -B tools/r6/spine/review.py "$r6_work/review" "$r6_work"
"$HOME/.local/bin/resource-guard" run --profile test --wait-seconds 900 -- \
  node tools/r6/spine/capture-playwright.mjs "$r6_work" "$r6_work/shots"
```

임시 파츠는 `sample.py asset-source/r6/monsters/_pipeline-test/species.json "$r6_source"`를 같은 Python으로 실행해 만든다. `r6_source`는 새 폴더를 지정한다. `prepare`는 파츠의 알파 여백을 자르고 잘라내기 전 위치를 부착물 오프셋에 보존한다. `export`는 Spine CLI로 `.spine`과 런타임 JSON을 왕복하고 종족 공용 아틀라스를 한 장 만든다. 편집 프로젝트는 `export/projects/`, 런타임 파일은 `export/<종족>/`에 들어간다. 에셋을 연결할 때 `manifest-fragment.json`의 `atlases`·`rigs`·`species` 항목을 검토한 다음 전장 매니페스트에 합친다. 임시 파츠는 캡처 페이지에서 네트워크 응답으로만 주입한다. [Spine CLI](https://esotericsoftware.com/spine-command-line-interface), [Phaser용 Spine 런타임](https://esotericsoftware.com/spine-phaser).

### 분해 시트 절단

```sh
"$r6_python" -B tools/r6/spine/cut_parts.py cut \
  "$r6_sheet" "$r6_assembly" asset-source/r6/monsters/_guides/infantry-biped.json "$r6_source" \
  --species machine --entry infantry --skin T1
"$r6_python" -B tools/r6/spine/monsters.py prepare "$r6_source" "$r6_work" --actor infantry T1
```

- `cut_parts.py guides <새 폴더>`로 PNG·JSON을 재생성한다. `cut`은 알파 연결 성분을 안내판 칸에 대응시킨다. 조립 그림이 `256×256`이면 원래 좌표를 사용한다. 다른 크기는 캐릭터를 가로 가운데와 발밑 원점에 맞춘다. 조립 그림의 바깥 치수에 부품 기본 영역을 맞추고, 부품 자체의 가로세로 비율을 유지한다. 피벗 추정은 해당 부품의 기준점 주변 불투명 화소를 사용한다.
- `report.json`에 칸 밖, 칸 겹침, 잘림, 미분리, 필수 슬롯 누락을 남긴다. 막힘이 있으면 종료 코드 2와 비교용 그림을 남긴다. 대응을 마친 개체는 슬롯별 투명 `256×256` PNG와 `species.json`을 출력한다. `silhouetteIoU`는 조립 결과를 원화와 비교하는 수치다. 조립 자세·관절 가림·걷기 중 틈은 그림과 재생을 보고 판정한다.
- `--placement <JSON>`에서 `targets`(슬롯별 조립 영역), `pivots`(뼈별 조립 좌표), `scale`(게임 표시 배율), `armless`(팔 없는 이족 단계)를 지정할 수 있다. 구형 RGB 설정화만 `reference.box/background`와 `legacy.background/parts`를 쓴다. 아래 보병 T1의 명세에 배경색, 분리 좌표, 의도적으로 자른 변이 있다. 단색 배경과 색이 유사한 외곽선은 일부 빠질 수 있다. 개별 픽셀을 살려야 하면 `monsters.py extract <시트> <마스크 명세.json> <새 폴더>`를 쓴다.
- 종족 입력 키는 `elf`, `human`, `machine`, `insect`, `stone`이다. 설정표의 `mech`·`golem`에 대응하는 값은 `machine`·`stone`이다. 개체별 출력의 단계 폴더를 종족 폴더에 모은다. 일반 계통은 `infantry/T1`~`T4`, `runner/T1`~`T4`, `armored/T1`~`T4`, `special/T1`~`T4`다. 보스는 `boss-t1/T1`~`boss-t4/T4`다. `species.json`의 `rigs`는 계통마다 하나다. T1의 피벗을 기준으로 T2~T4를 같은 관절에 정렬하고, 승인한 팔 없는 단계는 `armlessSkins`에 모은다. 종족 전체를 준비할 때는 `prepare`의 `--actor` 옵션을 생략한다.

### 기계 군단 보병 T1 시범

기계 라인업의 첫 보병과 분해도의 T1 머리·공용 골반·양쪽 다리로 조립했다. 정찰 보행기에는 팔이 없어서 `armlessSkins: ["T1"]`을 썼다. 분해도의 다리와 발이 붙어 있어 양쪽 절단선과 조립 좌표를 기록했다. 다음 시트에는 보병 T1 단독 조립 그림, 골반과 머리, 가까운쪽·먼쪽 다리와 발을 각각 요청한다. [기계 라인업](../bible/sheets/monsters-mech.webp) · [기계 분해도](../bible/sheets/monsters-mech-parts.webp) · [시범 명세](../../../../asset-source/r6/monsters/_pipeline-test/mech-infantry-t1/placement.json).

6개 슬롯을 Spine 4.3.26으로 왕복했다. 조립 실루엣 IoU는 **0.715**, 걷기 경계의 좌표 차이는 **0**이다. Chromium 전장에서 Mesh2D로 걷기 프레임 진행과 피격·쓰러짐 트랙을 확인했다. [조립 실루엣](../../../../asset-source/r6/monsters/_pipeline-test/mech-infantry-t1/assembly-silhouette.webp) · [조립 결과](../../../../asset-source/r6/monsters/_pipeline-test/mech-infantry-t1/assembly-preview.webp) · [절단 보고서](../../../../asset-source/r6/monsters/_pipeline-test/mech-infantry-t1/report.json) · [전장 캡처](../../../../asset-source/r6/monsters/_pipeline-test/mech-infantry-t1/battle-walk.webp) · [재생 검사](../../../../asset-source/r6/monsters/_pipeline-test/mech-infantry-t1/battle-report.json).

## 판정과 예상 작업 시간

- `review.py`는 그림자를 뺀 각 정지 자세를 32px 칸에 비율 유지해서 축소한다. 중심을 가로로 맞추고 바닥을 정렬한 뒤 알파 128 이상 화소의 IoU를 비교한다. 단계별 인접 쌍은 **0.92 미만**, 종족이 다른 모든 쌍은 **0.55 미만**을 적용한다. 여러 종족 작업 폴더를 한 번에 넘기면 종족별 비교가 실행된다. [임시 파츠 32px 판독 띠](../../../../asset-source/r6/monsters/_pipeline-test/machine-32px.webp).
- `check-runtime.mjs`는 내보낸 뼈대의 걷기 경계 전후 월드 변환, 피격·쓰러짐·보스 기술 동작, 각 스킨의 슬롯, 아틀라스 1장과 SHA-256을 검사한다. 아틀라스 크기 상한은 `2048×2048`이다. 여러 장이 나오면 텍스처 밀도와 부품 재사용률을 검토한다. WebP 전송 용량과 디코딩 후 RGBA 용량을 각각 기록한다.
- `capture-playwright.mjs`는 현재 게임의 전장을 띄워 지정한 개체가 실제 `EnemyLayer`의 Phaser Mesh2D로 재생되는지 확인한다. 보스 기술은 시범 도구에서 직접 재생한다. 게임의 보스 기믹과 해당 동작을 연결하는 작업은 후속 통합 범위다.
- 분리된 파츠가 준비된 기준으로 일반 개체 **12~25분**, 보스 **30~60분**을 예상한다. 이 중 일반 개체는 접점·정렬 7~15분, 판독·동작 확인과 수정 5~10분이다. 각 계통 첫 뼈대 조정은 별도로 **30~60분**이며, 그림 생성 대기와 반려 후 재작화 시간은 실측이 필요하다.

## 임시 파츠 시범

Spine Professional 4.3.26으로 일반 계통 4개와 개별 보스 4개의 프로젝트를 내보냈다. 20개체의 기대 슬롯, 파츠 위치와 크기가 왕복 후 유지됐다. 모든 걷기 루프의 처음과 끝 변환은 일치했다. 임시 부품 아틀라스는 `1492×205`, 무손실 WebP **15,136바이트**, RGBA8 **1,223,440바이트**였다. 인접 단계 15쌍의 실루엣 IoU는 **0.453~0.891**이다. 종족 간 비교는 동일 실루엣을 의도적으로 넣은 시험에서 400쌍을 검사했다. 실제 5종족 양산 파츠의 실루엣과 텍스처 크기는 투입 뒤 측정한다.

Chromium 156에서 실제 전장 길 위에 20개체를 배치했다. 개체마다 올바른 스킨과 걷기 트랙이 붙고 프레임이 진행됐다. 전장의 피격·쓰러짐 처리와 보스 4개체의 기술 트랙 등록을 확인했다. [전장 재생 캡처](../../../../asset-source/r6/monsters/_pipeline-test/battle-walk.webp), [개체별 검사 결과](../../../../asset-source/r6/monsters/_pipeline-test/battle-report.json).

## 일괄 양산

저장소 루트에서 아래 명령을 실행한다. 엘프·인간·기계·벌레·바위 폴더에 새 단계의 `sheet.png`, `assembly.png`, `parts.json`이 들어오면 같은 명령을 쓴다.

```sh
"$HOME/.agents/skills/spine-authoring/runtime/.venv/bin/python" -B tools/r6/spine/batch.py
```

- 다른 종족의 원화를 작업 중이면 명령 뒤에 `--species elf human insect`처럼 갱신할 종족을 지정한다. 나머지 종족은 지난 조립 결과를 쌍별 비교에 사용한다.
- 각 부품의 가로세로 비율을 유지하면서 조립 원화에 맞춰 위치와 크기를 두 차례 조정한다. 제작자가 지정한 부품 영역은 `placement.json`의 `targets`, 수동 관절은 `jointHints`에 둔다. 관절 양끝을 직접 맞춘 부품은 `fixedTargets`로 고정한다. 시트에 그린 방향과 들고 있는 방향이 다른 부품은 `rotations`에 반시계 회전각을 적는다. 후속 스킨의 관절은 T1 회전축에 맞춘다. 최종 수치는 같은 256px 캔버스에서 측정한 알파 실루엣 IoU다.
- 절단 오류와 조립 IoU 0.70 미만은 종족별 재요청 목록에 기록한다. 수치를 통과해도 분리된 부위에 사각 배경이나 잘린 관절이 남으면 원화 교체까지 전장에서 기본 보행체를 쓴다. `placement.json`의 `artReview`에는 해당 시트·조립 원화의 해시와 사유를 기록한다. [기계 재요청](../../../../asset-source/r6/monsters/machine/REDO.md) · [바위 재요청](../../../../asset-source/r6/monsters/stone/REDO.md) · [엘프 재요청](../../../../asset-source/r6/monsters/elf/REDO.md) · [인간 재요청](../../../../asset-source/r6/monsters/human/REDO.md) · [벌레 재요청](../../../../asset-source/r6/monsters/insect/REDO.md)
- 편집기 왕복과 아틀라스 패킹은 자원 보호 아래에서 실행한다. 입력·관절·도구가 같은 개체는 캐시를 쓴다. 새 스킨이 들어오면 해당 계통의 리그와 종족 아틀라스를 갱신한다. 로컬 `.orchestrate/r6-monster-batch/<종족>/packs/<해시>/`에 저작 JSON, 부품, 편집 프로젝트, 런타임 검사 결과가 남는다.
- 특수 T1은 엘프 잎 정령의 두 잎과 몸통이 위아래로 움직인다. 인간 수레는 바퀴 중심을 축으로 한 바퀴 구른다. 벌레는 등딱지가 들리면서 작은 개체 셋이 서로 다른 박자로 움직인다. 벌레 특수의 펼친 날개 원화는 재작화 예정이다.
- 전장은 그 웨이브의 종족 아틀라스와 리그를 지연 적재한다. 아직 제작하지 않은 단계와 전송이 실패한 개체는 기존 단계별 보행체를 사용한다. 전송 예산은 **종족당 WebP 768KiB 이내, 최대 2048×2048 한 장**이다. 이 묶음의 동시 표시 검수 목표는 **25개체**로, 5웨이브 한 편성의 크기에 맞췄다. 실기 크롬북 프레임 예산은 G5에서 측정한다.
- 32px 비교는 조립을 시도한 모든 개체의 그림자를 빼고 수행한다. 인접 단계와 다른 종족의 유사 쌍은 아트 검수에 남긴다. [기계 판독 띠](monsters/machine-32px.webp) · [바위 판독 띠](monsters/stone-32px.webp) · [엘프 판독 띠](monsters/elf-32px.webp) · [인간 판독 띠](monsters/human-32px.webp) · [벌레 판독 띠](monsters/insect-32px.webp) · [쌍별 판정](monsters/silhouettes.json)
- 3차에서는 기계 9건, 바위 15건, 인간 10건을 처리했다. 원화 폴더를 다른 제작자가 쓰는 동안에는 `batch.py --species machine stone human --runtime-only`로 실행한다. 이 옵션은 종족 편집 명세를 저작 캐시에 보관한다. 재작화한 네 개체는 이전 시트의 수동 고정이나 반려 메모를 풀고 새 입력으로 다시 정렬했다.
- 흰 얼룩은 256×256 조립 원화와 파츠 조립 결과 양쪽에서 찾는다. 알파 255이고 RGB가 모두 240 이상인 화소가 가로·세로·대각선으로 24개 이상 이어지면 위치와 면적을 `report.json`에 남긴다. 의도한 표식은 눈으로 확인한 뒤 `placement.json`의 `whiteMark.reason`과 `reviewKey`(두 원본과 검출 목록의 `digest`)에 근거를 남긴다. 이번 16개체에서는 흰 면이 팔다리·방패·고삐·회전날 사이 또는 조준 구멍에 남아 있었다. 표식으로 통과시킨 개체는 없다.
- 흰 배경을 확인한 원화는 `placement.json`의 `whiteKey.sourceHash`에 시트·조립 그림의 `digest`를 기록한다. 같은 원본으로 배치를 실행하면 `white_key.py`가 원래 해상도에서 RGB 세 채널이 240 이상인 연결 영역을 찾는다. 가장자리에 닿은 영역은 제거하고, 닫힌 영역은 24px 이상, 가로·세로 3px 이상, 내부 2×2 면이 있을 때 제거한다. 작은 점·가는 선·은회색은 보존한다. 큰 밝은 표식은 `whiteKey.protect.sheet` 또는 `assembly`의 원본 좌표 사각형 목록으로 보호할 수 있다. 경계 한 줄은 흰 매트와 혼합된 색을 분리한다.
- 캐시의 `white-key/<해시>/`에는 정리한 두 PNG와 원본 크기의 삭제 마스크가 남는다. 각 개체의 `report.json`에는 적용 여부, 삭제 화소 수, 경계 색을 보정한 화소 수가 있다. 판독 그림은 위가 분해 시트, 아래가 조립 원화다. 각 줄에서 원본, 삭제한 영역(앰버), 정리 결과 순으로 읽는다. [16개체 판독 그림](monsters/white-key)
- 흰 얼룩 16건이 모두 해소됐다. 기계 6건, 바위 3건, 인간 6건이 조립 기준을 통과해 다시 연결됐고, 인간 보병 T3는 IoU 0.674로 남았다. 되돌렸던 기계 보병 T2·T3, 중장갑 T1, 특수 T1도 다시 전용 스킨을 쓴다. 세 종족 아틀라스를 무손실 WebP로 다시 묶었다. 최대 용량은 바위의 776,326바이트다.
- `resource-guard run --profile test --wait-seconds 900 -- node tools/r6/spine/capture-playwright.mjs --published docs/renewal/r6/tech/monsters 15`로 W15를, 마지막 인수를 `20`으로 바꿔 W20을 확인한다. W15는 28개 중 17개(13종), W20은 30개 중 16개(10종)가 전용 스킨을 사용했다. 두 편성에서 걷기·피격·쓰러짐과 W15 기계 보스 T3·W20 바위 보스 T4의 기술을 확인했다. [W15 전장](monsters/battle-w15-walk.webp) · [W15 재생 결과](monsters/battle-w15-report.json) · [W20 전장](monsters/battle-walk.webp) · [W20 재생 결과](monsters/battle-report.json)

<!-- monster-batch:begin -->

| 종족 | 개체 | 조립 IoU | 슬롯 | 내보낸 동작 |
| --- | --- | ---: | ---: | --- |
| machine | infantry/T1 | 0.873 | 6 | 걷기·피격·쓰러짐 |
| machine | infantry/T2 | 0.809 | 11 | 걷기·피격·쓰러짐 |
| machine | infantry/T3 | 0.840 | 11 | 걷기·피격·쓰러짐 |
| machine | infantry/T4 | 0.868 | 11 | 걷기·피격·쓰러짐 |
| machine | runner/T1 | 0.758 | 10 | 걷기·피격·쓰러짐 |
| machine | runner/T2 | 0.731 | 11 | 걷기·피격·쓰러짐 |
| machine | runner/T3 | 0.689 | 12 | 조립 재요청 |
| machine | runner/T4 | 0.731 | 12 | 걷기·피격·쓰러짐 |
| machine | armored/T1 | 0.903 | 11 | 걷기·피격·쓰러짐 |
| machine | armored/T2 | 0.872 | 11 | 걷기·피격·쓰러짐 |
| machine | armored/T3 | 0.901 | 12 | 걷기·피격·쓰러짐 |
| machine | armored/T4 | 0.886 | 12 | 걷기·피격·쓰러짐 |
| machine | special/T1 | 0.900 | 2 | 걷기·피격·쓰러짐 |
| machine | special/T2 | 0.422 | 3 | 조립 재요청 |
| machine | special/T3 | 0.487 | 3 | 조립 재요청 |
| machine | special/T4 | 0.565 | 4 | 조립 재요청 |
| machine | boss-t1/T1 | 0.839 | 11 | 걷기·피격·쓰러짐·기술 |
| machine | boss-t2/T2 | 0.694 | 12 | 조립 재요청 |
| machine | boss-t3/T3 | 0.705 | 12 | 걷기·피격·쓰러짐·기술 |
| machine | boss-t4/T4 | 0.689 | 12 | 조립 재요청 |
| stone | infantry/T1 | 0.909 | 10 | 걷기·피격·쓰러짐 |
| stone | infantry/T2 | 0.822 | 10 | 걷기·피격·쓰러짐 |
| stone | infantry/T3 | 0.728 | 12 | 걷기·피격·쓰러짐 |
| stone | infantry/T4 | 0.825 | 10 | 걷기·피격·쓰러짐 |
| stone | runner/T1 | 0.912 | 10 | 걷기·피격·쓰러짐 |
| stone | runner/T2 | 0.843 | 10 | 걷기·피격·쓰러짐 |
| stone | runner/T3 | 0.743 | 11 | 걷기·피격·쓰러짐 |
| stone | runner/T4 | 0.905 | 11 | 걷기·피격·쓰러짐 |
| stone | armored/T1 | 0.933 | 11 | 걷기·피격·쓰러짐 |
| stone | armored/T2 | 0.883 | 11 | 걷기·피격·쓰러짐 |
| stone | armored/T3 | 0.839 | 12 | 걷기·피격·쓰러짐 |
| stone | armored/T4 | 0.778 | 11 | 걷기·피격·쓰러짐 |
| stone | special/T1 | 0.947 | 3 | 걷기·피격·쓰러짐 |
| stone | special/T2 | 0.460 | 3 | 조립 재요청 |
| stone | special/T3 | 0.537 | 3 | 조립 재요청 |
| stone | special/T4 | 0.590 | 3 | 조립 재요청 |
| stone | boss-t1/T1 | 0.827 | 11 | 걷기·피격·쓰러짐·기술 |
| stone | boss-t2/T2 | 0.665 | 11 | 조립 재요청 |
| stone | boss-t3/T3 | 0.643 | 10 | 조립 재요청 |
| stone | boss-t4/T4 | 0.725 | 11 | 걷기·피격·쓰러짐·기술 |
| elf | infantry/T1 | 0.876 | 13 | 걷기·피격·쓰러짐 |
| elf | runner/T1 | 0.879 | 13 | 걷기·피격·쓰러짐 |
| elf | armored/T1 | 0.925 | 13 | 걷기·피격·쓰러짐 |
| elf | special/T1 | 0.762 | 7 | 걷기·피격·쓰러짐 |
| elf | boss-t1/T1 | 0.787 | 13 | 원화 재요청 |
| human | infantry/T1 | 0.778 | 13 | 걷기·피격·쓰러짐 |
| human | infantry/T2 | 0.764 | 11 | 걷기·피격·쓰러짐 |
| human | infantry/T3 | 0.674 | 11 | 조립 재요청 |
| human | infantry/T4 | 0.773 | 11 | 걷기·피격·쓰러짐 |
| human | runner/T1 | 0.772 | 13 | 걷기·피격·쓰러짐 |
| human | runner/T2 | 0.688 | 12 | 조립 재요청 |
| human | runner/T3 | 0.744 | 12 | 걷기·피격·쓰러짐 |
| human | runner/T4 | 0.775 | 12 | 걷기·피격·쓰러짐 |
| human | armored/T1 | 0.922 | 13 | 걷기·피격·쓰러짐 |
| human | armored/T2 | 0.752 | 11 | 걷기·피격·쓰러짐 |
| human | armored/T3 | 0.813 | 11 | 걷기·피격·쓰러짐 |
| human | special/T1 | 0.956 | 7 | 걷기·피격·쓰러짐 |
| human | boss-t1/T1 | 0.760 | 13 | 걷기·피격·쓰러짐·기술 |
| insect | infantry/T1 | 0.812 | 13 | 원화 재요청 |
| insect | runner/T1 | 0.722 | 13 | 원화 재요청 |
| insect | armored/T1 | 0.916 | 13 | 걷기·피격·쓰러짐 |
| insect | special/T1 | 0.844 | 14 | 걷기·피격·쓰러짐 |
| insect | boss-t1/T1 | 0.778 | 13 | 원화 재요청 |

- 조립 IoU 0.70 이상 50/63개체, 전장 연결 46/63개체.
- `machine` 아틀라스 920×523, WebP 584,332바이트, RGBA8 1,924,640바이트.
- `stone` 아틀라스 1222×525, WebP 776,326바이트, RGBA8 2,566,200바이트.
- `elf` 아틀라스 691×110, WebP 107,032바이트, RGBA8 304,040바이트.
- `human` 아틀라스 1238×269, WebP 439,898바이트, RGBA8 1,332,088바이트.
- `insect` 아틀라스 581×142, WebP 87,470바이트, RGBA8 330,008바이트.
- 인접 단계 38쌍 중 0쌍, 종족 간 1475쌍 중 244쌍이 32px 구분 기준에 미달했다.

<!-- monster-batch:end -->

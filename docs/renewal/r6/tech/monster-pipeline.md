# R6 몬스터 Spine 제작 공정

[R6 PRD §4](../PRD-r6.md)와 [아트 설정표](../bible/monsters.md)를 따른다. 종족마다 일반 계통 뼈대 4개와 보스 개별 뼈대 4개를 내보낸다. 일반 계통은 같은 뼈대에 `T1`~`T4` 스킨을, 보스는 각 프로젝트에 해당 단계 스킨 하나를 넣는다. 5종족 전체는 뼈대 40개와 개체 100개다.

## Antigravity에 요청할 파츠

1. **개체마다 오른쪽을 향한 3/4 측면.** 같은 계통의 네 단계는 카메라·발밑 원점·관절 위치를 고정한다. R04 6색 안에서 무광 면과 외곽선으로 형태를 구분한다. 먼쪽과 가까운쪽 파츠를 각각 그린다.
2. **슬롯마다 투명 RGBA PNG 한 장.** 시작 규격은 공통 `256×256` 캔버스, 발밑 원점 `[128,216]`, 게임 좌표 한 단위당 원본 3px다. 한 장에 여러 부품을 모으는 경우 각 부품 사이에 여백을 둔 분해 시트와 조립 기준판을 함께 준다. 출력 PNG는 조립 기준판과 같은 캔버스 위치에 놓는다.
3. **가려진 연결부도 그린다.** 관절 근처에 3~6 원본 화소의 겹침 여유를 남긴다. 표식과 장갑은 몸통과 다른 레이어로 제공한다. 피벗·파일명·그리드는 그림에 굽지 않고 좌표를 별도로 적는다. 반짝임, 빛 번짐, 피, 공포, 치비, 밈, 음식 소재는 제외한다.
4. `species.json`에 `species`, `canvas`, `root`, `pixelsPerUnit`을 적는다. 실제 입력 키는 `elf`, `human`, `machine`, `insect`, `stone`이다. 설정표의 `mech`는 `machine`, `golem`은 `stone`에 대응한다. `rigs`에서 계통별 `variant`, `proportions`의 `bodyWidth`·`bodyHeight`·`legLength`, `pivots`의 뼈 이름별 좌표, 게임 표시 `scale`을 지정할 수 있다.
5. 폴더는 `infantry/T1`~`T4`, `runner/T1`~`T4`, `armored/T1`~`T4`, `special/T1`~`T4`, `boss-t1/T1`~`boss-t4/T4`다. 해당 폴더의 PNG 파일명은 `template` 출력의 슬롯 이름에 `.png`를 붙인다. 키는 게임의 [밸런스 계약](../../../../src/contracts/balanceV2.ts)을 따른다.

| 계통 | 틀 선택 | 주요 슬롯 |
| --- | --- | --- |
| 보병 `infantry` | `biped` | `body`, `head`, `leg-near`, `leg-foot-near`, `arm-near`, `arm-hand-near` 및 각 먼쪽 부위 |
| 질주 `runner` | `quadruped` | `body`, `head`, `leg-fore-near`, `leg-fore-foot-near` 및 앞·뒤·가까운쪽·먼쪽 조합 |
| 중장갑 `armored` | `biped`, `quadruped` | 선택한 걸음 틀의 팔다리, `armor`에 장갑판, `gear`에 방패·장비 |
| 특수 `special` | `flying`, `swarm`, `wheeled`, `crystal` | 엘프는 `wing-far/near`, 인간은 `wheel-1/2`, 기계는 모함과 `swarm-1/2/3`, 벌레는 `swarm-1/2/3`과 이후 단계에서 켤 수 있는 선택 다리 6개, 바위는 `crystal-far/near`를 시작점으로 삼는다. |
| 보스 `boss-t1`~`boss-t4` | `biped`, `quadruped` | 전용 체급과 장비. `skill` 뼈에 기술 연출 위치를 둔다. |

공용 선택 슬롯은 `armor`, `mark`, `gear`, `shadow`다. 비행 기체의 땅 그림자는 전장이 이미 그리므로 비행 스킨의 `shadow`는 비워 둔다. 제작자가 지정한 피벗을 우선 적용한다. 좌표가 없으면 첫 스킨의 파츠에서 기준점 주변 불투명 화소를 찾아 관절을 맞춘다. 정해진 슬롯 순서가 먼쪽 관절, 몸통, 장갑·표식, 가까운쪽 관절, 장비 순으로 겹침을 처리한다.

[기계 머리 분리 비교판](../../../../asset-source/r6/monsters/_pipeline-test/mask-comparison.webp)에서 라인업의 머리는 면적이 작고 턱과 목의 접점이 다른 파츠에 붙어 있다. 분해 시트의 같은 부위는 실제 크기에서 윤곽과 접점이 더 분명하다. 양산 입력은 부품별 개별 출력이 기본이다. 이미 그려 둔 분해 시트는 수동 마스크로 살릴 수 있다.

## 실행

저장소 루트에서 공용 Spine 4.3.26과 Pillow, 저장소 Node 의존성, Playwright Chromium, `cwebp`를 쓴다. 신규 출력 디렉터리를 사용한다.

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

시트를 쓸 때 `monsters.py extract <시트> <마스크 명세.json> <새 폴더>`를 실행한다. 명세는 `{"canvas":[256,256],"parts":{"head":{"box":[40,20,120,100],"position":[90,30],"mask":"head-mask.png","removeSpecks":true}}}` 형식이다. `box`의 오른쪽·아래 끝은 포함하지 않는다. 잘라낸 크기와 같은 8비트 회색 마스크는 검정이 투명, 흰색이 유지다. `removeSpecks`는 얇은 끝도 줄일 수 있어 1px 잡티가 보일 때만 켠다. 결과를 해당 스킨 폴더로 옮긴 뒤 결손 면을 보완한다.

## 판정과 예상 작업 시간

- `review.py`는 그림자를 뺀 각 정지 자세를 32px 칸에 비율 유지해서 축소한다. 중심을 가로로 맞추고 바닥을 정렬한 뒤 알파 128 이상 화소의 IoU를 비교한다. 단계별 인접 쌍은 **0.92 미만**, 종족이 다른 모든 쌍은 **0.55 미만**을 적용한다. 여러 종족 작업 폴더를 한 번에 넘기면 종족별 비교가 실행된다. [임시 파츠 32px 판독 띠](../../../../asset-source/r6/monsters/_pipeline-test/machine-32px.webp).
- `check-runtime.mjs`는 내보낸 뼈대의 걷기 경계 전후 월드 변환, 피격·쓰러짐·보스 기술 동작, 각 스킨의 슬롯, 아틀라스 1장과 SHA-256을 검사한다. 아틀라스 크기 상한은 `2048×2048`이다. 여러 장이 나오면 텍스처 밀도와 부품 재사용률을 검토한다. WebP 전송 용량과 디코딩 후 RGBA 용량을 각각 기록한다.
- `capture-playwright.mjs`는 현재 게임의 전장을 띄워 의도한 20개체가 실제 `EnemyLayer`의 Phaser Mesh2D로 재생되는지 확인한다. 보스 기술은 시범 도구에서 직접 재생한다. 게임의 보스 기믹과 해당 동작을 연결하는 작업은 후속 통합 범위다.
- 분리된 파츠가 준비된 기준으로 일반 개체 **12~25분**, 보스 **30~60분**을 예상한다. 이 중 일반 개체는 접점·정렬 7~15분, 판독·동작 확인과 수정 5~10분이다. 각 계통 첫 뼈대 조정은 별도로 **30~60분**이며, 그림 생성 대기와 반려 후 재작화 시간은 실측이 필요하다.

## 임시 파츠 시범

Spine Professional 4.3.26으로 일반 계통 4개와 개별 보스 4개의 프로젝트를 내보냈다. 20개체의 기대 슬롯, 파츠 위치와 크기가 왕복 후 유지됐다. 모든 걷기 루프의 처음과 끝 변환은 일치했다. 임시 부품 아틀라스는 `1492×205`, 무손실 WebP **15,136바이트**, RGBA8 **1,223,440바이트**였다. 인접 단계 15쌍의 실루엣 IoU는 **0.453~0.891**이다. 종족 간 비교는 동일 실루엣을 의도적으로 넣은 시험에서 400쌍을 검사했다. 실제 5종족 양산 파츠의 실루엣과 텍스처 크기는 투입 뒤 측정한다.

Chromium 156에서 실제 전장 길 위에 20개체를 배치했다. 개체마다 올바른 스킨과 걷기 트랙이 붙고 프레임이 진행됐다. 전장의 피격·쓰러짐 처리와 보스 4개체의 기술 트랙 등록을 확인했다. [전장 재생 캡처](../../../../asset-source/r6/monsters/_pipeline-test/battle-walk.webp), [개체별 검사 결과](../../../../asset-source/r6/monsters/_pipeline-test/battle-report.json).

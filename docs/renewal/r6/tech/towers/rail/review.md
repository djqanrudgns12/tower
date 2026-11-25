# R6 레일 포탑 Blender 렌더

Lv1은 팔각 기단 위에 원기둥 목과 단포신을 얹는다. Lv6의 합금 목은 더 높고, Lv12부터는 높은 세라믹 장갑 기둥에 삼연장이 올라간다. 기둥을 기단 한쪽에 배치해 냉각 중계탑의 중앙 고리 기둥과 구별했다. Lv18은 끝이 좁아지는 경사 기둥 위에 2×2 포신과 가속 고리 3개를 얹는다. 포구 간격을 넓히고 네 개에 각각 은회 테두리를 둘렀다. Lv20은 포신을 더 세우고 네 번째 고리와 금테 기단을 더한다. [바이블 원화](../../../bible/sheets/tower-rail.webp) · [Blender 부품과 Lv20 조립](../../../../../../asset-source/r6/towers/rail/rail-kit.blend) · [레시피](../../../../../../tools/r6/recipes/rail.json)

![레일 포탑 원화와 11형태 렌더](rail-review.webp)

![레일 포탑 48px 축소 띠](rail-48px.webp)

## 스프라이트

| 시트 | 배열 |
| --- | --- |
| [몸체](rail-bodies.webp) · [2배](rail-bodies-2x.webp) | 11프레임, 레벨 순 6열 |
| [포두 Lv1~10](rail-heads.webp) · [2배](rail-heads-2x.webp) | 96프레임, 6레벨 × 16방향, 10열 |
| [포두 Lv12~20](rail-heads-armored.webp) · [2배](rail-heads-armored-2x.webp) | 80프레임, 5레벨 × 16방향, 10열 |
| [공격](rail-attack.webp) · [2배](rail-attack-2x.webp) | 무기 단계당 8프레임, 20fps |
| [완성 형태](rail-forms.webp) · [2배](rail-forms-2x.webp) | 11프레임, 레벨 순 6열 |

192px와 384px 셀을 제공한다. 포두는 +Y에서 시작해 Z축 양의 방향으로 22.5°씩 회전한다. 시트 내 레벨 인덱스 × 16 + 방향 번호가 프레임 번호다. 몸체 셀의 `headAnchors2x` 위치에 포두 피벗을 붙인다. 192px 셀에서는 좌표를 절반으로 줄여 반올림한다. 비교판과 공격 시트는 6번 방향을 사용한다. [매니페스트](manifest.json)

가는 틸·은회 예광선이 먼저 보이고 포신이 뒤로 밀렸다가 복귀한다. 무기 II와 III은 예광선을 포구별로 순서대로 그리고 무기 IV는 4열 중앙에서 한 줄을 그린다. 공격 시트는 Lv1·6·12·18의 몸체를 포함한 동작 견본이다.

## 전장 시트

세 타워의 몸체와 포두는 192px·384px 셀로 내보낸다. 포두는 레벨별 시트에 16방향을 담는다. 무기 단계의 첫 레벨을 기준으로 각 방향의 공격 8프레임을 렌더한다. 같은 무기 단계에서 현재 레벨의 몸체에 공격 포두를 붙이고, 공격이 끝나면 현재 레벨의 대기 포두를 다시 표시한다. 공격 셀은 피벗을 유지한 채 공통 투명 여백을 잘라 전장 텍스처에 올린다. [전장 매니페스트 v2](../../../../../../public/assets/r6/manifest-v2.json)

판을 열 때 각 타워의 몸체 시트와 Lv1 포두 시트를 불러온다. 설치·강화하면 사용하는 포두와 무기 단계의 공격 시트를 추가한다. 이전 그림은 새 시트가 준비될 때까지 표시하고, 다른 타워도 쓰지 않으면 전장 텍스처에서 내린다. 형태가 바뀌면 포두가 0.6초 동안 제자리에 맞물리고, 무기 단계가 바뀌면 1.2초 동안 움직인다.

| 타워 | 192px 기준 | 384px 기준 |
| --- | ---: | ---: |
| 레일 | 968,638 B | 2,408,806 B |
| 곡사 | 1,063,374 B | 2,645,732 B |
| 냉각 | 1,079,570 B | 3,344,744 B |
| 합계 | 3,111,582 B | 8,399,282 B |

전장용 WebP 120장의 합계는 11,510,864바이트다. 판을 열 때 Phaser가 받는 기본 타워 6시트는 1배 화면에서 93,392바이트, 2배 화면에서 244,226바이트다.

## 48px 실루엣

같은 지면 피벗에서 알파 128 이상인 화소를 비교했다. 레일은 11형태 모두 같은 레벨의 곡사·냉각보다 높고, 높이는 31~46px이다. 레일 인접 단계 10쌍의 최대 IoU는 0.9036이다. 타워 간 같은 레벨 33쌍의 최대는 0.5140이다.

서로 다른 레벨까지 펼쳐 비교하면 363쌍 중 6쌍이 0.55 이상이다. 최대는 레일 Lv2와 냉각 Lv10의 0.5766이다.

## 다시 렌더하기

저장소 루트에서 실행한다. 편집한 키트로 렌더하려면 `--kit`을 넘긴다. 이 옵션을 생략하면 파이썬으로 새 키트를 조립해 출력 폴더에 저장한다. `--forms-only`로 11형태만 미리 볼 수 있다.

```sh
tower=rail
tower_work="$(mktemp -d /tmp/tower-r6.XXXXXXXX)"
tower_python="$HOME/.agents/skills/spine-authoring/runtime/.venv/bin/python"

"$HOME/.local/bin/resource-guard" status --profile avatar
"$HOME/.local/bin/resource-guard" run --profile avatar --wait-seconds 900 -- \
  /Applications/Blender.app/Contents/MacOS/Blender -b -t 3 --python-exit-code 1 \
  --python tools/r6/blender/render.py -- \
  "tools/r6/recipes/$tower.json" "$tower_work/png" \
  --kit "asset-source/r6/towers/$tower/$tower-kit.blend"
"$tower_python" -B tools/r6/blender/pack.py "$tower_work/png" \
  --out "$tower_work/$tower" --reference "docs/renewal/r6/bible/sheets/tower-$tower.webp"
```

패킹은 WebP의 팔레트·해시·크기·피벗·빈 칸과 레벨마다 서로 다른 16방향을 검사한다. 비교판 글꼴이 필요한 환경에서는 `--font`로 한글 글꼴을 지정한다.

전장용 공격 렌더는 `tower_game_render.py`에 타워 ID, 부품 파일, 레시피, 새 출력 폴더를 지정해 만든다. 타워별 출력 폴더를 한곳에 모아 아래 명령을 실행한다. 출력 폴더의 `towers/`와 `manifest-v2.json`을 `public/assets/r6/`에 반영한다.

```sh
"$tower_python" -B tools/r6/blender/tower_game_pack.py \
  docs/renewal/r6/tech/towers "$tower_work/attacks" \
  public/assets/r6/manifest-v2.json "$tower_work/public"
```

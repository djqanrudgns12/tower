# R6 레일 포탑 Blender 렌더

팔각 기단과 좁은 기둥 위에서 단포신이 쌍포신, 삼연장, 4열 레일로 늘어난다. Lv18은 경사진 기둥 위에 길이가 다른 2×2 레일과 가속 고리 3개를 얹었다. Lv20은 포신을 더 세우고 네 번째 고리와 금테 기단을 추가했다. 포구에는 은회 테두리를, 포구 안쪽과 장갑 사이에는 카본 그림자를 넣었다. [바이블 원화](../../../bible/sheets/tower-rail.webp) · [Blender 부품과 Lv20 조립](../../../../../../asset-source/r6/towers/rail/rail-kit.blend) · [레시피](../../../../../../tools/r6/recipes/rail.json)

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

Blender 5.2.3 LTS에서 11형태 렌더에 1.115초, 다섯 시트의 Blender 장면 조립과 PNG 저장에 총 17.607초가 걸렸다. 48px에서는 무기 IV의 금테와 긴 포신은 읽히지만, 포구 네 개는 두께가 얇아 한 덩어리로 보일 수 있다.

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

패킹은 WebP의 팔레트·해시·크기·피벗·빈 칸과 레벨마다 서로 다른 16방향을 검사한다. 비교판 글꼴이 필요한 환경에서는 `--font`로 한글 글꼴을 지정한다. [세 타워 실루엣 검수](../cryo/review.md)

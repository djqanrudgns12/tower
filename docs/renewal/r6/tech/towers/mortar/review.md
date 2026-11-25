# R6 곡사 포대 Blender 렌더

넓은 사각 포상 위에 낮은 장갑 몸체를 얹었다. 초반 포신을 늘리고 포구 안쪽에만 은회 테를 뒀다. Lv12는 세라믹 장갑 이음선이 보이며 Lv16의 고정발과 완충기는 상위 형태에도 남는다. Lv20 스커트에 경사 리브와 얇은 금테를 더했다. [바이블 원화](../../../bible/sheets/tower-mortar.webp) · [Blender 부품과 Lv20 조립](../../../../../../asset-source/r6/towers/mortar/mortar-kit.blend) · [레시피](../../../../../../tools/r6/recipes/mortar.json)

![11형태와 원화 비교](mortar-review.webp)

![48px 축소 띠](mortar-48px.webp)

## 시트와 피벗

| 시트 | 프레임 | 배열 | 피벗 192px / 384px |
| --- | ---: | --- | --- |
| [몸체](mortar-bodies.webp) · [2배](mortar-bodies-2x.webp) | 11 | 레벨 순 6열 | `[96, 142]` / `[192, 283]` |
| [포두 Lv1~10](mortar-heads.webp) · [2배](mortar-heads-2x.webp) | 96 | 6레벨 × 16방향 · 10열 | `[96,96]` / `[192,192]` |
| [포두 Lv12~20](mortar-heads-armored.webp) · [2배](mortar-heads-armored-2x.webp) | 80 | 5레벨 × 16방향 · 10열 | `[96,96]` / `[192,192]` |
| [발사](mortar-attack.webp) · [2배](mortar-attack-2x.webp) | 32 | 무기 단계별 1행 · 8프레임 · 20fps | 몸체와 같음 |
| [완성 형태](mortar-forms.webp) · [2배](mortar-forms-2x.webp) | 11 | 레벨 순 6열 | 몸체와 같음 |

포두 시트는 각 시트의 레벨 순서로 프레임을 묶고 레벨마다 +Y 방향에서 시작해 Z축 양의 방향으로 22.5°씩 회전한다. `headSheets`의 레벨 인덱스에 16을 곱한 뒤 방향 번호를 더하면 행 우선 프레임 번호가 된다. 포두 피벗을 몸체 셀의 `headAnchors2x` 좌표에 맞춘다. 192px 셀에서는 좌표를 절반으로 줄인다. Lv2와 Lv4의 강철 보강 띠, Lv10의 경고 띠, Lv14와 Lv16의 덮개, Lv20의 돔과 금테 포구가 회전 시트에 포함된다. [매니페스트](manifest.json)

포신을 대기 각도에서 15° 올리고 발사 순간 회전축을 높이의 9% 내린다. 몸체를 포함한 견본에서는 포상과 유압부도 접지점을 중심으로 눌린다.

## 검수 결과

[6종 48px 비교](../bastion/six-towers-iou.md) · [레벨별 색·면적·공격 검수](../bastion/six-towers-evidence.md)

## 다시 렌더하기

저장소 루트에서 실행한다. `--kit`을 주면 편집한 Blender 컬렉션을 읽는다. 이 옵션을 생략하면 파이썬으로 부품을 만들고 출력 폴더에 새 `.blend`를 저장한다. 새 PNG와 해당 배치의 `layout.json`은 같은 임시 폴더에 생긴다. `asset-source/r6/towers/mortar`에 이미 있는 PNG와 `layout.json`은 첫 렌더의 기록이다.

```sh
mortar_work="$(mktemp -d /tmp/tower-mortar.XXXXXXXX)"
mortar_python="$HOME/.agents/skills/spine-authoring/runtime/.venv/bin/python"
mortar_kit="asset-source/r6/towers/mortar/mortar-kit.blend"
mortar_reference="docs/renewal/r6/bible/sheets/tower-mortar.webp"

"$HOME/.local/bin/resource-guard" status --profile avatar
"$HOME/.local/bin/resource-guard" run --profile avatar --wait-seconds 900 -- \
  /Applications/Blender.app/Contents/MacOS/Blender -b -t 3 --python-exit-code 1 \
  --python tools/r6/blender/render.py -- \
  tools/r6/recipes/mortar.json "$mortar_work/png" --kit "$mortar_kit"
"$mortar_python" -B tools/r6/blender/pack.py "$mortar_work/png" \
  --out "$mortar_work/webp" --reference "$mortar_reference"
"$mortar_python" -B tools/r6/qa/check.py manifest "$mortar_work/webp/manifest.json"
```

비교판 글꼴은 macOS의 Apple SD Gothic Neo를 기본으로 사용한다. 다른 환경에서는 패킹 명령에 `--font`로 한글 글꼴을 지정한다.

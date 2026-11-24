# R6 곡사 포대 Blender 렌더

[바이블 원화](../../../bible/sheets/tower-mortar.webp)의 낮고 넓은 사각 포상과 네 방향 유압 지지대를 공통으로 뒀다. Lv1 대구경 단포신, Lv6 중장갑 단포신, Lv12 세라믹 쌍포, Lv18 금테 4연장으로 바뀐다. [Blender 원본](../../../../../../asset-source/r6/towers/mortar/mortar-kit.blend)은 Lv20 조립과 부품 편집 장면을 포함한다. 바이블의 `turret`·`deco`·`mark`는 [레시피](../../../../../../tools/r6/recipes/mortar.json)의 `head`·`detail`·`marking`에 대응한다.

![11형태와 바이블 원화 비교](mortar-review.webp)

![48px 축소 띠](mortar-48px.webp)

## 시트와 피벗

| 시트 | 프레임 | 배열 | 피벗 192px / 384px |
| --- | ---: | --- | --- |
| [몸체](mortar-bodies.webp) · [2배](mortar-bodies-2x.webp) | 11 | 레벨 순 6열 | `[96,124]` / `[192,247]` |
| [포두](mortar-heads.webp) · [2배](mortar-heads-2x.webp) | 64 | 무기 I~IV 순 · 각각 16방향 · 8열 | `[96,96]` / `[192,191]` |
| [발사](mortar-attack.webp) · [2배](mortar-attack-2x.webp) | 32 | 무기 단계별 1행 · 8프레임 · 20fps | `[96,124]` / `[192,247]` |
| [완성 형태](mortar-forms.webp) · [2배](mortar-forms-2x.webp) | 11 | Lv1·2·4·6·8·10·12·14·16·18·20 순 · 6열 | `[96,124]` / `[192,247]` |

포두는 +Y가 0번으로 시작하고 Z축 양의 방향으로 22.5°씩 회전한다. 포두 시트는 좌상단부터 행 우선 순서로 읽는다. 포두와 발사 시트는 각 무기 단계가 시작되는 Lv1·6·12·18을 사용한다. Lv2 보강 띠, Lv10 경고 띠, Lv14 포두 덮개, Lv20 탄도 돔과 금테 포구는 각 레벨 완성 형태에 들어 있다. 레벨별 회전에서도 이 부품을 유지하려면 해당 레시피의 포두를 추가로 렌더해야 한다.

발사는 비교판과 같은 7번 방향 한 벌이다. 45°에서 62°까지 포신을 들어 4번째 프레임(0.15초)에 반동이 시작된다. 포상 상부를 192px 기준 약 4px 내리고 포구에 얇은 앰버 압력 고리를 그렸다. 마지막 프레임은 대기 자세로 돌아온다. 이 시트는 포대 동작을 담으며 비행·착탄 효과와 조준 방향별 반동은 게임에서 연결할 항목이다.

## 검수 결과

- Blender 5.2.3, 고정 직교 카메라, 좌상단 방향의 4단 툰 명암, Freestyle 윤곽선. WebP 패킹에서 바깥 선을 192px에서 1px, 384px에서 2px로 추가했다.
- 192×192·384×384 셀을 쓰는 WebP 8개를 검사했다. R04 팔레트 위반 0, 프레임 수·피벗·빈 칸·SHA-256 검사를 통과했다. [매니페스트](manifest.json)
- 48px에서 인접 형태 사이의 가시 화소가 117~676개 달랐다. 가장 작은 차이는 Lv8→10의 경고 띠와 뒤쪽 완충기다. 이 수치는 축소 이미지 차이이며 아이들이 전장에서 부품을 알아보는지는 실기 검수가 필요하다.
- Mac mini에서 384px 완성 형태 11개가 1.059초, 평균 **형태당 0.096초**였다. 몸체·포두·발사·완성 형태의 네 배치는 총 7.723초였다. 장면 조립과 PNG 저장을 포함하고 Blender 시작과 자원 대기는 별도다. [원본 배치 기록](../../../../../../asset-source/r6/towers/mortar/layout.json)
- 원화보다 세로 덩치를 낮추고 포상 면적을 넓게 잡았다. 강철·합금형의 어두운 포구와 유압부는 어두운 전장 배경에서 대비가 낮을 수 있다. 48px에서는 뒤쪽 장전 암과 압력 게이지 같은 작은 부품을 구별하기 어렵다. 금테형은 원화의 두꺼운 금속 면을 얇은 선으로 줄였다. 실전 합성 시 포두와 고정 장갑의 앞뒤 겹침은 미검증이다.

## 다시 렌더하기

저장소 루트에서 실행한다. `--kit`을 주면 편집한 Blender 컬렉션을 읽는다. `--kit`을 빼면 파이썬으로 부품을 만들고 출력 폴더에 새 `.blend`를 저장한다. 비교판 글꼴은 기본으로 macOS의 Apple SD Gothic Neo를 쓰며, 다른 환경에서는 `--font`로 한글 글꼴을 지정한다.

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

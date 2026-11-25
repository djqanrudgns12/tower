# R6 방벽 기지 Blender 렌더

호형 기초가 전면 방벽에서 뒤쪽 레이더 붐 받침까지 이어진다. Lv6 두 판의 왼쪽 끝을 연결했고, 붐의 은회 능선과 레이더 테두리로 기지에서 솟은 구조를 읽기 쉽게 했다. Lv18부터는 경사진 대형 금테 접시가 올라간다.

[바이블 원화](../../../bible/sheets/tower-bastion.webp) · [Blender 부품과 Lv20 조립](../../../../../../asset-source/r6/towers/bastion/bastion-kit.blend) · [레시피](../../../../../../tools/r6/recipes/bastion.json)

![방벽 기지 원화와 11형태](<bastion-review.webp>)

![방벽 기지 48px 축소](<bastion-48px.webp>)

곡면 방벽이 압축됐다가 전면으로 펼쳐진다. 얇은 앰버 충격선에 이어 주변에 틸 강화 고리가 퍼지고, 접시와 판이 대기 위치로 돌아온다.

[기술 매니페스트](manifest.json)에는 완성 형태와 몸체 11개, 형태당 포두 16방향, 무기 단계당 대표 방향 공격 8프레임의 192·384px 시트를 기록했다. [전장 매니페스트](../../../../../../public/assets/r6/manifest-v2.json)의 공격은 무기 단계당 16방향이며 셀의 투명 여백을 자른다.

## 타워 여섯 종 비교

[같은 레벨 48px IoU 표](six-towers-iou.md) · [Lv20 비교판](six-towers-lv20.webp) · [Lv20 전장 캡처](six-towers-lv20-field.webp)

여섯 종의 같은 레벨 165쌍과 이번 세 종의 인접 형상 30쌍이 모두 통과했다. 두 검사에서 최대 IoU는 각각 0.5140과 0.9126이었다. 192·384px 기술·전장 시트에서 R04 팔레트 위반은 0개였다.

전장 첫 진입에는 원래 시작 타워 3종의 기본 시트 6개를 받는다. 192px 시트 합계는 93,392바이트다. 나머지 세 종은 각각 해금할 때 목록과 기본 시트를 받고, 공격 시트는 설치·강화할 때 받는다. 공통 목록에는 해금 대상 ID를 추가해 64바이트 늘었다.

## 다시 렌더하기

[레일 포탑의 렌더 명령](../rail/review.md)에서 `tower`를 `prism`, `hangar`, `bastion` 중 하나로 바꾼다. 전장 시트를 내보낼 때 `tower_game_pack.py`에 `--tower prism --tower hangar --tower bastion`을 넘기면 기존 지도·종족·타워 항목을 이어받는다.

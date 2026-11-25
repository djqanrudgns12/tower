# R6 방벽 기지 Blender 렌더

호형 방벽 안의 팔각 벙커에 중앙 틸 코어가 있다. 후방 중심축 붐에 큰 오목 접시를 달고, 상위 방벽에도 틸 충격 슬롯을 유지했다. 금테는 상단 한 줄과 접시 가장자리에 들어간다.

[바이블 원화](../../../bible/sheets/tower-bastion.webp) · [Blender 부품과 Lv20 조립](../../../../../../asset-source/r6/towers/bastion/bastion-kit.blend) · [레시피](../../../../../../tools/r6/recipes/bastion.json)

![방벽 기지 원화와 11형태](<bastion-review.webp>)

![방벽 기지 48px 축소](<bastion-48px.webp>)

전면 방벽이 안쪽으로 모였다가 펼쳐지고 접시가 좌우로 방향을 바꾼다.

[기술 매니페스트](manifest.json)에는 완성 형태와 몸체 11개, 형태당 포두 16방향, 무기 단계당 대표 방향 공격 8프레임의 192·384px 시트를 기록했다. [전장 매니페스트](../../../../../../public/assets/r6/manifest-v2.json)의 공격은 무기 단계당 16방향이며 셀의 투명 여백을 자른다.

## 타워 여섯 종 비교

[6종 48px 비교](../bastion/six-towers-iou.md) · [레벨별 색·면적·공격 검수](../bastion/six-towers-evidence.md)

[Lv20 비교판](six-towers-lv20.webp) · [전장 캡처](six-towers-lv20-field.webp)

## 다시 렌더하기

[레일 포탑의 렌더 명령](../rail/review.md)에서 `tower`를 `prism`, `hangar`, `bastion` 중 하나로 바꾼다. 전장 시트를 내보낼 때 `tower_game_pack.py`에 `--tower prism --tower hangar --tower bastion`을 넘기면 기존 지도·종족·타워 항목을 이어받는다.

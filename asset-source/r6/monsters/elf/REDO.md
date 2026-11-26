# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 35쌍 미달. 가장 비슷한 쌍은 `machine-infantry-t4`와 `elf-armored-t4` (IoU 0.673).
- stone 비교 400쌍 중 15쌍 미달. 가장 비슷한 쌍은 `stone-boss-t3`와 `elf-boss-t2` (IoU 0.643).
- human 비교 400쌍 중 85쌍 미달. 가장 비슷한 쌍은 `elf-infantry-t4`와 `human-infantry-t4` (IoU 0.713).
- insect 비교 400쌍 중 41쌍 미달. 가장 비슷한 쌍은 `elf-armored-t1`와 `insect-infantry-t3` (IoU 0.667).

## 도구로 해결

- `boss-t1/T1` 재작화 반영 · 조립 IoU 0.826
- `boss-t4/T4` 재작화 반영 · 조립 IoU 0.806
- `runner/T2` 재작화 반영 · 조립 IoU 0.853. 32px 대비 중앙값은 길 2.167배, 지형 4.467배다. 대비 1.5배 미만 화소는 길 26.2%, 지형 5.8%로 줄었다.
- G4 리그 보정 아틀라스 SHA-256 `e26469cf3d66a6523685753541639be70c87e1c3e48ddd135a752786ad27ba4e`
- `armored/T1` 접합 arm-hand-near · 조립 IoU 0.925 · 배치 SHA-256 `8bb671cbd7e9`
- `armored/T2` 접합 arm-hand-far, arm-hand-near, 장비 부착 위치 · 조립 IoU 0.857 · 배치 SHA-256 `bb67b734f05b`
- `armored/T3` 접합 arm-hand-far, arm-hand-near · 조립 IoU 0.947 · 배치 SHA-256 `b7bdbcec3588`
- `armored/T4` 접합 arm-hand-far, 장비 부착 위치 · 조립 IoU 0.830 · 배치 SHA-256 `575f31d58788`
- `boss-t1/T1` 접합 arm-far, leg-foot-near, arm-hand-near · 조립 IoU 0.818 · 배치 SHA-256 `7b360e6664d0`
- `boss-t2/T2` 접합 leg-fore-foot-far, leg-fore-foot-near · 조립 IoU 0.768 · 배치 SHA-256 `6b72d594aaaf`
- `boss-t3/T3` 접합 head, leg-foot-near · 조립 IoU 0.703 · 배치 SHA-256 `9483323bbc5c` · 추가 확인
- `boss-t4/T4` 접합 leg-hind-near, leg-hind-foot-near · 조립 IoU 0.795 · 배치 SHA-256 `473b3611ad3a`
- `infantry/T1` 접합 leg-foot-near · 조립 IoU 0.872 · 배치 SHA-256 `3baf1f011562`
- `infantry/T2` 접합 arm-hand-far · 조립 IoU 0.823 · 배치 SHA-256 `4d06d3739e9d`
- `infantry/T4` 접합 arm-hand-far · 조립 IoU 0.774 · 배치 SHA-256 `4a48b55e12c6`
- `runner/T2` 접합 leg-hind-foot-far, head · 조립 IoU 0.829 · 배치 SHA-256 `b061217c417e`
- `runner/T4` 접합 leg-hind-foot-far, head · 조립 IoU 0.826 · 배치 SHA-256 `f1ca666fff83`
- `special/T1` 접합 wing-near · 조립 IoU 0.758 · 배치 SHA-256 `8aced272b8f3`

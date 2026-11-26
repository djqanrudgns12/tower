# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 45쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `elf-boss-t2` (IoU 0.667).
- stone 비교 400쌍 중 23쌍 미달. 가장 비슷한 쌍은 `stone-boss-t3`와 `elf-boss-t2` (IoU 0.663).
- human 비교 400쌍 중 75쌍 미달. 가장 비슷한 쌍은 `elf-armored-t3`와 `human-infantry-t4` (IoU 0.710).
- insect 비교 400쌍 중 32쌍 미달. 가장 비슷한 쌍은 `elf-armored-t4`와 `insect-infantry-t4` (IoU 0.661).

## 32px 재작화

원래 색 아틀라스를 유지한 채 바깥 1px 은회(`#B8C0C8`) 테두리를 적용한 기준에서 아래 7개체는 지형(`#1D242C`) 또는 길(`#4A5563`) 중앙값이 1.5배 미만이다(원본 색 보존 우선).

- 지형 미달(3개체): `elf-special-t1` (지형 **1.377배** / 길 1.695배), `elf-armored-t3` (**1.467** / 1.625), `elf-runner-t3` (**1.486** / 1.660) — 어두운 숲 갑주·잎 중앙 면적이 넓어 지형 대비가 1.5배에 소폭 미달.
- 길 미달(4개체): `elf-armored-t2` (지형 2.069 / 길 **1.307**), `elf-boss-t2` (1.748 / **1.377**), `elf-armored-t4` (1.882 / **1.444**), `elf-boss-t4` (1.761 / **1.485**) — 짙은 녹회색·갈색 갑주 면이 길 색(`#4A5563`)과 유사.

## 도구로 해결

- `boss-t1/T1` 재작화 반영 · 조립 IoU 0.826
- `boss-t4/T4` 재작화 반영 · 조립 IoU 0.806
- `runner/T2` 재작화 반영 · 조립 IoU 0.853. 32px 대비 중앙값은 길 2.167배, 지형 4.467배다. 대비 1.5배 미만 화소는 길 26.2%, 지형 5.8%로 줄었다.
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
- `special/T3` 재작화·접합·단조 배율(`displayScale: 1.55`) 반영 · 조립 IoU 0.717
- `special/T4` 재작화·단조 배율(`displayScale: 1.60`) 반영 · 조립 IoU 0.743
- `boss-t3/T3` 접합 `arm-far`, `arm-hand-far`, `arm-hand-near`, 피벗 정렬 · 조립 IoU 0.712 · 33자세 최소 접합 22px²
- 바닥 대비 보정(원래 색 아틀라스 복원 + 런타임 바깥 1px 은회 `#B8C0C8` 실루엣 테두리) · 지형 중앙값 1.373→1.879배(미달 12→3개체), 길 중앙값 1.554→1.627배(미달 9→4개체) · 내부 색 ΔE76 최대 2.286
- G4 최종 아틀라스 1985×237 · 719,422바이트 · SHA-256 `267fecc76722fca4b5d332ad8b019b1f90a545567e0f1b665c018317b23df46b`

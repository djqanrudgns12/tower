# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 91쌍 미달. 가장 비슷한 쌍은 `machine-armored-t3`와 `human-runner-t4` (IoU 0.672).
- stone 비교 400쌍 중 113쌍 미달. 가장 비슷한 쌍은 `stone-special-t4`와 `human-special-t1` (IoU 0.705).
- elf 비교 400쌍 중 75쌍 미달. 가장 비슷한 쌍은 `elf-armored-t3`와 `human-infantry-t4` (IoU 0.710).
- insect 비교 400쌍 중 81쌍 미달. 가장 비슷한 쌍은 `human-special-t2`와 `insect-special-t4` (IoU 0.697).

## 도구로 해결

- `armored/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.752
- `armored/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.813
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.764
- `infantry/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.773
- `runner/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.744
- `runner/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.775
- `infantry/T3` 재작화 반영 · 조립 IoU 0.795
- `runner/T2` 재작화 반영 · 조립 IoU 0.773
- `armored/T1` 접합 arm-hand-far · 조립 IoU 0.922 · 배치 SHA-256 `10a9171434ce`
- `armored/T2` 접합 arm-hand-far, 머리 표시 순서 · 조립 IoU 0.784 · 배치 SHA-256 `39263a6cb2a5`
- `armored/T3` 접합 arm-hand-far, arm-hand-near, 머리 표시 순서 · 조립 IoU 0.854 · 배치 SHA-256 `00eba12709b9`
- `armored/T4` 접합 arm-hand-far · 조립 IoU 0.930 · 배치 SHA-256 `a0a086358e73`
- `boss-t2/T2` 접합 leg-fore-foot-near · 조립 IoU 0.786 · 배치 SHA-256 `923ef3ea4bf1`
- `boss-t3/T3` 접합 leg-foot-far, arm-far, arm-hand-far, leg-near, arm-hand-near · 조립 IoU 0.750 · 배치 SHA-256 `e9d10b67c857`
- `infantry/T1` 접합 arm-hand-far, arm-near, arm-hand-near · 조립 IoU 0.778 · 배치 SHA-256 `87110a8314a9`
- `infantry/T2` 장비 부착 위치 · 조립 IoU 0.753 · 배치 SHA-256 `1b0ac401aa7e`
- `infantry/T3` 접합 arm-hand-near, 장비 부착 위치 · 조립 IoU 0.735 · 배치 SHA-256 `d9ef84f6d2b7`
- `infantry/T4` 접합 arm-hand-far, arm-hand-near · 조립 IoU 0.772 · 배치 SHA-256 `b64a1460eba8`
- `runner/T3` 접합 leg-hind-foot-near, leg-fore-foot-near · 조립 IoU 0.808 · 배치 SHA-256 `6426f352e31a`
- `runner/T4` 접합 leg-fore-foot-far, leg-fore-foot-near · 조립 IoU 0.773 · 배치 SHA-256 `7d80b26a6345`

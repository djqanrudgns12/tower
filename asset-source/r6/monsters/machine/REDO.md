# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- stone 비교 400쌍 중 78쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `stone-infantry-t3` (IoU 0.693).
- elf 비교 400쌍 중 35쌍 미달. 가장 비슷한 쌍은 `machine-infantry-t4`와 `elf-armored-t4` (IoU 0.673).
- human 비교 400쌍 중 95쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- insect 비교 400쌍 중 71쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `insect-boss-t3` (IoU 0.701).

## 도구로 해결

- `armored/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.903
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.809
- `runner/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.758
- `special/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.900
- `runner/T3` 재작화 반영 · 조립 IoU 0.837
- `special/T2` 재작화 반영 · 조립 IoU 0.886
- `special/T3` 재작화 반영 · 조립 IoU 0.820
- `special/T4` 재작화 반영 · 조립 IoU 0.913
- `boss-t2/T2` 재작화 반영 · 조립 IoU 0.829
- `boss-t4/T4` 재작화 반영 · 조립 IoU 0.815
- `infantry/T3` 재작화 반영 · 조립 IoU 0.917
- `infantry/T4` 먼 쪽 팔·손 접합 보정 · 조립 IoU 0.869
- `boss-t3/T3` 재작화 반영 · 조립 IoU 0.825
- G4 리그 보정 아틀라스 SHA-256 `89ecd5cbb636e54d7db29f26c501d978574f5523163c55d98efc3dc325bee840`
- `armored/T1` 접합 leg-hind-near · 조립 IoU 0.892 · 배치 SHA-256 `3a03ee1f7d9b`
- `armored/T3` 접합 leg-fore-foot-far, leg-hind-near · 조립 IoU 0.889 · 배치 SHA-256 `51b2263890ab`
- `boss-t1/T1` 접합 leg-hind-foot-far, leg-hind-near, leg-hind-foot-near · 조립 IoU 0.831 · 배치 SHA-256 `d1e258221003`
- `boss-t2/T2` 접합 leg-hind-foot-far, leg-hind-near, leg-hind-foot-near · 조립 IoU 0.817 · 배치 SHA-256 `f32e62bd053d`
- `boss-t3/T3` 접합 head, leg-hind-foot-near, leg-fore-foot-near, 머리 표시 순서 · 조립 IoU 0.789 · 배치 SHA-256 `edbd72da504a`
- `boss-t4/T4` 접합 leg-hind-near, leg-fore-foot-near · 조립 IoU 0.804 · 배치 SHA-256 `d4353e3008ff`
- `infantry/T2` 접합 leg-near · 조립 IoU 0.803 · 배치 SHA-256 `f4c4acd8539e`
- `infantry/T3` 머리 표시 순서 · 조립 IoU 0.917 · 배치 SHA-256 `899d62dfb96d`
- `runner/T1` 접합 leg-hind-foot-far, leg-hind-near, leg-hind-foot-near, leg-fore-near, leg-fore-foot-near · 조립 IoU 0.728 · 배치 SHA-256 `7070f9faaad4` · 추가 확인
- `runner/T3` 접합 leg-hind-foot-far · 조립 IoU 0.837 · 배치 SHA-256 `e77252477566`

## 32px 외곽선 · 이전 검수 기록

아래 조합은 판독 띠에서 겹치는 면적이 기준 이상이다. 두 원화의 몸통 폭, 장비와 다리 사이의 빈 공간을 함께 검토한다.

- `machine-armored-t2` · `stone-armored-t1` — IoU 0.665
- `machine-armored-t2` · `stone-boss-t1` — IoU 0.661
- `machine-armored-t1` · `stone-boss-t1` — IoU 0.652
- `machine-armored-t2` · `stone-special-t1` — IoU 0.638
- `machine-armored-t2` · `stone-infantry-t1` — IoU 0.623
- `machine-armored-t1` · `stone-special-t1` — IoU 0.622
- `machine-armored-t3` · `stone-boss-t1` — IoU 0.616
- `machine-armored-t3` · `stone-special-t1` — IoU 0.610
- `machine-armored-t3` · `stone-infantry-t1` — IoU 0.603
- `machine-armored-t1` · `stone-infantry-t1` — IoU 0.600
- `machine-armored-t1` · `stone-armored-t1` — IoU 0.592
- `machine-armored-t3` · `stone-armored-t1` — IoU 0.564
- `machine-runner-t3` · `stone-special-t1` — IoU 0.562
- `machine-infantry-t3` · `stone-boss-t1` — IoU 0.554

# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- stone 비교 400쌍 중 84쌍 미달. 가장 비슷한 쌍은 `machine-infantry-t3`와 `stone-boss-t2` (IoU 0.634).
- elf 비교 400쌍 중 47쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `elf-boss-t2` (IoU 0.667).
- human 비교 400쌍 중 91쌍 미달. 가장 비슷한 쌍은 `machine-armored-t3`와 `human-runner-t4` (IoU 0.672).
- insect 비교 400쌍 중 73쌍 미달. 가장 비슷한 쌍은 `machine-boss-t3`와 `insect-boss-t3` (IoU 0.696).

## 32px 재작화

원래 색 아틀라스를 유지한 채 바깥 1px 은회(`#B8C0C8`) 테두리를 적용한 기준에서 지형 미달은 0개체이며, 아래 13개체는 길(`#4A5563`) 위 중앙값이 1.5배 미만이다(원본 색 보존 우선).

- `machine-armored-t4` (지형 2.032 / 길 **1.335**), `machine-armored-t3` (1.922 / **1.361**), `machine-armored-t2` (2.422 / **1.411**) — 짙은 슬레이트·건메탈 장갑 전면 면적 비중이 높아 길 색(`#4A5563`)과 명도 차이가 작음.
- `machine-special-t3` (2.411 / **1.438**), `machine-boss-t2` (1.976 / **1.438**), `machine-boss-t3` (1.914 / **1.448**), `machine-runner-t2` (2.044 / **1.457**), `machine-special-t2` (2.166 / **1.461**), `machine-special-t1` (2.153 / **1.464**), `machine-runner-t4` (2.256 / **1.468**), `machine-infantry-t2` (1.959 / **1.472**), `machine-boss-t4` (2.100 / **1.472**), `machine-special-t4` (2.501 / **1.493**) — 기계 고유 짙은 장갑 면이 길 색과 근접.

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
- `armored/T2` 재작화 반영 · 조립 IoU 0.912
- `runner/T1` 접합 `leg-fore-foot-far`, `leg-fore-far` 배치 보정 · 조립 IoU 0.708 · 33자세 최소 접합 12px²
- `armored/T4` 접합 `leg-fore-foot-far`, `leg-fore-far` 배치 보정 · 조립 IoU 0.879 · 33자세 최소 접합 17px²

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

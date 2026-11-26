# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 91쌍 미달. 가장 비슷한 쌍은 `machine-armored-t3`와 `human-runner-t4` (IoU 0.672).
- stone 비교 400쌍 중 113쌍 미달. 가장 비슷한 쌍은 `stone-special-t4`와 `human-special-t1` (IoU 0.705).
- elf 비교 400쌍 중 75쌍 미달. 가장 비슷한 쌍은 `elf-armored-t3`와 `human-infantry-t4` (IoU 0.710).
- insect 비교 400쌍 중 81쌍 미달. 가장 비슷한 쌍은 `human-special-t2`와 `insect-special-t4` (IoU 0.697).

## 32px 재작화

원래 색 아틀라스를 유지한 채 바깥 1px 은회(`#B8C0C8`) 테두리를 적용한 기준에서 지형 미달은 0개체이며, 아래 6개체는 길(`#4A5563`) 위 중앙값이 1.5배 미만이다(원본 색 보존 우선).

- `human-runner-t4` (지형 2.342배 / 길 **1.392배**), `human-runner-t2` (1.951 / **1.429**), `human-runner-t1` (2.102 / **1.443**), `human-runner-t3` (2.491 / **1.448**) — 갈색·회색 말 몸통 면적 비중이 커 길 색과 명도 차이가 작음.
- `human-boss-t2` (2.153 / **1.449**), `human-boss-t3` (1.904 / **1.451**) — 기마·어두운 목재 공성탑 몸통 면이 길 색과 근접.

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
- `boss-t1/T1` 재작화·몸통/망토 배치 정렬 반영 · 조립 IoU 0.738
- `boss-t4/T4` 재작화 반영 · 조립 IoU 0.749
- `armored/T4` 단조 배율(`displayScale: 1.75`) 반영 · 조립 IoU 0.930
- 바닥 대비 보정(원래 색 아틀라스 복원 + 런타임 바깥 1px 은회 `#B8C0C8` 실루엣 테두리) · 지형 중앙값 2.184→2.759배(미달 0→0개체), 길 중앙값 1.472→1.625배(미달 11→6개체) · 내부 색 ΔE76 최대 1.968
- G4 최종 아틀라스 2001×332 · 410,030바이트 · SHA-256 `e286396530d74d0894fad30c0274d03ddacb37c71c999ea1e7a8b0642844c659`

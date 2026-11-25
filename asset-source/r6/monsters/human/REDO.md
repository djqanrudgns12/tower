# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 95쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- stone 비교 400쌍 중 98쌍 미달. 가장 비슷한 쌍은 `stone-boss-t4`와 `human-armored-t3` (IoU 0.723).
- elf 비교 100쌍 중 12쌍 미달. 가장 비슷한 쌍은 `elf-infantry-t1`와 `human-infantry-t1` (IoU 0.691).
- insect 비교 100쌍 중 25쌍 미달. 가장 비슷한 쌍은 `human-armored-t1`와 `insect-armored-t1` (IoU 0.655).

## 도구로 해결

- `armored/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.752
- `armored/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.813
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.764
- `infantry/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.773
- `runner/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.744
- `runner/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.775
- `infantry/T3` 재작화 반영 · 조립 IoU 0.795
- `runner/T2` 재작화 반영 · 조립 IoU 0.773

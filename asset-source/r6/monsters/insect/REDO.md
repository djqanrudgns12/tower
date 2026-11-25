# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 71쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `insect-boss-t3` (IoU 0.701).
- stone 비교 400쌍 중 86쌍 미달. 가장 비슷한 쌍은 `stone-boss-t4`와 `insect-boss-t3` (IoU 0.697).
- elf 비교 400쌍 중 41쌍 미달. 가장 비슷한 쌍은 `elf-armored-t1`와 `insect-infantry-t3` (IoU 0.667).
- human 비교 400쌍 중 92쌍 미달. 가장 비슷한 쌍은 `human-special-t2`와 `insect-special-t4` (IoU 0.706).

## 도구로 해결

- `infantry/T1` 재작화 반영 · 조립 IoU 0.818
- `boss-t1/T1` 재작화 반영 · 조립 IoU 0.780
- `runner/T1` 재작화 반영 · 조립 IoU 0.868
- `boss-t2/T2` 새 시트와 먼 쪽 앞다리 접합 보정 반영 · 조립 IoU 0.868
- `boss-t4/T4` 새 시트와 먼 쪽 앞다리 접합 보정 반영 · 조립 IoU 0.833

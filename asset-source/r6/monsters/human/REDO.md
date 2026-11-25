# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 95쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- stone 비교 400쌍 중 98쌍 미달. 가장 비슷한 쌍은 `stone-boss-t4`와 `human-armored-t3` (IoU 0.723).
- elf 비교 400쌍 중 85쌍 미달. 가장 비슷한 쌍은 `elf-infantry-t4`와 `human-infantry-t4` (IoU 0.713).
- insect 비교 400쌍 중 92쌍 미달. 가장 비슷한 쌍은 `human-special-t2`와 `insect-special-t4` (IoU 0.706).

## 도구로 해결

- `armored/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.752
- `armored/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.813
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.764
- `infantry/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.773
- `runner/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.744
- `runner/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.775
- `infantry/T3` 재작화 반영 · 조립 IoU 0.795
- `runner/T2` 재작화 반영 · 조립 IoU 0.773

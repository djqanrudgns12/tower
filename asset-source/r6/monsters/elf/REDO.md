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

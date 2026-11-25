# 그림 재검수

## 조립

- `runner/T1` 가까운 앞다리(leg-fore-near)에 다른 부위와 사각 배경이 남습니다. 날개·가슴의 잘린 좌측 가장자리도 함께 복원해 주세요.

## 32px 비교

- machine 비교 100쌍 중 13쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `insect-armored-t1` (IoU 0.634).
- stone 비교 100쌍 중 20쌍 미달. 가장 비슷한 쌍은 `stone-special-t3`와 `insect-special-t1` (IoU 0.674).
- elf 비교 25쌍 중 3쌍 미달. 가장 비슷한 쌍은 `elf-armored-t1`와 `insect-boss-t1` (IoU 0.613).
- human 비교 65쌍 중 14쌍 미달. 가장 비슷한 쌍은 `human-armored-t1`와 `insect-armored-t1` (IoU 0.655).

## 도구로 해결

- `infantry/T1` 재작화 반영 · 조립 IoU 0.818
- `boss-t1/T1` 재작화 반영 · 조립 IoU 0.780

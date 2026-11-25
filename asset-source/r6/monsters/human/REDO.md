# 그림 재검수

## 조립

- `infantry/T3` gear, leg-far, leg-near 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.674.
- `runner/T2` body, leg-hind-near, head 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.688.

## 32px 비교

- machine 비교 260쌍 중 56쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- stone 비교 260쌍 중 50쌍 미달. 가장 비슷한 쌍은 `stone-boss-t4`와 `human-armored-t3` (IoU 0.723).
- elf 비교 65쌍 중 9쌍 미달. 가장 비슷한 쌍은 `elf-infantry-t1`와 `human-infantry-t1` (IoU 0.691).
- insect 비교 65쌍 중 13쌍 미달. 가장 비슷한 쌍은 `human-infantry-t4`와 `insect-boss-t1` (IoU 0.667).

## 도구로 해결

- `armored/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.752
- `armored/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.813
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.764
- `infantry/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.773
- `runner/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.744
- `runner/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.775

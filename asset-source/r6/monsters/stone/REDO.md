# 그림 재검수

## 조립

- `armored/T2` 흰 얼룩 · 원화 [148, 112, 159, 133]에서 89px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `armored/T4` 흰 얼룩 · 원화 [88, 114, 98, 168]에서 250px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `special/T2` body, crystal-far, crystal-near 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.460.
- `special/T3` body, crystal-near, crystal-far 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.537.
- `special/T4` body, crystal-far, crystal-near 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.590.
- `boss-t2/T2` leg-near, armor, leg-far 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.665.
- `boss-t3/T3` leg-near, body, leg-far 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.643.
- `boss-t4/T4` 흰 얼룩 · 원화 [86, 95, 110, 158]에서 748px. 부품 사이에 남은 흰 면을 확인해 주세요.

## 32px 비교

- machine 비교 400쌍 중 81쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `stone-infantry-t3` (IoU 0.693).
- elf 비교 100쌍 중 1쌍 미달. 가장 비슷한 쌍은 `stone-boss-t2`와 `elf-special-t1` (IoU 0.575).
- human 비교 260쌍 중 51쌍 미달. 가장 비슷한 쌍은 `stone-boss-t4`와 `human-armored-t3` (IoU 0.723).
- insect 비교 100쌍 중 17쌍 미달. 가장 비슷한 쌍은 `stone-special-t1`와 `insect-armored-t1` (IoU 0.641).

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

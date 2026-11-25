# 그림 재검수

## 조립

- `infantry/T2` 흰 얼룩 · 원화 [95, 106, 109, 123]에서 121px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `infantry/T3` 흰 얼룩 · 원화 [99, 106, 112, 123]에서 126px, 조립 [124, 67, 142, 79]에서 148px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `runner/T1` 흰 얼룩 · 원화 [167, 134, 180, 141]에서 32px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `runner/T3` head, body, armor 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.689.
- `armored/T1` 흰 얼룩 · 조립 [159, 97, 176, 105]에서 39px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `special/T1` 흰 얼룩 · 원화 [50, 141, 69, 154]에서 151px, 조립 [50, 140, 68, 152]에서 137px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `special/T2` body, swarm-2, swarm-1 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.422.
- `special/T3` body, swarm-2, swarm-1 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.487.
- `special/T4` body, swarm-3, swarm-2 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.565.
- `boss-t2/T2` body, armor, gear 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.694.
- `boss-t3/T3` 흰 얼룩 · 원화 [185, 121, 203, 137]에서 147px. 부품 사이에 남은 흰 면을 확인해 주세요.
- `boss-t4/T4` body, leg-fore-far, leg-hind-far 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.689.

## 32px 비교

- stone 비교 400쌍 중 81쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `stone-infantry-t3` (IoU 0.693).
- elf 비교 100쌍 중 7쌍 미달. 가장 비슷한 쌍은 `machine-infantry-t4`와 `elf-armored-t1` (IoU 0.600).
- human 비교 260쌍 중 56쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- insect 비교 100쌍 중 10쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `insect-armored-t1` (IoU 0.634).

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

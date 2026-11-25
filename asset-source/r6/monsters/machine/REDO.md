# 그림 재검수

## 조립

- `runner/T3` head, body, armor 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.689.
- `special/T2` body, swarm-2, swarm-1 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.422.
- `special/T3` body, swarm-2, swarm-1 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.487.
- `special/T4` body, swarm-3, swarm-2 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.565.
- `boss-t2/T2` body, armor, gear 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.694.
- `boss-t4/T4` body, leg-fore-far, leg-hind-far 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU 0.689.

## 32px 비교

- stone 비교 400쌍 중 80쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `stone-infantry-t3` (IoU 0.693).
- elf 비교 100쌍 중 6쌍 미달. 가장 비슷한 쌍은 `machine-infantry-t4`와 `elf-armored-t1` (IoU 0.600).
- human 비교 260쌍 중 56쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- insect 비교 100쌍 중 10쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `insect-armored-t1` (IoU 0.634).

## 도구로 해결

- `armored/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.903
- `boss-t3/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.705
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.809
- `infantry/T3` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.840
- `runner/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.758
- `special/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.900

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

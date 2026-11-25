# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- stone 비교 400쌍 중 78쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `stone-infantry-t3` (IoU 0.693).
- elf 비교 100쌍 중 7쌍 미달. 가장 비슷한 쌍은 `machine-infantry-t4`와 `elf-armored-t1` (IoU 0.600).
- human 비교 260쌍 중 57쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `human-armored-t3` (IoU 0.693).
- insect 비교 100쌍 중 12쌍 미달. 가장 비슷한 쌍은 `machine-armored-t2`와 `insect-armored-t1` (IoU 0.634).

## 도구로 해결

- `armored/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.903
- `infantry/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.809
- `runner/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.758
- `special/T1` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.900
- `runner/T3` 재작화 반영 · 조립 IoU 0.837
- `special/T2` 재작화 반영 · 조립 IoU 0.886
- `special/T3` 재작화 반영 · 조립 IoU 0.820
- `special/T4` 재작화 반영 · 조립 IoU 0.913
- `boss-t2/T2` 재작화 반영 · 조립 IoU 0.829
- `boss-t4/T4` 재작화 반영 · 조립 IoU 0.815
- `infantry/T3` 재작화 반영 · 조립 IoU 0.917
- `boss-t3/T3` 재작화 반영 · 조립 IoU 0.825

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

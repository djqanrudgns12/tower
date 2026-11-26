# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 84쌍 미달. 가장 비슷한 쌍은 `machine-boss-t2`와 `stone-boss-t3` (IoU 0.638).
- elf 비교 400쌍 중 23쌍 미달. 가장 비슷한 쌍은 `stone-boss-t3`와 `elf-boss-t2` (IoU 0.663).
- human 비교 400쌍 중 113쌍 미달. 가장 비슷한 쌍은 `stone-special-t4`와 `human-special-t1` (IoU 0.705).
- insect 비교 400쌍 중 105쌍 미달. 가장 비슷한 쌍은 `stone-infantry-t3`와 `insect-armored-t1` (IoU 0.698).

## 도구로 해결

- `armored/T2` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.883
- `armored/T4` 도구로 해결 (`5d5e8b0a`) · 조립 IoU 0.778
- `special/T2` 재작화 반영 · 조립 IoU 0.776
- `special/T3` 재작화 반영 · 조립 IoU 0.821
- `special/T4` 재작화 반영 · 조립 IoU 0.823
- `boss-t2/T2` 재작화 반영 · 조립 IoU 0.803
- `boss-t3/T3` 재작화 반영 · 조립 IoU 0.749
- `armored/T3` 접합 arm-hand-near, 장비 부착 위치 · 조립 IoU 0.879 · 배치 SHA-256 `16e4cbae68e6`
- `boss-t2/T2` 접합 arm-hand-near · 조립 IoU 0.798 · 배치 SHA-256 `4274e889ea1f`
- `infantry/T2` 접합 arm-hand-far · 조립 IoU 0.772 · 배치 SHA-256 `79fb5974ee91`
- `armored/T4` 장비 부착 위치, 왼쪽 방패 · 조립 IoU 0.870 · 배치 SHA-256 `a3647a1d41ed`
- `boss-t4/T4` 재작화 반영 · 조립 IoU 0.744
- `boss-t1/T1` 재작화 반영 · 조립 IoU 0.746
- `boss-t3/T3` 재작화·단조 배율(`displayScale: 2.45`) 반영 · 조립 IoU 0.707
- `special/T4` 재작화 반영 · 조립 IoU 0.804
- `boss-t4/T4` 접합 `leg-far`, `arm-far` 보정·피벗 정렬 · 조립 IoU 0.706 · 33자세 최소 접합 13px²
- `infantry/T3` (`displayScale: 1.35`), `armored/T4` (`displayScale: 1.56`), `special/T2` (`displayScale: 1.32`) 단조 배율 반영
- 바닥 대비 보정(종족 무광 톤 + 외곽 좌상단 림) 적용 · 지형 중앙값 1.691→3.275배(미달 1→0개체), 길 중앙값 1.414→1.641배(미달 16→1개체)
- G4 최종 아틀라스 1905×461 · 451,874바이트 · SHA-256 `fea985f75b0067054f3d2c07efeeb86ea0116c785638017805656b9ba49622e5`

## 32px 재작화

아틀라스 대비 보정 후 지형 대비 미달은 0개체이며, 아래 1개체만 길(`#4A5563`) 위 중앙값이 1.5배 미만이다.

- `stone-infantry-t4`: 지형 2.674배 / 길 **1.430배** — 짙은 현무암 몸통 중앙 면적 비중이 높아 길 색(`#4A5563`)과 명도 차이가 작음.

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

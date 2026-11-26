# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 68쌍 미달. 가장 비슷한 쌍은 `machine-boss-t3`와 `insect-boss-t3` (IoU 0.696).
- stone 비교 400쌍 중 105쌍 미달. 가장 비슷한 쌍은 `stone-infantry-t3`와 `insect-armored-t1` (IoU 0.698).
- elf 비교 400쌍 중 32쌍 미달. 가장 비슷한 쌍은 `elf-armored-t4`와 `insect-infantry-t4` (IoU 0.661).
- human 비교 400쌍 중 81쌍 미달. 가장 비슷한 쌍은 `human-special-t2`와 `insect-special-t4` (IoU 0.697).

## 도구로 해결

- `infantry/T1` 재작화 반영 · 조립 IoU 0.818
- `boss-t1/T1` 재작화 반영 · 조립 IoU 0.780
- `runner/T1` 재작화 반영 · 조립 IoU 0.868
- `boss-t2/T2` 새 시트와 먼 쪽 앞다리 접합 보정 반영 · 조립 IoU 0.868
- `boss-t4/T4` 새 시트와 먼 쪽 앞다리 접합 보정 반영 · 조립 IoU 0.833
- `armored/T1` 접합 leg-fore-far, leg-hind-near, leg-hind-foot-near · 조립 IoU 0.885 · 배치 SHA-256 `ed28cc66786d` · 추가 확인
- `armored/T2` 접합 leg-fore-far, leg-hind-foot-near, leg-fore-foot-near · 조립 IoU 0.929 · 배치 SHA-256 `245ef2169322` · 추가 확인
- `armored/T3` 접합 leg-hind-foot-far, leg-fore-far, leg-hind-near, leg-fore-foot-near · 조립 IoU 0.780 · 배치 SHA-256 `a544e440595e`
- `armored/T4` 접합 leg-hind-foot-far, leg-fore-far · 조립 IoU 0.914 · 배치 SHA-256 `b9011fa131f0`
- `boss-t3/T3` 접합 leg-fore-foot-near, 머리 표시 순서 · 조립 IoU 0.809 · 배치 SHA-256 `ee7a875a735a`
- `boss-t4/T4` 접합 head, 머리 표시 순서 · 조립 IoU 0.822 · 배치 SHA-256 `930aa1aaf3b2`
- `infantry/T1` 접합 leg-far, leg-foot-far, arm-hand-far, leg-near, arm-hand-near · 조립 IoU 0.703 · 배치 SHA-256 `cbeda8042b8a` · 추가 확인
- `infantry/T2` 접합 leg-foot-far, arm-hand-far, leg-foot-near, arm-hand-near, 머리 표시 순서 · 조립 IoU 0.759 · 배치 SHA-256 `fcbaea874f10`
- `infantry/T3` 접합 leg-foot-far, arm-hand-far, leg-near, leg-foot-near, arm-hand-near, 머리 표시 순서 · 조립 IoU 0.750 · 배치 SHA-256 `9259c0491720`
- `infantry/T4` 접합 leg-foot-far, leg-near, leg-foot-near, arm-hand-near, 머리 표시 순서 · 조립 IoU 0.730 · 배치 SHA-256 `665a3759fc9b`
- `runner/T1` 접합 leg-hind-foot-far, leg-fore-far, head, leg-hind-foot-near, leg-fore-foot-near · 조립 IoU 0.845 · 배치 SHA-256 `eda155206723`
- `runner/T2` 접합 leg-hind-foot-far, leg-fore-far, leg-fore-foot-far, head, leg-fore-near · 조립 IoU 0.739 · 배치 SHA-256 `f31a6967297a`
- `runner/T4` 접합 leg-hind-foot-far, head, leg-fore-foot-near · 조립 IoU 0.768 · 배치 SHA-256 `52471bfd092f`
- `special/T4` 접합 swarm-leg-1-near · 조립 IoU 0.804 · 배치 SHA-256 `25e72c801a22`
- `runner/T3` 접합 head, leg-hind-foot-near, 머리 표시 순서 · 조립 IoU 0.714 · 배치 SHA-256 `eea1b8045d61`
- `boss-t1/T1` 재작화·다리 접합 보정 반영 · 조립 IoU 0.729
- `armored/T1` 접합 `leg-hind-foot-far`, `leg-hind-far` 보정 · 조립 IoU 0.885 · 33자세 최소 접합 14px²
- `armored/T2` 접합 `leg-hind-foot-far`, `leg-hind-far` 보정 · 조립 IoU 0.914 · 33자세 최소 접합 14px²
- `infantry/T1` 접합 `leg-foot-near`, `leg-near` 보정 · 조립 IoU 0.767 · 33자세 최소 접합 8px²
- 바닥 대비 보정(종족 무광 톤 + 외곽 좌상단 림) 적용 · 지형 중앙값 1.509→3.261배(미달 10→0개체), 길 중앙값 1.457→1.691배(미달 14→0개체)
- G4 최종 아틀라스 1857×332 · 373,456바이트 · SHA-256 `feaa94400743b0acd36caee044310ee9dbaa1c46260348b985b53f4c9bd23874`

## 32px 재작화

아틀라스 대비 보정 후 지형·길 두 바닥 모두 대비 1.5배 미만 개체 0건.

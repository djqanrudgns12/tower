# 그림 재검수

## 조립

조립 기준 미달 개체 없음.

## 32px 비교

- machine 비교 400쌍 중 68쌍 미달. 가장 비슷한 쌍은 `machine-boss-t3`와 `insect-boss-t3` (IoU 0.696).
- stone 비교 400쌍 중 105쌍 미달. 가장 비슷한 쌍은 `stone-infantry-t3`와 `insect-armored-t1` (IoU 0.698).
- elf 비교 400쌍 중 32쌍 미달. 가장 비슷한 쌍은 `elf-armored-t4`와 `insect-infantry-t4` (IoU 0.661).
- human 비교 400쌍 중 81쌍 미달. 가장 비슷한 쌍은 `human-special-t2`와 `insect-special-t4` (IoU 0.697).

## 32px 재작화

원래 색 아틀라스를 유지한 채 바깥 1px 은회(`#B8C0C8`) 테두리를 적용한 기준에서 아래 10개체는 지형(`#1D242C`) 또는 길(`#4A5563`) 중앙값이 1.5배 미만이다(원본 색 보존 우선).

- 지형 미달(1개체): `insect-armored-t1` (지형 **1.399배** / 길 1.570배) — 검은 키틴 등딱지 면적이 넓어 어두운 지형과의 중앙값이 소폭 미달.
- 길 미달(9개체): `insect-special-t1` (지형 1.782 / 길 **1.360**), `insect-infantry-t1` (2.038 / **1.380**), `insect-infantry-t2` (1.920 / **1.386**), `insect-special-t2` (1.962 / **1.412**), `insect-runner-t1` (2.027 / **1.419**), `insect-special-t4` (2.092 / **1.435**), `insect-boss-t4` (1.913 / **1.449**), `insect-infantry-t3` (1.922 / **1.455**), `insect-armored-t3` (1.641 / **1.462**) — 짙은 키틴·갈색 갑각 면이 길 색(`#4A5563`)과 유사.

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
- 바닥 대비 보정(원래 색 아틀라스 복원 + 런타임 바깥 1px 은회 `#B8C0C8` 실루엣 테두리) · 지형 중앙값 1.509→1.921배(미달 10→1개체), 길 중앙값 1.457→1.512배(미달 14→9개체) · 내부 색 ΔE76 최대 2.297
- G4 최종 아틀라스 2033×300 · 335,212바이트 · SHA-256 `b852fe1c1b383602135b2c330bb65e8d83056b761f6db5d54b7aeff3a10afacf`

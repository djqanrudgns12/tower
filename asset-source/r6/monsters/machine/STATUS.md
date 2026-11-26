# 기계 군단 (`machine`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`
- 진행률: **20 / 20 완료** (`cut_parts.py` 절단 검증 통과 20개 · `REDO.md` 2·3·4회차 조립 재요청 전부 반영 완료)

## 완료 목록 (20개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 6 (`armless`) | 없음(기본) | 통과 (`issues=0`, IoU 0.528) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 11 (`+armor`) | `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.552) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 11 (`+armor`) | `leg-*`, `leg-foot-*` ← `T1`; `arm-*`, `arm-hand-*` ← `T2` | 통과 (`issues=0`, IoU 0.549) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 11 (`+armor`) | 없음(전 부위 신규) | 통과 (`issues=0`, IoU 0.504) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 10 | 없음(기본 · **REDO 반영: 발 4부위 긴 바늘형 재작화**) | 통과 (`issues=0`, 기본 IoU 0.442 / placement 0.672) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 11 (`+armor`) | 없음(늑대형 신규) | 통과 (`issues=0`, IoU 0.410) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 12 (`+armor`, `+gear`) | 없음(**REDO 반영: 다리·발 8부위 T3 보폭/각도 신규 작화**) | 통과 (`issues=0`, 기본 IoU 0.452 / placement 0.626) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T2` | 통과 (`issues=0`, IoU 0.483) |
| `armored/T1` | `armored-quadruped.json` | 1.10 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.589) |
| `armored/T2` | `armored-quadruped.json` | 1.22 | 11 (`+armor`) | 없음(갑충형 신규) | 통과 (`issues=0`, IoU 0.556) |
| `armored/T3` | `armored-quadruped.json` | 1.35 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.586) |
| `armored/T4` | `armored-quadruped.json` | 1.50 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` (4족·V방패·2연장 포탑 신규) | 통과 (`issues=0`, IoU 0.557) |
| `special/T1` | `special-swarm.json` | 1.00 | 2 (`body`, `swarm-1`) | 없음(기본) | 통과 (`issues=0`, IoU 0.555) |
| `special/T2` | `special-swarm.json` | 1.12 | 3 (`body`, `swarm-1~2`) | 없음(쌍열 수송기 신규) | 통과 (`issues=0`, IoU 0.595) |
| `special/T3` | `special-swarm.json` | 1.25 | 3 (`body`, `swarm-1~2`) | 없음(4로터 모함 신규) | 통과 (`issues=0`, IoU 0.476) |
| `special/T4` | `special-swarm.json` | 1.38 | 4 (`body`, `swarm-1~3`) | 없음(링 공중모함 신규) | 통과 (`issues=0`, IoU 0.704) |
| `boss-t1/T1` | `boss-quadruped.json` | 1.65 | 11 (`+armor`) | 없음(기본) | 통과 (`issues=0`, IoU 0.401) |
| `boss-t2/T2` | `boss-quadruped.json` | 1.80 | 12 (`+armor`, `+gear`) | 없음(스텔스 기체·날개·추진체 신규, 4족 다리 포함) | 통과 (`issues=0`, IoU 0.418) |
| `boss-t3/T3` | `boss-quadruped.json` | 2.00 | 12 (`+armor`, `+gear`) | 없음(쌍동 항공기함·도킹베이·추진체 신규, 4족 착륙각 포함) | 통과 (`issues=0`, IoU 0.435) |
| `boss-t4/T4` | `boss-quadruped.json` | 2.20 | 12 (`+armor`, `+gear`) | 없음(공성 차체·V방패·2연장 포탑 신규, 중량 4족 다리 포함) | 통과 (`issues=0`, IoU 0.474) |

## 재요청 반영 (`REDO.md`, 2·3회차 완료)

- `runner/T1/sheet.png`: 앞·뒷발(`leg-fore-foot-*`, `leg-hind-foot-*`) 4부위를 조립 원화와 같은 긴 바늘형 발끝으로 재작화 (`placement.json`·`report.json` 유지).
- `runner/T3/sheet.png`, `assembly.png`: 다량 `speck` 57건 제거 및 T1 관절·시트 파츠 비율에 맞춘 조립 정합 보정 (`cut_parts` `issues=0`, 모의 `fit_parts` IoU 0.845).
- `special/T2~T4/sheet.png`, `assembly.png`: 미세 `speck` 제거 및 T1 `swarm-*` 관절 위치·시트 파츠 비율에 맞춘 조립 정합 보정 (`issues=0`, 모의 `fit_parts` IoU 0.816~0.955).
- `boss-t2/T2/assembly.png`, `boss-t4/T4/sheet.png`, `assembly.png`: `boss-t4` 흰 잔여 점 122px/`speck` 제거 및 시트 파츠 비율·자세 기준 조립 정합 보정 (`issues=0`, 모의 `fit_parts` IoU 0.807~0.815).
- `infantry/T3/sheet.png`, `assembly.png` (4차 REDO 반영): `armor` 중앙 목 아치 내부의 밝은 회색 구멍을 어두운 슬레이트 장갑(`#1D242C`)으로 채우고 흰 픽셀(1,301px → 0px) 톤다운 정리, T1 관절 기준 재조립(`cut_parts` `issues=0`, 모의 `fit_parts` IoU 0.879).
- `boss-t3/T3/sheet.png`, `assembly.png` (4차 REDO 반영): 4족 다리 상·하단 관절 소켓 두께 보강 및 `body` 하단·발 소켓 겹침 깊게 재조립(`cut_parts` `issues=0`, 모의 `fit_parts` IoU 0.823).
- `armored/T4`, `boss-t2~t4`: 32px 외곽선 차별화를 위해 넓은 상자형 몸통을 피하고 다리 사이 빈 공간과 V형 방패·2연장 포탑·스텔스 날개 돌출을 적용함.

## G4 비평 검수 재작화 (`docs/renewal/r6/review/G4-monsters-critique.md` 5항)

- `armored/T2` (비평 5항): 벌레 갑충형 돔을 폐기하고 T1~T3 중장갑 보행기 계통을 잇는 45° 모따기 직립 4족 장갑 보행기(이중 전면 방패 `armor`·상부 틸 센서 머리·4족 유압 다리)로 재작화 (`cut_parts` `issues=0` · 11/11 슬롯, T1 관절 기준 모의 `fit_parts` IoU `0.872`, 32px 벌레 중장갑군 최대 IoU `0.531`, 지형/길 대비 `1.986/1.349`, 흰색·마젠타 잔여 `0/0`).
- `docs/renewal/r6/bible/sheets/monsters-machine-parts-all.webp` 갱신 완료.

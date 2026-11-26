# 철갑 인간 (`human`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`, `docs/renewal/r6/bible/sheets/monsters-human.webp`
- 진행률: **20 / 20 완료** (`cut_parts.py` 절단 검증 통과 20개 · 3회차 `REDO.md` 2건 + 4회차 남은 7개체 전원 완료)

## 완료 목록 (13개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 13 | 없음(기본 · **REDO 반영: assembly 하단 사각 배경 투명 제거**) | 통과 (`ready=true`, `issues=0`, 기본 IoU 0.633 / placement 0.517) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 11 (`+gear`) | `arm-hand-near`, `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.424) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 11 (`+gear`) | 없음(3회차 **REDO 반영: `arm-near`/`arm-hand-near` 손 분리·speck/흰 얼룩 제거·미늘창 조립 정합**, 모의 `fit_parts` IoU 0.729/0.795) | 통과 (`issues=0`) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 11 (`+gear`) | 없음(금테 판금·깃털투구·대검 신규, 원거리 다리/부츠 armored T1 규격) | 통과 (`issues=0`, IoU 0.523) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 13 | 없음(기본 · **REDO 반영: `body` 기수 머리 목 위까지 완전 복원**) | 통과 (`ready=true`, 기본 IoU 0.448 / placement 0.722) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` (**3회차 REDO 반영: speck 64건/흰 점 제거·T1 관절 기준 목/다리/창 조립 정합**, 모의 `fit_fresh` IoU 0.773; 기존 `fixedTargets` 해제 필요) | 통과 (`issues=0`) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.354) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.446) |
| `armored/T1` | `armored-biped.json` | 1.10 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.594) |
| `armored/T2` | `armored-biped.json` | 1.22 | 11 (`+gear`) | `arm-hand-far`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.578) |
| `armored/T3` | `armored-biped.json` | 1.35 | 11 (`+gear`) | `arm-hand-far`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.599) |
| `armored/T4` | `armored-biped.json` | 1.50 | 11 (`+gear`) | `arm-hand-far`, `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.741) |
| `special/T1` | `special-wheeled.json` | 1.00 | 7 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 2건, IoU 0.497) |
| `special/T2` | `special-wheeled.json` | 1.12 | 6 (`+head`, `+armor`, `+mark`) | 없음(방패 공성 수레 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.766) |
| `special/T3` | `special-wheeled.json` | 1.25 | 6 (`+head`, `+armor`, `+mark`) | 없음(쇠뇌 공성 포차 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.766) |
| `special/T4` | `special-wheeled.json` | 1.38 | 5 (`+head`, `+armor`) | 없음(철갑 공성 전차 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.804) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.526) |
| `boss-t2/T2` | `boss-quadruped.json` | 1.80 | 11 (`+gear`) | 없음(중장갑 전차 대장·기병창 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.786) |
| `boss-t3/T3` | `boss-biped.json` | 2.00 | 12 (`+armor`, `+gear`) | 없음(모듈형 이동식 철갑 공성탑 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.825) |
| `boss-t4/T4` | `boss-biped.json` | 2.20 | 12 (`+armor`, `+gear`) | 없음(왕국 총사령관 판금·대방패·할버드 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.752) |

## 남은 목록

- 없음 (20/20 완료).

## G4 비평 검수 재작화 (`docs/renewal/r6/review/G4-monsters-critique.md` 12항 선택)

- `boss-t1/T1` (비평 12항): 넓은 지휘 망토·등 깃발(`armor`)·대형 양손 공성 망치(`gear`)로 `infantry-t4`와 실루엣 분리 (`cut_parts` `issues=0` · 13/13 슬롯, 모의 `fit_parts` IoU `0.778`, 32px 보스-일반 최대 IoU `0.683`, 지형/길 대비 `2.713/1.593`, 흰색·마젠타 잔여 `0/0`).
- `boss-t4/T4` (비평 12항): 일반 중장갑 방패 복제를 제거하고 날개 견갑·쌍둥이 지휘 깃발(`armor`)·굵은 대형 할버드(`gear`)로 실루엣 차별화 (`cut_parts` `issues=0` · 12/12 슬롯, 모의 `fit_parts` IoU `0.771`, 32px 보스-일반 최대 IoU `0.579`, 지형/길 대비 `2.784/1.540`, 흰색·마젠타 잔여 `0/0`).
- `docs/renewal/r6/bible/sheets/monsters-human-parts-all.webp` 갱신 완료.

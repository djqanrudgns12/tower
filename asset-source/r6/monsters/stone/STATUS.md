# 바위 거인 (`stone`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`
- 진행률: **20 / 20 완료** (`cut_parts.py` 절단 검증 통과 20개)

## 완료 목록 (20개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.371) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 10 | `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.377) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 12 (`+armor`, `+gear`) | `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.439) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 10 | `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.413) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.518) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 10 | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.496) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 11 (`+armor`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.464) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 11 (`+armor`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.548) |
| `armored/T1` | `armored-biped.json` | 1.10 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.411) |
| `armored/T2` | `armored-biped.json` | 1.22 | 11 (`+gear`) | `arm-hand-far`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.399) |
| `armored/T3` | `armored-biped.json` | 1.35 | 12 (`+armor`, `+gear`) | `arm-hand-near`, `arm-far`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.451) |
| `armored/T4` | `armored-biped.json` | 1.50 | 11 (`+gear`) | `arm-hand-near`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.383) |
| `special/T1` | `special-crystal.json` | 1.00 | 3 | 없음(기본) | 통과 (`issues=0`, IoU 0.535) |
| `special/T2` | `special-crystal.json` | 1.12 | 3 | 없음(고리·수정핵 신규) | 통과 (`issues=0`, IoU 0.481) |
| `special/T3` | `special-crystal.json` | 1.25 | 3 | 없음(3단 수정 클러스터 신규) | 통과 (`issues=0`, IoU 0.343) |
| `special/T4` | `special-crystal.json` | 1.38 | 3 | 없음(대지 수정탑 신규) | 통과 (`issues=0`, IoU 0.404) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.485) |
| `boss-t2/T2` | `boss-biped.json` | 1.80 | 11 (`+armor`) | 없음(수정 갑옷·왕관·다리 신규, 원거리 다리/발 boss-t1 기반) | 통과 (`issues=0`, IoU 0.517) |
| `boss-t3/T3` | `boss-biped.json` | 2.00 | 10 | 없음(용암 균열 몸통·팔·다리 신규, 발 boss-t1 기반) | 통과 (`issues=0`, IoU 0.370) |
| `boss-t4/T4` | `boss-biped.json` | 2.20 | 11 (`+armor`) | 없음(산맥 성곽 어깨·수정 팔/다리 신규, 원거리 다리/발 boss-t1 기반) | 통과 (`issues=0`, IoU 0.523) |

## 재요청 반영 (`REDO.md`, 3회차 완료)

- `special/T2~T4/sheet.png`, `assembly.png`: T1 `crystal-far/near` 관절 기준 및 시트 파츠 비율에 맞춰 조립 정합 보정 (`issues=0`, 모의 `fit_parts` IoU 0.870~0.895).
- `boss-t2/T2`, `boss-t3/T3/sheet.png`, `assembly.png`: 시트 파츠 비율·관절 자세에 맞춰 조립 정합 보정 (`issues=0`, 모의 `fit_parts` IoU 0.850~0.855).

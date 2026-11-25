# 바위 거인 (`stone`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`
- 진행률: **5 / 20 완료** (`cut_parts.py` 절단 검증 통과 5개)

## 완료 목록

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.371) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.518) |
| `armored/T1` | `armored-biped.json` | 1.10 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.411) |
| `special/T1` | `special-crystal.json` | 1.00 | 3 | 없음(기본) | 통과 (`issues=0`, IoU 0.535) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.510) |

## 남은 목록 (15개체)

- `infantry`: T2, T3, T4
- `runner`: T2, T3, T4
- `armored`: T2, T3, T4
- `special`: T2, T3, T4
- 보스: `boss-t2/T2`, `boss-t3/T3`, `boss-t4/T4`

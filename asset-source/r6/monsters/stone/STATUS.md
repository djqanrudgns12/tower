# 바위 거인 (`stone`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`
- 진행률: **11 / 20 완료** (`cut_parts.py` 절단 검증 통과 11개)

## 완료 목록 (11개체)

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
| `special/T1` | `special-crystal.json` | 1.00 | 3 | 없음(기본) | 통과 (`issues=0`, IoU 0.535) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.485) |

## 남은 목록 (9개체 · 순차 진행 중)

- `armored`: `T2` (1.22, 조립 완료·파츠 생성 중), `T3` (1.35), `T4` (1.50)
- `special`: `T2` (1.12), `T3` (1.25), `T4` (1.38)
- 보스: `boss-t2/T2` (1.80), `boss-t3/T3` (2.00), `boss-t4/T4` (2.20)

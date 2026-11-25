# 기계 군단 (`machine`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`
- 진행률: **13 / 20 완료** (`cut_parts.py` 절단 검증 통과 13개)
- 한도 중단: 이미지 생성 할당량 소진 (`HTTP 429 RESOURCE_EXHAUSTED`, 리셋 예정: **2026-11-25 20:51 KST** 전후, 약 4시간 37분 후)

## 완료 목록 (13개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 6 (`armless`) | 없음(기본) | 통과 (`issues=0`, IoU 0.528) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 11 (`+armor`) | `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.552) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 11 (`+armor`) | `leg-*`, `leg-foot-*` ← `T1`; `arm-*`, `arm-hand-*` ← `T2` | 통과 (`issues=0`, IoU 0.549) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 11 (`+armor`) | 없음(전 부위 신규) | 통과 (`issues=0`, IoU 0.504) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.424) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 11 (`+armor`) | 없음(늑대형 신규) | 통과 (`issues=0`, IoU 0.410) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T2` | 통과 (`issues=0`, IoU 0.464) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T2` | 통과 (`issues=0`, IoU 0.483) |
| `armored/T1` | `armored-quadruped.json` | 1.10 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.589) |
| `armored/T2` | `armored-quadruped.json` | 1.22 | 11 (`+armor`) | 없음(갑충형 신규) | 통과 (`issues=0`, IoU 0.556) |
| `armored/T3` | `armored-quadruped.json` | 1.35 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.586) |
| `special/T1` | `special-swarm.json` | 1.00 | 2 (`body`, `swarm-1`) | 없음(기본) | 통과 (`issues=0`, IoU 0.555) |
| `boss-t1/T1` | `boss-quadruped.json` | 1.65 | 11 (`+armor`) | 없음(기본) | 통과 (`issues=0`, IoU 0.401) |

## 남은 목록 (7개체 · 429 한도 해제 후 재개)

- `armored/T4` (`armored-quadruped.json`, scale 1.50 — 1차 시안은 2족 조립·다리 스텀프 혼입으로 탈락, 2차 재생성 중 429 발생)
- `special/T2` (`special-swarm.json`, scale 1.12 — 생성 중 429 발생)
- `special/T3` (`special-swarm.json`, scale 1.25 — 생성 중 429 발생)
- `special/T4` (`special-swarm.json`, scale 1.38)
- `boss-t2/T2` (`boss-quadruped.json`, scale 1.80)
- `boss-t3/T3` (`boss-quadruped.json`, scale 2.00)
- `boss-t4/T4` (`boss-quadruped.json`, scale 2.20)

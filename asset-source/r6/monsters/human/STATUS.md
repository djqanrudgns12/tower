# 철갑 인간 (`human`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`, `docs/renewal/r6/bible/sheets/monsters-human.webp`
- 진행률: **13 / 20 완료** (`cut_parts.py` 절단 검증 통과 13개 · `REDO.md` 조립 재요청 2건 반영 완료)
- 한도 중단: 이미지 생성 할당량 소진 (`HTTP 429 RESOURCE_EXHAUSTED`, 2026-11-25 21:41 KST 확인 기준 남은 시간 4시간 9분 → 리셋 예정: **2026-11-26 01:51 KST** 전후)

## 완료 목록 (13개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 13 | 없음(기본 · **REDO 반영: assembly 하단 사각 배경 투명 제거**) | 통과 (`ready=true`, `issues=0`, 기본 IoU 0.633 / placement 0.517) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 11 (`+gear`) | `arm-hand-near`, `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, IoU 0.424) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 11 (`+gear`) | 없음(판금·미늘창·근접다리 신규, 원거리 다리/부츠 armored T1 규격) | 통과 (`issues=0`, IoU 0.524) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 11 (`+gear`) | 없음(금테 판금·깃털투구·대검 신규, 원거리 다리/부츠 armored T1 규격) | 통과 (`issues=0`, IoU 0.523) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 13 | 없음(기본 · **REDO 반영: `body` 기수 머리 목 위까지 완전 복원**) | 통과 (`ready=true`, 기본 IoU 0.448 / placement 0.722) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.472) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.354) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 12 (`+armor`, `+gear`) | `leg-*-*` 8슬롯 ← `T1` | 통과 (`issues=0`, IoU 0.446) |
| `armored/T1` | `armored-biped.json` | 1.10 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.594) |
| `armored/T2` | `armored-biped.json` | 1.22 | 11 (`+gear`) | `arm-hand-far`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.578) |
| `armored/T3` | `armored-biped.json` | 1.35 | 11 (`+gear`) | `arm-hand-far`, `leg-*` ← `T1` | 통과 (`issues=0`, IoU 0.599) |
| `special/T1` | `special-wheeled.json` | 1.00 | 7 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 2건, IoU 0.497) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.526) |

## 남은 목록 (7개체 · 429 한도 해제 후 재개)

- `armored` (`armored-biped.json`): `T4` (1.50 — 429로 파츠 생성 중단, 원화부터 재개)
- `special` (`special-wheeled.json`): `T2` (1.12), `T3` (1.25), `T4` (1.38)
- 보스: `boss-t2/T2` (`boss-quadruped.json`, 1.80), `boss-t3/T3` (`boss-biped.json`, 2.00), `boss-t4/T4` (`boss-biped.json`, 2.20)

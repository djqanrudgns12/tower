# 숲 엘프 (`elf`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`, `docs/renewal/r6/bible/sheets/monsters-elf.webp`
- 진행률: **20 / 20 완료** (`cut_parts.py` 절단 검증 통과 20개 · 4회차 `REDO.md` `boss-t4/T4` 조립 재분리 및 `runner/T2` 32px 고대비 재작화 반영)

## 완료 목록 (20개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 13 | 없음(기본) | 통과 (`ready=true`, IoU 0.520, 비차단 `speck` 2건) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 11 | `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.848) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 11 | `arm-hand-far` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.884) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 11 | `arm-hand-far` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.815) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 13 | 없음(기본) | 통과 (`ready=true`, `issues=0`, IoU 0.353) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 11 | 없음(**4회차 32px 대비 REDO 완료: 은회·틸 명도 분리, 지형 미만 8.0%**) | 통과 (`issues=0`, 모의 `fitIoU` 0.853) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 11 | 없음(뿔관 표범 사족 11슬롯 일체 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.715) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 11 | 없음(바람표범 사족 11슬롯 일체 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.782) |
| `armored/T1` | `armored-biped.json` | 1.10 | 13 | 없음(기본) | 통과 (`ready=true`, `issues=0`, IoU 0.647) |
| `armored/T2` | `armored-biped.json` | 1.22 | 11 (`+gear`) | `arm-hand-far`, `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.821) |
| `armored/T3` | `armored-biped.json` | 1.35 | 11 (`+armor`) | `arm-hand-far`, `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.905) |
| `armored/T4` | `armored-biped.json` | 1.50 | 12 (`+armor`, `+gear`) | `arm-hand-far`, `leg-*`, `leg-foot-*` ← `T1` | 통과 (`issues=0`, 모의 `fitIoU` 0.784) |
| `special/T1` | `special-flying.json` | 1.00 | 7 | 없음(기본) | 통과 (`ready=true`, `issues=0`, IoU 0.486) |
| `special/T2` | `special-flying.json` | 1.12 | 4 | 없음(이슬 날개정령 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.822) |
| `special/T3` | `special-flying.json` | 1.25 | 5 (`+armor`) | 없음(고리 바람정령 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.744) |
| `special/T4` | `special-flying.json` | 1.38 | 5 (`+armor`) | 없음(숲핵 대정령 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.758) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 13 | 없음(기본 · **4차 REDO 완료: 팔·다리·어깨잎 좌측 가장자리 완전 복원**) | 통과 (`issues=0`, 모의 `fitIoU` 0.759) |
| `boss-t2/T2` | `boss-quadruped.json` | 1.80 | 12 (`+armor`, `+gear`) | 없음(거목 뿌리거인 사족 12슬롯 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.772) |
| `boss-t3/T3` | `boss-biped.json` | 2.00 | 11 (`+armor`) | 없음(바람날개 대정령 6날개 11슬롯 신규) | 통과 (`issues=0`, 모의 `fitIoU` 0.732) |
| `boss-t4/T4` | `boss-quadruped.json` | 2.20 | 11 (`+gear`) | 없음(**4회차 조립 REDO 완료: body·head·leg-fore-near 재분리**) | 통과 (`issues=0`, 모의 `fitIoU` 0.853) |

## 남은 목록

- 없음 (20/20 완료).

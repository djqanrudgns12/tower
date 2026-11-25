# 바위 거인 (`stone`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`
- 진행률: **5 / 20 완료** (`cut_parts.py` 절단 검증 통과 5개)
- 한도 중단: 이미지 생성 할당량 소진 (`HTTP 429 RESOURCE_EXHAUSTED`, 리셋 예정: **2026-11-25 20:51 KST** 전후, 약 4시간 37분 후)

## 완료 목록 (5개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.371) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 10 | 없음(기본) | 통과 (`issues=0`, IoU 0.518) |
| `armored/T1` | `armored-biped.json` | 1.10 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.411) |
| `special/T1` | `special-crystal.json` | 1.00 | 3 | 없음(기본) | 통과 (`issues=0`, IoU 0.535) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 11 (`+gear`) | 없음(기본) | 통과 (`issues=0`, IoU 0.485) |

## 남은 목록 (15개체 · 429 한도 해제 후 재개)

- `infantry`: `T2` (1.05), `T3` (1.15), `T4` (1.28)
- `runner`: `T2` (0.95), `T3` (1.05), `T4` (1.18)
- `armored`: `T2` (1.22), `T3` (1.35), `T4` (1.50)
- `special`: `T2` (1.12), `T3` (1.25), `T4` (1.38)
- 보스: `boss-t2/T2` (1.80), `boss-t3/T3` (2.00), `boss-t4/T4` (2.20)

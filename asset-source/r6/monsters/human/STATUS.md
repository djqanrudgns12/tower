# 철갑 인간 (`human`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`, `docs/renewal/r6/bible/sheets/monsters-human.webp`
- 진행률: **5 / 20 완료** (`parts/` T1 원본을 `<계통>/<단계>/`로 복사 통일, `cut_parts.py` 절단 검증 통과 5개)
- 한도 중단: 이미지 생성 할당량 소진 확인 (`HTTP 429 RESOURCE_EXHAUSTED`, 2026-11-25 20:08 KST 확인 기준 남은 시간 42분 → 리셋 예정: **2026-11-25 20:51 KST** 전후)

## 완료 목록 (5개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 13 | 없음(기본) | 통과 (`ready=true`, `issues=0`, IoU 0.463) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 2건, IoU 0.445) |
| `armored/T1` | `armored-biped.json` | 1.10 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.594) |
| `special/T1` | `special-wheeled.json` | 1.00 | 7 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 2건, IoU 0.497) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 13 | 없음(기본) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.526) |

## 남은 목록 (15개체 · 429 한도 해제 후 재개)

- `infantry` (`infantry-biped.json`): `T2` (1.05), `T3` (1.15), `T4` (1.28)
- `runner` (`runner-quadruped.json`): `T2` (0.95), `T3` (1.05), `T4` (1.18)
- `armored` (`armored-biped.json`): `T2` (1.22), `T3` (1.35), `T4` (1.50)
- `special` (`special-wheeled.json`): `T2` (1.12), `T3` (1.25), `T4` (1.38)
- 보스: `boss-t2/T2` (`boss-quadruped.json`, 1.80), `boss-t3/T3` (`boss-biped.json`, 2.00), `boss-t4/T4` (`boss-biped.json`, 2.20)

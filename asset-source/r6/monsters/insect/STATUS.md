# 군체 벌레 (`insect`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`, `docs/renewal/r6/bible/sheets/monsters-insect.webp`
- 진행률: **5 / 20 완료** (`parts/` T1 원본을 `<계통>/<단계>/`로 복사 통일, `cut_parts.py` 절단 검증 통과 5개 · 3회차 REDO 2건(`infantry/T1`·`boss-t1/T1`) 완료)
- 중단 사유: 이미지 생성 서버 용량 부족 (`HTTP 503 UNAVAILABLE: No capacity available for model gemini-3.1-flash-image`, 2026-11-26 02:02~02:09 KST 3회 연속 실패로 `runner/T1` 재작화·`special` 재설계·남은 15개체 생성 대기)

## 완료 목록 (5개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 13 | 없음(기본 · **3회차 REDO 완료: 전신 기준 `assembly.png` 재조립·흰 점 17px 제거**, 모의 `fit_parts` IoU 0.744/0.818) | 통과 (`ready=true`, `issues=0`) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 13 | 없음(기본 · `REDO.md` 앞다리 배경 제거·날개/가슴 좌측 복원 대기 — 503으로 이미지 생성 대기) | 통과 (`ready=true`, 비차단 `speck` 1건, IoU 0.362) |
| `armored/T1` | `armored-quadruped.json` | 1.10 | 13 | 없음(기본) | 통과 (`ready=true`, `issues=0`, IoU 0.508) |
| `special/T1` | `special-swarm.json` | 1.00 | 14 | 없음(기본 · 재설계 대상) | 통과 (`ready=true`, `issues=0`, IoU 0.549) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 13 | 없음(기본 · **3회차 REDO 완료: `armor` 등날개 어두운 사각 배경 제거·다리/발목 맞물림 재조립**, 모의 `fit_parts` IoU 0.743/0.748) | 통과 (`ready=true`, `issues=0`) |

## 서버 복구 후 우선 처리 및 설계 수정 예정 항목

1. **REDO 잔여 1건 (`REDO.md`)**: `runner/T1`(`leg-fore-near` 배경 제거 + 날개·가슴 좌측 가장자리 복원 — `infantry/T1`·`boss-t1/T1`은 3회차 완료).
2. **`special` T1·T2 윤곽 재설계**: `armored` T1(둥근 검은 갑충)과 실루엣이 비슷하므로 날개를 편 자세나 낮은 원반형처럼 `armored`와 확연히 다른 윤곽으로 다시 잡는다(`special/T1` 시트·조립 포함 재작화).
3. **`special` T3·T4 및 W15 보스(`boss-t3/T3`) 광물화**: 청록 육각 캡슐 묶음이 알 덩어리처럼 보이지 않도록 각진 수정판·장갑판(광물 느낌)으로 다듬는다.
4. **라인업 시트 갱신**: `docs/renewal/r6/bible/sheets/monsters-insect.webp`에서 위 수정 칸만 교체해 갱신한다.

## 남은 목록 (15개체 + REDO 3건 · 429 한도 해제 후 재개)

- `infantry` (`infantry-biped.json`): `T2` (1.05), `T3` (1.15), `T4` (1.28)
- `runner` (`runner-quadruped.json`): `T2` (0.95), `T3` (1.05), `T4` (1.18)
- `armored` (`armored-quadruped.json`): `T2` (1.22), `T3` (1.35), `T4` (1.50)
- `special` (`special-swarm.json`): `T1` (1.00 재설계), `T2` (1.12), `T3` (1.25), `T4` (1.38)
- 보스: `boss-t2/T2` (`boss-quadruped.json`, 1.80), `boss-t3/T3` (`boss-quadruped.json`, 2.00 · 광물 수정판 적용), `boss-t4/T4` (`boss-quadruped.json`, 2.20)

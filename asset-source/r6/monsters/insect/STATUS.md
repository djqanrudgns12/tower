# 군체 벌레 (`insect`) 분해 시트 진행 현황

- 기준: `docs/renewal/r6/PRD-r6.md` §4, `docs/renewal/r6/tech/monster-pipeline.md`, `docs/renewal/r6/bible/monsters.md`, `docs/renewal/r6/bible/sheets/monsters-insect.webp`
- 진행률: **20 / 20 완료** (`infantry` 4/4 · `runner` 4/4 · `armored` 4/4 · `special` 4/4 · `boss` 4/4)
- 3회차 처리:
  - `REDO.md` `## 조립` 잔여 1건 완료: `runner/T1` (`leg-fore-near` 배경 정리 + 날개/가슴 복원, `infantry/T1`·`boss-t1/T1`은 `## 도구로 해결` 분류에 따라 유지)
  - `special` T1·T2 윤곽 재설계(낮은 원반형 비행체) 및 `special` T3·T4·`boss-t3/T3`(W15) 각진 다면체 틸 광물 장갑판 반영
  - `docs/renewal/r6/bible/sheets/monsters-insect.webp` `special` T1~T4·`boss` W15 칸 및 하단 32px 스트립(`특수 T4`·`보스 W15`) 갱신 완료
- 4회차 처리:
  - 잔여 보스 2개체(`boss-t2/T2`, `boss-t4/T4`) 신규 분해 시트·조립 기준판 제작 완료 (`boss-quadruped.json`, 마젠타 배경 완전 제거, `cut_parts.py` 및 `fit_parts.py` 모의 정합 통과)
  - `docs/renewal/r6/bible/sheets/monsters-insect-parts-all.webp` 20/20 한눈판 갱신 완료

## 완료 목록 (20개체)

| 개체 | 안내판 | 배율 | 슬롯 수 | 재사용 부위 | 절단 / 정합 검사 |
|---|---|---:|---:|---|---|
| `infantry/T1` | `infantry-biped.json` | 0.95 | 13 | 없음(기본 · 기존 유지) | 통과 (`ready=true`) |
| `infantry/T2` | `infantry-biped.json` | 1.05 | 11 | `T1` 다리·발·원거리 손 | 통과 (`ready=true`, `fitIoU=0.792`) |
| `infantry/T3` | `infantry-biped.json` | 1.15 | 11 | `T1` 다리·발·원거리 손 | 통과 (`ready=true`, `fitIoU=0.891`) |
| `infantry/T4` | `infantry-biped.json` | 1.28 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.865`) |
| `runner/T1` | `runner-quadruped.json` | 0.85 | 13 | 없음(기본 · **3회차 REDO 완료**) | 통과 (`ready=true`, `fitIoU=0.769`) |
| `runner/T2` | `runner-quadruped.json` | 0.95 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.868`) |
| `runner/T3` | `runner-quadruped.json` | 1.05 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.755`) |
| `runner/T4` | `runner-quadruped.json` | 1.18 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.774`) |
| `armored/T1` | `armored-quadruped.json` | 1.10 | 13 | 없음(기본 · 기존 유지) | 통과 (`ready=true`) |
| `armored/T2` | `armored-quadruped.json` | 1.22 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.930`) |
| `armored/T3` | `armored-quadruped.json` | 1.35 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.855`) |
| `armored/T4` | `armored-quadruped.json` | 1.50 | 11 | 없음(11슬롯 신규) | 통과 (`ready=true`, `fitIoU=0.868`) |
| `special/T1` | `special-swarm.json` | 1.00 | 5 | 없음(**원반형 비행체 재설계**) | 통과 (`ready=true`, `fitIoU=0.784`) |
| `special/T2` | `special-swarm.json` | 1.12 | 6 | 없음(**원반형 쌍날개 재설계**) | 통과 (`ready=true`, `fitIoU=0.742`) |
| `special/T3` | `special-swarm.json` | 1.25 | 6 | 없음(**각진 광물판 반영**) | 통과 (`ready=true`, `fitIoU=0.727`) |
| `special/T4` | `special-swarm.json` | 1.38 | 13 | 없음(**6족+광물판+자충 3기**) | 통과 (`ready=true`, `fitIoU=0.831`) |
| `boss-t1/T1` | `boss-biped.json` | 1.65 | 13 | 없음(기본 · 기존 유지) | 통과 (`ready=true`) |
| `boss-t2/T2` | `boss-quadruped.json` | 1.80 | 11 | 없음(**W10 거대 장수대왕 · 4회차 신규**) | 통과 (`ready=true`, `fitIoU=0.826`) |
| `boss-t3/T3` | `boss-quadruped.json` | 2.00 | 12 | 없음(**W15 광물 장갑판 반영**) | 통과 (`ready=true`, `fitIoU=0.811`) |
| `boss-t4/T4` | `boss-quadruped.json` | 2.20 | 12 | 없음(**W20 황제 헤라클레스갑충 · 4회차 신규**) | 통과 (`ready=true`, `fitIoU=0.792`) |

## 남은 목록

- 없음 (20/20 완료).

## G4 비평 검수 재작화 (`docs/renewal/r6/review/G4-monsters-critique.md` 11항)

- `boss-t1/T1` (비평 11항): 빈약한 왕관 인간형 벌을 폐기하고 설정표 원안의 횡폭이 넓은 비행형 거대 장갑 여왕말벌(4매 무광 날개 `armor`·앰버 줄무늬 대형 복부 `body`·큰턱/틸 겹눈 `head`·톱니 낫 앞다리·이족 13슬롯)로 재작화 (`cut_parts` `issues=0` · 13/13 슬롯, 모의 `fit_parts` IoU `0.729`, 32px 보스-일반 최대 IoU `0.483`, 지형/길 대비 `1.787/1.665`, 흰색·마젠타 잔여 `0/0`).
- `docs/renewal/r6/bible/sheets/monsters-insect-parts-all.webp` 갱신 완료.

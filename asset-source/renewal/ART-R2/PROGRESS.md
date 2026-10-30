# ART-R2 숲 테두리·궁수탑 진화형 결과

담당 Codex. 생성/의미 있는 이미지 수정은 내장 `image_gen.imagegen`. ART-R1 `prepare.py`의 알파·접촉판·타일/길·맵 합성 함수를 복사해 재사용했다.

- 요청11종 모두 자체1차 검수 통과 / **draft**. 총괄 인수와 실제 게임 검수는 별도다.
- 총18회 생성, 항목당 최대3회. 반려 시도7개는 삭제하지 않고 `sources/`와 `rejected/index.json`에 연결했다.
- 프로젝트 납품 및 처리/기록 쓰기는 ART-R2 폴더 안에서만 수행. src/public/docs/패키지 수정, commit/push 없음.

## 납품 파일

- 최종 PNG11장 및 SHA256/규격/기준점: `manifest.json` (상태 모두 draft).
- 최종 프롬프트/재시도 사유: `prompts.json`. 시도별 정확한 프롬프트·참조·원본: `generation-metadata.json`, `logs/*.generation.json`.
- 생성 원본18장: `sources/`. 전체 목록: `file-list.txt`.
- 숲·덤불 64·48·32px + 기존 나무: `contact-sheet-light.png`, `contact-sheet-dark.png`.
- 기본 포함7형태 한 줄, 192·64·48·32px와 받침 합성: `evolution-lineup-light.png`, `evolution-lineup-dark.png`.
- 맵 합성 각1920×1152: `garden_u.preview.empty.png`, `garden_u.preview.towers.png`.
- 배치: `garden_u.layout.json`. ART-R1 지면·길·소품·설치 자리를 계승하고 fallback 기존 나무 대신 새 숲/덤불31개를 수동 배치. 난수·좌우반전·회전·보호영역 알파 마스킹 없음.
- 처리: `prepare.py`; 생성 원본/기록 저장: `save-generation.py`.
- 재현 명령: `uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R2/prepare.py prepare` (또는 `preview`, `verify`).

## 항목

| id | 크기 | 최종 선택 시도 | 상태 |
|---|---|---:|---|
| `edge.forest.0` | 384×384 | 3 | draft |
| `edge.forest.1` | 384×384 | 3 | draft |
| `edge.forest.2` | 384×384 | 1 | draft |
| `edge.hedge.0` | 384×192 | 1 | draft |
| `edge.hedge.1` | 384×192 | 1 | draft |
| `tower.archer.A` | 192×192 | 1 | draft |
| `tower.archer.B` | 192×192 | 1 | draft |
| `tower.archer.A1` | 192×192 | 1 | draft |
| `tower.archer.A2` | 192×192 | 1 | draft |
| `tower.archer.B1` | 192×192 | 2 | draft |
| `tower.archer.B2` | 192×192 | 3 | draft |

## 자체 반려

| 항목 | 시도 | 이유 |
|---|---:|---|
| edge.forest.0 | 1·2 | 잎 명암4단 이상·내부 그라데이션. 3차에서 주요 잎면2단으로 단순화. |
| edge.forest.1 | 1 | 수관 내부 반투명 얼룩5673픽셀. |
| edge.forest.1 | 2 | 수관 얼룩은 해결됐지만 갈색 가지 접합부 핀홀4픽셀(원본7픽셀)이 남음. 3차 편집으로 해결. |
| tower.archer.B1 | 1 | 상징물은 맞지만 넓고 낮은 몸통. 2차에서 좁고 긴 석조 망루로 변경. |
| tower.archer.B2 | 1 | 높은 B 계열 망루 실루엣 불충분. |
| tower.archer.B2 | 2 | 세로형은 맞지만 방패 외곽 없는 원형 원판. 3차에서 방패 문장으로 변경. |

맵 초안 north-bulge-d가 설치 자리를509픽셀 가려 x9→9.5로 이동했다. 알파를 잘라내거나 가림으로 통과시키지 않았다.

## 처리와 검수 경계

- 숲/덤불은 생성 알파 유지·비율 유지 축소·투명 여백만 처리. 강제 팔레트 양자화·색칠로 덮기 없음. 주요 잎면2~3단, 줄기3단 이하로 자체 시각 검수했다.
- 모든 진화형의 기본형 하단 y128..191 RGBA를 그대로 보존. origin=(0.5,0.8125), anchor=(96,156). 본체만, 활 층 없음.
- 라인업 받침 합성은 `slot.pad.0.r1.png` 알파 경계를0.8칸에 맞추고 타워를1.05칸으로 고정했다. **맵 미리보기는 ART-R1의 전체캔버스 기준 받침 배치를 유지**한다. 두 해석의 실제 표시 크기는 다르다.
- 맵 타워 버전은 기존 궁수/포탑/서리3기 + 새 진화형6기를 별도 슬롯에 놓았다. 새 회전 무기층은 제작하지 않았다.
- 첫 완료 검사는 manifest 갱신 명령의 시스템 Python 의존성 누락과 숲1 핀홀을 검출해 실패했다. 지정 uv 환경에서 manifest를 갱신하고, 3차 생성 원본으로 핀홀을 고쳤다. 기준 완화 없음. 최초 결과는 `logs/initial-verification.json`에 보존.
- 최종 검증은 `logs/final-verification.json`. 앱 빌드·e2e·실제 게임/기기는 미실행(앱 코드 변경 없음). 총괄 인수 미실행.
- 작업 중 보호 해시가 달라진 외부 경로: `docs/renewal/progression.md`, `public/assets/manifest.json`, `src/contracts/assetManifest.ts`, `src/game/layers/GroundLayer.ts`. 본 작업에서 쓰지 않았으며 되돌리지 않았다. 최종 검사에 동시 변경으로 따로 기록한다.

## 총괄 확인 사항

1. 단순해진 숲이 기존 나무와 같은 손맛인지, 네 변 숲 밀도가 충분한지.
2. B1/B2의 가는 망루 비율과32px 문장 인식 정도. A1/A2는 톱니/깃털, B1/B2는 매/방패 외곽으로 구별했다.
3. 실제 표시에서 받침 전체캔버스 기준과 알파 경계 기준 중 어느 쪽을 사용할지. 접촉판/맵 차이는 위에 명시했다.

## 최종 실행 결과

- `prepare.py verify`: 통과. assetCount11, sourceCount18, maxAttemptsPerItem3, errors0.
- 최종 숲/덤불5종 내부 반투명 픽셀0, 설치 자리/길 중심 가림0. 타워6종 하단 y128..191 RGBA 기본형과 완전 동일.
- 보호 경로의 동시 변경4개는 최종 로그에 분리 기록. 본 작업 출력 범위 변경 없음.
- 이전 검사 재사용: 변경 없는 출력은 prepare에서 SHA256 키로 재사용. 전체 앱 검사 미실행.

- 최종 시각 확인에서 상단 슬롯(s04)의 A가 화면 위로 잘려 미리보기 A를 내부 슬롯(s17)으로 이동. 진화 타워6기의 배치를 layout.evolvedTowers로 명시하고 실제 알파 경계의 뷰포트 잘림 검사를 추가. 자산/기준점 변경 없음. 원인과 이전 경계는 logs/preview-placement-correction.json.

- 배치 보정 후 최종 verify 재실행: 통과. 타워 뷰포트 잘림0, 기존11종 규격/알파/하단 보존 검사도 통과. 반복 사유는 최종 합성의 잘림 결함 수정 및 검사 추가이며 판정 기준 완화 없음.

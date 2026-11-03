# ART-R2 숲 테두리 재작업 + 궁수탑 진화형 6종 — 요청서

담당: Codex(이미지 생성·처리) · 총괄 검수: Claude · 작업 폴더 `/Users/bodyking/Desktop/vibecoding/tower-wp/RENEWAL`(브랜치 `renewal/hub`)
출력은 `asset-source/renewal/ART-R2/` 안에만 둔다. `src`·`public`·`docs`·패키지 수정, commit, push 금지. 처리·기록 형식은 ART-R1과 같다(prompts.json, sources/, manifest.json(status draft), 접촉판, PROGRESS.md).

## A. 숲 테두리 (ART-R1에서 반려된 것 재작업)

ART-R1 총괄 검수: 24종 draft는 통과했다. 맵이 아직 비어 보이는 가장 큰 이유는 **맵 가장자리를 감싸는 숲 덩이가 없다**는 점이다. 반려 사유였던 "4단 이상 명암"을 고쳐서 다시 만든다.

| id | 크기 | 투명 | 칸 | 설명 |
|---|---|---|---|---|
| edge.forest.0~2 | 384×384 | 예 | 3 | 둥근 나무 2~3그루 + 발치 덤불이 한 덩이로 뭉친 숲 조각. 기존 `public/assets/deco.tree.r1.png`과 같은 나무 손맛·같은 3단 명암. 서로 다른 실루엣 3종 |
| edge.hedge.0~1 | 384×192 | 예 | 3×1.5 | 맵 가장자리를 따라 이어 붙일 낮은 덤불 띠(좌우 끝이 자연스럽게 사라짐) |

- 명암은 3단 이하(밝음·기본·그늘)로 하고, 잎 덩어리는 큰 면으로 쓴다. 잎 한 장 한 장을 그리지 않는다.
- 합성 미리보기를 다시 만든다. ART-R1 `garden_u.layout.json`에 숲·덤불 띠 배치를 추가해 맵 네 변이 숲으로 감싸여 보이게 하되, 설치 자리·길은 가리지 않는다. 빈 버전과 타워 버전 두 장.

## B. 궁수탑 진화형 6종 (본체만)

기준: `docs/renewal/progression.md` §1, `docs/renewal/catalog/towers.md` §0·§3(archer 행)·§3.1, `docs/renewal/art-bible-v2.md` §3.

- 참조: `public/assets/tower.archer.r1.png`(기본형). **받침 재질·발 위치·기준점(192×192, originX 0.5, originY 0.8125)·상부 사선 시점·좌상단 광원을 그대로 유지**하고 윗부분만 진화시킨다. 정면 입면도처럼 그리면 반려한다(시점 불일치).
- 무기(활)는 그리지 않는다. 회전 무기 층은 지금처럼 따로 있다.
- 1차형(Lv4): 회백색 성벽 돌과 청동 테두리로 재료가 한 단계 오른다.
  - `tower.archer.A` 속사: **가로로 넓은** 실루엣. 넓은 지붕, 양쪽 날개 구조물.
  - `tower.archer.B` 정찰: **높고 좁은** 실루엣. 높게 솟은 망루, 황동 망원경 표식.
- 2차형(Lv7): 흰 화강암, 청기와 또는 왕실 지붕, 황동 금장(#E6B84C) 포인트. 꼭대기에 **고유 상징물 1개**를 두고, 색이 아니라 꼭대기 조형으로 구별한다.
  - `tower.archer.A1` 연속 사격(톱니 문장), `tower.archer.A2` 갈래 화살(깃털 날개 문장): A처럼 가로형
  - `tower.archer.B1` 매의 눈(황금 매 풍향계), `tower.archer.B2` 급소 화살(과녁 방패 문장): B처럼 세로형
- 7형태(기본 포함)를 한 줄로 놓은 진화 라인업 접촉판을 만든다. 64·48·32px 축소판과 받침(`asset-source/renewal/ART-R1/slot.pad.0.r1.png`) 위 합성도 포함한다.

## 반려 기준·답장

`docs/renewal/art-bible-v2.md` §5를 스스로 먼저 적용한다. 항목당 시도는 최대 3회다. 끝나면 파일 목록, 접촉판·미리보기 경로, 스스로 반려한 것과 이유, 총괄이 판단할 점을 한국어로 짧게 답한다.

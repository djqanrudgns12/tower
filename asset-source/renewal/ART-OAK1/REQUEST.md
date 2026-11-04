# ART-OAK1 참나무 재질 원화 12장 (R5 P1)

근거: [R5 계획서](../../../docs/renewal/prd-r5-oak-v2.md) §3.1·§6 P1, [아트 기준 v2](../../../docs/renewal/art-bible-v2.md) §5 인수 관문.
생성: Antigravity(image-generator). 처리·검수: Claude(서브에이전트 처리, 총괄 검수). 커밋은 메인 세션만 한다.
작업 범위: 이 폴더(`asset-source/renewal/ART-OAK1/`)와 처리 산출물 `public/assets/ui/oak/*.webp`. `src`·`docs`는 고치지 않는다.

## 목적
화면 전체(홈·전투·모든 창)를 같은 나무 창 재질로 통일한다. 지금은 갈색 CSS 상자가 나무를 흉내 낸다. 틀·판·키를 41번 화풍의 **손으로 그린 재질 원화**로 바꾸고, 글이 놓이는 면만 밝은 단색 양피지로 둔다. 원화는 `border-image`(9-slice)와 타일로 늘려 쓴다.

## 참조 이미지(모든 장에 함께 넣는다)
- `docs/assets/design-41-kingdom-expedition.png` — 세계 화풍(붓 손맛, 따뜻한 좌상단 빛)
- `docs/renewal/qa/landing-baseline/01-home-desk.png` — 지금 홈의 참나무 판·호두나무 머리판 색과 분위기(이 색을 그림으로 옮기는 것이 목표)
- `docs/renewal/qa/pre-r4/02-battle-desk.webp` — 이전 전투 화면의 나무 틀 구성
- `public/assets/ui/icon.coin.png` — 이미 인수한 UI 원화 아이콘의 손맛·외곽선

## 공통 지시(영문 프롬프트에 그대로 넣는다)
Hand-painted 2D game UI material, same painterly style as the reference kingdom illustration. Flat orthographic straight-on front view, no perspective, no tilt, all edges perfectly parallel to the canvas edges. Warm top-left light, 2-3 tone soft cel shading, subtle hand-painted wood grain, clean thin dark-brown outline (#3a291e) only on outer contours. No text, no letters, no numbers, no symbols, no logos, no watermark. No glossy plastic highlights, no sparkles, no glow, no gradient vignette, no noise texture, no photo realism, no 3D render look. Even, calm detail so it can be stretched as a 9-slice UI piece.

색 기준(지금 토큰): 호두나무 테 `#754b2d`·짙은 테 `#38261a`·머리판 `#3b2719`, 참나무 판 `#decba8`·`#cbb289`, 양피지 `#fbf5e8`·`#f6ecd6`·홈 `#efe0c2`, 놋쇠 `#f7c96f`·`#d89b28`·`#7a4c14`, 숲색 `#2e6234`, 붉은 칠 `#a3352b`.

## 목록

| id | 쓰는 곳 | 캔버스 구성 | 내용(영문 프롬프트 핵심) |
|---|---|---|---|
| oak.frame.lg | 화면 바깥 틀, 전장 틀, 홈 머리판 테 | 정사각, 테가 캔버스 끝까지 꽉 참. 테 폭 = 캔버스의 1/8, 네 변 같은 폭. 안쪽은 순백 단색 | Rectangular dark walnut wood picture-frame border filling the whole canvas edge to edge, uniform border width on all four sides, simple mitred corners with a tiny wooden peg at each corner, grain running along each side. Inner area solid pure white #FFFFFF |
| oak.frame.sm | 창(Modal) 테, 카드 묶음 테 | 정사각, 테 폭 = 캔버스의 1/14, 안쪽 순백 | Same walnut frame as oak.frame.lg but slimmer and lighter in detail, uniform thin border, mitred corners, no pegs |
| oak.board | 옆판·문제판 바탕·탭 줄 | 정사각, 테 없이 전면 재질 | Seamless tileable medium-light oak plank board, 4 horizontal planks with thin dark seams, soft even grain, few small knots, colors #decba8 to #cbb289, evenly lit with no light falloff |
| oak.parch | 글 면(카드·창 본문) 가장자리 | 정사각, 종이가 캔버스 전체. 바깥 1/10만 살짝 짙은 낡은 가장자리, 가운데는 거의 단색 | Flat parchment sheet filling the whole canvas, center almost plain flat cream #fbf5e8, only the outer edge slightly darker and gently worn, no tears, no stains, no burn marks in the center |
| oak.groove | 음각 홈(가라앉은 카드·Segmented 바탕·입력칸) | 정사각, 홈이 캔버스 끝까지. 테 폭 1/12 | Rectangular recessed channel carved into oak, seen straight on: inner floor flat tan #efe0c2, carved bevel edge showing depth (darker inner top-left edge, lighter inner bottom-right edge), filling the whole canvas |
| oak.key.brass | 한 화면의 "지금 누를 것"(전투 시작·새 게임 등) | 가로 3:1 둥근 사각 키 하나, 가운데 배치, 순백 배경, 여백 있음 | Single wide rounded-rectangle brass plate key, front view, warm brass #f7c96f with #d89b28 shading, a darker bottom lip about 1/10 of its height showing it is raised, small rivet at each end, plain center for a label |
| oak.key.green | 기본 주 버튼(숲색) | oak.key.brass와 같은 모양·크기 | Same key shape, painted forest-green wood #2e6234, darker green bottom lip, plain center |
| oak.key.parch | 보조 버튼 | 같은 모양·크기 | Same key shape, light cream parchment-covered wooden key #fbf5e8 with oak-colored edge and darker oak bottom lip, plain center |
| oak.key.red | 위험 버튼(기록 지우기 등) | 같은 모양·크기 | Same key shape, red lacquered wood #a3352b with darker bottom lip, plain center |
| oak.badge.brass | 개수 배지·강조 배지 | 가로 2:1 알약 모양 판 하나, 순백 배경 | Small pill-shaped brass plate badge, front view, #f7c96f with #7a4c14 outline, plain center |
| oak.ribbon | 설명서 장 머리띠("제N장 · 제목") | 가로 4:1 띠 하나, 양 끝 접힌 꼬리, 순백 배경 | Horizontal muted crimson cloth banner ribbon #8c3a2e with folded swallow-tail ends, long plain flat center for a title, soft fabric shading only at the folds |
| oak.rule | 창 제목 줄 아래 구분선 | 가로 8:1 가는 선, 순백 배경 | Thin horizontal carved oak divider bar with small rounded brass end caps, plain uniform middle that can be stretched |

## 규칙(Antigravity)
- 항목당 생성 1회. 금지 사항(글자·반짝이·광택·원근·기울어짐·가운데 무늬)이 보이면 그 항목만 1회 다시 만든다.
- 파일은 직접 옮기지 못하므로 **답장에 id별 저장 경로를 표로** 적는다. 재생성 여부도 적는다.

## 처리(Claude, 다음 단계)
- `prepare.py`(ART-UI1을 9-slice용으로 바꿈): 원본은 `sources/`에 보존.
  - 틀·홈·양피지: 테 폭을 측정해 정사각으로 자르고 512px(lg)·256px(sm·홈·양피지)로 줄인다. `border-image-slice` 값을 `manifest.json`에 적는다.
  - 판: 반전 겹침으로 이음새 없는 타일을 만들고 256px로 줄인다.
  - 키·배지·띠·선: 흰 배경을 지우고(가장자리에 이어진 흰색만) 높이 기준 2배 밀도(키 96px, 배지 48px, 띠 96px, 선 24px)로 줄인다. 좌우 끝 보존 폭을 `manifest.json`에 적는다.
- 결과물: `public/assets/ui/oak/<id에서 oak. 뺀 이름>.webp`(예: `frame.lg.webp`), 전체 **400KB 이하**.
- 접촉판: 1366×650 실제 크기 목업(전장 틀 + 옆판 + 문제판 + 창 + 키 4종)과 32/48px 키 줄. 총괄이 이음새·흐림·갈색 폼 느낌을 본다.
- 인수 관문: 아트 기준 v2 §5 + 9-slice 늘렸을 때 이음새·늘어진 무늬가 보이지 않을 것. 실패한 재질은 단색 토큰으로 남기고 다음 묶음에서 다시 만든다.

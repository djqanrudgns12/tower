# ART-OAK2 설명서 5장 그림 · 오답 노트 빈 상태 그림 (R5 P3)

근거: [R5 계획서](../../../docs/renewal/prd-r5-oak-v2.md) §6 P1(ART-OAK2), §5.3 G6, §5.4 O1.
생성: Antigravity(image-generator). 처리·인수: 메인 세션(흰 배경 제거·크기 맞춤). 커밋은 메인 세션만 한다.
예비 2장은 이번에 만들지 않는다(필요해지면 따로 요청).

## 참조 이미지(두 장 모두 함께 넣는다)
- `public/assets/guide/guide.ch1.wave_cycle.png`, `guide.ch3.tower_evolution.png`, `guide.ch4.expedition_command.png` — 설명서 그림의 화풍·외곽선·배치(물건 아이콘을 한 줄로 늘어놓은 그림)
- `docs/assets/design-41-kingdom-expedition.png` — 세계 화풍

## 공통 지시(영문 프롬프트에 그대로 넣는다)
Hand-painted 2D game item illustration in exactly the same style as the reference guide images: chunky friendly shapes, clean dark-brown outline (#3a291e), warm top-left light, 2-3 tone soft cel shading, wood/brass/parchment palette. Objects isolated on a pure white #FFFFFF background with generous margin, no ground shadow plate, no frame, no scene background. No text, no letters, no numbers, no symbols that look like writing, no logos, no watermark, no glow, no sparkles, no gradient vignette, no photo realism.

## 목록

| id | 쓰는 곳 | 캔버스 | 내용(영문 프롬프트 핵심) |
|---|---|---|---|
| guide.ch5.new_features | 설명서 5장 "새로 생긴 것" 머리 그림 | 가로 8:3(예: 1600×600), 물건 5개를 한 줄로 고르게 | Left to right in one row: (1) three small wooden tower cards fanned out, face up with tiny tower pictures; (2) a small open wooden treasure chest with a glowing-free brass relic inside; (3) a brass trophy cup on a wooden stand; (4) an open parchment notebook with a red ribbon bookmark and a quill; (5) a small wooden tower being dragged by a cartoon hand with a curved wooden undo arrow beside it |
| note.empty | 오답 노트 빈 상태 | 가로 4:3(예: 1200×900), 가운데 물건 하나 | A single closed-then-opening parchment notebook lying slightly open on nothing, blank cream pages (#fbf5e8), red ribbon bookmark, a quill pen resting across it, a small sprig of oak leaves, calm and friendly, nothing written on the pages |

## 규칙(Antigravity)
- **셸 명령을 한 번도 쓰지 않는다.** 파일 읽기와 image-generator만 쓴다.
- 항목당 생성 1회. 금지 사항(글자·숫자·반짝이·배경 장면·그림자 판)이 보이면 그 항목만 1회 다시 만든다.
- 파일을 옮기지 못하므로 **답장에 id별 저장 경로를 표로** 적는다. 재생성 여부와 눈으로 본 문제도 적는다.

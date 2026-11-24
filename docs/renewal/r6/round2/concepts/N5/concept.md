# N5 · 네온 페인트 스플래시 팝 (Neon Paint Splash Pop)

> **"다크 옵시디언 배지 위에서 형광 라임·시안·핫 마젠타 물감이 터지는, 5·6학년 취향의 쿨한 스트리트 아케이드 어휘 타워디펜스"**  
> 대상: 초등학교 3~6학년 (특히 5·6학년이 "유치하지 않고 진짜 간지 난다"고 느끼는 스트리트 팝 감성 · 1280×720 가로형 웹/크롬북 기준)

---

## 0. 현재 제작 상태
- **상태**: **`막힘(image-generator HTTP 429, 약 4시간 20분 후 리셋으로 원화 6종 미생성. e-ui-kit.webp와 기획서·프롬프트 먼저 완성)`**
- 완료 산출물:
  - [`e-ui-kit.webp`](e-ui-kit.webp) (소스: [`mock/ui-kit.html`](mock/ui-kit.html))
  - [`concept.md`](concept.md) (본 문서 + 할당량 리셋 즉시 실행용 `6종 × 4안` 24개 원화 프롬프트 완비)
- 미생성 산출물 (리셋 후 생성 예정): `a-battle-bg.webp`, `b-home-bg.webp`, `c-tower-evo.webp`, `d-enemy-pack.webp`, `f1-combo.webp`, `f2-reveal.webp`

---

## 1. 참고 게임 및 매력 원리 (복제 금지 확인)

| 참고 타이틀 | 차용한 핵심 매력 원리 | N5 독창적 재해석 |
|---|---|---|
| **스플래툰 3 (Splatoon 3)** | 다크 아스팔트·배지 대비 위에서 젖어 번들거리는 형광 라임·시안·마젠타 잉크 스플래터, 스트리트 엣지·그래피티 태그 UI | 잉크로 바닥을 점령하는 대신 **타워 공격·정답 콤보가 터질 때마다 전장 길과 UI 테두리에 형광 페인트가 흩뿌려지는 스플래시 피드백**으로 재해석 |
| **포트나이트 (Fortnite)** | 기울어진(`skewX(-8deg)`) 강렬한 아케이드 CTA, 명쾌한 4~5단계 희귀도 색(회·파·보·금/크로마), 쿨한 스킨 진화 감각 | 배틀로얄 총기·스킨을 복제하지 않고, **바이저 페인트 스나이퍼→드래곤 블래스터** 등 오리지널 스트리트 히어로 타워와 학년 태그(`3G`~`6G`) 로비로 변환 |
| **마리오 카트 월드 (Mario Kart World)** | 기울어진 스티커 배지, 탄력 있는 스퀴시-바운스 콤보, 생동감 있는 광택 비닐 토이 하이라이트 | 콤보 게이지가 차오르면 **`피버 스플래시 5콤보!` 액체 웨이브 바**가 차오르며 전장 타워들이 일제히 오버드라이브 탄막을 발사 |
| **블룬스 TD 6 (Bloons TD 6)** | 명확한 잔디/도로 대비와 3단계 이상 외형이 격변하는 캐릭터형 타워, 직관적 설치 패드와 다채로운 투사체 | 원숭이 대신 **스트리트 스케이터·DJ·드론 오리지널 4종 타워**, 풍선 대신 **춤추는 붐박스 오리·스케이트보드 문어푸딩 등 밈 적군 5종** 배치 |

> **복제 금지 확인**: 스플래툰의 인클링/옥토링, 포트나이트의 라마/스킨, 마리오 캐릭터, BTD6의 다트 몽키 등 기존 IP 캐릭터·로고·UI 배치를 일절 복제하지 않았다.

---

## 2. 타워 4종 · 적군 5종 설정

### 아군 타워 4종 (살아 움직이는 스트리트 히어로 · 3단계 외형 격변)
| 타워 | 콘셉트 & 공격 방식 | Lv1 → Lv4 → Lv7 외형 진화 |
|---|---|---|
| **1. 바이저 페인트활 스나이퍼** | 장거리 정밀 단일 저격 · 치명타 잉크 폭발 | **Lv1**: 바이저 페인트활 스나이퍼 → **Lv4**: 듀얼 페인트건 건너(쌍권총+네온 후드) → **Lv7**: 네온 드래곤 블래스터(홀로그램 용 머리 캐논+날개 망토) |
| **2. 트윈노즐 스플래터 포** | 근~중거리 2연발 물감 광역 스플래시 | **Lv1**: 싱글 스트리트 펌프 → **Lv4**: 트윈노즐 스플래터 포(쌍배럴+등짐 잉크 탱크) → **Lv7**: 크로마 하이퍼 캐논(4배럴+무지개 물감 분수) |
| **3. 슬러시 DJ 냉각포탑** | 원형 턴테이블 파동으로 적 이동 속도 둔화 + 얼음 슬러시 | **Lv1**: 포터블 믹서 스탠드 → **Lv4**: 슬러시 DJ 냉각포탑(네온 헤드셋+시안 냉각 드럼) → **Lv7**: 울트라 클럽 서브우퍼(부유 턴테이블+얼음 크리스털 링) |
| **4. 그래피티 드론** | 공중 호버링하며 길목에 지속 페인트 도트 장판 살포 | **Lv1**: 4날개 미니 스프레이 드론 → **Lv4**: 트윈 스프레이 캔 탑재 그래피티 드론 → **Lv7**: 스텔스 네온 스텐실 제트기(홀로그램 날개+레이저 마킹) |

### 웃기고 엉뚱한 적군 5종 (고블린/일반 괴물 금지)
1. **춤추는 붐박스 오리**: 머리에 거대한 네온 카세트 붐박스를 이고 스텝을 밟으며 행진하는 뻔뻔한 흰 오리. 피격 시 음표와 깃털이 튄다.
2. **스케이트보드 문어푸딩**: 투명 말랑 푸딩 문어가 다리 8개로 미니 스케이트보드를 타며 혀를 내밀고 돌진. 빠른 이동 속도의 러시 유닛.
3. **거품 새는 스프레이캔 임프**: 뚜껑이 덜 닫혀 머리 위로 알록달록 페인트 거품을 줄줄 흘리며 낄낄대는 장난꾸러기 깡통 임프.
4. **왕눈이 라바콘 그렘린**: 공사장 주황 라바콘을 갑옷처럼 뒤집어쓰고 구멍 사이로 왕방울눈만 내민 탱커. 콘이 깨지면 머쓱한 표정이 드러난다.
5. **보스 · 무지개 물감 쏘는 그래피티 왕관 고릴라봇**: 황금 왕관과 그래피티 턱받이를 두른 거대 메카 고릴라. 양손 페인트 캐논으로 무지개 물감을 난사하며 등장.

---

## 3. 고유 홈 구도 & 전투 UI 규칙

### 홈 화면 고유 구도: **대각선 스트리트 페스티벌 배너 로비**
- **배경(풀블리드)**: 옥상 스케이트 아레나 위에서 바이저 페인트 스나이퍼와 동료 타워들이 공중 도약하며 형광 물감을 흩뿌리는 풀스크린 일러스트 (`b-home-bg`).
- **좌상단 그래피티 크레스트**: `skewX(-8deg)` 엠블럼과 타이틀, 학년 스트리트 태그(`3G` `4G` `5G` `6G`) 배치.
- **하단 슬릭 가로 바 + 우하단 거대 `배틀 스타트!` CTA**: 하단에 4칸 타워 도감·덱 프리뷰 가로 바를 슬릭하게 걸치고, 우하단에 `skewX(-8deg)` 형광 라임-시안 그라데이션의 거대 `배틀 스타트!` 버튼을 배치해 시선을 단번에 꽂는다. (다른 시안의 좌측 그림+우측 카드, 중앙 단상, 드레스룸과 완전히 다른 대각선 배너 구도)

### 전투 UI 고정 규칙
- **고정 템포 전투 UI**: 어휘 독해·방어 리듬 보호를 위해 템포 변경 버튼 없이 단일 고정 템포로 진행한다.
- **하단 고정 퀴즈 트레이**: 항상 **4지선다 보기(①~④)** + **`모르겠어요` 스트리트 태그 버튼** 5버튼 세트를 유지한다.

---

## 4. 컬러 팔레트 · 타이포그래피 · 손맛 명세

### 컬러 팔레트 (HEX & 대비)
| 역할 | 색상명 | HEX | 대비 및 사용처 |
|---|---|---|---|
| **다크 베이스** | Deep Obsidian | `#121324` | 전체 배지, HUD 패널, 전장 아스팔트 톤 (텍스트 흰색과 대비율 `16.4:1`) |
| **패널 서페이스** | Midnight Slate | `#191B33` / `#1E213D` | 카드·퀴즈 트레이·아이콘 소켓 배경 |
| **외곽선 & 섀도** | Void Ink | `#090A14` | 모든 버튼·카드·아이콘 `3~4px` 아웃라인 및 오프셋 하드 섀도 |
| **메인 액센트** | Neon Lime | `#C8FF00` | `배틀 스타트!` CTA, 정답 하이라이트, 피버 게이지 (`#090A14` 텍스트 대비 `14.8:1`) |
| **서브 액센트** | Electric Cyan | `#00E5FF` | 희귀 등급, 성문 실드(`15/15`), 아레나 네온 라인 |
| **경고 / 에너지** | Hot Magenta | `#FF2A85` | `모르겠어요` 태그, 보스 웨이브 배지, 학년 활성 태그 |
| **골드 / 콤보** | Solar Yellow | `#FFE600` | 잉크 코인(`340G`), `피버 스플래시 5콤보!`, 전설 크라운 |

### 희귀도 4단계 카드 체계
1. **일반 (Common)**: 스틸 그레이 (`#64748B` → `#262B42`) + 스틸 너트 스텐실 배지
2. **희귀 (Rare)**: 네온 시안 스플래터 (`#00E5FF` → `#0066CC`) + 스플래터 애로우 배지
3. **영웅 (Epic)**: 일렉트릭 퍼플 (`#C77DFF` → `#7B2CBF`) + 퍼플 볼트 번개 배지
4. **전설 (Legend)**: 크로매틱 무지개 그라데이션 (`#FF2A85` → `#FFE600` → `#C8FF00` → `#00E5FF`) + 황금 크라운 홀로그램 배지

### 한글 게임 타이포그래피 & 상업 무료 라이선스
| 용도 | 폰트 | 상업 무료 라이선스 | 스타일 규격 |
|---|---|---|---|
| **대형 타이틀 · 콤보 숫자** | `Black Han Sans` | **SIL Open Font License 1.1** (상업·웹·게임 임베드 완전 무료) | `skewX(-6deg)`, `paint-order: stroke fill`, `4px #090A14` 외곽선 |
| **스플래시 버튼 · 배지 · 카드명** | `SBAggroB` (어그로체 Bold) | **샌드박스 네트워크 무료 서체** (개인·기업·게임·영상 등 상업적 이용 무료, 폰트 단독 유료 재판매 금지) | `skewX(-8deg)`, `3~4px #090A14` 외곽선 + 글로시 하이라이트 |
| **4지선다 보기 · 뜻풀이 본문** | `Do Hyeon` | **SIL Open Font License 1.1** (상업·웹·게임 임베드 완전 무료) | 1280×720에서 뭉개짐 없는 높은 가독성 |

### 손맛(Juice) 타이밍 명세 (ms)
- **스플래시 평행사변형 버튼 눌림/복원**: `55ms` 하강(`translateY(+4px)`, 섀도 `6px→2px`) / `95ms` 탄성 복원(`cubic-bezier(.34,1.56,.64,1)`)
- **4지선다 정답 스플래시**: `160ms` 라임 물감 튀김 + 코인 비행(`240ms`) + 전장 타워 크리티컬 이펙트
- **`모르겠어요` 스트리트 태그**: `150ms` 마젠타 스퀴시 + 부담 없는 뜻풀이 네온 툴팁 슬라이드 인
- **피버 5콤보 액체 게이지 오버드라이브**: `380ms` 게이지 풀 차징 + `2000ms` 무지개 물감 탄막 피버
- **전설 크로마 카드 리빌**: `500ms` 스프레이 연막 흔들림 → `220ms` 홀로그램 무지개 광선 폭발

---

## 5. 양산 공정 · 공수 · 위험 관리 & 크롬북 60fps 예산

### 양산 공정 목표 (`타워 20×7=140`, `적 8×12=96`, `맵 4`)
| 구분 | 수량 | 파이프라인 | 예상 공수 |
|---|---|---|---|
| **타워 캐릭터 파츠** | `20종 × 7단계 = 140` | 2.5D 셀 셰이딩 릭 4기(스나이퍼·스플래터·DJ·드론) 기반 모자·바이저·노즐·무기 스왑 렌더 → `cwebp -q 85 -alpha_q 100` | 베이스 릭 3일 + 20종 스왑 7일 (10일) |
| **밈 적군 스프라이트** | `8종 × 12프레임 = 96` | 8종 코믹 바디 × (이동 4f + 피격 4f + 유머 리액션 4f) 아틀라스 패킹 | 원화·모션 5일 + 패킹 2일 (7일) |
| **스트리트 아레나 맵** | `4종` (옥상·스케이트파크·지하철역·네온페스티벌) | 15×9 모듈러 그리드 + 20개 스텐실 타워 패드 + 길목 스플래터 데칼 레이어 | 맵당 1.5일 (6일) |

### 주요 위험 및 대응
1. **다크 배경에서 길목/적군 시인성 저하 위험**: 길목 아스팔트를 `#1E223D` 밝기+형광 시안 경계선으로 분리하고, 모든 적군·투사체에 `3px #090A14` 굵은 외곽선 + 상단 림라이트를 강제한다.
2. **물감 파티클 과다로 인한 프레임 드랍 위험**: 동시 페인트 스플래터 데칼을 링 버퍼(최대 40개)로 제한해 오래된 바닥 얼룩부터 알파 페이드 아웃한다.

### 크롬북(학교 저사양 환경) 60fps 성능 예산
- **해상도 & DPR**: 논리 `1280×720` 고정, `devicePixelRatio` 상한 `1.5` 클램프.
- **아틀라스 & VRAM**: 판당 WebP 텍스처 아틀라스 2장 이하(`2048×2048`), 총 GPU 메모리 `< 46 MB`.
- **드로우 콜 & 풀링**: 동시 적군 35기·물감 파티클 풀 64개 상한. 액체 게이지·스플래시 버튼·아이콘은 CSS/경량 SVG로 처리해 60fps 유지.

---

## 6. 할당량 리셋 시 즉시 실행 가능한 원화 프롬프트 (`6종 × 4안 = 24안`)

> 아래 프롬프트는 `image-generator` HTTP 429 할당량 리셋 직후 바로 호출해 v1~v4를 비교 선별할 수 있도록 구성했다. 모든 프롬프트에 **텍스트 금지, 기존 타사 IP 캐릭터 복제 금지, N5 네온 페인트 스플래시 팝 스타일 통일**이 반영되어 있다.

### 6-1. `a-battle-bg` (1280×720 전장 아레나 배경 + 타워/적군 배치)
- **v1 (옥상 스케이트 아레나 기본형)**: `Top-down 3/4 isometric stylized 2.5D cel-shaded game battleground on a dark obsidian rooftop skatepark arena (#121324), clean wide S-curved asphalt lane bordered with glowing electric cyan (#00E5FF) neon tape, 20 glowing circular stencil tower pads along the roadside, neon graffiti murals on perimeter walls, vibrant lime (#C8FF00) and hot magenta (#FF2A85) wet paint splashes on the path, zero text, zero UI buttons, clear upper and lower margin for HUD, crisp bold black ink outlines`
- **v2 (나이트 스트리트 페스티벌형)**: `3/4 isometric 2.5D stylized arcade tower defense battlefield at a vibrant night street art festival, dark slate-blue asphalt road winding in a clear S-shape, 20 glowing yellow-lime neon placement pads, graffiti speakers and spray-paint cans at road corners, glossy liquid cyan and magenta paint splatters, dramatic rim lighting, no text, no letters, no HUD`
- **v3 (지하철 스트리트 플라자형)**: `Stylized 2.5D toon-shaded tower defense map set in a cool underground urban street plaza, dark navy tiled floor (#151730) with bright neon cyan lane borders, 20 circular spray-stencil tower spots, bright neon skateboard ramps at edges, glossy paint puddles reflecting neon lights, clean readability for gameplay, zero text, no characters from existing games`
- **v4 (하이컨트라스트 아케이드 경기장형)**: `High-contrast 2.5D cel-shaded esports street arena map, deep obsidian floor (#121324) with sharp glowing S-curve paint track, 20 illuminated hexagon-circle tower pads, vibrant lime, cyan, magenta and solar yellow wet ink splashes, top-left castle gate with glowing cyan barrier, clean empty top and bottom UI bands, no text, no numbers`

### 6-2. `b-home-bg` (1280×720 대각선 스트리트 페스티벌 배너 로비 풀블리드)
- **v1 (옥상 도약 스나이퍼 메인)**: `Dynamic low-angle wide 16:9 stylized 2.5D cel-shaded key art, an original cool teen street hero wearing neon visor and hoodie leaping mid-air across a dark obsidian rooftop skatepark (#121324), firing a glowing lime-cyan paint bow, massive glossy wet neon lime (#C8FF00), cyan (#00E5FF), and hot magenta (#FF2A85) paint splashes bursting behind, clean darker space on top-left and bottom-right for UI overlay, zero text, no logos`
- **v2 (4인 스트리트 스쿼드 집결)**: `Wide 16:9 stylized arcade game lobby splash art, 4 original stylized street-pop hero characters (visor paint sniper, twin-nozzle splatter gunner, DJ slushie turret operator, graffiti drone) posing heroically on a glowing rooftop neon stage, explosive liquid rainbow paint swirls in the background, dramatic rim lighting, deep dark-navy edges for UI contrast, zero text, no UI`
- **v3 (네온 페인트 페스티벌 점프)**: `Energetic 16:9 cel-shaded 2.5D rooftop festival illustration, cool anime-arcade style paint-bow archer sliding down a glowing cyan rail while spraying vibrant neon lime and magenta paint ribbons, night city neon skyline in deep indigo bokeh, spacious top-left and bottom areas for banner placement, zero text`
- **v4 (그래피티 아레나 챔피언 포즈)**: `Bold 16:9 street-arcade promotional art, visor-wearing neon dragon-blaster hero standing atop a spray-painted boombox podium, flanked by a tiny hovering graffiti drone, explosive wet glossy paint splatter arc in cyan, lime, and solar yellow against deep obsidian sky, crisp comic ink outlines, zero text`

### 6-3. `c-tower-evo` (타워 3단계 진화 비교: Lv1 → Lv4 → Lv7)
- **v1 (페인트활 스나이퍼 진화 라인)**: `Three-stage character evolution lineup from left to right on a dark obsidian gradient studio background (#121324), crisp 2.5D cel-shaded toy-vinyl style with thick black ink outlines: Left (Lv1) rookie street sniper with neon visor and compact cyan paint bow; Center (Lv4) dual paint-gunner with glowing lime hoodie and twin ink tanks; Right (Lv7) legendary neon dragon blaster hero with holographic dragon-head cannon and chromatic rainbow cape, increasing silhouette size by 35% per tier, zero text`
- **v2 (트윈노즐 스플래터 포 진화 라인)**: `3-tier game tower evolution showcase left-to-right on dark slate backdrop, bold 2.5D cartoon shading: Lv1 cute compact street paint pump operator -> Lv4 twin-nozzle splatter cannon trooper with glowing magenta backpack tank -> Lv7 colossal quad-barrel chroma hyper-cannon mech with golden crown emblem and rainbow ink burst, zero text`
- **v3 (슬러시 DJ 냉각포탑 진화 라인)**: `3-stage tower evolution sheet on clean dark navy studio ground: Lv1 portable mini turntable speaker -> Lv4 cool neon-headset DJ slushie turret spraying icy cyan paint -> Lv7 floating ultra club subwoofer fortress with glowing ice-crystal rings and holographic equalizer, crisp glossy highlights, zero text`
- **v4 (그래피티 드론 진화 라인)**: `3-tier flying street drone tower evolution left-to-right against dark obsidian background: Lv1 small 4-rotor spray-can drone -> Lv4 armored twin-spray graffiti drone with neon lime stencil wing -> Lv7 sleek stealth neon jet-drone with holographic wings and prismatic laser nozzle, bold outlines, zero text`

### 6-4. `d-enemy-pack` (웃긴 적군 5종 캐릭터 팩)
- **v1 (5종 풀라인업 웨이브 시트)**: `Stylized 2.5D cel-shaded funny game enemy character pack arranged in a clean lineup on dark slate studio backdrop (#191B33), thick black outlines and glossy wet paint accents: 1) cocky white duck wearing a giant glowing neon boombox on its head dancing, 2) translucent jelly octopus riding a mini skateboard sticking its tongue out, 3) mischievous spray-can imp leaking colorful paint foam, 4) wide-eyed googly gremlin wearing an orange traffic cone as armor, 5) giant boss gorilla-mech wearing a golden graffiti crown shooting rainbow paint cannons, comical expressive faces, zero text`
- **v2 (동일 5종 액션 포즈 변형)**: `Comical 3D-toon vinyl-toy enemy monster pack on dark navy background, 5 hilarious original meme enemies: dancing boombox duck, skateboarding pudding-octopus, foamy leaking spray-can imp, googly-eyed traffic-cone gremlin, and huge rainbow-paint-shooting graffiti crown gorilla-bot boss, high-saturation neon lime/cyan/magenta highlights, zero text`
- **v3 (정면 3/4 인게임 스탠딩 비율)**: `Game asset turnaround sheet of 5 funny street-pop enemies in 3/4 isometric game view on flat dark obsidian background, crisp comic outlines: boombox-head dancing duck, skateboard octopus pudding, bubbling spray-can imp, traffic-cone googly gremlin, oversized boss gorilla robot with crown and twin paint cannons, vibrant readable silhouettes, zero text`
- **v4 (피격·유머 표정 강조 팩)**: `Expressive stylized cartoon enemy lineup on dark indigo backdrop, exaggerated hilarious expressions (smug duck with boombox, dizzy octopus on skateboard, panicked bubbling spray-can imp, goofy cone-head gremlin, roaring crown gorilla-bot firing rainbow splatter), bright rim lighting, zero text`

### 6-5. `f1-combo` (정답 5콤보 피버 스플래시 VFX)
- **v1 (네온 페인트 폭죽 콤보)**: `Dynamic 16:9 arcade game climax scene VFX, massive radial burst of glossy wet neon lime (#C8FF00), electric cyan (#00E5FF), hot magenta (#FF2A85), and solar yellow (#FFE600) paint splashes, lightning bolts, and glowing gold star coins exploding from center screen over a dark obsidian rooftop arena, cheering visor paint-sniper hero and stunned comic boombox duck flying backward, zero text`
- **v2 (오버드라이브 물감 충격파)**: `Explosive 2.5D cel-shaded combo overdrive visual effect, neon rainbow shockwave ring expanding across a dark street battlefield, glowing lightning arcs connecting 4 stylized street towers firing supercharged paint beams simultaneously, sparkling golden coin shower, extreme energy and motion blur, zero text`
- **v3 (콤보 5단계 히트스톱 섬광)**: `High-impact anime-arcade hit-stop frame, dark obsidian background shattered by vivid cyan and lime diagonal speed lines, giant wet paint splatter crown bursting with star particles and musical notes, street heroes high-fiving while goofy cone gremlins tumble, zero text`
- **v4 (페인트 레인보우 피버 폭발)**: `Stylized 16:9 game fever mode splash art, prismatic paint tornado spiraling upward in the center of a dark neon plaza, launching dozens of glowing gold coins and neon lightning sparks, ultra glossy liquid highlights, bold black outlines, zero text`

### 6-6. `f2-reveal` (전설 크로마 카드/스페셜 팩 개봉 도파민 연출)
- **v1 (스프레이 캔 캡슐 크랙 오픈)**: `Dramatic 16:9 mobile game gacha reveal scene, a glowing giant chromatic rainbow spray-can capsule cracking open mid-air against a deep obsidian vortex (#121324), blinding solar yellow and electric cyan light beams bursting out with swirling wet neon paint ribbons and floating gold crown emblems, zero text`
- **v2 (크로마 홀로그램 카드 언박싱)**: `Explosive 16:9 legendary card reveal visual, a vertical holographic prism card frame glowing in iridescent magenta, yellow, lime, and cyan floating in center, surrounded by rotating neon paint rings, sparkling diamond dust, and spray-paint smoke clouds on dark background, zero text`
- **v3 (골든 크라운 보스 트로피 팝)**: `Arcade reward climax illustration, stylized metallic-rainbow treasure boombox bursting open, shooting out neon paint fireworks, golden crown sparkles, and holographic star badges against a deep indigo radial sunburst background, crisp cel-shaded style, zero text`
- **v4 (네온 드래곤 실루엣 소환)**: `High-contrast 16:9 legendary unlock VFX, silhouette of a neon dragon-blaster weapon emerging from a shattered chromatic prism cube, surrounded by liquid lime-cyan paint splashes and shimmering golden confetti, bold comic shading, zero text`

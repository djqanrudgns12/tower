# N4 · 문방구 히어로즈 대작전 (Stationery Heroes!)

> **"책상 위 필통 성문에서 튀어나온 아크릴·에나멜 문구 영웅들이 4지선다 어휘 마법으로 엉뚱한 숙제·오타 몬스터를 물리치는 탱글탱글 문구 굿즈 타워디펜스"**
> 대상: 초등학교 3~6학년 (주 타깃 5학년 · 1280×720 가로형 웹/크롬북 기준 · 아트 스타일: 아크릴 굿즈/에나멜 핀 풍 2D + Spine 2D)

---

## 현재 상태

- **상태** · **완성**. Codex 내장 `image_generation`으로 원화 6종에 각각 3안씩 총 18안을 생성했다. 6안을 채택하고 12안을 탈락시켰다.
- **화면** · 1280×720 Chromium 캡처, WebP 품질 90. 한글 문구는 HTML에 배치했다.
- **전장** · 15×9 격자에 타워가 놓인 자리 4개와 빈 설치 칸 16개를 표시했다. 타워 받침과 빈 칸 일부는 원화에 있으며, 나머지 설치 칸과 전술 격자는 HTML·CSS로 배치했다.

| 화면 | 목업 | 채택 / 탈락 | 채택 이유 |
|---|---|---|---|
| [전투](a-battle.webp) | [HTML](mock/battle.html) | 3안 중 3번 / 2장 | 구불길에서 적과 아군을 구별하기 쉽고 하단이 비어 있다. |
| [홈](b-home.webp) | [HTML](mock/home.html) | 3안 중 1번 / 2장 | 열린 필통과 출격하는 네 영웅의 얼굴이 읽히고 오른쪽에 시작 버튼이 들어간다. |
| [타워 진화](c-tower-evolution.webp) | [HTML](mock/tower-evo.html) | 3안 중 1번 / 2장 | 활을 유지하면서 목재, 은빛 펜촉, 금촉과 무지개 먹물로 실루엣이 커진다. |
| [적군 도감](d-enemy-pack.webp) | [HTML](mock/enemy-pack.html) | 3안 중 3번 / 2장 | 다섯 표정이 뚜렷하고 안경 쓴 숙제드래곤이 가장 크다. |
| [백점 콤보](f1-dopamine-combo.webp) | [HTML](mock/dopamine-combo.html) | 3안 중 1번 / 2장 | 별도장 아래 하이파이브로 네 영웅이 함께 환호한다. |
| [전설 영웅 공개](f2-dopamine-reveal.webp) | [HTML](mock/dopamine-reveal.html) | 3안 중 1번 / 2장 | 금박 필통과 보라 배경이 영웅 한 명에게 시선을 모은다. |
| [UI 키트](e-ui-kit.webp) | [HTML](mock/ui-kit.html) | 기존 | 딸기 버튼, 흰 칼선, 에나멜 베벨과 마스킹테이프의 기준이다. |

채택 원화 6장은 [목업 원화 폴더](mock/assets/)에 WebP로 담았다. 생성 후보 PNG는 저장소 밖 Codex 생성 폴더에 보관했다. 전설 공개 컷은 진화 도감의 마지막 단계보다 사람 얼굴에 가까워 두 장면을 잇는 캐릭터 형태가 덜 일관적이다. 초등 5학년 대상 반응 검수는 미실행이다.

---

## 1. 참고 게임 및 매력 원리 (복제 금지 원칙 준수)

| 참고 타이틀 | 가져온 핵심 매력 원리 | N4 적용 방식 |
|---|---|---|
| **쿠키런: 킹덤** | 두꺼운 잉크 외곽선(`#2C1E3E`) + 셀 셰이딩 + 광택 하이라이트로 살아 숨 쉬는 탱글탱글한 수집형 영웅 군단과 성문 로비의 활기 | 열린 필통 성에서 영웅 4인방이 뛰쳐나오는 단체 로비 무대(`b-home-bg`), 마스킹테이프·금박 희귀도 4단계 카드, Spine 2D 스쿼시&스트레치 모션 |
| **식물 vs 좀비 (PvZ)** | 일상 사물을 의인화한 유쾌한 아군 방어선 vs 엉뚱하고 우스꽝스러운 표정의 행진형 적군 대비 | 연필·지우개·형광펜·딱풀 아군 타워와 짝짝이 눈 낙서괴물·잉크문어·빨간 X 오타벌레의 명쾌한 코믹 대결 |
| **별의 커비** | 동글동글하고 말랑한 2~2.5등신 비율, 파스텔 원색 + 짙은 볼터치로 호감을 주는 직관적 실루엣 | 딱풀 슬라임 요리사·왕지우개의 모찌형 둥근 실루엣과 한눈에 읽히는 공격/피격 표정 변화 |
| **산리오 문구 굿즈** | 책상 모눈 커팅매트 위 아크릴 키링·에나멜 핀·마스킹테이프·금박 별도장의 "소장하고 싶은 실물 굿즈" 촉감 | UI 전체를 흰 칼선 다이컷 스티커 + 아크릴 3D 베벨 + 스프링 공책 + 마스킹테이프 전시대로 구성 (`e-ui-kit.webp`) |

> **저작권 및 복제 금지 확인**: 쿠키(생강과자), PvZ 식물/좀비, 커비, 산리오 캐릭터의 실루엣·복장·명칭을 일절 차용하지 않고, 오직 초등학생 책상 위 문방구(연필, 지우개, 형광펜, 딱풀, 필통, 노트, 클립)만을 의인화한 오리지널 IP로 설계했다.

---

## 2. 아군 타워 4종 & 엉뚱한 적 5종 설정

### 아군 타워 4종 (문방구 히어로즈)

| 타워 | 역할 & 전투 메커니즘 | 3단 진화 계보 (Lv1 → Lv4 → Lv7) | 시각 포인트 |
|---|---|---|---|
| **1. 연필궁수** | **원거리 단일 저격** — 깎은 연필심 화살을 빠르게 발사해 선두 적을 뚫음 | **지우개모자 연필궁수** → **만년필 기사** (은촉 창·잉크 망토) → **황금 캘리그래피 왕** (금촉 쌍활·왕관·무지개 먹물 화살) | 핑크 지우개 모자와 육각 노란 바디가 진화하며 금속 만년필·황금 붓펜 왕자로 성장 |
| **2. 왕지우개 탱크** | **전선 저지 & 넉백** — 큰 몸집으로 적을 막고 찌꺼기 충격파로 밀어냄 | **새하얀 지우개 견습생** → **파스텔 슬리브 기사** → **무적 지우개 요새** (황금 별방패·방호 헬멧) | 말랑하고 튼튼한 사각 모찌 실루엣 + 파스텔 블루 슬리브 옷 + 별 문양 황금 방패 |
| **3. 형광펜 빔 마법사** | **광역 마법 & 표식** — 형광 빔을 그어 직선·범위 적에게 추가 피해를 입힘 | **네온 사선캡 견습마법사** → **바이올렛 쌍색 형광마도사** → **프리즘 네온 대현자** | 형광 라임 사선 캡, 보라색 바디, 별빛 지팡이에서 뻗는 반짝이는 형광 줄긋기 빔 |
| **4. 딱풀 슬라임 요리사** | **광역 둔화 & 아군 버프** — 끈적 슬라임 풀방울을 뿌려 적 이동을 느리게 하고 아군 공속을 높임 | **민트 딱풀 견습셰프** → **하트 잼 딱풀 파티시에** → **전설 무지개 풀왕 셰프** | 셰프 모자 + 하트 풀국자 + 아래 황금 회전 다이얼, 반짝이는 슬라임 소스 |

### 엉뚱한 적 5종 (오타·숙제 군단)

| 적 몬스터 | 성격 & 행동 콘셉트 | 비주얼 시그니처 |
|---|---|---|
| **1. 짝짝이 눈 낙서괴물** (기본 보병) | 공책 여백에서 막 튀어나온 장난꾸러기 찌그러진 볼펜 낙서 | 크기 다른 짝짝이 왕눈, 삐뚤빼뚤 지그재그 다리, 혀를 내민 익살스러운 표정 |
| **2. 엎질러진 잉크문어** (고속 돌파) | 번지는 먹물을 흩뿌리며 미끄러지듯 빠르게 기어오는 말썽꾸러기 | 잉크병 뚜껑 모자를 쓴 짙은 남보라 문어, 촉수 끝에 파란 잉크 방울 |
| **3. 빨간 X 오타벌레** (분열/다수 웨이브) | 맞춤법을 틀리게 만드는 붉은 색연필 딱정벌레 | 몸통에 선명한 하얀 `X` 문양, 붉은 더듬이, 떼로 몰려다니는 둥근 갑충 |
| **4. 구겨진 종이공 뭉치** (고체력 탱커) | 틀린 시험지를 구겨 뭉쳐 만든 단단한 종이 공 굴림 괴물 | 연필 자국이 남은 구겨진 모눈종이 덩어리, 작은 화난 눈썹과 쿵쿵 구르는 모션 |
| **5. 보스: 선생님 안경 쓴 빨간펜 숙제드래곤** | 웨이브 최종 보스! 거대한 숙제 노트 날개를 펄럭이며 성문을 압박 | 반테 선생님 안경 코에 걸침, 붉은 마커펜 뿔과 꼬리, 시험지 망토, 위엄 있지만 코믹한 표정 |

---

## 3. 고유 홈 구도 설계 (`b-home-bg` & 로비 UX)

- **좌측 단체 무대 (`0~52%` 영역)**: 책상 위 거대 **열린 2단 필통 성문**에서 연필궁수·왕지우개·형광펜법사·딱풀요리사가 환하게 웃으며 앞으로 쏟아져 나오는 생동감 있는 단체 포즈. 배경은 반짝이는 민트/크림 모눈 책상과 포스트잇 언덕.
- **상단 아치형 리본 헤더**: 붉은 딸기 마스킹테이프와 금박 별이 달린 아치형 배너(`문방구 히어로즈 대작전`) + 우측 상단 골드 클립(`280G`)·별도장·학년 공책 인덱스 탭(`3학년`~`6학년`).
- **하단 스티커 독 & 딸기레드 별 CTA**: 하단 중앙~우측에 흰 칼선 아크릴 스티커 독(영웅 도감 / 굿즈 가방 / 퀴즈 연습)과 큼직한 **딸기레드 별 배지형 `방어 시작!` CTA 버튼**을 배치해 좌측 캐릭터들과 겹치지 않으면서 시선이 자연스럽게 출격 버튼으로 모이게 설계.
- **전투 하단 UI 고정 원칙**: 전장 하단에는 항상 **어휘 문제 + 4지선다 스티커 버튼 + `모르겠어요` 안전 버튼** 5버튼 구성으로 고정해 학습 몰입과 디펜스 리듬을 지킨다.

---

## 4. 컬러 팔레트 · 타이포그래피 · 손맛(Juice)

### 컬러 팔레트 (HEX & 명도 대비)

| 역할 | 색상명 | HEX | 대비 및 사용처 |
|---|---|---|---|
| **책상 모눈 바탕** | Mint Desk Cream | `#E3FBF2` / `#FFFDF4` | 메인 배경, 16px/80px 모눈 그리드. `#2C1E3E` 본문과 **대비율 13.8:1 (AAA)** |
| **주 외곽선 & 잉크** | Deep Berry Navy | `#2C1E3E` | 전 UI 3px 테두리, 타이포 스트로크(`paint-order: stroke fill`), SVG 잉크선 |
| **칼선 & 아크릴 광택** | Die-Cut White | `#FFFFFF` | 모든 버튼/스티커/핀 주변 2.5~4px 흰 칼선, 상단 글로시 하이라이트 |
| **메인 CTA & 성문 HP** | Strawberry Enamel | `#FF4D6D` / `#C92348` | `방어 시작!` 버튼, 성문 하트, 빨간 별도장. 흰 글씨+외곽선 대비 선명 |
| **정답 & 아크릴 민트** | Jelly Mint | `#2ED8A7` / `#119D76` | 정답 4지선다 하이라이트, 딱풀요리사 바디 |
| **골드 & `모르겠어요`** | Honey Butter Gold | `#FFD43B` / `#D98E04` | `280G` 골드 클립, `모르겠어요` 버튼, 별 점수, 전설 프레임 |
| **희귀 등급 (스카이)** | Sky Washi Blue | `#5AC8FA` / `#0284C7` | 희귀 등급 마스킹테이프, 왕지우개 슬리브 |
| **영웅 등급 (바이올렛)** | Grape Holo Purple | `#9D6BFF` / `#7C3AED` | 영웅 홀로그램 카드, 필통 성문, 핀 보드 벨벳 배경 |

### 희귀도 4단계 시각 구분
1. **일반 (Common)**: 실버 클립 + 회백 스트라이프 마스킹테이프 (`★☆☆☆`)
2. **희귀 (Rare)**: 스카이 블루 빗금 마스킹테이프 + 맑은 하늘 에나멜 테두리 (`★★☆☆`)
3. **영웅 (Epic)**: 포도 바이올렛 홀로그램 테이프 + 대각선 오로라 반짝임 (`★★★☆`)
4. **전설 (Legendary)**: 골드 금박 3D 프레임 + 무지개 홀로그램 쉬머 + 금박 별 스탬프 + 별 4개 (`★★★★`)

### 한글 게임 글꼴 & 상업 무료 라이선스

| 용도 | 폰트명 | 라이선스 | 적용 스타일 |
|---|---|---|---|
| **제목 · 숫자 · 콤보 · 버튼** | `yg-jalnan` (여기어때 잘난체) | 여기어때 무료 서체 (게임·앱·웹 상업적 사용 및 임베드 허용, 폰트 단독 유료 재판매 금지) | `-webkit-text-stroke: 3~4px #2C1E3E` + `paint-order: stroke fill` + 하단 2px 드롭 섀도 |
| **배너 · 마스코트 타이틀** | `Bagel Fat One` (Google Fonts) | **SIL Open Font License 1.1** (상업·웹폰트·번들 완전 무료) | 둥글고 통통한 장식 타이틀, 영웅/스테이지 배너 |
| **지문 · 4지선다 · 도감 설명** | `Jua` (주아체, Google Fonts) | 우아한형제들 **SIL OFL 1.1** (상업·임베드 완전 무료) | 손글씨 붓펜 감성으로 문구 테마와 일체감, 14px 이상 초등 가독성 최상 |

### 손맛(Juice) 타이밍 명세

| 인터랙션 | 목표 시간 (ms) | 물리 / 시각 피드백 |
|---|---|---|
| **아크릴 스티커 버튼 누름/뗌** | `55ms` 눌림 / `85ms` 복원 | `translateY(+4px)` 압축 + 3D 베벨 하단 두께 `6px → 2px` 감소 + 말랑한 아크릴 "똑딱" 클릭음 |
| **4지선다 정답 스티커 선택** | `160ms` 판정 + `240ms` 비행 | 버튼 `#2ED8A7` 민트 팝업 + 별도장 반짝 스파클 + 골드 클립이 성문 위로 포물선 비행 |
| **`모르겠어요` 뜻풀이 힌트** | `150ms` | 붉은 감점 플래시 없이 부드러운 노란 포스트잇 말풍선으로 핵심 뜻풀이 제시 (재도전 심리 장벽 제거) |
| **5연속 백점 콤보 피버** | `380ms` 인 / `2100ms` 유지 | 화면 상단 `5연속 백점 콤보!` 리본 탄성 바운스 + 필통 성문 앞 영웅 4종 동시 만세 점프 + 금박 별 비 |
| **타워 3단 진화 / 등급 오픈** | `500ms` 쉐이크 → `220ms` 팝 | 마스킹테이프 뜯기는 모션 후 홀로그램 섬광과 함께 진화 아크릴 배지 등장 |

---

## 5. 양산 공정 · 공수 · 위험 관리 & 크롬북 60fps 예산

### 양산 목표 (`타워 20×7=140, 적 8×12=96, 맵 4`)

| 자산 구분 | 목표 물량 | 제작 파이프라인 | 예상 공수 |
|---|---|---|---|
| **아군 타워 파츠** | `20종 × 7부위/단계 = 140` 파츠 | Spine 2D 공통 휴머노이드/문구 릭 2종(이족형·모찌형) 위에서 모자·무기·배지·표정 파츠만 PNG 교체 후 `cwebp -q 85 -alpha_q 100` 패킹 | 릭 2일 + 파츠 20종 8일 (총 10일) |
| **적군 몬스터 시트** | `8종 × 12프레임 = 96` 프레임 | Spine 2D 본 애니메이션(걷기 4·피격 4·스킬/사망 4) 자동 베이크 → 텍스처 아틀라스 WebP | 캐릭터 4일 + 리깅/패킹 3일 (총 7일) |
| **전장 맵 4종** | `맵 4종` (모눈책상·미술도화지·방과후교실·금박시험지성) | 반복 모눈/도화지 타일 베이스 + 모듈형 자/지우개 길목 경계 소품 스왑 | 맵당 1.5일 (총 6일) |

### 주요 위험 및 대응
1. **파스텔 톤 배경과 투사체 혼선 위험**: 바탕 모눈 책상의 채도를 낮춘 파스텔(`#E3FBF2`)로 눌러주고, 모든 아군/적군과 투사체에 `3px #2C1E3E` 외곽선 + `2px #FFFFFF` 칼선 아우라를 강제해 시인성을 분리한다.
2. **한자·특수기호 글리프 누락 위험**: 본 UI 키트 검수에서 `Bagel Fat One`이 한자 글리프를 지원하지 않음을 확인했다. 어휘 퀴즈 및 지문·힌트 카드에는 반드시 한자·한글 모두 완전 지원하는 `Jua` 또는 폴백 폰트를 지정한다.
3. **Spine 본 수 증가로 인한 저사양 CPU 부하**: 타워당 본(Bone) 수 최대 14개, 적군 최대 10개로 상한을 두고 메시 디포메이션 대신 단단한 아크릴 파츠 회전/스케일만 사용한다.

### 크롬북(학교 보급형) 60fps 성능 예산
- **해상도 & DPR**: 논리 `1280×720` 고정, `devicePixelRatio` 최대 `1.5` 제한.
- **아틀라스 & VRAM**: 전장 1판 기준 Spine 아틀라스 WebP `2048×2048` 2장 이하, 배경 1장 포함 총 GPU VRAM `< 42 MB`.
- **드로우 콜 & 파티클**: Spine 배치 드로우로 1판 드로우 콜 `< 65`, 동시 활성 적 최대 35기, 별/스파클 파티클 풀 50개 상한(60fps 미달 시 배경 홀로그램 반짝임 레이어만 자동 오프).

---

## 6. 원화 6종의 생성 프롬프트

아래는 제작에 사용한 6종의 프롬프트 설계안이다. Codex 내장 `image_generation`에서 화면별 구도와 소재를 조합해 각각 3안을 생성했다. 공통 접두어에 좌상단 채광과 화면별 UI 여백을 추가했으며, 전투 후보에는 타워 네 기와 길 위의 적을 함께 요청했다. 표정, 실루엣, 광원, 글자 유무와 UI 주변 여백을 기준으로 선별했다.

### 공통 스타일 접두어 (모든 프롬프트 앞에 동일 결합)
`2D mobile game illustration in the style of glossy acrylic charms and enamel pins, thick clean dark-purple-navy (#2C1E3E) ink outlines, crisp white die-cut sticker rim glow, vibrant pastel mint cream and strawberry coral palette, playful squishy chibi proportions, high clarity, NO text, NO letters, NO numbers, NO watermarks.`

---

### A. 전투 전장 배경 (`a-battle-bg`, 1280×720 가로형)
- **목적**: 상단 좌/우 HUD 여백, 중앙 모눈 책상 위 구불구불한 자·마커 길목, 좌측 큰 열린 필통 성문, 하단 30%는 퀴즈 패널을 가리지 않도록 깔끔한 연민트 책상 여백 유지.
- **v1 (클래식 모눈 책상 + 빨강/노랑 자 길목)**: `[공통 스타일], top-down 3/4 view of a cute pastel mint grid cutting-mat desk battlefield, a winding wooden ruler and masking-tape path from right to left leading to an open lavender pencil-case castle gate on the left, colorful eraser blocks and sticky-note defense pads along the path, bright sunny daylight sparkles, clean empty pastel desk margin at bottom 28% for UI`
- **v2 (미술 도화지 + 물감 튜브 언덕)**: `[공통 스타일], top-down 3/4 view of a cream sketchbook paper battlefield on a mint desk, winding pastel rainbow washi-tape road, adorable pencil-case castle gate with gold zipper crown on the left, 4 empty circular sticker defense pads around the bend, cheerful classroom window sunbeams, uncluttered bottom 28%`
- **v3 (방과 후 스프링 공책 + 연필꽂이 요새)**: `[공통 스타일], 3/4 isometric view of a spiral notebook page battlefield, clean S-curve pathway bordered by colorful paperclips and mini erasers, giant cute castle made of stacked pencil cases and colored pencils on the left, four round glowing sticker tower pads, bright cozy lighting, clean open bottom area`
- **v4 (홀로그램 스티커 보드 + 금박 성문)**: `[공통 스타일], 3/4 view of a glossy pastel desk mat battlefield with subtle grid lines, clean winding path made of yellow sticky notes, glittering acrylic prism pencil-case castle gate on the left, 4 distinct round tower placement stickers, crisp separation between path and grassy sticky-note mounds, empty bottom 28%`

### B. 홈 로비 배경 (`b-home-bg`, 1280×720 가로형)
- **목적**: 좌측(`0~52%`)에 열린 필통 성문 + 4명의 문구 영웅이 쏟아져 나오는 단체 무대, 상단 아치형 리본용 하늘 여백, 우측/하단은 스티커 독 & CTA 버튼용 깔끔한 공간 확보.
- **v1 (대형 열린 필통 성문 점프 포즈)**: `[공통 스타일], wide 16:9 home lobby illustration, on the left half a giant open pastel purple and mint pencil-case castle bursting open with four cheerful chibi stationery heroes jumping forward together: a yellow pencil archer with pink eraser hat, a chubby blue-sleeved eraser tank with gold shield, a purple highlighter wizard with neon lime cap, and a mint glue-stick chef with chef hat; bright cream-mint sunlit sky on the right and top for UI, sparkles and floating gold paperclips`
- **v2 (문방구 아치 아래 4인방 출격 세리머니)**: `[공통 스타일], 16:9 lobby scene, left-centered group dynamic action pose of four stationery heroes celebrating on a pastel sticky-note stage in front of a castle-shaped pencil box, confetti and tiny star stamps bursting behind them, wide clean pastel mint-cream gradient space on the right half and bottom strip for home UI buttons`
- **v3 (아크릴 스탠드 전시대 무대)**: `[공통 스타일], 16:9 lobby illustration, four cute stationery heroes standing proudly on a glossy tiered acrylic display stand on the left side in front of an open zippered pencil-case fortress, rainbow sparkles, clear open cream desk background on the right side for grade tabs and play button`
- **v4 (책상 위 히어로 본부 대집합)**: `[공통 스타일], 16:9 lobby scene, vibrant sunny desk mat, left half features a cute stationery fortress built from erasers, rulers, and a giant open pencil case with all four heroes waving happily, right half kept airy with soft clouds and gentle grid pattern for UI overlay`

### C. 타워 3단 진화 비교 시트 (`c-tower-evo`, 1280×720 가로형)
- **목적**: 연필궁수 계보(지우개모자 연필궁수 → 만년필 기사 → 황금 캘리그래피 왕) 3단계가 좌→우 원형 아크릴 단상 위에서 크기와 화려함이 뚜렷하게 커지는 시트.
- **v1 (연필→만년필→황금 캘리그래피 3단 정면)**: `[공통 스타일], character evolution lineup sheet showing 3 stages left to right on round acrylic bases against a clean pastel mint-cream grid backdrop: Stage 1 tiny cute yellow pencil archer wearing pink eraser hat holding a wooden bow; Stage 2 taller noble fountain-pen knight in silver-blue cape holding a glowing ink lance-bow; Stage 3 grand golden calligraphy-pen king with ruby crown, flowing ink ribbon wings, and radiant rainbow-gold bow, NO text`
- **v2 (역동적 사선 포즈 3단)**: `[공통 스타일], 3-stage character upgrade chart left to right on golden-rimmed circular sticker pedestals, Stage 1 cheerful baby pencil archer, Stage 2 armored fountain-pen ranger leaping, Stage 3 majestic golden brush-pen monarch floating with starry ink aura, clean pastel background, crisp silhouette growth 1x to 1.8x`
- **v3 (에나멜 배지 액자 전시형)**: `[공통 스타일], 3-stage evolution showcase on three pastel enamel badge medallions side by side, showing clear material upgrade from wooden yellow pencil with eraser cap, to glossy metallic navy fountain pen knight, to gleaming 24k gold calligraphy emperor with star stamps`
- **v4 (수직 스파클 진화 트랙)**: `[공통 스타일], horizontal 3-stage hero progression illustration, left small chibi pencil bowman, center medium silver-nibbed fountain pen paladin, right large dazzling golden calligraphy king surrounded by floating gold paperclips and star sparkles, clean soft cream backdrop`

### D. 엉뚱한 적군 5종 팩 (`d-enemy-pack`, 1280×720 가로형)
- **목적**: 낙서괴물, 잉크문어, 빨간 X 오타벌레, 구겨진 종이공 뭉치, 보스 빨간펜 숙제드래곤 5종이 겹치지 않고 나란히 보이는 캐릭터 시트.
- **v1 (일렬 도감 전시형)**: `[공통 스타일], enemy character lineup sheet of 5 funny stationery monsters standing side-by-side without overlapping on a clean cream grid backdrop: 1 goofy scribble doodle blob with mismatched big eyes, 2 mischievous dark-purple spilled ink octopus wearing an ink-bottle cap, 3 round red correction-mark beetle with bold white X on shell, 4 grumpy crumpled graph-paper ball monster, 5 giant boss red-marker homework dragon wearing half-rim teacher glasses and test-paper wings, NO text`
- **v2 (행진 웨이브 포즈)**: `[공통 스타일], 5 quirky comic stationery villains marching from right to left in clear separated poses on a soft mint backdrop: mismatched-eye doodle slime, splattering ink squid, red-X error bug, rolling crumpled paper golem, and towering teacher-glasses red-pen dragon boss flapping notebook wings`
- **v3 (스티커 팩 5종 분리 배치)**: `[공통 스타일], die-cut sticker pack arrangement of 5 distinct funny monsters with thick white sticker borders on a soft lilac mat: silly asymmetric-eye scribble creature, glossy inkwell octopus, crimson X-mark ladybug, cranky crumpled-paper boulder, and comical boss red-pen dragon in teacher spectacles`
- **v4 (표정 강조 2.5등신 시트)**: `[공통 스타일], clean studio turnaround-style lineup of 5 expressive comic stationery enemies, bold dark outlines, exaggerated goofy eyes, clearly showing scale hierarchy from small red-X bug and doodle monster up to huge red-pen homework dragon boss with teacher glasses`

### F1. 5연속 백점 콤보 도파민 연출 (`f1-combo`, 1280×720 가로형)
- **목적**: 중앙 폭죽/선버스트 속에서 문방구 히어로즈 4인이 금박 별도장·무지개 홀로그램 광채를 받으며 점프 하이파이브하는 쾌감 컷신.
- **v1 (금박 별도장 폭죽 하이파이브)**: `[공통 스타일], explosive victory combo illustration, radiant pastel rainbow sunburst background, the four cute stationery heroes (pencil archer, eraser tank, highlighter wizard, glue-stick chef) leaping together in mid-air high-fiving as golden star stamps, gold paperclips, and holographic confetti burst outward, intense joyful energy, clean center-top space for banner`
- **v2 (네온 형광 무지개 피버 빔)**: `[공통 스타일], dynamic anime-chibi fever activation scene, four stationery heroes glowing with golden-rainbow acrylic aura, highlighter wizard shooting neon prism beams into the sky while pencil arrows and star sparkles rain down, super bright celebratory mood`
- **v3 (시험지 백점 도장 대폭발)**: `[공통 스타일], joyful celebration splash art, giant glossy red-and-gold star stamp slamming down in glowing shockwaves surrounded by cheering stationery heroes, flying gold paperclip coins, and pastel confetti on a luminous cream-pink background`
- **v4 (무지개 아크릴 프레임 콤보 컷인)**: `[공통 스타일], full-screen comic-goods fever cut-in, diagonal holographic speed lines behind jumping stationery heroes tossing up gold clips and glowing stars, ultra-saturated strawberry pink, honey gold, and jelly mint palette`

### F2. 전설 문구 영웅/스킨 획득 연출 (`f2-reveal`, 1280×720 가로형)
- **목적**: 무지개 홀로그램 반짝임과 금박 마스킹테이프가 감긴 거대 선물 필통/가챠 캡슐이 열리며 전설 영웅(황금 캘리그래피 왕 또는 딱풀 슬라임 요리사)이 등장하는 도파민 순간.
- **v1 (금박 선물 필통 캡슐 오픈)**: `[공통 스타일], gacha legendary unlock reveal illustration, in the center a dazzling golden-trimmed pastel acrylic gift pencil-box cracking open with a burst of rainbow holographic light and floating gold stars, revealing the triumphant legendary golden calligraphy king and cute glue-stick chef inside glowing sticker rays, dark-violet velvet backdrop with luminous sparkles`
- **v2 (홀로그램 블리스터 팩 개봉)**: `[공통 스타일], dramatic toy-goods unboxing splash art, sparkling rainbow holographic packaging tearing open in the center with golden masking-tape ribbons flying aside, unveiling a glowing 4-star legendary stationery hero surrounded by floating diamond stars and gold paperclips`
- **v3 (왕관 별도장 빛기둥 소환)**: `[공통 스타일], radiant hero summon reveal scene, a towering rainbow prism light beam erupting from a giant golden star stamp pedestal, legendary stationery hero emerging in dynamic sparkly pose, surrounded by shimmering pastel confetti on deep berry-purple background`
- **v4 (무지개 보석 딱풀 왕 등장)**: `[공통 스타일], high-dopamine legendary reward screen background, giant golden-foil wrapped surprise box bursting open into glowing pastel hearts, rainbow stars, and shiny acrylic sparks showcasing a sparkling legendary stationery champion in the center`

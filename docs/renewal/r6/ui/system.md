# R6 UI/UX 디자인 시스템 명세서 (R04 전술 지도 + 전술 UI)

- **단일 기준**: `docs/renewal/r6/PRD-r6.md` §7·§2, `docs/renewal/r6/round3/concepts/R04/concept.md`
- **토큰 구현 파일**: [tokens.css](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/ui/tokens.css), [shared.css](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/ui/shared.css)
- **적용 대상**: 전 화면 13종(홈, 새 게임, 전투 HUD, 타워 상세·강화, 새 타워 해금, 보물 선택, 일시정지, 결과, 오답 노트, 사용 설명서, 환경설정, 랭킹, 교실 QR)

---

## 1. 색상 체계 및 명도 변형 규칙

### 1.1 R04 기본 6색 (무광)
| 이름 | HEX | 역할 |
|---|---|---|
| 카본 블랙 (`--r04-carbon`) | `#12161B` | 주 패널 바탕, 짙은 음영, 앰버/틸 위 텍스트(`--on-accent`) |
| 전술 슬레이트 (`--r04-slate`) | `#1D242C` | 카드 바탕, 전장 지형 기본면 |
| 등고선·그리드 (`--r04-line`) | `#4A5563` | 1px 헤어라인 테두리, 눈금, 구분선 |
| 차분한 은회 (`--r04-silver`) | `#B8C0C8` | 본문 텍스트, 금속 하이라이트 |
| 전술 앰버 (`--r04-amber`) | `#E69F24` | 주 CTA(`새 게임`, `시작`, `강화`), 골드, 무기 진화 미리보기, 연속 정답 보너스 |
| 전술 틸 (`--r04-teal`) | `#2FB5A3` | 성문 방어, 선택 상태, 사거리, 완료/정답 강조 |

### 1.2 명도 변형 · 시맨틱 토큰 (WCAG 2.1 AA ≥ 4.5:1 보장)
어두운 무광 계층은 카본(`#12161B`)을 기준으로 캔버스(`-4%` `#0E1216`), 카드(`+6%` `#1D242C`), 부각 카드(`+12%` `#26303B`)로만 구분하며 블룸/발광(`box-shadow` 글로우)은 쓰지 않는다.

| 구분 | 토큰 | 어두운 기본 | 밝은 화면(`data-theme="light"`) | 대비비(본문 기준) |
|---|---|---|---|---|
| 캔버스 배경 | `--bg-canvas` | `#0E1216` | `#E6EBF0` | — |
| 주 패널 | `--bg-panel` | `#12161B` | `#F4F6F8` | — |
| 카드 면 | `--bg-card` | `#1D242C` | `#FFFFFF` | — |
| 부각/호버 면 | `--bg-elevated` | `#26303B` | `#EBF0F5` | — |
| 1px 테두리 | `--border-hairline` | `#4A5563` | `#4A5563` | — |
| 제목·강조 글자 | `--text-strong` | `#E6ECF2` | `#12161B` | 12.7:1 / 17.8:1 |
| 본문 글자 | `--text-body` | `#B8C0C8` | `#242D37` | 8.2:1 / 13.5:1 |
| 보조·라벨 글자 | `--text-muted` | `#939EAB` | `#4A5563` | 5.8:1 / 6.9:1 |
| 위험·오류 | `--status-danger` | `#F68D84` | `#B83227` | 5.2:1 / 5.8:1 |

### 1.3 교실 프로젝터용 밝은 고대비 문제 패널
전투 화면이 어두운 전술 테마일 때도 **어휘 문제 패널(`.quiz-panel`)은 항상 밝은 고대비 면**을 유지한다. 교실 형광등/프로젝터 반사 환경에서도 흰/밝은 회색 종이 위 진한 카본 글자가 뭉개지지 않게 설계한다.
- 바탕 `--quiz-bg`: `#F2F4F7`, 선택지 카드 `--quiz-card`: `#FFFFFF`, 테두리 `--quiz-border`: `#4A5563`
- 본문 `--quiz-ink`: `#12161B` (17.8:1), 보조 `--quiz-ink-muted`: `#3D4754` (9.2:1)
- 강조: 앰버 `--quiz-amber` `#9A5B00`, 틸 `--quiz-teal` `#0E6E62`, 오답 `--quiz-danger` `#B83227`

---

## 2. 형태 · 선 · 모따기 규칙
- **1px 헤어라인**: 모든 패널·카드·입력칸·구분선은 `1px solid`를 사용한다(두꺼운 3~4px 테두리·나무 액자 9-slice 폐기).
- **45° 모따기(Chamfer)**: 둥근 `border-radius` 대신 좌상단·우하단 45° 대각선 절단(`clip-path: polygon(...)`)을 3단계 크기로 사용한다.
  - `--chamfer-sm: 6px`: 버튼, 작은 카드, 보물 타일, 문제 선택지
  - `--chamfer-md: 10px`: 모달 창, 문제 패널, HUD 바, 타워 상세 패널
  - `--chamfer-lg: 14px`: 대형 전장 미리보기 프레임(필요 시)
- **외곽 1px 선 구현법**: `clip-path`는 CSS `border`를 자르므로, 바깥 래퍼에 `padding: 1px; background: var(--border-hairline); clip-path: ...`를 두고 안쪽 `.c-inner`에 같은 각도의 `clip-path`와 배경색을 채워 45° 빗면까지 끊김 없는 1px 선을 만든다.

---

## 3. 타이포그래피 · 숫자 · 간격
- **글꼴(자체 호스팅 전제 / 시안 CDN)**:
  - 제목·수치·단추: `IBM Plex Sans KR` (`--font-display`)
  - 본문·어휘 문제·설명: `SUIT Variable` (`--font-body`)
- **고정폭 숫자(`.num`)**: `font-variant-numeric: tabular-nums` 필수. 골드, 웨이브, 점수, 순위, 강화 비용, 쿨다운 숫자가 바뀔 때 가로 폭 흔들림을 막는다.
- **글자 크기 4단계** (설정 `보통 1.0×` / `크게 1.12×` / `아주 크게 1.25×` 연동):
  1. `Display` (`28px` / `var(--fs-display)`): 결과 웨이브, 대형 수치
  2. `Heading` (`18px` / `var(--fs-heading)`): 화면·모달 제목, 문제 문장
  3. `Body` (`14px` / `var(--fs-body)`): 일반 본문, 선택지, 버튼
  4. `Caption` (`12px` / `var(--fs-caption)`): 보조 라벨, 태그, 툴팁
- **간격 단위(4px 격자)**: `4 / 8 / 12 / 16 / 20 / 24 / 32px` (`--sp-1` ~ `--sp-8`).

---

## 4. 인터랙션 5상태 규칙
1. **기본(Default)**: `--bg-card` + `--border-hairline` 1px 선.
2. **누름(Pressed)**: 면 명도만 한 단계 낮춤(`--bg-pressed`), `transform: translateY` 흔들림·글로우 금지.
3. **선택(Selected)**: 테두리를 `--accent-teal`로 바꾸고 배경을 `--accent-teal-dim`으로 채우며, 좌측/하단 2px 강조선 또는 `✓` 표식을 병행한다.
4. **비활성(Disabled)**: `opacity: 0.45`, 골드 부족 타워는 가격 텍스트를 `--status-danger`로 바꾸고 아이콘/레이블로 사유를 알린다.
5. **경고(Warning)**: 앰버(`--accent-amber`) 또는 위험(`--status-danger`) 1px 테두리 + 경고 아이콘을 **함께** 배치해 색맹/프로젝터에서도 구별된다.

---

## 5. 선 아이콘 SVG 규칙 (`docs/renewal/r6/ui/icons/`)
- **격자**: `viewBox="0 0 24 24"`, 안전 여백 `2px` (`2..22` 영역 내 작도).
- **선 굵기·끝**: `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="square"`, `stroke-linejoin="miter"` — 45° 모따기 UI와 결을 맞춘 각진 기술 선화.
- **구성 (54종)**:
  - `status/` 8종: `slow`, `stun`, `burn`, `vuln`, `shred`, `knockback`, `haste`, `ward`
  - `traits/` 8종: `armor`, `ward`, `flying`, `swarm`, `fast`, `split`, `regen`, `siege`
  - `relics/` 12종: `arrow_range`, `sky_net`, `big_blast`, `frost_bead`, `hero_blade`, `ember_charm`, `wise_book`, `lucky_pouch`, `trade_seal`, `evolve_stone`, `quick_spring`, `tall_pole`
  - `hud/` 26종: `gate`, `gold`, `wave`, `enemies`, `streak`, `score`, `pause`, `play`, `settings`, `note`, `guide`, `qr`, `upgrade`, `sell`, `lock`, `chest`, `stat-power`, `stat-speed`, `stat-range`, `back`, `close`, `check`, `cross`, `shuffle`, `school`, `edit`

---

## 6. 말투 · 금지선 체크리스트
- 평이한 한국어 해요체/명사형만 사용한다(`기지`, `성문`, `타워`, `적`, `웨이브`, `강화`).
- **금지어**: 군사·판타지 과장어(`수·호`, `출·격`, `징·집`, `작·전·실` 표현)는 전 화면·문서에서 0건 유지.
- **시각 금지**: 배속 버튼 없음, 타워 사람·동물형 없음, 네온 글로우/반짝이/무지개/광택 없음, 피·공포·치비·밈·음식 없음.

# UI 규정 v4 · 「참나무 작전실 v2」 (R5 기준)

상태: **확정(2026-11-04, P0)** · 작성: Claude 서브에이전트(총괄 위임), 총괄 검토 · 근거: [R5 계획서](prd-r5-oak-v2.md) §0·§1·§3·§4·§8, [아트 기준 v2](art-bible-v2.md), [ART-OAK1 요청서](../../asset-source/renewal/ART-OAK1/REQUEST.md)

[UI 규정 v3](ui-rules-v3.md)를 대체한다. 계획서의 결정은 바꾸지 않고 구체화만 한다. P2 세션 K(공용 부품 재질)와 P3 세션 A·B·C(화면)가 이 문서를 구현 기준으로 쓴다. 코드와 이 문서가 다르면 코드를 맞추고, 문서를 바꿔야 하면 메인에 요청한다.

- **홈 예외(v3 §5 예외를 이어받는다).** 홈은 옛 랜딩 캡처 [`qa/landing-baseline/01-home-{desk,cb,phone}.png`](qa/landing-baseline/)와 같은 모습이 기준이다. 비교는 `node tools/qa/scenes.mjs`의 `01-home-*`와 중간 폭 `12f-home-w1100`·`w1180`으로 한다. 홈 자체 CSS의 재질·반경·글자 크기는 기준 캡처를 따르고, 아래만 홈에도 적용한다: 토큰 출처(§2.4), 용어(§6), 글자 3층(§5.3), 13px·44px 하한, 가로 넘침 0, 밀도 상한(§7.1).
- **총괄 결정(2026-11-04, 초안 질문 답):**
  1. 홈 「새 게임」 큰 버튼은 기준 캡처대로 **숲색**으로 둔다(홈 예외). 놋쇠 `primary lg`는 홈 밖 화면의 "지금 누를 것"(새 게임 창 시작·전투 시작·다시 하기·계속)에 쓴다.
  2. 반경 `--r-sm`·`--r-md`는 **4·8px**로 되돌린다. 전환 동안 `tests/e2e/guide.spec.ts` G14 허용 반경은 0/4/8/14/999px(메인이 P0에 넓힘)이고, P3에서 B가 0/4/8/999px로 좁힌다.
  3. `ChoiceCard` 옷 입히기는 P2 동안 K가 맡는다(계획서 §7.1 소유표에 적음).
  4. `tools/qa/lib.mjs` 토큰 밖 색 검사는 `:root`의 hex 토큰 전부를 읽고, `tools/qa/scenes.mjs`는 `--font base|large|xlarge`를 받는다(메인, P0 반영). `<html data-motion>`은 P2에 K가 `src/ui/App.tsx`에 단다.
  5. 전투 바탕 `--bg`가 짙은 호두나무가 되면서 결과·오답 노트·일시정지 바탕도 같이 바뀌는 것은 의도("나무 창으로 통일")에 맞다. P4 눈 관문에서 본다.
- **총괄 결정(2026-11-05, P2 세션 K 보고 답):** 아래는 K가 규정과 다르게 한 곳을 그대로 받아들인 것이다. P3 트랙은 이 결정을 따른다.
  6. **카드 테 = 안쪽 2px 그림자**(`inset 0 0 0 2px`). 화면이 카드 여백을 덮어써서 실제 테두리를 넣으면 수직선 잠금이 깨진다. 카드 여백은 R4 16/12px 그대로 두고 §4.3의 14/10px는 쓰지 않는다.
  7. **키 원화는 버튼 뒤 `::before`**에 그리고, 면 색은 `background-clip: content-box`로 내용 상자에만 깐다. 버튼 상자·여백은 R4와 같다(실제 테두리를 줬을 때 휴대폰 답안 키가 3줄로 꺾여 세로 8px 넘침).
  8. **키 원화는 알약 모양**이라 §3.3 "원화 둥글기와 `--r-*`를 맞춘다"의 예외다. 계산 반경은 4px로 두고, 포커스 링이 알약 둘레에 둥근 사각으로 그려지는 것은 P4 눈 관문에서 다시 본다.
  9. **창 첫 포커스**: 고를 것·입력이 있는 창은 내용 첫 요소(R4 그대로), 읽기만 하는 창(랭킹 전체 보기)은 닫기. kit `Modal`의 `initialFocus: 'content' | 'close'`(기본 `content`)로 고른다.
  10. 창 머리줄은 구분선(`rule` 원화 12px) 칸 때문에 R4보다 4px 높다(64px). 허용한다.
  11. `--frame-lg` 12px은 단색 대체 틀 두께다. `frame.lg` 원화는 표시 폭 24px 이상에서만 쓰고, 그보다 얇은 테는 `frame.sm` 원화를 쓴다(P1 판정).
  12. §7.1 "글자 크기 종류"는 **보통 단계에서 센다**. 크게·아주 크게에서 `--read-step`이 더한 크기는 새 종류로 세지 않는다. 홈 오늘의 낱말 뜻은 기준 캡처대로 `calc(17px + var(--read-step))`, 예문은 `calc(15px + var(--read-step))`.
  13. `board` 원화는 메인이 밝기·대비를 보정했다(`a1e0adb`: 평균을 `--oak-1`로, 결·이음 대비 0.55배, 128px 표시 `--ink` 대비 최소 4.54). 판 위 글은 그래도 `--ink`만 쓴다.
  14. **`--line`(`--oak-2` #cbb289)은 글 바탕이 아니다.** 마우스를 올렸을 때 깔리는 바탕은 kit `ghost`처럼 `--parch-3`를 쓴다(`7685956`: `--ink-2` on `--line` 4.18로 axe 실패 2건). 가는 테·구분선·막대 빈 칸·점에만 쓴다.
- **총괄 결정(2026-11-05, P3 트랙 보고 답):**
  15. 설명서(B): R4 '자세히' 펼침은 없애고 카드의 '자세히 ›'가 그 장 화면(요약 3행 + 시연)을 연다. 타워 상성 카드는 목차에 두고 5장('새 타워와 적 특성')을 연다. 3장 사거리 캔버스는 정지 그림(설명서의 무한 반복은 1장 하나), 2장 결과 순환은 2.4초.
  16. 설명서 버튼 상한(§7.1)은 새 구조 측정값으로 바꾼다: 목차 ≤ 7(장 5 + 상성 + 닫기), 장 화면 ≤ 12(닫기 + 시연 고르기 4~8 + 목차·이전·다음).
  17. 트랙 문구 파일(`src/ui/game/gameCopy.ts`·`src/ui/screens/guide/guideCopy.ts`·`src/ui/screens/home/homeCopy.ts`)은 `copy.ts`로 합치지 않고 화면 폴더에 둔다. `tests/unit/terms.test.ts`가 `src/ui` 전체와 계약의 진화·보물 문구(`d5d623d`)를 검사한다.
  18. 모달이 아닌 화면 창(결과·오답 노트)은 kit `Window`·`Rule`을 쓴다(`93a7ef2`). 틀·구분선 규칙은 kit `Modal`과 한 벌이다.
  19. 진화·보물 문구의 적 고유 이름(예: '국자대장 달그락')과 타워 이름 '수호기사'는 금지어 검사 밖이다. **'수호기사'는 그대로 둔다(2026-11-05 사용자 결정).**
  20. 깃발 진화(2026-11-05, 사용자가 "밸런스를 크게 해치지 않는 선에서" 총괄에 맡김): A2 '승리의 나팔' 공격력 오라를 `[3000, 3200, 3400]` → `[3200, 3300, 3400]`으로 바꿔 A(Lv6 3200)에서 진화할 때 줄지 않게 했다(최고값 3400 그대로, Lv7 +2%p·Lv8 +1%p). B(피해 → 속도)와 B2(속도 31→19% + 공격력 +22%)는 의도된 맞바꿈이라 그대로 두고, 진화 카드의 붉은 감소 칩으로 보인다.
  21. **패널 규격 통일·색인 탭·비겹침(2026-11-05 사용자 승인):** 창 외곽 규격을 `sm` `420px` · `md` `680×540px`(환경설정·전체 랭킹·새 게임) · `lg` `860×580px`(사용 설명서·오답 노트) 3단 고정 프레임으로 잠그고(`≥720×620`에서 고정, 소형 화면은 반응형), 창 상단 주제 전환은 `ModalTabs`(`role="tablist"`, 본문 시트 `ModalTabPanel`과 일체형 연결)로, 창 안의 값 선택은 `Segmented`(`role="radiogroup"`)로 위계를 분리한다. 환경설정은 3탭(`소리` / `화면·조작` / `기록 관리`) + 우측 `348px` 고정 트랙, 사용 설명서는 목차 왕복 없이 1~5장 직행 탭 + 좌우 2단, 오답 노트는 `lg` 공책 창 + 3탭(`전체` / `집중 복습` / `졸업 임박`), 홈 학교 검색은 `sm` 전용 모달로 분리하며, 전투 우측 레일·전장 팝오버·모바일 해설 상자의 요소 덮침을 금지한다.
- 표시: **새로 만듦** = 지금 코드에 없는 이름. 이름을 바꾸려면 메인에 알리고 이 문서를 함께 고친다.

## 1. 방향

- **정체성은 이전, 뼈대는 R4.** 참나무·양피지·놋쇠 재질과 정보가 보이는 구성은 이전 것을, 키캡·카드 전체 버튼·큰 숫자 위계·접근성·하한·키보드 규칙은 R4 것을 쓴다.
- **흉내가 아니라 그림.** 틀·판·키는 41번 화풍 원화(9-slice·타일)로 그린다. 글이 놓이는 면만 단색 양피지다.
- **부품에서 한 번에.** 재질은 `src/ui/kit`과 `global.css`에만 둔다. 화면 CSS는 배치와 기능만 맡고, 색은 토큰으로만 쓴다.
- **v3에서 그대로 두는 규칙:** 글꼴 1종과 굵기(§5.1), 크기 단계 `--fs-1~6`, 간격 `--s1~8`, 44px·13px 하한, 6상태(기본·호버·누름·포커스·비활성·선택), 키캡 버튼을 짙은 바탕에 직접 두지 않는 규칙(§4.9에서 다듬음), 카드 안을 나눌 때 `Card sunk` 한 번만 쓰는 규칙, 한 문장 30자 목표, 움직임 시간(§7.3), `data-content` 표시, 눈 관문, 금지 목록(그라데이션·블러·`text-shadow`·유리·네온·광택·반짝이·이모지, 기능 없는 리본·배너·왕관, 브라우저 기본 라디오·체크박스·select·밑줄 링크 노출).

## 2. 색 토큰

모든 색은 `src/ui/styles/global.css`의 `:root`에서 나온다. 화면·부품 CSS에 hex·rgb를 직접 쓰지 않는다(캔버스 원화·게임 장면 제외). 한 단계 밖 색이 필요하면 메인에 토큰 추가를 요청한다.

### 2.1 재질 팔레트(새로 만듦)

값은 복원한 홈의 옛 토큰(`src/ui/screens/home/home.module.css` `.lobbyRoot`)에서 가져왔다. 숫자가 클수록 짙다. `walnut`·`parch`·`brass` 이름은 `2db26f4`에도 있었으나 값은 이 표가 새로 정한다.

| 토큰 | 값 | 재질 | 쓰는 곳 | 옛 토큰 |
|---|---|---|---|---|
| `--walnut-1` | `#8c5c38` | 호두나무 몰딩 | 머리판 안쪽 테, 틀 몰딩 선. **글자 바탕 금지**(§2.6) | `--oak-plaque-border` |
| `--walnut-2` | `#754b2d` | 호두나무 틀 면 | 화면·전장·창 틀의 대체 단색, 꺼진 스위치 테 | `--oak-frame-outer` |
| `--walnut-3` | `#3b2719` | 호두나무 짙은 면 | 머리판·HUD 판, 키·입력칸 테, 양피지 키 바닥 | `--oak-plaque-bg`(옛 `--oak-frame-edge` `#38261a`·`--edge` `#362419`를 합침, RGB 차 5 이하) |
| `--walnut-4` | `#2b1c11` | 가장 짙음 | 전투·결과·노트 바탕(`--bg`), 머리판 숫자 칸, ChoiceCard 그림 칸 | `--oak-plaque-cell` |
| `--oak-1` | `#decba8` | 참나무 판 밝은 결 | 판 대체 단색, 창 제목 구분선 | `--oak-board-molding` |
| `--oak-2` | `#cbb289` | 참나무 판 짙은 결 | 카드 가는 테, 홈 테, 막대 빈 칸, 구분선 | `--oak-inset-border` |
| `--parch-1` | `#fbf5e8` | 양피지 볼록 | 양피지 키, 고른 칸, 스위치 손잡이, 목록 행, 입력칸, ChoiceCard | `--oak-card-bg` |
| `--parch-2` | `#f6ecd6` | 양피지 면 | 카드·창 본문 면 | `--oak-board-bg` |
| `--parch-3` | `#efe0c2` | 양피지 홈 | `Card sunk`, 고르기 줄 홈, 꺼진 스위치, 비활성 키 | `--oak-inset-bg` |
| `--brass-1` | `#f7c96f` | 놋쇠 밝음 | 짙은 판 위 숫자·강조 글자, 놋쇠 배지 면 | `--oak-plaque-gold` |
| `--brass-2` | `#d89b28` | 놋쇠 면 | 놋쇠 키 면, 강조 면(늘어나는 칸·연속 정답 보너스 켜짐) | `--oak-rank-gold` |
| `--brass-3` | `#7a4c14` | 놋쇠 짙음 | 놋쇠 키 바닥, 놋쇠 배지 테, 밝은 면 위 강조 글자 | `--oak-amber-accent` |

### 2.2 v3 이름 → v4 값

R4 부품과 화면 CSS가 쓰는 v3 이름은 그대로 두고 값만 바꾼다. 그러면 화면 코드를 고치지 않아도 색이 따라온다.

| v3 이름 | v3 값 | v4 값 | 쓰는 곳 |
|---|---|---|---|
| `--bg` | `#1e3020` | `var(--walnut-4)` | 전투 `body[data-screen='battle']`, 결과·오답 노트·정지 바탕 |
| `--paper` | `#fffdf7` | `var(--parch-2)` | 카드·창 면, 전장 위 쪽지·말풍선 |
| `--paper-2` | `#f2ead8` | `var(--parch-3)` | `Card sunk`, 고르기 줄 홈, 비활성 키 |
| `--line` | `#e2d6bc` | `var(--oak-2)` | 가는 테, 구분선, 막대 빈 칸, 발밑 타원 |
| `--ink` | `#2b2118` | 유지 `#2b2118` | 본문 글 |
| `--ink-2` | `#6a5644` | `#574a3f` | 보조 글(옛 `--ink-soft`) |
| `--on-dark` | `#fffdf7` | `#fff6e3` | 짙은 면 위 글(옛 `--oak-plaque-ink`) |
| `--green` | `#277a4b` | `#2e6234` | 숲색 키, 정답, 켜진 스위치(옛 `--oak-cta-green`) |
| `--green-base` | `#1a5434` | `#1c3d21`(새 값) | 숲색 키 바닥 |
| `--amber` | `#f59e0b` | `var(--brass-2)` | 진화 키, 강조 면, 전투 태그 |
| `--amber-base` | `#b45309` | `var(--brass-3)` | 밝은 면 위 강조 글자, 놋쇠 바닥 |
| `--red` | `#c0392b` | `#a3352b` | 붉은 칠 키, 밀랍 배지, 경고 글(옛 `--danger`) |
| `--red-base` | `#8e2a20` | `#6e2018`(새 값) | 붉은 키 바닥, 밀랍 배지 테 |
| `--blue` | `#2563a8` | `#235885` | 밝은 면 위 포커스·선택 링(`2db26f4` 값. 참나무 판 짙은 결 위 대비 2.99 → 3.66) |
| `--scrim` | `rgba(20,14,10,.55)` | `rgba(24, 16, 10, 0.64)` | 창 뒤 막(옛 `.modalScrim` 값) |
| `--float` | `0 6px 20px rgba(…)` | `var(--shadow-board)` | 뜬 카드. 흐림 그림자를 없앤다(§3.4) |
| `--r-sm` | `8px` | `4px` | 키·입력칸·고르기 칸(옛 `--r-input`) |
| `--r-md` | `14px` | `8px` | 카드·창(옛 `--r-panel`) |
| `--fs-*` `--s*` `--touch` `--ease-out` `--t-ui` `--q-font` `--font` | — | 유지 | — |

### 2.3 새 글자·링 토큰(새로 만듦)

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--on-dark-2` | `#dfccb0` | 짙은 판 위 보조 글(옛 `--oak-plaque-muted`). `--walnut-2~4` 위에만 |
| `--focus-on-dark` | `#8fd0ff` | 짙은 면 위 포커스 링(홈에 있던 값을 공식으로) |
| `--ring` | 기본 `var(--blue)` | kit 포커스 링 색. 면을 칠하는 부품이 자기 면에 맞게 다시 정한다: 짙은 면(머리판·`onDark`·전투 바탕)은 `var(--focus-on-dark)`, 밝은 면(양피지·참나무 판)은 `var(--blue)` |

### 2.4 옛 `.lobbyRoot` 토큰 → `global.css`

P2에서 K가 `home.module.css` 맨 위 토큰 블록을 지우고 아래 별칭을 `global.css`에 둔다. 옛 이름은 홈 CSS가 쓰는 별칭으로만 남기고, 새 코드는 §2.1~2.3 이름만 쓴다.

| 옛 이름(값) | v4 정의 |
|---|---|
| `--edge`(`#362419`), `--oak-frame-edge`(`#38261a`), `--oak-plaque-bg`(`#3b2719`) | `var(--walnut-3)` |
| `--oak-plaque-border`·`--oak-frame-outer`·`--oak-plaque-cell` | `var(--walnut-1)`·`var(--walnut-2)`·`var(--walnut-4)` |
| `--oak-board-molding`·`--oak-inset-border` | `var(--oak-1)`·`var(--oak-2)` |
| `--oak-card-bg`·`--oak-board-bg`·`--oak-inset-bg` | `var(--parch-1)`·`var(--parch-2)`·`var(--parch-3)` |
| `--oak-plaque-gold`·`--oak-rank-gold`·`--oak-amber-accent` | `var(--brass-1)`·`var(--brass-2)`·`var(--brass-3)` |
| `--oak-plaque-ink`·`--oak-plaque-muted`·`--ink-soft` | `var(--on-dark)`·`var(--on-dark-2)`·`var(--ink-2)` |
| `--oak-cta-green`·`--danger`·`--focus-on-dark` | `var(--green)`·`var(--red)`·`#8fd0ff` |
| `--oak-cta-green-hover` `#25512a`, `--oak-rank-silver` `#a7b0b8`, `--oak-rank-bronze` `#c98352`, `--oak-world-fallback` `#5d7b41` | 값 그대로(홈 전용: 새 게임 호버, 랭킹 메달, 배경 캔버스 대체) |
| `--r-input` `4px`·`--r-panel` `8px` | `var(--r-sm)`·`var(--r-md)` |
| `--shadow` `0 2px 0 var(--edge)` · `--shadow-board` `0 4px 0 rgba(35, 22, 13, 0.28)` · `--shadow-pressed` `none` | 값 그대로(공식 토큰으로 올림) |

### 2.5 깊이·틀·원화 토큰

| 토큰 | 값 | 비고 |
|---|---|---|
| `--shadow` · `--shadow-board` · `--shadow-pressed` | §2.4 | 작은 칸 2px · 판·창·뜬 카드 4px · 눌림 |
| `--frame-lg` | `12px`(새로 만듦) | 화면 바깥 틀·전장 틀 표시 두께 |
| `--frame-sm` | `8px`(새로 만듦) | 창 테 표시 두께(옛 `ModalShell`의 테 2 + 판 4 + 몰딩 2) |
| `--art-<이름>` | `none` → 인수 뒤 `url('/assets/ui/oak/<이름>.webp')`(새로 만듦) | 원화 12장 각각(§3.2). `none`이면 대체 단색이 그려진다 |

### 2.6 대비(WCAG 상대 휘도로 직접 계산, 2026-11-04)

기준: 본문 4.5:1. 큰 글(24px 이상 또는 19px 굵게)·아이콘·조작 경계·포커스 링 3:1. **굵게** 표시는 기준 미달이다.

글자색 × 면:

| 글 \ 면 | parch-1 | parch-2 | parch-3 | oak-1 | oak-2 | walnut-1 | walnut-2 | walnut-3 | walnut-4 |
|---|---|---|---|---|---|---|---|---|---|
| `--ink` | 14.49 | 13.41 | 12.08 | 9.91 | 7.70 | **2.78** | — | — | — |
| `--ink-2` | 7.87 | 7.28 | 6.56 | 5.38 | **4.18** | — | — | — | — |
| `--red` | 6.23 | 5.77 | 5.19 | **4.26** | **3.31** | — | — | — | — |
| `--green` | 6.64 | 6.14 | 5.53 | 4.54 | **3.53** | — | — | — | — |
| `--brass-3` | 6.73 | 6.23 | 5.61 | 4.60 | **3.58** | — | — | **1.93** | — |
| `--on-dark` | — | — | — | — | — | 5.28 | 6.98 | 13.11 | 15.31 |
| `--on-dark-2` | — | — | — | — | — | **3.62** | 4.79 | 8.99 | 10.50 |
| `--brass-1` | — | — | — | — | — | **3.66** | 4.83 | 9.09 | 10.60 |

키·배지 면의 글자: 숲색 `--green` 위 `--on-dark` 6.71(`--ink` **2.18**), 붉은 칠 `--red` 위 `--on-dark` 6.30(`--ink` **2.33**), 놋쇠 `--brass-2` 위 `--ink` 6.48(`--on-dark` **2.26**), 놋쇠 배지 `--brass-1` 위 `--ink` 10.15.

선·링(3:1):

| 선·링 | 놓이는 면과 대비 |
|---|---|
| `--blue` `#235885` | parch-1 6.89 · parch-2 6.37 · parch-3 5.74 · oak-1 4.71 · oak-2 3.66 · brass-2 3.08 / walnut-2 **1.00** · walnut-3 **1.88** · walnut-4 **2.20** |
| (v3 `--blue` `#2563a8`) | oak-2 **2.99** · walnut-4 **2.69** — 그래서 값을 바꿨다 |
| `--focus-on-dark` | walnut-1 3.41 · walnut-2 4.51 · walnut-3 8.48 · walnut-4 9.89 / 홈 배경 `#5d7b41` **2.89** |
| `--walnut-3`(키·입력칸 테) | parch-1 12.97 · parch-2 12.00 · parch-3 10.81 · brass-2 5.80 |
| `--walnut-2`(꺼진 스위치 테) · `--green`(켜진 스위치) | parch-2 6.39 · parch-3 5.75 · `--green` 6.14 |
| `--brass-2`(놋쇠 키 면) | walnut-4 6.77 / parch-2 **2.07**(경계는 `--walnut-3` 테가 맡는다) |
| `--green`·`--red`(키 면) | walnut-4 **2.28**·**2.43** |
| `--oak-2`(가는 테) | parch-2 **1.74** — 장식 선이다. 이것만으로 조작 요소의 경계를 만들지 않는다 |

미달 쌍에서 나온 규칙:

1. 참나무 판(`--oak-2` 결) 위 작은 글은 `--ink`만 쓴다. `--ink-2`·상태색 글은 양피지 칸 안에 둔다. `--oak-1` 위 붉은 글도 금지.
2. `--walnut-1`은 테·몰딩 전용이다. 글을 올리지 않는다.
3. 짙은 면 위 강조 글은 `--brass-1`, 밝은 면 위 강조 글은 `--brass-3`(= `--amber-base`). 바꿔 쓰지 않는다.
4. 키 글자색은 면으로 정해진다: 숲색·붉은 칠 = `--on-dark`, 놋쇠·양피지 = `--ink`.
5. 짙은 면 위 포커스는 `--focus-on-dark`(`--ring`으로 전환). 홈 배경 캔버스 위에는 조작 요소를 직접 두지 않는다(지금도 판 위에 있다).
6. 숲색·붉은 키는 짙은 바탕(`--walnut-3·4`) 위에 직접 두지 않는다(v3 규칙 유지, §4.9).

## 3. 재질 4단

### 3.1 쓰는 곳

| 재질 | 쓰는 곳 | 그리는 법 | 대체 단색(원화 전) |
|---|---|---|---|
| 호두나무 틀(짙음) | 화면 바깥 틀, 전장 틀(B1), 머리판·HUD 판, 창 테 | `frame.lg`·`frame.sm` 9-slice | 틀 `--walnut-2`, 머리판 면 `--walnut-3` + 몰딩 `--walnut-1` |
| 참나무 판(중간) | 옆판(타워 칸·상황 카드), 하단 문제판 바탕, 탭 줄 | `board` 타일 | `--oak-1` |
| 양피지 면(밝음) | 글·문제·보기·카드 본문 | 단색 면 + 가장자리만 `parch`·`groove` 9-slice | 면 `--parch-1~3`, 테 2px `--oak-2` |
| 놋쇠 | 한 화면의 "지금 누를 것" 하나, 진화 키, 강조 배지 | `key.brass`·`badge.brass` + 단색 글자 `--ink` | 면 `--brass-2`(배지 `--brass-1`) |

### 3.2 원화 파일(ART-OAK1, `public/assets/ui/oak/<이름>.webp`)

파일 이름은 요청서의 id에서 `oak.`을 뺀 것이다. 원본은 2배 밀도이고, 처리 단계가 `border-image-slice` 값과 끝 보존 폭을 `manifest.json`에 적는다(요청서 「처리」). 아래 slice 어림값은 요청서의 캔버스 비율에서 나온 것이며, CSS에는 manifest 측정값을 그대로 쓴다.

| 파일 | 원본 | 그리는 법 | slice(어림) | 표시 두께 | 쓰는 부품 |
|---|---|---|---|---|---|
| `frame.lg` | 512² | `border-image`, `fill` 없음 | 테 폭 = 1/8 ≈ 64 | `--frame-lg` 12px | 화면·전장 틀(A), 홈 머리판 테(C) |
| `frame.sm` | 256² | 같음 | 1/14 ≈ 18 | `--frame-sm` 8px | `Modal`, 카드 묶음 |
| `board` | 256² 타일 | `background-image` 반복, `background-size: 128px` | — | — | `Card material="board"`, 탭 줄 |
| `parch` | 256² | `border-image`, `fill` 없음(가운데는 단색 면) | 가장자리 1/10 ≈ 26 | 6px | `Card`(양피지) |
| `groove` | 256² | 같음 | 1/12 ≈ 21 | 4px | `Card sunk`, `Segmented` 홈, 꺼진 `Toggle` |
| `key.brass`·`key.green`·`key.parch`·`key.red` | 높이 96(3:1) | `border-image` + `fill`, `stretch` | 위 = 테, 아래 = 테 + 바닥 입술(높이 1/10), 좌우 = 끝 보존 폭(리벳 포함) | slice ÷ 2 | `Button` 변형별(§4.1) |
| `badge.brass` | 높이 48(2:1) | `border-image` + `fill` | 좌우 = 높이의 1/2(둥근 끝) | 높이 20px에 비례 | `Badge` 놋쇠 |
| `ribbon` | 높이 96(4:1) | `border-image` + `fill` | 좌우 = 꼬리 폭 | 높이에 비례 | 설명서 장 머리띠(G8)만. 대체 `--red` 면 + `--on-dark` 글(6.30) |
| `rule` | 높이 24(8:1) | `border-image` + `fill`, 위아래 0 | 좌우 = 놋쇠 끝마개 폭 | 높이 12px | `Modal` 제목 줄 아래. 대체 2px `--oak-1` 선 |

### 3.3 `border-image` 규칙

- **slice 정하는 법:** 원본에서 늘려도 무늬가 티 나지 않는 띠가 시작하는 곳까지가 slice다. 네 변이 같은 틀은 한 값을 쓴다. 키·배지는 좌우 끝(리벳·둥근 끝)을 통째로 slice에 넣는다. 값은 manifest 측정값만 쓰고 어림하지 않는다.
- **선명도:** 표시 두께 ≤ slice ÷ 2(2배 밀도 이상). 키·배지는 `border-image-width`를 slice × (표시 높이 ÷ 원본 높이)로 준다.
- **반복:** 기본 `stretch`. 접촉판에서 결이 늘어져 보이면 그 파일만 `round`로 바꾸고 manifest에 적는다.
- **전환:** 부품 CSS는 `border: <두께> solid <대체 색>`과 `border-image: var(--art-<이름>) <slice> / <표시 두께> stretch`를 함께 둔다. `--art-<이름>`이 `none`이면 단색 테가, url이면 원화가 그려진다. 원화 인수는 `global.css`의 토큰 한 줄만 바꾼다.
- **주의:** `border-style: none`이나 `border-width: 0`이면 원화를 그리지 않는 브라우저가 있다. 테는 늘 `solid`·1px 이상으로 둔다. K는 첫 부품에서 Chromium과 Safari 둘 다 그려지는지 확인한다. `border-image`는 `border-radius`로 잘리지 않으므로 원화 모서리 둥글기와 `--r-*`를 맞춘다(바닥 그림자·포커스 링은 `border-radius` 모양을 따른다).
- **무게:** 원화 12장 합계 400KB(409,600바이트) 이하, 9-slice 한 장은 512px 이하.

### 3.4 깊이

- 깊이는 원화 질감과 **흐림 0의 단단한 바닥 그림자**로만 낸다. 바닥 두께는 `0`(눌림) · `2px`(작은 칸·고른 칸·손잡이) · `4px`(키·카드·판, 기본) · `6px`(뜬 상태: 정답 키 B10, ChoiceCard 호버·포커스) 네 단계만 쓴다.
- 한 요소의 그림자는 바깥 바닥 1개 + 안쪽 테 대용(`inset`, 펼침만, 흐림 0) 1개까지.
- 그라데이션(`linear-`·`radial-`·`conic-gradient`), `backdrop-filter`, `filter: blur`, `text-shadow`는 0이다(v3 유지). 호버의 `filter: brightness(1.06)`만 허용한다.

### 3.5 상자 크기 불변

- 재질을 입혀도 부품의 바깥 크기(`border-box`)와 내용 상자 위치는 R4 그대로다. 테를 그리면 **그 두께만큼 안쪽 여백을 줄인다**(예: 문제판 오른쪽 테 2px + 여백 14px = 16px).
- 원화의 표시 두께가 테보다 두꺼우면 `border-image-width`로만 늘린다(배치에 영향 없음).
- 하단 문제판은 `layout-v3.test.ts`의 `SEAM_INSET_PX = 16`과 `QuestionPanel.module.css` `.panel.seam`의 `- 16px`에 묶여 있다. 테+여백 합 16px를 바꾸지 않는다. 바꿔야 하면 A가 메인에 요청한다.
- 전장 틀(B1, `--frame-lg`)이 바깥 여백을 바꾸면 A는 레이아웃 계약(`docs/contracts/product.defaults.v0.5.json` `layout`)과 `layout.spec.ts`(메인 소유) 변경을 메인에 요청한다.

## 4. 부품

R4 구조는 바꾸지 않는다: 크기(`md` 44px·`lg` 56px, 아이콘 버튼 44×44), 포커스 링 3px, 첫 포커스 = 내용 첫 요소, 포커스 가둠·Esc·연 버튼으로 복귀, `Segmented`의 방향키·Home·End와 막힌 칸 건너뛰기, `aria-disabled` + 이유 줄, 카드 전체가 버튼인 ChoiceCard. 아래는 옷(면·테·바닥·상태색)만 정한다.

### 4.0 공통 상태

| 상태 | 규칙 |
|---|---|
| 호버(`hover: hover` 기기만) | `filter: brightness(1.06)`(R4 유지) |
| 누름 | `translateY(<바닥>)` + 바닥 0(R4 유지). **문제판 안은 transform 금지**(§7.4) → 바닥만 0 |
| 포커스 | `outline: 3px solid var(--ring)`, `outline-offset: 3px`(고르기 칸은 1px, R4 유지) |
| 비활성(`disabled`·`aria-disabled`) | 원화를 끄고 면 `--parch-3`, 테 2px `--oak-2`, 글 `--ink-2`, 바닥 0, `opacity: 0.6`. 눌러도 움직이지 않는다 |
| 선택 | 테 2px `--walnut-3` 또는 링 3px `--blue` — 색만이 아니라 테 모양으로도 구별 |

### 4.1 `Button`

| 변형·크기 | 면 | 테 | 바닥 | 글 | 원화 | 쓰는 곳 |
|---|---|---|---|---|---|---|
| `primary` `md` | `--green` | 2px `--walnut-3` | 4px `--green-base` | `--on-dark` 16px 700 | `key.green` | 다음 문제, 강화 |
| `primary` `lg` | `--brass-2` | 2px `--walnut-3` | 4px `--brass-3` | `--ink` 20px 800 | `key.brass` | **화면당 1개**인 "지금 누를 것": 전투 시작, 새 게임 창 시작, 다시 하기, 계속 |
| `accent` | `--brass-2` | 2px `--walnut-3` | 4px `--brass-3` | `--ink` | `key.brass` | 진화(타워 도구 묶음 안에서만) |
| `danger` | `--red` | 2px `--walnut-3` | 4px `--red-base` | `--on-dark` | `key.red` | 판매, 끝내기, 기록 지우기 |
| `secondary` | `--parch-1` | 2px `--walnut-3` | 4px `--walnut-3` | `--ink` | `key.parch` | 보조, 답안 키, 휴대폰 '모르겠어요' |
| `ghost` | 투명 | 없음 | 없음 | `--ink`(`onDark`면 `--on-dark`) | — | 글자만. 호버 면 `--parch-3` |

- 놋쇠는 계획서대로 "한 화면의 지금 누를 것"이다. v3의 "`primary lg`는 화면당 하나" 규칙에 맞춰 **`primary`+`lg`를 놋쇠로 그린다**(화면 코드 변경 없음). 놋쇠 `lg`가 둘 보이면 반려한다.
- 반경 `--r-sm`(4px). 안쪽 여백은 R4 값에서 테 2px를 뺀다(`md` 0 14px, `lg` 0 22px).

### 4.2 `IconButton`

- 옛 머리판 단추 모양: 양피지 키(`secondary`) + 아이콘 24px(`currentColor`, `src/ui/icons/ControlIcons.tsx` 한 세트).
- 글자를 함께 보이는 선택(새로 만듦, 이름 제안 `showLabel`): 아이콘 + 16px 700 글자, 너비 자동(최소 44px), 여백 0 10px. 머리판·창 머리처럼 자리가 있는 곳에서 쓴다. 전투 HUD는 아이콘만(R4).
- 개수 배지는 놋쇠 `Badge`(§4.6), 자리는 오른쪽 위 −6px(R4).
- 짙은 바탕에 직접 둘 때는 양피지 키 그대로(머리판 단추) 또는 `ghost` + `onDark`. 둘 다 `--ring`은 `--focus-on-dark`.

### 4.3 `Card`

| 종류 | 면 | 테 | 바닥 | 원화 | 글 |
|---|---|---|---|---|---|
| 기본(양피지) | `--paper`(= `--parch-2`) | 2px `--oak-2` | 없음 | `parch` 가장자리 6px | `--ink`·`--ink-2` |
| `float` | 같음 | 같음 | `--shadow-board` | 같음 | 같음 |
| `sunk`(음각 홈) | `--paper-2`(= `--parch-3`) | 2px `--oak-2` | 없음 | `groove` 4px | `--ink`·`--ink-2` |
| 판 재질 선택(새로 만듦, 제안 `material="board"`) | `--oak-1` + `--art-board` 타일 | 2px `--walnut-2` | 없음 | `board` | **`--ink`만**(§2.6 규칙 1) |
| 머리판 재질 선택(새로 만듦, 제안 `material="plaque"`) | `--walnut-3` | 2px `--walnut-1` | `--shadow-board` | `frame.lg` 테 | `--on-dark`·`--on-dark-2`, 강조 숫자 `--brass-1`, `--ring: var(--focus-on-dark)` |

- 반경 `--r-md`(8px). 여백 `md` 14px·`sm` 10px(R4 16·12에서 테 2px를 뺌), `none` 0.
- 재질 겹은 틀 > 판 > 양피지 면 > 내용, 최대 3겹이다. 양피지 면 안을 나눌 때는 `Card sunk`를 한 번만 쓴다(v3 유지).
- 판 재질과 머리판 재질은 옆판·문제판 바탕·탭 줄(판), 머리판·HUD(머리판)에만 쓴다. 쓰는 곳 배치는 A·C가 정한다.

### 4.4 `Segmented`·`Toggle`

| 부분 | 규칙 |
|---|---|
| `Segmented` 홈 | 면 `--paper-2`, 테 2px `--oak-2`(원화 `groove`), 안쪽 여백 2px(R4 4px − 테 2px), 반경 `--r-sm` |
| 칸(고르지 않음) | 투명, 글 `--ink-2` 16px 700(parch-3 위 6.56). 호버면 글 `--ink` |
| 고른 칸 | 면 `--parch-1`, 테 2px `--walnut-3`, 바닥 2px `--walnut-3`, 글 `--ink`. 고른 것은 테로도 구별된다(대비 10.81) |
| 막힌 칸 | `aria-disabled`, `opacity: 0.55`, 누르면 `onBlocked` 이유 한 줄(R4) |
| `Toggle` 트랙 | 52×30(R4). 꺼짐: 면 `--parch-3`, 테 2px `--walnut-2`. 켜짐: 면 `--green`, 테 2px `--walnut-3` |
| `Toggle` 손잡이 | 면 `--parch-1`, 테 2px `--walnut-3`, 바닥 2px `--walnut-3`. 켜면 오른쪽으로 간다(문제판 밖이라 transform 허용) |
| `Toggle` 상태 글자 | 이름 뒤에 '켜짐'·'꺼짐' 13px 700 `--ink-2`. `aria-hidden="true"`(스위치의 `aria-checked`가 이미 읽히므로 두 번 읽지 않게) |

### 4.5 `Stat`

- 아이콘 + 숫자 + 작은 이름(R4). 숫자는 Pretendard 800 + `tabular-nums`(표시용 굵은 글꼴, §5.1). `md` 16px·`lg` 24px(R4).
- 이름: 밝은 면 13px 700 `--ink-2`, 짙은 판 `--on-dark-2`. 숫자 색은 부모를 따른다. 골드·점수처럼 강조할 숫자만 밝은 면 `--brass-3`, 짙은 판 `--brass-1`.

### 4.6 `Badge`

| 종류 | 면 | 테 | 글 | 쓰는 곳 |
|---|---|---|---|---|
| 놋쇠(기본) | `--brass-1`(원화 `badge.brass`) | 1px `--brass-3` | `--ink` 13px 800 | 개수(오답 노트·`IconButton`), 새 기록, 복습(B4) |
| 밀랍(새로 만듦, 제안 `tone="wax"`) | `--red` | 1px `--red-base` | `--on-dark` 13px 800 | 경고: 보스 웨이브, 대응 공백 |

- 높이 20px, 최소 너비 20px, 반경 999px(999px은 배지·칩에만, v3 유지). 숫자 한두 자리 배지는 너비가 높이의 1.4배를 넘지 않아 알약으로 세지 않는다(§7.2).

### 4.7 `Modal` · `Window` · `ModalTabs`

- 옛 `ModalShell` 모양을 kit `Modal`이 이어받는다(C3). 랭킹 전체 보기도 `Modal`로 옮기고 `ModalShell`은 지운다. 창 재질은 한 벌이다.
- **한 요소로 그린다**(겹을 늘리지 않음): 테 `--frame-sm` 8px(원화 `frame.sm`, 대체 `--walnut-2`) + 안쪽 몰딩 `inset 0 0 0 2px var(--oak-1)` + 바닥 `--shadow-board`. 면 `--parch-2`, 반경 `--r-md`. 안쪽 여백 16px(R4 24px − 테 8px).
- 머리줄: 제목 `--fs-4` 24px 800 `--ink`, 아래 구분선 `rule`(대체 2px `--oak-1`), 구분선 아래 `--s2`. 닫기는 X 아이콘 `IconButton`(양피지 키).
- 막 `--scrim`. 크기 규격은 **`sm` `420px` · `md` `680px` · `lg` `860px`**이며, `fixed`가 켜진 창(`md` `680×540px`, `lg` `860×580px`)은 데스크톱·크롬북(`≥720×620`)에서 외곽 높이를 잠가 탭이나 상태를 바꿔도 창 크기가 흔들리지 않는다. `footer` 오른쪽 정렬, `dismissable`, 포커스 규칙은 R4 그대로.
- **색인 탭(`ModalTabs` + `ModalTabPanel`)**: 창 상단 주제 전환(`role="tablist"`)은 `--parch-3` 음각 레일 위로 선택 탭(`--parch-2` 면 + 위쪽 4px `--green` 강조 띠)이 솟아올라 본문 시트(`ModalTabPanel`)와 경계선 없이 이어진다. 창 안의 값 고르기(`Segmented`, `role="radiogroup"`)와 시각적으로 즉시 구별된다.
- 창 안 `--ring`은 `--blue`.

### 4.8 `ChoiceCard`(`src/ui/game/ChoiceCard.*`, 새 타워·진화·보물)

- 옛 징집 카드 모양(`2db26f4` `RecruitCard.module.css`): 카드 면 `--parch-1`, 테 2px `--walnut-3`, 반경 `--r-md`, 바닥 4px `--walnut-3`, 여백 10px.
- 그림 칸: 면 `--walnut-4`(짙은 칸), 반경 `--r-sm`, 발밑 타원 `--walnut-3`. ART-OAK1에 짙은 타일이 없어 단색으로 둔다(ART-OAK2 예비분에서 다시 본다).
- 본문: 이름 20px 800 `--ink`, 설명 16px 400 `--ink-2`.
- 호버·포커스: `translateY(-2px)` + 바닥 6px(창 안이라 transform 허용). 누름: `translateY(4px)` + 바닥 0. 막힘: 바닥 0, `opacity: 0.6`, 이유 줄(R4).
- 진화 감소 능력(B9)은 칩 테 2px `--red` + 글 `--red`(parch-1 위 6.23).

### 4.9 바탕별로 둘 수 있는 것

| 바탕 | 둘 수 있음 | 두지 않음 |
|---|---|---|
| 짙은 면(`--bg`, 머리판, 틀) | 놋쇠 키(6.77), 양피지 키·`IconButton`, `ghost onDark`, 짙은 판용 글자색 | 숲색·붉은 키(2.28·2.43), `--ink`·`--ink-2` 글, `--blue` 링 |
| 참나무 판 | 양피지 카드·키, `--ink` 글 | `--ink-2`·상태색 작은 글(§2.6 규칙 1) |
| 양피지 면 | 모든 키, 모든 밝은 면용 글자색 | `--on-dark` 계열 글 |

## 5. 글자

### 5.1 글꼴·굵기

Pretendard 하나, 굵기 400/700/800(계약 `layout.fontWeights`, v3 유지). 표시용 숫자(HUD·결과·`Stat`·배지)는 800 + `tabular-nums`다. 외부 표시 글꼴은 들이지 않는다(v3 총괄 결정 유지).

### 5.2 크기 단계

`--fs-1~6` = 13 / 16 / 20 / 24 / 32 / 44px만 쓴다. 예외는 문제 글(`--q-font`)과 읽는 글(`--read-font`)이 키운 값, 그리고 홈 자체 CSS(기준 캡처의 13~22px)다. 하한은 모든 장면·세 단계에서 13px이다.

### 5.3 글자 크기 설정 3층

| 층 | 보통 / 크게 / 아주 크게 | 대상 | 구현 |
|---|---|---|---|
| 문제 글 | 18 / 21 / 24px | 문제·보기 | `--q-font`(지금 그대로) |
| 읽는 글 | 기본 / +1 / +2px | 해설·오답 이유(B3), 설명서 본문, 오답 노트 뜻·예문, 오늘의 낱말 뜻, 결과 낱말 카드 | `--read-font`(16 / 17 / 18px) 또는 `calc(<기본 크기> + var(--read-step))` |
| 조작 글 | 고정 | 버튼·탭·HUD 숫자·배지·라벨 | `--fs-*` |

```css
/* global.css (K) — --read-step·--read-font 새로 만듦 */
:root { --q-font: 18px; --read-step: 0px; --read-font: calc(var(--fs-2) + var(--read-step)); }
:root[data-font='large']  { --q-font: 21px; --read-step: 1px; }
:root[data-font='xlarge'] { --q-font: 24px; --read-step: 2px; }
```

- `data-font`는 `src/ui/App.tsx`가 `<html>`에 단다(지금 그대로).
- 기본이 16px가 아닌 읽는 글은 `calc(<기본> + var(--read-step))`을 쓴다. 홈의 오늘의 낱말 뜻·예문은 `calc(15px + var(--read-step))`(옛 15/16/17px와 같음). 홈의 나머지 글은 15px 고정으로 바꾼다(`.foreground`·`.modalScrim`의 단계별 15/16/17px 규칙 삭제, C).
- 읽는 글 요소에는 `data-content`를 단다(상시 문장 셈에서 빠진다, §7.2).
- 문제판 안 해설이 커지면 `src/ui/useLayout.ts`의 문제판 높이 예산(계약 `questionFontExtraPx`)이 모자랄 수 있다. A가 1366×650에서 아주 크게로 확인하고, 모자라면 계약 변경을 메인에 요청한다.
- 관문: 세 단계 모두 1366×650 홈·전투 스크롤·넘침 0, 13px 하한.

## 6. 용어

화면 글은 평이하고 널리 쓰는 말로 쓴다. 세계관 말투는 쓰지 않는다(사용자 결정 2026-11-04).

| 쓰지 않음 | 씀 |
|---|---|
| 통합 수호 랭킹, 상세 순위표 열기, 상세 수호 순위표 | 랭킹, 전체 보기, 전체 랭킹(상위 50위) |
| 한 판 최고점 · 누적 명예점 · 최장 웨이브 · 내 기기 기록 | 최고 점수 · 랭킹 점수 · 최고 웨이브 · 내 기록 |
| 명예점, 획득 명예점 | 랭킹 점수 |
| 왕국 학술원 수호 작전실 · 낱말의 힘으로 성문을 지켜요 | 낱말 문제를 풀고 타워로 성문을 지켜요 |
| 왕국 수호 현황 | 접속 현황 |
| 오늘의 낱말 공부, 비석 | 오늘의 낱말 |
| 출정, 출정 대원 별명, 새 게임 출정 설정, 시작하기 | 시작, 닉네임, 새 게임, 시작 |
| 징집, 새 타워 징집 | 새 타워 |
| 고비, 대장, 대장 웨이브 | 보스, 보스 웨이브 |
| 버닝, 불꽃(연속 정답 3번) | 연속 정답 보너스(불꽃 아이콘은 그대로) |
| 원정 보물 | 보물 |
| 침입 종족 특성, 종족 | 적 특성, 적 |
| 수호자, 첫 수호자로 기록돼요 | 첫 기록이 남아요 |
| 왕국 초원 · 성문 수비전, 고비 5웨이브 시연 | 정원 미리보기, 5웨이브 보스 |
| 처음으로, 다시 보기 | 홈, 오답 노트 |

- **금지어 목록**(`tests/unit/terms.test.ts`의 `BANNED`와 같다. 화면 문자열에 이 글자가 **들어 있으면** 실패한다): 수호, 명예점, 최고점, 최장 웨이브, 내 기기, 상세 순위표, 왕국, 학술원, 작전실, 낱말의 힘, 낱말 공부, 비석, 출정, 시작하기, 징집, 고비, 대장, 버닝, 불꽃, 원정, 종족, 군자금, 성문 수비, 초원, 처음으로, 다시 보기.
- 검사 범위: `src/ui`·`src/application`의 문자열·템플릿·JSX 글(주석 제외). 닉네임 추천 낱말 묶음(`src/application/lobby.ts`, 시험의 `NAME_POOLS`)은 제외다. 목록을 바꾸면 시험과 이 문서를 같이 고친다(메인 소유).
- **유지하는 말**: 새 게임, 연습, 닉네임, 학교, 랭킹, 랭킹 점수, 웨이브, 골드, 성문, 오답 노트, 모르겠어요, 보물, 진화, 강화, 판매.
- 화면 글은 `src/ui/copy.ts`(메인)에 모은다. 트랙의 새 글은 자기 폴더 `*Copy.ts`에 두고 P4에서 메인이 합친다. 느낌표는 화면당 1개 이하, 영문 단독 라벨·이모지 0(v2·v3 유지).

## 7. 밀도·움직임

### 7.1 화면별 상한(장비가 센다: `node tools/qa/scenes.mjs` → `report.json`의 `audit.slop`)

| 화면(장면) | 버튼 | 상시 문장 | 글자 크기 종류 | 알약 | 겹 | P0 측정값 | v3 대비 |
|---|---|---|---|---|---|---|---|
| 홈(`01-home`, `12f`) | ≤ 24 | ≤ 3 | ≤ 9 | ≤ 2 | ≤ 5 | 24 · 3 · 9 · 2 · 5 | **완화**: v3 관문 밖 → 기준선 값을 상한으로 |
| 전투 준비·전투(`01-first-prep`, `02`, `04b`, `06`, `11-picked`) | ≤ 문제 4 + 모르겠어요 1 + 일시정지 1 + 타워 칸 수 + 2(최대 16) | ≤ 1(문제·해설 제외) | ≤ 5 | ≤ 3 | ≤ 3 | 10~14 · 0 · 3~4 · 1 · 2 | **완화**: 버튼 +2(전투 시작·보물 줄), 알약 1→3(복습·+N 골드·보너스), 겹 +1(호두나무 틀) |
| 새 게임(`01-newgame`) | ≤ 12 | ≤ 2 | ≤ 4 | 0 | ≤ 4 | 10 · 0 · 3 · 0 · 4 | v3 유지 |
| 새 타워·진화·보물(`03-cards`, `04-choice`, `11-cards`) | 카드 수 + 닫기 | ≤ 카드 수 | ≤ 4 | 0 | ≤ 2 | 3 · 0 · 3~4 · 0 · 2 | v3 유지 |
| 결과(`10b-result`) | ≤ 4 | ≤ 2 | ≤ 5 | 0 | ≤ 3 | 2 · 0 · 5 · 0 · 3 | v3 유지 |
| 정지·설정·설명서·오답 노트·랭킹(`10a`, `12a~12e`) | P0 측정값 이하(설명서는 결정 16) | ≤ 3 | ≤ 4 | 0 | P0 측정값 이하 | 1~24 · 0~8 · 2~4 · 0 · 2~5 | v3 유지("다른 화면 3개 이하") |

- 측정값은 메인의 P0 기준선 캡처(2026-11-04, desk·cb·phone) 값이다. 오답 노트 상시 문장 8개는 뜻·예문에 `data-content`가 없어서다 → §5.3대로 달면 0이 된다(C).
- 상시 문장 1개 규칙은 전투에서 유지한다(B11). 첫 판 '설치' 쪽지와 준비 바 힌트가 동시에 보이면 하나를 숨긴다.

### 7.2 세는 법

- 겹은 배경색(불투명 0.9 이상)이나 1px 이상 테가 있는 조상 사슬의 길이다. v3의 "+1 해석"은 버리고 측정값을 그대로 쓴다. `Modal`·틀을 한 요소로 그리면(§4.7) 겹이 늘지 않는다.
- 알약은 반경이 높이의 절반 이상이고 너비가 높이의 1.4배를 넘는 상자다. 숫자 배지는 정원·사각으로 그려 알약으로 세지 않는다.
- 상시 문장은 공백을 포함한 20자 이상 글이다. 문제·보기·읽는 글은 `data-content` 안에 둔다.

### 7.3 움직임

- UI 전환 120~240ms, 피드백 600ms 이하, ease-out 계열(v3 유지).
- **무한 반복은 화면당 1개 이하**다. 세는 대상은 끝없이 도는 CSS 애니메이션과 rAF 연출이다(전장 Phaser 장면과 홈 배경 캔버스는 세지 않는다). 전투는 준비 바 대기 움직임(B5), 설명서는 1장 시연(G2), 홈은 미니 전장(`MiniStageCanvas`)이 그 1개다.
- **움직임 줄이기에서 0**: OS `prefers-reduced-motion: reduce`와 설정 `motionMode: 'minimal'`(`src/persistence/settings.ts`) 둘 다에서 무한 반복을 멈추고 위치 이동 없이 투명도 전환만 남긴다. OS 쪽은 `global.css`의 미디어 규칙이 막는다. 설정 쪽은 지금 컴포넌트가 `reducedMotion`을 받아 `data-calm`을 다는 방식(`Hud.tsx`)만 있다. 새 반복 움직임은 이 방식을 따르거나, 메인이 `<html data-motion>`(새로 만듦, `src/ui/App.tsx`)을 달면 그것을 쓴다.

### 7.4 transform 금지 영역(수직선 잠금)

- 하단 문제판(`section[aria-label="어휘 문제"]`)의 보기 키·'모르겠어요' 키·문제판 상자, 레일(`aside[aria-label="타워 관리"]`), 전장 오른쪽 경계: `transform`·`translate`·`scale`·`top`·`left`·`margin`을 바꾸는 상태·움직임을 쓰지 않는다. 누름·채점·정답 떠오름(B10)은 바닥 두께(0·4·6px)와 면 색으로만 나타낸다.
- kit `Button`의 누름 `translateY(4px)`는 문제판 안에서 끈다(A가 문제판 CSS에서, 부품 쪽 선택이 필요하면 K에 요청).
- 문제판 위에 겹쳐 뜨는 말풍선(휴대폰 해설처럼 `position: absolute`이고 보기 자리를 바꾸지 않는 것)은 나타날 때 한 번의 이동을 허용한다.
- 관문: `tests/e2e/layout.spec.ts`의 보기 이동·문제판 높이·수직선 Δ ≤ 0.5px.

## 8. 관문 수치와 검사 방법

| 항목 | 기준 | 검사 |
|---|---|---|
| 글자·누름 | 13px·44px 하한(모든 장면, 글자 3단계) | `tests/e2e/layout.spec.ts`('13px·44px 하한' 시험, 뷰포트별 시험), `scenes.mjs` `report.json`의 `tiny`·`small`. 3단계: 지금은 `tests/e2e/guide.spec.ts` G13(아주 크게)만 있다 → 메인이 `scenes.mjs`나 `layout.spec.ts`에 글자 단계 반복을 더한다 |
| 넘침 | 가로 0, 1366×650 홈·전투 세로 스크롤 0 | `layout.spec.ts` 문서 넘침 단언, `home.spec.ts` L20~L22, `scenes.mjs` `overflowX`·`overflowY`(cb 크기 홈·전투 장면) |
| 재질 | 흰 종이 카드 0, 창 재질 1벌, 원화 ≤ 400KB | 눈 관문 + `grep -rni -e '#fff\b' -e '#ffffff' -e '#fffdf7' src/ui` 면 색 0 + `scenes.mjs` `audit.slop.offToken`(토큰 목록 v4 갱신 뒤, 부록 B) · `grep -rn ModalShell src` 0 · `cat public/assets/ui/oak/*.webp \| wc -c` ≤ 409600 |
| 대비 | §2.6 표 | `axe`의 `color-contrast`(아래 접근성 시험에 포함) |
| 그라데이션·블러 | 0 | `home.spec.ts` L20~L22·`guide.spec.ts` G14 스타일 전수 검사 |
| 움직임 | 무한 반복 화면당 ≤ 1, 움직임 줄이기에서 0 | `stage-animation.spec.ts`(홈 미니 전장), 각 트랙 e2e에서 `page.emulateMedia({ reducedMotion: 'reduce' })` 뒤 `document.getAnimations()` 중 반복 무한·재생 중인 것 0 |
| 수직선 | Δ ≤ 0.5px, 제출 흔들림 0 | `layout.spec.ts`, `tests/unit/layout-v3.test.ts`(`SEAM_INSET_PX`) |
| 성능 | 운영 빌드 CPU 4배 감속 60fps, 첫 화면 JS gzip 증가 ≤ 20KB | `node tools/qa/perf.mjs --target prod --rates 4`. gzip은 도구가 없다: `npm run build` 뒤 첫 화면 청크를 `gzip -9 -c <파일> \| wc -c`로 P0 값과 비교(P4 메인) |
| 접근성 | axe 위반 0, 키보드로 모든 조작, 포커스 복귀 | `play.spec.ts`('접근성: 홈·준비 화면 axe'), `guide.spec.ts` G01~G16, `home.spec.ts` L20~L22, `layout.spec.ts`(모달 포커스·정지 화면·순위표 탭·새 게임 radiogroup), `tests/unit/ui/kit-segments.test.ts` |
| 용어 | 금지어 0 | `npx vitest run tests/unit/terms.test.ts` |
| 학습 | 오답 이유·보상 미리보기·복습 배지가 보인다 | A가 `play.spec.ts`에 B2·B3·B4 단언을 더한다 |
| 밀도 | §7.1 표 | `scenes.mjs` `audit.slop` |
| 눈 관문 | Antigravity 전후 판정 반려 0 | `docs/renewal/qa/r5/` 비교판(pre-r4·기준선·R5). 가장 크고 대비 높은 것이 "지금 할 일"인가(v3 유지) |

## 부록 A. v3 → v4 바뀐 점

| 항목 | v3 | v4 |
|---|---|---|
| 재질 | CSS로 나무를 흉내 내지 않음, 밝은 종이 카드 | 호두나무 틀·참나무 판·양피지 면·놋쇠 4단, 틀·판·키는 원화 9-slice·타일 |
| 색 토큰 | v3 한 벌(`--bg` 숲색 등) | §2.1 팔레트 12개 + v3 이름 재매핑 + 옛 홈 토큰 별칭. 홈 토큰도 `global.css` 한 곳 |
| 테두리 | 카드·창 0, 입력칸만 | 카드 2px `--oak-2`, 키·입력칸 2px `--walnut-3`, 창 `--frame-sm`. 테만큼 여백을 줄여 크기 불변 |
| 그림자 | 키캡 바닥 + `--float`(흐림 20px) | 흐림 0만. 바닥 0·2·4·6px |
| 반경 | 8 · 14px | 4 · 8px(옛 랜딩과 같게) |
| 포커스 링 | `--blue` `#2563a8` | `--ring`(밝은 면 `--blue` `#235885`, 짙은 면 `--focus-on-dark`) |
| 주 버튼 | `primary` 숲색 | `primary md` 숲색, `primary lg`·`accent` 놋쇠 |
| 개수 배지 | 붉은 면 | 놋쇠(경고는 밀랍) |
| 창 | 종이 카드 창 + 옛 `ModalShell` 따로 | `Modal` 한 벌(호두나무 테 + 양피지 면 + 구분선 + X) |
| 짙은 바탕 위 키 | `IconButton`·`ghost onDark`만 | + 놋쇠 키·양피지 키(머리판 단추) |
| 글자 크기 설정 | 문제 글만 | 3층(문제 · 읽는 글 `--read-font` · 조작 고정) |
| 용어 | 대장, 불꽃(연속 정답 3번) | 보스, 연속 정답 보너스. 금지어 시험 |
| 밀도 | 홈 관문 밖, 전투 알약 ≤ 1·겹 ≤ 2 | 홈 기준선 상한, 전투 버튼 +2·알약 ≤ 3·겹 ≤ 3, 겹은 측정값 그대로 |
| 움직임 | `prefers-reduced-motion`만 | + 설정 `minimal`에서도 무한 반복 0, 문제판 transform 금지 명시 |

## 부록 B. 시작 전에 알아 둘 어긋남(2026-11-04 확인)

| 무엇 | 어디 | 누가 |
|---|---|---|
| 토큰 밖 색 검사가 v3 이름 14개만 안다(홈은 지금 72곳으로 셈) | `tools/qa/lib.mjs`의 `tokens` 목록 | 메인: `:root`의 hex 토큰 전체를 읽게 바꿨다(P0). 홈 72곳은 K가 C1로 토큰을 올리면 줄어야 한다 |
| 설명서 스타일 검사의 허용 반경이 0/8/14/999px | `tests/e2e/guide.spec.ts` G14 | 메인: 전환용 0/4/8/14/999px(P0). B: P3에서 0/4/8/999px로 |
| 학교 목록 글자 11px·12px(13px 하한 미달, 목록이 열릴 때만 보임) | `home.module.css` `.schoolItemBadge`·`.schoolItemAddress` | C |
| 홈 CSS에 직접 쓴 색 17곳(`#ffffff` 호버, `#5ce068` 접속 점 등) | `home.module.css` | C: 토큰으로 바꾸거나 메인에 토큰 요청 |
| kit 누름 `translateY`가 답안 키에도 걸린다 | `src/ui/kit/ui.module.css` `.btn:active` | K(P2 완료): `Button still`·조상 `--btn-press-y: 0px` 제공. A: 문제판에 적용 |
| 설정 `minimal`이 CSS 반복 움직임에 닿는 공통 길이 없다 | `src/ui/App.tsx` | K(P2 완료): `<html data-motion>`. A·B·C: 화면 CSS의 반복 움직임도 `[data-motion='minimal']`을 따르게 |

### P2 뒤 넘겨받을 것(2026-11-05, 세션 K 보고)

| 무엇 | 어디 | 누가 |
|---|---|---|
| 1366×650 **아주 크게** 첫 준비(`01-first-prep-cb`) 세로 넘침 4px. 그 판 문제·보기가 각각 2줄 | 전투 문제판 | A: 아주 크게로 다시 재고, 모자라면 메인에 계약 변경 요청 |
| 답안 키가 키 원화(알약)로 그려져 2~3줄에서 끝이 길쭉하고, 휴대폰에서 번호 '1'이 왼쪽 리벳에 붙는다 | `src/ui/game/` 문제판 | A: 답안 키는 원화를 끄고(`--key: none; --art-clip: initial; --art-shadow: initial`) B10(바닥 0·4·6px)으로 그리거나 `groove` 안 양피지 카드로. 누름 이동은 `still`이나 `--btn-press-y: 0px` |
| 일시정지(B15)가 아직 `Card`라 창 재질이 두 벌로 보인다 | 일시정지 | A: kit `Modal`로 |
| `home.module.css` 안 쓰는 클래스 15개(`modalScrim`·`modalDialog`·`settingsTabs` …), 직접 색 `#ffffff` 8곳 등 6곳 | `home.module.css` | C |
| 오늘의 낱말 뜻·예문에 읽는 글 표시 `data-content`가 없어 홈 상시 문장이 3→5로 세어진다 | `SteleStudyPanel.tsx` | C |
| Safari에서 원화(키·창·고르기 줄)가 그려지는지 눈 확인 안 함(Playwright WebKit 미설치) | — | 메인: P4 실기기 확인 |
| `scenes.mjs`에 글자 단계 선택이 없다 | `tools/qa/scenes.mjs` | 메인: `--font` 추가(P0) |
| `ChoiceCard`는 A 소유 폴더(`src/ui/game/`)인데 옷 입히기(C2)는 P2 K 몫 | 계획서 §7.1 | 메인: P2 동안 K 소유로 적었다(P0) |

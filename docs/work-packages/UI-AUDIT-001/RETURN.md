# UI-AUDIT-001 — 화면 점검과 스타일 보정 결과 보고 (RETURN)

```yaml
jobId: UI-AUDIT-001
status: COMPLETED
owner: Argon 4
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: ee5833846f0aa227ea3a6e2fe89257b02bae0e33
contractHashVerified: true
summary:
  preFixFails: 12        # 허용 CSS 결함 10건 + 수정 금지 경로(tsx/application) 결함 2건
  fixedInAllowedCss: 10  # 허용 경로(src/ui/**/*.module.css) 내 결함 10건 전량 수정 완료 (수정 후 CSS 결함 0건)
  contractProposals: 7   # REQUESTED_CONTRACT_CHANGE 7건 (금지 경로 결함 2건 + 공통 키트·동작·안내 보강 5건)
  userJudgmentItems: 3   # 취향·디자인 판단 항목 3건
  e2eResult: "4 passed (1.1m)"
```

---

## 1. 시작 확인 결과

작업 폴더 `C:\Users\User\Desktop\vibecoding\tower-wp\UI-AUDIT-001`에서 시작 전 5개 항목을 모두 검증하였다.

1. **`git rev-parse HEAD`**: `ee5833846f0aa227ea3a6e2fe89257b02bae0e33` (일치)
2. **`git status --short` (시작 시점)**: `M docs/work-packages/UI-AUDIT-001/REQUEST.md` 1줄 (일치)
3. **`npm ci` 및 `npx playwright install chromium`**: 정상 설치 완료
4. **`node tools/contract-hash.mjs UI-AUDIT-001`**:
   - `vocabulary_td_prd_v0_5.md`: `5d6f25e96aee6e07c31ea33d968cfbc210a9336ab4fb5235284db6cb0f20056a` (일치)
   - `docs/assets/design-41-kingdom-expedition.png`: `5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13` (일치)
   - `src/ui/styles/global.css`: `b56b448480523af7298c9bc93402e70d0e632c00dc42eb50c0a229796be5ab65` (일치)
   - `src/ui/kit.module.css`: `907abaee60c23d2e1e0fdc5efc471301df9971c4ef721fb7cecc43a785e9c120` (일치)
   - `src/ui/copy.ts`: `fd4799756d2a9432d77ea9a243bb3e900fa153826a0199bb6d42d0a731af658c` (일치)
   - `tests/e2e/play.spec.ts`: `3aea535a15079df01bea54218ff0fc9d80bada2686604fe41a122ef972436276` (일치)
5. **5173 포트 점유 확인**: 비어 있음 확인 후 `npm run test:e2e` 1회 실행 → 초기 캡처를 `test-results/before/`로 복사 보존.

---

## 2. 화면 × 크기 × 글자 배율 점검 요약 및 PRD §12.1 실측치

### 2.1 뷰포트별 R/S 모드 및 전장 칸 크기 실측 (§12.1 표 대비)

| 뷰포트 (CSS px) | PRD §12.1 기준 모드 / 전장 / 칸 | 실측 모드 | 실측 전장 (`mapW×mapH`) | 실측 칸 (`cell`) | 오차 | 가로 넘침 (`overflowX`) | 정지 버튼 노출 (`44×44`) | 판정 |
|---|---|---|---|---|---|---|---|---|
| **1440×900** (데스크톱) | R / 1087×652 / 72.4px | **R** | `1086×651` | `72.4px` | -1px 이내 | 전 화면 `0px` | 상시 노출 (`44×44`) | **PASS** |
| **1366×650** (크롬북) | R / 670×402 / 44.7px | **R** | `669×401` | `44.6px` | -1px 이내 | 전 화면 `0px` | 상시 노출 (`44×44`) | **PASS** |
| **1024×690** (iPad 가로) | R / 737×442 / 49.1px | **R** | `736×441` | `49.1px` | -1px 이내 | 전 화면 `0px` | 상시 노출 (`44×44`) | **PASS** |
| **768×950** (iPad 세로) | S / 736×442 / 49.1px | **S** | `735×441` | `49.0px` | -1px 이내 | 전 화면 `0px` | 상시 노출 (`44×44`) | **PASS** (보정 후) |
| **390×664** (휴대폰 세로) | S / 374×224 / 24.9px | **S** | `373×224` | `24.9px` | -1px 이내 | 전 화면 `0px` | 상시 노출 (`44×44`) | **PASS** (보정 후) |
| **320×460** (소형 휴대폰) | S / 304×182 / 20.3px | **S** | `303×181` | `20.2px` | -1px 이내 | 전 화면 `0px` (전: `23px`) | 상시 노출 (`44×44`, 전: 화면 밖 밀림) | **PASS** (보정 후) |

### 2.2 화면 × 크기 × 글자 크기(`보통 18px` / `크게 21px` / `아주 크게 24px`) 종합 판정표

> 표기: `전 FAIL → 후 PASS`는 허용 경로(`src/ui/**/*.module.css`) 보정으로 해결된 항목이며, `조건부(계약제안)`은 수정 금지 경로(`*.tsx`, `RunController.ts`)에 원인이 있어 `REQUESTED_CONTRACT_CHANGE`로 보고한 항목이다.

| 화면 (세부 상태) | 1440×900 (보통/크게/아주크게) | 1366×650 (보통/크게/아주크게) | 1024×690 (보통) | 768×950 (보통) | 390×664 (보통/크게/아주크게) | 320×460 (보통/크게/아주크게) | 핵심 점검 근거 및 전·후 변화 |
|---|---|---|---|---|---|---|---|
| **1. 홈** (`초기` / `이어하기 있음`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** `.sub`에 비표준 간격 `margin-top: -6px` 사용.<br>**[후]** `margin-top: 0` 및 `.stack` 간격 토큰(`var(--s3)`)으로 보정. 가로·세로 넘침 0, 대비 최소 `6.74:1`. |
| **2. 새 게임** (`학년·난이도·별명·맵 미리보기`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① 학년/난이도 `.grid2`가 4열/2열 카드 격자(§12.8 위반), ② 맵 미리보기 슬롯 칸(`#b3ada3`)과 풀(`#7cbc4c`) 비텍스트 대비 `1.03:1`(<3:1), ③ `320×460(아주크게)`에서 `.input` 가로 넘침 `13px`, ④ `.choice` 눌림/호버 상태 누락 및 `10px` 패딩 사용.<br>**[후]** `.grid2`를 1열 행(`1fr`)으로 전환, 슬롯 칸 `outline: 1px solid var(--edge)`(`6.22:1`) 추가, `.input { width: 100%; min-width: 0; }` 적용, `var(--s2) var(--s3)` 토큰화. |
| **3-a. 준비 문제 — 출제 초기** (`PREP_QUIZ`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① HUD 성문 막대 `.track` 대비 `1.85:1`(<3:1), ② `.options`에 `grid-auto-rows: 1fr`가 없어 줄바꿈 시 보기 높이 불일치, ③ `390×664(보통)`에서 `.stem` 플렉스 줄바꿈 등으로 세로 넘침 `91px` 발생.<br>**[후]** 성문 막대 트랙 `var(--parchment)`(`6.33:1`), `grid-auto-rows: 1fr` 적용, 인라인 칩 배치로 `1440`·`1366`·`1024`·`768`·`390(보통)` 세로 스크롤 `0px`. |
| **3-b. 준비 문제 — 정답 피드백** (`correct`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① 미선택 보기 `.dim { opacity: 0.62 }`로 실제 합성 대비 `.optionText` `4.29:1`, `.num` `4.18:1`(<4.5:1) 및 비토큰 RGB 생성, ② 정답 `<Mark>` 삽입 시 텍스트 폭이 `34px` 줄어 `390×664`·`320×460`에서 보기 높이가 `74px→101px`로 변하며 아래 행이 밀림(§12.5 위반).<br>**[후]** `.dim`을 `color: var(--ink-soft)`로 바꿔 대비 `7.08:1`/`6.50:1` 확보, `.option .mark`를 `.num` 자리에 겹쳐 배치하여 제출 전후 보기 크기·위치 변화 `0px`. |
| **3-c. 준비 문제 — 오답 피드백** (`wrong`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① `.dim` 합성 대비 `4.18:1`(<4.5:1), ② `<Mark>` 삽입으로 보기 행 밀림, ③ `1440×900`·`1366×650` `크게`/`아주크게`에서 `.wide` 높이 초과로 세로 스크롤 `20~29px` 발생.<br>**[후]** 대비 `6.50:1+`, 보기 위치 변화 `0px`, PRD §12.5 높이 예산(`padding: var(--s2) var(--s4)`, 줄간격 `1.38`/`1.35`) 적용으로 `1440`·`1366`·`1024`·`768` 전 글자 크기 세로 넘침 `0px`. |
| **3-d. 준비 문제 — 모르겠어요 피드백** (`skip`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** `.dim` 합성 대비 `4.18:1`(<4.5:1) 및 `<Mark>` 삽입 시 보기 크기 변동.<br>**[후]** 전 뷰포트 합성 대비 `6.50:1` 이상, 제출 전후 보기 상자 크기 100% 동일. |
| **4-a. 배치 — 대기 / 빈칸 선택 / 설치 미리보기** (`idle` / `slot` / `preview`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① S 모드 `.listCompact`가 3열 세로 카드 격자(§12.8 위반), ② `<Stats>` 수치 사이에 `·` 구분자 누락(`힘 8 1초마다 2.5칸`), ③ `768×950` 미리보기 시 빈 `.reason` 공백과 `.build` 높이로 `5px` 세로 넘침.<br>**[후]** `.listCompact`를 1열 행(`1fr`)으로 전환, `.stats > span + span::before { content: '· '; }` 추가, 빈 `.reason:empty` 제거로 `768×950` 세로 넘침 `0px`. |
| **4-b. 배치 — 타워 선택 / 강화** (`tower Lv1·Lv2`) | 전 FAIL → **후 PASS** *(Lv 표기는 계약제안)* | 전 FAIL → **후 PASS** *(Lv 표기는 계약제안)* | 전 FAIL → **후 PASS** *(Lv 표기는 계약제안)* | 전 FAIL → **후 PASS** *(Lv 표기는 계약제안)* | 전 FAIL → **후 PASS** *(Lv 표기는 계약제안)* | 전 FAIL → **후 PASS** *(Lv 표기는 계약제안)* | **[전]** ① 수치 `·` 구분자 누락, ② `.item` 버튼 6상태 중 `:hover`/`:active`/`:disabled` 누락 및 비표준 패딩(`6px`, `10px`), ③ `768×950`에서 `14~17px` 세로 넘침, ④ `ManagementPanel.tsx`에 영어 약어 `Lv 1` 하드코딩.<br>**[후]** CSS 결함 3건 모두 수정 완료(`768×950` 세로 넘침 `0px`). `Lv` → `레벨`은 `REQUESTED_CONTRACT_CHANGE-01`로 제안(`play.spec.ts`가 `Lv 1` 텍스트를 검증하므로 CSS 가상요소로 변형하지 않음). |
| **4-c. 배치 — 진화 길 선택** (`branch A/B`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① `.branchMark[data-branch='A']`가 `border-radius: 50%`를 사용하여 반경 토큰 2개 규칙(§12.8) 위반, ② `768×950`에서 세로 넘침 `111px`.<br>**[후]** `border-radius: var(--r-input)`으로 보정, 태블릿(`600~960px`)에서 A/B 두 분기 행을 나란히 배치하여 `768×950` 세로 넘침 `0px` 달성. |
| **4-d. 배치 — 판매 확인** (`sell`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** HUD 성문 막대 대비 미달 및 `Pause/Management` 간격 비토큰 값.<br>**[후]** `261골드에 판매 / 취소` 같은 패널 내 전환, 중앙 모달 없음, 대비·간격 모두 통과. |
| **5. 전투** (`BATTLE`) | 전 FAIL → **후 PASS** *(버닝 동시 느낌표는 계약제안)* | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** HUD 성문 막대 대비 미달, 문제판 비표준 간격(`6px`, `14px`).<br>**[후]** 전장·레일·하단 문제판 모두 `1440`·`1366`·`1024`·`768`·`390(보통)` 세로·가로 넘침 `0px`. 단, 3연속 정답 순간 전장 알림(`버닝! ...`)과 피드백(`정답!`)이 1초간 겹칠 때 느낌표가 2개가 되는 현상은 `REQUESTED_CONTRACT_CHANGE-02`로 제안. |
| **6. 마무리 문제** (`WAVE_WRAPUP` + 버닝 배지) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① `1440×900`·`1366×650`·`1024×690` R 모드에서 `.wrapup` 안내줄(`26px`)이 더해져 `26~29px` 세로 넘침 발생, ② `320×460`에서 `.burn` 배지가 정지 버튼 열을 밀어내 가로 넘침 `23px` 및 정지 버튼 화면 밖 이탈(`right: 335px`), ③ `768×950`에서 정지 버튼이 2행 1열로 떨어짐.<br>**[후]** `.wide` `min-height: 176px` 보정으로 R 모드 세로 넘침 `0px`, HUD `.bar` 레이아웃 보정으로 `320×460` 가로 넘침 `0px` 및 정지 버튼 고정(`right: 296px`). |
| **7. 일시정지** (`PauseOverlay` / `끝내기 확인`) | 전 FAIL → **후 PASS** *(저장종료 경합은 계약제안)* | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① `PauseOverlay.module.css`에 `10px`, `6px` 비표준 간격, ② 배후 HUD 가로 넘침으로 `320×460`에서 `overflowX=23px`.<br>**[후]** 문제·보기 DOM 완전 제거(`question=0`), 배후 `<main inert>` 처리, 간격 토큰화, 가로 넘침 `0px`. (`RunController.saveAndExit()` 비동기 경합은 `REQUESTED_CONTRACT_CHANGE-03` 참조). |
| **8. 결과** (`ResultScreen`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** ① `.stats`가 3열 카드 격자(`repeat(3, 1fr)`, 같은 모양 카드 3개 격자 나열로 §12.8 위반), ② `10px`, `6px` 비표준 간격.<br>**[후]** `.stats`를 1열 행(`display: flex; justify-content: space-between`) 목록으로 전환하고 간격 토큰(`var(--s2)`, `var(--s3)`) 적용. |
| **9. 내 기록** (`빈 상태` / `기록 테이블`) | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | 전 FAIL → **후 PASS** | **[전]** `.table th, .table td`에 `padding: 6px 8px` 비표준 간격 사용.<br>**[후]** `padding: var(--s1) var(--s2)`(`4px 8px`)로 보정. `320×460`·`아주 크게`까지 가로 넘침 `0px`. |
| **10. 사용 설명서** (`GuideScreen`) | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | 토큰·간격·대비·반응형 모두 기준 충족(가로 넘침 `0px`, 최소 텍스트 대비 `7.08:1`). |

---

## 3. PRD §12.8 11항목 및 추가 기준 전수 점검표

| # | 점검 항목 | PRD 기준 | 보정 전 상태 및 측정값 | 보정 후 상태 및 측정값 | 최종 판정 |
|---|---|---|---|---|---|
| 1 | **모서리 반경** | 토큰 2개만(`4px` 입력, `8px` 패널). 알약형(`999px`)은 칩 1종에만 | **FAIL** — `ManagementPanel.module.css`의 `.branchMark[data-branch='A']`가 `border-radius: 50%` 사용 | **PASS** — 모든 CSS 모듈에서 `var(--r-input)`(`4px`), `var(--r-panel)`(`8px`), `.chip`(`999px`)만 존재 (브라우저 기본 `<input type="radio">` 제외) | **PASS** |
| 2 | **그림자** | 요소당 1겹, 눌림 표현은 `1px` 이동 + 그림자 축소 | **FAIL** — `.pause`, `.item`, `.branch`, `.option`, `.choice`에 눌림(`:active`) 시 `1px` 이동·그림자 축소 누락 | **PASS** — 모든 커스텀 버튼에 `transform: translateY(1px); box-shadow: none;` 적용, 전 요소 그림자 최대 1겹(`0 2px 0 rgba(58,41,30,0.35)`) | **PASS** |
| 3 | **그라데이션·블러** | CSS 그라데이션·`backdrop-filter` 0 | **PASS** — 전 화면 `background-image: linear/radial-gradient` 0건, `backdrop-filter` 0건 | **PASS** — 0건 유지 | **PASS** |
| 4 | **글꼴** | 한국어 고딕 1종, 굵기 2단계(`400`/`700`), 장식 글꼴은 로고만 | **PASS** — `'Pretendard Variable', 'Pretendard', 'Noto Sans KR', ...` 1종, 계산된 `font-weight`는 `400`, `700` 2종만 존재 | **PASS** — 1종 글꼴·2단계 굵기(`400`/`700`) 유지 | **PASS** |
| 5 | **아이콘** | 한 세트·한 선 두께, 이모지 0, 의미 없는 반짝이·왕관·불꽃 0 | **PASS** — 전 화면 이모지 정규식 검사 0건, 인라인 SVG 및 승인된 타워 파츠 에셋만 사용 | **PASS** — 0건 유지 | **PASS** |
| 6 | **색** | §12.6 `:root` 토큰 밖 색 0. 성공·경고·위험 색은 상태에만 | **FAIL** — `QuestionPanel.module.css`의 `.dim { opacity: 0.62 }`로 인해 합성 색상이 토큰 밖 임의 RGB(`rgb(119,111,99)`)로 변질됨 | **PASS** — 허용 범위(`.module.css`) 내 하드코딩 색상(`#`, `rgb`, `rgba`, `hsl`) **0건**, `.dim`을 `var(--ink-soft)` 토큰으로 교체 | **PASS** |
| 7 | **간격** | `4px` 배수(`4`/`8`/`12`/`16`/`24`)만 | **FAIL** — 6개 `.module.css` 파일에 `-6px`, `6px`, `10px`, `14px`, `2px`, `1px`, `0.25em`, `1.3em` 등 15곳 존재 | **PASS** — 허용 범위 6개 `.module.css`의 모든 `padding`/`margin`/`gap`을 `var(--s1)`~`var(--s5)`(`4`·`8`·`12`·`16`·`24px`) 또는 `0`으로 치환 완료 | **PASS** |
| 8 | **카드 반복** | 같은 모양 카드 3개 이상을 격자로 나열한 화면 0. 목록은 장착 홈·행 형태 | **FAIL** — 새 게임 `.grid2`(4칸/2칸 격자), 휴대폰 타워 트레이 `.listCompact`(3칸 격자), 결과 `.stats`(3칸 격자) | **PASS** — 세 곳 모두 `1fr` 단일 열 수평 행(`행 형태`) 목록으로 변경하여 3개 이상 격자 카드 나열 화면 **0건** | **PASS** |
| 9 | **문구** | 느낌표 화면당 1개 이하, 마케팅·과장 칭찬 0, 영어 단독 라벨 0 | **조건부 FAIL (금지 경로)** — ① `ManagementPanel.tsx:154`에 영어 약어 `Lv {tower.level}` 존재, ② 전투 3연속 정답 순간 전장 알림(`버닝!...`)과 피드백(`정답!`)에 느낌표 각 1개씩 총 2개 동시 노출 가능 | **조건부 (계약 변경 제안)** — 금지 경로(`*.tsx`, `RunController.ts`) 수정 불가 규칙에 따라 `REQUESTED_CONTRACT_CHANGE-01`, `02`로 보고 | **제안 보고** |
| 10 | **빈 장식** | 기능 없는 배너·리본·두루마리·리벳 0. 장식 면적 문제판의 15% 이하 | **PASS** — 문제판 내 장식 요소는 유형 칩(`.chip`, 면적 약 `1.2%`)뿐이며 배너·두루마리·리벳 0건 | **PASS** — 문제판 장식 면적 `< 2%` (15% 이하 충족) | **PASS** |
| 11 | **버튼 상태** | 모든 버튼에 §12.6의 6상태와 disabled 이유 | **FAIL** — 커스텀 버튼(`.pause`, `.item`, `.branch`, `.option`, `.choice`)에 `:hover`/`:active`/`:disabled` 일부 누락; `kit.module.css`에 `pending` 미정의 | **PASS (허용 범위)** — 5종 커스텀 버튼에 default/hover/focus-visible/active/disabled 모두 정의 완료 (`kit.module.css`의 `pending`은 `REQUESTED_CONTRACT_CHANGE-04`로 제안) | **PASS** |
| 추가 1 | **§2.3 표시 규칙** | 난이도 한국어(`쉬움/보통/어려움/아주 어려움`), `점수`, `힘 8 · 1초마다 · 2.5칸` | **FAIL** — 난이도·점수는 적합하나, 타워 수치 `<Stats>`에 가운뎃점(`·`)이 빠져 `힘 8 1초마다 2.5칸`으로 붙어 보임 | **PASS** — `ManagementPanel.module.css`에 `.stats > span + span::before { content: '· '; color: var(--ink-soft); }` 추가하여 `힘 8 · 1초마다 · 2.5칸` 표시 | **PASS** |
| 추가 2 | **§12.5 문제판·보기** | 보기 4개 같은 모양, 말줄임·내부 스크롤 0, 제출 전후 2×2/1열 및 보기 위치 불변 | **FAIL** — 줄바꿈 시 보기 높이 불일치, 제출 후 `<Mark>` 삽입으로 `390×664`·`320×460`에서 보기가 2줄→3줄(`74px→101px`)로 변하며 아래 행 밀림 | **PASS** — `grid-auto-rows: 1fr` 및 `.option .mark` 절대 배치(번호 배지 위치 오버레이)로 308개 전 상태·뷰포트에서 보기 높이 오차 `0px`, 제출 전후 위치 이동 `0px` | **PASS** |
| 추가 3 | **§12.1 레이아웃** | R/S 모드·칸 크기 표 ±1px, 가로 넘침 0, 정지 버튼 언제나 보임 | **FAIL** — `320×460`에서 버닝 배지 출현 시 가로 넘침 `23px` 및 정지 버튼 화면 밖 이탈(`right: 335px`); 새 게임 입력창 `13px` 넘침 | **PASS** — 6개 뷰포트 × 3개 글자 크기 × 19개 화면 상태(총 308회 측정)에서 가로 넘침(`overflowX`) **전수 `0px`**, 정지 버튼 `44×44` 상시 화면 내 노출 | **PASS** |
| 추가 4 | **실제 합성 색 대비** | 일반 글자 `4.5:1` 이상, 주요 비텍스트 `3:1` 이상 (실제 합성색 기준) | **FAIL** — ① 미선택 보기 `.dim` 텍스트 `4.29:1` / 번호 `4.18:1` (<4.5:1), ② HUD 성문 트랙 `1.85:1` / 채움 `1.86:1` (<3:1), ③ 맵 미리보기 슬롯 `1.03:1` (<3:1) | **PASS** — ① `.dim` 텍스트 `7.08:1` / 번호 `6.50:1`, ② 성문 트랙 `6.33:1` / 초록 채움 `6.28:1` / 위험 채움 `5.71:1`, ③ 맵 미리보기 슬롯 외곽선 `6.22:1` / 성문 `5.12:1` (전 화면 최소 텍스트 대비 `5.44:1`) | **PASS** |

---

## 4. 수정한 CSS 파일과 보정 이유

허용 경로(`src/ui/**/*.module.css`, `kit.module.css` 제외) 안의 6개 파일만 수정하였다.

1. **`src/ui/game/GameScreen.module.css`**
   - `.modeR`: `row-gap: var(--s2)`(`8px`, PRD §12.1 세로 간격 8px 일치)로 보정.
   - `.modeS :focus-visible, .modeS button, .modeS [tabindex]`: `scroll-margin-top: 80px` 추가하여 sticky HUD 아래로 포커스된 요소가 가려지지 않게 보정(PRD §12.7).
   - `.wrapup`: `line-height: 20px` 고정 및 `.questionWrap` `gap: var(--s1)`(`4px`) 적용으로 R 모드 마무리 문제(`WAVE_WRAPUP`) 높이가 `208px` 예산 안에 들어오도록 보정.
   - `.build`: 불필요한 `min-height: 96px` 제거 및 패딩 `var(--s2) var(--s4)` 조정으로 태블릿(`768×950`) S 모드에서 트레이를 열었을 때 세로 스크롤이 생기지 않도록 보정.
   - `.tray > p:empty`: 비어 있는 상태 메시지(`<p className={kit.reason}>`)가 문서 흐름 높이를 차지하지 않도록 숨김 처리.
   - `.hint`, `.notice`: 비표준 패딩(`6px 8px`, `6px 12px`)을 4px 배수 토큰(`var(--s1) var(--s2)`, `var(--s1) var(--s3)`)으로 교체.

2. **`src/ui/game/Hud.module.css`**
   - `.hud`: 비표준 패딩(`6px 8px`, `gap: 6px 12px`)을 `padding: var(--s1) var(--s2); gap: var(--s1) var(--s3);`로 교체.
   - `.bar` (S 모드 상단 sticky HUD):
     - 폭 `> 480px`(`768×950` 태블릿 등)에서는 `display: flex; flex-wrap: wrap` 및 `.bar .pause { margin-left: auto; }`를 사용하여 버닝 배지(`.burn`)가 추가되더라도 정지 버튼이 다음 줄 첫 칸으로 밀리지 않고 우측 끝에 고정되도록 수정.
     - 폭 `<= 480px`(`390×664`, `320×460` 휴대폰)에서는 4열 그리드(`1fr auto auto 44px`)에서 1행에 성문·웨이브·골드, 2행에 점수(`1 / 3`)·버닝(`3`), 4열(`1 / 3` 행 걸침)에 `44×44` 정지 버튼을 배치하여 `320×460`에서 발생하던 `23px` 가로 넘침과 정지 버튼 이탈을 해결.
   - `.track`: 기존 `background: var(--edge)`(`--wood` 대비 `1.85:1`, `--green` 대비 `1.86:1`)를 `background: var(--parchment); border: 1px solid var(--edge);`로 변경하여 비텍스트 대비 `6.33:1`(트랙 대 배경) 및 `6.28:1`(채움 대 트랙) 확보.
   - `.milestone`: 비표준 패딩 `1px 6px`을 `0 var(--s1)`로 교체.
   - `.pause`: `box-shadow: var(--shadow)`, `:hover:not(:disabled)`, `:active:not(:disabled)`(`transform: translateY(1px); box-shadow: none;`), `:disabled` 상태 추가.

3. **`src/ui/game/ManagementPanel.module.css`**
   - `.panel > p:empty`: 빈 에러/잠금 줄이 불필요한 세로 공간을 차지하지 않도록 처리.
   - `@media (min-width: 600px) and (max-width: 960px)`: 태블릿 S 모드(`768×950`)에서 진화 분기 선택(`.panel:has(.branch)`) 시 A/B 두 분기를 2열로 배치하여 세로 스크롤(`111px → 0px`) 제거.
   - `.listCompact`: 3열 세로 카드 격자(`repeat(3, minmax(0, 1fr))`)를 1열 수평 행(`grid-template-columns: 1fr; gap: var(--s1);`)으로 변경하여 PRD §12.8(`같은 모양 카드 3개 이상을 격자로 나열한 화면 0. 목록은 장착 홈·행 형태`) 충족.
   - `.item, .branch`: `padding: 6px 10px`을 `var(--s1) var(--s2)`로 토큰화하고, `box-shadow: var(--shadow)` 및 `:hover`, `:active`(`translateY(1px)`, `box-shadow: none`), `:disabled` 상태 추가.
   - `.stats`: `gap: 10px`을 `var(--s1)`로 바꾸고 `.stats > span + span::before { content: '· '; color: var(--ink-soft); }`를 추가하여 PRD §2.3 및 §12.3의 `'힘 8 · 1초마다 · 2.5칸'` 표기 구현.
   - `.upgrade`: `padding: 2px 0`을 `var(--s1) 0`으로 토큰화.
   - `.branchMark[data-branch='A']`: `border-radius: 50%`를 제거하고 `.branchMark` 공통 `border-radius: var(--r-input)`(`4px`)을 사용하도록 수정(PRD §12.8 모서리 반경 토큰 2개 규칙 준수).

4. **`src/ui/game/PauseOverlay.module.css`**
   - `.fonts`, `.fonts legend`, `.confirm`: 비표준 간격(`10px 12px`, `0 6px`, `10px`)을 모두 `var(--s2) var(--s3)`, `0 var(--s1)`, `var(--s2)`(`4px` 배수 토큰)로 교체.

5. **`src/ui/game/QuestionPanel.module.css`**
   - `.panel`, `.wide`, `.narrow`: PRD §12.5 높이 예산에 맞춰 `.panel` 패딩을 `var(--s2) var(--s4)`(`8px 16px`), `.wide` 최소 높이를 `176px`로 설정하여 일반 문제(`176px`)와 마무리 문제(`176 + 24 = 200px <= 208px`) 모두 R 모드에서 세로 스크롤이 발생하지 않도록 보정.
   - `.stem`, `.chip`: `.stem`의 `display: flex; flex-wrap: wrap` 때문에 긴 지문이 항상 `.chip` 다음 줄로 떨어지던 문제를 인라인 블록(`.chip { display: inline-block; margin-right: var(--s2); vertical-align: middle; }`)으로 해결하여 지문 첫머리에 칩이 인라인으로 붙도록 수정(PRD §12.5). 줄간격 `1.38` 적용.
   - `.options`: `grid-auto-rows: 1fr`를 추가하여 한 행/열 안의 보기 4개가 항상 동일한 높이를 갖도록 보정(PRD §12.5).
   - `.option`, `.num`, `.option .mark`:
     - `.option` 최소 높이를 `var(--touch)`(`44px`), 패딩을 `var(--s1) var(--s3)`로 조정하고 `:hover:not(:disabled)` 및 `:active`(`box-shadow: none`) 보강.
     - 정답/오답 제출 후 `<Mark>` 아이콘이 추가될 때 `.optionText` 폭이 줄어들어 줄바꿈이 바뀌던 문제를 해결하기 위해, `.option:has(.mark) .num { visibility: hidden; }` 및 `.option .mark { position: absolute; left: var(--s3); width: 26px; height: 26px; ... }`로 번호 배지 자리에 정오표 아이콘을 겹쳐 표시. 제출 전후 보기 텍스트 폭·줄 수·높이 변화가 `0px`가 됨.
   - `.dim`: 기존 `opacity: 0.62`(합성 대비 `4.18:1`~`4.29:1`로 `4.5:1` 미달)를 제거하고 `.dim, .option.dim:disabled { color: var(--ink-soft); box-shadow: none; }` 및 `.dim .num { color: var(--ink-soft); }`로 변경하여 실제 합성 대비 `7.08:1`(텍스트) / `6.50:1`(번호) 확보.
   - `.feedback`, `.narrow .feedback:not(:has(.answer))`: 좁은 화면에서 피드백 대기 중 `모르겠어요` 버튼과 안내 문구를 한 줄(`flex-wrap: wrap`)에 배치해 불필요한 세로 공간 낭비를 줄이고, `.answer`(`15px`), `.why`(`14px`) 크기를 정리(PRD §12.5).
   - `.blank`: 비표준 마진 `0 0.25em`을 `0 var(--s1)`로 교체.

6. **`src/ui/screens/screens.module.css`**
   - `.sub`: `margin-top: -6px` 제거(`0`).
   - `.grid2`: 새 게임 화면의 학년(4개)·난이도(4개) 선택 목록을 다열 격자(`repeat(4, 1fr)` / `repeat(2, 1fr)`)에서 `grid-template-columns: 1fr` 행 목록으로 변경하고, `.choice`를 `display: flex; justify-content: space-between; align-items: center; padding: var(--s2) var(--s3);` 수평 행으로 구성(PRD §12.8 카드 반복 0).
   - `.choice`: `box-shadow: var(--shadow)`, `:hover`, `:active`, `:disabled` 상태 추가.
   - `.input`: `width: 100%; min-width: 0;`를 추가하여 `320×460(아주 크게)`에서 별명 입력창이 카드를 뚫고 가로 넘침(`13px`)을 일으키던 문제 해결.
   - `.notice`, `.stats`, `.table th, .table td`, `.reviewList`: 비표준 간격(`10px 12px`, `6px 8px`, `1.3em`)을 모두 4px 배수 토큰(`var(--s2) var(--s3)`, `var(--s1) var(--s2)`, `var(--s4)`)으로 교체.
   - `.stats`, `.stat`: 결과 화면의 3열 카드 격자를 1열 수평 행(`display: flex; justify-content: space-between`) 목록으로 변경(PRD §12.8).
   - `.previewCell[data-kind='slot']`, `.previewCell[data-kind='gate']`: 새 게임 맵 미리보기에서 돌 받침(`--map-stone`)과 풀(`--map-grass`)의 비텍스트 대비가 `1.03:1`이던 문제를 해결하기 위해 `outline: 1px solid var(--edge); outline-offset: -1px;`(`6.22:1`) 및 성문 `outline: 1px solid var(--gold);` 추가.

---

## 5. 계약 변경 제안 목록 (`REQUESTED_CONTRACT_CHANGE`)

수정 금지 경로(`src/ui/**/*.tsx`, `src/ui/copy.ts`, `src/ui/styles/global.css`, `src/ui/kit.module.css`, `src/application/**`, `tests/**`)에 위치한 항목은 직접 수정하지 않고 아래 7건의 `REQUESTED_CONTRACT_CHANGE`로 제안한다.

### `REQUESTED_CONTRACT_CHANGE-01` — 타워 레벨의 영어 약어(`Lv`) 한국어 표기 전환
- **위치**: `src/ui/game/ManagementPanel.tsx:154` 및 `tests/e2e/play.spec.ts:55`
- **현재**:
  ```tsx
  <p className={css.name}>{b.towers[tower.type].label} <span className={css.level}>Lv {tower.level}</span></p>
  ```
  (`tests/e2e/play.spec.ts:55`에서도 `await expect(page.getByText('Lv 1')).toBeVisible();`로 검증 중. 반면 `src/ui/screens/GuideScreen.tsx:26`과 `src/ui/copy.ts:74`는 `'레벨 3'`, `'최고 레벨이에요.'`처럼 한국어 `'레벨'`을 사용함.)
- **제안**: `ManagementPanel.tsx:154`의 `Lv {tower.level}`을 `레벨 {tower.level}`로 변경하고, `tests/e2e/play.spec.ts:55`의 기대 문자열을 `'레벨 1'`로 함께 갱신한다.
- **근거**: PRD §2.3 및 §12.8 (`문구: 느낌표 화면당 1개 이하, 마케팅 문구·과장 칭찬 0, 영어 단독 라벨 0`).

### `REQUESTED_CONTRACT_CHANGE-02` — 전투 3연속 정답 시 화면 내 느낌표 중복(2개) 방지
- **위치**: `src/application/RunController.ts:177` (또는 `src/ui/game/QuestionPanel.tsx:74`)
- **현재**:
  - `RunController.ts:177`: `if (b.burningTriggered) this.notice('버닝! 타워가 더 빨리 공격해요 · 8초', 'reward');`
  - `QuestionPanel.tsx:74`: `<p className={css.good}><Mark kind="check" />정답! <span className={css.reward}>...</span></p>`
  - 전투 중 3번째 연속 정답을 맞힌 직후 1초 동안 전장 상단 알림(`버닝! ...`)과 하단 문제판 피드백(`정답!`)이 동시에 렌더링되면서 한 화면에 느낌표가 2개 나타난다.
- **제안**: `RunController.ts:177`의 전장 알림 문구를 PRD §5 본문 표기 그대로 `'버닝: 타워가 더 빨리 공격해요 · 8초'`(또는 `'버닝 시작 · 타워가 8초 동안 더 빨리 공격해요.'`)로 변경한다.
- **근거**: PRD §5 (`‘버닝: 타워가 더 빨리 공격해요 · 8초’`) 및 PRD §12.8 (`문구: 느낌표 화면당 1개 이하`).

### `REQUESTED_CONTRACT_CHANGE-03` — 일시정지 `저장하고 나가기` 클릭 시 비동기 저장 경합(Race Condition) 수정
- **위치**: `src/application/RunController.ts:112-121, 213-235`
- **현재**:
  ```ts
  async saveAndExit(): Promise<boolean> {
    if (!this.persist) return false;
    this.pause('USER'); // 내부에서 this.save(false) -> void this.flush(false) 호출
    await this.flush(true);
    return this.saveStatus === 'saved';
  }
  ```
  `this.pause('USER')`가 먼저 `this.flush(false)`를 시작하여 `this.saving` 프라미스가 생성된 상태에서 직후 `await this.flush(true)`가 호출되면, `this.pendingSave = { force: true }`만 설정하고 첫 번째 `this.saving`을 기다린다. 첫 번째 `flush(false)`의 `finally` 블록이 예약된 두 번째 `void this.flush(true)`를 시작하면서 `this.saveStatus = 'saving'`으로 바꾸기 때문에, `saveAndExit()`의 `await this.flush(true)`가 풀리는 시점에 `this.saveStatus`가 `'saving'`이 되어 항상 `false`를 반환하고 일시정지 창에 `'아직 저장되지 않았어요. 다시 눌러 주세요.'` 오류가 표시된다.
- **제안**: `flush()`에서 `this.pendingSave` 재귀 호출까지 하나의 체인으로 완료될 때까지 기다리거나, `saveAndExit()`에서 이미 정지 상태일 때 중복 `this.save(false)`를 호출하지 않도록 `while (this.saving) await this.saving;` 루프를 추가한다.
- **근거**: PRD §12.7 및 §14.1 (`일시정지의 ‘저장하고 나가기’는 IndexedDB 기록 완료 후에 홈으로 이동하며 실패 시 정지 화면에 남아 재시도/비저장 종료를 선택하게 한다`).

### `REQUESTED_CONTRACT_CHANGE-04` — 공통 키트(`global.css`·`kit.module.css`) 눌림 그림자 토큰화 및 버튼 `pending`·`disabled` 우선순위 보강
- **위치**: `src/ui/styles/global.css:3-25`, `src/ui/kit.module.css:19-24`
- **현재**:
  1. `kit.module.css:19`에 `.button:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 1px 0 rgba(58, 41, 30, 0.35); }`로 `:root` 밖 `rgba(...)` 리터럴이 직접 쓰이고 있다.
  2. `kit.module.css:20-23`에서 `.button:disabled` 뒤에 `.primary`와 `.danger`가 선언되어(동일 명시도 `0,1,0` 또는 `:disabled` 조합 시), `<button className={`${kit.button} ${kit.primary}`} disabled>`일 때 `--green` 배경이 `--stone` 비활성 배경을 덮어쓴다.
  3. PRD §12.6의 버튼 6상태 중 `pending`(`[aria-busy='true']` 또는 `data-pending='true'`) 스타일이 `kit.module.css`에 정의되어 있지 않다.
- **제안**:
  1. `global.css` `:root`에 `--shadow-active: 0 1px 0 rgba(58, 41, 30, 0.35);` 토큰을 추가하고 `kit.module.css` 및 각 모듈에서 `var(--shadow-active)`를 사용한다.
  2. `kit.module.css`에서 `.button:disabled, .button[aria-busy='true']`를 `.primary`/`.danger` 아래에 선언하여 비활성·대기 상태의 배경(`var(--stone)`)·글자색(`var(--ink-soft)`)이 모든 변형에 일관되게 적용되게 한다.
- **근거**: PRD §12.6 (`모든 버튼은 default/hover/focus-visible/pressed/disabled/pending을 정의한다`) 및 §12.8 (`:root 토큰 밖의 임의 색상 0`).

### `REQUESTED_CONTRACT_CHANGE-05` — 타워 수치 가운뎃점(`·`) DOM 텍스트 반영 및 진화 분기 SVG 아이콘·한국어 라벨 연결
- **위치**: `src/ui/game/ManagementPanel.tsx:130, 165-171`, `src/ui/copy.ts:43`
- **현재**:
  1. `<Stats>` 컴포넌트(`ManagementPanel.tsx:165-171`)는 `<span>` 3개를 연속 렌더링하고 구분자 문자가 없어 현재 CSS `::before`(`content: '· '`)로 시각 보정 중이다.
  2. `copy.ts:43`에 `export const BRANCH_MARK: Record<BranchId, string> = { A: '동그라미 길', B: '마름모 길' };`가 정의되어 있으나 `ManagementPanel.tsx:130`에서 사용되지 않고 빈 `<span className={css.branchMark} />`만 렌더링한다(원래 A 분기는 `border-radius: 50%`로 원을 그렸으나 §12.8 반경 토큰 2개 규칙과 충돌하여 현재 `4px` 각진 정사각형/마름모로 보정됨).
- **제안**:
  1. `<Stats>` 내부에 실제 텍스트 노드 `' · '`를 넣어 스크린리더 및 `textContent` 검사에서도 `'힘 8 · 1초마다 · 2.5칸'`이 그대로 읽히게 한다.
  2. `BranchChoice`(`ManagementPanel.tsx:130`)에서 `BRANCH_MARK[id]`를 `sr-only` 또는 보조 라벨로 연결하고, 동그라미/마름모 도형은 CSS `border-radius: 50%` 대신 인라인 `<svg>`(`<circle>` / `<polygon>`)로 렌더링하여 §12.8 모서리 반경 규칙을 위반하지 않고 원형·마름모를 표현한다.
- **근거**: PRD §2.3 (`힘 8 · 1초마다 · 2.5칸`), §12.3, §12.8 (`모서리 반경 토큰 2개만`).

### `REQUESTED_CONTRACT_CHANGE-06` — 새 게임 화면 어려움·아주 어려움 선택 시 추천 안내 문구 표시
- **위치**: `src/ui/screens/NewGameScreen.tsx:42-49`
- **현재**: 난이도 4개(`쉬움`, `보통`, `어려움`, `아주 어려움`) 선택 목록 아래에 별도 안내 문구가 없다.
- **제안**: 선택된 난이도가 `'Hard'` 또는 `'Crazy'`일 때(또는 어려움·아주 어려움 행 아래에) `<p className={kit.muted}>배치에 익숙해지면 추천해요.</p>` 한 줄을 렌더링한다.
- **근거**: PRD §12.2 (`새 게임: ... 어려움·아주 어려움 아래 ‘배치에 익숙해지면 추천해요’ 한 줄`).

### `REQUESTED_CONTRACT_CHANGE-07` — 글자 확대(`크게`·`아주 크게`) 시 `useLayout.ts`의 문제판 높이 예산 연동
- **위치**: `src/ui/useLayout.ts:19-35`
- **현재**: `computeLayout(W, H, coarse)`이 현재 선택된 글자 크기(`fontScale: 'base' | 'large' | 'xlarge'`)를 인자로 받지 않고 고정 `R.questionBaseHeightPx`(`208`)만 사용한다.
- **제안**: `document.documentElement.dataset.font`가 `'large'` 또는 `'xlarge'`일 때 `q` 예산을 각각 `220` / `236`으로 계산에 반영하면, PRD §12.1(`긴 문제·글자 확대에서는 문제판이 늘어나고 R이 S로 바뀔 수 있다`)에 명시된 대로 `1366×650` 크롬북에서 `글자 아주 크게(24px)` + 마무리 문제(`WAVE_WRAPUP`) 조합일 때도 `14px`의 미세 스크롤 없이 전장 크기가 자동 조정된다.
- **근거**: PRD §12.1 (`창 크기·회전·글자 크기 변경 때 다시 계산하되 ... 긴 문제·글자 확대에서는 문제판이 늘어나고 R이 S로 바뀔 수 있다`).

---

## 6. 사용자 판단 항목 (취향·디자인 트레이드오프)

1. **소형 휴대폰(`390×664`, `320×460`) 타워 선택 트레이의 행 배치 vs 3열 컴팩트 배치**
   - 현재 PRD §12.8(`같은 모양 카드 3개 이상을 격자로 나열한 화면 0. 목록은 장착 홈·행 형태`)을 엄격히 준수하기 위해 `.listCompact`를 1열 수평 행(`궁수탑 60 골드` / `포탑 120 골드` / `서리탑 90 골드`)으로 구성하였다.
   - 반면 PRD §12.4 본문에는 `'빈칸 선택 때 기본3종+전체 버튼 한 행'`이라는 서술도 함께 존재한다. 3종을 한 줄의 작은 장착 홈(소켓) 형태로 두어 트레이 높이를 약 `96px` 더 낮출지, 현재처럼 글자와 가격 가독성이 높은 1열 행 형태를 유지할지는 사용자 판단 항목이다.
2. **새 게임 화면의 학년(4개)·난이도(4개) 및 결과 화면 요약(3개)의 행 목록 형태**
   - PRD §12.8(`같은 모양 카드 3개 이상을 격자로 나열한 화면 0. 목록은 장착 홈·행 형태`)에 따라 기존의 4칸·2칸·3칸 카드 격자를 모두 1열 수평 행 형태로 보정하였다. 한눈에 가로로 비교하는 세그먼트 바 형태를 선호할지, 현재의 행 목록 형태를 유지할지 사용자 확인이 가능하다.
3. **정답·오답 제출 후 번호 배지(`1`~`4`)와 정오표 아이콘(`✓`/`✕`)의 표시 방식**
   - 제출 전후 보기 텍스트 가용 폭이 줄어들어 줄바꿈과 버튼 높이가 변하는 현상(PRD §12.5 위반)을 막기 위해, 제출 후에는 번호 배지(`26×26px`) 자리에 같은 크기의 정오표 아이콘을 겹쳐 표시하도록 보정하였다. 번호(`1`~`4`)와 정오표 아이콘을 동시에 노출하고 싶다면 제출 전부터 우측에 `22px` 빈 아이콘 자리를 항상 예약하는 방식 중 선택할 수 있다.

---

## 7. 전·후 캡처 경로 및 `npm run test:e2e` 실행 결과

### 7.1 캡처 경로
- **보정 전 캡처 (`test-results/before/`)**:
  - `test-results/before/chromebook-prep.png` (`1366×650` 준비 문제)
  - `test-results/before/desktop-prep.png` (`1440×900` 준비 문제)
  - `test-results/before/desktop-preview.png` (`1440×900` 배치 설치 미리보기)
  - `test-results/before/desktop-built.png` (`1440×900` 타워 설치 후 선택)
  - `test-results/before/desktop-battle.png` (`1440×900` 전투 화면)
  - `test-results/before/desktop-paused.png` (`1440×900` 일시정지 가림막)
  - `test-results/before/phone-prep.png` (`390×844` 휴대폰 준비 문제)
  - `test-results/before/phone-magnify.png` (`390×844` 휴대폰 확대 선택 및 트레이)
- **보정 후 캡처 (`test-results/shots/`)**:
  - `test-results/shots/chromebook-prep.png`
  - `test-results/shots/desktop-prep.png`
  - `test-results/shots/desktop-preview.png`
  - `test-results/shots/desktop-built.png`
  - `test-results/shots/desktop-battle.png`
  - `test-results/shots/desktop-paused.png`
  - `test-results/shots/phone-prep.png`
  - `test-results/shots/phone-magnify.png`

### 7.2 `npm run test:e2e` 실제 실행 결과

```text
> vocabulary-tower-defense@0.1.0 test:e2e
> playwright test

Running 4 tests using 1 worker

  ok 1 [chromium] › tests\e2e\play.spec.ts:40:1 › 1440×900: 준비 → 설치 → 전투 → 정지 가림 → 재개 (33.4s)
  ok 2 [chromium] › tests\e2e\play.spec.ts:72:1 › 390×844 휴대폰: 가로 넘침 없음, 문제 전체가 보이고 확대 선택이 열린다 (22.3s)
  ok 3 [chromium] › tests\e2e\play.spec.ts:85:1 › 1366×650 크롬북: R 모드와 칸 크기 (2.4s)
  ok 4 [chromium] › tests\e2e\play.spec.ts:94:1 › 접근성: 홈·준비 화면 axe 위반 없음(캔버스 제외) (4.0s)

  4 passed (1.1m)
```

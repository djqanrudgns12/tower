# R6 홈 ‘오늘의 낱말’ 카드 초상 규격 (`portrait-spec.md`)

- 기준: `docs/renewal/r6/PRD-r6.md` §2·§4·§7, `docs/renewal/r6/bible/world.md`, `docs/renewal/r6/bible/monsters.md`
- 대상 컴포넌트: [SteleStudyPanel.tsx](file:///Users/bodyking/Desktop/Architecture/towerdeffense/src/ui/screens/home/SteleStudyPanel.tsx), [home.module.css](file:///Users/bodyking/Desktop/Architecture/towerdeffense/src/ui/screens/home/home.module.css)
- 비교 시트: [monsters-portraits-preview.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portraits-preview.webp)

---

## 1. 현행 구조 분석 및 교체 사유

1. **현행 에셋(옛 41번 화풍)**: `SteleStudyPanel.tsx`의 `STUDY_MONSTER_ARTS`는 `public/assets/ui/study/study.monster.01.webp` ~ `30.webp` (`192×192` WebP) 30장을 사용한다. 밝은 파스텔 동화 풍경·치비 비율·빛 번짐 화풍으로, R6의 R04 무광 전술 UI(`#12161B`·`#1D242C`·`#4A5563`·`#B8C0C8`·`#E69F24`·`#2FB5A3`) 및 새 5종족 몬스터와 이질감이 크다.
2. **반응형 CSS 왜곡 결함**: `home.module.css`의 `.steleGardenFrame`은 기본적으로 정사각(`100×100`, `84×84`, `78×78`, `96×96`)이나, `home.module.css:1423-1426` 구간에서 `width: 88px; height: 172px;` 직사각으로 설정되어 `object-fit: cover` 시 초상 좌우가 잘린다. R6 적용 시 해당 브레이크포인트를 `width: 88px; height: 88px;` 정사각으로 통일한다.

---

## 2. R6 초상 파일 · 해상도 · 용량 규격

| 항목 | 규격 | 비고 |
|---|---|---|
| **해상도** | **`256 × 256 px` (1:1 정사각)** | 데스크톱 `100×100px` 2× 레티나(200px) 이상 대응 |
| **포맷 · 압축** | 정적 불투명 WebP (`cwebp -q 88 -m 6`) | 알파 채널 불필요(불투명 카드 내부 배경 포함) |
| **파일 크기 예산** | **장당 ≤ 18 KB** (30장 합계 **≤ 540 KB**) | 예시 5장 실측 `12.3 ~ 16.2 KB` |
| **파일명 규칙** | `public/assets/ui/study/r6.portrait.<race>.<01~06>.webp` | `<race>` = `elf \| human \| mech \| insect \| golem` |
| **생성 원본 경로** | `asset-source/r6/monsters/<race>/portrait-<01~06>.webp` | 1024×1024 채택 원본만 WebP 보관 (`cwebp -q 92`) |

---

## 3. 구도 · 배경 · 틀 · 표정 규약

1. **구도 (흉상 70% 점유 원칙)**:
   - 3/4 정면 흉상(머리·어깨·상흉부 중심). 허리 아래 전신이나 긴 무기를 억지로 넣지 않는다.
   - 피사체 점유율 **가로·세로 68~76%**, 상·좌·우 최소 **12% 안전 여백**을 유지해 `78×78px` 소형 카드에서도 얼굴과 투구·뿔·센서 특징이 즉시 판독되게 한다.
   - 하단 경계는 가슴선에서 자연스럽게 캔버스 바닥에 밀착해 공중 절단 느낌을 피한다.
2. **배경 및 밝은 고대비 카드(`.studyCard`) 대응**:
   - 홈 ‘오늘의 낱말’ 카드는 교실 프로젝터 가독성을 위해 밝은 고대비 면(`#F2F4F7` / `#FFFFFF`)을 사용한다.
   - 초상 내부 배경을 **어두운 R04 전술 슬레이트(`#1D242C`) + 저대비 등고선 선화(`#2C3540`, 1px)**로 통일하여 밝은 카드 위에서도 액자 경계가 또렷하게 분리되도록 한다.
3. **UI 프레임 규칙 (CSS 구현, 원화 내부에 프레임 그리지 않음)**:
   - 테두리 `1px solid #4A5563`, 모서리 `--chamfer-sm` (`6px` 45° 모따기 또는 둥글기).
   - 프레임 하단 `3px` 종족 강조색 띠:
     - `elf` 숲 엘프: `#2FB5A3` (틸)
     - `human` 철갑 인간: `#B8C0C8` (은회)
     - `mech` 기계 군단: `#2FB5A3` (틸)
     - `insect` 군체 벌레: `#E69F24` (앰버)
     - `golem` 바위 거인: `#E69F24` (앰버)
4. **화풍 · 표정 · 금지 기준**:
   - 좌상단 45° 단일 광원, 무광 3단 셀 명암, `#12161B` 외곽선, R04 6색 제한 팔레트.
   - **표정**: 차분하고 단단한 대기·집중 시선(학습 카드 옆에서 시선을 산만하게 빼앗지 않는 안정감).
   - **절대 금지**: 치비(2등신), 과장된 웃음/윙크, 피·상처·공포·혐오, 네온 블룸·반짝이, 원화 내 텍스트/테두리/라벨.

---

## 4. 30장 풀 구성 및 종족 순환 규칙

### 4.1 종족 × 계통 배분 (총 30장 = 5종족 × 6장)
각 종족당 6장은 해당 종족의 진화 스펙트럼을 대표하도록 아래 비율로 구성한다.
- **보병(Infantry) 1장** (`01`): T3~T4 대표 개체 흉상
- **질주(Rush) 1장** (`02`): T2~T4 대표 야수/기체 흉상
- **중장갑(Heavy) 1장** (`03`): T3~T4 투구·어깨갑 중심 흉상
- **특수(Special) 1장** (`04`): 정령/공성 포수/드론/갑충/수정핵 상부
- **보스(Boss) 2장** (`05`, `06`): W5 지휘관급 + W20 최종 보스급 흉상

### 4.2 종족 순환 덱 알고리즘 (5종족 블록 셔플)
기존 `SteleStudyPanel.tsx`의 단순 30장 전체 Fisher-Yates 셔플은 랜덤 버튼 연속 클릭 시 같은 종족이 3~4번 연속 나올 수 있다. R6에서는 아래 **5종족 블록 라운드 로빈 셔플**을 적용한다.
1. 30장 풀을 종족별 6장 배열(`elf[6]`, `human[6]`, `mech[6]`, `insect[6]`, `golem[6]`)로 나누고 각 종족 내부를 Fisher-Yates 셔플한다.
2. 총 6개 라운드(`k = 0..5`)마다 5종족에서 `k`번째 이미지를 1장씩 꺼내 5장 블록을 만든 뒤, 블록 내부 5개 순서만 셔플한다.
3. **블록 경계 연속 금지**: 이전 블록 마지막 종족과 다음 블록 첫 종족이 같으면, 다음 블록의 0번과 1번 원소를 맞바꾼다.
4. 재셔플 시 직전 표시 이미지 및 직전 종족과의 연속 중복을 0건으로 유지하며, 기존의 **다음 1장 백그라운드 예열(`nextArt`)**은 그대로 유지한다.

---

## 5. 종족별 생성 현황 (30 / 30 완료)

- **총괄 수치(2026-11-27 00:36 KST 기준)**: 완료 `30/30` (`256×256` 불투명 WebP 장당 `8.2 ~ 17.0 KB`, 예산 `≤ 18 KB` 전원 통과, 합계 `410.4 KB / 540 KB`).
- **보정·교체 반영**: `mech-04`·`golem-04`·`elf-04` 점유율 크롭 보정 완료(원본 1024px 기준 가로·세로 점유 80~88%), `human-05` 가슴 십자 문장 → 중립 R04 앰버 독수리 문장 교체 완료(전 30장·전장 100개체 종교 상징 0건).

| 종족 | 완료 수 | 게임용 256×256 WebP 범위 · 소계 | 모델 개체 (`01~06`) | 현재 상태 및 비고 |
|---|---|---|---|---|
| **기계 군단 (`mech`)** | `6 / 6` | `9.8 ~ 13.1 KB` (소계 `71.3 KB`) | `mech_infantry_t4`, `mech_rush_t3`, `mech_heavy_t4`, `mech_special_t2`, `mech_boss_5`, `mech_boss_20` | **완료 · 78px/실루엣 검수 통과** (`04` 점유율 크롭 보정 반영) |
| **바위 거인 (`golem`)** | `6 / 6` | `8.2 ~ 15.3 KB` (소계 `78.2 KB`) | `golem_infantry_t4`, `golem_rush_t4`, `golem_heavy_t4`, `golem_special_t2`, `golem_boss_5`, `golem_boss_20` | **완료 · 78px/실루엣 검수 통과** (`04` 점유율 크롭 보정 반영) |
| **철갑 인간 (`human`)** | `6 / 6` | `14.2 ~ 16.1 KB` (소계 `91.8 KB`) | `human_infantry_t4`, `human_rush_t4`, `human_heavy_t4`, `human_special_t4`, `human_boss_5`, `human_boss_20` | **완료 · 78px/실루엣 검수 통과** (`05` 앰버 독수리 문장 교체, `06`만 `q82`) |
| **숲 엘프 (`elf`)** | `6 / 6` | `11.6 ~ 16.3 KB` (소계 `84.5 KB`) | `elf_infantry_t4`, `elf_rush_t4`, `elf_heavy_t4`, `elf_special_t4`, `elf_boss_5`, `elf_boss_20` | **완료 · 78px/실루엣 검수 통과** (`01·04·05·06` 신규, `04` 점유율 보정) |
| **군체 벌레 (`insect`)** | `6 / 6` | `12.6 ~ 17.0 KB` (소계 `84.7 KB`) | `insect_infantry_t4`, `insect_rush_t4`, `insect_heavy_t4`, `insect_special_t4`, `insect_boss_5`, `insect_boss_20` | **완료 · 78px/실루엣 검수 통과** (`01~06` 신규 전용 1024px 흉상) |

---

## 6. 홈 화면 연결 상태

- **연결 완료**: [portraitDeck.ts](file:///Users/bodyking/Desktop/Architecture/towerdeffense/src/ui/screens/home/portraitDeck.ts), [SteleStudyPanel.tsx](file:///Users/bodyking/Desktop/Architecture/towerdeffense/src/ui/screens/home/SteleStudyPanel.tsx), [home.module.css](file:///Users/bodyking/Desktop/Architecture/towerdeffense/src/ui/screens/home/home.module.css)
- **구현 내용**:
  - `STUDY_MONSTER_ARTS`를 R6 5종족×6장(`r6.portrait.<race>.<01~06>.webp`) 30장으로 교체하고, 옛 `study.monster.01~30.webp` 30장은 보존함(`HomeScreen`·`SteleStudyPanel`에 v1 분기가 없어 R6 초상만 사용).
  - §4.2의 5종족 블록 라운드 로빈 셔플(`shufflePortraitDeck` · `advancePortraitDeck`) 및 `nextArt` 1장 백그라운드 예열 적용.
  - `home.module.css`의 `88×172` 직사각 왜곡을 `88×88` 정사각으로 수정하고, §3.3의 `1px #4A5563` 테두리 + `--chamfer-sm` 모따기 + 하단 `3px` 종족 강조색 띠를 CSS로 적용함.
- **검증 및 캡처**: 단위 시험 `tests/unit/ui/r6-home-portraits.test.ts`, e2e `tests/e2e/home.spec.ts`, 4개 뷰포트 캡처 `docs/renewal/r6/tech/home-portraits/` (`1366×768`, `1280×800`, `1920×1080`, `768×1024`).

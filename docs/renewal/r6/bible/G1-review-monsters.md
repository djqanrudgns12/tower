# R6 G1 몬스터 5종족 아트 바이블 검수 · 비평 보고서

- 검수 일시: `2026-11-25 11:25 KST`
- 단일 기준: `docs/renewal/r6/PRD-r6.md` §2·§4·§8 G1, `docs/renewal/r6/bible/world.md`, `docs/renewal/r6/bible/monsters.md`
- 화풍 대조 기준: `docs/renewal/r6/round3/concepts/R04/c-enemies.webp`, `test-results/r6-towers/lv20-attack.webp`
- 상태: **5종족 라인업 5장 + 파츠 분해도 5장 + 초상 비교판 1장 + 초상 예시 5장 + 규격/검수 문서 완비 / 1차 비평가 반려 항목 및 전용 초상 4종은 HTTP 429 할당량 리셋(`~15:50 KST`) 후 재생성 큐 등록**

---

## 1. 이미지 생성 한도(HTTP 429) 발생 및 차단 내역

| 항목 | 내용 |
|---|---|
| **발생 시각** | `2026-11-25 11:12:40 ~ 11:13:15 KST` (총 31장 원화 생성 성공 직후 발생) |
| **오류 메시지** | `HTTP 429 RESOURCE_EXHAUSTED` — 리셋 대기 약 `4h 37m ~ 4h 38m` (`~15:50 KST` 이후 재개 가능) |
| **생성 완료 원화** | 라인업 5종 × 3안(15장) + 파츠 분해도 5종 × 3안(15장) + `mech` 전용 초상 1장 = **31장** |
| **429 차단 대상** | 홈 전용 1024px 초상 4종(`elf`, `human`, `insect`, `golem`) 및 파츠 3차 보정 4건 |
| **대응 원칙** | 가짜/도형 그림 미생성. `elf`·`human`·`insect`·`golem` 초상 예시 4장은 채택 원화(파츠 분해도 좌측 고화질)에서 흉상을 투명 추출해 R04 등고선 슬레이트 배경(`#1D242C`)과 합성한 1차 시범 `256×256` WebP로 제공하고, 429 리셋 후 전용 1024px 흉상 원화로 재촬영한다. |

---

## 2. 3안(후보) 시각 선별 결과

*(탈락 시안 및 생성 원본 JPG는 저장소 외 로컬 스크래치에만 보관, 저장소 내 PNG·탈락안 커밋 0건)*

### 2.1 5종족 20개체 라인업 선별 (15장 중 5장 채택)
| 종족 | 채택안 | 저장소 채택 원본 WebP | 선별 근거 및 탈락 사유 |
|---|---|---|---|
| **숲 엘프 (`elf`)** | **`v3`** | [elf/lineup-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/elf/lineup-raw.webp) | 5×4=20개체 정합, 전 개체 3/4 우향 일관, 틸 문양·목재 결 최상. (`v1`: 23개체 중복 배열로 탈락, `v2`: `elf_heavy_t1`만 좌향이라 방향 불일치로 탈락) |
| **철갑 인간 (`human`)** | **`v3`** | [human/lineup-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/human/lineup-raw.webp) | 5×4=20개체 정합, 은회 판금·앰버 장식·공성 수레 4단계 완벽. (`v1`: 22개체·수레 중복, `v2`: 21개체·수레 중복으로 탈락) |
| **기계 군단 (`mech`)** | **`v1_clean`** | [mech/lineup-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/mech/lineup-raw.webp) | 5×4=20개체 정합, R04 `c-enemies.webp` 4종 원안(4족 드론·갑충·스텔스 늑대·3족 결정·다족 공성 거대기체) 계승. (`cand_v1`: 4×4+2×2 변칙 배치, `cand_v3`: 22개체로 탈락) |
| **군체 벌레 (`insect`)** | **`v1`** | [insect/lineup-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/insect/lineup-raw.webp) | 5×4=20개체 정합, 전 개체 3/4 좌향 일관, 매트 날개 맥·키틴 갑각 선명. (`v2`: 4행 21개체·유충 누락, `v3`: 4기 방향 혼재로 탈락) |
| **바위 거인 (`golem`)** | **`v2`** | [golem/lineup-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/golem/lineup-raw.webp) | 5×4=20개체 정합, 3/4 우향 일관, `W20` 성벽·수정 첨탑 각면 선명. (`v1`: 23개체로 탈락, `v3`: `v2` 대비 `특수 T3` 틸 수정 비율 열세) |

### 2.2 5종족 Spine 2D 파츠 분해도 선별 (15장 중 5장 채택)
| 종족 | 채택안 | 저장소 채택 원본 WebP | 선별 근거 및 탈락 사유 |
|---|---|---|---|
| **숲 엘프 (`elf`)** | **`v1`** | [elf/parts-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/elf/parts-raw.webp) | 좌측 T4 양날 미늘창·뿔투구 포즈와 우측 T1~T4 교체 키트(후드/쌍검/장창/뿔투구+미늘창) 일치. (`v2`: T4 민머리·단날, `v3`: T3/T4 교체 파츠에 팔·몸통 혼입) |
| **철갑 인간 (`human`)** | **`v3`** | [human/parts-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/human/parts-raw.webp) | 좌측 T4 전신과 상단 7개 코어 파츠 + 하단 T1~T4 방패/무기 4세트 R04 팔레트 일치. (`v1`: 방패 안쪽 갈색 톤 이탈, `v2`: 방패 문양 단순) |
| **기계 군단 (`mech`)** | **`v3`** | [mech/parts-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/mech/parts-raw.webp) | 좌측 T4 + 중앙 코어 8개 파츠(냉각핀 분리) + 우측 T1~T4 모듈 3열 정렬이 겹침 없이 최상. (`v1`/`v2` 대비 파츠 간격·분류 우수) |
| **군체 벌레 (`insect`)** | **`v3`** | [insect/parts-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/insect/parts-raw.webp) | 좌측 T4 3/4 좌향(라인업 일치)·6족 전수 노출·T1~T4 턱/등갑 분리 완벽. (`v1`: 다리 5개만 노출, `v2`: 텍스트 `"T1~T4"` 포함 또는 등갑 오배치) |
| **바위 거인 (`golem`)** | **`v2`** | [golem/parts-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/golem/parts-raw.webp) | 3열 구도 명확, 상완/전완·대퇴/하퇴 관절 분절 구현, T1~T4 스킨 파츠 정확. (`v1`: 좌측 하단 혼입, `v3`: 중앙 중복 파츠 존재) |

### 2.3 홈 초상 원화
- **기계 군단 (`mech`)**: `mech_portrait_v1` 채택 → [mech/portrait-raw.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/asset-source/r6/monsters/mech/portrait-raw.webp) (`1024×1024` WebP).
- **나머지 4종족**: `HTTP 429` 차단으로 전용 원화 미생성 → 각 채택 파츠 원화 좌측 T4 흉상 추출 시범본 제작.

---

## 3. 비평가 2명 검수 결과 및 보정 이력

### 3.1 비평가 판정 요약표 (아트 디렉터 ≥ 8.0/10 · 초6 `"멋있다"`)
| 대상 시트 | 아트 디렉터 (≥8.0) | 초6 학생 | 판정 | 핵심 코멘트 및 조치 현황 |
|---|---|---|---|---|
| `monsters-elf.webp` | **7.9 / 10** | **멋있다** (8.0/10) | **1차 반려** | 타워 화풍 정합·틸 목재 우수. **지적**: `질주 T3(사슴)` 뼈대 불일치, 앰버 5% 미흡, `32px` W20 축척 역전·T4 크롭 잘림. → **크롭·W20 축척 버그 즉시 수정 완료**, 원화 `질주 T3`·앰버 5% 보강은 429 리셋 큐. |
| `monsters-human.webp` | **7.6 / 10** | **멋있다** (8.5/10) | **1차 반려** | `32px` 가독성 최고. **지적**: `W10` 전차-말 연결·설정(`기병`) 불일치, `W15` 바퀴 빈약, `W5` 단색 금빛, `중장갑 T2↔T3` 방패 방향 혼선. → **429 리셋 후 원화 재생성 큐**. |
| `monsters-mech.webp` | **8.1 / 10** | **멋있다** (9.5/10) | **합격** (조건부) | R04/타워 화풍 연속성 최상. **권고**: `중장갑 T2(갑충)`만 뼈대가 달라 후속 뼈대 통일·`32px` 밝기 보강 권장. |
| `monsters-insect.webp` | **7.8 / 10** | **무섭다** (5.5/10) | **1차 반려** | 키틴·날개맥 우수하나 **유일한 3/4 좌향**(방향 불일치), 초6이 `특수 T3/W15` 알주머니·`W20` 지네를 징그럽다고 판정, `32px` 어두움. → **429 리셋 후 3/4 우향 통일 + 포자→단단한 고치·지네→갑각 대장군 순화 재생성 큐**. |
| `monsters-golem.webp` | **8.6 / 10** | **멋있다** (9.0/10) | **합격** | R04 무광 현무암·용암·수정 대비 및 `32px` 가독성 전 종족 최우수(`특수 T3` 부유형 보완만 권고). |
| `monsters-elf-parts.webp` | **7.1 / 10** | — | **1차 반려** | **지적**: 허벅지 파츠 시인성/누락, 관절 통짜, 할버드 날 수 차이, 하단 본 다이어그램 복붙. → **하단 본 계층도 종족 분기 완료**, 파츠 분절 원화는 429 리셋 큐. |
| `monsters-human-parts.webp` | **6.8 / 10** | — | **1차 반려** | **지적**: `pelvis`·`far-cloak` 파츠 누락, 관절 통짜, 라인업 T4 투구/방패 문양 불일치, 하단 본 복붙. → **하단 본 계층도 분기 완료**, 파츠 원화는 429 리셋 큐. |
| `monsters-mech-parts.webp` | **8.2 / 10** | **멋있다** | **합격** (조건부) | 8슬롯·T1~T4 교체 정합 최상. **수정 완료**: 하단 본 계층도를 **3단 역관절 SVG**로 교체 완료. (추후 관절 상하 분절만 권고) |
| `monsters-insect-parts.webp` | **7.7 / 10** | — | **1차 반려** | **지적**: 몸통 배판 누락 및 하단 6족 본 다이어그램 복붙. → **하단 본 계층도를 6족 절지 전용 SVG로 교체 완료**, 배판 추가는 429 리셋 큐. |
| `monsters-golem-parts.webp` | **8.4 / 10** | — | **합격** | **5종 중 유일하게 상완/전완·대퇴/하퇴 관절 분절 구현**, 라인업 일치 최상. **수정 완료**: 하단 역삼각 SVG 계층도 분기 완료. |
| `monsters-portraits-preview.webp` | **8.3 / 10** | **멋있다** (8.5/10) | **합격** | 옛 41번(초6: "유치하다") 대비 게임 도감 느낌 압도적 개선. **수정 완료**: 반응형 실크기 5칸에 `mech` 전용 초상 추가. |
| `monsters-portrait-mech.webp` | **9.3 / 10** | **멋있다** (9.5/10) | **합격** | 1024px 전용 원화, 구도·점유율·등고선 배경 완벽. |
| 초상 시범 4종 (`elf`·`human`·`insect`·`golem`) | **6.5 ~ 7.4 / 10** | **멋있다** (7~9/10) | **1차 반려** | 초6은 전원 "멋있다" 판정했으나, 아트 디렉터 기준 전신 크롭 한계로 얼굴 비중 축소·무기/하단 절단 지적. → **429 리셋 후 `mech` 기준 1024px 전용 흉상 4종 재촬영 큐**. |

### 3.2 이번 턴 시트 보정 반영 내역
1. `prepare_crops.py` 행별 좌우 비투명 경계 인식 + 시드 연결요소 크롭으로 `elf` `보병 T4` 미늘창 잘림 제거.
2. `32×32px` 전장 축소 띠에 실제 계통·보스 체급 위계(`T1 21px` → `T4 25px` → `W5 28px` → `W15 31px` → `W20 32px`) 반영해 `W20` 축척 역전 해결.
3. `render_sheets.mjs` 파츠 분해도 하단 SVG 본 계층도를 종족별(`이족`, `3단 역관절 mech`, `6족 절지 insect`, `역삼각 분절 golem`) 4종 전용 도식으로 교체.
4. `monsters-portraits-preview.webp` 반응형 실크기 패널에 `mech` 포함 5종족 전부(`100px`·`88px`·`84px`·`78px`×2) 반영.

---

## 4. 정량 자동 검수 결과 (`check_monsters.py` 실측)

*(허용 팔레트 기준: `tools/r6/qa/check.py`와 동일한 R04 6색 × 명도 4단 `[0.74, 0.88, 1.0, 1.12]`)*

### 4.1 1920×1080 시트 11장 & 256×256 초상 5장 실측표
| 파일 | 해상도 | 용량 | 비팔레트 고채도 (`v>0.22, s>0.35, d>55`) | 평균 팔레트 거리 | 판정 |
|---|---|---|---|---|---|
| `monsters-elf.webp` | `1920×1080` | `130,728 B` (127.7 KB) | `0.0795%` | `3.07` | **PASS** |
| `monsters-human.webp` | `1920×1080` | `142,550 B` (139.2 KB) | `0.2627%` | `3.42` | **PASS** |
| `monsters-mech.webp` | `1920×1080` | `128,032 B` (125.0 KB) | `0.0687%` | `2.98` | **PASS** |
| `monsters-insect.webp` | `1920×1080` | `144,552 B` (141.2 KB) | `0.2081%` | `3.48` | **PASS** |
| `monsters-golem.webp` | `1920×1080` | `148,676 B` (145.2 KB) | `0.1790%` | `3.82` | **PASS** |
| `monsters-elf-parts.webp` | `1920×1080` | `110,488 B` (107.9 KB) | `0.0839%` | `2.81` | **PASS** |
| `monsters-human-parts.webp` | `1920×1080` | `126,856 B` (123.9 KB) | `0.6711%` | `4.10` | **PASS** |
| `monsters-mech-parts.webp` | `1920×1080` | `127,456 B` (124.5 KB) | `0.1769%` | `3.42` | **PASS** |
| `monsters-insect-parts.webp` | `1920×1080` | `99,594 B` (97.3 KB) | `0.2357%` | `2.97` | **PASS** |
| `monsters-golem-parts.webp` | `1920×1080` | `121,462 B` (118.6 KB) | `0.4402%` | `4.01` | **PASS** |
| `monsters-portraits-preview.webp` | `1920×1080` | `120,518 B` (117.7 KB) | `0.6524%` *(옛 41번 비교 이미지 2장 포함)* | `7.98` | **PASS** |
| `monsters-portrait-mech.webp` | `256×256` | `13,604 B` (13.3 KB) | `0.3922%` | `7.58` | **PASS** (≤18KB) |
| `monsters-portrait-{elf,human,insect,golem}.webp` | `256×256` | `12,560 ~ 16,538 B` | `0.00% ~ 4.40%` *(추출 경계 앰버 안티앨리어싱)* | `5.10 ~ 14.09` | 1차 시범 (429 후 재촬영) |

### 4.2 32×32px 전장 슬레이트(`#1D242C`) 대비 실루엣 가독성 실측
| 종족 | 평균 전경 점유율 | 최소 피크 휘도차 (`ΔL`) | 평균 피크 휘도차 (`ΔL`) | 판정 |
|---|---|---|---|---|
| `elf` | `18.3%` | `0.343` | `0.522` | PASS (단 `질주 T4` 틸·은회 하이라이트 보강 권고) |
| `human` | `25.0%` | `0.524` | `0.653` | PASS (전 종족 최고 대비) |
| `mech` | `21.1%` | `0.310` | `0.370` | PASS (보스 W15/W20 틸·앰버 비중 상향 권고) |
| `insect` | `17.3%` | `0.236` | `0.405` | PASS (`보병 T1`·`중장갑 T4` 앰버 선 보강 권고) |
| `golem` | `23.3%` | `0.403` | `0.486` | PASS (최상위 대비) |

### 4.3 AI 티 8항목 & 저장소 규격 점검표
1. **팔레트 이탈 없음**: 라인업 원화 5종 비팔레트 고채도 비율 `0.0356% ~ 0.5148%` 통과(무채색 기반 톤 매핑 준수).
2. **단일 광원 일관성**: 5종족 모두 좌상단 45° 광원 및 3단 셀 명암 유지. (`insect` 3/4 좌향만 리셋 후 우향 통일 예정)
3. **해부·구조 설득력**: `mech`·`golem` 합격, `human W10` 연결부·`elf 질주 T3` 뼈대·`elf/human parts` 관절 분절은 429 리셋 큐로 보완.
4. **Spine 뼈대 호환성**: 계통별 T1→T4 동일 축 진화 구조 설계 및 종족별 본 계층 도식(이족·역관절·6족·역삼각) 확보.
5. **32×32px 축소 가독성**: `test-results/r6-towers/lv20-attack.webp`와 동일 전장 슬레이트 위 `ΔL 0.236~0.653` 확인.
6. **생성 이미지 내 텍스트 0**: 채택 원화 11개 내 깨진 텍스트·라벨 **0건** 확인.
7. **질감 과잉·금지 표현 없음**: 피·상처·내장·해골·치비·음식·블룸·반짝이 **0건** (`insect` 포자/지네 순화만 429 리셋 큐).
8. **저장소 파일·금지어 검사**: 담당 경로(`docs/renewal/r6/bible/`, `asset-source/r6/monsters/`) 내 `.png` 파일 **0건**, PRD §2 금지 말투 4종 **0건**.

---

## 5. 429 할당량 리셋(`~15:50 KST`) 이후 후속 재생성 큐

1. **전용 1024px 홈 초상 4종**: `elf`, `human`, `insect`, `golem` (`mech`와 동일한 흉상 70%·등고선 배경 퀄리티로 재촬영).
2. **라인업 1차 반려 3종 보정**:
   - `insect`: **3/4 우향 통일** + `특수 T3/W15` 포자→단단한 고치/수정캡슐 + `W20` 갑각 지네장군으로 순화(초6 "멋있다" 기준 충족) + 앰버 선 보강.
   - `elf`: `질주 T3`을 고양이과 뼈대 유지 진화로 교정 + 앰버 `5%` 지휘 표식 보강.
   - `human`: `W10`을 설정(`중장갑 전투마 + 대형 창`)에 맞춰 기병 돌격 대장으로 교정 + `W5` 은회·앰버 조화 + `W15` 바퀴 강화 + `중장갑 T2` 방패 팔 통일.
3. **파츠 분해도 1차 반려 3종 보정**:
   - `elf-parts`(허벅지·상하 관절 분절·양날 미늘창), `human-parts`(`pelvis`/`far-cloak`·관절 분절·라인업 T4 통일), `insect-parts`(배판 파츠 추가).

---

## 6. 재생성 2차 (`2026-11-25 16:00~16:17 KST`)

- 기준: 합격한 기계 군단 라인업([monsters-mech.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-mech.webp), `8.1/10`) 및 기계 초상([monsters-portrait-mech.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portrait-mech.webp), `9.3/10`).
- 분해도 규격: `docs/renewal/r6/tech/monster-pipeline.md` 및 `asset-source/r6/monsters/_guides/*.json` 안내판 배치 준수 (`1536×1024` 투명 RGBA `sheet.png`, `256×256` 발밑 원점 `[128,216]` 조립 기준판 `assembly.png`, 계통별 T1 4종 + 보스 W5 1종 = 종족당 5개체, 총 15개체).

### 6.1 1차 반려 지적 대비 수정 내역 및 자체 비평 점수

| 대상 | 1차 지적 대비 수정 내용 | 자체 비평 점수 (기계 대비) | 남은 약점 |
|---|---|---|---|
| **철갑 인간 (`human`) 라인업** | 어두운 `#12161B` 전장에 묻히던 회색 비중을 줄이고 **은회(`#B8C0C8`)·앰버(`#E69F24`) 대비** 보강. `중장갑 T1~T4` 우향 앞방패 통일, `W5` 은회+앰버 조화, `W10` 수레 제거 후 중갑 기병 대장 재작화, `W15` 굵은 4바퀴 보강. 연결 컴포넌트 분리로 5×4=20개체 정격자화. | **8.7 / 10** *(라인업)* | `32px` 축소 시 보병 T1·질주 T1 가죽 부위가 타 단계보다 어둡고, 행 간 평균 32px IoU `0.386` (최대 `0.656`). |
| **군체 벌레 (`insect`) 라인업** | 유일한 좌향 → **전 개체 3/4 우향 통일**. 알주머니·애벌레·점액·지네형 완전 제거 → **무광 갑충·딱정벌레·잠자리·육각 캡슐·황제 헤라클레스갑충**으로 순화. 카본 몸체에 앰버 경고 띠·은회 집게·틸 겹눈 보강. | **8.6 / 10** *(라인업)* | `중장갑 T2`·`특수 T1`의 카본 비중이 커 `minPeakLumDelta`가 `0.261`로 낮음(앰버 테두리로 윤곽 유지). |
| **숲 엘프 (`elf`) 라인업** | `질주 T3(사슴)`을 제거해 **T1~T4 전부 4족 맹수(여우·살쾡이·뿔관 표범·바람표범) 뼈대**로 통일. 보병/중장갑/특수/보스에 앰버(`#E69F24`) 지휘 표식 보강 및 `질주 T4` 은회 갈기·틸 문양 대비 강화. | **8.5 / 10** *(라인업)* | `보병 T4`·`질주 T2` 상단 밝기가 낮아 `minPeakLumDelta` `0.254`로 전장 배경과 대비 여유가 적음. |
| **분해도 15개체 (`*-parts`)** | 인간·벌레·엘프 각 계통 T1 4종 + 보스 W5 1종을 `cut_parts.py` 안내판 틀에 맞춰 다리·발, 팔·손을 완전 분리 제작. `shadow` 비움, 조립 `256×256` 발밑 `[128,216]` 정렬 완료. | **8.4 / 10** *(15종 전원 PASS)* | 일부 사족/이족 개체(`runner` `0.353~0.445`, `insect/infantry` `0.362`)는 Spine 리깅 단계에서 피벗·`target` 좌표 미세 조정 필요. |
| **전용 초상 4종 (`human`·`insect`·`elf`·`golem`)** | `monsters-portrait-mech.webp` 기준 `1024×1024` 흉상 + R04 슬레이트(`#1D242C`)·저대비 등고선(`#2C3540`) 배경으로 전면 재촬영 후 `256×256` 불투명 WebP(`≤18 KB`) 변환. | **8.6 / 10** *(평균)* | `human`·`insect`·`elf`·`golem` 모두 좌우 어깨 여백이 `mech` 기준처럼 `80~90%` 수준으로 타이트하며(`12%` 좌우 여백 미달), `elf` 상단 뿔·`golem` 어깨 메카닉 잔여감 보정을 위한 2차 편집 시도 중 **HTTP 429 (`RESOURCE_EXHAUSTED`)** 발생으로 1차 생성 채택본 유지. |

### 6.2 `cut_parts.py` 자동 절단·조립 검증 실측 (15개체 전원 `ready: true`)

| 종족 | 계통/단계 | 안내판 틀 | 추출 슬롯 | `cutExitCode` | `ready` | `silhouetteIoU` | 비치명 이슈(`speck`) |
|---|---|---|---|---|---|---|---|
| `human` | `infantry/T1` | `infantry-biped.json` | 13개 (다리·발, 팔·손 분리) | `0` | `true` | `0.463` | 0건 |
| `human` | `runner/T1` | `runner-quadruped.json` | 13개 (4다리·4발굽 분리) | `0` | `true` | `0.445` | 2건 |
| `human` | `armored/T1` | `armored-biped.json` | 13개 (다리·발, 팔·손 분리) | `0` | `true` | `0.594` | 1건 |
| `human` | `special/T1` | `special-wheeled.json` | 7개 (`wheel-1,2` 분리) | `0` | `true` | `0.497` | 2건 |
| `human` | `boss-t1/T1` | `boss-biped.json` | 13개 (다리·발, 팔·손 분리) | `0` | `true` | `0.526` | 1건 |
| `insect` | `infantry/T1` | `infantry-biped.json` | 13개 (다리·발, 팔·집게 분리) | `0` | `true` | `0.362` | 0건 |
| `insect` | `runner/T1` | `runner-quadruped.json` | 13개 (4다리·4발 분리) | `0` | `true` | `0.362` | 1건 |
| `insect` | `armored/T1` | `armored-quadruped.json` | 13개 (4다리·4발 분리) | `0` | `true` | `0.508` | 0건 |
| `insect` | `special/T1` | `special-swarm.json` | 14개 (`swarm-1..3`, 6족) | `0` | `true` | `0.549` | 0건 |
| `insect` | `boss-t1/T1` | `boss-biped.json` | 13개 (다리·발, 팔·집게 분리) | `0` | `true` | `0.495` | 0건 |
| `elf` | `infantry/T1` | `infantry-biped.json` | 13개 (다리·발, 팔·손 분리) | `0` | `true` | `0.520` | 2건 |
| `elf` | `runner/T1` | `runner-quadruped.json` | 13개 (4다리·4발 분리) | `0` | `true` | `0.353` | 0건 |
| `elf` | `armored/T1` | `armored-biped.json` | 13개 (다리·발, 팔·손 분리) | `0` | `true` | `0.647` | 0건 |
| `elf` | `special/T1` | `special-flying.json` | 7개 (`wing-far/near` 분리) | `0` | `true` | `0.486` | 0건 |
| `elf` | `boss-t1/T1` | `boss-biped.json` | 13개 (다리·발, 팔·손 분리) | `0` | `true` | `0.505` | 0건 |

### 6.3 2차 재생성 시트 · 32px 판독 · 전용 초상 4종 정량 실측

| 파일 | 해상도 | 용량 | 비팔레트 고채도 (`v>0.22, s>0.35, d>55`) | 평균 팔레트 거리 | 32px 전경/최소·평균 `ΔL` |
|---|---|---|---|---|---|
| `monsters-human.webp` | `1920×1080` | `127,638 B` (124.6 KB) | `0.3441%` | `3.25` | 점유 `26.5%` · `0.442 / 0.612` |
| `monsters-human-parts.webp` | `1920×1080` | `92,356 B` (90.2 KB) | `0.1780%` | `2.40` | — |
| `monsters-insect.webp` | `1920×1080` | `118,016 B` (115.3 KB) | `0.1628%` | `2.81` | 점유 `19.0%` · `0.261 / 0.429` |
| `monsters-insect-parts.webp` | `1920×1080` | `87,874 B` (85.8 KB) | `0.1443%` | `2.27` | — |
| `monsters-elf.webp` | `1920×1080` | `123,956 B` (121.1 KB) | `0.1221%` | `2.91` | 점유 `23.2%` · `0.254 / 0.431` |
| `monsters-elf-parts.webp` | `1920×1080` | `84,958 B` (83.0 KB) | `0.1073%` | `2.28` | — |
| `monsters-portrait-human.webp` | `256×256` | `12,770 B` (12.5 KB) | `1.3199%` | `9.08` | **PASS** (≤18 KB) |
| `monsters-portrait-insect.webp` | `256×256` | `12,962 B` (12.7 KB) | `0.8041%` | `8.20` | **PASS** (≤18 KB) |
| `monsters-portrait-elf.webp` | `256×256` | `17,140 B` (16.7 KB) | `0.6699%` | `11.27` | **PASS** (≤18 KB) |
| `monsters-portrait-golem.webp` | `256×256` | `11,520 B` (11.3 KB) | `0.1831%` | `7.15` | **PASS** (≤18 KB) |

### 6.4 429 한도 도달 내역 및 후속
- **발생 시각**: `2026-11-25 16:12:50 KST` (전용 초상 4종 1차 생성 직후, 여백 12% 보정용 2차 재생성 중 `HTTP 429 RESOURCE_EXHAUSTED` 발생 — 리셋 대기 약 `4h 38m`, **`~20:51 KST` 해제 예상**).
- **완료 범위**: 요청된 인간·벌레·엘프 라인업 3종 + 분해도 15개체(`T1×4 + 보스 W5`) + 전용 초상 4종 전부 1차 이상 생성·후처리·정량 검증·시트 갱신까지 완료.
- **후속 필요 시**: 초상 4종의 12% 여백 축소 재촬영 및 전 계통 T2~T4/보스 W10~W20 나머지 45개체 분해도 양산은 `20:51 KST` 이후 별도 진행.

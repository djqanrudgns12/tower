# R6 몬스터 100개체 아트 설정표

- 기준: `docs/renewal/r6/PRD-r6.md` §4.1~§4.4, `docs/renewal/r6/bible/world.md`
- 관련 문서: [홈 초상 규격서](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/portrait-spec.md) · [몬스터 G1 검수 보고서](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/G1-review-monsters.md)
- 구성: **5종족 × (4계통 × T1~T4 + 보스 4) = 100개체**
- 제작 원칙:
  - 같은 종족·같은 계통의 `T1 → T2 → T3 → T4`는 **하나의 공유 Spine 뼈대**를 쓰고 스킨(갑옷·뿔·무기·체격 부품)을 교체·추가하여 단계별 진화를 표현한다.
  - 보스 4종(`W5`, `W10`, `W15`, `W20`)은 종족별 전용 대형 뼈대를 사용하며 각자 고유 기술 1개를 가진다.
  - 시트 규격: 종족당 1920×1080 WebP(q90) 1장, 20개체 동일 좌상단 광원·동일 축척 3/4 측면 라인업 + 하단 32×32px 축소 판독 띠.

---

## 1. 계통별 Spine 뼈대 및 보스 기술 공통 규격

| 계통 | Spine 뼈대 유형 | T1 → T4 진화 축 | 기본 크기 배율 |
|---|---|---|---|
| **보병 (`infantry`)** | 이족(또는 표준 보행) 뼈대 | 맨손/단검 → 장창/모자 → 어깨갑/양손무기 → 전신 장식갑/대무기 | `0.95x → 1.05x → 1.15x → 1.28x` |
| **질주 (`rush`)** | 4족 또는 전경 질주 뼈대 | 경량 몸체 → 날카로운 등판/발톱 → 추진/꼬리날개 → 중형 돌격 갑각 | `0.85x → 0.95x → 1.05x → 1.18x` |
| **중장갑 (`heavy`)** | 두꺼운 하체+방패 팔 뼈대 | 소형 방패 → 대형 사각/원형 방패 → 전신 중갑+투구 → 이중 방벽+중무기 | `1.10x → 1.22x → 1.35x → 1.50x` |
| **특수 (`special`)** | 비행/수레/모함/유충떼/수정 뼈대 | 단일 소형 기구 → 보조 부유체/바퀴 추가 → 핵심 코어 확대 → 완성형 특수 개체 (`insect_special`은 T1부터 비활성 6족 다리 본 내장) | `1.00x → 1.12x → 1.25x → 1.38x` |
| **보스 (`boss`)** | 웨이브별 전용 대형 뼈대 (W5·10·15·20) | 대형 체급 + 종족 상징 무장 + 보스 기술 이펙트 앵커 | `1.65x → 1.80x → 2.00x → 2.20x` |

### 보스 기술 6종 (v0.4 재사용·확장)
- `iron_stance`: 체력 기준 이하 시 일정 시간 물리/마법 저항 상승
- `burst_march`: 주기적으로 짧은 시간 이동 속도 급상승
- `call_escort`: 체력 구간마다 호위 개체 2기 소환
- `rally_haste`: 주변 아군 적의 이동 속도 증가 오라
- `ward_layers`: 중첩 방어막 생성(피격 시 1겹씩 소멸)
- `self_mend`: 주기적으로 최대 체력의 일정 비율 회복

---

## 2. 숲 엘프 (`elf`) — 20개체
- 시트: [monsters-elf.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-elf.webp) · 파츠 분해도: [monsters-elf-parts.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-elf-parts.webp) · 초상 예시: [monsters-portrait-elf.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portrait-elf.webp)
- 특수 계통 테마: **비행 정령** · 주 강조색: 틸 `#2FB5A3` (30%), 슬레이트 `#1D242C` (25%)

| ID | 가안 이름 | 계통·단계 | 크기 | T(n)→T(n+1) 변화 / 보스 기술 |
|---|---|---|---|---|
| `elf_infantry_t1` | 덩굴 정찰병 | 보병 T1 | `0.95x` | 얇은 나무 흉갑 + 짧은 수지 단검, 잎 후드 |
| `elf_infantry_t2` | 잎날 검병 | 보병 T2 | `1.05x` | 양손 잎날 쌍검 추가, 틸 문양 어깨띠 장착 |
| `elf_infantry_t3` | 참나무 창병 | 보병 T3 | `1.15x` | 긴 나무 장창 + 비대칭 나무 어깨갑·정강이 보호대 |
| `elf_infantry_t4` | 고목 근위병 | 보병 T4 | `1.28x` | 가시 덩굴 전신 갑옷 + 이중 날 미늘창 + 틸 망토 |
| `elf_rush_t1` | 숲여우 추적자 | 질주 T1 | `0.85x` | 날렵한 4족 체형, 목 주위 얇은 잎 갈기 |
| `elf_rush_t2` | 가시 살쾡이 | 질주 T2 | `0.95x` | 등에 돋은 짙은 덩굴 가시 능선, 앞다리 경질 각재 보호대 |
| `elf_rush_t3` | 뿔사슴 질주수 | 질주 T3 | `1.05x` | 틸 문양이 새겨진 큰 나뭇가지 뿔 + 뒷다리 힘줄 강화 |
| `elf_rush_t4` | 바람표범 맹수 | 질주 T4 | `1.18x` | 전신 목재 갑각 플레이트 + 이중 꼬리날개 + 틸 발톱 |
| `elf_heavy_t1` | 나무껍질 방패병 | 중장갑 T1 | `1.10x` | 둥근 원목 방패 + 두꺼운 덩굴 팔 보호구 |
| `elf_heavy_t2` | 옹이 장갑병 | 중장갑 T2 | `1.22x` | 사각형 고목 대방패 + 뿔 달린 나무 투구 |
| `elf_heavy_t3` | 뿌리 중장병 | 중장갑 T3 | `1.35x` | 상체를 감싸는 뿌리 흉갑 + 대형 나무 망치 |
| `elf_heavy_t4` | 천년목 중갑사 | 중장갑 T4 | `1.50x` | 틸 결정을 박은 거대 목재 방벽 방패 + 중갑 어깨기둥 |
| `elf_special_t1` | 솔방울 비행정령 | 특수 T1 | `1.00x` | 공중에 뜬 작은 솔방울 핵 + 나뭇잎 2장 날개 |
| `elf_special_t2` | 이슬 날개정령 | 특수 T2 | `1.12x` | 틸 결정 핵 확대 + 잠자리형 4장 잎 맥 날개 |
| `elf_special_t3` | 고리 바람정령 | 특수 T3 | `1.25x` | 핵 주위를 도는 덩굴 고리 2중 + 꼬리 기류 |
| `elf_special_t4` | 숲핵 대정령 | 특수 T4 | `1.38x` | 3겹 나뭇가지 왕관 틀 + 중심 대형 다면체 틸 핵 |
| `elf_boss_5` | 뿔투구 지휘관 | 보스 W5 | `1.65x` | 큰 수사슴 뿔 투구·이중 창 / 기술: `rally_haste` (주변 숲 무리 가속) |
| `elf_boss_10` | 거목 뿌리거인 | 보스 W10 | `1.80x` | 뿌리 다리 4개와 대형 목재 방패 / 기술: `iron_stance` (나무껍질 경화) |
| `elf_boss_15` | 바람날개 대정령 | 보스 W15 | `2.00x` | 6매 잎 날개와 공중 틸 결계 / 기술: `ward_layers` (4겹 바람 방어막) |
| `elf_boss_20` | 고대숲 대군주 | 보스 W20 | `2.20x` | 왕관 나무 뿔 + 4족 거대 정령수 기승 / 기술: `call_escort` (정령 호위 소환) |

---

## 3. 철갑 인간 (`human`) — 20개체
- 시트: [monsters-human.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-human.webp) · 파츠 분해도: [monsters-human-parts.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-human-parts.webp) · 초상 예시: [monsters-portrait-human.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portrait-human.webp)
- 특수 계통 테마: **공성 수레** · 주 강조색: 은회 `#B8C0C8` (30%), 회색 `#4A5563` (25%), 앰버 `#E69F24` (15%)

| ID | 가안 이름 | 계통·단계 | 크기 | T(n)→T(n+1) 변화 / 보스 기술 |
|---|---|---|---|---|
| `human_infantry_t1` | 철모 경보병 | 보병 T1 | `0.95x` | 둥근 철모 + 가죽 조끼 + 짧은 철검 |
| `human_infantry_t2` | 창병대원 | 보병 T2 | `1.05x` | 흉갑과 팔 보호구 착용 + 긴 강철 창 |
| `human_infantry_t3` | 미늘창 장교 | 보병 T3 | `1.15x` | 바이저 투구 + 큰 사각 어깨갑 + 양손 미늘창 |
| `human_infantry_t4` | 왕실 근위기사 | 보병 T4 | `1.28x` | 전신 은회 판금 갑옷 + 앰버 깃털 장식 투구 + 대검 |
| `human_rush_t1` | 전령 기마척후 | 질주 T1 | `0.85x` | 경량 장갑 마구 기수 + 짧은 기병창 |
| `human_rush_t2` | 사슬 갑옷 기수 | 질주 T2 | `0.95x` | 말 안면 철판 + 사슬 갑옷과 기병 방패 |
| `human_rush_t3` | 창기병 돌격수 | 질주 T3 | `1.05x` | 말 전신 은회 마갑 + 긴 돌격 랜스 + 앰버 깃발 |
| `human_rush_t4` | 중기병 돌격대장 | 질주 T4 | `1.18x` | 중장갑 전투 군마 + 뿔 투구 기사 + 중형 철퇴 |
| `human_heavy_t1` | 원형 방패병 | 중장갑 T1 | `1.10x` | 목재 테두리 철제 원형 방패 + 흉갑 |
| `human_heavy_t2` | 장방패 중보병 | 중장갑 T2 | `1.22x` | 어깨까지 가리는 대형 사각 강철 방패 + 투구 |
| `human_heavy_t3` | 강철 성벽병 | 중장갑 T3 | `1.35x` | 두꺼운 모따기 어깨갑 + 잠금형 대방패 + 철퇴 |
| `human_heavy_t4` | 철갑 중전차병 | 중장갑 T4 | `1.50x` | 전신 다중 판금 + 앰버 문장 대형 방벽 + 대형 도끼 |
| `human_special_t1` | 2륜 공성 손수레 | 특수 T1 | `1.00x` | 철 테두리 나무 바퀴 2개 + 앞쪽 뾰족 충각 |
| `human_special_t2` | 방패 공성 수레 | 특수 T2 | `1.12x` | 전면 경사 철판 방패 덮개 + 강화 바퀴 4개 |
| `human_special_t3` | 쇠뇌 공성 포차 | 특수 T3 | `1.25x` | 수레 상단에 대형 연발 쇠뇌 포대 탑재 |
| `human_special_t4` | 철갑 공성 전차 | 특수 T4 | `1.38x` | 중장갑 철판 차체 + 전방 대형 충각 + 상단 화살 포탑 |
| `human_boss_5` | 강철 대장군 | 보스 W5 | `1.65x` | 앰버 깃 장식 중갑 + 대형 철퇴 / 기술: `iron_stance` (방패 진형 방어) |
| `human_boss_10` | 철갑 전차 대장 | 보스 W10 | `1.80x` | 중장갑 전투마 + 대형 창 / 기술: `burst_march` (주기적 기병 돌진) |
| `human_boss_15` | 공성 탑거인차 | 보스 W15 | `2.00x` | 2층 높이 이동식 철갑 공성탑 / 기술: `call_escort` (보병 호위 하차) |
| `human_boss_20` | 왕국 총사령관 | 보스 W20 | `2.20x` | 전신 은회+앰버 금테 판금 + 대방패·거대 할버드 / 기술: `rally_haste` (군단 진군 가속) |

---

## 4. 기계 군단 (`mech`) — 20개체
- 시트: [monsters-mech.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-mech.webp) · 파츠 분해도: [monsters-mech-parts.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-mech-parts.webp) · 초상 예시: [monsters-portrait-mech.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portrait-mech.webp)
- 특수 계통 테마: **드론 모함(분열)** · 주 강조색: 슬레이트 `#1D242C` (35%), 회색 `#4A5563` (25%), 틸 `#2FB5A3` (8%)

| ID | 가안 이름 | 계통·단계 | 크기 | T(n)→T(n+1) 변화 / 보스 기술 |
|---|---|---|---|---|
| `mech_infantry_t1` | 이족 정찰 보행기 | 보병 T1 | `0.95x` | 단순 직사각 머리 센서 + 역관절 2족 프레임 |
| `mech_infantry_t2` | 경장갑 전투 보행기 | 보병 T2 | `1.05x` | 양팔 틸 광선 블레이드 + 흉부 슬레이트 장갑 추가 |
| `mech_infantry_t3` | 복열 센서 보행기 | 보병 T3 | `1.15x` | 듀얼 틸 광학 안테나 + 두꺼운 모따기 어깨판 |
| `mech_infantry_t4` | 중무장 지휘 보행기 | 보병 T4 | `1.28x` | 등 뒤 냉각 핀 + 전신 다중 각면 장갑 + 앰버 계급 띠 |
| `mech_rush_t1` | 4족 정찰 드론 | 질주 T1 | `0.85x` | 얇은 4족 유압 다리 + 틸 슬릿 안면부 (R04 원안 계승) |
| `mech_rush_t2` | 예각 스텔스 추적기 | 질주 T2 | `0.95x` | 늑대형 예각 스텔스 장갑판 + 후면 소형 추진 노즐 |
| `mech_rush_t3` | 고속 블레이드 하운드 | 질주 T3 | `1.05x` | 어깨 칼날 날개 추가 + 강화된 역관절 점프 피스톤 |
| `mech_rush_t4` | 중무장 인터셉터 | 질주 T4 | `1.18x` | 이중 추진 팩 + 전방 경사 쐐기 장갑 + 틸 광학 어레이 |
| `mech_heavy_t1` | 방패 4족 기계체 | 중장갑 T1 | `1.10x` | 굵은 4족 다리 + 전면 1단 사각 슬레이트 방패 |
| `mech_heavy_t2` | 장갑 갑충 드론 | 중장갑 T2 | `1.22x` | 낮고 둥근 분절 갑각 덮개 + 앰버 이음매 (R04 원안 계승) |
| `mech_heavy_t3` | 중장갑 벙커 보행기 | 중장갑 T3 | `1.35x` | 6족 지지대 + 전면 이중 유압 방벽 + 상단 센서 |
| `mech_heavy_t4` | 공성 실드 워커 | 중장갑 T4 | `1.50x` | 전면을 가리는 대형 V형 분할 장갑 방패 + 등 중포탑 |
| `mech_special_t1` | 소형 프로펠러 캐리어 | 특수 T1 | `1.00x` | 단일 중앙 동체 + 2로터 + 하부 자드론 1기 수납 |
| `mech_special_t2` | 쌍열 드론 수송기 | 특수 T2 | `1.12x` | 양측 덕트형 추진기 + 하부 분리 포트 2개 |
| `mech_special_t3` | 4로터 드론 모함 | 특수 T3 | `1.25x` | 4축 틸트 로터 + 중앙 육각 틸 코어 + 소형 드론 2기 동반 |
| `mech_special_t4` | 대형 분열 공중모함 | 특수 T4 | `1.38x` | 장갑 링 프레임 + 상단 레이더 + 소형 자드론 3기 부유 |
| `mech_boss_5` | 3족 결정 포행기 | 보스 W5 | `1.65x` | 거대 틸 수정 코어를 품은 3족 기계 프레임 / 기술: `ward_layers` (에너지 장막 4겹) |
| `mech_boss_10` | 고속 스텔스 파괴자 | 보스 W10 | `1.80x` | 날개형 6족 고속 기체 + 후방 추진체 / 기술: `burst_march` (터보 가속 돌진) |
| `mech_boss_15` | 항공 드론 기함 | 보스 W15 | `2.00x` | 대형 쌍동 비행 모함 + 측면 도킹 베이 / 기술: `call_escort` (전투 드론 사출) |
| `mech_boss_20` | 다족 공성 거대기체 | 보스 W20 | `2.20x` | 전면 초대형 V방패 + 상단 2연장 포탑 + 6족 기동부 / 기술: `iron_stance` (전면 장갑 전개) |

---

## 5. 군체 벌레 (`insect`) — 20개체
- 시트: [monsters-insect.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-insect.webp) · 파츠 분해도: [monsters-insect-parts.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-insect-parts.webp) · 초상 예시: [monsters-portrait-insect.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portrait-insect.webp)
- 특수 계통 테마: **분열 유충떼** · 주 강조색: 카본 `#12161B` (25%), 앰버 `#E69F24` (25%), 슬레이트 `#1D242C` (25%)

| ID | 가안 이름 | 계통·단계 | 크기 | T(n)→T(n+1) 변화 / 보스 기술 |
|---|---|---|---|---|
| `insect_infantry_t1` | 일개미 보행충 | 보병 T1 | `0.95x` | 매끈한 카본 키틴 몸체 + 작은 집게 턱 + 6족 |
| `insect_infantry_t2` | 병정 낫벌레 | 보병 T2 | `1.05x` | 앞다리 2개가 톱니 낫 형태로 확장 + 앰버 등줄 |
| `insect_infantry_t3` | 창뿔 갑충병 | 보병 T3 | `1.15x` | 두꺼운 흉부 등껍질 + 머리 앞쪽 긴 단일 뿔 |
| `insect_infantry_t4` | 쌍집게 군단충 | 보병 T4 | `1.28x` | 어깨 앰버 가시 능선 + 거대 이중 집게 턱 + 중장갑 마디 |
| `insect_rush_t1` | 날개 사마귀충 | 질주 T1 | `0.85x` | 가늘고 긴 몸체 + 접힌 얇은 뒷날개 |
| `insect_rush_t2` | 매미 질주충 | 질주 T2 | `0.95x` | 넓은 앰버 맥 매트 날개 전개 + 날렵한 뒷다리 |
| `insect_rush_t3` | 말벌 추적자 | 질주 T3 | `1.05x` | 검은 몸통에 굵은 앰버 줄무늬 3줄 + 복열 4날개 |
| `insect_rush_t4` | 잠자리 강습충 | 질주 T4 | `1.18x` | 길쭉한 장갑 꼬리 마디 + 대형 4날개 + 틸 겹눈 |
| `insect_heavy_t1` | 둥근 갑충 | 중장갑 T1 | `1.10x` | 돔형 매끈한 슬레이트 등껍질 + 짧은 6족 |
| `insect_heavy_t2` | 가시 딱정벌레 | 중장갑 T2 | `1.22x` | 등껍질 가장자리에 뾰족한 뿔 돌기 추가 + 두꺼운 앞다리 |
| `insect_heavy_t3` | 쇠뿔 장수풍뎅이 | 중장갑 T3 | `1.35x` | 상향 곡선 거대 뿔 + 2중 분할 앰버 경계선 등갑 |
| `insect_heavy_t4` | 성벽 코뿔소갑충 | 중장갑 T4 | `1.50x` | 거대 전방 3단 뿔 + 전신 요새형 두꺼운 계단식 키틴 갑각 |
| `insect_special_t1` | 마디 유충 | 특수 T1 | `1.00x` | 4마디 통통한 장갑 애벌레 + 앰버 등 점무늬 |
| `insect_special_t2` | 쌍둥이 유충무리 | 특수 T2 | `1.12x` | 고치 마디가 2갈래로 부푼 분열 전조 형태 + 짧은 집게 |
| `insect_special_t3` | 포자 주머니충 | 특수 T3 | `1.25x` | 등에 앰버·틸 고치 주머니 3개를 짊어진 분열체 |
| `insect_special_t4` | 군체 고치 모충 | 특수 T4 | `1.38x` | 6족 갑충 하체 위에 분할 가능한 유충 고치 5개가 얹힌 형태 |
| `insect_boss_5` | 질주 여왕말벌 | 보스 W5 | `1.65x` | 거대한 4날개 + 앰버 줄무늬 대형 복부 / 기술: `burst_march` (날개 가속 비행) |
| `insect_boss_10` | 거대 장수대왕 | 보스 W10 | `1.80x` | 거대한 가위 뿔 + 요새형 흑갑각 / 기술: `iron_stance` (등갑 웅크리기 방어) |
| `insect_boss_15` | 군체 부화 모체 | 보스 W15 | `2.00x` | 8족 대형 복부에 유충 고치 다발 탑재 / 기술: `call_escort` (유충 무리 사출) |
| `insect_boss_20` | 군단 거대 지네왕 | 보스 W20 | `2.20x` | 다절 중갑 몸통을 S자로 세운 거대 절지 보스 / 기술: `rally_haste` (군체 페로몬 가속) |

---

## 6. 바위 거인 (`golem`) — 20개체
- 시트: [monsters-golem.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-golem.webp) · 파츠 분해도: [monsters-golem-parts.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-golem-parts.webp) · 초상 예시: [monsters-portrait-golem.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/monsters-portrait-golem.webp)
- 특수 계통 테마: **재생 수정** · 주 강조색: 회색 `#4A5563` (35%), 슬레이트 `#1D242C` (25%), 앰버 `#E69F24` (18%)

| ID | 가안 이름 | 계통·단계 | 크기 | T(n)→T(n+1) 변화 / 보스 기술 |
|---|---|---|---|---|
| `golem_infantry_t1` | 자갈 보행골렘 | 보병 T1 | `0.95x` | 거친 둥근 바위 덩어리 조합 + 단순 바위 주먹 |
| `golem_infantry_t2` | 현무암 파수골렘 | 보병 T2 | `1.05x` | 각진 다면체 팔뚝 + 가슴 중앙 작은 앰버 열선 틈 |
| `golem_infantry_t3` | 철광석 전사골렘 | 보병 T3 | `1.15x` | 어깨에 솟은 뾰족 바위 기둥 + 묵직한 돌 망치 팔 |
| `golem_infantry_t4` | 용암핵 거신병 | 보병 T4 | `1.28x` | 관절마다 앰버 용암 균열선 + 이중 돌 갑옷 어깨판 |
| `golem_rush_t1` | 구르는 돌덩이 | 질주 T1 | `0.85x` | 낮은 4족 짐승형 바위 구조체, 짧은 돌다리 |
| `golem_rush_t2` | 쐐기 바위사냥개 | 질주 T2 | `0.95x` | 앞쪽이 뾰족한 쐐기형 화강암 머리 + 등 앰버 균열 |
| `golem_rush_t3` | 쇄석 돌진수 | 질주 T3 | `1.05x` | 등줄기를 따라 솟은 지느러미형 돌칼날 + 굵은 앞다리 |
| `golem_rush_t4` | 유성 파쇄거수 | 질주 T4 | `1.18x` | 어깨·등에 틸 수정과 앰버 열선이 박힌 중형 돌진 야수 |
| `golem_heavy_t1` | 판석 방패골렘 | 중장갑 T1 | `1.10x` | 넓고 투박한 한 덩어리 팔 방패 + 기둥 다리 |
| `golem_heavy_t2` | 기둥 성벽골렘 | 중장갑 T2 | `1.22x` | 사각형으로 다듬어진 대석 방벽 팔 + 돌 왕관 머리 |
| `golem_heavy_t3` | 암반 요새골렘 | 중장갑 T3 | `1.35x` | 양팔 모두 거대한 방벽 석판 + 등 뒤 바위 받침 |
| `golem_heavy_t4` | 고대 석조거신 | 중장갑 T4 | `1.50x` | 틸 문양이 새겨진 2중 성벽 석판 + 거대 석조 투구 |
| `golem_special_t1` | 수정 조각정령 | 특수 T1 | `1.00x` | 부유하는 작은 틸 육각 수정 1개 + 주위 자갈 3조각 |
| `golem_special_t2` | 공명 수정부유체 | 특수 T2 | `1.12x` | 바위 고리 틀 안에 뜬 중앙 틸 수정 기둥 |
| `golem_special_t3` | 맥동 재생핵 | 특수 T3 | `1.25x` | 3단 바위 받침대 + 다발로 솟은 틸 수정 클러스터 |
| `golem_special_t4` | 대지 재생수정탑 | 특수 T4 | `1.38x` | 공중 회전 암반 조각 4개 + 중앙 거대 틸 수정핵 |
| `golem_boss_5` | 쇄석 철퇴거인 | 보스 W5 | `1.65x` | 한쪽 팔이 거대 다면체 돌철퇴인 골렘 / 기술: `iron_stance` (암반 경화) |
| `golem_boss_10` | 수정 갑옷정령왕 | 보스 W10 | `1.80x` | 어깨·등 전체가 틸 수정 기둥으로 덮인 골렘 / 기술: `self_mend` (수정 재생 회복) |
| `golem_boss_15` | 용암 균열거인 | 보스 W15 | `2.00x` | 온몸의 바위 틈에서 앰버 열선이 흐르는 거구 / 기술: `ward_layers` (열기 암석막 5겹) |
| `golem_boss_20` | 산맥 대거신 | 보스 W20 | `2.20x` | 등 위에 수정 첨탑과 바위 성곽을 얹은 초대형 거신 / 기술: `self_mend` (대지 수정 자가 재생) |

# 이름과 전투 규칙 분리

한글 이름 하나를 바꾸면 설치창·예고·설명서·스크린 리더에 함께 반영돼야 한다. 저장 기록과 랭킹 제출에는 같은 타워·개체 ID와 밸런스 판이 남는다. 이 문서의 줄 번호는 R6 변경 전 `07b81813` 기준이다.

## 두 파일의 책임

- `docs/contracts/balance.v2.json`은 ID, 비용, 정수 배율, 표적 선택, 해금 시점과 기술 규칙을 담는다. 효과 설명에 넣을 피해·지속 시간·범위는 여기서 읽는다.
- `src/content/theme/r6.ko.json`은 `locale`, `themeId`, `towers[id].name`, `weapons[towerId][I..IV].{name,summaryTemplate}`, `species[id].name`, `lineages[id].name`, `entities[entityId].name`, `bossSkills[id].name`, `elites[id].name`, `relics[id].{name,summaryTemplate}`, `difficulties[id].{name,hint}`, `maps[id].name`을 담는다. 개체 키는 일반 80개와 보스 20개를 모두 명시한다. 화면별 문장과 접근성 문구는 이 이름을 조합한다. 아이콘·스킨은 동일 ID로 에셋 매니페스트에서 찾는다.
- 예를 들어 `towers.rail.name`은 “레일 포탑”, `weapons.rail.II.summaryTemplate`은 “{shots}발을 연달아 쏴요”다. Lv6에서 엔진이 준 2를 넣어 “2발을 연달아 쏴요”로 읽는다. 템플릿 매개변수는 기술별 허용 목록을 두고 값 누락을 콘텐츠 검사에서 잡는다. `snack_mend`의 화면명은 “회복”이다.
- `src/content/theme/`에서 한국어 파일을 검증하고 조회 함수를 내보낸다. 콘텐츠 합성 시 계약의 ID 집합과 테마 키 집합을 대조한다. 도메인 이벤트에는 ID와 수치만 싣는다. UI가 조회 함수를 쓰고 도메인·서버는 테마를 import하지 않는다. 전체 테마를 받아 순환 의존성이 생기는 도메인 헬퍼는 만들지 않는다.

## 현재 결합과 이관 대상

| 현재 위치(파일:줄) | 변경 내용 |
|---|---|
| `src/contracts/balance.ts:65,222,240,307,310,352` | v1 검증기는 예전 label·summary·names·icon을 계속 읽는다. v2 스키마는 각 객체의 허용 필드를 제한해 표시 필드가 들어오면 실패시킨다. |
| `src/content/index.ts:14,128`, `src/ui/copy.ts:7` | 선택한 판의 규칙·테마를 같은 콘텐츠 진입점에서 짝짓는다. 난이도 이름·힌트의 중복도 없앤다. |
| `src/domain/factions.ts:52`, `src/domain/towers.ts:83`, `src/ui/game/evolution.ts:12` | v2는 entityId·형태 번호·무기 단계만 계산한다. 예전 이름 헬퍼는 v1 경로에 한정한다. |
| `src/ui/game/Armory.tsx:53`, `FieldOverlay.tsx:105,176`, `SlotList.tsx:38,53`, `TowerDetail.tsx:57` (뒤 세 파일도 같은 폴더) | 상점, 설치 칸, 상세, 버튼 제목과 aria-label을 같은 이름 조회로 바꾼다. 비용·공격력은 계산된 수치를 사용한다. |
| `src/ui/game/RecruitCard.tsx:29`, `EvolveCard.tsx:40,53`, `RelicCard.tsx:57,84` (같은 폴더) | 자동 해금·다음 무기 안내와 보물 선택의 이름·설명·읽기 문구를 옮긴다. v1의 갈래 문구는 v1 화면에서 유지한다. |
| `src/ui/game/wavePreview.ts:8,37,52`, `counters.ts:10`, `ContextCard.tsx:26,42`, `GameScreen.tsx:574` (같은 폴더) | 예고를 개체 ID로 집계하고 도감과 같은 이름을 쓴다. 공간이 좁으면 계통 총수와 대표 개체를 구분해 표시한다. |
| `src/ui/screens/guide/guideModel.ts:57,357,517,547`, `difficultyReadout.ts:38` (같은 폴더) | 시작 세 종, 설치 예시, 무기·상성·난이도 안내를 새 데이터로 만든다. |
| `tests/unit/progression.test.ts:78,165`, `tests/unit/factions.test.ts:26`, `tests/unit/b3-traits-relics.test.ts:196` | v1 사례를 보존한다. v2의 수치 시험은 ID·효과, 콘텐츠 시험은 키의 완전성·보물 설명을 맡는다. |
| `tests/unit/ui/field-interaction.test.ts:78`, `tests/unit/ui/b3-counters-relics.test.ts:110,116`, `tests/unit/guide.test.ts:183` | 설치 칸·안내서·선택 버튼과 읽기 문구를 실제 한국어 조회 결과로 확인한다. |

## 적용 순서와 종료 조건

1. v1 파일·파서와 보관된 결과를 그대로 읽는 시험을 먼저 고정한다. v2 ID 및 표시 키를 확정하고, 테마 누락·알 수 없는 ID·중복·빈 이름·허용하지 않은 치환자를 빌드에서 거부한다.
2. 출시 전 콘텐츠를 조립해 UI 조회 함수를 연결한다. 새 개체 100개와 타워 6종 × 무기 4단계가 모두 조회되고, 보스·정예·종족 이름, 상세 수치와 읽기 문구가 일치해야 한다. 과거 판은 해당 판의 테마로 보여 준다.
3. 이름 하나만 바꾼 두 테스트 테마에서 버튼과 읽기 문구가 함께 바뀌는지 확인한다. 같은 시드·명령으로 얻은 편성, 전투 이벤트의 ID와 수치, 점수, 저장·제출 객체, balanceVersion 및 규칙 파일 해시는 같아야 한다. 화면 장식·한국어 변경은 테마 리비전으로 배포한다.

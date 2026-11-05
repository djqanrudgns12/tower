# 타워 로스터 확장·진화 트리 카탈로그 (R4-T)

초안: Antigravity(Gemini 4 Argon, 2026-10-31) · 큐레이션: 리뉴얼 총괄(Claude)

## 0. 총괄 결정 (본문보다 우선)

1. **20종 로스터와 9개 공통 메커니즘(§4)을 채택한다.** 엔진 순서는 난이도 "하" 7개(`antiAir`, `minRange`, `ricochet`, `burstQueue`, `knockbackPull`, `debuffMarks`, `towerCycle`)를 먼저 하고, "중" 2개(`fieldHazards`, `onKillTrigger`)는 그 뒤에 한다.
2. **판 안 접근은 안 1(징집)로 간다.** 시작은 기본 4종(`archer`, `cannon`, `frost`, `mage`)이고, W3·W6·W10·W14를 지키면 미보유 타워 3종 중 1종을 고른다. 장착함은 최대 8칸이다. "대표 타워 1종 사전 선택"은 v1에서 빼서 로비를 단순하게 둔다. 징집 화면은 큰 타워 카드 3장과 고르기 버튼만 둔다.
3. **학습 연동 독립 타워는 넣지 않는다**(§6 의견에 동의). 학습 연동은 `banner B1`의 버닝 증폭과, 훗날 비석 장식 연출로 한다.
4. 진화 목표: 20웨이브 판에서 **주력 타워 2~3기가 Lv7에 도달**하도록 비용 곡선을 맞춘다(R2 밸런스 기준에 추가).
5. `bell B1`은 단순화한 순수 수치 오라(사거리 +500 milli, 공속 +800 BP)로 확정한다.
6. 그림 층: 무기가 회전하는 타워는 기존처럼 본체+무기 2층이고, 회전이 필요 없는 타워(`bell`, `banner`, `trap`, `wind`, `alchemist`, `frost B1` 등)는 본체 1층으로 만든다.
7. 종각은 종교 상징을 쓰지 않는다. 사찰 범종이 아니라 도성 종루(공공 종각) 모티프다.
8. 신규 타워 가격·수치는 후보값이다. R2 밸런스 시뮬레이션으로 확정한다.

> **기준 문서:** `docs/contracts/balance.candidate.v0.4.json`, `src/domain/towers.ts`, `src/domain/combat.ts`, `docs/art_and_content_contract_v0_2.md`, `docs/style-lock-v1.md` (41번 왕국 원정대), `docs/renewal/catalog/monsters.md` §0
> **진화 단계 규약:** `Lv1~3` 기본형(`base`) → `Lv4~6` 1차 진화(`A` 또는 `B`) → `Lv7` 2차 진화(`A1`/`A2` 또는 `B1`/`B2`), `Lv8+`는 외형 변화 없는 숙련 레벨(타워당 외형 7종, 20종 총 140외형).
> **엔진 단위 규약:** 틱 `30Hz`(`1초 = 30틱`, `ticks = floor((ms * 30 + 999) / 1000)`), 거리 `milli`(`1칸 = 1000`), 비율 `BP`(`10000 = 100%`), 체력·피해 `milli-HP`(`1 HP = 1000`).
> **몬스터 v1 신규 능력 대응:** `flyer`(비행: 지면 전용 타워의 표적·착탄 제외)와 `splitter`(분열: 처치 지점 `±120 milli`에 소형체 2기 생성)가 타워 선택과 설치 위치의 핵심 분기점이 되도록 대공 여부(`O`/`X`)와 범위·연쇄·장판·다연발 역할을 배분했다. 한국적 모티프는 41번 화풍에 자연스럽게 녹아드는 **2종(`hwacha` 화차대, `bell` 종각초소)**만 채택했다.

---

## 1. 20종 타워 개요표

4개 분류(`사격` 5 · `폭발` 5 · `원소·마법` 5 · `지원·특수` 5) 균형 배분. 공중 공격 가능(`O`) 11종, 지상 전용(`X`, 일부 2차 진화에서 대공 해금) 8종, 비공격 지원(`-`) 1종이다.

| # | `id` | 한국어 이름 | 분류 | 역할 한 줄 (18자 이하) | 공중 공격 | 구분 | 가격대 (비용) | 핵심 위치·상성 |
|---:|---|---|---|---|:---:|:---:|---|---|
| 1 | `archer` | 궁수탑 | 사격 | 값싸고 빠른 기본 화살 사격 | `O` | 기존 | 저가 (`60G`) | 초반 범용 · `flyer` 기본 견제 |
| 2 | `crossbow` | 석궁탑 | 사격 | 장갑을 뚫는 묵직한 저격 | `O` | 기존 | 중가 (`100G`) | 긴 사선 · `shell`/정예/`flyer` |
| 3 | `sling` | 투석초소 | 사격 | 적 사이를 통통 튀는 돌팔매 | `O` | 신규 | 저가 (`65G`) | 초반 2~3기 도탄 · `splitter`/`flyer` |
| 4 | `ballista` | 거대노포 | 사격 | 긴 직선을 끝까지 꿰뚫는 창 | `O` | 신규 | 고가 (`125G`) | 직선 통로 끝 · 다수 관통/`splitter` |
| 5 | `falcon` | 매사냥대 | 사격 | 하늘 적을 낚아채는 사냥매 | `O` | 신규 | 중가 (`100G`) | 중앙 고지 · `flyer` 최우선 카운터 |
| 6 | `cannon` | 포탑 | 폭발 | 뭉친 지상 적을 한방에 폭격 | `X` | 기존 | 중가 (`100G`) | 굽은 모퉁이 · `swarm`/`splitter` |
| 7 | `mortar` | 박격포대 | 폭발 | 먼 길 너머로 쏘는 곡사포 | `X` | 신규 | 고가 (`135G`) | 2열 후방 슬롯(최소 사거리 보유) |
| 8 | `hwacha` | 화차대 | 폭발 | 불화살 다발을 쏟아붓는 화차 | `O` | 신규 | 고가 (`130G`) | 한국 모티프 · 시차 연타(`splitter`/겹방패) |
| 9 | `roller` | 통나무굴림대 | 폭발 | 길을 거슬러 굴러가는 통나무 | `X` | 신규 | 중가 (`95G`) | 직선로 출구 쪽 · 역주행 다중 충돌 |
| 10 | `alchemist` | 약병투척소 | 폭발 | 길 위에 남는 마법 물약 장판 | `X` | 신규 | 중가 (`90G`) | 병목 지점 · 분열 직후 파생체 용해 |
| 11 | `mage` | 마법탑 | 원소·마법 | 갑각도 뚫는 비전 마법 탄환 | `O` | 기존 | 중가 (`95G`) | 중거리 주력 · `shell`/중장갑 |
| 12 | `frost` | 서리탑 | 원소·마법 | 차가운 냉기로 발을 늦춰요 | `O` | 기존 | 저가 (`60G`) | 화력 타워 앞단 · `runner`/`flyer` |
| 13 | `lightning` | 번개탑 | 원소·마법 | 적에게 연달아 튀는 번개 | `O` | 기존 | 고가 (`150G`) | 간격 좁은 길 · `flyer`/`splitter` 연쇄 |
| 14 | `flame` | 화염탑 | 원소·마법 | 앞을 휩쓰는 부채꼴 불길 | `X`* | 기존 | 고가 (`130G`) | 코너 안쪽 근접 · `swarm`/`splitter`(*A2 대공) |
| 15 | `wind` | 바람개비탑 | 원소·마법 | 거센 돌풍으로 뒤로 밀쳐요 | `O` | 신규 | 중가 (`90G`) | 장판·포탑 뒤 · 적 역진행(`flyer` 특효) |
| 16 | `spear` | 창병초소 | 지원·특수 | 길목에서 빠르게 찌르는 창 | `X` | 기존 | 저가 (`70G`) | 길 밀착 슬롯 · 초반 `wisp`/`runner` |
| 17 | `guardian` | 수호기사 | 지원·특수 | 성문 앞을 지키는 단 한 기사 | `X`* | 기존 | 고가 (`180G`) | 맵 1기 제한 · 정예/대장 결투(*B1 대공) |
| 18 | `banner` | 깃발초소 | 지원·특수 | 주변 타워 힘과 속도를 강화 | `-` | 기존 | 저가 (`85G`) | 타워 밀집 중심 · 공격력/공속 오라 |
| 19 | `trap` | 덫공방초소 | 지원·특수 | 길 위에 미리 덫을 깔아둬요 | `X` | 신규 | 저가 (`85G`) | 성문 앞 보험 · 누출 직전 구속/폭죽 |
| 20 | `bell` | 종각초소 | 지원·특수 | 울림 파동으로 적을 약하게 | `O` | 신규 | 중가 (`120G`) | 한국 모티프 · 교차로 360도 음파+취약 |

---

## 2. 타워별 진화 트리 (Lv1~3 기본 → Lv4 1차 A/B → Lv7 2차 A1/A2/B1/B2)

- 기존 10종의 `Lv4` 1차 진화 명칭·핵심 수치는 `balance.candidate.v0.4.json`의 A/B 분기를 계승한다.
- `Lv7` 2차 진화는 1차 진화의 변경치를 유지한 위에서 **고유 능력 1개**를 추가한다(모든 수치는 `statusCaps`·`externalCaps` 상한 준수).

### 2.1 사격 분류 (5종)

#### [1] `archer` 궁수탑 (`60G` · 물리 · 대공 `O`)
- **기본형 (`Lv1~3`):** 피해 `8`, 간격 `30틱(1000ms)`, 사거리 `2500 milli`, 탄속 `12000`, 단일 표적.
- **상성(R4 B2):** 잘 잡는 적 없음 / 약한 적 없음 — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 속사 | 화살을 더 빨리 쏴요 | 공격 간격 배율 `intervalBP: 8000` |
| 2차 | `A1` | 연속 사격 | 세 번 쏠 때마다 두 발 연속! | 매 `3번째` 발사마다 `4틱` 뒤 동일 표적에 `damageBP: 8000` 추가 화살 1발 자동 발사, 본 화살 `damageBP: 12500` |
| 2차 | `A2` | 갈래 화살 | 가까운 적 셋에게 나눠 쏴요 | 최대 대상 `maxTargets: 3` 동시 조준 발사, 발당 `damageBP: 7500` (`splitter`·`swarm` 대응) |
| 1차 | `B` | 정찰 | 더 멀리, 조금 더 세게 쏴요 | `rangeAddMilli: +800` (총 `3300`), `damageBP: 13000` |
| 2차 | `B1` | 매의 눈 | 하늘 적과 먼 적에게 아주 세요 | `rangeAddMilli: +1200` (총 `3700`) 및 `flyer` 대상 피해 배율 `flyerDamageBP: 16500` |
| 2차 | `B2` | 급소 화살 | 다친 적을 한 방에 마무리해요 | 현재 체력 비율 `hp <= maxHp * 4000 / 10000` 이하인 적에게 피해 배율 `18000 BP` |

#### [2] `crossbow` 석궁탑 (`100G` · 물리 · 대공 `O`)
- **기본형 (`Lv1~3`):** 피해 `25`, 간격 `60틱(2000ms)`, 사거리 `3200 milli`, 탄속 `16000`, 물리 저항 무시 `5000 BP`.
- **상성(R4 B2):** 잘 잡는 적 `shell`·`boss`·`elite` / 약한 적 `swarm`·`runner` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 관통 | 뒤에 선 적까지 꿰뚫어요 | 첫 대상 뒤 선분 폭 `300 milli`의 2번째 적에게 `pierceDamageBP: 7500`, `damageBP: 10500` |
| 2차 | `A1` | 강철 꿰뚫기 | 한 줄로 선 적 넷까지 뚫어요 | 선분 폭 `380 milli`, 직선 뒤 적 최대 `3명`(총 `4명`)까지 각각 `7500 BP` 피해로 관통 |
| 2차 | `A2` | 파편 화살촉 | 맞은 뒤쪽으로 파편이 퍼져요 | 첫 대상 적중 시 전방 90도 반경 `900 milli` 내 최대 `3명`에게 `5500 BP` 파편 피해 (`splitter` 대응) |
| 1차 | `B` | 거대 사냥 | 정예와 대장에게 훨씬 세요 | `eliteBossDamageBP: 15000` |
| 2차 | `B1` | 중갑 파쇄기 | 어떤 갑옷도 완전히 뚫어요 | `physicalResistIgnoreBP: 10000`, `eliteBossDamageBP: 18500` |
| 2차 | `B2` | 쐐기 구속탄 | 큰 적의 발을 잠깐 못 박아요 | 적중 대상에게 감속 `5000 BP`를 `45틱(1500ms)` 부여(정예·대장은 첫 타 기절 `12틱` 추가) |

#### [3] `sling` 투석초소 (`65G` · 물리 · 대공 `O` · 신규)
- **기본형 (`Lv1~3`):** 피해 `8`, 간격 `33틱(1100ms)`, 사거리 `2300 milli`, 탄속 `11000`, 적중 후 반경 `1200 milli` 내 다른 적 1명에게 `7000 BP` 피해로 **1회 도탄(`ricochet`)**.
- **상성(R4 B2·B3):** 잘 잡는 적 `brute`·`clay` / 약한 적 `flyer` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 물수제비 | 돌멩이가 여러 적에게 튀어요 | 최대 도탄 횟수 `2회`(총 `3명`), 도탄 반경 `1500 milli`, 도탄 감쇠비 `7500 BP` |
| 2차 | `A1` | 통통 조약돌 | 다섯 적까지 지치지 않고 튀어요 | 최대 도탄 횟수 `4회`(총 `5명`), 도탄 감쇠비 `8500 BP` |
| 2차 | `A2` | 쌍돌팔매 | 돌 두 개를 한꺼번에 던져요 | 공격마다 서로 다른 표적 최대 `2명`에게 동시 발사(각각 도탄 `2회` 유지, `damageBP: 7500`) |
| 1차 | `B` | 묵직한 돌 | 돌이 커져서 더 아프게 맞혀요 | 도탄 제거(`maxTargets: 1`), `damageBP: 18000`, `physicalResistIgnoreBP: 2500` |
| 2차 | `B1` | 어질어질 바위 | 맞은 적을 잠깐 어지럽혀요 | 적중 대상에게 기절 `10틱(333ms)` 부여 및 `damageBP: 18500` |
| 2차 | `B2` | 쪼개지는 돌 | 부딪히면 돌조각이 사방에 튀어요 | 적중 지점 반경 `800 milli` 내 최대 `4명`에게 `6500 BP` 범위 파편 추가 타격 (`splitter` 대응) |

#### [4] `ballista` 거대노포 (`125G` · 물리 · 대공 `O` · 신규)
- **기본형 (`Lv1~3`):** 피해 `35`, 간격 `72틱(2400ms)`, 사거리 `3800 milli`, 탄속 `18000`, 발사 방향 사거리 끝까지 폭 `350 milli` 직선 위 적 최대 `4명` 관통(관통 감쇠 `8500 BP`).
- **상성(R4 B2·B3):** 잘 잡는 적 `boss`·`flyer`·`clay` / 약한 적 `runner` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 관통 작살 | 더 굵은 창이 감쇠 없이 뚫어요 | 선분 폭 `450 milli`, 최대 대상 `6명`, 관통 감쇠 없음(`chainFalloffBP: 10000`), `damageBP: 11000` |
| 2차 | `A1` | 폭풍 대노포 | 끝없이 긴 길을 단번에 꿰뚫어요 | `rangeAddMilli: +700` (총 `4500`), 최대 대상 `8명`, 공격 간격 배율 `intervalBP: 8500` |
| 2차 | `A2` | 밀치기 작살 | 꿰뚫린 적들을 뒤로 밀어내요 | 관통 적중한 모든 일반·정예 적을 경로 뒤로 `350 milli` 역진행(`knockback`, 대장 `120 milli`) |
| 1차 | `B` | 공성 화살 | 하늘 적과 대장에게 강력해요 | 최대 대상 `3명`으로 축소, `damageBP: 11500`, `eliteBossDamageBP: 13500` |
| 2차 | `B1` | 창공 사냥꾼 | 날아오는 적과 대장을 격추해요 | `flyerDamageBP: 18000`, `eliteBossDamageBP: 16000` |
| 2차 | `B2` | 불꽃 도화선 | 창이 지나간 길에 폭발이 나요 | 발사 `18틱(600ms)` 뒤 직선 궤적 위 적 최대 `5명`에게 기본 피해의 `5500 BP` 2차 물리 폭발 |

#### [5] `falcon` 매사냥대 (`100G` · 물리 · 대공 `O` · 신규)
- **기본형 (`Lv1~3`):** 피해 `16`, 간격 `36틱(1200ms)`, 사거리 `3400 milli`, 탄속 `18000`, 사거리 내 `flyer` 우선 조준(`preferFlyer: true`) 및 `flyerDamageBP: 10500`.
- **상성(R4 B2):** 잘 잡는 적 `flyer`·`runner` / 약한 적 `shell` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 급강하 | 매가 번개처럼 내려꽂혀요 | `intervalBP: 8000`, `flyerDamageBP: 16000` |
| 2차 | `A1` | 창공의 제왕 | 하늘 적을 단숨에 제압해요 | `flyerDamageBP: 21000` 및 적중한 `flyer` 반경 `900 milli` 공중 적 최대 `3명`에게 감속 `3500 BP` (`45틱`) |
| 2차 | `A2` | 쌍매 출격 | 매 두 마리가 함께 사냥해요 | 공격마다 최대 `2명` 동시 타격(`damageBP: 8000`), `rangeAddMilli: +400` |
| 1차 | `B` | 사냥 표식 | 약점을 찍어 다 같이 세게 쳐요 | 적중 적에게 `75틱(2500ms)` 동안 받는 최종 피해 `+2200 BP` 취약 표식(`vulnBP`) 부여, `damageBP: 12500` |
| 2차 | `B1` | 우두머리 추적 | 가장 튼튼한 적을 골라 찍어요 | 표적 규칙을 `현재 체력 최대` 우선으로 변경, 취약 표식 `vulnBP: 2500` (`90틱`) |
| 2차 | `B2` | 칼바람 날개 | 매가 스친 주변까지 함께 베어요 | 적중 대상 반경 `750 milli` 내 최대 `3명`에게 `7000 BP` 범위 피해 및 취약 표식 `1500 BP` 전파 |

---

### 2.2 폭발 분류 (5종)

#### [6] `cannon` 포탑 (`100G` · 물리 · 대공 `X`)
- **기본형 (`Lv1~3`):** 피해 `18`, 간격 `60틱(2000ms)`, 사거리 `2400 milli`, 탄속 `8000`, 착탄 폭발 반경 `750 milli`, 최대 대상 `4명`.
- **상성(R4 B2):** 잘 잡는 적 `swarm`·`splitter` / 약한 적 `flyer`·`runner` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 확산 | 더 넓게 터져 더 많이 맞혀요 | `splashRadiusMilli: 1050`, `maxTargets: 6`, `damageBP: 11500` |
| 2차 | `A1` | 산탄 대포 | 길 전체를 덮을 만큼 넓게 터져요 | `splashRadiusMilli: 1350`, `maxTargets: 8`, `intervalBP: 9000` (`splitter` 무리 광역 정리) |
| 2차 | `A2` | 자탄 포탄 | 터진 뒤 작은 폭탄이 한 번 더! | 착탄 `10틱` 뒤 동일 지점 반경 `950 milli`에 `5000 BP` 피해 2차 폭발(분열 파생체 후속 타격) |
| 1차 | `B` | 중포 | 좁게 터지지만 훨씬 세요 | `splashRadiusMilli: 550`, `maxTargets: 3`, `damageBP: 16000` |
| 2차 | `B1` | 파성 거포 | 단단한 갑각 적도 부숴 버려요 | `damageBP: 19500`, `physicalResistIgnoreBP: 4500` |
| 2차 | `B2` | 진동 충격탄 | 터지는 힘으로 적들을 멈춰요 | 폭발에 맞은 모든 적(최대 `3명`)에게 기절 `12틱(400ms)` 부여 |

#### [7] `mortar` 박격포대 (`135G` · 물리 · 대공 `X` · 신규)
- **기본형 (`Lv1~3`):** 피해 `26`, 간격 `84틱(2800ms)`, **최소 사거리 `1600 milli` ~ 최대 사거리 `4600 milli`**, 탄속 `7500`, 폭발 반경 `950 milli`, 최대 대상 `5명`.
- **상성(R4 B2·B3):** 잘 잡는 적 `swarm`·`burrow`·`splitter` / 약한 적 `runner`·`flyer` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 대형 유탄 | 멀리서 엄청나게 넓게 터져요 | `splashRadiusMilli: 1250`, `maxTargets: 7`, `rangeAddMilli: +400` (최대 `5000`), `damageBP: 11000` |
| 2차 | `A1` | 융단 포격 | 전장 반대편까지 묵직하게 덮어요 | `splashRadiusMilli: 1450`, `maxTargets: 9`, `damageBP: 12500` |
| 2차 | `A2` | 불꽃 유탄 | 터진 자리에 뜨거운 화상을 남겨요 | 피격 적에게 마법 화상 총피해 `12`(`milli` 환산 레벨 배율 적용)를 `60틱(2000ms)` 부여 |
| 1차 | `B` | 속사 박격 | 포탄이 더 빠르고 자주 떨어져요 | `intervalBP: 7800`, 탄속 `10500` |
| 2차 | `B1` | 쌍열 박격포 | 포탄 두 발을 잇달아 쏘아 올려요 | 발사 시 `12틱(400ms)` 간격으로 `damageBP: 7000` 유탄 `2발` 연속 낙하 (`splitter` 2단 정리) |
| 2차 | `B2` | 파갑 신호탄 | 맞은 적들의 방어를 약하게 해요 | 피격 적들의 물리·마법 저항을 `75틱(2500ms)` 동안 `2000 BP` 차감(`resistShredBP`) |

#### [8] `hwacha` 화차대 (`130G` · 물리 · 대공 `O` · 신규 · 한국 모티프 1)
- **기본형 (`Lv1~3`):** 발당 피해 `10`, 간격 `75틱(2500ms)`, 사거리 `3100 milli`, 탄속 `14000`, 한 주기에 `3틱` 간격으로 **불화살 `4발` 연발(`burstCount: 4`)** — 매 발마다 사거리 내 적 재조준(단일 착탄 반경 `350 milli`, 최대 `2명`).
- **상성(R4 B2):** 잘 잡는 적 `clay`·`swarm` / 약한 적 `shell` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 백발 신기전 | 불화살이 비처럼 쏟아져 내려요 | 연발 수 `burstCount: 6`, `rangeAddMilli: +300` |
| 2차 | `A1` | 화우 세례 | 여덟 발 화살비가 무리를 쓸어요 | 연발 수 `burstCount: 8`, 발사 간격 `2틱`, 착탄 반경 `450 milli` (`splitter`·겹방패 보스 특효) |
| 2차 | `A2` | 창공 유도전 | 하늘을 나는 적을 끝까지 쫓아요 | `preferFlyer: true`, `flyerDamageBP: 15000`, 단일 유도탄 전환으로 빗나감 방지 |
| 1차 | `B` | 대신기전 | 화살 수는 줄고 폭발은 커져요 | 연발 수 `burstCount: 3`, 발당 `damageBP: 16500`, 착탄 반경 `650 milli`(최대 `3명`) |
| 2차 | `B1` | 화약통 신기전 | 꽂힐 때마다 뜨거운 불이 붙어요 | 발당 마법 화상 총피해 `6`(`60틱`) 부여 및 착탄 반경 `750 milli` |
| 2차 | `B2` | 파갑 대화살 | 정예와 대장 방패를 연달아 뚫어요 | `physicalResistIgnoreBP: 5000`, `eliteBossDamageBP: 14500` |

#### [9] `roller` 통나무굴림대 (`95G` · 물리 · 대공 `X` · 신규)
- **기본형 (`Lv1~3`):** 피해 `15`, 간격 `66틱(2200ms)`, 투사 사거리 `1800 milli`(가장 가까운 경로 지점에 투입), 경로를 **거슬러(`-progress`) 속도 `9000 milli/초`로 최대 `2600 milli` 굴러가며** 폭 `600 milli` 내 지상 적 최대 `5명` 순차 타격.
- **상성(R4 B2):** 잘 잡는 적 `swarm`·`splitter`·`wisp` / 약한 적 `flyer`·`brute` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 가시 통나무 | 더 멀리 굴러가며 발을 늦춰요 | 굴림 거리 `3200 milli`, 최대 타격 `7명`, 충돌 적 감속 `2500 BP` (`45틱`) |
| 2차 | `A1` | 천하장사 맷돌 | 거대한 돌바위가 열 명을 뭉개요 | 굴림 거리 `4200 milli`, 최대 타격 `10명`, `physicalResistIgnoreBP: 4000`, `damageBP: 13500` |
| 2차 | `A2` | 쌍둥이 통나무 | 뒤따라 하나 더 굴러가 쓸어내요 | 투입 `15틱(500ms)` 뒤 `damageBP: 5500` 두 번째 통나무 연속 굴림 (`splitter` 분열체 청소) |
| 1차 | `B` | 화약 술통 | 정예와 부딪히거나 끝에서 쾅! | 최대 `4명` 충돌 또는 정예·대장 첫 충돌 시 즉시 반경 `950 milli` 폭발(`damageBP: 14500`, 최대 `5명`) |
| 2차 | `B1` | 큰불 화약통 | 엄청난 폭발로 주변을 초토화해요 | 폭발 반경 `1250 milli`, 최대 `7명`, 폭발 피해 배율 `damageBP: 18000` |
| 2차 | `B2` | 밀치기 큰통 | 굴러가며 적들을 뒤로 밀어붙여요 | 충돌한 일반·정예 적을 경로 뒤로 `300 milli` 역진행(`knockback`) 후 종료 폭발, `damageBP: 11000` |

#### [10] `alchemist` 약병투척소 (`90G` · 마법 · 대공 `X` · 신규)
- **기본형 (`Lv1~3`):** 틱당 장판 피해 `5`(매 `15틱=500ms`마다 타격, 총 `4회`), 투척 간격 `54틱(1800ms)`, 사거리 `2300 milli`, 탄속 `9500`, 착탄 지점에 **반경 `850 milli`, 지속 `60틱(2000ms)` 마법 물약 장판(`groundZone`)** 생성(틱당 최대 `5명`).
- **상성(R4 B2·B3):** 잘 잡는 적 `swarm`·`burrow`·`brute` / 약한 적 `runner`·`flyer` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 끈적이 수액 | 장판이 넓어지고 발이 쩍 붙어요 | 장판 반경 `1050 milli`, 장판 위 적 감속 `3000 BP` (`20틱` 갱신) |
| 2차 | `A1` | 호박 설탕늪 | 아주 오래 남는 끈적한 큰 늪! | 장판 지속 `90틱(3000ms)`(총 `6회` 타격), 감속 `4500 BP`, 최대 대상 `7명` |
| 2차 | `A2` | 톡톡 거품방울 | 장판 위에서 쓰러지면 펑 터져요! | 장판 위 적이 처치될 때 반경 `800 milli` 내 최대 `4명`에게 장판 1회 피해의 `18000 BP` 마법 폭발(`splitter` 카운터) |
| 1차 | `B` | 부글부글 물약 | 장판 마법 피해가 훨씬 세져요 | 장판 `damageBP: 14500`, 최대 대상 `6명` |
| 2차 | `B1` | 갑옷 녹이기 | 장판 위 적의 갑옷을 무르게 해요 | 장판 위 적의 물리·마법 저항을 `30틱` 동안 `2500 BP` 차감(`resistShredBP`) |
| 2차 | `B2` | 삼색 플라스크 | 앞뒤 길에 약병 세 개를 뿌려요 | 표적 지점 및 경로 전후 `±500 milli` 세 곳에 반경 `600 milli` 소형 장판(`damageBP: 7500`) 동시 생성 |

---

### 2.3 원소·마법 분류 (5종)

#### [11] `mage` 마법탑 (`95G` · 마법 · 대공 `O`)
- **기본형 (`Lv1~3`):** 피해 `16`, 간격 `42틱(1400ms)`, 사거리 `2400 milli`, 탄속 `10000`, 단일 표적.
- **상성(R4 B2):** 잘 잡는 적 `shell` / 약한 적 `wisp` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 집중 | 한 적에게 더 세게 쏴요 | `damageBP: 14000` |
| 2차 | `A1` | 비전 집중포 | 같은 적을 계속 치면 더 아파요 | 직전 공격과 동일 `enemyId` 연속 타격 시 중첩당 `+1500 BP`(최대 `+4500 BP`) 추가 피해, 즉발(`instant`) 전환 |
| 2차 | `A2` | 정령 파쇄탄 | 마법 저항도 뚫고 큰 적을 쳐요 | 마법 저항 무시 `5000 BP` 및 `eliteBossDamageBP: 15000` |
| 1차 | `B` | 파동 | 맞은 곳 주변 적도 함께 맞혀요 | `splashRadiusMilli: 750`, `maxTargets: 3`, `splashDamageBP: 9500` |
| 2차 | `B1` | 대마법 파동 | 파동이 훨씬 넓고 강하게 퍼져요 | `splashRadiusMilli: 950`, `maxTargets: 5`, `splashDamageBP: 9500` |
| 2차 | `B2` | 별빛 소용돌이 | 흩어진 적들을 가운데로 모아요 | 착탄 반경 `900 milli` 내 일반 적(최대 `4명`)의 `progress`를 중심 적 쪽으로 최대 `250 milli` 당김(`splitter` 집결) |

#### [12] `frost` 서리탑 (`60G` · 마법 · 대공 `O`)
- **기본형 (`Lv1~3`):** 피해 `5`, 간격 `27틱(900ms)`, 사거리 `2000 milli`, 탄속 `10000`, 감속 `3000 BP` / `60틱(2000ms)`.
- **상성(R4 B2):** 잘 잡는 적 `runner` / 약한 적 `boss`·`wisp` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 혹한 | 더 세게, 더 오래 느리게 해요 | `slowBP: 4000`, `slowTicks: 75틱(2500ms)` |
| 2차 | `A1` | 얼음 감옥 | 세 번 쏠 때마다 꽁꽁 얼려 멈춰요 | `slowBP: 5500` 및 매 `3번째` 발사마다 적중 대상에게 빙결(기절) `18틱(600ms)` 부여 |
| 2차 | `A2` | 고드름 송곳 | 이미 느려진 적에게 아주 아파요 | 현재 감속(`slows`) 상태인 적 타격 시 피해 배율 `30000 BP`(기본 피해 3배) 및 `rangeAddMilli: +400` |
| 1차 | `B` | 얼음 장판 | 맞은 곳 주변 적을 함께 늦춰요 | `splashRadiusMilli: 700`, `maxTargets: 4`, `slowBP: 2000`, `slowTicks: 60틱(2000ms)` |
| 2차 | `B1` | 눈보라 첨탑 | 탑 주변 모든 적을 쉬지 않고 얼려요 | 즉발 타워 중심 반경 `2200 milli` 전방위 파동 전환, 최대 `6명`, `slowBP: 3000` (`60틱`) |
| 2차 | `B2` | 깨지는 얼음꽃 | 얼어붙은 적이 쓰러지면 펑 터져요 | 이 탑의 감속이 걸린 적이 처치될 때 반경 `750 milli` 최대 `4명`에게 `20000 BP` 냉기 파편 피해 + 감속 전이 |

#### [13] `lightning` 번개탑 (`150G` · 마법 · 대공 `O`)
- **기본형 (`Lv1~3`):** 피해 `14`, 간격 `45틱(1500ms)`, 사거리 `2500 milli`, 즉발(`instant`), 최대 대상 `3명`, 연쇄 반경 `1800 milli`, 연쇄 감쇠비 `7000 BP`.
- **상성(R4 B2):** 잘 잡는 적 `swarm`·`splitter` / 약한 적 `runner`·`wisp` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 연쇄 | 번개가 더 많은 적에게 튀어요 | `maxTargets: 5`, `chainFalloffBP: 6500` |
| 2차 | `A1` | 폭풍 전류 | 일곱 적까지 힘 잃지 않고 튀어요 | `maxTargets: 7`, `chainFalloffBP: 8500`, 연쇄 반경 `2100 milli` (`splitter`·`flyer` 무리 특효) |
| 2차 | `A2` | 번개 구슬 | 마지막에 맞은 곳에서 스파크 폭발! | 마지막 연쇄 대상 중심 반경 `800 milli` 내 최대 `4명`에게 최초 피해의 `6000 BP` 범위 마법 피해 |
| 1차 | `B` | 충격 | 첫 적을 잠깐 멈추게 해요 | `maxTargets: 2`, `chainFalloffBP: 8000`, 첫 대상 기절 `9틱(300ms)` |
| 2차 | `B1` | 우레의 심판 | 굵은 벼락이 큰 적을 강타해요 | `damageBP: 14500`, 첫 대상 기절 `18틱(600ms)`, `eliteBossDamageBP: 13500` |
| 2차 | `B2` | 전류 전도 | 멈춤 효과가 다음 적에게도 옮겨요 | `maxTargets: 3`, 연쇄된 모든 대상에게 기절 `10틱(333ms)` 부여 |

#### [14] `flame` 화염탑 (`130G` · 마법 · 대공 `X` [단 `A2`에서 `O`])
- **기본형 (`Lv1~3`):** 피해 `8`, 간격 `23틱(750ms)`, 사거리 `1700 milli`, 즉발 90도 부채꼴, 최대 대상 `3명`, 화상 총피해 `4` / `60틱(2000ms)`.
- **상성(R4 B2):** 잘 잡는 적 `swarm`·`splitter` / 약한 적 `wisp`·`flyer` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 넓은 불길 | 더 멀리, 더 많이 태워요 | `rangeAddMilli: +400` (총 `2100`), `maxTargets: 5` |
| 2차 | `A1` | 화염 폭풍 | 쉴 새 없이 일곱 적을 휩쓸어요 | `maxTargets: 7`, `intervalBP: 8000` |
| 2차 | `A2` | 용오름 불기둥 | 치솟는 불길이 하늘 적까지 태워요 | **공중 공격 해금(`canHitFlyer: true`)**, `rangeAddMilli: +600` (총 `2300`), `flyerDamageBP: 13000` |
| 1차 | `B` | 잔불 | 불이 더 오래 세게 남아요 | `burnBP: 20000`, `damageBP: 9000` |
| 2차 | `B1` | 푸른 성화 | 마법 저항도 녹이는 뜨거운 불꽃! | `burnBP: 28000`, 화상 및 직접 타격에 마법 저항 무시 `4000 BP` 적용 |
| 2차 | `B2` | 불씨 옮기기 | 불붙은 적이 쓰러지면 옆으로 번져요 | 이 탑의 화상 보유 적이 처치될 때 반경 `850 milli` 최대 `4명`에게 동일 화상 즉시 부여(`splitter` 전염) |

#### [15] `wind` 바람개비탑 (`90G` · 마법 · 대공 `O` · 신규)
- **기본형 (`Lv1~3`):** 피해 `7`, 간격 `42틱(1400ms)`, 사거리 `2400 milli`, 즉발 90도 부채꼴(최대 `4명`), 피격 일반·정예 적을 경로 뒤로 **`500 milli` 역진행(`knockbackMilli`)** — `flyer`는 **`600 milli`** 역진행(대장은 밀치기 면역, 감속 `2000 BP` `30틱`으로 대체).
- **상성(R4 B2):** 잘 잡는 적 `flyer` / 약한 적 `boss` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 역풍 돌풍 | 더 많은 적을 더 멀리 밀쳐내요 | 최대 대상 `5명`, 지상 역진행 `650 milli` / `flyer` 역진행 `800 milli`, `damageBP: 13500` |
| 2차 | `A1` | 태풍 풍차 | 거센 태풍이 밀치고 발까지 늦춰요 | `rangeAddMilli: +400`, 역진행 `800 milli`(`flyer` `1000 milli`) 및 감속 `3000 BP` (`45틱`) 부여 |
| 2차 | `A2` | 하강 기류 | 하늘 적을 땅으로 짓눌러요! | 피격 `flyer`를 `90틱(3000ms)` 동안 **고도 추락 상태(`grounded`: 지상 전용 타워도 조준·타격 가능)**로 만듦 |
| 1차 | `B` | 칼바람 | 날카로운 바람날로 빠르게 베어요 | 밀치기 `120 milli`로 축소, `intervalBP: 7500`, `damageBP: 13500` |
| 2차 | `B1` | 회오리 칼날 | 직선으로 뻗는 회오리가 다 베어요 | 부채꼴 대신 길이 `3000 milli`·폭 `500 milli` 직선 관통(최대 `6명`, `damageBP: 17000`) |
| 2차 | `B2` | 순풍 응원 | 바람을 불어 이웃 타워도 빠르게! | 발사할 때마다 반경 `1800 milli` 내 아군 공격 타워 최대 `2기`의 다음 공격 대기 틱을 `6틱` 단축 |

---

### 2.4 지원·특수 분류 (5종)

#### [16] `spear` 창병초소 (`70G` · 물리 · 대공 `X`)
- **기본형 (`Lv1~3`):** 피해 `7`, 간격 `15틱(480ms)`, 사거리 `1300 milli`, 즉발(`instant`), 단일 표적.
- **상성(R4 B2):** 잘 잡는 적 `runner`·`brute` / 약한 적 `flyer`·`boss` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 긴 창 | 한 줄로 선 세 적을 찔러요 | `rangeAddMilli: +400` (총 `1700`), 선분 폭 `350 milli`, `maxTargets: 3`, `damageBP: 11000` |
| 2차 | `A1` | 장창 방진 | 네 명까지 한꺼번에 꿰뚫어 막아요 | `rangeAddMilli: +600` (총 `1900`), 선분 폭 `420 milli`, `maxTargets: 4` (`splitter` 즉각 2인 찌르기) |
| 2차 | `A2` | 풍차 창술 | 세 번 찌를 때마다 주변을 휩쓸어요 | 매 `3번째` 공격마다 타워 중심 반경 `1600 milli` 내 최대 `5명`에게 `14000 BP` 회전 참격 |
| 1차 | `B` | 파쇄 | 단단한 적을 더 세게 찔러요 | `damageBP: 12000`, `physicalResistIgnoreBP: 5000` |
| 2차 | `B1` | 갑옷 틈새 | 찌를수록 적의 갑옷을 벗겨내요 | 적중 적의 물리 저항을 `90틱(3000ms)` 동안 `2500 BP` 차감(`resistShredBP`) 및 `damageBP: 14500` |
| 2차 | `B2` | 방패 밀치기 | 찌르며 방패로 쳐서 멈춰 세워요 | 매 `4번째` 공격마다 첫 표적에게 기절 `12틱(400ms)` 부여 및 `damageBP: 13500` |

#### [17] `guardian` 수호기사 (`180G` · 물리 · 대공 `X` [단 `B1`에서 `O`] · 맵 최대 `1기`)
- **기본형 (`Lv1~3`):** 피해 `30`, 정예·대장 `eliteBossDamageBP: 25000`, 간격 `42틱(1400ms)`, 사거리 `1800 milli`, 즉발(`instant`), 단일 표적, `maxOnField: 1`.
- **상성(R4 B2):** 잘 잡는 적 `boss`·`elite`·`brute` / 약한 적 `swarm`·`flyer` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 결투 | 정예와 대장에게 훨씬 세요 | `eliteBossDamageBP: 30000` |
| 2차 | `A1` | 왕국의 검성 | 대장조차 꼼짝 못 할 일격을 날려요 | `eliteBossDamageBP: 35000`, 정예·대장 타격 시 감속 `3000 BP` (`60틱`) 및 물리 저항 무시 `4000 BP` |
| 2차 | `A2` | 불굴의 맹세 | 성문이 위험할수록 기사가 강해져요 | 성문 잃은 체력 비율에 비례해 공격속도 최대 `+3000 BP`, 피해 최대 `+2500 BP` 상승(최소 `+1000 BP` 상시) |
| 1차 | `B` | 수호 일격 | 주변 적 여럿을 함께 베어요 | 첫 대상 중심 반경 `800 milli`, `maxTargets: 3`, `splashDamageBP: 8000` |
| 2차 | `B1` | 황금 검풍 | 넓은 검기가 하늘 적까지 베어요! | **공중 공격 해금(`canHitFlyer: true`)**, 반경 `1100 milli`, `maxTargets: 6`, `splashDamageBP: 10000` |
| 2차 | `B2` | 철벽 수호진 | 기사 주변을 지나는 적은 느려져요 | 수호기사 중심 반경 `1800 milli` 내 모든 지상 적에게 상시 감속 오라 `2500 BP` 부여 |

#### [18] `banner` 깃발초소 (`85G` · 비공격 · 오라 반경 `3000 milli`)
- **기본형 (`Lv1~3`):** 직접 공격 없음, 반경 `3000 milli` 내 공격 타워에 공격력 보너스 Lv1~2 `[2500, 2700] BP`(Lv3은 마지막 값) 부여(동종 오라 최고값 적용, `externalCaps` 준수).
- **상성(R4 B2):** 잘 잡는 적 없음 / 약한 적 없음 — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 용기 | 주변 타워가 더 세게 공격해요 | 공격력 오라 Lv4~6 `[2800, 3000, 3200] BP` |
| 2차 | `A1` | 왕실 대군기 | 주변 타워가 대장에게 더욱 강해요 | 공격력 오라 Lv7~9 `[3200, 3500, 3800] BP` 및 범위 내 타워에 `eliteBossDamageBP: +1500 BP` 추가 부여 |
| 2차 | `A2` | 승리의 나팔 | 주변 타워가 적을 잡으면 보너스! | 공격력 오라 Lv7~9 `[3200, 3300, 3400] BP`(2026-11-05: A 마지막 값 3200에서 이어 진화로 줄지 않게) 및 범위 내 타워의 적 `5처치`마다 보너스 골드 `+2G` 지급(웨이브당 최대 `10G` 상한) |
| 1차 | `B` | 신속 | 주변 타워가 더 빨리 공격해요 | 공격속도 오라 Lv4~6 `[2500, 2800, 3100] BP` |
| 2차 | `B1` | 질풍 군기 | 버닝 때는 깃발 힘이 배로 커져요! | 공격속도 오라 Lv7~9 `[3100, 3400, 3700] BP`, 버닝(`burning`) 활성 중에는 오라 반경 `+600 milli` 및 속도 오라 `2400 BP` |
| 2차 | `B2` | 한마음 군기 | 속도와 공격력을 함께 올려 줘요 | 공격속도 오라 `1900 BP`부터 + 공격력 오라 `2200 BP`부터 동시 제공 |

#### [19] `trap` 덫공방초소 (`85G` · 물리 · 대공 `X` · 신규)
- **기본형 (`Lv1~3`):** 피해 `16`, 설치 간격 `66틱(2200ms)`, 사거리 `2000 milli` 내 경로 위에 **최대 `3개`의 바닥 덫(`roadTrap`, 감지 반경 `350 milli`)** 배치(웨이브 중 유지, 다음 웨이브 시작 시 잔여 덫 최대 `2개` 이월). 밟은 첫 적에게 피해 + 감속 `3500 BP` (`45틱`).
- **상성(R4 B2·B3):** 잘 잡는 적 `runner`·`burrow`·`brute` / 약한 적 `flyer` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 올가미 그물 | 덫을 더 많이 깔고 꽉 붙잡아요 | 최대 보유 덫 `4개`, 밟은 적 기절 `15틱(500ms)` 및 `physicalResistIgnoreBP: 3500`, `damageBP: 12000` |
| 2차 | `A1` | 강철 곰덫 | 큰 적도 단단히 물어 큰 피해를! | `damageBP: 17500`, 기절 `24틱(800ms)`, `eliteBossDamageBP: 15000` |
| 2차 | `A2` | 넓적 그물망 | 밟으면 주변 친구들까지 함께 묶여요 | 발동 반경 `750 milli` 내 최대 `4명` 동시 피해 및 기절 `15틱` 부여 |
| 1차 | `B` | 폭죽 발판 | 밟으면 펑 터져 여럿을 맞혀요 | 최대 보유 덫 `4개`, 발동 시 반경 `800 milli` 최대 `4명`에게 범위 물리 피해(`damageBP: 10500`) |
| 2차 | `B1` | 도토리 연쇄덫 | 한 번 터진 자리에 작은 덫이 또! | 덫이 터진 자리에서 `12틱` 뒤 `damageBP: 8000` 2차 폭죽 자동 발동 (`splitter` 분열체 즉시 제거) |
| 2차 | `B2` | 용수철 발판 | 밟은 적들을 통! 뒤로 튕겨내요 | 발동 반경 `700 milli` 내 일반·정예 적(최대 `3명`)을 경로 뒤로 `450 milli` 역진행(`knockback`), `damageBP: 13000` |

#### [20] `bell` 종각초소 (`120G` · 마법 · 대공 `O` · 신규 · 한국 모티프 2)
- **기본형 (`Lv1~3`):** 피해 `9`, 간격 `60틱(2000ms)`, 타워 중심 **반경 `2300 milli` 360도 즉발 음파 고리**(최대 대상 `5명`, 공중 포함), 피격 적에게 `60틱(2000ms)` 동안 받는 피해 증가 **`vulnBP: 2500`** 부여.
- **상성(R4 B2):** 잘 잡는 적 `boss`·`elite` / 약한 적 `wisp`·`brute` — 직접 타격 ×1.3 / ×0.7. 형태가 바꾸는 상성과 정확한 수치는 계약(`balance.candidate.v0.4.json` `towers`·`forms`)을 따른다.

| 단계 | 코드 | 이름 | 한 줄 요약 | 규칙 변화 및 고유 능력 (`30Hz`, `milli`, `BP`) |
|---|---|---|---|---|
| 1차 | `A` | 큰울림 종 | 종소리가 넓게 퍼져 적을 약하게! | 반경 `2600 milli`, 최대 대상 `7명`, 취약 `vulnBP: 3000` (`75틱`) |
| 2차 | `A1` | 천둥 대범종 | 전장을 울려 모든 적을 크게 약화! | 반경 `2900 milli`, 최대 대상 `10명`, 취약 `vulnBP: 3000` (`90틱`) |
| 2차 | `A2` | 여운 메아리 | 종소리가 두 번 울려 분열 적도 타격! | 본 타격 `15틱(500ms)` 뒤 반경 내 `damageBP: 6000` 여운 파동 1회 추가 발동 (`splitter` 대응) |
| 1차 | `B` | 맑은 종소리 | 아군 타워 사거리도 넓혀 주는 종! | 최대 대상 `5명` 유지, 반경 `2000 milli` 내 아군 공격 타워에 사거리 보너스 `+250 milli` 오라 부여 |
| 2차 | `B1` | 파수꾼 종각 | 이웃 타워가 훨씬 멀리, 하늘까지! | 아군 사거리 오라 `+400 milli` 및 **반경 `1600 milli` 내 지상 투사체 타워(`cannon`)는 제외하되 근접·부채꼴 타워(`spear`, `flame`, `guardian`)에 대공 타격 부여**(또는 사거리 오라 `+500 milli` + 공속 `+800 BP`로 단순화 가능) |
| 2차 | `B2` | 진혼의 종 | 종소리에 맞은 적의 발걸음이 굳어요 | 음파 피격 적에게 기절 `9틱(300ms)` 및 감속 `2500 BP` (`45틱`) 추가 부여 |

---

## 3. 형태별 외형 변화 규칙 및 영문 프롬프트 조각

### 3.1 단계별 실루엣·재료 진화 공통 규칙 (41번 왕국 원정대 + 아트 규격 v2)

- **캔버스·선화 규격:** `192×192` 투명 PNG(`originX: 0.5, originY: 0.8125`), 상부 사선 2D, 좌상단 광원, 갈색 외곽선(`#3a291e`), 과도한 광륜·블룸·텍스트 금지.
- **3덩어리 가독성:** 모든 형태는 **① 기반(받침대) + ② 공격 기관(무기/장치) + ③ 역할 표식(상단·전면 기호)** 세 덩어리로 읽혀야 한다.
- **단계별 재료·실루엣 분화:**
  1. **`Lv1~3` 기본형 (`base`):** 소나무 원목 + 둥근 강돌 받침 + 무쇠 부품. 낮고 아담한 1단 원통/사각 실루엣.
  2. **`Lv4~6` 1차 진화 (`A` vs `B`):** 다듬은 회백색 성벽 돌 + 구리/청동 테두리.
     - **`A` 갈래 (다수·확산·속사형):** **가로 확장 실루엣** — 쌍포신, 넓은 지붕, 다연장 발사대, 양쪽 날개 구조물.
     - **`B` 갈래 (집중·중량·특수형):** **수직 고층·중장갑 실루엣** — 높게 솟은 첨탑, 단일 대구경 포신, 두꺼운 철갑 방패판.
  3. **`Lv7+` 2차 진화 (`A1`/`A2`/`B1`/`B2`):** 정교한 백색 화강암·청기와/왕실 지붕 + 황동 금장(`#E6B84C`) 포인트 + **고유 상단 엠블럼 1개**로 A1과 A2, B1과 B2를 색이 아닌 꼭대기 조형으로 즉시 구분한다.

### 3.2 20종 × 7형태 영문 프롬프트 조각 (각 30단어 이하)

> 공통 스타일 프리픽스(생성 시 앞에 결합): `2D top-down oblique fantasy tower asset, Kingdom Expedition style, warm #3a291e outlines, bold clean shapes, soft top-left light, no text, no neon bloom:`

| `id` | `base` (Lv1~3) | `A` / `A1` / `A2` (가로·다수·확산 계열) | `B` / `B1` / `B2` (수직·중량·집중 계열) |
|---|---|---|---|
| `archer` | **base:** `Short pine watchtower on pebble base, single wooden bow turret, green quiver emblem.` (13w) | **A:** `Wide timber tower, twin rapid shortbows side-by-side, wind vane.` (9w)<br>**A1:** `White stone wide turret, triple rotary shortbow rack, brass gear crest.` (11w)<br>**A2:** `Broad stone watchtower, fan-shaped three-arrow bow frame, feathered wing crest.` (10w) | **B:** `Tall stone lookout tower, long composite bow, brass spyglass marker.` (10w)<br>**B1:** `High spire tower, eagle-wing longbow, golden hawk-eye weathercock on roof.` (10w)<br>**B2:** `Tall armored turret, crimson-fletched heavy longbow, target bullseye shield emblem.` (10w) |
| `crossbow` | **base:** `Sturdy oak platform, wide horizontal iron arbalest, bronze bolt rack.` (10w) | **A:** `Broad stone bastion, dual-rail piercing crossbow, silver spearhead crest.` (9w)<br>**A1:** `Wide granite bunker, long steel rail-arbalest with four stacked bolts.` (10w)<br>**A2:** `Wide brass-trimmed turret, notched scatter-bolt crossbow, starburst iron shield.` (9w) | **B:** `Tall reinforced stone tower, thick winch arbalest, horned trophy emblem.` (10w)<br>**B1:** `Towering ironclad turret, massive drill-tipped siege bolt, golden crown seal.` (10w)<br>**B2:** `Heavy vertical keep, chained harpoon arbalest, iron anchor side marker.` (10w) |
| `sling` | **base:** `Low wooden post on stone ring, Y-shaped leather slingshot, pebble basket.` (11w) | **A:** `Wide timber deck, twin elastic sling arms, skipping-stone tray.` (9w)<br>**A1:** `Broad white-stone stand, spinning wheel multi-slinger, blue wave crest.` (9w)<br>**A2:** `Double-forked wide oak catapult frame, two loaded smooth river stones.` (10w) | **B:** `Tall counterweight timber frame, heavy leather pouch holding one boulder.` (10w)<br>**B1:** `High stone sling tower, banded granite stun-rock, brass star emblem.` (10w)<br>**B2:** `Sturdy tall frame, cracked geode boulder in sling, amber crystal chunks.` (11w) |
| `ballista` | **base:** `Heavy timber turntable on stone pad, long iron-armed javelin ballista.` (10w) | **A:** `Wide stone rampart, broad twin-limb steel ballista, long silver lance.` (10w)<br>**A1:** `Grand white-stone bastion, giant triple-string wind ballista, winged spear crest.` (10w)<br>**A2:** `Wide brass-geared platform, blunt ram-headed javelin with coiled rope reel.` (10w) | **B:** `Tall elevated siege mount, angled heavy iron ballista, dragon-prow shield.` (10w)<br>**B1:** `High sky-aimed stone turret, golden-feathered anti-air harpoon, cloud crest.` (9w)<br>**B2:** `Tall armored mount, copper-capped fuse javelin, red powder horn marker.` (10w) |
| `falcon` | **base:** `Tall wooden perch post on mossy stone, brown hunting falcon, leather gauntlet sign.` (13w) | **A:** `Wide twin-beam wooden roost, sleek diving peregrine, teal wind ribbons.` (10w)<br>**A1:** `Grand stone aviary arch, golden-crested king eagle wings spread wide.` (10w)<br>**A2:** `Broad double-perch stone tower, two alert falcons perched left and right.` (11w) | **B:** `High stone falconry tower, hooded tracker hawk, red hunter horn emblem.` (10w)<br>**B1:** `Tall spire roost, fierce crimson-feathered hawk, golden bullseye banner.` (9w)<br>**B2:** `Ornate stone tower, broad-winged storm hawk surrounded by carved feather vanes.` (11w) |
| `cannon` | **base:** `Round cobblestone base, short chunky black iron cannon barrel, cannonball stack.` (11w) | **A:** `Wide stone battery, flared funnel-mouth blunderbuss cannon, dual powder kegs.` (10w)<br>**A1:** `Broad brass-rimmed fortress pad, triple-mouthed scatter cannon, wide blast shield.` (10w)<br>**A2:** `Wide granite turret, cluster-drum cannon loaded with bundled mini-bombs.` (9w) | **B:** `Tall armored stone mount, thick long-caliber iron siege cannon.` (9w)<br>**B1:** `Heavy towering ironclad turret, brass-ringed fortress breaker cannon, ram crest.` (10w)<br>**B2:** `Tall reinforced keep, flat-muzzle concussion cannon, heavy bell-shaped recoil weight.` (10w) |
| `mortar` | **base:** `Sunken sandbag-and-stone pit, upward-angled stubby bronze mortar tube, shell crate.` (10w) | **A:** `Wide stone artillery pit, wide-bore cauldron mortar, large round shells.` (10w)<br>**A1:** `Broad granite fortification, mammoth brass siege mortar, royal sunburst rim.` (10w)<br>**A2:** `Wide brick-and-stone pit, copper-braided ember mortar, warm coal brazier.` (9w) | **B:** `Elevated stepped stone base, sleek steep-angle iron mortar, rangefinder quadrant.` (10w)<br>**B1:** `Tall stone mount, twin vertical mortar barrels side-by-side, brass gears.` (10w)<br>**B2:** `High stone turret, fluted brass signal mortar, painted target flag.` (10w) |
| `hwacha` | **base:** `Two-wheeled oak cart on stone pad, honeycombed wooden box holding fire-arrows.` (11w) | **A:** `Wide four-wheeled armored cart, broad curved rack of sixty red arrows.` (11w)<br>**A1:** `Grand white-stone terrace, double-wide brass hwacha launcher, golden phoenix plaque.` (10w)<br>**A2:** `Wide tilted sky-rack cart, blue-fletched upward rocket arrows, cloud banner.` (10w) | **B:** `Tall reinforced wooden carriage, nine thick iron-tipped giant rocket tubes.` (10w)<br>**B1:** `Heavy tile-roofed siege cart, copper gunpowder-keg rocket spears, ember lantern.` (10w)<br>**B2:** `Tall brass-plated hwacha tower, armor-piercing steel rocket lances, tiger crest.` (10w) |
| `roller` | **base:** `Sloped wooden chute on stone base, heavy oak log ready to roll.` (12w) | **A:** `Wide timber ramp, iron-spiked wide cedar log, side guide rails.` (10w)<br>**A1:** `Grand stone chute, giant carved granite millstone wheel, brass axle.` (10w)<br>**A2:** `Wide dual-track wooden ramp holding two spiked logs in tandem.` (10w) | **B:** `Steep tall stone launcher, banded red powder barrel with short rope fuse.` (12w)<br>**B1:** `High iron-framed tower chute, oversized brass-bound bomb cask, flame seal.` (10w)<br>**B2:** `Tall spring-loaded stone ramp, heavy iron-bumper barrel, ram horn emblem.` (10w) |
| `alchemist` | **base:** `Timber workshop stand, copper cauldron and sling arm holding teal glass flask.` (12w) | **A:** `Wide stone lab table, bubbly amber honey vat, wide ladle catapult.` (11w)<br>**A1:** `Broad tiled pavilion, giant golden sap cauldron, sticky drip spout.` (10w)<br>**A2:** `Wide marble counter, iridescent soap-bubble alembic dome, round flasks.` (9w) | **B:** `Tall brick chimney tower, pressurized green-potion glass tank, brass nozzle.` (10w)<br>**B1:** `High stone spire lab, fuming emerald flask launcher, broken-shield plaque.` (10w)<br>**B2:** `Tall rotary brass rack holding red, teal, and gold potion bottles.` (11w) |
| `mage` | **base:** `Cylindrical grey stone tower, floating vertical violet crystal, small book emblem.` (11w) | **A:** `Focused stone obelisk, forward-aimed brass crystal prism ring, star seal.` (10w)<br>**A1:** `White marble spire, aligned triple brass lenses channeling purple crystal core.` (11w)<br>**A2:** `Tall dark-trimmed granite tower, sharp diamond-cut violet spire, crown ring.` (10w) | **B:** `Wide circular stone terrace, round indigo orb surrounded by three mini-spheres.` (11w)<br>**B1:** `Broad white-stone sanctum, five orbiting azure crystals around central dome.` (10w)<br>**B2:** `Wide brass-ringed astrolabe tower, swirling starry indigo globe in center.` (10w) |
| `frost` | **base:** `Pale stone pedestal, jagged clear cyan ice shard cluster, snowflake sign.` (11w) | **A:** `Tall glacier-stone spire, single towering deep-blue icicle lance, frost crown.` (10w)<br>**A1:** `High white-stone keep, hexagonal ice-cage crystal pillar, silver padlock emblem.` (10w)<br>**A2:** `Tall sharp spire, serrated twin cyan ice spears, crisp winter banner.` (11w) | **B:** `Wide low stone basin, flat blooming ice-flower crystal, snowy rim.` (10w)<br>**B1:** `Broad circular stone shrine, spinning snowflake weather-spire, four frost vents.` (10w)<br>**B2:** `Wide frosted stone ring, cluster of brittle faceted ice lotus buds.` (11w) |
| `lightning` | **base:** `Riveted stone plinth, two curved copper fork electrodes, yellow spark ball.` (11w) | **A:** `Wide stone platform, four fanned brass tesla coils linked by copper wire.` (12w)<br>**A1:** `Broad marble generator, ring of six golden lightning rods, storm drum.` (11w)<br>**A2:** `Wide copper-domed turret, twin arc coils cradling a bright amber sphere.` (11w) | **B:** `Tall stone obelisk, single thick iron lightning spire, anvil emblem.` (10w)<br>**B1:** `Towering white-and-gold pillar, giant trident thunder rod, royal cloud crest.` (10w)<br>**B2:** `High stone tower, heavy brass capacitor rod with copper chain conductors.` (11w) |
| `flame` | **base:** `Low iron-banded brick stove base, wide open bronze dragon-mouth nozzle, ember pot.` (12w) | **A:** `Wide stone hearth bunker, three fanned brass flame nozzles, red bellows.` (11w)<br>**A1:** `Broad granite bastion, wide curved five-vent fire grate, golden sun plate.` (11w)<br>**A2:** `Wide stone brazier tower, upward-tilted spiral chimney spout, rising flame vane.` (11w) | **B:** `Tall brick furnace tower, concentrated copper oil-torch cauldron, coal chute.` (10w)<br>**B1:** `High white-stone beacon keep, ornate brass brazier burning clear blue fire.` (11w)<br>**B2:** `Tall iron-riveted kiln tower, hanging lantern censers filled with warm embers.` (11w) |
| `wind` | **base:** `Round timber mill house on stone base, four-blade cream canvas pinwheel.` (11w) | **A:** `Wide stone windmill base, broad six-sail wooden rotor, teal wind-sock.` (10w)<br>**A1:** `Grand white-stone Dutch mill, giant eight-blade brass-rimmed fan, cloud crest.` (10w)<br>**A2:** `Wide angled stone tower, downward-tilted twin wooden rotors, heavy anchor vane.` (11w) | **B:** `Tall slender stone tower, vertical-axis curved metal wind turbine blades.` (10w)<br>**B1:** `High marble spire, fast-spinning silver spiral vortex blades, swallow emblem.` (10w)<br>**B2:** `Tall timber-and-brass tower, cheerful pinwheel topped with golden cheer-flags.` (9w) |
| `spear` | **base:** `Sandbagged wooden guard post, chibi soldier in blue tunic holding straight spear.` (12w) | **A:** `Wide stone barricade, two chibi pikemen holding extra-long iron pikes.` (10w)<br>**A1:** `Broad white-stone rampart, phalanx rack of four gleaming brass-tipped lances.` (10w)<br>**A2:** `Circular stone guard ring, agile lancer holding double-ended spinning halberd.` (10w) | **B:** `Reinforced iron-shielded post, armored guard wielding heavy wedge-head partisan.` (9w)<br>**B1:** `Tall stone sentry box, gold-trimmed soldier holding spiked armor-breaker pike.` (10w)<br>**B2:** `Sturdy stone bunker, tower-shield pikeman bracing a thick blunt ram-spear.` (10w) |
| `guardian` | **base:** `Flagstone hero dais, stocky armored chibi knight with kite shield and broadsword.` (12w) | **A:** `Raised marble duelist pedestal, caped knight holding two-handed golden greatsword.` (10w)<br>**A1:** `Grand crowned dais, royal champion in white-gold plate, giant sunblade.` (10w)<br>**A2:** `engraved stone altar, crimson-caped paladin raising glowing lion-crest banner sword.` (10w) | **B:** `Wide stone bastion circle, heavy knight with broad curved cleaver and buckler.` (12w)<br>**B1:** `Broad golden-ringed arena pad, winged valkyrie-knight swinging twin crescent blades.` (10w)<br>**B2:** `Wide fortress plinth, giant-shielded sentinel planting three iron ward-standards.` (9w) |
| `banner` | **base:** `Carved stone socket, tall oak pole flying a red-and-gold swallowtail pennant.` (11w) | **A:** `Wide stone podium, crimson velvet war-banner topped with brass lion finial.` (11w)<br>**A1:** `Grand marble rostrum, wide royal tapestry standard, golden crown and laurels.` (11w)<br>**A2:** `Broad festive stone stage, scarlet banner paired with gleaming brass fanfare horn.` (12w) | **B:** `Tall slender flagpole on stone plinth, twin fluttering sky-blue wind streamers.` (11w)<br>**B1:** `High white-stone mast, three vivid orange-and-cyan haste pennants, winged wheel.` (10w)<br>**B2:** `Tall dual-crossbar pole flying balanced red courage flag and blue speed flag.` (12w) |
| `trap` | **base:** `Wooden trapper hut on stone pad, coiled rope nets and spring-boards.` (11w) | **A:** `Wide timber workbench, heavy woven vine-nets and iron jaw-clamps on rack.` (11w)<br>**A1:** `Sturdy granite lodge, oversized brass-toothed bear trap displayed on roof.` (10w)<br>**A2:** `Wide stone post, giant spiderweb-woven rope net stretched across wooden frame.` (11w) | **B:** `Tall wooden gadget shed, colorful acorn firecracker boxes and coiled springs.` (11w)<br>**B1:** `Festive tiled workshop, stacked red-and-gold pinecone popper barrels, star sign.` (10w)<br>**B2:** `Tall brass-geared tinker post, giant wooden spring-bumper paddle on front.` (10w) |
| `bell` | **base:** `Open four-pillar pine pavilion on stone base, hanging bronze Korean civic pavilion bell (no religious symbols).` (12w) | **A:** `Wide curved-tile wooden belfry, large ornate bronze bell, heavy swing log.` (11w)<br>**A1:** `Grand white-stone royal pavilion, massive golden-bronze dragon bell, red tassels.` (10w)<br>**A2:** `Wide double-eave pavilion hanging a main bronze bell and two chime bells.` (12w) | **B:** `Tall two-story stone-and-timber watch-belfry, clear silver-bronze bell, lookout lantern.` (9w)<br>**B1:** `High palace beacon belfry, elevated golden bell and brass sighting telescope.` (11w)<br>**B2:** `Solemn dark-tiled stone belfry, thick iron-rimmed resonance bell, blue knot.` (10w) |

---

## 4. 새 메커니즘 목록 (엔진 확장 명세)

기존 `combat.ts`·`towers.ts`가 이미 지원하는 효과(투사체/즉발, 원형 착탄, 최대 대상 수, 감속, 물리 저항 무시, 번개 연쇄, 90도 부채꼴, 화상, 첫 대상 기절, 직선 2인 관통, 선분 다중 타격, 정예·대장 배율, 타워 주변 즉발 원형, 깃발 오라)는 그대로 재사용한다. **기존 코드로 안 되는 신규 규칙만 9개 공통 프리미티브로 추려** 모든 신규 타워·2차 진화가 공유하게 설계했다.

| # | 메커니즘 ID | 사용처 (타워·진화) | 필요한 도메인 필드 (`TowerStats` / `Enemy` / `RunState`) | 30Hz 정수 판정 규칙 | 구현 난이도 |
|---:|---|---|---|---|---|
| 1 | `antiAir` (대공·고도 추락) | 전 타워 공통, `falcon`, `hwacha A2`, `wind A2`, `flame A2`, `guardian B1` | `TowerStats`: `canHitFlyer: boolean`, `preferFlyer: boolean`, `flyerDamageBP: number`<br>`Enemy`: `flying: boolean`, `groundedUntilTick: number` | `e.flying && s.tick >= e.groundedUntilTick`이면 `canHitFlyer === false`인 타워의 `pickTarget`·범위 판정에서 제외. `preferFlyer`는 사거리 내 비행 적을 먼저 비교. | **하** |
| 2 | `minRangeMilli` (도넛 사거리) | `mortar` | `TowerStats`: `minRange: number` | `pickTarget`에서 `d2 < minRange * minRange`인 적을 후보에서 제외(착탄 폭발 자체는 좌표 기준 그대로 작동). | **하** |
| 3 | `ricochet` (투사체 도탄) | `sling` | `Projectile`: `ricochetLeft: number`, `ricochetRadius: number`, `ricochetFalloffBP: number`, `hitEnemyIds: number[]` | 단일 투사체 `resolve()` 적중 시 `ricochetLeft > 0`이면 반경 내 `!hitEnemyIds.includes(e.id)` 적(거리↑→진행도↓)에게 새 `Projectile` 발사. | **하** |
| 4 | `burstQueue` (시차 다연발) | `hwacha`, `archer A1`, `mortar B1`, `bell A2` | `Tower`: `burstLeft: number`, `nextBurstTick: number` | 주 발사 시 `burstLeft = burstCount - 1` 예약. 매 틱 `fire()`에서 `s.tick >= nextBurstTick`이면 추가 발사 처리. | **하** |
| 5 | `knockbackPull` (경로 역진행·집결) | `wind`, `ballista A2`, `roller B2`, `trap B2`, `mage B2` | `TowerStats`: `knockbackMilli: number`<br>`Enemy`: `knockbackUsedMilli: number` | 적중 시 `e.progress = Math.max(0, e.progress - delta)`(`moveRem = 0` 초기화). 무한 밀치기 방지를 위해 적 1기당 평생 역진행 상한(`3000 milli`) 및 대장 면역/감쇠 적용. | **하** |
| 6 | `debuffMarks` (취약·저항 차감) | `bell`, `falcon B`, `mortar B2`, `alchemist B1`, `spear B1`, `mage A2/flame B1`(마저 무시) | `Enemy`: `vulns: { source, bp, untilTick }[]`, `shreds: { source, bp, untilTick }[]`<br>`TowerStats`: `magicResistIgnoreBP: number` | `slows`와 동일하게 출처별 관리 후 최고값 1개만 적용(취약 상한 `3500 BP`, 저항 차감 상한 `3500 BP`). `applyHit`에서 저항 계산 전후에 `bpFloor`로 반영. | **하** |
| 7 | `fieldHazards` (지속 장판·바닥 덫·굴림체) | `alchemist` (장판), `trap` (덫), `roller` (굴림체), `ballista B2` | `RunState`: `hazards: FieldHazard[]` (`kind: 'zone' \| 'trap' \| 'roller'`, `x/y` 또는 `progress`, `expiresTick`, `charges`) | `battleTick`의 화상 직후 단계에서 일괄 갱신: `zone`은 매 `15틱` 반경 타격, `trap`은 `progress` 근접 적 감지 시 발동·차감, `roller`는 매 틱 `progress`를 줄이며 미충돌 적 타격. | **중** |
| 8 | `onKillTrigger` (처치 유발 효과) | `alchemist A2`, `frost B2`, `flame B2`, `banner A2` | `TowerStats` 플래그 + `kill()` 내 훅 | **판정 순서 고정:** 적 `hp === 0` 사망 시 ① `splitter` 분열 파생체 2기 생성 → ② 직후 같은 틱에 `onKillTrigger` 범위 피해·화상 전염 발동(방금 태어난 분열체까지 깔끔히 타격!). 재귀 방지를 위해 연쇄 깊이는 1단계로 제한. | **중** |
| 9 | `towerCycleAndDynamic` (공격 주기 카운터·조건부 오라) | `archer A1`, `frost A1`, `spear A2/B2`, `mage A1`, `guardian A2/B2`, `bell B` | `Tower`: `attackCount: number`, `lastTargetId: number \| null` | 발사마다 `attackCount++`로 `N번째` 강화타를 결정론적으로 판정. `bell B`의 사거리 오라는 `reachMilli`·`towerStats` 계산 시 `bestAura` 패턴으로 합산. | **하** |

---

## 5. 판 안 접근 방식 제안 (20종 인지 부하 해소)

15×9 전장에서 초등 3~6학년이 하단 어휘 문제를 풀면서 동시에 **타워 버튼 20개**를 훑는 것은 화면 공간(`style-lock-v1.md` 우측 장비함)과 인지 예산 모두에 무리가 간다. 한 판에 다루는 타워 수를 **최대 8칸**으로 제한하는 두 가지 방식을 비교한다.

| 비교 항목 | **권장안 (안 1): 고정 기본 4종 + 대장 웨이브 지원군 징집 (총 8칸)** | **대안 (안 2): 출정 전 원정 준비실에서 8칸 자유 덱 편성** |
|---|---|---|
| **진행 흐름** | 모든 판을 **기본 4종(`archer`, `cannon`, `frost`, `mage`)**으로 시작 → **W3·W6·W10·W14 클리어 직후** 미보유 타워 `3종 중 1종`을 골라 장비함 빈 홈(최대 `8칸`)에 추가 | 판 시작 전 로비에서 해금된 20종 중 **8종을 직접 골라** 장착함에 꽂고 출발(초보용 '추천 8종' 원클릭 제공), 판 중에는 변동 없음 |
| **초등학생 접근성** | **매우 높음.** 1웨이브에는 버튼 4개만 보이며, 새 타워가 한 번에 1종씩 들어와 자연스럽게 읽고 써 보게 됨 | **보통.** 처음부터 20종 설명서를 읽고 8종을 고르는 과정에서 출발 전 피로가 생길 수 있음 |
| **`flyer`·`splitter` 안전성** | 시작 4종에 이미 대공(`archer`, `frost`, `mage`)과 범위(`cannon`)가 모두 포함되어 어떤 뽑기가 나와도 절대 막히지 않음(W14 전 대공 특화, W17 전 범위·장판 가중치 보정 가능) | 학생이 실수로 지상 전용 8종만 골라 갈 위험이 있어 '대공 타워 최소 2종 필수' 같은 편성 검증 경고가 필요함 |
| **리플레이성·재미** | 매 판 들어오는 지원군에 따라 `바람개비+약병` 판, `화차+종각` 판 등 **매번 다른 조합 퍼즐**이 만들어짐 | 좋아하는 '나만의 최강 조합'을 100% 재현하고 실험하기 좋으나, 한 가지 교복 덱으로 고착되기 쉬움 |
| **구현 비용** | `RunState`에 `unlockedTowers: TowerId[]`와 징집 선택 커맨드(`pickDraftTower`) 1개 추가 필요 (**낮음~보통**) | 전투 도메인 변경 거의 없음(`RunConfig.loadout` 길이·유효성 검사만 추가, 대신 로비 편성 UI 필요) (**낮음**) |

- **최종 제안:** **권장안(안 1)**을 기본으로 채택하되, 시작 전에 **'오늘의 원정 대표 타워 1종'**만 학생이 직접 골라(`기본 4종 + 내 선택 1종 = 5종` 시작 → 징집 3회로 `8칸` 완성) 출발하게 하면, "새로 얻은 타워를 꼭 써 보고 싶은 마음"과 "한 판 안의 가벼운 발견 재미"를 모두 잡을 수 있다.

---

## 6. 학습 연동 타워 1종 도입에 대한 의견

- **결론: 정규 20종 로스터 안에 '연속 정답에 따라 강해지는 독립 타워 1종'을 넣는 것은 반대(비권장)한다.**
- **판단 근거:**
  1. **오답 시 이중 처벌(Double Jeopardy) 문제:** 현재 도메인(`run.ts`)에서 오답을 내면 이미 `골드 0 + PT 감점 + 최소 4초 해설 대기 + 전투 연속 정답(battleStreak) 초기화` 불이익을 겪는다. 여기에 주력 타워의 공격력까지 꺾이면, 어휘가 아직 낯선 학생일수록 문제도 틀리고 성문도 순식간에 터지는 좌절 루프에 빠진다.
  2. **기존 `burning` 시스템과의 역할 중복:** 이미 전투 문항 3연속 정답 시 모든 타워 공격속도를 `+2500 BP`(8초) 높여 주는 전역 보상 규칙이 있어, 정답의 쾌감이 특정 타워 1개가 아니라 내가 지은 **모든 타워**로 직관적으로 전달된다.
  3. **41번 확정 화풍(`style-lock-v1.md`)과의 정합성:** 확정 화풍 규약에서 *"전투 자산은 문자/학자 테마로 통일하지 않고, 한글 비석/훈민정음은 고정 장식 기념 공간으로 둔다"*고 명시했다. 붓·책 모양 학자 타워는 이 기준과 어긋난다.
- **대안 (학습 연동을 꼭 강화하고 싶을 때의 안전한 해법):**
  1. **기존 타워 진화 흡수(본 설계 반영 완료):** `banner` 2차 진화 **`B1 질풍 군기`**처럼 평소에도 제값을 하되 **`burning` 발동 중에만 오라 반경과 수치가 크게 증폭되는 '보너스 전용(하한선 보장)' 설계**로 녹인다.
  2. **맵 고정 장식 기믹 활용:** 타워 슬롯을 차지하지 않는 맵 위 고정 장식(**훈민정음 기념 비석**)이 전투 5연속 정답 달성 시 따뜻하게 빛나며 성문 체력 `+1` 회복 또는 전장 전체 축복 음파 1회를 울려 주는 연출이 교육적으로도, 화풍 면에서도 훨씬 자연스럽다.

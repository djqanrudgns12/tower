# 몬스터 종족·능력 카탈로그 (R4-M)

초안: Antigravity(Gemini 4 Argon, 2026-10-31) · 큐레이션: 리뉴얼 총괄(Claude)

## 0. 총괄 결정 (본문보다 우선)

1. **v1 새 능력은 `flyer`(비행)·`splitter`(분열) 두 개만** 켠다. 아이가 눈으로 바로 이해할 수 있고(날아서 피한다·갈라진다) 타워 선택에 의미가 생기기 때문이다. `aura_guard`·`healer`·`burrower`·`summoner`는 v1.1 후보로 둔다.
2. 그래서 **주력 종족은 일반 8종**(기존 6역할 + flyer + splitter) **+ 대장 4종 = 12종**이다. 확장 종족도 같은 틀을 쓴다.
3. §3.1 편성표의 **W14·W17 손님 슬롯은 주력 종족의 flyer(W14)·splitter(W17)로 바꾼다.** 확장 종족은 W21부터 등장한다(§3.2 침입 순환은 그대로).
4. 대장 체력은 기믹별 보정 `hpScaleBP`를 데이터로 허용한다(생존형 기믹 `ward_layers`·`snack_mend`는 8500부터 시작). 최종값은 밸런스 시뮬레이션으로 정한다.
5. 그림 규격은 §5.1의 64/128px 대신 **기존 인수 그림 규격**(`public/assets/manifest.json`의 `enemy.walker`·`enemy.boss`)을 따른다. 외곽선은 아트 기준 v2(#3a291e 계열)다. "glowing" 소품은 물체 자체가 따뜻하게 빛나는 정도까지만 허용한다. 주변 빛 번짐·광륜은 반려한다.
6. 1차 그림 생산 순서: 정원 종족 `acorn_goblin` 12종(기존 고블린·보라 오우거 그림은 도토리 보초병·통나무 덩치오우거 쪽으로 재사용을 검토) → 나머지 주력 3종족 → 확장 4종족.
7. flyer·splitter의 종족별 개체(이름·외형)는 그림 생산 직전에 종족 표에 추가한다.
8. **(R4 B3, 2026-11-04) 침입 종족 특성 4종.** 역할 능력은 여전히 비행·분열 둘이고, 16웨이브부터 침입하는 확장 4종족의 일반 적(대장 제외, 분열·호위 파생체 포함)에게만 종족 특성 하나가 붙는다(계약 `factions.<id>.trait`, [r4-b3](../../balance/r4-b3.md)). 위 3항의 "W21부터"는 R4 B1에서 W16으로 당겨졌다.
   - 딱정벌레 기사단 `honey_beetle` = **등껍질** `shell`: 물리 저항 +20%(정예와 합쳐 50% 상한). 표지 `shell` → 마법·석궁이 잘 잡는다.
   - 가마 토기단 `kiln_pottery` = **흙 보호막** `clay`: 저항 뒤 피해에서 타격마다 그 웨이브 기준 HP의 2.5%를 막는다(최소 1). 표지 `clay`를 잘 잡는 타워(투석·노포·화차)는 절반만 막힌다. 화상은 막지 않는다.
   - 두더지단 `brass_mole` = **땅굴** `burrow`: 경로 45% 지점부터 기본 속도 1.5초 구간에서 땅속(겨냥 공격 표적 불가, 날아가던 단일 투사체 빗나감). 착탄 범위·장판·덫·굴림·폭발은 맞는다. 비행 적은 파지 않는다. 표지 `burrow` → 박격·약병·덫.
   - 하늘유랑단 `breeze_corsair` = **하늘 떼** `flyers`: 그 종족 일반 적의 40%가 비행이다(표지는 비행 `flyer` 그대로 → 매사냥·노포 등).
   - 본문 §1의 `burrower`(땅굴꾼, 체력 50%에서 잠복) 역할은 v1에 켜지 않는다. 땅굴은 역할이 아니라 두더지단 특성(정해진 경로 구간)으로 대신한다.

> **기준 문서:** `docs/contracts/balance.candidate.v0.4.json`, `src/domain/waves.ts`, `src/domain/combat.ts`, `docs/art_and_content_contract_v0_2.md` §2~4, `docs/style-lock-v1.md` (41번 왕국 원정대)
> **핵심 원칙:** **능력(규칙)은 적게, 얼굴(종족)은 많이.** 같은 역할(`role`)은 종족(`faction`)이 달라도 동일한 도메인 수식·스탯을 공유하며, 데이터+스프라이트 팩 추가만으로 종족을 무한 확장한다.
> **엔진 단위 규약:** 틱 `30Hz`(`ticks = floor((ms * 30 + 999) / 1000)`), 거리 `milli`(`1칸 = 1000`), 비율 `BP`(`10000 = 100%`), 체력 `milli-HP`(`1 HP = 1000`).

---

## 1. 역할(Role) 표

### 1.1 기존 기본 6역할 (v1 전 종족 공통 슬롯)

각 종족의 일반 몬스터 6종은 아래 6개 역할에 1:1 대응한다(`boss`는 5웨이브 단위 별도 슬롯).

| 역할 ID | 역할명 | 체력 (`hpBP`) | 속도 (`speedBP`) | 물리/마법 저항 (`BP`) | 주 대응 타워 | 아이용 한 줄 설명 (20자 이하) |
|---|---|---:|---:|---:|---|---|
| `walker` | 보병 | `10000` | `10000` | `0` / `0` | `archer`, `spear` | 길 따라 또박또박 걸어와요. |
| `runner` | 질주 | `7000` | `13500` | `0` / `0` | `frost`, `archer`(속사) | 몸은 약해도 발이 아주 빨라요! |
| `brute` | 거구 | `18000` | `7500` | `0` / `0` | `crossbow`, `guardian` | 느리지만 체력이 무척 많아요. |
| `shell` | 갑각 | `11500` | `9000` | `3500` / `0` | `mage`, `crossbow`, `spear` B | 화살과 대포에 단단히 버텨요. |
| `wisp` | 정령 | `10000` | `11000` | `0` / `3500` | `archer`, `crossbow`, `spear` | 마법 공격을 스르르 흘려내요. |
| `swarm` | 떼 | `5500` | `11000` | `0` / `0` | `cannon`, `flame`, `lightning` | 작고 빠른 악당이 몰려와요! |

### 1.2 신규 능력 역할 후보 6종 (v1.1+ 확장 규칙 풀)

경로 1차원 진행도(`progress` milli-cell)와 정수 연산(`dist2`, `bpFloor`) 구조를 깨지 않으면서 기존 10종 타워의 상성을 입체화하는 후보 6종이다.

| 후보 ID | 역할명 | 기본 스탯 제안 (`hpBP` / `speedBP`) | 엔진 단위 규칙 (`30Hz`, `milli`, `BP`) | 핵심 대응 타워 | 복잡도 | 아이용 한 줄 설명 (20자 이하) |
|---|---|---|---|---|:---:|---|
| `flyer` | 비행병 | `8500` / `11500` | 경로 `progress`를 그대로 따르되 `flying = true`. 지면 전용 타워(`cannon`, `spear`, `guardian`)의 표적·착탄 범위에서 제외되고 대공 가능 타워만 피격 | `archer`(정찰), `crossbow`, `lightning`, `mage` | **하** | 날아가서 대포와 창을 피해요! |
| `aura_guard` | 방패기수 | `13500` / `8500` | 반경 `1600 milli` 안의 다른 살아 있는 적(본인 제외, 중첩 불가)이 받는 최종 피해를 `2000 BP` 경감(저항과 별산 후 총 피해감소 상한 `6500 BP`) | `frost`(속도차로 대열 분리), `crossbow` A(관통), `cannon` | **하** | 주변 친구들을 단단하게 지켜요! |
| `healer` | 치유사 | `9500` / `9500` | 매 `60틱(2000ms)`마다 반경 `1500 milli` 내 체력 손실이 있는 아군을 진행도↓ 순 최대 `3명` 골라 자기 `maxHp`의 `800 BP`(대장은 `400 BP`) 회복 | `crossbow` A(후열 관통), `lightning`(연쇄), `flame` B(잔불) | **중** | 다친 친구들의 체력을 고쳐요! |
| `splitter` | 분열병 | `11000` / `9500` | 처치 시 사망 지점(`progress ± 120 milli` 클램프)에 파생 소형체 2기 생성(`hpBP: 3000`, `speedBP: 12500`, 처치 골드·PT `0`, 누출 피해 `1`) | `cannon` A(확산), `flame`(부채꼴+화상), `spear` A(긴 창) | **중** | 쓰러지면 작은 둘로 갈라져요! |
| `burrower` | 땅굴꾼 | `10500` / `10000` | 피격 후 `hp <= maxHp * 5000 / 10000` 최초 도달 시 `36틱(1200ms)` 동안 잠복(1회 한정): 단일 표적 지정(`pickTarget`) 제외 + 속도 `13000 BP`(범위 폭발·기존 화상은 유효) | `crossbow`(잠복 전 일격), `cannon`, `flame`(지속 화상), `frost` B | **중** | 체력이 줄면 땅속에 숨어 가요! |
| `summoner` | 몰이꾼 | `12500` / `8000` | 매 `120틱(4000ms)`마다(최대 `3회`) 전방 `progress + 350 milli`에 미끼 졸개 1기 생성(`hpBP: 3500`, `speedBP: 12000`, 처치 골드·PT `0`, 누출 피해 `1`) | `cannon`, `lightning`, `crossbow` A(미끼 너머 본체 관통) | **중** | 피리를 불어 졸개를 불러내요! |

---

## 2. 8종족 카탈로그 (주력 4 + 원정 확장 4)

### 2.0 종족 요약 및 대장 기믹 프리미티브 규약

대장 32종(8종족 × 4대장)의 엔진 비대화를 막기 위해, 모든 대장 고유 기믹은 **6종의 결정론적 기믹 프리미티브**에 수치만 바인딩한다(모두 `statusCaps`: 보스 감속 상한 `3000 BP`, 평생 기절 상한 `3000ms`를 준수).

1. **`iron_stance` (방어 태세):** `hp`가 임계 `BP` 이하 최초 도달 시 `N틱` 동안 물리 또는 마법 저항 `+R BP`(저항 상한 `6500 BP`).
2. **`burst_march` (박차 행진):** 매 `P틱` 주기마다 `D틱` 동안 이동속도 `S BP`로 가속.
3. **`rally_haste` (진군 북소리):** 반경 `R milli` 내 일반 적의 이동속도 `+S BP`(합산 속도 상한 `15000 BP`, 중첩 불가).
4. **`ward_layers` (겹방패):** 등장 시 보호막 `C겹` 보유. 피격 시 1회 최종 피해를 최대 `capBP`(`maxHp` 대비 비율)로 제한하고 1겹 차감.
5. **`snack_mend` (새참 회복):** 매 `P틱` 주기(또는 임계 1회)마다 기절 상태가 아니면 자기 `maxHp`의 `H BP` 회복(최대 `M회`).
6. **`call_escort` (호위 호출):** `hp`가 임계 `BP` 이하 도달 시 전후 `±250 milli`에 같은 종족 지정 역할 파생 호위병 `K기` 생성(골드·PT `0`).

---

### 2.1 [`acorn_goblin`] 들숲 새참 도적단 — 주력 1: `garden_u` (3학년 정원)

- **콘셉트:** 왕국 정원의 달콤한 열매와 소풍 새참 바구니 냄새를 맡고 숲속에서 몰려온 붉은귀 고블린·오우거 유랑단이다. 부엌 국자, 도토리 방패, 냄비 뚜껑을 무기로 삼아 성문 부엌 찬장을 털겠다는 일념으로 행진한다.
- **팔레트:** `#D94B38`(주홍 피부), `#7A5299`(거구 보라 피부), `#6B442A`(참나무·가죽 갈색), `#E6B84C`(도토리 황동 금빛) — *기존 `ART-SAMPLE-001` 계승*
- **실루엣 규칙:** 좌우로 크게 뻗은 **수평 V자 뾰족귀** + 상체를 앞으로 숙인 2등신 전경 자세 + 손에 든 주방·채집 도구.

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 도토리 보초병 | `walker` | `Red-skinned chibi forest goblin, wide horizontal pointed ears, brown leather vest, holding a short wooden-shafted acorn spear forward, playful grin.` (20w) |
| 일반 2 | 새참 날치기꾼 | `runner` | `Lean red chibi goblin sprinting low, leaf bandana, carrying a woven picnic basket on back and wooden spoon dagger, big pointed ears swept back.` (24w) |
| 일반 3 | 통나무 덩치오우거 | `brute` | `Round-bellied purple chibi forest ogre, two tiny stubby horns, brown leather vest, hefting a thick knotted oak club over shoulder, goofy heavy stride.` (23w) |
| 일반 4 | 냄비뚜껑 갑옷병 | `shell` | `Stocky red chibi goblin wearing an upside-down copper soup pot helmet and holding a round riveted iron pot-lid shield in front.` (21w) |
| 일반 5 | 반딧불 초롱꾼 | `wisp` | `Chibi forest goblin in mossy hooded poncho, holding a curved twig staff dangling a glowing amber firefly glass jar ahead.` (20w) |
| 일반 6 | 솔방울 꼬마떼 | `swarm` | `Tiny energetic red goblin imp wearing an oversized acorn-cap beret, clutching a pinecone with both hands, scampering forward.` (18w) |
| 대장 W5 | 국자대장 달그락 | `boss` (5W) | **기믹(`iron_stance`):** `hp <= 5000 BP` 최초 도달 시 `90틱(3000ms)` 동안 물리저항 `+3500 BP`. **외형:** 커다란 구리 국자 창과 쟁반 흉갑을 찬 붉은 고블린 분대장, 머리 위 주방장 수건 매듭. |
| 대장 W10 | 멧돼지기수 우당탕 | `boss` (10W) | **기믹(`burst_march`):** 매 `120틱(4000ms)`마다 `36틱(1200ms)` 동안 속도 `11500 BP` 돌진. **외형:** 철판 안장을 얹은 둥근 산멧돼지 위에 올라타 나뭇가지 기수창을 내민 고블린 기수. |
| 대장 W15 | 새참수레 큰손오우거 | `boss` (15W) | **기믹(`call_escort`):** `hp <= 5000 BP` 도달 시 전방 `+250 milli`에 `shell` 파생 호위병 `2기` 호출. **외형:** 열매와 빵이 가득 찬 통나무 손수레를 밀고 오는 거대 보라 오우거 보급관. |
| 대장 W20 | 들숲총대장 도토리왕 | `boss` (20W) | **기믹(`rally_haste`):** 반경 `1800 milli` 내 일반 적 이동속도 `+1800 BP` 상시 부여. **외형:** 황금 도토리 왕관과 붉은 낙엽 망토를 두르고 북 달린 참나무 지휘봉을 흔드는 대장 고블린. |

---

### 2.2 [`river_rafter`] 여울목 통발 패거리 — 주력 2: `river_z` (4학년 강가)

- **콘셉트:** 강가 나루터의 반짝이는 조약돌과 물레방아 목재를 자기들 댐 공사에 쓰려고 몰려온 의인화 수달·물가 악동 패거리다. 나룻배 노, 대나무 통발, 큰 소라껍데기, 조롱박 부표를 메고 물장구치듯 성문 수로를 향해 진군한다.
- **팔레트:** `#2E8B99`(여울 청록), `#8C5A3C`(뗏목 밤갈색), `#F0784A`(부표·집게 산호주황), `#DCEEF2`(물거품 하늘백색)
- **실루엣 규칙:** **둥근 정수리·반원형 삿갓/조개모자** + 뒤쪽 바닥으로 길게 뻗어 균형을 잡는 **굵고 납작한 수달 꼬리**.

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 노젓기 수달병 | `walker` | `Cute brown-and-teal chibi river otter rafter wearing a reed vest, thick flat tail behind, holding a short wooden boat paddle forward.` (21w) |
| 일반 2 | 물보라 미끄럼꾼 | `runner` | `Sleek chibi otter leaning forward on wet-look wooden sandals, coral neckerchief fluttering, holding twin fish-trap bamboo hooks, streamlined silhouette.` (19w) |
| 일반 3 | 통나무집게 거구 | `brute` | `Broad-shouldered chibi giant river crab-otter hybrid wearing rope harness, carrying a mossy waterwheel timber log, chunky coral pincer gauntlets.` (19w) |
| 일반 4 | 소라투구 방패병 | `shell` | `Chibi river otter wearing a spiral teal conch-shell helmet and holding a thick ridged clam-shell shield forward, sturdy stance.` (19w) |
| 일반 5 | 물안개 호리병사 | `wisp` | `Chibi otter mystic in lotus-leaf poncho, carrying a glowing aqua gourd lantern on a bamboo fishing rod, serene cheeky smile.` (20w) |
| 일반 6 | 조약돌 올챙이단 | `swarm` | `Tiny round chibi tadpole-otter scout wearing a lily-pad cap and coral float ring around waist, waddling briskly forward.` (18w) |
| 대장 W5 | 나루터장 첨벙수달 | `boss` (5W) | **기믹(`burst_march`):** 매 `105틱(3500ms)`마다 `30틱(1000ms)` 동안 속도 `12000 BP` 미끄럼 전진. **외형:** 뗏목 널빤지 서핑보드를 옆구리에 끼고 산호 호루라기를 문 삿갓 수달 선봉장. |
| 대장 W10 | 큰소라 바위집게장 | `boss` (10W) | **기믹(`ward_layers`):** 등장 시 물방울 조개 방패 `4겹`, 타격당 최대 피해 `maxHp`의 `1200 BP` 상한. **외형:** 등 전체를 덮는 청록 줄무늬 대왕소라 갑옷과 닻 갈고리를 든 거구 대장. |
| 대장 W15 | 물레방아 뗏목선장 | `boss` (15W) | **기믹(`snack_mend`):** 매 `90틱(3000ms)`마다 자기 `maxHp`의 `600 BP` 회복(최대 `4회`). **외형:** 작은 물레방아 바퀴 배낭과 조롱박 수통 꾸러미를 멘 수염 난 고참 수달 선장. |
| 대장 W20 | 여울총대장 큰물결수달 | `boss` (20W) | **기믹(`call_escort`):** `hp <= 6600 BP`, `3300 BP` 2회 임계마다 `runner` 호위병 `2기`씩 호출. **외형:** 나룻배 뱃머리 모양 견장과 붉은 산호 노 지휘봉을 든 여울목 대선주. |

---

### 2.3 [`moon_dokkaebi`] 달빛 장터 도깨비단 — 주력 3: `courtyard` (5학년 궁궐 뜰)

- **콘셉트:** 궁궐 뜰의 잔치 음악과 메밀묵 냄새에 신이 나서 성문지기에게 씨름 내기와 수수께끼 장난을 걸러 온 한국 설화풍 도깨비 패거리다. 패랭이 모자, 가마솥 뚜껑, 깨진 기와, 청사초롱, 수수빗자루를 멋대로 걸치고 흥겹게 몰려온다.
- **팔레트:** `#3B5BA5`(쪽빛 남색), `#E09F3E`(유기·호박 노랑), `#59636E`(기와 먹회색), `#D95368`(모란 분홍 매듭)
- **실루엣 규칙:** 이마 위 **뭉툭하고 귀여운 뿔(홑뿔/쌍뿔)** + 패랭이·기와 견장으로 넓어진 **역삼각형 어깨선**(일본 오니풍 호피 무늬 금지, 한국 배자·짚신·매듭 조형 사용).

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 패랭이 소도깨비 | `walker` | `Cute indigo-blue chibi Korean dokkaebi with one stubby forehead horn, woven bamboo hat, amber vest, holding a studded wooden bat.` (20w) |
| 일반 2 | 수수빗자루 재주꾼 | `runner` | `Playful chibi dokkaebi hopping fast astride a sorghum broomstick, pink ribbon knots trailing, twin tiny horns and mischievous grin.` (19w) |
| 일반 3 | 맷돌어깨 씨름꾼 | `brute` | `Chunky chibi dokkaebi wrestler with pink waist sash, broad shoulders padded with stone millstone plates, carrying a heavy timber pillar.` (20w) |
| 일반 4 | 가마솥뚜껑 방패꾼 | `shell` | `Sturdy chibi dokkaebi wearing layered dark roof-tile shoulder guards and holding a large round black cast-iron cauldron lid shield.` (19w) |
| 일반 5 | 청사초롱 파란불꾼 | `wisp` | `Chibi dokkaebi in navy hanbok vest holding a traditional red-and-blue silk lantern glowing with soft cyan spirit flame ahead.` (19w) |
| 일반 6 | 메밀묵 꼬마도깨비 | `swarm` | `Tiny plump chibi baby dokkaebi with single nub horn, carrying a wooden tray stub, trotting eagerly in straw sandals.` (19w) |
| 대장 W5 | 씨름판장 뚝배기 | `boss` (5W) | **기믹(`iron_stance`):** `hp <= 5500 BP` 도달 시 `90틱(3000ms)` 동안 물리·마법 저항 각 `+2500 BP`. **외형:** 붉은 천 샅바와 금빛 방울 목걸이를 차고 큰 떡메를 쥔 장사 도깨비. |
| 대장 W10 | 풍물패장 징소리 | `boss` (10W) | **기믹(`rally_haste`):** 반경 `1800 milli` 내 일반 적 이동속도 `+2000 BP` 부여. **외형:** 상모 긴 끈이 둥글게 말린 모자를 쓰고 커다란 유기 징과 채를 든 악사 대장. |
| 대장 W15 | 초롱행렬 밤장수 | `boss` (15W) | **기믹(`call_escort`):** `hp <= 5000 BP` 도달 시 전후에 `wisp` 파생 호위병 `2기` 호출. **외형:** 등짐 지게에 오색 청사초롱 네 개를 매달고 부채로 길을 가리키는 등짐장수 도깨비. |
| 대장 W20 | 달빛총대장 금방망이 | `boss` (20W) | **기믹(`ward_layers`):** 등장 시 도깨비불 보호막 `5겹`, 타격당 최대 피해 `maxHp`의 `1000 BP` 상한. **외형:** 기와 장식 남색 두루마기와 모란 매듭을 두르고 큼직한 금테 도깨비방망이를 든 우두머리. |

---

### 2.4 [`hearth_yeti`] 화톳불 털복숭이 유목단 — 주력 4: `snow_step` (6학년 설원)

- **콘셉트:** 매서운 눈보라를 피해 성안의 따뜻한 아랫목과 군고구마 화로를 빌려 쓰려고 내려온 북방 설인·산양 유목단이다. 자작나무 썰매판과 통나무 얼음 방패, 김이 모락모락 나는 주전자를 챙겨 들고 눈길을 씩씩하게 헤쳐 온다.
- **팔레트:** `#355C8C`(빙하 남청 방한복 — 밝은 눈밭 배경 대비 주조색), `#EDF4F8`(눈털 크림백색), `#A65E38`(자작나무 적갈색), `#F2A93B`(화로 호박불빛)
- **실루엣 규칙:** 목이 없는 **큰 둥근 털공(종형 실루엣)** + 좌우로 둥글게 말린 산양 뿔·귀마개. *눈밭 가독성을 위해 몸통 면적 60% 이상을 `#355C8C` 방한 조끼·가죽 배낭으로 감싼다.*

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 털모자 눈길보병 | `walker` | `Round chibi snow yeti in deep slate-blue quilted parka with cream fur trim, earflap hat, holding a wooden snow-shovel spear.` (20w) |
| 일반 2 | 자작썰매 활강꾼 | `runner` | `Chibi mountain ram-folk in blue winter vest gliding forward on short curved birchwood skis, amber scarf streaming behind.` (18w) |
| 일반 3 | 빙하어깨 큰설인 | `brute` | `Hulking fluffy chibi yeti in heavy brown leather harness and blue cloak, carrying a frosted pine trunk with both paws.` (20w) |
| 일반 4 | 얼음통나무 중갑병 | `shell` | `Stocky chibi yeti wearing iron-bound sleigh plank armor and holding a thick hexagonal glacier-ice slab shield framed in wood.` (19w) |
| 일반 5 | 화로불씨 주전자꾼 | `wisp` | `Chibi snow ram shaman in navy wool hood, holding a crooked staff with a warm glowing amber brass brazier kettle.` (20w) |
| 일반 6 | 털뭉치 아기산양떼 | `swarm` | `Tiny round cream-and-blue chibi snow kid with curled baby horns and oversized mittens, bounding forward like a snowball.` (18w) |
| 대장 W5 | 군고구마 화로지기 | `boss` (5W) | **기믹(`snack_mend`):** 매 `90틱(3000ms)`마다 자기 `maxHp`의 `700 BP` 회복(최대 `3회`). **외형:** 등에 따뜻한 무쇠 화로통과 장작 꾸러미를 짊어지고 불집게를 든 푸근한 설인 조리장. |
| 대장 W10 | 눈사태 썰매대장 | `boss` (10W) | **기믹(`burst_march`):** 매 `105틱(3500ms)`마다 `36틱(1200ms)` 동안 속도 `12000 BP` 활강. **외형:** 철제 앞코가 달린 외날 나무 썰매를 타고 눈보라 깃발을 꽂은 산양 기수장. |
| 대장 W15 | 북방산양 뿔지기 | `boss` (15W) | **기믹(`iron_stance`):** `hp <= 6000 BP` 도달 시 `105틱(3500ms)` 동안 마법저항 `+4000 BP`. **외형:** 거대한 나선형 금테 뿔과 푸른 얼음 결정 망토를 두른 설원 파수대장. |
| 대장 W20 | 설원총대장 만년설인 | `boss` (20W) | **기믹(`call_escort`):** `hp <= 6600 BP`, `3300 BP` 2회 임계마다 `brute` 1기 + `shell` 1기 호출. **외형:** 남청색 유목민 대천막 망토와 화톳불 왕관 투구를 쓴 거대 백설인 족장. |

---

### 2.5 [`brass_mole`] 태엽 등불 두더지단 — 확장 1 (지하 광맥 원정)

- **콘셉트:** 성문 돌기둥과 무쇠 경첩을 희귀 광맥으로 착각해 캐러 올라온 지하 광산 두더지 기술단이다. 황동 안전모와 태엽 드릴, 광석 수레, 형광 수정 등불을 덜컹거리며 땅 위 원정에 나선다.
- **팔레트:** `#C9963B`(황동 금빛), `#5C4A42`(코코아 털색), `#4FD1C5`(형광 광석 민트), `#8A3B2E`(녹슨 철판 적갈색)
- **실루엣 규칙:** **납작한 반구형 황동 안전모** + 정면으로 돌출된 **분홍 코·원뿔형 드릴(쐐기형 전진 실루엣)**.

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 안전모 곡괭이병 | `walker` | `Chibi cocoa-furred mole miner wearing a round brass helmet with unlit lamp, rust-red overalls, holding a short blunt pickaxe.` (19w) |
| 일반 2 | 외바퀴 광차질주꾼 | `runner` | `Chibi mole engineer leaning forward pushing a fast single-wheel iron ore wheelbarrow, goggles on brass cap, energetic pose.` (18w) |
| 일반 3 | 증기해머 큰두더지 | `brute` | `Thickset muscular chibi mole foreman with wind-up brass key on back, carrying a massive round-headed irongeared mallet.` (17w) |
| 일반 4 | 황동철판 두더지병 | `shell` | `Armored chibi mole behind a curved riveted mine-cart door shield, wearing heavy brass dome helmet and shoulder plates.` (18w) |
| 일반 5 | 수정등불 측량사 | `wisp` | `Chibi mole surveyor in leather apron holding a brass tuning-fork staff topped with a glowing mint-teal crystal cluster.` (18w) |
| 일반 6 | 태엽나사 꼬마단 | `swarm` | `Tiny round chibi mole apprentice under an oversized brass hardhat, clutching a big golden gear wheel while scurrying.` (18w) |
| 대장 W5 | 굴착반장 코코아 | `boss` (5W) | **기믹(`iron_stance`):** `hp <= 5000 BP` 도달 시 `90틱(3000ms)` 동안 물리저항 `+4000 BP`. **외형:** 이중 황동 견장과 손잡이 달린 태엽 원뿔 드릴을 앞세운 현장 반장. |
| 대장 W10 | 광석수레 기관장 | `boss` (10W) | **기믹(`burst_march`):** 매 `90틱(3000ms)`마다 `30틱(1000ms)` 동안 속도 `12500 BP` 태엽 가속. **외형:** 민트색 광석이 실린 태엽 사륜 수레에 올라탄 고글 쓴 기관사 두더지. |
| 대장 W15 | 수정동굴 등불장인 | `boss` (15W) | **기믹(`ward_layers`):** 등장 시 민트 수정 방벽 `5겹`, 타격당 최대 피해 `maxHp`의 `1100 BP` 상한. **외형:** 등 뒤에 거대한 수정 공명기를 메고 황동 육분의 지팡이를 든 측량 대장. |
| 대장 W20 | 광산총대장 황동드릴왕 | `boss` (20W) | **기믹(`call_escort`):** `hp <= 6000 BP`, `3000 BP` 임계마다 `shell` 1기 + `runner` 1기 호출. **외형:** 커다란 태엽 왕관 헬멧과 양손 회전식 황동 굴착 방패를 장비한 광산 총감독. |

---

### 2.6 [`honey_beetle`] 호박꿀 딱정벌레 기사단 — 확장 2 (황금 들판 원정)

- **콘셉트:** 왕국 창고에 보관된 향긋한 봄꽃 꿀단지를 찾아 원정을 떠난 동화풍 의인화 갑충 기사단이다. 호박색 수지 방패와 민들레 홀씨 창, 꿀단지 배낭을 메고 장난감 기사처럼 씩씩하게 행군한다.
- **팔레트:** `#3E5641`(딱지날개 올리브녹색), `#F2B705`(꽃꿀 황금노랑), `#8C4A27`(호박 수지 갈색), `#FFF3C4`(민들레 크림)
- **실루엣 규칙:** **매끈하고 둥근 달걀형 등딱지 + 머리 앞 둥근 상향 뿔**, 징그럽지 않도록 반드시 **짧은 2족 보행 다리+2팔**로만 표현(곤충 다족 묘사 금지).

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 도토리창 풍뎅이병 | `walker` | `Cute upright bipedal chibi olive-green rhinoceros beetle knight, single rounded horn, golden sash, holding a short acorn-tipped lance.` (18w) |
| 일반 2 | 꽃잎스케이트 정찰병 | `runner` | `Slender bipedal chibi beetle scout in yellow scarf, leaning forward with wing-cases slightly ajar, holding twin sweetgum twig batons.` (19w) |
| 일반 3 | 호박통나무 사슴벌레장 | `brute` | `Broad-chested bipedal chibi stag beetle with rounded amber mandibles on helmet, carrying a honey-glazed timber ram.` (16w) |
| 일반 4 | 황금수지 중갑충 | `shell` | `Round bipedal chibi tortoise-beetle knight carrying a translucent golden amber-resin tower shield and wearing polished olive carapace plates.` (18w) |
| 일반 5 | 민들레홀씨 악사 | `wisp` | `Cute bipedal chibi beetle bard in cream cape, holding a curved stem staff topped with a glowing fluffy dandelion puff.` (20w) |
| 일반 6 | 꿀방울 아기풍뎅이 | `swarm` | `Tiny round bipedal chibi ladybug-like beetle squire with yellow spots and miniature wooden buckler, trotting cheerfully.` (16w) |
| 대장 W5 | 꿀단지 파수대장 | `boss` (5W) | **기믹(`snack_mend`):** 매 `90틱(3000ms)`마다 자기 `maxHp`의 `650 BP` 회복(최대 `4회`). **외형:** 등에 황금 꿀단지를 메고 꿀주걱 철퇴를 휘두르는 통통한 풍뎅이 보급관. |
| 대장 W10 | 황금뿔 돌격기사 | `boss` (10W) | **기믹(`ward_layers`):** 등장 시 호박 수지 보호막 `4겹`, 타격당 최대 피해 `maxHp`의 `1100 BP` 상한. **외형:** 둥근 Y자 황금 투구뿔과 마상창을 갖춘 올리브 갑충 선봉 기사. |
| 대장 W15 | 꽃가루 나팔수장 | `boss` (15W) | **기믹(`rally_haste`):** 반경 `1800 milli` 내 일반 적 이동속도 `+2000 BP` 부여. **외형:** 나팔꽃 모양 황금 호른을 불며 크림색 망토를 휘날리는 의장대장. |
| 대장 W20 | 들판총대장 호박갑충왕 | `boss` (20W) | **기믹(`iron_stance`):** `hp <= 6000 BP` 도달 시 `120틱(4000ms)` 동안 물리·마법 저항 각 `+3000 BP`. **외형:** 호박 보석 왕관과 꽃잎 문양 대방패를 든 늠름한 장수풍뎅이 군주. |

---

### 2.7 [`kiln_pottery`] 가마터 토기 정령단 — 확장 3 (외곽 가마터 원정)

- **콘셉트:** 외곽 가마터에서 마법 불씨를 품고 깨어나, 성안 대장간의 더 크고 따뜻한 화덕에 몸을 단단히 구우러 달려가는 옹기·토기 인형 일당이다. 항아리 몸통에 국자 팔, 청자 뚜껑 방패, 가마 불씨 단지를 이고 딸그락거리며 걸어온다.
- **팔레트:** `#C8643B`(테라코타 황토주황), `#6CC4A1`(청자 비취유약), `#47362E`(가마 그을음 고동), `#FFE082`(불씨 연노랑)
- **실루엣 규칙:** **배가 볼록한 항아리·단지 곡선 몸통 + 정수리 위 둥근 단지 뚜껑 꼭지**, 짧은 통나무·도자기 두 발.

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 옹기단지 걸음병 | `walker` | `Cute chibi terracotta clay-jar golem with lid knob on head, painted grin, stubby ceramic legs, holding a wooden kiln paddle.` (20w) |
| 일반 2 | 찻잔바퀴 구름꾼 | `runner` | `Small celadon-mint chibi teacup sprite leaning forward fast, steam puff trailing from lid, holding twin bamboo tea whisks.` (18w) |
| 일반 3 | 장독대 큰항아리 | `brute` | `Huge round dark-brown glazed kimchi-jar golem wrapped in straw rope belt, swinging a thick clay brick mallet.` (17w) |
| 일반 4 | 청자유약 기와병 | `shell` | `Sturdy terracotta chibi pot-knight glazed in jade-green celadon armor, holding a thick round ceramic kiln-shelf shield.` (16w) |
| 일반 5 | 가마불씨 호롱병 | `wisp` | `Chibi clay incense-burner sprite with warm yellow ember glow peeking through star cutouts, holding a brass poker wand.` (18w) |
| 일반 6 | 종지그릇 꼬마떼 | `swarm` | `Tiny round chibi clay sauce-dish imp with an upside-down saucer cap, scampering on tiny stubby feet.` (16w) |
| 대장 W5 | 뚝배기 불씨대장 | `boss` (5W) | **기믹(`iron_stance`):** `hp <= 5500 BP` 도달 시 `90틱(3000ms)` 동안 마법저항 `+4000 BP`. **외형:** 보글보글 열기가 피어오르는 검은 무쇠테 뚝배기 투구와 집게 창을 든 선봉장. |
| 대장 W10 | 청자주전자 다관장 | `boss` (10W) | **기믹(`ward_layers`):** 등장 시 유약 광택 방패 `5겹`, 타격당 최대 피해 `maxHp`의 `1100 BP` 상한. **외형:** 구름 문양 비취색 주전자 몸통과 코 부분 방패팔을 지닌 도자기 기사장. |
| 대장 W15 | 가마터 불무지장인 | `boss` (15W) | **기믹(`snack_mend`):** 매 `90틱(3000ms)`마다 자기 `maxHp`의 `700 BP` 회복(최대 `4회`). **외형:** 풀무 배낭으로 따뜻한 장작불을 피우며 깨진 틈에 황토를 덧바르는 가마 수호장. |
| 대장 W20 | 도기총대장 대장독왕 | `boss` (20W) | **기믹(`call_escort`):** `hp <= 6600 BP`, `3300 BP` 임계마다 `swarm` 3기씩 호출. **외형:** 금줄과 청자 견장을 두른 거대한 대장독 몸통에 기와 지붕 뚜껑을 쓴 토기 대왕. |

---

### 2.8 [`breeze_corsair`] 솔바람 하늘유랑단 — 확장 4 (구름 능선 원정)

- **콘셉트:** 산봉우리에서 나뭇잎 돛단배를 타고 유랑하다 성문 꼭대기의 멋진 깃발을 자기들 배의 새 돛으로 달고 싶어 내려온 날다람쥐·오소리 유랑단이다. 바람개비 창, 솔방울 추, 단풍잎 망토, 나침반을 차고 경쾌하게 달려온다.
- **팔레트:** `#8F3D4C`(단풍 자주색), `#D98E4E`(다람쥐 황토털), `#5DA9E9`(바람개비 하늘파랑), `#F4E3B2`(돛천 베이지)
- **실루엣 규칙:** 양옆 어깨에서 허리로 퍼지는 **삼각형 활공 망토** + 등 뒤로 높게 말아 올린 **커다란 S자 복슬 꼬리**.

| 구분 | 한국어 이름 | 역할 / 등장 | 외형 핵심 (일반: 영문 프롬프트 조각 40단어 이하 / 대장: 기믹 + 외형) |
|---|---|---|---|
| 일반 1 | 솔방울창 다람쥐병 | `walker` | `Cute chibi flying-squirrel corsair in burgundy cape, big curled fluffy tail behind, sailor bandana, holding a short pinwheel spear.` (19w) |
| 일반 2 | 바람개비 활공꾼 | `runner` | `Chibi squirrel scout leaning low with beige wing-cape spread wide, blue pinwheel spinning on helmet, dashing lightly forward.` (18w) |
| 일반 3 | 돛대어깨 큰오소리 | `brute` | `Broad chibi sky-badger boatswain in burgundy coat, carrying a wooden ship mast wrapped in beige sailcloth over shoulder.` (18w) |
| 일반 4 | 참나무통 갑판병 | `shell` | `Stocky chibi squirrel corsair wearing coopered oak-barrel chest armor and holding a round brass-rimmed ship wheel shield.` (17w) |
| 일반 5 | 구름나침반 항해사 | `wisp` | `Chibi squirrel navigator in sky-blue tricorn hat, holding a brass astrolabe staff glowing with gentle azure wind light.` (18w) |
| 일반 6 | 단풍잎 꼬마다람쥐 | `swarm` | `Tiny chibi chipmunk deckhand wearing a burgundy maple-leaf cape and oversized aviator goggles, scampering forward.` (15w) |
| 대장 W5 | 망원경 갑판장 솔솔 | `boss` (5W) | **기믹(`burst_march`):** 매 `90틱(3000ms)`마다 `30틱(1000ms)` 동안 속도 `12500 BP` 순풍 질주. **외형:** 황동 단안 망원경과 바람개비 쌍단검을 차고 큰 꼬리를 세운 갑판장. |
| 대장 W10 | 바람돛 조타수장 | `boss` (10W) | **기믹(`rally_haste`):** 반경 `2000 milli` 내 일반 적 이동속도 `+2000 BP` 부여. **외형:** 등 뒤에 삼각 범선 돛을 꽂고 푸른 나침반 조타륜을 든 항해 지휘관. |
| 대장 W15 | 구름닻 보급선장 | `boss` (15W) | **기믹(`snack_mend`):** 매 `90틱(3000ms)`마다 자기 `maxHp`의 `700 BP` 회복(최대 `4회`). **외형:** 도토리 건빵 자루와 나무 닻을 멘 푸근한 오소리 일등항해사. |
| 대장 W20 | 능선총대장 큰바람선장 | `boss` (20W) | **기믹(`ward_layers`):** 등장 시 회오리 바람막 `5겹`, 타격당 최대 피해 `maxHp`의 `1000 BP` 상한. **외형:** 자주색 선장 삼각모에 깃털을 꽂고 황금 풍향계 지휘검을 든 하늘유랑단 선장. |

---

## 3. 등장 일정 및 무한 침입 순환 규칙

### 3.1 1~20웨이브 맵별 신규 얼굴 편성표 (1~3웨이브 간격 보장)

기존 `balance.candidate.v0.4.json`에서 10웨이브 이후 새 얼굴이 끊기던 문제를 해결하기 위해, **주력 일반 6종 해금 시점을 W1~W12로 분산**하고, 대장 사이 공백인 **W14·W17에 21웨이브 원정 침입의 복선이 되는 '선발 정찰병(확장 종족 손님 유닛 2종)'**을 투입한다. 이로써 **1~20웨이브 전 구간에서 최대 3웨이브 이내마다 반드시 새 얼굴(총 12종)이 등장**한다.

| 해금 웨이브 | `garden_u` (3학년: `acorn_goblin`) | `river_z` (4학년: `river_rafter`) | `courtyard` (5학년: `moon_dokkaebi`) | `snow_step` (6학년: `hearth_yeti`) | 역할 가중치 (`weights` 합 `100`) |
|:---:|---|---|---|---|---|
| **W1** | 새 얼굴 ① `walker` (도토리 보초병) | 새 얼굴 ① `walker` (노젓기 수달병) | 새 얼굴 ① `walker` (패랭이 소도깨비) | 새 얼굴 ① `walker` (털모자 눈길보병) | `1:100` |
| **W3** (+2) | 새 얼굴 ② `runner` (새참 날치기꾼) | 새 얼굴 ② `runner` (물보라 미끄럼꾼) | 새 얼굴 ② `brute` (맷돌어깨 씨름꾼) | 새 얼굴 ② `brute` (빙하어깨 큰설인) | ①`70`, ②`30` |
| **W5** (+2) | 새 얼굴 ③ `brute` + **④ 대장 W5** | 새 얼굴 ③ `swarm` + **④ 대장 W5** | 새 얼굴 ③ `shell` + **④ 대장 W5** | 새 얼굴 ③ `runner` + **④ 대장 W5** | ①`50`, ②`30`, ③`20` + `boss` |
| **W7** (+2) | 새 얼굴 ⑤ `shell` (냄비뚜껑 갑옷병) | 새 얼굴 ⑤ `shell` (소라투구 방패병) | 새 얼굴 ⑤ `runner` (수수빗자루 재주꾼) | 새 얼굴 ⑤ `wisp` (화로불씨 주전자꾼) | ①`35`, ②`25`, ③`20`, ⑤`20` |
| **W9** (+2) | 새 얼굴 ⑥ `swarm` (솔방울 꼬마떼) | 새 얼굴 ⑥ `brute` (통나무집게 거구) | 새 얼굴 ⑥ `wisp` (청사초롱 파란불꾼) | 새 얼굴 ⑥ `shell` (얼음통나무 중갑병) | ①`28`, ②`22`, ③`18`, ⑤`16`, ⑥`16` |
| **W10** (+1) | 새 얼굴 **⑦ 대장 W10** (멧돼지기수) | 새 얼굴 **⑦ 대장 W10** (큰소라 집게장) | 새 얼굴 **⑦ 대장 W10** (풍물패장 징소리) | 새 얼굴 **⑦ 대장 W10** (눈사태 썰매대장) | W9 동일 + `boss` |
| **W12** (+2) | 새 얼굴 ⑧ `wisp` (반딧불 초롱꾼) | 새 얼굴 ⑧ `wisp` (물안개 호리병사) | 새 얼굴 ⑧ `swarm` (메밀묵 꼬마도깨비) | 새 얼굴 ⑧ `swarm` (털뭉치 아기산양떼) | 6역할 표준(`24/20/16/15/12/13`) |
| **W14** (+2) | 새 얼굴 ⑨ 손님 `honey_beetle.shell` | 새 얼굴 ⑨ 손님 `breeze_corsair.runner` | 새 얼굴 ⑨ 손님 `kiln_pottery.shell` | 새 얼굴 ⑨ 손님 `brass_mole.shell` | 주력 `80` + 손님⑨ `20` |
| **W15** (+1) | 새 얼굴 **⑩ 대장 W15** (새참수레 오우거) | 새 얼굴 **⑩ 대장 W15** (물레방아 선장) | 새 얼굴 **⑩ 대장 W15** (초롱행렬 밤장수) | 새 얼굴 **⑩ 대장 W15** (북방산양 뿔지기) | W14 동일 + `boss` |
| **W17** (+2) | 새 얼굴 ⑪ 손님 `honey_beetle.brute` | 새 얼굴 ⑪ 손님 `breeze_corsair.wisp` | 새 얼굴 ⑪ 손님 `kiln_pottery.brute` | 새 얼굴 ⑪ 손님 `brass_mole.brute` | 주력 `70` + 손님⑨`15` + 손님⑪`15` |
| **W20** (+3) | 새 얼굴 **⑫ 대장 W20** (도토리왕) | 새 얼굴 **⑫ 대장 W20** (큰물결수달) | 새 얼굴 **⑫ 대장 W20** (금방망이) | 새 얼굴 **⑫ 대장 W20** (만년설인) | W17 동일 + `boss` |

> *비고: v1.1에서 신규 능력 역할(§1.2)을 도입할 경우 W14·W17 손님 슬롯을 주력 종족의 신규 특수 역할 2종(예: `flyer`, `healer`)으로 즉시 치환하거나 병행할 수 있다.*

### 3.2 21웨이브 이후 '원정 침입' 순환 규칙

21웨이브부터는 5웨이브를 하나의 **침입 블록(`block = floor((wave - 21) / 5)`)**으로 묶어 나머지 7개 종족이 순서대로 침입한다. W14·W17에 정찰병을 보냈던 확장 종족이 첫 번째(`block = 0`, W21~25) 본대로 도착한다.

- **맵별 결정론적 침입 순환 배열 (`invasionOrder`, 길이 7):**
  - `garden_u`: `[honey_beetle, breeze_corsair, river_rafter, kiln_pottery, brass_mole, moon_dokkaebi, hearth_yeti]`
  - `river_z`: `[breeze_corsair, kiln_pottery, moon_dokkaebi, brass_mole, honey_beetle, hearth_yeti, acorn_goblin]`
  - `courtyard`: `[kiln_pottery, brass_mole, hearth_yeti, honey_beetle, breeze_corsair, acorn_goblin, river_rafter]`
  - `snow_step`: `[brass_mole, honey_beetle, acorn_goblin, breeze_corsair, kiln_pottery, river_rafter, moon_dokkaebi]`
- **블록 내 웨이브별 혼성 비율 (`offset = (wave - 21) % 5`):**
  - `offset 0, 1` (예: W21~22): **주력 종족 50% + 침입 종족 50%** (전선 합류기, 침입 일반 6종 전면 등장)
  - `offset 2, 3` (예: W23~24): **주력 종족 30% + 침입 종족 70%** (침입 절정기)
  - `offset 4` (예: W25, W30, ... 마일스톤): **주력 30% + 침입 70% + 침입 종족 대장 출격**
    - 대장 티어 순환: `bossTier = ((block % 3) + 2)` → W25는 **W10급 대장**, W30은 **W15급 대장**, W35는 **W20급 총대장** 순으로 고위 대장만 순환 출격.
  - **56웨이브 이후 (`block >= 7`):** 전 종족 1회전 완료 후에는 **연합 원정 모드**(주력 20% + `invasionOrder[block % 7]` 40% + `invasionOrder[(block + 3) % 7]` 40%)로 3종족 혼성 편성한다.

---

## 4. 정예(Elite) 시각 표현 규칙 (갑옷·띠 오버레이)

UI 아이콘·별·숫자 배지를 띄우지 않고, 48종의 일반 적 위에 **공용 소켓 기반 오버레이 레이어**를 겹쳐 어떤 종족 팩이 추가되어도 정예 원화를 따로 그리지 않게 한다.

| 정예 ID | 도메인 효과 | 체격 보정 | 전면 상부 레이어 (`z + 1`) | 후면·바닥 레이어 (`z - 1`) | 소켓·정렬 규칙 |
|---|---|---|---|---|---|
| **`armored`** (중갑) | `hp × 2.0`, 물리저항 `+2000 BP` (상한 `5000 BP`) | 본체 스케일 **`1.12x`** (`pivot (32,48)` 고정 확대) | **`elite_armored_pauldron.png`**: `chestSocketPx`(기본 `(34,34)`)에 결합되는 리벳 박힌 청강색(`#5B7083`) + 황동 테(`#E0A938`) 반달 어깨·가슴 철갑판 | **`elite_armored_ring.png`**: 발밑 `pivot (32,48)`에 깔리는 묵직한 타원형 무쇠 발판 테(점멸 없음) | `flipX` 반전 시 소켓 `dx` 부호 동시 반전. 외곽선 `2px` 짙은 갈색 동일 적용 |
| **`swift`** (신속) | `hp × 2.0`, 속도 `× 1.2` | 본체 스케일 **`1.08x`** (`pivot (32,48)` 고정 확대) | **`elite_swift_scarf.png`**: `headSocketPx`(기본 `(30,22)`)에 묶여 진행 반대쪽으로 날리는 하늘·연노랑 투톤(`#3EDBF0`/`#FFF3B0`) 두 갈래 바람 머리띠(2프레임) | **`elite_swift_trail.png`**: `pivot` 뒤쪽 `(-10,-4)`에 붙는 짧은 반투명 백색 바람결 2줄(기절·정지 중 숨김) | 날개·번개 기호 대신 천 머리띠와 바람결만으로 속도를 표현 |

---

## 5. 이미지 생성 공통 프롬프트 틀 및 반려 기준

### 5.1 영문 공통 프롬프트 템플릿

```text
2D top-down three-quarter tactical game sprite in "Kingdom Expedition" fantasy style, consistent ~38-degree overhead ground projection.
Subject: {UNIT_PROMPT_FRAGMENT}, facing right in an asymmetric forward-moving silhouette.
Proportions: cute 2-head-tall chibi villain for elementary-school adventure game, mischievous and playful expression, never scary or grotesque.
Line & Shading: bold dark espresso-brown outer outline (#3a291e), clean thinner inner lines, warm top-left sunlight, crisp 2-to-3-tone cel shading, large readable flat color blocks, faction palette ({HEX_1}, {HEX_2}, {HEX_3}, {HEX_4}), zero micro-texture or noisy hatching, clear silhouette at 24-32px display size.
Framing: single isolated character centered with feet grounded at bottom-center pivot ({FRAME_SIZE}, pivot {PIVOT_XY}), short contact shadow oval only, pure transparent RGBA background, no text, no letters, no numbers, no UI badges, no floor tiles.
```

- **일반 적 치수 치환값:** `{FRAME_SIZE} = 64x64px`, `{PIVOT_XY} = (32, 48)`
- **대장 치수 치환값:** `{FRAME_SIZE} = 128x128px`, `{PIVOT_XY} = (64, 96)`

### 5.2 인수 반려(Rejection) 기준

| 분류 | 즉시 반려 사유 |
|---|---|
| **문자·기호 오염** | 한글·영문·한자·가짜 룬 글자, 숫자, 가격표, 워터마크, 작가 서명이 1px이라도 포함된 경우 |
| **시점·원근 불일치** | 정면 수평 스탠딩 일러스트, 수직 90도 정수리 시점, 3D 렌더링 투시, 바닥 격자·잔디 타일이 함께 그려진 경우 |
| **재질·광택 오염 (AI Slop)** | 플라스틱·비닐 인형 같은 하이라이트, 에어브러시 그라데이션 남발, 금속 크롬 반사, 반짝이 별가루·네온 발광 테두리 |
| **과밀 디테일** | 털 한 올·비늘·모공 등 소형 잡질감이 많아 `24~30 CSS px` 축소 접촉판에서 내부가 검게 뭉개지거나 자글거리는 경우 |
| **정서·윤리 부적합** | 무서운 충혈 눈·날카로운 이빨 위협·피·해골·구더기·다족류 곤충 다리(징그러움), 실존 종교·정치 문양, 포켓몬·킹덤러시 등 기존 IP 특정 캐릭터와 구도·배색이 유사한 경우 |
| **알파·프레임 불량** | 가짜 투명 체크무늬 배경 포함, 외곽 흰색/검은색 반투명 테두리(halo) 잔류, 무기·꼬리가 프레임 경계 밖으로 잘린 경우 |

---

## 6. 엔진 변경 명세 및 구현 난이도

기존 결정론적 30Hz 정수 엔진(`src/domain/`)을 단계적으로 확장할 수 있도록 **4단계(Phase A~D)**로 분리했다. **Phase A~B만 구현해도 v1 8종족 80종 외형과 맵별·무한 침입 편성이 즉시 작동한다.**

| 단계 | 기능 항목 | 수정 대상 파일 | 새로 필요한 필드·타입·판정 규칙 | 난이도 |
|:---:|---|---|---|:---:|
| **A** | **종족 스킨·대장 티어 분리** (데이터+그림 팩 구조) | `src/contracts/balance.ts`, `src/domain/types.ts`, `src/domain/events.ts`, 에셋 manifest | • `SpawnEntry`, `Enemy`에 `factionId: string`, `bossTier: 1 \| 2 \| 3 \| 4 \| null` 추가 (`RUN_STATE_VERSION` 갱신)<br>• `spawn` / `kill` / `leak` 이벤트에 `factionId`, `elite`, `bossTier` 전달<br>• 적 manifest에 정예 소켓 `headSocketPx`, `chestSocketPx` 추가 (도메인 연산 영향 0) | **하** |
| **B** | **맵별 1~20W 편성표 & 21W+ 침입 순환** | `src/contracts/maps.ts`(또는 `balance.ts`), `src/domain/waves.ts` | • 맵 데이터에 `primaryFactionId`, `guestSpawns`(W14·W17), `invasionOrder: string[]`, `waveComposition` 추가<br>• `composeWave()`에서 `wave <= 20` 손님 비중 및 `wave >= 21` 5웨이브 블록 혼성비(`50:50` → `30:70` + 침입 `bossTier`) 정수 배정(`rng` 호출 횟수 고정) | **하** |
| **C** | **신규 일반 역할 6종 판정** (§1.2 선택 도입) | `src/domain/types.ts`, `src/domain/combat.ts`, `src/domain/towers.ts` | • `TowerStats.canHitAir: boolean` 추가 (`cannon`, `spear`, `guardian` = `false`) 및 `Enemy.flying: boolean` 필터링<br>• `applyHit()`에 반경 `1600` 내 `aura_guard` 탐색 피해 경감(`2000 BP`) 추가<br>• `Enemy`에 `isDerived: boolean`, `nextSkillTick: number \| null`, `skillChargesLeft: number`, `burrowUntilTick: number` 추가<br>• 공용 파생 생성 `spawnDerived()` 구현: `isDerived === true`면 `kill()` 시 골드·PT `0` 고정(농사 방지)<br>• `battleTick()` 순서 확장: `만료 → 생성 → 도착 공격 → 화상 → 적 주기 능력(healer·summoner) → 타워 발사 → 이동/누출` | **중** |
| **D** | **대장 기믹 프리미티브 6종** (§2.0) | `src/contracts/balance.ts`, `src/domain/combat.ts` | • 종족별 대장 정의에 선언형 `bossSkill` 객체(`type`, `triggerBp`, `periodTicks`, `durationTicks`, `valueBp`, `escortKind` 등) 연결<br>• `iron_stance`, `burst_march`, `rally_haste`, `ward_layers`, `snack_mend`, `call_escort` 6개 핸들러로 32종 대장 전체 구동(개별 보스 하드코딩 금지) | **중** |

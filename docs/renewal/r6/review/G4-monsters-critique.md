# R6 G4 몬스터 100개체 비평 검수 보고서

- 검수 일시: 2026-11-26
- 검수 대상: 5종족 × 20개체 = 100개체(분해 시트·Spine 2D 리깅·전장 배치)
  - 종족 한눈판·설정표: `docs/renewal/r6/bible/sheets/monsters-{machine,stone,human,elf,insect}-parts-all.webp`, `monsters-{mech,golem,human,elf,insect}.webp`
  - 전장 캡처·판독 띠: [battle-walk.webp](../tech/monsters/battle-walk.webp)(W20 · 30개체), [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp)(W15 · 28개체), `docs/renewal/r6/tech/monsters/{machine,stone,human,elf,insect}-32px.webp`
  - 자동 판독·메모: [silhouettes.json](../tech/monsters/silhouettes.json), [G4-monsters-notes.md](./G4-monsters-notes.md), [batch.json](../tech/monsters/batch.json)
- 기준: [PRD-r6.md](../PRD-r6.md)(§4 · §8), R04 화풍([concept.md](../round3/concepts/R04/concept.md), [a-battle.webp](../round3/concepts/R04/a-battle.webp), [c-enemies.webp](../round3/concepts/R04/c-enemies.webp)), 타워 비평 선례([G4-towers-critique.md](./G4-towers-critique.md))
- 비평가 구성: **비평가 A(아트 디렉터)** · **비평가 B(교사·학생 플레이어)**

> **요약 판정: G4 조건부 반려 (전면 재작업 불필요 — 리그·크기·대비 도구 보정 + 필수 6개체 재작화 후 재검수)**  
> 1차의 밋밋함과 2차의 유치함·과잉을 벗어나 R04 6색 무광 화풍과 실제 게임급 5종족 개성을 확보한 점은 분명한 진전이다. 100개체 모두 전용 스킨으로 전장에 올라왔고 인접 진화 75쌍도 모두 자동 기준을 통과했다. 그러나 실전장 캡처(W15·W20)에서 **사지 절단·파츠 이탈(16개체)**, **갑각 슬롯에 의한 머리 실종(7개체)**, **보스 2.2배·중장갑 1.5배 과대 스케일의 설치 칸 침범**, **어두운 바탕 묻힘(엘프 지형 14/20·기계 길 17/20 미달)**, 그리고 **핵심 6개체의 실루엣 중복·진화 퇴행**이 확인돼 현 상태로는 G4 통과가 어렵다.

---

## 1. 종족별 판정

| 종족 | 판정 | 한 줄 근거 |
|---|---|---|
| **기계 군단 (`machine`)** | **조건부** | R04 6색·45° 모따기 정합성과 특수·보스 진화 완성도는 5종족 중 최고이나, `machine-armored-t2`가 벌레 갑충과 혼동되고 길 대비(17/20 미달)·일부 리그 이탈 보정이 필요하다. |
| **철갑 인간 (`human`)** | **조건부** | 은회 판금+앰버 포인트로 교실·원거리 판독성이 5종족 중 최고(지형 대비 2.50, 0/20 미달)이나, W15·W20 무기 누락·손 분리·투구 묻힘과 보스 T1·T4 차별화 보완이 필요하다. |
| **바위 거인 (`stone`)** | **조건부** | 무광 현무암·수정·용암 재질감과 질주 계통 진화는 탄탄하나, `stone-boss-t1` 자동 관문 6건 탈락·`stone-boss-t3`↔`infantry-t4` 중복·`stone-special-t4` 퇴행 3건 재작화와 리그·크기 보정이 필수다. |
| **숲 엘프 (`elf`)** | **반려** | W15·W20에서 중장갑·보병 사지·방패 절단이 가장 심각하고, 14/20개체가 지형 대비 1.5배 미만(질주 T3·T4 명도 역전)이며 `elf-special-t3` 엉킨 선 뭉치까지 겹쳐 현 상태로 출하 불가다. |
| **군체 벌레 (`insect`)** | **반려** | 3회차 광물판(`special-t3/t4`, `boss-t3`) 다듬기와 질주·중장갑 원화는 양호하나, `insect-infantry-t2~t4` 머리 실종·`boss-t3` 머리 이탈/부유 발톱·`boss-t4` 관절 단면 노출·빈약한 `boss-t1`이 집중됐다. |

### 종족별 두 비평가 관찰 요지

- **기계 군단 (`machine`)**
  - **비평가 A(아트)**: `R04/c-enemies.webp`를 가장 자연스럽게 계승했다. 특히 `machine-special-t1~t4`(소형 캐리어 → 쌍열 수송기 → 4로터 모함 → 고리형 공중모함)와 `machine-boss-t1~t4`는 절제된 실제 게임급 완성도다. 반면 `machine-armored-t2`는 보행기 방패 계통을 깨고 벌레 갑충 돔을 써 종족 경계를 흐린다. `machine-infantry-t2`·`machine-runner-t1`에는 흰 배경 잔여가 남아 있다.
  - **비평가 B(교사·학생)**: 길(`#4A5563`)과 기체 슬레이트 회색이 겹쳐 17/20개체가 길 대비 1.5배 미만(`pathMedAvg 1.42`)이다. W15에서 `machine-armored-t2` 3기가 벌레 중장갑으로 읽힌다.
- **철갑 인간 (`human`)**
  - **비평가 A(아트)**: 판금 보병·기병·공성수레의 세계관 개성이 선명하고 `human-boss-t3`(공성탑)·`human-special-t4`(공성전차)의 무게감이 좋다. 다만 `human-boss-t1`↔`human-infantry-t4`, `human-boss-t4`↔`human-armored-t3/t4`(동일 독수리 방패)가 보스 전용 실루엣으로 덜 분리되며, `human-infantry-t1/t2`의 맨얼굴은 T3·T4 투구 대비 약간 가볍다.
  - **비평가 B(교사·학생)**: W15·W20 혼잡 속에서도 가장 먼저 눈에 들어오는 모범적인 명도 위계다. 다만 기병 말 몸통은 길 대비가 낮고(`1.34~1.37`), W20에서 `human-infantry-t4`의 떠 있는 손과 `human-runner-t3`의 깃발창 실종이 눈에 거슬린다.
- **바위 거인 (`stone`)**
  - **비평가 A(아트)**: 과한 광택 없이 무광 현무암+틸 수정+앰버 균열을 잘 절제했다. `stone-runner-t1~t4`의 4단계 진화가 매우 설득력 있다. 그러나 `stone-boss-t1`(일반 보병과 동일), `stone-boss-t3`(`stone-infantry-t4`와 쌍둥이), `stone-special-t4`(T3보다 작아진 퇴행) 3건은 원화 수정이 필요하다.
  - **비평가 B(교사·학생)**: W20에서 `stone-armored-t3`의 거대 회색 판석 방패 두 장과 `stone-infantry-t4`의 큰 덩치가 일반 적을 보스처럼 보이게 만들고 뒤편 유닛과 길을 가린다. 길 대비 15/20 미달(`pathMedAvg 1.47`)도 보강이 필요하다.
- **숲 엘프 (`elf`)**
  - **비평가 A(아트)**: 숲·가지·틸 문양 콘셉트 자체는 다른 4종족과 잘 구별된다. 6차에서 밝힌 `elf-runner-t2`는 32px에서 선명해졌으나, T3·T4가 다시 어두운 흑표범으로 떨어져 T1→T4 진화 명도가 역전됐다. `elf-special-t3`는 설정표의 깔끔한 바람 고리가 아니라 어두운 실타래 뭉치로 번잡해졌다.
  - **비평가 B(교사·학생)**: 지형 대비 1.5배 미만이 **14/20개체**로 최다다. W20 중앙의 `elf-runner-t3`·`elf-infantry-t4`는 프로젝터에서 배경에 묻힐 수준이며, W15·W20의 `elf-armored-t2~t4` 사지·방패 절단은 플레이어가 즉시 버그로 인지한다.
- **군체 벌레 (`insect`)**
  - **비평가 A(아트)**: 검수 메모의 쟁점이던 `insect-special-t3/t4`와 `insect-boss-t3`의 광물판 다듬기는 성공적이다(알 덩어리 인상 해소, R04 각진 틸 수정과 정합). `insect-runner-t1~t4`(날개 곤충 4종)와 `insect-armored-t1~t4` 원화 완성도도 높다. 다만 `insect-boss-t1`이 설정표의 거대 여왕말벌 대신 작은 왕관을 쓴 가는 인간형 벌로 바뀌어 유치하고 왜소하다.
  - **비평가 B(교사·학생)**: `insect-special-t1/t2`는 중장갑 T1과 실루엣은 분리됐으나 길 대비 최하위권(`1.274`·`1.310`)에 32px 셀 하단에 납작하게 깔려 잘 안 읽힌다. 무엇보다 W15·W20 전장에서 `insect-infantry-t2~t4`가 머리 없는 빈 목구멍으로 걷고 `insect-boss-t3` 앞발이 공중에 떠 있어 즉각 수정이 필요하다.

---

## 2. 우선순위별 문제 목록 (14건)

고치는 방법은 **`도구로 고침`**(크기·배치·슬롯 순서·파츠 추출·색 보정·QA 규칙)과 **`다시 그림`**(원화·파츠 재작화)으로 구분한다.

### P0 · 즉시 수정 필수 (G4 차단 요인, 6건)

#### 1. [P0] 전장 보행 중 사지 절단·파츠 이탈·관절 단면 노출
- **분류**: `도구로 고침`
- **대상 개체 id**: `elf-armored-t2`, `elf-armored-t3`, `elf-armored-t4`, `elf-infantry-t2`, `elf-infantry-t4`, `stone-infantry-t2`, `human-infantry-t4`, `machine-runner-t2`, `machine-runner-t3`, `machine-infantry-t3`, `machine-armored-t2`, `insect-armored-t3`, `insect-armored-t4`, `insect-boss-t1`, `insect-boss-t3`, `insect-boss-t4`
- **증거**:
  - [battle-walk.webp](../tech/monsters/battle-walk.webp): 우측 끝 `elf-armored-t3` 다리가 골반과 끊겨 부유하고 팔이 소실됨; 바로 왼쪽 `elf-armored-t4` 방패·앞다리가 직선으로 잘려 조각남. 좌측 `insect-boss-t4` 앞·뒷다리 관절에 빈 원통 단면 노출. 중앙·우측 `human-infantry-t4` 2기 모두 먼 쪽 손목·건틀릿이 허리 옆 허공에 분리 부유. 좌하단 `insect-armored-t4` 뒷다리 분리.
  - [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp): 좌측 `insect-boss-t3` 앞다리 아래 먼 쪽 발톱이 공중 분리. 좌하단 `elf-armored-t2` 먼 쪽 다리가 절단돼 발끝 점만 남고 `elf-infantry-t2` 정강이 끊김. 상단 중앙 `stone-infantry-t2` 양팔이 어깨와 떨어지고 왼손 수정 주먹이 수직 절단됨. 상단 `machine-runner-t2/t3` 뒷다리 분리, 중앙 우측 `machine-infantry-t3` 발 부유, `machine-armored-t2` 3기 모두 등껍질 아래 다리가 일자로 잘리고 등 위에 회색 파편 돌출.
  - [insect-32px.webp](../tech/monsters/insect-32px.webp): `armored/T3` 앞발 분리, `boss/T1` 우하단 발 조각 부유.
  - 대조: `monsters-*-parts-all.webp`의 원화 파츠 자체는 온전하므로 원화 결함이 아니라 파츠 절단·아틀라스 경계·본 피벗/회전 여유 문제다.
- **고치는 방법**: `tools/r6/spine/`(`cut_parts.py`, `fit_parts.py`, 아틀라스 패딩·본 원점)에서 관절 겹침 여유와 클리핑 경계를 보정하고, Mesh2D 재출력 후 W15·W20 실전장 캡처로 재확인한다.

#### 2. [P0] `armor` 슬롯이 `head`를 가려 머리 실종·빈 목구멍 노출
- **분류**: `도구로 고침`
- **대상 개체 id**: `insect-infantry-t2`, `insect-infantry-t3`, `insect-infantry-t4`, `insect-boss-t3`, `machine-infantry-t3`, `human-armored-t2`, `human-armored-t3`
- **증거**:
  - [insect-32px.webp](../tech/monsters/insect-32px.webp) 1행 T2~T4, [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 우측(`insect-infantry-t2` 2기, 하단 `t3`), [battle-walk.webp](../tech/monsters/battle-walk.webp) 좌하·중앙(`t4`·`t3`): `monsters-insect-parts-all.webp`에는 머리가 그려져 있으나, 조립 후 가슴·어깨 갑각(`armor`)이 머리 앞을 덮어 텅 빈 검은 목구멍처럼 보인다.
  - [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 좌측 및 [insect-32px.webp](../tech/monsters/insect-32px.webp) 5행 T3: `insect-boss-t3`의 머리가 등 위쪽으로 밀려나고 정면 목 부위가 빈 앰버 구멍으로 열렸다.
  - [machine-32px.webp](../tech/monsters/machine-32px.webp) 1행 T3, [battle-walk.webp](../tech/monsters/battle-walk.webp) 좌측, [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 중앙: `machine-infantry-t3`의 둥근 어깨 갑각이 머리 위로 솟아 빈 고리 목처럼 보인다.
  - [human-32px.webp](../tech/monsters/human-32px.webp) 3행 T2~T3, [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 하단 `human-armored-t2`: `human-armored-t3` 투구가 회색 칼라에 파묻히고 T2 목선 정렬이 어긋났다.
- **고치는 방법**: Spine 슬롯 그리기 순서(`rigs.py`에서 `head`가 `armor`보다 앞선 구조)를 `body → armor → head`로 조정하거나 해당 스킨의 `head` 부착 Y 오프셋을 올려 머리가 갑각 위로 선명하게 드러나게 한다.

#### 3. [P0] W15·W20 과대 스케일 및 길 이탈·빈 타워 설치 칸 침범
- **분류**: `도구로 고침`
- **대상 개체 id**: 전 종족 공통(특히 `insect-boss-t3`, `insect-boss-t4`, `stone-armored-t3`, `stone-infantry-t4`, `human-armored-t4`, `insect-armored-t4` 및 중장갑·보스 계통 전반)
- **증거**:
  - [battle-walk.webp](../tech/monsters/battle-walk.webp)(W20 · 30개체): 좌측 `insect-boss-t4`(2.20×)가 길 폭을 크게 넘겨 좌측 육각 설치 칸 가장자리를 덮는다. 상단·하단 `stone-armored-t3`의 거대 방패가 윗길과 뒤편 유닛을 가린다. 우하단 굽잇길에서 `stone-infantry-t4`·`elf-special-t3`·`insect-special-t3`·`elf-runner-t3`가 겹쳐 뭉치며 하단 설치 칸을 침범한다.
  - [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp)(W15 · 28개체): 좌측 `insect-boss-t3`(2.00×)가 좌측 설치 칸 절반을 덮고, 바로 옆 `insect-runner-t2`를 앞다리 뒤로 가린다. 내부 굽잇길의 `elf-armored-t2/t3`·`insect-infantry-t2`·`human-armored-t2`도 인접 설치 칸 위로 겹친다.
  - 기준 대조: R04 기준 [a-battle.webp](../round3/concepts/R04/a-battle.webp)에서는 적이 길 레일 안쪽 폭에 정갈하게 들어가 설치 칸을 침범하지 않는다.
- **고치는 방법**: `src/game/r6/monsters/*.json`의 기본 표시 배율을 전반적으로 25~30% 축소하고 계통 배율 상한을 압축한다(권장: 보병·질주 `0.70~0.92x`, 중장갑·특수 `0.85~1.12x`, 보스 `1.30~1.55x`). 보스 존재감은 과대 크기 대신 발밑 R04 1px 앰버 모따기 고리로 보강하고, 웨이브 혼잡 시 좁은 경로 횡분산(±4~6px)과 y+진행도 기준 깊이 정렬을 적용한다.

#### 4. [P0] `stone-boss-t1` 보스-일반 실루엣 중복 (자동 검수 유일 탈락 6건)
- **분류**: `다시 그림`
- **대상 개체 id**: `stone-boss-t1`
- **증거**:
  - [silhouettes.json](../tech/monsters/silhouettes.json) `bossVsRegular`: 전 종족 320쌍 중 기준(0.70) 미달 6쌍이 전부 `stone-boss-t1`에 집중(`stone-infantry-t3` 0.750, `t1` 0.738, `t2` 0.724, `t4` 0.714, `stone-armored-t1` 0.706, `t2` 0.704).
  - [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 5행 1열, [stone-32px.webp](../tech/monsters/stone-32px.webp) 5행 T1: 회색 돌 몸체에 회색 철퇴만 든 직립 골렘으로 `stone-infantry-t1/t3`와 실루엣·색이 모두 겹친다.
- **고치는 방법**: 일반 직립 보병 자세에서 벗어나 등 위 바위 아치·비대칭 거대 공성 망치·절제된 앰버/틸 핵 포인트를 갖춘 W5 보스 전용 실루엣으로 재작화한다(보스-일반 IoU < 0.65 목표).

#### 5. [P0] `machine-armored-t2` 벌레 종족 혼동 및 중장갑 진화 단절
- **분류**: `다시 그림`
- **대상 개체 id**: `machine-armored-t2`
- **증거**:
  - [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp)(3기 출현), [machine-32px.webp](../tech/monsters/machine-32px.webp) 3행 T2 vs [insect-32px.webp](../tech/monsters/insect-32px.webp) 3행 T1·T3: 둥근 검회색 돔 갑각 + 앰버 줄무늬 + 발톱 다리가 `insect-armored-t1/t3`와 거의 같은 종족으로 읽힌다.
  - [silhouettes.json](../tech/monsters/silhouettes.json) `crossSpecies`: 100개체 중 타 종족 중복 최다(`insect-boss-t3` 0.701, `stone-infantry-t3` 0.693, `human-armored-t3` 0.693, `insect-armored-t4` 0.690).
  - [monsters-machine-parts-all.webp](../bible/sheets/monsters-machine-parts-all.webp) 3행: T1(직립 방패 보행기) → **T2(갑충 돔)** → T3(직립 벙커 방패) → T4(V방패 포탑 워커)로 T2만 진화 계통이 끊긴다.
- **고치는 방법**: T1과 T3를 자연스럽게 잇는 45° 모따기 직립 장갑 방패 보행기(이중 각진 전면 방패 + 틸 광학 슬릿)로 재작화한다.

#### 6. [P0] 엘프·기계·바위·벌레 저대비 묻힘 및 엘프 질주 명도 역전
- **분류**: `도구로 고침`
- **대상 개체 id**:
  - 지형(`#1D242C`) 저대비: `elf-runner-t3`(1.159 · 미만 81.0%), `elf-infantry-t4`(1.175 · 76.9%), `elf-special-t1`(1.203 · 78.2%), `machine-infantry-t4`(1.215 · 71.0%), `elf-armored-t3`(1.242 · 83.3%), `elf-runner-t4`(1.268 · 71.0%), 외 엘프 8종(`infantry-t1~t3`, `armored-t1`, `boss-t1/t2` 등)·벌레 9종(`infantry-t2~t4`, `armored-t1/t2`, `boss-t2` 등)
  - 길(`#4A5563`) 저대비: `machine-armored-t4`(1.268 · 미만 72.1%), `insect-special-t1`(1.274 · 71.7%), `stone-armored-t2`(1.280 · 69.0%), `elf-boss-t2`(1.305 · 70.1%), `insect-special-t2`(1.310 · 72.6%), `machine-special-t3`(1.326 · 74.9%), `machine-boss-t3`(1.336), `human-runner-t1/t3/t4`(1.339~1.372), `stone-armored-t1/t3`(1.340~1.355)
- **증거**:
  - [silhouettes.json](../tech/monsters/silhouettes.json) `groundContrast`: 길 대비 1.5배 미만 개체 수는 기계 17/20, 바위 15/20, 벌레 13/20, 인간 10/20, 엘프 7/20; 지형 대비 1.5배 미만은 **엘프 14/20**, 벌레 9/20, 기계 4/20이다.
  - [elf-32px.webp](../tech/monsters/elf-32px.webp) 2행: 6차 수정으로 밝아진 `elf-runner-t2`(은회색)에 이어 `t3`·`t4`가 급격히 어두워져 상위 단계가 오히려 덜 보인다.
  - [battle-walk.webp](../tech/monsters/battle-walk.webp) 중앙 `elf-runner-t3`·`elf-infantry-t4`, [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 우상단 `elf-armored-t3`, [insect-32px.webp](../tech/monsters/insect-32px.webp) 4행 `insect-special-t1/t2`: 어두운 길·지형 위에서 윤곽이 뭉개져 프로젝터 환경에서 판독이 급감한다.
- **고치는 방법**: 아틀라스 색 보정 파이프라인에서 저대비 개체군(특히 엘프 T3·T4, 회색 기계·바위·기병 말 몸통)의 좌상단 명부 명도와 은회(`#B8C0C8`)·틸(`#2FB5A3`) 가장자리 림 대비를 끌어올리고(빛 번짐·광택 금지), `insect-special-t1/t2`는 32px 프레이밍 크기를 키워 납작함을 줄인다.

---

### P1 · 품질·진화·보스 정체성 확보 (5건)

#### 7. [P1] 리깅 조립 시 무기·방패 누락 및 위치 어긋남
- **분류**: `도구로 고침`
- **대상 개체 id**: `human-runner-t3`, `human-infantry-t2`, `human-infantry-t3`, `elf-armored-t2`, `elf-armored-t4`, `stone-armored-t3`, `stone-armored-t4`
- **증거**:
  - [human-32px.webp](../tech/monsters/human-32px.webp) 2행 T3, [battle-walk.webp](../tech/monsters/battle-walk.webp) 좌상단: [monsters-human-parts-all.webp](../bible/sheets/monsters-human-parts-all.webp)의 `human-runner-t3` 앰버 깃발창이 완전히 사라져 비무장 기병으로 보인다.
  - [human-32px.webp](../tech/monsters/human-32px.webp) 1행 T2·T3, [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 좌상·좌하단: `human-infantry-t2` 장창과 `t3` 미늘창이 소실되거나 몸 뒤로 숨어 맨손 병사로 보인다.
  - [elf-32px.webp](../tech/monsters/elf-32px.webp) 3행 T2·T4, [battle-w15-walk.webp](../tech/monsters/battle-w15-walk.webp) 하단 `elf-armored-t2`: 원화의 전면 대형 방패가 몸 왼쪽 뒤편으로 작게 밀려났다.
  - [stone-32px.webp](../tech/monsters/stone-32px.webp) 3행 T4 vs [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 3행 T4: 양손 쌍방패 중 먼 쪽 방패가 소실돼 T3보다 방어력이 약해 보인다. `stone-armored-t3`는 머리 위 성곽 장식(`armor`)이 분리 부유한다([battle-walk.webp](../tech/monsters/battle-walk.webp) 상단 중앙).
- **고치는 방법**: `cut_parts.py`·`fit_parts.py`에서 `gear`·`arm-hand-far`·`armor` 파츠 경계와 부착 좌표를 `monsters-*-parts-all.webp` 원화 기준에 맞게 재정렬한다.

#### 8. [P1] `stone-boss-t3`와 `stone-infantry-t4` 외형 중복
- **분류**: `다시 그림`
- **대상 개체 id**: `stone-boss-t3`
- **증거**:
  - [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 1행 4열(`infantry/T4`) vs 5행 3열(`boss-t3/T3`), [stone-32px.webp](../tech/monsters/stone-32px.webp) 1행 T4 vs 5행 T3: 둘 다 어두운 현무암 직립 골렘에 같은 배치의 앰버 용암 균열이 들어가 있어 쌍둥이처럼 보인다. 실제 [battle-walk.webp](../tech/monsters/battle-walk.webp)에서 `stone-infantry-t4`가 보스처럼 오인될 만큼 위계가 겹친다.
- **고치는 방법**: `stone-boss-t3`를 직립 보병형에서 벗어나 등 위 용암 굴뚝·거대 분화구 어깨·지면 충격형 비대칭 양팔을 가진 W15 보스 전용 실루엣으로 재작화한다.

#### 9. [P1] `stone-special-t4` 진화 퇴행 (T3·T1보다 왜소·단순화)
- **분류**: `다시 그림`
- **대상 개체 id**: `stone-special-t4`
- **증거**:
  - [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 4행(`special/T1~T4`), [stone-32px.webp](../tech/monsters/stone-32px.webp) 4행: T1(큰 단일 수정) → T2(바위 고리+수정) → T3(3단 피라미드+다발 수정 5개)로 올라가다, **T4에서 2단 얇은 받침 위 소형 단일 수정**으로 볼륨과 위계가 거꾸로 줄었다.
- **고치는 방법**: T3 피라미드 다발을 분명히 뛰어넘는 최종형(대형 중심 수정탑 + 외곽 부유 바위 고리·위성 수정 3기)으로 재작화한다.

#### 10. [P1] `elf-special-t3` 번잡한 철사 뭉치화 (R04 절제미 이탈)
- **분류**: `다시 그림`
- **대상 개체 id**: `elf-special-t3` *(선택 보강: `elf-special-t4`)*
- **증거**:
  - [monsters-elf.webp](../bible/sheets/monsters-elf.webp) 설정표의 정돈된 회전 고리와 달리, [monsters-elf-parts-all.webp](../bible/sheets/monsters-elf-parts-all.webp) 4행 3열·[elf-32px.webp](../tech/monsters/elf-32px.webp) 4행 T3·[battle-walk.webp](../tech/monsters/battle-walk.webp) 하단에서 어두운 회색 가는 선이 뭉친 철수세미처럼 번잡하게 표현됐다. W20 하단에서 `insect-special-t3`와 겹치면 형태가 완전히 뭉개진다.
  - `elf-special-t4`도 [elf-32px.webp](../tech/monsters/elf-32px.webp) 4행 T4에서 엉킨 고리 안의 흰 점 눈 두 개 달린 가면처럼 보여 설정표의 고목 왕관+다면체 숲핵 대비 완성도가 떨어진다.
- **고치는 방법**: 엉킨 가는 선을 걷어내고 R04 1px 외곽선과 2~3개의 깔끔한 기하학 바람 고리·잎날개 실루엣으로 재작화한다(`t4`는 여유 시 다면체 수정핵+가지 왕관으로 함께 다듬음).

#### 11. [P1] `insect-boss-t1` 빈약한 인간형 여왕벌 (보스 위압감 부족)
- **분류**: `다시 그림`
- **대상 개체 id**: `insect-boss-t1`
- **증거**:
  - [monsters-insect.webp](../bible/sheets/monsters-insect.webp) 설정표 5행 1열의 횡으로 넓은 거대 장갑 여왕말벌과 달리, [monsters-insect-parts-all.webp](../bible/sheets/monsters-insect-parts-all.webp) 5행 1열과 [insect-32px.webp](../tech/monsters/insect-32px.webp) 5행 T1에서는 가는 다리로 직립한 인간형 벌 병사에 작은 금색 왕관을 얹은 모습으로 바뀌었다.
  - 보스 T2~T4의 중후한 거대 갑충과 결이 맞지 않고, 32px에서 `insect-infantry-t1`보다 왜소해 W5 보스 존재감이 약하다.
- **고치는 방법**: 설정표 원안대로 횡폭이 넓고 묵직한 비행형 거대 장갑 여왕말벌(두꺼운 복부 마디 + 무광 4매 날개 + 절제된 앰버 경계 줄, 왕관 장식 제거)로 재작화한다.

---

### P2 · 마감 보완 및 검수 기준 정비 (3건)

#### 12. [P2] `human-boss-t1`·`human-boss-t4` 일반 기사 계통과의 보스 실루엣 유사성
- **분류**: `다시 그림` *(P0·P1 해결 후 여유 시 적용 권장 — `human-boss-t1` 우선)*
- **대상 개체 id**: `human-boss-t1`, `human-boss-t4`
- **증거**:
  - [human-32px.webp](../tech/monsters/human-32px.webp) 5행 T1 vs 1행 T4(`human-infantry-t4`): 둘 다 금색 깃털 투구+은회 판금+한손 무기 직립 기사로 `silhouettes.json` IoU **0.673**(기준 0.70 근접).
  - [human-32px.webp](../tech/monsters/human-32px.webp) 5행 T4 vs 3행 T3·T4(`human-armored-t3/t4`): 동일한 앰버 독수리 방패와 자세(IoU 0.633~0.677). 32px에서 보스 T4의 좌측 장병기는 2~3px로 얇아 원거리에서 일반 중장갑과 즉각 구분이 약하다.
- **고치는 방법**: `human-boss-t1`에 넓은 지휘 망토·등 깃발 또는 대형 양손 망치를 더하고, `human-boss-t4`는 일반 중장갑 방패 복제를 피해 지휘 깃발·대형 견갑·굵은 장병기 실루엣으로 차별화한다.

#### 13. [P2] 원화 파츠 흰 배경 잔여(8개체) 및 `machine-runner-t1` 32px 다리 시인성 약화
- **분류**: `도구로 고침` *(흰 배경 정화; `machine-runner-t1` 다리 구조 개편은 선택적 `다시 그림`)*
- **대상 개체 id**: `machine-infantry-t2`, `machine-runner-t1`, `stone-armored-t2`, `stone-armored-t3`, `elf-armored-t1`, `elf-armored-t2`, `elf-armored-t3`, `elf-armored-t4`
- **증거**:
  - [monsters-machine-parts-all.webp](../bible/sheets/monsters-machine-parts-all.webp): `infantry/T2` 우측 팔·가슴 경계에 흰 삼각 구멍, `runner/T1` 턱 아래 흰 삼각 잔여.
  - [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp): `armored/T2`·`T3` 방패와 몸통 사이 흰 틈새 잔여.
  - [monsters-elf-parts-all.webp](../bible/sheets/monsters-elf-parts-all.webp): `armored/T1~T4` 4개체 모두 분리된 하단 부츠(`leg-foot-near`) 뒤꿈치에 흰 삼각 잔여.
  - [machine-32px.webp](../tech/monsters/machine-32px.webp) 2행 T1(`machine-runner-t1`): 실처럼 가는 4개 다리가 32px에서 거의 사라져 둥근 캡슐만 떠 보인다.
- **고치는 방법**: `tools/r6/spine/white_key.py`의 내부 닫힌 영역 제거를 보강해 8개체 흰 잔여를 일괄 정리한다. `machine-runner-t1`은 추후 여유 시 T2~T4 늑대형과 결이 맞는 각진 경량 4족 프레임으로 `다시 그림`을 권장한다.

#### 14. [P2] 종족 간 자동 실루엣 판정(0.55) 현실화 및 비행 고도 표시 보강
- **분류**: `도구로 고침`
- **대상 개체 id**: 전 종족 자동 QA 규칙 + 비행 개체(`machine-special-t1~t4`, `elf-special-t1~t4`, `insect-runner-t1~t4`)
- **증거**:
  - [silhouettes.json](../tech/monsters/silhouettes.json): 종족 간 4,000쌍 중 696쌍이 이진 IoU 0.55를 초과했으나, 상위 쌍(`stone-boss-t4` vs `human-armored-t3` 0.723, `elf-infantry-t4` vs `human-infantry-t4` 0.713)은 실제 화면에서 색·재질·크기가 완전히 달라 혼동되지 않는다. 실제 혼동 쌍은 형태와 색이 함께 겹치는 `machine-armored-t2`↔벌레다.
  - [battle-walk.webp](../tech/monsters/battle-walk.webp): 비행 중인 `elf-special-t3`의 옅은 회색 타원 그림자가 본체와 떨어져 길 위 얼룩처럼 보이고, `machine-special-t3`는 그림자가 묻혀 지상 적과 고도 차이가 약하다.
- **고치는 방법**: 종족 간 자동 검수 기준은 이진 마스크 단일 0.55 대신 **"이진 IoU ≥ 0.65이면서 색·명도 차도 기준 미만인 쌍"**으로 고친다(같은 종족 보스-일반 0.70·인접 진화 0.92 기준은 유지). 비행 그림자(`EnemyLayer.ts` `flyerShadow`)에는 절제된 1px 카본/틸 이중 테두리를 더해 지상 유닛과 고도를 즉각 구분한다.

---

## 3. G4 통과 여부에 대한 두 비평가의 결론

### 비평가 A (아트 디렉터) 결론: **조건부 반려 (전면 재작업 불필요, 집중 보정 후 재검수)**
- 5종족 100개체의 전반적 화풍 일관성, 무광 6색 팔레트 절제, 피·공포·치비 배제 수준은 1·2차 시안 대비 크게 올라와 실제 상용 게임 수준에 근접했다. 특히 기계 특수/보스, 바위 질주, 벌레 광물판·중장갑, 인간 공성 계통은 그대로 써도 손색이 없다.
- 그러나 **실전장 캡처에서 드러난 사지 절단(16개체)·머리 실종(7개체)·무기 누락(7개체)**은 플레이 품질을 크게 깎는 명백한 공정 결함이고, **`stone-boss-t1`·`machine-armored-t2`·`stone-boss-t3`·`stone-special-t4`·`elf-special-t3`·`insect-boss-t1` 6개체**는 진화·종족·보스 위계를 깨뜨려 재작화가 필요하다. 이 6개체 재작화와 리그·대비 보정을 마치면 G4 아트 기준을 충분히 통과한다.

### 비평가 B (교사·학생 플레이어) 결론: **조건부 반려 (크기·대비·리그 수정 필수)**
- 지금 상태의 W15·W20 전장은 **몬스터가 길과 빈 설치 칸을 덮을 만큼 커서** 교실 프로젝터나 크롬북에서 경로와 방어 배치를 한눈에 읽기 어렵다. 또한 **엘프(지형 14/20 미달)·기계(길 17/20 미달)·바위(길 15/20 미달)**의 저대비 개체들은 밝은 교실 프로젝터에서 회색·어두운 바탕에 묻히기 쉽고, `stone-infantry-t4`·`stone-armored-t3`가 보스 못지않게 커서 "지금 가장 위험한 적이 누구인가"가 멀리서 바로 읽히지 않는다.
- **전체 스케일 25~30% 축소 + 보스 발밑 1px 앰버 표식 + 저대비 명부/림 보정 + 머리·사지 이탈 복구**를 적용하고, **타워가 실제 배치된 W15·W20 캡처**로 가림 여부를 확인하면 G4 통과에 동의한다.

### G4 재검수 통과 최소 조건
1. **도구 수정 완료**: P0-1(사지 절단·이탈 16개체), P0-2(머리 가림 7개체), P0-3(전장 스케일 축소 및 설치 칸 침범 해소), P0-6(저대비 명도 보정 — 지형·길 대비 중앙값 1.5 이상 회복), P1-1(무기·방패 7개체 복원).
2. **필수 재작화 완료 (6개체)**: `stone-boss-t1`, `machine-armored-t2`, `stone-boss-t3`, `stone-special-t4`, `elf-special-t3`, `insect-boss-t1` (재작화 후 `silhouettes.json` `bossVsRegular` 0건 실패 확인).
3. **확인용 캡처 추가**: 타워 배치 상태 W15·W20 전장 캡처 1세트 + 수정된 보스·사지 복구 개체 근접 확인.

### 미확인 항목 (이번 자료에서 확인 불가)
- **타워가 실제 배치된 상태에서의 타워·포신 가림 정도**: `battle-walk.webp`·`battle-w15-walk.webp`에 배치된 타워가 없고 빈 육각 설치 칸만 표시돼 있어, 빈 칸 침범만 확인했고 타워 본체와의 실제 겹침은 **미확인**.
- **W15·W20 외 보스 18종 및 T1 개체군의 실전장 보행 상태**: 전장 캡처에 등장한 보스는 `insect-boss-t3`(W15)·`insect-boss-t4`(W20) 2종뿐이며, 나머지 보스 18종(기계·바위·인간·엘프 보스 16종 + `insect-boss-t1/t2`)과 T1 개체의 실전장 보행 동작은 **미확인**(32px 정지 띠와 파츠 한눈판으로만 검토).
- **피격(`hit`)·쓰러짐(`fall`)·보스 기술(`boss-skill`) 동작 프레임**: `battle-report.json`·`battle-w15-report.json`의 트랙 실행 기록만 존재하고 장면 캡처가 없어 시각 품질은 **미확인**.
- **체력 막대·정예 배지·보스 기믹 표시 결합 시 혼잡도**: 캡처가 전원 만피·비정예·기믹 미활성 상태라 UI 표식 중첩 시 판독성은 **미확인**.
- **실제 교실 프로젝터 및 학교 크롬북(1366×768) 실기기 출력**: `silhouettes.json` 대비 수치와 1440×900 캡처·32px 띠를 근거로 판정했으며 실기기 확인은 **미확인**(G5에서 검증 필요).

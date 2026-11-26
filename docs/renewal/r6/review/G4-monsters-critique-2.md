# R6 G4 몬스터 100개체 2차 비평 검수 보고서

- 검수 일시: 2026-11-26
- 검수 기준 커밋: `9607521e` (1차 비평 `67b5ac61` 이후 밀집도·Y정렬 `e706bda5`·`a1deed0d`, 리그 보정 `2b3dec34`~`bd7e6fae`, 재작화 9개체 `b743d190`~`2819d693`·`0a046173`, 33자세 100/100 접합 `7b6f7769`, 계통 단조 배율 `405c4040`, 원색 복원 + 바깥 1px 은회 테두리·그림자 `9607521e` 반영 상태)
- 검수 자료:
  - 최신 전장·확대·보정 캡처: [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp), [contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp), [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp), [g4-rig-fix-walk.webp](../tech/monsters/g4-rig-fix-walk.webp), [density-w5-after.webp](../tech/monsters/density-w5-after.webp), [density-w15-after.webp](../tech/monsters/density-w15-after.webp), [density-w20-after.webp](../tech/monsters/density-w20-after.webp)
  - 32px 판독 띠·종족 간 비교·자동 수치: `docs/renewal/r6/tech/monsters/{machine,stone,human,elf,insect}-32px.webp`, [cross-species-worst.webp](../tech/monsters/cross-species-worst.webp), [silhouettes.json](../tech/monsters/silhouettes.json), [density-after.json](../tech/monsters/density-after.json)
  - 원화 한눈판·공정 기록: `docs/renewal/r6/bible/sheets/monsters-{machine,stone,human,elf,insect}-parts-all.webp`, [monster-pipeline.md](../tech/monster-pipeline.md)(G4 절), [g4-rig-fix.md](../tech/monsters/g4-rig-fix.md), [G4-monsters-notes.md](./G4-monsters-notes.md), 각 종족 `asset-source/r6/monsters/*/REDO.md`
- 기준: [PRD-r6.md](../PRD-r6.md)(§4 · §8), R04 화풍([concept.md](../round3/concepts/R04/concept.md), [a-battle.webp](../round3/concepts/R04/a-battle.webp), [c-enemies.webp](../round3/concepts/R04/c-enemies.webp)), 1차 비평([G4-monsters-critique.md](./G4-monsters-critique.md))
- 비평가 구성: **비평가 A(아트 디렉터)** · **비평가 B(교사·학생 플레이어)**

> **요약 판정: G4 조건부 통과 (전면 재비평 불필요 — 진행 중인 `human-boss-t1` 중립 문장 교체 + 최소 도구 보정 2건 완료 시 G4 최종 마감)**  
> 1차 비평의 14개 문제 중 **10건 해결 · 4건 부분 해결 · 0건 미해결**로 핵심 차단 요인(사지 절단, 머리 실종, 무기 누락, 보스·일반 중복, 벌레 혼동, 원색 훼손 없는 바닥 분리)이 모두 크게 정리됐다. 100/100 전용 스킨·조립 IoU ≥ 0.70·33자세 접합 미달 0건·같은 종족 보스-일반 미달 0건·6배 감속 59.61fps를 달성했고, 바깥 1px 은회 테두리는 종족 고유색을 지키면서 어두운 개체 판독성을 눈에 띄게 끌어올렸다. 남은 필수 차단 요인은 공립학교 기준에 따른 **`human-boss-t1` 십자 문장 교체(진행 중)**와, **이미 타워가 놓인 칸까지 덮는 1px 육각 윤곽 정리·최신 밀집도 재촬영**뿐이다.

---

## 1. 1차 비평 14개 문제별 처리 상태

- 집계: **해결 10건 / 부분 해결 4건 / 미해결 0건** (이 중 #12의 `human-boss-t1` 문장 교체 1건 **진행 중**)

| # | 1차 문제 (우선순위) | 상태 | 시각·수치 근거 |
|---:|---|---|---|
| 1 | 전장 보행 중 사지 절단·파츠 이탈·관절 단면 노출 16개체 (P0) | **해결** | [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)·[contrast-zoom.webp](../tech/monsters/contrast-zoom.webp)·[g4-rig-fix-walk.webp](../tech/monsters/g4-rig-fix-walk.webp) 하단에서 `elf-armored-t2~t4`, `elf-infantry-t2/t4`, `stone-infantry-t2`, `human-infantry-t4`(부유 손 해소), `machine-runner-t2/t3`, `machine-infantry-t3`, `machine-armored-t2`(재작화), `insect-armored-t3/t4`, `insect-boss-t3`(부유 앞발톱 복구), `insect-boss-t4`(관절 단면 해소)가 모두 온전하게 접합됨. [insect-32px.webp](../tech/monsters/insect-32px.webp) 5행 T1에서 `insect-boss-t1` 발 조각 부유 소멸(전장 보행은 미확인). [g4-rig-fix.md](../tech/monsters/g4-rig-fix.md) 기준 33자세 접합 미달 61→0/100개체. |
| 2 | `armor` 슬롯이 `head`를 가려 머리 실종·빈 목구멍 노출 7개체 (P0) | **부분 해결** | [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)·[g4-rig-fix-walk.webp](../tech/monsters/g4-rig-fix-walk.webp) 하단·각 32px 띠에서 `insect-infantry-t2/t3`, `insect-boss-t3`, `machine-infantry-t3`, `human-armored-t2/t3` 6개체는 머리가 갑각 위로 선명하게 복원됨([g4-rig-fix.md](../tech/monsters/g4-rig-fix.md) 노출률 100%). 다만 **`insect-infantry-t4`**는 슬롯은 앞으로 올라왔으나 머리 파츠가 어둡고 눈 포인트가 없어 [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone A 하단·[cross-species-worst.webp](../tech/monsters/cross-species-worst.webp) #01/#04·[insect-32px.webp](../tech/monsters/insect-32px.webp) 1행 T4에서 여전히 앰버 V자 칼라 위 어두운 구멍처럼 읽힘. |
| 3 | W15·W20 과대 스케일 및 길 이탈·빈 타워 설치 칸 침범 (P0) | **부분 해결** | [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)·[density-w5-after.webp](../tech/monsters/density-w5-after.webp)·[density-w15-after.webp](../tech/monsters/density-w15-after.webp)·[density-w20-after.webp](../tech/monsters/density-w20-after.webp)에서 높이 압축(상한 일반 54px·보스 95px)과 Y순 정렬로 타워 가림이 W15 `68.97%→6.65%`, W20 `36.81%→21.28%`로 크게 줄었고 보스 상시 44px 체력 막대·앰버 삼각형으로 위계가 선명해짐. 다만 [density-after.json](../tech/monsters/density-after.json) 기준 빈 설치 칸 면 가림이 여전히 W5 `83.16%`·W15 `66.35%`·W20 `76.96%`이고, 보완용 1px 윤곽이 몬스터·타워 위를 가로지르며, 밀집도 캡처 자체가 최신 `9607521e` 이전(`e5546f7a`) 상태임. |
| 4 | `stone-boss-t1` 보스-일반 실루엣 중복 6건 탈락 (P0) | **해결** | [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 5행 1열·[stone-32px.webp](../tech/monsters/stone-32px.webp) 5행 T1에서 등 위 바위 아치·거대 망치·앰버 바이저의 전용 보스 실루엣으로 재작화 완료. [silhouettes.json](../tech/monsters/silhouettes.json) `bossVsRegular` 최대 IoU `0.750→0.615`, 전 종족 보스-일반 탈락 **0건**(신형 전장 보행은 미확인). |
| 5 | `machine-armored-t2` 벌레 종족 혼동 및 중장갑 진화 단절 (P0) | **해결** | [monsters-machine-parts-all.webp](../bible/sheets/monsters-machine-parts-all.webp) 3행 2열·[machine-32px.webp](../tech/monsters/machine-32px.webp) 3행 T2·[contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)(3기 출현)에서 45° 모따기 앰버 줄무늬 방패 보행기로 재작화돼 T1→T4 계통이 자연스럽게 이어지고 벌레 혼동이 완전히 사라짐. [cross-species-worst.webp](../tech/monsters/cross-species-worst.webp) 상위 20쌍에서도 제외됨. |
| 6 | 엘프·기계·바위·벌레 저대비 묻힘 및 엘프 질주 명도 역전 (P0) | **부분 해결** | `9607521e` 바깥 1px `#B8C0C8` 은회 테두리로 고유색(내부 ΔE76 ≤ 2.68)을 지키면서 지형 중앙값 `1.656→2.056`(미달 26→4/100), 길 중앙값 `1.438→1.522`(미달 68→44/100)로 개선. [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) 좌(전)↔우(후)에서 `elf-runner-t3`·`elf-infantry-t4`·`insect-armored-t4`의 윤곽 분리가 뚜렷함. 다만 [elf-32px.webp](../tech/monsters/elf-32px.webp) 2행의 T1·T2(은백색)→T3·T4(흑표범) 명도 역전이 그대로고, 지형 미달 4개체(`elf-special-t1`·`insect-armored-t1`·`elf-armored-t3`·`elf-runner-t3`)와 [insect-32px.webp](../tech/monsters/insect-32px.webp) 4행 T1(`insect-special-t1`)의 납작함·저대비가 잔존함. |
| 7 | 리깅 조립 시 무기·방패 누락 및 위치 어긋남 7개체 (P1) | **해결** | [contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)(좌상 `human-runner-t3` 깃발창, 우하 `elf-armored-t4` 마름모 방패, 상·하 `stone-armored-t3` 어깨 성곽 밀착), [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)(좌상 `human-infantry-t3` 미늘창, 좌하 `human-infantry-t2` 장창·`elf-armored-t2` 대형 방패), [g4-rig-fix-walk.webp](../tech/monsters/g4-rig-fix-walk.webp) 하단·[stone-32px.webp](../tech/monsters/stone-32px.webp) 3행 T4(`stone-armored-t4` 왼쪽 방패 복원)에서 7개체 모두 복원 확인. |
| 8 | `stone-boss-t3`와 `stone-infantry-t4` 외형 중복 (P1) | **해결** | [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 5행 3열·[stone-32px.webp](../tech/monsters/stone-32px.webp) 5행 T3·[cross-species-worst.webp](../tech/monsters/cross-species-worst.webp) #05에서 거대 굽은 어깨·분화구 가슴·비대칭 강타 팔을 가진 묵직한 보스로 재작화돼 `stone-infantry-t4`(1행 T4)와 쌍둥이 혼동 완전 해소(`silhouettes.json` 쌍 IoU `0.642`; 전장 보행은 미확인). |
| 9 | `stone-special-t4` 진화 퇴행 (P1) | **해결** | [monsters-stone-parts-all.webp](../bible/sheets/monsters-stone-parts-all.webp) 4행 4열·[stone-32px.webp](../tech/monsters/stone-32px.webp) 4행 T4에서 계단식 원형 제단·중앙 대형 수정탑·외곽 바위 고리·위성 수정 3기로 재작화돼 T3 피라미드를 분명히 뛰어넘는 최종형 확보(전장 보행은 미확인). |
| 10 | `elf-special-t3` 번잡한 철사 뭉치화 · 선택 `t4` 가면화 (P1) | **해결** | [monsters-elf-parts-all.webp](../bible/sheets/monsters-elf-parts-all.webp) 4행 3~4열·[elf-32px.webp](../tech/monsters/elf-32px.webp) 4행 T3~T4·[contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone A 우하단에서 `elf-special-t3`가 깔끔한 틸 잎날개 + 기하학 바람 고리 2줄로 정돈됐고 `elf-special-t4`도 가면 인상을 벗고 나무 왕관+다면체 수정핵으로 정리됨(`t3` W20 전장 우수, `t4` 전장 보행은 미확인). |
| 11 | `insect-boss-t1` 빈약한 인간형 여왕벌 (P1) | **해결** | [monsters-insect-parts-all.webp](../bible/sheets/monsters-insect-parts-all.webp) 5행 1열·[insect-32px.webp](../tech/monsters/insect-32px.webp) 5행 T1에서 유치한 왕관을 제거하고 넓은 날개·굵은 앰버 줄무늬 복부·틸 겹눈을 갖춘 거대 장갑 여왕말벌로 재작화(`bossVsRegular` 최대 IoU `0.551`; W5 전장 보행은 미확인). |
| 12 | `human-boss-t1`·`boss-t4` 일반 기사 계통과의 유사성 (P2) | **부분 해결 *(진행 중)*** | [monsters-human-parts-all.webp](../bible/sheets/monsters-human-parts-all.webp) 5행 1·4열과 [human-32px.webp](../tech/monsters/human-32px.webp) 5행 T1·T4에서 `human-boss-t1`(넓은 지휘 망토·양손 망치, 최대 IoU `0.622`)과 `human-boss-t4`(등 날개 깃발·대형 양손 도끼·독수리 방패 제거, `armored-t3` IoU `0.606`) 모두 보스 실루엣 차별화는 완료. 다만 재작화된 **`human-boss-t1`의 앰버 십자 문장**을 중립 문장으로 교체하는 작업이 **진행 중**(전장 보행은 미확인). |
| 13 | 원화 파츠 흰 배경 잔여 8개체 및 `machine-runner-t1` 32px 다리 약화 (P2) | **해결** | [g4-rig-fix.md](../tech/monsters/g4-rig-fix.md) 게시 아틀라스 검사 0건, [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)·각 32px 띠에서 8개체 모두 흰 잔여 미관찰(참고: `monsters-*-parts-all.webp` 원화 한눈판 이미지 자체는 전처리 전 원본을 띄워 일부 흰 틈새가 보임). [machine-32px.webp](../tech/monsters/machine-32px.webp) 2행 T1에서 바깥 1px 은회 테두리 덕분에 `machine-runner-t1`의 가는 4개 다리가 32px에서도 분명히 읽힘(선택 권고였던 T1 4족 차체 개편은 미실시). |
| 14 | 종족 간 자동 실루엣 판정(0.55) 현실화 및 비행 고도 표시 보강 (P2) | **해결** | [silhouettes.json](../tech/monsters/silhouettes.json) `crossSpeciesColor`에 길 색 위 CIE ΔE76 ≥ 15 판독을 추가해 717쌍을 A(색 구분) 620쌍·B(색도 미달) 97쌍으로 분류했고, [cross-species-worst.webp](../tech/monsters/cross-species-worst.webp) 상위 20쌍도 실루엣 세부와 종족 모티프로 구별됨. [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)에서 `elf-special-*`·`machine-special-*`·`insect-runner-*`의 부유 고도와 R04 1px 카본/틸 이중 테두리 그림자(`flyerShadow`)가 적용돼 비행체 인지가 즉각 이뤄짐. |

---

## 2. 새로 생긴 문제 및 보정 부작용 (7건)

보정 과정에서 생긴 부작용과 이번 검수에서 확인된 새 문제를 심각도 순으로 적는다.

1. **[필수 · 진행 중 · 다시 그림] `human-boss-t1`의 앰버 십자 문장 (공립학교 종교 상징)**
   - **근거**: [monsters-human-parts-all.webp](../bible/sheets/monsters-human-parts-all.webp) 5행 1열(`boss-t1/T1` `mark` 슬롯과 좌측 조립도), [human-32px.webp](../tech/monsters/human-32px.webp) 5행 T1.
   - **평가(비평가 B)**: 12번 재작화 과정에서 십자군형 앰버 십자 문장이 새로 들어갔다. 공립학교 교육용 게임 기준상 종교 상징을 배제해야 하며, 현재 다른 에이전트 칸에서 중립 문장으로 재작화 **진행 중**이다.

2. **[필수 · 도구로 고침] 위층 1px 설치 칸 윤곽이 타워 기단과 몬스터 몸체를 가로지름 (밀집도 보정 부작용)**
   - **근거**: [density-w5-after.webp](../tech/monsters/density-w5-after.webp)·[density-w15-after.webp](../tech/monsters/density-w15-after.webp)·[density-w20-after.webp](../tech/monsters/density-w20-after.webp)(중앙 좌측 곡사포·우측 레일포탑 기단 위에 밝은 1px 육각선이 그대로 겹쳐 그려짐), [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone B(`stone-armored-t3` 방패와 `machine-armored-t3` 등을 1px 육각선이 절단), Zone A(`machine-infantry-t3` 상체 관통).
   - **평가(비평가 A·B)**: 가려진 빈 칸을 알리려는 취지는 좋으나, **이미 타워가 설치된 칸까지 위층 윤곽이 남고**, 빈 칸 윤곽도 몬스터 방패·갑주 위에 밝은 선으로 겹쳐 전장이 어수선해 보인다. 타워가 설치된 칸에서는 위층 윤곽을 끄고, 빈 칸도 적에게 실제로 50% 이상 가려졌을 때(또는 타워 설치 선택 중일 때)만 옅은 불투명도(`0.35~0.45`)나 점선으로 제한해야 한다.

3. **[필수 · 도구로 고침] 최신 `9607521e` 기준 타워 배치 밀집도 캡처 미갱신 및 기록 수치 불일치**
   - **근거**: [density-w5-after.webp](../tech/monsters/density-w5-after.webp)(구형 `stone-boss-t1`·구형 갑충 `machine-armored-t2`·보정 전 `insect-infantry-t1` 노출), [density-w15-after.webp](../tech/monsters/density-w15-after.webp)·[density-w20-after.webp](../tech/monsters/density-w20-after.webp)(1px 은회 테두리 및 `405c4040` 단조 크기 미반영), [G4-monsters-notes.md](./G4-monsters-notes.md) 40행(반려된 `0413a103` 수치 `지형 3.224 / 길 1.640 · 미달 0/19 · A 662 / B 55`가 남아 [silhouettes.json](../tech/monsters/silhouettes.json)·[monster-pipeline.md](../tech/monster-pipeline.md)의 최신 수치 `지형 2.056 / 길 1.522 · 미달 4/44 · A 620 / B 97`과 충돌).
   - **평가(비평가 B)**: 최신 에셋·1px 테두리·타워가 한 화면에 놓였을 때의 최종 가독성과 신형 W5 `stone-boss-t1` 실전 위압감을 확인하려면 최신 HEAD로 `--density` 재촬영 1회와 메모 수치 동기화가 필요하다.

4. **[권장 · 도구로 고침] 비행체 틸 이중 테두리 그림자(`flyerShadow`)의 지상 유닛 발밑 오인 (비행 보정 부작용)**
   - **근거**: [contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)·[contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone A(`insect-boss-t4` 뒷다리 아래 틸 고리 = 보스 뒤에 가려진 `elf-special-t3`의 그림자), [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)(`insect-boss-t3` 앞발 옆 `insect-runner-t2` 그림자, 중앙 `machine-special-t2` 그림자가 길 위 `<` 진행 화살표와 충돌).
   - **평가(비평가 A·B)**: 비행 구분 자체는 크게 좋아졌으나, 부유 거리(`0.20~0.28칸`)가 길고 틸 선이 또렷해 비행체가 대형 유닛 뒤에 가려지면 틸 고리만 바닥에 남아 **보스 발밑 장판이나 특수 표식**처럼 오인된다. 부유 오프셋을 `0.16~0.22칸`으로 소폭 줄이고 틸 선 불투명도를 약간 낮추면 본체와 그림자의 연결감이 개선된다.

5. **[권장 · 도구로 고침] `human-armored-t3` 보행 중 방패 가림 및 `stone-boss-t3` 목·가슴 미세 어긋남 (리그·재작화 미세 부작용)**
   - **근거**: [g4-rig-fix-walk.webp](../tech/monsters/g4-rig-fix-walk.webp) 하단 중앙 좌측(`human-armored-t3`의 은회 팔·상체가 보행 중 앰버 독수리 방패 상반부를 가려 방패가 잘린 듯 보임 — [human-32px.webp](../tech/monsters/human-32px.webp) 3행 T3 및 [density-w20-after.webp](../tech/monsters/density-w20-after.webp) 우하단에서는 온전하므로 보행 프레임 슬롯·팔 겹침), [cross-species-worst.webp](../tech/monsters/cross-species-worst.webp) #05·#10·#16·#17(128px `stone-boss-t3`에서 머리가 몸통 U자 목 홈보다 우상단으로 치우쳐 가슴 중앙에 어두운 반원 틈이 노출됨).
   - **평가(비평가 A)**: 치명적 절단은 아니나 보스·중장갑 완성도를 깎는 작은 티다. 슬롯 순서·좌표 수 px 조정으로 간단히 정리된다.

6. **[경미 · 관찰] 바깥 1px 은회(`#B8C0C8`) 테두리의 고명도 유닛 이중선감 (대비 보정 부작용 점검)**
   - **근거**: [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone B 우측(`human-infantry-t3/t4`, `human-armored-t4`의 밝은 은회 갑주 바깥으로 `은회 → 검은 선화 → 은회 1px` 이중 띠가 약하게 형성됨), Zone A 우측(`elf-special-t3` 가는 바람 고리 바깥쪽이 약간 두꺼워짐).
   - **평가(비평가 A·B)**: 전체 화면([contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp)·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp)) 기준으로는 **번잡하지 않고 어두운 개체 판독 이득이 압도적으로 크다**. 압축 배율에 따른 **보스 위압감 저하도 관찰되지 않는다**(W5 `1.89배`·W15 `1.96배`·W20 `1.98배`, 상시 44px 체력 막대+앰버 삼각형으로 보스 위계가 명확). 다만 `human`처럼 지형 대비가 이미 2.5배를 넘는 밝은 개체는 바깥 테두리 불투명도를 살짝 낮추면 스티커 느낌이 줄어들 여지가 있다.

7. **[경미 · 관찰] 발밑 Y순 정렬 + 배율 압축 이후 대형 타워 뒤 몬스터 일시 가림 증가**
   - **근거**: [density-w15-after.webp](../tech/monsters/density-w15-after.webp) 우하단 흰 대형 포탑 뒤(`stone-infantry-t2` `74.05%`·`stone-armored-t3` `63.96%`·`machine-armored-t3` `58.57%` 가림), [density-w20-after.webp](../tech/monsters/density-w20-after.webp) 중앙 우측 대형 포탑 뒤(`stone-runner-t3` `52.37%` 가림) — [density-after.json](../tech/monsters/density-after.json).
   - **평가(비평가 B)**: 타워가 적에게 가려지는 문제(최대 21.28%)를 푼 자연스러운 맞바꿈이며 체력 막대가 위층에 그려져 위치 추적은 가능하다. 다만 타워 뒤에 적이 반 이상 숨는 순간이 늘어 G5 실전 플레이 시 체감 답답함 여부를 한 번 확인할 만하다.

---

## 3. 길 대비 미달 44개체(REDO.md `32px 재작화`) 실제 시인성 선별

바깥 1px 은회 테두리(`9607521e`)가 적용된 실제 전장 캡처([contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp), [contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp), [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp))와 5종족 32px 판독 띠(`*-32px.webp`)를 전수 대조한 결과, **길 대비 수치 1.5배 미만 44개체 대부분(42개체)은 실제 화면에서 재작화가 필요 없다.** 중앙값 미달의 주원인은 짙은 건메탈·현무암·말 몸통·올리브 방패의 내부 휘도가 길(`#4A5563`)과 가깝기 때문이며, 실제 눈에는 **바깥 1px 은회 테두리 + 검은 내부 선화 + 색상 대비(올리브·갈색·앰버 vs 청회색 길) + 방패·수정·깃털·체력 막대** 덕분에 선명하게 구분된다(예: 수치 최저인 `elf-armored-t2` `1.307`은 [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp) 좌하단에서 밝은 녹·앰버 대형 방패로 매우 또렷하게 보이고, `human-runner-t3` `1.448`도 [contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp) 좌상단에서 가장 잘 읽히는 축이다).

### ① 길 대비 미달 44개체 중 실제 재작화 필요 선별 (필수 권장 1 + 선택 1)

| 구분 | 개체 id | 수치 (길 / 지형) | 실제 캡처 확인 근거 및 사유 |
|---|---|---:|---|
| **재작화 권장 (1순위)** | `insect-special-t1` | **1.360** / 1.782 | [insect-32px.webp](../tech/monsters/insect-32px.webp) 4행 T1(전장 보행 미확인). 단순히 색이 어두운 수준을 넘어 **32px 셀 바닥 1/3에 납작하게 눌린 어두운 원반 형태**라 바깥 1px 테두리를 둘러도 작은 검은 얼룩·파편처럼 읽힌다. 높이를 키우고 등딱지 틸·앰버 포인트 면적을 넓혀야 한다. |
| **선택 보강** | `stone-runner-t1` | **1.434** / 2.079 | [stone-32px.webp](../tech/monsters/stone-32px.webp) 2행 T1(전장 보행 미확인). 앰버·틸 포인트가 거의 없는 단색 회색 저신장 4족이라 길 색(`#4A5563`)과 색상·명도가 동시에 겹친다. 바깥 1px 테두리로 윤곽은 보이나 교실 프로젝터에서 작은 회색 돌덩이로 묻힐 여지가 있다. |

- **나머지 42개체(재작화 불필요)**:
  - 기계 13개체(`machine-armored-t2~t4`, `machine-special-t1~t4`, `machine-boss-t2~t4`, `machine-runner-t2/t4`, `machine-infantry-t2`): 1px 은회 테두리 + 45° 선화 + 틸/앰버 포인트로 W15·W20·32px 모두 명확.
  - 바위 11개체(`stone-armored-t1~t4`, `stone-infantry-t1~t4`, `stone-runner-t2`, `stone-boss-t2/t3`): `armored-t3`·`infantry-t2~t4`는 W15·W20에서 선명, 나머지 7개체도 32px에서 큰 체급·방패·수정/용암 포인트로 판독 양호.
  - 인간 6개체(`human-runner-t1~t4`, `human-boss-t2/t3`): 은회 판금 기수·앰버 망토/깃발 덕분에 길 위 판독성 최상급.
  - 엘프 4개체(`elf-armored-t2/t4`, `elf-boss-t2/t4`): 대형 녹·틸·앰버 방패와 갈색 나무 색상 대비로 길 위 판독 양호(`elf-boss-t2/t4`는 32px 기준 확인, 전장 보행 미확인).
  - 벌레 8개체(`insect-infantry-t1~t3`, `insect-runner-t1`, `insect-armored-t3`, `insect-special-t2/t4`, `insect-boss-t4`): 틸 눈·날개·앰버 줄무늬·수정판으로 W15·W20·32px 모두 판독 가능(`insect-special-t2`는 다소 납작하나 날개 폭이 넓어 `t1`보다 훨씬 양호).

### ② 부기 — 같은 `REDO.md` `32px 재작화`의 지형 대비 미달 4개체 중 실전 저시인성 (2개체)

길 대비 44개체에는 속하지 않지만 `elf/REDO.md`·`insect/REDO.md`의 `## 32px 재작화`에 함께 올라 있는 지형 미달 4개체 중 아래 2개체는 실제 시인성 취약이 확인돼 함께 적는다.

- **`elf-armored-t3`** (지형 **1.467** / 길 1.625): [contrast-w15-after.webp](../tech/monsters/contrast-w15-after.webp) 우상단·[contrast-w20-after.webp](../tech/monsters/contrast-w20-after.webp) 우측 끝·[contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone B 우측 끝에서 **실제 전장 시인성이 100개체 중 가장 약하다.** `elf-armored-t1/t2/t4`가 모두 큼직한 앰버·틸 방패를 든 것과 달리 T3만 방패 없이 어두운 갑주뿐이라 길 가장자리 어두운 음영에 쉽게 묻힌다(재작화 시 방패 추가·명부 보강으로 계통 일관성과 시인성을 동시 해결 가능).
- **`elf-special-t1`** (지형 **1.377** / 길 1.695): [elf-32px.webp](../tech/monsters/elf-32px.webp) 4행 T1(전장 보행 미확인). 비행 고도(`0.28칸`)로 상단 어두운 지형(`#1D242C`)과 겹칠 때 어두운 잎 뭉치 내부가 묻히고 작은 틸 얼굴 점만 남는다.
- *(나머지 2개체: `elf-runner-t3` 지형 `1.486`은 [contrast-zoom.webp](../tech/monsters/contrast-zoom.webp) Zone B 중앙에서 1px 테두리+틸 문양으로 판독 가능, `insect-armored-t1` 지형 `1.399`는 [insect-32px.webp](../tech/monsters/insect-32px.webp) 3행 T1에서 굵은 앰버 등딱지 테두리로 판독 가능하여 재작화 불필요).*

---

## 4. 종족별 판정 및 G4 통과 여부 결론

### 종족별 판정

| 종족 | 1차 판정 | 2차 판정 | 판정 근거 |
|---|---|---|---|
| **기계 군단 (`machine`)** | 조건부 | **통과** | `machine-armored-t2` 재작화로 종족 혼동·진화 단절 완전 해소. 33자세 접합 20/20·지형 미달 0/20·흰 잔여 0건·W15/W20 실전 판독 최상급. 길 미달 13개체 모두 실화면 판독 양호. |
| **바위 거인 (`stone`)** | 조건부 | **통과** | 필수 재작화 3건(`boss-t1`·`boss-t3`·`special-t4`)과 `armored-t4` 쌍방패·`infantry-t2` 양팔 복구로 보스 중복 0건·진화 퇴행 해소·접합 20/20·지형 미달 0/20 달성(`boss-t3` 128px 목 정렬·`runner-t1` 포인트는 경미 선택). |
| **철갑 인간 (`human`)** | 조건부 | **조건부 통과** *(진행 중 1건)* | 무기 3종·손 분리·투구 가림·보스 T1/T4 실루엣 차별화 모두 완료, 전장 판독성 최고. 단, 공립학교 기준상 **`human-boss-t1` 십자 문장 → 중립 문장 교체(진행 중)** 완료가 필수(`armored-t3` 보행 방패 겹침은 미세 도구 보정). |
| **숲 엘프 (`elf`)** | 반려 | **조건부 통과** | 1차 반려 사유였던 사지·방패 절단, `special-t3` 철사 뭉치·`t4` 가면, 지형 대량 묻힘(14→3/20)이 모두 크게 해결돼 전장 품질이 출하권에 진입. 다만 W15·W20 실전 시인성이 가장 약한 `elf-armored-t3`와 지형 미달 `elf-special-t1` 보강을 권장. |
| **군체 벌레 (`insect`)** | 반려 | **조건부 통과** | 1차 반려 사유였던 `boss-t3` 머리 이탈·부유 발톱, `boss-t4` 단면, `infantry-t2/t3` 머리 실종, `boss-t1` 왕관 인간형이 모두 해결돼 출하권에 진입. 32px 납작 저대비 `insect-special-t1`과 `insect-infantry-t4` 어두운 머리 시인성 보강을 권장. |

### 두 비평가 결론

- **비평가 A (아트 디렉터) — 조건부 통과**: 1차 비평에서 지적한 공정 결함(사지 절단·머리 가림·무기 누락)과 핵심 6개체(+선택 3개체) 재작화가 기대 이상으로 반영됐고, 아틀라스 명도 왜곡안을 버리고 바깥 1px 은회 테두리로 원색을 지킨 판단이 R04 6색 무광 정체성을 살렸다. 5종족 100개체가 실제 상용 게임 수준에 도달했으므로 추가 전면 검수는 불필요하다. 진행 중인 `human-boss-t1` 중립 문장 교체와 타워 칸 위 1px 윤곽 제거만 마치면 G4 아트 관문을 통과한다.
- **비평가 B (교사·학생 플레이어) — 조건부 통과**: W15·W20 실전장 캡처에서 적 크기·Y정렬·보스 체력 막대·비행 이중 테두리 그림자·1px 은회 테두리가 맞물려 1차 대비 전장 판독성이 극적으로 나아졌다. 보스 위압감도 압축 후 그대로 살아 있다. 공립학교 게임 원칙상 `human-boss-t1` 십자 문장 제거는 필수이고, 타워 기단 위 1px 윤곽 정리와 최신 빌드 기준 타워 배치 밀집도 1회 재촬영만 확인하면 G5(실기기·프로젝터·밸런스 통합)로 넘어가도 좋다.

### G4 최종 통과 최소 조건 (다시 그림 vs 도구로 고침)

#### A. G4 마감 필수 최소 조건 (완료 시 3차 비평 없이 G4 통과 확정)
- **다시 그림 (1건 · 진행 중)**
  1. `human-boss-t1`: 방패·망토(`mark`) 십자 문장 → 중립 기하학/방패 문장으로 교체 *(현재 진행 중)*.
- **도구로 고침 (2건)**
  1. **1px 설치 칸 윤곽 정리**: 이미 타워가 설치된 칸에서는 위층 1px 육각 윤곽을 비활성화하고, 빈 칸도 적에게 실제로 가려졌을 때만 옅은 불투명도(`0.35~0.45`) 또는 점선으로 절제.
  2. **최신 빌드 밀집도 재촬영 및 문서 수치 동기화**: `9607521e` 이후(`human-boss-t1` 반영 시 함께) 최신 아틀라스·1px 테두리·타워 배치 상태로 `density-w5/15/20-after.webp` 1회 재촬영 + [G4-monsters-notes.md](./G4-monsters-notes.md) 40행의 구형 `0413a103` 수치를 최신 `silhouettes.json` 수치로 갱신.

#### B. G5 진입 전 권장 마감 (G4 차단 조건 아님 · 단건 보강)
- **다시 그림 (2개체 우선 · 선택 3개체)**
  - 우선: `insect-special-t1` (32px 납작·저대비 해소), `elf-armored-t3` (W15·W20 실전 최약 시인성·방패 추가)
  - 선택: `insect-infantry-t4` (머리에 밝은 틸/앰버 눈 포인트 추가), `elf-special-t1` (어두운 지형 대비 잎 명부 보강), `stone-runner-t1` (소량 틸/앰버 포인트 보강)
- **도구로 고침 (3건)**
  - `flyerShadow` 부유 오프셋(`0.16~0.22칸`)·틸 고리 불투명도 소폭 절제(보스 발밑 장판 오인 방지).
  - `human-armored-t3` 보행 중 방패 가림 슬롯 조정 및 `stone-boss-t3` 머리 좌표 수 px 좌하단 정렬.
  - 지형 대비 2.5배 이상인 고명도 개체(`human` 등)의 바깥 1px 테두리 불투명도 소폭 하향 검토.

---

## 5. 미확인 항목 (이번 자료에서 확인 불가)

- **재작화 9개체 중 7개체의 실전장 보행 모습**: `machine-armored-t2`(W15)·`elf-special-t3`(W20)만 최신 전장 캡처에서 확인했고, `stone-boss-t1`, `stone-boss-t3`, `stone-special-t4`, `elf-special-t4`, `insect-boss-t1`, `human-boss-t1`, `human-boss-t4`는 32px 판독 띠·원화 한눈판·`cross-species-worst.webp`로만 검토했으며 실전장 보행은 **미확인**.
- **`human-boss-t1` 중립 문장 교체 결과**: 타 칸에서 재작화 예정이므로 교체 후 시각 결과는 **미확인(진행 중)**.
- **최신 `9607521e` 상태의 타워 배치 실전장 밀집도**: `density-w5/15/20-after.webp`가 `e5546f7a` 시점 캡처여서 바깥 1px 테두리·재작화 9개체·단조 크기 보정이 모두 적용된 상태의 타워 동시 배치 화면은 **미확인**.
- **W5·W15·W20 미등장 보스 16종 및 T1 개체군(`insect-special-t1`, `elf-special-t1`, `stone-runner-t1` 등)의 실전장 보행**: 32px 정지 띠와 파츠 한눈판으로만 확인했고 전장 보행은 **미확인**.
- **피격(`hit`)·쓰러짐(`fall`)·보스 기술(`boss-skill`) 동작 프레임 및 정예 배지·보스 기믹 결합 시 시인성**: [battle-report.json](../tech/monsters/battle-report.json)·[battle-w15-report.json](../tech/monsters/battle-w15-report.json) 실행 기록만 존재해 시각 품질은 **미확인**([density-w20-after.webp](../tech/monsters/density-w20-after.webp)의 보스 원형 범위 표시 1건만 확인).
- **실제 교실 프로젝터 및 학교 크롬북(1366×768) 실기기 출력**: 캡처와 대비 수치로 판정했으며 실기기 확인은 **미확인**(G5 검증 대상).

# 타워 성장·진화 규격 v1 (R2 엔진 기준)

상태: 총괄 결정 · 수치는 **후보값**이며 밸런스 시뮬레이션으로 확정한다.

## 1. 구조

```
Lv1 ─ Lv2 ─ Lv3   기본형(form: base)          그림 1장. Lv2·3은 코드 장식(깃발·금테)만 더한다
          │ Lv3→4  1차 진화: A 또는 B 선택       그림 2장
Lv4 ─ Lv5 ─ Lv6   1차형(form: A | B)
          │ Lv6→7  2차 진화: 고른 길에서 2갈래    그림 4장 (A→A1|A2, B→B1|B2)
Lv7 ─ Lv8 ─ Lv9   2차형(form: A1 | A2 | B1 | B2)
Lv10 ~            숙련 레벨: 형태는 그대로, 수치만 오른다. 5레벨마다 별 표식 하나
```

- 타워 1종 = 형태 7개(기본 1 + 1차 2 + 2차 4). 그림도 7장이다.
- 진화는 숫자만 바뀌는 게 아니다. 1차형은 공격 방식이 하나 바뀌고, 2차형은 **고유 능력 1개**를 얻는다(카탈로그 [catalog/towers.md](catalog/towers.md)).
- 깃발초소처럼 공격하지 않는 타워도 같은 구조를 쓴다(오라 종류·크기가 형태별로 바뀐다).

## 2. 레벨 상한

- `levels.max`: 정수면 그 레벨이 상한이고, `null`이면 무제한이다. **기본값 `null`**.
- 무제한이어도 비용이 피해보다 빨리 커져 실제로는 스스로 멈춘다. 시뮬레이션 목표는 "20웨이브 판에서 가장 많이 키운 타워가 Lv12~15".
- 안전 정수 범위는 엔진의 기존 검사(RECOVERY_REQUIRED(NUMERIC_LIMIT))가 지킨다. 상한이 없어도 비용 식이 안전 정수를 넘기 전에 골드가 모자라야 한다. 시험으로 Lv200까지 계산해 확인한다.

## 3. 수치 식 (후보)

| 레벨 | 1 | 2 | 3 | **4** | 5 | 6 | **7** | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| 피해 배율 | 1.00 | 1.30 | 1.65 | **2.30** | 2.75 | 3.25 | **4.40** | 5.10 | 5.90 |
| 다음 레벨 비용(기본가 대비) | 0.65 | 1.00 | **1.50** | 1.40 | 1.80 | **2.60** | 2.40 | 3.00 | — |

- 진화 레벨(4·7)은 배율이 크게 뛰는 대신 진화 비용(Lv3→4, Lv6→7)도 크다.
- Lv10부터: 피해 ×`levels.beyond.damageGrowthBP`(후보 11000=1.10배/레벨), 비용 ×`levels.beyond.costGrowthBP`(후보 12200=1.22배/레벨). 비용은 기존 `round5`로 반올림한다.
- 형태별 보정(사거리·간격·대상 수·특수 효과)은 기존 `BranchConfig` 방식처럼 형태 설정에 둔다. 2차형은 1차형 설정을 물려받고 덮어쓴다.
- 판매 환급은 지금처럼 투자 골드의 60%다.

## 4. 데이터 모델

```jsonc
// balance.candidate의 levels
"levels": {
  "max": null,                       // null = 무제한
  "evolveAt": [4, 7],                // 이 레벨로 올라갈 때 형태를 고른다
  "damageMultiplierBP": [10000, 13000, 16500, 23000, 27500, 32500, 44000, 51000, 59000],
  "upgradeCostOfBaseBP": [6500, 10000, 15000, 14000, 18000, 26000, 24000, 30000],
  "beyond": { "damageGrowthBP": 11000, "costGrowthBP": 12200 }
}
// 타워별 형태
"forms": {
  "archer": {
    "A":  { "label": "속사", "summary": "...", "intervalBP": 7000 },
    "B":  { "label": "정찰", "summary": "...", "rangeAddMilli": 600 },
    "A1": { "parent": "A", "label": "...", "summary": "...", "ability": { "kind": "...", ... } },
    "A2": { "parent": "A", ... }, "B1": { "parent": "B", ... }, "B2": { "parent": "B", ... }
  }
}
```

- 기존 `branches`는 `forms.A/B`로 옮긴다(값은 그대로 출발).
- 타워 상태의 `branch: 'A'|'B'|null`은 `form: 'base'|'A'|'B'|'A1'|'A2'|'B1'|'B2'`로 바꾼다.
- `RUN_STATE_VERSION`을 올린다. 이전 버전의 진행 중 판 스냅샷은 **오류 없이** "규칙이 바뀌어 이어갈 수 없어요"로 정리하고, 기록(점수·결과)은 지킨다.

## 5. R1↔R2 API 계약 (UI가 부르는 함수)

R2가 `src/domain/towers.ts`에 제공하고, R1은 이것만 쓴다. 이름을 바꾸려면 두 세션이 총괄을 거쳐 합의한다.

```ts
export type FormId = 'base' | 'A' | 'B' | 'A1' | 'A2' | 'B1' | 'B2';
export function formTier(form: FormId): 0 | 1 | 2;
/** 다음 강화가 진화면 고를 수 있는 형태 목록(2개), 아니면 null. 최대 레벨이면 null. */
export function evolutionChoices(b: Balance, tower: Pick<Tower, 'type' | 'level' | 'form'>): FormId[] | null;
export function formInfo(b: Balance, type: TowerId, form: FormId): { label: string; summary: string; tier: 0 | 1 | 2 };
export function upgradeCost(b: Balance, type: TowerId, level: number): number | null;  // 상한이면 null
export function towerStats(b: Balance, type: TowerId, level: number, form: FormId): TowerStats;
// 명령
{ type: 'upgrade'; towerId: number; form?: FormId }   // 진화 레벨이면 form 필수(FORM_REQUIRED)
```

화면 규칙(R1): 진화 선택 카드는 두 형태의 **그림을 크게** 나란히 보여 주고, 한 줄 설명과 바뀌는 수치 1~2개만 적는다.

## 6. 끝 기준(R2 성장 단계)

1. 위 데이터 모델과 API, 강화·진화 명령, 저장 버전 처리
2. 단위 시험: 진화 레벨에서 form 없으면 거절, 잘못된 부모 거절, Lv200 비용·피해 안전 정수, 상한 설정 동작, 결정론(같은 seed 같은 결과)
3. `tools/balance-sim.mjs`가 새 성장 구조로 돌고, 난이도별 도달 웨이브 중앙값이 현재 기준(쉬움 18, 보통 15, 어려움 14, 크레이지 11)에서 ±2 안. 타워 효율 시뮬레이션에서 한 형태가 압도하지 않음
4. `npm run verify` 통과

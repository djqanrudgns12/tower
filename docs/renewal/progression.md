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
- 무제한이어도 비용이 피해보다 빨리 커져 실제로는 스스로 멈춘다.
- 시뮬레이션 목표의 우선순위(2026-10-31 총괄 결정, R2 실측 반영):
  1. 난이도별 도달 웨이브 중앙값이 기준 ±2 안
  2. 보통 난이도 초보형 한 판 25분 이하(PRD)
  3. 20웨이브 판에서 주력 타워 2~3기가 Lv7 도달(진화가 눈에 보여야 한다)
  4. 가장 많이 키운 타워 Lv10~13(처음 목표 Lv12~15에서 완화. 한 판 골드 약 2,700이 고정이라 3과 함께 채울 수 없다). R2 1단계 실측은 Lv9였고, 1~3을 지키려면 피할 수 없어 받아들였다(`docs/balance/r2-progression-compare.md`).
  5. (2단계 추가) 균형형 80%에서 첫 진화(Lv4)가 보통 난이도 8웨이브 이하. 1단계 실측은 11웨이브라 진화가 너무 늦게 보인다.
- 안전 정수 범위는 엔진의 기존 검사(RECOVERY_REQUIRED(NUMERIC_LIMIT))가 지킨다. 상한이 없어도 비용 식이 안전 정수를 넘기 전에 골드가 모자라야 한다. 시험으로 Lv200까지 계산해 확인한다.

## 3. 수치 식 (계약 `balance.candidate.v0.4.json` levels와 같다)

| 레벨 | 1 | 2 | 3 | **4** | 5 | 6 | **7** | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| 피해 배율 | 1.00 | 1.32 | 1.64 | **2.35** | 2.85 | 3.38 | **4.10** | 4.75 | 5.40 |
| 다음 레벨 비용(기본가 대비) | 0.40 | 0.55 | **0.75** | 1.10 | 1.25 | **1.25** | 2.00 | 2.40 | — |

- R4 B2(`0.9.0-renewal-candidate`, [r4-b2](../balance/r4-b2.md)): 강화 1골드당 피해 증가가 새 설치의 Lv1→6 0.8~1.1배, Lv7→9 0.6~0.9배가 되도록 피해 배율을 올렸다(비용은 R2 값 그대로). 관문 측정 0.81·0.63(목표 하단: 넓게 짓기도 남도록).
- 진화 레벨(4·7)은 배율이 크게 뛰는 대신 진화 비용(Lv3→4, Lv6→7)도 크다.
- Lv10부터: 피해 ×`levels.beyond.damageGrowthBP`(10700=1.07배/레벨), 비용 ×`levels.beyond.costGrowthBP`(11200=1.12배/레벨). 비용은 기존 `round5`로 반올림한다.
- 형태별 보정(사거리·간격·대상 수·특수 효과)과 상성(`strongVs`·`weakVs`)은 형태 설정에 둔다. 2차형은 1차형 설정을 물려받고 덮어쓴다.
- 판매 환급은 지금처럼 투자 골드의 60%다.

## 4. 데이터 모델

```jsonc
// balance.candidate의 levels
"levels": {
  "max": null,                       // null = 무제한
  "evolveAt": [4, 7],                // 이 레벨로 올라갈 때 형태를 고른다
  "damageMultiplierBP": [10000, 13200, 16400, 23500, 28500, 33800, 41000, 47500, 54000],
  "upgradeCostOfBaseBP": [4000, 5500, 7500, 11000, 12500, 12500, 20000, 24000],
  "beyond": { "damageGrowthBP": 10700, "costGrowthBP": 11200 }
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
- `RUN_STATE_VERSION`을 올린다. 판은 메모리에만 있어(2026-11-04 이어하기 없음) 정리할 저장 판은 없다. 이 버전은 개발 전용 QA 로더(`?qaRun=1`)가 다른 버전 상태를 거부하는 데만 쓴다.

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

import { z } from 'zod';

// docs/contracts/balance.candidate.v0.4.json(스키마 0.4, 리뉴얼 성장·진화)의 런타임 계약. 단위는 정수 ms·BP(10000=1.0)·milli.
const int = z.number().int().refine(Number.isSafeInteger, '안전 정수가 아니다');
const nonNeg = int.min(0);
const bp = int.min(0).max(100000);

export const DIFFICULTY_IDS = ['Easy', 'Normal', 'Hard', 'Crazy'] as const;
/** 적 역할(role). 같은 역할은 종족(faction)이 달라도 수치·규칙이 같다(docs/renewal/catalog/monsters.md §1). */
export const ENEMY_KINDS = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm', 'flyer', 'splitter', 'splitling', 'boss'] as const;
/** 웨이브 편성에 쓰는 일반 역할(대장 제외). */
export const REGULAR_KINDS = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm', 'flyer', 'splitter'] as const;
/** 주력 종족의 기본 6역할. 맵마다 해금 순서(campaigns.roleOrder)가 다르다. */
export const BASE_ROLES = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm'] as const;
/** 대장 단계: 1~4단 = 5·10·15·20웨이브 대장. 그림·이름 키는 BOSS_RANKS(boss5~boss20)다. */
export const BOSS_TIERS = [1, 2, 3, 4] as const;
export const BOSS_RANKS = ['boss5', 'boss10', 'boss15', 'boss20'] as const;
/** 종족 팩의 그림·이름 키: 일반 역할 + 대장 단계. 그림 id는 `<artPrefix>.<키>`(예: acorn.runner, river.boss10). */
export const ART_ROLES = [...REGULAR_KINDS, ...BOSS_RANKS] as const;
export const ELITE_IDS = ['armored', 'swift'] as const;
/** 기존 10종 뒤에 리뉴얼 신규 10종(docs/renewal/catalog/towers.md §1). */
export const TOWER_IDS = [
  'archer', 'crossbow', 'cannon', 'mage', 'frost', 'lightning', 'flame', 'spear', 'guardian', 'banner',
  'sling', 'ballista', 'falcon', 'mortar', 'hwacha', 'roller', 'alchemist', 'wind', 'trap', 'bell',
] as const;
/** 1차형(Lv4 진화). 화면의 길 표식(동그라미·마름모)이 이 둘을 쓴다. */
export const BRANCH_IDS = ['A', 'B'] as const;
/** 타워 형태: 기본형 → 1차형(A·B) → 2차형(A1·A2·B1·B2). docs/renewal/progression.md §1. */
export const FORM_IDS = ['base', 'A', 'B', 'A1', 'A2', 'B1', 'B2'] as const;

export type DifficultyId = (typeof DIFFICULTY_IDS)[number];
export type EnemyKind = (typeof ENEMY_KINDS)[number];
export type RegularKind = (typeof REGULAR_KINDS)[number];
export type BaseRole = (typeof BASE_ROLES)[number];
export type BossTier = (typeof BOSS_TIERS)[number];
export type BossRank = (typeof BOSS_RANKS)[number];
export type ArtRole = (typeof ART_ROLES)[number];
export type EliteId = (typeof ELITE_IDS)[number];
export type TowerId = (typeof TOWER_IDS)[number];
export type BranchId = (typeof BRANCH_IDS)[number];
export type FormId = (typeof FORM_IDS)[number];

const tiers = z.object({ regular: nonNeg, elite: nonNeg, boss: nonNeg });

const difficulty = z.object({
  label: z.string().min(1),
  gateHp: int.min(1),
  enemyHpBP: bp,
  /**
   * 난이도 HP 배율의 초반 진입(prd-r4 §7.1: 어려움·아주 어려움 1웨이브 패배 상한). 1웨이브는 fromBP이고 waves웨이브에 걸쳐
   * enemyHpBP까지 선형으로 오른다((1+waves)웨이브부터 enemyHpBP). 없으면 처음부터 enemyHpBP.
   */
  enemyHpRamp: z.object({ fromBP: bp, waves: int.min(1) }).optional(),
  correctPt: int,
  wrongPt: int.max(0),
  skipPt: int.max(0),
  correctGold: nonNeg,
  /** 정답 골드의 웨이브 성장(prd-r4 §7.2 B): 정답 골드 = correctGold + floor(이 값 × (웨이브 − 1) / 10000). 없으면 0(고정). */
  correctGoldPerWaveBP: nonNeg.optional(),
  killGold: tiers,
  killPt: tiers,
  waveKillPtCap: nonNeg,
  milestoneSurvivalGold: nonNeg,
});

const enemy = z.object({
  hpBP: bp, speedBP: bp, physicalResistBP: bp, magicResistBP: bp,
  /** 비행(monsters.md §1.2 flyer): 대공이 안 되는 타워의 표적·착탄 범위에서 빠진다(towers.md §4-1). */
  flying: z.boolean().optional(),
  /** 분열(splitter): 처치되면 사망 지점 ±spreadMilli에 파생체 count기. 파생체는 처치 골드·PT가 0이다. */
  split: z.object({ kind: z.enum(ENEMY_KINDS), count: int.min(1).max(8), spreadMilli: nonNeg }).optional(),
  /** 이 역할을 다른 역할 그림으로 그린다(파생체처럼 종족 팩에 그림이 따로 없는 역할). */
  artRole: z.enum(REGULAR_KINDS).optional(),
});

const ms = nonNeg;
const burst = z.object({ count: int.min(2).max(12), gapTicks: int.min(1), followDamageBP: bp.optional() });
const areaHit = z.object({ radiusMilli: nonNeg, maxTargets: int.min(1), damageBP: bp });

/**
 * 공격 효과(towers.md §2·§4). 타워 기본값에도, 형태에도 둘 수 있고 형태 값이 이긴다(2차형은 1차형을 물려받는다).
 * 단위는 ms·milli·BP다. 엔진은 domain/combat.ts가 한 곳에서 해석한다.
 */
const effects = {
  /** 대공(§4-1): canHitFlyer가 없으면 대공 가능. preferFlyer는 사거리 안 비행 적을 먼저, flyerDamageBP는 비행 적 상황 배율. */
  canHitFlyer: z.boolean().optional(),
  preferFlyer: z.boolean().optional(),
  flyerDamageBP: bp.optional(),
  instant: z.boolean().optional(),
  projectileSpeedMilliPerSec: int.min(1).optional(),
  maxTargets: int.min(1).optional(),
  splashRadiusMilli: nonNeg.optional(),
  slowBP: bp.optional(),
  slowMs: ms.optional(),
  physicalResistIgnoreBP: bp.optional(),
  /** 마법 저항 무시(마법 A2·화염 B1). 화상에도 쓴다. */
  magicResistIgnoreBP: bp.optional(),
  /** 연쇄·직선 관통의 k번째 대상 감쇠. */
  chainFalloffBP: bp.optional(),
  chainRadiusMilli: nonNeg.optional(),
  /** 화상 총피해(Lv1, HP)와 지속. 투사체 적중에도 붙는다(박격 A2·화차 B1). */
  burnTotal: nonNeg.optional(),
  burnMs: ms.optional(),
  /** 정예·보스 상황 배율. */
  eliteBossDamageBP: bp.optional(),
  /** 도넛 사거리(§4-2 박격포): 이보다 가까운 적은 노리지 않는다. */
  minRangeMilli: nonNeg.optional(),
  /** 표적 규칙: first = 진행도 최대(기본), strongest = 현재 체력 최대(매 B1). */
  targetPriority: z.enum(['first', 'strongest']).optional(),
  /** 한 번에 서로 다른 표적 n명에게 따로 쏜다(궁수 A2·투석 A2·매 A2). */
  volley: int.min(1).max(8).optional(),
  /** 즉발 타워 중심 360도 고리(종각·서리 B1). 반경은 사거리. */
  ring: z.boolean().optional(),
  /**
   * 장판(§4-7 zone, 약병): 착탄 지점에 반경 splashRadiusMilli 장판을 durationMs 동안 남겨 periodMs마다(착탄 틱 포함) maxTargets명을 친다.
   * count가 3이면 표적 진행도와 그 앞뒤 spacingMilli 세 곳에 놓는다(약병 B2). 투사체는 착탄 피해 없이 장판만 남긴다.
   */
  zone: z.object({ durationMs: int.min(1), periodMs: int.min(1), count: int.min(1).max(5).optional(), spacingMilli: nonNeg.optional() }).optional(),
  /**
   * 바닥 덫(§4-7 trap): 공격 간격마다 사거리 안 경로에서 성문에 가장 가까운 빈자리에 덫 하나를 놓는다(타워당 maxActive개까지).
   * 진행도 ±detectMilli 안 지상 적이 밟으면 발동하고, 웨이브가 끝나면 carryOver개까지 다음 웨이브로 넘긴다.
   * 발동 범위는 splashRadiusMilli(0이면 밟은 적 하나), 대상 수는 maxTargets. 이월은 규칙상 최대 2개다(towers.md §2 [19]·§4-7).
   */
  trap: z.object({ maxActive: int.min(1).max(8), detectMilli: int.min(1), carryOver: nonNeg.max(2) }).optional(),
  /** 굴림체(§4-7 roller, 통나무): 첫 표적 진행도에 놓여 입구 쪽으로 speed로 distance만큼 굴러가며 폭(진행도) 안 지상 적을 maxTargets명까지 친다. */
  roller: z.object({ distanceMilli: int.min(1), speedMilliPerSec: int.min(30), widthMilli: nonNeg }).optional(),
  /** 화약 술통(통나무 B): afterHits번 충돌·정예/대장 충돌(eliteTrigger)·굴림 끝 가운데 먼저 오는 때 굴림체 자리에서 한 번 폭발. */
  rollBlast: z.object({ afterHits: int.min(1), eliteTrigger: z.boolean(), radiusMilli: nonNeg, maxTargets: int.min(1), damageBP: bp }).optional(),
  /** 지연 폭발(덫 B1 2차 폭죽·노포 B2 도화선): 공격 자리(덫 둘레·직선 궤적)에 delayMs 뒤 피해 × damageBP, 최대 maxTargets명(없으면 타워 대상 수). */
  delayedBlast: z.object({ delayMs: int.min(1), damageBP: bp, maxTargets: int.min(1).optional() }).optional(),
  /** 관통(석궁 A): 첫 대상 뒤 일직선 적 수(기본 1). */
  pierceCount: int.min(1).max(8).optional(),
  /** 맞은 모든 적 기절, 정예·대장만 기절, 정예·대장만 감속(석궁 B2·수호기사 A1), 대장만 감속(밀치기 면역 대체). */
  hitStunMs: ms.optional(),
  eliteStunMs: ms.optional(),
  eliteSlowBP: bp.optional(),
  eliteSlowMs: ms.optional(),
  bossSlowBP: bp.optional(),
  bossSlowMs: ms.optional(),
  /** 밀치기(§4-5): 경로 뒤로. 비행 적·대장 값이 따로 있다(대장 0 = 면역). 적 1기 평생 상한은 statusCaps. */
  knockbackMilli: nonNeg.optional(),
  knockbackFlyerMilli: nonNeg.optional(),
  knockbackBossMilli: nonNeg.optional(),
  /** 비행 적을 끌어내린다(바람 A2): 그동안 지상 전용 타워도 맞힌다. */
  groundFlyerMs: ms.optional(),
  /** 취약(받는 피해 +)·저항 차감(§4-6). 출처별로 두고 가장 큰 값 하나, 상한은 statusCaps. */
  vulnBP: bp.optional(),
  vulnMs: ms.optional(),
  shredPhysicalBP: bp.optional(),
  shredMagicBP: bp.optional(),
  shredMs: ms.optional(),
  /** 체력 비율이 이하인 적에게 피해 배율(궁수 B2), 감속 중인 적에게 피해 배율(서리 A2). */
  lowHpThresholdBP: bp.optional(),
  lowHpDamageBP: bp.optional(),
  slowedDamageBP: bp.optional(),
  /** 같은 적을 이어 치면 한 번마다 +stackBP(최대 max번, 마법 A1). */
  focusStackBP: bp.optional(),
  focusStackMax: int.min(1).max(10).optional(),
  /** 시차 다연발(§4-4): 주 공격 뒤 gapTicks마다 다시 조준해 count-1발 더, 뒤따르는 발의 피해 배율. */
  burst: burst.optional(),
  /** 공격 주기(§4-9): every번째 공격마다 기절·다연발·타워 중심 회전 공격을 더한다. */
  cycle: z.object({ every: int.min(2), stunMs: ms.optional(), burst: burst.optional(), ring: areaHit.optional() }).optional(),
  /** 공격의 마지막 대상 둘레에 2차 피해(파편·폭발). 비행 적만·취약·감속을 함께 줄 수 있다. */
  onHitSplash: areaHit.extend({ vulnBP: bp.optional(), vulnMs: ms.optional(), slowBP: bp.optional(), slowMs: ms.optional(), flyersOnly: z.boolean().optional() }).optional(),
  /** 도탄(§4-3): 맞힌 적 둘레의 아직 안 맞은 적에게 count번 튄다(count 0 = 없음). */
  ricochet: z.object({ count: int.min(0).max(8), radiusMilli: nonNeg, falloffBP: bp }).optional(),
  /** 착탄 둘레 일반 적을 중심 적 진행도 쪽으로 당긴다(마법 B2). */
  pull: z.object({ radiusMilli: nonNeg, maxTargets: int.min(1), milli: nonNeg }).optional(),
  /**
   * 처치 유발(§4-8): 이 타워의 감속·화상이 걸린 적, 또는 이 타워의 장판 위 적(zone)이 처치되면 둘레에 피해, 감속·화상을 옮긴다.
   * 분열 파생체가 생긴 뒤 같은 틱에 발동하고, 연쇄 깊이는 1단계다.
   */
  onKill: areaHit.extend({ mark: z.enum(['slow', 'burn', 'zone']), carry: z.enum(['none', 'slow', 'burn']) }).optional(),
  /** 성문이 깎일수록 공격 속도·피해가 오른다(최소값 상시, 수호기사 A2). */
  gateRage: z.object({ speedBP: bp, damageBP: bp, minBP: bp }).optional(),
  /** 타워 둘레 지상 적에게 상시 감속(수호기사 B2). */
  slowAura: z.object({ radiusMilli: nonNeg, slowBP: bp }).optional(),
  /** 쏠 때마다 둘레 공격 타워 count기의 다음 공격을 ticks만큼 당긴다(바람 B2). */
  hasteNeighbors: z.object({ radiusMilli: nonNeg, count: int.min(1), ticks: int.min(1) }).optional(),
  /** 오라를 주는 반경(없으면 사거리)과 둘레 공격 타워에 주는 사거리·공격 속도(종각 B·B1), 정예·대장 배율 가산(깃발 A1). */
  auraRadiusMilli: nonNeg.optional(),
  auraRangeMilli: nonNeg.optional(),
  auraSpeedBP: bp.optional(),
  auraEliteBossBP: bp.optional(),
  /** 오라 안 타워가 every번 처치할 때마다 골드(웨이브당 상한, 깃발 A2). */
  auraKillGold: z.object({ every: int.min(1), gold: int.min(1), waveCap: int.min(1) }).optional(),
  /** 버닝 중에는 오라 반경과 공격 속도 오라가 커진다(깃발 B1). */
  auraBurning: z.object({ rangeAddMilli: nonNeg, speedBP: bp }).optional(),
};
export const EFFECT_KEYS = Object.keys(effects) as Array<keyof typeof effects>;

const tower = z.object({
  label: z.string().min(1),
  cost: int.min(1),
  damage: nonNeg,
  damageType: z.enum(['physical', 'magic', 'none']),
  intervalMs: nonNeg,
  rangeMilli: nonNeg,
  coneDegrees: nonNeg.optional(),
  /** 직선 관통(노포): 선분 폭. 형태 lineWidthMilli가 이긴다. */
  lineWidthMilli: nonNeg.optional(),
  maxOnField: int.min(1).optional(),
  auraDamageBPByLevel: z.array(bp).optional(),
  ...effects,
});

/** 형태 하나의 보정. 2차형은 부모(1차형) 값을 물려받고 적은 필드만 덮어쓴다(progression.md §3). */
const form = z.object({
  label: z.string().min(1),
  summary: z.string().min(1),
  intervalBP: bp.optional(),
  damageBP: bp.optional(),
  rangeAddMilli: nonNeg.optional(),
  /** 번개 B 충격: 첫 대상 기절. */
  firstTargetStunMs: nonNeg.optional(),
  /** 화염 B 잔불: 화상 총피해 배율. */
  burnBP: bp.optional(),
  /** 석궁 A 관통: 첫 대상 뒤 일직선 적에 주는 피해 비율과 선분 폭. */
  pierceDamageBP: bp.optional(),
  pierceWidthMilli: nonNeg.optional(),
  /** 긴 창·직선 관통: 타워→첫 대상 방향 선분의 폭(길이는 사거리). 부채꼴보다 앞선다(바람 B1). */
  lineWidthMilli: nonNeg.optional(),
  /** 범위 공격의 대상별 피해 비율(마법 B 파동·수호기사 B 수호 일격). */
  splashDamageBP: bp.optional(),
  /** 깃발 형태: 그 형태 첫 레벨부터 레벨별 직접 피해 보너스, 또는 피해 보너스를 대체하는 공격 속도 보너스. 표를 넘으면 마지막 값. */
  auraDamageBPByLevel: z.array(bp).optional(),
  auraSpeedBPByLevel: z.array(bp).optional(),
  ...effects,
});

const factionId = z.string().regex(/^[a-z][a-z_]*$/);

/**
 * 종족 팩(monsters.md §2). 규칙은 역할(enemies)이 정하고, 종족은 이름·그림만 바꾼다. 새 종족은 이 표 한 줄과 그림으로 더한다.
 * 그림 id는 `<artPrefix>.<역할 또는 boss5~boss20>`이고, artAlias가 있으면 그 그림을 대신 쓴다(예: 정원 보병 → 기존 enemy.walker).
 */
/**
 * 대장 기믹 프리미티브 6종(monsters.md §2.0). 32 대장은 이 가운데 하나에 수치만 묶는다(대장별 코드 없음).
 * 모두 statusCaps(대장 감속·평생 기절·대장 저항·합산 속도 상한)를 지킨다.
 */
export const BOSS_SKILL_KINDS = ['iron_stance', 'burst_march', 'rally_haste', 'ward_layers', 'snack_mend', 'call_escort'] as const;
const bossSkill = z.discriminatedUnion('kind', [
  /** 방어 태세: 체력이 triggerBP 이하로 처음 내려가면 durationMs 동안 저항 +. */
  z.object({ kind: z.literal('iron_stance'), triggerBP: bp, durationMs: nonNeg, physicalBP: bp.optional(), magicBP: bp.optional() }),
  /** 박차 행진: periodMs마다 끝의 durationMs 동안 이동 속도를 speedBP로. */
  z.object({ kind: z.literal('burst_march'), periodMs: int.min(1), durationMs: nonNeg, speedBP: bp }),
  /** 진군 북소리: 반경 안 일반 적 이동 속도 +speedAddBP(중첩 없음, 합산 상한). */
  z.object({ kind: z.literal('rally_haste'), radiusMilli: nonNeg, speedAddBP: bp }),
  /** 겹방패: layers겹. 한 번 맞을 때 피해를 최대 체력의 capBP까지로 막고 한 겹 벗긴다. */
  z.object({ kind: z.literal('ward_layers'), layers: int.min(1), capBP: bp }),
  /** 새참 회복: periodMs마다 기절이 아니면 최대 체력의 healBP 회복(최대 maxTimes번). */
  z.object({ kind: z.literal('snack_mend'), periodMs: int.min(1), healBP: bp, maxTimes: int.min(1) }),
  /** 호위 호출: 체력이 thresholdsBP 각 값 이하로 처음 내려갈 때마다 같은 종족 escorts를 ±spreadMilli에 부른다(파생체). */
  z.object({ kind: z.literal('call_escort'), thresholdsBP: z.array(bp).min(1), escorts: z.array(z.enum(REGULAR_KINDS)).min(1), spreadMilli: nonNeg }),
]);

const faction = z.object({
  label: z.string().min(1),
  artPrefix: z.string().regex(/^[a-z]+$/),
  artAlias: z.partialRecord(z.enum(ART_ROLES), z.string().regex(/^[a-z][a-z0-9_.]*$/)).optional(),
  names: z.partialRecord(z.enum(ART_ROLES), z.string().min(1)).optional(),
  /** 대장 단계별 기믹과 체력 보정(없으면 10000). */
  bosses: z.partialRecord(z.enum(BOSS_RANKS), z.object({ skill: bossSkill, hpScaleBP: int.min(1000).max(30000).optional() })).optional(),
});

/** 맵 한 곳의 원정 편성(monsters.md §3): 주력 종족, 기본 6역할 해금 순서, 21웨이브부터 침입하는 종족 순환. */
const campaign = z.object({
  primary: factionId,
  roleOrder: z.array(z.enum(BASE_ROLES)).length(BASE_ROLES.length),
  invasionOrder: z.array(factionId).min(1),
});

const towerForms = z.object({
  A: form,
  B: form,
  A1: form.extend({ parent: z.literal('A') }),
  A2: form.extend({ parent: z.literal('A') }),
  B1: form.extend({ parent: z.literal('B') }),
  B2: form.extend({ parent: z.literal('B') }),
});

export const balanceSchema = z.object({
  schemaVersion: z.literal('0.4'),
  balanceVersion: z.string().min(1),
  units: z.object({ tickHz: z.literal(30) }).loose(),
  run: z.object({
    startGold: nonNeg,
    prepAttempts: z.object({ firstWave: int.min(1), laterWaves: int.min(1) }),
    correctFeedbackMs: nonNeg,
    wrongFeedbackMinMs: nonNeg,
    sellRatioBP: bp,
    /** 설치 직후 전액 환불(undoBuild)을 받을 수 있는 시간. */
    undoBuildMs: nonNeg,
  }),
  difficulties: z.record(z.enum(DIFFICULTY_IDS), difficulty),
  enemies: z.record(z.enum(ENEMY_KINDS), enemy),
  elites: z.object({
    armored: z.object({ hpBP: bp, speedBP: bp, addPhysicalResistBP: bp }),
    swift: z.object({ hpBP: bp, speedBP: bp, addPhysicalResistBP: bp }),
    physicalResistCapBP: bp,
  }),
  leakDamage: tiers,
  /** 취약·저항 차감 상한, 적 1기 평생 밀치기 상한(towers.md §4-5·§4-6). */
  statusCaps: z.object({
    regularSlowMaxBP: bp, bossSlowMaxBP: bp, stunLifetimeMaxMs: nonNeg, vulnMaxBP: bp, shredMaxBP: bp, knockbackLifetimeMaxMilli: nonNeg,
    /** 대장 방어 태세로 오른 저항 상한, 진군 북소리로 오른 이동 속도 상한(monsters.md §2.0). */
    bossResistMaxBP: bp, rallySpeedMaxBP: bp,
  }),
  waves: z.object({
    baseHpMilli: int.min(1),
    hpGrowthPercent: int.min(100),
    /**
     * 적 수 = min(max, base + step × floor((w − 1) / stepEveryWaves)). hpReference가 있으면 그 증가 폭(같은 base·max)으로 센 수를
     * 웨이브 총 HP의 기준으로 삼아, 줄어든 적 수만큼 개체 HP로 옮긴다(prd-r4 §7.2 A: 적 수를 줄여도 총 HP는 그대로).
     */
    count: z.object({
      base: int.min(1), step: nonNeg, stepEveryWaves: int.min(1), max: int.min(1),
      hpReference: z.object({ step: nonNeg, stepEveryWaves: int.min(1) }).optional(),
    }),
    /** 초반 완충(prd-r4 §7.2 A): [i]는 (i+1)웨이브의 기준 HP 배율. 표 밖 웨이브는 10000. */
    earlyHpBP: z.array(bp).optional(),
    spawnIntervalMs: z.object({ overrides: z.record(z.string().regex(/^[1-9]\d*$/), int.min(1)), base: int.min(1), perWave: int, min: int.min(1) }),
    bossEveryWaves: int.min(1),
    eliteRate: z.object({ fromWave: int.min(1), baseBP: bp, perWaveBP: bp, maxBP: bp }),
    /**
     * 웨이브별 역할 가중치(monsters.md §3.1). slotWeights[i]는 맵의 roleOrder[i] 역할, roleWeights는 역할을 바로 적는다(비행·분열).
     * 그 웨이브 이하에서 가장 늦은 fromWave 줄을 쓴다.
     */
    composition: z.array(z.object({ fromWave: int.min(1), slotWeights: z.array(nonNeg).min(1).max(BASE_ROLES.length), roleWeights: z.partialRecord(z.enum(REGULAR_KINDS), nonNeg).optional() })).min(1),
    /**
     * 21웨이브부터의 원정 침입(monsters.md §3.2). blockWaves 웨이브마다 invasionOrder의 다음 종족이 오고, 블록 안 offset별 침입 비율을 쓴다.
     * 대장 웨이브의 대장은 침입 종족이며 단계는 bossTiers[block % 길이]다. alliance.fromBlock부터는 주력 + 침입 두 종족 연합이다.
     */
    invasion: z.object({
      fromWave: int.min(1),
      blockWaves: int.min(1),
      invaderShareBPByOffset: z.array(int.min(0).max(10000)).min(1),
      bossTiers: z.array(z.literal([...BOSS_TIERS])).min(1),
      alliance: z.object({ fromBlock: nonNeg, primaryShareBP: int.min(0).max(10000), secondOffset: int.min(1) }),
      /** 이 웨이브까지의 대장 웨이브는 침입 중이어도 주력 종족의 대장(1~4단)이 나온다(prd-r4 §7.2 C: 침입을 당겨도 W20 총대장은 남긴다). */
      primaryBossUntilWave: nonNeg.optional(),
    }),
    baseTravelTicks: int.min(1),
  }),
  /**
   * 버닝(PRD §5): 전투 연속 정답 streak마다. tier2가 있으면 연속 정답이 tier2.streak 이상일 때 2단(더 큰 공격 속도)으로 켠다(prd-r4 §7.2 B).
   * streakAcrossWaves가 true면 전투 연속 정답 수가 웨이브를 넘어 이어진다(버닝 자체는 웨이브가 끝나면 꺼진다). 전투 문항(마무리 포함)의
   * 오답·'모르겠어요'만 끊고, 준비 문항은 세지도 끊지도 않는다. 웨이브당 전투 문항이 2~3개라 웨이브마다 끊으면 6연속(2단)이 나올 수 없다.
   */
  burning: z.object({
    streak: int.min(1), durationMs: nonNeg, attackSpeedBP: bp,
    tier2: z.object({ streak: int.min(1), attackSpeedBP: bp }).optional(),
    streakAcrossWaves: z.boolean().optional(),
  }),
  externalCaps: z.object({ damageBP: bp, attackSpeedBP: bp, minAttackIntervalMs: nonNeg }),
  levels: z.object({
    /** 정수면 그 레벨이 상한, null이면 무제한. */
    max: int.min(1).nullable(),
    /** 이 레벨로 올라갈 때 형태를 고른다: [1차 진화, 2차 진화]. */
    evolveAt: z.tuple([int.min(2), int.min(3)]),
    /** Lv1부터의 피해 배율. 표 밖은 beyond.damageGrowthBP를 한 레벨씩 곱한다. */
    damageMultiplierBP: z.array(int.min(1).max(1_000_000)).min(1),
    /** Lv1→2부터의 강화 비용(기본가 대비). 표 밖은 beyond.costGrowthBP를 한 레벨씩 곱한다. */
    upgradeCostOfBaseBP: z.array(int.min(1).max(1_000_000)).min(1),
    beyond: z.object({ damageGrowthBP: int.min(10000).max(100000), costGrowthBP: int.min(10000).max(100000) }),
  }),
  towers: z.record(z.enum(TOWER_IDS), tower),
  forms: z.record(z.enum(TOWER_IDS), towerForms),
  /**
   * 판 안 징집(towers.md §0-2·§5 안 1): startTowers로 시작하고, afterWaves 웨이브를 지킨 뒤 아직 없는 타워 offerCount종 가운데 하나를 고른다.
   * 장착함은 maxOwned칸까지. 시작 타워·후보는 그 판의 availableTowers 안에서만 고른다.
   */
  draft: z.object({
    startTowers: z.array(z.enum(TOWER_IDS)).min(1), afterWaves: z.array(int.min(1)), offerCount: int.min(1), maxOwned: int.min(1),
    /**
     * 대응 보장(prd-r4 §7.2 C): 지킨 웨이브 뒤 counterLookahead웨이브 안에 처음 나오는 역할의 강점 타워(counters[역할])가 장착함에 없으면
     * 후보 하나를 그 강점 타워로 낸다. B2의 타워별 strongVs가 들어오기 전까지 쓰는 최소 대응표다.
     */
    counters: z.partialRecord(z.enum(REGULAR_KINDS), z.array(z.enum(TOWER_IDS)).min(1)).optional(),
    counterLookahead: nonNeg.optional(),
  }),
  factions: z.record(factionId, faction),
  /** 맵 ID → 원정 편성. 모든 맵이 하나씩 가진다(content 시험). */
  campaigns: z.record(z.string().regex(/^[a-z_]+$/), campaign),
}).loose().superRefine((b, ctx) => {
  const lv = b.levels;
  if (lv.upgradeCostOfBaseBP.length !== lv.damageMultiplierBP.length - 1) ctx.addIssue({ code: 'custom', message: '강화 비용 수는 피해 배율 수보다 하나 적어야 한다' });
  if (lv.evolveAt[0] >= lv.evolveAt[1]) ctx.addIssue({ code: 'custom', message: '2차 진화는 1차 진화보다 뒤여야 한다' });
  if (lv.evolveAt[1] > lv.damageMultiplierBP.length) ctx.addIssue({ code: 'custom', message: '진화 레벨은 피해 배율 표 안에 있어야 한다' });
  if (b.waves.composition[0]?.fromWave !== 1) ctx.addIssue({ code: 'custom', message: '1웨이브 편성이 없다' });
  for (const c of b.waves.composition) {
    const total = c.slotWeights.reduce((a, x) => a + x, 0) + Object.values(c.roleWeights ?? {}).reduce((a, x) => a + x, 0);
    if (total <= 0) ctx.addIssue({ code: 'custom', message: `${c.fromWave}웨이브 편성 가중치 합이 0이다` });
  }
  for (const [kind, e] of Object.entries(b.enemies)) {
    if (!e.split) continue;
    const child = b.enemies[e.split.kind];
    if (e.split.kind === 'boss' || child.split) ctx.addIssue({ code: 'custom', message: `${kind}: 분열 파생체는 대장이 아니고 다시 분열하지 않아야 한다` });
  }
  const tier2 = b.burning.tier2;
  if (tier2 && (tier2.streak <= b.burning.streak || tier2.streak % b.burning.streak !== 0)) ctx.addIssue({ code: 'custom', message: '버닝 2단 연속 수는 1단 연속 수의 배수(2배 이상)여야 한다' });
  const dr = b.draft;
  if (new Set(dr.startTowers).size !== dr.startTowers.length || dr.startTowers.length > dr.maxOwned) ctx.addIssue({ code: 'custom', message: '징집 시작 타워가 겹치거나 장착함보다 많다' });
  if (dr.afterWaves.some((w, i) => i > 0 && w <= dr.afterWaves[i - 1]!)) ctx.addIssue({ code: 'custom', message: '징집 웨이브는 오름차순이어야 한다' });
  const inv = b.waves.invasion;
  if (inv.invaderShareBPByOffset.length !== inv.blockWaves) ctx.addIssue({ code: 'custom', message: '침입 비율 수는 블록 웨이브 수와 같아야 한다' });
  for (const [mapId, c] of Object.entries(b.campaigns)) {
    if (!b.factions[c.primary]) ctx.addIssue({ code: 'custom', message: `${mapId}: 없는 주력 종족 ${c.primary}` });
    if (new Set(c.roleOrder).size !== c.roleOrder.length) ctx.addIssue({ code: 'custom', message: `${mapId}: 역할 해금 순서가 겹친다` });
    if (new Set(c.invasionOrder).size !== c.invasionOrder.length) ctx.addIssue({ code: 'custom', message: `${mapId}: 침입 순환이 겹친다` });
    for (const f of c.invasionOrder) {
      if (!b.factions[f]) ctx.addIssue({ code: 'custom', message: `${mapId}: 없는 침입 종족 ${f}` });
      if (f === c.primary) ctx.addIssue({ code: 'custom', message: `${mapId}: 주력 종족이 침입 순환에 있다` });
    }
  }
});

export type Balance = z.infer<typeof balanceSchema>;
export type DifficultyConfig = Balance['difficulties'][DifficultyId];
export type TowerConfig = Balance['towers'][TowerId];
export type FormConfig = z.infer<typeof form>;
export type FactionConfig = z.infer<typeof faction>;
export type BossSkill = z.infer<typeof bossSkill>;
export type BossSkillKind = (typeof BOSS_SKILL_KINDS)[number];
export type CampaignConfig = z.infer<typeof campaign>;

import { z } from 'zod';

// docs/contracts/balance.candidate.v0.4.json의 런타임 계약. 단위는 정수 ms·BP(10000=1.0)·milli.
const int = z.number().int().refine(Number.isSafeInteger, '안전 정수가 아니다');
const nonNeg = int.min(0);
const bp = int.min(0).max(100000);

export const DIFFICULTY_IDS = ['Easy', 'Normal', 'Hard', 'Crazy'] as const;
export const ENEMY_KINDS = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm', 'boss'] as const;
export const REGULAR_KINDS = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm'] as const;
export const ELITE_IDS = ['armored', 'swift'] as const;
export const TOWER_IDS = ['archer', 'crossbow', 'cannon', 'mage', 'frost', 'lightning', 'flame', 'spear', 'guardian', 'banner'] as const;
export const BRANCH_IDS = ['A', 'B'] as const;

export type DifficultyId = (typeof DIFFICULTY_IDS)[number];
export type EnemyKind = (typeof ENEMY_KINDS)[number];
export type RegularKind = (typeof REGULAR_KINDS)[number];
export type EliteId = (typeof ELITE_IDS)[number];
export type TowerId = (typeof TOWER_IDS)[number];
export type BranchId = (typeof BRANCH_IDS)[number];

const tiers = z.object({ regular: nonNeg, elite: nonNeg, boss: nonNeg });

const difficulty = z.object({
  label: z.string().min(1),
  gateHp: int.min(1),
  enemyHpBP: bp,
  correctPt: int,
  wrongPt: int.max(0),
  skipPt: int.max(0),
  correctGold: nonNeg,
  killGold: tiers,
  killPt: tiers,
  waveKillPtCap: nonNeg,
  milestoneSurvivalGold: nonNeg,
});

const enemy = z.object({ hpBP: bp, speedBP: bp, physicalResistBP: bp, magicResistBP: bp });

const tower = z.object({
  label: z.string().min(1),
  cost: int.min(1),
  damage: nonNeg,
  damageType: z.enum(['physical', 'magic', 'none']),
  intervalMs: nonNeg,
  rangeMilli: nonNeg,
  projectileSpeedMilliPerSec: int.min(1).optional(),
  instant: z.boolean().optional(),
  maxTargets: int.min(1).optional(),
  splashRadiusMilli: nonNeg.optional(),
  slowBP: bp.optional(),
  slowMs: nonNeg.optional(),
  physicalResistIgnoreBP: bp.optional(),
  chainFalloffBP: bp.optional(),
  chainRadiusMilli: nonNeg.optional(),
  coneDegrees: nonNeg.optional(),
  burnTotal: nonNeg.optional(),
  burnMs: nonNeg.optional(),
  maxOnField: int.min(1).optional(),
  auraDamageBPByLevel: z.array(bp).optional(),
});

const branch = z.object({
  label: z.string().min(1),
  summary: z.string().min(1),
  intervalBP: bp.optional(),
  damageBP: bp.optional(),
  rangeAddMilli: nonNeg.optional(),
  splashRadiusMilli: nonNeg.optional(),
  maxTargets: int.min(1).optional(),
  slowBP: bp.optional(),
  slowMs: nonNeg.optional(),
  /** 정예·보스에게만 곱하는 상황 배율(석궁 B 거대 사냥·수호기사 A 결투). */
  eliteBossDamageBP: bp.optional(),
  /** 물리 저항 효과 무시(창병 B 파쇄). */
  physicalResistIgnoreBP: bp.optional(),
  /** 번개 연쇄 감쇠(번개 A·B). */
  chainFalloffBP: bp.optional(),
  /** 번개 B 충격: 첫 대상 기절. */
  firstTargetStunMs: nonNeg.optional(),
  /** 화염 B 잔불: 화상 총피해 배율. */
  burnBP: bp.optional(),
  /** 석궁 A 관통: 첫 대상 뒤 일직선 두 번째 적에 주는 피해 비율과 선분 폭. */
  pierceDamageBP: bp.optional(),
  pierceWidthMilli: nonNeg.optional(),
  /** 창병 A 긴 창: 타워→첫 대상 방향 선분의 폭(길이는 사거리). 대상 수는 maxTargets. */
  lineWidthMilli: nonNeg.optional(),
  /** 범위 공격의 대상별 피해 비율(마법 B 파동 75%·수호기사 B 수호 일격 80%). */
  splashDamageBP: bp.optional(),
  /** 깃발 A·B: Lv3/4/5 직접 피해 보너스, 또는 피해 보너스를 대체하는 공격 속도 보너스. */
  auraDamageBPByLevel: z.array(bp).optional(),
  auraSpeedBPByLevel: z.array(bp).optional(),
});

export const balanceSchema = z.object({
  schemaVersion: z.literal('0.3'),
  balanceVersion: z.string().min(1),
  units: z.object({ tickHz: z.literal(30) }).loose(),
  run: z.object({
    startGold: nonNeg,
    prepAttempts: z.object({ firstWave: int.min(1), laterWaves: int.min(1) }),
    correctFeedbackMs: nonNeg,
    wrongFeedbackMinMs: nonNeg,
    sellRatioBP: bp,
  }),
  difficulties: z.record(z.enum(DIFFICULTY_IDS), difficulty),
  enemies: z.record(z.enum(ENEMY_KINDS), enemy),
  elites: z.object({
    armored: z.object({ hpBP: bp, speedBP: bp, addPhysicalResistBP: bp }),
    swift: z.object({ hpBP: bp, speedBP: bp, addPhysicalResistBP: bp }),
    physicalResistCapBP: bp,
  }),
  leakDamage: tiers,
  statusCaps: z.object({ regularSlowMaxBP: bp, bossSlowMaxBP: bp, stunLifetimeMaxMs: nonNeg }),
  waves: z.object({
    baseHpMilli: int.min(1),
    hpGrowthPercent: int.min(100),
    count: z.object({ base: int.min(1), step: nonNeg, stepEveryWaves: int.min(1), max: int.min(1) }),
    spawnIntervalMs: z.object({ overrides: z.record(z.string().regex(/^[1-9]\d*$/), int.min(1)), base: int.min(1), perWave: int, min: int.min(1) }),
    bossEveryWaves: int.min(1),
    eliteRate: z.object({ fromWave: int.min(1), baseBP: bp, perWaveBP: bp, maxBP: bp }),
    composition: z.array(z.object({ fromWave: int.min(1), weights: z.partialRecord(z.enum(REGULAR_KINDS), nonNeg) })).min(1),
    baseTravelTicks: int.min(1),
  }),
  burning: z.object({ streak: int.min(1), durationMs: nonNeg, attackSpeedBP: bp }),
  externalCaps: z.object({ damageBP: bp, attackSpeedBP: bp, minAttackIntervalMs: nonNeg }),
  levels: z.object({
    max: int.min(1),
    branchAtLevel: int.min(2),
    upgradeCostOfBaseBP: z.array(bp),
    damageMultiplierBP: z.array(bp),
  }),
  towers: z.record(z.enum(TOWER_IDS), tower),
  branches: z.partialRecord(z.enum(TOWER_IDS), z.object({ A: branch, B: branch })),
}).loose().superRefine((b, ctx) => {
  if (b.levels.upgradeCostOfBaseBP.length !== b.levels.max - 1) ctx.addIssue({ code: 'custom', message: '강화 비용 수가 최대 레벨과 맞지 않는다' });
  if (b.levels.damageMultiplierBP.length !== b.levels.max) ctx.addIssue({ code: 'custom', message: '피해 배율 수가 최대 레벨과 맞지 않는다' });
  if (b.waves.composition[0]?.fromWave !== 1) ctx.addIssue({ code: 'custom', message: '1웨이브 편성이 없다' });
});

export type Balance = z.infer<typeof balanceSchema>;
export type DifficultyConfig = Balance['difficulties'][DifficultyId];
export type TowerConfig = Balance['towers'][TowerId];
export type BranchConfig = NonNullable<Balance['branches'][TowerId]>['A'];

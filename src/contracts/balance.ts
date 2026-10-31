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
export const TOWER_IDS = ['archer', 'crossbow', 'cannon', 'mage', 'frost', 'lightning', 'flame', 'spear', 'guardian', 'banner'] as const;
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
  correctPt: int,
  wrongPt: int.max(0),
  skipPt: int.max(0),
  correctGold: nonNeg,
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

/** 대공(towers.md §4-1). 타워·형태에 둘 수 있고 형태 값이 이긴다. canHitFlyer가 없으면 대공 가능이다. */
const antiAir = {
  canHitFlyer: z.boolean().optional(),
  /** 사거리 안 비행 적을 먼저 노린다(매사냥대 등). */
  preferFlyer: z.boolean().optional(),
  /** 비행 적에게만 곱하는 상황 배율. */
  flyerDamageBP: bp.optional(),
};

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
  ...antiAir,
});

/** 형태 하나의 보정. 2차형은 부모(1차형) 값을 물려받고 적은 필드만 덮어쓴다(progression.md §3). */
const form = z.object({
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
  /** 깃발 형태: 그 형태 첫 레벨부터 레벨별 직접 피해 보너스, 또는 피해 보너스를 대체하는 공격 속도 보너스. 표를 넘으면 마지막 값. */
  auraDamageBPByLevel: z.array(bp).optional(),
  auraSpeedBPByLevel: z.array(bp).optional(),
  ...antiAir,
});

const factionId = z.string().regex(/^[a-z][a-z_]*$/);

/**
 * 종족 팩(monsters.md §2). 규칙은 역할(enemies)이 정하고, 종족은 이름·그림만 바꾼다. 새 종족은 이 표 한 줄과 그림으로 더한다.
 * 그림 id는 `<artPrefix>.<역할 또는 boss5~boss20>`이고, artAlias가 있으면 그 그림을 대신 쓴다(예: 정원 보병 → 기존 enemy.walker).
 */
const faction = z.object({
  label: z.string().min(1),
  artPrefix: z.string().regex(/^[a-z]+$/),
  artAlias: z.partialRecord(z.enum(ART_ROLES), z.string().regex(/^[a-z][a-z0-9_.]*$/)).optional(),
  names: z.partialRecord(z.enum(ART_ROLES), z.string().min(1)).optional(),
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
  statusCaps: z.object({ regularSlowMaxBP: bp, bossSlowMaxBP: bp, stunLifetimeMaxMs: nonNeg }),
  waves: z.object({
    baseHpMilli: int.min(1),
    hpGrowthPercent: int.min(100),
    count: z.object({ base: int.min(1), step: nonNeg, stepEveryWaves: int.min(1), max: int.min(1) }),
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
    }),
    baseTravelTicks: int.min(1),
  }),
  burning: z.object({ streak: int.min(1), durationMs: nonNeg, attackSpeedBP: bp }),
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
export type CampaignConfig = z.infer<typeof campaign>;

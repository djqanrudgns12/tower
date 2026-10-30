import type { Balance, BranchId, FormConfig, FormId, TowerId } from '../contracts/balance';
import { dist2 } from './geometry';
import { bpFloor, ceilDiv, msToTicks, mulDivFloor, round5Bp } from './num';
import type { Tower } from './types';

export type { FormId } from '../contracts/balance';

// 타워 수치 계산은 도메인과 화면이 같은 함수를 쓴다(PRD §10.1 단일 기준). 성장·진화는 docs/renewal/progression.md.
export interface TowerStats {
  damage: number;
  damageType: 'physical' | 'magic';
  baseIntervalTicks: number;
  intervalBP: number;
  range: number;
  splashRadius: number;
  maxTargets: number;
  slowBP: number;
  slowTicks: number;
  projectileSpeed: number;
  physicalResistIgnoreBP: number;
  /** 즉발 공격(번개·화염·근접): 비행 없이 발사 틱에 맞힌다(PRD §20.3). */
  instant: boolean;
  /** 번개 연쇄: 다음 대상마다 최초 기준 피해에 곱하는 감쇠비와, 직전 대상 중심 탐색 반경. */
  chainFalloffBP: number;
  chainRadius: number;
  /** 화염 부채꼴(총각 90도). */
  cone: boolean;
  /** 화상 총피해(저항 전 milli-HP, 레벨 배율 반영)와 지속 틱. 0이면 화상 없음. */
  burnTotal: number;
  burnTicks: number;
  /** 정예·보스에게만 곱하는 상황 배율. */
  eliteBossDamageBP: number;
  /** 첫 대상 기절 틱(즉발 공격). */
  stunTicks: number;
  /** 관통: 두 번째 대상 피해 비율(0이면 없음)과 선분 폭. */
  pierceDamageBP: number;
  pierceWidth: number;
  /** 긴 창: 선분 폭(0이면 없음). 길이는 사거리. */
  lineWidth: number;
}

/** 형태 단계: 기본형 0, 1차형(A·B) 1, 2차형(A1~B2) 2. */
export function formTier(form: FormId): 0 | 1 | 2 {
  return form === 'base' ? 0 : form.length === 1 ? 1 : 2;
}

/** 화면의 길 표식(동그라미·마름모)에 쓰는 1차 길. 기본형은 null. */
export const formBranch = (form: FormId): BranchId | null => (form === 'base' ? null : (form[0] as BranchId));

/** 2차형은 1차형 값을 물려받고 적은 필드만 덮어쓴다. 기본형은 null. */
export function formConfig(b: Balance, type: TowerId, form: FormId): FormConfig | null {
  if (form === 'base') return null;
  const forms = b.forms[type];
  if (form === 'A' || form === 'B') return forms[form];
  const own = forms[form];
  return { ...forms[own.parent], ...own };
}

export function formInfo(b: Balance, type: TowerId, form: FormId): { label: string; summary: string; tier: 0 | 1 | 2 } {
  const tier = formTier(form);
  if (form === 'base') return { label: b.towers[type].label, summary: '기본형', tier };
  const f = b.forms[type][form];
  return { label: f.label, summary: f.summary, tier };
}

/** Lv L의 피해 배율(BP). 표를 넘으면 마지막 값에 한 레벨마다 숙련 성장률을 곱해 내림한다(progression.md §3). */
export function levelDamageBP(b: Balance, level: number): number {
  const table = b.levels.damageMultiplierBP;
  let v = table[Math.min(level, table.length) - 1]!;
  for (let l = table.length; l < level; l++) v = bpFloor(v, b.levels.beyond.damageGrowthBP, 'damage.beyond');
  return v;
}

/**
 * Lv L → L+1 강화 비용 배율(BP). 표를 넘으면 숙련 성장률을 곱한다. 기본가와 곱한 값이 안전 정수를 넘게 되는 레벨부터 null이다.
 * 그 레벨까지 쌓인 비용은 한 판에서 모을 수 있는 골드보다 훨씬 커서, 상한이 없어도 수치가 넘치기 전에 골드가 먼저 모자란다.
 */
function levelCostBP(b: Balance, level: number, base: number): number | null {
  const table = b.levels.upgradeCostOfBaseBP;
  const growth = b.levels.beyond.costGrowthBP;
  let v = table[Math.min(level, table.length) - 1]!;
  for (let l = table.length; l < level; l++) {
    if (v > Math.floor(Number.MAX_SAFE_INTEGER / growth)) return null;
    v = mulDivFloor(v, growth, 10000, 'cost.beyond');
  }
  return v > Math.floor(Number.MAX_SAFE_INTEGER / base) ? null : v;
}

export function towerStats(b: Balance, type: TowerId, level: number, form: FormId): TowerStats {
  const t = b.towers[type];
  const f = formConfig(b, type, form);
  const levelBP = levelDamageBP(b, level);
  let damage = bpFloor(t.damage * 1000, levelBP, 'damage.level');
  if (f?.damageBP) damage = bpFloor(damage, f.damageBP, 'damage.form');
  // 범위 공격 형태의 ‘각각 기본 피해의 N%’도 형태 배율로 한 단계 곱한다(PRD §7.3).
  if (f?.splashDamageBP) damage = bpFloor(damage, f.splashDamageBP, 'damage.splash');
  if (t.damageType === 'none') throw new Error(`${type}은 직접 공격 타워가 아니다`);
  return {
    damage,
    damageType: t.damageType,
    baseIntervalTicks: msToTicks(t.intervalMs),
    intervalBP: f?.intervalBP ?? 10000,
    range: t.rangeMilli + (f?.rangeAddMilli ?? 0),
    splashRadius: f?.splashRadiusMilli ?? t.splashRadiusMilli ?? 0,
    maxTargets: f?.maxTargets ?? t.maxTargets ?? 1,
    slowBP: f?.slowBP ?? t.slowBP ?? 0,
    slowTicks: msToTicks(f?.slowMs ?? t.slowMs ?? 0),
    projectileSpeed: t.projectileSpeedMilliPerSec ?? 10000,
    physicalResistIgnoreBP: f?.physicalResistIgnoreBP ?? t.physicalResistIgnoreBP ?? 0,
    instant: t.instant ?? false,
    chainFalloffBP: f?.chainFalloffBP ?? t.chainFalloffBP ?? 10000,
    chainRadius: t.chainRadiusMilli ?? 0,
    cone: coneOf(type, t.coneDegrees),
    // 화상 = Lv1 총피해 × 레벨 배율 × 화상 형태 배율(직접 피해 형태·깃발은 화상에 쓰지 않는다, PRD §20.2).
    burnTotal: t.burnTotal ? bpFloor(bpFloor(t.burnTotal * 1000, levelBP, 'burn.level'), f?.burnBP ?? 10000, 'burn.form') : 0,
    burnTicks: msToTicks(t.burnMs ?? 0),
    eliteBossDamageBP: f?.eliteBossDamageBP ?? 10000,
    stunTicks: msToTicks(f?.firstTargetStunMs ?? 0),
    pierceDamageBP: f?.pierceDamageBP ?? 0,
    pierceWidth: f?.pierceWidthMilli ?? 0,
    lineWidth: f?.lineWidthMilli ?? 0,
  };
}

/** 부채꼴 판정식(2·dot² ≥ 거리²·축길이²)은 총각 90도 전용이다(PRD §20.3). 다른 각도는 새 판정식이 필요하다. */
function coneOf(type: TowerId, degrees: number | undefined): boolean {
  if (degrees === undefined) return false;
  if (degrees !== 90) throw new Error(`${type}: 부채꼴은 90도만 지원한다(${degrees})`);
  return true;
}

/** 직접 공격하는 타워인가(깃발은 공격하지 않는다). */
export const attacks = (b: Balance, type: TowerId) => b.towers[type].damageType !== 'none';

/** 깃발 오라 반경: 기본 반경 + 형태의 사거리 보정. */
const auraRange = (b: Balance, type: TowerId, form: FormId) => b.towers[type].rangeMilli + (formConfig(b, type, form)?.rangeAddMilli ?? 0);

/** 화면의 범위 원: 공격 타워는 사거리, 깃발은 오라 반경(PRD §12.4). */
export const reachMilli = (b: Balance, type: TowerId, level: number, form: FormId) =>
  attacks(b, type) ? towerStats(b, type, level, form).range : auraRange(b, type, form);

/** 깃발 오라가 대상 타워에 닿는가. 버프 범위는 타워 바닥 중심 간 거리로 판정한다(PRD §7.3). */
export function auraReaches(b: Balance, banner: Pick<Tower, 'type' | 'form' | 'x' | 'y'>, target: Pick<Tower, 'x' | 'y'>): boolean {
  const r = auraRange(b, banner.type, banner.form);
  return dist2(banner.x, banner.y, target.x, target.y) <= r * r;
}

/**
 * 깃발 오라의 직접 피해 보너스(PRD §7.1·§7.3·§20.2). 같은 종류의 깃발 효과는 최고값만,
 * 전체 외부 피해 보너스는 상한까지만 준다. 깃발 자신·다른 깃발은 받지 않는다.
 */
export function auraDamageBonusBP(b: Balance, towers: readonly Tower[], target: Tower): number {
  return Math.min(bestAura(b, towers, target, 'damage'), b.externalCaps.damageBP);
}

/** 깃발 B(신속) 계열의 공격 속도 보너스. 버닝과 합친 전체 상한은 attackIntervalTicks가 적용한다(PRD §7.3, §20.2). */
export const auraSpeedBonusBP = (b: Balance, towers: readonly Tower[], target: Tower) => bestAura(b, towers, target, 'speed');

/**
 * 깃발 한 기가 주는 효과: 기본형은 레벨별 피해 보너스(타워 수치), 진화형은 그 형태 첫 레벨부터의 형태 값이다(표 밖은 마지막 값).
 * A 계열(용기)은 피해 보너스를 대체하고, B 계열(신속)은 피해 보너스를 없애고 속도 보너스를 준다(PRD §7.3).
 */
export function bannerAura(b: Balance, banner: Pick<Tower, 'type' | 'level' | 'form'>): { damageBP: number; speedBP: number } {
  const byLevel = b.towers[banner.type].auraDamageBPByLevel;
  if (!byLevel) return { damageBP: 0, speedBP: 0 };
  const f = formConfig(b, banner.type, banner.form);
  if (!f) return { damageBP: byLevel[Math.min(banner.level, byLevel.length) - 1]!, speedBP: 0 };
  // 2차형이 표를 물려받았으면 부모(1차형) 첫 레벨부터 이어 센다. 진화하면서 효과가 줄지 않게 한다.
  const own: FormConfig = banner.form === 'base' || banner.form === 'A' || banner.form === 'B' ? f : b.forms[banner.type][banner.form];
  const at = (key: 'auraDamageBPByLevel' | 'auraSpeedBPByLevel') => {
    const list = f[key];
    const from = b.levels.evolveAt[key in own ? formTier(banner.form) - 1 : 0]!;
    return list?.[Math.max(0, Math.min(banner.level - from, list.length - 1))] ?? 0;
  };
  return { damageBP: at('auraDamageBPByLevel'), speedBP: at('auraSpeedBPByLevel') };
}

/** 같은 종류의 깃발 효과는 범위 안 최고값 하나만(PRD §7.3). 깃발 자신·다른 깃발은 받지 않는다. */
function bestAura(b: Balance, towers: readonly Tower[], target: Tower, kind: 'damage' | 'speed'): number {
  if (!attacks(b, target.type)) return 0;
  let best = 0;
  for (const t of towers) {
    if (t.id === target.id || !b.towers[t.type].auraDamageBPByLevel || !auraReaches(b, t, target)) continue;
    const aura = bannerAura(b, t);
    best = Math.max(best, kind === 'damage' ? aura.damageBP : aura.speedBP);
  }
  return best;
}

/** ceil(기본틱 × 형태비 / (1 + 외부 속도)), 최소 간격 이상(PRD §20.2). */
export function attackIntervalTicks(b: Balance, stats: TowerStats, speedBonusBP: number): number {
  const speed = Math.min(b.externalCaps.attackSpeedBP, speedBonusBP);
  const ticks = ceilDiv(stats.baseIntervalTicks * stats.intervalBP, 10000 + speed);
  return Math.max(msToTicks(b.externalCaps.minAttackIntervalMs), ticks);
}

export const buildCost = (b: Balance, type: TowerId) => b.towers[type].cost;

/** level → level+1 비용. 설정 상한(levels.max)이거나 비용이 안전 정수를 넘는 레벨이면 null. */
export function upgradeCost(b: Balance, type: TowerId, level: number): number | null {
  if (b.levels.max !== null && level >= b.levels.max) return null;
  const base = b.towers[type].cost;
  const costBP = levelCostBP(b, level, base);
  return costBP === null ? null : round5Bp(base, costBP);
}

/**
 * 다음 강화가 진화면 고를 수 있는 형태 두 개, 아니면 null. 최고 레벨이면 null.
 * Lv3→4는 A·B, Lv6→7은 지금 길의 두 갈래(A→A1·A2, B→B1·B2)다(progression.md §1·§5).
 */
export function evolutionChoices(b: Balance, tower: Pick<Tower, 'type' | 'level' | 'form'>): FormId[] | null {
  if (upgradeCost(b, tower.type, tower.level) === null) return null;
  const next = tower.level + 1;
  if (next === b.levels.evolveAt[0] && tower.form === 'base') return ['A', 'B'];
  if (next === b.levels.evolveAt[1] && tower.form === 'A') return ['A1', 'A2'];
  if (next === b.levels.evolveAt[1] && tower.form === 'B') return ['B1', 'B2'];
  return null;
}

export const sellRefund = (b: Balance, tower: Pick<Tower, 'invested'>) => mulDivFloor(tower.invested, b.run.sellRatioBP, 10000, 'sell');

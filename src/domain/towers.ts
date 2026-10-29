import type { Balance, BranchConfig, BranchId, TowerId } from '../contracts/balance';
import { dist2 } from './geometry';
import { bpFloor, ceilDiv, msToTicks, mulDivFloor, round5Bp } from './num';
import type { Tower } from './types';

// 타워 수치 계산은 도메인과 화면이 같은 함수를 쓴다(PRD §10.1 단일 기준).
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
  /** 첫 대상 기절 틱(번개 B). */
  stunTicks: number;
  /** 석궁 A 관통: 두 번째 대상 피해 비율(0이면 없음)과 선분 폭. */
  pierceDamageBP: number;
  pierceWidth: number;
  /** 창병 A 긴 창: 선분 폭(0이면 없음). 길이는 사거리. */
  lineWidth: number;
}

export function branchOf(b: Balance, type: TowerId, branch: BranchId | null): BranchConfig | null {
  return branch ? (b.branches[type]?.[branch] ?? null) : null;
}

export function towerStats(b: Balance, type: TowerId, level: number, branch: BranchId | null): TowerStats {
  const t = b.towers[type];
  const br = branchOf(b, type, branch);
  let damage = bpFloor(t.damage * 1000, b.levels.damageMultiplierBP[level - 1]!, 'damage.level');
  if (br?.damageBP) damage = bpFloor(damage, br.damageBP, 'damage.branch');
  // 범위 공격 분기의 ‘각각 기본 피해의 N%’도 분기 배율로 한 단계 곱한다(PRD §7.3).
  if (br?.splashDamageBP) damage = bpFloor(damage, br.splashDamageBP, 'damage.splash');
  if (t.damageType === 'none') throw new Error(`${type}은 직접 공격 타워가 아니다`);
  return {
    damage,
    damageType: t.damageType,
    baseIntervalTicks: msToTicks(t.intervalMs),
    intervalBP: br?.intervalBP ?? 10000,
    range: t.rangeMilli + (br?.rangeAddMilli ?? 0),
    splashRadius: br?.splashRadiusMilli ?? t.splashRadiusMilli ?? 0,
    maxTargets: br?.maxTargets ?? t.maxTargets ?? 1,
    slowBP: br?.slowBP ?? t.slowBP ?? 0,
    slowTicks: msToTicks(br?.slowMs ?? t.slowMs ?? 0),
    projectileSpeed: t.projectileSpeedMilliPerSec ?? 10000,
    physicalResistIgnoreBP: br?.physicalResistIgnoreBP ?? t.physicalResistIgnoreBP ?? 0,
    instant: t.instant ?? false,
    chainFalloffBP: br?.chainFalloffBP ?? t.chainFalloffBP ?? 10000,
    chainRadius: t.chainRadiusMilli ?? 0,
    cone: coneOf(type, t.coneDegrees),
    // 화상 = Lv1 총피해 × 레벨 배율 × 화상 분기 배율(직접 피해 분기·깃발은 화상에 쓰지 않는다, PRD §20.2).
    burnTotal: t.burnTotal ? bpFloor(bpFloor(t.burnTotal * 1000, b.levels.damageMultiplierBP[level - 1]!, 'burn.level'), br?.burnBP ?? 10000, 'burn.branch') : 0,
    burnTicks: msToTicks(t.burnMs ?? 0),
    eliteBossDamageBP: br?.eliteBossDamageBP ?? 10000,
    stunTicks: msToTicks(br?.firstTargetStunMs ?? 0),
    pierceDamageBP: br?.pierceDamageBP ?? 0,
    pierceWidth: br?.pierceWidthMilli ?? 0,
    lineWidth: br?.lineWidthMilli ?? 0,
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

/** 화면의 범위 원: 공격 타워는 사거리, 깃발은 오라 반경(PRD §12.4). */
export const reachMilli = (b: Balance, type: TowerId, level: number, branch: BranchId | null) =>
  attacks(b, type) ? towerStats(b, type, level, branch).range : b.towers[type].rangeMilli;

/**
 * 깃발 오라의 직접 피해 보너스(PRD §7.1·§7.3·§20.2). 버프 범위는 타워 바닥 중심 간 거리로 판정하고,
 * 같은 종류의 깃발 효과는 최고값만, 전체 외부 피해 보너스는 상한까지만 준다. 깃발 자신·다른 깃발은 받지 않는다.
 */
export function auraDamageBonusBP(b: Balance, towers: readonly Tower[], target: Tower): number {
  return Math.min(bestAura(b, towers, target, 'damage'), b.externalCaps.damageBP);
}

/** 깃발 B(신속)의 공격 속도 보너스. 버닝과 합친 전체 상한은 attackIntervalTicks가 적용한다(PRD §7.3, §20.2). */
export const auraSpeedBonusBP = (b: Balance, towers: readonly Tower[], target: Tower) => bestAura(b, towers, target, 'speed');

/**
 * 깃발 한 기가 주는 효과: Lv1·2는 피해 보너스(타워 수치), Lv3부터는 분기 값이다.
 * A(용기)는 피해 보너스를 대체하고, B(신속)는 피해 보너스를 없애고 속도 보너스를 준다(PRD §7.3).
 */
export function bannerAura(b: Balance, banner: Pick<Tower, 'type' | 'level' | 'branch'>): { damageBP: number; speedBP: number } {
  const byLevel = b.towers[banner.type].auraDamageBPByLevel;
  if (!byLevel) return { damageBP: 0, speedBP: 0 };
  const br = branchOf(b, banner.type, banner.branch);
  const at = (list: number[] | undefined) => list?.[Math.min(banner.level - b.levels.branchAtLevel, list.length - 1)] ?? 0;
  if (banner.level < b.levels.branchAtLevel || !br) return { damageBP: byLevel[Math.min(banner.level, byLevel.length) - 1]!, speedBP: 0 };
  return { damageBP: at(br.auraDamageBPByLevel), speedBP: at(br.auraSpeedBPByLevel) };
}

/** 같은 종류의 깃발 효과는 범위 안 최고값 하나만(PRD §7.3). 깃발 자신·다른 깃발은 받지 않는다. */
function bestAura(b: Balance, towers: readonly Tower[], target: Tower, kind: 'damage' | 'speed'): number {
  if (!attacks(b, target.type)) return 0;
  let best = 0;
  for (const t of towers) {
    if (t.id === target.id || !b.towers[t.type].auraDamageBPByLevel) continue;
    const r = b.towers[t.type].rangeMilli;
    if (dist2(t.x, t.y, target.x, target.y) > r * r) continue;
    const aura = bannerAura(b, t);
    best = Math.max(best, kind === 'damage' ? aura.damageBP : aura.speedBP);
  }
  return best;
}

/** ceil(기본틱 × 분기비 / (1 + 외부 속도)), 최소 간격 이상(PRD §20.2). */
export function attackIntervalTicks(b: Balance, stats: TowerStats, speedBonusBP: number): number {
  const speed = Math.min(b.externalCaps.attackSpeedBP, speedBonusBP);
  const ticks = ceilDiv(stats.baseIntervalTicks * stats.intervalBP, 10000 + speed);
  return Math.max(msToTicks(b.externalCaps.minAttackIntervalMs), ticks);
}

export const buildCost = (b: Balance, type: TowerId) => b.towers[type].cost;

/** level → level+1 비용. 최대 레벨이면 null. */
export function upgradeCost(b: Balance, type: TowerId, level: number): number | null {
  if (level >= b.levels.max) return null;
  return round5Bp(b.towers[type].cost, b.levels.upgradeCostOfBaseBP[level - 1]!);
}

export const sellRefund = (b: Balance, tower: Pick<Tower, 'invested'>) => mulDivFloor(tower.invested, b.run.sellRatioBP, 10000, 'sell');

export const needsBranch = (b: Balance, level: number) => level + 1 === b.levels.branchAtLevel;

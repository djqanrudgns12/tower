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
}

export function branchOf(b: Balance, type: TowerId, branch: BranchId | null): BranchConfig | null {
  return branch ? (b.branches[type]?.[branch] ?? null) : null;
}

export function towerStats(b: Balance, type: TowerId, level: number, branch: BranchId | null): TowerStats {
  const t = b.towers[type];
  const br = branchOf(b, type, branch);
  let damage = bpFloor(t.damage * 1000, b.levels.damageMultiplierBP[level - 1]!, 'damage.level');
  if (br?.damageBP) damage = bpFloor(damage, br.damageBP, 'damage.branch');
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
    physicalResistIgnoreBP: t.physicalResistIgnoreBP ?? 0,
    instant: t.instant ?? false,
    chainFalloffBP: t.chainFalloffBP ?? 10000,
    chainRadius: t.chainRadiusMilli ?? 0,
    cone: coneOf(type, t.coneDegrees),
    burnTotal: t.burnTotal ? bpFloor(t.burnTotal * 1000, b.levels.damageMultiplierBP[level - 1]!, 'burn.level') : 0,
    burnTicks: msToTicks(t.burnMs ?? 0),
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

/**
 * 깃발 오라의 직접 피해 보너스(PRD §7.1·§7.3·§20.2). 버프 범위는 타워 바닥 중심 간 거리로 판정하고,
 * 같은 종류의 깃발 효과는 최고값만, 전체 외부 피해 보너스는 상한까지만 준다. 깃발 자신·다른 깃발은 받지 않는다.
 */
export function auraDamageBonusBP(b: Balance, towers: readonly Tower[], target: Tower): number {
  if (!attacks(b, target.type)) return 0;
  let best = 0;
  for (const t of towers) {
    const byLevel = b.towers[t.type].auraDamageBPByLevel;
    if (!byLevel || t.id === target.id) continue;
    const r = b.towers[t.type].rangeMilli;
    if (dist2(t.x, t.y, target.x, target.y) > r * r) continue;
    best = Math.max(best, byLevel[Math.min(t.level, byLevel.length) - 1]!);
  }
  return Math.min(best, b.externalCaps.damageBP);
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

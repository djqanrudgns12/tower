import type { Balance, BranchConfig, BranchId, TowerId } from '../contracts/balance';
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
  };
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

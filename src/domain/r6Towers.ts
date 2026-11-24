import type { Balance, FormConfig, TowerConfig, TowerId } from '../contracts/balance';
import { R6_TOWERS, type R6TowerId, type BalanceV2 } from '../contracts/balanceV2';

export const isR6Tower = (id: string): id is R6TowerId => R6_TOWERS.some((t) => t === id);
export function evolutionAt(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError('타워 레벨은 1~20입니다');
  const weapon = level >= 18 ? 3 : level >= 12 ? 2 : level >= 6 ? 1 : 0;
  return { stage: Math.floor(level / 2), weapon, material: (['steel', 'alloy', 'ceramic', 'gold'] as const)[weapon] };
}
export const towerArtKey = (id: R6TowerId, level: number) => `r6.tower.${id}.s${evolutionAt(level).stage}`;

export function towerDefinition(b: Balance, id: R6TowerId | TowerId): TowerConfig {
  if (!isR6Tower(id)) return b.towers[id];
  if (!b.r6 && id === 'mortar') return b.towers.mortar;
  if (!b.r6) throw new Error('현재 판에서 쓸 수 없는 타워입니다');
  return b.r6.base[id];
}

export interface WeaponProfile extends FormConfig {
  distribute?: boolean;
  slowPriority?: boolean;
  flatMagicIgnore?: number;
  aftershock?: { delayMs: number; damageBP: number };
  pulses?: { periodMs: number; damageBP: number; count: number };
}

export function weaponProfile(v: BalanceV2, id: R6TowerId, index: number): WeaponProfile {
  const t = v.towers;
  const row = { label: id, summary: id };
  switch (id) {
    case 'rail': {
      const w = t.rail.weapons[index]!;
      return {
        ...row,
        instant: true,
        damageBP: w.shotDamageBP ?? 10000,
        pierceCount: w.lineTargets - 1,
        pierceWidthMilli: w.lineWidthMilli,
        pierceDamageBP: w.lineTargets > 1 ? w.lineFalloffBP : 0,
        ...(w.shots > 1 && { burst: { count: w.shots, gapTicks: w.gapTicks, followDamageBP: w.followDamageBP } }),
      };
    }
    case 'mortar': {
      const w = t.mortar.weapons[index]!;
      return {
        ...row,
        splashRadiusMilli: w.radiusMilli,
        maxTargets: w.maxTargets,
        ...(w.aftershockBP && { aftershock: { delayMs: w.aftershockDelayMs, damageBP: w.aftershockBP } }),
        ...(w.zonePulses && { pulses: { periodMs: w.zonePeriodMs, damageBP: w.zoneDamageBP, count: w.zonePulses } }),
      };
    }
    case 'cryo': {
      const w = t.cryo.weapons[index]!;
      return {
        ...row,
        instant: true,
        ring: true,
        slowPriority: true,
        maxTargets: w.pulseTargets,
        slowBP: w.slowBP,
        slowMs: w.slowMs,
        ...(w.echoDelayMs && {
          burst: { count: 2, gapTicks: Math.ceil((w.echoDelayMs * 30) / 1000), followDamageBP: w.echoDamageBP },
        }),
      };
    }
    case 'prism': {
      const w = t.prism.weapons[index]!;
      return {
        ...row,
        instant: true,
        maxTargets: w.chainTargets,
        chainFalloffBP: w.chainFalloffBP,
        chainRadiusMilli: w.chainRadiusMilli,
        flatMagicIgnore: w.magicResistIgnoreBP,
      };
    }
    case 'hangar': {
      const w = t.hangar.weapons[index]!;
      return {
        ...row,
        instant: true,
        distribute: true,
        preferFlyer: true,
        flyerDamageBP: w.flyerDamageBP,
        ...(w.drones > 1 && {
          burst: { count: w.drones, gapTicks: w.launchGapTicks, followDamageBP: w.followDamageBP },
        }),
      };
    }
    case 'bastion': {
      const w = t.bastion.weapons[index]!;
      return {
        ...row,
        instant: true,
        ring: true,
        maxTargets: w.pushTargets,
        knockbackMilli: w.pushMilli,
        auraRadiusMilli: w.auraRadiusMilli,
        auraDamageBPByLevel: [w.auraDamageAddBP],
        auraSpeedBP: w.auraSpeedAddBP,
      };
    }
  }
}
export function r6Tables(v: BalanceV2) {
  const bases = {} as Record<R6TowerId, TowerConfig>;
  const profiles = {} as Record<R6TowerId, WeaponProfile[]>;
  for (const id of R6_TOWERS) {
    const { cost, damage, intervalMs, rangeMilli, damageType, canHitFlyer } = v.towers[id];
    bases[id] = {
      label: id,
      cost,
      damage,
      intervalMs,
      rangeMilli,
      damageType,
      canHitFlyer,
      ...(id === 'mortar' && { projectileSpeedMilliPerSec: v.towers.mortar.projectileSpeedMilliPerSec }),
    };
    profiles[id] = [0, 1, 2, 3].map((i) => weaponProfile(v, id, i));
  }
  return { base: bases, profiles };
}

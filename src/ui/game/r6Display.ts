import type { Balance, TowerId } from '../../contracts/balance';
import type { BalanceV2, RELICS, R6TowerId } from '../../contracts/balanceV2';
import { loadR6Theme } from '../../content/theme';
import { isR6Tower, towerDefinition } from '../../domain/r6Towers';
import { TOWER_COPY } from '../copy';

export const WEAPON_RANKS = ['I', 'II', 'III', 'IV'] as const;

const themes = new WeakMap<BalanceV2, ReturnType<typeof loadR6Theme>>();
export function battleTheme(rules: BalanceV2) {
  const theme = themes.get(rules) ?? loadR6Theme(rules);
  themes.set(rules, theme);
  return theme;
}

const roles: Record<R6TowerId, string> = {
  rail: '한 마리를 빠르게 공격',
  mortar: '포탄으로 여러 마리 공격',
  cryo: '주변 적의 이동 속도 감소',
  prism: '여러 적을 이어서 공격',
  hangar: '드론으로 공중 적 추적',
  bastion: '적을 밀고 주변 타워 지원',
};

export function battleTowerName(b: Balance, type: TowerId | R6TowerId) {
  return b.r6 && isR6Tower(type) ? battleTheme(b.r6.rules).towers[type].name : towerDefinition(b, type).label;
}

export function battleTowerRole(b: Balance, type: TowerId | R6TowerId) {
  if (b.r6 && isR6Tower(type)) return roles[type];
  return (TOWER_COPY[type as TowerId])?.role ?? '';
}

export function nextTowerUnlock(b: Balance, completedWave: number, available: readonly string[], owned: readonly string[]) {
  if (!b.r6) return null;
  for (const [wave, type] of Object.entries(b.r6.rules.unlocks.afterCompletedWave)) {
    if (Number(wave) > completedWave && available.includes(type) && !owned.includes(type)) return { wave: Number(wave), type };
  }
  return null;
}

export function relicEffectText(effect: BalanceV2['relics']['effects'][(typeof RELICS)[number]]) {
  const lines: string[] = [];
  const increase = (label: string, bp?: number) => { if (bp !== undefined) lines.push(`${label} +${(bp - 10000) / 100}%`); };
  increase('사거리', effect.rangeBP);
  increase('피해', effect.damageBP);
  increase('비행 적 피해', effect.flyerDamageBP);
  increase('감속 지속 시간', effect.slowMsBP);
  increase('정예·보스 피해', effect.eliteBossDamageBP);
  if (effect.burningAddMs) lines.push(`연속 정답 보너스 +${effect.burningAddMs / 1000}초`);
  if (effect.correctGoldAdd) lines.push(`정답 골드 +${effect.correctGoldAdd}`);
  if (effect.killGoldAdd) lines.push(`처치 골드 +${effect.killGoldAdd}`);
  if (effect.goldNow) lines.push(`즉시 +${effect.goldNow} 골드`);
  if (effect.sellRatioBP) lines.push(`판매 환급률 ${effect.sellRatioBP / 100}%`);
  if (effect.evolveCostBP) lines.push(`무기 단계 강화 비용 −${(10000 - effect.evolveCostBP) / 100}%`);
  if (effect.intervalBP) lines.push(`공격 간격 −${(10000 - effect.intervalBP) / 100}%`);
  if (effect.auraRangeAddMilli) lines.push(`지원 범위 +${effect.auraRangeAddMilli / 1000}칸`);
  return lines.join(' · ');
}

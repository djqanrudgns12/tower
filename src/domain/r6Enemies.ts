import type { BossSkill, EnemyKind } from '../contracts/balance';
import {
  entityId,
  FAMILIES,
  TIERS,
  type BalanceV2,
  type EntityId,
  type Lineage,
  type Species,
  type Tier,
} from '../contracts/balanceV2';
import { bpFloor } from './num';

export interface R6Entity {
  id: EntityId;
  species: Species;
  lineage: Lineage;
  tier: Tier;
  kind: EnemyKind;
  hpBP: number;
  speedBP: number;
  physicalResistBP: number;
  magicResistBP: number;
  flying: boolean;
  leakDamage: number;
  split?: { count: number; spreadMilli: number; childHpBP: number };
  regen?: { periodMs: number; healBP: number; times: number };
  boss?: { skill: BossSkill; hpScaleBP: number };
}
function bossRule(r: BalanceV2['enemies'], species: Species, tier: Tier): NonNullable<R6Entity['boss']> {
  const kind = r.bossByFaction[species][tier - 1]!;
  const skills = r.bossSkills;
  switch (kind) {
    case 'iron_stance':
      return { skill: { kind, ...skills[kind] }, hpScaleBP: skills[kind].hpScaleBP };
    case 'burst_march':
      return { skill: { kind, ...skills[kind] }, hpScaleBP: skills[kind].hpScaleBP };
    case 'rally_haste':
      return { skill: { kind, ...skills[kind] }, hpScaleBP: skills[kind].hpScaleBP };
    case 'snack_mend':
      return { skill: { kind, ...skills[kind] }, hpScaleBP: skills[kind].hpScaleBP };
    case 'ward_layers':
      return {
        skill: {
          kind,
          ...skills[kind],
          ...(species === 'stone' && tier === 3 && r.bossSkillOverrides['stone-boss-t3']),
        },
        hpScaleBP: skills[kind].hpScaleBP,
      };
    case 'call_escort':
      return {
        skill: {
          kind,
          ...skills[kind],
          escorts: Array.from({ length: skills[kind].escortCount }, () => 'walker' as const),
        },
        hpScaleBP: skills[kind].hpScaleBP,
      };
  }
}
export function expandEntities(v: BalanceV2) {
  const r = v.enemies;
  const entities = {} as Record<EntityId, R6Entity>;
  for (const species of r.factionOrder)
    for (const lineage of [...FAMILIES, 'boss' as const])
      for (const tier of TIERS) {
        const id = entityId(species, lineage, tier);
        const family = r.families[lineage],
          faction = r.factions[species];
        const stage =
          lineage === 'boss' ? { hpBP: r.bossTierHpBP[tier - 1]!, speedBP: 10000, resistAddBP: 0 } : r.tier[tier - 1]!;
        const special = lineage === 'special' ? r.specialByFaction[species] : undefined;
        const scale = (base: number, stageBP: number, factionBP: number, extra: number) =>
          bpFloor(
            bpFloor(bpFloor(base, stageBP, 'entity.stage'), factionBP, 'entity.faction'),
            extra,
            'entity.special',
          );
        const flying = !!special && 'flying' in special && special.flying;
        const kind: EnemyKind =
          lineage === 'boss'
            ? 'boss'
            : lineage === 'runner'
              ? 'runner'
              : lineage === 'armored'
                ? 'shell'
                : flying
                  ? 'flyer'
                  : special && 'splitCount' in special
                    ? 'splitter'
                    : 'walker';
        entities[id] = {
          id,
          species,
          lineage,
          tier,
          kind,
          flying,
          hpBP: scale(family.hpBP, stage.hpBP, faction.hpBP, special && 'hpBP' in special ? special.hpBP : 10000),
          speedBP: scale(
            family.speedBP,
            stage.speedBP,
            faction.speedBP,
            special && 'speedBP' in special ? special.speedBP : 10000,
          ),
          physicalResistBP: Math.min(
            r.resistCapBP,
            family.physicalResistBP + stage.resistAddBP + faction.physicalResistBP,
          ),
          magicResistBP: Math.min(r.resistCapBP, family.magicResistBP + stage.resistAddBP + faction.magicResistBP),
          leakDamage: special && 'leakDamage' in special ? special.leakDamage : v.leakDamage.regular,
          ...(special &&
            'splitCount' in special && {
              split: { count: special.splitCount, spreadMilli: special.spreadMilli, childHpBP: special.childHpBP },
            }),
          ...(special &&
            'regenPeriodMs' in special && {
              regen: { periodMs: special.regenPeriodMs, healBP: special.regenMaxHpBP, times: special.regenMaxTimes },
            }),
          ...(lineage === 'boss' && { boss: bossRule(r, species, tier) }),
        };
      }
  return entities;
}

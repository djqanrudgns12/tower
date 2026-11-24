import { z } from 'zod';
import { balanceSchema, BOSS_SKILL_KINDS, DIFFICULTY_IDS, difficultyRulesSchema, relicEffectSchema } from './balance';

export const R6_TOWERS = ['rail', 'mortar', 'cryo', 'prism', 'hangar', 'bastion'] as const;
export const SPECIES = ['elf', 'human', 'machine', 'insect', 'stone'] as const;
export const FAMILIES = ['infantry', 'runner', 'armored', 'special'] as const;
export const RELICS = ['arrow_range','sky_net','big_blast','frost_bead','hero_blade','ember_charm','wise_book','lucky_pouch','trade_seal','evolve_stone','quick_spring','tall_pole'] as const;
export type R6TowerId = typeof R6_TOWERS[number];
export type Species = typeof SPECIES[number];
export type Lineage = typeof FAMILIES[number] | 'boss';
export type Tier = 1 | 2 | 3 | 4;
export type EntityId = `${Species}-${Lineage}-t${Tier}`;
export const TIERS = [1,2,3,4] as const;
export const entityId = (species: Species, family: Lineage, tier: Tier): EntityId => `${species}-${family}-t${tier}`;
export const ENTITY_IDS = SPECIES.flatMap(s => [...FAMILIES, 'boss' as const].flatMap(f => TIERS.map(t => entityId(s, f, t))));

const n = z.int().min(0).max(1_000_000);
const pos = n.min(1);
const bp = n.max(100_000);
const share = n.max(10000);
const towerId = z.enum(R6_TOWERS);
const unit = z.strictObject({hpBP: pos, speedBP: pos, physicalResistBP: share, magicResistBP: share});
const four = <T extends z.ZodType>(item: T) => z.tuple([item,item,item,item]);
const tower = <T extends z.ZodType>(weapon: T) => z.strictObject({
  cost: pos, damage: pos, intervalMs: pos, rangeMilli: pos, damageType: z.enum(['physical','magic']),
  canHitFlyer: z.boolean(), weapons: four(weapon),
});
const shared = balanceSchema.shape;
const waves = shared.waves.omit({composition:true, invasion:true}).extend({
  bossIndexPercent: n.max(100), endlessEliteRate: shared.waves.shape.eliteRate,
}).strict();
const weightRow = four(n).refine(row => row.reduce((a,b) => a+b,0) === 100);
const band = z.strictObject({fromWave: pos, factions: pos.max(5), primaryWeight: pos, tierWeights: weightRow, familyWeights: weightRow});
const idsInOrder = <T extends string>(ids: readonly T[]) => z.array(z.enum(ids)).refine(arr => arr.join() === ids.join());
const levelsInOrder = (levels: number[]) => z.array(pos).refine(arr => arr.join() === levels.join());
const scaled = {hpScaleBP: pos};
export const balanceV2Schema = z.strictObject({
  schemaVersion: z.literal('2.0'), balanceVersion: z.literal('2.0.0'), prototypeMap: z.literal('garden_u'),
  units: z.strictObject({tickHz:z.literal(30),bpPerUnit:z.literal(10000),milliPerHp:z.literal(1000),milliPerCell:z.literal(1000)}),
  run: shared.run.strict(), burning: shared.burning.strict(), statusCaps: shared.statusCaps.strict(), externalCaps: shared.externalCaps.strict(),
  leakDamage: shared.leakDamage.strict(), difficulties: z.record(z.enum(DIFFICULTY_IDS),difficultyRulesSchema), waves, elites: shared.elites.strict(),
  levels: z.strictObject({max:z.literal(20), formAt:levelsInOrder([1,2,4,6,8,10,12,14,16,18,20]), weaponAt:levelsInOrder([1,6,12,18]),
    damageMultiplierBP:z.array(pos).length(20),upgradeCostOfBaseBP:z.array(pos).length(19)}),
  towers: z.strictObject({
    rail: tower(z.strictObject({shots:pos,gapTicks:n,followDamageBP:bp,shotDamageBP:bp.optional(),lineTargets:pos,lineWidthMilli:n,lineFalloffBP:share})),
    mortar: tower(z.strictObject({maxTargets:pos,radiusMilli:pos,aftershockDelayMs:n,aftershockBP:bp,zonePeriodMs:n,zonePulses:n,zoneDamageBP:bp})).extend({projectileSpeedMilliPerSec:pos}),
    cryo: tower(z.strictObject({pulseTargets:pos,slowBP:share,slowMs:pos,echoDelayMs:n,echoDamageBP:bp})),
    prism: tower(z.strictObject({chainTargets:pos,chainRadiusMilli:pos,chainFalloffBP:share,magicResistIgnoreBP:share})),
    hangar: tower(z.strictObject({drones:pos,launchGapTicks:n,followDamageBP:bp,flyerDamageBP:bp})),
    bastion: tower(z.strictObject({pushTargets:pos,pushMilli:n,auraRadiusMilli:pos,auraDamageAddBP:bp,auraSpeedAddBP:bp})),
  }),
  unlocks: z.strictObject({initial:idsInOrder(R6_TOWERS.slice(0,3)),afterCompletedWave:z.strictObject({'3':z.literal('prism'),'6':z.literal('hangar'),'9':z.literal('bastion')})}),
  enemies: z.strictObject({
    idPattern:z.literal('{species}-{lineage}-t{tier}'),familyOrder:idsInOrder(FAMILIES),factionOrder:idsInOrder(SPECIES),
    factions:z.record(z.enum(SPECIES),unit), families:z.record(z.enum([...FAMILIES,'boss']),unit),
    tier:four(z.strictObject({hpBP:pos,speedBP:pos,resistAddBP:share})),bossTierHpBP:four(pos),resistCapBP:share,
    specialByFaction:z.strictObject({
      elf:z.strictObject({flying:z.literal(true),leakDamage:pos}), human:z.strictObject({hpBP:pos,speedBP:pos,leakDamage:pos}),
      machine:z.strictObject({splitCount:pos,childHpBP:share,spreadMilli:n}),insect:z.strictObject({splitCount:pos,childHpBP:share,spreadMilli:n}),
      stone:z.strictObject({regenPeriodMs:pos,regenMaxHpBP:share,regenMaxTimes:pos}),
    }),
    bossSkills:z.strictObject({
      iron_stance:z.strictObject({...scaled,triggerBP:share,durationMs:pos,physicalBP:share}),
      burst_march:z.strictObject({...scaled,periodMs:pos,durationMs:pos,speedBP:bp}),
      call_escort:z.strictObject({...scaled,thresholdsBP:z.array(share).min(1),escortFamily:z.literal('infantry'),escortTier:z.literal(1),escortCount:pos,spreadMilli:n}),
      rally_haste:z.strictObject({...scaled,radiusMilli:pos,speedAddBP:bp}),
      ward_layers:z.strictObject({...scaled,layers:pos,capBP:share}), snack_mend:z.strictObject({...scaled,periodMs:pos,healBP:share,maxTimes:pos}),
    }),
    bossByFaction:z.record(z.enum(SPECIES),four(z.enum(BOSS_SKILL_KINDS))),
    bossSkillOverrides:z.strictObject({'stone-boss-t3':z.strictObject({layers:pos})}),
  }),
  mixer:z.strictObject({algorithm:z.literal('r6-mix-1'),bands:z.array(band).length(6),firstSeenEvery:z.literal(3),bossTierCycle:levelsInOrder([1,2,3,4])}),
  relics:z.strictObject({fromWave:pos,offerCount:pos,effects:z.record(z.enum(RELICS),relicEffectSchema.extend({towers:z.array(towerId).min(1).optional()}).strict())}),
}).superRefine((v, ctx) => {
  const bands = v.mixer.bands;
  if (bands.map(b => b.fromWave).join() !== '1,4,7,11,16,21' || bands.map(b => b.factions).join() !== '2,3,4,5,5,5')
    ctx.addIssue({code:'custom',path:['mixer','bands'],message:'편성 구간과 종족 수를 확인하세요'});
  if (v.enemies.bossByFaction.stone[2] !== 'ward_layers') ctx.addIssue({code:'custom',path:['enemies','bossSkillOverrides'],message:'겹방패 보정에는 해당 기술이 필요합니다'});
});
export type BalanceV2 = z.infer<typeof balanceV2Schema>;

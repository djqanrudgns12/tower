import { z } from 'zod';
import { BOSS_SKILL_KINDS, DIFFICULTY_IDS, ELITE_IDS } from '../../contracts/balance';
import { ENTITY_IDS, FAMILIES, RELICS, R6_TOWERS, SPECIES, type BalanceV2, type R6TowerId } from '../../contracts/balanceV2';
import data from './r6.ko.json';

const text = z.string().trim().min(1);
const named = z.strictObject({ name: text });
const described = named.extend({ summaryTemplate: text });
const ranks = ['I','II','III','IV'] as const;
const themeSchema = z.strictObject({
  locale: z.literal('ko'), themeId: text, towers: z.record(z.enum(R6_TOWERS),named),
  weapons: z.record(z.enum(R6_TOWERS),z.record(z.enum(ranks),described)),
  species: z.record(z.enum(SPECIES),named), lineages: z.record(z.enum([...FAMILIES,'boss']),named),
  entities: z.record(z.enum(ENTITY_IDS),named), bossSkills: z.record(z.enum(BOSS_SKILL_KINDS),named),
  elites: z.record(z.enum(ELITE_IDS),named), relics: z.record(z.enum(RELICS),described),
  difficulties: z.record(z.enum(DIFFICULTY_IDS),named.extend({hint:text})), maps:z.strictObject({garden_u:named}),
});
function interpolate(template: string, values: object) {
  return template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
    const value: unknown = Object.getOwnPropertyDescriptor(values,key)?.value;
    if (typeof value !== 'number') throw new Error(`알 수 없는 표시 값 ${key}`);
    return String(value);
  });
}

export function loadR6Theme(balance: BalanceV2, input: unknown = data) {
  const theme = themeSchema.parse(input);
  const weapon = (tower: R6TowerId, rank: typeof ranks[number]) => {
    const row = theme.weapons[tower][rank];
    return {name:row.name,summary:interpolate(row.summaryTemplate,balance.towers[tower].weapons[ranks.indexOf(rank)]!)};
  };
  for (const id of R6_TOWERS) for (const rank of ranks) weapon(id,rank);
  for (const id of RELICS) interpolate(theme.relics[id].summaryTemplate,balance.relics.effects[id]);
  return { ...theme, weapon };
}

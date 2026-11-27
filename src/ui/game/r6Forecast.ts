import type { R6Runtime } from '../../domain/r6Balance';
import type { Species } from '../../contracts/balanceV2';
import type { LineIconName } from '../icons/LineIcon';
import { previewR6Wave } from '../../domain/r6Mixer';
import { battleTheme } from './r6Display';

const COUNTER_HINT: Partial<Record<LineIconName, string>> = {
  'traits/armor': '레일·프리즘',
  'traits/ward': '곡사·방벽',
  'traits/fast': '냉각',
  'traits/flying': '격납고·레일',
  'traits/split': '곡사',
};

export function r6Forecast({ rules, entities }: R6Runtime, map: string, seed: number, wave: number) {
  const roster = previewR6Wave(rules, map, seed, wave);
  const theme = battleTheme(rules);
  const counts = new Map<Species, number>();
  const traits = new Set<LineIconName>();
  let boss = false;
  for (const enemy of roster) {
    counts.set(enemy.species, (counts.get(enemy.species) ?? 0) + 1);
    const entity = entities[enemy.id];
    boss ||= enemy.lineage === 'boss';
    if (entity.physicalResistBP > 0 || enemy.elite === 'armored') traits.add('traits/armor');
    if (entity.magicResistBP > 0) traits.add('traits/ward');
    if (enemy.lineage === 'runner' || enemy.elite === 'swift') traits.add('traits/fast');
    if (entity.flying) traits.add('traits/flying');
    if (entity.split) traits.add('traits/split');
    if (entity.regen) traits.add('traits/regen');
    if (entity.leakDamage > rules.leakDamage.regular) traits.add('traits/siege');
  }
  const counters = [...new Set([...traits].map(t => COUNTER_HINT[t]).filter((v): v is string => Boolean(v)))];
  return {
    total: roster.length,
    boss,
    traits: [...traits],
    counters,
    species: [...counts].map(([id, count]) => ({ id, count, name: theme.species[id].name })),
  };
}

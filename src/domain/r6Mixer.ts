import {
  entityId,
  TIERS,
  type BalanceV2,
  type EntityId,
  type Lineage,
  type Species,
  type Tier,
} from '../contracts/balanceV2';
import type { EliteId } from '../contracts/balance';
import { shuffle, intBelow } from './rng';
import { apportion } from './factions';

export interface MixedEnemy {
  species: Species;
  lineage: Lineage;
  tier: Tier;
  id: EntityId;
  elite: EliteId | null;
}
export function createWaveSequence(balance: BalanceV2, mapId: string, seed: number) {
  const { mixer, enemies, waves } = balance;
  const rng = (wave: number, name: string) => {
    const input = JSON.stringify([mixer.algorithm, balance.balanceVersion, mapId, seed >>> 0, wave, name]);
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(input)) hash = Math.imul(hash ^ byte, 16777619);
    return { s: hash >>> 0 || 0x6d2b79f5 };
  };
  const order = shuffle(rng(0, 'order'), [...enemies.factionOrder]);
  const make = (species: Species, lineage: Lineage, tier: Tier): MixedEnemy => ({
    species,
    lineage,
    tier,
    id: entityId(species, lineage, tier),
    elite: null,
  });
  const debut = new Map([
    [3, make(order[0]!, 'runner', 1)],
    [4, make(order[0]!, 'special', 1)],
    [6, make(order[1]!, 'special', 2)],
    [9, make(order[2]!, 'armored', 3)],
    [12, make(order[3]!, 'runner', 2)],
    [15, make(order[4]!, 'infantry', 3)],
    [18, make(order[0]!, 'special', 3)],
  ]);
  const reserve = order.flatMap((species) =>
    (['runner', 'special'] as const).map((family) => make(species, family, 4)),
  );
  shuffle(rng(0, 'reserve'), reserve).forEach((entry, i) => debut.set(21 + i * 3, entry));
  const unlockWave = new Map([...debut].map(([wave, entry]) => [entry.id, wave]));
  const endless = enemies.factionOrder.flatMap((species) =>
    enemies.familyOrder.map((family) => make(species, family, 4)),
  );
  const lastSeen = new Map<EntityId, number>();
  let wave = 0;
  return function nextWave() {
    wave++;
    const band = mixer.bands.findLast((row) => row.fromWave <= wave)!;
    const active = order.slice(0, band.factions);
    const primary = active[(wave - 1) % active.length];
    const boss = wave % waves.bossEveryWaves === 0;
    const c = waves.count;
    const total = Math.min(c.max, c.base + c.step * Math.floor((wave - 1) / c.stepEveryWaves));
    const n = total - Number(boss);
    const bySpecies = apportion(
      n,
      active.map((id) => (id === primary ? band.primaryWeight : 1)),
    );
    const byTier = apportion(n, band.tierWeights);
    const list: MixedEnemy[] = [];
    let pin = debut.get(wave);
    if (wave >= 51 && wave % mixer.firstSeenEvery === 0) {
      const age = (entry: MixedEnemy) => lastSeen.get(entry.id) ?? 0;
      pin = endless.reduce((oldest, entry) => (age(entry) < age(oldest) ? entry : oldest));
    }
    if (pin) {
      const i = active.indexOf(pin.species);
      bySpecies[i] = bySpecies[i]! - 1;
      byTier[pin.tier - 1] = byTier[pin.tier - 1]! - 1;
      list.push({ ...pin });
    }
    const tiers = byTier.flatMap((count, i) => Array<Tier>(count).fill(TIERS[i]!));
    shuffle(rng(wave, 'tiers'), tiers);
    const families = rng(wave, 'families');
    let slot = 0;
    active.forEach((species, i) => {
      for (let k = 0; k < bySpecies[i]!; k++) {
        const tier = tiers[slot++]!;
        const candidates = enemies.familyOrder.map((family) => make(species, family, tier));
        const weights = candidates.map((e, j) => (wave < (unlockWave.get(e.id) ?? 0) ? 0 : band.familyWeights[j]!));
        let pick = intBelow(
          families,
          weights.reduce((a, b) => a + b, 0),
        );
        const selected = weights.findIndex((weight) => (pick -= weight) < 0);
        list.push(candidates[selected]!);
      }
    });
    shuffle(rng(wave, 'spawn'), list);
    const rule = wave < waves.endlessEliteRate.fromWave ? waves.eliteRate : waves.endlessEliteRate;
    const rate = wave < rule.fromWave ? 0 : Math.min(rule.maxBP, rule.baseBP + rule.perWaveBP * (wave - rule.fromWave));
    const indices = shuffle(
      rng(wave, 'eliteSlots'),
      list.map((_, i) => i),
    );
    const kinds = rng(wave, 'eliteKinds');
    for (const index of indices.slice(0, Math.floor((n * rate) / 10000))) {
      list[index]!.elite = intBelow(kinds, 2) === 0 ? 'armored' : 'swift';
    }
    for (const entry of list) lastSeen.set(entry.id, wave);
    if (boss) {
      const j = wave / waves.bossEveryWaves - 1;
      const tier = mixer.bossTierCycle[j % mixer.bossTierCycle.length];
      list.splice(
        Math.floor((waves.bossIndexPercent * (total - 1)) / 100),
        0,
        make(order[j % order.length]!, 'boss', TIERS[tier! - 1]!),
      );
    }
    return list;
  };
}

/** 같은 입력의 새 사본을 돌려준다. 복원과 앞선 웨이브 예고도 캐시 유무에 상관없이 같다. */
const latest = new WeakMap<
  BalanceV2,
  { mapId: string; seed: number; next: () => MixedEnemy[]; wave: number; list: MixedEnemy[] }
>();
export function previewR6Wave(v: BalanceV2, mapId: string, seed: number, wave: number) {
  if (!Number.isSafeInteger(wave) || wave < 1) throw new RangeError('웨이브는 1 이상이어야 합니다');
  let cursor = latest.get(v);
  if (!cursor || cursor.mapId !== mapId || cursor.seed !== seed || cursor.wave > wave) {
    cursor = { mapId, seed, next: createWaveSequence(v, mapId, seed), wave: 0, list: [] };
    latest.set(v, cursor);
  }
  while (cursor.wave < wave) {
    cursor.list = cursor.next();
    cursor.wave++;
  }
  return cursor.list.map((e) => ({ ...e }));
}

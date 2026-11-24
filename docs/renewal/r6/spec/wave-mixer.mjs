// G0 편성 실행 예시. 난수·정수 배분은 제품 함수로 주입한다.
export function createWaveSequence(balance, mapId, seed, { shuffle, intBelow, apportion }) {
  const { mixer, enemies, waves } = balance;
  const rng = (wave, name) => {
    const input = JSON.stringify([mixer.algorithm, balance.balanceVersion, mapId, seed >>> 0, wave, name]);
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(input)) hash = Math.imul(hash ^ byte, 16777619);
    return { s: hash >>> 0 || 0x6d2b79f5 };
  };
  const order = shuffle(rng(0, 'order'), [...enemies.factionOrder]);
  const make = (species, lineage, tier) => ({ species, lineage, tier, id: `${species}-${lineage}-t${tier}`, elite: null });
  const debut = new Map([
    [3, make(order[0], 'runner', 1)], [4, make(order[0], 'special', 1)],
    [6, make(order[1], 'special', 2)], [9, make(order[2], 'armored', 3)],
    [12, make(order[3], 'runner', 2)], [15, make(order[4], 'infantry', 3)],
    [18, make(order[0], 'special', 3)],
  ]);
  const reserve = order.flatMap(species => ['runner', 'special'].map(family => make(species, family, 4)));
  shuffle(rng(0, 'reserve'), reserve).forEach((entry, i) => debut.set(21 + i * 3, entry));
  const unlockWave = new Map([...debut].map(([wave, entry]) => [entry.id, wave]));
  const endless = enemies.factionOrder.flatMap(species => enemies.familyOrder.map(family => make(species, family, 4)));
  const lastSeen = new Map();
  let wave = 0;
  return function nextWave() {
    wave++;
    const band = mixer.bands.findLast(row => row.fromWave <= wave);
    const active = order.slice(0, band.factions);
    const primary = active[(wave - 1) % active.length];
    const boss = wave % waves.bossEveryWaves === 0;
    const c = waves.count;
    const total = Math.min(c.max, c.base + c.step * Math.floor((wave - 1) / c.stepEveryWaves));
    const n = total - Number(boss);
    const bySpecies = apportion(n, active.map(id => id === primary ? band.primaryWeight : 1));
    const byTier = apportion(n, band.tierWeights);
    const list = [];
    let pin = debut.get(wave);
    if (wave >= 51 && wave % mixer.firstSeenEvery === 0) {
      const age = entry => lastSeen.get(entry.id) ?? 0;
      pin = endless.reduce((oldest, entry) => age(entry) < age(oldest) ? entry : oldest);
    }
    if (pin) {
      bySpecies[active.indexOf(pin.species)]--;
      byTier[pin.tier - 1]--;
      list.push({ ...pin });
    }
    const tiers = byTier.flatMap((count, i) => Array(count).fill(i + 1));
    shuffle(rng(wave, 'tiers'), tiers);
    const families = rng(wave, 'families');
    let slot = 0;
    active.forEach((species, i) => {
      for (let k = 0; k < bySpecies[i]; k++) {
        const tier = tiers[slot++];
        const candidates = enemies.familyOrder.map(family => make(species, family, tier));
        const weights = candidates.map((e, j) => wave < (unlockWave.get(e.id) ?? 0) ? 0 : band.familyWeights[j]);
        let pick = intBelow(families, weights.reduce((a, b) => a + b, 0));
        const selected = weights.findIndex(weight => (pick -= weight) < 0);
        list.push(candidates[selected]);
      }
    });
    shuffle(rng(wave, 'spawn'), list);
    const rule = wave < waves.endlessEliteRate.fromWave ? waves.eliteRate : waves.endlessEliteRate;
    const rate = wave < rule.fromWave ? 0 : Math.min(rule.maxBP, rule.baseBP + rule.perWaveBP * (wave - rule.fromWave));
    const indices = shuffle(rng(wave, 'eliteSlots'), list.map((_, i) => i));
    const kinds = rng(wave, 'eliteKinds');
    for (const index of indices.slice(0, Math.floor(n * rate / 10000))) {
      list[index].elite = intBelow(kinds, 2) === 0 ? 'armored' : 'swift';
    }
    for (const entry of list) lastSeen.set(entry.id, wave);
    if (boss) {
      const j = wave / waves.bossEveryWaves - 1;
      const tier = mixer.bossTierCycle[j % mixer.bossTierCycle.length];
      list.splice(Math.floor(waves.bossIndexPercent * (total - 1) / 100), 0, make(order[j % order.length], 'boss', tier));
    }
    return list;
  };
}

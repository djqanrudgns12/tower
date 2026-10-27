import { REGULAR_KINDS, type Balance, type DifficultyConfig, type EliteId, type EnemyKind } from '../contracts/balance';
import { bpCeil, mulDivCeil, mulDivFloor, msToTicks } from './num';
import { intBelow, shuffle, type Rng } from './rng';
import type { SpawnEntry } from './types';

// PRD §8.2~8.3, §20.4. 같은 seed·wave면 같은 편성이 나온다.
export function waveCount(b: Balance, wave: number): number {
  const c = b.waves.count;
  return Math.min(c.max, c.base + c.step * Math.floor((wave - 1) / c.stepEveryWaves));
}

export function spawnIntervalMs(b: Balance, wave: number): number {
  const s = b.waves.spawnIntervalMs;
  return s.overrides[String(wave)] ?? Math.max(s.min, s.base + s.perWave * (wave - 1));
}

export const spawnIntervalTicks = (b: Balance, wave: number) => msToTicks(spawnIntervalMs(b, wave));

/** 1웨이브 기준값에서 매 웨이브 ceil(이전×성장%/100). */
export function hpBaseMilli(b: Balance, wave: number): number {
  let hp = b.waves.baseHpMilli;
  for (let w = 2; w <= wave; w++) hp = mulDivCeil(hp, b.waves.hpGrowthPercent, 100, 'hpBase');
  return hp;
}

/** 난이도→종류→정예 순서로 한 단계씩 올림(PRD §8.2). */
export function enemyMaxHp(b: Balance, d: DifficultyConfig, baseMilli: number, kind: EnemyKind, elite: EliteId | null): number {
  let hp = bpCeil(baseMilli, d.enemyHpBP, 'hp.difficulty');
  hp = bpCeil(hp, b.enemies[kind].hpBP, 'hp.kind');
  if (elite) hp = bpCeil(hp, b.elites[elite].hpBP, 'hp.elite');
  return hp;
}

export function enemySpeedBP(b: Balance, kind: EnemyKind, elite: EliteId | null): number {
  return elite ? mulDivFloor(b.enemies[kind].speedBP, b.elites[elite].speedBP, 10000, 'speed') : b.enemies[kind].speedBP;
}

export function enemyResists(b: Balance, kind: EnemyKind, elite: EliteId | null) {
  const k = b.enemies[kind];
  const add = elite ? b.elites[elite].addPhysicalResistBP : 0;
  return { physical: Math.min(b.elites.physicalResistCapBP, k.physicalResistBP + add), magic: k.magicResistBP };
}

export function isMilestone(b: Balance, wave: number) {
  return wave % b.waves.bossEveryWaves === 0;
}

export function eliteRateBP(b: Balance, wave: number): number {
  const e = b.waves.eliteRate;
  return wave < e.fromWave ? 0 : Math.min(e.maxBP, e.baseBP + e.perWaveBP * (wave - e.fromWave));
}

/** 정수 배정(최대 나머지) → 섞기 → 정예 지정 → 보스 삽입. */
export function composeWave(b: Balance, wave: number, rng: Rng): SpawnEntry[] {
  const n = waveCount(b, wave);
  const boss = isMilestone(b, wave) ? 1 : 0;
  const regular = n - boss;
  const weights = [...b.waves.composition].filter(c => c.fromWave <= wave).sort((a, c) => a.fromWave - c.fromWave).at(-1)!.weights;
  const w = REGULAR_KINDS.map(k => weights[k] ?? 0);
  const total = w.reduce((a, x) => a + x, 0);
  const counts = w.map(x => Math.floor((regular * x) / total));
  const remainders = w.map((x, i) => ({ i, rem: (regular * x) % total })).sort((a, c) => c.rem - a.rem || a.i - c.i);
  let left = regular - counts.reduce((a, x) => a + x, 0);
  for (const r of remainders) {
    if (left <= 0) break;
    if (w[r.i]! > 0) { counts[r.i]!++; left--; }
  }
  const list: SpawnEntry[] = [];
  REGULAR_KINDS.forEach((kind, i) => { for (let k = 0; k < counts[i]!; k++) list.push({ kind, elite: null }); });
  shuffle(rng, list);
  const eliteCount = Math.floor((regular * eliteRateBP(b, wave)) / 10000);
  const order = shuffle(rng, list.map((_, i) => i)).slice(0, eliteCount);
  for (const idx of order) list[idx]!.elite = intBelow(rng, 2) === 0 ? 'armored' : 'swift';
  if (boss) list.splice(Math.floor((70 * (n - 1)) / 100), 0, { kind: 'boss', elite: null });
  return list;
}

import type { Balance, DifficultyConfig, EliteId, EnemyKind } from '../contracts/balance';
import { apportion, waveFactions, waveRoleWeights } from './factions';
import { bpCeil, mulDivCeil, mulDivFloor, msToTicks } from './num';
import { intBelow, shuffle, type Rng } from './rng';
import type { Enemy, SpawnEntry } from './types';

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

/** 난이도→종류→정예→대장 기믹 보정 순서로 한 단계씩 올림(PRD §8.2, monsters.md §0-4). */
export function enemyMaxHp(b: Balance, d: DifficultyConfig, baseMilli: number, kind: EnemyKind, elite: EliteId | null, bossScaleBP = 10000): number {
  let hp = bpCeil(baseMilli, d.enemyHpBP, 'hp.difficulty');
  hp = bpCeil(hp, b.enemies[kind].hpBP, 'hp.kind');
  if (elite) hp = bpCeil(hp, b.elites[elite].hpBP, 'hp.elite');
  if (bossScaleBP !== 10000) hp = bpCeil(hp, bossScaleBP, 'hp.bossScale');
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

/** 떠 있는 비행 적인가(끌어내린 동안은 아니다, towers.md §4-1). 판정(combat)과 렌더러(그림자·띄운 몸)가 같은 식을 쓴다. */
export const airborne = (e: Pick<Enemy, 'flying' | 'groundedUntilTick'>, tick: number) => e.flying && tick >= e.groundedUntilTick;

export function isMilestone(b: Balance, wave: number) {
  return wave % b.waves.bossEveryWaves === 0;
}

export function eliteRateBP(b: Balance, wave: number): number {
  const e = b.waves.eliteRate;
  return wave < e.fromWave ? 0 : Math.min(e.maxBP, e.baseBP + e.perWaveBP * (wave - e.fromWave));
}

/**
 * 정수 배정(최대 나머지) → 섞기 → 정예 지정 → 대장 삽입. 일반 적 수를 종족 비율로 먼저 나누고, 종족마다 같은 역할 가중치로 나눈다
 * (monsters.md §3). 난수 호출 수는 적 수로만 정해진다(종족·역할 구성이 바뀌어도 같은 seed의 호출 수는 같다).
 */
export function composeWave(b: Balance, mapId: string, wave: number, rng: Rng): SpawnEntry[] {
  const n = waveCount(b, wave);
  const plan = waveFactions(b, mapId, wave);
  const regular = n - (plan.boss ? 1 : 0);
  const roles = waveRoleWeights(b, mapId, wave);
  const byFaction = apportion(regular, plan.shares.map(x => x.shareBP));
  const list: SpawnEntry[] = [];
  plan.shares.forEach((share, i) => {
    const counts = apportion(byFaction[i]!, roles.map(r => r.weight));
    roles.forEach((r, j) => { for (let k = 0; k < counts[j]!; k++) list.push({ kind: r.kind, elite: null, faction: share.faction, bossTier: null }); });
  });
  shuffle(rng, list);
  const eliteCount = Math.floor((regular * eliteRateBP(b, wave)) / 10000);
  const order = shuffle(rng, list.map((_, i) => i)).slice(0, eliteCount);
  for (const idx of order) list[idx]!.elite = intBelow(rng, 2) === 0 ? 'armored' : 'swift';
  if (plan.boss) list.splice(Math.floor((70 * (n - 1)) / 100), 0, { kind: 'boss', elite: null, faction: plan.boss.faction, bossTier: plan.boss.tier });
  return list;
}

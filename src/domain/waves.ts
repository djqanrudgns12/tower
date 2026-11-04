import { REGULAR_KINDS, type Balance, type DifficultyConfig, type EliteId, type EnemyKind, type RegularKind } from '../contracts/balance';
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

/**
 * 웨이브 총 HP의 기준이 되는 적 수(prd-r4 §7.2 A). count.hpReference가 있으면 그 증가 폭(base·max는 같다)으로 센 수, 없으면 편성 수.
 * 1웨이브는 언제나 base라 편성 수와 같다.
 */
export function hpReferenceCount(b: Balance, wave: number): number {
  const c = b.waves.count;
  if (!c.hpReference) return waveCount(b, wave);
  return Math.min(c.max, c.base + c.hpReference.step * Math.floor((wave - 1) / c.hpReference.stepEveryWaves));
}

/** 초반 완충 배율(BP, prd-r4 §7.2 A). 표 밖 웨이브는 10000. */
export const earlyHpBP = (b: Balance, wave: number): number => b.waves.earlyHpBP?.[wave - 1] ?? 10000;

/**
 * 전투에서 쓰는 웨이브 기준 HP(milli): 115% 점화식(hpBaseMilli, 사용자 확정) → 줄인 적 수만큼 개체 HP로 옮김(기준 수/편성 수, 올림)
 * → 초반 완충(올림). 웨이브 총 HP는 기준 수로 센 옛 편성과 같고, 초반 완충 웨이브만 그만큼 낮다.
 */
export function waveHpBaseMilli(b: Balance, wave: number): number {
  let hp = hpBaseMilli(b, wave);
  const n = waveCount(b, wave), ref = hpReferenceCount(b, wave);
  if (ref !== n) hp = mulDivCeil(hp, ref, n, 'hpBase.carry');
  const early = earlyHpBP(b, wave);
  if (early !== 10000) hp = bpCeil(hp, early, 'hpBase.early');
  return hp;
}

/**
 * 웨이브 wave의 난이도 HP 배율(BP). enemyHpRamp가 있으면 1웨이브 fromBP에서 waves웨이브에 걸쳐 enemyHpBP까지 선형(0 쪽 버림)으로 오르고,
 * 없으면 enemyHpBP 그대로다(prd-r4 §7.1 어려움·아주 어려움 1웨이브).
 */
export function difficultyHpBP(d: DifficultyConfig, wave: number): number {
  const r = d.enemyHpRamp;
  if (!r) return d.enemyHpBP;
  const step = Math.min(Math.max(0, wave - 1), r.waves);
  return r.fromBP + Math.trunc(((d.enemyHpBP - r.fromBP) * step) / r.waves);
}

/**
 * 난이도→종류→정예→대장 기믹 보정 순서로 한 단계씩 올림(PRD §8.2, monsters.md §0-4). difficultyBP는 그 웨이브의 난이도 배율
 * (difficultyHpBP)이고, 생략하면 d.enemyHpBP다.
 */
export function enemyMaxHp(b: Balance, d: DifficultyConfig, baseMilli: number, kind: EnemyKind, elite: EliteId | null, bossScaleBP = 10000, difficultyBP = d.enemyHpBP): number {
  let hp = bpCeil(baseMilli, difficultyBP, 'hp.difficulty');
  hp = bpCeil(hp, b.enemies[kind].hpBP, 'hp.kind');
  if (elite) hp = bpCeil(hp, b.elites[elite].hpBP, 'hp.elite');
  if (bossScaleBP !== 10000) hp = bpCeil(hp, bossScaleBP, 'hp.bossScale');
  return hp;
}

/** 성문 누출 피해: 대장·정예는 leakDamage 표, 일반은 역할의 leakDamage(없으면 표의 regular). R4 B2.5에서 비행은 2다. */
export function leakDamageOf(b: Balance, e: Pick<Enemy, 'kind' | 'elite'>): number {
  if (e.kind === 'boss') return b.leakDamage.boss;
  if (e.elite) return b.leakDamage.elite;
  return b.enemies[e.kind].leakDamage ?? b.leakDamage.regular;
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
 * 한 종족 몫 n마리를 역할에 나눈다(REGULAR_KINDS 순서의 [역할, 수]). 하늘 떼 특성(prd-r4 §7.2 E, trait flyers)이 붙은 웨이브면 먼저 비행 몫
 * (flyerShareBP)을 떼고 나머지를 비행이 아닌 역할의 가중치로 나눈다. 그 밖은 역할 가중치 그대로다. 난수를 쓰지 않는다.
 */
export function factionRoleCounts(b: Balance, faction: string, wave: number, n: number, roles: ReadonlyArray<{ kind: RegularKind; weight: number }>): Array<[RegularKind, number]> {
  const t = b.factions[faction]?.trait;
  if (t?.kind !== 'flyers' || wave < t.fromWave) {
    const counts = apportion(n, roles.map(r => r.weight));
    return roles.map((r, j) => [r.kind, counts[j]!]);
  }
  const [ground, air] = apportion(n, [10000 - t.flyerShareBP, t.flyerShareBP]) as [number, number];
  const groundRoles = roles.filter(r => r.kind !== 'flyer');
  const counts = apportion(ground, groundRoles.map(r => r.weight));
  const byKind = new Map<RegularKind, number>(groundRoles.map((r, j) => [r.kind, counts[j]!]));
  byKind.set('flyer', air);
  return REGULAR_KINDS.filter(k => byKind.has(k)).map(k => [k, byKind.get(k)!]);
}

/**
 * 정수 배정(최대 나머지) → 섞기 → 정예 지정 → 대장 삽입. 일반 적 수를 종족 비율로 먼저 나누고, 종족마다 같은 역할 가중치로 나눈다
 * (monsters.md §3, 하늘 떼 특성은 factionRoleCounts). 난수 호출 수는 적 수로만 정해진다(종족·역할 구성이 바뀌어도 같은 seed의 호출 수는 같다).
 */
export function composeWave(b: Balance, mapId: string, wave: number, rng: Rng): SpawnEntry[] {
  const n = waveCount(b, wave);
  const plan = waveFactions(b, mapId, wave);
  const regular = n - (plan.boss ? 1 : 0);
  const roles = waveRoleWeights(b, mapId, wave);
  const byFaction = apportion(regular, plan.shares.map(x => x.shareBP));
  const list: SpawnEntry[] = [];
  plan.shares.forEach((share, i) => {
    for (const [kind, count] of factionRoleCounts(b, share.faction, wave, byFaction[i]!, roles)) {
      for (let k = 0; k < count; k++) list.push({ kind, elite: null, faction: share.faction, bossTier: null });
    }
  });
  shuffle(rng, list);
  const eliteCount = Math.floor((regular * eliteRateBP(b, wave)) / 10000);
  const order = shuffle(rng, list.map((_, i) => i)).slice(0, eliteCount);
  for (const idx of order) list[idx]!.elite = intBelow(rng, 2) === 0 ? 'armored' : 'swift';
  if (plan.boss) list.splice(Math.floor((70 * (n - 1)) / 100), 0, { kind: 'boss', elite: null, faction: plan.boss.faction, bossTier: plan.boss.tier });
  return list;
}

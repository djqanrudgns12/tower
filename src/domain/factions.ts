import { BOSS_RANKS, REGULAR_KINDS, type ArtRole, type Balance, type BossTier, type CampaignConfig, type EnemyKind, type RegularKind } from '../contracts/balance';
import type { Enemy } from './types';

// 종족(faction) × 역할(role) 편성(docs/renewal/catalog/monsters.md §0·§2·§3). 규칙은 역할이 정하고 종족은 이름·그림만 바꾼다.
// 같은 balance·map·wave면 같은 종족 비율·역할 가중치가 나온다(난수 없음).

/** 맵의 원정 편성. 편성이 없는 맵이면 던진다(content 시험이 모든 맵을 확인한다). */
export function campaignOf(b: Balance, mapId: string): CampaignConfig {
  const c = b.campaigns[mapId];
  if (!c) throw new Error(`원정 편성이 없는 맵: ${mapId}`);
  return c;
}

/** 대장 단계의 그림·이름 키(1단 → boss5 … 4단 → boss20). */
export const bossRank = (tier: BossTier) => BOSS_RANKS[tier - 1]!;

/** 적 하나의 그림·이름 키: 일반 역할은 그 역할, 대장은 boss5~boss20. */
export function artRoleOf(e: Pick<Enemy, 'kind' | 'bossTier'>): ArtRole {
  if (e.kind === 'boss') return bossRank(e.bossTier ?? 1);
  return e.kind;
}

/**
 * 렌더러가 쓸 그림 id: `<종족 artPrefix>.<역할 또는 boss5~boss20>`(예: acorn.runner, river.boss10).
 * 종족 팩의 artAlias가 있으면 그 id를 대신 쓴다(예: 정원 보병 acorn.walker → 기존 enemy.walker).
 */
export function enemyArtId(b: Balance, e: Pick<Enemy, 'kind' | 'faction' | 'bossTier'>): string {
  const f = b.factions[e.faction];
  if (!f) throw new Error(`없는 종족: ${e.faction}`);
  const role = artRoleOf(e);
  return f.artAlias?.[role] ?? `${f.artPrefix}.${role}`;
}

/** 화면용 이름(도감·대장 등장 알림). 종족 표에 이름이 없으면 null(비행·분열 개체는 그림 생산 때 이름을 더한다). */
export function enemyName(b: Balance, e: Pick<Enemy, 'kind' | 'faction' | 'bossTier'>): string | null {
  return b.factions[e.faction]?.names?.[artRoleOf(e)] ?? null;
}

export interface FactionShare { faction: string; shareBP: number }
export interface WaveFactions {
  /** 일반 적을 나눌 종족과 비율(합 10000). 첫 줄이 주력 종족이다. */
  shares: FactionShare[];
  /** 대장 웨이브면 대장의 종족과 단계. */
  boss: { faction: string; tier: BossTier } | null;
}

/**
 * 웨이브의 종족 비율과 대장(monsters.md §3). 20웨이브까지는 주력 종족만, 5웨이브마다 그 종족의 1~4단 대장이 나온다.
 * invasion.fromWave부터는 blockWaves 묶음마다 invasionOrder의 다음 종족이 침입하고, 대장 웨이브의 대장은 침입 종족이다.
 */
export function waveFactions(b: Balance, mapId: string, wave: number): WaveFactions {
  const c = campaignOf(b, mapId);
  const inv = b.waves.invasion;
  const milestone = wave % b.waves.bossEveryWaves === 0;
  if (wave < inv.fromWave) {
    const tier = Math.min(4, Math.max(1, Math.floor(wave / b.waves.bossEveryWaves))) as BossTier;
    return { shares: [{ faction: c.primary, shareBP: 10000 }], boss: milestone ? { faction: c.primary, tier } : null };
  }
  const k = wave - inv.fromWave;
  const block = Math.floor(k / inv.blockWaves);
  const order = c.invasionOrder;
  const first = order[block % order.length]!;
  const boss = milestone ? { faction: first, tier: inv.bossTiers[block % inv.bossTiers.length]! } : null;
  if (block >= inv.alliance.fromBlock) {
    const second = order[(block + inv.alliance.secondOffset) % order.length]!;
    const rest = 10000 - inv.alliance.primaryShareBP;
    const shares = second === first
      ? [{ faction: c.primary, shareBP: inv.alliance.primaryShareBP }, { faction: first, shareBP: rest }]
      : [{ faction: c.primary, shareBP: inv.alliance.primaryShareBP }, { faction: first, shareBP: rest - Math.floor(rest / 2) }, { faction: second, shareBP: Math.floor(rest / 2) }];
    return { shares, boss };
  }
  const invaderBP = inv.invaderShareBPByOffset[k % inv.blockWaves]!;
  return { shares: [{ faction: c.primary, shareBP: 10000 - invaderBP }, { faction: first, shareBP: invaderBP }], boss };
}

/** 웨이브의 역할 가중치(REGULAR_KINDS 순서, 0인 역할은 뺀다). slotWeights[i]는 맵 roleOrder[i] 역할이다. */
export function waveRoleWeights(b: Balance, mapId: string, wave: number): Array<{ kind: RegularKind; weight: number }> {
  const c = campaignOf(b, mapId);
  const row = [...b.waves.composition].filter(x => x.fromWave <= wave).sort((a, x) => a.fromWave - x.fromWave).at(-1)!;
  const weights = new Map<EnemyKind, number>();
  row.slotWeights.forEach((w, i) => weights.set(c.roleOrder[i]!, (weights.get(c.roleOrder[i]!) ?? 0) + w));
  for (const [kind, w] of Object.entries(row.roleWeights ?? {})) weights.set(kind as RegularKind, (weights.get(kind as RegularKind) ?? 0) + w);
  return REGULAR_KINDS.map(kind => ({ kind, weight: weights.get(kind) ?? 0 })).filter(x => x.weight > 0);
}

/** 정수 배정(최대 나머지): 내림한 뒤 남은 자리를 나머지가 큰 순(같으면 앞 순서)으로 가중치가 있는 칸에 하나씩. */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, x) => a + x, 0);
  if (sum <= 0) return weights.map(() => 0);
  const counts = weights.map(x => Math.floor((total * x) / sum));
  const remainders = weights.map((x, i) => ({ i, rem: (total * x) % sum })).sort((a, c) => c.rem - a.rem || a.i - c.i);
  let left = total - counts.reduce((a, x) => a + x, 0);
  for (const r of remainders) {
    if (left <= 0) break;
    if (weights[r.i]! > 0) { counts[r.i]!++; left--; }
  }
  return counts;
}

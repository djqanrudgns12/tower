import { TOWER_IDS, type Balance, type RegularKind, type TowerId } from '../contracts/balance';
import type { DomainEvent } from './events';
import { waveRoleWeights } from './factions';
import { shuffle } from './rng';
import type { DraftOffer, RunConfig, RunState } from './types';

// 판 안 징집(docs/renewal/catalog/towers.md §0-2·§5 안 1). 기본 4종으로 시작하고 정한 웨이브를 지킬 때마다 새 타워 하나를 고른다.
// 후보는 징집 전용 난수 흐름으로 뽑아 전투 편성·출제 순서를 바꾸지 않는다.

/** 시작 장착함: balance의 시작 타워 가운데 이 판이 쓸 수 있는 것(순서 유지). */
export const startingOwned = (b: Balance, config: Pick<RunConfig, 'availableTowers'>): TowerId[] =>
  b.draft.startTowers.filter(t => config.availableTowers.includes(t));

/** 장착함(화면의 타워 버튼 줄). */
export const ownedTowers = (s: Pick<RunState, 'owned'>): readonly TowerId[] => s.owned;

/** 고르기를 기다리는 징집 후보, 없으면 null. */
export const draftOffer = (s: Pick<RunState, 'draft'>): DraftOffer | null => s.draft;

/** 아직 징집으로 얻을 수 있는 타워(그 판이 쓸 수 있고 장착함에 없는 것, TOWER_IDS 순서). */
export const draftPool = (s: Pick<RunState, 'owned' | 'config'>): TowerId[] =>
  TOWER_IDS.filter(t => s.config.availableTowers.includes(t) && !s.owned.includes(t));

/** 다음 징집이 열리는 웨이브(그 웨이브를 지킨 뒤). 장착함이 차거나 후보가 없거나 남은 징집이 없으면 null. */
export function nextDraftWave(b: Balance, s: Pick<RunState, 'owned' | 'config' | 'completedWave'>): number | null {
  if (s.owned.length >= b.draft.maxOwned || draftPool(s).length === 0) return null;
  return b.draft.afterWaves.find(w => w > s.completedWave) ?? null;
}

/** 장착함에 넣고 후보를 닫는다. */
export function pickDraft(s: RunState, tower: TowerId, auto: boolean, ev: DomainEvent[]) {
  s.owned.push(tower);
  s.draft = null;
  ev.push({ type: 'draftPicked', tower, auto });
}

/**
 * 대응 보장 대상(prd-r4 §7.2 C): 웨이브 wave를 지킨 뒤 draft.counterLookahead웨이브 안에 처음 나오는 역할 가운데, 장착함에
 * 그 역할의 강점 타워(draft.counters)가 하나도 없는 첫 역할(웨이브 순, 같으면 REGULAR_KINDS 순)과 그 강점 타워 목록. 없으면 null.
 * 순수 함수다(편성 표만 본다).
 */
export function uncoveredNewRole(b: Balance, mapId: string, wave: number, owned: readonly TowerId[]): { role: RegularKind; wave: number; towers: TowerId[] } | null {
  const counters = b.draft.counters, lookahead = b.draft.counterLookahead ?? 0;
  if (!counters || lookahead <= 0 || !b.campaigns[mapId]) return null;
  const seen = new Set<RegularKind>();
  for (let w = 1; w <= wave; w++) for (const r of waveRoleWeights(b, mapId, w)) seen.add(r.kind);
  for (let w = wave + 1; w <= wave + lookahead; w++) {
    for (const r of waveRoleWeights(b, mapId, w)) {
      if (seen.has(r.kind)) continue;
      seen.add(r.kind);
      const towers = counters[r.kind];
      if (towers && !towers.some(t => owned.includes(t))) return { role: r.kind, wave: w, towers: [...towers] };
    }
  }
  return null;
}

/**
 * 웨이브를 지킨 직후 부른다. 징집 웨이브면 후보 offerCount종을 연다. 앞 후보를 아직 고르지 않았으면 첫 후보로 먼저 정한다
 * (화면이 징집 카드를 띄우지 못해도 판이 멈추거나 징집을 잃지 않는다).
 */
export function openDraft(b: Balance, s: RunState, ev: DomainEvent[]) {
  if (!b.draft.afterWaves.includes(s.wave)) return;
  if (s.draft) pickDraft(s, s.draft.offers[0]!, true, ev);
  if (s.owned.length >= b.draft.maxOwned) return;
  const pool = draftPool(s);
  if (pool.length === 0) return;
  const rng = { s: s.rng.draft };
  const shuffled = shuffle(rng, pool);
  const offers = shuffled.slice(0, b.draft.offerCount);
  s.rng.draft = rng.s;
  // 대응 보장: 곧 처음 나오는 역할의 강점 타워가 장착함에도 후보에도 없으면 마지막 후보를 섞인 순서의 첫 강점 타워로 바꾼다(난수 추가 없음).
  const need = uncoveredNewRole(b, s.config.mapId, s.wave, s.owned);
  if (need && !offers.some(t => need.towers.includes(t))) {
    const counter = shuffled.find(t => need.towers.includes(t));
    if (counter) offers[offers.length - 1] = counter;
  }
  s.draft = { wave: s.wave, offers };
  ev.push({ type: 'draftOffered', wave: s.wave, offers: [...offers] });
}

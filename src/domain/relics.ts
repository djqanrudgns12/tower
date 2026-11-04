import { TOWER_IDS, type Balance, type RelicConfig, type RelicEffect } from '../contracts/balance';
import type { GameContext } from './context';
import type { DomainEvent } from './events';
import { add, bpFloor } from './num';
import { streamSeed, shuffle } from './rng';
import type { RunState } from './types';

// 원정 보물(prd-r4 §7.2-F, R4 B3). W10부터 대장 웨이브(10·15·20…)를 지키면 갖지 않은 보물 3개 가운데 하나를 고른다.
// 효과는 그 판에서만 있고, 고른 보물 목록으로 만든 밸런스 사본(relicBalance)을 엔진·화면이 함께 읽는다. 그래서 화면의 값(강화비·판매 환급·
// 정답 골드·사거리 원)과 엔진 판정이 어긋나지 않는다. 후보는 seed·웨이브로 정한 보물 전용 난수로 뽑아 다른 난수 흐름을 바꾸지 않는다.

/** 계약의 보물 id(표 순서). 보물이 없는 밸런스면 빈 목록. */
export const relicIds = (b: Balance): string[] => Object.keys(b.relics?.items ?? {});

/** 보물 하나의 정의. 없는 id면 null. */
export const relicDef = (b: Balance, id: string): RelicConfig | null => b.relics?.items[id] ?? null;

/** 이 판에서 고른 보물(옛 상태는 없음). */
export const ownedRelics = (s: Pick<RunState, 'relics'>): readonly string[] => s.relics ?? [];

const scale = (v: number, bp: number) => bpFloor(v, bp, 'relic');

/** 보물 효과 하나를 밸런스 사본(깊은 복사본)에 적용한다. 같은 보물 목록이면 같은 결과다(목록을 정렬해 적용한다). */
function applyEffect(d: Balance, e: RelicEffect) {
  for (const type of e.towers ?? []) {
    const t = d.towers[type];
    const forms = Object.values(d.forms[type]);
    if (e.rangeBP !== undefined) {
      t.rangeMilli = scale(t.rangeMilli, e.rangeBP);
      for (const f of forms) if (f.rangeAddMilli !== undefined) f.rangeAddMilli = scale(f.rangeAddMilli, e.rangeBP);
    }
    if (e.damageBP !== undefined) t.damageBP = scale(t.damageBP ?? 10000, e.damageBP);
    if (e.intervalBP !== undefined) t.intervalMs = Math.max(1, scale(t.intervalMs, e.intervalBP));
    if (e.auraRangeAddMilli !== undefined) {
      t.rangeMilli += e.auraRangeAddMilli;
      if (t.auraRadiusMilli !== undefined) t.auraRadiusMilli += e.auraRangeAddMilli;
      for (const f of forms) if (f.auraRadiusMilli !== undefined) f.auraRadiusMilli += e.auraRangeAddMilli;
    }
  }
  for (const type of TOWER_IDS) {
    const t = d.towers[type];
    if (t.damageType === 'none') continue;
    const forms = Object.values(d.forms[type]);
    // 상황 배율은 형태 값이 타워 값을 덮으므로(effectsFor) 타워 값과 형태가 적은 값 모두에 한 번씩 곱한다.
    if (e.flyerDamageBP !== undefined) {
      t.flyerDamageBP = scale(t.flyerDamageBP ?? 10000, e.flyerDamageBP);
      for (const f of forms) if (f.flyerDamageBP !== undefined) f.flyerDamageBP = scale(f.flyerDamageBP, e.flyerDamageBP);
    }
    if (e.eliteBossDamageBP !== undefined) {
      t.eliteBossDamageBP = scale(t.eliteBossDamageBP ?? 10000, e.eliteBossDamageBP);
      for (const f of forms) if (f.eliteBossDamageBP !== undefined) f.eliteBossDamageBP = scale(f.eliteBossDamageBP, e.eliteBossDamageBP);
    }
    if (e.slowMsBP !== undefined) {
      for (const x of [t, ...forms]) {
        if (x.slowMs !== undefined) x.slowMs = scale(x.slowMs, e.slowMsBP);
        if (x.eliteSlowMs !== undefined) x.eliteSlowMs = scale(x.eliteSlowMs, e.slowMsBP);
        if (x.bossSlowMs !== undefined) x.bossSlowMs = scale(x.bossSlowMs, e.slowMsBP);
        if (x.onHitSplash?.slowMs !== undefined) x.onHitSplash = { ...x.onHitSplash, slowMs: scale(x.onHitSplash.slowMs, e.slowMsBP) };
      }
    }
  }
  if (e.burningAddMs !== undefined) d.burning.durationMs += e.burningAddMs;
  for (const diff of Object.values(d.difficulties)) {
    if (e.correctGoldAdd !== undefined) diff.correctGold += e.correctGoldAdd;
    if (e.killGoldAdd !== undefined) diff.killGold = { regular: diff.killGold.regular + e.killGoldAdd, elite: diff.killGold.elite + e.killGoldAdd, boss: diff.killGold.boss + e.killGoldAdd };
  }
  if (e.sellRatioBP !== undefined) d.run.sellRatioBP = Math.max(d.run.sellRatioBP, e.sellRatioBP);
  if (e.evolveCostBP !== undefined) {
    const table = [...d.levels.upgradeCostOfBaseBP];
    for (const at of d.levels.evolveAt) if (table[at - 2] !== undefined) table[at - 2] = Math.max(1, scale(table[at - 2]!, e.evolveCostBP));
    d.levels.upgradeCostOfBaseBP = table;
  }
}

const balanceCache = new WeakMap<Balance, Map<string, Balance>>();

/**
 * 고른 보물을 적용한 밸런스 사본(R4 B3). 보물이 없으면 원본 그대로다. 같은 원본·같은 보물 목록이면 같은 객체를 돌려준다
 * (타워 수치 기억 towerStats가 객체별이라 틱마다 다시 만들지 않는다). 모르는 id는 무시한다.
 */
export function relicBalance(b: Balance, relics: readonly string[] | undefined): Balance {
  const ids = (relics ?? []).filter(id => b.relics?.items[id]);
  if (ids.length === 0) return b;
  const key = [...ids].sort().join('|');
  let byKey = balanceCache.get(b);
  if (!byKey) { byKey = new Map(); balanceCache.set(b, byKey); }
  let derived = byKey.get(key);
  if (!derived) {
    derived = structuredClone(b);
    for (const id of [...ids].sort()) applyEffect(derived, b.relics!.items[id]!.effect);
    byKey.set(key, derived);
  }
  return derived;
}

const contextCache = new WeakMap<GameContext, Map<string, GameContext>>();

/** 이 판의 보물을 적용한 문맥(balance·difficulty만 바뀐다). 보물이 없으면 ctx 그대로. 엔진의 명령·틱 처리가 이 문맥으로 돈다. */
export function relicContext(ctx: GameContext, s: Pick<RunState, 'relics'>): GameContext {
  const relics = s.relics;
  if (!relics || relics.length === 0) return ctx;
  const balance = relicBalance(ctx.balance, relics);
  if (balance === ctx.balance) return ctx;
  const key = [...relics].sort().join('|');
  let byKey = contextCache.get(ctx);
  if (!byKey) { byKey = new Map(); contextCache.set(ctx, byKey); }
  let derived = byKey.get(key);
  if (!derived) {
    derived = { ...ctx, balance, difficulty: balance.difficulties[ctx.difficultyId] };
    byKey.set(key, derived);
  }
  return derived;
}

/** 보물 후보 난수의 시작 상태: seed와 웨이브로 정한다(판 상태에 난수 상태를 두지 않아 다른 흐름이 밀리지 않는다). */
export const relicSeed = (seed: number, wave: number) => streamSeed((seed ^ Math.imul(wave, 0x9e3779b1)) >>> 0, 'relic');

/** 웨이브 wave의 보물 후보: 갖지 않은 보물(표 순서)을 보물 난수로 섞어 앞에서 offerCount개. 순수 함수다. */
export function relicOfferFor(b: Balance, seed: number, wave: number, owned: readonly string[]): string[] {
  const rule = b.relics;
  if (!rule) return [];
  const pool = relicIds(b).filter(id => !owned.includes(id));
  return shuffle({ s: relicSeed(seed >>> 0, wave) }, pool).slice(0, rule.offerCount);
}

/** 이 웨이브를 지키면 보물을 고르는가: fromWave 이상의 대장 웨이브. */
export const relicWave = (b: Balance, wave: number): boolean =>
  b.relics !== undefined && wave >= b.relics.fromWave && wave % b.waves.bossEveryWaves === 0;

/**
 * 보물을 갖고 후보를 닫는다. auto는 고르지 않은 채 다음 보물 웨이브가 와서 첫 후보로 정해진 경우다. 고르는 순간 받는 골드(goldNow)가 있으면
 * 여기서 한 번 준다(다른 효과는 밸런스 사본이 맡는다).
 */
export function pickRelic(b: Balance, s: RunState, id: string, auto: boolean, ev: DomainEvent[]) {
  const gold = b.relics?.items[id]?.effect.goldNow ?? 0;
  const totals = { gold: add(s.gold, gold, 'gold'), earned: add(s.stats.goldEarned, gold) };
  s.relics = [...(s.relics ?? []), id];
  s.relicOffer = null;
  s.gold = totals.gold;
  s.stats.goldEarned = totals.earned;
  ev.push({ type: 'relicPicked', relic: id, auto, gold });
}

/**
 * 웨이브를 지킨 직후 부른다(징집 다음). 보물 웨이브면 후보를 연다. 앞 후보를 아직 고르지 않았으면 첫 후보로 먼저 정한다
 * (화면이 창을 띄우지 못해도 판이 멈추거나 보물을 잃지 않는다). 남은 보물이 없으면 열지 않는다.
 */
export function openRelicOffer(b: Balance, s: RunState, ev: DomainEvent[]) {
  if (!relicWave(b, s.wave)) return;
  if (s.relicOffer) pickRelic(b, s, s.relicOffer.offers[0]!, true, ev);
  const offers = relicOfferFor(b, s.config.seed, s.wave, ownedRelics(s));
  if (offers.length === 0) return;
  s.relicOffer = { wave: s.wave, offers };
  ev.push({ type: 'relicOffered', wave: s.wave, offers: [...offers] });
}

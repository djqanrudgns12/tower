import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type Balance, type TowerId } from '../../src/contracts/balance';
import { BALANCE } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { factionRoleCounts } from '../../src/domain/waves';
import { center, dist2, positionAt } from '../../src/domain/geometry';
import { applyCommand, nextCorrectGold, streakBonusGold, type Command } from '../../src/domain/run';
import { ownedRelics, relicBalance, relicContext, relicIds, relicOfferFor, relicWave } from '../../src/domain/relics';
import { burrowSpan, burrowed, clayReductionMilli, enemyTrait, factionTrait } from '../../src/domain/traits';
import { buildCost, foeTags, matchupBP, sellRefund, towerStats, upgradeCost } from '../../src/domain/towers';
import type { Enemy, RunState, TrapHazard } from '../../src/domain/types';
import { waveFactions, waveRoleWeights } from '../../src/domain/factions';
import { composeWave, hpBaseMilli } from '../../src/domain/waves';
import { answerCurrent, finishPrep, newRun, ok, ticks } from './helpers';
import { enemy } from './review-core/fixtures';

// R4 B3 후반 변화·한 판 더(prd-r4 §7.2 E·F): 침입 종족 특성 4종, 원정 보물 12개, 연속 정답 보너스(계약 선택).

const hits = (ev: DomainEvent[]) => ev.flatMap(e => (e.type === 'hit' ? [[e.enemyId, e.damage] as const] : []));

/** 정원 맵, 모든 타워를 갖고 거래 단계에서 지은 뒤 빈 전투로 들어간다(적은 시험이 직접 놓는다). */
function arena(towers: Array<[TowerId, string]>, wave = 16, ctxOverride?: (ctx: GameContext) => GameContext) {
  const run = newRun('Normal', 7);
  const ctx = ctxOverride ? ctxOverride(run.ctx) : run.ctx;
  const s = run.s;
  finishPrep(ctx, s);
  s.config.availableTowers = [...TOWER_IDS];
  s.owned = [...TOWER_IDS];
  s.gold = 100000;
  s.wave = wave;
  for (const [type, slotId] of towers) ok(ctx, s, { type: 'build', slotId, tower: type });
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  for (const t of s.towers) if (t.nextAttackTick !== null) t.nextAttackTick = s.tick + 1;
  return { ctx, s };
}

/** 경로 진행도 p에 가장 가까운 설치 칸. */
function slotNear(ctx: GameContext, p: number): string {
  const at = positionAt(ctx.path, p);
  return [...ctx.map.slots].sort((a, b) => dist2(center(a.x), center(a.y), at.x, at.y) - dist2(center(b.x), center(b.y), at.x, at.y))[0]!.id;
}

/** 움직이지 않게 기절시켜 둔 적. */
const still = (o: Partial<Enemy> & { progress: number }): Enemy => enemy({ id: 100, hp: 5_000_000, maxHp: 5_000_000, stunUntilTick: 10_000_000, ...o });

describe('종족 특성(prd-r4 §7.2 E)', () => {
  it('네 침입 종족에 특성이 하나씩, W16부터 붙고 주력 종족에는 없다', () => {
    expect(factionTrait(BALANCE, 'honey_beetle', 16)?.kind).toBe('shell');
    expect(factionTrait(BALANCE, 'kiln_pottery', 16)?.kind).toBe('clay');
    expect(factionTrait(BALANCE, 'brass_mole', 16)?.kind).toBe('burrow');
    expect(factionTrait(BALANCE, 'breeze_corsair', 16)?.kind).toBe('flyers');
    expect(factionTrait(BALANCE, 'brass_mole', 15)).toBeNull();
    for (const f of ['acorn_goblin', 'river_rafter', 'moon_dokkaebi', 'hearth_yeti']) expect(factionTrait(BALANCE, f, 30)).toBeNull();
    // 대장은 특성이 없고(기믹 6종 그대로), 비행 적은 땅굴을 파지 않는다.
    expect(enemyTrait(BALANCE, 'brass_mole', 'boss', 20)).toBeNull();
    expect(enemyTrait(BALANCE, 'brass_mole', 'flyer', 20)).toBeNull();
    expect(enemyTrait(BALANCE, 'brass_mole', 'walker', 20)?.kind).toBe('burrow');
  });

  it('특성 표지: 등껍질 → shell(이미 단단한 적이면 한 번), 흙 보호막 → clay, 땅굴 → burrow, 하늘 떼는 표지 없음', () => {
    expect(foeTags({ kind: 'walker', elite: null, trait: 'shell' })).toEqual(['walker', 'shell']);
    expect(foeTags({ kind: 'shell', elite: 'armored', trait: 'shell' })).toEqual(['shell', 'elite']);
    expect(foeTags({ kind: 'runner', elite: null, trait: 'clay' })).toEqual(['runner', 'clay']);
    expect(foeTags({ kind: 'walker', elite: null, trait: 'burrow' })).toEqual(['walker', 'burrow']);
    expect(foeTags({ kind: 'walker', elite: null, trait: 'flyers' })).toEqual(['walker']);
    // 대응 타워의 상성 배율이 바로 작동한다(화차·투석·노포 ↔ 흙 보호막, 덫·약병·박격포 ↔ 땅굴).
    expect(matchupBP(BALANCE, 'hwacha', 'base', { kind: 'walker', elite: null, trait: 'clay' })).toBe(13000);
    expect(matchupBP(BALANCE, 'mortar', 'base', { kind: 'walker', elite: null, trait: 'burrow' })).toBe(13000);
    expect(matchupBP(BALANCE, 'mage', 'base', { kind: 'walker', elite: null, trait: 'shell' })).toBe(13000);
  });

  it('하늘 떼: 하늘유랑단 몫의 40%가 비행이고, 특성이 없는 웨이브·종족의 편성은 예전과 같다', () => {
    // 강가 맵은 16웨이브에 하늘유랑단이 먼저 침입한다.
    const plan = waveFactions(BALANCE, 'river_z', 16);
    expect(plan.shares.map(x => x.faction)).toEqual(['river_rafter', 'breeze_corsair']);
    const list = composeWave(BALANCE, 'river_z', 16, { s: 1 });
    const corsair = list.filter(e => e.faction === 'breeze_corsair');
    const air = corsair.filter(e => e.kind === 'flyer').length;
    expect(air).toBe(Math.round(corsair.length * 0.4));
    // 특성이 없는 종족은 역할 가중치 그대로(최대 나머지 배정).
    const roles = waveRoleWeights(BALANCE, 'river_z', 16);
    const plain = factionRoleCounts(BALANCE, 'river_rafter', 16, 10, roles);
    expect(plain.map(([k]) => k)).toEqual(roles.map(r => r.kind));
    // 15웨이브 이전에는 하늘유랑단이어도 특성이 없다.
    expect(factionRoleCounts(BALANCE, 'breeze_corsair', 15, 10, roles)).toEqual(plain);
  });

  it('등껍질: 물리 저항 +20%, 정예와 합쳐 50% 상한', () => {
    const { ctx, s } = arena([]);
    const spawnOne = (kind: Enemy['kind'], elite: Enemy['elite']) => {
      s.battle!.spawnList = [{ kind, elite, faction: 'honey_beetle', bossTier: null }];
      s.battle!.spawnIndex = 0;
      s.battle!.nextSpawnTick = s.tick + 1;
      ticks(ctx, s, 1);
      return s.enemies.at(-1)!;
    };
    expect(spawnOne('walker', null)).toMatchObject({ trait: 'shell', physicalResistBP: 2000 });
    expect(spawnOne('shell', null).physicalResistBP).toBe(5000);
    expect(spawnOne('walker', 'armored').physicalResistBP).toBe(4000);
    expect(spawnOne('shell', 'armored').physicalResistBP).toBe(BALANCE.elites.physicalResistCapBP);
  });

  it('흙 보호막: 타격마다 그 웨이브 기준 체력 × 2.5%를 막고(최소 1), 화차는 절반만 막힌다', () => {
    const R = clayReductionMilli(BALANCE, { kind: 'clay', fromWave: 16, reductionBP: 250, counterKeepBP: 5000 }, 16);
    expect(R).toBe(Math.floor((hpBaseMilli(BALANCE, 16) * 250) / 10000));
    const trial = (type: TowerId) => {
      // 정원 맵 (8,2) 칸 둘레: 1행 길의 진행도 7900 적은 사거리 안이다(flyer-splitter.test.ts).
      const { ctx, s } = arena([[type, ctx0().map.slots.find(x => x.x === 8 && x.y === 2)!.id]]);
      s.enemies = [still({ progress: 7900, faction: 'kiln_pottery', trait: 'clay', clayMilli: R })];
      return hits(ticks(ctx, s, 120))[0]?.[1];
    };
    // 궁수 Lv1 8 HP < 막는 양: 1 milli-HP만 들어간다(한 방이 약한 연사형에 불리).
    expect(trial('archer')).toBe(1);
    // 화차: 10 HP × 상성 1.3 − 막는 양의 절반.
    expect(trial('hwacha')).toBe(13000 - Math.floor(R / 2));
    // 노포 강타: 35 HP × 1.3에서 절반만 막힌다(노포도 흙 보호막에 강하다).
    expect(trial('ballista')).toBe(45500 - Math.floor(R / 2));
  });

  it('땅굴: 경로 45% 지점부터 기본 속도 1.5초 구간에서 겨냥 공격의 표적이 안 되고, 바닥 덫은 맞는다', () => {
    const ctx = ctx0();
    const t = BALANCE.factions.brass_mole!.trait!;
    if (t.kind !== 'burrow') throw new Error('두더지단 특성');
    const [lo, hi] = burrowSpan(BALANCE, ctx.path, t);
    expect(lo).toBe(Math.floor((ctx.path.length * 4500) / 10000));
    expect(hi - lo).toBe(Math.floor((ctx.path.length * 45) / BALANCE.waves.baseTravelTicks));
    const mole = (progress: number): Enemy => still({ progress, faction: 'brass_mole', trait: 'burrow' });
    expect(burrowed(BALANCE, ctx.path, mole(lo))).toBe(true);
    expect(burrowed(BALANCE, ctx.path, mole(hi))).toBe(false);
    expect(burrowed(BALANCE, ctx.path, { ...mole(lo), flying: true })).toBe(false);

    const mid = Math.floor((lo + hi) / 2);
    const under = arena([['archer', slotNear(ctx, mid)]]);
    under.s.enemies = [mole(mid)];
    expect(ticks(under.ctx, under.s, 90).filter(e => e.type === 'fire')).toHaveLength(0);
    // 같은 자리여도 땅 위(구간 밖)면 쏜다.
    const above = arena([['archer', slotNear(ctx, mid)]]);
    above.s.enemies = [still({ progress: mid, faction: 'brass_mole' })];
    expect(hits(ticks(above.ctx, above.s, 90)).length).toBeGreaterThan(0);
    // 덫(바닥)은 땅속 적도 밟으면 터진다.
    const trap = arena([]);
    trap.s.enemies = [mole(mid)];
    const p = positionAt(trap.ctx.path, mid);
    const strike = { towerId: 999, towerType: 'trap' as const, damage: 16000, damageType: 'physical' as const, slowBP: 0, slowTicks: 0, physicalResistIgnoreBP: 0, bonusBP: 0, eliteBossDamageBP: 10000, canHitFlyer: false, flyerDamageBP: 10000 };
    const h: TrapHazard = { kind: 'trap', id: 1, towerId: 999, towerType: 'trap', x: p.x, y: p.y, createdTick: 0, expiresTick: null, charges: 1, maxTargets: 1, strike, progress: mid, radius: 350, blastRadius: 0, aftershock: null };
    trap.s.hazards = [h];
    expect(hits(ticks(trap.ctx, trap.s, 2)).map(x => x[0])).toEqual([100]);
  });

  it('특성은 W16부터 생성되는 적에게만 붙고 대장에게는 붙지 않는다(실제 편성)', () => {
    const { ctx, s } = arena([], 20);
    s.battle!.spawnList = composeWave(ctx.balance, ctx.map.id, 20, { s: 5 });
    s.battle!.spawnIndex = 0;
    s.battle!.intervalTicks = 1;
    s.battle!.nextSpawnTick = s.tick + 1;
    ticks(ctx, s, s.battle!.spawnList.length + 1);
    const invader = waveFactions(BALANCE, ctx.map.id, 20).shares[1]!.faction;
    const trait = factionTrait(BALANCE, invader, 20)!.kind;
    const spawned = s.enemies;
    expect(spawned.some(e => e.faction === invader)).toBe(true);
    for (const e of spawned) {
      if (e.kind === 'boss' || e.faction !== invader || (trait === 'burrow' && e.flying)) expect(e.trait, `${e.kind}/${e.faction}`).toBeUndefined();
      else expect(e.trait).toBe(trait);
    }
  });
});

let ctxCache: GameContext | null = null;
function ctx0(): GameContext {
  ctxCache ??= newRun('Normal', 7).ctx;
  return ctxCache;
}

/** 웨이브 wave를 막 지킨 상태로 만든다(빈 전투를 한 틱 진행). */
function clearWave(ctx: GameContext, s: RunState, wave: number): DomainEvent[] {
  if (s.phase !== 'BUILD') finishPrep(ctx, s);
  s.wave = wave;
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnList = [];
  s.battle!.spawnIndex = 0;
  return ticks(ctx, s, 1);
}

/** 마무리 문항이 남았으면 답해서 다음 준비 문제로 간다. */
function toPrep(ctx: GameContext, s: RunState) {
  for (let i = 0; i < 10 && s.phase !== 'PREP_QUIZ'; i++) answerCurrent(ctx, s, 'correct');
  expect(s.phase).toBe('PREP_QUIZ');
}

describe('원정 보물(prd-r4 §7.2-F)', () => {
  it('12개, W10부터 대장 웨이브마다 3개 후보', () => {
    expect(relicIds(BALANCE)).toHaveLength(12);
    expect([5, 9, 10, 11, 15, 20, 25].filter(w => relicWave(BALANCE, w))).toEqual([10, 15, 20, 25]);
    expect(Object.values(BALANCE.relics!.items).every(r => r.summary.length <= 20)).toBe(true);
  });

  it('후보는 seed·웨이브로 정해지고(갖지 않은 것만) 다른 난수 흐름을 바꾸지 않는다', () => {
    const a = relicOfferFor(BALANCE, 7, 10, []);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(relicOfferFor(BALANCE, 7, 10, [])).toEqual(a);
    expect(relicOfferFor(BALANCE, 7, 15, a).some(id => a.includes(id))).toBe(false);
    const seeds = new Set(Array.from({ length: 20 }, (_, i) => relicOfferFor(BALANCE, i + 1, 10, []).join(',')));
    expect(seeds.size).toBeGreaterThan(10);

    const { ctx, s } = newRun('Normal', 7);
    const without = newRun('Normal', 7, undefined);
    const plain = { ...without.ctx, balance: { ...without.ctx.balance, relics: undefined } as Balance };
    const ev = clearWave(ctx, s, 10);
    clearWave(plain, without.s, 10);
    expect(ev.find(e => e.type === 'relicOffered')).toEqual({ type: 'relicOffered', wave: 10, offers: a });
    expect(s.relicOffer).toEqual({ wave: 10, offers: a });
    expect(without.s.relicOffer).toBeUndefined();
    expect(s.rng).toEqual(without.s.rng);
  });

  it('고르기: 후보만 받고, 고르지 않으면 다음 보물 웨이브에 첫 후보로 정해진다', () => {
    const { ctx, s } = newRun('Normal', 7);
    clearWave(ctx, s, 10);
    const offers = s.relicOffer!.offers;
    const notOffered = relicIds(BALANCE).find(id => !offers.includes(id))!;
    expect(applyFail(ctx, s, { type: 'relicPick', relic: notOffered })).toBe('INVALID_RELIC');
    const ev = ok(ctx, s, { type: 'relicPick', relic: offers[1]! });
    const gold = BALANCE.relics!.items[offers[1]!]!.effect.goldNow ?? 0;
    expect(ev).toEqual([{ type: 'relicPicked', relic: offers[1], auto: false, gold }]);
    expect(ownedRelics(s)).toEqual([offers[1]]);
    expect(s.relicOffer).toBeNull();
    expect(applyFail(ctx, s, { type: 'relicPick', relic: offers[0]! })).toBe('NO_RELIC_OFFER');

    // 15웨이브 후보를 고르지 않고 20웨이브를 지키면 15웨이브 첫 후보가 자동으로 들어온다.
    toPrep(ctx, s);
    clearWave(ctx, s, 15);
    const first = s.relicOffer!.offers[0]!;
    toPrep(ctx, s);
    const ev20 = clearWave(ctx, s, 20);
    expect(ev20).toContainEqual({ type: 'relicPicked', relic: first, auto: true, gold: BALANCE.relics!.items[first]!.effect.goldNow ?? 0 });
    expect(ownedRelics(s)).toEqual([offers[1], first]);
    expect(s.relicOffer!.offers).not.toContain(first);
  });

  it('보물 12개의 효과가 밸런스 사본에 들어가고 원본은 그대로다', () => {
    const before = JSON.stringify(BALANCE);
    const with1 = (id: string) => relicBalance(BALANCE, [id]);
    expect(towerStats(with1('arrow_range'), 'archer', 1, 'base').range).toBe(Math.floor(BALANCE.towers.archer.rangeMilli * 1.15));
    expect(towerStats(with1('arrow_range'), 'cannon', 1, 'base').range).toBe(BALANCE.towers.cannon.rangeMilli);
    expect(towerStats(with1('sky_net'), 'archer', 1, 'base').flyerDamageBP).toBe(12500);
    expect(towerStats(with1('big_blast'), 'cannon', 1, 'base').damage).toBe(Math.floor(towerStats(BALANCE, 'cannon', 1, 'base').damage * 1.15));
    expect(towerStats(with1('big_blast'), 'archer', 1, 'base').damage).toBe(towerStats(BALANCE, 'archer', 1, 'base').damage);
    expect(with1('frost_bead').towers.frost.slowMs).toBe(Math.floor(BALANCE.towers.frost.slowMs! * 1.4));
    expect(towerStats(with1('hero_blade'), 'archer', 1, 'base').eliteBossDamageBP).toBe(12000);
    expect(with1('ember_charm').burning.durationMs).toBe(BALANCE.burning.durationMs + 3000);
    expect(with1('wise_book').difficulties.Normal.correctGold).toBe(BALANCE.difficulties.Normal.correctGold + 3);
    expect(with1('lucky_pouch').difficulties.Normal.killGold).toEqual({ regular: BALANCE.difficulties.Normal.killGold.regular + 1, elite: BALANCE.difficulties.Normal.killGold.elite + 1, boss: BALANCE.difficulties.Normal.killGold.boss + 1 });
    expect(sellRefund(with1('trade_seal'), { invested: 100 })).toBe(80);
    // 상인 도장은 고르는 순간 골드 +100(그 판의 보물 골드로 센다).
    const run = newRun('Normal', 7);
    run.s.relicOffer = { wave: 10, offers: ['trade_seal', 'wise_book', 'sky_net'] };
    const g0 = run.s.gold;
    ok(run.ctx, run.s, { type: 'relicPick', relic: 'trade_seal' });
    expect(run.s.gold - g0).toBe(100);
    expect(upgradeCost(with1('evolve_stone'), 'archer', 3)).toBeLessThan(upgradeCost(BALANCE, 'archer', 3)!);
    expect(upgradeCost(with1('evolve_stone'), 'archer', 2)).toBe(upgradeCost(BALANCE, 'archer', 2));
    expect(upgradeCost(with1('evolve_stone'), 'archer', 6)).toBeLessThan(upgradeCost(BALANCE, 'archer', 6)!);
    expect(with1('quick_spring').towers.trap.intervalMs).toBe(Math.floor(BALANCE.towers.trap.intervalMs * 0.75));
    expect(with1('tall_pole').towers.banner.rangeMilli).toBe(BALANCE.towers.banner.rangeMilli + 1000);
    expect(buildCost(with1('trade_seal'), 'archer')).toBe(buildCost(BALANCE, 'archer'));
    expect(JSON.stringify(BALANCE)).toBe(before);
    // 같은 보물 목록(순서 무관)이면 같은 사본·같은 문맥.
    expect(relicBalance(BALANCE, ['wise_book', 'sky_net'])).toBe(relicBalance(BALANCE, ['sky_net', 'wise_book']));
    expect(relicBalance(BALANCE, [])).toBe(BALANCE);
    const ctx = ctx0();
    expect(relicContext(ctx, { relics: ['wise_book'] })).toBe(relicContext(ctx, { relics: ['wise_book'] }));
    expect(relicContext(ctx, {})).toBe(ctx);
  });

  it('엔진이 보물 사본으로 돈다: 정답 골드 +3이 채점과 화면 값에 같이 들어간다', () => {
    const { ctx, s } = newRun('Normal', 7);
    const base = nextCorrectGold(ctx, s);
    s.relics = ['wise_book'];
    expect(nextCorrectGold(ctx, s)).toBe(base + 3);
    const goldBefore = s.gold;
    answerCurrent(ctx, s, 'correct');
    expect(s.gold - goldBefore).toBe(base + 3);
  });
});

describe('연속 정답 보너스(R4 B3 실험 채택, run.answerStreakBonus)', () => {
  const without = (ctx: GameContext): GameContext => {
    const balance = structuredClone(ctx.balance);
    delete balance.run.answerStreakBonus;
    return { ...ctx, balance, difficulty: balance.difficulties[ctx.difficultyId] };
  };

  it('계약 값: 연속마다 +3, 상한 24(9번째 정답부터, R4 마지막 조정)', () => {
    expect(BALANCE.run.answerStreakBonus).toEqual({ goldPerStreak: 3, maxGold: 24 });
    expect([1, 2, 3, 8, 9, 40].map(n => streakBonusGold(BALANCE, n))).toEqual([0, 3, 6, 21, 24, 24]);
  });

  it('규칙이 없으면 꺼져 있고 상태에 연속 수를 남기지 않는다', () => {
    const run = newRun('Normal', 7);
    const ctx = without(run.ctx);
    const golds: number[] = [];
    for (let i = 0; i < 3; i++) { const g = run.s.gold; answerCurrent(ctx, run.s, 'correct'); golds.push(run.s.gold - g); }
    expect(golds).toEqual([ctx.difficulty.correctGold, ctx.difficulty.correctGold, ctx.difficulty.correctGold]);
    expect(run.s.quiz.answerStreak).toBeUndefined();
    expect(streakBonusGold(ctx.balance, 5)).toBe(0);
  });

  it('준비 문항부터 이어진 정답마다 +3, 오답은 0골드이고 연속을 끊으며 화면 값(nextCorrectGold)과 채점이 같다', () => {
    const { ctx, s } = newRun('Normal', 7);
    const golds: number[] = [];
    const shown: number[] = [];
    const answer = (kind: 'correct' | 'wrong') => { shown.push(nextCorrectGold(ctx, s)); const g = s.gold; answerCurrent(ctx, s, kind); golds.push(s.gold - g); };
    answer('correct'); answer('correct'); answer('correct'); answer('wrong'); answer('correct');
    const base = ctx.difficulty.correctGold;
    expect(golds).toEqual([base, base + 3, base + 6, 0, base]);
    expect(shown.filter((_, i) => golds[i]! > 0)).toEqual(golds.filter(g => g > 0));
    expect(s.quiz.answerStreak).toBe(1);
  });
});

function applyFail(ctx: GameContext, s: RunState, cmd: Command): string {
  const r = applyCommand(ctx, s, cmd);
  return r.ok ? 'ok' : r.error;
}

import { describe, expect, it } from 'vitest';
import { TOWER_IDS, type TowerId } from '../../src/contracts/balance';
import { BALANCE, PILOT_TOWERS } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import { draftOffer, draftPool, nextDraftWave, ownedTowers } from '../../src/domain/draft';
import type { DomainEvent } from '../../src/domain/events';
import { applyCommand, createRun } from '../../src/domain/run';
import type { RunState } from '../../src/domain/types';
import { answerCurrent, finishPrep, newRun, ok, THREE_TOWERS, ticks } from './helpers';

// 판 안 징집(docs/renewal/catalog/towers.md §0-2·§5 안 1): 기본 4종 시작, W3·W6·W10·W14 뒤 3종 중 1종, 장착함 8칸.

function allTowersRun(seed = 21) {
  const { ctx } = newRun('Normal', seed);
  const s = createRun(ctx, {
    runId: `draft-${seed}`, playerId: 'p1', nickname: '시험', grade: 3, difficulty: 'Normal', mapId: ctx.map.id, seed,
    bankId: 'g3-dev', bankVersion: '0.1.0-dev', contentMode: 'development', availableTowers: [...TOWER_IDS],
    rankingEligibility: 'personal', createdAt: '2026-10-31T00:00:00.000Z',
  });
  return { ctx, s };
}

/** 지금 웨이브를 적 없이 바로 끝내고(성문 무사), 마무리 문항이 있으면 답한다. 사건을 모아 돌려준다. */
function clearWave(ctx: GameContext, s: RunState): DomainEvent[] {
  const ev: DomainEvent[] = [];
  finishPrep(ctx, s);
  ev.push(...ok(ctx, s, { type: 'startBattle' }));
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  s.enemies = [];
  ev.push(...ticks(ctx, s, 1));
  while (s.phase === 'WAVE_WRAPUP') answerCurrent(ctx, s, 'correct');
  return ev;
}

const freeSlot = (ctx: GameContext, s: RunState) => ctx.map.slots.find(x => !s.towers.some(t => t.slotId === x.id))!.id;

describe('장착함과 징집', () => {
  it('기본 4종(궁수·포탑·서리·마법)으로 시작하고, 장착함에 없는 타워는 지을 수 없다', () => {
    const { ctx, s } = allTowersRun();
    expect(ownedTowers(s)).toEqual(['archer', 'cannon', 'frost', 'mage']);
    finishPrep(ctx, s);
    s.gold = 1000;
    expect(applyCommand(ctx, s, { type: 'build', slotId: freeSlot(ctx, s), tower: 'lightning' })).toEqual({ ok: false, error: 'NOT_OWNED' });
    ok(ctx, s, { type: 'build', slotId: freeSlot(ctx, s), tower: 'mage' });
    expect(nextDraftWave(BALANCE, s)).toBe(3);
  });

  it('시범 3종 판은 시작 타워가 그 판의 타워로 줄고 징집 후보가 없어 징집이 열리지 않는다', () => {
    const { ctx, s } = newRun('Normal', 4);
    expect(ownedTowers(s)).toEqual(THREE_TOWERS.filter(t => BALANCE.draft.startTowers.includes(t)));
    expect(draftPool(s)).toEqual([]);
    for (let w = 1; w <= 3; w++) expect(clearWave(ctx, s).some(e => e.type === 'draftOffered')).toBe(false);
    expect(s.draft).toBeNull();
    expect(nextDraftWave(BALANCE, s)).toBeNull();
  });

  it('앱 기본 판(PILOT_TOWERS, 타워 20종)은 시작 4종을 갖고 나머지 16종이 징집 후보다', () => {
    expect(PILOT_TOWERS).toHaveLength(20);
    expect(PILOT_TOWERS.filter(t => !BALANCE.draft.startTowers.includes(t))).toHaveLength(16);
    const { ctx } = newRun('Normal', 31);
    const s = createRun(ctx, {
      runId: 'draft-app', playerId: 'p1', nickname: '시험', grade: 3, difficulty: 'Normal', mapId: ctx.map.id, seed: 31,
      bankId: 'g3-dev', bankVersion: '0.1.0-dev', contentMode: 'development', availableTowers: [...PILOT_TOWERS],
      rankingEligibility: 'personal', createdAt: '2026-10-31T00:00:00.000Z',
    });
    expect(ownedTowers(s)).toEqual(BALANCE.draft.startTowers);
    expect([...draftPool(s)].sort()).toEqual(PILOT_TOWERS.filter(t => !BALANCE.draft.startTowers.includes(t)).sort());
    expect(nextDraftWave(BALANCE, s)).toBe(BALANCE.draft.afterWaves[0]);
  });

  it('W3을 지키면 아직 없는 타워 3종이 후보로 열리고, 고르면 장착함에 들어와 지을 수 있다', () => {
    const { ctx, s } = allTowersRun();
    expect(applyCommand(ctx, s, { type: 'draftPick', tower: 'lightning' })).toEqual({ ok: false, error: 'NO_DRAFT' });
    clearWave(ctx, s);
    clearWave(ctx, s);
    expect(s.draft).toBeNull();
    const ev = clearWave(ctx, s);
    const offered = ev.find(e => e.type === 'draftOffered');
    const offer = draftOffer(s)!;
    expect(offered).toEqual({ type: 'draftOffered', wave: 3, offers: offer.offers });
    expect(offer.offers).toHaveLength(3);
    expect(new Set(offer.offers).size).toBe(3);
    for (const t of offer.offers) expect(s.owned.includes(t)).toBe(false);
    const other = TOWER_IDS.find(t => !s.owned.includes(t) && !offer.offers.includes(t))!;
    expect(applyCommand(ctx, s, { type: 'draftPick', tower: other })).toEqual({ ok: false, error: 'INVALID_DRAFT' });
    const pick = offer.offers[1]!;
    expect(ok(ctx, s, { type: 'draftPick', tower: pick })).toEqual([{ type: 'draftPicked', tower: pick, auto: false }]);
    expect(s.owned).toEqual(['archer', 'cannon', 'frost', 'mage', pick]);
    expect(s.draft).toBeNull();
    finishPrep(ctx, s);
    s.gold = 1000;
    ok(ctx, s, { type: 'build', slotId: freeSlot(ctx, s), tower: pick });
  });

  it('고르지 않은 채 다음 징집 웨이브를 지키면 앞 후보의 첫 카드로 정하고 새 후보를 연다. 장착함은 8칸에서 멈춘다', () => {
    const { ctx, s } = allTowersRun(33);
    const picked: Array<{ tower: TowerId; auto: boolean }> = [];
    for (let w = 1; w <= 14; w++) {
      for (const e of clearWave(ctx, s)) if (e.type === 'draftPicked') picked.push({ tower: e.tower, auto: e.auto });
    }
    expect(picked.map(p => p.auto)).toEqual([true, true, true]);
    expect(s.draft?.wave).toBe(14);
    expect(s.owned).toHaveLength(7);
    ok(ctx, s, { type: 'draftPick', tower: s.draft!.offers[2]! });
    expect(s.owned).toHaveLength(BALANCE.draft.maxOwned);
    expect(nextDraftWave(BALANCE, s)).toBeNull();
  });

  it('같은 seed면 같은 후보이고, 징집 난수는 전투 편성을 바꾸지 않는다', () => {
    const a = allTowersRun(55), b = allTowersRun(55);
    for (let w = 1; w <= 3; w++) { clearWave(a.ctx, a.s); clearWave(b.ctx, b.s); }
    expect(a.s.draft).toEqual(b.s.draft);
    const pilot = newRun('Normal', 55);
    for (let w = 1; w <= 3; w++) clearWave(pilot.ctx, pilot.s);
    finishPrep(a.ctx, a.s); finishPrep(pilot.ctx, pilot.s);
    ok(a.ctx, a.s, { type: 'startBattle' }); ok(pilot.ctx, pilot.s, { type: 'startBattle' });
    expect(a.s.battle!.spawnList).toEqual(pilot.s.battle!.spawnList);
  });

  it('정지 중에는 고를 수 없다', () => {
    const { ctx, s } = allTowersRun();
    for (let w = 1; w <= 3; w++) clearWave(ctx, s);
    ok(ctx, s, { type: 'pause', reason: 'USER' });
    expect(applyCommand(ctx, s, { type: 'draftPick', tower: s.draft!.offers[0]! })).toEqual({ ok: false, error: 'PAUSED' });
  });
});

import { expect, it, vi } from 'vitest';
import data from '../../docs/contracts/balance.v2.json';
import { balanceV2Schema, R6_TOWERS } from '../../src/contracts/balanceV2';
import { compileR6Balance } from '../../src/domain/r6Balance';
import { evolutionAt, towerArtKey } from '../../src/domain/r6Towers';
import { grantR6QaGold } from '../../src/application/qaGold';
import { applyCommand, createRun } from '../../src/domain/run';
import { openDraft } from '../../src/domain/draft';
import { relicBalance } from '../../src/domain/relics';
import { towerStats, upgradeCost } from '../../src/domain/towers';
import { newRun } from './helpers';

const rules = balanceV2Schema.parse(data);
function setup() {
  const { ctx: legacy, s: old } = newRun();
  const balance = compileR6Balance(legacy.balance, rules);
  const ctx = { ...legacy, balance, difficulty: balance.difficulties.Normal };
  const s = createRun(ctx, { ...old.config, availableTowers: [...R6_TOWERS] });
  s.phase = 'BUILD';
  s.gold = 10000;
  return { ctx, s };
}
it('3·6·9웨이브에서만 설치권을 순서대로 한 번 열고 실결제액으로 판매한다', () => {
  const { ctx, s } = setup();
  expect(s.owned).toEqual(['rail', 'mortar', 'cryo']);
  const slotId = ctx.map.slots[0]!.id;
  expect(applyCommand(ctx, s, { type: 'build', tower: 'hangar', slotId })).toEqual({ ok: false, error: 'NOT_OWNED' });
  const unlocked = new Map<number, (typeof s.owned)[number]>([[3, 'prism'], [6, 'hangar'], [9, 'bastion']]);
  const owned = [...s.owned];
  for (let wave = 1; wave <= 10; wave++) {
    s.completedWave = wave;
    const events: Parameters<typeof openDraft>[2] = [];
    openDraft(ctx.balance, s, events);
    const tower = unlocked.get(wave);
    expect(events).toEqual(tower ? [{ type: 'towerUnlocked', wave, tower }] : []);
    if (tower) owned.push(tower);
    expect(s.owned).toEqual(owned);
    openDraft(ctx.balance, s, events);
    expect(events).toHaveLength(tower ? 1 : 0);
  }
  expect(s.owned).toEqual(R6_TOWERS);
  expect(applyCommand(ctx, s, { type: 'build', tower: 'rail', slotId }).ok).toBe(true);
  for (let level = 1; level < 20; level++) expect(applyCommand(ctx, s, { type: 'upgrade', towerId: 1 }).ok).toBe(true);
  const gold = s.gold;
  expect(applyCommand(ctx, s, { type: 'upgrade', towerId: 1 })).toEqual({ ok: false, error: 'MAX_LEVEL' });
  expect(s.gold).toBe(gold);
  expect(applyCommand(ctx, s, { type: 'sell', towerId: 1 }).ok).toBe(true);
  expect(s.gold).toBe(gold + Math.floor((10000 - gold) * 0.6));
});

it('형태 사이의 홀수 레벨에는 몸체를 유지하고 무기와 재질은 네 번의 구간으로 나눈다', () => {
  const keys = Array.from({ length: 20 }, (_, i) => towerArtKey('rail', i + 1));
  expect(new Set(keys).size).toBe(11);
  expect(keys.slice(0, 5)).toEqual(['r6.tower.rail.s0', 'r6.tower.rail.s1', 'r6.tower.rail.s1', 'r6.tower.rail.s2', 'r6.tower.rail.s2']);
  expect(keys.at(-1)).toBe('r6.tower.rail.s10');
  for (const [start, end, weapon, material] of [[1, 5, 0, 'steel'], [6, 11, 1, 'alloy'], [12, 17, 2, 'ceramic'], [18, 20, 3, 'gold']] as const) {
    for (let level = start; level <= end; level++) expect(evolutionAt(level)).toMatchObject({ weapon, material });
  }
  for (const level of [0, 2.5, 21]) expect(() => evolutionAt(level)).toThrow(RangeError);
});

it('시험 골드는 개발 빌드의 R6 설치 단계에서만 지급한다', () => {
  const { s } = setup();
  s.config.rankingEligibility = 'personal';
  grantR6QaGold(s, 100);
  expect(s.gold).toBe(10100);
  expect(() => grantR6QaGold({ ...s, phase: 'BATTLE' }, 100)).toThrow('설치 단계');
  vi.stubEnv('DEV', false);
  try {
    expect(() => grantR6QaGold(s, 100)).toThrow('개발 빌드');
    expect(s.gold).toBe(10100);
  } finally {
    vi.unstubAllEnvs();
  }
});
it('6종의 레벨·무기·형태와 진화 할인 경계를 적용한다', () => {
  const {
    ctx: { balance: b },
  } = setup();
  const discounted = relicBalance(b, ['evolve_stone']);
  for (const id of R6_TOWERS) {
    for (let level = 1; level <= 20; level++) {
      expect(evolutionAt(level).stage).toBe(Math.floor(level / 2));
      expect(towerStats(b, id, level, 'base').damage).toBeGreaterThan(0);
      if ([5, 11, 17].includes(level))
        expect(upgradeCost(discounted, id, level)!).toBeLessThan(upgradeCost(b, id, level)!);
      else expect(upgradeCost(discounted, id, level)).toBe(upgradeCost(b, id, level));
    }
  }
  expect(towerStats(b, 'rail', 5, 'base').fx.burst).toBeUndefined();
  expect(towerStats(b, 'rail', 6, 'base').fx.burst?.count).toBe(2);
  expect(towerStats(b, 'rail', 12, 'base').fx.burst?.count).toBe(3);
  expect(towerStats(b, 'rail', 18, 'base').pierceDamageBP).toBe(6500);
  expect(towerStats(b, 'cryo', 18, 'base').fx.burst?.gapTicks).toBe(9);
  expect(towerStats(b, 'hangar', 18, 'base').fx.burst?.count).toBe(4);
  expect(towerStats(b, 'mortar', 18, 'base').weapon?.pulses?.count).toBe(2);
});

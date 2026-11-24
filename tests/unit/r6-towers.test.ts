import { expect, it } from 'vitest';
import data from '../../docs/contracts/balance.v2.json';
import { balanceV2Schema, R6_TOWERS } from '../../src/contracts/balanceV2';
import { compileR6Balance } from '../../src/domain/r6Balance';
import { evolutionAt } from '../../src/domain/r6Towers';
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
it('완료 웨이브에서 설치권을 한 번만 열고 실결제액으로 판매한다', () => {
  const { ctx, s } = setup();
  expect(s.owned).toEqual(['rail', 'mortar', 'cryo']);
  const slotId = ctx.map.slots[0]!.id;
  expect(applyCommand(ctx, s, { type: 'build', tower: 'hangar', slotId })).toEqual({ ok: false, error: 'NOT_OWNED' });
  for (const w of [3, 3, 6, 9]) {
    s.completedWave = w;
    openDraft(ctx.balance, s, []);
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

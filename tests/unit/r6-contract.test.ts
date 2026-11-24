import { describe, expect, it } from 'vitest';
import data from '../../docs/contracts/balance.v2.json';
import { balanceV2Schema } from '../../src/contracts/balanceV2';
import { loadR6Theme } from '../../src/content/theme';
import ko from '../../src/content/theme/r6.ko.json';

describe('R6 규칙과 한국어 표시', () => {
  const rules = balanceV2Schema.parse(data);
  it('100개체와 무기 표시를 실제 규칙에서 조립한다', () => {
    const theme = loadR6Theme(rules);
    expect(Object.keys(theme.entities)).toHaveLength(100);
    expect(theme.weapon('rail', 'II').summary).toBe('2발을 쏴요');
    expect(loadR6Theme(rules, { ...ko, towers: { ...ko.towers, rail: { name: '새 이름' } } }).towers.rail.name).toBe(
      '새 이름',
    );
  });
  it('누락된 개체, 잘못된 표시 변수, 잘못된 해금과 성장 표를 거부한다', () => {
    expect(() => loadR6Theme(rules, { ...ko, entities: {} })).toThrow();
    const bad = structuredClone(ko);
    bad.weapons.prism.IV.summaryTemplate = '{shots}';
    expect(() => loadR6Theme(rules, bad)).toThrow();
    expect(
      balanceV2Schema.safeParse({ ...data, unlocks: { ...data.unlocks, initial: ['rail', 'rail', 'cryo'] } }).success,
    ).toBe(false);
    expect(balanceV2Schema.safeParse({ ...data, levels: { ...data.levels, damageMultiplierBP: [1] } }).success).toBe(
      false,
    );
  });
});
it('중첩 규칙에 섞인 표시 값과 예약할 수 없는 단계 비중을 거부한다', () => {
  const extra = { ...data, run: { ...data.run, prepAttempts: { ...data.run.prepAttempts, name: '표시' } } };
  expect(balanceV2Schema.safeParse(extra).success).toBe(false);
  const copy = structuredClone(data);
  copy.mixer.bands[2]!.tierWeights = [0, 100, 0, 0];
  expect(balanceV2Schema.safeParse(copy).success).toBe(false);
});

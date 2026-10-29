import { describe, expect, it } from 'vitest';
import { measure, STREAMS } from '../../tools/sim/towerEfficiency';

describe('S11 타워 효율(PRD §7.5 ①)', () => {
  it('같은 배치·같은 줄이면 같은 피해를 내고, 깃발은 혼자서는 피해가 없다', () => {
    const one = measure([{ type: 'archer', slot: [8, 2] }], STREAMS.line);
    expect(one.damage).toBeGreaterThan(0);
    expect(one.gold).toBe(60);
    expect(measure([{ type: 'archer', slot: [8, 2] }], STREAMS.line)).toEqual(one);
    expect(measure([{ type: 'banner', slot: [8, 2] }], STREAMS.line).damage).toBe(0);
  });
});

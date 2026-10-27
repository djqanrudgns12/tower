import { describe, expect, it } from 'vitest';
import { BALANCE, MAPS } from '../../src/content';
import { buildPath, positionAt } from '../../src/domain/geometry';
import { isqrt, msToTicks, NumericLimitError, round5Bp, safe } from '../../src/domain/num';
import { intBelow, nextU32, shuffle, streamSeed } from '../../src/domain/rng';
import { sellRefund, upgradeCost } from '../../src/domain/towers';
import { composeWave, enemyMaxHp, hpBaseMilli, spawnIntervalTicks, waveCount } from '../../src/domain/waves';

describe('xorshift32-v1', () => {
  it('Marsaglia(2003) C 원형과 같은 출력을 낸다', () => {
    let x = 2463534242;
    const out = Array.from({ length: 5 }, () => (x = nextU32(x)));
    expect(out).toEqual([723471715, 2497366906, 2064144800, 2008045182, 3532304609]);
  });
  it('0 seed와 스트림 0 결과를 비영값으로 바꾼다', () => {
    expect(streamSeed(0, 'battle')).not.toBe(0);
    expect(streamSeed(0x9e3779b9, 'battle')).toBe(0x6d2b79f5);
  });
  it('거절 표본 정수는 범위 안이고 같은 상태면 같은 섞기를 낸다', () => {
    const r = { s: 99 };
    for (let i = 0; i < 2000; i++) { const v = intBelow(r, 7); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(7); }
    expect(shuffle({ s: 5 }, [1, 2, 3, 4, 5, 6])).toEqual(shuffle({ s: 5 }, [1, 2, 3, 4, 5, 6]));
  });
});

describe('정수 산술', () => {
  it('정수 ms를 올림 틱으로 바꾼다(A33)', () => {
    expect([1000, 1600, 1400, 1250, 1085, 750, 4000].map(msToTicks)).toEqual([30, 48, 42, 38, 33, 23, 120]);
    expect([1, 2, 3, 4].map(w => spawnIntervalTicks(BALANCE, w))).toEqual([48, 42, 38, 33]);
  });
  it('v0.4 부동소수 식이 어긋나던 41·81웨이브도 정수 ms로 계산한다', () => {
    expect(spawnIntervalTicks(BALANCE, 41)).toBe(27);
    expect(spawnIntervalTicks(BALANCE, 81)).toBe(21);
  });
  it('round5 강화비와 60% 판매(A14): 궁수 40/70/110/155, Lv5 판매 261', () => {
    expect([1, 2, 3, 4].map(l => upgradeCost(BALANCE, 'archer', l))).toEqual([40, 70, 110, 155]);
    expect(upgradeCost(BALANCE, 'archer', 5)).toBeNull();
    expect(sellRefund(BALANCE, { invested: 435 })).toBe(261);
    expect(round5Bp(120, 6500)).toBe(80);
  });
  it('안전 범위 밖은 조용히 자르지 않고 던진다(A34)', () => {
    expect(() => safe(Number.MAX_SAFE_INTEGER + 2)).toThrow(NumericLimitError);
    expect(isqrt(2500 * 2500 + 1)).toBe(2500);
  });
});

describe('웨이브 생성(PRD §8.2~8.3)', () => {
  it('적 수와 HP 점화식', () => {
    expect([1, 3, 4, 7, 10, 61, 200].map(w => waveCount(BALANCE, w))).toEqual([24, 24, 26, 28, 30, 64, 64]);
    expect([1, 2, 3].map(w => hpBaseMilli(BALANCE, w))).toEqual([24000, 27600, 31740]);
  });
  it('보스는 총 수 안에서 70% 지점, 정예는 6웨이브부터', () => {
    const w5 = composeWave(BALANCE, 5, { s: 7 });
    expect(w5).toHaveLength(26);
    expect(w5.findIndex(e => e.kind === 'boss')).toBe(Math.floor((70 * 25) / 100));
    expect(w5.filter(e => e.elite).length).toBe(0);
    const w10 = composeWave(BALANCE, 10, { s: 7 });
    expect(w10.filter(e => e.elite).length).toBe(Math.floor(29 * 0.09));
    expect(new Set(composeWave(BALANCE, 3, { s: 1 }).map(e => e.kind))).toEqual(new Set(['walker', 'runner', 'brute']));
  });
  it('최대 나머지 배정이 가중치 기대 수를 지킨다', () => {
    // 24×60%=14.4, 24×25%=6, 24×15%=3.6 → 내림 14/6/3, 남은 1자리는 나머지가 큰 튼튼형(0.6)에.
    const w3 = composeWave(BALANCE, 3, { s: 3 });
    const count = (k: string) => w3.filter(e => e.kind === k).length;
    expect([count('walker'), count('runner'), count('brute')]).toEqual([14, 6, 4]);
  });
  it('모든 난이도에서 무방비 누출 피해 합 ≥ 성문 HP(A16)', () => {
    for (const d of Object.values(BALANCE.difficulties)) {
      for (let w = 1; w <= 60; w++) {
        const list = composeWave(BALANCE, w, { s: w * 31 });
        const leak = list.reduce((a, e) => a + (e.kind === 'boss' ? BALANCE.leakDamage.boss : e.elite ? BALANCE.leakDamage.elite : BALANCE.leakDamage.regular), 0);
        expect(leak).toBeGreaterThanOrEqual(d.gateHp);
      }
    }
  });
  it('HP는 단계별 올림이며 Crazy 보스도 60웨이브까지 안전 정수', () => {
    expect(enemyMaxHp(BALANCE, BALANCE.difficulties.Normal, 24000, 'walker', null)).toBe(24000);
    expect(enemyMaxHp(BALANCE, BALANCE.difficulties.Crazy, hpBaseMilli(BALANCE, 60), 'boss', null)).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

describe('경로 기하', () => {
  it('4맵 모두 waypoint 길이가 pathLength×1000이고 끝점이 출구다', () => {
    for (const m of MAPS) {
      const p = buildPath(m);
      expect(p.length).toBe(m.pathLength * 1000);
      const end = positionAt(p, p.length);
      expect([end.x, end.y]).toEqual([m.exitCell[0] * 1000 + 500, m.exitCell[1] * 1000 + 500]);
    }
  });
});

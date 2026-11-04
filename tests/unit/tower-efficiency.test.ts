import { describe, expect, it } from 'vitest';
import { TOWER_IDS } from '../../src/contracts/balance';
import { measure, referenceSlot, ROLES, ROLE_STREAMS, runMatrix, STREAMS, UTILITY_TOWERS } from '../../tools/sim/towerEfficiency';

describe('S11 타워 효율(PRD §7.5 ①)', () => {
  it('같은 배치·같은 줄이면 같은 피해를 내고, 깃발은 혼자서는 피해가 없다', () => {
    const one = measure([{ type: 'archer', slot: [8, 2] }], STREAMS.line);
    expect(one.damage).toBeGreaterThan(0);
    expect(one.gold).toBe(60);
    expect(measure([{ type: 'archer', slot: [8, 2] }], STREAMS.line)).toEqual(one);
    expect(measure([{ type: 'banner', slot: [8, 2] }], STREAMS.line).damage).toBe(0);
  });
});

describe('B0 상성표(20종 × 역할 9종)', () => {
  it('손으로 고른 10종이 아니라 타워 20종 모두를 역할 9종 줄에서 궁수와 견준다', () => {
    const rows = runMatrix(undefined, { mapId: 'garden_u' });
    expect(rows.map(r => r.tower)).toEqual([...TOWER_IDS]);
    expect(ROLES).toHaveLength(9);
    expect(Object.keys(ROLE_STREAMS)).toEqual([...ROLES]);
    const archer = rows.find(r => r.tower === 'archer')!;
    for (const role of ROLES) expect(archer.ratio[role]).toBe(1);
    // 깃발은 공격하지 않고, 지상 전용 타워는 비행 줄에서 0이다.
    const banner = rows.find(r => r.tower === 'banner')!;
    expect(banner.attacks).toBe(false);
    expect(banner.pass).toBeNull();
    expect(rows.find(r => r.tower === 'cannon')!.ratio.flyer).toBe(0);
    // 유틸 6종은 시너지로 판정하므로 효율 판정(pass)이 없다. 그 밖의 공격 타워는 판정한다.
    for (const r of rows) {
      if (UTILITY_TOWERS.includes(r.tower) || r.tower === 'archer') expect(r.pass).toBeNull();
      else expect(typeof r.pass).toBe('boolean');
    }
  });

  it('기준 칸은 정원 맵 (8,2)이고 다른 맵도 실제 설치 칸을 가리킨다', () => {
    expect(referenceSlot('garden_u')).toEqual([8, 2]);
    for (const id of ['river_z', 'courtyard', 'snow_step']) {
      const slot = referenceSlot(id);
      expect(measure([{ type: 'archer', slot }], STREAMS.line, undefined, id).damage).toBeGreaterThan(0);
    }
  });

  it('분열 줄은 몸통과 새끼를 섞어 만든다', () => {
    expect(STREAMS.splitter.pattern?.map(p => p.kind)).toEqual(['splitter', 'splitling', 'splitling']);
    expect(measure([{ type: 'archer', slot: [8, 2] }], STREAMS.splitter).damage).toBeGreaterThan(0);
  });
});

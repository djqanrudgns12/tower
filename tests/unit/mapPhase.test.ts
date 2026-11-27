import { describe, expect, it } from 'vitest';
import { MAP_PHASE_TABLE, biomeForGrade, linearLuminanceRatio, mapPhase } from '../../src/game/r6/mapPhase';

describe('mapPhase 5웨이브 × 10단계 & 4학년 바이옴', () => {
  it('1~50웨이브를 5웨이브 단위 10단계로 정확히 분할하고 51+는 10단계를 유지한다', () => {
    expect(mapPhase(1).index).toBe(0);
    expect(mapPhase(5).index).toBe(0);
    expect(mapPhase(5).bossAlert).toBe(true);
    expect(mapPhase(6).index).toBe(1);
    expect(mapPhase(6).bossAlert).toBe(false);
    expect(mapPhase(45).index).toBe(8);
    expect(mapPhase(46).index).toBe(9);
    expect(mapPhase(50).index).toBe(9);
    expect(mapPhase(51).index).toBe(9);
  });

  it('모든 10단계 지형 틴트의 선형 휘도 비가 0.80 이상이며 입자 상한 24를 지킨다', () => {
    for (const phase of MAP_PHASE_TABLE) {
      expect(linearLuminanceRatio(phase.terrainTint), phase.id).toBeGreaterThanOrEqual(0.8);
      expect(phase.particleCount, phase.id).toBeLessThanOrEqual(24);
    }
  });

  it('3~6학년을 4대 월드 바이옴으로 매핑한다', () => {
    expect(biomeForGrade(3)).toBe('meadow');
    expect(biomeForGrade(4)).toBe('river');
    expect(biomeForGrade(5)).toBe('ochre');
    expect(biomeForGrade(6)).toBe('snow');
  });
});

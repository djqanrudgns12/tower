import { describe, expect, it } from 'vitest';
import { stepTowerDirection, towerIdleSpec } from '../../src/game/r6/TowerPlayback';

describe('R6 타워 회전 보간과 Zero-Texture Idle', () => {
  it('16방향 최단 경로로 최대 2스텝씩 돌고 4스텝 초과 차이는 즉시 스냅한다', () => {
    // 시계 방향 3스텝 차이 → 2스텝 전진 후 1스텝 마무리
    expect(stepTowerDirection(0, 3)).toBe(2);
    expect(stepTowerDirection(2, 3)).toBe(3);

    // 경계 넘김(15 → 2: +3스텝) 최단 회전
    expect(stepTowerDirection(15, 2)).toBe(1);
    expect(stepTowerDirection(1, 2)).toBe(2);

    // 반시계(1 → 14: -3스텝) 최단 회전
    expect(stepTowerDirection(1, 14)).toBe(15);

    // 5스텝 이상 급격한 표적 전환 시 즉시 스냅
    expect(stepTowerDirection(0, 8)).toBe(8);
    expect(stepTowerDirection(2, 9)).toBe(9);
  });

  it('품질·reducedMotion에 따라 Idle 호흡·글로우·스캔을 단계적으로 끈다', () => {
    const q0 = towerIdleSpec(1, 'rail', 1000, 2000, 0, false);
    expect(q0.glowAlpha).toBeGreaterThan(0);
    expect(q0.glowColor).toBe(0x2fb5a3);

    // 품질 1: 글로우 오프, 호흡·스캔 유지
    const q1 = towerIdleSpec(1, 'rail', 1000, 2000, 1, false);
    expect(q1.glowAlpha).toBe(0);

    // 품질 2 & reducedMotion: 모든 Idle 효과 오프
    const q2 = towerIdleSpec(1, 'rail', 1000, 2000, 2, false);
    expect(q2).toEqual({ breathY: 0, glowAlpha: 0, glowColor: 0x2fb5a3, scanOffset: 0 });
    const rm = towerIdleSpec(1, 'rail', 1000, 2000, 0, true);
    expect(rm).toEqual({ breathY: 0, glowAlpha: 0, glowColor: 0x2fb5a3, scanOffset: 0 });
  });
});

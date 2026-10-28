import { describe, expect, it } from 'vitest';
import { simulateRun, withOverrides, type SimOptions } from '../../tools/sim/balanceSim';

describe('S11 엔진 시뮬레이터', () => {
  it('가상 플레이어가 명령 거부 없이 제품 엔진을 끝까지 돌리고, 같은 seed면 같은 결과를 낸다', () => {
    const opt: SimOptions = { mapId: 'garden_u', difficulty: 'Normal', accuracy: 0.8, readSec: 12, strategy: 'novice', seed: 3, maxWaves: 6 };
    const a = simulateRun(opt);
    expect(a.completedWave).toBe(6);
    expect(a.endReason).toBe('WAVE_CAP');
    expect(a.correct + a.wrong).toBeGreaterThanOrEqual(5 + 3 * 5);
    expect(simulateRun(opt)).toEqual(a);
  });

  it('후보 수치 덮어쓰기는 밸런스 스키마를 다시 통과해야 한다', () => {
    expect(withOverrides(['run.prepAttempts.laterWaves=2']).run.prepAttempts.laterWaves).toBe(2);
    expect(() => withOverrides(['run.noSuchKey=1'])).toThrow('없는 밸런스 경로');
    expect(() => withOverrides(['run.startGold="많이"'])).toThrow();
  });
});

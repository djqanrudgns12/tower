import { describe, expect, it } from 'vitest';
import { simulateRun, TOWER_IDS, withOverrides, type SimOptions } from '../../tools/sim/balanceSim';

describe('S11 엔진 시뮬레이터', () => {
  it('가상 플레이어가 명령 거부 없이 제품 엔진을 끝까지 돌리고, 같은 seed면 같은 결과를 낸다', () => {
    const opt: SimOptions = { mapId: 'garden_u', difficulty: 'Normal', accuracy: 0.8, readSec: 12, strategy: 'novice', seed: 3, maxWaves: 6 };
    const a = simulateRun(opt);
    expect(a.completedWave).toBe(6);
    expect(a.endReason).toBe('WAVE_CAP');
    expect(a.correct + a.wrong).toBeGreaterThanOrEqual(5 + 3 * 5);
    expect(simulateRun(opt)).toEqual(a);
  });

  it('10종 균형 전략은 가치가 낮게 잡힌 차례 하나에 막혀 강화만 하지 않고, 타워를 늘린 뒤에 진화한다(PRD §7.5 ②)', () => {
    // 고치기 전에는 1웨이브에 3기만 짓고 다음 차례(창병)를 미룬 채 2웨이브에 진화했다.
    const opt: SimOptions = { mapId: 'garden_u', difficulty: 'Hard', accuracy: 0.8, readSec: 12, strategy: 'balanced10', seed: 3, maxWaves: 8, towers: [...TOWER_IDS] };
    let builds = 0, beforeEvo: number | null = null;
    const a = simulateRun({ ...opt, onCommand: (_w, _g, cmd) => {
      if (beforeEvo !== null) return;
      if (cmd.type === 'build') builds++;
      if (cmd.type === 'upgrade' && cmd.branch) beforeEvo = builds;
    } });
    expect(beforeEvo).toBeGreaterThanOrEqual(5);
    // 엔진 가치는 판 사이에 캐시를 함께 쓰므로 같은 seed의 결과가 같아야 한다.
    expect(simulateRun(opt)).toEqual(a);
  });

  it('후보 수치 덮어쓰기는 밸런스 스키마를 다시 통과해야 한다', () => {
    expect(withOverrides(['run.prepAttempts.laterWaves=2']).run.prepAttempts.laterWaves).toBe(2);
    expect(() => withOverrides(['run.noSuchKey=1'])).toThrow('없는 밸런스 경로');
    expect(() => withOverrides(['run.startGold="많이"'])).toThrow();
  });
});

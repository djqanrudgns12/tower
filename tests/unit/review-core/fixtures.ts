import { vi } from 'vitest';
import { RunController } from '../../../src/application/RunController';
import type { GameContext } from '../../../src/domain/context';
import type { Enemy, RunState } from '../../../src/domain/types';
import { finishPrep, newRun, ok } from '../helpers';

export function battleFixture() {
  const { ctx, s } = newRun();
  finishPrep(ctx, s);
  ok(ctx, s, { type: 'startBattle' });
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  return { ctx, s };
}

export function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 1, kind: 'walker', elite: null, hp: 24000, maxHp: 24000,
    progress: 0, moveRem: 0, speedBP: 10000, physicalResistBP: 0, magicResistBP: 0,
    slows: [], stunUntilTick: 0, stunTicksUsed: 0, alive: true, ...overrides,
  };
}

/** 공개 start/dispatch와 RAF 콜백만 사용한다. 저장소·실제 브라우저는 연결하지 않는다. */
export function controlledFrames(ctx: GameContext, s: RunState) {
  let callback: FrameRequestCallback | undefined;
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callback = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  const controller = new RunController(ctx, s, { saveSeq: 0, ownership: null });
  controller.start();
  return {
    controller,
    frame(dt = 34) { now += dt; callback!(now); },
    cleanup() { controller.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); },
  };
}

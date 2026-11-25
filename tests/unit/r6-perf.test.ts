import { afterEach, expect, it, vi } from 'vitest';
import { localBalanceSession } from '../../src/application/balanceSession';
import { RenderQuality } from '../../src/application/renderQuality';
import { RunController } from '../../src/application/RunController';
import type { DomainEvent } from '../../src/domain/events';
import type { RunState } from '../../src/domain/types';
import { finishPrep, nearestSlots, newRun, ok } from './helpers';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function measure(quality: RenderQuality, duration: number, delta: number) {
  let paused = false;
  for (let ms = 0; ms < duration; ms += delta) paused = quality.sample(delta) || paused;
  return paused;
}

it('짧은 끊김은 지나가고 30fps 미만 5초마다 한 단계 낮춘 뒤 45fps 이상 20초마다 한 단계 올린다', () => {
  const quality = new RenderQuality();
  expect(quality.sample(900)).toBe(false);
  expect(measure(quality, 4100, 20)).toBe(false);
  expect(quality.current).toBe(0);
  for (const level of [1, 2, 3]) {
    expect(measure(quality, 5000, 50)).toBe(false);
    expect(quality.current).toBe(level);
  }
  expect(measure(quality, 10_000, 50)).toBe(false);
  expect(measure(quality, 15_000, 20)).toBe(false);
  expect(quality.current).toBe(3);
  expect(measure(quality, 5000, 20)).toBe(false);
  expect(quality.current).toBe(2);
});

it('가벼운 화면은 바로 3단계를 적용하고 한 번의 긴 끊김이나 회복에 의해 정지·전환되지 않는다', () => {
  const quality = new RenderQuality();
  quality.setLight(true);
  expect(quality.current).toBe(3);
  expect(quality.sample(12_000)).toBe(false);
  expect(measure(quality, 20_000, 20)).toBe(false);
  expect(quality.current).toBe(3);
  quality.setLight(false);
  expect(quality.current).toBe(0);
});

function clock() {
  let now = 0;
  let nextFrame: FrameRequestCallback;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => { nextFrame = frame; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return (duration: number, dt: number) => {
    const end = now + duration;
    while (now < end) {
      now = Math.min(now + dt, end);
      nextFrame(now);
    }
  };
}

function battle() {
  const session = localBalanceSession('2.0.0', 3, 'Normal', newRun().s.config);
  if (session.version !== '2.0.0') throw new Error('R6 시험 판을 열지 못했습니다.');
  const { ctx } = session;
  // 앱 진입점과 같은 계약으로 컨트롤러에 넘긴다.
  const state = session.state as RunState;
  finishPrep(ctx, state);
  for (const slotId of nearestSlots(ctx, 2)) ok(ctx, state, { type: 'build', tower: state.owned[0]!, slotId });
  ok(ctx, state, { type: 'startBattle' });
  return { ctx, state };
}

it('저속 렌더로 3단계에 도달해도 같은 30Hz 틱의 전투 상태와 사건이 일치한다', () => {
  const elapsed = 15_001;
  const { ctx, state } = battle();
  const run = clock();
  const collect = (delta: number) => {
    const controller = new RunController(ctx, structuredClone(state), { recordOnFinish: false });
    const events: DomainEvent[] = [];
    controller.onEvents(batch => events.push(...batch));
    controller.start();
    run(elapsed, delta);
    controller.dispose();
    return { controller, events };
  };
  const fast = collect(20);
  const slow = collect(50);
  expect(fast.controller.renderQuality.current).toBe(0);
  expect(slow.controller.renderQuality.current).toBe(3);
  expect(slow.controller.state.tick - state.tick).toBe(450);
  expect(slow.controller.state).toEqual(fast.controller.state);
  expect(slow.events).toEqual(fast.events);
  expect(slow.events.some(event => event.type === 'hit')).toBe(true);
});

it('R6 자동 정지는 3단계에서 15fps 미만이 10초 더 이어진 뒤에만 열리며 수동 재개한다', () => {
  const { ctx, state } = battle();
  const controller = new RunController(ctx, state, { recordOnFinish: false });
  const run = clock();
  controller.start();
  run(15_000, 100);
  expect(controller.renderQuality.current).toBe(3);
  expect(controller.state.pause).toEqual([]);
  run(9900, 100);
  expect(controller.state.pause).toEqual([]);
  run(100, 100);
  expect(controller.state.pause).toEqual(['PERFORMANCE']);
  const frozenAt = controller.state.tick;
  run(5000, 100);
  expect(controller.state.tick).toBe(frozenAt);
  controller.resume();
  run(5000, 100);
  expect(controller.state.pause).toEqual([]);
  expect(controller.state.tick).toBeGreaterThan(frozenAt);
  expect(controller.renderQuality.current).toBe(3);
  controller.dispose();
});

it('R6는 표시값이 같으면 화면을 다시 그리지 않고 전투 정지는 즉시 알린다', () => {
  const { ctx, state } = battle();
  const controller = new RunController(ctx, state, { recordOnFinish: false });
  const run = clock();
  const publish = vi.fn();
  const initialView = controller.getView();
  const initialTick = state.tick;
  controller.subscribe(publish);
  controller.start();
  run(200, 20);
  expect(state.tick).toBeGreaterThan(initialTick);
  expect(controller.getView()).toBe(initialView);
  expect(publish).not.toHaveBeenCalled();
  controller.pause('USER');
  expect(controller.getView().pause).toEqual(['USER']);
  expect(publish).toHaveBeenCalledTimes(1);
  controller.dispose();
});

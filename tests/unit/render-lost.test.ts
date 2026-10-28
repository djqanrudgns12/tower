import { expect, it } from 'vitest';
import { RunController } from '../../src/application/RunController';
import { newRun } from './helpers';

// PRD §12.7: 정지 원인 CONTEXT_LOST. 사용자 재개가 오류 원인을 제거하지 않는다. 복구 뒤에는 수동 재개(§14).
it('WebGL 문맥을 잃으면 멈추고, 돌아오기 전에는 ‘계속’으로 풀리지 않는다', () => {
  const { ctx, s } = newRun();
  const controller = new RunController(ctx, s, { saveSeq: 0, ownership: null });
  controller.rendererLost();
  expect([s.pause, controller.getView().renderLost]).toEqual([['CONTEXT_LOST'], true]);
  controller.resume();
  expect(s.pause).toEqual(['CONTEXT_LOST']);
  controller.rendererRestored();
  expect([s.pause, controller.getView().renderLost]).toEqual([['CONTEXT_LOST'], false]);
  controller.resume();
  expect(s.pause).toEqual([]);
});

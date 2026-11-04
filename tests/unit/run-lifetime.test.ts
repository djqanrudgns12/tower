import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunController } from '../../src/application/RunController';
import { buildRunRecord } from '../../src/application/runRecord';
import { startNewRun, startPractice, type StartResult } from '../../src/application/session';
import { addRecord, clearLocalHistory, listRecords, resetDbConnection } from '../../src/persistence/db';
import { queueAndFlushCompletedRun } from '../../src/persistence/lobbyClient';
import type * as DbModule from '../../src/persistence/db';
import type * as LobbyClientModule from '../../src/persistence/lobbyClient';
import { correctChoice } from './helpers';

// 판 수명(PRD §14.1 이어하기 없음): 판은 메모리에만 있고, 끝내기·패배 때만 개인 기록 → 공개 제출 큐에 남는다.

vi.mock('../../src/persistence/db', async importOriginal => {
  const actual = await importOriginal<typeof DbModule>();
  return { ...actual, addRecord: vi.fn(actual.addRecord) };
});
vi.mock('../../src/persistence/lobbyClient', async importOriginal => ({
  ...(await importOriginal<typeof LobbyClientModule>()),
  reportRunStarted: vi.fn(async () => undefined),
  queueAndFlushCompletedRun: vi.fn(async () => undefined),
}));

const input = { grade: 3, difficulty: 'Normal' as const, nickname: '하늘바람', playerId: 'p-life' };
const opened: RunController[] = [];
function controllerOf(res: StartResult): RunController {
  if (!res.ok) throw new Error(`시작 실패: ${res.message}`);
  opened.push(res.controller);
  return res.controller;
}
const answer = (c: RunController) => c.dispatch({ type: 'answer', encounterId: c.state.quiz.current!.id, choice: correctChoice(c.ctx, c.state as never) });

beforeEach(async () => {
  vi.mocked(addRecord).mockClear();
  vi.mocked(queueAndFlushCompletedRun).mockClear();
  await resetDbConnection();
  await clearLocalHistory();
});
afterEach(() => { for (const c of opened.splice(0)) c.dispose(); });

describe('판 수명(이어하기 없음)', () => {
  it('진행 중에는 아무것도 쓰지 않고, 끝내기에서만 개인 기록 → 공개 제출 큐 순서로 남긴다', async () => {
    const c = controllerOf(startNewRun(input));
    expect(answer(c).ok).toBe(true);
    c.pause('USER');
    c.resume();
    c.pause('HIDDEN');
    await new Promise(r => setTimeout(r, 20));
    expect(addRecord).not.toHaveBeenCalled();
    expect(await listRecords()).toEqual([]);

    c.resume();
    expect(c.dispatch({ type: 'quit' }).ok).toBe(true);
    await vi.waitFor(() => expect(queueAndFlushCompletedRun).toHaveBeenCalledTimes(1));
    const order = [addRecord, queueAndFlushCompletedRun].map(fn => vi.mocked(fn).mock.invocationCallOrder[0]!);
    expect(order[0]).toBeLessThan(order[1]!);
    const records = await listRecords();
    expect(records).toEqual([{ ...buildRunRecord(c.state as never), endedAt: records[0]!.endedAt }]);
    expect(vi.mocked(queueAndFlushCompletedRun).mock.calls[0]).toEqual([records[0], input.playerId]);
  });

  it('끝내지 않고 떠난 판(창 닫기·처음 화면으로)은 기록 없이 사라지고, 판은 몇 개든 서로 막지 않고 연다', async () => {
    const left = controllerOf(startNewRun(input));
    const other = controllerOf(startNewRun(input));
    expect(other.state.config.runId).not.toBe(left.state.config.runId);
    answer(left);
    left.dispose();
    await new Promise(r => setTimeout(r, 20));
    expect(addRecord).not.toHaveBeenCalled();
    expect(await listRecords()).toEqual([]);
  });

  it('연습 판은 끝나도 기록하지 않는다', async () => {
    const practice = startPractice('p-life');
    opened.push(practice);
    answer(practice);
    expect(practice.dispatch({ type: 'quit' }).ok).toBe(true);
    await new Promise(r => setTimeout(r, 20));
    expect(addRecord).not.toHaveBeenCalled();
    expect(queueAndFlushCompletedRun).not.toHaveBeenCalled();
  });
});

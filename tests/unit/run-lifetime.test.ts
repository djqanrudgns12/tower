import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunController } from '../../src/application/RunController';
import { buildRunRecord } from '../../src/application/runRecord';
import { startNewRun, startPractice, type StartResult } from '../../src/application/session';
import { addRecord, clearLocalHistory, listQuestionHistory, listRecords, resetDbConnection } from '../../src/persistence/db';
import { queueAndFlushCompletedRun, reportRunStarted } from '../../src/persistence/lobbyClient';
import type * as DbModule from '../../src/persistence/db';
import type * as LobbyClientModule from '../../src/persistence/lobbyClient';
import { advanceTick, createRun } from '../../src/domain/run';
import { contextFor, loadGradeContent } from '../../src/content';
import { correctChoice } from './helpers';

// 판 수명(PRD §14.1 이어하기 없음): 판은 메모리에만 있고, 끝내기·패배 때만 개인 기록 → 공개 제출 큐에 남는다.

vi.mock('../../src/persistence/db', async importOriginal => {
  const actual = await importOriginal<typeof DbModule>();
  return { ...actual, addRecord: vi.fn(actual.addRecord), listQuestionHistory: vi.fn(actual.listQuestionHistory) };
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
  vi.mocked(listQuestionHistory).mockReset();
  vi.mocked(reportRunStarted).mockClear();
  vi.mocked(queueAndFlushCompletedRun).mockClear();
  await resetDbConnection();
  await clearLocalHistory();
});
afterEach(() => { for (const c of opened.splice(0)) c.dispose(); });

describe('판 수명(이어하기 없음)', () => {
  it('전체 원ID 이력을 시작 때 한 번 복사해 후순위에 둔다', async () => {
    const initial = controllerOf(await startNewRun(input));
    const ids = initial.ctx.questionIds.slice(0, -1);
    const rows = ids.map(questionId => ({ questionId, lastSeenAt: '2026-11-06T00:00:00.000Z' }));
    vi.mocked(listQuestionHistory).mockClear();
    vi.mocked(listQuestionHistory).mockResolvedValueOnce(rows);
    const next = controllerOf(await startNewRun(input));
    rows.splice(0);
    expect(next.state.quiz.previousQuestionIds).toEqual([...ids].sort());
    expect(next.state.quiz.current!.questionId).toBe(initial.ctx.questionIds.at(-1));
    answer(next);
    expect(listQuestionHistory).toHaveBeenCalledTimes(1);
  });

  it('다른 학년·이전 은행 판의 완료 기록도 원ID로 새 판에 들어온다', async () => {
    await Promise.all([loadGradeContent(4), loadGradeContent(5)]);
    const first = controllerOf(await startNewRun({ ...input, grade: 4 }));
    const nextContext = contextFor(5, 'Normal');
    const shared = first.ctx.questionIds.find(id => nextContext.questions.has(id))!;
    expect(shared).toBeDefined();
    const q = first.ctx.questions.get(shared)!;
    await addRecord({ ...buildRunRecord(first.state as never), bankVersion: 'older-bank', answers: [{ encounterId: 1, questionId: shared, revision: q.revision, choice: q.correctOptionId, phase: 'prep', wave: 1 }] });
    const next = controllerOf(await startNewRun({ ...input, grade: 5 }));
    expect(next.state.quiz.previousQuestionIds).toContain(shared);
  });

  it('이력 읽기를 기다리는 동안 취소되면 판과 시작 신고를 만들지 않는다', async () => {
    let release!: (rows: DbModule.QuestionHistory[]) => void;
    vi.mocked(listQuestionHistory).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const abort = new AbortController();
    const pending = startNewRun(input, abort.signal);
    abort.abort();
    release([]);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(reportRunStarted).not.toHaveBeenCalled();
    expect(addRecord).not.toHaveBeenCalled();
  });

  it('전역 이력을 읽지 못해도 빈 복사본으로 시작한다', async () => {
    vi.mocked(listQuestionHistory).mockRejectedValueOnce(new Error('DB unavailable'));
    const c = controllerOf(await startNewRun(input));
    expect(c.state.quiz.previousQuestionIds).toEqual([]);
    expect(c.state.phase).toBe('PREP_QUIZ');
    expect(listQuestionHistory).toHaveBeenCalledTimes(1);
  });

  it('진행 중에는 아무것도 쓰지 않고, 끝내기에서만 개인 기록 → 공개 제출 큐 순서로 남긴다', async () => {
    const c = controllerOf(await startNewRun(input));
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
    const left = controllerOf(await startNewRun(input));
    const other = controllerOf(await startNewRun(input));
    expect(other.state.config.runId).not.toBe(left.state.config.runId);
    answer(left);
    left.dispose();
    await new Promise(r => setTimeout(r, 20));
    expect(addRecord).not.toHaveBeenCalled();
    expect(await listRecords()).toEqual([]);
  });

  it('전투 시작 때 문항이 소진되어도 종료 이벤트로 완료 기록을 한 번 남긴다', async () => {
    const regular = controllerOf(await startNewRun(input));
    const id = regular.ctx.questionIds[0]!;
    const ctx = { ...regular.ctx, questionIds: [id], questions: new Map([[id, regular.ctx.questions.get(id)!]]) };
    const state = createRun(ctx, regular.state.config);
    state.quiz.prepTarget = 1;
    const c = new RunController(ctx, state, { recordOnFinish: true });
    opened.push(c);
    answer(c);
    for (let tick = 0; tick < 60; tick++) advanceTick(ctx, state);
    expect(state.phase).toBe('BUILD');
    expect(c.dispatch({ type: 'startBattle' }).ok).toBe(true);
    expect(state.endReason).toBe('CONTENT_COMPLETE');
    await vi.waitFor(() => expect(addRecord).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(queueAndFlushCompletedRun).toHaveBeenCalledTimes(1));
    expect((await listRecords())[0]!.answers).toHaveLength(1);
    expect((await listQuestionHistory()).map(row => row.questionId)).toEqual([id]);
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

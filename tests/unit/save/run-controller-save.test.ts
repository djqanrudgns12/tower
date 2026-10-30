import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERIODIC_SAVE_TICKS, RunController } from '../../../src/application/RunController';
import { buildRunRecord } from '../../../src/application/runRecord';
import type { RunState } from '../../../src/domain/types';
import {
  addRecord,
  clearLocalHistory,
  clearSnapshot,
  listRecords,
  loadSnapshot,
  resetDbConnection,
  writeSnapshot,
} from '../../../src/persistence/db';
import { queueAndFlushCompletedRun } from '../../../src/persistence/lobbyClient';
import type * as DbModule from '../../../src/persistence/db';
import type * as LobbyClientModule from '../../../src/persistence/lobbyClient';
import { correctChoice, finishPrep, newRun, ok } from '../helpers';

// PRD §14.1 저장 스케줄러: 쓰기 직렬화·밀린 저장 합치기·실패 정지·같은 순번 재시도·저장 후 나가기·종료 기록 순서.
// 실제 IndexedDB 의미는 fake-indexeddb로, 실패와 느린 쓰기는 writeSnapshot 감싸개로 만든다.

const real = await vi.importActual<typeof DbModule>('../../../src/persistence/db');

vi.mock('../../../src/persistence/db', async importOriginal => {
  const actual = await importOriginal<typeof DbModule>();
  return {
    ...actual,
    writeSnapshot: vi.fn(actual.writeSnapshot),
    addRecord: vi.fn(actual.addRecord),
    clearSnapshot: vi.fn(actual.clearSnapshot),
  };
});
vi.mock('../../../src/persistence/lobbyClient', async importOriginal => ({
  ...(await importOriginal<typeof LobbyClientModule>()),
  queueAndFlushCompletedRun: vi.fn(async () => undefined),
}));

const write = vi.mocked(writeSnapshot);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

/** 문이 열릴 때까지 기다렸다가 실제로 쓰는 느린 쓰기. 동시에 몇 개가 쓰는지도 센다. */
function slowWrites() {
  const gate = deferred();
  const stats = { inFlight: 0, maxInFlight: 0 };
  write.mockImplementation(async (state, seq, strict) => {
    stats.inFlight++;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    try {
      await gate.promise;
      await real.writeSnapshot(state, seq, strict);
    } finally {
      stats.inFlight--;
    }
  });
  return { open: gate.resolve, stats };
}

const flushMicrotasks = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

function setup() {
  const { ctx, s } = newRun('Normal', 777);
  const release = vi.fn();
  const controller = new RunController(ctx, s, { saveSeq: 0, ownership: { release }, recordOnFinish: true });
  const answer = () => controller.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(ctx, s) });
  return { ctx, s, controller, release, answer };
}

async function loaded(): Promise<{ state: RunState; seq: number }> {
  const r = await loadSnapshot();
  if (r.kind !== 'ok') throw new Error(`저장 없음: ${r.kind}`);
  return r;
}

beforeEach(async () => {
  write.mockReset();
  write.mockImplementation(real.writeSnapshot);
  vi.mocked(addRecord).mockClear();
  vi.mocked(clearSnapshot).mockClear();
  vi.mocked(queueAndFlushCompletedRun).mockClear();
  await resetDbConnection();
  await clearLocalHistory();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RunController 저장 스케줄러(PRD §14.1)', () => {
  it('채점 직후 저장하고, 완료된 저장은 슬롯을 교대하며 순번을 올린다', async () => {
    const { s, controller, answer } = setup();
    expect(answer().ok).toBe(true);
    await controller.settle();
    expect(write).toHaveBeenCalledTimes(1);
    let snap = await loaded();
    expect(snap.seq).toBe(1);
    expect(snap.state.gold).toBe(s.gold);
    expect(snap.state.stats.correct).toBe(1);

    controller.pause('USER');
    await controller.settle();
    snap = await loaded();
    expect([snap.seq, controller.savedSeq, controller.saveStatus]).toEqual([2, 2, 'saved']);
    expect(snap.state.pause).toEqual(['USER']);
    // 재개는 상태를 바꾸지 않으므로 쓰지 않는다.
    controller.resume();
    await controller.settle();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('쓰기는 하나씩만 하고, 쓰는 동안 밀린 요청은 최신 상태 하나로 합친다', async () => {
    const { s, controller, answer } = setup();
    const slow = slowWrites();
    answer();
    await flushMicrotasks();
    expect(write).toHaveBeenCalledTimes(1);
    // 첫 쓰기가 끝나기 전에 저장 요청 세 번.
    controller.pause('USER');
    controller.pause('HIDDEN');
    controller.pause('PERFORMANCE');
    await flushMicrotasks();
    expect(write).toHaveBeenCalledTimes(1);

    slow.open();
    await controller.settle();
    expect(write).toHaveBeenCalledTimes(2);
    expect(slow.stats.maxInFlight).toBe(1);
    expect(write.mock.calls.map(c => c[1])).toEqual([1, 2]);
    const snap = await loaded();
    expect(snap.seq).toBe(2);
    expect(snap.state.pause).toEqual(['USER', 'HIDDEN', 'PERFORMANCE']);
    expect(snap.state).toEqual(JSON.parse(JSON.stringify(s)));
  });

  it('쓰기가 실패하면 메모리 최신 상태를 보존한 채 STORAGE로 정지하고, 정지 중에는 자동 저장·명령을 받지 않는다', async () => {
    const { s, controller, answer } = setup();
    write.mockRejectedValueOnce(new DOMException('공간 부족', 'QuotaExceededError'));
    answer();
    const afterAnswer = structuredClone(s);
    await controller.settle();

    expect(s.pause).toEqual(['STORAGE']);
    expect(controller.saveStatus).toBe('error');
    expect(controller.getView().saveStatus).toBe('error');
    expect(controller.getView().pause).toEqual(['STORAGE']);
    expect({ ...s, pause: [] }).toEqual({ ...afterAnswer, pause: [] });
    expect(await loadSnapshot()).toEqual({ kind: 'none' });

    // 학생의 ‘계속’은 저장 실패를 풀지 못하고, 답안·거래는 거부된다(§12.7).
    controller.resume();
    expect(s.pause).toContain('STORAGE');
    expect(controller.dispatch({ type: 'startBattle' })).toEqual({ ok: false, error: 'PAUSED' });
    controller.pause('USER');
    await controller.settle();
    expect(write).toHaveBeenCalledTimes(1);
    // 저장 실패 중의 ‘저장 후 나가기’는 성공이 아니다.
    expect(await controller.saveAndExit()).toBe(false);
  });

  it('다시 저장하기는 같은 순번으로 같은 상태를 쓰고, 채점·골드를 다시 실행하지 않으며, 수동 재개를 기다린다', async () => {
    const { s, controller, answer } = setup();
    write.mockRejectedValueOnce(new Error('트랜잭션 오류'));
    answer();
    await controller.settle();
    const failedSeq = write.mock.calls[0]![1];
    const gold = s.gold;
    const pt = s.pt;

    // 재시도도 실패하면 순번을 올리지 않고 그대로 정지한다.
    write.mockRejectedValueOnce(new Error('또 실패'));
    expect(await controller.retrySave()).toBe(false);
    expect(s.pause).toContain('STORAGE');

    expect(await controller.retrySave()).toBe(true);
    expect(write.mock.calls.map(c => c[1])).toEqual([failedSeq, failedSeq, failedSeq]);
    expect(s.pause).toEqual(['USER']);
    expect(controller.saveStatus).toBe('saved');
    expect([s.gold, s.pt, s.stats.correct]).toEqual([gold, pt, 1]);
    const snap = await loaded();
    expect(snap.seq).toBe(failedSeq);
    expect([snap.state.gold, snap.state.pt, snap.state.stats.correct]).toEqual([gold, pt, 1]);

    // 재시도 뒤 자동 저장이 다시 돈다.
    controller.resume();
    controller.pause('USER');
    await controller.settle();
    expect((await loaded()).seq).toBe(failedSeq + 1);
  });

  it('저장 후 나가기는 밀린 저장까지 끝나야 성공을 알리고, 실패하면 false와 STORAGE 정지', async () => {
    const { s, controller, answer } = setup();
    const slow = slowWrites();
    answer();
    let done = false;
    const exit = controller.saveAndExit().then(v => { done = true; return v; });
    await flushMicrotasks();
    expect(done).toBe(false);
    slow.open();
    expect(await exit).toBe(true);
    const snap = await loaded();
    expect(snap.state.pause).toEqual(['USER']);
    expect(snap.state).toEqual(JSON.parse(JSON.stringify(s)));
    // 첫 쓰기는 strict가 아니어도 나가기 요청은 strict로 쓴다.
    expect(write.mock.calls.some(c => c[2] === true)).toBe(true);

    const second = setup();
    write.mockRejectedValueOnce(new Error('접근 제한'));
    expect(await second.controller.saveAndExit()).toBe(false);
    expect(second.s.pause).toContain('STORAGE');
  });

  it('끝난 판: 진행 중 쓰기를 기다린 뒤 buildRunRecord → addRecord → clearSnapshot → 공개 제출 큐 순서로 남긴다', async () => {
    const { s, controller, answer } = setup();
    const slow = slowWrites();
    answer();
    await flushMicrotasks();
    expect(controller.dispatch({ type: 'quit' }).ok).toBe(true);
    expect(s.phase).toBe('GAME_OVER');
    await flushMicrotasks();
    expect(addRecord).not.toHaveBeenCalled();
    slow.open();
    await vi.waitFor(() => expect(queueAndFlushCompletedRun).toHaveBeenCalledTimes(1));

    const order = [write, addRecord, clearSnapshot, queueAndFlushCompletedRun].map(fn => vi.mocked(fn).mock.invocationCallOrder[0]!);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const records = await listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ ...buildRunRecord(s), endedAt: records[0]!.endedAt });
    expect(vi.mocked(queueAndFlushCompletedRun).mock.calls[0]).toEqual([records[0], s.config.playerId]);
    // 늦게 끝난 쓰기가 끝난 판의 저장을 되살리지 않는다.
    expect(await loadSnapshot()).toEqual({ kind: 'none' });
    // 끝난 판은 더 저장하지 않는다.
    controller.pause('USER');
    await controller.settle();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('소유권은 진행 중 쓰기가 끝난 뒤에 놓는다', async () => {
    const { controller, release, answer } = setup();
    const slow = slowWrites();
    answer();
    await flushMicrotasks();
    controller.dispose();
    await flushMicrotasks();
    expect(release).not.toHaveBeenCalled();
    slow.open();
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
  });

  it('소유권이 없거나(연습·저장 불가 브라우저) 자동 저장을 끄면 스냅샷을 쓰지 않는다', async () => {
    const { ctx, s } = newRun('Normal', 99);
    const practice = new RunController(ctx, s, { ownership: null, recordOnFinish: false });
    expect([practice.persist, practice.saveStatus]).toEqual([false, 'disabled']);
    practice.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(ctx, s) });
    practice.dispatch({ type: 'quit' });
    expect(await practice.saveAndExit()).toBe(false);
    await flushMicrotasks();
    expect(write).not.toHaveBeenCalled();
    expect(addRecord).not.toHaveBeenCalled();
    expect(await listRecords()).toEqual([]);

    const other = newRun('Normal', 100);
    const blocked = new RunController(other.ctx, other.s, { ownership: { release() {} }, autosave: false });
    expect(blocked.persist).toBe(false);
    blocked.pause('USER');
    await blocked.settle();
    expect(write).not.toHaveBeenCalled();
  });

  it(`전투 중에는 ${PERIODIC_SAVE_TICKS}틱(2초)마다 저장한다`, async () => {
    const { ctx, s } = newRun('Normal', 4242);
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'build', slotId: ctx.map.slots[0]!.id, tower: 'archer' });
    let callback: FrameRequestCallback | undefined;
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callback = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
    const controller = new RunController(ctx, s, { saveSeq: 0, ownership: { release() {} } });
    controller.start();
    controller.dispatch({ type: 'startBattle' });
    // 문제는 풀지 않고 전투만 흘린다. 프레임 사이에 저장이 끝나도록 기다린다.
    const startTick = s.tick;
    for (let i = 0; i < 200 && s.phase !== 'GAME_OVER'; i++) {
      now += TICK;
      callback!(now);
      await controller.settle();
    }
    controller.dispose();
    const ticks = write.mock.calls.map(c => c[0].tick);
    const battleTicks = ticks.filter(t => t > startTick);
    expect(s.phase).toBe('BATTLE');
    expect(battleTicks.length).toBeGreaterThanOrEqual(3);
    // 첫 저장(전투 시작 명령)은 그 틱의 진행 뒤에 찍히므로 첫 간격은 한 틱 짧을 수 있다.
    const gaps = battleTicks.slice(1).map((t, i) => t - battleTicks[i]!);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(PERIODIC_SAVE_TICKS - 1);
    expect(gaps.slice(1).every(g => g === PERIODIC_SAVE_TICKS)).toBe(true);
  });
});

const TICK = 1000 / 30 + 0.01;

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunController } from '../../../src/application/RunController';
import {
  loadSaved,
  NO_SAVE_NOTICE,
  resumeBlocker,
  resumeRun,
  startNewRun,
  startPractice,
  type SavedRun,
  type StartResult,
} from '../../../src/application/session';
import { clearLocalHistory, listRecords, loadSnapshot, resetDbConnection } from '../../../src/persistence/db';
import type * as LobbyClientModule from '../../../src/persistence/lobbyClient';
import { correctChoice } from '../helpers';

// PRD §14.2 버전 고정 이어하기, §12.2 이어하기 우선·연습 판, §14 Web Locks 없는 브라우저 안내.

vi.mock('../../../src/persistence/lobbyClient', async importOriginal => ({
  ...(await importOriginal<typeof LobbyClientModule>()),
  reportRunStarted: vi.fn(async () => undefined),
  queueAndFlushCompletedRun: vi.fn(async () => undefined),
}));

const opened: RunController[] = [];
function controllerOf(res: StartResult): RunController {
  if (!res.ok) throw new Error(`시작 실패: ${res.message}`);
  opened.push(res.controller);
  return res.controller;
}

const input = { grade: 3, difficulty: 'Normal' as const, nickname: '하늘바람', playerId: 'p-save' };

/** 새 판을 열어 답 하나를 내고 정지·저장한 뒤 나간다. */
async function savedRun(): Promise<SavedRun> {
  const c = controllerOf(await startNewRun({ ...input, replaceSaved: true }));
  const s = c.state;
  c.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(c.ctx, s as never) });
  expect(await c.saveAndExit()).toBe(true);
  c.dispose();
  await c.settle();
  const r = await loadSaved();
  if (r.kind !== 'ok') throw new Error(r.kind);
  return r;
}

beforeEach(async () => {
  await resetDbConnection();
  await clearLocalHistory();
});

afterEach(async () => {
  for (const c of opened.splice(0)) c.dispose();
  // 소유권 해제(쓰기 완료 뒤)를 기다린다.
  await new Promise(r => setTimeout(r, 0));
  vi.unstubAllGlobals();
});

describe('이어하기(PRD §14.2)', () => {
  it('저장한 판을 같은 골드·성문·문항으로, RESTORED 정지 상태로 이어 한다', async () => {
    const saved = await savedRun();
    expect(resumeBlocker(saved)).toBeNull();
    const c = controllerOf(await resumeRun(saved));
    expect(c.state.pause).toEqual(['RESTORED']);
    expect(c.getView().pause).toEqual(['RESTORED']);
    expect({ ...c.state, pause: [] }).toEqual({ ...saved.state, pause: [] });
    // 이어한 판은 불러온 순번 다음으로 저장한다(슬롯 교대).
    expect(c.savedSeq).toBe(saved.seq);
    c.resume();
    expect(c.state.pause).toEqual([]);
    c.pause('USER');
    await c.settle();
    const next = await loadSnapshot();
    expect(next.kind === 'ok' && next.seq).toBe(saved.seq + 1);
  });

  it('지난 세션의 정지 이유(저장 실패·숨김·학생 정지)는 버리고 RESTORED로 시작한다', async () => {
    const saved = await savedRun();
    saved.state.pause = ['USER', 'STORAGE', 'HIDDEN'];
    const c = controllerOf(await resumeRun(saved));
    expect(c.state.pause).toEqual(['RESTORED']);
  });

  it.each([
    ['규칙', (s: SavedRun) => { s.state.config.rulesVersion = '0.1-old'; }],
    ['밸런스', (s: SavedRun) => { s.state.config.balanceVersion = '0.1-old'; }],
    ['맵', (s: SavedRun) => { s.state.config.mapVersion = '0.1-old'; }],
    ['문제은행', (s: SavedRun) => { s.state.config.bankVersion = '0.1-old'; }],
  ])('%s 버전이 바뀌면 이어하지 않고 이유를 알린다', async (_name, mutate) => {
    const saved = await savedRun();
    mutate(saved);
    const blocked = resumeBlocker(saved);
    expect(blocked).toMatch(/이어할 수 없어요/);
    expect(await resumeRun(saved)).toEqual({ ok: false, message: blocked });
    // 이어할 수 없다고 저장을 조용히 지우지 않는다.
    expect((await loadSnapshot()).kind).toBe('ok');
  });
});

describe('새 게임과 저장된 판(PRD §12.2, §14.1)', () => {
  it('startNewRun은 저장된 판을 조용히 지우지 않는다. 학생이 새 게임을 고른 경우에만 바꾼다', async () => {
    const saved = await savedRun();
    const refused = await startNewRun(input);
    expect(refused.ok).toBe(false);
    const still = await loadSnapshot();
    expect(still.kind === 'ok' && still.state.config.runId).toBe(saved.state.config.runId);

    const c = controllerOf(await startNewRun({ ...input, replaceSaved: true }));
    expect(c.state.config.runId).not.toBe(saved.state.config.runId);
    expect(await loadSnapshot()).toEqual({ kind: 'none' });
    // 새 판의 첫 저장이 이전 판의 높은 순번에 가리지 않는다.
    c.pause('USER');
    await c.settle();
    const fresh = await loadSnapshot();
    expect(fresh.kind === 'ok' && [fresh.seq, fresh.state.config.runId]).toEqual([1, c.state.config.runId]);
  });

  it('다른 창이 판을 쥐고 있으면 열지 않고 그 판의 저장도 지우지 않는다', async () => {
    const saved = await savedRun();
    const holder = controllerOf(await resumeRun(saved));
    const second = await startNewRun({ ...input, replaceSaved: true });
    expect(second).toEqual({ ok: false, message: expect.stringContaining('다른 창') });
    expect((await loadSnapshot()).kind).toBe('ok');
    expect(holder.persist).toBe(true);
  });

  it('Web Locks가 없는 브라우저는 시작 전에 저장 불가를 알리고, 이어하기를 끄고, 저장하지 않는다', async () => {
    const saved = await savedRun();
    vi.stubGlobal('navigator', {});
    expect(resumeBlocker(saved)).toBe(NO_SAVE_NOTICE);
    expect(await resumeRun(saved)).toEqual({ ok: false, message: NO_SAVE_NOTICE });
    const res = await startNewRun({ ...input, replaceSaved: true });
    expect(res.ok && res.warning).toBe(NO_SAVE_NOTICE);
    const c = controllerOf(res);
    expect([c.persist, c.saveStatus]).toEqual([false, 'disabled']);
    // 저장하지 않으므로 이전 저장도 건드리지 않는다.
    const kept = await loadSnapshot();
    expect(kept.kind === 'ok' && kept.state.config.runId).toBe(saved.state.config.runId);
  });

  it('연습 판은 저장·기록을 남기지 않고 저장된 판도 건드리지 않는다', async () => {
    const saved = await savedRun();
    const practice = startPractice('p-save');
    opened.push(practice);
    expect(practice.persist).toBe(false);
    const s = practice.state;
    practice.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(practice.ctx, s as never) });
    practice.dispatch({ type: 'quit' });
    await practice.settle();
    await new Promise(r => setTimeout(r, 0));
    expect(await listRecords()).toEqual([]);
    const kept = await loadSnapshot();
    expect(kept.kind === 'ok' && kept.seq).toBe(saved.seq);
  });
});

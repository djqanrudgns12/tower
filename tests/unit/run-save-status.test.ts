import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunController, type RunSaveStatus } from '../../src/application/RunController';
import { clearLocalHistory, listPendingRunSyncs, listQuestionHistory, listRecords } from '../../src/persistence/db';
import { ResultScreen } from '../../src/ui/screens/ResultScreen';
import { correctChoice, newRun } from './helpers';

function finishRun() {
  const { ctx, s } = newRun();
  s.config.contentMode = 'published';
  s.completedWave = 1;
  const controller = new RunController(ctx, s, { recordOnFinish: true });
  expect(controller.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: correctChoice(ctx, s) }).ok).toBe(true);
  expect(controller.dispatch({ type: 'quit' }).ok).toBe(true);
  expect(controller.state.phase).toBe('GAME_OVER');
  controller.dispose();
  return controller;
}

function abortAfterPut(storeName: 'questionHistory' | 'syncQueue') {
  const put = IDBObjectStore.prototype.put;
  return vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    const request = put.apply(this, args);
    if (this.name === storeName) {
      request.addEventListener('success', () => this.transaction.abort(), { once: true });
    }
    return request;
  });
}

function resultMarkup(controller: RunController) {
  return renderToStaticMarkup(createElement(ResultScreen, {
    state: controller.state, controller, onAgain: vi.fn(), onHome: vi.fn(),
  }));
}

describe('완주 기록 저장 상태', () => {
  let consent: boolean;
  beforeEach(async () => {
    consent = true;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'vocabulary-td.settings' ? JSON.stringify({ shareRecords: consent }) : null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubEnv('VITE_API_BASE', '');
    await clearLocalHistory();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('개인 기록 저장이 중단돼도 판은 끝나고 기록과 문항 이력이 함께 되돌려진다', async () => {
    abortAfterPut('questionHistory');
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('failed'));
    expect(await listRecords()).toEqual([]);
    expect(await listQuestionHistory()).toEqual([]);
    expect(await listPendingRunSyncs()).toEqual([]);
    const html = resultMarkup(controller);
    expect(html).toContain('기록을 저장하지 못했어요.');
    expect(html).toContain('다시 시도</button>');
  });

  it('큐 등록이 중단되면 이미 저장한 개인 기록은 남기고 재시도할 상태를 보여 준다', async () => {
    abortAfterPut('syncQueue');
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('failed'));
    expect((await listRecords()).map(record => record.runId)).toEqual([controller.state.config.runId]);
    expect(await listPendingRunSyncs()).toEqual([]);
  });

  it('개인 기록과 공개 큐가 모두 저장되고 오프라인이면 랭킹 전송 대기 상태를 보여 준다', async () => {
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('pending'));
    const [record] = await listRecords();
    expect(record?.runId).toBe(controller.state.config.runId);
    expect((await listPendingRunSyncs()).map(item => item.record)).toEqual([record]);
    expect(resultMarkup(controller)).toContain('랭킹 전송 대기 중');
    consent = false;
    expect(resultMarkup(controller)).toContain('기록 저장됨');
  });

  it('개인 기록 저장 재시도는 같은 판을 다시 쓰고 큐까지 등록한다', async () => {
    const aborted = abortAfterPut('questionHistory');
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('failed'));
    aborted.mockRestore();

    await controller.retrySave();
    expect(controller.getSaveStatus()).toBe('pending');
    expect((await listRecords()).map(record => record.runId)).toEqual([controller.state.config.runId]);
    expect(await listQuestionHistory()).toHaveLength(1);
    expect(await listPendingRunSyncs()).toHaveLength(1);
  });

  it('재시도는 남은 큐 등록을 한 번만 하고 개인 기록을 다시 쓰지 않는다', async () => {
    const aborted = abortAfterPut('syncQueue');
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('failed'));
    const [record] = await listRecords();
    aborted.mockRestore();

    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    const statuses: RunSaveStatus[] = [];
    const unsubscribe = controller.subscribe(() => { statuses.push(controller.getSaveStatus()); });
    await Promise.all([controller.retrySave(), controller.retrySave()]);
    unsubscribe();
    expect(statuses).toEqual(['saving', 'saved', 'pending']);
    expect(controller.getSaveStatus()).toBe('pending');
    expect(put).toHaveBeenCalledTimes(1);
    expect(await listRecords()).toEqual([record]);
    expect((await listPendingRunSyncs()).map(item => item.record)).toEqual([record]);
  });

  it('공개 동의가 꺼져 있으면 개인 기록만 저장한다', async () => {
    consent = false;
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('saved'));
    expect((await listRecords()).map(record => record.runId)).toEqual([controller.state.config.runId]);
    expect(await listPendingRunSyncs()).toEqual([]);
    const html = resultMarkup(controller);
    expect(html).toContain('기록 저장됨');
    expect(html).not.toContain('랭킹 전송 대기 중');
  });

  it('기록을 삭제한 뒤 등록 재시도를 눌러도 삭제한 기록과 큐가 다시 생기지 않는다', async () => {
    const aborted = abortAfterPut('syncQueue');
    const controller = finishRun();
    await vi.waitFor(() => expect(controller.getSaveStatus()).toBe('failed'));
    aborted.mockRestore();
    await clearLocalHistory();
    await controller.retrySave();
    expect(controller.getSaveStatus()).toBe('untracked');
    expect(await listRecords()).toEqual([]);
    expect(await listPendingRunSyncs()).toEqual([]);
  });
});

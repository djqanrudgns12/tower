import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as persistence from '../../src/persistence/db';
import type { RunAnswer, RunRecord } from '../../src/persistence/db';

const answer = (questionId: string, choice: RunAnswer['choice'] = 'a', revision = 1): RunAnswer => ({
  encounterId: 1, questionId, revision, choice, phase: 'prep', wave: 1,
});
const record = (runId: string, endedAt: string, answers?: RunAnswer[]): RunRecord => ({
  runId, nickname: '솔방울', grade: 4, difficulty: 'Normal', mapId: 'river_z', pt: 30,
  completedWave: 1, endedAtWave: 1, correct: 1, wrong: 1, skipped: 1,
  endedAt, endReason: 'QUIT', contentMode: 'published', balanceVersion: 'test', bankVersion: 'test',
  ...(answers ? { answers } : {}),
});
async function removeDatabase() {
  await persistence.resetDbConnection();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('vocabulary-td');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
beforeEach(async () => {
  vi.stubGlobal('localStorage', { removeItem: vi.fn() });
  await removeDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await removeDatabase();
  vi.unstubAllGlobals();
});

it('학년·판 번호와 관계없이 문항 ID로 합치고 정답·오답·모르겠어요를 모두 보존한다', async () => {
  await persistence.addRecord(record('own-grade', '2026-11-01T00:00:00Z', [answer('g4-c'), answer('g4-a', 'b'), answer('g4-b', 'skipped')]));
  await persistence.addRecord({ ...record('shared-grade', '2026-11-02T00:00:00Z', [answer('g4-a', 'a', 2)]), grade: 5, bankVersion: 'shared-v2' });
  expect(await persistence.listQuestionHistory()).toEqual([
    { questionId: 'g4-a', lastSeenAt: '2026-11-02T00:00:00.000Z' },
    { questionId: 'g4-b', lastSeenAt: '2026-11-01T00:00:00.000Z' },
    { questionId: 'g4-c', lastSeenAt: '2026-11-01T00:00:00.000Z' },
  ]);
});

it('같은 완료 기록을 다시 쓰거나 오래된 기록을 나중에 써도 최신 풀이 시각을 유지한다', async () => {
  const latest = record('latest', '2026-11-02T00:00:00Z', [answer('g4-a'), answer('g4-a', 'b')]);
  await persistence.addRecord(latest);
  await persistence.addRecord(latest);
  await persistence.addRecord(record('older', '2026-11-01T00:00:00Z', [answer('g4-a', 'skipped')]));
  expect(await persistence.listQuestionHistory()).toEqual([{ questionId: 'g4-a', lastSeenAt: '2026-11-02T00:00:00.000Z' }]);
  expect(await persistence.listRecords()).toHaveLength(2);
});

it('완료 기록을 최근 100판으로 정리해도 더 오래된 문항 이력은 남긴다', async () => {
  for (let i = 0; i < 101; i++) {
    await persistence.addRecord(record(`run-${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), [answer(`g4-${String(i).padStart(3, '0')}`)]));
  }
  expect(await persistence.listRecords()).toHaveLength(100);
  expect((await persistence.listRecords()).some(row => row.runId === 'run-0')).toBe(false);
  const history = await persistence.listQuestionHistory();
  expect(history).toHaveLength(101);
  expect(history[0]).toEqual({ questionId: 'g4-000', lastSeenAt: '2026-01-01T00:00:00.000Z' });
});

it('v3의 완료 기록에서 이관하고 answers 없는 옛 기록과 동기화 큐도 유지한다', async () => {
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('vocabulary-td', 3);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('records', { keyPath: 'runId' }).createIndex('endedAt', 'endedAt');
      request.result.createObjectStore('syncQueue', { keyPath: 'runId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = old.transaction(['records', 'syncQueue'], 'readwrite');
    tx.objectStore('records').put(record('z-old', '2026-11-01T00:00:00Z', [answer('g4-a', 'skipped'), answer('g4-b', 'b')]));
    tx.objectStore('records').put(record('a-new', '2026-11-02T09:00:00+09:00', [answer('g4-a', 'a', 2)]));
    tx.objectStore('records').put(record('without-answers', '2026-11-03T00:00:00Z'));
    tx.objectStore('syncQueue').put({ runId: 'a-new', record: record('a-new', '2026-11-02T09:00:00+09:00'), playerId: 'local', attempts: 0, queuedAt: '2026-11-02T00:00:00Z' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  old.close();
  expect(await persistence.listQuestionHistory()).toEqual([
    { questionId: 'g4-a', lastSeenAt: '2026-11-02T00:00:00.000Z' },
    { questionId: 'g4-b', lastSeenAt: '2026-11-01T00:00:00.000Z' },
  ]);
  expect((await persistence.db()).version).toBe(4);
  expect(await persistence.listRecords()).toHaveLength(3);
  expect((await persistence.listPendingRunSyncs()).map(row => row.runId)).toEqual(['a-new']);
});

it('로컬 기록 정리는 전역 문항 이력과 완료 기록·대기 큐를 함께 비운다', async () => {
  const played = record('played', '2026-11-02T00:00:00Z', [answer('g4-a')]);
  await persistence.addRecord(played);
  await persistence.enqueueRunSync(played, 'local');
  await persistence.clearLocalHistory();
  expect(await persistence.listQuestionHistory()).toEqual([]);
  expect(await persistence.listRecords()).toEqual([]);
  expect(await persistence.listPendingRunSyncs()).toEqual([]);
});

it('문항 이력 쓰기가 실패하면 완료 기록도 함께 롤백한다', async () => {
  await persistence.db();
  const original = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    if (this.name === 'questionHistory') throw new DOMException('저장 공간 없음', 'QuotaExceededError');
    return key === undefined ? original.call(this, value) : original.call(this, value, key);
  });
  await expect(persistence.addRecord(record('not-saved', '2026-11-02T00:00:00Z', [answer('g4-a')]))).rejects.toMatchObject({ name: 'QuotaExceededError' });
  spy.mockRestore();
  expect(await persistence.listRecords()).toEqual([]);
  expect(await persistence.listQuestionHistory()).toEqual([]);
});

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { clearReviewNote } from './reviewNote';

// 이 기기의 끝난 판 기록과 공개 제출 대기 큐(PRD §14). 진행 중인 판은 메모리에만 있고 여기에 쓰지 않는다(이어하기 없음).
export interface RunRecord {
  runId: string;
  nickname: string;
  grade: number;
  difficulty: string;
  mapId: string;
  pt: number;
  completedWave: number;
  endedAtWave: number;
  correct: number;
  wrong: number;
  skipped: number;
  endedAt: string;
  endReason: string;
  contentMode: string;
  balanceVersion: string;
  bankVersion: string;
  answers?: RunAnswer[];
  activeTicks?: number;
}

export interface RunAnswer {
  encounterId: number;
  questionId: string;
  revision: number;
  choice: 'a' | 'b' | 'c' | 'd' | 'skipped';
  phase: 'prep' | 'battle';
  wave: number;
}

export interface PendingRunSync {
  runId: string;
  record: RunRecord;
  playerId: string;
  attempts: number;
  queuedAt: string;
  retryAt?: number;
  retryDelayMs?: number;
}

interface TowerDb extends DBSchema {
  records: { key: string; value: RunRecord; indexes: { endedAt: string } };
  syncQueue: { key: string; value: PendingRunSync };
}

const DB_NAME = 'vocabulary-td';
/** 3: 옛 진행 중 판 저장소('run', 2슬롯 스냅샷)를 지운다(2026-11-04 이어하기 제거). */
const DB_VERSION = 3;
/** 버전 2까지 있던 진행 중 판 저장소. 업그레이드 때 지우기만 한다. */
const RETIRED_RUN_STORE = 'run';
const MAX_RECORDS = 100;
let dbPromise: Promise<IDBPDatabase<TowerDb>> | null = null;

export function db(): Promise<IDBPDatabase<TowerDb>> {
  dbPromise ??= openDB<TowerDb>(DB_NAME, DB_VERSION, {
    blocked() {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vocabulary-td.storageBlocked', { detail: '다른 탭을 닫고 다시 시도해 주세요.' }));
    },
    blocking() {
      void resetDbConnection();
    },
    terminated() { dbPromise = null; },
    upgrade(database, oldVersion) {
      if (oldVersion < 1) database.createObjectStore('records', { keyPath: 'runId' }).createIndex('endedAt', 'endedAt');
      if (oldVersion < 2 && !database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'runId' });
      }
      // 이 기기에 남은 옛 진행 중 판(스냅샷)을 정리한다. 기록·대기 큐는 그대로 둔다.
      const legacy = database as unknown as IDBPDatabase;
      if (legacy.objectStoreNames.contains(RETIRED_RUN_STORE)) legacy.deleteObjectStore(RETIRED_RUN_STORE);
    },
  }).catch(error => {
    // 실패한 open promise를 고정하면 다음 기록 읽기·쓰기도 영원히 실패한다.
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/** 테스트 격리 시 닫고 다시 열 수 있게 한다. */
export async function resetDbConnection(): Promise<void> {
  if (!dbPromise) return;
  const opened = await dbPromise.catch(() => null);
  opened?.close();
  dbPromise = null;
}

export async function addRecord(record: RunRecord): Promise<void> {
  const database = await db();
  const tx = database.transaction('records', 'readwrite', { durability: 'strict' });
  await tx.store.put(record);
  const all = await tx.store.index('endedAt').getAllKeys();
  for (const key of all.slice(0, Math.max(0, all.length - MAX_RECORDS))) await tx.store.delete(key);
  await tx.done;
}

export async function listRecords(): Promise<RunRecord[]> {
  const database = await db();
  return (await database.getAllFromIndex('records', 'endedAt')).reverse();
}

/** 환경설정의 ‘이 기기 로컬 기록 정리’: 완료 기록·대기 동기화 큐와 오답 노트(localStorage)를 모두 비운다. */
export async function clearLocalHistory(): Promise<void> {
  // 오답 노트는 IndexedDB가 아니라 localStorage에 있어 같은 트랜잭션에 묶을 수 없다. 먼저 지워 IndexedDB 실패와 무관하게 비운다.
  clearReviewNote();
  const database = await db();
  const tx = database.transaction(['records', 'syncQueue'], 'readwrite', { durability: 'strict' });
  await tx.objectStore('records').clear();
  await tx.objectStore('syncQueue').clear();
  await tx.done;
}

export async function enqueueRunSync(record: RunRecord, playerId: string): Promise<void> {
  const database = await db();
  const tx = database.transaction('syncQueue', 'readwrite');
  const existing = await tx.store.get(record.runId);
  if (!existing) {
    await tx.store.put({ runId: record.runId, record, playerId, attempts: 0, queuedAt: new Date().toISOString() });
  }
  await tx.done;
}

export async function listPendingRunSyncs(): Promise<PendingRunSync[]> {
  const database = await db();
  return (await database.getAll('syncQueue')).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.runId.localeCompare(b.runId));
}

export async function getPendingRunSync(runId: string): Promise<PendingRunSync | undefined> {
  const database = await db();
  return database.get('syncQueue', runId);
}

export async function removePendingRunSync(runId: string): Promise<void> {
  const database = await db();
  await database.delete('syncQueue', runId);
}

export async function bumpPendingRunSyncAttempt(runId: string, maxAttempts = 5): Promise<void> {
  const database = await db();
  const tx = database.transaction('syncQueue', 'readwrite');
  const item = await tx.store.get(runId);
  if (item) {
    if (item.attempts + 1 >= maxAttempts) await tx.store.delete(runId);
    else await tx.store.put({ ...item, attempts: item.attempts + 1 });
  }
  await tx.done;
}

/** 일시 장애는 포기 횟수를 늘리지 않고 다음 접속 시 재시도한다. */
export async function deferPendingRunSync(runId: string, delayMs = 30_000): Promise<void> {
  const database = await db();
  const tx = database.transaction('syncQueue', 'readwrite');
  const item = await tx.store.get(runId);
  if (item) {
    const retryDelayMs = Math.max(delayMs, Math.min(3_600_000, (item.retryDelayMs ?? 0) * 2));
    await tx.store.put({ ...item, retryDelayMs, retryAt: Date.now() + retryDelayMs });
  }
  await tx.done;
}

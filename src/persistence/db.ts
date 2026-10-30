import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RunState } from '../domain/types';

// 저장 의미(PRD §14): 전체 스냅샷 2슬롯 교대, 무결성 해시가 맞는 슬롯 중 seq가 큰 쪽을 읽는다.
export interface SavedSlot { slot: 'A' | 'B'; seq: number; savedAt: string; hash: string; json: string }

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
}

export interface PendingRunSync {
  runId: string;
  record: RunRecord;
  playerId: string;
  attempts: number;
  queuedAt: string;
}

interface TowerDb extends DBSchema {
  run: { key: 'A' | 'B'; value: SavedSlot };
  records: { key: string; value: RunRecord; indexes: { endedAt: string } };
  syncQueue: { key: string; value: PendingRunSync };
}

const DB_NAME = 'vocabulary-td';
const DB_VERSION = 2;
const MAX_RECORDS = 100;
const MAX_SYNC_QUEUE = 50;
let dbPromise: Promise<IDBPDatabase<TowerDb>> | null = null;

export function db(): Promise<IDBPDatabase<TowerDb>> {
  dbPromise ??= openDB<TowerDb>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('run', { keyPath: 'slot' });
        database.createObjectStore('records', { keyPath: 'runId' }).createIndex('endedAt', 'endedAt');
      }
      if (oldVersion < 2 && !database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'runId' });
      }
    },
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

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function writeSnapshot(state: RunState, seq: number, strict: boolean): Promise<void> {
  const json = JSON.stringify(state);
  const value: SavedSlot = { slot: seq % 2 === 1 ? 'A' : 'B', seq, savedAt: new Date().toISOString(), hash: await sha256(json), json };
  const database = await db();
  // 주기 저장은 기본(relaxed), ‘저장 후 나가기’·종료 기록은 strict(Chrome 121+ 기본값 변경 대응).
  const tx = database.transaction('run', 'readwrite', { durability: strict ? 'strict' : 'default' });
  await tx.store.put(value);
  await tx.done;
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; state: RunState; seq: number; savedAt: string }
  | { kind: 'corrupt' };

export async function loadSnapshot(): Promise<LoadResult> {
  const database = await db();
  const slots = (await database.getAll('run')).sort((a, b) => b.seq - a.seq);
  if (slots.length === 0) return { kind: 'none' };
  for (const slot of slots) {
    try {
      if ((await sha256(slot.json)) !== slot.hash) continue;
      const state = JSON.parse(slot.json) as RunState;
      return { kind: 'ok', state, seq: slot.seq, savedAt: slot.savedAt };
    } catch {
      continue;
    }
  }
  return { kind: 'corrupt' };
}

export async function clearSnapshot(): Promise<void> {
  const database = await db();
  await database.clear('run');
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

/** 환경설정의 ‘이 기기 로컬 기록 정리’: 진행 중 저장 슬롯·완료 기록·대기 동기화 큐를 모두 비운다. */
export async function clearLocalHistory(): Promise<void> {
  const database = await db();
  const tx = database.transaction(['run', 'records', 'syncQueue'], 'readwrite', { durability: 'strict' });
  await tx.objectStore('run').clear();
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
  const keys = await tx.store.getAllKeys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SYNC_QUEUE))) await tx.store.delete(key);
  await tx.done;
}

export async function listPendingRunSyncs(): Promise<PendingRunSync[]> {
  const database = await db();
  return database.getAll('syncQueue');
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

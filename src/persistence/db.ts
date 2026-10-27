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

interface TowerDb extends DBSchema {
  run: { key: 'A' | 'B'; value: SavedSlot };
  records: { key: string; value: RunRecord; indexes: { endedAt: string } };
}

const DB_NAME = 'vocabulary-td';
const MAX_RECORDS = 100;
let dbPromise: Promise<IDBPDatabase<TowerDb>> | null = null;

export function db(): Promise<IDBPDatabase<TowerDb>> {
  dbPromise ??= openDB<TowerDb>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('run', { keyPath: 'slot' });
      database.createObjectStore('records', { keyPath: 'runId' }).createIndex('endedAt', 'endedAt');
    },
  });
  return dbPromise;
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

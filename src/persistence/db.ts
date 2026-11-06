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

/** 학년·은행 판 번호가 바뀌어도 같은 원문항 ID로 이어지는 이 기기의 풀이 이력. */
export interface QuestionHistory {
  questionId: string;
  lastSeenAt: string;
}

interface TowerDb extends DBSchema {
  records: { key: string; value: RunRecord; indexes: { endedAt: string } };
  syncQueue: { key: string; value: PendingRunSync };
  questionHistory: { key: string; value: QuestionHistory };
}

const DB_NAME = 'vocabulary-td';
/** 3: 옛 진행 중 판 저장소 삭제. 4: 학년 공통 문항 이력과 기존 완료 기록 이관. */
const DB_VERSION = 4;
/** 버전 2까지 있던 진행 중 판 저장소. 업그레이드 때 지우기만 한다. */
const RETIRED_RUN_STORE = 'run';
const MAX_RECORDS = 100;
let dbPromise: Promise<IDBPDatabase<TowerDb>> | null = null;

interface QuestionHistoryWriter {
  get(questionId: string): Promise<QuestionHistory | undefined>;
  put(item: QuestionHistory): Promise<string>;
}

async function rememberAnswers(store: QuestionHistoryWriter, record: RunRecord): Promise<void> {
  const time = Date.parse(record.endedAt);
  if (!Number.isFinite(time)) return;
  const lastSeenAt = new Date(time).toISOString();
  const ids = new Set((record.answers ?? []).map(answer => answer.questionId));
  for (const questionId of ids) {
    if (typeof questionId !== 'string' || questionId.length === 0) continue;
    const previous = await store.get(questionId);
    if (!previous || previous.lastSeenAt < lastSeenAt) await store.put({ questionId, lastSeenAt });
  }
}

export function db(): Promise<IDBPDatabase<TowerDb>> {
  dbPromise ??= openDB<TowerDb>(DB_NAME, DB_VERSION, {
    blocked() {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vocabulary-td.storageBlocked', { detail: '다른 탭을 닫고 다시 시도해 주세요.' }));
    },
    blocking() {
      void resetDbConnection();
    },
    terminated() { dbPromise = null; },
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) database.createObjectStore('records', { keyPath: 'runId' }).createIndex('endedAt', 'endedAt');
      if (oldVersion < 2 && !database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'runId' });
      }
      // 이 기기에 남은 옛 진행 중 판(스냅샷)을 정리한다. 기록·대기 큐는 그대로 둔다.
      const legacy = database as unknown as IDBPDatabase;
      if (legacy.objectStoreNames.contains(RETIRED_RUN_STORE)) legacy.deleteObjectStore(RETIRED_RUN_STORE);
      if (oldVersion < 4) {
        const history = database.createObjectStore('questionHistory', { keyPath: 'questionId' });
        // IndexedDB 요청만 기다려 업그레이드 트랜잭션 안에서 기존 answers까지 함께 이관한다.
        void (async () => {
          const records = await transaction.objectStore('records').getAll();
          for (const record of records) await rememberAnswers(history, record);
        })().catch(() => {
          try { transaction.abort(); } catch { /* 이미 중단된 업그레이드는 openDB가 실패로 돌려준다. */ }
        });
      }
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
  const tx = database.transaction(['records', 'questionHistory'], 'readwrite', { durability: 'strict' });
  try {
    const records = tx.objectStore('records');
    await records.put(record);
    await rememberAnswers(tx.objectStore('questionHistory'), record);
    const all = await records.index('endedAt').getAllKeys();
    for (const key of all.slice(0, Math.max(0, all.length - MAX_RECORDS))) await records.delete(key);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* 이미 중단된 트랜잭션의 원래 오류를 보존한다. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function listRecords(): Promise<RunRecord[]> {
  const database = await db();
  return (await database.getAllFromIndex('records', 'endedAt')).reverse();
}

/** 판 시작 때 한 번 읽어 복사한다. ID 순서는 기기 로캘과 관계없이 같다. */
export async function listQuestionHistory(): Promise<QuestionHistory[]> {
  const database = await db();
  return (await database.getAll('questionHistory')).sort((a, b) => a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0);
}

/** 환경설정의 ‘이 기기 로컬 기록 정리’: 완료 기록·문항 이력·대기 동기화 큐와 오답 노트를 모두 비운다. */
export async function clearLocalHistory(): Promise<void> {
  // 오답 노트는 IndexedDB가 아니라 localStorage에 있어 같은 트랜잭션에 묶을 수 없다. 먼저 지워 IndexedDB 실패와 무관하게 비운다.
  clearReviewNote();
  const database = await db();
  const tx = database.transaction(['records', 'syncQueue', 'questionHistory'], 'readwrite', { durability: 'strict' });
  await tx.objectStore('records').clear();
  await tx.objectStore('syncQueue').clear();
  await tx.objectStore('questionHistory').clear();
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

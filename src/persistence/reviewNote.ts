import { MAX_REVIEW_SENSES } from '../domain/quiz';
import type { Encounter, ReviewSense } from '../domain/types';

// 이 기기 오답 노트(R4 L, docs/renewal/prd-r4-ui-learning.md §6.1). localStorage에만 두고 동기화·점수·퍼센트는 없다(PRD v0.5 §20.5 예외).
// IndexedDB 버전은 올리지 않는다(privacy-storage 시험·e2e가 v2를 가정). 읽기 실패·저장 차단은 빈 노트로 보고 게임을 막지 않는다.
export const REVIEW_NOTE_KEY = 'vocabulary-td.reviewNote.v2';
const LEGACY_REVIEW_NOTE_KEY = 'vocabulary-td.reviewNote.v1';
/** 노트에 두는 뜻의 상한. 넘으면 오래 안 본 것부터 뺀다. */
export const REVIEW_NOTE_MAX = 60;
/** 다른 판에서 이만큼 맞히면 졸업한다. */
export const REVIEW_GRADUATE_CLEARS = 2;
/** 항목마다 기억하는 틀린 문항 수(최근 것부터). */
const MAX_QUESTION_IDS = 6;

export interface ReviewNoteItem {
  lemma: string;
  senseKey: string;
  bankId: string;
  /** 틀린 문항(최근 것부터). 같은 뜻의 다른 문항이 있으면 그쪽을 먼저 낸다. */
  questionIds: string[];
  misses: number;
  /** 담은 뒤 다른 판에서 맞힌 판 수. 틀리면 0으로 돌아간다. */
  clears: number;
  addedAt: string;
  lastSeenAt: string;
}

export interface ReviewNote {
  v: 2;
  items: Record<string, ReviewNoteItem>;
  graduated: number;
}

/** 한 판이 끝났을 때 결과 화면에 넘길 값. 점수·퍼센트가 아니라 낱말 수만이다. */
export interface ReviewDelta {
  /** 이번 판에서 틀려 노트에 담은 서로 다른 뜻의 수(이미 있던 뜻을 또 틀린 것도 센다). */
  added: number;
  /** 이번 판에서 졸업해 노트에서 빠진 뜻의 수. */
  graduated: number;
}

export const NO_REVIEW_DELTA: ReviewDelta = { added: 0, graduated: 0 };

/** 판 하나에서 뜻(senseKey)마다 모은 채점 결과. */
export interface SenseResult {
  senseKey: string;
  lemma: string;
  /** 틀리거나 ‘모르겠어요’로 넘긴 문항(처음 나온 순). */
  missedQuestionIds: string[];
  missed: number;
  correct: number;
}

type QuestionTarget = { target: { lemma: string; senseKey: string } };

export const emptyReviewNote = (): ReviewNote => ({ v: 2, items: {}, graduated: 0 });

/** 같은 뜻도 받는 학년 은행마다 복습 기록을 따로 보존한다. 구분자가 들어간 값도 충돌하지 않는다. */
export const reviewNoteItemKey = (bankId: string, senseKey: string): string => JSON.stringify([bankId, senseKey]);

const isCount = (x: unknown, min: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min;

/** v1·v2의 쓸 수 있는 항목을 은행·뜻 키로 읽는다. 지원하지 않는 버전이나 깨진 값은 빈 노트다. */
export function normalizeReviewNote(raw: unknown): ReviewNote {
  if (typeof raw !== 'object' || raw === null) return emptyReviewNote();
  const r = raw as { v?: unknown; items?: unknown; graduated?: unknown };
  if ((r.v !== 1 && r.v !== 2) || typeof r.items !== 'object' || r.items === null) return emptyReviewNote();
  const note = emptyReviewNote();
  if (isCount(r.graduated, 0)) note.graduated = r.graduated;
  for (const value of Object.values(r.items as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue;
    const i = value as Partial<Record<keyof ReviewNoteItem, unknown>>;
    if (typeof i.senseKey !== 'string' || i.senseKey === '' || typeof i.lemma !== 'string' || typeof i.bankId !== 'string') continue;
    if (!isCount(i.misses, 1) || !isCount(i.clears, 0) || typeof i.addedAt !== 'string' || typeof i.lastSeenAt !== 'string') continue;
    if (!Array.isArray(i.questionIds)) continue;
    note.items[reviewNoteItemKey(i.bankId, i.senseKey)] = {
      lemma: i.lemma, senseKey: i.senseKey, bankId: i.bankId,
      questionIds: i.questionIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_QUESTION_IDS),
      misses: i.misses, clears: i.clears, addedAt: i.addedAt, lastSeenAt: i.lastSeenAt,
    };
  }
  return note;
}

/** 끝난 판의 채점 기록을 뜻별로 모은다. 문항이 철회돼 찾을 수 없으면 건너뛴다. 처음 나온 순서를 지킨다. */
export function senseResultsOf(history: readonly Encounter[], questions: ReadonlyMap<string, QuestionTarget>): SenseResult[] {
  const bySense = new Map<string, SenseResult>();
  for (const e of history) {
    const q = questions.get(e.questionId);
    if (!e.answer || !q) continue;
    let r = bySense.get(q.target.senseKey);
    if (!r) bySense.set(q.target.senseKey, r = { senseKey: q.target.senseKey, lemma: q.target.lemma, missedQuestionIds: [], missed: 0, correct: 0 });
    if (e.answer.correct) r.correct++;
    else {
      r.missed++;
      if (!r.missedQuestionIds.includes(e.questionId)) r.missedQuestionIds.push(e.questionId);
    }
  }
  return [...bySense.values()];
}

const byAge = (a: ReviewNoteItem, b: ReviewNoteItem) =>
  a.lastSeenAt.localeCompare(b.lastSeenAt) || a.addedAt.localeCompare(b.addedAt) || a.senseKey.localeCompare(b.senseKey) || a.bankId.localeCompare(b.bankId);

/**
 * 끝난 판을 노트에 반영한다(순수 함수, 입력 노트는 바꾸지 않는다).
 * - 이 판에서 틀린 뜻: 담는다. 이미 있으면 misses+1, 어느 쪽이든 clears=0.
 * - 틀리지 않고 맞힌 뜻이 이미 노트에 있으면(= 다른 판에서 담은 것): 판 하나에 clears+1. 2가 되면 빼고 graduated+1.
 * - 같은 판에서 틀린 뒤 맞힌 뜻은 맞힌 것으로 세지 않는다(다른 판에서 맞혀야 졸업한다).
 * - 60개를 넘으면 오래 안 본 것부터 뺀다.
 */
export function applyRunToNote(note: ReviewNote, results: readonly SenseResult[], bankId: string, now: string): { note: ReviewNote; delta: ReviewDelta } {
  const next: ReviewNote = { v: 2, items: structuredClone(note.items), graduated: note.graduated };
  const touched = new Set<string>();
  let graduated = 0;
  for (const r of results) {
    const key = reviewNoteItemKey(bankId, r.senseKey);
    const current = next.items[key];
    if (r.missed > 0) {
      next.items[key] = current
        ? {
            ...current, bankId, lemma: r.lemma, misses: current.misses + 1, clears: 0, lastSeenAt: now,
            questionIds: [...r.missedQuestionIds, ...current.questionIds.filter(id => !r.missedQuestionIds.includes(id))].slice(0, MAX_QUESTION_IDS),
          }
        : { lemma: r.lemma, senseKey: r.senseKey, bankId, questionIds: r.missedQuestionIds.slice(0, MAX_QUESTION_IDS), misses: 1, clears: 0, addedAt: now, lastSeenAt: now };
      touched.add(key);
    } else if (current && r.correct > 0) {
      current.lastSeenAt = now;
      current.clears++;
      if (current.clears >= REVIEW_GRADUATE_CLEARS) {
        delete next.items[key];
        next.graduated++;
        graduated++;
      }
    }
  }
  const keys = Object.keys(next.items);
  if (keys.length > REVIEW_NOTE_MAX) {
    const oldest = keys.map(k => next.items[k]!).sort(byAge).slice(0, keys.length - REVIEW_NOTE_MAX);
    for (const item of oldest) delete next.items[reviewNoteItemKey(item.bankId, item.senseKey)];
  }
  return { note: next, delta: { added: [...touched].filter(k => next.items[k]).length, graduated } };
}

/**
 * 이 판(은행·난이도)에서 쓸 수 있는 노트 항목을 복습 순서로 돌려준다: 틀린 횟수 많은 순, 같으면 오래 안 본 순.
 * 다른 은행 항목과, 철회되거나 난이도 문에 걸려 풀에 문항이 하나도 없는 뜻은 읽을 때 걸러 낸다(지우지는 않는다).
 */
export function listReviewNoteItems(note: ReviewNote, bankId: string, questions: ReadonlyMap<string, QuestionTarget>): ReviewNoteItem[] {
  const senses = new Set<string>();
  for (const q of questions.values()) senses.add(q.target.senseKey);
  return Object.values(note.items)
    .filter(i => i.bankId === bankId && senses.has(i.senseKey))
    .map(i => ({ ...i, questionIds: i.questionIds.filter(id => questions.has(id)) }))
    .sort((a, b) => b.misses - a.misses || byAge(a, b));
}

/** `createRun`에 넘길 판 복사본: 쓸 수 있는 항목 가운데 앞에서 12개. */
export function reviewSensesForRun(note: ReviewNote, bankId: string, questions: ReadonlyMap<string, QuestionTarget>): ReviewSense[] {
  return listReviewNoteItems(note, bankId, questions)
    .slice(0, MAX_REVIEW_SENSES)
    .map(i => ({ senseKey: i.senseKey, lemma: i.lemma, questionIds: i.questionIds, misses: i.misses, lastSeenAt: i.lastSeenAt }));
}

// --- localStorage 입출력. 시험은 가짜 저장소를 넘겨 쓴다. ---

export type NoteStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 저장소를 못 쓰는 환경(차단·서버·시험)이면 null. */
export function defaultNoteStore(): NoteStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadReviewNote(store: NoteStore | null = defaultNoteStore()): ReviewNote {
  if (!store) return emptyReviewNote();
  try {
    const raw = store.getItem(REVIEW_NOTE_KEY) ?? store.getItem(LEGACY_REVIEW_NOTE_KEY);
    return raw ? normalizeReviewNote(JSON.parse(raw)) : emptyReviewNote();
  } catch {
    return emptyReviewNote();
  }
}

export function saveReviewNote(note: ReviewNote, store: NoteStore | null = defaultNoteStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(REVIEW_NOTE_KEY, JSON.stringify(note));
  } catch {
    return false;
  }
  // 새 기록을 저장하지 못했을 때는 v1 원본을 남긴다. 삭제만 막혀도 v2 저장은 성공이다.
  try { store.removeItem(LEGACY_REVIEW_NOTE_KEY); } catch { /* v2를 우선해서 읽는다. */ }
  return true;
}

/** 설정의 ‘이 기기 로컬 기록 정리’가 부른다. 저장소가 없거나 막혀 있어도 던지지 않는다. */
export function clearReviewNote(store: NoteStore | null = defaultNoteStore()): void {
  for (const key of [REVIEW_NOTE_KEY, LEGACY_REVIEW_NOTE_KEY]) {
    try { store?.removeItem(key); } catch { /* 다른 버전의 정리도 시도한다. */ }
  }
}

/** 끝난 정규 판을 노트에 담고 결과 화면에 넘길 값을 돌려준다. 저장소를 쓸 수 없으면 아무것도 담지 않고 0을 돌려준다. */
export function recordFinishedRun(
  history: readonly Encounter[],
  bankId: string,
  questions: ReadonlyMap<string, QuestionTarget>,
  opts: { now?: Date; store?: NoteStore | null } = {},
): ReviewDelta {
  const store = opts.store === undefined ? defaultNoteStore() : opts.store;
  if (!store) return NO_REVIEW_DELTA;
  const { note, delta } = applyRunToNote(loadReviewNote(store), senseResultsOf(history, questions), bankId, (opts.now ?? new Date()).toISOString());
  return saveReviewNote(note, store) ? delta : NO_REVIEW_DELTA;
}

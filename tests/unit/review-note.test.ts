import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunController } from '../../src/application/RunController';
import { selectView } from '../../src/application/view';
import { BALANCE, contextFor, MAPS, PILOT_TOWERS } from '../../src/content';
import { createContext, type GameContext, type RuntimeQuestion } from '../../src/domain/context';
import { createEncounter, MAX_REVIEW_SENSES, pickQuestion } from '../../src/domain/quiz';
import { createRun } from '../../src/domain/run';
import type { Encounter, EncounterPhase, ReviewSense, RunState } from '../../src/domain/types';
import { clearLocalHistory, listRecords, resetDbConnection } from '../../src/persistence/db';
import {
  applyRunToNote,
  clearReviewNote,
  emptyReviewNote,
  listReviewNoteItems,
  loadReviewNote,
  normalizeReviewNote,
  recordFinishedRun,
  REVIEW_NOTE_KEY,
  REVIEW_NOTE_MAX,
  reviewSensesForRun,
  saveReviewNote,
  senseResultsOf,
  type NoteStore,
  type SenseResult,
} from '../../src/persistence/reviewNote';
import type * as LobbyClientModule from '../../src/persistence/lobbyClient';
import { answerCurrent, wrongChoice } from './helpers';

// R4 L(prd-r4 §6.1): 이 기기 오답 노트(담기·졸업·상한·거르기)와 준비 문제의 복습 단계(§9.4 제한·결정성).

vi.mock('../../src/persistence/lobbyClient', async importOriginal => ({
  ...(await importOriginal<typeof LobbyClientModule>()),
  queueAndFlushCompletedRun: vi.fn(async () => undefined),
}));

function fakeStorage(init: Record<string, string> = {}): NoteStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
}

const NOW = (n: number) => `2026-11-${String(n).padStart(2, '0')}T00:00:00.000Z`;
const res = (senseKey: string, o: { missed?: number; correct?: number; ids?: string[] } = {}): SenseResult => ({
  senseKey, lemma: senseKey.split('/')[0]!, missedQuestionIds: o.ids ?? (o.missed ? [`q-${senseKey}`] : []), missed: o.missed ?? 0, correct: o.correct ?? 0,
});

// ---------------------------------------------------------------------------------------------------------------------
describe('오답 노트 저장소', () => {
  it('틀린 문항과 ‘모르겠어요’를 뜻 단위로 담고, 맞힌 뜻은 담지 않는다', async () => {
    const ctx = contextFor(3, 'Normal');
    const s = createRun(ctx, runInput(ctx, 'rn-1'));
    const first = ctx.questions.get(s.quiz.current!.questionId)!;
    answerCurrent(ctx, s, 'wrong');
    const second = ctx.questions.get(s.quiz.current!.questionId)!;
    answerCurrent(ctx, s, 'skip');
    const third = ctx.questions.get(s.quiz.current!.questionId)!;
    answerCurrent(ctx, s, 'correct');
    expect(s.quiz.history.map(e => e.answer?.correct)).toEqual([false, false, true]);

    const store = fakeStorage();
    const delta = recordFinishedRun(s.quiz.history, s.config.bankId, ctx.questions, { store, now: new Date(NOW(1)) });
    expect(delta).toEqual({ added: 2, graduated: 0 });
    const note = loadReviewNote(store);
    expect(Object.keys(note.items).sort()).toEqual([first.target.senseKey, second.target.senseKey].sort());
    expect(note.items[third.target.senseKey]).toBeUndefined();
    expect(note.items[first.target.senseKey]).toEqual({
      lemma: first.target.lemma, senseKey: first.target.senseKey, bankId: s.config.bankId, questionIds: [first.id],
      misses: 1, clears: 0, addedAt: NOW(1), lastSeenAt: NOW(1),
    });
    expect(note.graduated).toBe(0);
    // 점수·퍼센트는 저장하지 않는다(PRD v0.5 §20.5).
    expect(JSON.stringify([...store.data.values()])).not.toMatch(/score|percent|mastery|숙련/i);
  });

  it('다시 틀리면 misses+1·clears 0, 다른 판에서 두 번 맞히면 졸업해 노트에서 빠지고 graduated가 오른다', () => {
    let note = emptyReviewNote();
    const step = (day: number, ...results: SenseResult[]) => {
      const out = applyRunToNote(note, results, 'g3', NOW(day));
      note = out.note;
      return out.delta;
    };
    expect(step(1, res('a/명사/1', { missed: 1 }))).toEqual({ added: 1, graduated: 0 });
    // 같은 판에서 틀린 뒤 맞힌 것은 맞힌 것으로 세지 않는다(다른 판에서 맞혀야 한다).
    expect(step(1, res('b/명사/1', { missed: 1, correct: 1 }))).toEqual({ added: 1, graduated: 0 });
    expect(note.items['b/명사/1']!.clears).toBe(0);
    // 다른 판에서 한 번 맞힘 → clears 1.
    expect(step(2, res('a/명사/1', { correct: 1 }))).toEqual({ added: 0, graduated: 0 });
    expect(note.items['a/명사/1']).toMatchObject({ misses: 1, clears: 1, lastSeenAt: NOW(2), addedAt: NOW(1) });
    // 또 틀리면 다시 처음부터: misses 2, clears 0.
    expect(step(3, res('a/명사/1', { missed: 1 }))).toEqual({ added: 1, graduated: 0 });
    expect(note.items['a/명사/1']).toMatchObject({ misses: 2, clears: 0 });
    // 한 판에서 여러 번 맞혀도 판 하나로 센다 → 두 판이 필요하다.
    expect(step(4, res('a/명사/1', { correct: 3 }))).toEqual({ added: 0, graduated: 0 });
    expect(note.items['a/명사/1']!.clears).toBe(1);
    expect(step(5, res('a/명사/1', { correct: 1 }))).toEqual({ added: 0, graduated: 1 });
    expect(note.items['a/명사/1']).toBeUndefined();
    expect(note.graduated).toBe(1);
    // 노트에 없는 뜻을 맞혀도 아무 일 없다.
    expect(step(6, res('z/명사/1', { correct: 2 }))).toEqual({ added: 0, graduated: 0 });
    expect(note.items['z/명사/1']).toBeUndefined();
  });

  it(`상한 ${REVIEW_NOTE_MAX}개: 넘으면 오래 안 본 것부터 뺀다`, () => {
    let note = emptyReviewNote();
    for (let run = 0; run < 7; run++) {
      const results = Array.from({ length: 10 }, (_, i) => res(`w${run * 10 + i}/명사/1`, { missed: 1 }));
      const out = applyRunToNote(note, results, 'g3', NOW(run + 1));
      note = out.note;
      expect(out.delta.added).toBe(10);
    }
    const keys = Object.keys(note.items);
    expect(keys).toHaveLength(REVIEW_NOTE_MAX);
    // 첫 판(1일)에 담은 10개가 빠졌다.
    expect(keys.some(k => Number(k.slice(1).split('/')[0]) < 10)).toBe(false);
    // 오래된 항목을 다시 만나면(맞혀도) 최근으로 갱신되어 먼저 빠지지 않는다.
    const refreshed = applyRunToNote(note, [res('w10/명사/1', { correct: 1 })], 'g3', NOW(20)).note;
    const next = applyRunToNote(refreshed, [res('new/명사/1', { missed: 1 })], 'g3', NOW(21)).note;
    expect(next.items['w10/명사/1']).toBeDefined();
    expect(next.items['w11/명사/1']).toBeUndefined();
    expect(Object.keys(next.items)).toHaveLength(REVIEW_NOTE_MAX);
  });

  it('판에 복사할 때: 다른 은행·철회돼 풀에 없는 뜻을 거르고, 틀린 횟수 많은 순→오래 안 본 순으로 최대 12개', () => {
    const ctx = contextFor(3, 'Normal');
    const ids = [...ctx.questionIds];
    const target = (id: string) => ctx.questions.get(id)!.target;
    const note = emptyReviewNote();
    const add = (id: string, misses: number, day: number, bankId = 'g3') => {
      note.items[target(id).senseKey] = { lemma: target(id).lemma, senseKey: target(id).senseKey, bankId, questionIds: [id], misses, clears: 0, addedAt: NOW(1), lastSeenAt: NOW(day) };
    };
    // 14개: misses 1(11개, 날짜 다름) + misses 3 + misses 2 + 다른 은행 1 + 풀에 없는 뜻 1.
    ids.slice(0, 11).forEach((id, i) => add(id, 1, 10 + i));
    add(ids[11]!, 3, 25);
    add(ids[12]!, 2, 26);
    add(ids[13]!, 5, 27, 'g4-other-bank');
    note.items['철회됨/명사/1'] = { lemma: '철회됨', senseKey: '철회됨/명사/1', bankId: 'g3', questionIds: ['g3-gone-0001'], misses: 9, clears: 0, addedAt: NOW(1), lastSeenAt: NOW(1) };

    const all = listReviewNoteItems(note, 'g3', ctx.questions);
    expect(all).toHaveLength(13); // 다른 은행·철회된 뜻은 읽을 때 걸러 낸다(노트에서 지우지는 않는다).
    expect(Object.keys(note.items)).toHaveLength(15);
    const picked = reviewSensesForRun(note, 'g3', ctx.questions);
    expect(picked).toHaveLength(MAX_REVIEW_SENSES);
    expect(picked.map(p => p.misses).slice(0, 3)).toEqual([3, 2, 1]);
    // 같은 횟수에서는 오래 안 본 것(날짜가 앞선 것)부터. 12개 중 마지막으로 밀린 것은 가장 최근에 본 misses 1.
    const ones = picked.filter(p => p.misses === 1).map(p => p.lastSeenAt);
    expect(ones).toEqual([...ones].sort());
    expect(picked.some(p => p.lastSeenAt === NOW(20))).toBe(false);
    expect(picked.every(p => p.senseKey !== '철회됨/명사/1')).toBe(true);

    // 철회돼 풀에 없는 문항 id는 questionIds에서 빠진다(뜻이 풀에 남아 있으면 뜻은 그대로 쓴다).
    note.items[target(ids[0]!).senseKey]!.questionIds = ['g3-gone-0002', ids[0]!];
    expect(listReviewNoteItems(note, 'g3', ctx.questions).find(i => i.senseKey === target(ids[0]!).senseKey)!.questionIds).toEqual([ids[0]]);
  });

  it('깨진 저장값·다른 버전·막힌 저장소에서도 던지지 않고 빈 노트로 진행한다', () => {
    expect(loadReviewNote(fakeStorage({ [REVIEW_NOTE_KEY]: '{깨짐' }))).toEqual(emptyReviewNote());
    expect(loadReviewNote(fakeStorage({ [REVIEW_NOTE_KEY]: JSON.stringify({ v: 2, items: {}, graduated: 0 }) }))).toEqual(emptyReviewNote());
    expect(loadReviewNote(null)).toEqual(emptyReviewNote());
    // 항목 하나가 깨져도 나머지는 살린다.
    const good = { lemma: '꼼꼼하다', senseKey: '꼼꼼하다/형용사/1', bankId: 'g3', questionIds: ['q1'], misses: 2, clears: 1, addedAt: NOW(1), lastSeenAt: NOW(2) };
    const note = normalizeReviewNote({ v: 1, graduated: 3, items: { a: { ...good, misses: 0 }, b: 'x', c: good, d: { ...good, questionIds: 'no' } } });
    expect(Object.keys(note.items)).toEqual(['꼼꼼하다/형용사/1']);
    expect(note.graduated).toBe(3);

    const throwing: NoteStore = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadReviewNote(throwing)).toEqual(emptyReviewNote());
    expect(saveReviewNote(emptyReviewNote(), throwing)).toBe(false);
    expect(() => clearReviewNote(throwing)).not.toThrow();
    const history = [{ questionId: [...contextFor(3, 'Normal').questionIds][0]!, answer: { correct: false } }] as unknown as Encounter[];
    const ctx = contextFor(3, 'Normal');
    expect(recordFinishedRun(history, 'g3', ctx.questions, { store: throwing })).toEqual({ added: 0, graduated: 0 });
    expect(recordFinishedRun(history, 'g3', ctx.questions, { store: null })).toEqual({ added: 0, graduated: 0 });
  });

  it('철회돼 찾을 수 없는 문항의 채점은 노트에 넣지 않는다', () => {
    const ctx = contextFor(3, 'Normal');
    const known = [...ctx.questionIds][0]!;
    const history = [
      { questionId: 'g3-gone-0001', answer: { correct: false } },
      { questionId: known, answer: { correct: false } },
      { questionId: known, answer: null },
    ] as unknown as Encounter[];
    const results = senseResultsOf(history, ctx.questions);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ missed: 1, correct: 0, missedQuestionIds: [known] });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('오답 노트 지우기·컨트롤러 담기', () => {
  beforeEach(async () => {
    await resetDbConnection();
    await clearLocalHistory();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clearLocalHistory가 오답 노트 키도 지운다', async () => {
    const store = fakeStorage({ [REVIEW_NOTE_KEY]: JSON.stringify(emptyReviewNote()), 'vocabulary-td.settings': '{}' });
    vi.stubGlobal('localStorage', store);
    await clearLocalHistory();
    expect(store.data.has(REVIEW_NOTE_KEY)).toBe(false);
    // 노트가 아닌 다른 키(환경설정)는 건드리지 않는다.
    expect(store.data.has('vocabulary-td.settings')).toBe(true);
  });

  async function finished(opts: { recordOnFinish: boolean; end: 'quit' | 'leave'; store: ReturnType<typeof fakeStorage> }) {
    vi.stubGlobal('localStorage', opts.store);
    const ctx = contextFor(3, 'Normal');
    const s = createRun(ctx, runInput(ctx, `ctl-${opts.end}`));
    const wrongQuestion = ctx.questions.get(s.quiz.current!.questionId)!;
    const controller = new RunController(ctx, s, { recordOnFinish: opts.recordOnFinish });
    controller.dispatch({ type: 'answer', encounterId: s.quiz.current!.id, choice: wrongChoice(ctx, s) });
    expect(controller.getView().reviewDelta).toBeNull();
    if (opts.end === 'quit') controller.dispatch({ type: 'quit' });
    // 끝내지 않고 화면을 떠난 판(창 닫기·처음 화면으로)은 버려진다(이어하기 없음).
    if (opts.end === 'leave') controller.dispose();
    await new Promise(r => setTimeout(r, 20));
    return { controller, wrongQuestion, s };
  }

  it('이번 판 끝내기(quit)는 틀린 낱말을 담고 결과로 새로 담은 수를 넘긴다', async () => {
    const store = fakeStorage();
    const { controller, wrongQuestion } = await finished({ recordOnFinish: true, end: 'quit', store });
    await vi.waitFor(() => expect(controller.getView().reviewDelta).toEqual({ added: 1, graduated: 0 }));
    expect(Object.keys(loadReviewNote(store).items)).toEqual([wrongQuestion.target.senseKey]);
    expect(await listRecords()).toHaveLength(1);
    controller.dispose();
  });

  it('끝내지 않고 떠난 판은 담지도 기록하지도 않는다', async () => {
    const store = fakeStorage();
    const { controller } = await finished({ recordOnFinish: true, end: 'leave', store });
    expect(controller.getView().reviewDelta).toBeNull();
    expect(store.data.has(REVIEW_NOTE_KEY)).toBe(false);
    expect(await listRecords()).toEqual([]);
  });

  it('연습 판(recordOnFinish: false)은 끝나도 담지 않는다', async () => {
    const store = fakeStorage();
    const { controller } = await finished({ recordOnFinish: false, end: 'quit', store });
    expect(controller.getView().reviewDelta).toBeNull();
    expect(store.data.has(REVIEW_NOTE_KEY)).toBe(false);
    expect(await listRecords()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 복습 단계(domain/quiz.ts). 공개 은행은 뜻 하나에 문항 하나라서, 같은 뜻의 다른 문항을 시험하려고 합성 은행을 쓴다.

function runInput(ctx: GameContext, runId: string, reviewSenses?: readonly ReviewSense[], seed = 20261104) {
  return {
    runId, playerId: 'p1', nickname: '시험', grade: 3, difficulty: 'Normal' as const, mapId: ctx.map.id, seed,
    bankId: 'g3', bankVersion: '1', contentMode: 'development' as const, availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal' as const,
    createdAt: '2026-11-04T00:00:00.000Z', ...(reviewSenses ? { reviewSenses } : {}),
  };
}

/** q01·q02는 뜻 sA, q03·q04는 뜻 sB, q05는 뜻 sC, 나머지는 문항마다 뜻이 다르다. 36문항. */
function synthetic() {
  const template = contextFor(3, 'Normal').questions.values().next().value!;
  const senseOf = (i: number) => (i <= 2 ? 'sA' : i <= 4 ? 'sB' : i === 5 ? 'sC' : `s${i}`);
  const questions: RuntimeQuestion[] = Array.from({ length: 36 }, (_, n) => {
    const i = n + 1;
    const id = `q${String(i).padStart(2, '0')}`;
    return { ...structuredClone(template), id, readingLoad: 50, target: { lemma: `낱말${senseOf(i)}`, partOfSpeech: '명사', senseKey: senseOf(i) } };
  });
  const ctx = createContext({ balance: BALANCE, difficulty: 'Normal', map: MAPS.find(m => m.grade === 3)!, questions, battleReadingLoadMax: 70 });
  const sense = (senseKey: string, ...questionIds: string[]): ReviewSense => ({ senseKey, lemma: `낱말${senseKey}`, questionIds, misses: 1, lastSeenAt: NOW(1) });
  return { ctx, sense };
}

type Syn = ReturnType<typeof synthetic>;

/** 빈 이력·빈 큐에서 시작하는 판. `answered`개의 준비 문제를 채점한 상태로 만든다(이력만, 문항 내용은 상관없다). */
function state(syn: Syn, reviewSenses: ReviewSense[], opts: { graded?: Array<boolean> } = {}): RunState {
  const s = createRun(syn.ctx, runInput(syn.ctx, 'rv', reviewSenses));
  Object.assign(s.quiz, { queue: [], cursor: 0, cycle: 0, recentQuestions: [], recentSenses: [], current: null, reviewUsed: {} });
  s.quiz.history = (opts.graded ?? [true]).map(correct => ({ phase: 'prep', answer: { choice: 'a', tick: 0, correct, pt: 0, gold: 0 } }) as unknown as Encounter);
  return s;
}

const pick = (syn: Syn, s: RunState, phase: EncounterPhase = 'prep') => pickQuestion(syn.ctx, s.quiz, phase, { s: 4242 });

describe('복습 단계 선택(prd-r4 §6.1)', () => {
  it('준비 문제 3개에 1번꼴로(이 판 두 번째·다섯 번째…) 오답 노트 뜻을 먼저 내고, 같은 뜻의 다른 문항을 우선한다', () => {
    const syn = synthetic();
    const senses = [syn.sense('sA', 'q01')];
    // 채점한 준비 문제가 0·2·3개일 때는 복습 차례가 아니다. 1개·4개일 때 차례다.
    for (const graded of [[], [true, true], [true, true, true]]) expect(pick(syn, state(syn, senses, { graded })).review).toBe(false);
    for (const graded of [[true], [true, true, true, true]]) {
      expect(pick(syn, state(syn, senses, { graded }))).toEqual({ id: 'q02', review: true });
    }
  });

  it('같은 뜻의 다른 문항이 없으면 전에 틀린 문항을 다시 낸다', () => {
    const syn = synthetic();
    expect(pick(syn, state(syn, [syn.sense('sC', 'q05')]))).toEqual({ id: 'q05', review: true });
    // 다른 문항(q02)이 최근 30문항에 있으면 틀린 문항(q01)을 다시 낸다.
    const s = state(syn, [syn.sense('sA', 'q01')]);
    s.quiz.recentQuestions = ['q02'];
    expect(pick(syn, s)).toEqual({ id: 'q01', review: true });
  });

  it('최근 30문항·8뜻 제한을 지킨다: 걸리면 그 뜻을 건너뛰고, 모두 걸리면 기존 선택으로 넘어간다', () => {
    const syn = synthetic();
    const senses = [syn.sense('sA', 'q01'), syn.sense('sB', 'q03')];
    const recentSense = state(syn, senses);
    recentSense.quiz.recentSenses = ['s9', 'sA'];
    expect(pick(syn, recentSense)).toEqual({ id: 'q04', review: true });

    const bothQuestionsRecent = state(syn, senses);
    bothQuestionsRecent.quiz.recentQuestions = ['q01', 'q02'];
    expect(pick(syn, bothQuestionsRecent)).toEqual({ id: 'q04', review: true });

    const nothing = state(syn, senses);
    nothing.quiz.recentSenses = ['sA', 'sB'];
    const normal = pick(syn, nothing);
    expect(normal.review).toBe(false);
    expect(['sA', 'sB']).not.toContain(syn.ctx.questions.get(normal.id)!.target.senseKey);
  });

  it('덜 낸 뜻부터, 뜻 하나는 한 판에서 최대 2번까지다', () => {
    const syn = synthetic();
    const s = state(syn, [syn.sense('sA', 'q01'), syn.sense('sB', 'q03')]);
    s.quiz.reviewUsed = { sA: 1 };
    expect(pick(syn, s)).toEqual({ id: 'q04', review: true }); // sB가 0번, sA가 1번 → sB 먼저
    s.quiz.reviewUsed = { sA: 2, sB: 2 };
    expect(pick(syn, s).review).toBe(false);
    s.quiz.reviewUsed = { sA: 2, sB: 1 };
    expect(pick(syn, s)).toEqual({ id: 'q04', review: true });
  });

  it('도움 단계가 -1이면 복습을 쉬고, 전투 문제에서는 하지 않는다', () => {
    const syn = synthetic();
    const senses = [syn.sense('sA', 'q01')];
    // 채점 4개 → 복습 차례(4 % 3 = 1). 정답이 섞여 h=0이면 낸다.
    expect(pick(syn, state(syn, senses, { graded: [false, true, false, true] })).review).toBe(true);
    expect(pick(syn, state(syn, senses, { graded: [false, false, false, true] })).review).toBe(false);
    expect(pick(syn, state(syn, senses, { graded: [true, true, true, true] })).review).toBe(true); // +1은 쉬지 않는다
    // 복습 차례여도 전투 문제는 일반 선택이다.
    for (const graded of [[true], [true, true, true, true]]) expect(pick(syn, state(syn, senses, { graded }), 'battle').review).toBe(false);
  });

  it('복습 문항은 큐에서 이번 주기에 쓴 것으로 센다(큐 안에 있으면 앞으로 당기고, 이미 쓴 자리면 그대로)', () => {
    const syn = synthetic();
    const ids = syn.ctx.questionIds;
    const s = state(syn, [syn.sense('sA', 'q01')]);
    s.quiz.queue = [...ids];
    s.quiz.cursor = 0;
    const before = [...s.quiz.queue];
    expect(pick(syn, s)).toEqual({ id: 'q02', review: true });
    expect(s.quiz.cursor).toBe(1);
    expect(s.quiz.queue.slice(0, 1)).toEqual(['q02']);
    expect(s.quiz.queue.slice(1)).not.toContain('q02');
    expect([...s.quiz.queue].sort()).toEqual([...before].sort());

    // q02가 이번 주기에 이미 쓴 자리(커서 앞)에 있으면 큐를 건드리지 않는다.
    const used = state(syn, [syn.sense('sA', 'q01')]);
    used.quiz.queue = ['q02', ...ids.filter(id => id !== 'q02')];
    used.quiz.cursor = 2;
    const queue = [...used.quiz.queue];
    expect(pick(syn, used)).toEqual({ id: 'q02', review: true });
    expect([used.quiz.cursor, used.quiz.queue]).toEqual([2, queue]);
  });

  it('긴 판: 복습은 3번에 1번 차례에만, 뜻당 2번 이하, 앞선 8뜻·30문항과 겹치지 않고, 전투 문제에는 없다', () => {
    const syn = synthetic();
    const senses = [syn.sense('sA', 'q01'), syn.sense('sB', 'q03'), syn.sense('sC', 'q05')];
    const s = createRun(syn.ctx, runInput(syn.ctx, 'long', senses, 777));
    const seen: Encounter[] = [];
    const grade = (enc: Encounter, correct: boolean) => {
      enc.answer = { choice: 'a', tick: 0, correct, pt: 0, gold: 0 };
      s.quiz.history.push(structuredClone(enc));
      seen.push(enc);
    };
    grade(s.quiz.current!, true);
    for (let k = 1; k < 45; k++) grade(createEncounter(syn.ctx, s, 'prep'), k % 2 === 0); // 번갈아 맞히고 틀려 h=0을 지킨다
    const sense = (e: Encounter) => syn.ctx.questions.get(e.questionId)!.target.senseKey;
    const reviews = seen.map((e, k) => ({ e, k })).filter(x => x.e.review);
    expect(reviews.length).toBeGreaterThanOrEqual(4);
    const perSense: Record<string, number> = {};
    for (const { e, k } of reviews) {
      expect(k % 3, `${k}번째`).toBe(1);
      expect(['sA', 'sB', 'sC']).toContain(sense(e));
      perSense[sense(e)] = (perSense[sense(e)] ?? 0) + 1;
      expect(seen.slice(Math.max(0, k - 8), k).map(sense), `${k}번째의 앞선 8뜻`).not.toContain(sense(e));
      expect(seen.slice(Math.max(0, k - 30), k).map(x => x.questionId), `${k}번째의 앞선 30문항`).not.toContain(e.questionId);
    }
    expect(Math.max(...Object.values(perSense))).toBeLessThanOrEqual(2);
    expect(s.quiz.reviewUsed).toEqual(perSense);
    // 일반 문항에서도 복습 단계가 없던 시절의 제한(앞선 30문항 안에서는 반복 없음)이 그대로다.
    for (let k = 0; k < seen.length; k++) {
      if (seen[k]!.review) continue;
      expect(seen.slice(Math.max(0, k - 30), k).map(x => x.questionId)).not.toContain(seen[k]!.questionId);
    }

    for (let k = 0; k < 20; k++) expect(createEncounter(syn.ctx, s, 'battle').review).toBe(false);
  });

  it('같은 씨앗·같은 오답 노트 복사본이면 같은 출제(A18), 노트가 없으면 복습이 없다', () => {
    const syn = synthetic();
    const senses = [syn.sense('sA', 'q01'), syn.sense('sB', 'q03')];
    const play = (reviewSenses?: ReviewSense[]) => {
      const s = createRun(syn.ctx, runInput(syn.ctx, 'det', reviewSenses, 31337));
      const out: Array<[string, boolean]> = [[s.quiz.current!.questionId, s.quiz.current!.review]];
      s.quiz.current!.answer = { choice: 'a', tick: 0, correct: true, pt: 0, gold: 0 };
      s.quiz.history.push(structuredClone(s.quiz.current!));
      for (let k = 1; k < 20; k++) {
        const enc = createEncounter(syn.ctx, s, 'prep');
        enc.answer = { choice: 'a', tick: 0, correct: k % 2 === 0, pt: 0, gold: 0 };
        s.quiz.history.push(structuredClone(enc));
        out.push([enc.questionId, enc.review]);
      }
      return out;
    };
    const a = play(senses);
    expect(play(senses)).toEqual(a);
    expect(a.some(([, review]) => review)).toBe(true);
    const none = play();
    expect(none.some(([, review]) => review)).toBe(false);
    expect(play([])).toEqual(none);
    expect(play(senses)).not.toEqual(none);
  });
});

describe('판 시작 때 복사(createRun)', () => {
  it('최대 12뜻·중복 제거·깊은 복사이고, 설정(config)에는 들어가지 않는다', () => {
    const syn = synthetic();
    const many: ReviewSense[] = Array.from({ length: 15 }, (_, i) => syn.sense(`s${i + 10}`, `q${i + 10}`));
    many.push(many[0]!);
    const s = createRun(syn.ctx, runInput(syn.ctx, 'copy', many));
    expect(s.quiz.reviewSenses.map(x => x.senseKey)).toEqual(many.slice(0, MAX_REVIEW_SENSES).map(x => x.senseKey));
    many[0]!.questionIds.push('mutated');
    expect(s.quiz.reviewSenses[0]!.questionIds).toEqual(['q10']);
    expect('reviewSenses' in s.config).toBe(false);
    expect(s.quiz.reviewUsed).toEqual({});
    expect(createRun(syn.ctx, runInput(syn.ctx, 'none')).quiz.reviewSenses).toEqual([]);
  });

  it('복습 문항은 view.question.isReview로 알린다(보상은 그대로)', () => {
    const ctx = contextFor(3, 'Normal');
    const probe = createRun(ctx, runInput(ctx, 'probe'));
    const first = probe.quiz.current!.questionId;
    // 첫 문항이 아닌 문항 몇 개를 틀린 낱말로 적어 둔다.
    const notes = ctx.questionIds.filter(id => id !== first).slice(0, 5).map(id => ({
      senseKey: ctx.questions.get(id)!.target.senseKey, lemma: ctx.questions.get(id)!.target.lemma, questionIds: [id], misses: 1, lastSeenAt: NOW(1),
    }));
    const s = createRun(ctx, runInput(ctx, 'view', notes));
    expect(selectView(ctx, s).question!.isReview).toBe(false);
    answerCurrent(ctx, s, 'correct');
    const view = selectView(ctx, s).question!;
    expect(view.isReview).toBe(true);
    expect(notes.map(n => n.senseKey)).toContain(ctx.questions.get(s.quiz.current!.questionId)!.target.senseKey);
    expect(view.reward).toBeNull();
  });
});

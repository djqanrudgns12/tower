import { expect, it } from 'vitest';
import { BALANCE, contextFor, MAPS, loadGradeContent } from '../../src/content';
import { createContext, type GameContext, type RuntimeQuestion } from '../../src/domain/context';
import { createEncounter } from '../../src/domain/quiz';
import { advanceTick, applyCommand, createRun, replaceUnavailableQuestion } from '../../src/domain/run';
import type { DifficultyId } from '../../src/contracts/balance';

await loadGradeContent(3);
const template = contextFor(3, 'Normal').questions.values().next().value!;
function questions(n: number, grade = 3): RuntimeQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ ...structuredClone(template), id: `g${grade}-exposure-${String(i).padStart(3, '0')}`, grade,
    difficultyTier: 'core', variantTag: 'standard', readingLoad: 40,
    target: { lemma: `시험어${i}`, partOfSpeech: '명사', senseKey: `fixture/${grade}/${i}` },
  }));
}
function context(pool: RuntimeQuestion[], difficulty: DifficultyId = 'Normal', grade = 3) {
  return createContext({ balance: BALANCE, difficulty, map: MAPS.find(m => m.grade === grade)!, questions: pool, battleReadingLoadMax: 100 });
}
function start(ctx: GameContext, previousQuestionIds: string[] = []) {
  return createRun(ctx, Object.assign({ runId: 'exposure', playerId: 'test', nickname: '시험', grade: ctx.map.grade,
    difficulty: ctx.difficultyId, mapId: ctx.map.id, seed: 37, bankId: `g${ctx.map.grade}`, bankVersion: 'test',
    contentMode: 'development' as const, availableTowers: [], rankingEligibility: 'personal' as const, createdAt: '2026-11-07T00:00:00Z',
  }, { previousQuestionIds }));
}
function blank(ctx: GameContext) {
  const state = start(ctx);
  Object.assign(state.quiz, { presented: [], queue: [...ctx.questionIds], cursor: 0, recentQuestions: [], recentSenses: [], current: null, nextEncounterId: 1 });
  return state;
}

it('판 전체에서 같은 문항과 뜻은 한 번만 내며, 남은 뜻이 없으면 반복 대신 소진을 알린다', () => {
  const pool = questions(12);
  pool[1]!.target.senseKey = pool[0]!.target.senseKey;
  const ctx = context(pool), state = blank(ctx);
  const draws = Array.from({ length: 11 }, () => ctx.questions.get(createEncounter(ctx, state, 'prep').questionId)!);
  expect(new Set(draws.map(q => q.id)).size).toBe(11);
  expect(new Set(draws.map(q => q.target.senseKey)).size).toBe(11);
  expect(() => createEncounter(ctx, state, 'prep')).toThrow(/문항.*없/);
});

it.each(['Easy', 'Normal'] as const)('%s에서는 뜻이 달라도 같은 낱말을 한 판에 한 번만 낸다', difficulty => {
  const pool = questions(12); pool[1]!.target.lemma = pool[0]!.target.lemma;
  const ctx = context(pool, difficulty), state = blank(ctx);
  const draws = Array.from({ length: 11 }, () => ctx.questions.get(createEncounter(ctx, state, 'prep').questionId)!);
  expect(new Set(draws.map(q => q.target.lemma)).size).toBe(11);
  expect(() => createEncounter(ctx, state, 'prep')).toThrow(/문항.*없/);
});

it.each(['Hard', 'Crazy'] as const)('%s에서는 같은 낱말을 다른 뜻으로 두 번까지, 사이에 다른8문항을 두고 낸다', difficulty => {
  const pool = questions(14); pool[1]!.target.lemma = pool[0]!.target.lemma; pool[2]!.target.lemma = pool[0]!.target.lemma;
  const ctx = context(pool, difficulty), state = blank(ctx);
  const draws = Array.from({ length: 13 }, () => ctx.questions.get(createEncounter(ctx, state, 'prep').questionId)!);
  const positions = draws.flatMap((q, i) => q.target.lemma === pool[0]!.target.lemma ? [i] : []);
  expect(positions).toHaveLength(2);
  expect(positions[1]! - positions[0]!).toBeGreaterThanOrEqual(9);
  expect(() => createEncounter(ctx, state, 'prep')).toThrow(/문항.*없/);
});

it('공유 비율은 첫 출제부터30% 이하이며 공유만 남아도 상한을 풀지 않는다', () => {
  const own = questions(10, 5), shared = questions(20, 4).map(q => ({ ...q, target: { ...q.target, lemma: `공유${q.target.lemma}` } }));
  const ctx = context([...own, ...shared], 'Normal', 5), state = blank(ctx);
  let count = 0;
  for (let i = 1; i <= 14; i++) {
    if (ctx.questions.get(createEncounter(ctx, state, 'prep').questionId)!.grade !== 5) count++;
    expect(count * 10).toBeLessThanOrEqual(i * 3);
  }
  expect(count).toBe(4);
  expect(() => createEncounter(ctx, state, 'prep')).toThrow(/문항.*없/);
});

it('판 시작 이력은 복사하며 이미 푼 원ID를 뒤로 미루고 같은 입력을 재현한다', () => {
  const pool = questions(12), ctx = context(pool), prior = pool.slice(0, 9).map(q => q.id);
  const first = start(ctx, prior), second = JSON.parse(JSON.stringify(start(ctx, [...prior].reverse()))) as typeof first;
  prior.splice(0);
  const draw = (state: typeof first) => [state.quiz.current!.questionId, ...Array.from({ length: 11 }, () => createEncounter(ctx, state, 'prep').questionId)];
  const ids = draw(first);
  expect(ids.slice(0, 3).sort()).toEqual(pool.slice(9).map(q => q.id).sort());
  expect(draw(second)).toEqual(ids);
  expect(new Set(ids).size).toBe(12);
});

it('작은 풀은 다음 문항이 없으면 패배나 중복 출제 없이 정상 종료한다', () => {
  const ctx = context(questions(1)), state = start(ctx), current = state.quiz.current!;
  expect(applyCommand(ctx, state, { type: 'answer', encounterId: current.id, choice: template.correctOptionId }).ok).toBe(true);
  for (let tick = 0; tick < 300; tick++) advanceTick(ctx, state);
  expect(state.phase).toBe('GAME_OVER');
  expect(state.endReason).toBe('CONTENT_COMPLETE');
  expect(state.quiz.history).toHaveLength(1);
  expect(state.gateHp).toBe(state.gateMaxHp);
});

it('다른 학년 맵을 보여 주는 미리보기도 실제 은행 학년을 기준으로 출제한다', () => {
  const source = context(questions(5)), ctx = { ...source, map: MAPS.find(m => m.grade === 6)! };
  const state = start(ctx);
  expect(Array.from({ length: 4 }, () => createEncounter(ctx, state, 'prep').questionId)).toHaveLength(4);
});

it.each(['battle', 'wrapup', 'retraction'] as const)('%s에서 마지막 문항을 마치거나 철회해도 중복 없이 정상 종료한다', phase => {
  const ctx = context(questions(1)), state = start(ctx);
  if (phase === 'retraction') {
    const withdrawn = { ...ctx, questionIds: [], questions: new Map<string, RuntimeQuestion>() };
    const events = replaceUnavailableQuestion(withdrawn, state);
    expect(events.filter(event => event.type === 'gameOver')).toHaveLength(1);
    expect(state.quiz.history).toHaveLength(0);
    expect(state.quiz.current).toBeNull();
  } else {
    state.phase = phase === 'battle' ? 'BATTLE' : 'WAVE_WRAPUP';
    state.quiz.current!.phase = 'battle';
    state.quiz.current!.wrapup = phase === 'wrapup';
    state.battle = { spawnList: [{ kind: 'walker', elite: null }], spawnIndex: 0, nextSpawnTick: 10000, intervalTicks: 100, hpBaseMilli: 1000, startedTick: 0 };
    const current = state.quiz.current!;
    expect(applyCommand(ctx, state, { type: 'answer', encounterId: current.id, choice: template.correctOptionId }).ok).toBe(true);
    const events = Array.from({ length: 100 }, () => advanceTick(ctx, state)).flat();
    expect(events.filter(event => event.type === 'gameOver')).toHaveLength(1);
    expect(state.quiz.history).toHaveLength(1);
  }
  expect(state.phase).toBe('GAME_OVER');
  expect(state.endReason).toBe('CONTENT_COMPLETE');
  expect(state.gateHp).toBe(state.gateMaxHp);
});

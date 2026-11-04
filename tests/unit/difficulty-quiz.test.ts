import { describe, expect, it } from 'vitest';
import type { DifficultyId } from '../../src/contracts/balance';
import type { DifficultyTier, VariantTag } from '../../src/contracts/questions';
import { BALANCE, contextFor, DIFFICULTY_GATE, gradeContent, MAPS, PILOT_TOWERS } from '../../src/content';
import { createContext, isQuestionEligibleForDifficulty, type RuntimeQuestion } from '../../src/domain/context';
import { createEncounter, DEFAULT_TIER_SCHEDULE, helpLevel, pickQuestion } from '../../src/domain/quiz';
import { createRun } from '../../src/domain/run';
import type { Encounter, EncounterPhase, RunState } from '../../src/domain/types';

function makeSyntheticPool(grade = 4): RuntimeQuestion[] {
  const specs: Array<{ tier: DifficultyTier; tag: VariantTag; count: number }> = [
    { tier: 'basic', tag: 'standard', count: 25 },
    { tier: 'core', tag: 'standard', count: 25 },
    { tier: 'core', tag: 'polysemy', count: 10 },
    { tier: 'advanced', tag: 'standard', count: 15 },
    { tier: 'advanced', tag: 'confusable', count: 25 },
    { tier: 'challenge', tag: 'idiom_proverb', count: 15 },
    { tier: 'challenge', tag: 'dialect', count: 15 },
  ];
  const out: RuntimeQuestion[] = [];
  let idx = 1;
  for (const sp of specs) {
    for (let i = 0; i < sp.count; i++, idx++) {
      out.push({
        id: `g${grade}-syn-${String(idx).padStart(4, '0')}`,
        revision: 1,
        status: 'verified_candidate',
        grade,
        type: 'definition',
        difficultyTier: sp.tier,
        variantTag: sp.tag,
        ...(sp.tag === 'dialect' ? { dialectRegion: '경상' as const } : {}),
        target: {
          lemma: `낱말${idx}`,
          partOfSpeech: '명사',
          senseKey: `낱말${idx}/명사/${idx}-1`,
        },
        stem: `다음 문장에서 ‘낱말${idx}’의 뜻으로 알맞은 것은 무엇일까요? (${idx})`,
        options: [
          { id: 'a', text: '첫 번째 뜻풀이 보기입니다' },
          { id: 'b', text: '두 번째 뜻풀이 보기입니다' },
          { id: 'c', text: '세 번째 뜻풀이 보기입니다' },
          { id: 'd', text: '네 번째 뜻풀이 보기입니다' },
        ],
        correctOptionId: 'a',
        explanation: `‘낱말${idx}’의 뜻을 바르게 설명한 것이에요.`,
        distractorRationales: {
          b: '다른 뜻이에요.',
          c: '어울리지 않는 뜻이에요.',
          d: '반대에 가까운 뜻이에요.',
        },
        readingLoad: 52,
      });
    }
  }
  return out;
}

const ALL_DIFFICULTIES: DifficultyId[] = ['Easy', 'Normal', 'Hard', 'Crazy'];
const eligible = (tier: DifficultyTier, tag: VariantTag, d: DifficultyId) =>
  isQuestionEligibleForDifficulty({ difficultyTier: tier, variantTag: tag }, d, DIFFICULTY_GATE);
/** PRD §9.1: 어려움·아주 어려움에서만 내는 유형. */
const HARD_ONLY_TAGS: VariantTag[] = ['confusable', 'idiom_proverb', 'dialect'];

function runFor(pool: RuntimeQuestion[], difficulty: DifficultyId, draws: number, seed = 20261030) {
  const map = MAPS.find(m => m.grade === pool[0]!.grade)!;
  const ctx = createContext({ balance: BALANCE, difficulty, map, questions: pool, battleReadingLoadMax: 80, tierSchedule: DEFAULT_TIER_SCHEDULE[difficulty] });
  const s = createRun(ctx, {
    runId: `sim-${difficulty}`, playerId: 'p1', nickname: '검증러', grade: pool[0]!.grade, difficulty, mapId: map.id, seed,
    bankId: 'syn', bankVersion: '1', contentMode: 'development', availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal',
    createdAt: '2026-10-30T00:00:00.000Z',
  });
  // createRun이 이미 첫 준비 문항 1개를 뽑았다.
  const picked = [ctx.questions.get(s.quiz.current!.questionId)!];
  for (let i = 1; i < draws; i++) picked.push(ctx.questions.get(createEncounter(ctx, s, 'prep').questionId)!);
  return { ctx, s, picked };
}

describe('난이도 × 심화 단계 출제(PRD §9.1, §9.4)', () => {
  it('쉬움·보통은 도전 단계와 관용구·속담·혼동 어휘·방언을 내지 않고, 어려움·아주 어려움은 기초를 빼고 모두 낸다', () => {
    for (const d of ['Easy', 'Normal'] as DifficultyId[]) {
      expect(eligible('basic', 'standard', d)).toBe(true);
      expect(eligible('core', 'polysemy', d)).toBe(true);
      expect(eligible('challenge', 'standard', d)).toBe(false);
      for (const tag of HARD_ONLY_TAGS) expect(eligible('advanced', tag, d), `${d} ${tag}`).toBe(false);
    }
    expect(eligible('advanced', 'standard', 'Easy')).toBe(false);
    expect(eligible('advanced', 'standard', 'Normal')).toBe(true);
    for (const d of ['Hard', 'Crazy'] as DifficultyId[]) {
      expect(eligible('basic', 'standard', d)).toBe(false);
      for (const tier of ['core', 'advanced', 'challenge'] as DifficultyTier[]) {
        for (const tag of ['standard', 'polysemy', ...HARD_ONLY_TAGS] as VariantTag[]) expect(eligible(tier, tag, d), `${d} ${tier} ${tag}`).toBe(true);
      }
    }
    // 표지 없는 문항(초기 공개 은행)은 core·standard로 보아 네 난이도 모두에서 나온다.
    for (const d of ALL_DIFFICULTIES) expect(isQuestionEligibleForDifficulty({}, d, DIFFICULTY_GATE)).toBe(true);
  });

  it('합성 은행 200회: 쉬움·보통에는 어려움 전용 유형·도전 단계가 0건, 아주 어려움의 도전 비중이 어려움보다 높다', () => {
    const all = makeSyntheticPool(4);
    const picked = Object.fromEntries(ALL_DIFFICULTIES.map(d => [d, runFor(all.filter(q => isQuestionEligibleForDifficulty(q, d, DIFFICULTY_GATE)), d, 200).picked]));
    for (const d of ['Easy', 'Normal']) {
      expect(picked[d]!.filter(q => q.difficultyTier === 'challenge' || HARD_ONLY_TAGS.includes(q.variantTag ?? 'standard'))).toEqual([]);
    }
    expect(picked.Normal!.some(q => q.difficultyTier === 'advanced')).toBe(true);
    const challenges = (d: string) => picked[d]!.filter(q => q.difficultyTier === 'challenge').length;
    expect(challenges('Hard')).toBeGreaterThan(30);
    expect(challenges('Crazy')).toBeGreaterThan(challenges('Hard'));
    for (const d of ['Hard', 'Crazy']) expect(picked[d]!.some(q => q.variantTag === 'dialect')).toBe(true);
  });

  it('심화 단계를 골라 내도 풀을 한 바퀴 다 쓰기 전에는 같은 문항을 다시 내지 않는다(PRD §9.4)', () => {
    const all = makeSyntheticPool(4);
    for (const d of ALL_DIFFICULTIES) {
      const pool = all.filter(q => isQuestionEligibleForDifficulty(q, d, DIFFICULTY_GATE));
      const { s, picked } = runFor(pool, d, pool.length);
      expect(new Set(picked.map(q => q.id)).size, `${d}: 한 바퀴 ${pool.length}회`).toBe(pool.length);
      expect(s.quiz.cycle, d).toBe(1);
    }
  });

  it('런타임 은행은 공개(published) 은행이거나 3학년 개발용 묶음뿐이다(PRD §9.3·§9.4)', () => {
    for (const grade of [3, 4, 5, 6]) {
      const { bank } = gradeContent(grade);
      if (!bank) continue;
      expect(['published', 'dev_fixture'], `${grade}학년 ${bank.bankId}`).toContain(bank.status);
      if (bank.status === 'dev_fixture') expect(grade).toBe(3);
      expect(bank.questions.every(q => q.status === bank.status)).toBe(true);
      for (const difficulty of ALL_DIFFICULTIES) {
        const ctx = contextFor(grade, difficulty);
        for (const q of ctx.questions.values()) expect(isQuestionEligibleForDifficulty(q, difficulty, DIFFICULTY_GATE)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// R4 L(prd-r4 §6.2): 판 안 도움 단계 h

const graded = (correct: boolean | 'skip'): Pick<Encounter, 'answer'> => ({
  answer: { choice: correct === 'skip' ? 'skipped' : correct ? 'a' : 'b', tick: 0, correct: correct === true, pt: 0, gold: 0 },
});
const seq = (...kinds: Array<boolean | 'skip'>) => kinds.map(graded);

describe('도움 단계 h(prd-r4 §6.2)', () => {
  it('최근 채점 4개: 오답·모르겠어요 3개 이상이면 -1, 4연속 정답이면 +1, 나머지는 0', () => {
    expect(helpLevel([])).toBe(0);
    expect(helpLevel(seq(true, true, true))).toBe(0);
    expect(helpLevel(seq(true, true, true, true))).toBe(1);
    expect(helpLevel(seq(true, true, true, false))).toBe(0);
    expect(helpLevel(seq(true, true, false, false))).toBe(0);
    expect(helpLevel(seq(false, true, false, true))).toBe(0);
    expect(helpLevel(seq(false, false, false))).toBe(-1);
    expect(helpLevel(seq(false, true, false, false))).toBe(-1);
    // ‘모르겠어요’도 오답과 같이 센다.
    expect(helpLevel(seq('skip', 'skip', true, 'skip'))).toBe(-1);
    // 최근 4개만 본다: 앞쪽의 오답은 잊고, 뒤쪽 4개가 모두 정답이면 올린다.
    expect(helpLevel(seq(false, false, false, false, true, true, true, true))).toBe(1);
    expect(helpLevel(seq(true, true, true, true, true, false, false, false))).toBe(-1);
  });

  it('판은 도움 단계 0에서 시작하고 채점 기록만 본다(판 밖 숙련도 없음)', () => {
    const { s } = runFor(makeSyntheticPool(4).filter(q => isQuestionEligibleForDifficulty(q, 'Normal', DIFFICULTY_GATE)), 'Normal', 1);
    expect(helpLevel(s.quiz.history)).toBe(0);
  });
});

/** 빈 큐·빈 이력에서 시작하는 판. 도움 단계는 history를 채워 만든다. */
function fresh(ctx: ReturnType<typeof createContext>, difficulty: DifficultyId, history: Array<boolean | 'skip'> = [], nextEncounterId = 1): RunState {
  const s = createRun(ctx, {
    runId: 'h-test', playerId: 'p1', nickname: '시험', grade: 4, difficulty, mapId: ctx.map.id, seed: 20261104,
    bankId: 'syn', bankVersion: '1', contentMode: 'development', availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal',
    createdAt: '2026-11-04T00:00:00.000Z',
  });
  Object.assign(s.quiz, { queue: [], cursor: 0, cycle: 0, recentQuestions: [], recentSenses: [], current: null, nextEncounterId });
  s.quiz.history = history.map(k => ({ ...graded(k) }) as Encounter);
  return s;
}

/** 문항을 하나 내고 채점해 이력에 남긴다(answer()가 하는 일 중 선택에 보이는 부분). */
function drawGraded(ctx: ReturnType<typeof createContext>, s: RunState, phase: EncounterPhase, correct: boolean): RuntimeQuestion {
  const enc = createEncounter(ctx, s, phase);
  enc.answer = { choice: correct ? 'a' : 'b', tick: s.tick, correct, pt: 0, gold: 0 };
  s.quiz.history.push(structuredClone(enc));
  return ctx.questions.get(enc.questionId)!;
}

describe('도움 단계 × 단계 있는 은행(합성 은행: 코드 변경 없이 단계 이동이 켜진다)', () => {
  const tierIndex = (tier: DifficultyTier | undefined) => ['basic', 'core', 'advanced', 'challenge'].indexOf(tier ?? 'core');
  const poolFor = (d: DifficultyId) => makeSyntheticPool(4).filter(q => isQuestionEligibleForDifficulty(q, d, DIFFICULTY_GATE));
  const ctxFor = (d: DifficultyId) => {
    const pool = poolFor(d);
    return createContext({ balance: BALANCE, difficulty: d, map: MAPS.find(m => m.grade === 4)!, questions: pool, battleReadingLoadMax: 80, tierSchedule: DEFAULT_TIER_SCHEDULE[d] });
  };
  const tierPicked = (d: DifficultyId, history: Array<boolean | 'skip'>, nextEncounterId: number) => {
    const ctx = ctxFor(d);
    const s = fresh(ctx, d, history, nextEncounterId);
    return ctx.questions.get(pickQuestion(ctx, s.quiz, 'prep', { s: 123 }).id)!.difficultyTier;
  };
  const wrong4 = [false, false, false, false];
  const right4 = [true, true, true, true];

  it('어려움: 일정표 단계(고급·핵심·도전)를 -1이면 한 칸 내리고 +1이면 한 칸 올린다', () => {
    // 어려움 일정표 1~3번째 = advanced, core, challenge.
    expect([1, 2, 3].map(id => tierPicked('Hard', [], id))).toEqual(['advanced', 'core', 'challenge']);
    expect([1, 2, 3].map(id => tierPicked('Hard', wrong4, id))).toEqual(['core', 'core', 'advanced']);
    expect([1, 2, 3].map(id => tierPicked('Hard', right4, id))).toEqual(['challenge', 'advanced', 'challenge']);
  });

  it('난이도 문 밖으로는 옮기지 않는다: 어려움에 기초는 없고, 보통에 도전은 없다', () => {
    // 어려움 core를 내리면 basic이 되지만 풀에 없으므로 core에 머문다(위 시험의 두 번째 값). 보통은 advanced를 올려도 그대로다.
    expect(tierPicked('Normal', right4, 3)).toBe('advanced'); // 보통 일정표 3번째 = advanced, 도전은 없다
    expect(tierPicked('Normal', wrong4, 3)).toBe('core');
    expect(tierPicked('Normal', wrong4, 4)).toBe('basic'); // 4번째 = basic, 더 내릴 곳이 없다
    expect(tierPicked('Easy', right4, 1)).toBe('core'); // 쉬움 1번째 basic → core, 쉬움에 advanced는 없다
    expect(tierPicked('Easy', right4, 3)).toBe('core'); // 쉬움 3번째 core → advanced는 문 밖이라 머문다
  });

  it('옮긴 단계가 이번 주기에 비면 일정표 단계, 그것도 비면 기존 완화로 넘어간다', () => {
    const ctx = ctxFor('Hard');
    const s = fresh(ctx, 'Hard', wrong4, 2); // 일정표 core, h=-1 → basic 없음 → core
    const picked: Array<DifficultyTier | undefined> = [];
    // core 35문항을 모두 쓴 뒤에도 던지지 않고 다른 단계로 넘어간다. 풀을 한 바퀴 쓰기 전에는 같은 문항이 나오지 않는다.
    const total = ctx.questionIds.length;
    for (let i = 0; i < total; i++) {
      s.quiz.nextEncounterId = 2;
      picked.push(drawGraded(ctx, s, 'prep', false).difficultyTier);
    }
    expect(new Set(s.quiz.recentQuestions).size).toBe(Math.min(30, total));
    expect(picked.slice(0, 30).every(tier => tier === 'core')).toBe(true);
    expect(picked.slice(35).some(tier => tier !== 'core')).toBe(true);
  });

  it('+1일 때 평균 단계가 0보다 높고, -1일 때 낮다(보통, 30문항)', () => {
    const mean = (kind: 'low' | 'mid' | 'high') => {
      const ctx = ctxFor('Normal');
      const s = fresh(ctx, 'Normal');
      let sum = 0;
      for (let i = 0; i < 30; i++) {
        // low: 항상 오답 → -1. high: 항상 정답 → +1. mid: 번갈아 → 0.
        const correct = kind === 'high' || (kind === 'mid' && i % 2 === 1);
        s.quiz.nextEncounterId = 1 + (i % 10);
        sum += tierIndex(drawGraded(ctx, s, 'prep', correct).difficultyTier);
      }
      return sum / 30;
    };
    const [low, mid, high] = [mean('low'), mean('mid'), mean('high')];
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });
});

describe('도움 단계 × 단계 없는 은행(읽기 부담, 공개 3학년 51문항)', () => {
  const ctx = contextFor(3, 'Normal');
  const loadOf = (id: string) => ctx.questions.get(id)!.readingLoad;
  const byLoad = [...ctx.questionIds].sort((a, b) => loadOf(a) - loadOf(b) || (a < b ? -1 : 1));
  const k = Math.ceil(byLoad.length * 0.4);
  const low = new Set(byLoad.slice(0, k));
  const high = new Set(byLoad.slice(byLoad.length - k));
  const mean = (qs: RuntimeQuestion[]) => qs.reduce((a, q) => a + q.readingLoad, 0) / qs.length;
  /** 앞선 채점 기록(`before`)으로 h를 먼저 정해 두고 n개를 낸다. */
  const play = (n: number, answerAt: (i: number) => boolean, before: boolean[] = []) => {
    const s = fresh(ctx, 'Normal', before);
    return Array.from({ length: n }, (_, i) => drawGraded(ctx, s, 'prep', answerAt(i)));
  };

  it('공개 은행에는 단계가 없다(그래서 읽기 부담 경로가 실제로 일한다)', () => {
    expect(new Set([...ctx.questions.values()].map(q => q.difficultyTier ?? 'core')).size).toBe(1);
    expect(low.size).toBe(21);
  });

  it('h=-1이면 하위 40% 안에서 먼저 고르고, 그 구간이 바닥나면 던지지 않고 기존 단계로 넘어간다', () => {
    const picked = play(low.size + 3, () => false, [false, false, false, false]);
    expect(picked.slice(0, low.size).every(q => low.has(q.id))).toBe(true);
    expect(picked.slice(low.size).some(q => !low.has(q.id))).toBe(true);
    // 한 바퀴를 다 쓰기 전에는 같은 문항이 다시 나오지 않는다.
    expect(new Set(picked.map(q => q.id)).size).toBe(picked.length);
  });

  it('h=+1이면 상위 40% 안에서 먼저 고른다', () => {
    const picked = play(high.size, () => true, [true, true, true, true]);
    expect(picked.every(q => high.has(q.id))).toBe(true);
  });

  it('고른 문항의 평균 읽기 부담: -1은 0보다 낮고, +1은 0보다 높다', () => {
    const low1 = mean(play(18, () => false, [false, false, false, false]));
    const mid = mean(play(18, i => i % 2 === 1));
    const high1 = mean(play(18, () => true, [true, true, true, true]));
    expect(low1).toBeLessThan(mid);
    expect(high1).toBeGreaterThan(mid);
  });

  it('전투 문제에서는 +1이어도 전투 읽기 부담 상한을 넘는 문항을 내지 않는다', () => {
    const s = fresh(ctx, 'Normal');
    const picked = Array.from({ length: 15 }, () => drawGraded(ctx, s, 'battle', true));
    expect(picked.every(q => q.readingLoad <= ctx.battleReadingLoadMax)).toBe(true);
  });

  it('h=0이면 예전과 같은 선택이다(구간 단계를 끼우지 않는다)', () => {
    const a = fresh(ctx, 'Normal', [true, false]);
    const b = fresh(ctx, 'Normal', []);
    expect(pickQuestion(ctx, a.quiz, 'prep', { s: 99 }).id).toBe(pickQuestion(ctx, b.quiz, 'prep', { s: 99 }).id);
  });
});

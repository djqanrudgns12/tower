import { describe, expect, it } from 'vitest';
import type { DifficultyId } from '../../src/contracts/balance';
import type { DifficultyTier, VariantTag } from '../../src/contracts/questions';
import { BALANCE, contextFor, DIFFICULTY_GATE, gradeContent, MAPS, PILOT_TOWERS } from '../../src/content';
import { createContext, isQuestionEligibleForDifficulty, type RuntimeQuestion } from '../../src/domain/context';
import { createEncounter, DEFAULT_TIER_SCHEDULE } from '../../src/domain/quiz';
import { createRun } from '../../src/domain/run';

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

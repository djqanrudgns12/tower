import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DifficultyId } from '../../src/contracts/balance';
import type { DifficultyTier, VariantTag } from '../../src/contracts/questions';
import { BALANCE, contextFor, gradeContent, MAPS, PILOT_TOWERS } from '../../src/content';
import { createContext, isQuestionEligibleForDifficulty, type RuntimeQuestion } from '../../src/domain/context';
import { createEncounter, DEFAULT_TIER_SCHEDULE } from '../../src/domain/quiz';
import { createRun } from '../../src/domain/run';

const root = path.resolve(import.meta.dirname, '../..');

function makeSyntheticPool(grade = 4): RuntimeQuestion[] {
  const specs: Array<{ tier: DifficultyTier; tag: VariantTag; count: number }> = [
    { tier: 'basic', tag: 'standard', count: 25 },
    { tier: 'core', tag: 'standard', count: 25 },
    { tier: 'core', tag: 'polysemy', count: 10 },
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

describe('4단계 난이도 × 4단계 어휘 심화도(basic/core/advanced/challenge) 출제 엔진', () => {
  it('난이도별 허용 게이트(isQuestionEligibleForDifficulty)가 방언과 도전 문항을 엄격히 분리한다', () => {
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'basic', variantTag: 'standard' }, 'Easy')).toBe(true);
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'core', variantTag: 'standard' }, 'Easy')).toBe(true);
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'advanced', variantTag: 'confusable' }, 'Easy')).toBe(false);
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'challenge', variantTag: 'dialect' }, 'Easy')).toBe(false);

    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'basic', variantTag: 'standard' }, 'Normal')).toBe(true);
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'advanced', variantTag: 'confusable' }, 'Normal')).toBe(true);
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'challenge', variantTag: 'idiom_proverb' }, 'Normal')).toBe(false);
    expect(isQuestionEligibleForDifficulty({ difficultyTier: 'challenge', variantTag: 'dialect' }, 'Normal')).toBe(false);

    for (const diff of ['Hard', 'Crazy'] as DifficultyId[]) {
      expect(isQuestionEligibleForDifficulty({ difficultyTier: 'basic', variantTag: 'standard' }, diff)).toBe(false);
      expect(isQuestionEligibleForDifficulty({ difficultyTier: 'core', variantTag: 'standard' }, diff)).toBe(true);
      expect(isQuestionEligibleForDifficulty({ difficultyTier: 'advanced', variantTag: 'confusable' }, diff)).toBe(true);
      expect(isQuestionEligibleForDifficulty({ difficultyTier: 'challenge', variantTag: 'idiom_proverb' }, diff)).toBe(true);
      expect(isQuestionEligibleForDifficulty({ difficultyTier: 'challenge', variantTag: 'dialect' }, diff)).toBe(true);
    }
  });

  it('합성 은행 200회 순환 시 Easy/Normal에는 방언·도전 문항이 0건이고, Crazy의 challenge 비중이 Hard보다 높다', () => {
    const allQuestions = makeSyntheticPool(4);
    const map = MAPS.find(m => m.grade === 4)!;

    const runSample = (difficulty: DifficultyId) => {
      const eligible = allQuestions.filter(q => isQuestionEligibleForDifficulty(q, difficulty));
      const ctx = createContext({
        balance: BALANCE,
        difficulty,
        map,
        questions: eligible,
        battleReadingLoadMax: 80,
        tierSchedule: DEFAULT_TIER_SCHEDULE[difficulty],
      });
      const s = createRun(ctx, {
        runId: `sim-${difficulty}`,
        playerId: 'p1',
        nickname: '검증러',
        grade: 4,
        difficulty,
        mapId: map.id,
        seed: 20261030,
        bankId: 'syn',
        bankVersion: '1',
        contentMode: 'development',
        availableTowers: [...PILOT_TOWERS],
        rankingEligibility: 'personal',
        createdAt: '2026-10-30T00:00:00.000Z',
      });
      // createRun이 이미 첫 준비 문항 1개를 뽑았으므로 이어서 199개를 더 뽑는다.
      const picked = [ctx.questions.get(s.quiz.current!.questionId)!];
      for (let i = 1; i < 200; i++) {
        const enc = createEncounter(ctx, s, i % 2 === 0 ? 'battle' : 'prep');
        picked.push(ctx.questions.get(enc.questionId)!);
      }
      return picked;
    };

    const easyPicked = runSample('Easy');
    const normalPicked = runSample('Normal');
    const hardPicked = runSample('Hard');
    const crazyPicked = runSample('Crazy');

    expect(easyPicked.every(q => (q.difficultyTier === 'basic' || q.difficultyTier === 'core') && q.variantTag !== 'dialect')).toBe(true);
    expect(normalPicked.every(q => q.difficultyTier !== 'challenge' && q.variantTag !== 'dialect')).toBe(true);
    expect(normalPicked.some(q => q.difficultyTier === 'advanced')).toBe(true);

    const hardChallenges = hardPicked.filter(q => q.difficultyTier === 'challenge').length;
    const crazyChallenges = crazyPicked.filter(q => q.difficultyTier === 'challenge').length;
    expect(hardChallenges).toBeGreaterThan(30);
    expect(crazyChallenges).toBeGreaterThan(hardChallenges);
    expect(hardPicked.some(q => q.variantTag === 'dialect')).toBe(true);
    expect(crazyPicked.some(q => q.variantTag === 'dialect')).toBe(true);
  });

  const allFourCandidatesExist = [3, 4, 5, 6].every(g =>
    existsSync(path.join(root, `src/content/questions/grade${g}.candidate.json`))
  );

  it.skipIf(!allFourCandidatesExist)('3~6학년 실제 런타임 은행이 각 학년 1,000문항을 초과하고 4단계 난이도 회전을 정상 수행한다', () => {
    for (const grade of [3, 4, 5, 6]) {
      const { bank } = gradeContent(grade);
      expect(bank, `${grade}학년 은행 없음`).not.toBeNull();
      expect(bank!.questions.length).toBeGreaterThan(1000);

      const distinctLemmas = new Set(bank!.questions.map(q => q.target.lemma.normalize('NFC')));
      expect(distinctLemmas.size).toBeGreaterThanOrEqual(340);

      for (const difficulty of ['Easy', 'Normal', 'Hard', 'Crazy'] as DifficultyId[]) {
        const ctx = contextFor(grade, difficulty);
        expect(ctx.questionIds.length).toBeGreaterThan(400);
        const s = createRun(ctx, {
          runId: `real-${grade}-${difficulty}`,
          playerId: 'p1',
          nickname: '학년검증',
          grade,
          difficulty,
          mapId: ctx.map.id,
          seed: 77700 + grade,
          bankId: bank!.bankId,
          bankVersion: bank!.bankVersion,
          contentMode: 'development',
          availableTowers: [...PILOT_TOWERS],
          rankingEligibility: 'personal',
          createdAt: '2026-10-30T00:00:00.000Z',
        });

        let prevId = s.quiz.current!.questionId;
        const seenIds = new Set([prevId]);
        for (let i = 1; i < 300; i++) {
          const phase = i % 2 === 0 ? 'battle' : 'prep';
          const enc = createEncounter(ctx, s, phase);
          expect(enc.questionId).not.toBe(prevId);
          prevId = enc.questionId;
          seenIds.add(enc.questionId);
          const q = ctx.questions.get(enc.questionId)!;
          if (phase === 'battle') {
            expect(q.readingLoad).toBeLessThanOrEqual(ctx.battleReadingLoadMax);
          }
          if (difficulty === 'Easy') {
            expect(['basic', 'core']).toContain(q.difficultyTier ?? 'core');
            expect(q.variantTag).not.toBe('dialect');
          } else if (difficulty === 'Normal') {
            expect(q.difficultyTier).not.toBe('challenge');
            expect(q.variantTag).not.toBe('dialect');
          } else {
            expect(q.difficultyTier).not.toBe('basic');
          }
        }
        // 300회 회전 시 동일 문항 풀 편중 없이 최소 250개 이상의 서로 다른 문항이 고르게 출제되어야 한다.
        expect(seenIds.size).toBeGreaterThanOrEqual(250);
      }
    }
  });
});

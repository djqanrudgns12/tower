import { expect, it, vi } from 'vitest';

vi.mock('../../src/content/questions/grade5.json', async () => {
  const { bankQuestionSchema, sharedBankFileSchema } = await import('../../src/contracts/questions');
  const question = (grade: number, index: number) => bankQuestionSchema.parse({
    id: `g${grade}-shared-${String(index).padStart(4, '0')}`, revision: 1, status: 'published', grade,
    type: 'definition', difficultyTier: 'core', variantTag: 'standard',
    target: { lemma: `시험어${grade}-${index}`, partOfSpeech: '명사', senseKey: `fixture/${grade}/${index}` },
    stem: '시험용 낱말의 뜻을 고르세요.',
    options: [{ id: 'a', text: '첫째 뜻' }, { id: 'b', text: '둘째 뜻' }, { id: 'c', text: '셋째 뜻' }, { id: 'd', text: '넷째 뜻' }],
    correctOptionId: 'a', explanation: '시험에서 쓰는 뜻이에요.', distractorRationales: { b: '다른 뜻이에요.', c: '다른 뜻이에요.', d: '다른 뜻이에요.' },
  });
  return { default: sharedBankFileSchema.parse({ bankId: 'g5', bankVersion: 'fixture-shared-5', grade: 5, status: 'published', questions: [
    ...Array.from({ length: 1000 }, (_, i) => question(5, i + 1)),
    { ...question(4, 1), difficultyTier: 'basic', gradeBand: { min: 4, max: 5 } },
  ] }) };
});

it('실제 공개 로더와 출제 컨텍스트가 공유 문항의 원ID·학년과 받는 학년 수준을 보존한다', async () => {
  const content = await import('../../src/content');
  const bank = content.gradeContent(5).bank!;
  expect(bank.bankVersion).toBe('fixture-shared-5');
  expect(bank.questions).toHaveLength(1001);
  expect(bank.questions.find(q => q.id === 'g4-shared-0001')).toMatchObject({ grade: 4, difficultyTier: 'basic', gradeBand: { min: 4, max: 5 } });
  const easy = content.contextFor(5, 'Easy');
  expect(easy.map.grade).toBe(5);
  expect(easy.questions.get('g4-shared-0001')).toMatchObject({ grade: 4, difficultyTier: 'basic' });
  expect(content.contextFor(5, 'Hard').questions.has('g4-shared-0001')).toBe(false);
  const retractions = { listVersion: 'fixture', entries: [{ questionId: 'g4-shared-0001', revision: 1, reason: '시험 철회', retractedAt: '2026-11-07T00:00:00Z' }] };
  expect(content.reviewQuestions(5).has('g4-shared-0001')).toBe(true);
  expect(content.toRuntime(bank, retractions).some(q => q.id === 'g4-shared-0001')).toBe(false);
  expect(content.contextFor(5, 'Easy', retractions).questions.has('g4-shared-0001')).toBe(false);
});

import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import type * as Content from '../../src/content';
import { bankQuestionSchema, sharedBankFileSchema, type BankFile } from '../../src/contracts/questions';

const fixtures = vi.hoisted(() => ({ banks: new Map<number, BankFile>() }));
vi.mock('../../src/content', async importOriginal => {
  const actual = await importOriginal<typeof Content>();
  return { ...actual, gradeContent: (grade: number) => ({ ...actual.gradeContent(grade), bank: fixtures.banks.get(grade) ?? null }) };
});
import { loadAllStudyCards, selectDailySteleCards } from '../../src/application/lobby';

function question(grade: number, index: number) {
  return bankQuestionSchema.parse({
    id: `g${grade}-study-${String(index).padStart(4, '0')}`, revision: 1, status: 'published', grade,
    type: 'definition', difficultyTier: 'advanced', variantTag: 'standard',
    target: { lemma: `시험어${grade}-${index}`, partOfSpeech: '명사', senseKey: `fixture/${grade}/${index}` },
    stem: '시험용 낱말의 뜻을 고르세요.',
    options: [{ id: 'a', text: '시험의 첫째 뜻' }, { id: 'b', text: '둘째 뜻' }, { id: 'c', text: '셋째 뜻' }, { id: 'd', text: '넷째 뜻' }],
    correctOptionId: 'a', explanation: '시험에서 쓰는 뜻이에요.', distractorRationales: { b: '다른 뜻이에요.', c: '다른 뜻이에요.', d: '다른 뜻이에요.' },
  });
}
const original = question(4, 1);
fixtures.banks.set(4, sharedBankFileSchema.parse({ bankId: 'g4', bankVersion: 'fixture-4', grade: 4, status: 'published', questions: [original] }));
fixtures.banks.set(5, sharedBankFileSchema.parse({ bankId: 'g5', bankVersion: 'fixture-5', grade: 5, status: 'published', questions: [
  ...Array.from({ length: 1000 }, (_, i) => question(5, i + 1)),
  { ...original, difficultyTier: 'basic', gradeBand: { min: 4, max: 5 } },
] }));

it('전체 낱말 카드는 같은 문항의 공유본 때문에 원학년 수준 표시가 바뀌지 않는다', async () => {
  const cards = await loadAllStudyCards();
  expect(cards.filter(card => card.questionId === original.id)).toMatchObject([
    { gradeLabel: '4학년', levelLabel: '심화 어휘' },
  ]);
  expect(cards).toHaveLength(1001);
});

it('선택 학년의 오늘의 낱말은 받는 학년과 그 학년의 수준을 표시한다', () => {
  const cards = selectDailySteleCards(5, new Date('2026-11-07T00:00:00Z'));
  expect(cards.filter(card => card.questionId === original.id)).toMatchObject([
    { gradeLabel: '5학년', levelLabel: '기초 어휘' },
  ]);
});

it('ID와 판을 철회하면 전체 카드와 받는 학년 카드에서 함께 빠진다', async () => {
  const retractions = { listVersion: 'fixture', entries: [{ questionId: original.id, revision: 1, reason: '시험 철회', retractedAt: '2026-11-07T00:00:00Z' }] };
  expect((await loadAllStudyCards(retractions)).some(card => card.questionId === original.id)).toBe(false);
  expect(selectDailySteleCards(5, new Date('2026-11-07T00:00:00Z'), retractions).some(card => card.questionId === original.id)).toBe(false);
});

import { expect, it, vi } from 'vitest';
import { createGradeLoader } from '../../src/content/gradeLoader';
import { sharedBankFileSchema, type BankManifest } from '../../src/contracts/questions';

const bank = sharedBankFileSchema.parse({ bankId: 'g5', bankVersion: 'fixture-v1', grade: 5, status: 'published',
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: `g5-loader-${String(i + 1).padStart(4, '0')}`, revision: 1, status: 'published', grade: 5,
    type: 'definition', difficultyTier: 'core', variantTag: 'standard',
    target: { lemma: `시험어${i}`, partOfSpeech: '명사', senseKey: `fixture/${i}` },
    stem: `시험용 낱말 ${i}의 뜻을 고르세요.`,
    options: [{ id: 'a', text: '첫째 뜻' }, { id: 'b', text: '둘째 뜻' }, { id: 'c', text: '셋째 뜻' }, { id: 'd', text: '넷째 뜻' }],
    correctOptionId: 'a', explanation: '시험에서 쓰는 뜻이에요.', distractorRationales: { b: '다른 뜻이에요.', c: '다른 뜻이에요.', d: '다른 뜻이에요.' },
  })),
});
const manifest: BankManifest = { schemaVersion: '1', banks: [
  { grade: 5, bankId: 'g5', bankVersion: 'fixture-v1', questionCount: 30, ownCount: 30, sharedCount: 0 },
] };

it('공개 목록만으로 이용 가능 여부를 알고, 요청을 합쳐 한 번만 파일을 읽는다', async () => {
  const fetchBank = vi.fn(async () => bank), loader = createGradeLoader(manifest, { 5: fetchBank });
  const changed = vi.fn();
  const unsubscribe = loader.subscribe(changed);
  expect(loader.state(5)).toBe('unloaded');
  expect(loader.state(6)).toBe('unavailable');
  expect(await loader.load(6)).toBeNull();
  expect(fetchBank).not.toHaveBeenCalled();
  const first = loader.load(5), second = loader.load(5);
  expect(first).toBe(second);
  expect(loader.state(5)).toBe('loading');
  expect(loader.peek(5)).toBeNull();
  await first;
  expect(loader.state(5)).toBe('ready');
  expect(loader.peek(5)?.bankVersion).toBe('fixture-v1');
  expect(await loader.load(5)).toBe(loader.peek(5));
  expect(fetchBank).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it('전송 실패는 미공개와 구분하고, 다시 요청하면 재시도한다', async () => {
  const fetchBank = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(bank);
  const loader = createGradeLoader(manifest, { 5: fetchBank });
  await expect(loader.load(5)).rejects.toThrow('network');
  expect(loader.state(5)).toBe('error');
  expect(loader.available(5)).toBe(true);
  expect(loader.peek(5)).toBeNull();
  await loader.load(5);
  expect(loader.state(5)).toBe('ready');
  expect(fetchBank).toHaveBeenCalledTimes(2);
});

it.each([
  ['판 번호', { ...bank, bankVersion: 'stale' }],
  ['문항 수', { ...bank, questions: [...bank.questions, { ...bank.questions[0]!, id: 'g5-loader-0031' }] }],
  ['후보 은행', { ...bank, status: 'verified_candidate', questions: bank.questions.map(q => ({ ...q, status: 'verified_candidate' })) }],
])('%s가 목록과 다르면 적재하지 않는다', async (_name, incoming) => {
  const loader = createGradeLoader(manifest, { 5: async () => incoming });
  await expect(loader.load(5)).rejects.toThrow();
  expect(loader.state(5)).toBe('error');
  expect(loader.peek(5)).toBeNull();
});

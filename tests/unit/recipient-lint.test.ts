import { describe, expect, it } from 'vitest';
import { lintBatchForGrade, lintBatchStrict } from '../../src/content/lint';
import type { LintInput } from '../../src/content/lint';

function question(load = 40): LintInput {
  return {
    id: 'g4-test-0001', grade: 4, type: 'cloze', difficultyTier: 'basic', variantTag: 'standard',
    target: { lemma: '시험어', senseKey: '시험어/명사/1' }, stem: '가'.repeat(load - 4) + '(    )',
    options: [{ id: 'a', text: '가' }, { id: 'b', text: '나' }, { id: 'c', text: '다' }, { id: 'd', text: '라' }],
    correctOptionId: 'a', explanation: '상황에 맞는 뜻이에요.', distractorRationales: { b: '다른 뜻이에요.', c: '다른 뜻이에요.', d: '다른 뜻이에요.' },
  };
}

describe('공유 문항의 받는 학년 검사', () => {
  it('원 ID·학년을 보존하며 받는 학년의 basic 읽기 상한을 적용한다', () => {
    const q = question(100), before = structuredClone(q);
    expect(lintBatchStrict([q])).toContain(`${q.id}: basic 단계 문항 읽기 부담 과다(100음절 > 92음절)`);
    expect(lintBatchForGrade([q], 5)).toEqual([]);
    expect(q).toEqual(before);
  });

  it('받는 학년의 절대 읽기 상한과 경계를 검사한다', () => {
    const boundary = { ...question(126), difficultyTier: 'core' as const };
    expect(lintBatchForGrade([boundary], 5)).toEqual([]);
    const tooLong = { ...question(127), difficultyTier: 'core' as const };
    expect(lintBatchForGrade([tooLong], 5)).toContain(`${tooLong.id}: 5학년 절대 읽기 부담 상한 초과(127음절 > 126음절)`);
  });

  it('풀이 어휘 제한도 받는 학년을 따르며 전체 초등 금칙어는 유지한다', () => {
    const q = { ...question(), explanation: '타당성을 살펴요.' };
    expect(lintBatchForGrade([q], 4)).toContain(`${q.id}: 4학년(3~4학년군)에 어려운 풀이·보기 어휘(타당성)`);
    expect(lintBatchForGrade([q], 5)).toEqual([]);
    const hard = { ...q, explanation: '형이상학을 살펴요.' };
    expect(lintBatchForGrade([hard], 6)).toContain(`${q.id}: 초등 수준 초과 어휘: 형이상학`);
  });

  it('받는 학년을 핑계로 원 ID·학년 불일치를 허용하지 않는다', () => {
    const q = { ...question(), id: 'g5-test-0001' };
    expect(lintBatchForGrade([q], 5)).toContain(`${q.id}: ID와 학년이 다르다`);
  });

  it('서로 다른 원학년에서 같은 뜻·유형이 들어오면 받는 풀에서 중복으로 잡는다', () => {
    const q = question(), other = { ...question(), id: 'g5-test-0002', grade: 5, stem: '나'.repeat(36) + '(    )' };
    expect(lintBatchStrict([q, other])).toEqual([]);
    expect(lintBatchForGrade([q, other], 5)).toContain(`${other.id}: 같은 의미·같은 유형 중복(5:시험어/명사/1:cloze)`);
  });

  it('동일 학년에서는 기존 검사 결과가 같고 지원 밖 학년은 거부한다', () => {
    const q = { ...question(113), explanation: '귀기울여요.' };
    expect(lintBatchForGrade([q], 4)).toEqual(lintBatchStrict([q]));
    expect(() => lintBatchForGrade([q], 7)).toThrow(RangeError);
    expect(() => lintBatchForGrade([q], 4.5)).toThrow(RangeError);
  });
});

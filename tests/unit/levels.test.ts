import { describe, expect, it } from 'vitest';
import { lintGradeBasisUnit } from '../../src/content/lint';
import { levelBatchSchema, levelJudgeSchema } from '../../src/contracts/levels';
import type { LevelJudge } from '../../src/contracts/levels';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import type { QuestionType, VariantTag } from '../../src/contracts/questions';
import {
  assessLevel, candidateBand, isCurrentLevelAssessment, judgeScores, levelAssessmentHash,
  merge, precompute, tierForGrade,
} from '../../tools/content/levels';
import { contentHash } from '../../tools/content/bankBuild';

function question(grade = 4, type: QuestionType = 'cloze', variantTag: VariantTag = 'standard', load = 47): QuestionDraft {
  return {
    schemaVersion: '0.2', batchId: 'LEVEL-TEST', id: `g${grade}-test-0001`, revision: 1,
    status: 'draft', grade, type, variantTag,
    gradeBasis: { reference: '수준 판정', editionYear: 2022, unit: 'stdict:전문어 표지 없음', reviewed: false },
    target: { lemma: '시험어', partOfSpeech: '명사', senseKey: '시험어/명사/1' },
    stem: '가'.repeat(load - 4),
    options: [{ id: 'a', text: '나' }, { id: 'b', text: '다' }, { id: 'c', text: '라' }, { id: 'd', text: '마' }],
    correctOptionId: 'a', explanation: '시험 해설', distractorRationales: { b: '이유', c: '이유', d: '이유' },
    source: {
      provider: 'stdict', entryId: '1', senseId: '1', senseOrder: 1,
      url: 'https://stdict.korean.go.kr/', retrievedAt: '2026-11-05T00:00:00Z', license: '출처 표시',
      evidenceHash: 'a'.repeat(64), evidenceArtifactId: 'test',
    },
    review: { reviewerId: null, reviewedAt: null },
  };
}

function judge(q: QuestionDraft, who: LevelJudge['judge'] = 'argon', change: Partial<LevelJudge> = {}): LevelJudge {
  return {
    questionId: q.id, revision: q.revision, contentHash: contentHash(q), judge: who, model: `${who}-test`,
    L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null, elementaryFit: 'pass',
    basisType: 'stdict_structural', unit: 'stdict:전문어 표지 없음', reason: '점수 경계 시험', ...change,
  };
}

describe('lv1 사전 계산과 학년별 판정', () => {
  it.each([
    [4, 'cloze', 'standard', 47, 1, 1, 0, null, 4, 'basic', 4, 4],
    [4, 'synonym_context', 'standard', 53, 1, 2, 2, null, 9, 'advanced', 4, 5],
    [5, 'definition', 'polysemy', 82, 2, 2, 2, null, 12, 'core', 5, 6],
    [5, 'cloze', 'idiom_proverb', 61, 2, 1, 2, 3, 11, 'advanced', 4, 5],
    [6, 'cloze', 'standard', 69, 3, 3, 2, null, 15, 'core', 6, 6],
    [6, 'usage', 'confusable', 116, 2, 3, 3, null, 18, 'advanced', 6, 6],
  ] as const)('계획 예: %i학년 %s·%s·%i음절', (grade, type, variant, load, L1, L2, T1, idiomOpacity, V, ownTier, min, max) => {
    const q = question(grade, type, variant, load);
    const a = judge(q, 'argon', { L1, L2, T1, idiomOpacity });
    const c = judge(q, 'codex', { L1, L2, T1, idiomOpacity });
    const result = assessLevel(q, a, c);
    expect(result.merged).toEqual({ rule: 3, L: L1 + L2, T: V - 2 * (L1 + L2), V, ownTier, band: { min, max }, flags: [] });
    if (grade === 5 && variant === 'polysemy') {
      expect(tierForGrade(6, 4, 4, variant, load).tier).toBe('core');
    }
  });

  it.each([[65, 0], [66, 1], [85, 1], [86, 2]] as const)('읽기량 %i의 길이 가산점은 %i', (load, lengthBump) => {
    expect(precompute(question(4, 'cloze', 'standard', load))).toEqual({
      typeBase: 0, lengthBump, t3Base: 0, readingLoad: load, krdictGrade: null, stdictSpecialized: false,
    });
  });

  it.each([['definition', 0], ['cloze', 0], ['synonym_context', 1], ['antonym_context', 1], ['usage', 2]] as const)('유형 %s의 기본점은 %i', (type, base) => {
    expect(precompute(question(4, type)).typeBase).toBe(base);
  });

  it('NFC 한글 음절과 보기까지 세고, 사전 조회 결과는 입력으로 받는다', () => {
    const q = question();
    q.stem = '가 A 123';
    expect(precompute(q, { krdictGrade: '중급', stdictSpecialized: true })).toMatchObject({
      readingLoad: 5, krdictGrade: '중급', stdictSpecialized: true,
    });
  });

  it('T2만 3으로 제한하고 관용구의 2/3은 판정자에게 받는다', () => {
    const q = question(6, 'usage', 'idiom_proverb', 116);
    const p = precompute(q);
    expect(p.t3Base).toBeNull();
    expect(judgeScores(p, judge(q, 'argon', { L1: 3, L2: 3, T1: 3, inference: 1, idiomOpacity: 3 })))
      .toEqual({ L: 6, T: 9, V: 21 });
    expect(judgeScores(p, judge(q, 'argon', { idiomOpacity: 2 }))).toEqual({ L: 2, T: 5, V: 9 });
    expect(() => judgeScores(p, judge(q))).toThrow(/관용/);
    expect(() => judgeScores(precompute(question()), judge(q, 'argon', { idiomOpacity: 2 }))).toThrow(/관용/);
  });

  it.each([[0, 'basic'], [1, 'basic'], [2, 'core'], [4, 'core'], [5, 'advanced'], [6, 'advanced'], [7, 'challenge'], [9, 'challenge']] as const)('R=%i 경계는 %s', (T, tier) => {
    expect(tierForGrade(3, 0, T, 'standard', 40)).toEqual({ tier, flags: [] });
  });

  it.each([3, 4, 5, 6])('basic 읽기량 상한 %i학년 경계', grade => {
    const cap = 10 * grade + 52;
    expect(tierForGrade(grade, 0, 0, 'standard', cap).tier).toBe('basic');
    expect(tierForGrade(grade, 0, 0, 'standard', cap + 1)).toEqual({
      tier: 'core', flags: grade === 3 ? ['long_basic'] : ['too_easy', 'long_basic'],
    });
  });

  it.each([['polysemy', 'core'], ['confusable', 'core'], ['idiom_proverb', 'advanced'], ['dialect', 'challenge']] as const)('너무 쉬워도 %s의 하한은 %s', (variant, tier) => {
    expect(tierForGrade(6, 0, 0, variant, 140)).toEqual({ tier, flags: ['too_easy'] });
  });

  it('너무 어려운 자기 학년은 challenge와 표시를 남긴다', () => {
    expect(tierForGrade(3, 6, 9, 'standard', 50)).toEqual({ tier: 'challenge', flags: ['too_hard'] });
  });

  it('후보 띠는 한 학년 이내, 위로 R>=0, 아래로 홀수 L·T>=5·R<=9만 허용한다', () => {
    expect(candidateBand(4, 2, 0)).toEqual({ min: 4, max: 4 });
    expect(candidateBand(5, 3, 5)).toEqual({ min: 4, max: 5 });
    expect(candidateBand(5, 3, 4)).toEqual({ min: 5, max: 5 });
    expect(candidateBand(5, 4, 5)).toEqual({ min: 5, max: 6 });
    expect(candidateBand(5, 3, 8)).toEqual({ min: 5, max: 6 });
    expect(candidateBand(3, 1, 5)).toEqual({ min: 3, max: 4 });
    expect(candidateBand(6, 6, 9)).toEqual({ min: 6, max: 6 });
  });
});

describe('lv1 합의 규칙의 우선순위', () => {
  it('규칙 1은 점수 차이·띠 불일치보다 먼저 처리하고 최댓값·자기 학년으로 잠근다', () => {
    const q = question(3);
    const result = merge(q, judge(q, 'argon', { L1: 0, L2: 0, elementaryFit: 'too_low' }), judge(q, 'codex', { L1: 3, L2: 3, T1: 3 }));
    expect(result).toMatchObject({ rule: 1, L: 6, T: 3, V: 15, band: { min: 3, max: 3 } });
    expect(result.flags).toContain('elementaryFit');
    expect(result.flags).not.toContain('spotCheck');
  });

  it.each([{ L1: 3, L2: 2 }, { T1: 3 }])('규칙 2는 ΔL 또는 ΔT가 3인 경계에서 규칙 4보다 먼저 적용한다', change => {
    const q = question();
    expect(merge(q, judge(q), judge(q, 'codex', change))).toMatchObject({ rule: 2, band: { min: 4, max: 4 } });
  });

  it('점수가 같아도 점수상 띠가 비면 규칙 3 대신 규칙 2다', () => {
    const q = question(6);
    const result = merge(q, judge(q), judge(q, 'codex'));
    expect(result).toMatchObject({ rule: 2, ownTier: 'basic', band: { min: 6, max: 6 } });
    expect(result.flags).toContain('too_easy');
  });

  it('규칙 3은 합계 평균을 올림하고 두 점수상 띠의 교집합을 후보 조건으로 좁힌다', () => {
    const q = question(4);
    expect(merge(q, judge(q, 'argon', { L1: 1, L2: 1, T1: 1 }), judge(q, 'codex', { L1: 1, L2: 2, T1: 2 })))
      .toEqual({ rule: 3, L: 3, T: 2, V: 8, ownTier: 'core', band: { min: 4, max: 4 }, flags: [] });
  });

  it.each([
    [{ L1: 1, L2: 1 }, { L1: 2, L2: 2 }, 4, 0],
    [{ T1: 0, inference: 0 }, { T1: 1, inference: 1 }, 2, 1],
    [{ L1: 0, L2: 3 }, { L1: 2, L2: 2 }, 4, 0],
    [{ L1: 0, L2: 3 }, { L1: 2, L2: 1 }, 3, 0],
  ] as const)('축 차이와 합계 차이 조건을 둘 다 만족하지 않으면 규칙 4 (%j / %j)', (a, c, L, T) => {
    const q = question();
    expect(merge(q, judge(q, 'argon', a), judge(q, 'codex', c)))
      .toMatchObject({ rule: 4, L, T, band: { min: 4, max: 4 }, flags: ['spotCheck'] });
  });

  it('전문 분야 표지는 합의와 별도로 수정 표시를 남긴다', () => {
    const q = question();
    expect(merge(q, judge(q), judge(q, 'codex'), precompute(q, { stdictSpecialized: true })))
      .toMatchObject({ rule: 3, flags: ['stdictSpecialized'] });
  });
});

describe('수준 계약·해시·revision 연결', () => {
  it('정렬된 JSON은 키·판정자 순서와 무관하고 점수·합의·근거 변화는 묶는다', () => {
    const q = question();
    const item = assessLevel(q, judge(q), judge(q, 'codex'));
    const input = { rubricVersion: 'lv1' as const, ...item };
    expect(item.levelAssessmentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(levelAssessmentHash({ ...input, judges: [...input.judges].reverse() })).toBe(item.levelAssessmentHash);
    expect(levelAssessmentHash({ ...input, precomputed: Object.fromEntries(Object.entries(input.precomputed).reverse()) as typeof input.precomputed })).toBe(item.levelAssessmentHash);
    for (const change of [
      { precomputed: { ...input.precomputed, krdictGrade: '중급' as const } },
      { judges: input.judges.map(j => ({ ...j, T1: 1 })) },
      { judges: input.judges.map(j => ({ ...j, unit: 'krdict:중급' })) },
      { merged: { ...input.merged, band: { min: 4, max: 5 } } },
    ]) expect(levelAssessmentHash({ ...input, ...change })).not.toBe(item.levelAssessmentHash);
    expect(levelBatchSchema.parse({ batchId: q.batchId, rubricVersion: 'lv1', items: [item] }).items).toEqual([item]);
  });

  it('현재 revision·본문·계산·해시가 일치해야 합의를 재사용한다', () => {
    const q = question();
    const item = assessLevel(q, judge(q), judge(q, 'codex'));
    expect(isCurrentLevelAssessment(q, item)).toBe(true);
    expect(isCurrentLevelAssessment({ ...q, revision: 2 }, item)).toBe(false);
    expect(isCurrentLevelAssessment({ ...q, stem: `${q.stem}가` }, item)).toBe(false);
    expect(isCurrentLevelAssessment(q, { ...item, merged: { ...item.merged, ownTier: 'challenge' } })).toBe(false);
    const forged = { ...item, merged: { ...item.merged, ownTier: 'challenge' as const } };
    forged.levelAssessmentHash = levelAssessmentHash({ rubricVersion: 'lv1', ...forged });
    expect(isCurrentLevelAssessment(q, forged)).toBe(false);
    expect(isCurrentLevelAssessment({ ...q, gradeBasis: { ...q.gradeBasis, unit: 'krdict:중급' }, difficultyTier: 'basic' }, item)).toBe(true);
    expect(() => assessLevel(q, judge(q, 'argon', { revision: 2 }), judge(q, 'codex'))).toThrow();
    expect(() => assessLevel(q, judge(q), judge(q))).toThrow();
  });

  it('본문 해시 밖인 변형 태그가 바뀌어도 예외 없이 이전 합의를 거부한다', () => {
    const q = question(5, 'cloze', 'idiom_proverb');
    const item = assessLevel(q, judge(q, 'argon', { idiomOpacity: 3 }), judge(q, 'codex', { idiomOpacity: 3 }));
    const changed = { ...q, variantTag: 'standard' as const };
    expect(contentHash(changed)).toBe(contentHash(q));
    expect(isCurrentLevelAssessment(changed, item)).toBe(false);
    expect(isCurrentLevelAssessment({ ...q, grade: 6 }, item)).toBe(false);
  });

  it.each([{ L1: 4 }, { L2: -1 }, { T1: 1.5 }, { inference: 2 }, { idiomOpacity: 1 }, { judge: 'gemini' }])('잘못된 판정자 점수를 거부한다: %j', change => {
    expect(levelJudgeSchema.safeParse({ ...judge(question()), ...change }).success).toBe(false);
  });

  it('중복 판정자·다른 revision·중복 문항·잘못된 V와 띠를 거부한다', () => {
    const q = question();
    const item = assessLevel(q, judge(q), judge(q, 'codex'));
    const batch = { batchId: q.batchId, rubricVersion: 'lv1', items: [item] };
    for (const change of [
      { judges: [item.judges[0], item.judges[0]] },
      { revision: 2 },
      { merged: { ...item.merged, V: 21 } },
      { merged: { ...item.merged, band: { min: 5, max: 4 } } },
    ]) expect(levelBatchSchema.safeParse({ ...batch, items: [{ ...item, ...change }] }).success).toBe(false);
    expect(levelBatchSchema.safeParse({ ...batch, items: [item, item] }).success).toBe(false);
  });
});

describe('학년 근거 단위 형식은 새 앞단에서만 검사한다', () => {
  const codes = new Set(['4국04-03']);
  it.each(['[4국04-03] 낱말의 의미 관계', 'krdict:초급', 'krdict:중급', 'krdict:고급', 'stdict:전문어 표지 없음', 'rubric_inferred(L=2,T=0)', 'rubric_inferred(L=6,T=9)'])('허용: %s', unit => {
    expect(lintGradeBasisUnit(unit, codes)).toEqual([]);
  });
  it.each(['', '2022 개정 국어과 교육과정', '[6국04-99] 없는 코드', '본문 [4국04-03] 낱말', 'krdict:하급', 'stdict:', 'rubric_inferred(L=7,T=0)', 'rubric_inferred(L=2,T=10)', '[4국04-03] 12쪽', 'stdict:3단원', 'stdict:3 단원', 'krdict:초급 2쪽'])('거부: %s', unit => {
    expect(lintGradeBasisUnit(unit, codes).length).toBeGreaterThan(0);
  });
  it('정본이 없으면 성취기준만 실패로 본다', () => {
    expect(lintGradeBasisUnit('[4국04-03] 낱말의 의미 관계', null).length).toBeGreaterThan(0);
    expect(lintGradeBasisUnit('stdict:뜻 번호 1', null)).toEqual([]);
    expect(lintGradeBasisUnit('[4국04-03] 낱말의 의미 관계', new Set(['[4국04-03]']))).toEqual([]);
  });
});

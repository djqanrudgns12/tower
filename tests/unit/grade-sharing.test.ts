import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { LevelAssessment, LevelJudge } from '../../src/contracts/levels';
import { contentHashInput, questionDraftSchema } from '../../src/contracts/questionDraft';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import type { VariantTag } from '../../src/contracts/questions';
import { selectUpwardShares } from '../../tools/content/gradeSharing';
import { assessLevel, levelAssessmentHash, relativeDifficulty } from '../../tools/content/levels';

function question(grade: number, index = 1, variantTag: VariantTag = 'standard', load = 40): QuestionDraft {
  return questionDraftSchema.parse({
    schemaVersion: '0.2', batchId: 'SHARING-TEST', id: `g${grade}-sharing-${String(index).padStart(4, '0')}`,
    revision: 1, status: 'draft', grade, type: 'cloze', variantTag,
    gradeBasis: { reference: '시험', editionYear: 2022, unit: 'stdict:전문어 표지 없음', reviewed: false },
    target: { lemma: '시험어', partOfSpeech: '명사', senseKey: '시험어/명사/1' },
    stem: '가'.repeat(load - 4),
    options: [{ id: 'a', text: '나' }, { id: 'b', text: '다' }, { id: 'c', text: '라' }, { id: 'd', text: '마' }],
    correctOptionId: 'a', explanation: '공유 계산 시험용 해설', distractorRationales: { b: '이유', c: '이유', d: '이유' },
    source: {
      provider: 'stdict', entryId: '1', senseId: '1', senseOrder: 1, url: 'https://stdict.korean.go.kr/',
      retrievedAt: '2026-11-06T00:00:00Z', license: '출처 표시', evidenceHash: 'a'.repeat(64), evidenceArtifactId: 'test',
    },
    review: { reviewerId: null, reviewedAt: null },
  });
}

function assessment(q: QuestionDraft, argon: Partial<LevelJudge> = {}, codex = argon, specialized = false): LevelAssessment {
  const judge = (who: LevelJudge['judge'], change: Partial<LevelJudge>): LevelJudge => ({
    questionId: q.id, revision: q.revision,
    contentHash: createHash('sha256').update(contentHashInput(q)).digest('hex'),
    judge: who, model: `${who}-test`, L1: q.grade - 2, L2: q.grade - 2, T1: 0, inference: 0,
    idiomOpacity: q.variantTag === 'idiom_proverb' ? 2 : null, elementaryFit: 'pass',
    basisType: 'stdict_structural', unit: 'stdict:전문어 표지 없음', reason: '공유 경계 시험', ...change,
  });
  return assessLevel(q, judge('argon', argon), judge('codex', codex), { stdictSpecialized: specialized });
}

const own = (grade: number, count = 1000) => Array.from({ length: count }, (_, i) => question(grade, i + 1));
const own4 = own(4);

function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freezeDeep(child);
  Object.freeze(value);
}

describe('위로 한 학년 공유의 순수 선택', () => {
  it.each([3, 4, 5] as const)('%i학년은 바로 위 학년으로만 공유하며 원학년 tier와 구분한다', grade => {
    const q = question(grade);
    q.difficultyTier = 'advanced';
    const level = assessment(q);
    const result = selectUpwardShares(grade + 1, [...own(grade + 1), q], [level]);
    expect(level.merged).toMatchObject({ rule: 3, ownTier: 'core', band: { min: grade, max: grade + 1 } });
    expect(result.ownApprovedCount).toBe(1000);
    expect(result.limit).toBe(240);
    expect(result.shared).toEqual([{ question: q, targetGrade: grade + 1, difficultyTier: 'basic', flags: [] }]);
    expect(result.shared[0]!.question).toBe(q);
    expect(q.difficultyTier).toBe('advanced');
  });

  it.each([999, 1000, 1004, 1005])('자기 승인 %i개에서 문턱과 내림 상한을 계산한다', count => {
    const sources = Array.from({ length: 250 }, (_, i) => question(3, i + 1));
    const result = selectUpwardShares(4, [...own(4, count), ...sources], sources.map(q => assessment(q)));
    const expected = count === 999 ? 0 : count === 1005 ? 241 : 240;
    expect(result.ownApprovedCount).toBe(count);
    expect(result.limit).toBe(expected);
    expect(result.shared.map(s => s.question.id)).toEqual(sources.slice(0, expected).map(q => q.id));
  });

  it('중복·과거 revision·다른 학년·연습 문항은 자기 승인 하한을 부풀리지 않는다', () => {
    const residents = own4.slice(0, 999);
    const source = question(3);
    const practice = { ...question(4), id: 'g4-practice-0001' };
    const newer = { ...residents[0]!, revision: 2 };
    const result = selectUpwardShares(4, [...residents, ...residents, newer, practice, source, ...own(5)], [assessment(source)]);
    expect(result).toEqual({ ownApprovedCount: 999, limit: 0, shared: [] });
  });

  it('같은 최신 revision의 초안 충돌은 자기 수에서도 제외한다', () => {
    const conflict = { ...own4[0]!, explanation: '같은 revision의 다른 해설' };
    expect(selectUpwardShares(4, [...own4, conflict], []).ownApprovedCount).toBe(999);
    expect(selectUpwardShares(4, [conflict, ...own4], []).ownApprovedCount).toBe(999);
  });

  it('아래 방향의 실제 띠가 있어도 공유하지 않고 두 학년 건너뛰기도 금지한다', () => {
    const q = question(5);
    q.type = 'synonym_context';
    const lowerBand = assessment(q, { L1: 2, L2: 1, T1: 3, inference: 1 });
    expect(lowerBand.merged.band.min).toBe(4);
    expect(selectUpwardShares(4, [...own4, q], [lowerBand]).shared).toEqual([]);
    const g3 = question(3);
    expect(selectUpwardShares(5, [...own(5), g3], [assessment(g3)]).shared).toEqual([]);
    expect(selectUpwardShares(3, [...own(3), q], [lowerBand]).shared).toEqual([]);
    expect(() => selectUpwardShares(7, [q], [lowerBand])).toThrow(RangeError);
  });

  it('받는 학년 R=0은 허용하고 R=-1은 제외한다', () => {
    const q = question(3);
    const easy = assessment(q, { L1: 1, L2: 0, T1: 1 });
    expect(relativeDifficulty(4, easy.merged.L, easy.merged.T)).toBe(-1);
    expect(selectUpwardShares(4, [...own4, q], [easy]).shared).toEqual([]);
    expect(selectUpwardShares(4, [...own4, q], [assessment(q)]).shared).toHaveLength(1);
  });

  it('평균 R이 0이어도 두 판정자의 실제 합의 띠 밖이면 제외한다', () => {
    const q = question(4);
    const level = assessment(q, { L1: 1, L2: 1, T1: 1 }, { L1: 1, L2: 2, T1: 2 });
    expect(level.merged).toMatchObject({ rule: 3, band: { min: 4, max: 4 } });
    expect(relativeDifficulty(5, level.merged.L, level.merged.T)).toBe(0);
    expect(selectUpwardShares(5, [...own(5), q], [level]).shared).toEqual([]);
  });

  it.each([
    [{ elementaryFit: 'too_high' }, {}, 1],
    [{ L1: 0, L2: 0 }, { L1: 3, L2: 0 }, 2],
    [{ L1: 0, L2: 2 }, { L1: 2, L2: 0 }, 4],
  ] as const)('자동 확정이 아닌 규칙 %j/%j → %i는 제외한다', (a, c, rule) => {
    const q = question(3);
    const level = assessment(q, a, c);
    expect(level.merged.rule).toBe(rule);
    expect(selectUpwardShares(4, [...own4, q], [level]).shared).toEqual([]);
  });

  it('전문 분야는 규칙 3이어도 제외하고 평가가 없는 초안도 공유하지 않는다', () => {
    const q = question(3);
    const level = assessment(q, {}, {}, true);
    expect(level.merged.rule).toBe(3);
    expect(level.merged.flags).toContain('stdictSpecialized');
    expect(selectUpwardShares(4, [...own4, q], [level]).shared).toEqual([]);
    expect(selectUpwardShares(4, [...own4, q], []).shared).toEqual([]);
  });

  it.each([
    ['standard', 1, 1, 0, null, 'basic'],
    ['polysemy', 1, 1, 0, null, 'core'],
    ['confusable', 1, 0, 0, null, 'core'],
    ['idiom_proverb', 1, 0, 0, 2, 'advanced'],
    ['dialect', 0, 0, 1, null, 'challenge'],
  ] as const)('%s 변형의 받는 학년 난도 하한을 보존한다', (variant, L1, L2, T1, idiomOpacity, tier) => {
    const q = question(3, 1, variant);
    const result = selectUpwardShares(4, [...own4, q], [assessment(q, { L1, L2, T1, idiomOpacity })]);
    expect(result.shared.map(s => s.difficultyTier)).toEqual([tier]);
  });

  it.each([[92, 'basic', []], [93, 'core', ['long_basic']]] as const)('받는 4학년 읽기량 %i 경계를 지킨다', (load, tier, flags) => {
    const q = question(3, 1, 'standard', load);
    const result = selectUpwardShares(4, [...own4, q], [assessment(q, { L1: 1, L2: 0 })]);
    expect(result.shared.map(s => ({ tier: s.difficultyTier, flags: s.flags }))).toEqual([{ tier, flags }]);
  });

  it('현재 본문·ID·revision·학년·변형이 달라진 평가를 제외한다', () => {
    const q = question(3);
    const level = assessment(q);
    const changed: QuestionDraft[] = [
      { ...q, stem: `${q.stem}가` }, { ...q, revision: 2 }, { ...q, id: 'g3-sharing-0002' },
      { ...q, grade: 4 }, { ...q, variantTag: 'polysemy' },
      { ...q, explanation: '다른 해설' },
    ];
    for (const draft of changed) expect(selectUpwardShares(4, [...own4, draft], [level]).shared).toEqual([]);
  });

  it('수준 해시·판정자·사전 계산 변조와 해시까지 다시 만든 합의 변조를 제외한다', () => {
    const q = question(3);
    const level = assessment(q);
    const forged = structuredClone(level);
    forged.merged.ownTier = 'challenge';
    forged.levelAssessmentHash = levelAssessmentHash({ rubricVersion: 'lv1', ...forged });
    const variants: LevelAssessment[] = [
      { ...level, levelAssessmentHash: '0'.repeat(64) },
      { ...level, revision: 2 }, { ...level, questionId: 'g3-sharing-0002' },
      { ...level, contentHash: '0'.repeat(64) },
      { ...level, judges: level.judges.map(j => ({ ...j, T1: 1 })) },
      { ...level, precomputed: { ...level.precomputed, readingLoad: 41 } }, forged,
    ];
    for (const item of variants) expect(selectUpwardShares(4, [...own4, q], [item]).shared).toEqual([]);
  });

  it('오래된 평가로 돌아가지 않고 최신 revision만 선택한다', () => {
    const old = question(3);
    const latest = { ...old, revision: 2 };
    const oldLevel = assessment(old);
    expect(selectUpwardShares(4, [...own4, old, latest], [oldLevel]).shared).toEqual([]);
    const latestLevel = assessment(latest);
    const result = selectUpwardShares(4, [...own4, latest, old, latest], [oldLevel, latestLevel, latestLevel]);
    expect(result.shared.map(s => s.question.revision)).toEqual([2]);
  });

  it('최신 초안이나 현재 평가가 충돌하면 입력 순서와 무관하게 공유하지 않는다', () => {
    const q = question(3);
    const changed = { ...q, stem: `${q.stem}나` };
    const level = assessment(q);
    const other = assessment(q, { T1: 1 });
    for (const drafts of [[q, changed], [changed, q]]) {
      expect(selectUpwardShares(4, [...own4, ...drafts], [level, assessment(changed)]).shared).toEqual([]);
    }
    for (const levels of [[level, other], [other, level]]) {
      expect(selectUpwardShares(4, [...own4, q], levels).shared).toEqual([]);
    }
    const invalid = { ...level, levelAssessmentHash: '0'.repeat(64) };
    for (const levels of [[level, invalid], [invalid, level]]) {
      expect(selectUpwardShares(4, [...own4, q], levels).shared).toEqual([]);
    }
    const reversed = { ...level, judges: [...level.judges].reverse() };
    expect(selectUpwardShares(4, [...own4, q], [reversed, level]).shared).toHaveLength(1);
  });

  it('집합과 판정자 순서를 바꿔도 ID순으로 같은 240개를 고르고 원본 전체를 보존한다', () => {
    const sources = Array.from({ length: 245 }, (_, i) => question(3, i + 1));
    const levels = sources.map(q => assessment(q));
    const drafts = [...sources, ...own4, ...sources];
    const shuffledLevels = [...levels].reverse().map(level => ({ ...level, judges: [...level.judges].reverse() }));
    const shuffledDrafts = [...drafts].reverse();
    const before = structuredClone({ drafts, levels, shuffledDrafts, shuffledLevels });
    freezeDeep({ drafts, levels, shuffledDrafts, shuffledLevels });
    const result = selectUpwardShares(4, drafts, levels);
    expect(selectUpwardShares(4, shuffledDrafts, shuffledLevels)).toEqual(result);
    expect(result.shared.map(s => s.question.id)).toEqual(sources.slice(0, 240).map(q => q.id));
    expect(new Set(result.shared.map(s => s.question.id)).size).toBe(240);
    expect({ drafts, levels, shuffledDrafts, shuffledLevels }).toEqual(before);
  });
});

import { describe, expect, it } from 'vitest';
import type { LevelJudge } from '../../src/contracts/levels';
import { questionDraftSchema, type QuestionDraft } from '../../src/contracts/questionDraft';
import type { RetractionList } from '../../src/contracts/questions';
import { contentHash, rationalesHash, toBankQuestion, type BatchInput } from '../../tools/content/bankBuild';
import { assessLevel } from '../../tools/content/levels';
import { prepareSharedBank, sharedBankVersion } from '../../tools/content/sharedBankPlan';

const empty: RetractionList = { listVersion: 'test', entries: [] };
function question(grade: number, index: number, load = 40): QuestionDraft {
  return questionDraftSchema.parse({
    schemaVersion: '0.2', batchId: `SHARED-PLAN-${grade}`, id: `g${grade}-plan-${String(index).padStart(4, '0')}`,
    revision: 1, status: 'machine_checked', grade, type: 'cloze', difficultyTier: 'advanced', variantTag: 'standard',
    gradeBasis: { reference: '시험', editionYear: 2022, unit: 'stdict:전문어 표지 없음', reviewed: false },
    target: { lemma: `시험어${grade}-${index}`, partOfSpeech: '명사', senseKey: `fixture/${grade}/${index}` },
    stem: `${grade}:${index} ${'가'.repeat(load - 4)} (    )`,
    options: [{ id: 'a', text: '나' }, { id: 'b', text: '다' }, { id: 'c', text: '라' }, { id: 'd', text: '마' }],
    correctOptionId: 'a', explanation: '상황에 맞는 뜻이에요.', distractorRationales: { b: '다른 뜻이에요.', c: '다른 뜻이에요.', d: '다른 뜻이에요.' },
    source: { provider: 'stdict', entryId: '1', senseId: '1', senseOrder: 1, url: 'https://stdict.korean.go.kr/',
      retrievedAt: '2026-11-06T00:00:00Z', license: '출처 표시', evidenceHash: 'a'.repeat(64), evidenceArtifactId: 'fixture' },
    review: { reviewerId: null, reviewedAt: null },
  });
}
function approved(drafts: QuestionDraft[]): BatchInput {
  const batchId = drafts[0]!.batchId, run = { id: 'fixture', model: 'gpt-6-astra', effort: 'high' as const };
  return { batchId, drafts, argonBlind: null,
    sidecar: { batchId, jobId: 'fixture', publicationPolicy: 'codex-argon-v1', producer: { model: 'Argon', tool: 'fixture', date: '2026-11-07' }, rejected: [],
      items: drafts.map(q => ({ id: q.id, revision: q.revision, uniquenessNote: '시험', gradeEvidence: '시험', selfRefutation: q.options.map(o => ({
        optionId: o.id, substituted: o.text, verdict: o.id === q.correctOptionId ? 'fits' : 'does_not_fit', reason: '시험' })) })) },
    reviews: { codex: { reviewId: 'fixture', jobId: 'fixture', reviewer: { model: run.model, tool: 'fixture', freshContext: true, date: '2026-11-07' },
      items: drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: contentHash(q), run, blindChoice: q.correctOptionId,
        verdicts: { source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'pass' }, findings: [] })) } },
    explanation: { batchId, reviewer: { model: run.model, role: 'commander', date: '2026-11-07' }, items: drafts.map(q => ({
      questionId: q.id, revision: q.revision, contentHash: contentHash(q), rationalesHash: rationalesHash(q), run, explanation: 'pass', findings: [] })) },
  };
}
function level(q: QuestionDraft) {
  const judge = (who: LevelJudge['judge']): LevelJudge => ({ questionId: q.id, revision: q.revision, contentHash: contentHash(q),
    judge: who, model: 'fixture', L1: 2, L2: 2, T1: 1, inference: 0, idiomOpacity: null, elementaryFit: 'pass',
    basisType: 'stdict_structural', unit: q.gradeBasis.unit, reason: '시험' });
  return assessLevel(q, judge('argon'), judge('codex'));
}
const residents = Array.from({ length: 1000 }, (_, i) => question(5, i + 1));
const own = approved(residents);

describe('학년 공유 은행 빌드 준비', () => {
  it('현재 승인만 합쳐 원 ID·학년과 받는 학년 tier·띠를 보존한다', () => {
    const source = approved([question(4, 1)]), before = structuredClone(source), assessment = level(source.drafts[0]!);
    const result = prepareSharedBank([own, source], [assessment], empty, 5);
    expect(result.ownApproved).toBe(1000); expect(result.shared).toBe(1); expect(result.rejectedShares).toEqual([]);
    expect(result.bank!.questions).toHaveLength(1001);
    expect(result.bank!.questions.find(q => q.id === 'g4-plan-0001')).toMatchObject({ grade: 4, difficultyTier: 'basic', gradeBand: { min: 4, max: 5 } });
    expect(source).toEqual(before);
  });
  it('자기 하한·공개 하한은 공유 유입으로 채우지 않고 철회도 적용한다', () => {
    const source = approved([question(4, 1)]), assessment = level(source.drafts[0]!);
    const retractions: RetractionList = { ...empty, entries: [{ questionId: residents[0]!.id, revision: 1, reason: '시험', retractedAt: '2026-11-07T00:00:00Z' }] };
    const result = prepareSharedBank([own, source], [assessment], retractions, 5);
    expect(result.ownApproved).toBe(999); expect(result.shared).toBe(0); expect(result.bank!.questions).toHaveLength(999);
    expect(prepareSharedBank([approved(residents.slice(0, 29)), source], [assessment], empty, 5).bank).toBeNull();
  });
  it('독립 검수 불일치·철회·최신 미승인 판은 공유하지 않는다', () => {
    const source = approved([question(4, 1)]), assessment = level(source.drafts[0]!);
    source.reviews.codex!.items[0]!.blindChoice = 'multiple';
    expect(prepareSharedBank([own, source], [assessment], empty, 5).shared).toBe(0);
    const clean = approved([question(4, 1)]), newer = structuredClone(clean); newer.drafts[0]!.revision++;
    expect(prepareSharedBank([own, clean, newer], [assessment], empty, 5).shared).toBe(0);
    const withdrawn: RetractionList = { ...empty, entries: [{ questionId: clean.drafts[0]!.id, revision: 1, reason: '시험', retractedAt: '2026-11-07T00:00:00Z' }] };
    expect(prepareSharedBank([own, clean], [assessment], withdrawn, 5).shared).toBe(0);
  });
  it('받는 학년 검사와 기존 지문 충돌을 통과하지 못한 공유 후보를 제외한다', () => {
    const long = question(4, 1, 127), duplicate = question(4, 2); duplicate.stem = residents[0]!.stem;
    const result = prepareSharedBank([own, approved([long, duplicate])], [level(long), level(duplicate)], empty, 5);
    expect(result.shared).toBe(0); expect(result.bank!.questions).toHaveLength(1000);
    expect(result.rejectedShares).toEqual([
      { questionId: long.id, reasons: [`${long.id}: 5학년 절대 읽기 부담 상한 초과(127음절 > 126음절)`] },
      { questionId: duplicate.id, reasons: ['받는 학년 은행의 지문과 중복'] },
    ]);
  });
  it('24% 상한을 적용하고 입력 순서가 달라도 같은 은행과 버전을 만든다', () => {
    const sources = Array.from({ length: 250 }, (_, i) => question(4, i + 1)), source = approved(sources), assessments = sources.map(level);
    const result = prepareSharedBank([own, source], assessments, empty, 5);
    expect(result.shared).toBe(240); expect(result.bank!.questions).toHaveLength(1240);
    expect(prepareSharedBank([source, own], [...assessments].reverse(), empty, 5).bank).toEqual(result.bank);
  });
  it('같은 문항이라도 받는 학년·난도·오답 이유가 달라지면 판 번호가 달라진다', () => {
    const q = toBankQuestion(question(4, 1), 'published'), second = toBankQuestion(question(4, 2), 'published');
    expect(sharedBankVersion(4, [q])).not.toBe(sharedBankVersion(5, [q]));
    expect(sharedBankVersion(5, [q])).not.toBe(sharedBankVersion(5, [{ ...q, difficultyTier: 'core' }]));
    expect(sharedBankVersion(5, [q])).not.toBe(sharedBankVersion(5, [{ ...q, distractorRationales: { ...q.distractorRationales, b: '다듬은 이유' } }]));
    expect(sharedBankVersion(5, [q, second])).toBe(sharedBankVersion(5, [second, q]));
  });
});

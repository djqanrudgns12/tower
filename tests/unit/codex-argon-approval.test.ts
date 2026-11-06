import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blindReviewSchema, draftBatchSchema, draftSidecarSchema, explanationReviewSchema,
} from '../../src/contracts/questionDraft';
import { contentHash, decide, decideCandidate, type BatchInput } from '../../tools/content/bankBuild';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string): unknown => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
function readLegacy(batchId: string): BatchInput {
  return {
    batchId,
    drafts: draftBatchSchema.parse(read(`content-source/batches/${batchId}/drafts.json`)),
    sidecar: draftSidecarSchema.parse(read(`content-source/batches/${batchId}/sidecar.json`)),
    reviews: {
      codex: blindReviewSchema.parse(read(`content-source/reviews/${batchId}/codex.json`)),
      claude: blindReviewSchema.parse(read(`content-source/reviews/${batchId}/claude.json`)),
    },
    explanation: explanationReviewSchema.parse(read(`content-source/approvals/${batchId}.explanation.json`)),
  };
}
const legacy = readLegacy('Q20-001');
const strongRun = { id: 'test-codex-run', model: 'gpt-6-astra', effort: 'high' as const };

/** 저장된 Q20 문항 한 개를 메모리에서 복사한다. 추적 콘텐츠에는 쓰지 않는다. */
function fixture(): BatchInput {
  const batch = structuredClone(legacy);
  const id = 'g3-argon-0001';
  batch.drafts = batch.drafts.filter(q => q.id === id);
  batch.sidecar.items = batch.sidecar.items.filter(q => q.id === id);
  batch.sidecar.publicationPolicy = 'codex-argon-v1';
  batch.reviews.codex!.items = batch.reviews.codex!.items.filter(q => q.questionId === id);
  batch.reviews.codex!.reviewer.model = 'gpt-6-astra';
  batch.reviews.codex!.items[0]!.run = { ...strongRun };
  batch.reviews.codex!.items[0]!.verdicts.explanation = 'pass';
  batch.explanation!.items = batch.explanation!.items.filter(q => q.questionId === id);
  batch.explanation!.reviewer.model = 'gpt-6-astra';
  batch.explanation!.items[0]!.run = { ...strongRun };
  delete batch.reviews.claude;
  return batch;
}

function rejected(batch: BatchInput, reason: string) {
  const decisions = decide(batch);
  expect(decisions[0]!.decision).toBe('quarantined');
  expect(decisions[0]!.reasons).toContain(reason);
  // 새 정책은 후보 경로로도 낮은 기준을 우회할 수 없다.
  expect(decideCandidate(batch)).toEqual(decisions);
}

describe('codex-argon-v1 공개 승인', () => {
  it('항목별 출처 도입 전의 gpt-6-astra 2단계 보고서는 보고서 출처로 확인한다', () => {
    const batch = fixture();
    delete batch.reviews.codex!.items[0]!.run;
    batch.reviews.codex!.reviewer.tool = '2단계 블라인드 검수(tools/orchestrate/review.mjs)';
    expect(decide(batch)[0]!.decision).toBe('approved');
    batch.reviews.codex!.reviewer.model = 'GPT-6';
    expect(decide(batch)[0]!.decision).toBe('quarantined');
  });
  it('정책은 선택 필드이고 알려지지 않은 정책은 거절한다', () => {
    expect(draftSidecarSchema.parse(legacy.sidecar)).toEqual(legacy.sidecar);
    expect(draftSidecarSchema.parse(fixture().sidecar).publicationPolicy).toBe('codex-argon-v1');
    expect(draftSidecarSchema.safeParse({ ...legacy.sidecar, publicationPolicy: 'unknown' }).success).toBe(false);
  });

  it.each(['high', 'xhigh'] as const)('Claude 없이 강한 Codex(%s)·Argon·Codex 해설로 승인한다', effort => {
    const batch = fixture();
    batch.reviews.codex!.items[0]!.run!.effort = effort;
    batch.explanation!.items[0]!.run!.effort = effort;
    expect(decide(batch)[0]).toMatchObject({ decision: 'approved', reasons: [] });
    expect(decideCandidate(batch)).toEqual(decide(batch));
  });

  it('Claude fail은 새 정책의 승인에 관여하지 않는다', () => {
    const batch = fixture();
    batch.reviews.claude = structuredClone(legacy.reviews.claude!);
    for (const item of batch.reviews.claude.items) {
      item.blindChoice = 'none';
      item.verdicts.source = 'fail';
      item.verdicts.explanation = 'fail';
    }
    expect(decide(batch)[0]).toMatchObject({ decision: 'approved', reasons: [] });
  });

  it.each(['minimal', 'low', 'medium', 'max'] as const)('Codex effort=%s는 거절한다', effort => {
    const batch = fixture();
    batch.reviews.codex!.items[0]!.run!.effort = effort;
    rejected(batch, 'codex: gpt-6-astra high/xhigh 실행 출처 필요');
  });

  it.each(['GPT-6', 'gpt-6-sol'])('과거/다른 모델 %s는 거절한다', model => {
    const batch = fixture();
    batch.reviews.codex!.items[0]!.run!.model = model;
    rejected(batch, 'codex: gpt-6-astra high/xhigh 실행 출처 필요');
  });

  it('항목별 실행 출처 없는 Codex는 거절한다', () => {
    const batch = fixture();
    delete batch.reviews.codex!.items[0]!.run;
    rejected(batch, 'codex: gpt-6-astra high/xhigh 실행 출처 필요');
  });

  it('새 문맥이 아닌 Codex 보고서는 직접 판정에서도 거절한다', () => {
    const batch = fixture();
    Object.assign(batch.reviews.codex!.reviewer, { freshContext: false });
    rejected(batch, 'codex: freshContext true 필요');
  });

  it.each(['revision', 'contentHash'] as const)('현재 %s와 다른 Codex는 거절한다', field => {
    const batch = fixture();
    const item = batch.reviews.codex!.items[0]!;
    if (field === 'revision') item.revision++;
    else item.contentHash = '0'.repeat(64);
    rejected(batch, 'codex: 이 revision의 독립 검토 없음');
  });

  it('독립 풀이가 정답과 다르면 거절한다', () => {
    const batch = fixture();
    batch.reviews.codex!.items[0]!.blindChoice = 'multiple';
    rejected(batch, 'codex: 독립 풀이 multiple ≠ 정답');
  });

  it.each(['source', 'uniqueness', 'grade', 'language', 'explanation'] as const)('Codex %s는 pass여야 한다', key => {
    for (const verdict of ['fail', 'uncertain'] as const) {
      const batch = fixture();
      batch.reviews.codex!.items[0]!.verdicts[key] = verdict;
      rejected(batch, `codex: ${key} ${verdict}`);
    }
  });

  it('오답 이유만 바뀌어도 이전 해설 대조는 무효다', () => {
    const batch = fixture();
    const draft = batch.drafts[0]!;
    const before = contentHash(draft);
    const wrong = draft.options.find(o => o.id !== draft.correctOptionId)!.id;
    draft.distractorRationales[wrong] += ' 추가 확인이 필요해요.';
    expect(contentHash(draft)).toBe(before);
    rejected(batch, 'Codex 해설 대조 없음');
  });

  it.each(['없음', 'fail', 'Claude', 'run 없음', '약한 effort', '다른 run 모델', '이전 revision', '다른 contentHash'] as const)('Codex 해설 %s는 거절한다', kind => {
    const batch = fixture();
    const exp = batch.explanation!.items[0]!;
    let reason = 'Codex 해설 대조 없음';
    if (kind === '없음') batch.explanation = null;
    if (kind === 'fail') { exp.explanation = 'fail'; reason = 'Codex 해설 대조 fail'; }
    if (kind === 'Claude') { batch.explanation!.reviewer.model = 'claude-opus-5-5'; reason = 'Codex 해설 대조: gpt-6-astra high/xhigh 실행 출처 필요'; }
    if (kind === 'run 없음') { delete exp.run; reason = 'Codex 해설 대조: gpt-6-astra high/xhigh 실행 출처 필요'; }
    if (kind === '약한 effort') { exp.run!.effort = 'medium'; reason = 'Codex 해설 대조: gpt-6-astra high/xhigh 실행 출처 필요'; }
    if (kind === '다른 run 모델') { exp.run!.model = 'GPT-6'; reason = 'Codex 해설 대조: gpt-6-astra high/xhigh 실행 출처 필요'; }
    if (kind === '이전 revision') exp.revision++;
    if (kind === '다른 contentHash') exp.contentHash = '0'.repeat(64);
    rejected(batch, reason);
  });

  it.each(['누락', '중복', '오답 fits', '정답 does_not_fit', '이전 revision', '다른 id'] as const)('불완전한 자체 반박(%s)은 거절한다', kind => {
    const batch = fixture();
    const self = batch.sidecar.items[0]!;
    const wrong = self.selfRefutation.filter(r => r.verdict === 'does_not_fit');
    if (kind === '누락') self.selfRefutation.pop();
    if (kind === '중복') wrong[1]!.optionId = wrong[0]!.optionId;
    if (kind === '오답 fits') wrong[0]!.verdict = 'fits';
    if (kind === '정답 does_not_fit') self.selfRefutation.find(r => r.verdict === 'fits')!.verdict = 'does_not_fit';
    if (kind === '이전 revision') self.revision++;
    if (kind === '다른 id') self.id = 'g3-argon-9999';
    rejected(batch, 'Argon 자체 반박: 서로 다른 4개 보기에서 정답만 fits여야 한다');
  });

  it('해설을 보지 않은 Argon blind의 uncertain은 Codex 해설 통과를 막지 않는다', () => {
    const batch = fixture();
    batch.argonBlind = structuredClone(batch.reviews.codex!);
    batch.argonBlind.items[0]!.verdicts.explanation = 'uncertain';
    expect(decide(batch)[0]!.decision).toBe('approved');
    batch.argonBlind.items[0]!.verdicts.explanation = 'fail';
    rejected(batch, 'argon-blind: explanation fail');
  });

  it.each(['source', 'uniqueness', 'grade', 'language'] as const)('현재 argon-blind의 %s fail/uncertain을 무시하지 않는다', key => {
    for (const verdict of ['fail', 'uncertain'] as const) {
      const batch = fixture();
      batch.argonBlind = structuredClone(batch.reviews.codex!);
      batch.argonBlind.items[0]!.verdicts[key] = verdict;
      rejected(batch, `argon-blind: ${key} ${verdict}`);
    }
  });

  it('같은 revision의 argon-blind 해시 불일치도 앞단처럼 거절한다', () => {
    const batch = fixture();
    batch.argonBlind = structuredClone(batch.reviews.codex!);
    batch.argonBlind.items[0]!.contentHash = '0'.repeat(64);
    rejected(batch, 'argon-blind: 검수 뒤 본문이 바뀜(같은 revision, 다른 contentHash)');
  });

  it('게시 형식과 의미 검사를 유지한다', () => {
    const batch = fixture();
    batch.drafts[0]!.explanation = '';
    const hash = contentHash(batch.drafts[0]!);
    batch.reviews.codex!.items[0]!.contentHash = hash;
    batch.explanation!.items[0]!.contentHash = hash;
    expect(decide(batch)[0]!.decision).toBe('quarantined');
    expect(decide(batch)[0]!.reasons.some(r => r.startsWith('게시 형식: '))).toBe(true);
    const semantic = fixture();
    const wrong = semantic.drafts[0]!.options.find(o => o.id !== semantic.drafts[0]!.correctOptionId)!.id;
    // 스키마 상한(80자) 안이면서 의미 검사 상한(60자)을 넘긴다.
    semantic.drafts[0]!.distractorRationales[wrong] = '가'.repeat(61);
    expect(decide(semantic)[0]!.reasons.some(r => r.startsWith('의미 검사: '))).toBe(true);
  });

  it('Q50 엄격 검사의 문항 결함과 배치 결함을 유지한다', () => {
    const batch = fixture();
    batch.batchId = 'Q50-G3-TEST';
    // 같은 fixture를 반복해 중복 문항과 정답 분포 결함을 함께 만든다.
    batch.drafts = Array.from({ length: 20 }, () => structuredClone(batch.drafts[0]!));
    const decisions = decide(batch);
    expect(decisions.every(d => d.decision === 'quarantined')).toBe(true);
    expect(decisions[0]!.reasons).toContain('엄격 검사: 배치 내 지문 중복');
    expect(decisions[0]!.reasons).toContain('배치 검사: 같은 정답 번호가 4회 이상 연속된다');
    expect(decideCandidate(batch)).toEqual(decisions);
  });

  it('정책 없는 Q20-001~003은 기존 승인 51개와 Claude 필수 판정을 보존한다', () => {
    const batches = [legacy, readLegacy('Q20-002'), readLegacy('Q20-003')];
    expect(batches.flatMap(decide).filter(d => d.decision === 'approved')).toHaveLength(51);
    const batch = structuredClone(legacy);
    delete batch.reviews.claude;
    expect(decide(batch).find(d => d.questionId === 'g3-argon-0001')).toMatchObject({
      decision: 'quarantined', reasons: ['claude: 이 revision의 독립 검토 없음'],
    });
  });
});

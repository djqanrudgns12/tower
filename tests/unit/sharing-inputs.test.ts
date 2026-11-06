import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRegistry, loadBatches } from '../../tools/content/bankBuild';
import { buildSharingInputs } from '../../tools/content/sharingInputs';
import type { RetractionList } from '../../src/contracts/questions';

const root = path.resolve(import.meta.dirname, '../..');
const batch = loadBatches(root).find(b => b.batchId === 'Q20-001')!;
const id = 'g3-argon-0001';
const empty: RetractionList = { listVersion: 'test', entries: [] };
const ids = (result: ReturnType<typeof buildSharingInputs>) => result.drafts.map(q => q.id);

describe('공유 입력의 현재 공개 승인·철회 대조', () => {
  it('보고서에서 공개 승인을 다시 계산하며 원 초안을 변경하지 않는다', () => {
    const before = structuredClone(batch);
    const result = buildSharingInputs([batch], empty);
    expect(result.registry).toEqual(buildRegistry([batch]));
    expect(ids(result)).toContain(id);
    expect(result.drafts.find(q => q.id === id)).toBe(batch.drafts.find(q => q.id === id));
    expect(batch).toEqual(before);
  });

  it('최신 수정본이 미승인이면 과거 승인본으로 되돌아가 공유하지 않는다', () => {
    const newer = structuredClone(batch);
    newer.drafts.find(q => q.id === id)!.revision += 1;
    expect(ids(buildSharingInputs([batch, newer], empty))).not.toContain(id);
    expect(ids(buildSharingInputs([newer, batch], empty))).not.toContain(id);
  });

  it('최신 revision의 본문이 충돌하면 어느 승인본도 고르지 않는다', () => {
    const conflicting = structuredClone(batch);
    conflicting.drafts.find(q => q.id === id)!.explanation = '같은 판 번호의 다른 해설';
    expect(ids(buildSharingInputs([batch, conflicting], empty))).not.toContain(id);
    expect(ids(buildSharingInputs([conflicting, batch], empty))).not.toContain(id);
  });

  it('초안이 같아도 검수 보고서가 상충하면 승인 하나로 덮지 않는다', () => {
    const rejected = structuredClone(batch);
    rejected.reviews.codex!.items.find(q => q.questionId === id)!.blindChoice = 'multiple';
    expect(ids(buildSharingInputs([batch, rejected], empty))).not.toContain(id);
  });

  it('현재 공개 조건을 잃은 보고서·오답 이유는 공유 근거가 되지 않는다', () => {
    const missing = structuredClone(batch);
    delete missing.reviews.claude;
    expect(ids(buildSharingInputs([missing], empty))).not.toContain(id);
    const changed = structuredClone(batch);
    const q = changed.drafts.find(q => q.id === id)!;
    const wrong = q.options.find(o => o.id !== q.correctOptionId)!.id;
    q.distractorRationales[wrong] = '검수 뒤 바뀐 오답 이유';
    expect(ids(buildSharingInputs([changed], empty))).not.toContain(id);
  });

  it('철회는 ID와 revision 모두 일치할 때 적용한다', () => {
    const revision = batch.drafts.find(q => q.id === id)!.revision;
    const retraction = { questionId: id, revision, reason: '시험 철회', retractedAt: '2026-11-07T00:00:00.000Z' };
    expect(ids(buildSharingInputs([batch], { ...empty, entries: [retraction] }))).not.toContain(id);
    expect(ids(buildSharingInputs([batch], { ...empty, entries: [{ ...retraction, revision: revision + 1 }] }))).toContain(id);
  });

  it('다른 배치의 승인 판정을 같은 ID의 근거로 섞지 않는다', () => {
    const mismatched = { ...structuredClone(batch), batchId: 'OTHER-BATCH' };
    expect(ids(buildSharingInputs([mismatched], empty))).not.toContain(id);
  });

  it('동일 입력 중복은 한 번만 세며 정렬과 원본 참조가 일정하다', () => {
    const single = buildSharingInputs([batch], empty);
    const repeated = buildSharingInputs([batch, batch], empty);
    expect(repeated.drafts).toEqual(single.drafts);
    expect(ids(repeated)).toEqual(ids(repeated).sort());
    expect(new Set(ids(repeated)).size).toBe(repeated.drafts.length);
  });
});

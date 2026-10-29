import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBank, buildPracticeBank, buildRegistry, contentHash, decide, isPractice, loadBatches, MIN_PUBLISHED, type BatchInput, type Registry } from '../../tools/content/bankBuild';

const root = path.resolve(import.meta.dirname, '../..');
const batches = loadBatches(root);
const q20 = batches.find(b => b.batchId === 'Q20-001')!;
const approvedId = 'g3-argon-0001';

/** 한 문항만 바꾼 배치 사본. 보고서·해설 대조는 원본 그대로 둔다. */
function withDraft(change: (q: BatchInput['drafts'][number]) => void): BatchInput {
  const copy = structuredClone(q20);
  change(copy.drafts.find(q => q.id === approvedId)!);
  return copy;
}
const decisionOf = (batch: BatchInput) => decide(batch).find(d => d.questionId === approvedId)!;

describe('승인 레지스트리·게시 은행 빌드', () => {
  it('저장된 레지스트리는 초안·보고서에서 다시 계산한 것과 같다(손으로 승인할 수 없다)', () => {
    const stored = JSON.parse(readFileSync(path.join(root, 'content-source/approvals/registry.json'), 'utf8')) as Registry;
    expect(stored).toEqual(buildRegistry(batches));
  });

  it('통과 문항도 독립 풀이가 정답과 다르면 격리한다', () => {
    expect(decisionOf(q20).decision).toBe('approved');
    const batch = structuredClone(q20);
    batch.reviews.codex!.items.find(i => i.questionId === approvedId)!.blindChoice = 'multiple';
    expect(decisionOf(batch)).toMatchObject({ decision: 'quarantined', reasons: ['codex: 독립 풀이 multiple ≠ 정답'] });
  });

  it('해설이 바뀌면 이전 revision의 보고서는 근거가 되지 않는다', () => {
    const d = decisionOf(withDraft(q => { q.explanation = '‘꼼꼼하다’는 빈틈이 없다는 뜻이에요.'; }));
    expect(d.decision).toBe('quarantined');
    expect(d.reasons).toEqual(['codex: 이 revision의 독립 검토 없음', 'claude: 이 revision의 독립 검토 없음', '총괄 해설 대조 없음']);
  });

  it('contentHash에 없는 오답 이유만 바뀌어도 총괄 해설 대조를 다시 받아야 한다', () => {
    const d = decisionOf(withDraft(q => { q.distractorRationales.b = '‘몸이 지쳐 움직이기 힘들다’는 사교성을 뜻해요.'; }));
    expect(d.reasons).toEqual(['총괄 해설 대조 없음']);
  });

  it(`승인 문항이 ${MIN_PUBLISHED}개 미만이면 공개 은행을 만들지 않는다`, () => {
    const registry = buildRegistry(batches);
    const approved = registry.entries.filter(e => e.decision === 'approved');
    const short = { ...registry, entries: approved.slice(0, MIN_PUBLISHED - 1) };
    const r = buildBank(batches, short, 3);
    expect(r.bank).toBeNull();
    expect(r.approved).toBe(MIN_PUBLISHED - 1);
  });

  it('저장된 공개 은행은 승인 레지스트리에서 다시 만든 것과 같다(손으로 문항을 넣거나 고칠 수 없다)', () => {
    const { bank } = buildBank(batches, buildRegistry(batches), 3);
    const path3 = path.join(root, 'src/content/questions/grade3.json');
    if (!bank) { expect(existsSync(path3)).toBe(false); return; }
    expect(JSON.parse(readFileSync(path3, 'utf8'))).toEqual(bank);
  });

  it('연습 문항은 학년 은행에 들어가지 않고, 연습 은행은 네 문항이 모두 승인되어야 바뀐다(저장된 파일과 같다)', () => {
    const registry = buildRegistry(batches);
    expect(buildBank(batches, registry, 3).bank?.questions.some(q => isPractice(q.id)) ?? false).toBe(false);
    const stored = JSON.parse(readFileSync(path.join(root, 'src/content/questions/practice.json'), 'utf8'));
    const { bank } = buildPracticeBank(batches, registry);
    if (bank) expect(stored).toEqual(bank);
    else expect(stored.status).toBe('dev_fixture');
  });

  it('승인 문항이 충분하면 가장 높은 승인 revision만 published 은행으로 묶고, 판 번호는 내용으로 정해진다', () => {
    const base = q20.drafts.find(q => q.id === approvedId)!;
    const drafts = Array.from({ length: MIN_PUBLISHED }, (_, i) => ({ ...structuredClone(base), id: `g3-argon-${9000 + i}`, stem: `${base.stem} (${i})` }));
    const rev2 = { ...structuredClone(drafts[0]!), revision: 2, explanation: '‘꼼꼼하다’는 빈틈없이 조심스럽다는 뜻이에요.' };
    const unapproved = { ...structuredClone(base), id: 'g3-argon-9999' };
    const batch: BatchInput = { ...structuredClone(q20), drafts: [...drafts, rev2, unapproved] };
    const entries = [...drafts, rev2].map(q => ({ questionId: q.id, revision: q.revision, batchId: 'X', contentHash: contentHash(q), decision: 'approved' as const, reasons: [] }));
    const registry: Registry = { schemaVersion: '1', rule: '', approved: entries.length, quarantined: 0, entries };
    const { bank } = buildBank([batch], registry, 3);
    expect(bank?.status).toBe('published');
    expect(bank?.questions).toHaveLength(MIN_PUBLISHED);
    expect(bank?.questions.find(q => q.id === drafts[0]!.id)?.revision).toBe(2);
    expect(bank?.questions.some(q => q.id === unapproved.id)).toBe(false);
    expect(buildBank([batch], registry, 3).bank?.bankVersion).toBe(bank?.bankVersion);
    // rev2 승인을 빼면 같은 문항이 rev1로 돌아가므로 내용이 달라져 판 번호도 달라진다.
    expect(buildBank([batch], { ...registry, entries: entries.slice(0, -1) }, 3).bank?.bankVersion).not.toBe(bank?.bankVersion);
  });
});

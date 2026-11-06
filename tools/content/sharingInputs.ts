import { isDeepStrictEqual } from 'node:util';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import type { RetractionList } from '../../src/contracts/questions';
import { buildRegistry, contentHash, isPractice } from './bankBuild';
import type { BatchInput, Decision, Registry } from './bankBuild';

/**
 * 공유 선택기에 넘길 현재 공개 승인 초안만 만든다. 후보 레지스트리를 받지 않고
 * 원 배치의 실제 검수 보고서로 공개 레지스트리를 재계산한다.
 * 최신 초안이 미승인·충돌·철회 상태라면 과거 승인 revision으로 돌아가지 않는다.
 * 반환 registry는 은행 빌드에도 재사용할 수 있다. 파일 IO·은행 변경은 하지 않는다.
 */
export function buildSharingInputs(
  batches: BatchInput[],
  retractions: RetractionList,
): { registry: Registry; drafts: QuestionDraft[] } {
  const registry = buildRegistry(batches);
  const decisions = new Map<string, Decision[]>();
  for (const item of registry.entries) {
    const key = `${item.questionId}@${item.revision}`;
    const entries = decisions.get(key) ?? [];
    entries.push(item);
    decisions.set(key, entries);
  }
  const latest = new Map<string, { question: QuestionDraft; conflict: boolean }>();
  for (const batch of batches) for (const q of batch.drafts) {
    const previous = latest.get(q.id);
    const misplaced = q.batchId !== batch.batchId;
    if (!previous || q.revision > previous.question.revision) {
      latest.set(q.id, { question: q, conflict: misplaced });
    } else if (q.revision === previous.question.revision
      && (misplaced || !isDeepStrictEqual(q, previous.question))) {
      previous.conflict = true;
    }
  }
  const retracted = new Set(retractions.entries.map(e => `${e.questionId}@${e.revision}`));
  const drafts = [...latest.values()].filter(({ question: q, conflict }) => {
    const key = `${q.id}@${q.revision}`;
    if (conflict || isPractice(q.id) || !q.id.startsWith(`g${q.grade}-`) || retracted.has(key)) return false;
    const entries = decisions.get(key) ?? [];
    const hash = contentHash(q);
    return entries.length > 0 && entries.every(e => e.decision === 'approved'
      && e.batchId === q.batchId && e.contentHash === hash);
  }).map(({ question }) => question).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { registry, drafts };
}

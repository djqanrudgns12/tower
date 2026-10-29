import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintQuestion } from '../../src/content/lint';
import {
  blindReviewSchema, contentHashInput, draftBatchSchema, draftSidecarSchema, explanationReviewSchema, rationalesHashInput,
  type BlindReview, type DraftSidecar, type ExplanationReview, type QuestionDraft,
} from '../../src/contracts/questionDraft';
import { bankFileSchema, bankQuestionSchema, type BankFile, type BankQuestion } from '../../src/contracts/questions';

// 게시 은행 빌드(PRD §9.3, §10.2). 초안·Argon 자체 반박·Codex/Claude 독립 검토·총괄 해설 대조를
// questionId/revision/contentHash로 조인해 승인 레지스트리를 만들고, 승인 문항만 published 은행으로 옮긴다.
// 상태 필드를 손으로 바꾸거나 레지스트리를 고쳐서 게시본을 만들 수 없다(tests/unit/bank-build.test.ts가 다시 계산해 대조).

/** 정답 키 없이 푸는 독립 검토자. 파일 이름이 곧 역할이다(QR-001 요청서의 결과 경로). */
export const BLIND_REVIEWERS = ['codex', 'claude'] as const;
/** 사용자용 은행의 최소 승인 문항 수(PRD §9.4, P1 표). */
export const MIN_PUBLISHED = 30;
export const RULE = 'Argon 자체 반박에서 정답만 맞음 · Codex·Claude 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass · 총괄 해설 대조 pass · 게시 형식·의미 검사 통과. 하나라도 어긋나면 그 revision은 격리한다.';

type Reviewer = (typeof BLIND_REVIEWERS)[number];

export interface BatchInput {
  batchId: string;
  drafts: QuestionDraft[];
  sidecar: DraftSidecar;
  reviews: Partial<Record<Reviewer, BlindReview>>;
  explanation: ExplanationReview | null;
}

export interface Decision {
  questionId: string;
  revision: number;
  batchId: string;
  contentHash: string;
  decision: 'approved' | 'quarantined';
  reasons: string[];
}

export interface Registry {
  schemaVersion: '1';
  rule: string;
  approved: number;
  quarantined: number;
  entries: Decision[];
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const contentHash = (q: QuestionDraft) => sha256(contentHashInput(q));
export const rationalesHash = (q: QuestionDraft) => sha256(rationalesHashInput(q));

/** content-source/batches/<batchId>와 같은 이름의 검토·해설 대조 파일을 읽는다. 없는 보고서는 비워 둔다. */
export function loadBatches(root: string): BatchInput[] {
  const dir = path.join(root, 'content-source/batches');
  if (!existsSync(dir)) return [];
  const read = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
  return readdirSync(dir).sort().flatMap(batchId => {
    const draftsPath = path.join(dir, batchId, 'drafts.json');
    if (!existsSync(draftsPath)) return [];
    const reviews: BatchInput['reviews'] = {};
    for (const who of BLIND_REVIEWERS) {
      const p = path.join(root, 'content-source/reviews', batchId, `${who}.json`);
      if (existsSync(p)) reviews[who] = blindReviewSchema.parse(read(p));
    }
    const exp = path.join(root, 'content-source/approvals', `${batchId}.explanation.json`);
    return [{
      batchId,
      drafts: draftBatchSchema.parse(read(draftsPath)),
      sidecar: draftSidecarSchema.parse(read(path.join(dir, batchId, 'sidecar.json'))),
      reviews,
      explanation: existsSync(exp) ? explanationReviewSchema.parse(read(exp)) : null,
    }];
  });
}

export function toBankQuestion(q: QuestionDraft): BankQuestion {
  return {
    id: q.id, revision: q.revision, status: 'published', grade: q.grade, type: q.type, target: q.target, stem: q.stem,
    options: q.options, correctOptionId: q.correctOptionId, explanation: q.explanation, distractorRationales: q.distractorRationales,
  };
}

/** 문항 revision마다 승인·격리를 정한다. 보고서는 같은 contentHash일 때만 그 revision의 근거가 된다. */
export function decide(batch: BatchInput): Decision[] {
  return batch.drafts.map(q => {
    const hash = contentHash(q);
    const reasons: string[] = [];
    const self = batch.sidecar.items.find(i => i.id === q.id && i.revision === q.revision);
    const fits = self?.selfRefutation.filter(r => r.verdict === 'fits').map(r => r.optionId) ?? [];
    if (!self) reasons.push('Argon 자체 반박 없음');
    else if (fits.length !== 1 || fits[0] !== q.correctOptionId) reasons.push(`Argon 자체 반박: 맞는 보기 ${fits.join(',') || '없음'}`);
    for (const who of BLIND_REVIEWERS) {
      const item = batch.reviews[who]?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash);
      if (!item) { reasons.push(`${who}: 이 revision의 독립 검토 없음`); continue; }
      if (item.blindChoice !== q.correctOptionId) reasons.push(`${who}: 독립 풀이 ${item.blindChoice} ≠ 정답`);
      for (const k of ['source', 'uniqueness', 'grade', 'language'] as const) if (item.verdicts[k] !== 'pass') reasons.push(`${who}: ${k} ${item.verdicts[k]}`);
      // 검토자는 해설을 받지 않았으므로 explanation은 uncertain이 정상이다. fail만 격리 사유로 본다.
      if (item.verdicts.explanation === 'fail') reasons.push(`${who}: explanation fail`);
    }
    const exp = batch.explanation?.items.find(i => i.questionId === q.id && i.revision === q.revision);
    if (!exp || exp.contentHash !== hash || exp.rationalesHash !== rationalesHash(q)) reasons.push('총괄 해설 대조 없음');
    else if (exp.explanation !== 'pass') reasons.push(`총괄 해설 대조 fail: ${exp.findings.join(' / ')}`);
    const bank = bankQuestionSchema.safeParse(toBankQuestion(q));
    if (!bank.success) reasons.push(`게시 형식: ${bank.error.issues.map(i => i.message).join(', ')}`);
    else reasons.push(...lintQuestion(bank.data).map(p => `의미 검사: ${p}`));
    return { questionId: q.id, revision: q.revision, batchId: batch.batchId, contentHash: hash, decision: reasons.length ? 'quarantined' : 'approved', reasons };
  });
}

export function buildRegistry(batches: BatchInput[]): Registry {
  const entries = batches.flatMap(decide).sort((a, b) => a.questionId.localeCompare(b.questionId) || a.revision - b.revision);
  const approved = entries.filter(e => e.decision === 'approved').length;
  return { schemaVersion: '1', rule: RULE, approved, quarantined: entries.length - approved, entries };
}

/**
 * 한 학년의 승인 문항을 published 은행으로 묶는다. 같은 문항은 승인된 가장 높은 revision만 쓴다.
 * 승인 문항이 MIN_PUBLISHED보다 적으면 은행을 만들지 않는다. 판 번호는 들어간 문항으로 정해지는 불변 값이다.
 */
export function buildBank(batches: BatchInput[], registry: Registry, grade: number): { bank: BankFile | null; approved: number; note: string } {
  const ok = new Set(registry.entries.filter(e => e.decision === 'approved').map(e => `${e.questionId}@${e.revision}:${e.contentHash}`));
  const latest = new Map<string, QuestionDraft>();
  for (const q of batches.flatMap(b => b.drafts)) {
    if (q.grade !== grade || !ok.has(`${q.id}@${q.revision}:${contentHash(q)}`)) continue;
    if ((latest.get(q.id)?.revision ?? 0) < q.revision) latest.set(q.id, q);
  }
  const drafts = [...latest.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (drafts.length < MIN_PUBLISHED) return { bank: null, approved: drafts.length, note: `${grade}학년 승인 ${drafts.length}/${MIN_PUBLISHED} — 공개 은행을 만들지 않는다` };
  const bankVersion = `pub-${sha256(drafts.map(q => `${q.id}@${q.revision}:${contentHash(q)}`).join('\n')).slice(0, 12)}`;
  const bank = bankFileSchema.parse({ bankId: `g${grade}`, bankVersion, grade, status: 'published', questions: drafts.map(toBankQuestion) });
  return { bank, approved: drafts.length, note: `${grade}학년 승인 ${drafts.length}문항 → ${bankVersion}` };
}

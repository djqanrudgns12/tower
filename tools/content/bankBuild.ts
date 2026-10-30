import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintBatchStrict, lintQuestion } from '../../src/content/lint';
import {
  blindReviewSchema, contentHashInput, draftBatchSchema, draftSidecarSchema, explanationReviewSchema, rationalesHashInput,
  type BlindReview, type DraftSidecar, type ExplanationReview, type QuestionDraft,
} from '../../src/contracts/questionDraft';
import { bankFileSchema, bankQuestionSchema, type BankFile, type BankQuestion, type BankStatus } from '../../src/contracts/questions';

// 게시 은행 빌드(PRD §9.3, §10.2). 초안·Argon 자체 반박·Codex/Claude 독립 검토·총괄 해설 대조를
// questionId/revision/contentHash로 조인해 승인 레지스트리를 만들고, 승인 문항만 published 은행으로 옮긴다.
// 또한 새 문맥(freshContext=true) 독립 블라인드 검수(argon-blind.json) + 자체 반박 + 해설 대조 + 의미 검사를
// 모두 통과한 확장 문항은 candidate-registry.json을 통해 verified_candidate 후보 은행으로 결정론적으로 빌드한다.
// 상태 필드를 손으로 바꾸거나 레지스트리를 고쳐서 은행을 만들 수 없다(tests/unit/bank-build.test.ts가 다시 계산해 대조).

/** 정답 키 없이 푸는 독립 검토자. 파일 이름이 곧 역할이다(QR-001 요청서의 결과 경로). */
export const BLIND_REVIEWERS = ['codex', 'claude'] as const;
/** 사용자용 은행의 최소 승인 문항 수(PRD §9.4, P1 표). */
export const MIN_PUBLISHED = 30;
/** 첫 연습 판 전용 문항(PRD §12.2). 학년 은행에 넣지 않고 연습 은행으로 따로 묶는다. 네 문항이 모두 승인되어야 바꾼다. */
export const isPractice = (id: string) => /^g[3-6]-practice-/.test(id);
export const PRACTICE_SIZE = 4;
export const RULE = 'Argon 자체 반박에서 정답만 맞음 · Codex·Claude 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass · 총괄 해설 대조 pass · 게시 형식·의미 검사 통과. 하나라도 어긋나면 그 revision은 격리한다.';
export const CANDIDATE_RULE = '3모델 공동검수 승인 문항 또는 (Argon 자체 반박에서 정답만 맞음 · 존재하는 외부 블라인드 검수(codex/claude) 모두 pass · 새 문맥 argon-blind 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass · 총괄 해설 대조 pass · 게시 형식·의미·엄격 검사 통과). 하나라도 어긋나면 격리한다.';

type Reviewer = (typeof BLIND_REVIEWERS)[number];

export interface BatchInput {
  batchId: string;
  drafts: QuestionDraft[];
  sidecar: DraftSidecar;
  reviews: Partial<Record<Reviewer, BlindReview>>;
  argonBlind?: BlindReview | null;
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
    const argonBlindPath = path.join(root, 'content-source/reviews', batchId, 'argon-blind.json');
    const exp = path.join(root, 'content-source/approvals', `${batchId}.explanation.json`);
    return [{
      batchId,
      drafts: draftBatchSchema.parse(read(draftsPath)),
      sidecar: draftSidecarSchema.parse(read(path.join(dir, batchId, 'sidecar.json'))),
      reviews,
      argonBlind: existsSync(argonBlindPath) ? blindReviewSchema.parse(read(argonBlindPath)) : null,
      explanation: existsSync(exp) ? explanationReviewSchema.parse(read(exp)) : null,
    }];
  });
}

export function toBankQuestion(q: QuestionDraft, status: BankStatus = 'published'): BankQuestion {
  return {
    id: q.id,
    revision: q.revision,
    status,
    grade: q.grade,
    type: q.type,
    ...(q.difficultyTier ? { difficultyTier: q.difficultyTier } : {}),
    ...(q.variantTag ? { variantTag: q.variantTag } : {}),
    ...(q.dialectRegion ? { dialectRegion: q.dialectRegion } : {}),
    target: q.target,
    stem: q.stem,
    options: q.options,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
    distractorRationales: q.distractorRationales,
  };
}

/** 문항 revision마다 공동검수 승인·격리를 정한다. 보고서는 같은 contentHash일 때만 그 revision의 근거가 된다. */
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

/** 외부 블라인드 검수(codex/claude) 및 새 문맥 블라인드 검수(argon-blind.json) 기반 후보 은행 판정. 이미 3모델 승인을 받은 문항은 그대로 통과시킨다. */
export function decideCandidate(batch: BatchInput): Decision[] {
  const fullByKey = new Map(decide(batch).map(d => [`${d.questionId}@${d.revision}`, d]));
  const strictIssues = batch.batchId.startsWith('Q50-') ? lintBatchStrict(batch.drafts) : [];
  return batch.drafts.map(q => {
    const full = fullByKey.get(`${q.id}@${q.revision}`);
    if (full?.decision === 'approved') return full;

    const hash = contentHash(q);
    const reasons: string[] = [];
    const self = batch.sidecar.items.find(i => i.id === q.id && i.revision === q.revision);
    const fits = self?.selfRefutation.filter(r => r.verdict === 'fits').map(r => r.optionId) ?? [];
    if (!self) reasons.push('Argon 자체 반박 없음');
    else if (fits.length !== 1 || fits[0] !== q.correctOptionId) reasons.push(`Argon 자체 반박: 맞는 보기 ${fits.join(',') || '없음'}`);

    for (const who of BLIND_REVIEWERS) {
      const ext = batch.reviews[who]?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash);
      if (!ext) continue;
      if (ext.blindChoice !== q.correctOptionId) reasons.push(`${who}: 독립 풀이 ${ext.blindChoice} ≠ 정답`);
      for (const k of ['source', 'uniqueness', 'grade', 'language'] as const) {
        if (ext.verdicts[k] !== 'pass') reasons.push(`${who}: ${k} ${ext.verdicts[k]}`);
      }
      if (ext.verdicts.explanation === 'fail') reasons.push(`${who}: explanation fail`);
    }

    const blind = batch.argonBlind?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash);
    if (!blind) reasons.push('argon-blind: 이 revision의 독립 검토 없음');
    else {
      if (blind.blindChoice !== q.correctOptionId) reasons.push(`argon-blind: 독립 풀이 ${blind.blindChoice} ≠ 정답`);
      for (const k of ['source', 'uniqueness', 'grade', 'language'] as const) if (blind.verdicts[k] !== 'pass') reasons.push(`argon-blind: ${k} ${blind.verdicts[k]}`);
      if (blind.verdicts.explanation === 'fail') reasons.push('argon-blind: explanation fail');
    }

    const exp = batch.explanation?.items.find(i => i.questionId === q.id && i.revision === q.revision);
    if (!exp || exp.contentHash !== hash || exp.rationalesHash !== rationalesHash(q)) reasons.push('총괄 해설 대조 없음');
    else if (exp.explanation !== 'pass') reasons.push(`총괄 해설 대조 fail: ${exp.findings.join(' / ')}`);

    const bank = bankQuestionSchema.safeParse(toBankQuestion(q, 'verified_candidate'));
    if (!bank.success) reasons.push(`게시 형식: ${bank.error.issues.map(i => i.message).join(', ')}`);
    else reasons.push(...lintQuestion(bank.data).map(p => `의미 검사: ${p}`));
    for (const s of strictIssues) {
      if (s.startsWith(`${q.id}: `)) {
        const msg = `엄격 검사: ${s.slice(q.id.length + 2)}`;
        if (!reasons.includes(msg)) reasons.push(msg);
      } else if (!/^[a-z0-9-]+: /.test(s)) {
        const msg = `배치 검사: ${s}`;
        if (!reasons.includes(msg)) reasons.push(msg);
      }
    }

    return { questionId: q.id, revision: q.revision, batchId: batch.batchId, contentHash: hash, decision: reasons.length ? 'quarantined' : 'approved', reasons };
  });
}

export function buildRegistry(batches: BatchInput[]): Registry {
  const entries = batches.flatMap(decide).sort((a, b) => a.questionId.localeCompare(b.questionId) || a.revision - b.revision);
  const approved = entries.filter(e => e.decision === 'approved').length;
  return { schemaVersion: '1', rule: RULE, approved, quarantined: entries.length - approved, entries };
}

export function buildCandidateRegistry(batches: BatchInput[]): Registry {
  const entries = batches.flatMap(decideCandidate).sort((a, b) => a.questionId.localeCompare(b.questionId) || a.revision - b.revision);
  const approved = entries.filter(e => e.decision === 'approved').length;
  return { schemaVersion: '1', rule: CANDIDATE_RULE, approved, quarantined: entries.length - approved, entries };
}

/**
 * 한 학년의 승인 문항을 published 은행으로 묶는다. 같은 문항은 승인된 가장 높은 revision만 쓴다.
 * 승인 문항이 MIN_PUBLISHED보다 적으면 은행을 만들지 않는다. 판 번호는 들어간 문항으로 정해지는 불변 값이다.
 */
export function buildBank(batches: BatchInput[], registry: Registry, grade: number): { bank: BankFile | null; approved: number; note: string } {
  const drafts = approvedLatest(batches, registry, q => q.grade === grade && !isPractice(q.id));
  if (drafts.length < MIN_PUBLISHED) return { bank: null, approved: drafts.length, note: `${grade}학년 승인 ${drafts.length}/${MIN_PUBLISHED} — 공개 은행을 만들지 않는다` };
  const bankVersion = versionOf('pub', drafts);
  const bank = bankFileSchema.parse({ bankId: `g${grade}`, bankVersion, grade, status: 'published', questions: drafts.map(q => toBankQuestion(q, 'published')) });
  return { bank, approved: drafts.length, note: `${grade}학년 승인 ${drafts.length}문항 → ${bankVersion}` };
}

/**
 * 한 학년의 검증 완료 후보 은행을 묶는다(3모델 승인본 + 새 문맥 블라인드 검증 통과본 통합).
 * 공개 은행보다 확장된 문항이 있고 총량이 MIN_PUBLISHED 이상일 때만 grade<N>.candidate.json을 만든다.
 */
export function buildCandidateBank(
  batches: BatchInput[],
  publishedRegistry: Registry,
  candidateRegistry: Registry,
  grade: number,
): { bank: BankFile | null; approved: number; note: string } {
  const publishedCount = approvedLatest(batches, publishedRegistry, q => q.grade === grade && !isPractice(q.id)).length;
  const drafts = approvedLatest(batches, candidateRegistry, q => q.grade === grade && !isPractice(q.id));
  if (drafts.length < MIN_PUBLISHED) {
    return { bank: null, approved: drafts.length, note: `${grade}학년 후보 검증 ${drafts.length}/${MIN_PUBLISHED} — 후보 은행을 만들지 않는다` };
  }
  if (drafts.length <= publishedCount) {
    return { bank: null, approved: drafts.length, note: `${grade}학년 후보 ${drafts.length}문항(공개 ${publishedCount}문항과 같음) — 별도 후보 은행 불필요` };
  }
  const bankVersion = versionOf('cand', drafts);
  const bank = bankFileSchema.parse({
    bankId: `g${grade}-candidate`,
    bankVersion,
    grade,
    status: 'verified_candidate',
    note: '표준국어대사전·우리말샘 원문 근거 + 4보기 자체 반박 + 외부 Codex 블라인드 교차검수 및 새 문맥 독립 블라인드 검수(argon-blind) 반영 후보 은행. 3모델(Claude 포함) 공동검수 완료 전까지 개인 기록용(development)으로 운용한다.',
    questions: drafts.map(q => toBankQuestion(q, 'verified_candidate')),
  });
  return { bank, approved: drafts.length, note: `${grade}학년 후보 검증 ${drafts.length}문항 → ${bankVersion}` };
}

/** 첫 연습 판 은행. 연습 문항 네 개가 모두 승인되어야 만든다(그 전에는 개발용 연습 은행을 그대로 쓴다). */
export function buildPracticeBank(batches: BatchInput[], registry: Registry): { bank: BankFile | null; note: string } {
  const drafts = approvedLatest(batches, registry, q => isPractice(q.id));
  if (drafts.length < PRACTICE_SIZE) return { bank: null, note: `연습 문항 승인 ${drafts.length}/${PRACTICE_SIZE} — 연습 은행을 바꾸지 않는다` };
  const bankVersion = versionOf('pub', drafts);
  const bank = bankFileSchema.parse({
    bankId: 'practice', bankVersion, grade: drafts[0]!.grade, status: 'published',
    note: '첫 연습 판 전용(PRD §12.2). 정규 은행·기록·공개 랭킹에 쓰지 않는다. Argon·Codex·Claude 공동검수를 통과한 문항이다.',
    questions: drafts.map(q => toBankQuestion(q, 'published')),
  });
  return { bank, note: `연습 문항 승인 ${drafts.length}문항 → ${bankVersion}` };
}

/** 승인된 revision 가운데 문항마다 가장 높은 것만, ID 순으로. */
function approvedLatest(batches: BatchInput[], registry: Registry, keep: (q: QuestionDraft) => boolean): QuestionDraft[] {
  const ok = new Set(registry.entries.filter(e => e.decision === 'approved').map(e => `${e.questionId}@${e.revision}:${e.contentHash}`));
  const latest = new Map<string, QuestionDraft>();
  for (const q of batches.flatMap(b => b.drafts)) {
    if (!keep(q) || !ok.has(`${q.id}@${q.revision}:${contentHash(q)}`)) continue;
    if ((latest.get(q.id)?.revision ?? 0) < q.revision) latest.set(q.id, q);
  }
  return [...latest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** 판 번호는 들어간 문항으로 정해지는 불변 값이다. */
const versionOf = (prefix: string, drafts: QuestionDraft[]) =>
  `${prefix}-${sha256(drafts.map(q => `${q.id}@${q.revision}:${contentHash(q)}`).join('\n')).slice(0, 12)}`;

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintBatchStrict, lintQuestion } from '../../src/content/lint';
import {
  blindReviewSchema, contentHashInput, draftBatchSchema, draftSidecarSchema, explanationReviewSchema, rationalesHashInput,
  type BlindReview, type DraftSidecar, type ExplanationReview, type QuestionDraft,
} from '../../src/contracts/questionDraft';
import { bankFileSchema, bankQuestionSchema, type BankFile, type BankQuestion, type BankStatus } from '../../src/contracts/questions';

// 게시 은행 빌드(PRD §9.3, §10.2). 초안·Argon 자체 반박·정책별 독립 검토·해설 대조를
// questionId/revision/contentHash로 조인해 승인 레지스트리를 만들고, 승인 문항만 published 은행으로 옮긴다.
// 공동검수 진행 중인 문항은 같은 revision의 외부 블라인드 검수 1건 이상 + 새 문맥 argon-blind + 자체 반박 + 해설 대조 + 의미 검사를
// 통과하면 candidate-registry.json을 거쳐 verified_candidate 후보 은행으로 만든다. 후보 은행은 게임에 싣지 않는다.
// 상태 필드를 손으로 바꾸거나 레지스트리를 고쳐서 은행을 만들 수 없다(tests/unit/bank-build.test.ts가 다시 계산해 대조).

/** 정답 키 없이 푸는 독립 검토자. 파일 이름이 곧 역할이다(QR-001 요청서의 결과 경로). */
export const BLIND_REVIEWERS = ['codex', 'claude'] as const;
/** 사용자용 은행의 최소 승인 문항 수(PRD §9.4, P1 표). */
export const MIN_PUBLISHED = 30;
/** 첫 연습 판 전용 문항(PRD §12.2). 학년 은행에 넣지 않고 연습 은행으로 따로 묶는다. 네 문항이 모두 승인되어야 바꾼다. */
export const isPractice = (id: string) => /^g[3-6]-practice-/.test(id);
export const PRACTICE_SIZE = 4;
const LEGACY_RULE = 'Argon 자체 반박에서 정답만 맞음 · Codex·Claude 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass · Claude 총괄 해설 대조 pass · 게시 형식·의미 검사 통과. 하나라도 어긋나면 그 revision은 격리한다.';
const LEGACY_CANDIDATE_RULE = '3모델 공동검수 승인 문항 또는 (Argon 자체 반박에서 정답만 맞음 · 같은 revision·contentHash의 외부 블라인드 검수(codex·claude) 1건 이상이 있고 있는 것은 모두 pass · 새 문맥 argon-blind 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass · 해설 대조 pass · 게시 형식·의미·엄격 검사 통과). 하나라도 어긋나면 격리한다. 후보 은행은 제작 진척 확인용이며 게임에 싣지 않는다(PRD §9.3).';
export const RULE = 'publicationPolicy=codex-argon-v1: 현재 id·revision의 Argon 자체 반박은 서로 다른 4개 보기에서 정답만 fits, 나머지는 does_not_fit · 현재 revision·contentHash의 Codex 독립 풀이가 정답과 같고 source·uniqueness·grade·language·explanation 모두 pass · freshContext=true 및 항목 run.model=gpt-6-astra, effort=high 또는 xhigh(항목 출처 도입 전에는 gpt-6-astra 2단계 도구 보고서로 독립 풀이 출처 확인; 과거 effort는 추정하지 않음) · 현재 revision·contentHash·rationalesHash의 Codex 해설 대조 pass(reviewer.model과 run.model=gpt-6-astra, effort=high 또는 xhigh) · 현재 argon-blind가 있으면 새 문맥·같은 해시·정답 일치·source/uniqueness/grade/language pass 및 explanation fail 금지 · 게시 형식·의미 검사와 Q50 엄격 배치 검사 통과. Claude는 사용하지 않는다. 정책 없는 legacy: Argon 자체 반박에서 정답만 맞음 · 현재 revision·contentHash의 Codex·Claude 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass, explanation fail 금지 · 현재 revision·contentHash·rationalesHash의 Claude 총괄 해설 대조 pass · 게시 형식·의미 검사 통과. 각 정책의 조건이 하나라도 어긋나면 그 revision은 격리한다.';
export const CANDIDATE_RULE = 'publicationPolicy=codex-argon-v1은 공개 승인과 동일한 판정만 사용한다(Claude나 legacy 후보 경로로 우회 불가). 정책 없는 legacy: 공개 승인 문항 또는 (Argon 자체 반박에서 정답만 맞음 · 같은 revision·contentHash의 외부 블라인드 검수(codex·claude) 1건 이상이 있고 있는 것은 모두 정답 일치, source·uniqueness·grade·language pass, explanation fail 금지 · 새 문맥 argon-blind 독립 풀이가 정답과 같고 source·uniqueness·grade·language 모두 pass, explanation fail 금지 · 현재 revision·contentHash·rationalesHash의 해설 대조 pass · 게시 형식·의미·Q50 엄격 검사 통과). 하나라도 어긋나면 격리한다. 후보 은행은 제작 진척 확인용이며 게임에 싣지 않는다(PRD §9.3).';
/** 총괄 해설 대조는 작성 모델(Argon)이 아닌 총괄 Claude가 해야 공동검수로 인정한다(공동검수 절차 §역할, PRD §19). */
export const isCommanderModel = (model: string) => /claude/i.test(model);

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
    if (!existsSync(draftsPath) || existsSync(path.join(dir, batchId, 'closed.json'))) return [];
    const sidecar = draftSidecarSchema.parse(read(path.join(dir, batchId, 'sidecar.json')));
    const reviews: BatchInput['reviews'] = {};
    for (const who of BLIND_REVIEWERS) {
      // 새 정책은 낡거나 잘못된 Claude 보고서의 존재·파싱에도 의존하지 않는다.
      if (sidecar.publicationPolicy === 'codex-argon-v1' && who === 'claude') continue;
      const p = path.join(root, 'content-source/reviews', batchId, `${who}.json`);
      if (existsSync(p)) reviews[who] = blindReviewSchema.parse(read(p));
    }
    const argonBlindPath = path.join(root, 'content-source/reviews', batchId, 'argon-blind.json');
    const exp = path.join(root, 'content-source/approvals', `${batchId}.explanation.json`);
    return [{
      batchId,
      drafts: draftBatchSchema.parse(read(draftsPath)),
      sidecar,
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

const isStrongCodexRun = (run: BlindReview['items'][number]['run']) =>
  run?.model === 'gpt-6-astra' && (run.effort === 'high' || run.effort === 'xhigh');

/** 명시적으로 전환한 배치만 적용한다. legacy의 승인·후보 판정은 그대로 보존한다. */
function decideCodexArgon(batch: BatchInput): Decision[] {
  const strict = batch.batchId.startsWith('Q50-') ? lintBatchStrict(batch.drafts) : [];
  const batchIssues = strict.filter(s => !batch.drafts.some(q => s.startsWith(`${q.id}: `)));
  return batch.drafts.map(q => {
    const hash = contentHash(q);
    const reasons: string[] = [];
    const self = batch.sidecar.items.find(i => i.id === q.id && i.revision === q.revision);
    if (!self || self.selfRefutation.length !== 4 || new Set(self.selfRefutation.map(r => r.optionId)).size !== 4
      || !self.selfRefutation.every(r => q.options.some(o => o.id === r.optionId)
        && r.verdict === (r.optionId === q.correctOptionId ? 'fits' : 'does_not_fit'))) {
      reasons.push('Argon 자체 반박: 서로 다른 4개 보기에서 정답만 fits여야 한다');
    }

    const checkReview = (who: string, item: BlindReview['items'][number], explanationRequired = true) => {
      if (item.blindChoice !== q.correctOptionId) reasons.push(`${who}: 독립 풀이 ${item.blindChoice} ≠ 정답`);
      for (const key of ['source', 'uniqueness', 'grade', 'language', 'explanation'] as const) {
        if (key === 'explanation' && !explanationRequired && item.verdicts[key] === 'uncertain') continue;
        if (item.verdicts[key] !== 'pass') reasons.push(`${who}: ${key} ${item.verdicts[key]}`);
      }
    };
    const codex = batch.reviews.codex;
    const item = codex?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash);
    if (!item) reasons.push('codex: 이 revision의 독립 검토 없음');
    else {
      if (codex?.reviewer.freshContext !== true) reasons.push('codex: freshContext true 필요');
      const reportProvenance = !item.run && codex?.reviewer.model === 'gpt-6-astra'
        && codex.reviewer.tool === '2단계 블라인드 검수(tools/orchestrate/review.mjs)';
      if (!isStrongCodexRun(item.run) && !reportProvenance) reasons.push('codex: gpt-6-astra high/xhigh 실행 출처 필요');
      checkReview('codex', item);
    }
    // 현재 revision의 실제 지적과 해시 불일치는 앞단과 같이 유지한다. 이전 revision은 근거가 아니다.
    for (const blind of batch.argonBlind?.items.filter(i => i.questionId === q.id && i.revision === q.revision) ?? []) {
      if (blind.contentHash !== hash) reasons.push('argon-blind: 검수 뒤 본문이 바뀜(같은 revision, 다른 contentHash)');
      else {
        if (batch.argonBlind?.reviewer.freshContext !== true) reasons.push('argon-blind: freshContext true 필요');
        // Argon blind에는 해설을 주지 않았다. 실제 fail은 유지하고, 미제공에 따른 uncertain은 Codex 해설 대조가 맡는다.
        checkReview('argon-blind', blind, false);
      }
    }

    const exp = batch.explanation?.items.find(i => i.questionId === q.id && i.revision === q.revision);
    if (!exp || exp.contentHash !== hash || exp.rationalesHash !== rationalesHash(q)) reasons.push('Codex 해설 대조 없음');
    else {
      if (batch.explanation?.reviewer.model !== 'gpt-6-astra' || !isStrongCodexRun(exp.run)) {
        reasons.push('Codex 해설 대조: gpt-6-astra high/xhigh 실행 출처 필요');
      }
      if (exp.explanation !== 'pass') reasons.push('Codex 해설 대조 fail');
    }
    const bank = bankQuestionSchema.safeParse(toBankQuestion(q));
    if (!bank.success) reasons.push(`게시 형식: ${bank.error.issues.map(i => i.message).join(', ')}`);
    else reasons.push(...lintQuestion(bank.data).map(p => `의미 검사: ${p}`));
    reasons.push(...strict.filter(s => s.startsWith(`${q.id}: `)).map(s => `엄격 검사: ${s.slice(q.id.length + 2)}`));
    reasons.push(...batchIssues.map(s => `배치 검사: ${s}`));
    return { questionId: q.id, revision: q.revision, batchId: batch.batchId, contentHash: hash,
      decision: reasons.length ? 'quarantined' : 'approved', reasons: [...new Set(reasons)] };
  });
}

/** 문항 revision마다 정책별 승인·격리를 정한다. 보고서는 같은 contentHash일 때만 그 revision의 근거가 된다. */
export function decide(batch: BatchInput): Decision[] {
  if (batch.sidecar.publicationPolicy === 'codex-argon-v1') return decideCodexArgon(batch);
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
    else if (!isCommanderModel(batch.explanation!.reviewer.model)) reasons.push(`총괄 해설 대조자가 Claude가 아님: ${batch.explanation!.reviewer.model}`);
    else if (exp.explanation !== 'pass') reasons.push(`총괄 해설 대조 fail: ${exp.findings.join(' / ')}`);
    const bank = bankQuestionSchema.safeParse(toBankQuestion(q));
    if (!bank.success) reasons.push(`게시 형식: ${bank.error.issues.map(i => i.message).join(', ')}`);
    else reasons.push(...lintQuestion(bank.data).map(p => `의미 검사: ${p}`));
    return { questionId: q.id, revision: q.revision, batchId: batch.batchId, contentHash: hash, decision: reasons.length ? 'quarantined' : 'approved', reasons };
  });
}

/** 외부 블라인드 검수(codex/claude) 및 새 문맥 블라인드 검수(argon-blind.json) 기반 후보 은행 판정. 이미 3모델 승인을 받은 문항은 그대로 통과시킨다. */
export function decideCandidate(batch: BatchInput): Decision[] {
  if (batch.sidecar.publicationPolicy === 'codex-argon-v1') return decide(batch);
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

    let externals = 0;
    for (const who of BLIND_REVIEWERS) {
      const sameRevision = batch.reviews[who]?.items.filter(i => i.questionId === q.id && i.revision === q.revision) ?? [];
      const ext = sameRevision.find(i => i.contentHash === hash);
      // revision을 올리지 않고 본문만 바꾸면 그 검수는 이 본문의 근거가 아니다. 조용히 넘기지 않는다.
      if (!ext && sameRevision.length > 0) reasons.push(`${who}: 검수 뒤 본문이 바뀜(같은 revision, 다른 contentHash)`);
      if (!ext) continue;
      externals++;
      if (ext.blindChoice !== q.correctOptionId) reasons.push(`${who}: 독립 풀이 ${ext.blindChoice} ≠ 정답`);
      for (const k of ['source', 'uniqueness', 'grade', 'language'] as const) {
        if (ext.verdicts[k] !== 'pass') reasons.push(`${who}: ${k} ${ext.verdicts[k]}`);
      }
      if (ext.verdicts.explanation === 'fail') reasons.push(`${who}: explanation fail`);
    }

    if (externals === 0) reasons.push('외부 블라인드 검수(codex·claude): 이 revision의 검수 없음');

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
  return { schemaVersion: '1', rule: batches.some(b => b.sidecar.publicationPolicy === 'codex-argon-v1') ? RULE : LEGACY_RULE, approved, quarantined: entries.length - approved, entries };
}

export function buildCandidateRegistry(batches: BatchInput[]): Registry {
  const entries = batches.flatMap(decideCandidate).sort((a, b) => a.questionId.localeCompare(b.questionId) || a.revision - b.revision);
  const approved = entries.filter(e => e.decision === 'approved').length;
  return { schemaVersion: '1', rule: batches.some(b => b.sidecar.publicationPolicy === 'codex-argon-v1') ? CANDIDATE_RULE : LEGACY_CANDIDATE_RULE, approved, quarantined: entries.length - approved, entries };
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
    note: '공동검수 진행 중인 후보 은행. 같은 revision의 외부 블라인드 검수(codex·claude) 1건 이상과 새 문맥 argon-blind를 통과했다. 3모델 공동검수 승인 전에는 게임에 싣지 않는다(PRD §9.3).',
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

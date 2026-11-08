import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintBatchStrict, lintGradeBasisUnit, lintQuestion } from '../../src/content/lint';
import type { BlindReview, DraftSidecar, QuestionDraft } from '../../src/contracts/questionDraft';
import { OPTION_IDS, type OptionId } from '../../src/contracts/questions';
import { contentHash, policyReviewer, toBankQuestion, type BatchInput } from './bankBuild';
import { isCurrentLevelAssessment } from './levels';

export interface FrontDecision {
  questionId: string;
  revision: number;
  contentHash: string;
  status: 'pass' | 'defect' | 'pending';
  defects: string[];
  pending: string[];
}
export interface FrontGateOptions { root?: string; curriculumCodes?: Set<string> | null }

/** 정본 파일이 없으면 성취기준 근거를 인정하지 않는다. 코드 필드만 읽고 근거 문장에서 추측하지 않는다. */
function curriculumCodes(root?: string): Set<string> | null {
  if (!root) return null;
  const file = path.join(root, 'content-source/reference/curriculum-2022.json');
  if (!existsSync(file)) return null;
  const codes = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'code' && typeof child === 'string' && /^\[?\d{1,2}국\d{2}-\d{2}\]?$/.test(child)) codes.add(child);
      else visit(child);
    }
  };
  visit(JSON.parse(readFileSync(file, 'utf8')));
  return codes;
}

export function currentDrafts(drafts: QuestionDraft[]): QuestionDraft[] {
  const latest = new Map<string, QuestionDraft>();
  for (const q of drafts) if (!latest.has(q.id) || latest.get(q.id)!.revision < q.revision) latest.set(q.id, q);
  return [...latest.values()];
}

export function selfRefutationPasses(q: QuestionDraft, side?: DraftSidecar['items'][number]): boolean {
  if (!side || side.revision !== q.revision || side.id !== q.id) return false;
  return side.selfRefutation.length === 4 && new Set(side.selfRefutation.map(r => r.optionId)).size === 4
    && side.selfRefutation.every(r => r.verdict === (r.optionId === q.correctOptionId ? 'fits' : 'does_not_fit'));
}

function reviewDefects(q: QuestionDraft, who: string, item: BlindReview['items'][number]): string[] {
  const issues: string[] = [];
  if (item.blindChoice !== q.correctOptionId) issues.push(`${who}: 독립 풀이 ${item.blindChoice} ≠ 정답`);
  for (const k of ['source', 'uniqueness', 'grade', 'language'] as const) {
    if (item.verdicts[k] !== 'pass') issues.push(`${who}: ${k} ${item.verdicts[k]}`);
  }
  if (item.verdicts.explanation === 'fail') issues.push(`${who}: explanation fail`);
  return issues;
}

/** Claude 검수와 해설 대조 없이 S3 진입 여부를 판정한다. levelFile은 읽은 JSON 또는 파일 경로다. */
export function frontGate(batch: BatchInput, levelFile: unknown = null, opts: FrontGateOptions = {}): { items: FrontDecision[]; batchDefects: string[] } {
  const drafts = currentDrafts(batch.drafts);
  const levels: unknown = typeof levelFile === 'string'
    ? (existsSync(levelFile) ? JSON.parse(readFileSync(levelFile, 'utf8')) : null) : levelFile;
  const levelItems: unknown[] = levels && typeof levels === 'object' && 'items' in levels && Array.isArray(levels.items)
    && 'batchId' in levels && levels.batchId === batch.batchId && 'rubricVersion' in levels && levels.rubricVersion === 'lv1' ? levels.items : [];
  const codes = opts.curriculumCodes === undefined ? curriculumCodes(opts.root ?? process.cwd()) : opts.curriculumCodes;
  const strict = batch.batchId.startsWith('Q50-') ? lintBatchStrict(drafts) : [];
  const batchDefects = strict.filter(s => !drafts.some(q => s.startsWith(`${q.id}: `)));
  const items = drafts.map((q): FrontDecision => {
    const hash = contentHash(q);
    const defects: string[] = [];
    const pending: string[] = [];
    const self = batch.sidecar.items.find(i => i.id === q.id && i.revision === q.revision);
    if (!selfRefutationPasses(q, self)) defects.push('Argon 자체 반박에서 정답만 fits여야 한다');
    // 앞단 독립 검토는 정책 검토자(claude-argon-v1이면 Claude, 그 밖에는 Codex)가 맡는다.
    const who = policyReviewer(batch.sidecar) ?? 'codex';
    const independent = batch.reviews[who]?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash);
    if (independent) defects.push(...reviewDefects(q, who, independent));
    else pending.push(`${who}: 이 revision·contentHash의 독립 검토 없음`);
    const level = levelItems.find(i => isCurrentLevelAssessment(q, i));
    if (!isCurrentLevelAssessment(q, level)) pending.push('이 revision의 수준 합의 없음');
    else {
      if (level.merged.rule === 1) defects.push('수준 합의: elementaryFit 금지 조건');
      for (const flag of ['too_hard', 'stdictSpecialized'] as const) if (level.merged.flags.includes(flag)) defects.push(`수준 합의: ${flag}`);
      if (q.difficultyTier !== level.merged.ownTier) pending.push('tier 미반영');
      defects.push(...lintGradeBasisUnit(q.gradeBasis.unit, codes));
    }
    defects.push(...lintQuestion(toBankQuestion(q)).map(s => `의미 검사: ${s}`));
    defects.push(...strict.filter(s => s.startsWith(`${q.id}: `)).map(s => `엄격 검사: ${s.slice(q.id.length + 2)}`));
    const argon = batch.argonBlind?.items.filter(i => i.questionId === q.id && i.revision === q.revision) ?? [];
    for (const item of argon) {
      if (item.contentHash !== hash) defects.push('argon-blind: 검수 뒤 본문이 바뀜(같은 revision, 다른 contentHash)');
      else defects.push(...reviewDefects(q, 'argon-blind', item));
    }
    return { questionId: q.id, revision: q.revision, contentHash: hash,
      status: defects.length ? 'defect' : pending.length ? 'pending' : 'pass', defects: [...new Set(defects)], pending };
  });
  return { items, batchDefects };
}

const PATTERNS = ['aaaa', 'bbbb', 'cccc', 'dddd', 'abcdabcd', 'dcbadcba'];
const PREFIXES = [...new Set(PATTERNS.flatMap(p => Array.from({ length: p.length }, (_, i) => p.slice(0, i))))].sort((a, b) => b.length - a.length);

/** 정답 분포·연속·순환 제약을 함께 풀어 바꾸는 문항 수를 최소화한다. 실패 상태를 기억하는 비용 제한 탐색. */
function minimumSequence(drafts: QuestionDraft[], mutable: boolean[]): OptionId[] {
  const n = drafts.length;
  const original = drafts.map(q => OPTION_IDS.indexOf(q.correctOptionId));
  const min = Math.floor(n * 0.16), max = Math.ceil(n * 0.34);
  const suffix = Array.from({ length: n + 1 }, () => [0, 0, 0, 0]);
  const locked = Array.from({ length: n + 1 }, () => [0, 0, 0, 0]);
  for (let i = n - 1; i >= 0; i--) {
    suffix[i] = [...suffix[i + 1]!]; locked[i] = [...locked[i + 1]!];
    suffix[i]![original[i]!]!++;
    if (!mutable[i]) locked[i]![original[i]!]!++;
  }
  const lowerBound = (i: number, counts: number[]) => Math.max(
    counts.reduce((sum, c, k) => sum + Math.max(0, c + suffix[i]![k]! - max), 0),
    counts.reduce((sum, c, k) => sum + Math.max(0, min - c - suffix[i]![k]!), 0),
  );
  // 잠긴 끝부분에 금지 패턴이 있으면 앞의 자유 문항 조합을 전부 탐색하지 않는다.
  const feasible = new Map<string, boolean>();
  const canFinish = (i: number, trail: string): boolean => {
    if (i === n) return true;
    const key = `${i}/${trail}`;
    if (feasible.has(key)) return feasible.get(key)!;
    const choices = mutable[i] ? [0, 1, 2, 3] : [original[i]!];
    const yes = choices.some(k => {
      const next = trail + OPTION_IDS[k]!;
      return !PATTERNS.some(p => next.endsWith(p)) && canFinish(i + 1, PREFIXES.find(p => next.endsWith(p))!);
    });
    feasible.set(key, yes);
    return yes;
  };
  if (!canFinish(0, '')) throw new Error('배치 엄격 결함을 관문 통과 문항 보존 조건으로 해소할 수 없다');
  const answer: number[] = [];
  for (let budget = lowerBound(0, [0, 0, 0, 0]); budget <= mutable.filter(Boolean).length; budget++) {
    const failed = new Set<string>();
    const search = (i: number, counts: number[], trail: string, left: number): boolean => {
      if (!canFinish(i, trail) || lowerBound(i, counts) > left || counts.some((c, k) => c + locked[i]![k]! > max || c + n - i < min)) return false;
      if (i === n) return counts.every(c => c >= min && c <= max);
      const key = `${i}/${counts.join(',')}/${trail}/${left}`;
      if (failed.has(key)) return false;
      const choices = [original[i]!, ...[0, 1, 2, 3].filter(k => k !== original[i]).sort((a, b) => counts[a]! - counts[b]!)];
      for (const k of choices) {
        const cost = Number(k !== original[i]);
        if (cost > left || (cost && !mutable[i]) || counts[k]! >= max) continue;
        const next = trail + OPTION_IDS[k]!;
        if (PATTERNS.some(p => next.endsWith(p))) continue;
        counts[k]!++; answer[i] = k;
        if (search(i + 1, counts, PREFIXES.find(p => next.endsWith(p))!, left - cost)) return true;
        counts[k]!--;
      }
      failed.add(key);
      return false;
    };
    if (search(0, [0, 0, 0, 0], '', budget)) return answer.map(k => OPTION_IDS[k]!);
  }
  throw new Error('배치 엄격 결함을 관문 통과 문항 보존 조건으로 해소할 수 없다');
}

/**
 * 입력은 변경하지 않는다. 배치 단위 결함(정답 분포·연속·순환)만 보기 이동으로 해소한다.
 * 문항 단위 결함은 앞단 판정이 다음 수정 회차로 넘기므로 여기서 막지 않는다. 그런 문항과 자체 반박이
 * 어긋난 문항, 관문 통과 문항은 옮기지 않는다. 배치 단위 결함이 남으면 결과를 반영하지 않는다.
 */
export function fixBatchStrict(drafts: QuestionDraft[], sidecar: DraftSidecar, gatePassed: Set<string>) {
  const result = { drafts: structuredClone(drafts), sidecar: structuredClone(sidecar), changed: [] as string[] };
  const isQuestionIssue = (s: string) => drafts.some(q => s.startsWith(`${q.id}: `));
  const before = lintBatchStrict(drafts);
  const defective = new Set(drafts.filter(q => before.some(s => s.startsWith(`${q.id}: `))).map(q => q.id));
  if (!before.some(s => !isQuestionIssue(s))) return result;
  const mutable = drafts.map(q => !gatePassed.has(`${q.id}@${q.revision}`) && !defective.has(q.id)
    && selfRefutationPasses(q, sidecar.items.find(s => s.id === q.id && s.revision === q.revision)));
  const seq = minimumSequence(drafts, mutable);
  result.drafts = result.drafts.map((q, index) => {
    const next = seq[index]!;
    const old = q.correctOptionId;
    if (next === old) return q;
    const remap = (id: OptionId): OptionId => id === old ? next : id === next ? old : id;
    const side = result.sidecar.items.find(s => s.id === q.id && s.revision === q.revision)!;
    q.options = q.options.map(o => ({ ...o, id: remap(o.id) })).sort((a, b) => a.id.localeCompare(b.id));
    q.distractorRationales = Object.fromEntries(Object.entries(q.distractorRationales).map(([id, reason]) => [remap(id as OptionId), reason]));
    q.correctOptionId = next;
    q.revision++;
    side.revision = q.revision;
    side.selfRefutation = side.selfRefutation.map(r => ({ ...r, optionId: remap(r.optionId) })).sort((a, b) => a.optionId.localeCompare(b.optionId));
    if (!selfRefutationPasses(q, side)) throw new Error(`${q.id}: 보기 재배열 뒤 자체 반박 불일치`);
    result.changed.push(`${q.id}@${q.revision}`);
    return q;
  });
  const after = lintBatchStrict(result.drafts).filter(s => !isQuestionIssue(s));
  if (after.length) throw new Error(`보기 재배열 뒤 엄격 검사 실패: ${after.join('; ')}`);
  return result;
}

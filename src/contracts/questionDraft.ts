import { z } from 'zod';
import { OPTION_IDS, QUESTION_TYPES } from './questions';

// docs/contracts/question-draft.schema.json(schemaVersion 0.2)과 같은 구조의 런타임 검사. 두 파일을 함께 바꾼다.
const sha = z.string().regex(/^[a-f0-9]{64}$/);

export const questionDraftSchema = z.object({
  schemaVersion: z.literal('0.2'),
  batchId: z.string().min(1),
  id: z.string().regex(/^g[3-6]-[a-z_-]+-[0-9]{4,}$/),
  revision: z.number().int().min(1),
  status: z.enum(['draft', 'machine_checked']),
  grade: z.number().int().min(3).max(6),
  gradeBasis: z.object({ reference: z.string().min(1), editionYear: z.number().int().min(2000), unit: z.string().min(1), reviewed: z.boolean() }).strict(),
  target: z.object({ lemma: z.string().min(1), partOfSpeech: z.string().min(1), senseKey: z.string().min(1) }).strict(),
  type: z.enum(QUESTION_TYPES),
  stem: z.string().min(1).max(500),
  options: z.array(z.object({ id: z.enum(OPTION_IDS), text: z.string().min(1).max(300) }).strict()).length(4),
  correctOptionId: z.enum(OPTION_IDS),
  explanation: z.string().min(1).max(700),
  distractorRationales: z.partialRecord(z.enum(OPTION_IDS), z.string().min(1)),
  source: z.object({
    provider: z.enum(['stdict', 'krdict']),
    entryId: z.string().min(1),
    senseId: z.string().min(1).nullable(),
    senseOrder: z.number().int().min(1).nullable(),
    url: z.url().regex(/^https:\/\//),
    retrievedAt: z.iso.datetime(),
    license: z.string().min(1),
    evidenceHash: sha,
    evidenceArtifactId: z.string().min(1),
  }).strict().refine(s => s.senseId !== null || s.senseOrder !== null, '의미 ID나 의미 번호 중 하나는 있어야 한다'),
  review: z.object({ reviewerId: z.null(), reviewedAt: z.null() }).strict(),
}).strict();

export const draftBatchSchema = z.array(questionDraftSchema).min(1).max(20);

/** 제작 sidecar: 스키마 밖 제작 정보는 여기에 둔다(PRD §10.2). */
export const draftSidecarSchema = z.object({
  batchId: z.string().min(1),
  jobId: z.string().min(1),
  producer: z.object({ model: z.string().min(1), tool: z.string().min(1), date: z.iso.date() }).strict(),
  items: z.array(z.object({
    id: z.string().min(1),
    revision: z.number().int().min(1),
    selfRefutation: z.array(z.object({ optionId: z.enum(OPTION_IDS), substituted: z.string().min(1), verdict: z.enum(['fits', 'does_not_fit']), reason: z.string().min(1) }).strict()).length(4),
    uniquenessNote: z.string().min(1),
    gradeEvidence: z.string().min(1),
  }).strict()),
  rejected: z.array(z.object({ lemma: z.string().min(1), reason: z.string().min(1) }).strict()),
}).strict();

/** 정답 키를 보지 않은 독립 검토 보고서(PRD §19.4, model_work_orders §10). */
export const blindReviewSchema = z.object({
  reviewId: z.string().min(1),
  jobId: z.string().min(1),
  reviewer: z.object({ model: z.string().min(1), tool: z.string().min(1), freshContext: z.literal(true), date: z.iso.date() }).strict(),
  items: z.array(z.object({
    questionId: z.string().min(1),
    revision: z.number().int().min(1),
    contentHash: sha,
    blindChoice: z.enum(['a', 'b', 'c', 'd', 'none', 'multiple']),
    verdicts: z.object({
      source: z.enum(['pass', 'fail', 'uncertain']),
      uniqueness: z.enum(['pass', 'fail', 'uncertain']),
      grade: z.enum(['pass', 'fail', 'uncertain']),
      language: z.enum(['pass', 'fail', 'uncertain']),
      explanation: z.enum(['pass', 'fail', 'uncertain']),
    }).strict(),
    findings: z.array(z.string()),
  }).strict()).min(1),
}).strict();

/**
 * 총괄의 해설 대조(정답 키를 보는 단계). 독립 검토자가 uncertain으로 비워 둔 explanation 판정을 채운다(QR-001 승인 규칙).
 * 해설과 오답 이유를 함께 보므로, contentHash에 없는 오답 이유는 rationalesHash로 묶는다.
 */
export const explanationReviewSchema = z.object({
  batchId: z.string().min(1),
  reviewer: z.object({ model: z.string().min(1), role: z.literal('commander'), date: z.iso.date() }).strict(),
  items: z.array(z.object({
    questionId: z.string().min(1),
    revision: z.number().int().min(1),
    contentHash: sha,
    rationalesHash: sha,
    explanation: z.enum(['pass', 'fail']),
    findings: z.array(z.string()),
  }).strict()).min(1),
}).strict();

export type QuestionDraft = z.infer<typeof questionDraftSchema>;
export type ExplanationReview = z.infer<typeof explanationReviewSchema>;
export type DraftSidecar = z.infer<typeof draftSidecarSchema>;
export type BlindReview = z.infer<typeof blindReviewSchema>;

/** 채점에 필요한 정규화 문항의 해시 입력(PRD §10.2 contentHash). 키 순서·NFC를 고정한다. */
export function contentHashInput(q: Pick<QuestionDraft, 'id' | 'revision' | 'type' | 'target' | 'stem' | 'options' | 'correctOptionId' | 'explanation'>): string {
  const n = (t: string) => t.normalize('NFC');
  return JSON.stringify({
    id: q.id, revision: q.revision, type: q.type,
    target: { lemma: n(q.target.lemma), partOfSpeech: n(q.target.partOfSpeech), senseKey: n(q.target.senseKey) },
    stem: n(q.stem),
    options: [...q.options].sort((a, b) => a.id.localeCompare(b.id)).map(o => ({ id: o.id, text: n(o.text) })),
    correctOptionId: q.correctOptionId,
    explanation: n(q.explanation),
  });
}

/** 해설 대조가 함께 본 오답 이유의 해시 입력. 보기 ID 순서로 고정한다. */
export function rationalesHashInput(q: Pick<QuestionDraft, 'distractorRationales'>): string {
  return JSON.stringify(Object.keys(q.distractorRationales).sort().map(id => [id, q.distractorRationales[id as keyof typeof q.distractorRationales]!.normalize('NFC')]));
}

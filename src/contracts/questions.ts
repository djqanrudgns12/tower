import { z } from 'zod';

// 런타임 문제은행 형식. 승인 게시본은 status=published, 개발 중 연결 시험용은 status=dev_fixture다(PRD §9.3, §10.2).
// 제작 초안은 docs/contracts/question-draft.schema.json을 따른다. 이 스키마로 초안을 받지 않는다.
export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
export type OptionId = (typeof OPTION_IDS)[number];

export const QUESTION_TYPES = ['definition', 'cloze', 'synonym_context', 'antonym_context', 'usage'] as const;

export const bankQuestionSchema = z.object({
  id: z.string().regex(/^g[3-6]-[a-z_-]+-[0-9]{4,}$/),
  revision: z.number().int().min(1),
  status: z.enum(['published', 'dev_fixture']),
  grade: z.number().int().min(3).max(6),
  type: z.enum(QUESTION_TYPES),
  target: z.object({ lemma: z.string().min(1), partOfSpeech: z.string().min(1), senseKey: z.string().min(1) }),
  stem: z.string().min(1).max(200),
  options: z.array(z.object({ id: z.enum(OPTION_IDS), text: z.string().min(1).max(120) })).length(4),
  correctOptionId: z.enum(OPTION_IDS),
  explanation: z.string().min(1).max(120),
  distractorRationales: z.partialRecord(z.enum(OPTION_IDS), z.string().min(1).max(80)),
}).strict().superRefine((q, ctx) => {
  const ids = q.options.map(o => o.id);
  const texts = q.options.map(o => o.text.normalize('NFC').trim());
  if (new Set(ids).size !== 4) ctx.addIssue({ code: 'custom', message: `${q.id}: 보기 ID 중복` });
  if (new Set(texts).size !== 4) ctx.addIssue({ code: 'custom', message: `${q.id}: 보기 글 중복` });
  if (!ids.includes(q.correctOptionId)) ctx.addIssue({ code: 'custom', message: `${q.id}: 정답 ID가 보기에 없음` });
  const wrong = ids.filter(id => id !== q.correctOptionId).sort();
  const keys = Object.keys(q.distractorRationales).sort();
  if (JSON.stringify(wrong) !== JSON.stringify(keys)) ctx.addIssue({ code: 'custom', message: `${q.id}: 오답 이유는 오답 3개에 정확히 하나씩` });
  if (!q.id.startsWith(`g${q.grade}-`)) ctx.addIssue({ code: 'custom', message: `${q.id}: 학년과 ID 불일치` });
});

export const bankFileSchema = z.object({
  bankId: z.string().min(1),
  bankVersion: z.string().min(1),
  grade: z.number().int().min(3).max(6),
  status: z.enum(['published', 'dev_fixture']),
  note: z.string().optional(),
  questions: z.array(bankQuestionSchema).min(1),
}).strict().superRefine((b, ctx) => {
  if (new Set(b.questions.map(q => q.id)).size !== b.questions.length) ctx.addIssue({ code: 'custom', message: '문항 ID 중복' });
  for (const q of b.questions) if (q.grade !== b.grade || q.status !== b.status) ctx.addIssue({ code: 'custom', message: `${q.id}: 은행의 학년·상태와 다름` });
});

/**
 * 긴급 철회 목록(PRD §9.5, §16.4). 실행 중 은행을 덮어쓰지 않고 버전이 붙은 별도 목록으로 겹쳐 적용한다.
 * 이미 끝난 답변은 소급 변경하지 않는다. 걸려 있던 미제출 문항만 무벌점·무보상으로 바뀐다.
 */
export const retractionListSchema = z.object({
  listVersion: z.string().min(1),
  entries: z.array(z.object({
    questionId: z.string().min(1),
    revision: z.number().int().min(1),
    reason: z.string().min(1),
    retractedAt: z.iso.datetime(),
  }).strict()),
}).strict().superRefine((list, ctx) => {
  const keys = list.entries.map(e => `${e.questionId}@${e.revision}`);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: '철회 항목 중복' });
});

export type RetractionList = z.infer<typeof retractionListSchema>;
export type BankQuestion = z.infer<typeof bankQuestionSchema>;
export type BankFile = z.infer<typeof bankFileSchema>;

/** 지문+보기 4개의 한글 음절 수(PRD §9.2 readingLoad). */
export function readingLoad(q: Pick<BankQuestion, 'stem' | 'options'>): number {
  const text = q.stem + q.options.map(o => o.text).join('');
  return (text.normalize('NFC').match(/[가-힣]/g) ?? []).length;
}

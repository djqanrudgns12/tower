import { z } from 'zod';

// 런타임 문제은행 형식. 승인 게시본은 status=published, 개발 중 연결 시험용은 status=dev_fixture다(PRD §9.3, §10.2).
// 제작 초안은 docs/contracts/question-draft.schema.json을 따른다. 이 스키마로 초안을 받지 않는다.
export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
export type OptionId = (typeof OPTION_IDS)[number];

export const QUESTION_TYPES = ['definition', 'cloze', 'synonym_context', 'antonym_context', 'usage'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTY_TIERS = ['basic', 'core', 'advanced', 'challenge'] as const;
export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number];

export const VARIANT_TAGS = ['standard', 'polysemy', 'confusable', 'idiom_proverb', 'dialect'] as const;
export type VariantTag = (typeof VARIANT_TAGS)[number];

export const DIALECT_REGIONS = ['강원', '경기', '경상', '전라', '충청', '제주', '공통'] as const;
export type DialectRegion = (typeof DIALECT_REGIONS)[number];

const difficultyGateRuleSchema = z.object({
  allowedTiers: z.array(z.enum(DIFFICULTY_TIERS)).min(1),
  allowedVariants: z.array(z.enum(VARIANT_TAGS)).min(1),
});
/** 계약 `questionSelection.difficultyGate`(PRD §9.1). 설명용 note 키는 버린다. */
export const difficultyGateSchema = z.object({
  Easy: difficultyGateRuleSchema,
  Normal: difficultyGateRuleSchema,
  Hard: difficultyGateRuleSchema,
  Crazy: difficultyGateRuleSchema,
});

export const BANK_STATUSES = ['published', 'verified_candidate', 'dev_fixture'] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];

export const bankQuestionSchema = z.object({
  id: z.string().regex(/^g[3-6]-[a-z_-]+-[0-9]{4,}$/),
  revision: z.number().int().min(1),
  status: z.enum(BANK_STATUSES),
  grade: z.number().int().min(3).max(6),
  type: z.enum(QUESTION_TYPES),
  difficultyTier: z.enum(DIFFICULTY_TIERS).optional(),
  variantTag: z.enum(VARIANT_TAGS).optional(),
  dialectRegion: z.enum(DIALECT_REGIONS).optional(),
  target: z.object({ lemma: z.string().min(1), partOfSpeech: z.string().min(1), senseKey: z.string().min(1) }),
  stem: z.string().min(1).max(200),
  options: z.array(z.object({ id: z.enum(OPTION_IDS), text: z.string().min(1).max(120) })).length(4),
  correctOptionId: z.enum(OPTION_IDS),
  explanation: z.string().min(1).max(120),
  distractorRationales: z.partialRecord(z.enum(OPTION_IDS), z.string().min(1).max(80)),
}).strict().superRefine((q, ctx) => {
  const o0 = q.options[0]!, o1 = q.options[1]!, o2 = q.options[2]!, o3 = q.options[3]!;
  const id0 = o0.id, id1 = o1.id, id2 = o2.id, id3 = o3.id;
  const uniqueIds = id0 !== id1 && id0 !== id2 && id0 !== id3 && id1 !== id2 && id1 !== id3 && id2 !== id3;
  if (!uniqueIds) ctx.addIssue({ code: 'custom', message: `${q.id}: 보기 ID 중복` });
  const t0 = o0.text.normalize('NFC').trim();
  const t1 = o1.text.normalize('NFC').trim();
  const t2 = o2.text.normalize('NFC').trim();
  const t3 = o3.text.normalize('NFC').trim();
  if (t0 === t1 || t0 === t2 || t0 === t3 || t1 === t2 || t1 === t3 || t2 === t3) {
    ctx.addIssue({ code: 'custom', message: `${q.id}: 보기 글 중복` });
  }
  const c = q.correctOptionId;
  if (id0 !== c && id1 !== c && id2 !== c && id3 !== c) {
    ctx.addIssue({ code: 'custom', message: `${q.id}: 정답 ID가 보기에 없음` });
  }
  const rKeys = Object.keys(q.distractorRationales);
  if (uniqueIds) {
    if (rKeys.length !== 3 || Object.prototype.hasOwnProperty.call(q.distractorRationales, c)) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: 오답 이유는 오답 3개에 정확히 하나씩` });
    }
  } else {
    const wrong = [id0, id1, id2, id3].filter(id => id !== c).sort();
    rKeys.sort();
    if (JSON.stringify(wrong) !== JSON.stringify(rKeys)) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: 오답 이유는 오답 3개에 정확히 하나씩` });
    }
  }
  if (!q.id.startsWith(`g${q.grade}-`)) ctx.addIssue({ code: 'custom', message: `${q.id}: 학년과 ID 불일치` });
  if (q.variantTag === 'dialect' && !q.dialectRegion) ctx.addIssue({ code: 'custom', message: `${q.id}: 방언 문항은 dialectRegion 필수` });
  if (q.variantTag === 'dialect' && q.difficultyTier !== 'challenge') ctx.addIssue({ code: 'custom', message: `${q.id}: 방언 문항은 difficultyTier=challenge 필수` });
  if (q.dialectRegion && q.variantTag !== 'dialect') ctx.addIssue({ code: 'custom', message: `${q.id}: dialectRegion은 variantTag=dialect일 때만 허용` });
});

export const bankFileSchema = z.object({
  bankId: z.string().min(1),
  bankVersion: z.string().min(1),
  grade: z.number().int().min(3).max(6),
  status: z.enum(BANK_STATUSES),
  note: z.string().optional(),
  questions: z.array(bankQuestionSchema).min(1),
}).strict().superRefine((b, ctx) => {
  const seen = new Set<string>();
  let dup = false;
  for (const q of b.questions) {
    if (seen.has(q.id)) dup = true;
    else seen.add(q.id);
  }
  if (dup) ctx.addIssue({ code: 'custom', message: '문항 ID 중복' });
  for (const q of b.questions) if (q.grade !== b.grade || q.status !== b.status) ctx.addIssue({ code: 'custom', message: `${q.id}: 은행의 학년·상태와 다름` });
});

/** 공개 학년 은행의 공유 계약. 개발·후보·연습 은행은 위의 자기 학년 전용 계약을 쓴다. */
export const sharedBankQuestionSchema = bankQuestionSchema.safeExtend({
  gradeBand: z.object({ min: z.number().int().min(3).max(6), max: z.number().int().min(3).max(6) }).strict().optional(),
}).superRefine((q, ctx) => {
  const band = q.gradeBand;
  if (band && (band.min > q.grade || band.max < q.grade || band.min < q.grade - 1 || band.max > q.grade + 1)) {
    ctx.addIssue({ code: 'custom', message: `${q.id}: 공유 학년 띠는 원학년을 포함한 인접 학년 범위여야 한다` });
  }
});

export const sharedBankFileSchema = z.object({
  ...bankFileSchema.shape,
  questions: z.array(sharedBankQuestionSchema).min(1),
}).strict().superRefine((bank, ctx) => {
  const seen = new Set<string>();
  const shared: z.infer<typeof sharedBankQuestionSchema>[] = [];
  let dup = false;
  let own = 0;
  for (const q of bank.questions) {
    if (seen.has(q.id)) dup = true;
    else seen.add(q.id);
    if (q.grade !== bank.grade) shared.push(q);
    else if (!/^g[3-6]-practice-/.test(q.id)) own++;
  }
  if (dup) ctx.addIssue({ code: 'custom', message: '문항 ID 중복' });
  for (const q of bank.questions) if (q.status !== bank.status) ctx.addIssue({ code: 'custom', message: `${q.id}: 은행의 상태와 다름` });
  if (!shared.length) return;
  if (bank.status !== 'published' || bank.bankId !== `g${bank.grade}`) {
    ctx.addIssue({ code: 'custom', message: '공유 문항은 공개 학년 은행에만 수록한다' });
  }
  if (own < 1000) ctx.addIssue({ code: 'custom', message: '공유 전에 자기 학년 승인 1000문항이 필요하다' });
  if (shared.length > Math.floor(own * 24 / 100)) ctx.addIssue({ code: 'custom', message: '위로 공유 상한 24%를 넘었다' });
  for (const q of shared) {
    if (q.grade + 1 !== bank.grade || /^g[3-6]-practice-/.test(q.id)) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: 정규 문항을 바로 위 학년으로만 공유할 수 있다` });
    }
    if (!q.gradeBand || bank.grade < q.gradeBand.min || bank.grade > q.gradeBand.max) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: 받는 학년을 포함한 공유 학년 띠가 필요하다` });
    }
  }
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
export type SharedBankQuestion = z.infer<typeof sharedBankQuestionSchema>;
export type SharedBankFile = z.infer<typeof sharedBankFileSchema>;

/** 본문을 내려받기 전 공개 여부와 판 번호를 확인하는 작은 목록. */
export const bankManifestSchema = z.object({
  schemaVersion: z.literal('1'),
  banks: z.array(z.object({
    grade: z.number().int().min(3).max(6), bankId: z.string().min(1), bankVersion: z.string().min(1),
    questionCount: z.number().int().min(30), ownCount: z.number().int().min(30), sharedCount: z.number().int().min(0),
  }).strict()).max(4),
}).strict().superRefine((manifest, ctx) => {
  if (new Set(manifest.banks.map(bank => bank.grade)).size !== manifest.banks.length) ctx.addIssue({ code: 'custom', message: '공개 학년 중복' });
  for (const bank of manifest.banks) {
    if (bank.bankId !== `g${bank.grade}` || bank.questionCount !== bank.ownCount + bank.sharedCount) ctx.addIssue({ code: 'custom', message: '은행 목록의 학년·문항 수 불일치' });
    if (bank.sharedCount && (bank.ownCount < 1000 || bank.sharedCount > Math.floor(bank.ownCount * .24))) ctx.addIssue({ code: 'custom', message: '은행 목록의 공유 하한·상한 위반' });
  }
});
export type BankManifest = z.infer<typeof bankManifestSchema>;

/** 지문+보기 4개의 한글 음절 수(PRD §9.2 readingLoad). */
export function readingLoad(q: Pick<BankQuestion, 'stem' | 'options'>): number {
  let text = q.stem;
  for (let i = 0; i < q.options.length; i++) text += q.options[i]!.text;
  const s = text.normalize('NFC');
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) count++;
  }
  return count;
}

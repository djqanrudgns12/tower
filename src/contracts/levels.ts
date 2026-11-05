import { z } from 'zod';
import { DIFFICULTY_TIERS } from './questions';

/** CR-1000 §3. 점수 계약은 초안 계약과 분리하고, 합의가 있는 revision에만 적용한다. */
export const LEVEL_RUBRIC_VERSION = 'lv1' as const;
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const score = z.number().int().min(0).max(3);
const grade = z.number().int().min(3).max(6);
const identity = {
  questionId: z.string().regex(/^g[3-6]-[a-z_-]+-[0-9]{4,}$/),
  revision: z.number().int().min(1),
  contentHash: sha,
};

export const levelJudgeSchema = z.object({
  ...identity,
  judge: z.enum(['argon', 'codex']),
  model: z.string().trim().min(1),
  L1: score,
  L2: score,
  T1: score,
  inference: z.union([z.literal(0), z.literal(1)]),
  idiomOpacity: z.union([z.literal(2), z.literal(3), z.null()]),
  elementaryFit: z.enum(['pass', 'too_low', 'too_high']),
  basisType: z.enum(['corpus_graded', 'curriculum_explicit', 'stdict_structural', 'rubric_inferred']),
  unit: z.string().trim().min(1),
  reason: z.string().trim().min(1),
}).strict();

export const levelPrecomputedSchema = z.object({
  typeBase: z.number().int().min(0).max(2),
  lengthBump: z.number().int().min(0).max(2),
  /** 관용구는 판정자가 정하므로 null. 나머지는 변형 기본점이다. */
  t3Base: score.nullable(),
  readingLoad: z.number().int().min(0),
  krdictGrade: z.enum(['초급', '중급', '고급']).nullable(),
  stdictSpecialized: z.boolean(),
}).strict();

/** 앞단은 elementaryFit·stdictSpecialized·too_hard를 수정 대상으로 처리한다. */
export const LEVEL_FLAGS = ['too_easy', 'too_hard', 'long_basic', 'elementaryFit', 'stdictSpecialized', 'spotCheck'] as const;
export const levelMergedSchema = z.object({
  rule: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  L: z.number().int().min(0).max(6),
  T: z.number().int().min(0).max(9),
  V: z.number().int().min(0).max(21),
  ownTier: z.enum(DIFFICULTY_TIERS),
  band: z.object({ min: grade, max: grade }).strict(),
  flags: z.array(z.enum(LEVEL_FLAGS)),
}).strict().superRefine((value, ctx) => {
  if (value.V !== 2 * value.L + value.T) ctx.addIssue({ code: 'custom', message: 'V는 2L+T여야 한다' });
  if (value.band.min > value.band.max) ctx.addIssue({ code: 'custom', message: '학년 띠의 min은 max 이하여야 한다' });
  if (new Set(value.flags).size !== value.flags.length) ctx.addIssue({ code: 'custom', message: '수준 표시 중복' });
});

export const levelAssessmentSchema = z.object({
  ...identity,
  precomputed: levelPrecomputedSchema,
  judges: z.array(levelJudgeSchema).length(2),
  merged: levelMergedSchema,
  levelAssessmentHash: sha,
}).strict().superRefine((item, ctx) => {
  if (new Set(item.judges.map(j => j.judge)).size !== 2) ctx.addIssue({ code: 'custom', message: 'Argon·Codex 판정이 각각 하나여야 한다' });
  for (const judge of item.judges) {
    if (judge.questionId !== item.questionId || judge.revision !== item.revision || judge.contentHash !== item.contentHash) {
      ctx.addIssue({ code: 'custom', message: '판정자는 같은 문항·revision·본문 해시를 보아야 한다' });
    }
    if ((item.precomputed.t3Base === null) !== (judge.idiomOpacity !== null)) {
      ctx.addIssue({ code: 'custom', message: '관용구만 불투명도 판정이 있어야 한다' });
    }
  }
  const ownGrade = Number(item.questionId[1]);
  const { min, max } = item.merged.band;
  if (min > ownGrade || max < ownGrade || min < ownGrade - 1 || max > ownGrade + 1) {
    ctx.addIssue({ code: 'custom', message: '학년 띠는 자기 학년을 포함한 인접 학년 이내여야 한다' });
  }
  if (item.merged.rule !== 3 && (min !== ownGrade || max !== ownGrade)) {
    ctx.addIssue({ code: 'custom', message: '자동 확정 외에는 자기 학년만 허용한다' });
  }
});

/** content-source/levels/<batchId>.json. 실제 파일 쓰기는 잠금 적용기가 맡는다. */
export const levelBatchSchema = z.object({
  batchId: z.string().min(1),
  rubricVersion: z.literal(LEVEL_RUBRIC_VERSION),
  items: z.array(levelAssessmentSchema),
}).strict().superRefine((batch, ctx) => {
  const keys = batch.items.map(item => `${item.questionId}@${item.revision}`);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: '문항·revision 수준 판정 중복' });
});

export type LevelJudge = z.infer<typeof levelJudgeSchema>;
export type LevelPrecomputed = z.infer<typeof levelPrecomputedSchema>;
export type LevelFlag = (typeof LEVEL_FLAGS)[number];
export type LevelMerged = z.infer<typeof levelMergedSchema>;
export type LevelAssessment = z.infer<typeof levelAssessmentSchema>;
export type LevelBatch = z.infer<typeof levelBatchSchema>;

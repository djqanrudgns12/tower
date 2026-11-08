import { createHash } from 'node:crypto';
import { GRADE_BATTLE_READING_LOAD } from '../../src/content/lint';
import {
  LEVEL_RUBRIC_VERSION, levelAssessmentSchema, levelJudgeSchema, levelPrecomputedSchema,
} from '../../src/contracts/levels';
import type { LevelAssessment, LevelFlag, LevelJudge, LevelMerged, LevelPrecomputed } from '../../src/contracts/levels';
import { contentHashInput } from '../../src/contracts/questionDraft';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import { DIFFICULTY_TIERS, readingLoad } from '../../src/contracts/questions';
import type { DifficultyTier, QuestionType, VariantTag } from '../../src/contracts/questions';

/** 이 모듈은 입출력·모델 호출을 하지 않는다. 사전 조회 결과는 실행기가 읽어 넘긴다. */
export type LevelQuestion = Pick<QuestionDraft, 'grade' | 'type' | 'variantTag' | 'stem' | 'options'>;
export type LevelEvidence = Partial<Pick<LevelPrecomputed, 'krdictGrade' | 'stdictSpecialized'>>;
export interface LevelScores { L: number; T: number; V: number }
export type GradeBand = LevelMerged['band'];

const TYPE_BASE: Record<QuestionType, number> = { definition: 0, cloze: 0, synonym_context: 1, antonym_context: 1, usage: 2 };
const T3_BASE: Record<VariantTag, number | null> = { standard: 0, polysemy: 1, confusable: 2, idiom_proverb: null, dialect: 3 };
const VARIANT_FLOOR: Record<VariantTag, DifficultyTier> = { standard: 'basic', polysemy: 'core', confusable: 'core', idiom_proverb: 'advanced', dialect: 'challenge' };

/** 조회 불가인 기초사전 등급은 null, 전문 분야 표지가 확인된 경우에만 true로 입력한다. */
export function precompute(q: LevelQuestion, evidence: LevelEvidence = {}): LevelPrecomputed {
  const load = readingLoad(q);
  return levelPrecomputedSchema.parse({
    typeBase: TYPE_BASE[q.type],
    lengthBump: load <= 65 ? 0 : load <= 85 ? 1 : 2,
    t3Base: T3_BASE[q.variantTag ?? 'standard'],
    readingLoad: load,
    krdictGrade: evidence.krdictGrade ?? null,
    stdictSpecialized: evidence.stdictSpecialized ?? false,
  });
}

export function judgeScores(precomputed: LevelPrecomputed, judge: LevelJudge): LevelScores {
  const p = levelPrecomputedSchema.parse(precomputed);
  const j = levelJudgeSchema.parse(judge);
  if ((p.t3Base === null) !== (j.idiomOpacity !== null)) throw new Error('관용구만 불투명도 2/3 판정이 필요하다');
  const L = j.L1 + j.L2;
  const T2 = Math.min(3, p.typeBase + p.lengthBump + j.inference);
  const T = j.T1 + T2 + (p.t3Base ?? j.idiomOpacity!);
  return { L, T, V: 2 * L + T };
}

export const relativeDifficulty = (grade: number, L: number, T: number): number => 2 * L + T - 4 * (grade - 3);

/** R → 변형 하한 → basic 읽기량 순서. 너무 쉬움·어려움도 자기 학년에서 버리지 않는다. */
export function tierForGrade(grade: number, L: number, T: number, variant: VariantTag, load: number): { tier: DifficultyTier; flags: LevelFlag[] } {
  const R = relativeDifficulty(grade, L, T);
  const flags: LevelFlag[] = R < 0 ? ['too_easy'] : R > 9 ? ['too_hard'] : [];
  let tier: DifficultyTier = R <= 1 ? 'basic' : R <= 4 ? 'core' : R <= 6 ? 'advanced' : 'challenge';
  const floor = VARIANT_FLOOR[variant];
  if (DIFFICULTY_TIERS.indexOf(tier) < DIFFICULTY_TIERS.indexOf(floor)) tier = floor;
  if (tier === 'basic' && load > (GRADE_BATTLE_READING_LOAD[grade] ?? 70) + 12) {
    tier = 'core';
    flags.push('long_basic');
  }
  return { tier, flags };
}

/** §3.2·3.4의 점수상 후보. 실제 공유의 읽기량·출처·Claude 확인·수량 제한은 W5가 적용한다. */
export function candidateBand(grade: number, L: number, T: number): GradeBand {
  const lower = grade > 3 && L % 2 === 1 && T >= 5 && relativeDifficulty(grade - 1, L, T) <= 9;
  const upper = grade < 6 && relativeDifficulty(grade + 1, L, T) >= 0;
  return { min: lower ? grade - 1 : grade, max: upper ? grade + 1 : grade };
}

/** §3.3 규칙 선택용 띠. too_easy/too_hard를 자기 학년으로 보정하기 전에 교집합을 검사한다. */
function scoreGrades(grade: number, scores: LevelScores): number[] {
  return [grade - 1, grade, grade + 1].filter(g => g >= 3 && g <= 6
    && relativeDifficulty(g, scores.L, scores.T) >= 0 && relativeDifficulty(g, scores.L, scores.T) <= 9);
}

/** 키 순서에 영향받지 않는 JSON. 배열 순서는 의미가 있으므로 호출부에서 집합만 정렬한다. */
function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJSON(child)}`).join(',')}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('수준 해시에는 JSON 값만 쓸 수 있다');
  return result;
}

/** 순서대로 처음 맞는 규칙 하나만 적용한다. 판정자 순서가 바뀌어도 결과는 같다. */
export function merge(q: LevelQuestion, a: LevelJudge, c: LevelJudge, precomputed: LevelPrecomputed = precompute(q)): LevelMerged {
  const A = levelJudgeSchema.parse(a);
  const C = levelJudgeSchema.parse(c);
  if (A.judge === C.judge || A.questionId !== C.questionId || A.revision !== C.revision || A.contentHash !== C.contentHash) {
    throw new Error('같은 문항·revision·해시의 서로 다른 두 판정자(Argon과 Codex 또는 Claude) 판정이 각각 필요하다');
  }
  const p = levelPrecomputedSchema.parse(precomputed);
  if (canonicalJSON(p) !== canonicalJSON(precompute(q, p))) throw new Error('사전 계산이 문항과 일치하지 않는다');
  const sa = judgeScores(p, A);
  const sc = judgeScores(p, C);
  const deltaL = Math.abs(sa.L - sc.L);
  const deltaT = Math.abs(sa.T - sc.T);
  const bandC = scoreGrades(q.grade, sc);
  const intersection = scoreGrades(q.grade, sa).filter(g => bandC.includes(g));
  const axesClose = (['L1', 'L2', 'T1', 'inference', 'idiomOpacity'] as const)
    .every(axis => Math.abs((A[axis] ?? 0) - (C[axis] ?? 0)) <= 1);
  let rule: LevelMerged['rule'];
  if (A.elementaryFit !== 'pass' || C.elementaryFit !== 'pass') rule = 1;
  else if (deltaL >= 3 || deltaT >= 3 || intersection.length === 0) rule = 2;
  else if (axesClose && deltaL <= 1 && deltaT <= 1) rule = 3;
  else rule = 4;

  const L = rule === 3 ? Math.ceil((sa.L + sc.L) / 2) : Math.max(sa.L, sc.L);
  const T = rule <= 2 ? Math.max(sa.T, sc.T) : Math.ceil((sa.T + sc.T) / 2);
  const own = tierForGrade(q.grade, L, T, q.variantTag ?? 'standard', p.readingLoad);
  const flags = [...own.flags];
  if (rule === 1) flags.push('elementaryFit');
  if (p.stdictSpecialized) flags.push('stdictSpecialized');
  if (rule === 4) flags.push('spotCheck');
  let band: GradeBand = { min: q.grade, max: q.grade };
  if (rule === 3) {
    const candidates = candidateBand(q.grade, L, T);
    const shared = intersection.filter(g => g >= candidates.min && g <= candidates.max);
    // 자기 학년은 R 범위를 벗어나도 유지한다. 인접 학년은 두 판정이 모두 허용해야 한다.
    band = { min: Math.min(q.grade, ...shared), max: Math.max(q.grade, ...shared) };
  }
  return { rule, L, T, V: 2 * L + T, ownTier: own.tier, band, flags };
}

export interface LevelHashInput {
  rubricVersion: typeof LEVEL_RUBRIC_VERSION;
  contentHash: string;
  precomputed: LevelPrecomputed;
  judges: readonly LevelJudge[];
  merged: LevelMerged;
}

/** 점수뿐 아니라 모델·학년 근거도 묶는다. contentHash 자체가 문항 ID와 revision을 포함한다. */
export function levelAssessmentHash(input: LevelHashInput): string {
  const value = {
    rubricVersion: input.rubricVersion,
    contentHash: input.contentHash,
    precomputed: input.precomputed,
    judges: [...input.judges].sort((a, b) => a.judge < b.judge ? -1 : a.judge > b.judge ? 1 : 0),
    merged: { ...input.merged, flags: [...input.merged.flags].sort() },
  };
  return createHash('sha256').update(canonicalJSON(value)).digest('hex');
}

const questionHash = (q: QuestionDraft) => createHash('sha256').update(contentHashInput(q)).digest('hex');

/** 실행기는 반환값을 배치 계약으로 감싸 staging에 쓴다. 이 함수는 파일을 쓰지 않는다. */
export function assessLevel(q: QuestionDraft, a: LevelJudge, c: LevelJudge, evidence: LevelEvidence = {}): LevelAssessment {
  const hash = questionHash(q);
  const judges = [levelJudgeSchema.parse(a), levelJudgeSchema.parse(c)].sort((a, b) => a.judge < b.judge ? -1 : 1);
  for (const j of judges) {
    if (j.questionId !== q.id || j.revision !== q.revision || j.contentHash !== hash) throw new Error('판정의 문항·revision·본문 해시가 현재 초안과 다르다');
  }
  const precomputed = precompute(q, evidence);
  const merged = merge(q, judges[0]!, judges[1]!, precomputed);
  return levelAssessmentSchema.parse({
    questionId: q.id, revision: q.revision, contentHash: hash, precomputed, judges, merged,
    levelAssessmentHash: levelAssessmentHash({ rubricVersion: LEVEL_RUBRIC_VERSION, contentHash: hash, precomputed, judges, merged }),
  });
}

/** 앞단·공유 수록은 저장값을 신뢰하기 전에 현재 본문과 계산 결과를 다시 대조한다. */
export function isCurrentLevelAssessment(q: QuestionDraft, input: unknown): input is LevelAssessment {
  const parsed = levelAssessmentSchema.safeParse(input);
  if (!parsed.success) return false;
  const item = parsed.data;
  if (item.questionId !== q.id || item.revision !== q.revision || item.contentHash !== questionHash(q)) return false;
  // grade·variantTag는 본문 해시 밖이다. 재판정 전에 이 입력의 일치 여부부터 검사한다.
  if (q.grade !== Number(q.id[1]) || canonicalJSON(precompute(q, item.precomputed)) !== canonicalJSON(item.precomputed)) return false;
  const expected = assessLevel(q, item.judges[0]!, item.judges[1]!, item.precomputed);
  return canonicalJSON(expected.precomputed) === canonicalJSON(item.precomputed)
    && canonicalJSON(expected.merged) === canonicalJSON(item.merged)
    && expected.levelAssessmentHash === item.levelAssessmentHash;
}

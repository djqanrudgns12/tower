import type { Balance, DifficultyConfig, DifficultyId } from '../contracts/balance';
import type { MapConfig } from '../contracts/maps';
import type { BankQuestion, DifficultyTier, VariantTag } from '../contracts/questions';
import { buildPath, type PathGeometry } from './geometry';

export interface RuntimeQuestion extends BankQuestion { readingLoad: number }

/** 난이도별 출제 허용 범위(계약 `questionSelection.difficultyGate`). */
export interface DifficultyGateRule { allowedTiers: readonly DifficultyTier[]; allowedVariants: readonly VariantTag[] }
export type DifficultyGate = Record<DifficultyId, DifficultyGateRule>;

/**
 * PRD §9.1: 쉬움·보통은 도전 단계와 관용구·속담·혼동 어휘·방언을 내지 않고, 어려움·아주 어려움만 낸다.
 * 표지가 없는 문항(초기 3학년 공개 은행)은 핵심(core)·표준(standard)으로 본다.
 */
export function isQuestionEligibleForDifficulty(
  q: Pick<BankQuestion, 'difficultyTier' | 'variantTag'>,
  difficulty: DifficultyId,
  gate: DifficultyGate,
): boolean {
  const rule = gate[difficulty];
  return rule.allowedTiers.includes(q.difficultyTier ?? 'core') && rule.allowedVariants.includes(q.variantTag ?? 'standard');
}

/** 한 판 동안 바뀌지 않는 콘텐츠 묶음. 상태(RunState)와 분리해 상태 크기를 줄인다. */
export interface GameContext {
  balance: Balance;
  difficultyId: DifficultyId;
  difficulty: DifficultyConfig;
  map: MapConfig;
  path: PathGeometry;
  questions: ReadonlyMap<string, RuntimeQuestion>;
  questionIds: readonly string[];
  battleReadingLoadMax: number;
  tierSchedule?: readonly DifficultyTier[] | undefined;
}

export function createContext(input: {
  balance: Balance;
  difficulty: DifficultyId;
  map: MapConfig;
  questions: readonly RuntimeQuestion[];
  battleReadingLoadMax: number;
  tierSchedule?: readonly DifficultyTier[] | undefined;
}): GameContext {
  if (input.questions.length === 0) throw new Error('승인 문항이 없다');
  const questions = new Map(input.questions.map(q => [q.id, q] as const));
  return {
    balance: input.balance,
    difficultyId: input.difficulty,
    difficulty: input.balance.difficulties[input.difficulty],
    map: input.map,
    path: buildPath(input.map),
    questions,
    questionIds: [...questions.keys()].sort(),
    battleReadingLoadMax: input.battleReadingLoadMax,
    ...(input.tierSchedule ? { tierSchedule: input.tierSchedule } : {}),
  };
}

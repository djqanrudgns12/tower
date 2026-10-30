import type { Balance, DifficultyConfig, DifficultyId } from '../contracts/balance';
import type { MapConfig } from '../contracts/maps';
import type { BankQuestion, DifficultyTier } from '../contracts/questions';
import { buildPath, type PathGeometry } from './geometry';

export interface RuntimeQuestion extends BankQuestion { readingLoad: number }

/**
 * 4단계 난이도별 출제 허용 게이트.
 * - 쉬움(Easy): 기초(basic)·핵심(core) 표준어만 허용(심화 함정·도전·방언 원천 차단).
 * - 보통(Normal): 기초(basic)·핵심(core)·심화(advanced) 표준어·다의어·혼동쌍 허용(도전·방언 원천 차단).
 * - 어려움(Hard)·아주 어려움(Crazy): 핵심(core)·심화(advanced)·최상위 도전(challenge, 속담·관용구·지역 방언 포함) 허용(너무 쉬운 basic 제외).
 */
export function isQuestionEligibleForDifficulty(
  q: Pick<BankQuestion, 'difficultyTier' | 'variantTag'>,
  difficulty: DifficultyId,
): boolean {
  const tier = q.difficultyTier ?? 'core';
  const tag = q.variantTag ?? 'standard';
  if (difficulty === 'Easy') {
    return (tier === 'basic' || tier === 'core') && tag !== 'dialect';
  }
  if (difficulty === 'Normal') {
    return tier !== 'challenge' && tag !== 'dialect';
  }
  return tier !== 'basic';
}

/** 한 판 동안 바뀌지 않는 콘텐츠 묶음. 상태(RunState)와 분리해 저장 크기를 줄인다. */
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

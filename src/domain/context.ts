import type { Balance, DifficultyConfig, DifficultyId } from '../contracts/balance';
import type { MapConfig } from '../contracts/maps';
import type { BankQuestion } from '../contracts/questions';
import { buildPath, type PathGeometry } from './geometry';

export interface RuntimeQuestion extends BankQuestion { readingLoad: number }

/** 한 판 동안 바뀌지 않는 콘텐츠 묶음. 상태(RunState)와 분리해 저장 크기를 줄인다. */
export interface GameContext {
  balance: Balance;
  difficulty: DifficultyConfig;
  map: MapConfig;
  path: PathGeometry;
  questions: ReadonlyMap<string, RuntimeQuestion>;
  questionIds: readonly string[];
  battleReadingLoadMax: number;
}

export function createContext(input: {
  balance: Balance;
  difficulty: DifficultyId;
  map: MapConfig;
  questions: readonly RuntimeQuestion[];
  battleReadingLoadMax: number;
}): GameContext {
  if (input.questions.length === 0) throw new Error('승인 문항이 없다');
  const questions = new Map(input.questions.map(q => [q.id, q] as const));
  return {
    balance: input.balance,
    difficulty: input.balance.difficulties[input.difficulty],
    map: input.map,
    path: buildPath(input.map),
    questions,
    questionIds: [...questions.keys()].sort(),
    battleReadingLoadMax: input.battleReadingLoadMax,
  };
}

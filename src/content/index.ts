import balanceJson from '../../docs/contracts/balance.candidate.v0.3.json';
import mapsJson from '../../docs/contracts/maps.candidate.v0.4.json';
import defaultsJson from '../../docs/contracts/product.defaults.v0.5.json';
import { balanceSchema, type DifficultyId, type TowerId } from '../contracts/balance';
import { mapsFileSchema, type MapConfig } from '../contracts/maps';
import { bankFileSchema, readingLoad, type BankFile } from '../contracts/questions';
import { createContext, type GameContext, type RuntimeQuestion } from '../domain/context';
import grade3Dev from './questions/grade3.dev.json';

// 계약 JSON을 런타임 스키마로 한 번 검사한 뒤 쓴다. 숨은 상수를 화면·도메인에 따로 두지 않는다(PRD §10.1).
export const BALANCE = balanceSchema.parse(balanceJson);
export const MAPS: readonly MapConfig[] = mapsFileSchema.parse(mapsJson).maps;
export const DEFAULTS = defaultsJson;

export const PILOT_TOWERS = defaultsJson.pilot.towers as TowerId[];

const banks: Record<number, BankFile> = { 3: bankFileSchema.parse(grade3Dev) };

export interface GradeContent {
  grade: number;
  map: MapConfig;
  bank: BankFile | null;
}

export function gradeContent(grade: number): GradeContent {
  const map = MAPS.find(m => m.grade === grade);
  if (!map) throw new Error(`${grade}학년 맵이 없다`);
  return { grade, map, bank: banks[grade] ?? null };
}

export const toRuntime = (bank: BankFile): RuntimeQuestion[] => bank.questions.map(q => ({ ...q, readingLoad: readingLoad(q) }));

export function contextFor(grade: number, difficulty: DifficultyId): GameContext {
  const { map, bank } = gradeContent(grade);
  if (!bank) throw new Error(`${grade}학년 문제은행이 아직 없다`);
  const caps = defaultsJson.questionSelection.battleReadingLoadMaxSyllables as Record<string, number>;
  return createContext({ balance: BALANCE, difficulty, map, questions: toRuntime(bank), battleReadingLoadMax: caps[String(grade)] ?? 70 });
}

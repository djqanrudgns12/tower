import balanceJson from '../../docs/contracts/balance.candidate.v0.4.json';
import mapsJson from '../../docs/contracts/maps.candidate.v0.4.json';
import defaultsJson from '../../docs/contracts/product.defaults.v0.5.json';
import { balanceSchema, type DifficultyId, type TowerId } from '../contracts/balance';
import { mapsFileSchema, type MapConfig } from '../contracts/maps';
import { bankFileSchema, bankManifestSchema, difficultyGateSchema, readingLoad, retractionListSchema, type BankFile, type DifficultyTier, type RetractionList } from '../contracts/questions';
import { createContext, isQuestionEligibleForDifficulty, type DifficultyGate, type GameContext, type RuntimeQuestion } from '../domain/context';
import manifestJson from './questions/manifest.json';
import { createGradeLoader, type BankLoader } from './gradeLoader';
import practiceJson from './questions/practice.json';
import retractionsJson from './retractions.json';

// 계약 JSON을 런타임 스키마로 한 번 검사한 뒤 쓴다. 숨은 상수를 화면·도메인에 따로 두지 않는다(PRD §10.1).
export const BALANCE = balanceSchema.parse(balanceJson);
export const MAPS: readonly MapConfig[] = mapsFileSchema.parse(mapsJson).maps;
export const DEFAULTS = defaultsJson;

export const PILOT_TOWERS = defaultsJson.pilot.towers as TowerId[];
export const RETRACTIONS: RetractionList = retractionListSchema.parse(retractionsJson);

// 사용자에게는 공동검수를 통과한 공개 은행(grade<N>.json, status=published)만 싣는다(PRD §9.3 "승인 문항만 배포",
// §9.4 "미승인 문항을 가져오지 않는다"). 공동검수 전 후보 은행(grade<N>.candidate.json)은 제작 도구만 읽고 번들에 넣지 않는다.
const publishedRaw = import.meta.glob<unknown>('./questions/grade[3-6].json', { import: 'default' });
const manifest = bankManifestSchema.parse(manifestJson);
const loaders: Record<number, BankLoader> = {};
for (const entry of manifest.banks) {
  const load = publishedRaw[`./questions/grade${entry.grade}.json`];
  if (load) loaders[entry.grade] = load;
}
const gradeLoader = createGradeLoader(manifest, loaders, { 3: () => import('./questions/grade3.dev.json').then(module => module.default) });
export const PUBLISHED_GRADES: readonly number[] = gradeLoader.publishedGrades;
export const isGradeAvailable = gradeLoader.available;
export const gradeLoadState = gradeLoader.state;
export const subscribeGradeContent = gradeLoader.subscribe;

export const DIFFICULTY_GATE: DifficultyGate = difficultyGateSchema.parse(defaultsJson.questionSelection.difficultyGate);

export interface GradeContent {
  grade: number;
  map: MapConfig;
  bank: BankFile | null;
}

export function gradeContent(grade: number): GradeContent {
  const map = MAPS.find(m => m.grade === grade);
  if (!map) throw new Error(`${grade}학년 맵이 없다`);
  return { grade, map, bank: gradeLoader.peek(grade) };
}

/** 문제 본문이 필요한 화면·도구의 진입점. 같은 학년의 동시 호출은 하나로 합친다. */
export async function loadGradeContent(grade: number): Promise<GradeContent> {
  gradeContent(grade); // 지원하지 않는 학년은 파일 요청 전에 거절한다.
  await gradeLoader.load(grade);
  return gradeContent(grade);
}

/** 철회 목록을 겹친 뒤 남은 문항. 같은 ID라도 철회된 revision만 뺀다(PRD §9.5, A26). */
export function toRuntime(bank: BankFile, retractions: RetractionList = RETRACTIONS): RuntimeQuestion[] {
  const retracted = new Set(retractions.entries.map(e => `${e.questionId}@${e.revision}`));
  return bank.questions.filter(q => !retracted.has(`${q.id}@${q.revision}`)).map(q => ({ ...q, readingLoad: readingLoad(q) }));
}

/** 복습 화면용 조회. 철회된 문항은 해설을 다시 보여 주지 않는다. 문항이 하나도 없어도 던지지 않는다. */
export function reviewQuestions(grade: number): ReadonlyMap<string, RuntimeQuestion> {
  const { bank } = gradeContent(grade);
  return new Map(bank ? toRuntime(bank).map(q => [q.id, q] as const) : []);
}

/**
 * 첫 연습 판(PRD §12.2): 문제 1개 → 골드 → 궁수 설치 → 적 3마리 → 생존 회복. 정규 규칙은 그대로 두고
 * 시도 수·마릿수·등장 간격만 줄인다. 문항은 연습 전용 묶음이며 정규 은행·기록에 쓰지 않는다.
 */
export const PRACTICE = { grade: 3, difficulty: 'Easy' as DifficultyId, seed: 20261028, enemies: 3, spawnIntervalMs: 2200 };
const practiceBank = bankFileSchema.parse(practiceJson);

export function practiceContext(): GameContext {
  const balance = structuredClone(BALANCE);
  balance.balanceVersion = `${BALANCE.balanceVersion}+practice`;
  balance.run.prepAttempts.firstWave = 1;
  balance.waves.count = { ...balance.waves.count, base: PRACTICE.enemies, step: 0 };
  balance.waves.spawnIntervalMs = { ...balance.waves.spawnIntervalMs, overrides: { 1: PRACTICE.spawnIntervalMs } };
  const { map } = gradeContent(PRACTICE.grade);
  return createContext({ balance, difficulty: PRACTICE.difficulty, map, questions: toRuntime(practiceBank), battleReadingLoadMax: 70 });
}

export const PRACTICE_BANK = { bankId: practiceBank.bankId, bankVersion: practiceBank.bankVersion };

export class ContentUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'ContentUnavailableError'; }
}
export class ContentNotLoadedError extends Error {
  constructor(grade: number) { super(`${grade}학년 문제를 먼저 불러와야 한다`); this.name = 'ContentNotLoadedError'; }
}

export function contextFor(grade: number, difficulty: DifficultyId, retractions: RetractionList = RETRACTIONS): GameContext {
  const { map, bank } = gradeContent(grade);
  if (!bank) {
    if (isGradeAvailable(grade)) throw new ContentNotLoadedError(grade);
    throw new ContentUnavailableError(`${grade}학년 문제은행이 아직 없다`);
  }
  const active = toRuntime(bank, retractions);
  // 전부 철회되면 판을 시작하지 않는다. 학생 패배가 아니라 복구 안내다(PRD §16.2).
  if (active.length === 0) throw new ContentUnavailableError(`${grade}학년 문항이 모두 철회되었다`);
  const questions = active.filter(q => isQuestionEligibleForDifficulty(q, difficulty, DIFFICULTY_GATE));
  if (questions.length === 0) throw new ContentUnavailableError(`${grade}학년 ${difficulty} 난이도에 쓸 수 있는 문항이 없다`);
  const caps = defaultsJson.questionSelection.battleReadingLoadMaxSyllables as Record<string, number>;
  const schedules = defaultsJson.questionSelection.difficultyTierSchedule as Record<DifficultyId, DifficultyTier[]>;
  return createContext({
    balance: BALANCE,
    difficulty,
    map,
    questions,
    battleReadingLoadMax: caps[String(grade)] ?? 70,
    tierSchedule: schedules[difficulty],
  });
}

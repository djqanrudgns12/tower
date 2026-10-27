import type { BranchId, DifficultyId, EliteId, EnemyKind, TowerId } from '../contracts/balance';
import type { OptionId } from '../contracts/questions';

// 저장·재개되는 전체 상태. 순수 JSON(숫자·문자열·배열·객체)만 쓴다(PRD §10.1, §14).
export const RUN_STATE_VERSION = 1;
export const RULES_VERSION = '0.4-candidate';

export type Phase = 'PREP_QUIZ' | 'BUILD' | 'BATTLE' | 'WAVE_WRAPUP' | 'GAME_OVER';
export type PauseReason = 'USER' | 'HIDDEN' | 'PERFORMANCE' | 'STORAGE' | 'CONTEXT_LOST' | 'OWNERSHIP' | 'RESTORED' | 'NUMERIC_LIMIT';
export type EncounterPhase = 'prep' | 'battle';

export interface RunConfig {
  runId: string;
  playerId: string;
  nickname: string;
  grade: number;
  difficulty: DifficultyId;
  mapId: string;
  seed: number;
  rngAlgorithm: string;
  rulesVersion: string;
  balanceVersion: string;
  mapVersion: string;
  bankId: string;
  bankVersion: string;
  contentMode: 'published' | 'development';
  availableTowers: TowerId[];
  rankingEligibility: 'personal';
  createdAt: string;
}

export interface Encounter {
  id: number;
  questionId: string;
  revision: number;
  phase: EncounterPhase;
  wave: number;
  createdTick: number;
  optionOrder: OptionId[];
  /** 전투 종료 순간 남아 있던 미제출 문항이면 true(PRD §3.5). */
  wrapup: boolean;
  answer: null | { choice: OptionId | 'skipped'; tick: number; correct: boolean; pt: number; gold: number };
}

export interface Feedback {
  encounterId: number;
  result: 'correct' | 'wrong' | 'skipped';
  /** 정답이면 이 틱에 자동으로 다음 단계로 간다. */
  autoAdvanceTick: number | null;
  /** 오답·모르겠어요는 이 틱부터 ‘다음 문제’를 누를 수 있다. */
  nextEnabledTick: number | null;
}

export interface QuizState {
  queue: string[];
  cursor: number;
  cycle: number;
  recentQuestions: string[];
  recentSenses: string[];
  current: Encounter | null;
  feedback: Feedback | null;
  prepTarget: number;
  prepDone: number;
  battleStreak: number;
  nextEncounterId: number;
  history: Encounter[];
}

export interface SlowEffect { source: number; bp: number; untilTick: number }

export interface Enemy {
  id: number;
  kind: EnemyKind;
  elite: EliteId | null;
  hp: number;
  maxHp: number;
  /** 경로 진행(milli-cell). */
  progress: number;
  moveRem: number;
  speedBP: number;
  physicalResistBP: number;
  magicResistBP: number;
  slows: SlowEffect[];
  stunUntilTick: number;
  stunTicksUsed: number;
  alive: boolean;
}

export interface Tower {
  id: number;
  type: TowerId;
  slotId: string;
  x: number;
  y: number;
  level: number;
  branch: BranchId | null;
  invested: number;
  nextAttackTick: number | null;
}

export interface Projectile {
  id: number;
  towerId: number;
  towerType: TowerId;
  fromX: number;
  fromY: number;
  /** 단일 대상이면 대상 ID, 범위 공격이면 null. */
  targetId: number | null;
  toX: number;
  toY: number;
  firedTick: number;
  arrivalTick: number;
  damage: number;
  damageType: 'physical' | 'magic';
  splashRadius: number;
  maxTargets: number;
  slowBP: number;
  slowTicks: number;
}

export interface SpawnEntry { kind: EnemyKind; elite: EliteId | null }

export interface BattleState {
  spawnList: SpawnEntry[];
  spawnIndex: number;
  nextSpawnTick: number;
  intervalTicks: number;
  hpBaseMilli: number;
  startedTick: number;
}

export interface RunStats {
  correct: number;
  wrong: number;
  skipped: number;
  kills: number;
  bossKills: number;
  bossLeaks: number;
  leaks: number;
  goldEarned: number;
  ptFromQuestions: number;
  ptFromKills: number;
  activeTicks: number;
  battleTicks: number;
}

export interface RunState {
  v: number;
  config: RunConfig;
  phase: Phase;
  pause: PauseReason[];
  tick: number;
  wave: number;
  completedWave: number;
  endedAtWave: number | null;
  endReason: null | 'DEFEAT' | 'QUIT';
  gateHp: number;
  gateMaxHp: number;
  gold: number;
  pt: number;
  waveKillPtGranted: number;
  burningUntilTick: number;
  rng: { battle: number; question: number; option: number };
  seq: { command: number; enemy: number; tower: number; projectile: number };
  quiz: QuizState;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  battle: BattleState | null;
  stats: RunStats;
  milestoneRewardedWaves: number[];
}

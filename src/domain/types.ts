import type { BossTier, DifficultyId, EliteId, EnemyKind, FormId, TowerId } from '../contracts/balance';
import type { OptionId } from '../contracts/questions';

// 저장·재개되는 전체 상태. 순수 JSON(숫자·문자열·배열·객체)만 쓴다(PRD §10.1, §14).
/**
 * 2: 타워 branch → form, 설치 취소 기한(리뉴얼 R2). 3: 적 종족·대장 단계(R2 2단계).
 * 이전 버전의 진행 중 판은 이어가지 않는다(application/session.ts resumeBlocker).
 */
export const RUN_STATE_VERSION = 3;
/**
 * 0.5-candidate: P2 공격 프로필(즉발·연쇄·부채꼴·화상·깃발 오라, 물리 저항 무시)과 적 화상 상태(PRD §7.1, §20.2~20.3).
 * 0.5.1-candidate: 난이도별 심화 단계 출제 순서와 한 바퀴 뒤 섞기(PRD §9.1, §9.4). 같은 시드의 출제 순서가 바뀌므로 옛 저장은 이어하지 않는다.
 */
export const RULES_VERSION = '0.5.1-candidate';

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
/** 화상 출처(타워 ID)별 총피해 스냅샷(저항 반영 뒤 milli-HP)과 고유 만료 틱(PRD §20.2). */
export interface BurnSource { source: number; total: number; expiresTick: number }

export interface Enemy {
  id: number;
  /** 역할. 수치·규칙은 역할이 정한다. */
  kind: EnemyKind;
  /** 종족(balance.factions 키). 이름·그림만 바꾼다(domain/factions.ts enemyArtId). */
  faction: string;
  /** 대장 단계(1~4 = 5·10·15·20웨이브 대장). 대장이 아니면 null. */
  bossTier: BossTier | null;
  /** 분열·호위로 생긴 파생체: 처치 골드·PT 0(농사 방지). */
  derived: boolean;
  /** 비행 역할. 이 틱 전까지는 땅으로 끌어내려져(grounded) 대공이 안 되는 타워도 맞힌다. */
  flying: boolean;
  groundedUntilTick: number;
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
  /** 화상: 출처 목록, 적마다 하나인 피해 시계(다음 피해 틱), 4등분 나머지(PRD §20.2). */
  burns: BurnSource[];
  burnNextTick: number | null;
  burnRemainder: number;
  alive: boolean;
}

export interface Tower {
  id: number;
  type: TowerId;
  slotId: string;
  x: number;
  y: number;
  level: number;
  /** 기본형 → 1차형(A·B, Lv4) → 2차형(A1~B2, Lv7). docs/renewal/progression.md §1. */
  form: FormId;
  invested: number;
  nextAttackTick: number | null;
  /** 이 틱 전까지 설치 취소(전액 환불)를 받는다. 강화하거나 공격·오라를 쓰면 null. */
  undoUntilTick: number | null;
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
  /** 물리 저항 효과를 줄이는 비율(석궁, PRD §7.1·§20.2). */
  physicalResistIgnoreBP: number;
  /** 발사 순간의 외부(깃발) 피해 보너스. damage는 레벨·형태까지만 반영하고, 맞을 때 상황→외부→저항 순서로 곱한다(PRD §20.2). */
  bonusBP: number;
  /** 정예·보스에게만 곱하는 상황 배율(석궁 B·수호기사 A). */
  eliteBossDamageBP: number;
  /** 대공 가능(아니면 떠 있는 비행 적은 빗나가고 범위에서도 빠진다)과 비행 적 상황 배율. */
  canHitFlyer: boolean;
  flyerDamageBP: number;
}

/** 생성 예약. faction이 없으면 맵의 주력 종족, 대장의 bossTier가 없으면 1단이다(시험·연습용 줄). */
export interface SpawnEntry { kind: EnemyKind; elite: EliteId | null; faction?: string; bossTier?: BossTier | null }

export interface BattleState {
  spawnList: SpawnEntry[];
  spawnIndex: number;
  nextSpawnTick: number;
  intervalTicks: number;
  hpBaseMilli: number;
  startedTick: number;
}

/** 징집 후보(towers.md §0-2). 고르기 전까지 남고, 다음 징집 웨이브가 오면 첫 후보로 정해진다. */
export interface DraftOffer { wave: number; offers: TowerId[] }

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
  rng: { battle: number; question: number; option: number; draft: number };
  seq: { command: number; enemy: number; tower: number; projectile: number };
  quiz: QuizState;
  /** 장착함: 이 판에서 지을 수 있는 타워(시작 타워 + 징집으로 고른 순서). */
  owned: TowerId[];
  /** 고르기를 기다리는 징집 후보. */
  draft: DraftOffer | null;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  battle: BattleState | null;
  stats: RunStats;
  milestoneRewardedWaves: number[];
}

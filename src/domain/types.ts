import type { BossTier, DifficultyId, EliteId, EnemyKind, FormId, TowerId } from '../contracts/balance';
import type { OptionId } from '../contracts/questions';

// 저장·재개되는 전체 상태. 순수 JSON(숫자·문자열·배열·객체)만 쓴다(PRD §10.1, §14).
/**
 * 2: 타워 branch → form, 설치 취소 기한(리뉴얼 R2). 3: 적 종족·대장 단계(R2 2단계). 4: 신규 타워 효과 상태(취약·저항 차감·밀치기·공격 주기·다연발). 5: 대장 기믹 상태.
 * 6: 장판·덫·굴림체(RunState.hazards, 투사체 zone, seq.hazard).
 * 이전 버전의 진행 중 판은 이어가지 않는다(application/session.ts resumeBlocker).
 */
export const RUN_STATE_VERSION = 6;
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
/** 취약(받는 피해 +bp): 감속처럼 출처(타워 ID)별로 두고 가장 큰 값 하나만 쓴다(towers.md §4-6). */
export type VulnMark = SlowEffect;
/** 저항 차감: 출처별 물리·마법 차감. 종류마다 가장 큰 값 하나만 쓴다. */
export interface ShredMark { source: number; physicalBP: number; magicBP: number; untilTick: number }
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
  vulns: VulnMark[];
  shreds: ShredMark[];
  /** 지금까지 뒤로 밀린 거리(평생 상한 statusCaps.knockbackLifetimeMaxMilli). */
  knockbackUsed: number;
  /** 대장 기믹 진행(monsters.md §2.0). 기믹이 없는 적은 null. */
  boss: BossState | null;
  alive: boolean;
}

/** 대장 기믹 진행: 등장 틱, 방어 태세(발동 여부·저항·끝 틱), 남은 겹방패, 회복 횟수·다음 회복 틱, 지난 호위 호출 단계. */
export interface BossState {
  bornTick: number;
  stanceUsed: boolean;
  stance: { physicalBP: number; magicBP: number; untilTick: number } | null;
  wardLeft: number;
  mends: number;
  nextMendTick: number;
  escortStep: number;
}

/** 시차 다연발 예약(towers.md §4-4): 남은 발 수, 다음 발 틱, 간격, 뒤따르는 발의 피해 배율. */
export interface BurstState { left: number; nextTick: number; gapTicks: number; damageBP: number }

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
  /** 지금까지 한 공격 수(공격 주기 every번째 판정, towers.md §4-9). */
  attacks: number;
  burst: BurstState | null;
  /** 같은 적을 이어 친 횟수(마법 A1). */
  focus: { targetId: number; stacks: number } | null;
  /** 처치 골드 오라(깃발 A2): 오라 안 처치 수와 이번 웨이브에 준 골드. */
  auraKills: number;
  auraGold: number;
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
  /** 맞을 때의 추가 효과(없으면 없음). */
  fx?: HitFx;
  /** 맞힌 뒤 마지막 대상 둘레 2차 피해. */
  splash?: SplashHit;
  /** 도탄: 남은 횟수와 이미 맞은 적. */
  ricochet?: { left: number; radius: number; falloffBP: number; hit: number[] };
  /** 착탄 둘레 당기기. */
  pull?: { radius: number; maxTargets: number; milli: number };
  /** 착탄하면 장판을 남긴다(약병, towers.md §4-7). progress는 발사 때 표적의 경로 진행도(앞뒤 장판 자리). */
  zone?: ZoneSpec;
}

/** 장판 설정 스냅샷: 반경·타격 간격·타격 횟수·개수(1 또는 3)·경로 앞뒤 간격, 표적 진행도. */
export interface ZoneSpec { radius: number; periodTicks: number; pulses: number; durationTicks: number; count: number; spacing: number; progress: number }

/** 장판·덫·굴림체·지연 폭발이 맞힐 때 쓰는 타격 스냅샷(놓은 순간의 레벨·형태·오라). 투사체와 같은 모양이다. */
export type HazardStrike = Pick<Projectile, 'towerId' | 'towerType' | 'damage' | 'damageType' | 'slowBP' | 'slowTicks' | 'physicalResistIgnoreBP' | 'bonusBP' | 'eliteBossDamageBP' | 'canHitFlyer' | 'flyerDamageBP' | 'fx'>;

export type HazardKind = 'zone' | 'trap' | 'roller';

/**
 * 바닥에 남는 공격(towers.md §4-7 fieldHazards). battleTick의 화상 직후 단계에서 생성순으로 일괄 갱신한다.
 * charges는 남은 횟수다: zone 타격, trap 발동, roller 충돌. expiresTick이 null이면 시간으로는 사라지지 않는다(덫).
 */
interface HazardBase {
  id: number;
  towerId: number;
  towerType: TowerId;
  /** 중심(zone·trap) 또는 지금 위치(roller). 직선 zone은 선분 시작점(타워 자리). */
  x: number;
  y: number;
  createdTick: number;
  expiresTick: number | null;
  charges: number;
  maxTargets: number;
  strike: HazardStrike;
}

/** 직선 모양(노포 B2 도화선): 시작점에서 (dx, dy) 방향, 길이 length·폭 width. */
export interface HazardLine { dx: number; dy: number; length: number; width: number }

/** 장판(약병)·지연 폭발(덫 B1 2차 폭죽·노포 B2 도화선): nextTick부터 periodTicks마다 반경(또는 직선) 안 최대 maxTargets명. */
export interface ZoneHazard extends HazardBase {
  kind: 'zone';
  radius: number;
  nextTick: number;
  periodTicks: number;
  line: HazardLine | null;
  /** 한 번 터지고 사라지는 지연 폭발이면 true(장판 위 처치 유발·화면 그림이 장판과 구분한다). */
  blast: boolean;
}

/** 바닥 덫: 진행도 progress ± radius 안 지상 적이 밟으면 발동. blastRadius가 0이면 밟은 적 하나, 아니면 그 둘레 최대 maxTargets명. */
export interface TrapHazard extends HazardBase {
  kind: 'trap';
  progress: number;
  radius: number;
  blastRadius: number;
  /** 터진 자리 delayTicks 뒤 2차 폭죽(피해만, 덫 B1). */
  aftershock: { delayTicks: number; damage: number } | null;
}

/** 굴림체: 매 틱 stepMilli씩 progress를 줄이며(입구 쪽) 스친 구간의 아직 안 맞은 지상 적을 친다. */
export interface RollerHazard extends HazardBase {
  kind: 'roller';
  progress: number;
  endProgress: number;
  stepMilli: number;
  /** 진행도 기준 충돌 반쪽 폭. */
  halfWidth: number;
  hit: number[];
  /** 화약 술통(통나무 B): afterHits번 충돌·정예/대장 충돌·굴림 끝 가운데 먼저 오는 때 한 번 폭발. */
  blast: { afterHits: number; eliteTrigger: boolean; radius: number; maxTargets: number; damage: number } | null;
}

export type FieldHazard = ZoneHazard | TrapHazard | RollerHazard;

/** 한 번의 적중이 싣는 추가 효과(틱·BP, 0이면 없음). 발사 순간의 스냅샷이다. */
export interface HitFx {
  burnTotal: number; burnTicks: number; magicResistIgnoreBP: number;
  stunTicks: number; eliteStunTicks: number; eliteSlowBP: number; eliteSlowTicks: number; bossSlowBP: number; bossSlowTicks: number;
  knockback: number; knockbackFlyer: number; knockbackBoss: number; groundTicks: number;
  vulnBP: number; vulnTicks: number; shredPhysicalBP: number; shredMagicBP: number; shredTicks: number;
  lowHpThresholdBP: number; lowHpDamageBP: number; slowedDamageBP: number;
}

/** 마지막 대상 둘레 2차 피해(파편·폭발): 반경·대상 수·피해(이미 배율 반영)·추가 효과. */
export interface SplashHit { radius: number; maxTargets: number; damage: number; vulnBP: number; vulnTicks: number; slowBP: number; slowTicks: number; flyersOnly: boolean }

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
  seq: { command: number; enemy: number; tower: number; projectile: number; hazard: number };
  quiz: QuizState;
  /** 장착함: 이 판에서 지을 수 있는 타워(시작 타워 + 징집으로 고른 순서). */
  owned: TowerId[];
  /** 고르기를 기다리는 징집 후보. */
  draft: DraftOffer | null;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  /** 장판·덫·굴림체(towers.md §4-7). 웨이브가 끝나면 덫만 타워마다 최대 2개 남긴다. */
  hazards: FieldHazard[];
  battle: BattleState | null;
  stats: RunStats;
  milestoneRewardedWaves: number[];
}

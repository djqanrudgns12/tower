import type { EnemyKind } from '../../contracts/balance';
import { CELL_PX } from '../assets';
import { GAITS, strideWorld, type Gait } from './gait';

// 적 보행 자세. RIG 작업(RIG-001)은 이 파일과 game/animation/** 안에서만 바꾼다.
// 렌더러는 이 함수의 결과만 그리며, 판정·이동 진행도는 바꾸지 않는다(PRD §11.3).
export interface PoseInput {
  kind: EnemyKind;
  /** 개체별 0..1 위상(독립 보행). */
  phase: number;
  /** 초 단위 화면 시간. */
  time: number;
  /** 속도 BP(10000=기본). 걸음 빠르기에 쓴다. */
  speedBP: number;
  moving: boolean;
  frames: number;
  reducedMotion: boolean;
  /** 경로를 따라 온 월드 px(보간된 진행도). 주면 감속·맵 길이와 상관없이 걸음을 거리에 맞춘다. */
  distance?: number;
  /** 같은 적의 마지막 피격 효과가 시작된 뒤 초. 없으면 피격 없음. */
  hitAge?: number;
}

export interface Pose {
  frame: number;
  /** 위로 뜨는 px(월드 단위). 발 있는 적은 0이다(지면 고정). */
  bob: number;
  /** 세로 눌림 배율(지면 기준점 고정). */
  squashY: number;
  /** 피격 효과 중. 렌더러는 `enemy.<kind>.hit` 그림이 있으면 그것을 쓴다. */
  hit: boolean;
}

/** 개체 피격 효과 길이와, 같은 적에게 효과를 다시 시작하는 최소 간격(PRD §11.4). */
export const HIT_MS = 100;
export const HIT_MIN_GAP_MS = 120;
export const acceptsHit = (lastStartMs: number | null, nowMs: number) => lastStartMs === null || nowMs - lastStartMs >= HIT_MIN_GAP_MS;

/** 렌더러가 거리를 주지 않을 때의 기본 이동 속도: 3학년 맵 40칸을 720틱(30Hz, 24초)에 걷는다. */
export const FALLBACK_CELLS_PER_SEC = 40 / 24;
/** 보행표가 없는 적(임시 2프레임 그림)의 초당 주기. */
const STEPS_PER_SECOND: Partial<Record<EnemyKind, number>> = { runner: 2.8, swarm: 3.2, brute: 1.6, boss: 1.4 };
/** 디딤 때 발을 기준으로 몸이 내려앉는 비율과, 피격 직후 눌림 비율. */
const WALK_DIP = 0.04;
const HIT_SQUASH = 0.12;

export function enemyPose(p: PoseInput): Pose {
  const hitK = p.hitAge !== undefined && p.hitAge >= 0 ? (p.hitAge * 1000) / HIT_MS : 1;
  const hit = hitK < 1;
  // 정지 중에는 피격이어도 그림만 바꾸고 몸은 그대로 둔다.
  if (!p.moving) return { frame: 0, bob: 0, squashY: 1, hit };
  const gait = GAITS[p.kind];
  const rig = gait && gait.grounded.length === p.frames ? gait : null;
  const cycle = rig && p.distance !== undefined ? p.distance / strideWorld(p.kind, rig) + p.phase : p.time * cyclesPerSecond(p, rig) + p.phase;
  const at = cycle - Math.floor(cycle);
  const frame = rig ? rig.starts.findLastIndex(s => s <= at) : Math.floor(at * p.frames) % p.frames;
  if (p.reducedMotion) return { frame, bob: 0, squashY: 1, hit };
  // 떠다니는 적만 몸을 띄운다. 발 있는 적은 발을 기준으로 디딤 때 살짝 내려앉는다.
  const bob = p.kind === 'wisp' ? 3 * Math.sin(cycle * Math.PI) : 0;
  const dip = p.kind === 'wisp' ? 0 : 0.5 + 0.5 * Math.cos(4 * Math.PI * (at - (rig ? rig.dip : 1 / (2 * p.frames))));
  return { frame, bob, squashY: hit ? hitSquash(hitK) : 1 - WALK_DIP * dip, hit };
}

function cyclesPerSecond(p: PoseInput, rig: Gait | null): number {
  if (rig) return (FALLBACK_CELLS_PER_SEC * CELL_PX * (p.speedBP / 10000)) / strideWorld(p.kind, rig);
  return (STEPS_PER_SECOND[p.kind] ?? 2.2) * (p.speedBP / 10000);
}

/** 맞은 순간 가장 눌리고 HIT_MS 동안 풀린다. */
const hitSquash = (k: number) => 1 - HIT_SQUASH * (1 - k) ** 2;

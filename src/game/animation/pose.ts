import type { EnemyKind } from '../../contracts/balance';

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
}

export interface Pose {
  frame: number;
  /** 위로 뜨는 px(월드 단위). */
  bob: number;
  /** 세로 눌림 배율(지면 기준점 고정). */
  squashY: number;
}

const STEPS_PER_SECOND: Partial<Record<EnemyKind, number>> = { runner: 2.8, swarm: 3.2, brute: 1.6, boss: 1.4 };

export function enemyPose(p: PoseInput): Pose {
  if (!p.moving) return { frame: 0, bob: 0, squashY: 1 };
  const rate = (STEPS_PER_SECOND[p.kind] ?? 2.2) * (p.speedBP / 10000);
  const cycle = p.time * rate + p.phase;
  const frame = Math.floor(cycle * p.frames) % p.frames;
  if (p.reducedMotion) return { frame, bob: 0, squashY: 1 };
  const wave = Math.abs(Math.sin(cycle * Math.PI * 2));
  return { frame, bob: p.kind === 'wisp' ? 3 * Math.sin(cycle * Math.PI) : wave * 2.2, squashY: 1 - (1 - wave) * 0.04 };
}

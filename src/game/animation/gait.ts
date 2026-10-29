import type { EnemyKind } from '../../contracts/balance';
import { CELL_PX, ENEMY_DISPLAY } from '../assets';

// 원본 프레임 보행표(RIG-001). 원화 revision이 바뀌면 다시 재고, tests/unit/animation.test.ts가 납품 PNG와 대조한다.
export interface Gait {
  /** 원본 너비 px(표시 배율 계산용). */
  width: number;
  /** 프레임별로 바닥에 닿은 신발의 x 중심(원본 px, 오른쪽이 진행 방향). */
  grounded: readonly (readonly number[])[];
  /** 한 주기(두 걸음) 동안 몸이 나아가는 거리(원본 px). */
  stride: number;
  /** 프레임이 시작하는 주기 위치(0..1). */
  starts: readonly number[];
  /** 몸이 가장 낮은 주기 위치(첫 디딤 프레임 가운데). 반 주기 뒤에 한 번 더 온다. */
  dip: number;
}

/**
 * 몸을 받치는 발(그 프레임의 가장 앞 접지 발)은 다음 프레임에서 가장 뒤 접지 발이 된다.
 * 그 사이 몸이 두 위치의 차이만큼 나아가야 발이 땅에서 미끄러지지 않으므로, 프레임 길이를 그 차이에 비례시킨다.
 */
function gait(width: number, grounded: number[][]): Gait {
  const travel = grounded.map((feet, k) => Math.max(...feet) - Math.min(...grounded[(k + 1) % grounded.length]!));
  const stride = travel.reduce((a, b) => a + b, 0);
  let at = 0;
  const starts = travel.map(t => { const s = at; at += t / stride; return s; });
  const first = grounded.findIndex(feet => feet.length > 1);
  return { width, grounded, stride, starts, dip: starts[first]! + travel[first]! / stride / 2 };
}

export const GAITS: Partial<Record<EnemyKind, Gait>> = {
  // enemy.walker.0~3.r1: 디딤(두 발) → 지나감 → 디딤 → 지나감. 바닥 4행 중 아래 2행까지 닿은 덩어리를 쟀다.
  walker: gait(128, [[43.5, 81], [68.5], [40, 79], [63]]),
};

/** 한 주기 동안 몸이 나아가는 월드 px(표시 크기는 인수된 manifest를 따른다). */
export const strideWorld = (kind: EnemyKind, g: Gait) => (g.stride * ENEMY_DISPLAY[kind] * CELL_PX) / g.width;

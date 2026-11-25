import { evolutionAt } from '../../domain/r6Towers';

export const R6_HIT_MS = 60;
export const R6_REWARD_MS = 500;
export const MORTAR_SCORCH_MS = 400;

export const railLanes = (level: number) => evolutionAt(level).weapon + 1;
export const prismDelay = (index: number, reduced: boolean) => reduced ? 0 : 120 + index * 120;

export function fragmentCount(kind: 'rail' | 'kill', quality: number, reduced: boolean) {
  const limits = kind === 'rail' ? [4, 3, 2, 1] : [5, 3, 2, 1];
  return reduced ? 1 : limits[quality] ?? 1;
}

/** 화면 좌표에서 포탄이 오르는 거리는 중점에서 가장 높다. */
export function shellPoint(from: { x: number; y: number }, to: { x: number; y: number }, progress: number, height: number) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress - 4 * height * progress * (1 - progress),
  };
}

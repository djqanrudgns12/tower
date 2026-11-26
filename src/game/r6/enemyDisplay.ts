/** 캐릭터가 큰 구간의 배율만 눌러 단계별 크기 차이를 남긴다. */
export function r6EnemyScale(scale: number, setupHeight: number, boss: boolean): number {
  const height = scale * setupHeight;
  const knee = boss ? 86 : 37;
  if (height <= knee) return scale;
  const compressed = knee + (height - knee) * (boss ? .13 : .28);
  return Math.min(compressed, boss ? 95 : 54) / setupHeight;
}

const R6_VISUAL_LIFT_CELLS: ReadonlyArray<readonly [prefix: string, liftCells: number]> = [
  ['elf-special-', 0.28],
  ['machine-special-', 0.24],
  ['insect-runner-', 0.20],
];

/** R6 전장에서 비행 그림자와 띄운 높이를 적용할 개체인지 판별한다. */
export function isR6VisualFlyer(entityId: string | undefined, flying: boolean): boolean {
  if (flying) return true;
  if (!entityId) return false;
  return R6_VISUAL_LIFT_CELLS.some(([prefix]) => entityId.startsWith(prefix));
}

/** R6 비행 개체의 시각적 부유 높이(칸). 끌어내려진 동안은 0이다. */
export function r6VisualFlyerLiftCells(entityId: string | undefined, flying: boolean, grounded: boolean): number {
  if (grounded) return 0;
  if (entityId) {
    for (const [prefix, lift] of R6_VISUAL_LIFT_CELLS) {
      if (entityId.startsWith(prefix)) return lift;
    }
  }
  return flying ? 0.25 : 0;
}

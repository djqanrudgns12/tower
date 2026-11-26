/** 캐릭터가 큰 구간의 배율만 눌러 단계별 크기 차이를 남긴다. */
export function r6EnemyScale(scale: number, setupHeight: number, boss: boolean): number {
  const height = scale * setupHeight;
  const knee = boss ? 86 : 37;
  if (height <= knee) return scale;
  const compressed = knee + (height - knee) * (boss ? .13 : .28);
  return Math.min(compressed, boss ? 95 : 54) / setupHeight;
}

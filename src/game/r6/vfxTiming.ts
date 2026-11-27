import { evolutionAt } from '../../domain/r6Towers';

export const R6_HIT_MS = 60;
export const R6_REWARD_MS = 500;
export const MORTAR_SCORCH_MS = 400;

export type R6BiomeAmbient = 'meadow' | 'river' | 'ochre' | 'snow';

const WEAPON_STAGE_SCALES = [1.0, 1.12, 1.25, 1.4] as const;

export const railLanes = (level: number) => evolutionAt(level).weapon + 1;
export const prismDelay = (index: number, reduced: boolean) => reduced ? 0 : 120 + index * 120;

/** 무기 단계(I~IV)에 맞춘 VFX 크기 배수. */
export function weaponStageScale(level: number): number {
  const { weapon } = evolutionAt(level);
  return WEAPON_STAGE_SCALES[weapon] ?? 1.0;
}

/** 보스 처치 시 120ms 감쇠 카메라 미세 진동(품질 0 & !reduced 전용, 최대 ≤ 2.5px). */
export function bossPunchOffset(elapsedMs: number, quality: number, reduced: boolean): number {
  if (reduced || quality >= 1 || elapsedMs < 0 || elapsedMs >= 120) return 0;
  return Number((2.4 * (1 - elapsedMs / 120)).toFixed(3));
}

/** R6 전장 ID에서 4대 월드 바이옴 외곽 입자 유형을 고른다. */
export function r6BiomeAmbientKind(mapId: string): R6BiomeAmbient {
  const id = mapId.toLowerCase();
  if (id.startsWith('river')) return 'river';
  if (id.startsWith('ochre') || id.startsWith('courtyard')) return 'ochre';
  if (id.startsWith('snow')) return 'snow';
  return 'meadow';
}

export function fragmentCount(kind: 'rail' | 'kill', quality: number, reduced: boolean) {
  const limits = kind === 'rail' ? [4, 3, 2, 1] : [5, 3, 2, 1];
  return reduced ? 1 : limits[quality] ?? 1;
}

/** 품질 단계별 Graphics 계층 도형 호출 예산. */
export function vfxGraphicsBudget(quality: number): number {
  if (quality <= 0) return 400;
  if (quality === 1) return 200;
  return 100;
}

/** 품질·접근성 설정에 따른 풀링 Image 파티클 동시 활성 상한. */
export function vfxParticleCap(quality: number, reduced: boolean): number {
  if (reduced || quality >= 3) return 16;
  if (quality === 2) return 36;
  if (quality === 1) return 72;
  return 120;
}

export const SPECIES_KILL_TINTS: Readonly<Record<string, number>> = {
  elf: 0x2fb5a3,
  human: 0x7aa2d4,
  machine: 0xe69f24,
  insect: 0x8ac926,
  stone: 0xb8c0c8,
};

export function speciesKillTint(entityId: string | undefined): number {
  const species = entityId?.split('-')[0];
  return (species ? SPECIES_KILL_TINTS[species] : undefined) ?? 0xb8c0c8;
}

/** 화면 좌표에서 포탄이 오르는 거리는 중점에서 가장 높다. */
export function shellPoint(from: { x: number; y: number }, to: { x: number; y: number }, progress: number, height: number) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress - 4 * height * progress * (1 - progress),
  };
}

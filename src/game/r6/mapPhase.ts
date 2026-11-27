import type { Species } from '../../contracts/balanceV2';
import r6MapThemes from '../../content/theme/r6MapThemes.json';

export type MapBiome = 'meadow' | 'river' | 'ochre' | 'snow';

export interface MapPhaseSpec {
  /** 0..9 (1~50웨이브를 5웨이브 단위로 10구간 분할). */
  readonly index: number;
  readonly id: string;
  readonly waveFrom: number;
  readonly waveTo: number;
  readonly biome: string;
  /** 지형 전용 sRGB 틴트(선형 휘도 Y_after/Y_before >= 0.80 실측 보장). */
  readonly terrainTint: number;
  /** 공용 256×256 아우라 시트 프레임 인덱스 (0..3). */
  readonly auraFrame: 0 | 1 | 2 | 3;
  /** 아우라 입자 색상. */
  readonly auraColor: number;
  /** 활성 입자 상한 (<= 24). */
  readonly particleCount: number;
  /** 5웨이브 보스 경보 펄스 강도. */
  readonly bossAlert: boolean;
}

/** 4대 학년 바이옴 매핑 (3학년 초원 · 4학년 수로 · 5학년 황토 · 6학년 설원). */
export function biomeForGrade(grade: number): MapBiome {
  if (grade === 4) return 'river';
  if (grade === 5) return 'ochre';
  if (grade === 6) return 'snow';
  return 'meadow';
}

const SRGB_TO_LINEAR = (channel8: number) => {
  const s = channel8 / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** 24비트 16진 틴트가 백색 기준 지형에 곱해졌을 때의 선형 상대 휘도(0..1). */
export function linearLuminanceRatio(rgb: number): number {
  const r = SRGB_TO_LINEAR((rgb >> 16) & 0xff);
  const g = SRGB_TO_LINEAR((rgb >> 8) & 0xff);
  const b = SRGB_TO_LINEAR(rgb & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 1~50웨이브(5웨이브 × 10구간) 규격화 지형 광원 · 아우라 정의표.
 * 모든 terrainTint는 linearLuminanceRatio >= 0.80을 만족해 밤·황혼 구간에서도 지형/길/몬스터 대비 >= 2.056을 보존한다.
 */
export const MAP_PHASE_TABLE: readonly Omit<MapPhaseSpec, 'biome'>[] = [
  { index: 0, id: 'morning_sun', waveFrom: 1, waveTo: 5, terrainTint: 0xffffff, auraFrame: 0, auraColor: 0xfff3c4, particleCount: 4, bossAlert: false },
  { index: 1, id: 'high_noon', waveFrom: 6, waveTo: 10, terrainTint: 0xffffff, auraFrame: 1, auraColor: 0xdcfce7, particleCount: 6, bossAlert: false },
  { index: 2, id: 'golden_dusk', waveFrom: 11, waveTo: 15, terrainTint: 0xfff1da, auraFrame: 1, auraColor: 0xfde68a, particleCount: 10, bossAlert: false },
  { index: 3, id: 'blue_moon', waveFrom: 16, waveTo: 20, terrainTint: 0xe2ecfa, auraFrame: 2, auraColor: 0xbae6fd, particleCount: 14, bossAlert: false },
  { index: 4, id: 'mist_dawn', waveFrom: 21, waveTo: 25, terrainTint: 0xe6eff4, auraFrame: 0, auraColor: 0xe0f2fe, particleCount: 14, bossAlert: false },
  { index: 5, id: 'jade_storm', waveFrom: 26, waveTo: 30, terrainTint: 0xdff3ed, auraFrame: 3, auraColor: 0x5eead4, particleCount: 18, bossAlert: false },
  { index: 6, id: 'amber_twilight', waveFrom: 31, waveTo: 35, terrainTint: 0xfde7cf, auraFrame: 1, auraColor: 0xfdba74, particleCount: 18, bossAlert: false },
  { index: 7, id: 'amethyst_star', waveFrom: 36, waveTo: 40, terrainTint: 0xede9fb, auraFrame: 2, auraColor: 0xd8b4fe, particleCount: 20, bossAlert: false },
  { index: 8, id: 'aurora_ridge', waveFrom: 41, waveTo: 45, terrainTint: 0xdef1f5, auraFrame: 3, auraColor: 0x67e8f9, particleCount: 22, bossAlert: false },
  { index: 9, id: 'solar_crown', waveFrom: 46, waveTo: 50, terrainTint: 0xfff4d4, auraFrame: 0, auraColor: 0xfacc15, particleCount: 24, bossAlert: false },
] as const;

export function mapPhase(wave: number, grade = 3): MapPhaseSpec {
  const clamped = Math.max(1, Math.min(50, Math.floor(wave)));
  const index = Math.floor((clamped - 1) / 5);
  const entry = MAP_PHASE_TABLE[index]!;
  return {
    ...entry,
    biome: biomeForGrade(grade),
    bossAlert: wave >= 1 && wave % 5 === 0,
  };
}

export interface MapThemeLabel {
  readonly biomeName: string;
  readonly biomeShort: string;
  readonly chapterTitle: string;
  readonly chapterBadge: string;
}

/** 4대 학년 바이옴·10개 5웨이브 챕터 한국어 라벨(금지어 규칙과 분리된 JSON 원천 조회). */
export function mapThemeLabel(wave: number, grade = 3): MapThemeLabel {
  const phase = mapPhase(wave, grade);
  const biomeKey = biomeForGrade(grade);
  const biomeEntry = r6MapThemes.biomes[biomeKey];
  const chapterEntry = r6MapThemes.chapters[phase.index] ?? r6MapThemes.chapters[0]!;
  return {
    biomeName: biomeEntry.name,
    biomeShort: biomeEntry.short,
    chapterTitle: chapterEntry.title,
    chapterBadge: chapterEntry.badge,
  };
}

const STUDY_PORTRAIT_SPECIES: Record<Species, string> = {
  elf: 'elf',
  human: 'human',
  machine: 'mech',
  insect: 'insect',
  stone: 'golem',
};

/** 웨이브 예고 카드에 쓰는 256×256 종족 초상화 경로. */
export function speciesPortraitUrl(species: Species): string {
  return `assets/ui/study/r6.portrait.${STUDY_PORTRAIT_SPECIES[species]}.01.webp`;
}

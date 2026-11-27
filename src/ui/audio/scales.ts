/**
 * 0KB WebAudio 바이옴·국면별 5음계 음향 사전 (WP-C2-01).
 * 3~6학년 4대 월드 바이옴(meadow · river · ochre · snow)과 전투 국면별 화음·템포·레이어 가중치를 정의한다.
 */
export type AudioBiome = 'meadow' | 'river' | 'ochre' | 'snow';
export type AudioPhase = 'PREP_QUIZ' | 'BUILD' | 'BATTLE' | 'BOSS' | 'BURNING' | 'RESULT';
export type ResultFanfareKind = 'clear' | 'newBest' | 'defeat';

export interface BiomeScaleSpec {
  readonly bpm: number;
  /** 1스텝 길이(초). */
  readonly stepSec: number;
  /** 저음 패드 루트 4마디 진행(Hz). */
  readonly bassRoots: readonly [number, number, number, number];
  /** 주선율 8스텝 패턴(Hz). */
  readonly melodyPattern: readonly number[];
  /** 고조 아르페지오(BURNING/BOSS용 상성 선율, Hz). */
  readonly harmonicPattern: readonly number[];
}

export interface PhaseLayerMix {
  readonly padGain: number;
  readonly melodyGain: number;
  readonly harmonicGain: number;
  readonly percussionGain: number;
  readonly tempoFactor: number;
}

export interface ResultNote {
  readonly f: number;
  readonly t: number;
  readonly d: number;
  readonly type: OscillatorType;
  readonly gain: number;
  readonly to?: number;
}

export const BIOME_SCALES: Readonly<Record<AudioBiome, BiomeScaleSpec>> = {
  // 3학년 들판(meadow): 밝은 C 장조 5음계 (C4-D4-E4-G4-A4)
  meadow: {
    bpm: 96,
    stepSec: 0.5,
    bassRoots: [196.0, 220.0, 261.63, 196.0],
    melodyPattern: [392.0, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0, 329.63],
    harmonicPattern: [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440.0],
  },
  // 4학년 강가(river): 청량한 F 리디안 5음계 (F4-G4-A4-C5-D5)
  river: {
    bpm: 102,
    stepSec: 0.46,
    bassRoots: [174.61, 196.0, 220.0, 174.61],
    melodyPattern: [349.23, 392.0, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0],
    harmonicPattern: [523.25, 587.33, 698.46, 783.99, 698.46, 587.33, 523.25, 440.0],
  },
  // 5학년 황토·협곡(ochre): 웅장한 D 도리안 5음계 (D4-E4-F4-A4-C5)
  ochre: {
    bpm: 108,
    stepSec: 0.44,
    bassRoots: [146.83, 174.61, 196.0, 164.81],
    melodyPattern: [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63],
    harmonicPattern: [440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0, 392.0],
  },
  // 6학년 설원·고성(snow): 긴장감 있는 A 단조 5음계 (A3-C4-D4-E4-G4)
  snow: {
    bpm: 112,
    stepSec: 0.42,
    bassRoots: [220.0, 196.0, 164.81, 196.0],
    melodyPattern: [440.0, 392.0, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0],
    harmonicPattern: [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 659.25, 523.25],
  },
};

export const PHASE_MIX: Readonly<Record<AudioPhase, PhaseLayerMix>> = {
  PREP_QUIZ: { padGain: 0.24, melodyGain: 0.0, harmonicGain: 0.0, percussionGain: 0.0, tempoFactor: 1.0 },
  BUILD: { padGain: 0.22, melodyGain: 0.16, harmonicGain: 0.0, percussionGain: 0.0, tempoFactor: 1.0 },
  BATTLE: { padGain: 0.2, melodyGain: 0.24, harmonicGain: 0.0, percussionGain: 0.04, tempoFactor: 0.96 },
  BOSS: { padGain: 0.24, melodyGain: 0.26, harmonicGain: 0.12, percussionGain: 0.08, tempoFactor: 0.9 },
  BURNING: { padGain: 0.22, melodyGain: 0.28, harmonicGain: 0.16, percussionGain: 0.07, tempoFactor: 0.88 },
  RESULT: { padGain: 0.0, melodyGain: 0.0, harmonicGain: 0.0, percussionGain: 0.0, tempoFactor: 1.0 },
};

export const RESULT_FANFARE: Readonly<Record<ResultFanfareKind, readonly ResultNote[]>> = {
  clear: [
    { f: 523.25, t: 0, d: 0.11, type: 'triangle', gain: 0.36 },
    { f: 659.25, t: 0.09, d: 0.11, type: 'triangle', gain: 0.36 },
    { f: 783.99, t: 0.18, d: 0.13, type: 'triangle', gain: 0.38 },
    { f: 1046.5, t: 0.3, d: 0.28, type: 'sine', gain: 0.4 },
  ],
  newBest: [
    { f: 523.25, t: 0, d: 0.09, type: 'triangle', gain: 0.38 },
    { f: 659.25, t: 0.08, d: 0.09, type: 'triangle', gain: 0.38 },
    { f: 783.99, t: 0.16, d: 0.1, type: 'triangle', gain: 0.4 },
    { f: 1046.5, t: 0.25, d: 0.14, type: 'triangle', gain: 0.42 },
    { f: 1318.5, t: 0.36, d: 0.3, type: 'sine', gain: 0.32 },
  ],
  defeat: [
    { f: 440.0, t: 0, d: 0.16, type: 'sine', gain: 0.32 },
    { f: 392.0, t: 0.15, d: 0.16, type: 'sine', gain: 0.3 },
    { f: 329.63, t: 0.3, d: 0.28, type: 'triangle', gain: 0.28 },
  ],
};

/** 맵 ID와 학년(R6 3~6학년 바이옴)에서 4대 월드 바이옴을 결정한다. */
export function biomeFromMapId(mapId: string | undefined, grade?: number): AudioBiome {
  if (grade === 4) return 'river';
  if (grade === 5) return 'ochre';
  if (grade === 6) return 'snow';
  if (grade === 3) return 'meadow';
  if (!mapId) return 'meadow';
  const lower = mapId.toLowerCase();
  if (lower.startsWith('river')) return 'river';
  if (lower.startsWith('ochre') || lower.startsWith('courtyard')) return 'ochre';
  if (lower.startsWith('snow')) return 'snow';
  return 'meadow';
}

import {
  BIOME_SCALES,
  PHASE_MIX,
  type AudioBiome,
  type AudioPhase,
  type PhaseLayerMix,
} from './scales';

export interface BgmSceneContext {
  biome: AudioBiome;
  phase: AudioPhase;
  isBossWave: boolean;
  isBurning: boolean;
}

export type TonePlayFn = (
  note: { f: number; t: number; d: number; type: OscillatorType; gain: number },
  at: number,
  bus: GainNode,
) => void;

export type NoisePercPlayFn = (
  gain: number,
  freq: number,
  d: number,
  filter: BiquadFilterType,
  at: number,
  bus: GainNode,
) => void;

/**
 * 0KB WebAudio 3-레이어 적응형 BGM 합성 스케줄러(WP-C2-01).
 * 품질 2+에서는 저음 패드 1레이어만 남기고, 국면·바이옴 전환 시 레이어 믹스를 부드럽게 바꾼다.
 */
export class BgmEngine {
  private context: BgmSceneContext = {
    biome: 'meadow',
    phase: 'PREP_QUIZ',
    isBossWave: false,
    isBurning: false,
  };
  private quality = 0;
  private mix: PhaseLayerMix = PHASE_MIX.PREP_QUIZ;
  private fadeFrom: PhaseLayerMix = PHASE_MIX.PREP_QUIZ;
  private fadeStartSec = -1;
  private step = 0;

  get currentContext(): Readonly<BgmSceneContext> {
    return this.context;
  }

  effectivePhase(c: BgmSceneContext = this.context): AudioPhase {
    if (c.phase === 'RESULT') return 'RESULT';
    if (c.isBurning && (c.phase === 'BATTLE' || c.phase === 'BOSS')) return 'BURNING';
    if (c.isBossWave && c.phase === 'BATTLE') return 'BOSS';
    return c.phase;
  }

  currentMix(atSec: number): PhaseLayerMix {
    const target = this.mix;
    if (this.fadeStartSec < 0) return target;
    const elapsed = atSec - this.fadeStartSec;
    const k = Math.max(0, Math.min(1, elapsed / 0.4));
    if (k >= 1) return target;
    const lerp = (a: number, b: number) => a + (b - a) * k;
    return {
      padGain: lerp(this.fadeFrom.padGain, target.padGain),
      melodyGain: lerp(this.fadeFrom.melodyGain, target.melodyGain),
      harmonicGain: lerp(this.fadeFrom.harmonicGain, target.harmonicGain),
      percussionGain: lerp(this.fadeFrom.percussionGain, target.percussionGain),
      tempoFactor: target.tempoFactor,
    };
  }

  setContext(patch: Partial<BgmSceneContext>, nowSec = 0): void {
    const next: BgmSceneContext = { ...this.context, ...patch };
    const prevPhase = this.effectivePhase(this.context);
    const nextPhase = this.effectivePhase(next);
    this.context = next;
    if (prevPhase !== nextPhase) {
      this.fadeFrom = this.currentMix(nowSec);
      this.mix = PHASE_MIX[nextPhase];
      this.fadeStartSec = nowSec;
    }
  }

  setQuality(quality: number): void {
    this.quality = Math.max(0, Math.floor(quality));
  }

  stepDurationSec(): number {
    const scale = BIOME_SCALES[this.context.biome];
    return Math.max(0.28, scale.stepSec * this.mix.tempoFactor);
  }

  scheduleStep(
    atSec: number,
    bus: GainNode,
    playTone: TonePlayFn,
    playPerc?: NoisePercPlayFn,
  ): void {
    const mix = this.currentMix(atSec);
    const scale = BIOME_SCALES[this.context.biome];
    const dur = this.stepDurationSec();
    const idx = this.step;
    this.step++;

    // 레이어 1: 저음 패드(모든 품질 유지). 마디 첫 박과 4박마다 뿌리음 배치.
    if (mix.padGain > 0.005) {
      const root = scale.bassRoots[Math.floor(idx / 2) % scale.bassRoots.length]!;
      playTone(
        { f: root, t: 0, d: dur * 0.92, type: 'triangle', gain: mix.padGain },
        atSec,
        bus,
      );
    }

    // 품질 2+에서는 CPU 보호를 위해 1레이어만 재생한다.
    if (this.quality >= 2) return;

    // 레이어 2: 주선율 아르페지오
    if (mix.melodyGain > 0.005) {
      const freq = scale.melodyPattern[idx % scale.melodyPattern.length]!;
      playTone(
        { f: freq, t: 0, d: dur * 0.85, type: 'triangle', gain: mix.melodyGain },
        atSec,
        bus,
      );
    }

    // 레이어 2b: BOSS/BURNING 상성 선율
    if (mix.harmonicGain > 0.005 && idx % 2 === 1) {
      const harm = scale.harmonicPattern[idx % scale.harmonicPattern.length]!;
      playTone(
        { f: harm, t: dur * 0.12, d: dur * 0.62, type: 'sine', gain: mix.harmonicGain },
        atSec,
        bus,
      );
    }

    // 레이어 3: BOSS/BURNING 경량 노이즈 퍼커션
    if (mix.percussionGain > 0.005 && playPerc) {
      if (idx % 2 === 0) {
        playPerc(mix.percussionGain, 220, 0.07, 'lowpass', atSec, bus);
      } else {
        playPerc(mix.percussionGain * 0.75, 4200, 0.04, 'highpass', atSec, bus);
      }
    }
  }
}

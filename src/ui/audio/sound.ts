import type { DomainEvent, EngineTowerId } from '../../domain/engineTypes';
import { BgmEngine, type BgmSceneContext } from './bgmEngine';
import { RESULT_FANFARE, type ResultFanfareKind } from './scales';

// 소리(PRD §11.5 · V2 WP-Q4.4 · 동반 고도화 WP-C2-01). 음원 파일(0KB) 없이 WebAudio 합성을 사용한다.
// 도메인 사건을 듣기만 하고 판정·보상에 관여하지 않는다. 첫 사용자 입력 뒤에만 소리를 켜고, 실패하면 무음으로 진행한다.

export interface AudioConfig {
  bgmVolume: number;
  sfxVolume: number;
  /** 발사음 동시 채널. */
  fireChannels: number;
  /** 전체 효과음 동시 채널. */
  sfxChannels: number;
  /** 같은 발사 종류의 최소 간격. */
  sameFireMinGapMs: number;
}

/** 효과음 종류. 정답·오답·누출·버닝·결과가 최우선이고, 넘치면 장식인 발사음부터 생략한다. */
export type Sfx =
  | `fire.${EngineTowerId}`
  | 'kill'
  | 'kill.boss'
  | 'leak'
  | 'correct'
  | 'wrong'
  | 'skipped'
  | 'wave'
  | 'milestone'
  | 'burning'
  | 'towerStage'
  | 'towerUnlocked'
  | `result.${ResultFanfareKind}`;

const PRIORITY: Record<string, number> = {
  correct: 3,
  wrong: 3,
  leak: 3,
  burning: 3,
  'result.clear': 3,
  'result.newBest': 3,
  'result.defeat': 3,
  skipped: 2,
  wave: 2,
  milestone: 2,
  towerUnlocked: 2,
  towerStage: 2,
  'kill.boss': 2,
  kill: 1,
};
const priorityOf = (s: Sfx) => PRIORITY[s] ?? 0;

export interface Voice { sfx: Sfx; startMs: number; endMs: number; stop(): void }

/**
 * 채널 배정(순수 함수). 새 소리를 낼 수 있으면 비울 소리(없으면 null)를 돌려주고, 못 내면 false다.
 * 끝난 소리는 호출자가 미리 빼 둔다.
 */
export function admit(active: readonly Voice[], sfx: Sfx, nowMs: number, lastFire: ReadonlyMap<Sfx, number>, cfg: AudioConfig): Voice | null | false {
  const fire = sfx.startsWith('fire.');
  if (fire) {
    const last = lastFire.get(sfx);
    if (last !== undefined && nowMs - last < cfg.sameFireMinGapMs) return false;
    if (active.filter(v => v.sfx.startsWith('fire.')).length >= cfg.fireChannels) return false;
  }
  if (active.length < cfg.sfxChannels) return null;
  // 전체 채널이 찼으면 우선순위가 더 낮은 소리 가운데 가장 먼저 시작한 것을 비운다.
  const victim = [...active].filter(v => priorityOf(v.sfx) < priorityOf(sfx)).sort((a, b) => priorityOf(a.sfx) - priorityOf(b.sfx) || a.startMs - b.startMs)[0];
  return victim ?? false;
}

/** 사건 → 효과음. 화면에 보이는 결과를 따라갈 뿐 새 사건을 만들지 않는다. */
export function sfxFor(e: DomainEvent, bossEveryWaves: number): Sfx | null {
  switch (e.type) {
    case 'fire': case 'strike': return `fire.${e.towerType}`;
    case 'kill': return e.kind === 'boss' ? 'kill.boss' : 'kill';
    case 'leak': return 'leak';
    case 'answered': return e.result === 'correct' ? 'correct' : e.result === 'wrong' ? 'wrong' : 'skipped';
    case 'burning': return 'burning';
    case 'towerUnlocked': return 'towerUnlocked';
    case 'towerStage': return e.stage > 0 ? 'towerStage' : null;
    case 'waveComplete': return 'wave';
    case 'phase': return e.phase === 'BATTLE' && e.wave % bossEveryWaves === 0 ? 'milestone' : null;
    default: return null;
  }
}

type Note = { f: number; t: number; d: number; type: OscillatorType; gain: number; to?: number };
type NoiseLayer = { t: number; d: number; gain: number; filter: BiquadFilterType; freq: number; Q?: number };

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1567.98;
const STREAK_PITCH_RATIOS = [1, 1.0595, 1.1225, 1.1892, 1.2599, 1.3348] as const;

/** 효과음 악보(초 단위 시작·길이). 짧고 부드럽게, 오답도 겁주지 않는 낮은 두 음이다. */
const SCORE: Record<Sfx, readonly Note[]> = {
  'fire.archer': [{ f: 740, to: 520, t: 0, d: 0.06, type: 'triangle', gain: 0.35 }],
  'fire.cannon': [{ f: 150, to: 70, t: 0, d: 0.14, type: 'sine', gain: 0.7 }],
  'fire.frost': [{ f: 1480, t: 0, d: 0.12, type: 'sine', gain: 0.25 }, { f: 1975, t: 0.03, d: 0.1, type: 'sine', gain: 0.15 }],
  'fire.crossbow': [{ f: 820, to: 560, t: 0, d: 0.06, type: 'triangle', gain: 0.35 }],
  'fire.mage': [{ f: 1200, to: 1600, t: 0, d: 0.1, type: 'sine', gain: 0.2 }],
  'fire.lightning': [{ f: 900, to: 300, t: 0, d: 0.08, type: 'sawtooth', gain: 0.2 }],
  'fire.flame': [{ f: 300, to: 260, t: 0, d: 0.1, type: 'triangle', gain: 0.25 }],
  'fire.spear': [{ f: 220, to: 160, t: 0, d: 0.08, type: 'square', gain: 0.2 }],
  'fire.guardian': [{ f: 180, to: 140, t: 0, d: 0.1, type: 'square', gain: 0.2 }],
  'fire.banner': [{ f: 600, t: 0, d: 0.08, type: 'triangle', gain: 0.2 }],
  'fire.sling': [{ f: 520, to: 380, t: 0, d: 0.06, type: 'triangle', gain: 0.3 }],
  'fire.ballista': [{ f: 640, to: 300, t: 0, d: 0.1, type: 'triangle', gain: 0.35 }],
  'fire.falcon': [{ f: 1600, to: 1100, t: 0, d: 0.08, type: 'sine', gain: 0.2 }],
  'fire.mortar': [{ f: 135, to: 58, t: 0, d: 0.16, type: 'sine', gain: 0.68 }, { f: 92, to: 48, t: 0, d: 0.12, type: 'triangle', gain: 0.32 }],
  'fire.hwacha': [{ f: 700, to: 500, t: 0, d: 0.05, type: 'triangle', gain: 0.25 }],
  'fire.roller': [{ f: 110, to: 90, t: 0, d: 0.18, type: 'triangle', gain: 0.4 }],
  'fire.alchemist': [{ f: 500, to: 800, t: 0, d: 0.1, type: 'sine', gain: 0.2 }],
  'fire.wind': [{ f: 400, to: 250, t: 0, d: 0.12, type: 'sine', gain: 0.2 }],
  'fire.trap': [{ f: 260, to: 200, t: 0, d: 0.08, type: 'square', gain: 0.18 }],
  'fire.bell': [{ f: 523, t: 0, d: 0.25, type: 'sine', gain: 0.3 }],
  'fire.rail': [{ f: 1240, to: 420, t: 0, d: 0.06, type: 'triangle', gain: 0.28 }],
  'fire.cryo': [{ f: 980, to: 740, t: 0, d: 0.15, type: 'sine', gain: 0.26 }, { f: 1960, to: 1480, t: 0.015, d: 0.09, type: 'sine', gain: 0.12 }],
  'fire.prism': [{ f: 760, to: 1520, t: 0, d: 0.11, type: 'sine', gain: 0.22 }, { f: 1140, to: 2280, t: 0.01, d: 0.09, type: 'sine', gain: 0.11 }],
  'fire.hangar': [{ f: 540, t: 0, d: 0.045, type: 'triangle', gain: 0.22 }, { f: 645, t: 0.04, d: 0.045, type: 'triangle', gain: 0.18 }],
  'fire.bastion': [{ f: 230, to: 110, t: 0, d: 0.13, type: 'triangle', gain: 0.4 }],
  kill: [{ f: 880, to: 1320, t: 0, d: 0.06, type: 'square', gain: 0.11 }],
  'kill.boss': [{ f: 220, to: 110, t: 0, d: 0.18, type: 'triangle', gain: 0.45 }, { f: 880, to: 1320, t: 0.04, d: 0.14, type: 'triangle', gain: 0.22 }],
  leak: [{ f: 140, to: 90, t: 0, d: 0.28, type: 'triangle', gain: 0.6 }],
  correct: [{ f: C6, t: 0, d: 0.09, type: 'triangle', gain: 0.5 }, { f: E6, t: 0.09, d: 0.14, type: 'triangle', gain: 0.5 }],
  wrong: [{ f: 330, t: 0, d: 0.12, type: 'sine', gain: 0.45 }, { f: 262, t: 0.12, d: 0.18, type: 'sine', gain: 0.45 }],
  skipped: [{ f: C5, t: 0, d: 0.08, type: 'sine', gain: 0.3 }],
  wave: [{ f: C5, t: 0, d: 0.1, type: 'triangle', gain: 0.4 }, { f: E5, t: 0.1, d: 0.1, type: 'triangle', gain: 0.4 }, { f: G5, t: 0.2, d: 0.2, type: 'triangle', gain: 0.4 }],
  milestone: [{ f: 196, t: 0, d: 0.18, type: 'triangle', gain: 0.5 }, { f: 196, t: 0.3, d: 0.3, type: 'triangle', gain: 0.5 }],
  burning: [{ f: E5, to: G5, t: 0, d: 0.11, type: 'triangle', gain: 0.38 }, { f: C6, to: E6, t: 0.08, d: 0.18, type: 'sine', gain: 0.36 }],
  towerStage: [{ f: G5, t: 0, d: 0.07, type: 'triangle', gain: 0.35 }, { f: C6, t: 0.06, d: 0.13, type: 'triangle', gain: 0.38 }],
  towerUnlocked: [
    { f: C5, t: 0, d: 0.08, type: 'triangle', gain: 0.38 },
    { f: E5, t: 0.07, d: 0.08, type: 'triangle', gain: 0.38 },
    { f: G5, t: 0.14, d: 0.1, type: 'triangle', gain: 0.4 },
    { f: C6, t: 0.22, d: 0.22, type: 'triangle', gain: 0.42 },
    { f: G6, t: 0.24, d: 0.18, type: 'sine', gain: 0.22 },
  ],
  'result.clear': RESULT_FANFARE.clear,
  'result.newBest': RESULT_FANFARE.newBest,
  'result.defeat': RESULT_FANFARE.defeat,
};

/** 0KB 캐시 화이트 노이즈 + 필터 레이어(WebAudio 미지원 모의 컨텍스트는 자동 건너뜀). */
const NOISE_SCORE: Partial<Record<Sfx, NoiseLayer>> = {
  'fire.rail': { t: 0, d: 0.04, gain: 0.12, filter: 'highpass', freq: 2400 },
  'fire.mortar': { t: 0, d: 0.14, gain: 0.26, filter: 'lowpass', freq: 460, Q: 1.2 },
  'fire.cryo': { t: 0.01, d: 0.1, gain: 0.14, filter: 'bandpass', freq: 3800, Q: 3.0 },
  'fire.hangar': { t: 0, d: 0.055, gain: 0.1, filter: 'bandpass', freq: 1400, Q: 2.0 },
  'fire.bastion': { t: 0, d: 0.1, gain: 0.16, filter: 'lowpass', freq: 360, Q: 1.4 },
  'kill.boss': { t: 0, d: 0.22, gain: 0.25, filter: 'lowpass', freq: 620, Q: 1.0 },
  burning: { t: 0, d: 0.2, gain: 0.15, filter: 'bandpass', freq: 1700, Q: 1.4 },
};

const lengthOf = (notes: readonly Note[]) => Math.max(...notes.map(n => n.t + n.d));

export class SoundDirector {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private voices: Voice[] = [];
  private lastFire = new Map<Sfx, number>();
  private readonly towerWeapons = new Map<number, number>();
  private readonly bgmEngine = new BgmEngine();
  private correctStreakCount = 0;
  private synthSeed = 0x9e3779b9;
  private enabled = true;
  private backgroundUnlocked = false;
  private paused = false;
  private hidden = false;
  private bgmVolume: number;
  private sfxVolume: number;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmNext = 0;
  private previewStopTimer: ReturnType<typeof setTimeout> | null = null;
  private previewStops: Array<() => void> = [];
  private visibilityListener: (() => void) | null = null;

  constructor(private readonly cfg: AudioConfig, private readonly bossEveryWaves: number, private readonly create: () => AudioContext = () => new AudioContext()) {
    this.bgmVolume = cfg.bgmVolume;
    this.sfxVolume = cfg.sfxVolume;
  }

  /** 현재 퀴즈 연속 정답 단계(테스트·검증 조회용). */
  get correctStreak(): number { return this.correctStreakCount; }
  get hasCompressor(): boolean { return this.compressor !== null; }
  get sceneContext(): Readonly<BgmSceneContext> { return this.bgmEngine.currentContext; }

  private ensureContext(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = this.create();
      this.sfxBus = this.ctx.createGain();
      this.bgmBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.bgmBus.gain.value = this.bgmVolume;
      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 6;
        comp.attack.value = 0.005;
        comp.release.value = 0.18;
        this.sfxBus.connect(comp);
        this.bgmBus.connect(comp);
        comp.connect(this.ctx.destination);
        this.compressor = comp;
      } else {
        this.sfxBus.connect(this.ctx.destination);
        this.bgmBus.connect(this.ctx.destination);
        this.compressor = null;
      }
      this.attachVisibility();
      return true;
    } catch {
      this.ctx = null;
      this.sfxBus = null;
      this.bgmBus = null;
      this.compressor = null;
      return false;
    }
  }

  private attachVisibility(): void {
    if (this.visibilityListener || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    this.hidden = document.visibilityState === 'hidden';
    const onChange = () => {
      this.hidden = document.visibilityState === 'hidden';
      this.sync();
    };
    document.addEventListener('visibilitychange', onChange);
    this.visibilityListener = () => document.removeEventListener('visibilitychange', onChange);
  }

  /** 첫 사용자 입력에서 부른다. 만들 수 없으면 무음으로 둔다. */
  unlock() {
    this.backgroundUnlocked = true;
    this.ensureContext();
    this.sync();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopPreview();
    this.sync();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.stopPreview();
    this.sync();
  }
  setQuality(quality: number) { this.bgmEngine.setQuality(quality); }

  /** 전장 국면·바이옴 변화 알림(오디오 국면 전환). */
  setSceneContext(patch: Partial<BgmSceneContext>) {
    this.bgmEngine.setContext(patch, this.ctx?.currentTime ?? 0);
    if (patch.phase === 'RESULT') {
      this.stopBgm();
    } else if (this.ctx && this.backgroundUnlocked) {
      this.sync();
    }
  }

  /** 배경 음악·효과음 크기를 즉시 갱신한다(설정 모달·전투 중 공통). */
  setVolumes(bgmVolume: number, sfxVolume: number) {
    this.bgmVolume = Math.max(0, Math.min(1, bgmVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    if (this.bgmBus) this.bgmBus.gain.value = this.bgmVolume;
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
  }

  /** 설정 모달의 효과음 미리 듣기. 배경 선율은 켜지 않고 선택한 효과음만 한 번 들려준다. */
  preview(sfx: Sfx) {
    if (!this.enabled) return;
    if (!this.ensureContext() || !this.ctx || !this.sfxBus) return;
    void this.ctx.resume?.().catch(() => undefined);
    this.play(sfx);
  }

  /** 설정 모달에서 현재 바이옴 배경 선율을 짧게 미리 듣는다(기존 bgmEngine 상태를 덮어쓰지 않음). */
  previewBgm(durationMs = 1600) {
    if (!this.enabled) return;
    if (!this.ensureContext() || !this.ctx || !this.bgmBus) return;
    void this.ctx.resume?.().catch(() => undefined);
    this.stopPreview();
    const previewEngine = new BgmEngine();
    previewEngine.setContextImmediate({
      biome: this.bgmEngine.currentContext.biome,
      phase: 'BATTLE',
      isBossWave: false,
      isBurning: false,
    });
    const t0 = this.ctx.currentTime;
    const step = previewEngine.stepDurationSec();
    for (let i = 0; i < 3; i++) {
      previewEngine.scheduleStep(
        t0 + i * step,
        this.bgmBus,
        (n, at, bus) => { this.previewStops.push(this.tone(n, at, bus)); },
        (gain, freq, d, filter, at, bus) => {
          const stop = this.noise({ t: 0, d, gain, filter, freq, Q: 1.0 }, 1, at, bus);
          if (stop) this.previewStops.push(stop);
        },
      );
    }
    this.previewStopTimer = setTimeout(() => {
      this.previewStopTimer = null;
      this.stopPreview();
    }, durationMs);
  }

  /** 결과 화면 3종 팡파르(clear · newBest · defeat)를 BGM 정지 직후 안전하게 울린다. */
  playResultFanfare(kind: ResultFanfareKind) {
    this.setSceneContext({ phase: 'RESULT' });
    this.stopPreview();
    if (!this.enabled || this.hidden) return;
    if (!this.ensureContext() || !this.ctx || !this.sfxBus) return;
    void this.ctx.resume?.().catch(() => undefined);
    this.play(`result.${kind}`);
  }

  private stopPreview() {
    if (this.previewStopTimer) {
      clearTimeout(this.previewStopTimer);
      this.previewStopTimer = null;
    }
    for (const stop of this.previewStops) stop();
    this.previewStops = [];
  }

  /** 소리를 낼 수 있는 상태(켜짐·정지 아님·준비됨)에서만 효과음을 낸다. */
  handle(events: readonly DomainEvent[]) {
    if (!this.ctx || !this.enabled || this.paused || this.hidden) return;
    for (const e of events) {
      if (e.type === 'towerStage') {
        this.towerWeapons.set(e.towerId, e.weapon);
      } else if (e.type === 'answered') {
        if (e.result === 'correct') this.correctStreakCount = Math.min(5, this.correctStreakCount + 1);
        else this.correctStreakCount = 0;
      }
      const sfx = sfxFor(e, this.bossEveryWaves);
      if (!sfx) continue;
      let pitchScale = 1;
      if (sfx === 'correct') {
        pitchScale = STREAK_PITCH_RATIOS[Math.max(0, this.correctStreakCount - 1)] ?? 1;
      } else if (e.type === 'fire' || e.type === 'strike') {
        const weapon = this.towerWeapons.get(e.towerId) ?? 0;
        const jitter = 1 + (this.nextSynthRand() * 2 - 1) * 0.04;
        pitchScale = (1 + weapon * 0.05) * jitter;
      }
      this.play(sfx, pitchScale);
    }
  }

  get activeVoices(): readonly Voice[] { return this.voices; }
  get bgmRunning() { return this.bgmTimer !== null; }

  dispose() {
    this.stopBgm();
    this.stopPreview();
    this.visibilityListener?.();
    this.visibilityListener = null;
    for (const v of this.voices) v.stop();
    this.voices = [];
    this.noiseBuffer = null;
    this.compressor = null;
    this.sfxBus = null;
    this.bgmBus = null;
    this.towerWeapons.clear();
    this.correctStreakCount = 0;
    void this.ctx?.close?.().catch(() => undefined);
    this.ctx = null;
  }

  private play(sfx: Sfx, pitchScale = 1) {
    const ctx = this.ctx!;
    const nowMs = ctx.currentTime * 1000;
    this.voices = this.voices.filter(v => v.endMs > nowMs);
    const slot = admit(this.voices, sfx, nowMs, this.lastFire, this.cfg);
    if (slot === false) return;
    if (slot) { slot.stop(); this.voices = this.voices.filter(v => v !== slot); }
    if (sfx.startsWith('fire.')) this.lastFire.set(sfx, nowMs);
    const notes = SCORE[sfx];
    const stops = notes.map(n => this.tone({
      ...n,
      f: n.f * pitchScale,
      ...(n.to !== undefined ? { to: n.to * pitchScale } : {}),
    }, ctx.currentTime, this.sfxBus!));
    const noiseLayer = NOISE_SCORE[sfx];
    if (noiseLayer) {
      const stopNoise = this.noise(noiseLayer, pitchScale, ctx.currentTime, this.sfxBus!);
      if (stopNoise) stops.push(stopNoise);
    }
    this.voices.push({ sfx, startMs: nowMs, endMs: nowMs + lengthOf(notes) * 1000, stop: () => stops.forEach(s => s()) });
  }

  private nextSynthRand(): number {
    this.synthSeed = (Math.imul(this.synthSeed, 1664525) + 1013904223) >>> 0;
    return this.synthSeed / 0x1_0000_0000;
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    if (typeof ctx.createBuffer !== 'function') return null;
    const rate = ctx.sampleRate || 44100;
    const length = Math.max(1, Math.floor(rate * 0.35));
    const buf = ctx.createBuffer(1, length, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < length; i++) ch[i] = this.nextSynthRand() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  private noise(n: NoiseLayer, pitchScale: number, at: number, bus: GainNode): (() => void) | null {
    const ctx = this.ctx!;
    if (typeof ctx.createBufferSource !== 'function' || typeof ctx.createBiquadFilter !== 'function') return null;
    const buf = this.ensureNoiseBuffer(ctx);
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = n.filter;
    filter.frequency.setValueAtTime(n.freq * pitchScale, at + n.t);
    if (n.Q !== undefined) filter.Q.setValueAtTime(n.Q, at + n.t);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at + n.t);
    env.gain.linearRampToValueAtTime(n.gain, at + n.t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + n.t + n.d);
    src.connect(filter);
    filter.connect(env);
    env.connect(bus);
    src.start(at + n.t);
    src.stop(at + n.t + n.d + 0.02);
    return () => { try { src.stop(); } catch { /* 이미 끝남 */ } };
  }

  /** 짧은 음 하나: 빠르게 올라갔다 지수로 사라진다. 돌려준 함수로 즉시 멈춘다. */
  private tone(n: Note, at: number, bus: GainNode): () => void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = n.type;
    osc.frequency.setValueAtTime(n.f, at + n.t);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, at + n.t + n.d);
    env.gain.setValueAtTime(0.0001, at + n.t);
    env.gain.linearRampToValueAtTime(n.gain, at + n.t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + n.t + n.d);
    osc.connect(env); env.connect(bus);
    osc.start(at + n.t); osc.stop(at + n.t + n.d + 0.02);
    return () => { try { osc.stop(); } catch { /* 이미 끝남 */ } };
  }

  /** 켜짐·정지·숨김 상태를 맞춘다. 배경 선율 타이머는 하나만 둔다(음소거·정지·재개를 반복해도 겹치지 않는다). */
  private sync() {
    const ctx = this.ctx;
    if (!ctx) return;
    const audible = this.enabled && !this.paused && !this.hidden;
    if (audible) { void ctx.resume?.().catch(() => undefined); if (this.backgroundUnlocked) this.startBgm(); }
    else {
      this.stopBgm();
      for (const v of this.voices) v.stop();
      this.voices = [];
      if (this.paused || this.hidden) void ctx.suspend?.().catch(() => undefined);
    }
  }

  private startBgm() {
    if (this.bgmTimer || !this.ctx) return;
    if (this.bgmEngine.currentContext.phase === 'RESULT') return;
    this.bgmNext = this.ctx.currentTime + 0.1;
    // 0.2초마다 0.6초 앞까지 음을 예약한다(백그라운드 복귀 시 최대 4스텝 상한으로 스파이크 방지).
    const schedule = () => {
      const ctx = this.ctx;
      if (!ctx || !this.bgmBus) return;
      if (this.bgmNext < ctx.currentTime - 0.1) {
        this.bgmNext = ctx.currentTime + 0.05;
      }
      let steps = 0;
      while (this.bgmNext < ctx.currentTime + 0.6 && steps < 4) {
        steps++;
        const step = this.bgmEngine.stepDurationSec();
        this.bgmEngine.scheduleStep(
          this.bgmNext,
          this.bgmBus,
          (n, at, bus) => { this.tone(n, at, bus); },
          (gain, freq, d, filter, at, bus) => { this.noise({ t: 0, d, gain, filter, freq, Q: 1.0 }, 1, at, bus); },
        );
        this.bgmNext += step;
      }
    };
    schedule();
    this.bgmTimer = setInterval(schedule, 200);
  }

  private stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }
}

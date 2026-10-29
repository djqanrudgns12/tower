import type { TowerId } from '../../contracts/balance';
import type { DomainEvent } from '../../domain/events';

// 소리(PRD §11.5). P1은 음원 파일 없이 WebAudio로 짧은 효과음과 배경 선율을 합성한다.
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

/** 효과음 종류. 정답·오답·누출이 가장 먼저이고, 넘치면 장식인 발사음부터 생략한다. */
export type Sfx = `fire.${TowerId}` | 'kill' | 'leak' | 'correct' | 'wrong' | 'skipped' | 'wave' | 'milestone';
const PRIORITY: Record<string, number> = { correct: 3, wrong: 3, leak: 3, skipped: 2, wave: 2, milestone: 2, kill: 1 };
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
    case 'kill': return 'kill';
    case 'leak': return 'leak';
    case 'answered': return e.result === 'correct' ? 'correct' : e.result === 'wrong' ? 'wrong' : 'skipped';
    case 'waveComplete': return 'wave';
    case 'phase': return e.phase === 'BATTLE' && e.wave % bossEveryWaves === 0 ? 'milestone' : null;
    default: return null;
  }
}

type Note = { f: number; t: number; d: number; type: OscillatorType; gain: number; to?: number };
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5;
/** 효과음 악보(초 단위 시작·길이). 짧고 부드럽게, 오답도 겁주지 않는 낮은 두 음이다. */
const SCORE: Record<Sfx, Note[]> = {
  'fire.archer': [{ f: 740, to: 520, t: 0, d: 0.06, type: 'triangle', gain: 0.35 }],
  'fire.cannon': [{ f: 150, to: 70, t: 0, d: 0.14, type: 'sine', gain: 0.7 }],
  'fire.frost': [{ f: 1480, t: 0, d: 0.12, type: 'sine', gain: 0.25 }, { f: 1975, t: 0.03, d: 0.1, type: 'sine', gain: 0.15 }],
  // P2 타워는 아직 전투에 없지만 종류마다 소리 자리를 둔다.
  'fire.crossbow': [{ f: 820, to: 560, t: 0, d: 0.06, type: 'triangle', gain: 0.35 }],
  'fire.mage': [{ f: 1200, to: 1600, t: 0, d: 0.1, type: 'sine', gain: 0.2 }],
  'fire.lightning': [{ f: 900, to: 300, t: 0, d: 0.08, type: 'sawtooth', gain: 0.2 }],
  'fire.flame': [{ f: 300, to: 260, t: 0, d: 0.1, type: 'triangle', gain: 0.25 }],
  'fire.spear': [{ f: 220, to: 160, t: 0, d: 0.08, type: 'square', gain: 0.2 }],
  'fire.guardian': [{ f: 180, to: 140, t: 0, d: 0.1, type: 'square', gain: 0.2 }],
  'fire.banner': [{ f: 600, t: 0, d: 0.08, type: 'triangle', gain: 0.2 }],
  kill: [{ f: 880, to: 1320, t: 0, d: 0.06, type: 'square', gain: 0.12 }],
  leak: [{ f: 140, to: 90, t: 0, d: 0.28, type: 'triangle', gain: 0.6 }],
  correct: [{ f: C6, t: 0, d: 0.09, type: 'triangle', gain: 0.5 }, { f: E6, t: 0.09, d: 0.14, type: 'triangle', gain: 0.5 }],
  wrong: [{ f: 330, t: 0, d: 0.12, type: 'sine', gain: 0.45 }, { f: 262, t: 0.12, d: 0.18, type: 'sine', gain: 0.45 }],
  skipped: [{ f: C5, t: 0, d: 0.08, type: 'sine', gain: 0.3 }],
  wave: [{ f: C5, t: 0, d: 0.1, type: 'triangle', gain: 0.4 }, { f: E5, t: 0.1, d: 0.1, type: 'triangle', gain: 0.4 }, { f: G5, t: 0.2, d: 0.2, type: 'triangle', gain: 0.4 }],
  milestone: [{ f: 196, t: 0, d: 0.18, type: 'triangle', gain: 0.5 }, { f: 196, t: 0.3, d: 0.3, type: 'triangle', gain: 0.5 }],
};
const lengthOf = (notes: Note[]) => Math.max(...notes.map(n => n.t + n.d));

/** 배경 선율: 5음 음계의 느린 8음 반복(한 바퀴 4초). */
const BGM = [392, 440, 523.25, 587.33, 523.25, 440, 392, 329.63];
const BGM_STEP = 0.5;

export class SoundDirector {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private voices: Voice[] = [];
  private lastFire = new Map<Sfx, number>();
  private enabled = true;
  private paused = false;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmNext = 0;
  private bgmStep = 0;

  constructor(private readonly cfg: AudioConfig, private readonly bossEveryWaves: number, private readonly create: () => AudioContext = () => new AudioContext()) {}

  /** 첫 사용자 입력에서 부른다. 만들 수 없으면 무음으로 둔다. */
  unlock() {
    if (this.ctx) { void this.ctx.resume?.().catch(() => undefined); return; }
    try {
      this.ctx = this.create();
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.cfg.sfxVolume; this.sfxBus.connect(this.ctx.destination);
      this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = this.cfg.bgmVolume; this.bgmBus.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    this.sync();
  }

  setEnabled(on: boolean) { this.enabled = on; this.sync(); }
  setPaused(paused: boolean) { this.paused = paused; this.sync(); }

  /** 소리를 낼 수 있는 상태(켜짐·정지 아님·준비됨)에서만 효과음을 낸다. */
  handle(events: readonly DomainEvent[]) {
    if (!this.ctx || !this.enabled || this.paused) return;
    for (const e of events) {
      const sfx = sfxFor(e, this.bossEveryWaves);
      if (sfx) this.play(sfx);
    }
  }

  get activeVoices(): readonly Voice[] { return this.voices; }
  get bgmRunning() { return this.bgmTimer !== null; }

  dispose() {
    this.stopBgm();
    for (const v of this.voices) v.stop();
    this.voices = [];
    void this.ctx?.close?.().catch(() => undefined);
    this.ctx = null;
  }

  private play(sfx: Sfx) {
    const ctx = this.ctx!;
    const nowMs = ctx.currentTime * 1000;
    this.voices = this.voices.filter(v => v.endMs > nowMs);
    const slot = admit(this.voices, sfx, nowMs, this.lastFire, this.cfg);
    if (slot === false) return;
    if (slot) { slot.stop(); this.voices = this.voices.filter(v => v !== slot); }
    if (sfx.startsWith('fire.')) this.lastFire.set(sfx, nowMs);
    const notes = SCORE[sfx];
    const stops = notes.map(n => this.tone(n, ctx.currentTime, this.sfxBus!));
    this.voices.push({ sfx, startMs: nowMs, endMs: nowMs + lengthOf(notes) * 1000, stop: () => stops.forEach(s => s()) });
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

  /** 켜짐·정지 상태를 맞춘다. 배경 선율 타이머는 하나만 둔다(음소거·정지·재개를 반복해도 겹치지 않는다). */
  private sync() {
    const ctx = this.ctx;
    if (!ctx) return;
    const audible = this.enabled && !this.paused;
    if (audible) { void ctx.resume?.().catch(() => undefined); this.startBgm(); }
    else {
      this.stopBgm();
      for (const v of this.voices) v.stop();
      this.voices = [];
      if (this.paused) void ctx.suspend?.().catch(() => undefined);
    }
  }

  private startBgm() {
    if (this.bgmTimer || !this.ctx) return;
    this.bgmNext = this.ctx.currentTime + 0.1;
    // 0.2초마다 0.6초 앞까지 음을 예약한다(타이머가 늦어도 선율이 끊기지 않게).
    const schedule = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      while (this.bgmNext < ctx.currentTime + 0.6) {
        this.tone({ f: BGM[this.bgmStep % BGM.length]!, t: 0, d: BGM_STEP * 0.9, type: 'triangle', gain: 0.3 }, this.bgmNext, this.bgmBus!);
        this.bgmNext += BGM_STEP;
        this.bgmStep++;
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

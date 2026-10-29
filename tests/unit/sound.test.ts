import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '../../src/content';
import type { DomainEvent } from '../../src/domain/events';
import { admit, SoundDirector, sfxFor, type AudioConfig, type Voice } from '../../src/ui/audio/sound';

// PRD §11.5: 발사음 4채널·전체 8채널·같은 발사 80ms, 정답·오답·누출 우선, 음소거·정지·재개에도 배경 루프 하나.
const cfg: AudioConfig = DEFAULTS.audio;
const voice = (sfx: Voice['sfx'], startMs: number): Voice => ({ sfx, startMs, endMs: startMs + 500, stop: vi.fn() });

/** 실제 소리 없이 만든 노드 수만 세는 AudioContext. */
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const ctx = {
    currentTime: 0, state: 'running', destination: {}, oscillators: 0,
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => { ctx.oscillators++; return { type: 'sine', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; },
    resume: vi.fn(() => Promise.resolve()), suspend: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()),
  };
  return ctx;
}
const fire = (towerType: 'archer' | 'cannon', projectileId = 1): DomainEvent => ({ type: 'fire', projectileId, towerId: 1, towerType });

afterEach(() => { vi.useRealTimers(); });

describe('소리 채널 배정(PRD §11.5)', () => {
  it('같은 발사 종류는 80ms 안에 다시 내지 않는다', () => {
    const last = new Map([['fire.archer' as const, 1000]]);
    expect(admit([], 'fire.archer', 1000 + cfg.sameFireMinGapMs - 1, last, cfg)).toBe(false);
    expect(admit([], 'fire.archer', 1000 + cfg.sameFireMinGapMs, last, cfg)).toBeNull();
    expect(admit([], 'fire.cannon', 1001, last, cfg)).toBeNull();
  });

  it('발사음은 동시에 4개까지만 낸다', () => {
    const four = Array.from({ length: cfg.fireChannels }, (_, i) => voice(i % 2 ? 'fire.cannon' : 'fire.archer', i));
    expect(admit(four, 'fire.frost', 10, new Map(), cfg)).toBe(false);
    expect(admit(four, 'kill', 10, new Map(), cfg)).toBeNull();
  });

  it('전체 8채널이 차면 정답음은 가장 오래된 발사음을 밀어내고, 같은 우선순위끼리는 밀어내지 않는다', () => {
    const full = [...Array.from({ length: 4 }, (_, i) => voice('fire.archer', 100 + i)), ...Array.from({ length: 4 }, (_, i) => voice('kill', i))];
    expect(admit(full, 'correct', 200, new Map(), cfg)).toBe(full[0]);
    const important = Array.from({ length: cfg.sfxChannels }, (_, i) => voice('wrong', i));
    expect(admit(important, 'leak', 200, new Map(), cfg)).toBe(false);
  });

  it('고비 웨이브 전투 시작만 예고음을 낸다', () => {
    expect(sfxFor({ type: 'phase', phase: 'BATTLE', wave: 5 }, 5)).toBe('milestone');
    expect(sfxFor({ type: 'phase', phase: 'BATTLE', wave: 4 }, 5)).toBeNull();
    expect(sfxFor({ type: 'answered', encounterId: 1, result: 'skipped', pt: 0, gold: 0 }, 5)).toBe('skipped');
  });
});

describe('SoundDirector', () => {
  it('첫 입력(unlock) 전에는 아무 소리도 만들지 않는다', () => {
    const ctx = fakeContext();
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.handle([fire('archer')]);
    expect(ctx.oscillators).toBe(0);
  });

  it('음소거·정지·재개를 반복해도 배경 선율 타이머는 하나뿐이고, 꺼진 동안에는 효과음을 내지 않는다', () => {
    vi.useFakeTimers();
    const interval = vi.spyOn(globalThis, 'setInterval');
    const ctx = fakeContext();
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.unlock();
    expect(sound.bgmRunning).toBe(true);
    for (let i = 0; i < 3; i++) { sound.setEnabled(false); sound.setEnabled(true); sound.setPaused(true); sound.setPaused(false); sound.setEnabled(true); }
    const live = interval.mock.results.length - vi.getTimerCount();
    expect(vi.getTimerCount()).toBe(1);
    expect(live).toBeGreaterThan(0);

    sound.setPaused(true);
    expect(ctx.suspend).toHaveBeenCalled();
    const before = ctx.oscillators;
    sound.handle([{ type: 'answered', encounterId: 1, result: 'correct', pt: 10, gold: 5 }]);
    expect(ctx.oscillators).toBe(before);
    expect(sound.bgmRunning).toBe(false);

    sound.setPaused(false);
    sound.handle([{ type: 'answered', encounterId: 2, result: 'correct', pt: 10, gold: 5 }]);
    expect(sound.activeVoices.map(v => v.sfx)).toEqual(['correct']);
    sound.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('같은 틱의 발사 6개 가운데 같은 종류는 한 번, 서로 다른 종류도 4채널까지만 낸다', () => {
    const ctx = fakeContext();
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.unlock();
    const kinds = ['archer', 'archer', 'cannon', 'frost', 'crossbow', 'mage'] as const;
    sound.handle(kinds.map((towerType, i): DomainEvent => ({ type: 'fire', projectileId: i, towerId: i, towerType })));
    expect(sound.activeVoices.map(v => v.sfx)).toEqual(['fire.archer', 'fire.cannon', 'fire.frost', 'fire.crossbow']);
    sound.dispose();
  });
});

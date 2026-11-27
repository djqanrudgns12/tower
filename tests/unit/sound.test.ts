import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '../../src/content';
import { R6_TOWERS } from '../../src/contracts/balanceV2';
import type { DomainEvent } from '../../src/domain/events';
import { biomeFromMapId } from '../../src/ui/audio/scales';
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

  it.each(R6_TOWERS)('R6 %s 발사를 처리하면 효과음 채널에 등록한다', towerType => {
    const ctx = fakeContext();
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.unlock();
    try {
      sound.handle([{ type: 'fire', projectileId: 1, towerId: 1, towerType }]);
      expect(sound.activeVoices.map(v => v.sfx)).toEqual([`fire.${towerType}`]);
    } finally {
      sound.dispose();
    }
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

  it('노이즈·필터 지원 환경과 연속 정답 피치·버닝/진화/해금·보스 처치 이벤트를 처리한다', () => {
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const freqs: number[] = [];
    const ctx = {
      ...fakeContext(),
      sampleRate: 44100,
      noiseSources: 0,
      filters: 0,
      createOscillator: () => ({
        type: 'sine',
        frequency: {
          ...param(),
          setValueAtTime: vi.fn((v: number) => { freqs.push(v); }),
        },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      }),
      createBuffer: (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBufferSource: () => { ctx.noiseSources++; return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; },
      createBiquadFilter: () => { ctx.filters++; return { type: 'lowpass', frequency: param(), Q: param(), connect: vi.fn() }; },
    };
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.unlock();
    sound.handle([
      { type: 'answered', encounterId: 1, result: 'correct', pt: 10, gold: 5 },
      { type: 'answered', encounterId: 2, result: 'correct', pt: 10, gold: 5 },
    ]);
    expect(sound.correctStreak).toBe(2);
    expect(freqs[2]!).toBeGreaterThan(freqs[0]!);
    sound.handle([{ type: 'answered', encounterId: 3, result: 'wrong', pt: 0, gold: 0 }]);
    expect(sound.correctStreak).toBe(0);

    sound.handle([
      { type: 'burning', untilTick: 100 },
      { type: 'towerUnlocked', tower: 'prism', wave: 3 },
      { type: 'towerStage', towerId: 1, stage: 3, weapon: 1, tick: 10 },
      { type: 'fire', projectileId: 1, towerId: 1, towerType: 'rail' },
      { type: 'kill', enemyId: 99, kind: 'boss', elite: false, x: 100, y: 100, gold: 20, pt: 10 },
    ]);
    expect(sound.activeVoices.map(v => v.sfx)).toEqual(
      expect.arrayContaining(['burning', 'towerUnlocked', 'towerStage', 'fire.rail', 'kill.boss']),
    );
    expect(ctx.noiseSources).toBeGreaterThanOrEqual(3);
    expect(ctx.filters).toBeGreaterThanOrEqual(3);
    sound.dispose();
  });

  it('WP-C2-01: DynamicsCompressorNode 마스터 리미터를 연결하고 미지원 환경에서는 직결 폴백한다', () => {
    const compCtx = {
      ...fakeContext(),
      createDynamicsCompressor: () => ({
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect: vi.fn(),
      }),
    };
    const s1 = new SoundDirector(cfg, 5, () => compCtx as unknown as AudioContext);
    s1.unlock();
    expect(s1.hasCompressor).toBe(true);
    s1.dispose();

    const plainCtx = fakeContext();
    const s2 = new SoundDirector(cfg, 5, () => plainCtx as unknown as AudioContext);
    s2.unlock();
    expect(s2.hasCompressor).toBe(false);
    s2.dispose();
  });

  it('WP-C2-01: 4바이옴·5국면 전환, 품질 2+ 1레이어 축소, 결과 3종 팡파르, 30분 가상 실행에서도 타이머·보이스 누수가 없다', () => {
    vi.useFakeTimers();
    const ctx = fakeContext();
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.unlock();
    expect(vi.getTimerCount()).toBe(1);

    for (const biome of ['meadow', 'river', 'ochre', 'snow'] as const) {
      for (const phase of ['PREP_QUIZ', 'BUILD', 'BATTLE', 'BOSS', 'BURNING'] as const) {
        sound.setSceneContext({ biome, phase, isBossWave: phase === 'BOSS', isBurning: phase === 'BURNING' });
        vi.advanceTimersByTime(1500);
        expect(vi.getTimerCount()).toBe(1);
      }
    }

    // 30분 장기 전환 시뮬레이션 후 품질 2+ 감축·결과 팡파르
    sound.setQuality(2);
    const beforeQ2 = ctx.oscillators;
    vi.advanceTimersByTime(1000);
    expect(ctx.oscillators - beforeQ2).toBeLessThanOrEqual(3);

    sound.preview('result.clear');
    sound.preview('result.newBest');
    sound.preview('result.defeat');
    sound.setSceneContext({ phase: 'RESULT' });
    expect(sound.bgmRunning).toBe(false);
    sound.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('WP-C2-01 감사 보강: R6 학년별 바이옴·RESULT 복귀·previewBgm 비오염·백그라운드 스파이크 가드·결과 팡파르', () => {
    vi.useFakeTimers();
    expect([3, 4, 5, 6].map(g => biomeFromMapId('garden_u', g))).toEqual(['meadow', 'river', 'ochre', 'snow']);

    const stops: Array<ReturnType<typeof vi.fn>> = [];
    const ctx = {
      ...fakeContext(),
      createOscillator: () => {
        ctx.oscillators++;
        const stop = vi.fn();
        stops.push(stop);
        return {
          type: 'sine',
          frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop,
        };
      },
    };
    const sound = new SoundDirector(cfg, 5, () => ctx as unknown as AudioContext);
    sound.unlock();
    expect(sound.bgmRunning).toBe(true);

    // previewBgm은 기존 sceneContext.phase를 오염시키지 않으며, 비활성화 시 미리듣기 오실레이터를 즉시 중단한다.
    sound.setSceneContext({ phase: 'PREP_QUIZ', biome: 'river' });
    const countBeforePreview = stops.length;
    sound.previewBgm();
    expect(sound.sceneContext.phase).toBe('PREP_QUIZ');
    expect(sound.sceneContext.biome).toBe('river');
    expect(stops.length).toBeGreaterThan(countBeforePreview);
    const previewStopCount = stops.slice(countBeforePreview).length;
    sound.setEnabled(false);
    expect(stops.slice(countBeforePreview).filter(s => s.mock.calls.length > 0).length).toBeGreaterThanOrEqual(previewStopCount);

    // 다시 켜고 백그라운드 탭 30초 스로틀링 복귀 시에도 스텝 폭주가 발생하지 않는다(최대 4스텝).
    sound.setEnabled(true);
    ctx.currentTime += 30;
    const oscBeforeSpike = ctx.oscillators;
    vi.advanceTimersByTime(200);
    expect(ctx.oscillators - oscBeforeSpike).toBeLessThanOrEqual(16);

    // RESULT 정지 후 새 판(PREP_QUIZ)으로 복귀하면 BGM이 정상 재개된다.
    sound.setSceneContext({ phase: 'RESULT' });
    expect(sound.bgmRunning).toBe(false);
    sound.setSceneContext({ phase: 'PREP_QUIZ' });
    expect(sound.bgmRunning).toBe(true);

    // playResultFanfare는 BGM을 멈추고 result.newBest 보이스를 재생한다.
    sound.playResultFanfare('newBest');
    expect(sound.bgmRunning).toBe(false);
    expect(sound.activeVoices.map(v => v.sfx)).toContain('result.newBest');

    sound.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

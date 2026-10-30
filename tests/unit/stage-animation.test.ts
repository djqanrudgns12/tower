import { describe, expect, it, vi } from 'vitest';
import { loadSettings } from '../../src/persistence/settings';
import { sampleStageDemo } from '../../src/ui/screens/home/MiniStageCanvas';

describe('왕국 초원 · 성문 수비전 애니메이션 및 모션 기본값 복구 검증', () => {
  it('OS prefers-reduced-motion이 켜진 환경이나 사용자 선택 없이 minimal로 저장된 기록은 full로 복구하고, 직접 선택한 정지는 유지한다', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
    });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));

    try {
      // 1) 신규 진입: OS prefers-reduced-motion: reduce여도 기본 연출은 'full'이어야 한다.
      const fresh = loadSettings();
      expect(fresh.motionMode).toBe('full');
      expect(fresh.reducedMotion).toBe(false);

      // 2) 과거 버전에서 사용자 선택 없이 'minimal'로 굳어진 저장본은 별명·학년을 유지한 채 'full'로 자동 복구된다.
      store.set('vocabulary-td.settings', JSON.stringify({
        lastNickname: '따뜻한학자',
        lastGrade: 5,
        reducedMotion: true,
        motionMode: 'minimal',
      }));
      const healed = loadSettings();
      expect(healed.motionMode).toBe('full');
      expect(healed.reducedMotion).toBe(false);
      expect(healed.lastNickname).toBe('따뜻한학자');
      expect(healed.lastGrade).toBe(5);

      // 3) 사용자가 환경설정에서 직접 '정지'(motionCustomized: true)를 고른 경우에는 그대로 보존된다.
      store.set('vocabulary-td.settings', JSON.stringify({
        ...healed,
        motionMode: 'minimal',
        reducedMotion: true,
        motionCustomized: true,
      }));
      const explicit = loadSettings();
      expect(explicit.motionMode).toBe('minimal');
      expect(explicit.reducedMotion).toBe(true);
      expect(explicit.motionCustomized).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('성문 수비전 미니 시연(sampleStageDemo)은 전 주기에서 적 대열과 투사체가 끊김 없이 전진한다', () => {
    const snapA = sampleStageDemo(480, 180, 1000, true);
    const snapB = sampleStageDemo(480, 180, 1400, true);
    expect(snapA.enemies.length).toBeGreaterThanOrEqual(4);
    expect(snapB.enemies.length).toBeGreaterThanOrEqual(4);
    expect(snapA.projectiles.length).toBeGreaterThan(0);

    // 같은 슬롯 적이 실제로 이동하고 투사체 좌표가 갱신되는지 확인
    const slot0A = snapA.enemies.find(e => e.slot === 0)!;
    const slot0B = snapB.enemies.find(e => e.slot === 0)!;
    expect(Math.hypot(slot0B.x - slot0A.x, slot0B.y - slot0A.y)).toBeGreaterThan(5);
    expect(snapB.projectiles[0]!.x).not.toBe(snapA.projectiles[0]!.x);

    // 11초 루프 전 구간(500ms 간격) 어디에서도 전장이 텅 비지 않는다.
    for (let t = 0; t <= 11000; t += 500) {
      const snap = sampleStageDemo(480, 180, t, true);
      expect(snap.enemies.length).toBeGreaterThanOrEqual(3);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  bossPunchOffset,
  fragmentCount,
  prismDelay,
  r6BiomeAmbientKind,
  railLanes,
  shellPoint,
  speciesKillTint,
  vfxGraphicsBudget,
  vfxParticleCap,
  weaponStageScale,
} from '../../src/game/r6/vfxTiming';

describe('R6 공격 연출 시간과 품질', () => {
  it('무기 단계에 맞춰 동시에 보이는 예광선 수가 늘어난다', () => {
    expect([1, 5, 6, 11, 12, 17, 18, 20].map(railLanes)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('프리즘은 충전 뒤 0.12초 간격으로 잇고 움직임을 줄이면 같이 표시한다', () => {
    const links = [0, 1, 2, 3, 4];
    expect(links.map(i => prismDelay(i, false))).toEqual([120, 240, 360, 480, 600]);
    expect(links.map(i => prismDelay(i, true))).toEqual([0, 0, 0, 0, 0]);
  });

  it.each(['rail', 'kill'] as const)('품질이 낮아지면 %s 파편 수를 줄이고 움직임을 줄이면 한 조각만 그린다', kind => {
    const counts = [0, 1, 2, 3].map(q => fragmentCount(kind, q, false));
    expect(counts[0]).toBeGreaterThan(counts[1]!);
    expect(counts.slice(1)).toEqual([3, 2, 1]);
    expect(fragmentCount(kind, 0, true)).toBe(1);
  });

  it('포탄은 발사점과 착탄점을 지나고 중간에서 직선보다 높다', () => {
    const from = { x: 44, y: 35 }, to = { x: 126, y: 79 };
    expect(shellPoint(from, to, 0, 32)).toEqual(from);
    expect(shellPoint(from, to, 1, 32)).toEqual(to);
    expect(shellPoint(from, to, .5, 32)).toEqual({ x: 85, y: 25 });
    expect(shellPoint(from, to, .5, 0)).toEqual({ x: 85, y: 57 });
  });

  it('품질·모션 설정에 따라 도형 예산·파티클 상한·종족 색조를 정한다', () => {
    expect([0, 1, 2, 3].map(vfxGraphicsBudget)).toEqual([400, 200, 100, 100]);
    expect([0, 1, 2, 3].map(q => vfxParticleCap(q, false))).toEqual([120, 72, 36, 16]);
    expect(vfxParticleCap(0, true)).toBe(16);
    expect(speciesKillTint('elf-infantry-t1')).toBe(0x2fb5a3);
    expect(speciesKillTint('machine-boss-t4')).toBe(0xe69f24);
    expect(speciesKillTint(undefined)).toBe(0xb8c0c8);
  });

  it('WP-C2-05: 무기 단계별 VFX 스케일, 보스 펀치 120ms 감쇠, R6 4바이옴 입자 매핑이 정확하다', () => {
    expect([1, 6, 12, 18].map(weaponStageScale)).toEqual([1.0, 1.12, 1.25, 1.4]);
    expect(bossPunchOffset(0, 0, false)).toBeLessThanOrEqual(2.5);
    expect(bossPunchOffset(60, 0, false)).toBeGreaterThan(0);
    expect(bossPunchOffset(120, 0, false)).toBe(0);
    expect(bossPunchOffset(10, 1, false)).toBe(0);
    expect(bossPunchOffset(10, 0, true)).toBe(0);
    expect(['meadow_easy', 'river_normal', 'ochre_hard', 'snow_crazy'].map(id => r6BiomeAmbientKind(id)))
      .toEqual(['meadow', 'river', 'ochre', 'snow']);
    expect([3, 4, 5, 6].map(g => r6BiomeAmbientKind('garden_u', g)))
      .toEqual(['meadow', 'river', 'ochre', 'snow']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  r6EnemyStridePx,
  r6MaxFallingSkeletons,
  r6OutlineStyle,
  r6TurnStep,
  r6WalkTimeScale,
} from '../../src/game/r6/enemyDisplay';

describe('R6 몬스터 아웃라인·속도·회전·낙하 정책', () => {
  it('개체 대비 등급과 품질에 맞춰 4방위 아웃라인과 카본/오프를 고른다', () => {
    // 고대비 일반 개체는 이중선 제거를 위해 오프, 고대비 보스는 카본 아웃라인
    expect(r6OutlineStyle('stone-special-t1', 0)).toEqual({ enabled: false, color: 0x12161b, alpha: 0 });
    expect(r6OutlineStyle('human-boss-t1', 0)).toEqual({ enabled: true, color: 0x12161b, alpha: 0.32 });

    // 중대비 일반은 품질 0만 적용, 품질 1+부터 해제
    expect(r6OutlineStyle('elf-infantry-t1', 0)).toEqual({ enabled: true, color: 0xb8c0c8, alpha: 0.24 });
    expect(r6OutlineStyle('elf-infantry-t1', 1).enabled).toBe(false);
    expect(r6OutlineStyle('insect-boss-t1', 1)).toEqual({ enabled: true, color: 0xb8c0c8, alpha: 0.36 });

    // 저대비 개체는 품질 0~1 은회 적용, 품질 2+ 해제
    expect(r6OutlineStyle('machine-infantry-t1', 0)).toEqual({ enabled: true, color: 0xb8c0c8, alpha: 0.42 });
    expect(r6OutlineStyle('machine-infantry-t1', 1)).toEqual({ enabled: true, color: 0xb8c0c8, alpha: 0.42 });
    expect(r6OutlineStyle('machine-infantry-t1', 2).enabled).toBe(false);
  });

  it('화면 실이동 속도와 보폭에 맞춰 걷기 배속을 동기화하고 상하한을 지킨다', () => {
    const stride = r6EnemyStridePx('elf-infantry-t1');
    expect(stride).toBeGreaterThan(24);
    expect(r6WalkTimeScale(stride * 0.8, stride, 0.8)).toBeCloseTo(1.0, 4);
    // 세로 축소 구간(속도 절반)에서도 배속이 따라 내려가고 0.45 하한을 지킨다
    expect(r6WalkTimeScale(stride * 0.5, stride, 1.0)).toBeCloseTo(0.5, 4);
    expect(r6WalkTimeScale(1, stride, 1.0)).toBe(0.45);
    expect(r6WalkTimeScale(1000, stride, 1.0)).toBe(2.2);
  });

  it('2px 방향 히스테리시스로 미세 떨림을 막고 100ms 스쿼시 턴을 수행한다', () => {
    // ±1.9px 이내 변동에서는 방향을 유지
    expect(r6TurnStep(-1.5, 1, 1, -1, 1000, false)).toEqual({
      facing: 1, displayFacing: 1, turnStartMs: -1, scaleXFactor: 1,
    });

    // -4px 전환 시작 → 25ms(수축 중) → 75ms(반전 확장 중) → 110ms(완료)
    const t0 = r6TurnStep(-4, 1, 1, -1, 1000, false);
    expect(t0).toEqual({ facing: -1, displayFacing: 1, turnStartMs: 1000, scaleXFactor: 1 });
    const t25 = r6TurnStep(-4, t0.facing, t0.displayFacing, t0.turnStartMs, 1025, false);
    expect(t25.scaleXFactor).toBeCloseTo(0.625, 4);
    const t75 = r6TurnStep(-4, t25.facing, t25.displayFacing, t25.turnStartMs, 1075, false);
    expect(t75.displayFacing).toBe(-1);
    expect(t75.scaleXFactor).toBeCloseTo(-0.625, 4);
    const t110 = r6TurnStep(-4, t75.facing, t75.displayFacing, t75.turnStartMs, 1110, false);
    expect(t110).toEqual({ facing: -1, displayFacing: -1, turnStartMs: -1, scaleXFactor: -1 });

    // reducedMotion에서는 즉시 전환
    expect(r6TurnStep(-4, 1, 1, -1, 1000, true)).toEqual({
      facing: -1, displayFacing: -1, turnStartMs: -1, scaleXFactor: -1,
    });
  });

  it('품질 단계별 동시 낙하 스켈레톤 상한을 8/6/4로 제한한다', () => {
    expect(r6MaxFallingSkeletons(0)).toBe(8);
    expect(r6MaxFallingSkeletons(1)).toBe(6);
    expect(r6MaxFallingSkeletons(2)).toBe(4);
    expect(r6MaxFallingSkeletons(3)).toBe(4);
  });
});

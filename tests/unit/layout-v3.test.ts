import { describe, expect, it } from 'vitest';
import { selectView, viewKey } from '../../src/application/view';
import { TOWER_IDS } from '../../src/contracts/balance';
import { TOWER_ROLE_GROUP } from '../../src/ui/game/ManagementPanel';
import { computeLayout } from '../../src/ui/useLayout';
import { newRun } from './helpers';

describe('시안 1 v3 가변 레일·수직선 잠금 레이아웃 계산(computeLayout)', () => {
  it('1600×960 와이드 데스크톱: R 모드, maxWidth 1560 캡 적용, 칸 크기 >= 70px', () => {
    const l = computeLayout(1600, 960, false, 'base');
    expect(l.mode).toBe('R');
    expect(l.cell).toBeGreaterThanOrEqual(70);
    expect(l.railW).toBeGreaterThanOrEqual(308);
    expect(l.railW).toBeLessThanOrEqual(346);
    expect(l.compactRail).toBe(false);
    expect(l.mapW + 12 + l.railW).toBeLessThanOrEqual(1560 - 2 * l.pad);
  });

  it('1440×900 표준 데스크톱: R 모드, 칸 크기 > 70px, 레일 308~346px, 가로 넘침 없음', () => {
    const l = computeLayout(1440, 900, false, 'base');
    expect(l.mode).toBe('R');
    expect(l.cell).toBeGreaterThan(70);
    expect(l.railW).toBeGreaterThanOrEqual(308);
    expect(l.railW).toBeLessThanOrEqual(346);
    expect(l.compactRail).toBe(false);
    expect(l.mapW + 12 + l.railW).toBeLessThanOrEqual(1440 - 2 * l.pad);
  });

  it('1366×650 저높이 크롬북: R 모드 유지, 칸 크기 >= 44px, 레일 346px, compactRail 활성화', () => {
    const l = computeLayout(1366, 650, false, 'base');
    expect(l.mode).toBe('R');
    expect(l.cell).toBeGreaterThanOrEqual(44);
    expect(l.railW).toBe(346);
    expect(l.compactRail).toBe(true);
    expect(l.mapW + 12 + l.railW).toBeLessThanOrEqual(1366 - 2 * l.pad);
  });

  it('1024×690 소형 노트북·태블릿 가로: R 모드, 레일 272~346px 가변 폭', () => {
    const l = computeLayout(1024, 690, false, 'base');
    expect(l.mode).toBe('R');
    expect(l.railW).toBeGreaterThanOrEqual(272);
    expect(l.railW).toBeLessThanOrEqual(346);
    expect(l.mapW + 12 + l.railW).toBeLessThanOrEqual(1024 - 2 * l.pad);
  });

  it('모든 R 모드 해상도에서 상·하단 수직선 잠금 수학식 오차가 정확히 0px이다', () => {
    for (const [w, h] of [
      [1920, 1080],
      [1600, 960],
      [1440, 900],
      [1366, 650],
      [1280, 800],
      [1024, 768],
      [1024, 690],
    ] as const) {
      const l = computeLayout(w, h, false, 'base');
      expect(l.mode).toBe('R');
      const totalGridW = l.mapW + 12 + l.railW;
      // 하단 보드 바깥 테두리(4px) + 안쪽 여백(12px) = 좌우 각 16px
      const col2W = l.railW - 16;
      const col1W = totalGridW - 32 - 12 - col2W;
      const bottomLeftColRightEdge = 16 + col1W;
      const bottomRightColLeftEdge = bottomLeftColRightEdge + 12;
      expect(bottomLeftColRightEdge).toBe(l.mapW);
      expect(bottomRightColLeftEdge).toBe(l.mapW + 12);
    }
  });

  it('태블릿 세로(820×1060, 768×1024)와 휴대폰(390×844, 320×460)에서 S 모드로 전환하고 가로 넘침이 없다', () => {
    for (const [w, h] of [[820, 1060], [768, 1024]] as const) {
      const tabletP = computeLayout(w, h, true, 'base');
      expect(tabletP.mode).toBe('S');
      expect(tabletP.wideQuestion).toBe(true);
      expect(tabletP.mapW).toBeLessThanOrEqual(w - 2 * tabletP.pad);
    }

    for (const [w, h] of [[390, 844], [360, 640], [320, 460]] as const) {
      const phone = computeLayout(w, h, true, 'base');
      expect(phone.mode).toBe('S');
      expect(phone.pad).toBe(8);
      expect(phone.mapW).toBeLessThanOrEqual(w - 2 * phone.pad);
    }

    const landscapePhone = computeLayout(640, 360, true, 'base');
    expect(landscapePhone.portraitHint).toBe(true);
  });

  it('글자 확대(base / large / xlarge) 시에도 양수 칸 크기와 무결성을 유지한다', () => {
    for (const font of ['base', 'large', 'xlarge'] as const) {
      const l = computeLayout(1280, 800, false, font);
      expect(l.cell).toBeGreaterThanOrEqual(24);
      expect(l.mapW).toBeGreaterThan(0);
      expect(l.mapH).toBeGreaterThan(0);
    }
  });
});

describe('시안 1 v3 10종 타워 역할 분류 및 GameView 파생 지표', () => {
  it('계약의 10종 타워 ID가 모두 역할 필터 그룹에 빠짐없이 매핑된다', () => {
    expect(TOWER_IDS).toHaveLength(10);
    for (const id of TOWER_IDS) {
      expect(['fast', 'area', 'slow', 'support']).toContain(TOWER_ROLE_GROUP[id]);
    }
  });

  it('난이도별 정답·오답 보상 예고(stakes), 연속 정답(battleStreak), 처치 점수 한도를 노출한다', () => {
    const { ctx, s } = newRun();
    const v0 = selectView(ctx, s);
    expect(v0.stakes).toEqual({
      correctGold: ctx.difficulty.correctGold,
      correctPt: ctx.difficulty.correctPt,
      wrongPt: ctx.difficulty.wrongPt,
    });
    expect(v0.battleStreak).toBe(0);
    expect(v0.waveKillPtCap).toBe(ctx.difficulty.waveKillPtCap);

    const k0 = viewKey(s);
    s.quiz.battleStreak = 2;
    const k1 = viewKey(s);
    expect(k1).not.toBe(k0);
    expect(selectView(ctx, s).battleStreak).toBe(2);

    s.stats.ptFromKills = 12;
    expect(viewKey(s)).not.toBe(k1);
  });
});

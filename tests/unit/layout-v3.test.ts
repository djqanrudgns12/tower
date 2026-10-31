import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import defaults from '../../docs/contracts/product.defaults.v0.5.json';
import { selectView, viewKey } from '../../src/application/view';
import { TOWER_IDS } from '../../src/contracts/balance';
import { TOWER_ROLE_GROUP } from '../../src/ui/game/towerRoles';
import { computeLayout, minRailWidth } from '../../src/ui/useLayout';
import { newRun } from './helpers';

// 계산식을 시험 안에 다시 쓰지 않는다. 기대값은 v3 문서 §2 표와 계약 layout 블록에서 읽는다.
const v3Doc = readFileSync(new URL('../../docs/ui_ux_refinement_p1_v3_prd.md', import.meta.url), 'utf8');
const L = defaults.layout;
const RAIL = L.modes.R.rail;
/** 하단 문제판 바깥 테두리(4px) + 안쪽 여백(12px). 오른쪽 열 = 레일 폭 − 이 값(QuestionPanel·GameScreen CSS의 수직선 잠금). */
const SEAM_INSET_PX = 16;
const tableRows = v3Doc
  .split('\n')
  .filter(line => /^\| `\d+×\d+` \|/.test(line))
  .map(line => {
    const cells = line.split('|').slice(1, -1).map(c => c.trim().replace(/`/g, ''));
    const [W, H] = cells[0]!.split('×').map(Number) as [number, number];
    const [mapW, mapH] = cells[2]!.split('×').map(Number) as [number, number];
    return { W, H, mode: cells[1] as 'R' | 'S', mapW, mapH, cell: Number.parseFloat(cells[3]!), railW: Number.parseFloat(cells[4]!) };
  });

/**
 * 문서 표의 알려진 오기. 표 스스로의 칸 값과 어긋나는 칸만 적는다(문서 수정은 총괄 몫, RETURN.md 참조).
 * S 모드 폭 제한 두 행은 전장 폭을 내림하지 않은 안쪽 폭으로 적었다. R 행들은 floor(칸 × 15)로 적었다.
 * - 820×1060: 52.5 × 15 = 787.5 → 787(표 788)
 * - 390×844: 24.9 × 15 = 373.5 → 373(표 374)
 */
const DOC_ERRATA: Record<string, { mapW?: number }> = { '820×1060': { mapW: 787 }, '390×844': { mapW: 373 } };

describe('시안 1 v3 가변 레일·수직선 잠금 레이아웃 계산(computeLayout)', () => {
  it('v3 문서 §2 표의 모든 행(모드·전장·칸·레일)을 그대로 재현한다', () => {
    expect(tableRows.length).toBeGreaterThanOrEqual(6);
    for (const row of tableRows) {
      const at = `${row.W}×${row.H}`;
      const fix = DOC_ERRATA[at];
      if (fix?.mapW !== undefined) {
        // 오기 칸은 문서의 칸 값으로 다시 확인한다: 전장 폭 = floor(칸 × 15).
        expect(fix.mapW).toBe(Math.floor(row.cell * 15));
        expect(row.mapW).not.toBe(fix.mapW);
      }
      const l = computeLayout(row.W, row.H, false, 'base');
      expect({ at, mode: l.mode, mapW: l.mapW, mapH: l.mapH, cell: l.cell, railW: l.railW }).toEqual({
        at, mode: row.mode, mapW: fix?.mapW ?? row.mapW, mapH: row.mapH, cell: row.cell, railW: row.railW,
      });
    }
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

  it('레일 폭은 계약 layout 범위 안의 정수이고, 하단 오른쪽 열 폭(레일 − 잠금 여백)이 200px을 넘는다', () => {
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
      expect(Number.isInteger(l.railW)).toBe(true);
      expect(l.railW).toBeGreaterThanOrEqual(RAIL.tabletMinPx);
      expect(l.railW).toBeLessThanOrEqual(RAIL.maxPx);
      expect(l.railW - SEAM_INSET_PX).toBeGreaterThan(200);
      expect(l.mapW + 12 + l.railW).toBeLessThanOrEqual(Math.min(w, L.frameMaxPx) - 2 * l.pad);
    }
  });

  it('레일 최소폭은 1024px 이하 272, 1160px 이상 308이고 사이는 이어져서, 폭이 늘 때 칸이 줄지 않는다', () => {
    expect([minRailWidth(1000), minRailWidth(1024), minRailWidth(1160), minRailWidth(1500)]).toEqual([
      RAIL.tabletMinPx, RAIL.tabletMinPx, RAIL.minPx, RAIL.minPx,
    ]);
    let prev = 0;
    for (let w = 1100; w <= 1220; w++) {
      const l = computeLayout(w, 800, false, 'base');
      expect(l.cell).toBeGreaterThanOrEqual(prev);
      prev = l.cell;
    }
  });

  it('레일 폭·프레임·압축 레일 기준은 계약 layout 값(1560·272/308/346·460)을 따른다', () => {
    expect(L.frameMaxPx).toBe(1560);
    expect([RAIL.tabletMinPx, RAIL.minPx, RAIL.maxPx, RAIL.tabletBelowWidthPx, RAIL.compactMapHeightMaxPx]).toEqual([272, 308, 346, 1160, 460]);
    expect(L.optionGrid.twoByTwoMinCellWidthPx).toBe(200);
    expect(minRailWidth(1024)).toBe(RAIL.tabletMinPx);
    expect(minRailWidth(RAIL.tabletBelowWidthPx)).toBe(RAIL.minPx);
    expect(minRailWidth(1920)).toBe(RAIL.minPx);
    for (const [w, h] of [[1920, 1080], [1600, 960], [1440, 900], [1366, 650], [1280, 800], [1024, 768], [1024, 690]] as const) {
      const l = computeLayout(w, h, false, 'base');
      expect(l.mode).toBe('R');
      expect(l.railW).toBeGreaterThanOrEqual(minRailWidth(w));
      expect(l.railW).toBeLessThanOrEqual(RAIL.maxPx);
      // [전장 | 레일 간격 | 레일] 묶음이 프레임 안쪽 폭을 넘지 않는다(가로 넘침 0).
      expect(l.mapW + L.modes.R.railGapPx + l.railW).toBeLessThanOrEqual(Math.min(w, L.frameMaxPx) - 2 * l.pad);
      expect(l.compactRail).toBe(l.mapH <= RAIL.compactMapHeightMaxPx);
    }
    expect(computeLayout(1366, 650, false, 'base').compactRail).toBe(true);
    expect(computeLayout(1440, 900, false, 'base').compactRail).toBe(false);
  });

  it('같은 높이에서 창이 넓어지면 칸이 줄지 않는다(1159→1160px 레일 최소폭 전환 연속)', () => {
    for (const H of [650, 690, 768, 800, 900]) {
      let prev = { W: 0, cell: 0, minRail: 0 };
      for (let W = 900; W <= 1700; W++) {
        const l = computeLayout(W, H, false, 'base');
        const minRail = minRailWidth(W);
        if (prev.W) {
          if (l.mode === 'R' && computeLayout(prev.W, H, false, 'base').mode === 'R') {
            expect(l.cell, `${prev.W}→${W}×${H}`).toBeGreaterThanOrEqual(prev.cell);
          }
          expect(Math.abs(minRail - prev.minRail), `${prev.W}→${W} 레일 최소폭 점프`).toBeLessThanOrEqual(1);
        }
        prev = { W, cell: l.cell, minRail };
      }
    }
    expect(computeLayout(1160, 690, false, 'base').cell).toBeGreaterThanOrEqual(computeLayout(1159, 690, false, 'base').cell);
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
      expect(phone.pad).toBe(L.outerPaddingPx.phone);
      expect(phone.mapW).toBeLessThanOrEqual(w - 2 * phone.pad);
    }

    const landscapePhone = computeLayout(640, 360, true, 'base');
    expect(landscapePhone.portraitHint).toBe(true);
  });

  it('글자 확대(base / large / xlarge)는 문제판 예산 q를 계약 값만큼 늘린다', () => {
    for (const font of ['base', 'large', 'xlarge'] as const) {
      const l = computeLayout(1280, 800, false, font);
      expect(l.q).toBe(L.modes.R.questionBaseHeightPx + L.questionFontExtraPx[font]);
      expect(l.qWide).toBe(l.q);
      expect(l.font).toBe(font);
      expect(l.cell).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('시안 1 v3 10종 타워 역할 분류 및 GameView 파생 지표', () => {
  it('계약의 타워 ID(리뉴얼 20종)가 모두 역할 필터 그룹에 빠짐없이 매핑된다', () => {
    expect(TOWER_IDS).toHaveLength(20);
    for (const id of TOWER_IDS) {
      expect(['fast', 'area', 'slow', 'support']).toContain(TOWER_ROLE_GROUP[id]);
    }
  });

  it('난이도별 정답·오답 보상 예고(stakes)와 연속 정답(battleStreak)을 노출한다', () => {
    const { ctx, s } = newRun();
    const v0 = selectView(ctx, s);
    expect(v0.stakes).toEqual({
      correctGold: ctx.difficulty.correctGold,
      correctPt: ctx.difficulty.correctPt,
      wrongPt: ctx.difficulty.wrongPt,
    });
    expect(v0.battleStreak).toBe(0);
    // 화면에서 쓰지 않던 처치 점수 한도 필드는 GameView에서 뺐다(WP-UI 항목 10).
    expect('waveKillPtCap' in v0).toBe(false);
    expect('waveKillPtGranted' in v0).toBe(false);

    const k0 = viewKey(s);
    s.quiz.battleStreak = 2;
    const k1 = viewKey(s);
    expect(k1).not.toBe(k0);
    expect(selectView(ctx, s).battleStreak).toBe(2);

    s.stats.ptFromKills = 12;
    expect(viewKey(s)).not.toBe(k1);
  });
});

import { useSyncExternalStore } from 'react';
import { DEFAULTS } from '../content';

// 화면 모드는 폭 구간이 아니라 칸 크기 계산으로 고른다(PRD §12.1 + v3 가변 레일·수직선 잠금 규격).
export interface Layout {
  mode: 'R' | 'S';
  cell: number;
  mapW: number;
  mapH: number;
  railW: number;
  pad: number;
  coarse: boolean;
  magnifyBelow: number;
  portraitHint: boolean;
  wideQuestion: boolean;
  compactRail: boolean;
  /** 하단 문제판 높이 예산(px). R 모드에서 문제판·준비판이 이 높이를 채운다. */
  questionH: number;
}

const L = DEFAULTS.layout;

/**
 * v3 레이아웃 계약(가변 레일·수직선 잠금). 화면 코드(TS·CSS)는 숨은 숫자 대신 이 표만 읽는다.
 * 계약 JSON(product.defaults layout 블록)의 옛 값(frameMaxPx 1440, railWidthPx 224, twoByTwoMinCellWidthPx 160)과
 * 다른 값은 이 표가 우선한다. JSON 블록 갱신은 계약 소유자가 이 표를 옮겨 적는다.
 */
export const LAYOUT_V3 = {
  frameMaxPx: 1560,
  rail: {
    minDesktopPx: 308,
    minTabletPx: 272,
    maxPx: 346,
    /** 이 폭에서 데스크톱 최소폭, 아래 폭에서 태블릿 최소폭. 사이는 선형으로 이어 칸 크기가 끊기지 않는다. */
    desktopFromWidthPx: 1160,
    tabletUpToWidthPx: 1024,
  },
  /** 하단 판의 바깥 테두리 + 안쪽 여백. 하단 오른쪽 열 = 레일 폭 − 이 값(상·하단 수직선 0.0px 잠금). */
  seamInsetPx: 16,
  optionGrid: { twoByTwoMinCellWidthPx: 200, twoByTwoMaxLines: 2 },
} as const;

/** 레일 최소폭: 1024px 이하 272px, 1160px 이상 308px, 사이는 선형(폭이 1px 늘 때 칸이 줄어드는 불연속 없음). */
export function railMinWidth(W: number): number {
  const r = LAYOUT_V3.rail;
  const t = (W - r.tabletUpToWidthPx) / (r.desktopFromWidthPx - r.tabletUpToWidthPx);
  return r.minTabletPx + (r.minDesktopPx - r.minTabletPx) * Math.max(0, Math.min(1, t));
}

export type FontScaleKey = keyof typeof L.questionFontExtraPx;

/**
 * 글자를 키우면 문제판 예산이 늘고, 그만큼 전장이 줄거나 R이 S로 바뀐다(PRD §12.1).
 * 높이가 먼저 전장 크기를 제한하는 와이드·표준·크롬북 화면에서는 칸 크기를 해치지 않고
 * 남는 가로 여백을 우측 관리 레일(308~346px)로 흡수해 가독성과 상·하단 수직선 정렬을 맞춘다.
 */
export function computeLayout(W: number, H: number, coarse: boolean, font: FontScaleKey = 'base'): Layout {
  const phone = W < L.outerPaddingPx.phoneBelowWidthPx;
  const pad = phone ? L.outerPaddingPx.phone : L.outerPaddingPx.default;
  const effW = Math.min(W, LAYOUT_V3.frameMaxPx);
  const rawInnerW = Math.max(200, W - 2 * pad);
  const innerW = Math.max(200, effW - 2 * pad);
  const innerH = Math.max(200, H - 2 * pad);
  const R = L.modes.R;
  const S = L.modes.S;
  const minRailW = railMinWidth(W);
  const q = phone ? 300 : R.questionBaseHeightPx + L.questionFontExtraPx[font];
  const cRMode = Math.min((rawInnerW - minRailW - R.railGapPx) / 15, (innerH - R.verticalGapPx - q) / 9);
  const cSMode = Math.min(rawInnerW / 15, (innerH - S.hudHeightPx - 3 * S.verticalGapPx - S.toolbarHeightPx - q) / 9);
  const mode: 'R' | 'S' = !phone && cRMode >= cSMode && cRMode >= 24 ? 'R' : 'S';
  const cR = Math.min((innerW - minRailW - R.railGapPx) / 15, (innerH - R.verticalGapPx - q) / 9);
  const cSfit = Math.min(innerW / 15, (innerH - S.hudHeightPx - 3 * S.verticalGapPx - S.toolbarHeightPx - q) / 9);
  const cell = Math.max(10, Math.floor((mode === 'R' ? cR : phone || cSfit < 24 ? innerW / 15 : cSfit) * 10) / 10);
  const mapW = Math.floor(cell * 15);
  const mapH = Math.floor(cell * 9);
  const railW = mode === 'R' ? Math.floor(Math.max(minRailW, Math.min(LAYOUT_V3.rail.maxPx, innerW - mapW - R.railGapPx))) : innerW;
  return {
    mode,
    cell,
    mapW,
    mapH,
    railW,
    pad,
    coarse,
    magnifyBelow: coarse ? L.magnifyBelowCellPx.coarse : L.magnifyBelowCellPx.fine,
    portraitHint: H < L.portraitHintBelowHeightPx && W > H,
    wideQuestion: mode === 'R' || innerW >= L.questionWideInnerMinPx,
    compactRail: mode === 'R' && mapH <= 460,
    questionH: q,
  };
}

let cached: Layout | null = null;
let cachedKey = '';
function snapshot(): Layout {
  const vv = window.visualViewport;
  const W = Math.round(vv?.width ?? window.innerWidth), H = Math.round(vv?.height ?? window.innerHeight);
  const coarse = window.matchMedia('(any-pointer: coarse)').matches;
  const raw = document.documentElement.dataset.font;
  const font: FontScaleKey = raw === 'large' || raw === 'xlarge' ? raw : 'base';
  const key = `${W}x${H}:${coarse}:${font}`;
  if (key !== cachedKey || !cached) { cachedKey = key; cached = computeLayout(W, H, coarse, font); }
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  window.visualViewport?.addEventListener('resize', cb);
  // 글자 크기는 App이 <html data-font>로 바꾼다.
  const fontWatch = new MutationObserver(cb);
  fontWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font'] });
  return () => { window.removeEventListener('resize', cb); window.visualViewport?.removeEventListener('resize', cb); fontWatch.disconnect(); };
}

export const useLayout = () => useSyncExternalStore(subscribe, snapshot);

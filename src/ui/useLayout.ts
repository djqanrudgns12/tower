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
  /** 문제판 높이 예산(px). 해설 카드는 이 안에서만 스크롤한다(PRD §12.1·§12.5). */
  q: number;
  /** 두 칸 문제판의 높이 예산(px). 휴대폰 세로 적층에서도 해설 카드 크기를 이 값에 맞춘다. */
  qWide: number;
  font: FontScaleKey;
}

const L = DEFAULTS.layout;
const RAIL = L.modes.R.rail;

export type FontScaleKey = keyof typeof L.questionFontExtraPx;

/**
 * 레일 최소폭. 계약 값(태블릿 272 → 데스크톱 308)을 폭 1px당 1px씩 이어 붙여
 * 1159→1160px에서 칸이 갑자기 줄어드는 불연속을 없앤다(기울기 1이면 칸 크기는 줄지 않는다).
 */
export function minRailWidth(W: number): number {
  const rampStart = RAIL.tabletBelowWidthPx - (RAIL.minPx - RAIL.tabletMinPx);
  return Math.min(RAIL.minPx, Math.max(RAIL.tabletMinPx, RAIL.tabletMinPx + (W - rampStart)));
}

/** CSS가 계약 값을 쓰도록 :root에 변수로 넣는다(숨은 상수 금지, PRD §10.1). 첫 렌더 전에 한 번 넣는다. */
export const LAYOUT_CSS_VARS: Readonly<Record<string, string>> = {
  '--frame-max': `${L.frameMaxPx}px`,
  '--rail-min': `${RAIL.minPx}px`,
};
if (typeof document !== 'undefined') {
  for (const [name, value] of Object.entries(LAYOUT_CSS_VARS)) document.documentElement.style.setProperty(name, value);
}

/**
 * 글자를 키우면 문제판 예산이 늘고, 그만큼 전장이 줄거나 R이 S로 바뀐다(PRD §12.1).
 * 높이가 먼저 전장 크기를 제한하는 와이드·표준·크롬북 화면에서는 칸 크기를 해치지 않고
 * 남는 가로 여백을 우측 관리 레일(계약 layout.modes.R.rail 최소~최대)로 흡수해 가독성과 상·하단 수직선 정렬을 맞춘다.
 */
export function computeLayout(W: number, H: number, coarse: boolean, font: FontScaleKey = 'base'): Layout {
  const phone = W < L.outerPaddingPx.phoneBelowWidthPx;
  const pad = phone ? L.outerPaddingPx.phone : L.outerPaddingPx.default;
  const effW = Math.min(W, L.frameMaxPx);
  const rawInnerW = Math.max(200, W - 2 * pad);
  const innerW = Math.max(200, effW - 2 * pad);
  const innerH = Math.max(200, H - 2 * pad);
  const R = L.modes.R;
  const S = L.modes.S;
  const minRailW = minRailWidth(W);
  const qWide = R.questionBaseHeightPx + L.questionFontExtraPx[font];
  const q = phone ? 300 : qWide;
  const cRMode = Math.min((rawInnerW - minRailW - R.railGapPx) / 15, (innerH - R.verticalGapPx - q) / 9);
  const cSMode = Math.min(rawInnerW / 15, (innerH - S.hudHeightPx - 3 * S.verticalGapPx - S.toolbarHeightPx - q) / 9);
  const mode: 'R' | 'S' = !phone && cRMode >= cSMode && cRMode >= 24 ? 'R' : 'S';
  const cR = Math.min((innerW - minRailW - R.railGapPx) / 15, (innerH - R.verticalGapPx - q) / 9);
  const cSfit = Math.min(innerW / 15, (innerH - S.hudHeightPx - 3 * S.verticalGapPx - S.toolbarHeightPx - q) / 9);
  const cell = Math.max(10, Math.floor((mode === 'R' ? cR : phone || cSfit < 24 ? innerW / 15 : cSfit) * 10) / 10);
  const mapW = Math.floor(cell * 15);
  const mapH = Math.floor(cell * 9);
  const railW = mode === 'R' ? Math.max(minRailW, Math.min(RAIL.maxPx, innerW - mapW - R.railGapPx)) : innerW;
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
    compactRail: mode === 'R' && mapH <= RAIL.compactMapHeightMaxPx,
    q,
    qWide,
    font,
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

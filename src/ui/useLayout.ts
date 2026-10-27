import { useSyncExternalStore } from 'react';
import { DEFAULTS } from '../content';

// 화면 모드는 폭 구간이 아니라 칸 크기 계산으로 고른다(PRD §12.1).
export interface Layout {
  mode: 'R' | 'S';
  cell: number;
  mapW: number;
  mapH: number;
  pad: number;
  coarse: boolean;
  magnifyBelow: number;
  portraitHint: boolean;
  wideQuestion: boolean;
}

const L = DEFAULTS.layout;

export function computeLayout(W: number, H: number, coarse: boolean): Layout {
  const phone = W < L.outerPaddingPx.phoneBelowWidthPx;
  const pad = phone ? L.outerPaddingPx.phone : L.outerPaddingPx.default;
  const R = L.modes.R, S = L.modes.S;
  const q = phone ? 300 : R.questionBaseHeightPx;
  const cR = Math.min((W - 2 * pad - R.railWidthPx - R.railGapPx) / 15, (H - 2 * pad - R.verticalGapPx - q) / 9);
  const cSfit = Math.min((W - 2 * pad) / 15, (H - 2 * pad - S.hudHeightPx - 3 * S.verticalGapPx - S.toolbarHeightPx - q) / 9);
  const mode: 'R' | 'S' = !phone && cR >= cSfit && cR >= 24 ? 'R' : 'S';
  const cell = Math.max(10, Math.floor((mode === 'R' ? cR : phone || cSfit < 24 ? (W - 2 * pad) / 15 : cSfit) * 10) / 10);
  const mapW = Math.floor(cell * 15), mapH = Math.floor(cell * 9);
  return {
    mode, cell, mapW, mapH, pad, coarse,
    magnifyBelow: coarse ? L.magnifyBelowCellPx.coarse : L.magnifyBelowCellPx.fine,
    portraitHint: H < L.portraitHintBelowHeightPx && W > H,
    wideQuestion: W - 2 * pad >= L.questionWideInnerMinPx + 40,
  };
}

let cached: Layout | null = null;
let cachedKey = '';
function snapshot(): Layout {
  const vv = window.visualViewport;
  const W = Math.round(vv?.width ?? window.innerWidth), H = Math.round(vv?.height ?? window.innerHeight);
  const coarse = window.matchMedia('(any-pointer: coarse)').matches;
  const key = `${W}x${H}:${coarse}`;
  if (key !== cachedKey || !cached) { cachedKey = key; cached = computeLayout(W, H, coarse); }
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  window.visualViewport?.addEventListener('resize', cb);
  return () => { window.removeEventListener('resize', cb); window.visualViewport?.removeEventListener('resize', cb); };
}

export const useLayout = () => useSyncExternalStore(subscribe, snapshot);

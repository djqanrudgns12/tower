import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RankingBoard } from '../../../src/ui/screens/home/RankingBoard';
import { RankingModal } from '../../../src/ui/screens/home/RankingModal';

it.each(['single_score', 'best_wave', 'honor_points'] as const)('%s 홈은 시즌 2로 시작하고 상세 창은 선택한 지난 시즌을 유지한다', tab => {
  const common = { playerId: '', currentNickname: '', schoolName: '', schoolCode: '' };
  const noop = () => {};
  const board = renderToStaticMarkup(createElement(RankingBoard, {
    ...common, tab, onTabChange: noop, defaultGrade: 3, defaultDifficulty: 'Normal', refreshTick: 0,
    boardRef: { current: null }, onOpenQrModal: noop, onOpenDetailModal: noop,
  }));
  expect(board).toMatch(/<button[^>]*aria-checked="true"[^>]*>시즌 2<\/button>/);
  expect(board).toMatch(/<button[^>]*aria-checked="false"[^>]*>시즌 1<\/button>/);
  const detail = renderToStaticMarkup(createElement(RankingModal, {
    ...common, initialTab: tab, initialGrade: 3, initialDifficulty: 'Normal', initialPeriod: 'season1', onClose: noop,
  }));
  expect(detail).toMatch(/<button[^>]*aria-checked="true"[^>]*>시즌 1<\/button>/);
});

import type { RankingPeriod, RankingTabId } from '../../../contracts/lobby';
import { fmtNumber } from '../../copy';

/** 랭킹 전체 보기의 탭 3개(ui-rules-v3 §4: 명예점 → 랭킹 점수). '내 기기 기록'은 오프라인일 때 첫 탭이 대신 보여 준다. */
export const RANKING_TABS: readonly RankingTabId[] = ['single_score', 'best_wave', 'honor_points'];

export const TAB_LABELS: Record<RankingTabId, string> = {
  single_score: '한 판 최고점',
  best_wave: '최장 웨이브',
  honor_points: '랭킹 점수',
  local_device: '내 기기 기록',
};

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  weekly: '주간',
  season1: '시즌 1',
  all_time: '누적',
};

export function formatPrimaryMetric(tab: RankingTabId, value: number): string {
  return tab === 'best_wave' ? `${fmtNumber(value)}웨이브` : `${fmtNumber(value)}점`;
}

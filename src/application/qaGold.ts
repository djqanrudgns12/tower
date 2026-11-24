import type { RunState } from '../domain/types';

type QaGoldState = Pick<RunState, 'phase' | 'gold'> & {
  config: Pick<RunState['config'], 'balanceVersion' | 'rankingEligibility'>;
};

/** 브라우저 시험에서 기록을 남기지 않는 R6 판을 준비할 때 한 번 쓴다. */
export function grantR6QaGold(state: QaGoldState, gold: number): void {
  if (!import.meta.env.DEV) throw new Error('시험 골드는 개발 빌드에서만 지급할 수 있습니다');
  if (state.config.balanceVersion !== '2.0.0' || state.phase !== 'BUILD' || state.config.rankingEligibility !== 'personal') {
    throw new Error('R6 개인 판의 설치 단계에서만 시험 골드를 지급할 수 있습니다');
  }
  if (!Number.isSafeInteger(gold) || gold <= 0 || !Number.isSafeInteger(state.gold + gold)) {
    throw new RangeError('시험 골드의 범위를 확인하세요');
  }
  state.gold += gold;
}

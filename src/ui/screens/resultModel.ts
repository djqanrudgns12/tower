import type { RunStats } from '../../domain/types';

/** 결과 창 '이번 판 기록'(R5 R1)과 만점 칭찬(R2)이 쓰는 숫자. 퍼센트·숙련도는 만들지 않는다(PRD §20.5). */
export interface RunLog {
  /** 푼 문제: 보기를 골라 답한 수(정답 + 오답). */
  solved: number;
  /** '모르겠어요'로 넘긴 수. */
  skipped: number;
  /** 만난 낱말: 답하거나 넘긴 문항이 가리키는 서로 다른 뜻의 수. */
  words: number;
  /** 풀고 넘긴 문제가 하나 이상 있고, 틀린 것도 '모르겠어요'도 없는 판. */
  perfect: boolean;
}

/**
 * @param answered 답하거나 넘긴 문항(`answer`가 있는 이력)
 * @param senseOf 문항 id → 뜻 키. 문항이 사라졌으면(철회) undefined라 문항 id로 센다.
 */
export function runLog(stats: Pick<RunStats, 'correct' | 'wrong' | 'skipped'>, answered: readonly { questionId: string }[], senseOf: (questionId: string) => string | undefined): RunLog {
  return {
    solved: stats.correct + stats.wrong,
    skipped: stats.skipped,
    words: new Set(answered.map(a => senseOf(a.questionId) ?? a.questionId)).size,
    perfect: stats.correct >= 1 && stats.wrong === 0 && stats.skipped === 0,
  };
}

/** 숫자 올라가기(R2)의 한 장면 값: 진행도 p(0~1)에서 0 → target. 끝이 느려지는 곡선이고 항상 정수다. */
export function countUpAt(target: number, p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return Math.round(target * (1 - (1 - t) ** 3));
}

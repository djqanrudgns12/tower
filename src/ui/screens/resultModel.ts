import type { RunState, RunStats } from '../../domain/types';
import { isR6Tower } from '../../domain/r6Towers';
import r6ThemeJson from '../../content/theme/r6.ko.json';

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

export interface R6WaveChapter {
  index: number;
  rangeLabel: string;
  name: string;
}

export interface R6RunSummary {
  chapter: R6WaveChapter;
  bossKills: number;
  maxStreak: number;
  topTower: { type: string; name: string; attacks: number } | null;
}

/** 5웨이브 × 10단계(1~50웨이브) 한국어 챕터 명칭. 금지어(‘초원’ 등)를 쓰지 않는다. */
const R6_CHAPTER_NAMES = [
  '아침 햇살',
  '바람 언덕',
  '구름 능선',
  '저녁 노을',
  '황혼 성채',
  '별빛 고원',
  '새벽 안개',
  '여명 능선',
  '황금 마루',
  '태양 왕관',
] as const;

export function r6WaveChapter(completedWave: number): R6WaveChapter {
  const wave = Math.max(1, Math.min(50, Math.floor(completedWave || 1)));
  const zeroBased = Math.floor((wave - 1) / 5);
  const start = zeroBased * 5 + 1;
  return {
    index: zeroBased + 1,
    rangeLabel: `${start}~${start + 4}웨이브`,
    name: R6_CHAPTER_NAMES[zeroBased] ?? R6_CHAPTER_NAMES[0],
  };
}

/**
 * R6 판 성취 요약(WP-C2-03, 퍼센트·숙련도 지표 없음).
 * `balanceVersion === '1.0.0'`이면 null을 돌려준다.
 */
export function summarizeR6Run(
  state: Pick<RunState, 'config' | 'completedWave' | 'stats' | 'towers' | 'quiz'>,
): R6RunSummary | null {
  if (state.config.balanceVersion === '1.0.0') return null;

  let streak = 0;
  let maxStreak = 0;
  for (const entry of state.quiz.history) {
    if (!entry.answer) continue;
    if (entry.answer.correct) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
  }

  let bestTower: { type: string; attacks: number; id: number } | null = null;
  for (const tower of state.towers) {
    if (tower.attacks <= 0) continue;
    if (!bestTower || tower.attacks > bestTower.attacks || (tower.attacks === bestTower.attacks && tower.id < bestTower.id)) {
      bestTower = { type: tower.type, attacks: tower.attacks, id: tower.id };
    }
  }

  const r6Towers = r6ThemeJson.towers as Record<string, { name: string }>;
  const topTower = bestTower
    ? {
        type: bestTower.type,
        name: (isR6Tower(bestTower.type) ? r6Towers[bestTower.type]?.name : undefined) ?? bestTower.type,
        attacks: bestTower.attacks,
      }
    : null;

  return {
    chapter: r6WaveChapter(state.completedWave),
    bossKills: state.stats.bossKills,
    maxStreak,
    topTower,
  };
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

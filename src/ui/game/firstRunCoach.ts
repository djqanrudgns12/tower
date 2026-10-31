import type { GameView } from '../../application/view';

// 첫 판 코치 마크(ui-rules-v2 §4 문구 줄이기): 상시 안내 대신, 그 조작을 한 번 해 볼 때까지만 한 문장을 보인다.
// 기기에 한 번 해 본 단계만 남긴다(점수·기록과 무관한 화면 편의 상태).
export type CoachMark = 'place' | 'start';
const KEY = 'vocabulary-td.coach';

export const COACH_TEXT: Record<CoachMark, string> = {
  place: '타워를 끌어다 길 옆 돌 받침에 놓아요.',
  start: '전투 시작을 누르면 적이 와요.',
};

export function readCoachDone(): Set<CoachMark> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is CoachMark => x === 'place' || x === 'start') : []);
  } catch {
    return new Set();
  }
}

export function markCoachDone(done: Set<CoachMark>, mark: CoachMark): Set<CoachMark> {
  if (done.has(mark)) return done;
  const next = new Set(done).add(mark);
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* 저장소를 못 쓰면 이번 판에서만 기억한다. */ }
  return next;
}

/** 지금 보일 코치 마크. 준비 단계에서 타워가 없으면 놓기, 있으면 시작. */
export function currentCoach(view: Pick<GameView, 'phase' | 'towers'>, done: ReadonlySet<CoachMark>): CoachMark | null {
  if (view.phase !== 'BUILD') return null;
  if (view.towers.length === 0) return done.has('place') ? null : 'place';
  return done.has('start') ? null : 'start';
}

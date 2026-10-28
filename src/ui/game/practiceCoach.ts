import type { GameView } from '../../application/view';
import type { FieldSelection } from '../../game/bridge';

// 첫 연습 판의 안내(PRD §12.2). 단계마다 해당 조작 옆에 한 문장만 보인다. 모달을 잇달아 띄우지 않는다.
export type CoachAt = 'question' | 'field' | 'panel' | 'start';
export interface CoachStep { at: CoachAt; text: string }

export function practiceCoach(view: GameView, selection: Pick<FieldSelection, 'slotId' | 'previewType'>): CoachStep | null {
  if (view.completedWave >= 1) return null;
  if (view.phase === 'PREP_QUIZ') {
    const q = view.question;
    if (!q?.chosen) return { at: 'question', text: '문제를 풀면 골드를 받아요. 알맞은 답을 눌러 보세요.' };
    // 숫자 뒤 조사(을/를)가 읽는 법에 따라 바뀌므로 ‘골드 +20’처럼 조사 없이 쓴다.
    if (q.feedback?.result === 'correct') return { at: 'question', text: `정답이에요. 골드 +${q.reward?.gold ?? 0} · 골드로 타워를 사요.` };
    return { at: 'question', text: '정답과 해설을 읽고 ‘다음 문제’를 눌러요. 틀려도 골드로 타워를 놓을 수 있어요.' };
  }
  if (view.phase === 'BUILD') {
    if (view.towers.length > 0) return { at: 'start', text: '‘전투 시작’을 누르면 적 3마리가 길을 따라와요.' };
    if (!selection.slotId) return { at: 'field', text: '길 옆 빈 돌 받침을 눌러 타워 자리를 골라요.' };
    if (!selection.previewType) return { at: 'panel', text: '타워를 하나 골라요. 처음에는 빠르게 쏘는 궁수탑이 좋아요.' };
    return { at: 'panel', text: '‘설치’를 누르면 골드를 내고 타워를 놓아요.' };
  }
  if (view.phase === 'BATTLE') return { at: 'question', text: '타워는 알아서 쏴요. 전투 중에도 문제를 풀면 골드를 더 받아요.' };
  return null;
}

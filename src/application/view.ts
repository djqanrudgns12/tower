import type { BranchId, TowerId } from '../contracts/balance';
import type { OptionId } from '../contracts/questions';
import type { GameContext } from '../domain/context';
import type { PauseReason, Phase, RunState, RunStats } from '../domain/types';

// React가 구독하는 요약. 적 위치처럼 매 틱 바뀌는 값은 넣지 않는다(PRD §13.3).
export interface QuestionView {
  encounterId: number;
  label: string;
  stem: string;
  options: Array<{ id: OptionId; text: string }>;
  chosen: OptionId | 'skipped' | null;
  reward: { pt: number; gold: number } | null;
  feedback: null | {
    result: 'correct' | 'wrong' | 'skipped';
    correctOptionId: OptionId;
    correctText: string;
    explanation: string;
    chosenRationale: string | null;
    secondsLeft: number;
    canNext: boolean;
  };
  wrapup: boolean;
}

export interface TowerView { id: number; type: TowerId; slotId: string; level: number; branch: BranchId | null; invested: number }

export interface GameView {
  phase: Phase;
  wave: number;
  completedWave: number;
  endedAtWave: number | null;
  endReason: RunState['endReason'];
  gateHp: number;
  gateMaxHp: number;
  gold: number;
  pt: number;
  pause: PauseReason[];
  burningSecondsLeft: number;
  prep: { done: number; target: number };
  question: QuestionView | null;
  towers: TowerView[];
  stats: RunStats;
  milestoneWave: boolean;
}

export interface Notice { id: number; text: string; tone: 'info' | 'reward' | 'warn' }
export interface ControllerView extends GameView { notices: Notice[]; saveStatus: 'saved' | 'saving' | 'error' | 'disabled' }

const secondsLeft = (until: number | null, tick: number) => (until === null ? 0 : Math.max(0, Math.ceil((until - tick) / 30)));

export function selectView(ctx: GameContext, s: RunState): GameView {
  const enc = s.quiz.current;
  let question: QuestionView | null = null;
  if (enc) {
    const q = ctx.questions.get(enc.questionId)!;
    const text = (id: OptionId) => q.options.find(o => o.id === id)!.text;
    const fb = s.quiz.feedback && s.quiz.feedback.encounterId === enc.id ? s.quiz.feedback : null;
    const label = enc.wrapup ? '마무리 문제' : enc.phase === 'prep' ? `준비 ${Math.min(s.quiz.prepDone + (enc.answer ? 0 : 1), s.quiz.prepTarget)}/${s.quiz.prepTarget}` : '전투 문제';
    const chosen = enc.answer?.choice ?? null;
    question = {
      encounterId: enc.id, label, stem: q.stem, wrapup: enc.wrapup,
      options: enc.optionOrder.map(id => ({ id, text: text(id) })),
      chosen,
      reward: enc.answer ? { pt: enc.answer.pt, gold: enc.answer.gold } : null,
      feedback: fb && {
        result: fb.result,
        correctOptionId: q.correctOptionId,
        correctText: text(q.correctOptionId),
        explanation: q.explanation,
        chosenRationale: chosen && chosen !== 'skipped' && chosen !== q.correctOptionId ? (q.distractorRationales[chosen] ?? null) : null,
        secondsLeft: secondsLeft(fb.nextEnabledTick, s.tick),
        canNext: fb.nextEnabledTick !== null && s.tick >= fb.nextEnabledTick,
      },
    };
  }
  return {
    phase: s.phase, wave: s.wave, completedWave: s.completedWave, endedAtWave: s.endedAtWave, endReason: s.endReason,
    gateHp: Math.max(0, s.gateHp), gateMaxHp: s.gateMaxHp, gold: s.gold, pt: s.pt, pause: [...s.pause],
    burningSecondsLeft: secondsLeft(s.burningUntilTick, s.tick),
    prep: { done: s.quiz.prepDone, target: s.quiz.prepTarget },
    question,
    towers: s.towers.map(t => ({ id: t.id, type: t.type, slotId: t.slotId, level: t.level, branch: t.branch, invested: t.invested })),
    stats: { ...s.stats },
    milestoneWave: s.wave % ctx.balance.waves.bossEveryWaves === 0,
  };
}

/** 화면이 바뀌어야 하는 값만 묶은 열쇠. 같으면 React를 다시 그리지 않는다. */
export function viewKey(s: RunState): string {
  const fb = s.quiz.feedback;
  return [
    s.phase, s.wave, s.gateHp, s.gold, s.pt, s.pause.join(','), s.quiz.current?.id ?? 0, s.quiz.current?.answer ? 1 : 0, s.quiz.current?.wrapup ? 1 : 0,
    fb ? `${fb.result}:${secondsLeft(fb.nextEnabledTick, s.tick)}` : '-', secondsLeft(s.burningUntilTick, s.tick),
    s.towers.map(t => `${t.id}.${t.level}.${t.branch ?? ''}`).join('|'), s.quiz.prepDone,
  ].join('/');
}

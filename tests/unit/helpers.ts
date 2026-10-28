import type { DifficultyId } from '../../src/contracts/balance';
import { contextFor, PILOT_TOWERS } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { advanceTick, applyCommand, createRun, type Command } from '../../src/domain/run';
import type { Phase, RunState } from '../../src/domain/types';

export function newRun(difficulty: DifficultyId = 'Normal', seed = 12345): { ctx: GameContext; s: RunState } {
  const ctx = contextFor(3, difficulty);
  const s = createRun(ctx, {
    runId: `test-${seed}`, playerId: 'p1', nickname: '시험', grade: 3, difficulty, mapId: ctx.map.id, seed,
    bankId: 'g3-dev', bankVersion: '0.1.0-dev', contentMode: 'development', availableTowers: [...PILOT_TOWERS],
    rankingEligibility: 'personal', createdAt: '2026-10-28T00:00:00.000Z',
  });
  return { ctx, s };
}

export function ok(ctx: GameContext, s: RunState, cmd: Command): DomainEvent[] {
  const r = applyCommand(ctx, s, cmd);
  if (!r.ok) throw new Error(`명령 거부: ${cmd.type} → ${r.error}`);
  return r.events;
}

export function correctChoice(ctx: GameContext, s: RunState) {
  const enc = s.quiz.current!;
  return ctx.questions.get(enc.questionId)!.correctOptionId;
}

export function wrongChoice(ctx: GameContext, s: RunState) {
  const enc = s.quiz.current!;
  const q = ctx.questions.get(enc.questionId)!;
  return q.options.find(o => o.id !== q.correctOptionId)!.id;
}

export function ticks(ctx: GameContext, s: RunState, n: number): DomainEvent[] {
  const all: DomainEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...advanceTick(ctx, s));
  return all;
}

/** 현재 문항에 답하고 피드백이 끝날 때까지 진행한다. */
export function answerCurrent(ctx: GameContext, s: RunState, kind: 'correct' | 'wrong' | 'skip') {
  const id = s.quiz.current!.id;
  if (kind === 'skip') ok(ctx, s, { type: 'skip', encounterId: id });
  else ok(ctx, s, { type: 'answer', encounterId: id, choice: kind === 'correct' ? correctChoice(ctx, s) : wrongChoice(ctx, s) });
  const fb = s.quiz.feedback!;
  if (fb.autoAdvanceTick !== null) ticks(ctx, s, fb.autoAdvanceTick - s.tick);
  // 수동 ‘다음’은 그 틱의 판정 뒤에 처리되므로 한 틱을 더 진행한다(PRD §3.4(8)).
  else { ticks(ctx, s, fb.nextEnabledTick! - s.tick); ok(ctx, s, { type: 'next', encounterId: id }); ticks(ctx, s, 1); }
}

export function finishPrep(ctx: GameContext, s: RunState, kind: 'correct' | 'wrong' | 'skip' = 'correct') {
  while (s.phase === 'PREP_QUIZ') answerCurrent(ctx, s, kind);
}

export function runUntil(ctx: GameContext, s: RunState, phases: Phase[], limit = 30 * 600): DomainEvent[] {
  const all: DomainEvent[] = [];
  for (let i = 0; i < limit && !phases.includes(s.phase); i++) all.push(...advanceTick(ctx, s));
  if (!phases.includes(s.phase)) throw new Error(`${phases.join('/')}에 도달하지 못함: ${s.phase}`);
  return all;
}

/** 경로에서 가장 가까운 빈 슬롯. */
export function nearestSlots(ctx: GameContext, count: number): string[] {
  const path = ctx.map.pathCells;
  return [...ctx.map.slots]
    .map(slot => ({ id: slot.id, d: Math.min(...path.map(([x, y]) => (x - slot.x) ** 2 + (y - slot.y) ** 2)), cover: path.filter(([x, y]) => (x - slot.x) ** 2 + (y - slot.y) ** 2 <= 6.25).length }))
    .sort((a, b) => b.cover - a.cover || a.d - b.d || a.id.localeCompare(b.id))
    .slice(0, count).map(x => x.id);
}

/** 상태 해시(FNV-1a 32). 재생 결과 비교용. */
export function stateHash(s: RunState): string {
  const text = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

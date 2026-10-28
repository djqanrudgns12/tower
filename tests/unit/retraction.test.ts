import { describe, expect, it } from 'vitest';
import { contextFor, ContentUnavailableError, gradeContent, toRuntime } from '../../src/content';
import type { RetractionList } from '../../src/contracts/questions';
import { replaceUnavailableQuestion } from '../../src/domain/run';
import { answerCurrent, finishPrep, newRun, ok, runUntil } from './helpers';

// A26: 준비 시도 유지·전투 무벌점 교체·마무리 무벌점 취소, 알려진 오류 해설의 복습 노출 없음(PRD §9.5, §17.2).
const retract = (...ids: Array<[string, number]>): RetractionList => ({
  listVersion: 'test', entries: ids.map(([questionId, revision]) => ({ questionId, revision, reason: '시험', retractedAt: '2026-10-28T00:00:00.000Z' })),
});

describe('A26 문항 철회 목록', () => {
  it('철회된 revision만 빼고, 전부 철회되면 판을 열지 않는다', () => {
    const bank = gradeContent(3).bank!;
    const first = bank.questions[0]!;
    expect(toRuntime(bank, retract([first.id, first.revision])).some(q => q.id === first.id)).toBe(false);
    expect(toRuntime(bank, retract([first.id, first.revision + 1])).some(q => q.id === first.id)).toBe(true);
    const all = retract(...bank.questions.map(q => [q.id, q.revision] as [string, number]));
    expect(() => contextFor(3, 'Normal', all)).toThrow(ContentUnavailableError);
  });

  it('준비 문항이 철회되면 시도 수를 늘리지 않고 바꾼다', () => {
    const { s } = newRun();
    answerCurrent(contextFor(3, 'Normal'), s, 'correct');
    const before = { id: s.quiz.current!.id, prepDone: s.quiz.prepDone, pt: s.pt, gold: s.gold, history: s.quiz.history.length };
    const ctx = contextFor(3, 'Normal', retract([s.quiz.current!.questionId, s.quiz.current!.revision]));
    expect(replaceUnavailableQuestion(ctx, s).some(e => e.type === 'encounter')).toBe(true);
    expect(s.quiz.current!.id).not.toBe(before.id);
    expect(ctx.questions.has(s.quiz.current!.questionId)).toBe(true);
    expect({ prepDone: s.quiz.prepDone, pt: s.pt, gold: s.gold, history: s.quiz.history.length })
      .toEqual({ prepDone: before.prepDone, pt: before.pt, gold: before.gold, history: before.history });
  });

  it('전투 문항은 무벌점 교체, 마무리 문항은 취소 후 다음 준비', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    const battle = contextFor(3, 'Normal', retract([s.quiz.current!.questionId, s.quiz.current!.revision]));
    replaceUnavailableQuestion(battle, s);
    expect({ phase: s.phase, questionPhase: s.quiz.current!.phase, streak: s.quiz.battleStreak }).toEqual({ phase: 'BATTLE', questionPhase: 'battle', streak: 0 });

    s.battle!.spawnIndex = s.battle!.spawnList.length;
    s.enemies = [];
    runUntil(ctx, s, ['WAVE_WRAPUP']);
    const wave = s.wave;
    const wrapup = contextFor(3, 'Normal', retract([s.quiz.current!.questionId, s.quiz.current!.revision]));
    replaceUnavailableQuestion(wrapup, s);
    expect({ phase: s.phase, wave: s.wave, questionPhase: s.quiz.current!.phase }).toEqual({ phase: 'PREP_QUIZ', wave: wave + 1, questionPhase: 'prep' });
  });

  it('이미 답한 문항은 철회돼도 소급 변경하지 않는다', () => {
    const { ctx, s } = newRun();
    const id = s.quiz.current!.id;
    ok(ctx, s, { type: 'skip', encounterId: id });
    const after = contextFor(3, 'Normal', retract([s.quiz.current!.questionId, s.quiz.current!.revision]));
    expect(replaceUnavailableQuestion(after, s)).toEqual([]);
    expect(s.quiz.current!.id).toBe(id);
  });
});

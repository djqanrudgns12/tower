import { describe, expect, it } from 'vitest';
import { BALANCE, practiceContext } from '../../src/content';
import { createRun } from '../../src/domain/run';
import { practiceCoach } from '../../src/ui/game/practiceCoach';
import { selectView } from '../../src/application/view';
import { answerCurrent, ok, runUntil } from './helpers';

// PRD §12.2: 문제 1개 → 골드 → 궁수 선택/설치 → 적 3개 방어 → 생존 회복. 정규 시드·점수·첫5문항에 영향 없음.
const practiceRun = () => {
  const ctx = practiceContext();
  const s = createRun(ctx, {
    runId: 'practice-test', playerId: 'p1', nickname: '연습', grade: 3, difficulty: 'Easy', mapId: ctx.map.id, seed: 20261028,
    bankId: 'practice', bankVersion: '0.1.0-practice', contentMode: 'development', availableTowers: ['archer', 'cannon', 'frost'],
    rankingEligibility: 'personal', createdAt: '2026-10-28T00:00:00.000Z',
  });
  return { ctx, s };
};

describe('첫 연습 판', () => {
  it('문제 1개, 적 3마리, 생존하면 성문이 다시 가득 찬다', () => {
    const { ctx, s } = practiceRun();
    expect(ctx.questionIds.every(id => id.startsWith('g3-practice-'))).toBe(true);
    expect(s.quiz.prepTarget).toBe(1);
    answerCurrent(ctx, s, 'correct');
    expect(s.phase).toBe('BUILD');
    ok(ctx, s, { type: 'build', slotId: ctx.map.slots.find(slot => slot.x === 8 && slot.y === 2)!.id, tower: 'archer' });
    ok(ctx, s, { type: 'startBattle' });
    expect(s.battle!.spawnList.map(e => e.kind)).toEqual(['walker', 'walker', 'walker']);
    s.gateHp -= 1;
    runUntil(ctx, s, ['WAVE_WRAPUP', 'PREP_QUIZ', 'GAME_OVER']);
    expect({ completed: s.completedWave, gate: s.gateHp, max: s.gateMaxHp, over: s.phase === 'GAME_OVER' }).toEqual({ completed: 1, gate: s.gateMaxHp, max: s.gateMaxHp, over: false });
  });

  it('정규 밸런스는 바꾸지 않는다', () => {
    practiceContext();
    expect([BALANCE.run.prepAttempts.firstWave, BALANCE.waves.count.base, BALANCE.balanceVersion.includes('practice')]).toEqual([5, 24, false]);
  });

  it('안내는 지금 할 조작 옆에 한 문장씩 나온다', () => {
    const { ctx, s } = practiceRun();
    const texts: string[] = [];
    const at = (slotId: string | null = null, previewType: 'archer' | null = null) => {
      const step = practiceCoach(selectView(ctx, s), { slotId, previewType });
      if (step) texts.push(step.text);
      return step?.at;
    };
    expect(at()).toBe('question');
    answerCurrent(ctx, s, 'correct');
    const slot = ctx.map.slots[8]!.id;
    expect([at(), at(slot), at(slot, 'archer')]).toEqual(['field', 'panel', 'panel']);
    ok(ctx, s, { type: 'build', slotId: slot, tower: 'archer' });
    expect(at()).toBe('start');
    // 문구: 느낌표 화면당 1개 이하(PRD §12.8). 안내 문장에는 쓰지 않는다.
    expect(texts.filter(t => t.includes('!'))).toEqual([]);
  });
});

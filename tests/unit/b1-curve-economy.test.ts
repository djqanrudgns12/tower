import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/content';
import { burningBonusBP } from '../../src/domain/combat';
import { msToTicks } from '../../src/domain/num';
import { correctGoldAt } from '../../src/domain/run';
import type { GameContext } from '../../src/domain/context';
import type { RunState } from '../../src/domain/types';
import { answerCurrent, finishPrep, newRun, ok, ticks } from './helpers';

// R4 B1 곡선·경제(prd-r4 §7.2 A·B): 정답 골드의 웨이브 성장, 불꽃 2단, 연속 정답의 웨이브 넘김.

/** 지금 전투를 적 없이 바로 끝낸다(성문 무사). 마무리 문항이 남으면 WAVE_WRAPUP에 머문다. */
function endBattle(ctx: GameContext, s: RunState) {
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  s.enemies = [];
  ticks(ctx, s, 1);
}

describe('정답 골드 = correctGold + floor(correctGoldPerWaveBP × (웨이브 − 1) / 10000)', () => {
  it('보통: 1웨이브 22, 웨이브마다 0.75씩 내림으로 오른다', () => {
    const d = BALANCE.difficulties.Normal;
    expect(d.correctGoldPerWaveBP).toBe(7500);
    expect([1, 2, 3, 5, 11, 21].map(w => correctGoldAt(d, w))).toEqual([22, 22, 23, 25, 29, 37]);
    // 성장이 없는 난이도 설정이면 고정값이다.
    expect(correctGoldAt({ ...d, correctGoldPerWaveBP: 0 }, 30)).toBe(22);
    expect(correctGoldAt({ ...d, correctGoldPerWaveBP: undefined }, 30)).toBe(22);
  });

  it('준비 문항 정답은 그 웨이브의 값을 받고, 오답은 0골드다(확정)', () => {
    const { ctx, s } = newRun('Normal', 7);
    finishPrep(ctx, s);
    expect(s.quiz.history.filter(e => e.answer!.correct).map(e => e.answer!.gold)).toEqual([22, 22, 22, 22, 22]);
    // 5웨이브 준비 문항까지 건너뛴다.
    for (let w = 1; w <= 4; w++) {
      if (s.phase === 'PREP_QUIZ') finishPrep(ctx, s);
      ok(ctx, s, { type: 'startBattle' });
      endBattle(ctx, s);
      while (s.phase === 'WAVE_WRAPUP') answerCurrent(ctx, s, 'correct');
    }
    expect([s.phase, s.wave]).toEqual(['PREP_QUIZ', 5]);
    const gold = s.gold;
    answerCurrent(ctx, s, 'correct');
    expect(s.gold - gold).toBe(25);
    expect(s.quiz.history.at(-1)!.answer!.gold).toBe(25);
    const before = s.gold;
    answerCurrent(ctx, s, 'wrong');
    expect(s.gold).toBe(before);
    expect(s.quiz.history.at(-1)!.answer!.gold).toBe(0);
  });
});

describe('불꽃(버닝) 2단과 웨이브를 넘는 연속 정답', () => {
  it('3연속은 1단(+25%), 6연속 이상은 2단(+40%)이고 3개마다 지금부터 다시 센다', () => {
    const { ctx, s } = newRun('Normal', 9);
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 40 }, () => ({ kind: 'brute' as const, elite: null }));
    s.gateHp = s.gateMaxHp = 1000;
    for (let i = 0; i < 3; i++) answerCurrent(ctx, s, 'correct');
    expect(s.burningTier).toBe(1);
    expect(burningBonusBP(ctx, s, s.tick)).toBe(BALANCE.burning.attackSpeedBP);
    for (let i = 0; i < 3; i++) answerCurrent(ctx, s, 'correct');
    expect(s.quiz.battleStreak).toBe(6);
    expect(s.burningTier).toBe(2);
    expect(burningBonusBP(ctx, s, s.tick)).toBe(BALANCE.burning.tier2!.attackSpeedBP);
    expect(BALANCE.burning.tier2).toEqual({ streak: 6, attackSpeedBP: 4000 });
    // 오답은 연속을 끊지만 켜진 불꽃은 남은 시간까지 간다. 다시 3연속이면 1단으로 새로 켠다.
    const until = s.burningUntilTick;
    answerCurrent(ctx, s, 'wrong');
    expect([s.quiz.battleStreak, s.burningTier, s.burningUntilTick]).toEqual([0, 2, until]);
    for (let i = 0; i < 3; i++) answerCurrent(ctx, s, 'correct');
    expect(s.burningTier).toBe(1);
    expect(s.burningUntilTick).toBe(s.quiz.history.at(-1)!.answer!.tick + msToTicks(BALANCE.burning.durationMs));
  });

  it('streakAcrossWaves: 웨이브가 끝나면 불꽃은 꺼지지만 전투 연속 수는 다음 웨이브로 이어진다. 준비 문항은 세지도 끊지도 않는다', () => {
    expect(BALANCE.burning.streakAcrossWaves).toBe(true);
    const { ctx, s } = newRun('Normal', 11);
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 40 }, () => ({ kind: 'brute' as const, elite: null }));
    s.gateHp = s.gateMaxHp = 1000;
    for (let i = 0; i < 5; i++) answerCurrent(ctx, s, 'correct');
    expect([s.quiz.battleStreak, s.burningTier]).toEqual([5, 1]);
    endBattle(ctx, s);
    // 마무리 문항이 걸려 있으면 정답으로 넘긴다(충전하지 않는다).
    while (s.phase === 'WAVE_WRAPUP') answerCurrent(ctx, s, 'correct');
    expect([s.burningUntilTick, s.burningTier, s.quiz.battleStreak]).toEqual([-1, 0, 5]);
    // 준비 문항의 오답은 전투 연속을 끊지 않는다.
    answerCurrent(ctx, s, 'wrong');
    finishPrep(ctx, s);
    expect(s.quiz.battleStreak).toBe(5);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 40 }, () => ({ kind: 'brute' as const, elite: null }));
    answerCurrent(ctx, s, 'correct');
    expect([s.quiz.battleStreak, s.burningTier]).toEqual([6, 2]);
    expect(s.burningUntilTick).toBeGreaterThan(s.tick);
  });

  it('streakAcrossWaves: 마무리 문항(전투 문항)의 오답·모르겠어요는 연속을 끊는다', () => {
    const { ctx, s } = newRun('Normal', 13);
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 40 }, () => ({ kind: 'brute' as const, elite: null }));
    s.gateHp = s.gateMaxHp = 1000;
    for (let i = 0; i < 2; i++) answerCurrent(ctx, s, 'correct');
    expect(s.quiz.current!.answer).toBeNull();
    endBattle(ctx, s);
    expect(s.phase).toBe('WAVE_WRAPUP');
    expect(s.quiz.battleStreak).toBe(2);
    answerCurrent(ctx, s, 'skip');
    expect(s.quiz.battleStreak).toBe(0);
  });

  it('streakAcrossWaves가 꺼진 밸런스는 예전처럼 웨이브마다 연속을 0으로 되돌린다', () => {
    const { ctx: base, s } = newRun('Normal', 15);
    const ctx = { ...base, balance: { ...base.balance, burning: { ...base.balance.burning, streakAcrossWaves: false } } };
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 40 }, () => ({ kind: 'brute' as const, elite: null }));
    for (let i = 0; i < 2; i++) answerCurrent(ctx, s, 'correct');
    endBattle(ctx, s);
    while (s.phase === 'WAVE_WRAPUP') answerCurrent(ctx, s, 'correct');
    expect(s.quiz.battleStreak).toBe(0);
  });
});

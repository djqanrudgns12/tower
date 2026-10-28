import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { OptionId } from '../../src/contracts/questions';
import { advanceTick, applyCommand, type Command } from '../../src/domain/run';
import { attackIntervalTicks, towerStats } from '../../src/domain/towers';
import { answerCurrent, correctChoice, finishPrep, nearestSlots, newRun, ok, runUntil, stateHash, ticks, wrongChoice } from './helpers';

describe('준비·배치·전투 흐름', () => {
  it('A01: 1·2·3웨이브 준비는 최초 제출 5/3/3회, 오답·모르겠어요도 횟수에 포함', () => {
    const { ctx, s } = newRun();
    const counts: number[] = [];
    for (let w = 1; w <= 3; w++) {
      let n = 0;
      while (s.phase === 'PREP_QUIZ') { answerCurrent(ctx, s, n % 2 ? 'wrong' : 'skip'); n++; }
      counts.push(n);
      expect(s.phase).toBe('BUILD');
      ok(ctx, s, { type: 'startBattle' });
      s.battle!.spawnList = [{ kind: 'walker', elite: null }];
      runUntil(ctx, s, ['PREP_QUIZ', 'WAVE_WRAPUP']);
      while (s.phase === 'WAVE_WRAPUP') answerCurrent(ctx, s, 'skip');
    }
    expect(counts).toEqual([5, 3, 3]);
  });

  it('A02: 수동 시작 전에는 적·전투 문항·버닝이 없다', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ticks(ctx, s, 600);
    expect(s.phase).toBe('BUILD');
    expect(s.enemies).toHaveLength(0);
    expect(s.quiz.current).toBeNull();
    expect(applyCommand(ctx, s, { type: 'answer', encounterId: 1, choice: 'a' })).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });

  it('준비 문제를 모두 틀려도 시작 골드 120으로 궁수 2개를 놓을 수 있다', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s, 'wrong');
    expect(s.gold).toBe(120);
    const [a, b] = nearestSlots(ctx, 2);
    ok(ctx, s, { type: 'build', slotId: a!, tower: 'archer' });
    ok(ctx, s, { type: 'build', slotId: b!, tower: 'archer' });
    expect(s.gold).toBe(0);
  });
});

describe('성문·처치·누출(PRD §3.3)', () => {
  it('A03: HP1에서 마지막 적을 처치하면 최대 HP로 1회 회복', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    for (const slot of nearestSlots(ctx, 3)) ok(ctx, s, { type: 'build', slotId: slot, tower: 'archer' });
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'walker', elite: null }];
    s.battle!.hpBaseMilli = 1;
    s.gateHp = 1;
    runUntil(ctx, s, ['PREP_QUIZ', 'WAVE_WRAPUP']);
    expect(s.stats.kills).toBe(1);
    expect(s.gateHp).toBe(s.gateMaxHp);
    expect(s.completedWave).toBe(1);
  });

  it('A04: HP1에서 마지막 일반 적이 누출되면 0HP 패배, 회복·다음 웨이브 없음', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'walker', elite: null }];
    s.gateHp = 1;
    runUntil(ctx, s, ['GAME_OVER']);
    expect(s.gateHp).toBe(0);
    expect(s.completedWave).toBe(0);
    expect(s.endedAtWave).toBe(1);
    expect(s.quiz.current).toBeNull();
  });

  it('A05·C02: 보스 누출 후 성문이 살아 있으면 완료·전회복, 보스 보상 0, 고비 생존 40골드', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    s.wave = 5;
    const before = { gold: s.gold, pt: s.pt };
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'boss', elite: null }];
    const answered = { gold: 0, pt: 0 };
    const events = runUntil(ctx, s, ['PREP_QUIZ', 'WAVE_WRAPUP']);
    for (const e of events) if (e.type === 'answered') { answered.gold += e.gold; answered.pt += e.pt; }
    expect(s.stats.bossLeaks).toBe(1);
    expect(s.gateHp).toBe(s.gateMaxHp);
    expect(s.gold - before.gold).toBe(40);
    expect(s.pt - before.pt).toBe(0);
    expect(s.milestoneRewardedWaves).toEqual([5]);
  });

  it('C01: Normal 5웨이브 보스 처치+생존 = 75골드/20PT + 40골드, 장부 1회', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    s.wave = 5;
    for (const slot of nearestSlots(ctx, 2)) ok(ctx, s, { type: 'build', slotId: slot, tower: 'archer' });
    const before = { gold: s.gold, pt: s.pt };
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'boss', elite: null }];
    s.battle!.hpBaseMilli = 1;
    runUntil(ctx, s, ['PREP_QUIZ', 'WAVE_WRAPUP']);
    expect(s.stats.bossKills).toBe(1);
    expect(s.gold - before.gold).toBe(75 + 40);
    expect(s.pt - before.pt).toBe(20);
  });

  it('A06: 같은 틱에 처치될 적은 이동·누출하지 않는다(처치 우선)', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'walker', elite: null }];
    ticks(ctx, s, 1);
    const e = s.enemies[0]!;
    e.progress = ctx.path.length - 1;
    e.hp = 1;
    s.projectiles.push({ id: 999, towerId: 1, towerType: 'archer', fromX: 0, fromY: 0, targetId: e.id, toX: 0, toY: 0, firedTick: s.tick, arrivalTick: s.tick + 1, damage: 5000, damageType: 'physical', splashRadius: 0, maxTargets: 1, slowBP: 0, slowTicks: 0 });
    const gate = s.gateHp;
    const events = ticks(ctx, s, 1);
    expect(events.filter(x => x.type === 'kill')).toHaveLength(1);
    expect(events.filter(x => x.type === 'leak')).toHaveLength(0);
    expect(s.gateHp).toBe(gate);
  });

  it('기본형은 장애 없이 정확히 720틱에 출구에 닿는다(4맵 공통 통과 시간)', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'walker', elite: null }];
    const start = s.tick;
    const events = runUntil(ctx, s, ['PREP_QUIZ', 'WAVE_WRAPUP', 'GAME_OVER']);
    const leakAt = start + events.findIndex(x => x.type === 'leak');
    expect(events.some(x => x.type === 'leak')).toBe(true);
    expect(leakAt).toBeGreaterThan(0);
    expect(s.stats.leaks).toBe(1);
    expect(s.stats.battleTicks).toBe(720);
  });
});

describe('문항·점수(PRD §4.3~4.4, §5)', () => {
  it('A07: 같은 encounter 연타·재제출은 채점·보상 1회', () => {
    const { ctx, s } = newRun();
    const id = s.quiz.current!.id;
    const choice = correctChoice(ctx, s);
    ok(ctx, s, { type: 'answer', encounterId: id, choice });
    expect(applyCommand(ctx, s, { type: 'answer', encounterId: id, choice })).toEqual({ ok: false, error: 'ALREADY_ANSWERED' });
    expect(applyCommand(ctx, s, { type: 'skip', encounterId: id })).toEqual({ ok: false, error: 'ALREADY_ANSWERED' });
    expect(s.gold).toBe(120 + 22);
    expect(s.pt).toBe(15);
  });

  it('A08: 0PT에서 오답이면 음수 PT, 골드·성문은 그대로', () => {
    const { ctx, s } = newRun();
    answerCurrent(ctx, s, 'wrong');
    expect(s.pt).toBe(-8);
    expect(s.gold).toBe(120);
    expect(s.gateHp).toBe(15);
  });

  it('A32: 모르겠어요는 PT·골드 0, 4초(120틱) 뒤에만 수동 진행, 준비 시도 1회', () => {
    const { ctx, s } = newRun();
    const id = s.quiz.current!.id;
    ok(ctx, s, { type: 'skip', encounterId: id });
    expect([s.pt, s.gold, s.quiz.prepDone, s.stats.skipped]).toEqual([0, 120, 1, 1]);
    ticks(ctx, s, 119);
    expect(applyCommand(ctx, s, { type: 'next', encounterId: id })).toEqual({ ok: false, error: 'NEXT_NOT_READY' });
    ticks(ctx, s, 1);
    ok(ctx, s, { type: 'next', encounterId: id });
    // 수동 전환은 그 틱의 판정 뒤에 처리한다(PRD §3.4(8)).
    expect(s.quiz.current!.id).toBe(id);
    ticks(ctx, s, 1);
    expect(s.quiz.current!.id).not.toBe(id);
    expect(s.quiz.history[0]!.answer!.choice).toBe('skipped');
  });

  it('A09: 오답 대기 중 정지·재개는 남은 대기 시간을 보존하고 정지 중 답안을 받지 않는다', () => {
    const { ctx, s } = newRun();
    const id = s.quiz.current!.id;
    ok(ctx, s, { type: 'answer', encounterId: id, choice: wrongChoice(ctx, s) });
    ticks(ctx, s, 60);
    ok(ctx, s, { type: 'pause', reason: 'USER' });
    const t = s.tick;
    ticks(ctx, s, 500);
    expect(s.tick).toBe(t);
    expect(applyCommand(ctx, s, { type: 'next', encounterId: id })).toEqual({ ok: false, error: 'PAUSED' });
    ok(ctx, s, { type: 'resume', reason: 'USER' });
    ticks(ctx, s, 59);
    expect(applyCommand(ctx, s, { type: 'next', encounterId: id }).ok).toBe(false);
    ticks(ctx, s, 1);
    expect(applyCommand(ctx, s, { type: 'next', encounterId: id }).ok).toBe(true);
  });

  it('A10·A25: 전투 종료 때 미제출 문항 1개만 마무리, 새 전투 문항 없음, 버닝 충전 없음', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'walker', elite: null }];
    const battleEncounter = s.quiz.current!.id;
    runUntil(ctx, s, ['WAVE_WRAPUP']);
    expect(s.quiz.current!.id).toBe(battleEncounter);
    expect(s.quiz.current!.wrapup).toBe(true);
    const before = { gold: s.gold, pt: s.pt };
    ok(ctx, s, { type: 'answer', encounterId: battleEncounter, choice: correctChoice(ctx, s) });
    expect(s.gold - before.gold).toBe(22);
    expect(s.burningUntilTick).toBe(-1);
    runUntil(ctx, s, ['PREP_QUIZ']);
    expect(s.wave).toBe(2);
    expect(s.quiz.history.filter(h => h.phase === 'battle')).toHaveLength(1);
  });

  it('A11: 종료 순간 이미 채점된 문항은 재제출·재보상 없이 피드백만 마무리', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'walker', elite: null }];
    const id = s.quiz.current!.id;
    ticks(ctx, s, 700);
    ok(ctx, s, { type: 'answer', encounterId: id, choice: wrongChoice(ctx, s) });
    runUntil(ctx, s, ['WAVE_WRAPUP']);
    expect(applyCommand(ctx, s, { type: 'answer', encounterId: id, choice: 'a' })).toEqual({ ok: false, error: 'ALREADY_ANSWERED' });
    ticks(ctx, s, 120);
    ok(ctx, s, { type: 'next', encounterId: id });
    ticks(ctx, s, 1);
    expect(s.phase).toBe('PREP_QUIZ');
  });

  it('A12: 3연속 정답마다 버닝 8초 갱신, 오답은 연속 0, 웨이브 종료 때 버닝 0', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 24 }, () => ({ kind: 'brute' as const, elite: null }));
    for (let i = 0; i < 3; i++) answerCurrent(ctx, s, 'correct');
    expect(s.burningUntilTick).toBe(s.quiz.history.at(-1)!.answer!.tick + 240);
    answerCurrent(ctx, s, 'wrong');
    expect(s.quiz.battleStreak).toBe(0);
    for (let i = 0; i < 3; i++) answerCurrent(ctx, s, 'correct');
    const refreshed = s.burningUntilTick;
    expect(refreshed).toBe(s.quiz.history.at(-1)!.answer!.tick + 240);
    runUntil(ctx, s, ['WAVE_WRAPUP', 'PREP_QUIZ', 'GAME_OVER']);
    expect(s.burningUntilTick).toBe(-1);
  });

  it('A36: 전투 출제는 읽기 부담 상한 이하 문항을 고른다', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = Array.from({ length: 24 }, () => ({ kind: 'brute' as const, elite: null }));
    for (let i = 0; i < 12 && s.phase === 'BATTLE'; i++) {
      expect(ctx.questions.get(s.quiz.current!.questionId)!.readingLoad).toBeLessThanOrEqual(ctx.battleReadingLoadMax);
      answerCurrent(ctx, s, 'skip');
    }
  });

  it('A17: 최근 30문항·8의미 안에서 반복하지 않고, 바로 앞 문항은 다시 내지 않는다', () => {
    const { ctx, s } = newRun();
    s.gateHp = s.gateMaxHp = 100000; // 출제 순서만 보려고 성문이 무너지지 않게 한다.
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      seen.push(s.quiz.current!.questionId);
      answerCurrent(ctx, s, 'skip');
      if (s.phase === 'BUILD') { ok(ctx, s, { type: 'startBattle' }); s.battle!.spawnList = Array.from({ length: 30 }, () => ({ kind: 'brute' as const, elite: null })); }
      if (s.phase === 'WAVE_WRAPUP' || s.phase === 'GAME_OVER') break;
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    const firstCycle = seen.slice(0, 30);
    expect(new Set(firstCycle).size).toBe(firstCycle.length);
  });
});

describe('거래(PRD §6.3, §7)', () => {
  it('A13: 골드 부족·이미 찬 칸·준비 단계 거래는 원자적으로 거부', () => {
    const { ctx, s } = newRun();
    const slot = nearestSlots(ctx, 1)[0]!;
    expect(applyCommand(ctx, s, { type: 'build', slotId: slot, tower: 'archer' })).toEqual({ ok: false, error: 'WRONG_PHASE' });
    finishPrep(ctx, s, 'wrong');
    ok(ctx, s, { type: 'build', slotId: slot, tower: 'archer' });
    expect(applyCommand(ctx, s, { type: 'build', slotId: slot, tower: 'archer' })).toEqual({ ok: false, error: 'SLOT_TAKEN' });
    s.gold = 59;
    expect(applyCommand(ctx, s, { type: 'build', slotId: nearestSlots(ctx, 2)[1]!, tower: 'archer' })).toEqual({ ok: false, error: 'NOT_ENOUGH_GOLD' });
    expect(s.gold).toBe(59);
    expect(applyCommand(ctx, s, { type: 'build', slotId: nearestSlots(ctx, 2)[1]!, tower: 'mage' })).toEqual({ ok: false, error: 'NOT_AVAILABLE' });
  });

  it('A14: 궁수 Lv5까지 강화(Lv3 분기 필수) 뒤 판매하면 435의 60%인 261', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    s.gold = 1000;
    ok(ctx, s, { type: 'build', slotId: nearestSlots(ctx, 1)[0]!, tower: 'archer' });
    const id = s.towers[0]!.id;
    ok(ctx, s, { type: 'upgrade', towerId: id });
    expect(applyCommand(ctx, s, { type: 'upgrade', towerId: id })).toEqual({ ok: false, error: 'BRANCH_REQUIRED' });
    ok(ctx, s, { type: 'upgrade', towerId: id, branch: 'A' });
    ok(ctx, s, { type: 'upgrade', towerId: id });
    ok(ctx, s, { type: 'upgrade', towerId: id });
    expect(applyCommand(ctx, s, { type: 'upgrade', towerId: id })).toEqual({ ok: false, error: 'MAX_LEVEL' });
    expect(s.towers[0]!.invested).toBe(435);
    const gold = s.gold;
    ok(ctx, s, { type: 'sell', towerId: id });
    expect(s.gold - gold).toBe(261);
    expect(applyCommand(ctx, s, { type: 'sell', towerId: id })).toEqual({ ok: false, error: 'UNKNOWN_TOWER' });
  });

  it('A30: 강화·버닝은 예약된 공격 시각을 바꾸지 않고, 전투 중 새 타워는 한 간격을 기다린다', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    s.gold = 1000;
    const [a, b] = nearestSlots(ctx, 2);
    ok(ctx, s, { type: 'build', slotId: a!, tower: 'archer' });
    ok(ctx, s, { type: 'startBattle' });
    const scheduled = s.towers[0]!.nextAttackTick;
    ok(ctx, s, { type: 'upgrade', towerId: s.towers[0]!.id });
    s.burningUntilTick = s.tick + 240;
    expect(s.towers[0]!.nextAttackTick).toBe(scheduled);
    ok(ctx, s, { type: 'build', slotId: b!, tower: 'cannon' });
    const cannon = s.towers[1]!;
    // 새 타워의 첫 간격은 구매 순간의 버닝 보너스를 쓴다(PRD §5, §7.2; REVIEW-CORE-001 R04).
    expect(cannon.nextAttackTick).toBe(s.tick + attackIntervalTicks(ctx.balance, towerStats(ctx.balance, 'cannon', 1, null), ctx.balance.burning.attackSpeedBP));
  });

  it('서리 감속은 출처별로 두고 가장 강한 값만, 일반 60%·보스 30% 상한', async () => {
    const { effectiveSlowBP } = await import('../../src/domain/combat');
    const { ctx } = newRun();
    const e = { kind: 'walker', slows: [{ source: 1, bp: 2500, untilTick: 100 }, { source: 2, bp: 4000, untilTick: 50 }] } as never;
    expect(effectiveSlowBP(ctx, e, 10)).toBe(4000);
    expect(effectiveSlowBP(ctx, e, 60)).toBe(2500);
    const boss = { kind: 'boss', slows: [{ source: 1, bp: 9000, untilTick: 100 }] } as never;
    expect(effectiveSlowBP(ctx, boss, 10)).toBe(3000);
  });
});

describe('재현·저장(PRD §13.3, §14)', () => {
  function script(seed: number) {
    const { ctx, s } = newRun('Normal', seed);
    const log: Array<{ at: number; cmd: Command }> = [];
    const send = (cmd: Command) => { log.push({ at: s.tick, cmd }); return applyCommand(ctx, s, cmd); };
    let guard = 0;
    while (s.phase !== 'GAME_OVER' && s.wave <= 3 && guard++ < 20000) {
      const enc = s.quiz.current;
      if (enc && !enc.answer && s.tick % 97 === 0) send({ type: 'answer', encounterId: enc.id, choice: (s.tick % 3 ? correctChoice(ctx, s) : wrongChoice(ctx, s)) as OptionId });
      const fb = s.quiz.feedback;
      if (fb?.nextEnabledTick !== null && fb && s.tick >= fb.nextEnabledTick) send({ type: 'next', encounterId: fb.encounterId });
      if (s.phase === 'BUILD') {
        for (const slot of nearestSlots(ctx, 4)) if (s.gold >= 60 && !s.towers.some(t => t.slotId === slot)) send({ type: 'build', slotId: slot, tower: s.towers.length % 2 ? 'frost' : 'archer' });
        send({ type: 'startBattle' });
      }
      advanceTick(ctx, s);
    }
    return { ctx, s, log };
  }

  it('A18: 같은 seed·같은 명령 기록을 다시 재생하면 상태가 같다', () => {
    const first = script(777);
    const { ctx, s } = newRun('Normal', 777);
    let i = 0;
    while (s.tick < first.s.tick) {
      while (i < first.log.length && first.log[i]!.at === s.tick) applyCommand(ctx, s, first.log[i++]!.cmd);
      advanceTick(ctx, s);
    }
    while (i < first.log.length && first.log[i]!.at === s.tick) applyCommand(ctx, s, first.log[i++]!.cmd);
    expect(stateHash(s)).toBe(stateHash(first.s));
    expect(first.s.wave).toBeGreaterThanOrEqual(2);
  });

  it('A31: 처치 PT 상한 직전 저장·복원해도 이미 지급한 웨이브 처치 PT를 유지', () => {
    const { ctx, s } = newRun();
    finishPrep(ctx, s);
    s.waveKillPtGranted = 29;
    s.gold = 1000;
    const restored = structuredClone(s);
    expect(restored.waveKillPtGranted).toBe(29);
    for (const slot of nearestSlots(ctx, 4)) ok(ctx, restored, { type: 'build', slotId: slot, tower: 'archer' });
    ok(ctx, restored, { type: 'startBattle' });
    restored.battle!.spawnList = [{ kind: 'walker', elite: null }, { kind: 'walker', elite: null }];
    restored.battle!.hpBaseMilli = 1;
    const pt = restored.pt;
    runUntil(ctx, restored, ['PREP_QUIZ', 'WAVE_WRAPUP']);
    const fromKills = restored.pt - pt - restored.quiz.history.filter(h => h.phase === 'battle').reduce((a, h) => a + (h.answer?.pt ?? 0), 0);
    expect(fromKills).toBe(1);
  });
});

describe('불변식(fast-check)', () => {
  it('무작위 명령·틱에서도 골드는 음수가 되지 않고 문항 보상은 encounter당 1회', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 2 ** 31 }), fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 50, maxLength: 400 }), (seed, actions) => {
      const { ctx, s } = newRun('Hard', seed);
      const slots = ctx.map.slots.map(x => x.id);
      for (const a of actions) {
        const enc = s.quiz.current;
        const t = s.towers[a % Math.max(1, s.towers.length)];
        const cmds: Command[] = [
          enc ? { type: 'answer', encounterId: enc.id, choice: (['a', 'b', 'c', 'd'] as const)[a % 4]! } : { type: 'startBattle' },
          enc ? { type: 'skip', encounterId: enc.id } : { type: 'startBattle' },
          { type: 'next', encounterId: s.quiz.feedback?.encounterId ?? 0 },
          { type: 'build', slotId: slots[(a * 7 + s.tick) % slots.length]!, tower: (['archer', 'cannon', 'frost'] as const)[a % 3]! },
          t ? { type: 'upgrade', towerId: t.id, branch: a % 2 ? 'A' : 'B' } : { type: 'startBattle' },
          t ? { type: 'sell', towerId: t.id } : { type: 'startBattle' },
          { type: 'startBattle' },
        ];
        applyCommand(ctx, s, cmds[a % cmds.length]!);
        for (let k = 0; k < (a + 1) * 9; k++) advanceTick(ctx, s);
        expect(s.gold).toBeGreaterThanOrEqual(0);
        expect(s.gateHp <= s.gateMaxHp).toBe(true);
        if (s.phase === 'GAME_OVER') break;
      }
      const ids = s.quiz.history.map(h => h.id);
      expect(new Set(ids).size).toBe(ids.length);
      const sumPt = s.quiz.history.reduce((a, h) => a + h.answer!.pt, 0);
      expect(s.stats.ptFromQuestions).toBe(sumPt);
      expect(s.pt).toBe(s.stats.ptFromQuestions + s.stats.ptFromKills);
    }), { numRuns: 40 });
  });
});

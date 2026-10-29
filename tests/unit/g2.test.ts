import { describe, expect, it } from 'vitest';
import type { OptionId } from '../../src/contracts/questions';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { advanceTick, applyCommand, type Command } from '../../src/domain/run';
import type { RunState } from '../../src/domain/types';
import { nearestSlots, newRun, stateHash } from './helpers';

// G2 첫 완성 구간 게이트(PRD §18.2): 한 판을 1→6웨이브까지 이어 가며 정답·오답·모르겠어요를 섞고,
// 중간중간 저장·복원(JSON 왕복 + RESTORED 정지)과 학생 정지를 끼워도 끊김 없는 판과 같은 결과가 나와야 한다.
// 보상은 사건의 골드·PT 합과 상태가 맞아떨어지고(장부 대조), 같은 문항·같은 고비 보상이 두 번 들어가지 않는다.

const TARGET_WAVE = 6;
const SAVE_EVERY = 211; // 소수 간격이라 준비·전투·마무리·오답 대기 등 여러 국면에 걸린다.
const PAUSE_EVERY = 307;

type Interrupt = (s: RunState, ctx: GameContext) => RunState;

/** 상태만 보고 정하는 가상 학생. 같은 상태면 같은 명령을 내므로 두 판을 그대로 비교할 수 있다. */
function decide(ctx: GameContext, s: RunState): Command[] {
  const cmds: Command[] = [];
  const enc = s.quiz.current;
  const fb = s.quiz.feedback;
  if (fb?.nextEnabledTick !== null && fb && s.tick >= fb.nextEnabledTick) cmds.push({ type: 'next', encounterId: fb.encounterId });
  else if (enc && !enc.answer && !fb && s.tick - enc.createdTick >= 45) {
    const q = ctx.questions.get(enc.questionId)!;
    if (enc.id % 5 === 0) cmds.push({ type: 'skip', encounterId: enc.id });
    else cmds.push({ type: 'answer', encounterId: enc.id, choice: (enc.id % 5 === 3 ? q.options.find(o => o.id !== q.correctOptionId)!.id : q.correctOptionId) as OptionId });
  }
  if (s.phase === 'BUILD') {
    const kinds = ['archer', 'cannon', 'frost'] as const;
    for (const slot of nearestSlots(ctx, 6)) if (!s.towers.some(t => t.slotId === slot)) cmds.push({ type: 'build', slotId: slot, tower: kinds[s.towers.length % 3]! });
    for (const t of s.towers) cmds.push({ type: 'upgrade', towerId: t.id, ...(t.level === 2 ? { branch: 'A' as const } : {}) });
    cmds.push({ type: 'startBattle' });
  }
  return cmds;
}

function play(interrupt: Interrupt | null) {
  const run = newRun('Normal', 4242);
  const { ctx } = run;
  let { s } = run;
  const events: DomainEvent[] = [];
  const seen = { restoredInWrongWait: false, restoredMidFlight: false, restoredWithBoss: false, restoredInWrapup: false, restores: 0 };
  for (let guard = 0; guard < 30 * 60 * 40 && s.phase !== 'GAME_OVER' && s.completedWave < TARGET_WAVE; guard++) {
    if (interrupt && s.tick > 0 && s.tick % SAVE_EVERY === 0) {
      const fb = s.quiz.feedback;
      if (fb?.nextEnabledTick && fb.nextEnabledTick > s.tick && fb.result === 'wrong') seen.restoredInWrongWait = true;
      if (s.projectiles.length > 0) seen.restoredMidFlight = true;
      if (s.enemies.some(e => e.alive && e.kind === 'boss')) seen.restoredWithBoss = true;
      if (s.phase === 'WAVE_WRAPUP') seen.restoredInWrapup = true;
      seen.restores++;
      s = interrupt(s, ctx);
    }
    if (interrupt && s.tick > 0 && s.tick % PAUSE_EVERY === 0) {
      expect(applyCommand(ctx, s, { type: 'pause', reason: 'USER' }).ok).toBe(true);
      // 정지 중에는 답안·거래를 받지 않는다.
      for (const cmd of decide(ctx, s)) expect(applyCommand(ctx, s, cmd)).toEqual({ ok: false, error: 'PAUSED' });
      expect(applyCommand(ctx, s, { type: 'resume', reason: 'USER' }).ok).toBe(true);
    }
    for (const cmd of decide(ctx, s)) {
      const r = applyCommand(ctx, s, cmd);
      if (r.ok) events.push(...r.events);
    }
    events.push(...advanceTick(ctx, s));
  }
  return { ctx, s, events, seen };
}

/** 저장(JSON 직렬화)·불러오기와 같은 왕복. 이어하기는 RESTORED 정지로 시작하고 학생이 계속을 누른다(PRD §14.2). */
const saveAndRestore: Interrupt = (s, ctx) => {
  const restored = JSON.parse(JSON.stringify(s)) as RunState;
  restored.pause.push('RESTORED');
  expect(applyCommand(ctx, restored, { type: 'resume', reason: 'RESTORED' }).ok).toBe(true);
  return restored;
};

/** 사건이 실은 골드·PT 변화의 합. 고비 생존 골드는 waveComplete의 milestoneGold로 온다. */
const sum = (events: DomainEvent[], key: 'gold' | 'pt') => events.reduce((a, e) => {
  if (key === 'gold' && e.type === 'waveComplete') return a + e.milestoneGold;
  return a + (key in e ? (e as Record<string, unknown>)[key] as number : 0);
}, 0);

describe('G2 첫 완성 구간: 1→6웨이브 한 판', () => {
  const straight = play(null);
  const interrupted = play(saveAndRestore);

  it('끊김 없는 판이 4→5(고비 보스)→6웨이브를 지나 6웨이브를 마친다', () => {
    expect(straight.s.phase).not.toBe('GAME_OVER');
    expect(straight.s.completedWave).toBe(TARGET_WAVE);
    expect(straight.events.some(e => e.type === 'spawn' && e.kind === 'boss')).toBe(true);
    const answered = straight.events.filter(e => e.type === 'answered');
    expect(new Set(answered.map(e => e.type === 'answered' && e.result))).toEqual(new Set(['correct', 'wrong', 'skipped']));
  });

  it('저장·복원과 정지를 끼운 판은 끊김 없는 판과 상태·사건이 같다', () => {
    const { seen } = interrupted;
    // 이 시험이 실제로 어려운 순간을 지났는지 확인한다.
    expect(seen).toMatchObject({ restoredInWrongWait: true, restoredMidFlight: true, restoredWithBoss: true, restoredInWrapup: true });
    expect(seen.restores).toBeGreaterThan(20);
    expect(stateHash(interrupted.s)).toBe(stateHash(straight.s));
    expect(interrupted.events).toEqual(straight.events);
  });

  for (const [name, run] of [['끊김 없는 판', straight], ['저장·복원 판', interrupted]] as const) {
    it(`${name}: 보상 사건의 합이 상태와 맞고, 같은 문항·고비 보상은 한 번뿐이다`, () => {
      const { ctx, s, events } = run;
      expect(ctx.balance.run.startGold + sum(events, 'gold')).toBe(s.gold);
      expect(sum(events, 'pt')).toBe(s.pt);
      const answered = events.flatMap(e => (e.type === 'answered' ? [e.encounterId] : []));
      expect(new Set(answered).size).toBe(answered.length);
      // 지금 문항도 이미 history에 있으므로 ID로 합친다.
      const recorded = new Set([...s.quiz.history, ...(s.quiz.current ? [s.quiz.current] : [])].filter(h => h.answer).map(h => h.id));
      expect(new Set(answered)).toEqual(recorded);
      const milestones = events.flatMap(e => (e.type === 'waveComplete' && e.milestoneGold > 0 ? [e.wave] : []));
      expect(milestones).toEqual([5]);
      expect(s.milestoneRewardedWaves).toEqual([5]);
      const kills = events.flatMap(e => (e.type === 'kill' ? [e.enemyId] : []));
      expect(new Set(kills).size).toBe(kills.length);
    });
  }
});

import { expect, it } from 'vitest';
import { localBalanceSession } from '../../src/application/balanceSession';
import type { R6TowerId } from '../../src/contracts/balanceV2';
import { applyCommand, advanceTick } from '../../src/domain/run';
import { auraDamageBonusBP, auraSpeedBonusBP, towerStats } from '../../src/domain/towers';
import { newRun } from './helpers';
import { enemy } from './review-core/fixtures';

function battle(type: R6TowerId, level: number, count = 5) {
  const run = localBalanceSession('2.0.0', 3, 'Normal', newRun().s.config);
  if (run.version !== '2.0.0') throw new Error('잘못된 판');
  const { ctx, state: s } = run;
  s.phase = 'BUILD';
  s.owned = [type];
  s.gold = 10000;
  expect(applyCommand(ctx, s, { type: 'build', tower: type, slotId: ctx.map.slots[0]!.id }).ok).toBe(true);
  const t = s.towers[0]!;
  t.level = level;
  t.x = ctx.path.points[0]!.x;
  t.y = ctx.path.points[0]!.y;
  expect(applyCommand(ctx, s, { type: 'startBattle' }).ok).toBe(true);
  t.nextAttackTick = s.tick + 1;
  s.battle!.spawnIndex = s.battle!.spawnList.length;
  s.enemies = Array.from({ length: count }, (_, i) =>
    enemy({ id: i + 1, progress: (i + 1) * 100, speedBP: 0, hp: 1e7, maxHp: 1e7 }),
  );
  s.seq.enemy = count + 1;
  return { ctx, s, t, tick: () => advanceTick(ctx, s) };
}
it('드론은 발진 때 재조준하며 강화 전 발사 피해를 지키고 판매하면 남은 발진을 취소한다', () => {
  const { ctx, s, t, tick } = battle('hangar', 18);
  s.enemies[0]!.flying = true;
  s.enemies[1]!.flying = true;
  const first = tick().find((e) => e.type === 'hit')!;
  expect(first.enemyId).toBe(2);
  expect(applyCommand(ctx, s, { type: 'upgrade', towerId: t.id }).ok).toBe(true);
  tick();
  tick();
  const second = tick().find((e) => e.type === 'hit')!;
  expect(second.enemyId).toBe(1);
  expect(second.damage).toBe(Math.floor(Math.floor(towerStats(ctx.balance, 'hangar', 18, 'base').damage * 0.55) * 1.4));
  expect(applyCommand(ctx, s, { type: 'sell', towerId: t.id }).ok).toBe(true);
  for (let i = 0; i < 8; i++) expect(tick().some((e) => e.type === 'hit')).toBe(false);
});
it('냉각 파동은 남은 감속이 짧은 적부터 치고 아홉 틱 뒤 다시 판정한다', () => {
  const { s, tick } = battle('cryo', 18);
  s.enemies[4]!.slows = [{ source: 99, bp: 3000, untilTick: 200 }];
  const hit = tick().filter((e) => e.type === 'hit');
  expect(hit.map((e) => e.enemyId)).toEqual([4, 3, 2, 1]);
  for (let i = 0; i < 8; i++) expect(tick().some((e) => e.type === 'strike')).toBe(false);
  expect(tick().filter((e) => e.type === 'hit')[0]?.damage).toBe(Math.floor(hit[0]!.damage * 0.3));
});
it('곡사포는 판매 뒤에도 처음 조준한 지점에 착탄·후속탄·장판 두 번을 판정한다', () => {
  const { ctx, s, t, tick } = battle('mortar', 18);
  const fired = tick().find((e) => e.type === 'fire')!;
  const p = s.projectiles[0]!;
  expect(fired.tick).toBe(1);
  expect(applyCommand(ctx, s, { type: 'sell', towerId: t.id }).ok).toBe(true);
  const hits = [];
  for (let i = 0; i < 45; i++) for (const e of tick()) if (e.type === 'areaImpact') hits.push(e);
  expect(hits.map((e) => [e.part, e.tick - p.arrivalTick])).toEqual([
    ['shell', 0],
    ['aftershock', 12],
    ['zone', 18],
    ['zone', 36],
  ]);
  expect(hits.every((e) => e.x === p.toX && e.y === p.toY)).toBe(true);
});
it('프리즘은 직전 피해를 내림해 연쇄하고 방벽은 최고 오라만 이웃에 준다', () => {
  const { ctx, s, t, tick } = battle('prism', 18);
  for (const e of s.enemies) e.magicResistBP = 2500;
  const hits = tick().filter((e) => e.type === 'hit');
  let damage = towerStats(ctx.balance, 'prism', 18, 'base').damage;
  expect(hits).toHaveLength(5);
  for (const hit of hits) {
    expect(hit.damage).toBe(Math.floor((damage * 9) / 10));
    damage = Math.floor((damage * 7) / 10);
  }
  const giv = { ...t, id: 2, type: 'bastion' as const };
  expect(auraDamageBonusBP(ctx.balance, [giv], giv)).toBe(0);
  expect(auraDamageBonusBP(ctx.balance, [giv, { ...giv, id: 3, level: 6 }], t)).toBe(2000);
  expect(auraSpeedBonusBP(ctx.balance, [giv], t)).toBe(900);
});
it('정예 분열 조각은 부모의 정예 전 체력으로 생성하며 조각 처치는 무보상이다', () => {
  const { s, t, tick } = battle('rail', 18, 0);
  const b = s.battle!;
  b.spawnList = [{ kind: 'splitter', entityId: 'insect-special-t3', faction: 'insect', elite: 'armored' }];
  b.spawnIndex = 0;
  b.hpBaseMilli = 100000;
  b.nextSpawnTick = 1;
  t.nextAttackTick = null;
  tick();
  const parent = s.enemies[0]!;
  // 9800 × 1.05 × 0.88는 두 단계 내림 후 9055BP, 정예는 두 배다.
  expect(parent.hp).toBe(181100);
  parent.hp = 1;
  t.nextAttackTick = s.tick + 1;
  tick();
  expect(s.enemies.map((e) => [e.kind, e.maxHp, e.elite, e.derived])).toEqual([
    ['splitling', 16290, null, true],
    ['splitling', 16290, null, true],
  ]);
  s.enemies.forEach((e) => {
    e.hp = 1;
  });
  t.nextAttackTick = s.tick + 1;
  expect(tick().find((e) => e.type === 'kill')).toMatchObject({ gold: 0, pt: 0 });
  expect(s.discovered).toEqual(['insect-special-t3']);
});
it('바위 특수는 생성 90틱 뒤부터 최대 세 번 회복한다', () => {
  const { s, t, tick } = battle('rail', 1, 0);
  const b = s.battle!;
  b.spawnList = [{ kind: 'walker', entityId: 'stone-special-t4', faction: 'stone', elite: null }];
  b.spawnIndex = 0;
  b.nextSpawnTick = 1;
  t.nextAttackTick = null;
  tick();
  const stone = s.enemies[0]!;
  stone.hp = 1;
  stone.speedBP = 0;
  for (let i = 0; i < 89; i++) tick();
  expect(stone.hp).toBe(1);
  for (let i = 0; i < 272; i++) tick();
  expect(stone.hp).toBe(1 + 3 * Math.floor(stone.maxHp * 0.03));
});
it('레일 IV는 첫 표적 뒤의 한 기만 같은 틱에 관통한다', () => {
  const { ctx, s, t, tick } = battle('rail', 18);
  const entry = ctx.path.points[0]!,
    next = ctx.path.points[1]!;
  t.x = entry.x + 1000 * Math.sign(next.x - entry.x);
  t.y = entry.y + 1000 * Math.sign(next.y - entry.y);
  const hits = tick().filter((e) => e.type === 'hit');
  expect(hits.map((e) => e.enemyId)).toEqual([5, 4]);
  expect(hits[1]!.damage).toBe(Math.floor((hits[0]!.damage * 65) / 100));
  expect(s.projectiles).toHaveLength(0);
});
it('레일 연사는 기존 표적을 유지하고 사라진 표적을 다시 고른다', () => {
  const { s, tick } = battle('rail', 12);
  expect(tick().find((e) => e.type === 'hit')?.enemyId).toBe(5);
  s.enemies[0]!.progress = 900;
  for (let i = 0; i < 3; i++) tick();
  expect(tick().find((e) => e.type === 'hit')?.enemyId).toBe(5);
  s.enemies[4]!.alive = false;
  for (let i = 0; i < 3; i++) tick();
  expect(tick().find((e) => e.type === 'hit')?.enemyId).toBe(1);
});

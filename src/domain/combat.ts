import type { GameContext } from './context';
import type { DomainEvent } from './events';
import { dist2, positionAt } from './geometry';
import { add, bpFloor, isqrt, mulDivCeil, safe } from './num';
import { attackIntervalTicks, towerStats } from './towers';
import type { Enemy, Projectile, RunState, Tower } from './types';
import { enemyMaxHp, enemyResists, enemySpeedBP } from './waves';

// 같은 틱 순서(PRD §3.4, §20.3): 만료 → 생성 → 도착 공격 → 타워 발사 → 이동/누출. 패배·완료 판정은 run.ts가 이어서 한다.
export function battleTick(ctx: GameContext, s: RunState, ev: DomainEvent[]): void {
  const t = s.tick;
  const battle = s.battle!;
  for (const e of s.enemies) if (e.slows.length) e.slows = e.slows.filter(x => x.untilTick > t);

  while (battle.spawnIndex < battle.spawnList.length && t >= battle.nextSpawnTick) {
    spawn(ctx, s, ev);
    battle.nextSpawnTick += battle.intervalTicks;
  }

  if (s.projectiles.length) {
    const due = s.projectiles.filter(p => p.arrivalTick <= t);
    if (due.length) {
      s.projectiles = s.projectiles.filter(p => p.arrivalTick > t);
      for (const p of due) resolve(ctx, s, p, ev);
    }
  }

  const speedBonus = t < s.burningUntilTick ? ctx.balance.burning.attackSpeedBP : 0;
  for (const tower of s.towers) fire(ctx, s, tower, speedBonus, ev);

  move(ctx, s, ev);
  if (s.enemies.some(e => !e.alive)) s.enemies = s.enemies.filter(e => e.alive);
}

function spawn(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  const b = ctx.balance;
  const entry = s.battle!.spawnList[s.battle!.spawnIndex++]!;
  const hp = enemyMaxHp(b, ctx.difficulty, s.battle!.hpBaseMilli, entry.kind, entry.elite);
  const res = enemyResists(b, entry.kind, entry.elite);
  const enemy: Enemy = {
    id: s.seq.enemy++, kind: entry.kind, elite: entry.elite, hp, maxHp: hp, progress: 0, moveRem: 0,
    speedBP: enemySpeedBP(b, entry.kind, entry.elite), physicalResistBP: res.physical, magicResistBP: res.magic,
    slows: [], stunUntilTick: 0, stunTicksUsed: 0, alive: true,
  };
  s.enemies.push(enemy);
  ev.push({ type: 'spawn', enemyId: enemy.id, kind: enemy.kind });
}

/** 진행도 최대 → 생성 순번 최소(PRD §7.1). */
function pickTarget(ctx: GameContext, s: RunState, x: number, y: number, range: number): Enemy | null {
  const r2 = range * range;
  let best: Enemy | null = null;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const p = positionAt(ctx.path, e.progress);
    if (dist2(p.x, p.y, x, y) > r2) continue;
    if (!best || e.progress > best.progress || (e.progress === best.progress && e.id < best.id)) best = e;
  }
  return best;
}

function fire(ctx: GameContext, s: RunState, tower: Tower, speedBonus: number, ev: DomainEvent[]) {
  const t = s.tick;
  if (tower.nextAttackTick === null || t < tower.nextAttackTick) return;
  const stats = towerStats(ctx.balance, tower.type, tower.level, tower.branch);
  const target = pickTarget(ctx, s, tower.x, tower.y, stats.range);
  // 표적이 없으면 준비 상태로 기다린다. 기다린 시간만큼 몰아서 쏘지 않는다(PRD §7.2).
  if (!target) return;
  const at = positionAt(ctx.path, target.progress);
  const distance = isqrt(dist2(at.x, at.y, tower.x, tower.y));
  const flight = Math.max(1, mulDivCeil(distance, 30, stats.projectileSpeed, 'flight'));
  const projectile: Projectile = {
    id: s.seq.projectile++, towerId: tower.id, towerType: tower.type, fromX: tower.x, fromY: tower.y,
    targetId: stats.splashRadius > 0 ? null : target.id, toX: at.x, toY: at.y, firedTick: t, arrivalTick: t + flight,
    damage: stats.damage, damageType: stats.damageType, splashRadius: stats.splashRadius, maxTargets: stats.maxTargets,
    slowBP: stats.slowBP, slowTicks: stats.slowTicks,
  };
  s.projectiles.push(projectile);
  tower.nextAttackTick = t + attackIntervalTicks(ctx.balance, stats, speedBonus);
  ev.push({ type: 'fire', projectileId: projectile.id, towerId: tower.id, towerType: tower.type });
}

function resolve(ctx: GameContext, s: RunState, p: Projectile, ev: DomainEvent[]) {
  if (p.targetId !== null) {
    // 단일 대상: 도착 전에 처치·누출되면 빗나감, 다른 적으로 바꾸지 않는다(PRD §20.3).
    const target = s.enemies.find(e => e.id === p.targetId && e.alive);
    if (target) applyHit(ctx, s, p, target, ev);
    return;
  }
  const r2 = p.splashRadius * p.splashRadius;
  const hits = s.enemies
    .filter(e => e.alive)
    .map(e => { const at = positionAt(ctx.path, e.progress); return { e, d: dist2(at.x, at.y, p.toX, p.toY) }; })
    .filter(h => h.d <= r2)
    .sort((a, b) => a.d - b.d || b.e.progress - a.e.progress || a.e.id - b.e.id)
    .slice(0, p.maxTargets);
  for (const h of hits) applyHit(ctx, s, p, h.e, ev);
}

/** 저항 계산 뒤 양의 피해는 최소 1 milli-HP(PRD §20.2). */
export function mitigated(damage: number, resistBP: number): number {
  if (damage <= 0) return 0;
  return Math.max(1, bpFloor(damage, 10000 - resistBP, 'resist'));
}

function applyHit(ctx: GameContext, s: RunState, p: Projectile, e: Enemy, ev: DomainEvent[]) {
  const resist = p.damageType === 'physical' ? e.physicalResistBP : e.magicResistBP;
  const dealt = Math.min(e.hp, mitigated(p.damage, resist));
  e.hp = safe(e.hp - dealt, 'hp');
  const at = positionAt(ctx.path, e.progress);
  ev.push({ type: 'hit', enemyId: e.id, x: at.x, y: at.y, damage: dealt, towerType: p.towerType });
  if (e.hp === 0) {
    kill(ctx, s, e, at, ev);
    return;
  }
  if (p.slowBP > 0) {
    // 출처별 세기·만료를 따로 둔다. 약한 효과가 강한 효과의 만료를 늘리지 않는다(PRD §8.5).
    const own = e.slows.find(x => x.source === p.towerId);
    const untilTick = s.tick + p.slowTicks;
    if (own) { own.bp = p.slowBP; own.untilTick = untilTick; }
    else e.slows.push({ source: p.towerId, bp: p.slowBP, untilTick });
  }
}

function kill(ctx: GameContext, s: RunState, e: Enemy, at: { x: number; y: number }, ev: DomainEvent[]) {
  e.alive = false;
  const d = ctx.difficulty;
  const tier = e.kind === 'boss' ? 'boss' : e.elite ? 'elite' : 'regular';
  const gold = d.killGold[tier];
  let pt = d.killPt[tier];
  if (tier !== 'boss') {
    pt = Math.max(0, Math.min(pt, d.waveKillPtCap - s.waveKillPtGranted));
    s.waveKillPtGranted = add(s.waveKillPtGranted, pt);
  } else s.stats.bossKills++;
  s.gold = add(s.gold, gold, 'gold');
  s.pt = add(s.pt, pt, 'pt');
  s.stats.kills++;
  s.stats.goldEarned = add(s.stats.goldEarned, gold);
  s.stats.ptFromKills = add(s.stats.ptFromKills, pt);
  ev.push({ type: 'kill', enemyId: e.id, kind: e.kind, elite: e.elite !== null, x: at.x, y: at.y, gold, pt });
}

export function effectiveSlowBP(ctx: GameContext, e: Enemy, tick: number): number {
  let bp = 0;
  for (const x of e.slows) if (x.untilTick > tick && x.bp > bp) bp = x.bp;
  const cap = e.kind === 'boss' ? ctx.balance.statusCaps.bossSlowMaxBP : ctx.balance.statusCaps.regularSlowMaxBP;
  return Math.min(bp, cap);
}

/** 고정 분모 이동: 감속이 바뀌어도 나머지 단위가 같다(PRD §20.1). */
function move(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  const denominator = ctx.balance.waves.baseTravelTicks * 10000 * 10000;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.stunUntilTick > s.tick) { e.stunTicksUsed++; continue; }
    const slow = effectiveSlowBP(ctx, e, s.tick);
    const numerator = safe(ctx.path.cells * 1000 * e.speedBP * (10000 - slow) + e.moveRem, 'move');
    const delta = Math.floor(numerator / denominator);
    e.moveRem = numerator - delta * denominator;
    e.progress += delta;
    if (e.progress >= ctx.path.length) leak(ctx, s, e, ev);
  }
}

function leak(ctx: GameContext, s: RunState, e: Enemy, ev: DomainEvent[]) {
  e.alive = false;
  const tier = e.kind === 'boss' ? 'boss' : e.elite ? 'elite' : 'regular';
  const damage = ctx.balance.leakDamage[tier];
  s.gateHp -= damage;
  s.stats.leaks++;
  if (e.kind === 'boss') s.stats.bossLeaks++;
  ev.push({ type: 'leak', enemyId: e.id, kind: e.kind, damage, gateHp: s.gateHp });
}

import type { GameContext } from './context';
import type { DomainEvent } from './events';
import { dist2, positionAt } from './geometry';
import { add, bpFloor, ceilDiv, isqrt, msToTicks, safe, TICK_HZ } from './num';
import { attackIntervalTicks, auraDamageBonusBP, auraSpeedBonusBP, towerStats, type TowerStats } from './towers';
import type { Enemy, Projectile, RunState, Tower } from './types';
import { enemyMaxHp, enemyResists, enemySpeedBP } from './waves';

// 같은 틱 순서(PRD §3.4, §20.3): 만료 → 생성 → 도착 공격 → 화상 → 타워 발사(즉발 포함) → 이동/누출. 패배·완료 판정은 run.ts가 이어서 한다.
export function battleTick(ctx: GameContext, s: RunState, ev: DomainEvent[]): void {
  const t = s.tick;
  const battle = s.battle!;
  for (const e of s.enemies) {
    if (e.slows.length) e.slows = e.slows.filter(x => x.untilTick > t);
    // 화상 출처는 만료 틱의 마지막 피해까지 포함하므로 여기서는 지난 것만 지운다(PRD §20.2).
    if (e.burns.length) e.burns = e.burns.filter(x => t <= x.expiresTick);
  }

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

  for (const e of s.enemies) if (e.alive && e.burnNextTick !== null && t >= e.burnNextTick) burnTick(ctx, s, e, ev);

  for (const tower of s.towers) fire(ctx, s, tower, ev);

  move(ctx, s, ev);
  if (s.enemies.some(e => !e.alive)) s.enemies = s.enemies.filter(e => e.alive);
}

/** 버닝 중 공격 속도 보너스(PRD §5). 발사와 전투 중 구매가 같은 값을 쓴다. */
export const burningBonusBP = (ctx: GameContext, s: RunState, tick: number) => (tick < s.burningUntilTick ? ctx.balance.burning.attackSpeedBP : 0);

function spawn(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  const b = ctx.balance;
  const entry = s.battle!.spawnList[s.battle!.spawnIndex++]!;
  const hp = enemyMaxHp(b, ctx.difficulty, s.battle!.hpBaseMilli, entry.kind, entry.elite);
  const res = enemyResists(b, entry.kind, entry.elite);
  const enemy: Enemy = {
    id: s.seq.enemy++, kind: entry.kind, elite: entry.elite, hp, maxHp: hp, progress: 0, moveRem: 0,
    speedBP: enemySpeedBP(b, entry.kind, entry.elite), physicalResistBP: res.physical, magicResistBP: res.magic,
    slows: [], stunUntilTick: 0, stunTicksUsed: 0, burns: [], burnNextTick: null, burnRemainder: 0, alive: true,
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

/** 한 번의 타격이 싣는 값. 투사체는 발사 순간의 스냅샷이고 즉발 공격은 그 자리에서 만든다. */
type Strike = Pick<Projectile, 'towerId' | 'towerType' | 'damage' | 'damageType' | 'slowBP' | 'slowTicks' | 'physicalResistIgnoreBP' | 'bonusBP' | 'eliteBossDamageBP'>;

const strikeOf = (tower: Tower, stats: TowerStats, damage: number, bonusBP: number): Strike => ({
  towerId: tower.id, towerType: tower.type, damage, damageType: stats.damageType, slowBP: stats.slowBP, slowTicks: stats.slowTicks,
  physicalResistIgnoreBP: stats.physicalResistIgnoreBP, bonusBP, eliteBossDamageBP: stats.eliteBossDamageBP,
});

/** 타워의 외부 공격 속도 보너스: 버닝 + 깃발 B(신속). 합계 상한은 attackIntervalTicks가 적용한다(PRD §20.2). */
export const towerSpeedBonusBP = (ctx: GameContext, s: RunState, tower: Tower) => burningBonusBP(ctx, s, s.tick) + auraSpeedBonusBP(ctx.balance, s.towers, tower);

function fire(ctx: GameContext, s: RunState, tower: Tower, ev: DomainEvent[]) {
  const t = s.tick;
  if (tower.nextAttackTick === null || t < tower.nextAttackTick) return;
  const stats = towerStats(ctx.balance, tower.type, tower.level, tower.branch);
  const target = pickTarget(ctx, s, tower.x, tower.y, stats.range);
  // 표적이 없으면 준비 상태로 기다린다. 기다린 시간만큼 몰아서 쏘지 않는다(PRD §7.2).
  if (!target) return;
  // 오라는 거래 뒤 다음 공격 계산 때 다시 읽는다(PRD §20.2).
  const bonus = auraDamageBonusBP(ctx.balance, s.towers, tower);
  tower.nextAttackTick = t + attackIntervalTicks(ctx.balance, stats, towerSpeedBonusBP(ctx, s, tower));
  if (stats.instant) { strike(ctx, s, tower, stats, target, bonus, ev); return; }
  const at = positionAt(ctx.path, target.progress);
  launch(s, tower, stats, stats.splashRadius > 0 ? null : target, at, strikeOf(tower, stats, stats.damage, bonus), ev);
  // 석궁 A 관통: 첫 대상 뒤 일직선의 두 번째 적에게 따로 날아가는 화살(발사 때 ID 고정, PRD §20.3).
  if (stats.pierceDamageBP > 0) {
    const second = pierceTarget(ctx, s, tower, target, stats);
    if (second) launch(s, tower, stats, second, positionAt(ctx.path, second.progress), strikeOf(tower, stats, bpFloor(stats.damage, stats.pierceDamageBP, 'damage.pierce'), bonus), ev);
  }
}

function launch(s: RunState, tower: Tower, stats: TowerStats, target: Enemy | null, at: { x: number; y: number }, a: Strike, ev: DomainEvent[]) {
  const flight = Math.max(1, flightTicks(dist2(at.x, at.y, tower.x, tower.y), stats.projectileSpeed));
  const projectile: Projectile = {
    ...a, id: s.seq.projectile++, fromX: tower.x, fromY: tower.y, targetId: target?.id ?? null, toX: at.x, toY: at.y,
    firedTick: s.tick, arrivalTick: s.tick + flight, splashRadius: target ? 0 : stats.splashRadius, maxTargets: stats.maxTargets,
  };
  s.projectiles.push(projectile);
  ev.push({ type: 'fire', projectileId: projectile.id, towerId: tower.id, towerType: tower.type });
}

/** 정수 선분 판정: 타워→기준점 방향 d로, 전방 거리 0..length·폭 width 안이면 [전방 내적, true]. */
function inLine(tower: Tower, d: { x: number; y: number }, p: { x: number; y: number }, length: number, width: number): number | null {
  const vx = p.x - tower.x, vy = p.y - tower.y;
  const d2 = d.x * d.x + d.y * d.y;
  const dot = vx * d.x + vy * d.y;
  const cross = vx * d.y - vy * d.x;
  if (dot < 0 || safe(dot * dot, 'line') > safe(length * length * d2, 'line')) return null;
  return safe(4 * cross * cross, 'line') <= safe(width * width * d2, 'line') ? dot : null;
}

/** 첫 대상의 발사 당시 위치 방향, 사거리 끝까지 폭 0.30칸 선분에서 첫 대상 뒤의 적을 전방 거리↑ → 생성순↑로 하나. */
function pierceTarget(ctx: GameContext, s: RunState, tower: Tower, first: Enemy, stats: TowerStats): Enemy | null {
  const f = positionAt(ctx.path, first.progress);
  const d = { x: f.x - tower.x, y: f.y - tower.y };
  const firstDot = d.x * d.x + d.y * d.y;
  const behind = s.enemies
    .filter(e => e.alive && e !== first)
    .map(e => ({ e, dot: inLine(tower, d, positionAt(ctx.path, e.progress), stats.range, stats.pierceWidth) }))
    .filter((c): c is { e: Enemy; dot: number } => c.dot !== null && c.dot > firstDot)
    .sort((a, b) => a.dot - b.dot || a.e.id - b.e.id);
  return behind[0]?.e ?? null;
}

/**
 * 즉발 공격(PRD §20.3): 비행 지연 없이 같은 틱에 맞힌다. 여기서 처치된 적은 다음 타워의 후보에서 빠진다.
 * 번개는 직전 대상 중심의 연쇄, 화염은 기본 표적 방향 90도 부채꼴, 그 밖(창병·수호기사)은 기본 표적 하나다.
 */
function strike(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats, first: Enemy, bonus: number, ev: DomainEvent[]) {
  const targets = stats.chainRadius > 0 ? chainTargets(ctx, s, first, stats)
    : stats.cone ? coneTargets(ctx, s, tower, first, stats)
    : stats.lineWidth > 0 ? lineTargets(ctx, s, tower, first, stats)
    : stats.splashRadius > 0 ? aroundTargets(ctx, s, first, stats)
    : [first];
  const hits = targets.map((e, k) => ({ e, at: positionAt(ctx.path, e.progress), damage: chainDamage(stats.damage, stats.chainFalloffBP, k) }));
  ev.push({ type: 'strike', towerId: tower.id, towerType: tower.type, fromX: tower.x, fromY: tower.y, targets: hits.map(h => ({ enemyId: h.e.id, x: h.at.x, y: h.at.y })) });
  for (const h of hits) {
    applyHit(ctx, s, strikeOf(tower, stats, h.damage, bonus), h.e, ev);
    if (h.e.alive && stats.burnTotal > 0) applyBurn(s, h.e, tower.id, mitigated(stats.burnTotal, h.e.magicResistBP), stats.burnTicks);
  }
  // 번개 B 충격: 첫 대상 기절. 한 적의 평생 기절 시간 상한을 넘기지 않는다(PRD §7.3, statusCaps).
  if (stats.stunTicks > 0 && first.alive) {
    const left = msToTicks(ctx.balance.statusCaps.stunLifetimeMaxMs) - first.stunTicksUsed;
    if (left > 0) first.stunUntilTick = Math.max(first.stunUntilTick, s.tick + Math.min(stats.stunTicks, left));
  }
}

/** 창병 A 긴 창: 타워→첫 대상 방향, 길이 = 사거리·폭 0.35칸 선분 안에서 첫 대상 포함 진행도↓ → 생성순↑로 최대 수(PRD §20.3). */
function lineTargets(ctx: GameContext, s: RunState, tower: Tower, first: Enemy, stats: TowerStats): Enemy[] {
  const f = positionAt(ctx.path, first.progress);
  const d = { x: f.x - tower.x, y: f.y - tower.y };
  const others = s.enemies
    .filter(e => e.alive && e !== first && inLine(tower, d, positionAt(ctx.path, e.progress), stats.range, stats.lineWidth) !== null)
    .sort((a, b) => b.progress - a.progress || a.id - b.id);
  return [first, ...others].slice(0, stats.maxTargets);
}

/** 수호기사 B 수호 일격: 첫 대상 중심 반경 안을 거리↑ → 진행도↓ → 생성순↑로 최대 수(PRD §20.3). */
function aroundTargets(ctx: GameContext, s: RunState, first: Enemy, stats: TowerStats): Enemy[] {
  const c = positionAt(ctx.path, first.progress);
  const r2 = stats.splashRadius * stats.splashRadius;
  return s.enemies
    .filter(e => e.alive)
    .map(e => { const p = positionAt(ctx.path, e.progress); return { e, d: dist2(p.x, p.y, c.x, c.y) }; })
    .filter(h => h.d <= r2)
    .sort((a, b) => a.d - b.d || b.e.progress - a.e.progress || a.e.id - b.e.id)
    .slice(0, stats.maxTargets)
    .map(h => h.e);
}

/** 번개 k번째 대상의 피해 = 최초 기준 피해 × 감쇠비^k, 마지막에 한 번 내림한다(PRD §20.3). 중간 곱이 커서 BigInt로 계산한다. */
export function chainDamage(base: number, falloffBP: number, k: number): number {
  if (k === 0) return base;
  return Number((BigInt(base) * BigInt(falloffBP) ** BigInt(k)) / 10000n ** BigInt(k));
}

/** 첫 표적 뒤에는 직전 대상 중심 반경 안의 아직 맞지 않은 적을 거리↑ → 진행도↓ → 생성순↑로 고른다. 없으면 끝난다. */
function chainTargets(ctx: GameContext, s: RunState, first: Enemy, stats: TowerStats): Enemy[] {
  const chosen = [first];
  const r2 = stats.chainRadius * stats.chainRadius;
  while (chosen.length < stats.maxTargets) {
    const last = positionAt(ctx.path, chosen[chosen.length - 1]!.progress);
    const next = s.enemies
      .filter(e => e.alive && !chosen.includes(e))
      .map(e => { const p = positionAt(ctx.path, e.progress); return { e, d: dist2(p.x, p.y, last.x, last.y) }; })
      .filter(c => c.d <= r2)
      .sort((a, b) => a.d - b.d || b.e.progress - a.e.progress || a.e.id - b.e.id)[0];
    if (!next) break;
    chosen.push(next.e);
  }
  return chosen;
}

/**
 * 화염 부채꼴: 타워에서 기본 표적 방향을 축으로 한 총각 90도. 사거리 안, 전방(dot ≥ 0), 2·dot² ≥ 거리²·축길이²인 적을
 * 진행도↓ → 생성순↑로 최대 대상 수만큼 고른다. 정수식만 쓴다(PRD §20.2~20.3).
 */
function coneTargets(ctx: GameContext, s: RunState, tower: Tower, first: Enemy, stats: TowerStats): Enemy[] {
  const f = positionAt(ctx.path, first.progress);
  const ax = f.x - tower.x, ay = f.y - tower.y;
  const axis2 = ax * ax + ay * ay;
  const r2 = stats.range * stats.range;
  return s.enemies
    .filter(e => {
      if (!e.alive) return false;
      const p = positionAt(ctx.path, e.progress);
      const dx = p.x - tower.x, dy = p.y - tower.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) return false;
      const dot = dx * ax + dy * ay;
      return dot >= 0 && safe(2 * dot * dot, 'cone') >= safe(d2 * axis2, 'cone');
    })
    .sort((a, b) => b.progress - a.progress || a.id - b.id)
    .slice(0, stats.maxTargets);
}

/** 0.5초 화상 간격(PRD §7.1). */
const BURN_INTERVAL_TICKS = 15;

/**
 * 화상 부여(PRD §20.2): 출처(타워)마다 총피해 스냅샷과 고유 만료를 두고, 같은 출처 재적중은 자기 값만 갱신한다.
 * 피해 시계는 적마다 하나라서 재적중·다른 출처가 다음 피해 시각을 미루지 않는다.
 */
function applyBurn(s: RunState, e: Enemy, source: number, total: number, ticks: number) {
  const expiresTick = s.tick + ticks;
  const own = e.burns.find(b => b.source === source);
  if (own) { own.total = total; own.expiresTick = expiresTick; }
  else e.burns.push({ source, total, expiresTick });
  if (e.burnNextTick === null) e.burnNextTick = s.tick + BURN_INTERVAL_TICKS;
}

/** 피해 시점마다 유효 출처 중 총피해가 가장 큰 하나(동률은 타워 생성순)를 4등분해 지급하고, 나머지는 다음으로 넘긴다. */
function burnTick(ctx: GameContext, s: RunState, e: Enemy, ev: DomainEvent[]) {
  const top = [...e.burns].sort((a, b) => b.total - a.total || a.source - b.source)[0];
  if (top) {
    const sum = top.total + e.burnRemainder;
    const pay = Math.min(e.hp, Math.floor(sum / 4));
    e.burnRemainder = sum % 4;
    if (pay > 0) {
      e.hp = safe(e.hp - pay, 'hp');
      ev.push({ type: 'burn', enemyId: e.id, damage: pay });
      if (e.hp === 0) { kill(ctx, s, e, positionAt(ctx.path, e.progress), ev); return; }
    }
  }
  e.burnNextTick = add(e.burnNextTick!, BURN_INTERVAL_TICKS);
  e.burns = e.burns.filter(b => s.tick < b.expiresTick);
  if (e.burns.length === 0) { e.burnNextTick = null; e.burnRemainder = 0; }
}

/** 도착 틱 수 = ceil(거리×30/속도). 거리를 먼저 내림하면 경계에서 1틱 일찍 닿으므로 제곱 그대로 올림한다(PRD §20.3, §13.3). */
function flightTicks(d2: number, speed: number): number {
  const n = safe(d2 * TICK_HZ * TICK_HZ, 'flight');
  const root = isqrt(n);
  return ceilDiv(root * root < n ? root + 1 : root, speed);
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

/** 물리 저항 무시는 최종 물리 저항 수치의 비율을 줄인다. 마법 저항에는 적용하지 않는다(PRD §20.2). */
export function effectiveResistBP(e: Pick<Enemy, 'physicalResistBP' | 'magicResistBP'>, damageType: 'physical' | 'magic', ignoreBP: number): number {
  if (damageType === 'magic') return e.magicResistBP;
  return ignoreBP > 0 ? bpFloor(e.physicalResistBP, 10000 - ignoreBP, 'resist.ignore') : e.physicalResistBP;
}

/** 레벨·분기까지 반영된 피해에 상황(정예·보스) → 외부(깃발) → 저항 순서로 한 단계씩 곱한다(PRD §20.2). */
function applyHit(ctx: GameContext, s: RunState, p: Strike, e: Enemy, ev: DomainEvent[]) {
  let damage = p.damage;
  if (p.eliteBossDamageBP !== 10000 && (e.elite !== null || e.kind === 'boss')) damage = bpFloor(damage, p.eliteBossDamageBP, 'damage.situational');
  if (p.bonusBP > 0) damage = bpFloor(damage, 10000 + p.bonusBP, 'damage.external');
  const resist = effectiveResistBP(e, p.damageType, p.physicalResistIgnoreBP);
  const dealt = Math.min(e.hp, mitigated(damage, resist));
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

import type { GameContext } from './context';
import type { DomainEvent, HazardEndReason } from './events';
import { bossDef, burstMarching, campaignOf, enemyArtId } from './factions';
import { dist2, positionAt } from './geometry';
import { hazardExpiredEvent, trapSpot } from './hazards';
import { add, bpFloor, ceilDiv, isqrt, msToTicks, safe, TICK_HZ } from './num';
import {
  attackIntervalTicks, attacks, auraDamageBonusBP, auraEliteBossBonusBP, auraRangeBonusMilli, auraReaches, auraSpeedBonusBP, effectsFor,
  isAuraGiver, towerStats, type TowerStats,
} from './towers';
import type {
  Enemy, FieldHazard, HazardStrike, HitFx, Projectile, RollerHazard, RunState, SpawnEntry, SplashHit, Tower, TrapHazard, ZoneHazard, ZoneSpec,
} from './types';
import { airborne, enemyMaxHp, enemyResists, enemySpeedBP, hpBaseMilli } from './waves';

// 같은 틱 순서(PRD §3.4, §20.3): 만료 → 생성 → 도착 공격(장판 착탄 포함) → 화상 → 장판·덫·굴림체(towers.md §4-7) → 대장 회복
// → 상시 오라 → 타워 발사(즉발·다연발·덫 놓기·굴림체 투입 포함) → 이동/누출.
// 패배·완료 판정은 run.ts가 이어서 한다. 신규 타워 효과는 docs/renewal/catalog/towers.md §2·§4.
export function battleTick(ctx: GameContext, s: RunState, ev: DomainEvent[]): void {
  const t = s.tick;
  const battle = s.battle!;
  for (const e of s.enemies) {
    if (e.slows.length) e.slows = e.slows.filter(x => x.untilTick > t);
    if (e.vulns.length) e.vulns = e.vulns.filter(x => x.untilTick > t);
    if (e.shreds.length) e.shreds = e.shreds.filter(x => x.untilTick > t);
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
  updateHazards(ctx, s, ev);
  for (const e of s.enemies) if (e.alive && e.boss) bossMend(ctx, s, e, ev);

  for (const tower of s.towers) slowAura(ctx, s, tower);
  for (const tower of s.towers) fire(ctx, s, tower, ev);

  move(ctx, s, ev);
  if (s.enemies.some(e => !e.alive)) s.enemies = s.enemies.filter(e => e.alive);
}

/** 버닝 중 공격 속도 보너스(PRD §5). 발사와 전투 중 구매가 같은 값을 쓴다. */
export const burningBonusBP = (ctx: GameContext, s: RunState, tick: number) => (tick < s.burningUntilTick ? ctx.balance.burning.attackSpeedBP : 0);
const burningNow = (s: RunState) => s.tick < s.burningUntilTick;

function spawn(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  const entry = s.battle!.spawnList[s.battle!.spawnIndex++]!;
  addEnemy(ctx, s, entry, s.battle!.hpBaseMilli, 0, false, ev);
}

/** 적 하나를 경로 progress 지점에 만든다. 생성 예약에 종족이 없으면 맵 주력 종족, 대장 단계가 없으면 1단이다. */
function addEnemy(ctx: GameContext, s: RunState, entry: SpawnEntry, hpBase: number, progress: number, derived: boolean, ev: DomainEvent[]): Enemy {
  const b = ctx.balance;
  const faction = entry.faction ?? campaignOf(b, ctx.map.id).primary;
  const bossTier = entry.kind === 'boss' ? (entry.bossTier ?? 1) : null;
  // 대장 기믹과 체력 보정(monsters.md §0-4·§2.0): 생존형(겹방패·회복)은 체력을 낮춰 시작한다.
  const def = bossDef(b, { kind: entry.kind, faction, bossTier });
  const hp = enemyMaxHp(b, ctx.difficulty, hpBase, entry.kind, entry.elite, def?.hpScaleBP ?? 10000);
  const res = enemyResists(b, entry.kind, entry.elite);
  const skill = def?.skill;
  const enemy: Enemy = {
    id: s.seq.enemy++, kind: entry.kind, faction, bossTier, derived, flying: b.enemies[entry.kind].flying ?? false, groundedUntilTick: 0,
    elite: entry.elite, hp, maxHp: hp, progress, moveRem: 0,
    speedBP: enemySpeedBP(b, entry.kind, entry.elite), physicalResistBP: res.physical, magicResistBP: res.magic,
    slows: [], stunUntilTick: 0, stunTicksUsed: 0, burns: [], burnNextTick: null, burnRemainder: 0, vulns: [], shreds: [], knockbackUsed: 0,
    boss: skill ? {
      bornTick: s.tick, stanceUsed: false, stance: null, wardLeft: skill.kind === 'ward_layers' ? skill.layers : 0,
      mends: 0, nextMendTick: skill.kind === 'snack_mend' ? s.tick + msToTicks(skill.periodMs) : 0, escortStep: 0,
    } : null,
    alive: true,
  };
  s.enemies.push(enemy);
  ev.push({ type: 'spawn', enemyId: enemy.id, kind: enemy.kind, faction: enemy.faction, art: enemyArtId(b, enemy) });
  return enemy;
}

/** 이 공격이 이 적을 노리고 맞힐 수 있는가. 대공이 안 되는 공격은 떠 있는 비행 적을 지나친다. */
const reachable = (canHitFlyer: boolean, e: Enemy, tick: number) => e.alive && (canHitFlyer || !airborne(e, tick));

const at = (ctx: GameContext, e: Enemy) => positionAt(ctx.path, e.progress);

/**
 * 표적 후보를 고르는 순서(PRD §7.1): 사거리 안(도넛 사거리면 안쪽 반경 밖), 진행도 최대 → 생성 순번 최소.
 * strongest는 현재 체력 최대가 먼저다. preferFlyer면 떠 있는 비행 적을 먼저 같은 순서로 고른다.
 */
function candidates(ctx: GameContext, s: RunState, x: number, y: number, stats: TowerStats, range: number): Enemy[] {
  const r2 = range * range, in2 = stats.minRange * stats.minRange;
  const strongest = stats.fx.targetPriority === 'strongest';
  return s.enemies
    .filter(e => {
      if (!reachable(stats.canHitFlyer, e, s.tick)) return false;
      const p = at(ctx, e);
      const d = dist2(p.x, p.y, x, y);
      return d <= r2 && d >= in2;
    })
    .sort((a, b) => {
      if (stats.preferFlyer) { const fa = airborne(a, s.tick) ? 0 : 1, fb = airborne(b, s.tick) ? 0 : 1; if (fa !== fb) return fa - fb; }
      if (strongest && a.hp !== b.hp) return b.hp - a.hp;
      return b.progress - a.progress || a.id - b.id;
    });
}

/** 한 번의 타격이 싣는 값. 투사체는 발사 순간의 스냅샷이고 즉발 공격은 그 자리에서 만든다. */
type Strike = Pick<Projectile, 'towerId' | 'towerType' | 'damage' | 'damageType' | 'slowBP' | 'slowTicks' | 'physicalResistIgnoreBP' | 'bonusBP' | 'eliteBossDamageBP' | 'canHitFlyer' | 'flyerDamageBP' | 'fx'>;

const NO_FX: HitFx = {
  burnTotal: 0, burnTicks: 0, magicResistIgnoreBP: 0, stunTicks: 0, eliteStunTicks: 0, eliteSlowBP: 0, eliteSlowTicks: 0, bossSlowBP: 0, bossSlowTicks: 0,
  knockback: 0, knockbackFlyer: 0, knockbackBoss: 0, groundTicks: 0, vulnBP: 0, vulnTicks: 0, shredPhysicalBP: 0, shredMagicBP: 0, shredTicks: 0,
  lowHpThresholdBP: 0, lowHpDamageBP: 10000, slowedDamageBP: 10000,
};

/** 타워 수치 → 적중 효과 스냅샷. extraStunTicks는 공격 주기의 기절(서리 A1 등)이다. */
function hitFxOf(stats: TowerStats, extraStunTicks: number): HitFx {
  const f = stats.fx;
  return {
    burnTotal: stats.burnTotal, burnTicks: stats.burnTicks, magicResistIgnoreBP: f.magicResistIgnoreBP ?? 0,
    stunTicks: Math.max(msToTicks(f.hitStunMs ?? 0), extraStunTicks), eliteStunTicks: msToTicks(f.eliteStunMs ?? 0),
    eliteSlowBP: f.eliteSlowBP ?? 0, eliteSlowTicks: msToTicks(f.eliteSlowMs ?? 0), bossSlowBP: f.bossSlowBP ?? 0, bossSlowTicks: msToTicks(f.bossSlowMs ?? 0),
    knockback: f.knockbackMilli ?? 0, knockbackFlyer: f.knockbackFlyerMilli ?? f.knockbackMilli ?? 0, knockbackBoss: f.knockbackBossMilli ?? 0,
    groundTicks: msToTicks(f.groundFlyerMs ?? 0), vulnBP: f.vulnBP ?? 0, vulnTicks: msToTicks(f.vulnMs ?? 0),
    shredPhysicalBP: f.shredPhysicalBP ?? 0, shredMagicBP: f.shredMagicBP ?? 0, shredTicks: msToTicks(f.shredMs ?? 0),
    lowHpThresholdBP: f.lowHpThresholdBP ?? 0, lowHpDamageBP: f.lowHpDamageBP ?? 10000, slowedDamageBP: f.slowedDamageBP ?? 10000,
  };
}

const strikeOf = (tower: Tower, stats: TowerStats, damage: number, bonusBP: number, eliteBossDamageBP: number, fx: HitFx): Strike => ({
  towerId: tower.id, towerType: tower.type, damage, damageType: stats.damageType, slowBP: stats.slowBP, slowTicks: stats.slowTicks,
  physicalResistIgnoreBP: stats.physicalResistIgnoreBP, bonusBP, eliteBossDamageBP, canHitFlyer: stats.canHitFlyer, flyerDamageBP: stats.flyerDamageBP, fx,
});

function splashOf(stats: TowerStats, damage: number): SplashHit | null {
  const o = stats.fx.onHitSplash;
  if (!o) return null;
  return {
    radius: o.radiusMilli, maxTargets: o.maxTargets, damage: o.damageBP ? bpFloor(damage, o.damageBP, 'damage.splashHit') : 0,
    vulnBP: o.vulnBP ?? 0, vulnTicks: msToTicks(o.vulnMs ?? 0), slowBP: o.slowBP ?? 0, slowTicks: msToTicks(o.slowMs ?? 0), flyersOnly: o.flyersOnly ?? false,
  };
}

/** 성문이 깎인 비율에 비례하는 보너스(최소값 상시, 수호기사 A2). */
function gateRageBP(s: RunState, rage: { speedBP: number; damageBP: number; minBP: number } | undefined, kind: 'speed' | 'damage'): number {
  if (!rage) return 0;
  const lostBP = Math.floor((Math.max(0, s.gateMaxHp - Math.max(0, s.gateHp)) * 10000) / s.gateMaxHp);
  return Math.max(rage.minBP, Math.floor(((kind === 'speed' ? rage.speedBP : rage.damageBP) * lostBP) / 10000));
}

/** 타워의 외부 공격 속도 보너스: 버닝 + 오라(깃발 B·종각 B1) + 성문 분노. 합계 상한은 attackIntervalTicks가 적용한다(PRD §20.2). */
export function towerSpeedBonusBP(ctx: GameContext, s: RunState, tower: Tower): number {
  const b = ctx.balance;
  const rage = attacks(b, tower.type) ? effectsFor(b, tower.type, tower.form).gateRage : undefined;
  return burningBonusBP(ctx, s, s.tick) + auraSpeedBonusBP(b, s.towers, tower, burningNow(s)) + gateRageBP(s, rage, 'speed');
}

/** 상시 감속 오라(수호기사 B2): 둘레 지상 적에게 이 틱과 다음 틱 동안 감속을 건다. */
function slowAura(ctx: GameContext, s: RunState, tower: Tower) {
  if (!attacks(ctx.balance, tower.type)) return;
  const aura = effectsFor(ctx.balance, tower.type, tower.form).slowAura;
  if (!aura) return;
  const r2 = aura.radiusMilli * aura.radiusMilli;
  for (const e of s.enemies) {
    if (!e.alive || airborne(e, s.tick)) continue;
    const p = at(ctx, e);
    if (dist2(p.x, p.y, tower.x, tower.y) <= r2) addSlow(e, tower.id, aura.slowBP, s.tick + 2);
  }
}

function fire(ctx: GameContext, s: RunState, tower: Tower, ev: DomainEvent[]) {
  const t = s.tick;
  const b = ctx.balance;
  if (!attacks(b, tower.type)) return;
  // 시차 다연발(§4-4): 다음 발 틱이면 다시 조준해 쏜다. 표적이 없으면 남은 발은 버린다.
  if (tower.burst && t >= tower.burst.nextTick) {
    const burst = tower.burst;
    const shot = shoot(ctx, s, tower, towerStats(b, tower.type, tower.level, tower.form), burst.damageBP, 0, ev);
    burst.left = shot ? burst.left - 1 : 0;
    burst.nextTick = t + burst.gapTicks;
    if (burst.left <= 0) tower.burst = null;
  }
  if (tower.nextAttackTick === null || t < tower.nextAttackTick) return;
  const stats = towerStats(b, tower.type, tower.level, tower.form);
  const range = stats.range + auraRangeBonusMilli(b, s.towers, tower, burningNow(s));
  // 덫공방(§4-7 trap)은 적이 없어도 미리 덫을 놓는다. 덫이 가득이거나 빈자리가 없으면 준비 상태로 기다린다.
  if (stats.fx.trap) { placeTrap(ctx, s, tower, stats, range, ev); return; }
  const targets = candidates(ctx, s, tower.x, tower.y, stats, range);
  // 표적이 없으면 준비 상태로 기다린다. 기다린 시간만큼 몰아서 쏘지 않는다(PRD §7.2).
  if (targets.length === 0) return;
  commitAttack(ctx, s, tower, stats);
  const cycle = stats.fx.cycle && tower.attacks % stats.fx.cycle.every === 0 ? stats.fx.cycle : null;
  shoot(ctx, s, tower, stats, 10000, cycle?.stunMs ? msToTicks(cycle.stunMs) : 0, ev, targets);
  const burst = cycle?.burst ?? stats.fx.burst;
  if (burst) tower.burst = { left: burst.count - 1, nextTick: t + burst.gapTicks, gapTicks: burst.gapTicks, damageBP: burst.followDamageBP ?? 10000 };
  // 공격 주기의 회전 공격(창병 A2): 타워 중심 반경 안을 진행도↓로 최대 수.
  if (cycle?.ring) {
    const r2 = cycle.ring.radiusMilli * cycle.ring.radiusMilli;
    const ring = s.enemies
      .filter(e => reachable(stats.canHitFlyer, e, t) && (p => dist2(p.x, p.y, tower.x, tower.y) <= r2)(at(ctx, e)))
      .sort((a, c) => c.progress - a.progress || a.id - c.id)
      .slice(0, cycle.ring.maxTargets);
    const elite = stats.eliteBossDamageBP + auraEliteBossBonusBP(b, s.towers, tower, burningNow(s));
    if (ring.length) hitAll(ctx, s, tower, stats, ring, bpFloor(stats.damage, cycle.ring.damageBP, 'damage.cycleRing'), auraDamageBonusBP(b, s.towers, tower), elite, ev);
  }
  // 이웃 타워 재촉(바람 B2): 가까운 공격 타워 count기의 다음 공격을 당긴다(이번 틱에 다시 쏘지는 않는다).
  const haste = stats.fx.hasteNeighbors;
  if (haste) {
    const r2 = haste.radiusMilli * haste.radiusMilli;
    s.towers
      .filter(o => o !== tower && o.nextAttackTick !== null && attacks(b, o.type) && dist2(o.x, o.y, tower.x, tower.y) <= r2)
      .sort((a, c) => dist2(a.x, a.y, tower.x, tower.y) - dist2(c.x, c.y, tower.x, tower.y) || a.id - c.id)
      .slice(0, haste.count)
      .forEach(o => { o.nextAttackTick = Math.max(t + 1, o.nextAttackTick! - haste.ticks); });
  }
}

/** 공격 확정: 공격한 타워와 이 공격에 오라를 준 타워는 더는 설치 취소(전액 환불)를 받지 않는다(공짜 공격 방지). 다음 공격을 예약한다. */
function commitAttack(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats) {
  const b = ctx.balance;
  tower.undoUntilTick = null;
  for (const o of s.towers) if (o.undoUntilTick !== null && o !== tower && isAuraGiver(b, o) && auraReaches(b, o, tower, burningNow(s))) o.undoUntilTick = null;
  // 오라는 거래 뒤 다음 공격 계산 때 다시 읽는다(PRD §20.2).
  tower.nextAttackTick = s.tick + attackIntervalTicks(b, stats, towerSpeedBonusBP(ctx, s, tower));
  tower.attacks++;
}

/**
 * 공격 한 번(주 공격·다연발 한 발): 서로 다른 표적 volley명에게 즉발 또는 투사체로 친다. 표적이 없으면 false.
 * 피해 = 레벨·형태 피해 × damageBP(뒤따르는 발) × 같은 적 연속(마법 A1) × 성문 분노(수호기사 A2).
 */
function shoot(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats, damageBP: number, extraStunTicks: number, ev: DomainEvent[], found?: Enemy[]): boolean {
  const b = ctx.balance;
  const targets = (found ?? candidates(ctx, s, tower.x, tower.y, stats, stats.range + auraRangeBonusMilli(b, s.towers, tower, burningNow(s)))).slice(0, stats.volley);
  if (targets.length === 0) return false;
  let damage = damageBP === 10000 ? stats.damage : bpFloor(stats.damage, damageBP, 'damage.follow');
  const rage = gateRageBP(s, stats.fx.gateRage, 'damage');
  if (rage > 0) damage = bpFloor(damage, 10000 + rage, 'damage.rage');
  const focus = stats.fx.focusStackBP;
  if (focus) {
    const first = targets[0]!;
    const stacks = tower.focus?.targetId === first.id ? Math.min(stats.fx.focusStackMax ?? 1, tower.focus.stacks + 1) : 0;
    tower.focus = { targetId: first.id, stacks };
    if (stacks > 0) damage = bpFloor(damage, 10000 + focus * stacks, 'damage.focus');
  }
  const bonus = auraDamageBonusBP(b, s.towers, tower);
  const elite = stats.eliteBossDamageBP + auraEliteBossBonusBP(b, s.towers, tower, burningNow(s));
  const fx = hitFxOf(stats, extraStunTicks);
  for (const target of targets) {
    // 굴림체(§4-7 roller): 즉발 대신 표적 자리에 놓여 다음 틱부터 입구 쪽으로 굴러간다.
    if (stats.fx.roller) { launchRoller(ctx, s, tower, stats, target, strikeOf(tower, stats, damage, bonus, elite, fx), ev); continue; }
    if (stats.instant) {
      const aim = at(ctx, target);
      strike(ctx, s, tower, stats, target, damage, bonus, elite, fx, ev);
      // 도화선(노포 B2): 직선 궤적에 delayMs 뒤 2차 폭발.
      const fuse = stats.fx.delayedBlast;
      if (fuse && stats.lineWidth > 0) lightFuse(s, tower, stats, aim, fuse, strikeOf(tower, stats, damage, bonus, elite, fx), ev);
      continue;
    }
    const a = strikeOf(tower, stats, damage, bonus, elite, fx);
    const splash = splashOf(stats, damage);
    const ric = stats.fx.ricochet;
    const zone = stats.fx.zone;
    const extra: Pick<Projectile, 'splash' | 'ricochet' | 'pull' | 'zone'> = {
      ...(splash && stats.splashRadius === 0 ? { splash } : {}),
      ...(ric && ric.count > 0 && stats.splashRadius === 0 ? { ricochet: { left: ric.count, radius: ric.radiusMilli, falloffBP: ric.falloffBP, hit: [target.id] } } : {}),
      ...(stats.fx.pull && stats.splashRadius > 0 ? { pull: { radius: stats.fx.pull.radiusMilli, maxTargets: stats.fx.pull.maxTargets, milli: stats.fx.pull.milli } } : {}),
      ...(zone && stats.splashRadius > 0 ? { zone: zoneSpec(stats, zone, target.progress) } : {}),
    };
    launch(s, tower, tower, stats, stats.splashRadius > 0 ? null : target, at(ctx, target), { ...a, ...extra }, ev);
    // 관통(석궁 A 등): 첫 대상 뒤 일직선 적에게 따로 날아가는 화살(발사 때 ID 고정, PRD §20.3).
    if (stats.pierceDamageBP > 0) {
      const pierce = strikeOf(tower, stats, bpFloor(damage, stats.pierceDamageBP, 'damage.pierce'), bonus, elite, fx);
      for (const e of pierceTargets(ctx, s, tower, target, stats)) launch(s, tower, tower, stats, e, at(ctx, e), pierce, ev);
    }
  }
  return true;
}

function launch(s: RunState, tower: Tower, from: { x: number; y: number }, stats: Pick<TowerStats, 'projectileSpeed' | 'splashRadius' | 'maxTargets'>, target: Enemy | null, to: { x: number; y: number }, a: Strike & Partial<Pick<Projectile, 'splash' | 'ricochet' | 'pull' | 'zone'>>, ev: DomainEvent[]) {
  const flight = Math.max(1, flightTicks(dist2(to.x, to.y, from.x, from.y), stats.projectileSpeed));
  const projectile: Projectile = {
    ...a, id: s.seq.projectile++, fromX: from.x, fromY: from.y, targetId: target?.id ?? null, toX: to.x, toY: to.y,
    firedTick: s.tick, arrivalTick: s.tick + flight, splashRadius: target ? 0 : stats.splashRadius, maxTargets: stats.maxTargets,
  };
  s.projectiles.push(projectile);
  ev.push({ type: 'fire', projectileId: projectile.id, towerId: tower.id, towerType: tower.type });
}

/** 정수 선분 판정: 타워→기준점 방향 d로, 전방 거리 0..length·폭 width 안이면 전방 내적, 아니면 null. */
function inLine(tower: { x: number; y: number }, d: { x: number; y: number }, p: { x: number; y: number }, length: number, width: number): number | null {
  const vx = p.x - tower.x, vy = p.y - tower.y;
  const d2 = d.x * d.x + d.y * d.y;
  const dot = vx * d.x + vy * d.y;
  const cross = vx * d.y - vy * d.x;
  if (dot < 0 || safe(dot * dot, 'line') > safe(length * length * d2, 'line')) return null;
  // 옆으로 아주 먼 적(긴 맵의 반대편 길)은 4·cross²가 안전 정수를 넘는다. 오른쪽(폭² × d²)은 늘 안전 범위라
  // 넘친 쪽은 그보다 크다는 뜻이므로 계산하지 않고 선 밖으로 친다(결과 같음, NUMERIC_LIMIT 정지 방지).
  const lateral = 4 * cross * cross;
  if (!Number.isSafeInteger(lateral)) return null;
  return lateral <= safe(width * width * d2, 'line') ? dot : null;
}

/** 첫 대상의 발사 당시 위치 방향, 사거리 끝까지 선분에서 첫 대상 뒤의 적을 전방 거리↑ → 생성순↑로 pierceCount명. */
function pierceTargets(ctx: GameContext, s: RunState, tower: Tower, first: Enemy, stats: TowerStats): Enemy[] {
  const f = at(ctx, first);
  const d = { x: f.x - tower.x, y: f.y - tower.y };
  const firstDot = d.x * d.x + d.y * d.y;
  return s.enemies
    .filter(e => reachable(stats.canHitFlyer, e, s.tick) && e !== first)
    .map(e => ({ e, dot: inLine(tower, d, at(ctx, e), stats.range, stats.pierceWidth) }))
    .filter((c): c is { e: Enemy; dot: number } => c.dot !== null && c.dot > firstDot)
    .sort((a, b) => a.dot - b.dot || a.e.id - b.e.id)
    .slice(0, stats.pierceCount)
    .map(c => c.e);
}

/**
 * 즉발 공격(PRD §20.3): 비행 지연 없이 같은 틱에 맞힌다. 여기서 처치된 적은 다음 타워의 후보에서 빠진다.
 * 모양 우선순위: 연쇄(번개) → 직선(창병 A·노포·바람 B1) → 부채꼴(화염·바람) → 고리(종각·서리 B1) → 첫 대상 둘레(수호기사 B) → 하나.
 */
function strike(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats, first: Enemy, damage: number, bonus: number, elite: number, fx: HitFx, ev: DomainEvent[]) {
  const targets = stats.chainRadius > 0 ? chainTargets(ctx, s, first, stats)
    : stats.lineWidth > 0 ? lineTargets(ctx, s, tower, first, stats)
    : stats.cone ? coneTargets(ctx, s, tower, first, stats)
    : stats.fx.ring ? ringTargets(ctx, s, tower, stats)
    : stats.splashRadius > 0 ? aroundTargets(ctx, s, first, stats)
    : [first];
  hitAll(ctx, s, tower, stats, targets, damage, bonus, elite, ev, fx);
}

/** 즉발 대상 목록을 순서대로 맞힌다(k번째는 감쇠비^k). 첫 대상 기절, 마지막 대상 둘레 2차 피해. */
function hitAll(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats, targets: Enemy[], damage: number, bonus: number, elite: number, ev: DomainEvent[], fx: HitFx = hitFxOf(stats, 0)) {
  const hits = targets.map((e, k) => ({ e, at: at(ctx, e), damage: chainDamage(damage, stats.chainFalloffBP, k) }));
  ev.push({ type: 'strike', towerId: tower.id, towerType: tower.type, fromX: tower.x, fromY: tower.y, targets: hits.map(h => ({ enemyId: h.e.id, x: h.at.x, y: h.at.y })) });
  for (const h of hits) applyHit(ctx, s, strikeOf(tower, stats, h.damage, bonus, elite, fx), h.e, ev);
  // 충격(번개 B 등): 첫 대상 기절. 한 적의 평생 기절 시간 상한을 넘기지 않는다(PRD §7.3, statusCaps).
  const first = targets[0];
  if (stats.stunTicks > 0 && first?.alive) stun(ctx, s, first, stats.stunTicks);
  const last = hits.at(-1);
  const splash = splashOf(stats, damage);
  if (last && splash) splashAround(ctx, s, strikeOf(tower, stats, splash.damage, bonus, elite, NO_FX), last.e, last.at, splash, ev);
}

/** 창병 A 긴 창: 타워→첫 대상 방향, 길이 = 사거리·폭 선분 안에서 첫 대상 포함 진행도↓ → 생성순↑로 최대 수(PRD §20.3). */
function lineTargets(ctx: GameContext, s: RunState, tower: Tower, first: Enemy, stats: TowerStats): Enemy[] {
  const f = at(ctx, first);
  const d = { x: f.x - tower.x, y: f.y - tower.y };
  const others = s.enemies
    .filter(e => reachable(stats.canHitFlyer, e, s.tick) && e !== first && inLine(tower, d, at(ctx, e), stats.range, stats.lineWidth) !== null)
    .sort((a, b) => b.progress - a.progress || a.id - b.id);
  return [first, ...others].slice(0, stats.maxTargets);
}

/** 수호기사 B 수호 일격: 첫 대상 중심 반경 안을 거리↑ → 진행도↓ → 생성순↑로 최대 수(PRD §20.3). */
function aroundTargets(ctx: GameContext, s: RunState, first: Enemy, stats: TowerStats): Enemy[] {
  const c = at(ctx, first);
  return nearby(ctx, s, c, stats.splashRadius, stats.maxTargets, e => reachable(stats.canHitFlyer, e, s.tick));
}

/** 점 c 둘레 반경 안을 거리↑ → 진행도↓ → 생성순↑로 최대 수. */
function nearby(ctx: GameContext, s: RunState, c: { x: number; y: number }, radius: number, max: number, ok: (e: Enemy) => boolean): Enemy[] {
  const r2 = radius * radius;
  return s.enemies
    .filter(ok)
    .map(e => { const p = at(ctx, e); return { e, d: dist2(p.x, p.y, c.x, c.y) }; })
    .filter(h => h.d <= r2)
    .sort((a, b) => a.d - b.d || b.e.progress - a.e.progress || a.e.id - b.e.id)
    .slice(0, max)
    .map(h => h.e);
}

/** 고리(종각·서리 B1): 타워 중심 사거리 안 전방위, 진행도↓ → 생성순↑로 최대 수. */
function ringTargets(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats): Enemy[] {
  const r2 = stats.range * stats.range;
  return s.enemies
    .filter(e => reachable(stats.canHitFlyer, e, s.tick) && (p => dist2(p.x, p.y, tower.x, tower.y) <= r2)(at(ctx, e)))
    .sort((a, b) => b.progress - a.progress || a.id - b.id)
    .slice(0, stats.maxTargets);
}

/** 번개 k번째 대상의 피해 = 최초 기준 피해 × 감쇠비^k, 마지막에 한 번 내림한다(PRD §20.3). 중간 곱이 커서 BigInt로 계산한다. */
export function chainDamage(base: number, falloffBP: number, k: number): number {
  if (k === 0 || falloffBP === 10000) return base;
  return Number((BigInt(base) * BigInt(falloffBP) ** BigInt(k)) / 10000n ** BigInt(k));
}

/** 첫 표적 뒤에는 직전 대상 중심 반경 안의 아직 맞지 않은 적을 거리↑ → 진행도↓ → 생성순↑로 고른다. 없으면 끝난다. */
function chainTargets(ctx: GameContext, s: RunState, first: Enemy, stats: TowerStats): Enemy[] {
  const chosen = [first];
  while (chosen.length < stats.maxTargets) {
    const last = at(ctx, chosen[chosen.length - 1]!);
    const next = nearby(ctx, s, last, stats.chainRadius, 1, e => reachable(stats.canHitFlyer, e, s.tick) && !chosen.includes(e))[0];
    if (!next) break;
    chosen.push(next);
  }
  return chosen;
}

/**
 * 화염 부채꼴: 타워에서 기본 표적 방향을 축으로 한 총각 90도. 사거리 안, 전방(dot ≥ 0), 2·dot² ≥ 거리²·축길이²인 적을
 * 진행도↓ → 생성순↑로 최대 대상 수만큼 고른다. 정수식만 쓴다(PRD §20.2~20.3).
 */
function coneTargets(ctx: GameContext, s: RunState, tower: Tower, first: Enemy, stats: TowerStats): Enemy[] {
  const f = at(ctx, first);
  const ax = f.x - tower.x, ay = f.y - tower.y;
  const axis2 = ax * ax + ay * ay;
  const r2 = stats.range * stats.range;
  return s.enemies
    .filter(e => {
      if (!reachable(stats.canHitFlyer, e, s.tick)) return false;
      const p = at(ctx, e);
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
      if (e.hp === 0) { kill(ctx, s, e, at(ctx, e), ev, top.source, 0); return; }
      if (e.boss) bossThresholds(ctx, s, e, ev);
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
  // 약병(§4-7 zone): 착탄 피해 없이 장판만 남긴다. 첫 타격은 이 틱의 장판 단계에서 한다.
  if (p.zone) { placeZones(ctx, s, p, p.zone, ev); return; }
  if (p.targetId !== null) {
    // 단일 대상: 도착 전에 처치·누출되면 빗나감, 다른 적으로 바꾸지 않는다(PRD §20.3). 대공이 안 되면 다시 떠오른 비행 적도 빗나간다.
    const target = s.enemies.find(e => e.id === p.targetId && reachable(p.canHitFlyer, e, s.tick));
    if (!target) return;
    const point = at(ctx, target);
    applyHit(ctx, s, p, target, ev);
    if (p.splash) splashAround(ctx, s, { ...p, damage: p.splash.damage, fx: NO_FX }, target, point, p.splash, ev);
    if (p.ricochet && p.ricochet.left > 0) ricochet(ctx, s, p, point, ev);
    return;
  }
  const hits = nearby(ctx, s, { x: p.toX, y: p.toY }, p.splashRadius, p.maxTargets, e => reachable(p.canHitFlyer, e, s.tick));
  for (const e of hits) applyHit(ctx, s, p, e, ev);
  if (p.pull && hits[0]) pull(ctx, s, p.pull, hits[0], { x: p.toX, y: p.toY });
}

/** 도탄(§4-3): 맞힌 자리 둘레의 아직 안 맞은 적에게 감쇠한 피해로 새 투사체를 보낸다. */
function ricochet(ctx: GameContext, s: RunState, p: Projectile, from: { x: number; y: number }, ev: DomainEvent[]) {
  const r = p.ricochet!;
  const next = nearby(ctx, s, from, r.radius, 1, e => reachable(p.canHitFlyer, e, s.tick) && !r.hit.includes(e.id))[0];
  if (!next) return;
  const tower = s.towers.find(t => t.id === p.towerId);
  if (!tower) return;
  const stats = towerStats(ctx.balance, tower.type, tower.level, tower.form);
  const bounce: Strike & Pick<Projectile, 'ricochet'> = {
    towerId: p.towerId, towerType: p.towerType, damage: bpFloor(p.damage, r.falloffBP, 'damage.ricochet'), damageType: p.damageType, slowBP: p.slowBP, slowTicks: p.slowTicks,
    physicalResistIgnoreBP: p.physicalResistIgnoreBP, bonusBP: p.bonusBP, eliteBossDamageBP: p.eliteBossDamageBP, canHitFlyer: p.canHitFlyer, flyerDamageBP: p.flyerDamageBP,
    ...(p.fx ? { fx: p.fx } : {}), ricochet: { ...r, left: r.left - 1, hit: [...r.hit, next.id] },
  };
  launch(s, tower, from, stats, next, at(ctx, next), bounce, ev);
}

/** 마지막 대상 둘레 2차 피해(파편·폭발): 그 대상은 빼고, 반경 안 거리↑로 최대 수. */
function splashAround(ctx: GameContext, s: RunState, a: Strike, center: Enemy, point: { x: number; y: number }, splash: SplashHit, ev: DomainEvent[]) {
  const targets = nearby(ctx, s, point, splash.radius, splash.maxTargets, e => e !== center && reachable(a.canHitFlyer, e, s.tick) && (!splash.flyersOnly || e.flying));
  const fx: HitFx = { ...NO_FX, vulnBP: splash.vulnBP, vulnTicks: splash.vulnTicks };
  for (const e of targets) applyHit(ctx, s, { ...a, damage: splash.damage, slowBP: splash.slowBP, slowTicks: splash.slowTicks, fx }, e, ev);
}

/** 당기기(마법 B2): 착탄 둘레 일반 적(대장 제외)을 중심 적 진행도 쪽으로 최대 milli. */
function pull(ctx: GameContext, s: RunState, rule: NonNullable<Projectile['pull']>, center: Enemy, point: { x: number; y: number }) {
  for (const e of nearby(ctx, s, point, rule.radius, rule.maxTargets, e => e.alive && e !== center && e.kind !== 'boss')) {
    const gap = center.progress - e.progress;
    const step = Math.sign(gap) * Math.min(Math.abs(gap), rule.milli);
    if (step < 0) knockback(ctx, e, -step);
    else if (step > 0) { e.progress = Math.min(ctx.path.length - 1, e.progress + step); e.moveRem = 0; }
  }
}

/** 저항 계산 뒤 양의 피해는 최소 1 milli-HP(PRD §20.2). */
export function mitigated(damage: number, resistBP: number): number {
  if (damage <= 0) return 0;
  return Math.max(1, bpFloor(damage, 10000 - resistBP, 'resist'));
}

const strongest = (list: Array<{ bp: number; untilTick: number }>, tick: number) => list.reduce((m, x) => (x.untilTick > tick && x.bp > m ? x.bp : m), 0);

/**
 * 최종 저항(PRD §20.2, towers.md §4-6): 저항 차감(가장 큰 출처 하나, 상한)을 먼저 빼고, 무시 비율로 남은 저항을 줄인다.
 * 물리 저항 무시는 물리에만, 마법 저항 무시는 마법(화상 포함)에만 쓴다.
 */
export function effectiveResistBP(e: Pick<Enemy, 'physicalResistBP' | 'magicResistBP'> & Partial<Pick<Enemy, 'shreds' | 'boss'>>, damageType: 'physical' | 'magic', ignoreBP: number, magicIgnoreBP = 0, tick = 0, shredCapBP = 10000, stanceCapBP = 10000): number {
  const shred = Math.min(shredCapBP, (e.shreds ?? []).reduce((m, x) => (x.untilTick > tick ? Math.max(m, damageType === 'magic' ? x.magicBP : x.physicalBP) : m), 0));
  // 대장 방어 태세(monsters.md §2.0 iron_stance): 기본 저항에 더하고 상한까지.
  const stance = e.boss?.stance && tick < e.boss.stance.untilTick ? e.boss.stance : null;
  const own = damageType === 'magic' ? e.magicResistBP : e.physicalResistBP;
  const raised = stance ? Math.max(own, Math.min(stanceCapBP, own + (damageType === 'magic' ? stance.magicBP : stance.physicalBP))) : own;
  const base = Math.max(0, raised - shred);
  if (damageType === 'magic') return magicIgnoreBP > 0 ? bpFloor(base, 10000 - magicIgnoreBP, 'resist.ignore') : base;
  return ignoreBP > 0 ? bpFloor(base, 10000 - ignoreBP, 'resist.ignore') : base;
}

/** 대장 체력 임계(방어 태세 첫 발동·호위 호출 단계). 피해·화상 뒤 살아 있을 때 부른다. */
function bossThresholds(ctx: GameContext, s: RunState, e: Enemy, ev: DomainEvent[]) {
  const skill = bossDef(ctx.balance, e)?.skill;
  const st = e.boss!;
  const below = (bp: number) => safe(e.hp * 10000, 'boss') <= safe(e.maxHp * bp, 'boss');
  if (skill?.kind === 'iron_stance' && !st.stanceUsed && below(skill.triggerBP)) {
    st.stanceUsed = true;
    st.stance = { physicalBP: skill.physicalBP ?? 0, magicBP: skill.magicBP ?? 0, untilTick: s.tick + msToTicks(skill.durationMs) };
    ev.push({ type: 'bossSkill', enemyId: e.id, skill: 'iron_stance' });
  }
  if (skill?.kind === 'call_escort') {
    while (st.escortStep < skill.thresholdsBP.length && below(skill.thresholdsBP[st.escortStep]!)) {
      st.escortStep++;
      ev.push({ type: 'bossSkill', enemyId: e.id, skill: 'call_escort' });
      const hpBase = s.battle?.hpBaseMilli ?? hpBaseMilli(ctx.balance, s.wave);
      const n = skill.escorts.length;
      skill.escorts.forEach((kind, i) => {
        const offset = n === 1 ? skill.spreadMilli : -skill.spreadMilli + Math.floor((2 * skill.spreadMilli * i) / (n - 1));
        addEnemy(ctx, s, { kind, elite: null, faction: e.faction }, hpBase, Math.min(ctx.path.length - 1, Math.max(0, e.progress + offset)), true, ev);
      });
    }
  }
}

/** 새참 회복(monsters.md §2.0 snack_mend): 주기마다 기절이 아니면 회복, 최대 횟수까지. 기절 중이면 그 주기는 건너뛴다. */
function bossMend(ctx: GameContext, s: RunState, e: Enemy, ev: DomainEvent[]) {
  const skill = bossDef(ctx.balance, e)?.skill;
  const st = e.boss!;
  if (skill?.kind !== 'snack_mend' || st.mends >= skill.maxTimes || s.tick < st.nextMendTick) return;
  st.nextMendTick = s.tick + msToTicks(skill.periodMs);
  if (e.stunUntilTick > s.tick) return;
  st.mends++;
  e.hp = Math.min(e.maxHp, add(e.hp, Math.floor((e.maxHp * skill.healBP) / 10000), 'hp'));
  ev.push({ type: 'bossSkill', enemyId: e.id, skill: 'snack_mend' });
}

/** 이동 속도: 대장 돌진(burst_march) 중이면 그 속도, 일반 적은 진군 북소리 반경 안이면 더한 속도(상한까지, 원래보다 낮추지 않는다). */
function moveSpeedBP(ctx: GameContext, s: RunState, e: Enemy, rallies: Array<{ x: number; y: number; r2: number; add: number }>): number {
  if (e.kind === 'boss') {
    const skill = e.boss ? bossDef(ctx.balance, e)?.skill : undefined;
    if (skill?.kind === 'burst_march' && burstMarching(skill, e.boss!.bornTick, s.tick)) return skill.speedBP;
    return e.speedBP;
  }
  if (rallies.length === 0) return e.speedBP;
  const p = at(ctx, e);
  const add = rallies.reduce((m, r) => (dist2(p.x, p.y, r.x, r.y) <= r.r2 ? Math.max(m, r.add) : m), 0);
  return add > 0 ? Math.max(e.speedBP, Math.min(ctx.balance.statusCaps.rallySpeedMaxBP, e.speedBP + add)) : e.speedBP;
}

function addSlow(e: Enemy, source: number, bp: number, untilTick: number) {
  // 출처별 세기·만료를 따로 둔다. 약한 효과가 강한 효과의 만료를 늘리지 않는다(PRD §8.5).
  const own = e.slows.find(x => x.source === source);
  if (own) { own.bp = bp; own.untilTick = untilTick; }
  else e.slows.push({ source, bp, untilTick });
}

function stun(ctx: GameContext, s: RunState, e: Enemy, ticks: number) {
  const left = msToTicks(ctx.balance.statusCaps.stunLifetimeMaxMs) - e.stunTicksUsed;
  if (left > 0) e.stunUntilTick = Math.max(e.stunUntilTick, s.tick + Math.min(ticks, left));
}

/** 밀치기(§4-5): 경로 뒤로, 적 1기 평생 상한까지. 이동 나머지는 버린다. */
function knockback(ctx: GameContext, e: Enemy, milli: number) {
  const d = Math.min(milli, ctx.balance.statusCaps.knockbackLifetimeMaxMilli - e.knockbackUsed, e.progress);
  if (d <= 0) return;
  e.progress -= d;
  e.moveRem = 0;
  e.knockbackUsed += d;
}

/**
 * 레벨·형태까지 반영된 피해에 상황(정예·보스 → 비행 → 빈사 → 감속 중) → 외부(깃발) → 취약 → 저항 순서로 한 단계씩 곱한다(PRD §20.2).
 * 피해가 0인 타격(전염·감속만)은 피해 없이 효과만 준다. depth는 처치 유발 효과의 연쇄 깊이다.
 */
function applyHit(ctx: GameContext, s: RunState, p: Strike, e: Enemy, ev: DomainEvent[], depth = 0) {
  // 같은 목록 앞의 타격(처치 유발 등)으로 이미 쓰러진 적은 건너뛴다. 다시 처치되면 보상이 두 번 나간다.
  if (!e.alive) return;
  const b = ctx.balance;
  const fx = p.fx ?? NO_FX;
  const elite = e.elite !== null || e.kind === 'boss';
  if (p.damage > 0) {
    let damage = p.damage;
    if (p.eliteBossDamageBP !== 10000 && elite) damage = bpFloor(damage, p.eliteBossDamageBP, 'damage.situational');
    if (p.flyerDamageBP !== 10000 && e.flying) damage = bpFloor(damage, p.flyerDamageBP, 'damage.flyer');
    if (fx.lowHpThresholdBP > 0 && safe(e.hp * 10000, 'lowHp') <= safe(e.maxHp * fx.lowHpThresholdBP, 'lowHp')) damage = bpFloor(damage, fx.lowHpDamageBP, 'damage.lowHp');
    if (fx.slowedDamageBP !== 10000 && e.slows.some(x => x.untilTick > s.tick)) damage = bpFloor(damage, fx.slowedDamageBP, 'damage.slowed');
    if (p.bonusBP > 0) damage = bpFloor(damage, 10000 + p.bonusBP, 'damage.external');
    const vuln = Math.min(b.statusCaps.vulnMaxBP, strongest(e.vulns, s.tick));
    if (vuln > 0) damage = bpFloor(damage, 10000 + vuln, 'damage.vuln');
    const resist = effectiveResistBP(e, p.damageType, p.physicalResistIgnoreBP, fx.magicResistIgnoreBP, s.tick, b.statusCaps.shredMaxBP, b.statusCaps.bossResistMaxBP);
    let dealt = Math.min(e.hp, mitigated(damage, resist));
    // 겹방패(monsters.md §2.0): 한 번 맞을 때마다 최대 체력의 capBP까지만 받고 한 겹 벗긴다.
    if (e.boss && e.boss.wardLeft > 0) {
      const skill = bossDef(b, e)?.skill;
      if (skill?.kind === 'ward_layers') {
        dealt = Math.min(dealt, Math.max(1, Math.floor((e.maxHp * skill.capBP) / 10000)));
        e.boss.wardLeft--;
        ev.push({ type: 'bossSkill', enemyId: e.id, skill: 'ward_layers' });
      }
    }
    e.hp = safe(e.hp - dealt, 'hp');
    const point = at(ctx, e);
    ev.push({ type: 'hit', enemyId: e.id, x: point.x, y: point.y, damage: dealt, towerType: p.towerType });
    if (e.hp === 0) {
      kill(ctx, s, e, point, ev, p.towerId, depth);
      return;
    }
    if (e.boss) bossThresholds(ctx, s, e, ev);
  }
  if (p.slowBP > 0) addSlow(e, p.towerId, p.slowBP, s.tick + p.slowTicks);
  if (fx.eliteSlowBP > 0 && elite) addSlow(e, p.towerId, fx.eliteSlowBP, s.tick + fx.eliteSlowTicks);
  if (fx.bossSlowBP > 0 && e.kind === 'boss') addSlow(e, p.towerId, fx.bossSlowBP, s.tick + fx.bossSlowTicks);
  if (fx.stunTicks > 0) stun(ctx, s, e, fx.stunTicks);
  if (fx.eliteStunTicks > 0 && elite) stun(ctx, s, e, fx.eliteStunTicks);
  const push = e.kind === 'boss' ? fx.knockbackBoss : e.flying ? fx.knockbackFlyer : fx.knockback;
  if (push > 0) knockback(ctx, e, push);
  if (fx.groundTicks > 0 && e.flying) e.groundedUntilTick = Math.max(e.groundedUntilTick, s.tick + fx.groundTicks);
  if (fx.vulnBP > 0) {
    const own = e.vulns.find(x => x.source === p.towerId);
    if (own) { own.bp = fx.vulnBP; own.untilTick = s.tick + fx.vulnTicks; } else e.vulns.push({ source: p.towerId, bp: fx.vulnBP, untilTick: s.tick + fx.vulnTicks });
  }
  if (fx.shredPhysicalBP > 0 || fx.shredMagicBP > 0) {
    const own = e.shreds.find(x => x.source === p.towerId);
    const mark = { source: p.towerId, physicalBP: fx.shredPhysicalBP, magicBP: fx.shredMagicBP, untilTick: s.tick + fx.shredTicks };
    if (own) Object.assign(own, mark); else e.shreds.push(mark);
  }
  if (fx.burnTotal > 0) {
    const resist = effectiveResistBP(e, 'magic', 0, fx.magicResistIgnoreBP, s.tick, b.statusCaps.shredMaxBP);
    applyBurn(s, e, p.towerId, mitigated(fx.burnTotal, resist), fx.burnTicks);
  }
}

/**
 * 처치(PRD §8): 보상 → 분열(monsters.md §1.2) → 처치 유발 효과(towers.md §4-8, 깊이 1) → 처치 골드 오라(깃발 A2).
 * killer는 마지막 피해를 준 타워 ID(화상은 그 출처), 없으면 null.
 */
function kill(ctx: GameContext, s: RunState, e: Enemy, point: { x: number; y: number }, ev: DomainEvent[], killer: number | null, depth: number) {
  e.alive = false;
  const d = ctx.difficulty;
  const tier = e.kind === 'boss' ? 'boss' : e.elite ? 'elite' : 'regular';
  // 파생체(분열·호위)는 처치 골드·PT가 없다(monsters.md §1.2, 농사 방지).
  const gold = e.derived ? 0 : d.killGold[tier];
  let pt = e.derived ? 0 : d.killPt[tier];
  if (tier !== 'boss') {
    pt = Math.max(0, Math.min(pt, d.waveKillPtCap - s.waveKillPtGranted));
    s.waveKillPtGranted = add(s.waveKillPtGranted, pt);
  } else s.stats.bossKills++;
  s.gold = add(s.gold, gold, 'gold');
  s.pt = add(s.pt, pt, 'pt');
  s.stats.kills++;
  s.stats.goldEarned = add(s.stats.goldEarned, gold);
  s.stats.ptFromKills = add(s.stats.ptFromKills, pt);
  ev.push({ type: 'kill', enemyId: e.id, kind: e.kind, elite: e.elite !== null, x: point.x, y: point.y, gold, pt });
  split(ctx, s, e, ev);
  if (depth === 0) onKill(ctx, s, e, point, ev);
  if (killer !== null && !e.derived) killGoldAura(ctx, s, killer, ev);
}

/**
 * 처치 유발(§4-8): 이 적에게 감속(mark: slow)·화상(mark: burn)을 건 타워, 또는 처치 지점을 덮은 장판의 타워(mark: zone) 가운데
 * onKill이 있는 타워마다(생성순) 둘레에 피해를 주고 감속·화상을 옮긴다. 옮겨진 타격으로 처치돼도 다시 유발하지 않는다(깊이 1).
 * kill()이 분열 파생체를 먼저 만든 뒤 부르므로, 방금 태어난 파생체도 맞는다.
 * 떠 있는 비행 적은 바닥 장판 위에 있지 않다(장판이 대공이 안 되면 그 위에서 쓰러져도 장판 처치로 치지 않는다).
 */
function onKill(ctx: GameContext, s: RunState, e: Enemy, point: { x: number; y: number }, ev: DomainEvent[]) {
  const b = ctx.balance;
  const grounded = !airborne(e, s.tick);
  const zoned = new Set<number>(s.hazards.flatMap(h => (
    h.kind === 'zone' && !h.blast && h.line === null && (grounded || h.strike.canHitFlyer)
      && (h.expiresTick === null || s.tick < h.expiresTick) && dist2(point.x, point.y, h.x, h.y) <= h.radius * h.radius ? [h.towerId] : [])));
  const sources = new Set<number>([...e.slows.filter(x => x.untilTick > s.tick).map(x => x.source), ...e.burns.map(x => x.source), ...zoned]);
  for (const tower of s.towers.filter(t => sources.has(t.id)).sort((a, c) => a.id - c.id)) {
    if (!attacks(b, tower.type)) continue;
    const stats = towerStats(b, tower.type, tower.level, tower.form);
    const rule = stats.fx.onKill;
    if (!rule) continue;
    const marked = rule.mark === 'slow' ? e.slows.some(x => x.source === tower.id && x.untilTick > s.tick)
      : rule.mark === 'burn' ? e.burns.some(x => x.source === tower.id)
      : zoned.has(tower.id);
    if (!marked) continue;
    const targets = nearby(ctx, s, point, rule.radiusMilli, rule.maxTargets, o => reachable(stats.canHitFlyer, o, s.tick));
    if (targets.length === 0) continue;
    const fx: HitFx = rule.carry === 'burn' ? { ...NO_FX, burnTotal: stats.burnTotal, burnTicks: stats.burnTicks, magicResistIgnoreBP: stats.fx.magicResistIgnoreBP ?? 0 } : NO_FX;
    const a = strikeOf(tower, stats, rule.damageBP ? bpFloor(stats.damage, rule.damageBP, 'damage.onKill') : 0, 0, stats.eliteBossDamageBP, fx);
    const carried: Strike = rule.carry === 'slow' ? a : { ...a, slowBP: 0, slowTicks: 0 };
    ev.push({ type: 'strike', towerId: tower.id, towerType: tower.type, fromX: point.x, fromY: point.y, targets: targets.map(o => ({ enemyId: o.id, ...at(ctx, o) })) });
    for (const o of targets) applyHit(ctx, s, carried, o, ev, 1);
  }
}

/** 처치 골드 오라(깃발 A2): 오라 안 타워가 every번 처치할 때마다 gold, 웨이브당 상한까지. */
function killGoldAura(ctx: GameContext, s: RunState, killer: number, ev: DomainEvent[]) {
  const b = ctx.balance;
  const tower = s.towers.find(t => t.id === killer);
  if (!tower) return;
  for (const giver of s.towers) {
    if (giver === tower || !isAuraGiver(b, giver)) continue;
    const rule = effectsFor(b, giver.type, giver.form).auraKillGold;
    if (!rule || !auraReaches(b, giver, tower, burningNow(s))) continue;
    giver.auraKills++;
    if (giver.auraKills % rule.every !== 0 || giver.auraGold >= rule.waveCap) continue;
    const gold = Math.min(rule.gold, rule.waveCap - giver.auraGold);
    giver.auraGold += gold;
    s.gold = add(s.gold, gold, 'gold');
    s.stats.goldEarned = add(s.stats.goldEarned, gold);
    ev.push({ type: 'auraGold', towerId: giver.id, gold });
  }
}

/**
 * 분열(monsters.md §1.2 splitter): 처치 지점 progress에서 -spread…+spread로 고르게 파생체를 놓는다(경로 안으로 자른다).
 * 같은 틱 뒤 타워의 표적이 될 수 있고, 처치 유발 효과(towers.md §4-8)는 이 뒤에 온다.
 */
function split(ctx: GameContext, s: RunState, e: Enemy, ev: DomainEvent[]) {
  const rule = ctx.balance.enemies[e.kind].split;
  if (!rule) return;
  const hpBase = s.battle?.hpBaseMilli ?? hpBaseMilli(ctx.balance, s.wave);
  for (let i = 0; i < rule.count; i++) {
    const offset = rule.count === 1 ? 0 : -rule.spreadMilli + Math.floor((2 * rule.spreadMilli * i) / (rule.count - 1));
    const progress = Math.min(ctx.path.length - 1, Math.max(0, e.progress + offset));
    addEnemy(ctx, s, { kind: rule.kind, elite: null, faction: e.faction }, hpBase, progress, true, ev);
  }
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
  // 진군 북소리(rally_haste) 대장의 이번 틱 위치. 이동 전 위치로 한 번만 잰다.
  const rallies = s.enemies.flatMap(e => {
    const skill = e.alive && e.boss ? bossDef(ctx.balance, e)?.skill : undefined;
    return skill?.kind === 'rally_haste' ? [{ ...at(ctx, e), r2: skill.radiusMilli * skill.radiusMilli, add: skill.speedAddBP }] : [];
  });
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.stunUntilTick > s.tick) { e.stunTicksUsed++; continue; }
    const slow = effectiveSlowBP(ctx, e, s.tick);
    const numerator = safe(ctx.path.cells * 1000 * moveSpeedBP(ctx, s, e, rallies) * (10000 - slow) + e.moveRem, 'move');
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

// ── 장판·덫·굴림체(towers.md §4-7 fieldHazards) ──────────────────────────────────────────────
// 놓는 순간의 타격 스냅샷(레벨·형태·오라)을 싣고, battleTick의 화상 직후 단계에서 생성순으로 일괄 갱신한다.
// 이번 갱신 중에 새로 생긴 것(덫 B1 2차 폭죽)은 다음 틱부터 본다. 장판은 착탄 틱에, 굴림체는 투입 다음 틱에 처음 움직인다.

/** 피해만 싣는 2차 폭발 타격(감속·추가 효과 없음). */
const damageOnly = (a: Strike, damage: number): HazardStrike => ({ ...a, damage, slowBP: 0, slowTicks: 0, fx: NO_FX });

function addHazard(s: RunState, h: FieldHazard, ev: DomainEvent[]) {
  s.hazards.push(h);
  ev.push({
    type: 'hazardPlaced', hazardId: h.id, kind: h.kind, towerId: h.towerId, towerType: h.towerType, x: h.x, y: h.y,
    radius: h.kind === 'roller' ? h.halfWidth : h.radius, progress: h.kind === 'zone' ? null : h.progress, expiresTick: h.expiresTick,
    line: h.kind === 'zone' ? h.line : null, blast: h.kind === 'zone' && h.blast,
  });
}

function triggered(ctx: GameContext, h: FieldHazard, point: { x: number; y: number }, blast: boolean, targets: Enemy[]): DomainEvent {
  return { type: 'hazardTriggered', hazardId: h.id, kind: h.kind, towerId: h.towerId, towerType: h.towerType, x: point.x, y: point.y, blast, targets: targets.map(e => ({ enemyId: e.id, ...at(ctx, e) })) };
}

/** 약병 장판 설정 스냅샷: 타격 횟수 = ceil(지속 틱 / 간격 틱)(기본 60/15 = 4회). */
function zoneSpec(stats: TowerStats, zone: NonNullable<TowerStats['fx']['zone']>, progress: number): ZoneSpec {
  const periodTicks = msToTicks(zone.periodMs), durationTicks = msToTicks(zone.durationMs);
  return { radius: stats.splashRadius, periodTicks, durationTicks, pulses: ceilDiv(durationTicks, periodTicks), count: zone.count ?? 1, spacing: zone.spacingMilli ?? 0, progress };
}

/** 착탄: 착탄 지점(개수가 여럿이면 표적 진행도와 그 앞뒤 spacing 자리)에 장판을 놓는다. 첫 타격은 이 틱. */
function placeZones(ctx: GameContext, s: RunState, p: Projectile, z: ZoneSpec, ev: DomainEvent[]) {
  const strike: HazardStrike = {
    towerId: p.towerId, towerType: p.towerType, damage: p.damage, damageType: p.damageType, slowBP: p.slowBP, slowTicks: p.slowTicks,
    physicalResistIgnoreBP: p.physicalResistIgnoreBP, bonusBP: p.bonusBP, eliteBossDamageBP: p.eliteBossDamageBP, canHitFlyer: p.canHitFlyer, flyerDamageBP: p.flyerDamageBP,
    ...(p.fx ? { fx: p.fx } : {}),
  };
  for (let i = 0; i < z.count; i++) {
    const offset = Math.floor(((2 * i - (z.count - 1)) * z.spacing) / 2);
    const point = z.count === 1 ? { x: p.toX, y: p.toY } : positionAt(ctx.path, Math.min(ctx.path.length, Math.max(0, z.progress + offset)));
    addHazard(s, {
      kind: 'zone', id: s.seq.hazard++, towerId: p.towerId, towerType: p.towerType, x: point.x, y: point.y, createdTick: s.tick,
      expiresTick: s.tick + z.durationTicks, charges: z.pulses, maxTargets: p.maxTargets, strike, radius: z.radius,
      nextTick: s.tick, periodTicks: z.periodTicks, line: null, blast: false,
    }, ev);
  }
}

/** 도화선(노포 B2): 타워에서 발사 방향 직선(길이 사거리·폭 선분 폭)에 delayMs 뒤 피해만 주는 폭발 한 번. */
function lightFuse(s: RunState, tower: Tower, stats: TowerStats, aim: { x: number; y: number }, fuse: NonNullable<TowerStats['fx']['delayedBlast']>, a: Strike, ev: DomainEvent[]) {
  const dx = aim.x - tower.x, dy = aim.y - tower.y;
  if (dx === 0 && dy === 0) return;
  const delay = msToTicks(fuse.delayMs);
  addHazard(s, {
    kind: 'zone', id: s.seq.hazard++, towerId: tower.id, towerType: tower.type, x: tower.x, y: tower.y, createdTick: s.tick,
    expiresTick: s.tick + delay, charges: 1, maxTargets: fuse.maxTargets ?? stats.maxTargets, strike: damageOnly(a, bpFloor(a.damage, fuse.damageBP, 'damage.fuse')),
    radius: 0, nextTick: s.tick + delay, periodTicks: delay, line: { dx, dy, length: stats.range, width: stats.lineWidth }, blast: true,
  }, ev);
}

/** 굴림체 투입: 첫 표적 진행도에서 입구 쪽으로 distance만큼(0에서 멈춤), 틱당 speed/30씩. 대상 수는 타워 maxTargets. */
function launchRoller(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats, target: Enemy, a: Strike, ev: DomainEvent[]) {
  const rule = stats.fx.roller!;
  const step = Math.max(1, Math.floor(rule.speedMilliPerSec / TICK_HZ));
  const end = Math.max(0, target.progress - rule.distanceMilli);
  const blast = stats.fx.rollBlast;
  const p = at(ctx, target);
  addHazard(s, {
    kind: 'roller', id: s.seq.hazard++, towerId: tower.id, towerType: tower.type, x: p.x, y: p.y, createdTick: s.tick,
    expiresTick: s.tick + Math.max(1, ceilDiv(target.progress - end, step)), charges: stats.maxTargets, maxTargets: stats.maxTargets, strike: a,
    progress: target.progress, endProgress: end, stepMilli: step, halfWidth: Math.floor(rule.widthMilli / 2), hit: [],
    blast: blast ? { afterHits: blast.afterHits, eliteTrigger: blast.eliteTrigger, radius: blast.radiusMilli, maxTargets: blast.maxTargets, damage: bpFloor(a.damage, blast.damageBP, 'damage.rollBlast') } : null,
  }, ev);
}

/**
 * 덫 놓기(§4-7 trap): 타워당 maxActive개까지, 사거리(오라 포함) 안 경로에서 다른 덫과 감지 지름 이상 떨어진 가장 성문 쪽 자리.
 * 놓으면 공격으로 친다(설치 취소 끝, 다음 공격 예약). 자리가 없으면 쏘지 않은 것처럼 준비 상태로 기다린다.
 */
function placeTrap(ctx: GameContext, s: RunState, tower: Tower, stats: TowerStats, range: number, ev: DomainEvent[]) {
  const rule = stats.fx.trap!;
  if (s.hazards.filter(h => h.kind === 'trap' && h.towerId === tower.id).length >= rule.maxActive) return;
  const taken = s.hazards.flatMap(h => (h.kind === 'trap' ? [h.progress] : []));
  const progress = trapSpot(ctx.path, tower.x, tower.y, range, taken, 2 * rule.detectMilli);
  if (progress === null) return;
  commitAttack(ctx, s, tower, stats);
  const b = ctx.balance;
  const a = strikeOf(tower, stats, stats.damage, auraDamageBonusBP(b, s.towers, tower), stats.eliteBossDamageBP + auraEliteBossBonusBP(b, s.towers, tower, burningNow(s)), hitFxOf(stats, 0));
  const after = stats.fx.delayedBlast;
  const p = positionAt(ctx.path, progress);
  addHazard(s, {
    kind: 'trap', id: s.seq.hazard++, towerId: tower.id, towerType: tower.type, x: p.x, y: p.y, createdTick: s.tick, expiresTick: null, charges: 1,
    maxTargets: stats.maxTargets, strike: a, progress, radius: rule.detectMilli, blastRadius: stats.splashRadius,
    aftershock: after ? { delayTicks: msToTicks(after.delayMs), damage: bpFloor(stats.damage, after.damageBP, 'damage.aftershock') } : null,
  }, ev);
}

/** 화상 직후 단계: 생성순으로 장판 타격·덫 감지·굴림체 이동을 하고, 끝난 것을 지운다. */
function updateHazards(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  if (s.hazards.length === 0) return;
  const gone = new Set<number>();
  for (const h of [...s.hazards]) {
    const end = h.kind === 'zone' ? tickZone(ctx, s, h, ev) : h.kind === 'trap' ? tickTrap(ctx, s, h, ev) : tickRoller(ctx, s, h, ev);
    if (end) { gone.add(h.id); ev.push(hazardExpiredEvent(h, end)); }
  }
  if (gone.size) s.hazards = s.hazards.filter(h => !gone.has(h.id));
}

/** 장판: 타격 틱이면 반경(또는 직선) 안 지상 적 최대 maxTargets명을 친다(거리↑ → 진행도↓ → 생성순↑). 지속이 끝나면 사라진다. */
function tickZone(ctx: GameContext, s: RunState, z: ZoneHazard, ev: DomainEvent[]): HazardEndReason | null {
  if (z.charges > 0 && s.tick >= z.nextTick) {
    z.charges--;
    z.nextTick = add(z.nextTick, z.periodTicks, 'hazard.tick');
    const ok = (e: Enemy) => reachable(z.strike.canHitFlyer, e, s.tick);
    const line = z.line;
    const targets = line
      ? s.enemies
        .filter(e => ok(e) && inLine(z, { x: line.dx, y: line.dy }, at(ctx, e), line.length, line.width) !== null)
        .sort((a, c) => c.progress - a.progress || a.id - c.id)
        .slice(0, z.maxTargets)
      : nearby(ctx, s, z, z.radius, z.maxTargets, ok);
    if (targets.length > 0 || z.blast) ev.push(triggered(ctx, z, z, z.blast, targets));
    for (const e of targets) applyHit(ctx, s, z.strike, e, ev);
  }
  if (z.expiresTick !== null && s.tick >= z.expiresTick) return z.blast ? 'spent' : 'time';
  return null;
}

/**
 * 덫: 진행도 ±감지 반경 안의 지상 적 가운데 가장 앞선 적(진행도↓ → 생성순↑)이 밟으면 발동한다.
 * 발동 범위가 있으면 밟은 적과 덫 둘레 최대 maxTargets명, 없으면 밟은 적 하나. 2차 폭죽은 delayTicks 뒤 같은 자리.
 */
function tickTrap(ctx: GameContext, s: RunState, trap: TrapHazard, ev: DomainEvent[]): HazardEndReason | null {
  const ok = (e: Enemy) => reachable(trap.strike.canHitFlyer, e, s.tick);
  const stepping = s.enemies
    .filter(e => ok(e) && Math.abs(e.progress - trap.progress) <= trap.radius)
    .sort((a, c) => c.progress - a.progress || a.id - c.id)[0];
  if (!stepping) return null;
  const targets = trap.blastRadius > 0
    ? [stepping, ...nearby(ctx, s, trap, trap.blastRadius, trap.maxTargets, e => e !== stepping && ok(e))].slice(0, trap.maxTargets)
    : [stepping];
  trap.charges--;
  ev.push(triggered(ctx, trap, trap, trap.blastRadius > 0, targets));
  for (const e of targets) applyHit(ctx, s, trap.strike, e, ev);
  if (trap.aftershock) {
    const at2 = s.tick + trap.aftershock.delayTicks;
    addHazard(s, {
      kind: 'zone', id: s.seq.hazard++, towerId: trap.towerId, towerType: trap.towerType, x: trap.x, y: trap.y, createdTick: s.tick, expiresTick: at2, charges: 1,
      maxTargets: trap.maxTargets, strike: damageOnly(trap.strike, trap.aftershock.damage), radius: trap.blastRadius > 0 ? trap.blastRadius : trap.radius,
      nextTick: at2, periodTicks: trap.aftershock.delayTicks, line: null, blast: true,
    }, ev);
  }
  return trap.charges <= 0 ? 'spent' : null;
}

/**
 * 굴림체: progress를 stepMilli 줄이고(끝에서 멈춤), 지난 구간[새 위치 − 반쪽 폭, 옛 위치 + 반쪽 폭]의 아직 안 맞은 지상 적을
 * 진행도↓ → 생성순↑로 남은 횟수만큼 친다. 화약 술통은 afterHits번째·정예/대장 충돌·굴림 끝 가운데 먼저 오는 때 굴림체 자리에서 폭발한다.
 */
function tickRoller(ctx: GameContext, s: RunState, r: RollerHazard, ev: DomainEvent[]): HazardEndReason | null {
  const from = r.progress;
  const to = Math.max(r.endProgress, from - r.stepMilli);
  const pos = positionAt(ctx.path, to);
  r.progress = to; r.x = pos.x; r.y = pos.y;
  const ok = (e: Enemy) => reachable(r.strike.canHitFlyer, e, s.tick);
  const met = s.enemies
    .filter(e => ok(e) && !r.hit.includes(e.id) && e.progress >= to - r.halfWidth && e.progress <= from + r.halfWidth)
    .sort((a, c) => c.progress - a.progress || a.id - c.id);
  const struck: Enemy[] = [];
  let boom = false;
  for (const e of met) {
    if (r.charges <= 0 || boom) break;
    r.hit.push(e.id);
    r.charges--;
    struck.push(e);
    if (r.blast && ((r.blast.eliteTrigger && (e.elite !== null || e.kind === 'boss')) || r.hit.length >= r.blast.afterHits)) boom = true;
  }
  if (struck.length > 0) {
    ev.push(triggered(ctx, r, pos, false, struck));
    for (const e of struck) applyHit(ctx, s, r.strike, e, ev);
  }
  if (!boom && r.charges > 0 && to > r.endProgress) return null;
  if (r.blast) {
    const targets = nearby(ctx, s, pos, r.blast.radius, r.blast.maxTargets, ok);
    ev.push(triggered(ctx, r, pos, true, targets));
    const a = damageOnly(r.strike, r.blast.damage);
    for (const e of targets) applyHit(ctx, s, a, e, ev);
  }
  return boom || r.charges <= 0 ? 'spent' : 'end';
}

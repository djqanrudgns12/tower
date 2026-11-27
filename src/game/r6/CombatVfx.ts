import type Phaser from 'phaser';
import type { DomainEvent } from '../../domain/events';
import type { RunState } from '../../domain/types';
import { auraReaches, towerStats } from '../../domain/towers';
import { CELL_PX } from '../assets';
import { DEPTH, fieldPosition, toWorld, type LayerContext } from '../layers/shared';
import { R6_COLORS as color } from './manifest';
import { R6_MAP_SCALE, R6_MAP_SQUASH } from './mapProjection';
import {
  fragmentCount,
  MORTAR_SCORCH_MS,
  prismDelay,
  railLanes,
  shellPoint,
  speciesKillTint,
  vfxGraphicsBudget,
  vfxParticleCap,
} from './vfxTiming';

type Graphics = Phaser.GameObjects.Graphics;
type Point = { x: number; y: number };
type Strike = Extract<DomainEvent, { type: 'strike' }>;
type Impact = Extract<DomainEvent, { type: 'areaImpact' }>;
type Draw = (age: number, reduced: boolean, quality: number) => void;
interface Cue { start: number; duration: number; draw: Draw }

interface Particle {
  img: Phaser.GameObjects.Image;
  active: boolean;
  start: number;
  duration: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  gravity: number;
  scale0: number;
  scale1: number;
  rot0: number;
  rotSpeed: number;
  alpha0: number;
}

const BLEND_NORMAL = 0 as Phaser.BlendModes;
const BLEND_ADD = 1 as Phaser.BlendModes;
const MAX_CUES = 96;
const POOL_SIZE = 120;
const TAU = Math.PI * 2;
const VFX_ATLAS_KEY = 'r6.vfx.atlas';
const VFX_FRAMES = [
  'muzzle_cross',
  'ring_shock',
  'smoke_puff',
  'ground_crack',
  'frost_hex',
  'spark_shard',
  'glow_dot',
  'debris_chunk',
] as const;
type VfxFrame = (typeof VFX_FRAMES)[number];

/** 0KB 절차적 256×256(64×64 × 8종) VFX 아틀라스를 씬당 1회 생성한다. */
function ensureVfxAtlas(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(VFX_ATLAS_KEY)) return true;
  if (typeof document === 'undefined') return false;
  const tex = scene.textures.createCanvas(VFX_ATLAS_KEY, 256, 256);
  if (!tex) return false;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 256, 256);

  const cell = (index: number, draw: (cx: number, cy: number) => void) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    ctx.save();
    ctx.translate(col * 64 + 32, row * 64 + 32);
    draw(0, 0);
    ctx.restore();
    tex.add(VFX_FRAMES[index]!, 0, col * 64, row * 64, 64, 64);
  };

  // 0: muzzle_cross (십자 섬광)
  cell(0, () => {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(4, -4); ctx.lineTo(30, 0); ctx.lineTo(4, 4);
    ctx.lineTo(0, 30); ctx.lineTo(-4, 4); ctx.lineTo(-30, 0); ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
  });

  // 1: ring_shock (방사형 충격파 고리)
  cell(1, () => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.stroke();
  });

  // 2: smoke_puff (소프트 연기 덩이)
  cell(2, () => {
    for (const [ox, oy, r] of [[0, -4, 18], [-10, 6, 14], [10, 5, 14]] as const) {
      const g = ctx.createRadialGradient(ox, oy, 2, ox, oy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.fill();
    }
  });

  // 3: ground_crack (착탄 방사 균열)
  cell(3, () => {
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a + 0.14) * 14, Math.sin(a + 0.14) * 14);
      ctx.lineTo(Math.cos(a - 0.08) * 26, Math.sin(a - 0.08) * 26);
      ctx.stroke();
    }
  });

  // 4: frost_hex (육각 서리 결정)
  cell(4, () => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -22, Math.sin(a) * -22);
      ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = Math.cos(a) * 12;
      const y = Math.sin(a) * 12;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // 5: spark_shard (날카로운 스파크 파편)
  cell(5, () => {
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 24);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
  });

  // 6: glow_dot (부드러운 발광 코어)
  cell(6, () => {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
  });

  // 7: debris_chunk (다각형 처치 파편)
  cell(7, () => {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(6, -16);
    ctx.lineTo(18, 2);
    ctx.lineTo(4, 16);
    ctx.lineTo(-16, 10);
    ctx.closePath();
    ctx.fill();
  });

  tex.refresh();
  return true;
}

/** 2계층 하이브리드 VFX: 핵심 가독성 선/원은 Graphics(예산 400/200/100)에, 파편/연기/충격파는 절차적 텍스처 풀(≤120)에 그린다. */
export class R6CombatVfx {
  private readonly ground: Graphics;
  private readonly air: Graphics;
  private readonly flight: Graphics;
  private readonly cues: Cue[] = [];
  private readonly railVolleys = new Map<number, number>();
  private readonly shellRadii = new Map<number, number>();
  private readonly pool: Particle[] = [];
  private readonly atlasReady: boolean;
  private activeParticles = 0;

  constructor(private readonly c: LayerContext) {
    const { scene, bridge } = c;
    this.ground = scene.add.graphics().setName('r6:vfx:ground').setDepth(DEPTH.overlay + 2);
    this.flight = scene.add.graphics().setName('r6:vfx:shell').setDepth(DEPTH.projectiles);
    this.air = scene.add.graphics().setName('r6:vfx:air').setDepth(DEPTH.fx);
    this.atlasReady = ensureVfxAtlas(scene);
    if (this.atlasReady) {
      for (let i = 0; i < POOL_SIZE; i++) {
        const img = scene.add.image(0, 0, VFX_ATLAS_KEY, 'glow_dot').setVisible(false).setActive(false);
        this.pool.push({
          img, active: false, start: 0, duration: 200,
          x0: 0, y0: 0, vx: 0, vy: 0, gravity: 0, scale0: 1, scale1: 1, rot0: 0, rotSpeed: 0, alpha0: 1,
        });
      }
    }
    const off = bridge.controller.onEvents(events => {
      if (!scene.sys.isActive()) return;
      for (const e of events) {
        if (e.type === 'areaImpact') this.impact(e);
      }
    });
    scene.events.once('shutdown', () => { off(); this.destroyPool(); });
    scene.events.once('destroy', () => { off(); this.destroyPool(); });
  }

  private destroyPool() {
    for (const p of this.pool) p.img.destroy();
    this.pool.length = 0;
    this.activeParticles = 0;
  }

  strike(e: Strike, lift: number, enemyLift: (id: number) => number, mountX: number) {
    const { controller } = this.c.bridge;
    const first = e.targets[0];
    if (!first) return;
    const tower = controller.state.towers.find(t => t.id === e.towerId);
    const from = fieldPosition(this.c, e.fromX, e.fromY);
    const muzzle = { x: from.x + mountX, y: from.y - CELL_PX * .32 - lift };
    const toBody = (target: Strike['targets'][number]) => {
      const p = fieldPosition(this.c, target.x, target.y);
      return { x: p.x, y: p.y - 12 - enemyLift(target.enemyId) };
    };
    const type: string = e.towerType;
    switch (type) {
      case 'rail': {
        const target = toBody(first);
        const final = toBody(e.targets.at(-1)!);
        const emitted = tower && this.railVolleys.get(tower.id) === tower.attacks;
        if (tower) this.railVolleys.set(tower.id, tower.attacks);
        if (!emitted) {
          this.rail(muzzle, target, final, railLanes(tower?.level ?? 1));
          this.spawnParticle('muzzle_cross', muzzle.x, muzzle.y, color.silver, 0.34, 0.14, 110, 0, 0, 0, Math.atan2(final.y - muzzle.y, final.x - muzzle.x), 0, true);
        }
        break;
      }
      case 'cryo': {
        const range = tower ? towerStats(controller.ctx.balance, tower.type, tower.level, tower.form).range : 2000;
        this.cryo(from, toWorld(range));
        for (const t of e.targets.slice(0, 4)) {
          const p = toBody(t);
          this.spawnParticle('frost_hex', p.x, p.y - 6, color.teal, 0.28, 0.42, 320, 0, 14, 0, t.enemyId * 0.7, 2.2, true);
        }
        break;
      }
      case 'prism':
        this.prism([muzzle, ...e.targets.slice(0, 5).map(toBody)]);
        this.spawnParticle('glow_dot', muzzle.x, muzzle.y, color.amber, 0.36, 0.16, 150, 0, 0, 0, 0, 0, true);
        break;
      case 'bastion': {
        const target = fieldPosition(this.c, first.x, first.y);
        const links = controller.state.towers.filter(ally =>
          tower && ally !== tower && String(ally.type) !== 'bastion' && auraReaches(controller.ctx.balance, tower, ally));
        this.bastion(from, target, links.map(ally => fieldPosition(this.c, ally.x, ally.y)));
        this.spawnParticle('ring_shock', from.x, from.y, color.teal, 0.24, 0.65, 260, 0, 0, 0, 0, 0, true);
        break;
      }
    }
  }

  onHit(e: Extract<DomainEvent, { type: 'hit' }>, lift: number) {
    if (String(e.towerType) !== 'rail') return;
    const { x, y } = fieldPosition(this.c, e.x, e.y);
    this.fragments({ x, y: y - 12 - lift }, 'rail', e.enemyId);
  }

  onKill(e: Extract<DomainEvent, { type: 'kill' }>) {
    const { x, y } = fieldPosition(this.c, e.x, e.y);
    const at = { x, y: y - 14 };
    const tint = speciesKillTint(e.entityId);
    const boss = e.kind === 'boss';
    this.fragments(at, 'kill', e.enemyId, tint);
    if (boss) {
      this.spawnParticle('ring_shock', at.x, at.y, color.amber, 0.3, 1.35, 360, 0, 0, 0, 0, 0, true);
      this.spawnParticle('smoke_puff', at.x, at.y - 6, color.silver, 0.5, 1.15, 420, 0, -18, 0, 0, 0.5, false);
    }
  }

  sync(s: RunState, alpha: number, liftOf: (id: number) => number) {
    const { scene, bridge } = this.c;
    const now = scene.time.now;
    const reduced = bridge.reducedMotion;
    const quality = bridge.controller.renderQuality.current;
    this.ground.clear();
    this.air.clear();
    this.flight.clear();

    let shapeBudget = vfxGraphicsBudget(quality);
    let kept = 0;
    for (const cue of this.cues) {
      const elapsed = now - cue.start;
      if (elapsed >= cue.duration) continue;
      this.cues[kept++] = cue;
      if (shapeBudget <= 0) continue;
      const before = this.ground.commandBuffer.length + this.air.commandBuffer.length;
      cue.draw(Math.max(0, elapsed), reduced, quality);
      const after = this.ground.commandBuffer.length + this.air.commandBuffer.length;
      shapeBudget -= Math.max(1, Math.round((after - before) / 4));
    }
    this.cues.length = kept;
    for (const id of this.railVolleys.keys()) if (!s.towers.some(t => t.id === id)) this.railVolleys.delete(id);

    this.shellRadii.clear();
    for (const p of s.projectiles) {
      if (p.towerType !== 'mortar') continue;
      this.shellRadii.set(p.id, p.splashRadius);
      if (p.part && p.part !== 'shell') continue;
      const f = Math.max(0, Math.min(1, (s.tick + alpha - p.firedTick) / Math.max(1, p.arrivalTick - p.firedTick)));
      const from = fieldPosition(this.c, p.fromX, p.fromY);
      from.y -= CELL_PX * .32 + liftOf(p.towerId);
      const to = fieldPosition(this.c, p.toX, p.toY);
      const height = reduced ? 0 : CELL_PX * .55;
      const head = shellPoint(from, to, f, height);
      const tail = shellPoint(from, to, Math.max(0, f - .10), height);
      this.flight.lineStyle(2, color.amber, .64).lineBetween(tail.x, tail.y, head.x, head.y)
        .fillStyle(color.amber).fillCircle(head.x, head.y, 3.4);
    }

    this.syncParticles(now, reduced);
  }

  private syncParticles(now: number, reduced: boolean) {
    if (!this.atlasReady || this.pool.length === 0) return;
    let active = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      const age = now - p.start;
      if (age >= p.duration) {
        p.active = false;
        p.img.setVisible(false).setActive(false);
        continue;
      }
      active++;
      const t = Math.max(0, age / p.duration);
      const sec = age / 1000;
      const px = reduced ? p.x0 : p.x0 + p.vx * sec;
      const py = reduced ? p.y0 : p.y0 + p.vy * sec + 0.5 * p.gravity * sec * sec;
      const scale = p.scale0 + (p.scale1 - p.scale0) * (1 - (1 - t) * (1 - t));
      p.img
        .setPosition(px, py)
        .setScale(scale)
        .setRotation(reduced ? p.rot0 : p.rot0 + p.rotSpeed * sec)
        .setAlpha(p.alpha0 * (1 - t));
    }
    this.activeParticles = active;
  }

  private spawnParticle(
    frame: VfxFrame,
    x: number,
    y: number,
    tint: number,
    scale0: number,
    scale1: number,
    duration: number,
    vx: number,
    vy: number,
    gravity: number,
    rot0: number,
    rotSpeed: number,
    additive: boolean,
  ) {
    if (!this.atlasReady) return;
    const { bridge, scene } = this.c;
    const cap = vfxParticleCap(bridge.controller.renderQuality.current, bridge.reducedMotion);
    if (this.activeParticles >= cap) return;
    const slot = this.pool.find(p => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.start = scene.time.now;
    slot.duration = duration;
    slot.x0 = x;
    slot.y0 = y;
    slot.vx = vx;
    slot.vy = vy;
    slot.gravity = gravity;
    slot.scale0 = scale0;
    slot.scale1 = scale1;
    slot.rot0 = rot0;
    slot.rotSpeed = rotSpeed;
    slot.alpha0 = additive ? 0.92 : 0.78;
    // ADD와 NORMAL을 서로 다른 깊이 대역에 두어 WebGL 배칭/블렌드 전환을 프레임당 ≤4회로 유지한다.
    slot.img
      .setTexture(VFX_ATLAS_KEY, frame)
      .setPosition(x, y)
      .setScale(scale0)
      .setRotation(rot0)
      .setTint(tint)
      .setAlpha(slot.alpha0)
      .setBlendMode(additive ? BLEND_ADD : BLEND_NORMAL)
      .setDepth(additive ? DEPTH.fx + 0.2 : DEPTH.overlay + 2.5)
      .setActive(true)
      .setVisible(true);
    this.activeParticles++;
  }

  private impact(e: Impact) {
    const { controller } = this.c.bridge;
    const tower = controller.state.towers.find(t => t.id === e.towerId);
    const milli = this.shellRadii.get(e.projectileId)
      ?? (tower ? towerStats(controller.ctx.balance, tower.type, tower.level, tower.form).splashRadius : 750);
    const at = fieldPosition(this.c, e.x, e.y);
    const radius = toWorld(milli);
    const shell = e.part === 'shell';
    if (shell) {
      const worldR = radius * (this.c.projected ? R6_MAP_SCALE : 1);
      const ringScale = Math.max(0.4, (worldR * 2) / 52);
      this.spawnParticle('ground_crack', at.x, at.y, color.carbon, ringScale * 0.45, ringScale * 0.65, 360, 0, 0, 0, e.projectileId * 0.9, 0, false);
      this.spawnParticle('ring_shock', at.x, at.y, color.amber, 0.25, ringScale, 220, 0, 0, 0, 0, 0, true);
      this.spawnParticle('smoke_puff', at.x, at.y - 4, color.silver, 0.38, 0.85, 320, 0, -24, 0, 0, 0.7, false);
    }
    this.add(shell ? MORTAR_SCORCH_MS : 240, (age, reduced) => {
      if (shell) this.ellipse(this.ground, at, radius * .34, color.carbon, .76 * (1 - age / MORTAR_SCORCH_MS), 0);
      if (age >= 240) return;
      const f = age / 240;
      const reach = reduced ? 1 : .25 + .75 * (1 - (1 - f) ** 2);
      this.ellipse(this.ground, at, radius * reach, color.amber, .92 * (1 - f), 2);
      if (shell) this.ellipse(this.ground, at, radius * reach * .67, color.silver, .74 * (1 - f), 1.3);
    });
  }

  private rail(from: Point, target: Point, final: Point, lanes: number) {
    const dx = target.x - from.x, dy = target.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length, ny = dx / length;
    this.add(105, age => {
      const alpha = 1 - age / 105;
      this.air.lineStyle(2, color.silver, alpha);
      for (let i = 0; i < lanes; i++) {
        const n = (i - (lanes - 1) / 2) * 4;
        this.air.lineBetween(from.x + nx * n, from.y + ny * n, final.x + nx * n, final.y + ny * n);
      }
      this.air.fillStyle(color.teal, alpha).fillCircle(final.x, final.y, 2.8);
    });
  }

  private cryo(from: Point, radius: number) {
    this.add(350, (age, reduced) => {
      const f = age / 350;
      this.ellipse(this.ground, from, radius * (reduced ? 1 : .16 + .84 * (1 - (1 - f) ** 2)), color.teal, .9 * (1 - f), 1.6);
    });
  }

  private prism(points: Point[]) {
    const reduced = this.c.bridge.reducedMotion;
    const duration = 165;
    const end = prismDelay(points.length - 2, reduced) + duration;
    this.add(end, age => {
      for (let i = 1; i < points.length; i++) {
        const elapsed = age - prismDelay(i - 1, reduced);
        if (elapsed < 0 || elapsed >= duration) continue;
        const from = points[i - 1]!, to = points[i]!;
        this.air.lineStyle(2, color.amber, Math.min(1, (duration - elapsed) / 64))
          .lineBetween(from.x, from.y, to.x, to.y);
      }
    });
  }

  private bastion(from: Point, target: Point, allies: Point[]) {
    const squash = this.c.projected ? R6_MAP_SQUASH : 1;
    const dx = target.x - from.x, dy = (target.y - from.y) / squash;
    const heading = Math.atan2(dy, dx);
    const radius = Math.max(20, Math.hypot(dx, dy) + 9);
    this.add(320, (age, reduced) => {
      const alpha = 1 - age / 320;
      const reach = radius * (reduced ? 1 : .4 + .6 * (1 - alpha ** 2));
      const boundary = Array.from({ length: 9 }, (_, i) => {
        const angle = heading + (i - 4) * Math.PI / 24;
        return { x: from.x + reach * Math.cos(angle), y: from.y + reach * squash * Math.sin(angle) };
      });
      this.ground.fillStyle(color.teal, .23 * alpha).beginPath().moveTo(from.x, from.y);
      for (const p of boundary) this.ground.lineTo(p.x, p.y);
      this.ground.closePath().fillPath();
      this.ground.lineStyle(3, color.teal, .96 * alpha).beginPath().moveTo(boundary[0]!.x, boundary[0]!.y);
      for (let i = 1; i < boundary.length; i++) this.ground.lineTo(boundary[i]!.x, boundary[i]!.y);
      this.ground.strokePath();
      this.ground.lineStyle(1, color.teal, .64 * alpha);
      for (const ally of allies) this.ground.lineBetween(from.x, from.y, ally.x, ally.y);
    });
  }

  private fragments(at: Point, kind: 'rail' | 'kill', seed: number, tint = color.silver) {
    const { controller, reducedMotion } = this.c.bridge;
    const count = fragmentCount(kind, controller.renderQuality.current, reducedMotion);
    if (this.atlasReady) {
      const frame: VfxFrame = kind === 'rail' ? 'spark_shard' : 'debris_chunk';
      const dur = kind === 'rail' ? 150 : 280;
      for (let i = 0; i < count; i++) {
        const angle = (i / Math.max(1, count) + seed * 0.618) * TAU;
        const speed = kind === 'rail' ? 42 : 52;
        this.spawnParticle(
          frame, at.x, at.y, i % 2 ? color.silver : kind === 'rail' ? color.amber : tint,
          0.16, 0.08, dur,
          Math.cos(angle) * speed, Math.sin(angle) * speed * 0.72 - (kind === 'kill' ? 16 : 0),
          kind === 'kill' ? 68 : 0, angle, kind === 'kill' ? 5 : 0, kind === 'rail',
        );
      }
      return;
    }
    const rail = kind === 'rail';
    const duration = rail ? 130 : 260;
    this.add(duration, (age, reduced, quality) => {
      const f = age / duration;
      const n = fragmentCount(kind, quality, reduced);
      for (let i = 0; i < n; i++) {
        const angle = (i / (rail ? 4 : 5) + seed * .618) * TAU;
        const spread = 4 + (reduced ? 0 : f * (rail ? 9 : 16));
        const x = at.x + Math.cos(angle) * spread;
        const y = at.y + Math.sin(angle) * spread * .72 + (reduced || rail ? 0 : f * f * 9);
        this.air.fillStyle(i % 2 ? color.silver : rail ? color.amber : tint, .9 * (1 - f))
          .fillTriangle(x - 1.7, y + 1, x + 2, y, x, y - 2.6);
      }
    });
  }

  private ellipse(g: Graphics, at: Point, radius: number, tint: number, alpha: number, stroke: number) {
    const r = radius * (this.c.projected ? R6_MAP_SCALE : 1);
    const h = r * (this.c.projected ? R6_MAP_SQUASH : 1);
    if (stroke) g.lineStyle(stroke, tint, alpha).strokeEllipse(at.x, at.y, r * 2, h * 2, 20);
    else g.fillStyle(tint, alpha).fillEllipse(at.x, at.y, r * 2, h * 2, 16);
  }

  private add(duration: number, draw: Draw) {
    if (this.cues.length >= MAX_CUES) this.cues.shift();
    this.cues.push({ start: this.c.scene.time.now, duration, draw });
  }
}

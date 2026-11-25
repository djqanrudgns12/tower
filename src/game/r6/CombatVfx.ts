import type Phaser from 'phaser';
import type { DomainEvent } from '../../domain/events';
import type { RunState } from '../../domain/types';
import { auraReaches, towerStats } from '../../domain/towers';
import { CELL_PX } from '../assets';
import { DEPTH, fieldPosition, toWorld, type LayerContext } from '../layers/shared';
import { R6_COLORS as color } from './manifest';
import { R6_MAP_SCALE, R6_MAP_SQUASH } from './mapProjection';
import { fragmentCount, MORTAR_SCORCH_MS, prismDelay, railLanes, shellPoint } from './vfxTiming';

type Graphics = Phaser.GameObjects.Graphics;
type Point = { x: number; y: number };
type Strike = Extract<DomainEvent, { type: 'strike' }>;
type Impact = Extract<DomainEvent, { type: 'areaImpact' }>;
type Draw = (age: number, reduced: boolean, quality: number) => void;
interface Cue { start: number; duration: number; draw: Draw }

const MAX_CUES = 96;
const TAU = Math.PI * 2;

/** 공격 결과를 읽어 그린다. 그래픽 세 개를 재사용하고, 밀집 장면의 일시 효과 수에 상한을 둔다. */
export class R6CombatVfx {
  private readonly ground: Graphics;
  private readonly air: Graphics;
  private readonly flight: Graphics;
  private readonly cues: Cue[] = [];
  private readonly railVolleys = new Map<number, number>();
  private readonly shellRadii = new Map<number, number>();

  constructor(private readonly c: LayerContext) {
    const { scene, bridge } = c;
    this.ground = scene.add.graphics().setName('r6:vfx:ground').setDepth(DEPTH.overlay + 2);
    this.flight = scene.add.graphics().setName('r6:vfx:shell').setDepth(DEPTH.projectiles);
    this.air = scene.add.graphics().setName('r6:vfx:air').setDepth(DEPTH.fx);
    const off = bridge.controller.onEvents(events => {
      if (!scene.sys.isActive()) return;
      for (const e of events) {
        if (e.type === 'areaImpact') this.impact(e);
      }
    });
    scene.events.once('shutdown', off);
    scene.events.once('destroy', off);
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
        if (!emitted) this.rail(muzzle, target, final, railLanes(tower?.level ?? 1));
        break;
      }
      case 'cryo': {
        const range = tower ? towerStats(controller.ctx.balance, tower.type, tower.level, tower.form).range : 2000;
        this.cryo(from, toWorld(range));
        break;
      }
      case 'prism':
        this.prism([muzzle, ...e.targets.slice(0, 5).map(toBody)]);
        break;
      case 'bastion': {
        const target = fieldPosition(this.c, first.x, first.y);
        const links = controller.state.towers.filter(ally =>
          tower && ally !== tower && String(ally.type) !== 'bastion' && auraReaches(controller.ctx.balance, tower, ally));
        this.bastion(from, target, links.map(ally => fieldPosition(this.c, ally.x, ally.y)));
        break;
      }
      // 격납고는 스프라이트를 관리하는 TowerLayer에서 비행과 연사를 그린다.
    }
  }

  onHit(e: Extract<DomainEvent, { type: 'hit' }>, lift: number) {
    if (String(e.towerType) !== 'rail') return;
    const { x, y } = fieldPosition(this.c, e.x, e.y);
    this.fragments({ x, y: y - 12 - lift }, 'rail', e.enemyId);
  }

  onKill(e: Extract<DomainEvent, { type: 'kill' }>) {
    const { x, y } = fieldPosition(this.c, e.x, e.y);
    this.fragments({ x, y: y - 14 }, 'kill', e.enemyId);
  }

  sync(s: RunState, alpha: number, liftOf: (id: number) => number) {
    const { scene, bridge } = this.c;
    const now = scene.time.now;
    const reduced = bridge.reducedMotion;
    const quality = bridge.controller.renderQuality.current;
    this.ground.clear();
    this.air.clear();
    this.flight.clear();
    let kept = 0;
    for (const cue of this.cues) {
      const elapsed = now - cue.start;
      if (elapsed >= cue.duration) continue;
      this.cues[kept++] = cue;
      cue.draw(Math.max(0, elapsed), reduced, quality);
    }
    this.cues.length = kept;
    for (const id of this.railVolleys.keys()) if (!s.towers.some(t => t.id === id)) this.railVolleys.delete(id);

    this.shellRadii.clear();
    for (const p of s.projectiles) {
      if (p.towerType !== 'mortar') continue;
      this.shellRadii.set(p.id, p.splashRadius);
      // 추가 타격은 같은 자리에 예약된다. 날아가는 포탄은 첫 발뿐이다.
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
  }

  private impact(e: Impact) {
    const { controller } = this.c.bridge;
    const tower = controller.state.towers.find(t => t.id === e.towerId);
    const milli = this.shellRadii.get(e.projectileId)
      ?? (tower ? towerStats(controller.ctx.balance, tower.type, tower.level, tower.form).splashRadius : 750);
    const at = fieldPosition(this.c, e.x, e.y);
    const radius = toWorld(milli);
    const shell = e.part === 'shell';
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

  private fragments(at: Point, kind: 'rail' | 'kill', seed: number) {
    const rail = kind === 'rail';
    const duration = rail ? 130 : 260;
    this.add(duration, (age, reduced, quality) => {
      const f = age / duration;
      const count = fragmentCount(kind, quality, reduced);
      for (let i = 0; i < count; i++) {
        const angle = (i / (rail ? 4 : 5) + seed * .618) * TAU;
        const spread = 4 + (reduced ? 0 : f * (rail ? 9 : 16));
        const x = at.x + Math.cos(angle) * spread;
        const y = at.y + Math.sin(angle) * spread * .72 + (reduced || rail ? 0 : f * f * 9);
        this.air.fillStyle(i % 2 ? color.silver : rail ? color.amber : color.line, .9 * (1 - f))
          .fillTriangle(x - 1.7, y + 1, x + 2, y, x, y - 2.6);
      }
    });
  }

  private ellipse(g: Graphics, at: Point, radius: number, tint: number, alpha: number, stroke: number) {
    const r = radius * (this.c.projected ? R6_MAP_SCALE : 1);
    const h = r * (this.c.projected ? R6_MAP_SQUASH : 1);
    if (stroke) g.lineStyle(stroke, tint, alpha).strokeEllipse(at.x, at.y, r * 2, h * 2, 32);
    else g.fillStyle(tint, alpha).fillEllipse(at.x, at.y, r * 2, h * 2, 16);
  }

  private add(duration: number, draw: Draw) {
    if (this.cues.length >= MAX_CUES) this.cues.shift();
    this.cues.push({ start: this.c.scene.time.now, duration, draw });
  }
}

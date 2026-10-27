import Phaser from 'phaser';
import { assetManifestSchema } from '../contracts/assetManifest';
import type { TowerId } from '../contracts/balance';
import { DEFAULTS } from '../content';
import type { DomainEvent } from '../domain/events';
import { positionAt } from '../domain/geometry';
import { towerStats } from '../domain/towers';
import type { Enemy, RunState } from '../domain/types';
import { enemyPose } from './animation/pose';
import { drawGround, drawSprites, isTreeCell, PALETTE } from './art';
import { applyManifest, ASSETS, CELL_PX, TEX, WORLD_H, WORLD_W } from './assets';
import type { FieldBridge } from './bridge';

const toWorld = (milli: number) => (milli * CELL_PX) / 1000;
const DEPTH = { ground: 0, mood: 1, overlay: 5, units: 10, projectiles: 2000, fx: 2100, ui: 3000 };

interface EnemyView { sprite: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Image | null; prev: number; cur: number; phase: number; flashUntil: number; facing: 1 | -1 }
interface TowerView { body: Phaser.GameObjects.Image; weapon: Phaser.GameObjects.Image; pips: Phaser.GameObjects.Graphics; level: number; branch: string | null; recoilUntil: number; angle: number }

/** 전장 렌더러. 도메인 상태를 읽기만 하고 판정·보상을 만들지 않는다(PRD §11.4, §13.2). */
export class BattleScene extends Phaser.Scene {
  private bridge!: FieldBridge;
  private enemies = new Map<number, EnemyView>();
  private towers = new Map<number, TowerView>();
  private shots = new Map<number, Phaser.GameObjects.Image>();
  private overlay!: Phaser.GameObjects.Graphics;
  private hpBars!: Phaser.GameObjects.Graphics;
  private mood!: Phaser.GameObjects.Rectangle;
  private miniCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private miniFrame!: Phaser.GameObjects.Graphics;
  private lastTick = -1;
  private overlayKey = '';
  private moodWave = -1;
  private down: { x: number; y: number } | null = null;
  private offEvents: (() => void) | null = null;
  private cssCell = 0;

  constructor() { super('battle'); }

  init(data: { bridge: FieldBridge }) { this.bridge = data.bridge; }

  /** 인수된 원화(public/assets/manifest.json의 integrated_pass)가 있으면 같은 ID로 먼저 싣는다. 없으면 임시 그림. */
  preload() {
    this.load.json('asset-manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-asset-manifest', (_key: string, _type: string, data: unknown) => {
      const parsed = assetManifestSchema.safeParse(data);
      if (!parsed.success) return;
      for (const a of applyManifest(parsed.data)) this.load.image(a.id, `assets/${a.file}`);
    });
    this.load.on('loaderror', () => undefined);
  }

  create() {
    const map = this.bridge.controller.ctx.map;
    // 인수된 성문·나무·비석 원화가 있으면 지면에 굽지 않고 이미지로 세운다.
    const has = { gate: this.textures.exists('map.gate'), tree: this.textures.exists('deco.tree'), stele: this.textures.exists('deco.stele') };
    if (!this.textures.exists(ASSETS.ground.key)) drawGround(this, map, has);
    drawSprites(this);
    const icons: Record<string, string> = {};
    for (const key of ['tower.archer', 'tower.archer.weapon', 'tower.cannon', 'tower.cannon.weapon', 'tower.frost', 'tower.frost.weapon']) icons[key] = this.textures.getBase64(key);
    this.bridge.onIcons?.(icons);
    this.add.image(0, 0, ASSETS.ground.key).setOrigin(0).setScale(1 / TEX).setDepth(DEPTH.ground);
    for (const d of map.decorations) {
      const [dx, dy] = d.cells[0]!;
      const key = d.kind === 'culture' ? 'deco.stele' : 'deco.tree';
      if ((d.kind === 'culture' ? has.stele : has.tree) && (d.kind === 'culture' || isTreeCell(dx, dy))) this.placeDecor(key, dx, dy);
    }
    if (has.gate) this.placeDecor('map.gate', map.exitCell[0], map.exitCell[1]);
    for (const d of map.decorations) if (d.kind === 'culture') {
      const [x, y] = d.cells[0]!;
      this.add.text((x + 0.5) * CELL_PX, (y + 0.42) * CELL_PX, '가', { fontFamily: 'Pretendard Variable, Pretendard, sans-serif', fontSize: '20px', fontStyle: '700', color: '#5c5650', resolution: 2 }).setOrigin(0.5).setDepth(DEPTH.overlay);
    }
    this.mood = this.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff, 0).setOrigin(0).setDepth(DEPTH.mood);
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.hpBars = this.add.graphics().setDepth(DEPTH.ui);
    this.miniFrame = this.add.graphics().setDepth(DEPTH.ui + 1);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(false);
    this.cameras.main.ignore(this.miniFrame);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.down = { x: p.x, y: p.y }; });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.offEvents = this.bridge.controller.onEvents(this.onEvents);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offEvents?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.offEvents?.());
    this.layout();
    this.applyMood(true);
  }

  private placeDecor(key: string, x: number, y: number) {
    const img = this.add.image((x + 0.5) * CELL_PX, (y + 0.5) * CELL_PX, key);
    const src = img.texture.getSourceImage() as { width: number; height: number };
    const cells = key === 'map.gate' ? 1.8 : 1.05;
    img.setOrigin(0.5, key === 'map.gate' ? 0.75 : 0.85).setDisplaySize(CELL_PX * cells, (CELL_PX * cells * src.height) / src.width).setDepth(DEPTH.units + (y + 0.5) * CELL_PX);
  }

  /** 캔버스 크기가 바뀌면 React 쪽에서 호출한다. */
  layout() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setViewport(0, 0, w, h);
    const fit = Math.min(w / WORLD_W, h / WORLD_H);
    this.cssCell = (fit * CELL_PX) / Math.max(1, window.devicePixelRatio || 1);
    const sel = this.selectedCell();
    if (this.bridge.magnify && sel) {
      const factor = Math.max(1, 48 / Math.max(1, this.cssCell));
      cam.setZoom(fit * factor);
      cam.centerOn((sel.x + 0.5) * CELL_PX, (sel.y + 0.5) * CELL_PX);
      this.showMini(w);
    } else {
      cam.setZoom(fit);
      cam.centerOn(WORLD_W / 2, WORLD_H / 2);
      this.hideMini();
    }
  }

  private showMini(canvasW: number) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const mw = Math.round(90 * dpr), mh = Math.round(54 * dpr), pad = Math.round(6 * dpr);
    if (!this.miniCam) {
      this.miniCam = this.cameras.add(canvasW - mw - pad, pad, mw, mh).setBounds(0, 0, WORLD_W, WORLD_H);
      this.miniCam.setBackgroundColor('rgba(58,41,30,0.85)');
      this.miniCam.ignore([this.hpBars]);
    }
    this.miniCam.setViewport(canvasW - mw - pad, pad, mw, mh).setZoom(mw / WORLD_W).centerOn(WORLD_W / 2, WORLD_H / 2);
    this.miniCam.setVisible(true);
  }

  private hideMini() { this.miniCam?.setVisible(false); this.miniFrame.clear(); }

  private selectedCell() {
    const sel = this.bridge.selection;
    const slotId = sel.slotId ?? this.bridge.controller.state.towers.find(t => t.id === sel.towerId)?.slotId ?? null;
    return slotId ? this.bridge.controller.ctx.map.slots.find(s => s.id === slotId) ?? null : null;
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    const down = this.down;
    this.down = null;
    if (!down || Math.hypot(p.x - down.x, p.y - down.y) > 14 * (window.devicePixelRatio || 1)) return;
    // 미니맵은 위치 안내용이다. 미니맵 위 탭은 무시한다(PRD §12.4).
    if (this.miniCam?.visible && p.x >= this.miniCam.x && p.y <= this.miniCam.y + this.miniCam.height) return;
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const x = Math.floor(world.x / CELL_PX), y = Math.floor(world.y / CELL_PX);
    const state = this.bridge.controller.state;
    const slot = this.bridge.controller.ctx.map.slots.find(s => s.x === x && s.y === y);
    if (!slot) { this.bridge.onTap({ kind: 'empty' }); return; }
    const tower = state.towers.find(t => t.slotId === slot.id);
    this.bridge.onTap(tower ? { kind: 'tower', towerId: tower.id, slotId: slot.id } : { kind: 'slot', slotId: slot.id });
  }

  private onEvents = (events: DomainEvent[]) => {
    if (!this.sys.isActive()) return;
    for (const e of events) {
      if (e.type === 'hit') {
        const v = this.enemies.get(e.enemyId);
        if (v) v.flashUntil = this.time.now + 100;
        this.fx(e.towerType === 'cannon' ? ASSETS.projectile.puff : e.towerType === 'frost' ? ASSETS.projectile.shard : ASSETS.projectile.spark, toWorld(e.x), toWorld(e.y) - 14, e.towerType === 'cannon' ? 0.9 : 0.55);
      } else if (e.type === 'kill') {
        for (let i = 0; i < 3; i++) this.fx(ASSETS.projectile.puff, toWorld(e.x) + (i - 1) * 9, toWorld(e.y) - 10 - (i % 2) * 6, 0.6);
      } else if (e.type === 'fire') {
        const t = this.towers.get(e.towerId);
        const shot = this.bridge.controller.state.projectiles.find(p => p.id === e.projectileId);
        if (t && shot) { t.angle = Math.atan2(shot.toY - shot.fromY, shot.toX - shot.fromX); t.recoilUntil = this.time.now + 120; }
      } else if (e.type === 'leak') {
        const [gx, gy] = this.bridge.controller.ctx.map.exitCell;
        const flash = this.add.rectangle((gx + 0.5) * CELL_PX, (gy + 0.5) * CELL_PX, CELL_PX * 1.3, CELL_PX * 1.3, 0xa3352b, 0.35).setDepth(DEPTH.fx);
        this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
      } else if (e.type === 'phase' && e.phase === 'PREP_QUIZ') this.applyMood(false);
    }
  };

  private fx(key: string, x: number, y: number, scale: number) {
    if (this.bridge.reducedMotion && key === ASSETS.projectile.puff) return;
    const img = this.add.image(x, y, key).setDepth(DEPTH.fx).setScale(scale * 0.5).setAlpha(0.95);
    this.tweens.add({ targets: img, scale: scale, alpha: 0, duration: this.bridge.reducedMotion ? 80 : 180, onComplete: () => img.destroy() });
  }

  /** 웨이브 무드: 지면 위 약한 색층만 바꾼다(PRD §11.5). */
  private applyMood(immediate: boolean) {
    const wave = Math.max(1, this.bridge.controller.state.wave);
    if (wave === this.moodWave) return;
    this.moodWave = wave;
    const entry = DEFAULTS.mood.entries[(wave - 1) % 5]!;
    const color = entry.tint ? Number.parseInt(entry.tint.slice(1), 16) : 0xffffff;
    this.tweens.killTweensOf(this.mood);
    if (immediate || this.bridge.reducedMotion) { this.mood.setFillStyle(color, entry.alpha); return; }
    this.tweens.add({ targets: this.mood, fillAlpha: 0, duration: 300, onComplete: () => { this.mood.setFillStyle(color, 0); this.tweens.add({ targets: this.mood, fillAlpha: entry.alpha, duration: 300 }); } });
  }

  override update(time: number) {
    const s = this.bridge.controller.state;
    const alpha = this.bridge.controller.alpha;
    if (s.tick !== this.lastTick) {
      for (const [id, v] of this.enemies) {
        const e = s.enemies.find(x => x.id === id);
        if (e) { v.prev = v.cur; v.cur = e.progress; }
      }
      this.lastTick = s.tick;
    }
    this.syncTowers(s, time);
    this.syncEnemies(s, time, alpha);
    this.syncShots(s, alpha);
    this.drawOverlay(s);
    if (this.miniCam?.visible) {
      const v = this.cameras.main.worldView;
      this.miniFrame.clear().lineStyle(6, 0xf5ebd4, 1).strokeRect(v.x, v.y, v.width, v.height);
    }
  }

  private syncTowers(s: RunState, time: number) {
    const seen = new Set<number>();
    for (const t of s.towers) {
      seen.add(t.id);
      let v = this.towers.get(t.id);
      const x = toWorld(t.x), y = toWorld(t.y);
      if (!v) {
        const spec = ASSETS.towers[t.type]!;
        const body = this.add.image(x, y + CELL_PX * 0.32, spec.key).setOrigin(spec.originX, spec.originY).setDisplaySize(CELL_PX * spec.displayCells, CELL_PX * spec.displayCells * (spec.height / spec.width));
        const wspec = ASSETS.weapons[t.type]!;
        const weapon = this.add.image(x, y - CELL_PX * 0.32, wspec.key).setDisplaySize(CELL_PX * wspec.displayCells, CELL_PX * wspec.displayCells);
        const pips = this.add.graphics();
        v = { body, weapon, pips, level: 0, branch: null, recoilUntil: 0, angle: t.type === 'frost' ? 0 : -Math.PI / 2 };
        this.towers.set(t.id, v);
        if (!this.bridge.reducedMotion) { body.setScale(body.scaleX * 0.96, body.scaleY * 0.96); this.tweens.add({ targets: body, scaleX: body.scaleX / 0.96, scaleY: body.scaleY / 0.96, duration: 120 }); }
      }
      const depth = DEPTH.units + y;
      v.body.setDepth(depth);
      v.weapon.setDepth(depth + 1);
      v.pips.setDepth(depth + 2);
      const recoil = time < v.recoilUntil && !this.bridge.reducedMotion ? 2 : 0;
      if (t.type === 'frost') v.weapon.setPosition(x, y - CELL_PX * 0.38 + (this.bridge.reducedMotion ? 0 : Math.sin(time / 420 + t.id) * 2));
      else v.weapon.setPosition(x - Math.cos(v.angle) * recoil, y - CELL_PX * 0.32 - Math.sin(v.angle) * recoil).setRotation(v.angle);
      if (v.level !== t.level || v.branch !== t.branch) {
        v.level = t.level; v.branch = t.branch;
        v.pips.clear();
        const startX = x - (t.level - 1) * 5;
        for (let i = 0; i < t.level; i++) { v.pips.fillStyle(PALETTE.outline, 1).fillCircle(startX + i * 10, y + CELL_PX * 0.36, 4.2); v.pips.fillStyle(0xf4d35e, 1).fillCircle(startX + i * 10, y + CELL_PX * 0.36, 2.8); }
        if (t.branch) {
          // 분기 표식: A 원, B 마름모. 색만으로 구분하지 않는다.
          const bx = x + CELL_PX * 0.34, by = y - CELL_PX * 0.36;
          v.pips.fillStyle(PALETTE.outline, 1);
          if (t.branch === 'A') v.pips.fillCircle(bx, by, 8).fillStyle(0x245b88, 1).fillCircle(bx, by, 5.5);
          else v.pips.fillPoints([new Phaser.Math.Vector2(bx, by - 9), new Phaser.Math.Vector2(bx + 9, by), new Phaser.Math.Vector2(bx, by + 9), new Phaser.Math.Vector2(bx - 9, by)], true).fillStyle(0xa3352b, 1).fillPoints([new Phaser.Math.Vector2(bx, by - 6), new Phaser.Math.Vector2(bx + 6, by), new Phaser.Math.Vector2(bx, by + 6), new Phaser.Math.Vector2(bx - 6, by)], true);
        }
      }
    }
    for (const [id, v] of this.towers) if (!seen.has(id)) { v.body.destroy(); v.weapon.destroy(); v.pips.destroy(); this.towers.delete(id); }
  }

  private syncEnemies(s: RunState, time: number, alpha: number) {
    const path = this.bridge.controller.ctx.path;
    const seen = new Set<number>();
    this.hpBars.clear();
    for (const e of s.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        const spec = ASSETS.enemy(e.kind, 0);
        const sprite = this.add.image(0, 0, spec.key).setOrigin(spec.originX, spec.originY).setDisplaySize(CELL_PX * spec.displayCells, CELL_PX * spec.displayCells);
        const badge = e.elite ? this.add.image(0, 0, ASSETS.badge[e.elite]).setDisplaySize(14, 16) : null;
        // 개체마다 보행 위상을 다르게 둔다(PRD §11.3).
        v = { sprite, badge, prev: e.progress, cur: e.progress, phase: (e.id * 0.618034) % 1, flashUntil: 0, facing: 1 };
        this.enemies.set(e.id, v);
      }
      const progress = v.prev + (v.cur - v.prev) * alpha;
      const p = positionAt(path, progress);
      const ahead = positionAt(path, Math.min(path.length, progress + 200));
      if (ahead.x !== p.x) v.facing = ahead.x > p.x ? 1 : -1;
      const x = toWorld(p.x), y = toWorld(p.y);
      const moving = v.cur !== v.prev && s.pause.length === 0;
      const pose = enemyPose({ kind: e.kind, phase: v.phase, time: time / 1000, speedBP: e.speedBP, moving, frames: this.frameCount(e.kind), reducedMotion: this.bridge.reducedMotion });
      const spec = ASSETS.enemy(e.kind, 0);
      v.sprite.setTexture(`enemy.${e.kind}.${pose.frame}`).setPosition(x, y + CELL_PX * 0.14 - pose.bob).setFlipX(v.facing < 0).setDepth(DEPTH.units + y + 0.5)
        .setDisplaySize(CELL_PX * spec.displayCells, CELL_PX * spec.displayCells * pose.squashY);
      this.tint(v, e, time);
      if (v.badge) v.badge.setPosition(x, y - CELL_PX * (e.kind === 'boss' ? 0.86 : 0.5)).setDepth(DEPTH.units + y + 0.6);
      if (e.hp < e.maxHp) {
        const w = e.kind === 'boss' ? 44 : 28, bx = x - w / 2, by = y - CELL_PX * (e.kind === 'boss' ? 0.78 : 0.44);
        this.hpBars.fillStyle(PALETTE.outline, 0.9).fillRect(bx - 1, by - 1, w + 2, 6).fillStyle(0xd94f3d, 1).fillRect(bx, by, Math.max(1, (w * e.hp) / e.maxHp), 4);
      }
    }
    for (const [id, v] of this.enemies) if (!seen.has(id)) { v.sprite.destroy(); v.badge?.destroy(); this.enemies.delete(id); }
  }

  private frames = new Map<string, number>();
  /** 인수된 원화가 프레임을 더 납품하면(enemy.walker.2, .3 …) 그만큼 쓴다. */
  private frameCount(kind: string): number {
    let n = this.frames.get(kind);
    if (n === undefined) { n = 1; while (n < 8 && this.textures.exists(`enemy.${kind}.${n}`)) n++; this.frames.set(kind, n); }
    return n;
  }

  private tint(v: EnemyView, e: Enemy, time: number) {
    if (time < v.flashUntil) { v.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); return; }
    v.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    if (e.slows.some(x => x.untilTick > this.bridge.controller.state.tick)) v.sprite.setTint(0xb9e2ff);
    else v.sprite.clearTint();
  }

  private syncShots(s: RunState, alpha: number) {
    const seen = new Set<number>();
    const path = this.bridge.controller.ctx.path;
    for (const p of s.projectiles) {
      seen.add(p.id);
      let img = this.shots.get(p.id);
      if (!img) {
        const key = p.towerType === 'cannon' ? ASSETS.projectile.ball : p.towerType === 'frost' ? ASSETS.projectile.shard : ASSETS.projectile.arrow;
        img = this.add.image(0, 0, key).setDepth(DEPTH.projectiles).setScale(p.towerType === 'archer' ? 0.5 : 0.6);
        this.shots.set(p.id, img);
      }
      const f = Phaser.Math.Clamp((s.tick + alpha - p.firedTick) / Math.max(1, p.arrivalTick - p.firedTick), 0, 1);
      // 단일 대상은 대상의 현재 위치를 향해 그리지만 도착 틱은 바꾸지 않는다(PRD §20.3).
      const target = p.targetId !== null ? s.enemies.find(e => e.id === p.targetId) : null;
      const to = target ? positionAt(path, this.enemies.get(target.id) ? this.enemies.get(target.id)!.prev + (this.enemies.get(target.id)!.cur - this.enemies.get(target.id)!.prev) * alpha : target.progress) : { x: p.toX, y: p.toY };
      const fx = toWorld(p.fromX), fy = toWorld(p.fromY) - CELL_PX * 0.32, tx = toWorld(to.x), ty = toWorld(to.y) - CELL_PX * 0.08;
      const arc = p.towerType === 'cannon' ? Math.sin(f * Math.PI) * CELL_PX * 0.55 : 0;
      img.setPosition(fx + (tx - fx) * f, fy + (ty - fy) * f - arc);
      if (p.towerType === 'archer') img.setRotation(Math.atan2(ty - fy, tx - fx));
    }
    for (const [id, img] of this.shots) if (!seen.has(id)) { img.destroy(); this.shots.delete(id); }
  }

  /** 선택 칸·사거리 원·원 안의 길. 선택이 바뀔 때만 다시 그린다(PRD §12.4). */
  private drawOverlay(s: RunState) {
    const sel = this.bridge.selection;
    const tower = sel.towerId !== null ? s.towers.find(t => t.id === sel.towerId) ?? null : null;
    const key = `${sel.slotId}|${sel.towerId}|${sel.previewType}|${sel.previewBranch}|${tower?.level}|${tower?.branch}|${s.phase}|${s.towers.length}|${this.bridge.magnify}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const g = this.overlay.clear();
    const map = this.bridge.controller.ctx.map;
    const b = this.bridge.controller.ctx.balance;
    const trading = s.phase === 'BUILD' || s.phase === 'BATTLE';
    if (trading && sel.previewType && !sel.slotId) {
      for (const slot of map.slots) if (!s.towers.some(t => t.slotId === slot.id)) g.lineStyle(3, 0xf5ebd4, 0.9).strokeRoundedRect(slot.x * CELL_PX + 5, slot.y * CELL_PX + 5, CELL_PX - 10, CELL_PX - 10, 8);
    }
    const cell = this.selectedCell();
    if (cell) {
      let range = 0;
      const type: TowerId | null = tower?.type ?? sel.previewType;
      if (type) range = toWorld(towerStats(b, type, tower ? (sel.previewBranch && tower.level === 2 ? 3 : tower.level) : 1, tower ? (sel.previewBranch ?? tower.branch) : null).range);
      const cx = (cell.x + 0.5) * CELL_PX, cy = (cell.y + 0.5) * CELL_PX;
      if (range > 0) {
        g.fillStyle(0xf5ebd4, 0.16).fillCircle(cx, cy, range).lineStyle(2.5, 0xf5ebd4, 0.95).strokeCircle(cx, cy, range);
        for (const [x, y] of map.pathCells) {
          const px = (x + 0.5) * CELL_PX, py = (y + 0.5) * CELL_PX;
          if ((px - cx) ** 2 + (py - cy) ** 2 <= range * range) g.fillStyle(0xfff6d8, 0.42).fillRoundedRect(px - CELL_PX * 0.3, py - CELL_PX * 0.3, CELL_PX * 0.6, CELL_PX * 0.6, 8);
        }
      }
      g.lineStyle(4, PALETTE.outline, 1).strokeRoundedRect(cell.x * CELL_PX + 2, cell.y * CELL_PX + 2, CELL_PX - 4, CELL_PX - 4, 10);
      g.lineStyle(3, 0xf4d35e, 1).strokeRoundedRect(cell.x * CELL_PX + 3, cell.y * CELL_PX + 3, CELL_PX - 6, CELL_PX - 6, 9);
    }
  }
}


import Phaser from 'phaser';
import { positionAt } from '../../domain/geometry';
import { enemyArtId } from '../../domain/factions';
import type { Enemy, RunState } from '../../domain/types';
import { acceptsHit, enemyPose, HIT_MS } from '../animation/pose';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, enemyArt, type EnemyArt } from '../assets';
import { DEPTH, toWorld, type LayerContext } from './shared';

interface EnemyView { sprite: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Image | null; art: EnemyArt; prev: number; cur: number; phase: number; flashUntil: number; hitAt: number | null; facing: 1 | -1 }

/** 적 층: 종족×역할 그림, 길 위 보간 위치, 걸음 자세, 피격 점멸·둔화 색, 정예 배지, 체력 막대. */
export class EnemyLayer {
  private readonly c: LayerContext;
  private enemies = new Map<number, EnemyView>();
  /** 그림 id·종류별로 고른 그림. 텍스처는 장면을 만든 뒤 바뀌지 않는다. */
  private arts = new Map<string, EnemyArt>();
  private lastTick = -1;
  /** 체력 막대. 미니맵 카메라에서는 감춘다. */
  readonly hpBars: Phaser.GameObjects.Graphics;

  constructor(c: LayerContext) {
    this.c = c;
    this.hpBars = c.scene.add.graphics().setDepth(DEPTH.ui);
  }

  /** 새 틱이 오면 보간 구간을 한 칸 민다. */
  advance(s: RunState) {
    if (s.tick === this.lastTick) return;
    for (const [id, v] of this.enemies) {
      const e = s.enemies.find(x => x.id === id);
      if (e) { v.prev = v.cur; v.cur = e.progress; }
    }
    this.lastTick = s.tick;
  }

  /** 같은 적의 피격 효과는 120ms 안에 다시 시작하지 않는다(PRD §11.4). */
  onHit(enemyId: number) {
    const v = this.enemies.get(enemyId);
    const now = this.c.scene.time.now;
    if (v && acceptsHit(v.hitAt, now)) { v.hitAt = now; v.flashUntil = now + HIT_MS; }
  }

  /** 지금 그려진 적 그림의 위치(화상 연기 등). 없으면 null. */
  spriteAt(enemyId: number): { x: number; y: number } | null {
    const v = this.enemies.get(enemyId);
    return v ? { x: v.sprite.x, y: v.sprite.y } : null;
  }

  /** 보간된 진행 거리. 아직 그리지 않은 적이면 null. */
  progressOf(enemyId: number, alpha: number): number | null {
    const v = this.enemies.get(enemyId);
    return v ? v.prev + (v.cur - v.prev) * alpha : null;
  }

  sync(s: RunState, time: number, alpha: number) {
    const { scene, bridge } = this.c;
    const path = bridge.controller.ctx.path;
    const seen = new Set<number>();
    this.hpBars.clear();
    for (const e of s.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        const art = this.artOf(e);
        const sprite = scene.add.image(0, 0, art.framed ? `${art.base}.0` : art.base).setOrigin(art.originX, art.originY).setDisplaySize(CELL_PX * art.displayCells, CELL_PX * art.displayCells);
        const badge = e.elite ? scene.add.image(0, 0, ASSETS.badge[e.elite]).setDisplaySize(14, 16) : null;
        // 개체마다 보행 위상을 다르게 둔다(PRD §11.3).
        v = { sprite, badge, art, prev: e.progress, cur: e.progress, phase: (e.id * 0.618034) % 1, flashUntil: 0, hitAt: null, facing: 1 };
        this.enemies.set(e.id, v);
      }
      const progress = v.prev + (v.cur - v.prev) * alpha;
      const p = positionAt(path, progress);
      const ahead = positionAt(path, Math.min(path.length, progress + 200));
      if (ahead.x !== p.x) v.facing = ahead.x > p.x ? 1 : -1;
      const x = toWorld(p.x), y = toWorld(p.y);
      const moving = v.cur !== v.prev && s.pause.length === 0;
      // 걸음은 보간된 진행 거리로 맞춰 감속·맵 길이와 상관없이 발이 미끄러지지 않게 한다(RIG-001).
      // 한 장짜리 종족 그림은 frames 1이라 pose가 디딤 눌림·떠오름으로 걸음을 보여 준다.
      const { art } = v;
      const pose = enemyPose({ kind: e.kind, phase: v.phase, time: time / 1000, speedBP: e.speedBP, moving, frames: art.frames, reducedMotion: bridge.reducedMotion,
        distance: toWorld(progress), ...(v.hitAt === null ? {} : { hitAge: (time - v.hitAt) / 1000 }) });
      const hitKey = `${art.base}.hit`;
      const hitArt = pose.hit && scene.textures.exists(hitKey);
      v.sprite.setTexture(hitArt ? hitKey : art.framed ? `${art.base}.${pose.frame}` : art.base).setPosition(x, y + CELL_PX * 0.14 - pose.bob).setFlipX(v.facing < 0).setDepth(DEPTH.units + y + 0.5)
        .setDisplaySize(CELL_PX * art.displayCells, CELL_PX * art.displayCells * pose.squashY);
      this.tint(v, e, time, hitArt);
      if (v.badge) v.badge.setPosition(x, y - CELL_PX * (e.kind === 'boss' ? 0.86 : 0.5)).setDepth(DEPTH.units + y + 0.6);
      if (e.hp < e.maxHp) {
        const w = e.kind === 'boss' ? 44 : 28, bx = x - w / 2, by = y - CELL_PX * (e.kind === 'boss' ? 0.78 : 0.44);
        this.hpBars.fillStyle(PALETTE.outline, 0.9).fillRect(bx - 1, by - 1, w + 2, 6).fillStyle(0xd94f3d, 1).fillRect(bx, by, Math.max(1, (w * e.hp) / e.maxHp), 4);
      }
    }
    for (const [id, v] of this.enemies) if (!seen.has(id)) { v.sprite.destroy(); v.badge?.destroy(); this.enemies.delete(id); }
  }

  /** 종족 그림 id → 기존 enemy.<kind>.<n>(프레임을 더 납품하면 그만큼) → 임시 대역 순으로 고른다(assets.ts enemyArt). */
  private artOf(e: Enemy): EnemyArt {
    // 종족 표에 없는 적(종족 이전 저장 등)은 그 종류의 기존 그림으로 둔다.
    const b = this.c.bridge.controller.ctx.balance;
    const id = b.factions[e.faction] ? enemyArtId(b, e) : `enemy.${e.kind}`;
    const key = `${id}|${e.kind}`;
    let art = this.arts.get(key);
    if (!art) { art = enemyArt(id, e.kind, k => this.c.scene.textures.exists(k)); this.arts.set(key, art); }
    return art;
  }

  /** 피격 원화가 있으면 그 그림이 피격을 보여 주므로 흰색 점멸을 덮지 않는다. */
  private tint(v: EnemyView, e: Enemy, time: number, hitArt: boolean) {
    if (time < v.flashUntil && !hitArt) { v.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); return; }
    v.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    if (e.slows.some(x => x.untilTick > this.c.bridge.controller.state.tick)) v.sprite.setTint(0xb9e2ff);
    else v.sprite.clearTint();
  }
}

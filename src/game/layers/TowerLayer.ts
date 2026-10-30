import Phaser from 'phaser';
import type { DomainEvent } from '../../domain/events';
import { formBranch } from '../../domain/towers';
import type { RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX } from '../assets';
import { DEPTH, FIXED_WEAPON, toWorld, type LayerContext } from './shared';

interface TowerView { body: Phaser.GameObjects.Image; weapon: Phaser.GameObjects.Image | null; pips: Phaser.GameObjects.Graphics; level: number; branch: string | null; recoilUntil: number; angle: number }

/** 타워 층: 몸체·무기·레벨 표식. 무기는 발사·즉발 공격 쪽으로 돌고 반동한다. */
export class TowerLayer {
  private readonly c: LayerContext;
  private towers = new Map<number, TowerView>();

  constructor(c: LayerContext) { this.c = c; }

  onFire(e: Extract<DomainEvent, { type: 'fire' }>) {
    const t = this.towers.get(e.towerId);
    const shot = this.c.bridge.controller.state.projectiles.find(p => p.id === e.projectileId);
    if (t && shot) { t.angle = Math.atan2(shot.toY - shot.fromY, shot.toX - shot.fromX); t.recoilUntil = this.c.scene.time.now + 120; }
  }

  /** 즉발 공격(PRD §11.4): 무기는 첫 대상 쪽으로 돌고 반동한다. */
  onStrike(e: Extract<DomainEvent, { type: 'strike' }>) {
    const t = this.towers.get(e.towerId);
    const first = e.targets[0];
    if (!first) return;
    const fx = toWorld(e.fromX), fy = toWorld(e.fromY) - CELL_PX * 0.32;
    if (t && !FIXED_WEAPON.has(e.towerType)) { t.angle = Math.atan2(toWorld(first.y) - fy, toWorld(first.x) - fx); t.recoilUntil = this.c.scene.time.now + 120; }
  }

  sync(s: RunState, time: number) {
    const { scene, bridge } = this.c;
    const seen = new Set<number>();
    for (const t of s.towers) {
      seen.add(t.id);
      let v = this.towers.get(t.id);
      const x = toWorld(t.x), y = toWorld(t.y);
      if (!v) {
        const spec = ASSETS.towers[t.type]!;
        const body = scene.add.image(x, y + CELL_PX * 0.32, spec.key).setOrigin(spec.originX, spec.originY).setDisplaySize(CELL_PX * spec.displayCells, CELL_PX * spec.displayCells * (spec.height / spec.width));
        // 깃발초소는 무기가 없다. 서리·번개 무기는 돌지 않고 떠 있다.
        const wspec = ASSETS.weapons[t.type];
        const weapon = wspec ? scene.add.image(x, y - CELL_PX * 0.32, wspec.key).setDisplaySize(CELL_PX * wspec.displayCells, CELL_PX * wspec.displayCells) : null;
        const pips = scene.add.graphics();
        v = { body, weapon, pips, level: 0, branch: null, recoilUntil: 0, angle: FIXED_WEAPON.has(t.type) ? 0 : -Math.PI / 2 };
        this.towers.set(t.id, v);
        if (!bridge.reducedMotion) { body.setScale(body.scaleX * 0.96, body.scaleY * 0.96); scene.tweens.add({ targets: body, scaleX: body.scaleX / 0.96, scaleY: body.scaleY / 0.96, duration: 120 }); }
      }
      const depth = DEPTH.units + y;
      v.body.setDepth(depth);
      v.weapon?.setDepth(depth + 1);
      v.pips.setDepth(depth + 2);
      const recoil = time < v.recoilUntil && !bridge.reducedMotion ? 2 : 0;
      if (FIXED_WEAPON.has(t.type)) v.weapon?.setPosition(x, y - CELL_PX * 0.38 + (bridge.reducedMotion ? 0 : Math.sin(time / 420 + t.id) * 2));
      else v.weapon?.setPosition(x - Math.cos(v.angle) * recoil, y - CELL_PX * 0.32 - Math.sin(v.angle) * recoil).setRotation(v.angle);
      if (v.level !== t.level || v.branch !== t.form) {
        v.level = t.level; v.branch = t.form;
        const branch = formBranch(t.form);
        v.pips.clear();
        const startX = x - (t.level - 1) * 5;
        for (let i = 0; i < t.level; i++) { v.pips.fillStyle(PALETTE.outline, 1).fillCircle(startX + i * 10, y + CELL_PX * 0.36, 4.2); v.pips.fillStyle(0xf4d35e, 1).fillCircle(startX + i * 10, y + CELL_PX * 0.36, 2.8); }
        if (branch) {
          // 분기 표식: A 원, B 마름모. 색만으로 구분하지 않는다.
          const bx = x + CELL_PX * 0.34, by = y - CELL_PX * 0.36;
          v.pips.fillStyle(PALETTE.outline, 1);
          if (branch === 'A') v.pips.fillCircle(bx, by, 8).fillStyle(0x245b88, 1).fillCircle(bx, by, 5.5);
          else v.pips.fillPoints([new Phaser.Math.Vector2(bx, by - 9), new Phaser.Math.Vector2(bx + 9, by), new Phaser.Math.Vector2(bx, by + 9), new Phaser.Math.Vector2(bx - 9, by)], true).fillStyle(0xa3352b, 1).fillPoints([new Phaser.Math.Vector2(bx, by - 6), new Phaser.Math.Vector2(bx + 6, by), new Phaser.Math.Vector2(bx, by + 6), new Phaser.Math.Vector2(bx - 6, by)], true);
        }
      }
    }
    for (const [id, v] of this.towers) if (!seen.has(id)) { v.body.destroy(); v.weapon?.destroy(); v.pips.destroy(); this.towers.delete(id); }
  }
}

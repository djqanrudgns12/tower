import Phaser from 'phaser';
import type { DomainEvent } from '../../domain/events';
import { positionAt } from '../../domain/geometry';
import type { RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, WORLD_W } from '../assets';
import { DEPTH, toWorld, type LayerContext } from './shared';

/** 처치 보상 표찰의 화면 최소 글자 크기(CSS px, v3 §1-2 13px 하한). */
const CALLOUT_MIN_CSS_PX = 13;

/** 효과 층: 날아가는 투사체, 피격·처치·화상 효과, 즉발 공격 효과, 성문 피해 섬광, 처치 보상 표찰. */
export class EffectLayer {
  private readonly c: LayerContext;
  private shots = new Map<number, Phaser.GameObjects.Image>();
  /** 처치 보상 표찰. 미니맵 카메라에서는 감춘다. */
  readonly callouts: Phaser.GameObjects.Container;

  constructor(c: LayerContext) {
    this.c = c;
    this.callouts = c.scene.add.container(0, 0).setDepth(DEPTH.fx + 5);
  }

  onHit(e: Extract<DomainEvent, { type: 'hit' }>) {
    this.fx(e.towerType === 'cannon' ? ASSETS.projectile.puff : e.towerType === 'frost' ? ASSETS.projectile.shard : ASSETS.projectile.spark, toWorld(e.x), toWorld(e.y) - 14, e.towerType === 'cannon' ? 0.9 : 0.55);
  }

  onKill(e: Extract<DomainEvent, { type: 'kill' }>) {
    for (let i = 0; i < 3; i++) this.fx(ASSETS.projectile.puff, toWorld(e.x) + (i - 1) * 9, toWorld(e.y) - 10 - (i % 2) * 6, 0.6);
    this.spawnKillCallout(e.x, e.y, e.gold, e.pt);
  }

  /** 화상 연기: 적 그림 위치에 작은 불씨. */
  onBurn(at: { x: number; y: number }) {
    this.fx(ASSETS.projectile.puff, at.x, at.y - CELL_PX * 0.3, 0.3, 0xf08a3c);
  }

  onLeak() {
    const { scene } = this.c;
    const [gx, gy] = this.c.bridge.controller.ctx.map.exitCell;
    const flash = scene.add.rectangle((gx + 0.5) * CELL_PX, (gy + 0.5) * CELL_PX, CELL_PX * 1.3, CELL_PX * 1.3, 0xa3352b, 0.35).setDepth(DEPTH.fx);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
  }

  /**
   * 즉발 공격 효과(PRD §11.4): 비행 지연 없이 그 틱에 보인다.
   * 번개는 타워→대상 순서로 이어지는 짧은 선, 화염은 맞은 자리의 불꽃, 근접은 맞은 자리의 섬광이다.
   * `lift`는 진화형 본체에 맞춰 올라간 무기 높이(TowerLayer.weaponLift)다.
   */
  onStrike(e: Extract<DomainEvent, { type: 'strike' }>, lift = 0) {
    const { scene, bridge } = this.c;
    const first = e.targets[0];
    if (!first) return;
    const fx = toWorld(e.fromX), fy = toWorld(e.fromY) - CELL_PX * 0.32 - lift;
    if (e.towerType === 'lightning') {
      const g = scene.add.graphics().setDepth(DEPTH.fx);
      const pts = [{ x: fx, y: fy - CELL_PX * 0.1 }, ...e.targets.map(p => ({ x: toWorld(p.x), y: toWorld(p.y) - 10 }))];
      g.lineStyle(5, PALETTE.outline, 0.5);
      for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y);
      g.lineStyle(2.5, 0xfff3a8, 1);
      for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y);
      scene.tweens.add({ targets: g, alpha: 0, duration: bridge.reducedMotion ? 60 : 160, onComplete: () => g.destroy() });
      return;
    }
    for (const p of e.targets) {
      if (e.towerType === 'flame') this.fx(ASSETS.projectile.puff, toWorld(p.x), toWorld(p.y) - 12, 0.7, 0xf08a3c);
      else this.fx(ASSETS.projectile.spark, toWorld(p.x), toWorld(p.y) - 12, 0.5);
    }
  }

  private fx(key: string, x: number, y: number, scale: number, tint?: number) {
    const { scene, bridge } = this.c;
    if (bridge.reducedMotion && key === ASSETS.projectile.puff) return;
    const img = scene.add.image(x, y, key).setDepth(DEPTH.fx).setScale(scale * 0.5).setAlpha(0.95);
    if (tint !== undefined) img.setTint(tint);
    scene.tweens.add({ targets: img, scale: scale, alpha: 0, duration: bridge.reducedMotion ? 80 : 180, onComplete: () => img.destroy() });
  }

  /**
   * 적 처치 보상 부유 표찰: 이미 상태에 반영된 보상을 전장 위에서 즉시 읽히게 보여 준다(PRD §10.3·§11.4).
   * 글자는 화면에서 13px 이상이어야 한다(v3 §1-2). 화면 CSS px = 월드 px × 메인 카메라 배율 × 캔버스 표시 배율(1/dpr)이므로,
   * 생성 시점의 메인 카메라 배율(칸 맞춤·확대 모드 포함)로 월드 글자 크기를 키운다. 기존 13px보다 작아지지는 않는다.
   * 미니맵 카메라는 callouts 컨테이너를 무시하므로 표찰이 미니맵에 비치지 않는다.
   */
  private spawnKillCallout(milliX: number, milliY: number, gold: number, pt: number) {
    const { scene, bridge } = this.c;
    if (gold <= 0 && pt <= 0) return;
    const cssPerWorld = scene.cameras.main.zoom * scene.scale.zoom;
    const fontPx = Math.max(CALLOUT_MIN_CSS_PX, Math.ceil(CALLOUT_MIN_CSS_PX / Math.max(0.01, cssPerWorld)));
    const k = fontPx / CALLOUT_MIN_CSS_PX;
    const rise = bridge.reducedMotion ? 0 : Math.round(14 * k);
    const text = pt > 0 ? `+${gold}골드 · +${pt}점` : `+${gold}골드`;
    const label = scene.add.text(0, 0, text, {
      fontFamily: 'Pretendard Variable, Pretendard, sans-serif',
      fontSize: `${fontPx}px`,
      fontStyle: '700',
      color: '#ffd859',
      backgroundColor: '#2e1b10',
      padding: { x: Math.round(6 * k), y: Math.round(3 * k) },
      stroke: '#362419',
      strokeThickness: Math.max(2, Math.round(2 * k)),
      resolution: 2,
    }).setOrigin(0.5);
    // 커진 표찰도 전장 밖으로 잘리지 않게 실제 크기로 가장자리를 막는다(떠오르는 거리 포함).
    const halfW = label.displayWidth / 2, halfH = label.displayHeight / 2;
    const wx = Phaser.Math.Clamp(toWorld(milliX), halfW, Math.max(halfW, WORLD_W - halfW));
    const wy = Math.max(halfH + rise, toWorld(milliY) - 24);
    label.setPosition(wx, wy);
    this.callouts.add(label);
    if (bridge.reducedMotion) {
      // 움직임 줄이기: 제자리에서 보였다가 같은 시간(680ms) 뒤 투명도만 낮춰 사라진다. 위로 떠오르지 않는다.
      scene.tweens.add({ targets: label, alpha: 0, delay: 440, duration: 240, onComplete: () => label.destroy() });
    } else {
      scene.tweens.add({ targets: label, y: wy - rise, alpha: 0, delay: 180, duration: 500, onComplete: () => label.destroy() });
    }
  }

  /** 단일 대상은 대상의 현재 위치를 향해 그리지만 도착 틱은 바꾸지 않는다(PRD §20.3). */
  syncShots(s: RunState, alpha: number, progressOf: (enemyId: number, alpha: number) => number | null, liftOf: (towerId: number) => number = () => 0) {
    const { scene, bridge } = this.c;
    const seen = new Set<number>();
    const path = bridge.controller.ctx.path;
    for (const p of s.projectiles) {
      seen.add(p.id);
      let img = this.shots.get(p.id);
      if (!img) {
        const key = p.towerType === 'cannon' ? ASSETS.projectile.ball : p.towerType === 'frost' ? ASSETS.projectile.shard : ASSETS.projectile.arrow;
        img = scene.add.image(0, 0, key).setDepth(DEPTH.projectiles).setScale(p.towerType === 'archer' ? 0.5 : 0.6);
        this.shots.set(p.id, img);
      }
      const f = Phaser.Math.Clamp((s.tick + alpha - p.firedTick) / Math.max(1, p.arrivalTick - p.firedTick), 0, 1);
      const target = p.targetId !== null ? s.enemies.find(e => e.id === p.targetId) : null;
      const to = target ? positionAt(path, progressOf(target.id, alpha) ?? target.progress) : { x: p.toX, y: p.toY };
      const fx = toWorld(p.fromX), fy = toWorld(p.fromY) - CELL_PX * 0.32 - liftOf(p.towerId), tx = toWorld(to.x), ty = toWorld(to.y) - CELL_PX * 0.08;
      const arc = p.towerType === 'cannon' ? Math.sin(f * Math.PI) * CELL_PX * 0.55 : 0;
      img.setPosition(fx + (tx - fx) * f, fy + (ty - fy) * f - arc);
      if (p.towerType === 'archer') img.setRotation(Math.atan2(ty - fy, tx - fx));
    }
    for (const [id, img] of this.shots) if (!seen.has(id)) { img.destroy(); this.shots.delete(id); }
  }
}

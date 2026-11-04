import Phaser from 'phaser';
import type { DomainEvent } from '../../domain/events';
import { positionAt } from '../../domain/geometry';
import type { FieldHazard, HazardKind, RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, WORLD_W } from '../assets';
import { BLAST_BURST_MS, blastCharge, blastLook, formBlastRadius, fusePuffCount, hazardBlastRadius, hazardEndCue, hazardLook, ROLLER_LENGTH_CELLS, ROLLER_THICK_CELLS, rollerHeading, trapCloseCue, wardDotOffsets, ZONE_ALPHA, ZONE_FLATTEN, type BlastLook, type BossCue, type HazardLook } from './cues';
import { DEPTH, toWorld, type LayerContext } from './shared';

/** 처치 보상 표찰의 화면 최소 글자 크기(CSS px, v3 §1-2 13px 하한). */
const CALLOUT_MIN_CSS_PX = 13;

/** 발밑 기준점: 길 위치보다 0.14칸 아래(적 그림의 발, EnemyLayer와 같다). */
const FOOT = CELL_PX * 0.14;

/** 장판·덫·굴림체 그림 하나. 한 번만 그리고 위치·투명도·배율만 바꾼다. 지연 폭발 대기 표시(blast)만 찬 정도가 바뀌어 매 프레임 다시 그린다. */
interface HazardView { g: Phaser.GameObjects.Graphics; kind: HazardKind; blast?: BlastLook }

/** 지연 폭발이 놓일 때 사건에서 읽어 둔 모양과 자리(월드 px). 터질 때 폭발을 그리는 데 쓴다(터진 장판은 같은 틱에 상태에서 사라진다). */
interface BlastSpot { look: BlastLook; x: number; y: number }

/** 효과 층: 날아가는 투사체, 피격·처치·화상 효과, 즉발 공격 효과, 성문 피해 섬광, 처치 보상 표찰, 대장 기믹·분열 순간 연출. */
export class EffectLayer {
  private readonly c: LayerContext;
  private shots = new Map<number, Phaser.GameObjects.Image>();
  private hazards = new Map<number, HazardView>();
  private blasts = new Map<number, BlastSpot>();
  /** 둘레 폭발(화약 술통·범위 덫)의 반경(칸). 터지면 같은 틱에 상태에서 사라지므로 살아 있는 동안 읽어 둔다. */
  private blastRadii = new Map<number, number>();
  /** 처치 보상 표찰. 미니맵 카메라에서는 감춘다. */
  readonly callouts: Phaser.GameObjects.Container;

  constructor(c: LayerContext) {
    this.c = c;
    this.callouts = c.scene.add.container(0, 0).setDepth(DEPTH.fx + 5);
  }

  /** lift는 떠 있는 비행 적의 몸 높이(EnemyLayer.liftOf)다. 맞은 자리를 몸에 맞춘다. */
  onHit(e: Extract<DomainEvent, { type: 'hit' }>, lift = 0) {
    this.fx(e.towerType === 'cannon' ? ASSETS.projectile.puff : e.towerType === 'frost' ? ASSETS.projectile.shard : ASSETS.projectile.spark, toWorld(e.x), toWorld(e.y) - 14 - lift, e.towerType === 'cannon' ? 0.9 : 0.55);
  }

  /** labelRaise(월드 px)만큼 보상 표찰을 올린다(분열: 튀어나오는 파생체를 가리지 않게). */
  onKill(e: Extract<DomainEvent, { type: 'kill' }>, labelRaise = 0) {
    for (let i = 0; i < 3; i++) this.fx(ASSETS.projectile.puff, toWorld(e.x) + (i - 1) * 9, toWorld(e.y) - 10 - (i % 2) * 6, 0.6);
    this.spawnKillCallout(e.x, e.y, e.gold, e.pt, labelRaise);
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
  onStrike(e: Extract<DomainEvent, { type: 'strike' }>, lift = 0, enemyLift: (enemyId: number) => number = () => 0) {
    const { scene, bridge } = this.c;
    const first = e.targets[0];
    if (!first) return;
    const fx = toWorld(e.fromX), fy = toWorld(e.fromY) - CELL_PX * 0.32 - lift;
    if (e.towerType === 'lightning') {
      const g = scene.add.graphics().setDepth(DEPTH.fx);
      const pts = [{ x: fx, y: fy - CELL_PX * 0.1 }, ...e.targets.map(p => ({ x: toWorld(p.x), y: toWorld(p.y) - 10 - enemyLift(p.enemyId) }))];
      g.lineStyle(5, PALETTE.outline, 0.5);
      for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y);
      g.lineStyle(2.5, 0xfff3a8, 1);
      for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y);
      scene.tweens.add({ targets: g, alpha: 0, duration: bridge.reducedMotion ? 60 : 160, onComplete: () => g.destroy() });
      return;
    }
    for (const p of e.targets) {
      const py = toWorld(p.y) - 12 - enemyLift(p.enemyId);
      if (e.towerType === 'flame') this.fx(ASSETS.projectile.puff, toWorld(p.x), py, 0.7, 0xf08a3c);
      else this.fx(ASSETS.projectile.spark, toWorld(p.x), py, 0.5);
    }
  }

  /**
   * 대장 기믹 순간 연출(cues.bossCue). at은 대장의 길 위 위치(월드 px). 600ms 안에 끝나고(ui-rules-v2 §2),
   * 움직임 줄이기면 커지거나 떠오르지 않고 투명도만 바뀐다. 상시 표시(고리·점·먼지 줄·원)는 EnemyLayer가 상태로 그린다.
   */
  onBossSkill(cue: BossCue, at: { x: number; y: number }, escortSpots: ReadonlyArray<{ x: number; y: number }> = []) {
    const { scene, bridge } = this.c;
    const reduced = bridge.reducedMotion;
    if (cue.kind === 'ring') {
      // 방패 고리가 바깥에서 발밑으로 한 번 조여 든다. 움직임 줄이기면 상시 고리만 보인다.
      if (reduced) return;
      const g = scene.add.graphics().setDepth(DEPTH.overlay + 2).setPosition(at.x, at.y + FOOT);
      g.lineStyle(7, PALETTE.outline, 0.85).strokeEllipse(0, 0, CELL_PX * 1.25, CELL_PX * 0.44);
      g.lineStyle(3.5, PALETTE.cream, 1).strokeEllipse(0, 0, CELL_PX * 1.25, CELL_PX * 0.44);
      g.setScale(1.45);
      scene.tweens.add({ targets: g, scale: 1, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
    } else if (cue.kind === 'wardPop') {
      // 벗겨진 방패 점 자리에서 작은 조각이 튄다.
      const dx = wardDotOffsets(cue.of)[cue.index] ?? 0;
      this.flash(ASSETS.projectile.shard, at.x + dx, at.y - CELL_PX * 0.92, 0.55, undefined, DEPTH.ui + 1);
    } else if (cue.kind === 'heal') {
      this.floatLabel(at.x, at.y - CELL_PX * 1.02, `+${cue.hp}`, `#${PALETTE.grassLight.toString(16).padStart(6, '0')}`);
    } else {
      // 호위 호출: 호위병이 나타나는 대장 옆 자리마다 먼지 구름. 호위병은 그 속에서 커지며 나타난다(EnemyLayer 등장 연출).
      const spots = escortSpots.length ? escortSpots : [at];
      for (const p of spots) this.cloud(p.x, p.y + FOOT - 6, CELL_PX * 0.24, PALETTE.cream, 460);
    }
  }

  /** 분열: 쓰러진 자리에서 작은 회색 연기가 피고, 파생체 둘이 그 속에서 튀어나온다(EnemyLayer 등장 연출, 300ms). */
  onSplit(milliX: number, milliY: number) {
    this.cloud(toWorld(milliX), toWorld(milliY) + FOOT - 8, CELL_PX * 0.22, PALETTE.stoneLight, 320);
  }

  /**
   * 연기·먼지 구름: 동그라미 셋을 짙은 갈색 외곽선으로 묶은 덩이(41번 화풍). 커지며 옅어지고,
   * 움직임 줄이기면 같은 크기로 투명도만 낮춘다. 적 그림 위에 피어 나타나는 적을 잠깐 가린다.
   */
  private cloud(x: number, y: number, r: number, fill: number, duration: number) {
    const { scene, bridge } = this.c;
    const reduced = bridge.reducedMotion;
    const blobs = [[-0.6, 0.12, 0.62], [0.6, 0.12, 0.62], [0, -0.28, 0.8]] as const;
    const g = scene.add.graphics().setDepth(DEPTH.fx).setPosition(x, y);
    g.fillStyle(PALETTE.outline, 0.7);
    for (const [bx, by, br] of blobs) g.fillCircle(bx * r, by * r, br * r + 2.5);
    g.fillStyle(fill, 1);
    for (const [bx, by, br] of blobs) g.fillCircle(bx * r, by * r, br * r);
    g.setScale(reduced ? 1 : 0.6).setAlpha(0.95);
    scene.tweens.add({ targets: g, ...(reduced ? {} : { scale: 1.1 }), alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }

  /** 새 순간 효과: 커지며 사라진다. 움직임 줄이기면 같은 크기로 투명도만 낮춘다. */
  private flash(key: string, x: number, y: number, scale: number, tint?: number, depth = DEPTH.fx, duration = 260) {
    const { scene, bridge } = this.c;
    const reduced = bridge.reducedMotion;
    const img = scene.add.image(x, y, key).setDepth(depth).setScale(reduced ? scale : scale * 0.5).setAlpha(0.95);
    if (tint !== undefined) img.setTint(tint);
    scene.tweens.add({ targets: img, ...(reduced ? {} : { scale }), alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
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
  private spawnKillCallout(milliX: number, milliY: number, gold: number, pt: number, raise = 0) {
    if (gold <= 0 && pt <= 0) return;
    this.floatLabel(toWorld(milliX), toWorld(milliY) - 24 - raise, pt > 0 ? `+${gold}골드 · +${pt}점` : `+${gold}골드`, '#ffd859');
  }

  /** 떠오르는 표찰(처치 보상·대장 회복). worldX·worldY는 표찰 가운데의 월드 위치이고, 전장 밖으로 잘리지 않게 막는다. */
  private floatLabel(worldX: number, worldY: number, text: string, color: string) {
    const { scene, bridge } = this.c;
    const cssPerWorld = scene.cameras.main.zoom * scene.scale.zoom;
    const fontPx = Math.max(CALLOUT_MIN_CSS_PX, Math.ceil(CALLOUT_MIN_CSS_PX / Math.max(0.01, cssPerWorld)));
    const k = fontPx / CALLOUT_MIN_CSS_PX;
    const rise = bridge.reducedMotion ? 0 : Math.round(14 * k);
    const label = scene.add.text(0, 0, text, {
      fontFamily: 'Pretendard Variable, Pretendard, sans-serif',
      fontSize: `${fontPx}px`,
      fontStyle: '700',
      color,
      backgroundColor: '#2e1b10',
      padding: { x: Math.round(6 * k), y: Math.round(3 * k) },
      stroke: '#362419',
      strokeThickness: Math.max(2, Math.round(2 * k)),
      resolution: 2,
    }).setOrigin(0.5);
    // 커진 표찰도 전장 밖으로 잘리지 않게 실제 크기로 가장자리를 막는다(떠오르는 거리 포함).
    const halfW = label.displayWidth / 2, halfH = label.displayHeight / 2;
    const wx = Phaser.Math.Clamp(worldX, halfW, Math.max(halfW, WORLD_W - halfW));
    const wy = Math.max(halfH + rise, worldY);
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
  syncShots(s: RunState, alpha: number, progressOf: (enemyId: number, alpha: number) => number | null, liftOf: (towerId: number) => number = () => 0, enemyLift: (enemyId: number) => number = () => 0) {
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
      const fx = toWorld(p.fromX), fy = toWorld(p.fromY) - CELL_PX * 0.32 - liftOf(p.towerId), tx = toWorld(to.x), ty = toWorld(to.y) - CELL_PX * 0.08 - (target ? enemyLift(target.id) : 0);
      const arc = p.towerType === 'cannon' ? Math.sin(f * Math.PI) * CELL_PX * 0.55 : 0;
      img.setPosition(fx + (tx - fx) * f, fy + (ty - fy) * f - arc);
      if (p.towerType === 'archer') img.setRotation(Math.atan2(ty - fy, tx - fx));
    }
    for (const [id, img] of this.shots) if (!seen.has(id)) { img.destroy(); this.shots.delete(id); }
  }

  /** 지연 폭발이 놓였다(덫 B1 2차 폭죽·노포 B2 도화선): 터질 때 그릴 모양과 자리를 읽어 둔다. 대기 표시는 syncHazards가 상태로 그린다. */
  onHazardPlaced(e: Extract<DomainEvent, { type: 'hazardPlaced' }>) {
    if (e.kind === 'zone' && e.blast) this.blasts.set(e.hazardId, { look: blastLook(e), x: toWorld(e.x), y: toWorld(e.y) + FOOT });
  }

  /**
   * 덫이 발동했다: 150ms 닫혔다 열린다(움직임 줄이기면 투명도만). 소진되면 syncHazards가 곧 거둔다. 지연 폭발이 터지면 폭발 연출이 대기 표시를 대신한다.
   * 범위 덫(폭죽 발판 계열)과 화약 술통이 터지면 둘레 폭발 고리를 더한다(burst).
   */
  onHazardTriggered(e: Extract<DomainEvent, { type: 'hazardTriggered' }>) {
    if (e.kind === 'zone') { if (e.blast) this.detonate(e); return; }
    if (e.blast) this.burst(e.kind, e);
    if (e.kind !== 'trap') return;
    const v = this.hazards.get(e.hazardId);
    if (!v) return;
    const { scene, bridge } = this.c;
    const cue = trapCloseCue(bridge.reducedMotion);
    scene.tweens.killTweensOf(v.g);
    v.g.setScale(1).setAlpha(1);
    scene.tweens.add({ targets: v.g, scale: cue.scale, alpha: cue.alpha, duration: cue.ms, yoyo: true, ease: 'Quad.easeOut' });
  }

  /**
   * 바닥에 남는 장판(약병)·덫·굴림체를 상태에서 읽어 그린다. 상태에 없으면 아무것도 그리지 않고, 사라진 것은 짧게 거둔다.
   * 장판·덫은 놓인 자리에 한 번 그리고, 굴림체는 상태의 진행도로 매 프레임 길 위를 옮긴다. 땅 위의 것이라 발밑 기준(FOOT)에 맞춘다.
   */
  syncHazards(s: RunState, alpha: number) {
    const path = this.c.bridge.controller.ctx.path;
    const seen = new Set<number>();
    for (const h of s.hazards) {
      const blastRadius = hazardBlastRadius(h);
      if (blastRadius !== null) this.blastRadii.set(h.id, blastRadius);
      const look = hazardLook(h, alpha);
      if (!look) {
        if (h.kind === 'zone' && h.blast) { seen.add(h.id); this.syncBlast(h, s.tick, alpha); }
        continue;
      }
      seen.add(h.id);
      let v = this.hazards.get(h.id);
      if (!v) {
        v = { g: this.c.scene.add.graphics(), kind: h.kind };
        this.drawHazard(v.g, look);
        this.hazards.set(h.id, v);
        if (look.kind !== 'roller') v.g.setPosition(toWorld(h.x), toWorld(h.y) + FOOT).setDepth(DEPTH.overlay + 0.5);
      }
      if (look.kind === 'roller') {
        const p = positionAt(path, look.progress), wy = toWorld(p.y) + FOOT;
        v.g.setPosition(toWorld(p.x), wy).setRotation(rollerHeading(path, look.progress) + Math.PI / 2).setDepth(DEPTH.units + wy + 0.55);
      }
    }
    for (const [id, v] of this.hazards) if (!seen.has(id)) { this.retireHazard(v); this.hazards.delete(id); }
    for (const id of this.blasts.keys()) if (!seen.has(id)) this.blasts.delete(id);
    for (const id of this.blastRadii.keys()) if (!seen.has(id)) this.blastRadii.delete(id);
  }

  /**
   * 지연 폭발 대기 표시: 터질 자리와 시간을 보인다. 덫 2차 폭죽은 폭발 반경의 점선 고리와 가운데 폭죽 표지, 고리 안이 시계 방향으로 차오른다.
   * 노포 도화선은 타워에서 뻗은 폭발 띠(실제 폭)와 점선 도화선이고, 불꽃이 선 위를 타 들어간다. 움직임 줄이기면 모양은 그대로 두고 투명도만 서서히 짙어진다.
   */
  private syncBlast(h: Extract<FieldHazard, { kind: 'zone' }>, tick: number, alpha: number) {
    const { scene, bridge } = this.c;
    const reduced = bridge.reducedMotion;
    const look = blastLook(h);
    let v = this.hazards.get(h.id);
    if (!v) {
      v = { g: scene.add.graphics().setDepth(DEPTH.overlay + 0.4), kind: 'zone', blast: look };
      const x = toWorld(h.x), y = toWorld(h.y) + FOOT;
      v.g.setPosition(x, y);
      if (look.kind === 'fuse') v.g.setRotation(look.heading);
      this.hazards.set(h.id, v);
      if (!this.blasts.has(h.id)) this.blasts.set(h.id, { look, x, y });
    }
    const charge = blastCharge(h, tick, alpha);
    v.g.setAlpha(reduced ? 0.35 + 0.55 * charge : 0.92);
    v.g.clear();
    if (look.kind === 'ring') this.drawBlastRing(v.g, look.radius * CELL_PX, reduced ? 0 : charge);
    else this.drawBlastFuse(v.g, look.length * CELL_PX, look.width * CELL_PX, reduced ? 0 : charge);
  }

  /** 점선 고리(반경 radius px, 세로는 장판처럼 ZONE_FLATTEN으로 눌림)와 가운데 폭죽 표지. progress는 시계 방향 부채꼴 0..1(0이면 그리지 않는다). */
  private drawBlastRing(g: Phaser.GameObjects.Graphics, rx: number, progress: number) {
    const ry = rx * ZONE_FLATTEN;
    const at = (a: number) => new Phaser.Math.Vector2(Math.cos(a) * rx, Math.sin(a) * ry);
    if (progress > 0) {
      const start = -Math.PI / 2, steps = Math.max(2, Math.ceil(progress * 28));
      g.fillStyle(0xf08a3c, 0.3).fillPoints([new Phaser.Math.Vector2(0, 0), ...Array.from({ length: steps + 1 }, (_, i) => at(start + (progress * 2 * Math.PI * i) / steps))], true);
    }
    const dashes = Math.max(10, Math.round(rx / 3.2));
    for (let i = 0; i < dashes; i++) {
      const a0 = (i * 2 * Math.PI) / dashes, a1 = a0 + (Math.PI * 1.1) / dashes, p0 = at(a0), p1 = at(a1);
      g.lineStyle(3, PALETTE.outline, 0.85).lineBetween(p0.x, p0.y, p1.x, p1.y);
      g.lineStyle(1.4, PALETTE.cream, 1).lineBetween(p0.x, p0.y, p1.x, p1.y);
    }
    // 작은 폭죽: 둥근 통 + 짧은 도화선 + 불씨(깜빡이지 않고 고정).
    g.fillStyle(PALETTE.outline, 1).fillCircle(0, -2, 5.2);
    g.fillStyle(0xd9552b, 1).fillCircle(0, -2, 3.7);
    g.lineStyle(2, PALETTE.outline, 1).lineBetween(0, -6, 3, -10);
    g.fillStyle(PALETTE.outline, 1).fillCircle(3, -10.5, 3);
    g.fillStyle(PALETTE.flowerA, 1).fillCircle(3, -10.5, 1.8);
  }

  /** 도화선: 원점(타워 발밑)에서 +x 방향으로 length px, 폭 width px의 폭발 띠. progress만큼 앞쪽이 타서 어두워지고 그 끝에 불씨가 있다. */
  private drawBlastFuse(g: Phaser.GameObjects.Graphics, length: number, width: number, progress: number) {
    g.fillStyle(0xf08a3c, 0.16).fillRect(0, -width / 2, length, width);
    const dash = 7, gap = 5, burnt = length * progress;
    for (let x = 0; x < length; x += dash + gap) {
      const x1 = Math.min(length, x + dash);
      g.lineStyle(3, PALETTE.outline, 0.85).lineBetween(x, 0, x1, 0);
      g.lineStyle(1.4, x1 <= burnt ? PALETTE.woodDark : PALETTE.cream, 1).lineBetween(x, 0, x1, 0);
    }
    if (progress > 0) {
      g.fillStyle(PALETTE.outline, 1).fillCircle(burnt, 0, 4.4);
      g.fillStyle(PALETTE.flowerA, 1).fillCircle(burnt, 0, 2.8);
    }
  }

  /**
   * 지연 폭발이 터졌다: 대기 표시를 거두고 폭발을 그린다. 덫 2차 폭죽은 반경만큼 퍼지는 고리와 가운데 연기, 노포 도화선은 폭발 띠 전체가 번쩍이지 않고 한 번 옅게 떴다 사라지며 선을 따라 연기 덩이가 핀다.
   * 대기 표시가 없으면(장면 상태로 연 판·늦은 프레임) 사건의 자리에 반경 0.5칸 고리를 그린다.
   */
  private detonate(e: Extract<DomainEvent, { type: 'hazardTriggered' }>) {
    const { scene } = this.c;
    const wait = this.hazards.get(e.hazardId);
    if (wait) { scene.tweens.killTweensOf(wait.g); wait.g.destroy(); this.hazards.delete(e.hazardId); }
    const spot = this.blasts.get(e.hazardId) ?? { look: { kind: 'ring', radius: 0.5 } as BlastLook, x: toWorld(e.x), y: toWorld(e.y) + FOOT };
    this.blasts.delete(e.hazardId);
    if (spot.look.kind === 'ring') {
      this.burstRing(spot.x, spot.y, spot.look.radius);
    } else {
      const { length, width, heading } = spot.look, L = length * CELL_PX, W = width * CELL_PX;
      const g = scene.add.graphics().setDepth(DEPTH.fx).setPosition(spot.x, spot.y).setRotation(heading);
      g.fillStyle(0xf08a3c, 0.4).fillRect(0, -W / 2, L, W);
      scene.tweens.add({ targets: g, alpha: 0, duration: BLAST_BURST_MS, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
      const n = fusePuffCount(length);
      for (let i = 0; i < n; i++) {
        const d = ((i + 0.5) / n) * L;
        this.cloud(spot.x + Math.cos(heading) * d, spot.y + Math.sin(heading) * d - 4, Math.max(CELL_PX * 0.14, W * 0.55), 0xf08a3c, BLAST_BURST_MS + 80);
      }
    }
  }

  /**
   * 둘레 폭발(화약 술통·범위 덫)이 터졌다: 실제 폭발 반경만큼 퍼지는 고리와 가운데 연기를 지연 폭발과 같은 크기·색·길이(260ms)로 그린다.
   * 반경은 살아 있는 동안 읽어 둔 값, 없으면 타워 형태 규칙, 그것도 없으면 0.5칸이다. 굴러가던 술통은 터지는 순간 거둔다.
   */
  private burst(kind: 'trap' | 'roller', e: Extract<DomainEvent, { type: 'hazardTriggered' }>) {
    const { controller } = this.c.bridge;
    const tower = controller.state.towers.find(t => t.id === e.towerId);
    const radius = this.blastRadii.get(e.hazardId) ?? (tower ? formBlastRadius(controller.ctx.balance, tower, kind) : null) ?? 0.5;
    this.blastRadii.delete(e.hazardId);
    if (kind === 'roller') {
      const v = this.hazards.get(e.hazardId);
      if (v) { this.c.scene.tweens.killTweensOf(v.g); v.g.destroy(); this.hazards.delete(e.hazardId); }
    }
    this.burstRing(toWorld(e.x), toWorld(e.y) + FOOT, radius);
  }

  /** 폭발 고리: 반경 radiusCells칸의 눌린 타원(ZONE_FLATTEN)이 퍼지며 사라지고 가운데 연기가 핀다. 움직임 줄이기면 같은 크기로 투명도만 낮춘다. */
  private burstRing(x: number, y: number, radiusCells: number) {
    const { scene, bridge } = this.c;
    const reduced = bridge.reducedMotion;
    const rx = radiusCells * CELL_PX, ry = rx * ZONE_FLATTEN;
    const g = scene.add.graphics().setDepth(DEPTH.fx).setPosition(x, y);
    g.fillStyle(0xf08a3c, 0.35).fillEllipse(0, 0, rx * 2, ry * 2);
    g.lineStyle(3, PALETTE.outline, 0.8).strokeEllipse(0, 0, rx * 2, ry * 2);
    g.lineStyle(1.5, PALETTE.cream, 1).strokeEllipse(0, 0, rx * 2, ry * 2);
    g.setScale(reduced ? 1 : 0.55);
    scene.tweens.add({ targets: g, ...(reduced ? {} : { scale: 1 }), alpha: 0, duration: BLAST_BURST_MS, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
    this.cloud(x, y - 4, CELL_PX * 0.26, 0xf08a3c, BLAST_BURST_MS + 80);
  }

  /** 사라진 장판·덫·굴림체: 장판 200ms 페이드, 덫은 150ms 닫히며(움직임 줄이기면 투명도만), 굴림체 150ms 페이드. */
  private retireHazard(v: HazardView) {
    const { scene, bridge } = this.c;
    const cue = hazardEndCue(v.kind, bridge.reducedMotion);
    scene.tweens.killTweensOf(v.g);
    scene.tweens.add({ targets: v.g, alpha: 0, ...(cue.scale === 1 ? {} : { scale: v.g.scaleX * cue.scale }), duration: cue.ms, ease: 'Quad.easeOut', onComplete: () => v.g.destroy() });
  }

  /** 그림은 (0, 0) 중심으로 그린다. 외곽선은 가는 선(장판 1px)이고 광택·번쩍임은 없다. */
  private drawHazard(g: Phaser.GameObjects.Graphics, look: HazardLook) {
    if (look.kind === 'zone') {
      const rx = look.rx * CELL_PX, ry = look.ry * CELL_PX;
      g.fillStyle(PALETTE.leafLight, ZONE_ALPHA).fillEllipse(0, 0, rx * 2, ry * 2);
      g.lineStyle(1, PALETTE.leafDark, 1).strokeEllipse(0, 0, rx * 2, ry * 2);
    } else if (look.kind === 'trap') {
      const r = (look.diameter * CELL_PX) / 2, teeth = 8;
      g.fillStyle(PALETTE.outline, 1);
      for (let i = 0; i < teeth; i++) {
        const a = (i * 2 * Math.PI) / teeth, ca = Math.cos(a), sa = Math.sin(a), px = -sa * 2.4, py = ca * 2.4;
        g.fillTriangle(ca * (r - 1) + px, sa * (r - 1) + py, ca * (r - 1) - px, sa * (r - 1) - py, ca * (r + 3.2), sa * (r + 3.2));
      }
      g.fillCircle(0, 0, r + 1.2);
      g.fillStyle(PALETTE.wood, 1).fillCircle(0, 0, r - 0.8);
      g.fillStyle(PALETTE.woodDark, 1).fillCircle(0, 0, r * 0.38);
    } else {
      // 눕혀 놓은 통나무: 긴 쪽이 굴러가는 방향과 직각(drawHazard는 가로로 그리고 층이 돌린다). 한쪽 끝면에 나이테 원 하나.
      const len = ROLLER_LENGTH_CELLS * CELL_PX, th = ROLLER_THICK_CELLS * CELL_PX;
      g.fillStyle(PALETTE.outline, 1).fillRoundedRect(-len / 2 - 1.5, -th / 2 - 1.5, len + 3, th + 3, th / 2 + 1.5);
      g.fillStyle(PALETTE.wood, 1).fillRoundedRect(-len / 2, -th / 2, len, th, th / 2);
      const cx = len / 2 - th / 2, cr = th / 2 - 2;
      g.fillStyle(PALETTE.woodLight, 1).fillCircle(cx, 0, cr);
      g.lineStyle(1.5, PALETTE.woodDark, 1).strokeCircle(cx, 0, cr * 0.55);
    }
  }
}

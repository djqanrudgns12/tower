import Phaser from 'phaser';
import { positionAt } from '../../domain/geometry';
import { enemyArtId } from '../../domain/factions';
import type { Enemy, RunState } from '../../domain/types';
import { acceptsHit, enemyPose, HIT_MS } from '../animation/pose';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, enemyArt, type EnemyArt } from '../assets';
import { bossStatus, flyerLift, introFrame, wardDotOffsets, type BossStatus, type SpawnIntro } from './cues';
import { DEPTH, toWorld, type LayerContext } from './shared';

interface EnemyView {
  sprite: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Image | null; art: EnemyArt; prev: number; cur: number; phase: number; flashUntil: number; hitAt: number | null; facing: 1 | -1;
  /** 지금 그린 길 위 위치(월드 px, 등장 연출 포함)와 비행 몸 높이(px). 효과 층이 맞힌 자리·기믹 위치를 맞출 때 쓴다. */
  x: number; y: number; lift: number;
  /** 분열·호위 등장 연출(시작 시각 ms). */
  intro: (SpawnIntro & { start: number }) | null;
}

/** 발밑 기준점: 길 위치보다 0.14칸 아래(적 그림의 발). */
const FOOT = CELL_PX * 0.14;
/** 비행 몸이 오르내릴 때 따라가는 시간(ms). */
const LIFT_EASE_MS = 140;
/** 대장 기믹 색: 방패 고리(강철), 겹방패 점(푸른 방패), 북소리 원(옅은 산호), 먼지(크림 + 갈색 외곽선). */
const STANCE = PALETTE.stoneLight, WARD = PALETTE.ice, RALLY = PALETTE.flowerB, DUST = PALETTE.cream;

/**
 * 적 층: 종족×역할 그림, 길 위 보간 위치, 걸음 자세, 피격 점멸·둔화 색, 정예 배지, 체력 막대.
 * 대장 기믹(방패 고리·겹방패 점·먼지 줄·북소리 원), 비행 적의 그림자와 띄운 몸, 분열·호위 등장 연출도 그린다(cues.ts가 고른다).
 */
export class EnemyLayer {
  private readonly c: LayerContext;
  private enemies = new Map<number, EnemyView>();
  /** 그림 id·종류별로 고른 그림. 텍스처는 장면을 만든 뒤 바뀌지 않는다. */
  private arts = new Map<string, EnemyArt>();
  /** 아직 그리지 않은 적의 등장 연출(사건이 그림보다 먼저 온다). */
  private pendingIntros = new Map<number, SpawnIntro>();
  private lastTick = -1;
  private lastTime: number | null = null;
  /** 체력 막대와 겹방패 점. 미니맵 카메라에서는 감춘다. */
  readonly hpBars: Phaser.GameObjects.Graphics;
  /** 땅에 붙은 표시: 비행 그림자, 방패 고리, 먼지 줄, 북소리 원. 적 그림보다 아래다. */
  private readonly ground: Phaser.GameObjects.Graphics;

  constructor(c: LayerContext) {
    this.c = c;
    this.hpBars = c.scene.add.graphics().setDepth(DEPTH.ui);
    this.ground = c.scene.add.graphics().setDepth(DEPTH.overlay + 1);
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

  /** 분열 파생체·호위병의 등장 연출을 예약한다. 그 적을 처음 그릴 때 시작한다. */
  expectIntros(intros: readonly SpawnIntro[]) {
    for (const i of intros) this.pendingIntros.set(i.enemyId, i);
  }

  /** 지금 그려진 적 그림의 위치(화상 연기 등). 없으면 null. */
  spriteAt(enemyId: number): { x: number; y: number } | null {
    const v = this.enemies.get(enemyId);
    return v ? { x: v.sprite.x, y: v.sprite.y } : null;
  }

  /** 지금 그린 길 위 위치(월드 px). 아직 그리지 않은 적이면 null. */
  placeOf(enemyId: number): { x: number; y: number } | null {
    const v = this.enemies.get(enemyId);
    return v ? { x: v.x, y: v.y } : null;
  }

  /** 떠 있는 비행 적의 몸 높이(월드 px). 맞힌 자리·투사체 겨냥을 몸에 맞춘다. */
  liftOf(enemyId: number): number {
    return this.enemies.get(enemyId)?.lift ?? 0;
  }

  /** 보간된 진행 거리. 아직 그리지 않은 적이면 null. */
  progressOf(enemyId: number, alpha: number): number | null {
    const v = this.enemies.get(enemyId);
    return v ? v.prev + (v.cur - v.prev) * alpha : null;
  }

  sync(s: RunState, time: number, alpha: number) {
    const { scene, bridge } = this.c;
    const { path, balance } = bridge.controller.ctx;
    const reduced = bridge.reducedMotion;
    const dt = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    const seen = new Set<number>();
    this.hpBars.clear();
    this.ground.clear();
    for (const e of s.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        const art = this.artOf(e);
        const sprite = scene.add.image(0, 0, art.framed ? `${art.base}.0` : art.base).setOrigin(art.originX, art.originY).setDisplaySize(CELL_PX * art.displayCells, CELL_PX * art.displayCells);
        const badge = e.elite ? scene.add.image(0, 0, ASSETS.badge[e.elite]).setDisplaySize(14, 16) : null;
        const intro = this.pendingIntros.get(e.id);
        this.pendingIntros.delete(e.id);
        // 개체마다 보행 위상을 다르게 둔다(PRD §11.3).
        v = { sprite, badge, art, prev: e.progress, cur: e.progress, phase: (e.id * 0.618034) % 1, flashUntil: 0, hitAt: null, facing: 1,
          x: 0, y: 0, lift: flyerLift(e, s.tick) * CELL_PX, intro: intro ? { ...intro, start: time } : null };
        this.enemies.set(e.id, v);
      }
      const progress = v.prev + (v.cur - v.prev) * alpha;
      const p = positionAt(path, progress);
      const ahead = positionAt(path, Math.min(path.length, progress + 200));
      if (ahead.x !== p.x) v.facing = ahead.x > p.x ? 1 : -1;
      let x = toWorld(p.x), y = toWorld(p.y);
      const moving = v.cur !== v.prev && s.pause.length === 0;
      // 비행 몸 높이: 끌어내려지면 내려앉고 다시 떠오른다. 움직임 줄이기면 바로 바뀐다.
      const liftTarget = flyerLift(e, s.tick) * CELL_PX;
      v.lift = reduced || dt <= 0 ? liftTarget : v.lift + (liftTarget - v.lift) * Math.min(1, dt / LIFT_EASE_MS);
      // 등장 연출: 분열은 처치 지점에서 옆으로 튀어 제자리에 내려앉고, 호위병은 제자리에서 커지며 나타난다.
      const intro = v.intro ? introFrame(v.intro, time - v.intro.start, reduced) : null;
      if (v.intro && !intro) v.intro = null;
      let hop = 0, scaleK = 1, alphaK = 1;
      if (intro && v.intro) {
        if (v.intro.from) { const fx = toWorld(v.intro.from.x), fy = toWorld(v.intro.from.y); x = fx + (x - fx) * intro.t; y = fy + (y - fy) * intro.t; }
        x += intro.sway * CELL_PX;
        hop = intro.lift * CELL_PX;
        scaleK = intro.scale;
        alphaK = intro.alpha;
      }
      v.x = x; v.y = y;
      // 걸음은 보간된 진행 거리로 맞춰 감속·맵 길이와 상관없이 발이 미끄러지지 않게 한다(RIG-001).
      // 한 장짜리 종족 그림은 frames 1이라 pose가 디딤 눌림·떠오름으로 걸음을 보여 준다.
      const { art } = v;
      const pose = enemyPose({ kind: e.kind, phase: v.phase, time: time / 1000, speedBP: e.speedBP, moving, frames: art.frames, reducedMotion: reduced,
        distance: toWorld(progress), ...(v.hitAt === null ? {} : { hitAge: (time - v.hitAt) / 1000 }) });
      const hitKey = `${art.base}.hit`;
      const hitArt = pose.hit && scene.textures.exists(hitKey);
      const size = CELL_PX * art.displayCells * scaleK;
      if (e.flying) this.flyerShadow(x, y + FOOT, art.displayCells * scaleK, v.lift);
      v.sprite.setTexture(hitArt ? hitKey : art.framed ? `${art.base}.${pose.frame}` : art.base).setPosition(x, y + FOOT - pose.bob - v.lift - hop).setFlipX(v.facing < 0).setDepth(DEPTH.units + y + 0.5)
        .setDisplaySize(size, size * pose.squashY).setAlpha(alphaK);
      this.tint(v, e, time, hitArt);
      const top = y - v.lift - hop;
      if (v.badge) v.badge.setPosition(x, top - CELL_PX * (e.kind === 'boss' ? 0.86 : 0.5)).setDepth(DEPTH.units + y + 0.6).setAlpha(alphaK);
      const status = bossStatus(balance, e, s.tick);
      if (status) this.bossMarks(status, x, y, progress, time, moving);
      if (e.hp < e.maxHp) {
        const w = e.kind === 'boss' ? 44 : 28, bx = x - w / 2, by = top - CELL_PX * (e.kind === 'boss' ? 0.78 : 0.44);
        this.hpBars.fillStyle(PALETTE.outline, 0.9).fillRect(bx - 1, by - 1, w + 2, 6).fillStyle(0xd94f3d, 1).fillRect(bx, by, Math.max(1, (w * e.hp) / e.maxHp), 4);
      }
    }
    for (const [id, v] of this.enemies) if (!seen.has(id)) { v.sprite.destroy(); v.badge?.destroy(); this.enemies.delete(id); }
    // 그려지기 전에 사라진 적(같은 틱 처치 등)의 예약은 버린다.
    for (const id of this.pendingIntros.keys()) if (!s.enemies.some(e => e.id === id)) this.pendingIntros.delete(id);
  }

  /** 비행 적의 땅 그림자: 몸이 높을수록 조금 작고 옅다. 몸은 그 위에 떠 있다. */
  private flyerShadow(x: number, footY: number, cells: number, lift: number) {
    const k = 1 - 0.25 * Math.min(1, lift / (CELL_PX * 0.25));
    this.ground.fillStyle(PALETTE.outline, 0.3 * k + 0.05).fillEllipse(x, footY, CELL_PX * cells * 0.62 * k, CELL_PX * 0.17 * k);
  }

  /** 대장이 지금 하는 일(상태로 읽는다): 북소리 원, 방패 고리, 돌진 먼지 줄(땅), 겹방패 점(머리 위). */
  private bossMarks(st: BossStatus, x: number, y: number, progress: number, time: number, moving: boolean) {
    const g = this.ground;
    const path = this.c.bridge.controller.ctx.path;
    if (st.rallyMilli > 0) {
      const r = toWorld(st.rallyMilli);
      g.fillStyle(RALLY, 0.14).fillCircle(x, y, r).lineStyle(2.5, RALLY, 0.75).strokeCircle(x, y, r);
    }
    if (st.dash && moving) {
      // 지나온 길 위, 대장 그림 뒤끝부터 먼지 세 덩이. 앞쪽이 진하고 뒤로 갈수록 옅다. 움직임 줄이기면 제자리에 둔다.
      const drift = this.c.bridge.reducedMotion ? 0 : (time % 240) / 240;
      for (let i = 0; i < 3; i++) {
        const back = positionAt(path, Math.max(0, progress - 520 - (i + drift) * 230));
        const r = CELL_PX * (0.17 - i * 0.025), a = (1 - i * 0.25) * (1 - 0.4 * drift);
        const bx = toWorld(back.x), by = toWorld(back.y) + FOOT - r * 0.4;
        g.fillStyle(PALETTE.outline, 0.8 * a).fillEllipse(bx, by, r * 2 + 5, r * 1.3 + 5);
        g.fillStyle(DUST, a).fillEllipse(bx, by, r * 2, r * 1.3);
      }
    }
    if (st.stance) {
      g.lineStyle(7, PALETTE.outline, 0.85).strokeEllipse(x, y + FOOT, CELL_PX * 1.25, CELL_PX * 0.44);
      g.lineStyle(3.5, STANCE, 1).strokeEllipse(x, y + FOOT, CELL_PX * 1.25, CELL_PX * 0.44);
    }
    if (st.wardDots > 0) {
      const cy = y - CELL_PX * 0.92;
      for (const dx of wardDotOffsets(st.wardDots)) this.shieldDot(x + dx, cy);
    }
  }

  /** 작은 방패 점(위 네모 + 아래 뾰족), 짙은 갈색 외곽선. */
  private shieldDot(x: number, y: number) {
    const g = this.hpBars;
    g.fillStyle(PALETTE.outline, 1).fillRoundedRect(x - 5.5, y - 6, 11, 8, 2.5).fillTriangle(x - 5.5, y + 1, x + 5.5, y + 1, x, y + 7);
    g.fillStyle(WARD, 1).fillRoundedRect(x - 3.5, y - 4, 7, 5, 1.5).fillTriangle(x - 3.5, y + 0.5, x + 3.5, y + 0.5, x, y + 4.5);
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

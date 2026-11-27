import Phaser from 'phaser';
import type { SpineGameObject } from '@esotericsoftware/spine-phaser-v4';
import type { R6BattleAssets } from '../r6/BattleAssets';
import { R6_COLORS } from '../r6/manifest';
import {
  attachR6SilhouetteOutline,
  isR6VisualFlyer,
  r6EnemyScale,
  r6EnemyStridePx,
  r6FlyerShadowSpec,
  r6MaxFallingSkeletons,
  r6TurnStep,
  r6VisualFlyerLiftCells,
  r6WalkTimeScale,
} from '../r6/enemyDisplay';
import type { EnemyFootprint } from '../r6/padOutline';
import { R6_HIT_MS } from '../r6/vfxTiming';
import { positionAt } from '../../domain/geometry';
import { enemyArtId } from '../../domain/factions';
import { burrowed } from '../../domain/traits';
import type { Enemy, RunState } from '../../domain/types';
import { acceptsHit, enemyPose, HIT_MS } from '../animation/pose';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, enemyArt, type EnemyArt } from '../assets';
import { bossStatus, flyerLift, introFrame, wardDotOffsets, type BossStatus, type SpawnIntro } from './cues';
import { DEPTH, fieldPosition, r6UnitDepth, toWorld, type LayerContext } from './shared';

interface EnemyView {
  sprite: Phaser.GameObjects.Image | null; spine: EnemySpine | null; spineRevision: number; badge: Phaser.GameObjects.Image | null;
  /** 종족 특성 배지(prd-r4 §7.2 E): 원화 특성 아이콘. 특성이 없거나 그림을 못 실었으면 null. */
  trait: Phaser.GameObjects.Image | null;
  kind: Enemy['kind']; entityId: string | undefined; art: EnemyArt;
  prev: number; cur: number; phase: number; flashUntil: number; flashAt: number; hitAt: number | null;
  facing: 1 | -1; displayFacing: 1 | -1; turnStartMs: number;
  prevX: number; prevY: number; emaSpeedPx: number; hasScreenPos: boolean;
  knockUntil: number; knockDirX: number; knockDirY: number;
  /** 지금 그린 길 위 위치(월드 px, 등장 연출 포함)와 비행 몸 높이(px). 효과 층이 맞힌 자리·기믹 위치를 맞출 때 쓴다. */
  x: number; y: number; lift: number;
  /** 현재 프레임 화면 바운딩 박스(월드 px). 빈 설치 칸 가림 판정에 쓴다. */
  bounds: EnemyFootprint | null;
  /** 분열·호위 등장 연출(시작 시각 ms). */
  intro: (SpawnIntro & { start: number }) | null;
}

interface EnemySpine {
  object: SpineGameObject;
  scale: number;
  stridePx: number;
  headOffset: number;
  bounds: { width: number; height: number; left: number; top: number };
  hit: string | undefined;
  fall: string | undefined;
  poseMs: number;
}

/** 피격 점멸: 원화에 더하는 밝기(ADD, 약 25%)와 같은 적의 점멸 최소 간격(R4 PRD §9.2: 300ms에 한 번). */
const FLASH_TINT = 0x404040;
const FLASH_GAP_MS = 300;

/** 특성 배지 크기(px). 체력 막대 왼쪽 끝 옆(막대와 같은 높이)에 붙여 정예 배지·체력 막대와 겹치지 않게 한다. */
const TRAIT_BADGE_PX = 18;
/** 땅굴 속(표적이 안 되는 구간)에서 적 그림·배지·체력 막대의 투명도(prd-r4 §7.2 E). */
const BURROW_ALPHA = 0.25;

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
  private readonly spineBounds = new Map<string, { width: number; height: number; left: number; top: number }>();
  private readonly footprints: EnemyFootprint[] = [];
  /** 아직 그리지 않은 적의 등장 연출(사건이 그림보다 먼저 온다). */
  private pendingIntros = new Map<number, SpawnIntro>();
  /** 동시 낙하 재생 중인 쓰러진 Spine 스켈레톤(품질 상한 및 아웃라인 해제 관리). */
  private readonly falling = new Set<SpineGameObject>();
  private lastTick = -1;
  private lastTime: number | null = null;
  /** 체력 막대와 겹방패 점. 미니맵 카메라에서는 감춘다. */
  readonly hpBars: Phaser.GameObjects.Graphics;
  /** 땅에 붙은 표시: 비행 그림자, 방패 고리, 먼지 줄, 북소리 원. 적 그림보다 아래다. */
  private readonly ground: Phaser.GameObjects.Graphics;

  constructor(c: LayerContext, private readonly assets: R6BattleAssets | null = null) {
    this.c = c;
    this.hpBars = c.scene.add.graphics().setDepth(DEPTH.ui);
    this.ground = c.scene.add.graphics().setDepth(DEPTH.overlay + 1);
  }

  /** 새 틱이 오면 보간 구간을 한 칸 민다. */
  advance(s: RunState) {
    if (s.tick === this.lastTick) return;
    for (const e of s.enemies) {
      const v = this.enemies.get(e.id);
      if (v) { v.prev = v.cur; v.cur = e.progress; }
    }
    this.lastTick = s.tick;
  }

  /** 같은 적의 피격 효과는 120ms 안에 다시 시작하지 않는다(PRD §11.4). */
  onHit(enemyId: number) {
    const v = this.enemies.get(enemyId);
    const now = this.c.scene.time.now;
    if (this.assets && (v?.kind === 'boss' || (!v && this.c.bridge.controller.state.enemies.some(e => e.id === enemyId && e.kind === 'boss')))) {
      if (!this.c.bridge.reducedMotion && (!v || now - v.flashAt >= FLASH_GAP_MS)) {
        const { scene } = this.c;
        const camera = scene.cameras.main;
        const px = 1.35 / Math.max(.01, camera.zoom * scene.scale.zoom);
        camera.shake(75, new Phaser.Math.Vector2(px / camera.width, px / camera.height));
      }
    }
    if (!v || !acceptsHit(v.hitAt, now)) return;
    v.hitAt = now;
    const quality = this.c.bridge.controller.renderQuality.current;
    const spine = v.spine;
    if (spine?.hit && !this.c.bridge.reducedMotion && (quality < 2 || v.kind === 'boss')) {
      spine.object.animationState.setAnimation(1, spine.hit, false);
      spine.object.animationState.addEmptyAnimation(1, 0.08, 0);
    }
    if (!this.c.bridge.reducedMotion) {
      v.knockUntil = now + 120;
    }
    // 밝게 섞는 점멸은 같은 적에 300ms에 한 번만: 계속 맞는 대장이 하얀 실루엣으로 깨져 보이지 않게 한다.
    if (now - v.flashAt >= FLASH_GAP_MS) { v.flashAt = now; v.flashUntil = now + (this.assets ? R6_HIT_MS : HIT_MS); }
  }

  onBossSkill(enemyId: number) {
    const object = this.enemies.get(enemyId)?.spine?.object;
    if (!object || this.c.bridge.reducedMotion || !object.skeleton.data.findAnimation('boss-skill')) return;
    object.animationState.setAnimation(2, 'boss-skill', false);
    object.animationState.addEmptyAnimation(2, 0.08, 0);
  }

  onKill(enemyId: number) {
    const v = this.enemies.get(enemyId);
    const spine = v?.spine;
    if (!v || !spine?.fall || this.c.bridge.reducedMotion) return;
    const { object, fall } = spine;
    const quality = this.c.bridge.controller.renderQuality.current;
    object.setName(`r6:fallen:${enemyId}`);
    v.badge?.destroy();
    v.trait?.destroy();
    this.enemies.delete(enemyId);
    if (this.falling.size >= r6MaxFallingSkeletons(quality)) {
      object.animationState.timeScale = 0;
      this.falling.add(object);
      this.c.scene.tweens.add({
        targets: object, alpha: 0, duration: 150,
        onComplete: () => { this.falling.delete(object); object.destroy(); },
      });
      return;
    }
    object.animationState.clearTracks();
    object.skeleton.setupPose();
    object.animationState.timeScale = 1;
    object.animationState.setAnimation(0, fall, false);
    object.addToUpdateList();
    this.falling.add(object);
    const ms = object.skeleton.data.findAnimation(fall)!.duration * 1000;
    this.c.scene.tweens.add({
      targets: object, alpha: 0, delay: ms * 0.7, duration: ms * 0.3,
      onComplete: () => { this.falling.delete(object); object.destroy(); },
    });
  }

  /** 분열 파생체·호위병의 등장 연출을 예약한다. 그 적을 처음 그릴 때 시작한다. */
  expectIntros(intros: readonly SpawnIntro[]) {
    for (const i of intros) this.pendingIntros.set(i.enemyId, i);
  }

  /** 지금 그려진 적 그림의 위치(화상 연기 등). 없으면 null. */
  spriteAt(enemyId: number): { x: number; y: number } | null {
    const v = this.enemies.get(enemyId);
    return v?.spine?.object ?? v?.sprite ?? null;
  }

  /** 지금 그린 길 위 위치(월드 px). 아직 그리지 않은 적이면 null. */
  placeOf(enemyId: number): { x: number; y: number } | null {
    const v = this.enemies.get(enemyId);
    return v ? { x: v.x, y: v.y } : null;
  }

  /** 지금 그려진 모든 적의 발밑 Y와 바운딩 박스. GroundLayer가 빈 칸 윤곽 표시 여부에 쓴다. */
  activeFootprints(): readonly EnemyFootprint[] {
    return this.footprints;
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

  sync(s: RunState, time: number, alpha: number, delta: number) {
    const { scene, bridge } = this.c;
    const { path, balance } = bridge.controller.ctx;
    const reduced = bridge.reducedMotion;
    if (this.assets && reduced && scene.cameras.main.shakeEffect.isRunning) scene.cameras.main.shakeEffect.reset();
    const quality = bridge.controller.renderQuality.current;
    const dt = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    const seen = new Set<number>();
    this.footprints.length = 0;
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
        // 하늘 떼(flyers)는 종족의 비행 비율일 뿐이라 개체에는 배지를 달지 않는다(비행 적은 그림자·띄운 몸으로 이미 보인다).
        const traitKey = e.trait && e.trait !== 'flyers' ? ASSETS.traitBadge[e.trait] : null;
        const trait = traitKey && scene.textures.exists(traitKey) ? scene.add.image(0, 0, traitKey).setDisplaySize(TRAIT_BADGE_PX, TRAIT_BADGE_PX) : null;
        const intro = this.pendingIntros.get(e.id);
        this.pendingIntros.delete(e.id);
        // 개체마다 보행 위상을 다르게 둔다(PRD §11.3).
        const initLift = this.assets && this.c.projected
          ? r6VisualFlyerLiftCells(e.entityId, e.flying, e.groundedUntilTick > s.tick) * CELL_PX
          : flyerLift(e, s.tick) * CELL_PX;
        v = { sprite, spine: null, spineRevision: -1, badge, trait, kind: e.kind, entityId: e.entityId, art,
          prev: e.progress, cur: e.progress, phase: (e.id * 0.618034) % 1, flashUntil: 0, flashAt: -Infinity, hitAt: null,
          facing: 1, displayFacing: 1, turnStartMs: -1, prevX: 0, prevY: 0, emaSpeedPx: 0, hasScreenPos: false,
          knockUntil: 0, knockDirX: -1, knockDirY: 0,
          x: 0, y: 0, lift: initLift, bounds: null, intro: intro ? { ...intro, start: time } : null };
        this.enemies.set(e.id, v);
      }
      if (!v.spine && this.assets && v.spineRevision !== this.assets.revision) {
        v.spineRevision = this.assets.revision;
        this.addSpine(v, e);
      }
      const progress = v.prev + (v.cur - v.prev) * alpha;
      const p = positionAt(path, progress);
      const ahead = positionAt(path, Math.min(path.length, progress + 200));
      const point = fieldPosition(this.c, p.x, p.y);
      const aheadPt = fieldPosition(this.c, ahead.x, ahead.y);
      const turn = r6TurnStep(aheadPt.x - point.x, v.facing, v.displayFacing, v.turnStartMs, time, reduced);
      v.facing = turn.facing;
      v.displayFacing = turn.displayFacing;
      v.turnStartMs = turn.turnStartMs;

      const moving = v.cur !== v.prev && s.pause.length === 0;
      const dtSec = dt / 1000;
      if (v.hasScreenPos && dtSec > 0.0005 && moving) {
        const dx = point.x - v.prevX;
        const dy = point.y - v.prevY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01) {
          v.knockDirX = -dx / dist;
          v.knockDirY = -dy / dist;
        }
        const inst = dist / dtSec;
        v.emaSpeedPx = v.emaSpeedPx > 0 ? v.emaSpeedPx * 0.72 + inst * 0.28 : inst;
      } else if (!moving) {
        v.emaSpeedPx = 0;
      }
      v.prevX = point.x;
      v.prevY = point.y;
      v.hasScreenPos = true;

      let { x, y } = point;
      const knockRemaining = v.knockUntil - scene.time.now;
      if (!reduced && knockRemaining > 0) {
        const knockPx = 2 * (knockRemaining / 120);
        x += v.knockDirX * knockPx;
        y += v.knockDirY * knockPx;
      }
      const foot = this.c.projected ? 0 : FOOT;
      // 비행 몸 높이: 끌어내려지면 내려앉고 다시 떠오른다. 움직임 줄이기면 바로 바뀐다.
      const liftTarget = (this.assets && this.c.projected
        ? r6VisualFlyerLiftCells(e.entityId, e.flying, e.groundedUntilTick > s.tick)
        : flyerLift(e, s.tick)) * CELL_PX;
      v.lift = reduced || dt <= 0 ? liftTarget : v.lift + (liftTarget - v.lift) * Math.min(1, dt / LIFT_EASE_MS);
      // 등장 연출: 분열은 처치 지점에서 옆으로 튀어 제자리에 내려앉고, 호위병은 제자리에서 커지며 나타난다.
      const intro = v.intro ? introFrame(v.intro, time - v.intro.start, reduced) : null;
      if (v.intro && !intro) v.intro = null;
      let hop = 0, scaleK = 1, alphaK = 1;
      // 땅굴 속이면 흐리게(표적이 안 되는 동안). 엔진 판정과 같은 함수를 쓴다.
      const under = e.trait === 'burrow' && burrowed(balance, path, e);
      if (intro && v.intro) {
        if (v.intro.from) { const { x: fx, y: fy } = fieldPosition(this.c, v.intro.from.x, v.intro.from.y); x = fx + (x - fx) * intro.t; y = fy + (y - fy) * intro.t; }
        x += intro.sway * CELL_PX;
        hop = intro.lift * CELL_PX;
        scaleK = intro.scale;
        alphaK = intro.alpha;
      }
      if (under) alphaK *= BURROW_ALPHA;
      v.x = x; v.y = y;
      const { art } = v;
      const visualFlyer = this.assets && this.c.projected ? isR6VisualFlyer(e.entityId, e.flying) : e.flying;
      if (visualFlyer && (quality < 2 || e.kind === 'boss')) this.flyerShadow(x, y + foot, art.displayCells * scaleK, v.lift);
      else if (this.assets && this.c.projected && (quality === 0 || e.kind === 'boss')) this.groundShadow(x, y + foot, art.displayCells * scaleK, e.kind === 'boss');
      const depth = this.c.projected ? r6UnitDepth(y, 'enemy') : DEPTH.units + y + 0.5;
      if (v.spine) {
        const { object, scale, stridePx, bounds } = v.spine;
        const originY = y + foot - v.lift - hop;
        const sAbs = scale * scaleK;
        object.setPosition(x, originY).setDepth(depth)
          .setScale(turn.scaleXFactor * sAbs, sAbs).setAlpha(alphaK);
        const topPx = originY - bounds.top * sAbs;
        const leftPx = v.facing > 0 ? x + bounds.left * sAbs : x - (bounds.left + bounds.width) * sAbs;
        v.bounds = {
          footY: y,
          left: leftPx,
          top: topPx,
          right: leftPx + bounds.width * sAbs,
          bottom: topPx + bounds.height * sAbs,
        };
        this.footprints.push(v.bounds);
        object.animationState.timeScale = reduced || s.pause.length ? 0 : 1;
        const walk = object.animationState.getTrack(0);
        if (walk) {
          walk.timeScale = !moving ? 0 : v.emaSpeedPx > 0.5
            ? r6WalkTimeScale(v.emaSpeedPx, stridePx, sAbs)
            : e.speedBP / 10000;
        }
        const far = path.length - progress > 6000;
        const interval = quality < 2 || e.kind === 'boss' ? 0 : far ? 100 : 50;
        v.spine.poseMs += delta;
        if (v.spine.poseMs >= interval) {
          // 갱신을 건너뛴 시간만큼 자세를 전진시킨다. 길 위 위치는 매 프레임 위에서 따로 보간한다.
          object.updatePose(v.spine.poseMs);
          v.spine.poseMs = 0;
        }
      } else {
        // 그림 시트의 걸음은 보간된 진행 거리에 맞춘다.
        const pose = enemyPose({ kind: e.kind, phase: v.phase, time: time / 1000, speedBP: e.speedBP, moving, frames: art.frames, reducedMotion: reduced,
          distance: toWorld(progress), ...(v.hitAt === null ? {} : { hitAge: (time - v.hitAt) / 1000 }) });
        const hitKey = `${art.base}.hit`;
        const hitArt = pose.hit && scene.textures.exists(hitKey);
        const size = CELL_PX * art.displayCells * scaleK;
        const sprY = y + foot - pose.bob - v.lift - hop;
        const sprH = size * pose.squashY;
        v.sprite!.setTexture(hitArt ? hitKey : art.framed ? `${art.base}.${pose.frame}` : art.base)
          .setPosition(x, sprY).setFlipX(v.facing < 0).setDepth(depth)
          .setDisplaySize(size, sprH).setAlpha(alphaK);
        const leftPx = x - art.originX * size;
        const topPx = sprY - art.originY * sprH;
        v.bounds = { footY: y, left: leftPx, top: topPx, right: leftPx + size, bottom: topPx + sprH };
        this.footprints.push(v.bounds);
        if (!this.assets) this.tint(v, e, time, hitArt);
      }
      const top = y - v.lift - hop;
      if (this.assets) {
        // v2 전투에서 감속은 냉각 중계탑의 타격에서만 적용된다. 피격 하이라이트는 0-패스 ADD 틴트로 처리하므로 대괄호 표시는 생략한다.
        const frost = e.slows.some(slow => slow.untilTick > s.tick);
        if (frost) this.r6Marks(x, top, e.kind === 'boss', false, frost, alphaK);
      }
      if (v.badge) v.badge.setPosition(x, top - CELL_PX * (e.kind === 'boss' ? 0.86 : 0.5)).setDepth(DEPTH.units + y + 0.6).setAlpha(alphaK);
      // 특성 배지: 체력 막대(폭 28px) 왼쪽 옆, 막대 높이. 대장에게는 붙지 않는다.
      if (v.trait) v.trait.setPosition(x - 14 - TRAIT_BADGE_PX / 2 - 2, top - CELL_PX * 0.44 + 2).setDepth(DEPTH.ui).setAlpha(alphaK);
      const status = bossStatus(balance, e, s.tick);
      if (status) this.bossMarks(status, x, y, progress, time, moving);
      const boss = e.kind === 'boss';
      const r6Boss = Boolean(this.assets && boss);
      if (e.hp < e.maxHp || r6Boss) {
        const w = boss ? 44 : 28, bx = x - w / 2;
        const bossBarY = top + foot - (v.spine?.headOffset ?? CELL_PX * .78) - 9;
        const by = r6Boss ? Math.max(scene.cameras.main.worldView.y + 4, bossBarY) : top - CELL_PX * (boss ? .78 : .44);
        const k = under ? BURROW_ALPHA : 1;
        this.hpBars.fillStyle(PALETTE.outline, 0.9 * k).fillRect(bx - 1, by - 1, w + 2, 6).fillStyle(this.assets ? R6_COLORS.amber : 0xd94f3d, k).fillRect(bx, by, Math.max(1, (w * e.hp) / e.maxHp), 4);
        if (r6Boss) {
          this.hpBars.fillStyle(R6_COLORS.carbon, 1).fillTriangle(bx - 13, by - 2, bx - 2, by - 2, bx - 7.5, by + 8);
          this.hpBars.fillStyle(R6_COLORS.amber, 1).fillTriangle(bx - 11, by - 1, bx - 4, by - 1, bx - 7.5, by + 5);
        }
      }
    }
    for (const [id, v] of this.enemies) if (!seen.has(id)) { v.sprite?.destroy(); v.spine?.object.destroy(); v.badge?.destroy(); v.trait?.destroy(); this.enemies.delete(id); }
    // 그려지기 전에 사라진 적(같은 틱 처치 등)의 예약은 버린다.
    for (const id of this.pendingIntros.keys()) if (!s.enemies.some(e => e.id === id)) this.pendingIntros.delete(id);
  }

  /** 흰 외곽선과 냉기 결정을 그린다. 면을 덮지 않아 Spine과 대역 그림에 같은 표시를 쓴다. */
  private r6Marks(x: number, footY: number, boss: boolean, flash: boolean, frost: boolean, alpha: number) {
    const half = boss ? 25 : 15;
    const bottom = footY + 1;
    const top = footY - (boss ? 42 : 26);
    const g = this.hpBars;
    if (flash) {
      g.lineStyle(1.5, 0xffffff, alpha);
      for (const side of [-1, 1]) {
        const edge = x + half * side;
        const inner = edge - 5 * side;
        g.beginPath().moveTo(inner, top).lineTo(edge, top + 4).lineTo(edge, top + 8).strokePath();
        g.beginPath().moveTo(edge, bottom - 7).lineTo(edge, bottom - 3).lineTo(inner, bottom).strokePath();
      }
    }
    if (frost) {
      const cx = x + half * .78, cy = top + 4;
      g.fillStyle(R6_COLORS.teal, alpha).fillTriangle(cx, cy - 6, cx + 4, cy, cx, cy + 6)
        .fillTriangle(cx, cy - 6, cx - 4, cy, cx, cy + 6);
      g.lineStyle(1, R6_COLORS.silver, alpha).lineBetween(cx - 2, cy + 1, cx, cy - 3);
    }
  }

  private addSpine(v: EnemyView, enemy: Enemy) {
    const art = this.assets?.enemyArt(enemy);
    if (!art) return;
    const { scene, bridge } = this.c;
    let object: SpineGameObject | undefined;
    try {
      const data = scene.spine.getSkeletonData(art.data, art.atlas);
      if (!data.findSkin(art.skin) || !data.findAnimation(art.rig.walk)) return;
      object = scene.add.spine(0, 0, art.data, art.atlas, { renderer: 'phaser' }).setName(`r6:enemy:${enemy.id}`);
      object.removeFromUpdateList();
      if (this.c.projected) {
        const fallenRef = object;
        attachR6SilhouetteOutline(object, scene, () => bridge.controller.renderQuality.current, {
          entityId: enemy.entityId,
          getHitFlash: () => (scene.time.now < v.flashUntil ? 1 : 0),
          isFalling: () => this.falling.has(fallenRef),
        });
      }
      object.skeleton.setSkin(art.skin);
      object.skeleton.setupPoseSlots();
      const boundsKey = art.data + ':' + art.skin;
      let bounds = this.spineBounds.get(boundsKey);
      if (!bounds) {
        object.updatePose(0);
        const setup = object.skeleton.getBoundsRect();
        // Phaser용 Spine은 Y축이 아래로 증가한다.
        bounds = { width: setup.width, height: setup.height, left: setup.x, top: -setup.y };
        this.spineBounds.set(boundsKey, bounds);
      }
      const baseScale = art.scale * (enemy.derived ? 0.8 : 1);
      const scale = this.c.projected ? r6EnemyScale(baseScale, bounds.height, enemy.kind === 'boss') : baseScale;
      object.animationState.setAnimation(0, art.rig.walk, true).trackTime = bridge.reducedMotion ? 0 : v.phase;
      object.updatePose(0);
      v.spine = {
        object,
        scale,
        stridePx: r6EnemyStridePx(enemy.entityId),
        headOffset: bounds.top * scale,
        bounds,
        hit: art.rig.hit && data.findAnimation(art.rig.hit) ? art.rig.hit : undefined,
        fall: art.rig.fall && data.findAnimation(art.rig.fall) ? art.rig.fall : undefined,
        poseMs: 0,
      };
      v.sprite?.destroy();
      v.sprite = null;
    } catch {
      object?.destroy();
    }
  }

  /** 비행 적의 땅 그림자: 몸이 높을수록 조금 작고 옅다. R6에서는 1px 이중 테두리를 절제해 본체에 붙여 보인다. */
  private flyerShadow(x: number, footY: number, cells: number, lift: number) {
    if (this.assets && this.c.projected) {
      const spec = r6FlyerShadowSpec(cells, lift, CELL_PX);
      const sy = footY + spec.offsetY;
      this.ground.fillStyle(R6_COLORS.carbon, spec.fillAlpha).fillEllipse(x, sy, spec.width, spec.height);
      this.ground.lineStyle(1, R6_COLORS.carbon, spec.outerAlpha).strokeEllipse(x, sy, spec.width, spec.height);
      if (spec.width > 8 && spec.height > 4) {
        this.ground.lineStyle(1, R6_COLORS.teal, spec.tealAlpha).strokeEllipse(x, sy, spec.width - 4, spec.height - 2.5);
      }
      return;
    }
    const k = 1 - 0.25 * Math.min(1, lift / (CELL_PX * 0.28));
    const w = CELL_PX * cells * 0.62 * k;
    const h = CELL_PX * 0.17 * k;
    this.ground.fillStyle(PALETTE.outline, 0.3 * k + 0.05).fillEllipse(x, footY, w, h);
  }

  /** 지상 R6 적의 발밑 접지 그림자: 발 크기에 맞춰 작고 옅게 깔아 번잡함을 덜어 낸다. */
  private groundShadow(x: number, footY: number, cells: number, boss: boolean) {
    const w = CELL_PX * Math.min(boss ? 0.74 : 0.44, cells * 0.36);
    const h = CELL_PX * (boss ? 0.14 : 0.09);
    this.ground.fillStyle(R6_COLORS.carbon, 0.24).fillEllipse(x, footY, w, h);
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
        const backPoint = fieldPosition(this.c, back.x, back.y);
        const bx = backPoint.x, by = backPoint.y + (this.c.projected ? 0 : FOOT) - r * 0.4;
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

  /** 피격 점멸은 흰색 채움 대신 밝기만 더한다. 피격 원화가 있으면 그 그림이 피격을 보여 주므로 덮지 않는다. */
  private tint(v: EnemyView, e: Enemy, time: number, hitArt: boolean) {
    if (time < v.flashUntil && !hitArt) { v.sprite!.setTint(FLASH_TINT).setTintMode(Phaser.TintModes.ADD); return; }
    v.sprite!.setTintMode(Phaser.TintModes.MULTIPLY);
    if (e.slows.some(x => x.untilTick > this.c.bridge.controller.state.tick)) v.sprite!.setTint(0xb9e2ff);
    else v.sprite!.clearTint();
  }
}

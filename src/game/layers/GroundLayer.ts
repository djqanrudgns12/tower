import type Phaser from 'phaser';
import type { RunState } from '../../domain/types';
import { DEFAULTS } from '../../content';
import { composeGroundArt, drawGround, isTreeCell, slotBaseSprites } from '../art';
import { ASSETS, CELL_PX, TEX, WORLD_H, WORLD_W } from '../assets';
import { composeLayoutGround, padSprites, type PadSprite } from '../layoutGround';
import { claimedDecorations, layoutFor, resolvePlacements, steleOriginY, type MapLayout, type PlacedArt } from '../layouts';
import { PAD_FADE_MS, isPlacing, padAlpha } from './cues';
import { selectedCell } from './InputLayer';
import {
  R6_AURA_KEY,
  R6_GATE_BACK_KEY,
  R6_GATE_FRONT_KEY,
  R6_GROUND_KEY,
  R6_PAD_KEY,
  type R6BattleAssets,
} from '../r6/BattleAssets';
import { biomeForGrade, mapPhase } from '../r6/mapPhase';
import { projectField, R6_MAP_SQUASH, r6Overview, r6Pad } from '../r6/mapProjection';
import { R6_COLORS } from '../r6/manifest';
import {
  padCornerSegments,
  padOcclusionRatio,
  padSamplePoints,
  R6_PAD_OCCLUSION_THRESHOLD,
  R6_PAD_OUTLINE_COLOR,
  R6_PAD_OUTLINE_RADIUS_RATIO,
  type EnemyFootprint,
  type PadSamplePoint,
} from '../r6/padOutline';
import { DEPTH, r6UnitDepth, type LayerContext } from './shared';

/** deco.stele.r1 원화에서 비석 면 가운데의 세로 위치(원화 높이 대비, 면은 약 28~130/192px). */
const STELE_FACE_Y = 0.41;

const MAX_AURA_PARTICLES = 24;

const BIOME_BACKDROP: Record<'meadow' | 'river' | 'ochre' | 'snow', { day: number; dark: number }> = {
  meadow: { day: 0x8fb363, dark: 0x18221b },
  river: { day: 0x5c908b, dark: 0x152226 },
  ochre: { day: 0xb59565, dark: 0x241d15 },
  snow: { day: 0xb9cddc, dark: 0x18222c },
};

/** 16진 sRGB 두 색을 비율 t(0..1)로 보간한다. */
function lerpRgb(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * k);
  const g = Math.round(((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * k);
  const b = Math.round((from & 0xff) + ((to & 0xff) - (from & 0xff)) * k);
  return (r << 16) | (g << 8) | b;
}

/** 지면 층: 바닥 그림, 설치 받침(따로 세워 투명도를 바꾼다), 나무·바위·비석·성문 원화, 웨이브 무드 색층. */
export class GroundLayer {
  private readonly c: LayerContext;
  private readonly assets: R6BattleAssets | null;
  private mood?: Phaser.GameObjects.Rectangle;
  private moodWave = -1;
  private has = { gate: false, tree: false, stele: false, rock: false };
  /** 이번 지면을 배치표로 조립했으면 그 배치표. 없으면 기존 지면(되돌림 경로). */
  private layout: MapLayout | null = null;
  /** 지면에 굽지 않고 따로 세운 설치 받침(자리 id → 그림). 받침이 구운 지면에 섞인 경로(인수 지면·임시 그림)에서는 비어 있다. */
  private pads = new Map<string, Phaser.GameObjects.Image>();
  private padList: PadSprite[] = [];
  private activePad: string | null = null;
  private padOutlines: Phaser.GameObjects.Graphics | null = null;
  private r6Slots: Array<{ id: string; x: number; y: number; samples: readonly PadSamplePoint[] }> = [];
  private r6OutlinesActive = false;
  private r6Backdrop: Phaser.GameObjects.Rectangle | null = null;
  private r6Ground: Phaser.GameObjects.Image | null = null;
  private r6HasOverviewCrop = false;
  private gateBack: Phaser.GameObjects.Image | null = null;
  private gateFront: Phaser.GameObjects.Image | null = null;
  private auraPool: Array<{
    sprite: Phaser.GameObjects.Image;
    baseX: number;
    baseY: number;
    phase: number;
    speed: number;
  }> = [];
  private phaseWave = -1;
  private currentTintRgb = 0xffffff;
  private targetTintRgb = 0xffffff;
  private targetAuraCount = 0;
  private targetBossAlert = false;

  constructor(c: LayerContext, assets: R6BattleAssets | null = null) {
    this.c = c;
    this.assets = assets;
  }

  /**
   * 인수된 성문·나무·비석·바위 원화가 있으면 지면에 굽지 않고 이미지로 세운다. 맵 배치표와 ART-R1 재료가 있으면 배치표로,
   * 아니면 바닥 재료(ART-002)로, 그것도 없으면 임시 그림으로 지면을 조립한다.
   */
  bake() {
    const { scene } = this.c;
    const map = this.c.bridge.controller.ctx.map;
    const t = scene.textures;
    this.has = { gate: t.exists('map.gate'), tree: t.exists('deco.tree'), stele: t.exists('deco.stele'), rock: t.exists('deco.rock') };
    if (t.exists(R6_GROUND_KEY) || t.exists(ASSETS.ground.key)) return;
    const layout = layoutFor(map.id);
    if (layout && composeLayoutGround(scene, map, layout)) { this.layout = layout; this.padList = padSprites(scene, map); return; }
    if (composeGroundArt(scene, map)) this.padList = slotBaseSprites(scene, map);
    else drawGround(scene, map, this.has);
  }

  build() {
    const { scene, bridge } = this.c;
    const map = bridge.controller.ctx.map;
    if (scene.textures.exists(R6_GROUND_KEY)) {
      const meta = this.assets?.mapMeta;
      this.r6HasOverviewCrop = Boolean(meta);
      const biome = biomeForGrade(map.grade);
      const bgHex = BIOME_BACKDROP[biome][bridge.lightTheme ? 'day' : 'dark'];
      if (this.c.projected) {
        this.r6Backdrop = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, bgHex, 1)
          .setOrigin(0).setDepth(DEPTH.ground - 1);
      }
      const gx = meta ? r6Overview.x : 0;
      const gy = meta ? r6Overview.y : 0;
      const gw = meta ? r6Overview.width : WORLD_W;
      const gh = meta ? r6Overview.height : WORLD_H;
      this.r6Ground = scene.add.image(gx, gy, R6_GROUND_KEY).setOrigin(0).setDisplaySize(gw, gh).setDepth(DEPTH.ground);
      if (this.c.projected) this.drawR6Directions(map.pathCells);
      if (this.c.projected && scene.textures.exists(R6_PAD_KEY)) {
        this.padOutlines = scene.add.graphics().setDepth(DEPTH.r6Marks).setName('r6:pad-outlines');
        const radius = r6Pad.radius * R6_PAD_OUTLINE_RADIUS_RATIO;
        this.r6Slots = [];
        for (const slot of map.slots) {
          const p = projectField((slot.x + 0.5) * CELL_PX, (slot.y + 0.5) * CELL_PX);
          const pad = scene.add.image(p.x, p.y, R6_PAD_KEY, 0)
            .setDisplaySize(r6Pad.size[0]!, r6Pad.size[1]!)
            .setOrigin(r6Pad.pivot[0]! / r6Pad.size[0]!, r6Pad.pivot[1]! / r6Pad.size[1]!)
            .setDepth(r6UnitDepth(p.y, 'pad')).setName(`r6:pad:${slot.id}`);
          this.pads.set(slot.id, pad);
          this.r6Slots.push({
            id: slot.id,
            x: p.x,
            y: p.y,
            samples: padSamplePoints(p.x, p.y, radius, R6_MAP_SQUASH),
          });
        }
      }
      if (this.c.projected && meta) {
        if (scene.textures.exists(R6_GATE_BACK_KEY)) {
          this.gateBack = scene.add.image(meta.gateBack.worldX, meta.gateBack.worldY, R6_GATE_BACK_KEY)
            .setOrigin(0)
            .setDisplaySize(meta.gateBack.displayW, meta.gateBack.displayH)
            .setDepth(DEPTH.units + meta.gatePlaneY - 0.5)
            .setName('r6:gate:back');
        }
        if (scene.textures.exists(R6_GATE_FRONT_KEY)) {
          this.gateFront = scene.add.image(meta.gateFront.worldX, meta.gateFront.worldY, R6_GATE_FRONT_KEY)
            .setOrigin(0)
            .setDisplaySize(meta.gateFront.displayW, meta.gateFront.displayH)
            .setDepth(DEPTH.units + meta.gatePlaneY + 18)
            .setName('r6:gate:front');
        }
        if (scene.textures.exists(R6_AURA_KEY)) {
          for (let i = 0; i < MAX_AURA_PARTICLES; i++) {
            const cols = 6;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const baseX = r6Overview.x + ((col + 0.5 + ((i * 37) % 10) * 0.03) / cols) * r6Overview.width;
            const baseY = r6Overview.y + ((row + 0.5 + ((i * 53) % 10) * 0.03) / 4) * r6Overview.height;
            const sprite = scene.add.image(baseX, baseY, R6_AURA_KEY, i % 4)
              .setDisplaySize(26 + (i % 3) * 10, 26 + (i % 3) * 10)
              .setDepth(DEPTH.ground + 0.5)
              .setVisible(false);
            this.auraPool.push({
              sprite,
              baseX,
              baseY,
              phase: i * 0.71,
              speed: 0.45 + (i % 5) * 0.12,
            });
          }
        }
      }
      return;
    }
    scene.add.image(0, 0, ASSETS.ground.key).setOrigin(0).setScale(1 / TEX).setDepth(DEPTH.ground);
    // 설치 받침은 지면 바로 위(웨이브 무드 색층 아래)에 따로 세운다. 처음에는 평소 투명도(흐리게)다.
    for (const p of this.padList) this.pads.set(p.slotId, scene.add.image(p.x, p.y, p.key).setOrigin(p.originX, p.originY).setScale(p.scale).setDepth(DEPTH.ground + 0.5).setAlpha(padAlpha({ occupied: false, placing: false, focused: false, highContrast: false })));
    const decor = new Map<string, Phaser.GameObjects.Image>();
    // 배치표가 맡은 장식 칸(정원: 연못·바위 정원)에는 기본 나무·바위를 세우지 않는다.
    const claimed = this.layout ? claimedDecorations(this.layout) : new Set<string>();
    for (const d of map.decorations) {
      if (claimed.has(d.id)) continue;
      const [dx, dy] = d.cells[0]!;
      const key = d.kind === 'culture' ? 'deco.stele' : isTreeCell(dx, dy) ? 'deco.tree' : 'deco.rock';
      if (scene.textures.exists(key)) decor.set(`${dx},${dy}`, this.placeDecor(key, dx, dy));
    }
    if (this.has.gate) this.placeDecor('map.gate', map.exitCell[0], map.exitCell[1]);
    // 가장자리 숲·덤불(ART-R2)과 안쪽 숲 덩이는 키 큰 그림이라 지면에 굽지 않고 깊이 정렬 이미지로 세운다.
    if (this.layout) for (const p of resolvePlacements(this.layout, map)) if ((p.kind === 'edge' || p.kind === 'grove') && scene.textures.exists(p.asset)) this.placeArt(p);
    for (const d of map.decorations) if (d.kind === 'culture') {
      const [x, y] = d.cells[0]!;
      // 원화 비석은 칸보다 위로 솟아 있으므로 비석 면 가운데에 새기고, 비석 바로 위 깊이에 둔다.
      const art = decor.get(`${x},${y}`);
      const glyphY = art ? art.y - (art.originY - STELE_FACE_Y) * art.displayHeight : (y + 0.42) * CELL_PX;
      scene.add.text((x + 0.5) * CELL_PX, glyphY, '가', { fontFamily: 'Pretendard Variable, Pretendard, sans-serif', fontSize: '20px', fontStyle: '700', color: '#463c35', resolution: 2 }).setOrigin(0.5).setDepth(art ? art.depth + 0.1 : DEPTH.overlay);
    }
    this.mood = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff, 0).setOrigin(0).setDepth(DEPTH.mood);
  }

  /** 긴 직선마다 한 개씩, 길 중심에서 비켜난 방향 표시를 그린다. */
  private drawR6Directions(path: ReadonlyArray<readonly [number, number]>) {
    const marks = this.c.scene.add.graphics().setDepth(DEPTH.r6Marks).setName('r6:route');
    for (let start = 0, end = 1; end < path.length; start = end - 1) {
      const [x, y] = path[start]!;
      const [nx, ny] = path[end]!;
      const dx = nx - x, dy = ny - y;
      while (end < path.length && path[end]![0] === x + dx * (end - start) &&
        path[end]![1] === y + dy * (end - start)) end++;
      const steps = end - start - 1;
      if (steps < 3) continue;
      const mid = steps / 2;
      const centerX = x + .5 + mid * dx - dy * .31;
      const centerY = y + .5 + mid * dy + dx * .31;
      const at = (along: number, across: number) => projectField(
        (centerX + dx * along - dy * across) * CELL_PX, (centerY + dy * along + dx * across) * CELL_PX);
      const a = at(-.10, -.10), b = at(.08, 0), c = at(-.10, .10);
      for (const [weight, color] of [[3, R6_COLORS.carbon], [1.4, R6_COLORS.silver]] as const) {
        marks.lineStyle(weight, color).beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).strokePath();
      }
    }
  }

  private placeDecor(key: string, x: number, y: number) {
    const img = this.c.scene.add.image((x + 0.5) * CELL_PX, (y + 0.5) * CELL_PX, key);
    const src = img.texture.getSourceImage() as { width: number; height: number };
    const cells = key === 'map.gate' ? 1.8 : 1.05;
    return img.setOrigin(0.5, key === 'map.gate' ? 0.75 : key === 'deco.stele' ? steleOriginY(y) : 0.85).setDisplaySize(CELL_PX * cells, (CELL_PX * cells * src.height) / src.width).setDepth(DEPTH.units + (y + 0.5) * CELL_PX);
  }

  private placeArt(p: PlacedArt) {
    const img = this.c.scene.add.image(p.cx * CELL_PX, p.cy * CELL_PX, p.asset);
    const src = img.texture.getSourceImage() as { width: number; height: number };
    const w = p.w * CELL_PX;
    // 맵 위쪽 밖에 기준점이 있는 조각도 지면 위에 오도록 깊이는 맵 안쪽(0칸 이상)으로 자른다.
    return img.setOrigin(p.ox, p.oy).setDisplaySize(w, (w * src.height) / src.width).setDepth(DEPTH.units + Math.max(0, p.cy) * CELL_PX);
  }

  /**
   * 설치 받침 밝기: 평소 흐리게, 타워를 고르거나 끌어 놓는 동안에만 밝게(cues.padAlpha). 타워가 선 받침·선택·키보드 커서·고대비 설정이면 늘 밝다.
   * 움직임 줄이기면 바로 바뀌고, 아니면 PAD_FADE_MS 동안 부드럽게 바뀐다. 받침이 구운 지면에 섞인 경로에서는 할 일이 없다.
   */
  syncPads(s: RunState, deltaMs: number, enemies: readonly EnemyFootprint[] = []) {
    if (this.pads.size === 0) return;
    const { bridge } = this.c;
    if (this.c.projected) {
      const id = bridge.drag ? bridge.drag.slotId : selectedCell(bridge)?.id ?? null;
      if (id !== this.activePad) {
        if (this.activePad) this.pads.get(this.activePad)?.setFrame(0);
        if (id) this.pads.get(id)?.setFrame(1);
        this.activePad = id;
      }
      this.syncR6PadOutlines(s, enemies);
      return;
    }
    const placing = isPlacing(s.phase, bridge.selection, Boolean(bridge.drag));
    const occupied = new Set(s.towers.map(t => t.slotId));
    const focus = new Set([selectedCell(bridge)?.id, bridge.keyboardSlotId, bridge.drag?.slotId]);
    const highContrast = Boolean((bridge as { highContrastMap?: boolean }).highContrastMap);
    const step = bridge.reducedMotion || bridge.controller.renderQuality.current >= 2 ? 1 : Math.min(1, deltaMs / PAD_FADE_MS);
    for (const [slotId, img] of this.pads) {
      const target = padAlpha({ occupied: occupied.has(slotId), placing, focused: focus.has(slotId), highContrast });
      const d = target - img.alpha;
      if (Math.abs(d) > 0.004) img.setAlpha(Math.abs(d) <= step ? target : img.alpha + Math.sign(d) * step);
    }
  }

  /**
   * 비어 있는 설치 칸이 앞쪽 적에게 50% 넘게 가려질 때만 R04 1px 짧은 모서리 표식을 그린다.
   * 이미 타워가 놓인 칸과 50% 이하 가림 칸에는 그리지 않는다.
   */
  private syncR6PadOutlines(s: RunState, enemies: readonly EnemyFootprint[]) {
    if (!this.padOutlines || this.r6Slots.length === 0) return;
    if (this.r6OutlinesActive) {
      this.padOutlines.clear();
      this.r6OutlinesActive = false;
    }
    if (enemies.length === 0) return;
    const occupied = new Set(s.towers.map(t => t.slotId));
    const radius = r6Pad.radius * R6_PAD_OUTLINE_RADIUS_RATIO;
    for (const slot of this.r6Slots) {
      if (occupied.has(slot.id)) continue;
      if (padOcclusionRatio(slot.y, slot.samples, enemies) <= R6_PAD_OCCLUSION_THRESHOLD) continue;
      const segments = padCornerSegments(slot.x, slot.y, radius, R6_MAP_SQUASH, slot.y, enemies);
      for (const seg of segments) {
        this.padOutlines
          .lineStyle(1, R6_PAD_OUTLINE_COLOR, seg.alpha)
          .beginPath()
          .moveTo(seg.x1, seg.y1)
          .lineTo(seg.x2, seg.y2)
          .strokePath();
      }
      this.r6OutlinesActive = true;
    }
  }

  /** 웨이브 무드: 지면 위 약한 색층 또는 V2 5웨이브 규격 아우라를 바꾼다(PRD §11.5). */
  applyMood(immediate: boolean) {
    const { scene, bridge } = this.c;
    if (this.c.projected && this.r6Ground) {
      const wave = Math.max(1, bridge.controller.state.wave);
      const grade = bridge.controller.ctx.map.grade;
      if (wave === this.phaseWave && !immediate) return;
      this.phaseWave = wave;
      const spec = mapPhase(wave, grade);
      this.targetTintRgb = spec.terrainTint;
      this.targetAuraCount = spec.particleCount;
      this.targetBossAlert = spec.bossAlert;
      if (immediate || bridge.reducedMotion || bridge.controller.renderQuality.current >= 2) {
        this.currentTintRgb = this.targetTintRgb;
        this.r6Ground.setTint(this.currentTintRgb);
      }
      for (let i = 0; i < this.auraPool.length; i++) {
        const entry = this.auraPool[i]!;
        entry.sprite.setFrame(spec.auraFrame).setTint(spec.auraColor);
      }
      return;
    }
    const mood = this.mood;
    if (!mood) return;
    const wave = Math.max(1, bridge.controller.state.wave);
    if (wave === this.moodWave) return;
    this.moodWave = wave;
    const entry = DEFAULTS.mood.entries[(wave - 1) % 5]!;
    const color = entry.tint ? Number.parseInt(entry.tint.slice(1), 16) : 0xffffff;
    scene.tweens.killTweensOf(mood);
    if (immediate || bridge.reducedMotion || bridge.controller.renderQuality.current >= 2) { mood.setFillStyle(color, entry.alpha); return; }
    scene.tweens.add({ targets: mood, fillAlpha: 0, duration: 300, onComplete: () => { mood.setFillStyle(color, 0); scene.tweens.add({ targets: mood, fillAlpha: entry.alpha, duration: 300 }); } });
  }

  /** 주간/야간 지형 텍스처를 교체한다. */
  setGroundTexture(key: string, grade: number, lightTheme: boolean) {
    if (!this.r6Ground) return;
    const gw = this.r6HasOverviewCrop ? r6Overview.width : WORLD_W;
    const gh = this.r6HasOverviewCrop ? r6Overview.height : WORLD_H;
    this.r6Ground.setTexture(key).setDisplaySize(gw, gh).setTint(this.currentTintRgb);
    if (this.r6Backdrop) {
      const biome = biomeForGrade(grade);
      this.r6Backdrop.setFillStyle(BIOME_BACKDROP[biome][lightTheme ? 'day' : 'dark'], 1);
    }
  }

  /** V2 지형 광원 보간·아우라 입자 부유·5웨이브 보스 성문 펄스를 갱신한다. */
  syncAtmosphere(timeMs: number, deltaMs: number, phase: string) {
    if (!this.c.projected || !this.r6Ground) return;
    const { bridge } = this.c;
    const lowQuality = bridge.controller.renderQuality.current >= 2;
    const reduced = bridge.reducedMotion;
    if (this.currentTintRgb !== this.targetTintRgb) {
      this.currentTintRgb = reduced || lowQuality
        ? this.targetTintRgb
        : lerpRgb(this.currentTintRgb, this.targetTintRgb, Math.min(1, deltaMs / 450));
      this.r6Ground.setTint(this.currentTintRgb);
    }
    const activeCount = lowQuality ? 0 : Math.min(this.auraPool.length, this.targetAuraCount);
    const tSec = timeMs / 1000;
    for (let i = 0; i < this.auraPool.length; i++) {
      const item = this.auraPool[i]!;
      if (i >= activeCount) {
        if (item.sprite.visible) item.sprite.setVisible(false);
        continue;
      }
      if (!item.sprite.visible) item.sprite.setVisible(true);
      if (reduced) {
        item.sprite.setPosition(item.baseX, item.baseY).setAlpha(0.14);
      } else {
        const driftX = Math.sin(tSec * item.speed + item.phase) * 10;
        const driftY = Math.cos(tSec * item.speed * 0.8 + item.phase) * 6;
        const alpha = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(tSec * 1.4 + item.phase));
        item.sprite.setPosition(item.baseX + driftX, item.baseY + driftY).setAlpha(alpha);
      }
    }
    if (this.gateBack && this.gateFront) {
      if (this.targetBossAlert && phase === 'PREP_QUIZ' && !reduced) {
        // 5의 배수 웨이브 준비 단계에서 1.2Hz(<3Hz) 약한 청록·호박 펄스로 보스 출현을 예고한다.
        const pulse = 0.5 + 0.5 * Math.sin(tSec * 1.2 * Math.PI * 2);
        const tint = lerpRgb(0xffffff, 0xbef5ee, pulse * 0.45);
        this.gateBack.setTint(tint);
        this.gateFront.setTint(tint);
      } else {
        this.gateBack.clearTint();
        this.gateFront.clearTint();
      }
    }
  }
}

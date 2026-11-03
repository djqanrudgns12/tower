import type Phaser from 'phaser';
import {
  butterflyBounds, butterflySpecs, butterflyStep, CLOUD_ALPHA, cloudSpecs, cloudStep, rippleFrame, RIPPLE_COUNT, rng, ambientSeed,
  timeOfDay, waterSpots, type Bounds, type CloudSpec, type Tint, type Wanderer, type WaterSpot,
} from '../ambient';
import { CELL_PX, WORLD_H, WORLD_W } from '../assets';
import { layoutFor } from '../layouts';
import { DEPTH, type LayerContext } from './shared';

/** 시간 색조가 목표 색으로 가는 시간(ms). 웨이브가 바뀔 때만 움직이고, 움직임 줄이기면 바로 바뀐다. */
const TINT_FADE_MS = 1500;
const RIPPLE_REDRAW_MS = 33;
/** 나비 날개 하나의 보이는 너비(월드 px)와 색(곱하기 색조). */
const BUTTERFLY_PX = 19;
const BUTTERFLY_TINTS = [0xfff1a8, 0xffc0cf, 0xb4dcff, 0xffc7a0] as const;
const CLOUD_KEY = 'ambient.cloud', BUTTERFLY_KEY = 'ambient.butterfly', BUTTERFLY_TEX_W = 40;

const split = (c: number) => ({ r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 });

/**
 * 살아 있는 분위기 층(은은하게, 개체 수 적게): 정원 위로 느리게 지나가는 구름 그림자, 나비 몇 마리, 물 위 잔물결,
 * 웨이브에 따라 아침 → 노을 → 밤으로 아주 약하게 바뀌는 전체 색조. 도메인 상태는 웨이브 번호와 일시정지만 읽는다.
 * 구름 그림자·잔물결은 지면 바로 위(타워·적·길 위 장식 아래)에만 그려 적·타워·길의 가독성을 해치지 않고, 색조 층은 투사체·효과 아래다.
 * 움직임 줄이기면 구름·나비·잔물결을 그리지 않고 색조만 바로 바꾼다(ui-rules-v2 §2).
 */
export class AmbientLayer {
  private readonly c: LayerContext;
  private readonly clouds: Array<{ spec: CloudSpec; img: Phaser.GameObjects.Image }> = [];
  private readonly flies: Array<{ spec: Wanderer; img: Phaser.GameObjects.Image; phase: number }> = [];
  private readonly bounds: Bounds;
  private readonly rand: () => number;
  private readonly water: WaterSpot[];
  private readonly ripples: Phaser.GameObjects.Graphics;
  private readonly tint: Phaser.GameObjects.Rectangle;
  private now = { r: 255, g: 255, b: 255, a: 0 };
  private wave = -1;
  private target: Tint = { color: 0xffffff, alpha: 0 };
  private clockMs = 0;
  private paintedColor = -1;
  private paintedAlpha = -1;
  /** 잔물결은 느려서 초당 약 30번만 다시 그린다(크롬북 부담을 줄인다). */
  private rippleAt = -1000;

  constructor(c: LayerContext) {
    this.c = c;
    const { scene, bridge } = c;
    const map = bridge.controller.ctx.map;
    this.makeTextures();
    this.bounds = butterflyBounds(WORLD_W, WORLD_H, CELL_PX);
    this.rand = rng(ambientSeed(map.id, 'flight'));
    for (const spec of cloudSpecs(map.id, WORLD_W, WORLD_H, CELL_PX)) {
      this.clouds.push({ spec, img: scene.add.image(spec.x, spec.y, CLOUD_KEY).setDisplaySize(spec.w, spec.h).setAlpha(CLOUD_ALPHA).setDepth(DEPTH.mood + 0.5) });
    }
    butterflySpecs(map.id, this.bounds, CELL_PX).forEach((spec, i) => {
      const img = scene.add.image(spec.x, spec.y, BUTTERFLY_KEY).setTint(BUTTERFLY_TINTS[i % BUTTERFLY_TINTS.length]!);
      this.flies.push({ spec, img, phase: i * 2.1 });
    });
    this.water = waterSpots(layoutFor(map.id), map, CELL_PX, asset => {
      if (!scene.textures.exists(asset)) return null;
      const src = scene.textures.get(asset).getSourceImage() as { width: number; height: number };
      return { width: src.width, height: src.height };
    });
    this.ripples = scene.add.graphics().setDepth(DEPTH.mood + 0.2);
    this.tint = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff, 0).setOrigin(0).setDepth(DEPTH.projectiles - 1);
    this.syncTint(0, true);
    this.apply(0, bridge.reducedMotion);
  }

  /** 구름 그림자(바깥이 옅은 큰 타원)와 나비(위에서 본 날개 네 장)의 임시 그림. 같은 키가 이미 있으면 다시 만들지 않는다. */
  private makeTextures() {
    const t = this.c.scene.textures;
    if (!t.exists(CLOUD_KEY)) {
      const tex = t.createCanvas(CLOUD_KEY, 256, 128);
      if (tex) {
        const g = tex.getContext();
        g.save();
        g.translate(128, 64);
        g.scale(1, 0.5);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, 128);
        grad.addColorStop(0, 'rgba(30,48,26,0.95)');
        grad.addColorStop(0.55, 'rgba(30,48,26,0.6)');
        grad.addColorStop(1, 'rgba(30,48,26,0)');
        g.fillStyle = grad;
        g.fillRect(-128, -128, 256, 256);
        g.restore();
        tex.refresh();
      }
    }
    if (!t.exists(BUTTERFLY_KEY)) {
      const tex = t.createCanvas(BUTTERFLY_KEY, BUTTERFLY_TEX_W, 30);
      if (tex) {
        const g = tex.getContext();
        g.strokeStyle = '#3a291e'; g.lineWidth = 2;
        // 날개 네 장(곱하기 색조가 입혀질 흰 바탕) + 위 날개의 연한 무늬 + 몸통.
        const wing = (x: number, y: number, rx: number, ry: number, rot: number) => { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); g.stroke(); };
        const spot = (x: number, y: number, r: number) => { g.fillStyle = '#d8cfb8'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
        wing(11, 10, 10, 7.5, -0.55); wing(29, 10, 10, 7.5, 0.55); wing(13, 21, 7.5, 5.5, 0.45); wing(27, 21, 7.5, 5.5, -0.45);
        spot(8.5, 8, 3); spot(31.5, 8, 3);
        g.fillStyle = '#3a291e';
        g.beginPath(); g.roundRect(18.2, 4, 3.6, 22, 1.8); g.fill();
        tex.refresh();
      }
    }
  }

  /** 웨이브가 바뀌면 목표 색조를 다시 고르고, 목표 쪽으로 TINT_FADE_MS 동안 부드럽게(움직임 줄이기·snap이면 바로) 간다. */
  private syncTint(deltaMs: number, snap: boolean) {
    const wave = Math.max(1, this.c.bridge.controller.state.wave);
    if (wave !== this.wave) { this.wave = wave; this.target = timeOfDay(wave); }
    const to = split(this.target.color), k = snap ? 1 : Math.min(1, deltaMs / TINT_FADE_MS);
    const n = this.now;
    n.r += (to.r - n.r) * k; n.g += (to.g - n.g) * k; n.b += (to.b - n.b) * k; n.a += (this.target.alpha - n.a) * k;
    const color = (Math.round(n.r) << 16) | (Math.round(n.g) << 8) | Math.round(n.b);
    // 목표에 닿은 뒤에는 색조 층을 건드리지 않는다(매 프레임 다시 칠하지 않는다).
    if (color !== this.paintedColor || Math.abs(n.a - this.paintedAlpha) > 0.0005) { this.tint.setFillStyle(color, n.a); this.paintedColor = color; this.paintedAlpha = n.a; }
  }

  /** 구름·나비·잔물결을 보이거나 감춘다. 움직임 줄이기면 모두 감춘다. */
  private apply(deltaSec: number, reduced: boolean) {
    for (const c of this.clouds) c.img.setVisible(!reduced);
    for (const f of this.flies) f.img.setVisible(!reduced);
    this.ripples.setVisible(!reduced);
    if (reduced) { this.ripples.clear(); return; }
    this.moveClouds(deltaSec);
    this.moveFlies(deltaSec);
    this.drawRipples();
  }

  private moveClouds(dt: number) {
    for (const c of this.clouds) { c.spec = cloudStep(c.spec, dt, WORLD_W); c.img.setPosition(c.spec.x, c.spec.y); }
  }

  /** 나비: 목표를 향해 날며 가볍게 흔들리고, 날개를 천천히 접었다 편다(초당 약 3번). 앉아 있는 동안은 날개를 반쯤 접는다. */
  private moveFlies(dt: number) {
    const scale = BUTTERFLY_PX / BUTTERFLY_TEX_W;
    for (const f of this.flies) {
      f.spec = butterflyStep(f.spec, dt, this.rand, this.bounds);
      const resting = f.spec.rest > 0;
      const flap = resting ? 0.5 : 0.45 + 0.55 * Math.abs(Math.sin(this.clockMs / 1000 * 9 + f.phase));
      const sway = resting ? 0 : Math.sin(this.clockMs / 1000 * 2.3 + f.phase) * 4;
      const bob = resting ? 0 : Math.cos(this.clockMs / 1000 * 3.1 + f.phase) * 3;
      f.img.setPosition(f.spec.x + sway, f.spec.y + bob - 10).setScale(scale * flap, scale).setDepth(DEPTH.units + f.spec.y + 40);
    }
  }

  /** 물 위 잔물결: 가는 흰 타원 고리가 한 자리에서 퍼지며 옅어진다. 물이 없는 맵은 그리지 않는다. */
  private drawRipples() {
    if (this.clockMs - this.rippleAt < RIPPLE_REDRAW_MS && this.clockMs >= this.rippleAt) return;
    this.rippleAt = this.clockMs;
    const g = this.ripples.clear();
    this.water.forEach((spot, si) => {
      for (let k = 0; k < RIPPLE_COUNT; k++) {
        const r = rippleFrame(spot, k, this.clockMs, si);
        g.lineStyle(1.3, 0xe9f6ff, r.alpha).strokeEllipse(r.x, r.y, r.rx * 2, r.ry * 2);
      }
    });
  }

  /** 매 프레임. 일시정지 중에는 구름·나비·잔물결이 멈춘다(색조는 웨이브에 따라서만 바뀐다). */
  update(deltaMs: number) {
    const { bridge } = this.c;
    const reduced = bridge.reducedMotion;
    const paused = bridge.controller.state.pause.length > 0;
    const dt = paused ? 0 : Math.min(100, Math.max(0, deltaMs));
    this.clockMs += dt;
    this.syncTint(deltaMs, reduced);
    this.apply(dt / 1000, reduced);
  }
}

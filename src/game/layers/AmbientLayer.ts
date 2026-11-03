import type Phaser from 'phaser';
import {
  ambientSeed, ambientSettings, butterflyArt, butterflyBounds, butterflySpecs, butterflyStep, BUTTERFLY_CELLS, CLOUD_ALPHA, CLOUD_ART_ALPHA, CLOUD_ART_SCALE, cloudArt, cloudSpecs, cloudStep,
  DRIFT_LOOK, driftSpecs, driftStep, rippleFrame, RIPPLE_COUNT, rng, timeOfDay, waterSpots,
  type AmbientSettings, type Bounds, type CloudSpec, type Drifter, type DriftKind, type Tint, type Wanderer, type WaterSpot,
} from '../ambient';
import { CELL_PX, WORLD_H, WORLD_W } from '../assets';
import { layoutFor } from '../layouts';
import { DEPTH, type LayerContext } from './shared';

/** 시간 색조가 목표 색으로 가는 시간(ms). 웨이브가 바뀔 때만 움직이고, 움직임 줄이기면 바로 바뀐다. */
const TINT_FADE_MS = 1500;
const RIPPLE_REDRAW_MS = 33;
/** 코드로 그린 옛 나비 그림(원화가 없을 때)의 곱하기 색조. */
const BUTTERFLY_TINTS = [0xfff1a8, 0xffc0cf, 0xb4dcff, 0xffc7a0] as const;
const CLOUD_KEY = 'ambient.cloud', BUTTERFLY_KEY = 'ambient.butterfly', BUTTERFLY_TEX_W = 40;
/** 원화 나비가 날개를 펴고 접는 속도(초당 번). */
const WING_BEATS_PER_SEC = 7;
/** 코드로 그린 꽃잎·눈송이 텍스처 키와 꽃잎 색(곱하기 색조). */
const DRIFT_KEY: Record<DriftKind, string> = { petal: 'ambient.petal', snow: 'ambient.snow' };
const PETAL_TINTS = [0xffc9d6, 0xffe0e6, 0xffb3c6, 0xfff0f3] as const;

const split = (c: number) => ({ r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 });

interface Fly { spec: Wanderer; img: Phaser.GameObjects.Image; phase: number; frames: readonly [string, string] | null }
interface Flake { spec: Drifter; img: Phaser.GameObjects.Image; kind: DriftKind }

/**
 * 살아 있는 분위기 층(은은하게, 개체 수 적게): 맵마다 설정 표(ambient.ts AMBIENT_SETTINGS)가 정한 요소만 그린다.
 * 구름 그림자·나비는 원화(fx.cloudshadow·fx.butterfly)가 실렸으면 원화로, 아니면 코드로 그린 옛 임시 그림으로 그린다.
 * 물 위 잔물결·흩날리는 꽃잎·눈송이는 맵에 따라 다르고, 웨이브에 따라 아침 → 노을 → 밤으로 바뀌는 전체 색조는 모든 맵에 있다.
 * 도메인 상태는 웨이브 번호와 일시정지만 읽는다. 구름 그림자·잔물결은 지면 바로 위(타워·적·길 위 장식 아래)에만 그려 가독성을 해치지 않고,
 * 색조 층은 투사체·효과 아래다. 움직임 줄이기면 구름·나비·잔물결·꽃잎·눈송이를 그리지 않고 색조만 바로 바꾼다(ui-rules-v2 §2).
 */
export class AmbientLayer {
  private readonly c: LayerContext;
  private readonly cfg: AmbientSettings;
  private readonly clouds: Array<{ spec: CloudSpec; img: Phaser.GameObjects.Image }> = [];
  private readonly flies: Fly[] = [];
  private readonly flakes: Flake[] = [];
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
    const cfg = (this.cfg = ambientSettings(map.id));
    const has = (key: string) => scene.textures.exists(key);
    this.bounds = butterflyBounds(WORLD_W, WORLD_H, CELL_PX);
    this.rand = rng(ambientSeed(map.id, 'flight'));

    if (cfg.clouds) {
      const art = cloudArt(has);
      if (!art) this.makeCloudTexture();
      cloudSpecs(map.id, WORLD_W, WORLD_H, CELL_PX).forEach((spec, i) => {
        const img = art
          ? scene.add.image(spec.x, spec.y, art[i % art.length]!).setDisplaySize(spec.w * CLOUD_ART_SCALE, spec.w * CLOUD_ART_SCALE).setAlpha(CLOUD_ART_ALPHA[i % CLOUD_ART_ALPHA.length]!)
          : scene.add.image(spec.x, spec.y, CLOUD_KEY).setDisplaySize(spec.w, spec.h).setAlpha(CLOUD_ALPHA);
        this.clouds.push({ spec, img: img.setDepth(DEPTH.mood + 0.5) });
      });
    }

    if (cfg.butterflies.length) {
      const arts = cfg.butterflies.map(color => butterflyArt(color, has));
      if (arts.some(a => !a)) this.makeButterflyTexture();
      butterflySpecs(map.id, this.bounds, CELL_PX, cfg.butterflies.length).forEach((spec, i) => {
        const frames = arts[i] ?? null;
        const img = frames ? scene.add.image(spec.x, spec.y, frames[0]) : scene.add.image(spec.x, spec.y, BUTTERFLY_KEY).setTint(BUTTERFLY_TINTS[i % BUTTERFLY_TINTS.length]!);
        this.flies.push({ spec, img, phase: i * 2.1, frames });
      });
    }

    this.water = waterSpots(layoutFor(map.id), map, CELL_PX, asset => {
      if (!scene.textures.exists(asset)) return null;
      const src = scene.textures.get(asset).getSourceImage() as { width: number; height: number };
      return { width: src.width, height: src.height };
    }, cfg.water);
    this.ripples = scene.add.graphics().setDepth(DEPTH.mood + 0.2);

    if (cfg.drift) {
      const { kind, count } = cfg.drift;
      this.makeDriftTexture(kind);
      driftSpecs(map.id, kind, count, WORLD_W, WORLD_H).forEach((spec, i) => {
        const img = scene.add.image(spec.x, spec.y, DRIFT_KEY[kind]).setAlpha(DRIFT_LOOK[kind].alpha).setDepth(DEPTH.projectiles - 2);
        if (kind === 'petal') img.setTint(PETAL_TINTS[i % PETAL_TINTS.length]!);
        img.setScale(spec.size / img.width);
        this.flakes.push({ spec, img, kind });
      });
    }

    this.tint = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff, 0).setOrigin(0).setDepth(DEPTH.projectiles - 1);
    this.syncTint(0, true);
    this.apply(0, bridge.reducedMotion);
  }

  /** 구름 그림자 원화가 없을 때의 임시 그림: 바깥이 옅은 큰 타원. 같은 키가 이미 있으면 다시 만들지 않는다. */
  private makeCloudTexture() {
    const t = this.c.scene.textures;
    if (t.exists(CLOUD_KEY)) return;
    const tex = t.createCanvas(CLOUD_KEY, 256, 128);
    if (!tex) return;
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

  /** 나비 원화가 없을 때의 임시 그림: 위에서 본 날개 네 장(곱하기 색조가 입혀질 흰 바탕) + 위 날개의 연한 무늬 + 몸통. */
  private makeButterflyTexture() {
    const t = this.c.scene.textures;
    if (t.exists(BUTTERFLY_KEY)) return;
    const tex = t.createCanvas(BUTTERFLY_KEY, BUTTERFLY_TEX_W, 30);
    if (!tex) return;
    const g = tex.getContext();
    g.strokeStyle = '#3a291e'; g.lineWidth = 2;
    const wing = (x: number, y: number, rx: number, ry: number, rot: number) => { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); g.stroke(); };
    const spot = (x: number, y: number, r: number) => { g.fillStyle = '#d8cfb8'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    wing(11, 10, 10, 7.5, -0.55); wing(29, 10, 10, 7.5, 0.55); wing(13, 21, 7.5, 5.5, 0.45); wing(27, 21, 7.5, 5.5, -0.45);
    spot(8.5, 8, 3); spot(31.5, 8, 3);
    g.fillStyle = '#3a291e';
    g.beginPath(); g.roundRect(18.2, 4, 3.6, 22, 1.8); g.fill();
    tex.refresh();
  }

  /** 꽃잎(옆으로 긴 타원에 가운데 주름, 곱하기 색조가 입혀질 흰 바탕)과 눈송이(가장자리가 부드러운 흰 점)를 코드로 그린다. */
  private makeDriftTexture(kind: DriftKind) {
    const t = this.c.scene.textures, key = DRIFT_KEY[kind];
    if (t.exists(key)) return;
    const tex = t.createCanvas(key, 32, 32);
    if (!tex) return;
    const g = tex.getContext();
    if (kind === 'snow') {
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
    } else {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(16, 16, 15, 8.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(150,90,100,0.55)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(4, 17); g.quadraticCurveTo(16, 12, 28, 16); g.stroke();
    }
    tex.refresh();
  }

  /** 웨이브가 바뀌면 목표 색조를 다시 고르고, 목표 쪽으로 TINT_FADE_MS 동안 부드럽게(움직임 줄이기·snap이면 바로) 간다. */
  private syncTint(deltaMs: number, snap: boolean) {
    const wave = Math.max(1, this.c.bridge.controller.state.wave);
    if (wave !== this.wave) { this.wave = wave; this.target = timeOfDay(wave, this.cfg.tint); }
    const to = split(this.target.color), k = snap ? 1 : Math.min(1, deltaMs / TINT_FADE_MS);
    const n = this.now;
    n.r += (to.r - n.r) * k; n.g += (to.g - n.g) * k; n.b += (to.b - n.b) * k; n.a += (this.target.alpha - n.a) * k;
    const color = (Math.round(n.r) << 16) | (Math.round(n.g) << 8) | Math.round(n.b);
    // 목표에 닿은 뒤에는 색조 층을 건드리지 않는다(매 프레임 다시 칠하지 않는다).
    if (color !== this.paintedColor || Math.abs(n.a - this.paintedAlpha) > 0.0005) { this.tint.setFillStyle(color, n.a); this.paintedColor = color; this.paintedAlpha = n.a; }
  }

  /** 구름·나비·잔물결·꽃잎·눈송이를 보이거나 감춘다. 움직임 줄이기면 모두 감춘다. */
  private apply(deltaSec: number, reduced: boolean) {
    for (const c of this.clouds) c.img.setVisible(!reduced);
    for (const f of this.flies) f.img.setVisible(!reduced);
    for (const f of this.flakes) f.img.setVisible(!reduced);
    this.ripples.setVisible(!reduced);
    if (reduced) { this.ripples.clear(); return; }
    this.moveClouds(deltaSec);
    this.moveFlies(deltaSec);
    this.moveFlakes(deltaSec);
    this.drawRipples();
  }

  private moveClouds(dt: number) {
    for (const c of this.clouds) { c.spec = cloudStep(c.spec, dt, WORLD_W); c.img.setPosition(c.spec.x, c.spec.y); }
  }

  /**
   * 나비: 목표를 향해 날며 가볍게 흔들린다. 원화는 날개를 편 그림과 접은 그림을 번갈아 보이고(앉으면 접는다),
   * 코드 그림은 날개 너비를 줄였다 늘린다(초당 약 3번, 앉아 있는 동안은 반쯤 접는다).
   */
  private moveFlies(dt: number) {
    const px = BUTTERFLY_CELLS * CELL_PX;
    for (const f of this.flies) {
      f.spec = butterflyStep(f.spec, dt, this.rand, this.bounds);
      const resting = f.spec.rest > 0, sec = this.clockMs / 1000;
      const sway = resting ? 0 : Math.sin(sec * 2.3 + f.phase) * 4;
      const bob = resting ? 0 : Math.cos(sec * 3.1 + f.phase) * 3;
      f.img.setPosition(f.spec.x + sway, f.spec.y + bob - 10).setDepth(DEPTH.units + f.spec.y + 40);
      if (f.frames) {
        const key = f.frames[resting || Math.floor(sec * WING_BEATS_PER_SEC + f.phase) % 2 === 1 ? 1 : 0];
        if (f.img.texture.key !== key) f.img.setTexture(key);
        f.img.setScale(px / f.img.width);
      } else {
        const flap = resting ? 0.5 : 0.45 + 0.55 * Math.abs(Math.sin(sec * 9 + f.phase));
        const scale = px / BUTTERFLY_TEX_W;
        f.img.setScale(scale * flap, scale);
      }
    }
  }

  /** 꽃잎·눈송이: 바람을 따라 천천히 흐르며 좌우로 살짝 흔들리고, 아래로 나가면 위에서 다시 들어온다. */
  private moveFlakes(dt: number) {
    const sec = this.clockMs / 1000;
    for (const f of this.flakes) {
      f.spec = driftStep(f.spec, dt, this.rand, WORLD_W, WORLD_H);
      const petal = f.kind === 'petal';
      f.img.setPosition(f.spec.x + Math.sin(sec * (petal ? 1.7 : 0.9) + f.spec.phase) * (petal ? 7 : 5), f.spec.y);
      if (petal) {
        const s = f.spec.size / f.img.width;
        f.img.setRotation(f.spec.rot).setScale(s, s * (0.55 + 0.45 * Math.abs(Math.cos(sec * 2.1 + f.spec.phase))));
      }
    }
  }

  /** 물 위 잔물결: 가는 흰 타원 고리가 한 자리에서 퍼지며 옅어진다. 물이 없는 맵은 그리지 않는다. */
  private drawRipples() {
    if (this.water.length === 0) return;
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

  /** 매 프레임. 일시정지 중에는 구름·나비·잔물결·꽃잎·눈송이가 멈춘다(색조는 웨이브에 따라서만 바뀐다). */
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

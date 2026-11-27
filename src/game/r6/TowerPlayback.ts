import type Phaser from 'phaser';
import { R6_TOWERS, type R6TowerId } from '../../contracts/balanceV2';
import { evolutionAt, isR6Tower } from '../../domain/r6Towers';
import type { RunState } from '../../domain/types';
import { CELL_PX } from '../assets';
import { topFit } from '../layers/cues';
import { DEPTH, fieldPosition, r6UnitDepth, type LayerContext } from '../layers/shared';
import type { R6BattleAssets } from './BattleAssets';
import { projectFieldDelta } from './mapProjection';
import { headDirection, R6_COLORS, type R6Manifest, type TowerFormArt } from './manifest';

const BLEND_ADD = 1 as Phaser.BlendModes;
const TOWER_GLOW_KEY = 'r6.tower.glow';
const TOWER_GLOW_COLORS: Readonly<Record<R6TowerId, number>> = {
  rail: R6_COLORS.teal,
  mortar: R6_COLORS.amber,
  cryo: 0x7dd3fc,
  prism: 0xc084fc,
  hangar: 0x34d399,
  bastion: R6_COLORS.amber,
};

/** 16방향 최단 거리 step(최대 2스텝/프레임, >4스텝 차이나면 즉시 스냅) 계산 순수 함수. */
export function stepTowerDirection(
  current: number,
  target: number,
  maxStep = 2,
  snapThreshold = 4,
): number {
  const c = ((current % 16) + 16) % 16;
  const t = ((target % 16) + 16) % 16;
  let diff = t - c;
  if (diff > 8) diff -= 16;
  if (diff < -8) diff += 16;
  if (Math.abs(diff) <= maxStep || Math.abs(diff) > snapThreshold) return t;
  return (((c + Math.sign(diff) * maxStep) % 16) + 16) % 16;
}

/** 타워 대기(Idle) 미세 호흡·글로우·경계 스캔 계산. 품질 1에서 글로우 오프, 품질 2+/reducedMotion에서 전체 오프. */
export function towerIdleSpec(
  towerId: number,
  type: R6TowerId | undefined,
  timeMs: number,
  idleMs: number,
  quality: number,
  reducedMotion: boolean,
  burning = false,
): { breathY: number; glowAlpha: number; glowColor: number; scanOffset: -1 | 0 | 1 } {
  const glowColor = burning && quality === 0 && !reducedMotion
    ? R6_COLORS.amber
    : (type ? TOWER_GLOW_COLORS[type] : R6_COLORS.teal);
  if (reducedMotion || quality >= 2) {
    return { breathY: 0, glowAlpha: 0, glowColor, scanOffset: 0 };
  }
  const phase = towerId * 1.37 + timeMs * 0.0024;
  const breathY = Math.sin(phase) * 0.9;
  const glowAlpha = quality === 0
    ? (burning ? 0.36 + 0.14 * (0.5 + 0.5 * Math.sin(phase * 2.2)) : 0.22 + 0.12 * (0.5 + 0.5 * Math.sin(phase * 1.15)))
    : 0;
  let scanOffset: -1 | 0 | 1 = 0;
  if (idleMs >= 1400) {
    const cycle = Math.floor(((idleMs - 1400) / 520 + towerId) % 4);
    scanOffset = cycle === 1 ? 1 : cycle === 3 ? -1 : 0;
  }
  return { breathY, glowAlpha, glowColor, scanOffset };
}

function ensureTowerGlowTexture(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(TOWER_GLOW_KEY)) return true;
  if (typeof document === 'undefined') return false;
  const tex = scene.textures.createCanvas(TOWER_GLOW_KEY, 32, 32);
  if (!tex) return false;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  tex.refresh();
  return true;
}

interface TowerView {
  body: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image | undefined;
  dust?: Phaser.GameObjects.Graphics | undefined;
  type: R6TowerId | undefined;
  stage: number;
  weaponStage: number;
  aimDirection: number;
  direction: number;
  attackAt: number;
  attachAt: number;
  attachMs: number;
  shotLift: number;
}

export class R6TowerPlayback {
  private readonly views = new Map<number, TowerView>();
  private readonly placeholders = new Map<number, Phaser.GameObjects.Rectangle>();

  constructor(private readonly c: LayerContext, private readonly assets: R6BattleAssets) {}

  weaponLift(towerId: number) { return this.views.get(towerId)?.shotLift ?? 0; }

  weaponOffset(towerId: number) {
    const view = this.views.get(towerId);
    return view ? view.head.x - view.body.x : 0;
  }

  attack(towerId: number, dx: number, dy: number) {
    const view = this.views.get(towerId);
    const projection = this.assets.manifest?.projection;
    if (!view || !projection) return;
    if (dx || dy) {
      const p = this.c.projected ? projectFieldDelta(dx, dy) : { x: dx, y: dy };
      view.aimDirection = headDirection(p.x, p.y, projection);
      view.direction = stepTowerDirection(view.direction, view.aimDirection);
    }
    view.attackAt = this.c.scene.time.now;
  }

  sync(state: RunState, time: number) {
    const { scene, bridge } = this.c;
    const { manifest } = this.assets;
    const present = new Set<number>();
    const sheets = new Set<string>();
    for (const tower of state.towers) {
      present.add(tower.id);
      const id: string = tower.type;
      const type = isR6Tower(id) ? id : undefined;
      const { stage, weapon } = evolutionAt(tower.level);
      const forms = manifest && type ? manifest.towers[type] : undefined;
      const form = forms?.[stage];
      const { x, y } = fieldPosition(this.c, tower.x, tower.y);
      if (!manifest || !forms || !form) {
        this.removeView(tower.id);
        this.placeholder(tower.id, x, y, type);
        continue;
      }
      this.wantForm(sheets, form, bridge.reducedMotion);
      const bodyTexture = this.assets.towerTexture(form.body, sheets);
      const headTexture = this.assets.towerTexture(form.head, sheets);
      let view = this.views.get(tower.id);
      if (!bodyTexture || !headTexture) {
        if (view) {
          const previous = forms[view.stage]!;
          this.wantForm(sheets, previous, bridge.reducedMotion);
          this.draw(tower.id, view, manifest, previous, x, y, time, sheets);
        } else this.placeholder(tower.id, x, y, type);
        continue;
      }
      this.placeholders.get(tower.id)?.destroy();
      this.placeholders.delete(tower.id);
      if (!view) {
        const initDir = headDirection(0, -1, manifest.projection);
        const glow = ensureTowerGlowTexture(scene)
          ? scene.add.image(x, y, TOWER_GLOW_KEY).setBlendMode(BLEND_ADD).setVisible(false)
          : undefined;
        view = {
          body: scene.add.image(x, y, bodyTexture, form.bodyFrame).setName(`r6:tower:${tower.id}:body`),
          head: scene.add.image(x, y, headTexture, 0).setName(`r6:tower:${tower.id}:head`),
          glow,
          type,
          stage, weaponStage: weapon, aimDirection: initDir, direction: initDir,
          attackAt: -Infinity, attachAt: -Infinity, attachMs: 600, shotLift: 0,
        };
        this.views.set(tower.id, view);
      } else if (view.stage !== stage) {
        view.attachMs = view.weaponStage === weapon ? 600 : 1200;
        view.weaponStage = weapon;
        view.attachAt = time;
        view.attackAt = -Infinity;
        view.stage = stage;
      }
      view.type = type;
      this.draw(tower.id, view, manifest, form, x, y, time, sheets);
    }
    for (const id of this.views.keys()) if (!present.has(id)) this.removeView(id);
    for (const [id, shape] of this.placeholders) if (!present.has(id)) { shape.destroy(); this.placeholders.delete(id); }
    return sheets;
  }

  private wantForm(sheets: Set<string>, form: TowerFormArt, reduced: boolean) {
    if (reduced) return;
    if ('sheets' in form.attack) for (const id of form.attack.sheets) this.assets.towerTexture(id, sheets);
    else if (form.attack.clip) this.assets.towerTexture(form.attack.clip.sheet, sheets);
  }

  private draw(towerId: number, v: TowerView, manifest: R6Manifest, form: TowerFormArt, x: number, y: number, time: number, sheets: Set<string>) {
    const { reducedMotion: reduced, controller } = this.c.bridge;
    const quality = controller.renderQuality.current;
    const body = manifest.sheets[form.body]!;
    const head = manifest.sheets[form.head]!;
    const [bx, by] = body.pivot;
    const [mx, my] = form.mount;
    const foot = this.c.projected ? y : y + CELL_PX * 0.32;
    const above = Math.max(by, by - my + head.pivot[1]) * form.scale;
    const fit = this.c.projected ? { scale: Math.min(1, (foot - 2) / above), drop: 0 } : topFit(foot, above, CELL_PX);
    const scale = fit.scale * form.scale;
    const footY = foot + fit.drop;
    const headY = footY + (my - by) * scale;
    const depth = this.c.projected ? r6UnitDepth(y, 'tower') : DEPTH.units + y;
    v.shotLift = y - CELL_PX * 0.32 - headY;

    const burning = controller.state.burningUntilTick > controller.state.tick;
    const idleMs = Number.isFinite(v.attackAt) ? Math.max(0, time - v.attackAt) : 1400 + time;
    const idle = towerIdleSpec(towerId, v.type, time, idleMs, quality, reduced, burning);
    const targetDir = idle.scanOffset !== 0 && idleMs >= 1400
      ? (((v.aimDirection + idle.scanOffset) % 16) + 16) % 16
      : v.aimDirection;
    v.direction = reduced ? targetDir : stepTowerDirection(v.direction, targetDir);

    const bodyTexture = this.assets.towerTexture(form.body, sheets)!;
    if (v.body.texture.key !== bodyTexture || Number(v.body.frame.name) !== form.bodyFrame) v.body.setTexture(bodyTexture, form.bodyFrame);
    v.body.setOrigin(bx / body.width, by / body.height).setPosition(x, footY)
      .setDisplaySize(body.width * scale, body.height * scale).setDepth(depth);

    const { attack } = form;
    const attackFrame = reduced ? -1 : Math.floor((time - v.attackAt) * attack.fps / 1000);
    const directional = 'sheets' in attack;
    const clip = directional ? {
      sheet: attack.sheets[v.direction < 8 ? 0 : 1], first: (v.direction % 8) * attack.frames, count: attack.frames,
    } : attack.clip?.direction === v.direction ? attack.clip : undefined;
    const clipTexture = clip && attackFrame >= 0 && attackFrame < clip.count ? this.assets.towerTexture(clip.sheet, sheets) : undefined;
    const useClip = clip && clipTexture;
    const headArt = useClip ? manifest.sheets[clip.sheet]! : head;
    const recoil = directional || useClip ? 0 : (attack.recoilPixels[attackFrame] ?? 0) * scale;
    const theta = (manifest.projection.zeroBearingDeg / 180 - v.direction / 8) * Math.PI;
    const attach = reduced ? 1 : Math.max(0, Math.min(1, (time - v.attachAt) / v.attachMs));
    const settle = (1 - attach) ** 2 * scale * 18;
    const headX = x + (mx - bx) * scale - Math.sin(theta) * recoil;
    const headDrawY = headY - settle + idle.breathY + Math.cos(theta) * recoil * manifest.projection.squashY;
    const headTexture = clipTexture ?? this.assets.towerTexture(form.head, sheets)!;
    const headFrame = useClip ? clip.first + attackFrame : v.direction;
    if (v.head.texture.key !== headTexture || Number(v.head.frame.name) !== headFrame) v.head.setTexture(headTexture, headFrame);
    v.head.setOrigin(headArt.pivot[0] / headArt.width, headArt.pivot[1] / headArt.height)
      .setPosition(headX, headDrawY)
      .setDisplaySize(headArt.width * scale, headArt.height * scale).setDepth(this.c.projected ? depth : depth + 1);
    if (v.glow) {
      if (idle.glowAlpha > 0) {
        const glowSize = Math.max(22, CELL_PX * 0.55 * (1 + v.weaponStage * 0.12));
        v.glow.setPosition(headX, headDrawY - headArt.pivot[1] * scale * 0.15)
          .setDisplaySize(glowSize, glowSize * 0.72)
          .setTint(idle.glowColor)
          .setAlpha(idle.glowAlpha)
          .setDepth((this.c.projected ? depth : depth + 1) + 0.05)
          .setVisible(true);
      } else {
        v.glow.setVisible(false);
      }
    }
    this.drawDust(v, quality > 0 ? 1 : attach, x, footY, depth);
  }

  private drawDust(v: TowerView, progress: number, x: number, y: number, depth: number) {
    if (progress < .48 || progress >= 1) {
      v.dust?.destroy();
      v.dust = undefined;
      return;
    }
    const spread = (progress - .48) / .52;
    const dust = v.dust ??= this.c.scene.add.graphics().setDepth(this.c.projected ? depth : depth + 2).setName(v.body.name + ':dust');
    dust.clear().fillStyle(R6_COLORS.silver, .43 * (1 - spread));
    for (const offset of [-1, -.55, .55, 1]) {
      dust.fillCircle(x + offset * (9 + 12 * spread), y - 1 - 4 * spread / Math.abs(offset), 1.5 - spread);
    }
  }

  private placeholder(id: number, x: number, y: number, type: R6TowerId | undefined) {
    if (this.placeholders.has(id)) return;
    const index = type ? R6_TOWERS.indexOf(type) : 0;
    const shape = this.c.scene.add.rectangle(x, y, 33 + index * 3, 34 - index * 2, R6_COLORS.line)
      .setOrigin(0.5, this.c.projected ? 1 : 0.5)
      .setStrokeStyle(2, R6_COLORS.teal).setDepth(this.c.projected ? r6UnitDepth(y, 'tower') : DEPTH.units + y).setName(`r6:tower:${id}:placeholder`);
    this.placeholders.set(id, shape);
  }

  private removeView(id: number) {
    const view = this.views.get(id);
    view?.body.destroy();
    view?.head.destroy();
    view?.glow?.destroy();
    view?.dust?.destroy();
    this.views.delete(id);
  }
}

import type Phaser from 'phaser';
import { R6_TOWERS, type R6TowerId } from '../../contracts/balanceV2';
import { evolutionAt, isR6Tower } from '../../domain/r6Towers';
import type { RunState } from '../../domain/types';
import { CELL_PX } from '../assets';
import { topFit } from '../layers/cues';
import { DEPTH, fieldPosition, type LayerContext } from '../layers/shared';
import { sheetKey, type R6BattleAssets } from './BattleAssets';
import { projectFieldDelta } from './mapProjection';
import { headDirection, R6_COLORS, type R6Manifest, type TowerFormArt } from './manifest';

interface TowerView {
  body: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  dust?: Phaser.GameObjects.Graphics | undefined;
  stage: number;
  weaponStage: number;
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

  attack(towerId: number, dx: number, dy: number) {
    const view = this.views.get(towerId);
    const projection = this.assets.manifest?.projection;
    if (!view || !projection) return;
    if (dx || dy) {
      const p = this.c.projected ? projectFieldDelta(dx, dy) : { x: dx, y: dy };
      view.direction = headDirection(p.x, p.y, projection);
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
      let view = this.views.get(tower.id);
      if (!scene.textures.exists(sheetKey(form.body)) || !scene.textures.exists(sheetKey(form.head))) {
        if (view) {
          const previous = forms[view.stage]!;
          this.wantForm(sheets, previous, bridge.reducedMotion);
          this.draw(view, manifest, previous, x, y, time, bridge.reducedMotion);
        } else this.placeholder(tower.id, x, y, type);
        continue;
      }
      this.placeholders.get(tower.id)?.destroy();
      this.placeholders.delete(tower.id);
      if (!view) {
        view = {
          body: scene.add.image(x, y, sheetKey(form.body), form.bodyFrame).setName(`r6:tower:${tower.id}:body`),
          head: scene.add.image(x, y, sheetKey(form.head), 0).setName(`r6:tower:${tower.id}:head`),
          stage, weaponStage: weapon, direction: headDirection(0, -1, manifest.projection),
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
      this.draw(view, manifest, form, x, y, time, bridge.reducedMotion);
    }
    for (const id of this.views.keys()) if (!present.has(id)) this.removeView(id);
    for (const [id, shape] of this.placeholders) if (!present.has(id)) { shape.destroy(); this.placeholders.delete(id); }
    this.assets.keepTowerSheets(sheets);
  }

  private wantForm(sheets: Set<string>, form: TowerFormArt, reduced: boolean) {
    sheets.add(form.body).add(form.head);
    if (reduced) return;
    if ('sheets' in form.attack) for (const id of form.attack.sheets) sheets.add(id);
    else if (form.attack.clip) sheets.add(form.attack.clip.sheet);
  }

  private draw(v: TowerView, manifest: R6Manifest, form: TowerFormArt, x: number, y: number, time: number, reduced: boolean) {
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
    const depth = DEPTH.units + y;
    v.shotLift = y - CELL_PX * 0.32 - headY;

    const bodyTexture = sheetKey(form.body);
    if (v.body.texture.key !== bodyTexture || Number(v.body.frame.name) !== form.bodyFrame) v.body.setTexture(bodyTexture, form.bodyFrame);
    v.body.setOrigin(bx / body.width, by / body.height).setPosition(x, footY)
      .setDisplaySize(body.width * scale, body.height * scale).setDepth(depth);

    const { attack } = form;
    const attackFrame = reduced ? -1 : Math.floor((time - v.attackAt) * attack.fps / 1000);
    const directional = 'sheets' in attack;
    const clip = directional ? {
      sheet: attack.sheets[v.direction < 8 ? 0 : 1], first: (v.direction % 8) * attack.frames, count: attack.frames,
    } : attack.clip?.direction === v.direction ? attack.clip : undefined;
    const useClip = clip && attackFrame >= 0 && attackFrame < clip.count && this.c.scene.textures.exists(sheetKey(clip.sheet));
    const headArt = useClip ? manifest.sheets[clip.sheet]! : head;
    const recoil = directional || useClip ? 0 : (attack.recoilPixels[attackFrame] ?? 0) * scale;
    const theta = (manifest.projection.zeroBearingDeg / 180 - v.direction / 8) * Math.PI;
    const attach = reduced ? 1 : Math.max(0, Math.min(1, (time - v.attachAt) / v.attachMs));
    const settle = (1 - attach) ** 2 * scale * 18;
    const headTexture = sheetKey(useClip ? clip.sheet : form.head);
    const headFrame = useClip ? clip.first + attackFrame : v.direction;
    if (v.head.texture.key !== headTexture || Number(v.head.frame.name) !== headFrame) v.head.setTexture(headTexture, headFrame);
    v.head.setOrigin(headArt.pivot[0] / headArt.width, headArt.pivot[1] / headArt.height)
      .setPosition(x + (mx - bx) * scale - Math.sin(theta) * recoil,
        headY - settle + Math.cos(theta) * recoil * manifest.projection.squashY)
      .setDisplaySize(headArt.width * scale, headArt.height * scale).setDepth(depth + 1);
    this.drawDust(v, attach, x, footY, depth);
  }

  private drawDust(v: TowerView, progress: number, x: number, y: number, depth: number) {
    if (progress < .48 || progress >= 1) {
      v.dust?.destroy();
      v.dust = undefined;
      return;
    }
    const spread = (progress - .48) / .52;
    const dust = v.dust ??= this.c.scene.add.graphics().setDepth(depth + 2).setName(v.body.name + ':dust');
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
      .setStrokeStyle(2, R6_COLORS.teal).setDepth(DEPTH.units + y).setName(`r6:tower:${id}:placeholder`);
    this.placeholders.set(id, shape);
  }

  private removeView(id: number) {
    const view = this.views.get(id);
    view?.body.destroy();
    view?.head.destroy();
    view?.dust?.destroy();
    this.views.delete(id);
  }
}

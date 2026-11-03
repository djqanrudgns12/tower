import Phaser from 'phaser';
import type { TowerId } from '../../contracts/balance';
import type { DomainEvent } from '../../domain/events';
import { formBranch, type FormId } from '../../domain/towers';
import type { RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, towerBodyArt, weaponMountOffset, type AssetSpec } from '../assets';
import { topFit } from './cues';
import { DEPTH, FIXED_WEAPON, toWorld, type LayerContext } from './shared';

/**
 * `form`은 본체 그림이 맞춰진 형태, `lift`는 무기를 기본 높이보다 올리는 높이(월드 px, 형태에 따른 올림 + 장착점이 정한 올림), `mountX`는 장착점이 정한 가로 이동(월드 px).
 * `x`·`y`는 칸 가운데(월드 px), `footY`·`scale`은 세계 위쪽 경계에 맞춘 발판 높이와 몸체·무기 배율(맨 윗줄만 1이 아니다, cues.topFit), `shotLift`는 그에 맞춘 발사 시작점 올림이다.
 */
interface TowerView { body: Phaser.GameObjects.Image; weapon: Phaser.GameObjects.Image | null; pips: Phaser.GameObjects.Graphics; level: number; branch: string | null; form: FormId | null; lift: number; mountX: number; recoilUntil: number; angle: number; x: number; y: number; footY: number; scale: number; shotLift: number }

/** 알파 경계 상자를 잴 때 이보다 옅은 픽셀(가장자리 잔여 알파)은 무시한다. */
const TOP_ALPHA_MIN = 16;
const displayHeight = (spec: AssetSpec) => CELL_PX * spec.displayCells * (spec.height / spec.width);

/** 타워 층: 몸체·무기·레벨 표식. 무기는 발사·즉발 공격 쪽으로 돌고 반동한다. */
export class TowerLayer {
  private readonly c: LayerContext;
  private towers = new Map<number, TowerView>();
  /** 텍스처 키 → 불투명 윗변(텍스처 px 행). 텍스처마다 한 번만 잰다. */
  private tops = new Map<string, number>();
  /** 본체 그림 키 → 기본형 대비 무기 올림(월드 px). 형태별로 한 번 계산해 둔다. */
  private lifts = new Map<string, number>();

  constructor(c: LayerContext) { this.c = c; }

  /** 발사체·즉발 효과의 시작점도 무기와 같이 올린다(EffectLayer가 읽는다). */
  weaponLift(towerId: number): number { return this.towers.get(towerId)?.shotLift ?? 0; }

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
    const fx = toWorld(e.fromX), fy = toWorld(e.fromY) - CELL_PX * 0.32 - (t?.shotLift ?? 0);
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
        v = { body, weapon, pips, level: 0, branch: null, form: null, lift: 0, mountX: 0, recoilUntil: 0, angle: FIXED_WEAPON.has(t.type) ? 0 : -Math.PI / 2, x, y, footY: y + CELL_PX * 0.32, scale: 1, shotLift: 0 };
        this.towers.set(t.id, v);
        this.applyForm(v, t.type, t.form);
        if (!bridge.reducedMotion) { body.setScale(body.scaleX * 0.96, body.scaleY * 0.96); scene.tweens.add({ targets: body, scaleX: body.scaleX / 0.96, scaleY: body.scaleY / 0.96, duration: 120 }); }
      }
      // 형태가 바뀌면 무기 위치·튀어 오름보다 먼저 본체 그림을 바꾼다(튀어 오름은 새 그림의 크기로 돌아온다).
      if (v.form !== t.form) this.applyForm(v, t.type, t.form);
      const depth = DEPTH.units + y;
      v.body.setDepth(depth);
      v.weapon?.setDepth(depth + 1);
      v.pips.setDepth(depth + 2);
      const recoil = time < v.recoilUntil && !bridge.reducedMotion ? 2 : 0;
      // 무기 자리는 발판 위 높이(0.64·0.7칸 + 올림)를 맨 윗줄 배율만큼 줄여 발판에서 잰다(배율 1이면 y − 0.32·0.38칸 − 올림과 같다).
      const k = v.scale;
      if (FIXED_WEAPON.has(t.type)) v.weapon?.setPosition(x + v.mountX * k, v.footY - (CELL_PX * 0.7 + v.lift) * k + (bridge.reducedMotion ? 0 : Math.sin(time / 420 + t.id) * 2));
      else v.weapon?.setPosition(x + v.mountX * k - Math.cos(v.angle) * recoil, v.footY - (CELL_PX * 0.64 + v.lift) * k - Math.sin(v.angle) * recoil).setRotation(v.angle);
      if (v.level !== t.level || v.branch !== t.form) {
        if (v.level > 0 && v.branch !== t.form) this.popEvolved(v);
        v.level = t.level; v.branch = t.form;
        const branch = formBranch(t.form);
        v.pips.clear();
        // 형태 그림이 단계를 보여 주므로 점은 지금 단계 안의 레벨(1~3)만 그린다. Lv10부터는 5레벨마다 별 하나(최대 3개, progression.md §1).
        const stars = t.level >= 10 ? Math.min(3, Math.floor((t.level - 5) / 5)) : 0;
        const dots = stars > 0 ? 0 : ((t.level - 1) % 3) + 1;
        const startX = x - (dots - 1) * 5;
        for (let i = 0; i < dots; i++) { v.pips.fillStyle(PALETTE.outline, 1).fillCircle(startX + i * 10, y + CELL_PX * 0.36, 4.2); v.pips.fillStyle(0xf4d35e, 1).fillCircle(startX + i * 10, y + CELL_PX * 0.36, 2.8); }
        for (let i = 0; i < stars; i++) this.star(v.pips, x - (stars - 1) * 7 + i * 14, y + CELL_PX * 0.36);
        // 분기 표식(A 원, B 마름모)은 그 형태의 그림이 없어 기본형으로 대신 그릴 때만 남긴다.
        if (branch && !this.hasFormArt(t.type, t.form)) {
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

  /**
   * 본체를 형태별 그림으로 맞춘다: tower.<타워>.<형태> → 부모 형태 → 기본형 → 임시 그림(assets.towerBodyArt).
   * 서리탑 진화형 그림은 수정이 본체에 그려져 있어, 진화형 그림을 쓰는 동안 떠 있는 수정(무기 층)을 숨긴다. 다른 타워의 무기는 그대로다.
   */
  private applyForm(v: TowerView, type: TowerId, form: FormId) {
    const { scene } = this.c;
    const base = ASSETS.towers[type];
    const art = towerBodyArt(type, form, key => scene.textures.exists(key));
    if (v.body.texture.key !== art.key) {
      // 진행 중인 크기 트윈이 옛 그림 배율로 되돌리지 않게 먼저 멈춘다.
      scene.tweens.killTweensOf(v.body);
      v.body.setTexture(art.key).setOrigin(art.originX, art.originY).setDisplaySize(CELL_PX * art.displayCells, displayHeight(art));
    }
    v.form = form;
    const mount = weaponMountOffset(base, FIXED_WEAPON.has(type));
    v.lift = this.liftOf(base, art) + mount.lift;
    v.mountX = mount.dx;
    if (type === 'frost') v.weapon?.setVisible(art.key === base.key);
    this.fitTop(v, type, art);
  }

  /**
   * 맨 윗줄 타워가 세계 위쪽 경계에서 잘리지 않게 발판을 조금 내리고 필요하면 몸체·무기를 줄인다(cues.topFit).
   * 몸체와 떠 있는 무기(서리·번개·바람개비) 가운데 더 높이 솟은 불투명 윗변을 기준으로 하며, 경계에 닿지 않는 타워는 배율 1·내림 0이라 그대로다.
   */
  private fitTop(v: TowerView, type: TowerId, art: AssetSpec) {
    const foot = v.y + CELL_PX * 0.32;
    let above = displayHeight(art) * (art.originY - this.topRow(art.key) / art.height);
    const wspec = ASSETS.weapons[type];
    if (v.weapon && wspec && FIXED_WEAPON.has(type)) {
      const wh = CELL_PX * wspec.displayCells;
      // 떠 있는 무기: 발판에서 무기 가운데까지(0.7칸 + 올림) + 가운데에서 불투명 윗변까지 + 위아래 흔들림 2px.
      above = Math.max(above, CELL_PX * 0.7 + v.lift + wh * (0.5 - this.topRow(wspec.key) / wspec.height) + 2);
    }
    const { drop, scale } = topFit(foot, above, CELL_PX);
    v.scale = scale;
    v.footY = foot + drop;
    v.shotLift = v.lift * scale - drop - CELL_PX * 0.64 * (1 - scale);
    v.body.setPosition(v.x, v.footY).setDisplaySize(CELL_PX * art.displayCells * scale, displayHeight(art) * scale);
    if (v.weapon && wspec) v.weapon.setDisplaySize(CELL_PX * wspec.displayCells * scale, CELL_PX * wspec.displayCells * scale);
  }

  /**
   * 기본형 대비 무기 올림(월드 px): 두 본체 그림의 불투명 윗변이 지면 기준점 위로 얼마나 높은지의 차.
   * 진화형이 기본형보다 낮으면 음수(무기도 내려앉는다).
   */
  private liftOf(base: AssetSpec, art: AssetSpec): number {
    if (art.key === base.key) return 0;
    let lift = this.lifts.get(art.key);
    if (lift === undefined) {
      const above = (spec: AssetSpec) => displayHeight(spec) * (spec.originY - this.topRow(spec.key) / spec.height);
      lift = above(art) - above(base);
      this.lifts.set(art.key, lift);
    }
    return lift;
  }

  /** 텍스처의 불투명 윗변(텍스처 px 행). 원본 그림을 한 번 캔버스에 그려 위에서부터 훑는다. 잴 수 없으면 0(맨 위). */
  private topRow(key: string): number {
    const cached = this.tops.get(key);
    if (cached !== undefined) return cached;
    let top = 0;
    const src = this.c.scene.textures.get(key).getSourceImage();
    if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) {
      const w = src.width, h = src.height;
      const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
      if (ctx && w > 0 && h > 0) {
        ctx.drawImage(src, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        let i = 3;
        while (i < data.length && data[i]! <= TOP_ALPHA_MIN) i += 4;
        top = Math.floor((i - 3) / 4 / w);
      }
    }
    this.tops.set(key, top);
    return top;
  }

  /**
   * 진화: 새 형태가 되면 몸체·무기가 살짝 튀어 올랐다 내려앉는다(ui-rules-v2 §5, 왕복 0.28초). 몸체는 아래 기준점에서 커져 위로 솟는다.
   * 모션을 줄이면 크기·위치는 그대로 두고 투명도만 한 번 바꾼다. 빛기둥은 화면 겹층(EvolvePillar)이 그린다.
   */
  /** 그 형태(또는 부모 형태)의 진화 그림이 실려 있는가. 없으면 기본형 그림으로 대신 그린다. */
  private hasFormArt(type: TowerId, form: FormId): boolean {
    return towerBodyArt(type, form, key => this.c.scene.textures.exists(key)).key !== ASSETS.towers[type].key;
  }

  /** 숙련 별: 외곽선 있는 작은 금색 별 하나. */
  private star(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
    const pts = (r: number, inner: number) => Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 === 0 ? r : inner;
      return new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    });
    g.fillStyle(PALETTE.outline, 1).fillPoints(pts(7.5, 3.6), true);
    g.fillStyle(0xf4d35e, 1).fillPoints(pts(5.2, 2.4), true);
  }

  private popEvolved(v: TowerView) {
    const { scene, bridge } = this.c;
    const parts = v.weapon ? [v.body, v.weapon] : [v.body];
    if (bridge.reducedMotion) {
      for (const p of parts) scene.tweens.add({ targets: p, alpha: { from: 0.45, to: 1 }, duration: 240, ease: 'Sine.easeOut' });
      return;
    }
    for (const p of parts) {
      const sx = p.scaleX, sy = p.scaleY;
      const grow = p === v.body ? { x: 1.08, y: 1.16 } : { x: 1.12, y: 1.12 };
      scene.tweens.add({ targets: p, scaleX: sx * grow.x, scaleY: sy * grow.y, duration: 140, ease: 'Quad.easeOut', yoyo: true, onComplete: () => p.setScale(sx, sy) });
    }
  }
}

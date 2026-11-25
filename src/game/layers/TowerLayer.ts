import Phaser from 'phaser';
import type { TowerId } from '../../contracts/balance';
import type { DomainEvent } from '../../domain/events';
import { positionAt } from '../../domain/geometry';
import { evolutionAt } from '../../domain/r6Towers';
import { formBranch, type FormId } from '../../domain/towers';
import type { RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { ASSETS, CELL_PX, towerBodyArt, weaponMountOffset, type AssetSpec } from '../assets';
import { HANGAR_FLIGHT, type R6BattleAssets } from '../r6/BattleAssets';
import { headDirection, R6_COLORS } from '../r6/manifest';
import { R6TowerPlayback } from '../r6/TowerPlayback';
import { flyerLift, topFit, WIND_SPIN, windSpinStep } from './cues';
import { DEPTH, fieldPosition, FIXED_WEAPON, toWorld, type LayerContext } from './shared';

/**
 * `form`은 본체 그림이 맞춰진 형태, `lift`는 무기를 기본 높이보다 올리는 높이(월드 px, 형태에 따른 올림 + 장착점이 정한 올림), `mountX`는 장착점이 정한 가로 이동(월드 px).
 * `x`·`y`는 칸 가운데(월드 px), `footY`·`scale`은 세계 위쪽 경계에 맞춘 발판 높이와 몸체·무기 배율(맨 윗줄만 1이 아니다, cues.topFit), `shotLift`는 그에 맞춘 발사 시작점 올림이다.
 * `spin`·`spinBoost`·`spinAt`은 바람개비탑 날개의 각도(rad)·공격 순간 가속(rad/s)·마지막 갱신 시각(ms)이다.
 */
interface TowerView { body: Phaser.GameObjects.Image; weapon: Phaser.GameObjects.Image | null; pips: Phaser.GameObjects.Graphics; level: number; branch: string | null; form: FormId | null; lift: number; mountX: number; recoilUntil: number; angle: number; x: number; y: number; footY: number; scale: number; shotLift: number; spin: number; spinBoost: number; spinAt: number }

type Strike = Extract<DomainEvent, { type: 'strike' }>;
interface DroneFlight {
  image: Phaser.GameObjects.Image;
  shots: Phaser.GameObjects.Graphics;
  start: number;
  fps: number;
  weapon: number;
  targetId: number;
  target: { x: number; y: number };
  facing: number;
  goal: { x: number; y: number };
}

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

  private readonly r6: R6TowerPlayback | null;
  private readonly flights = new Map<number, DroneFlight>();

  constructor(c: LayerContext, private readonly assets: R6BattleAssets | null = null) {
    this.c = c;
    this.r6 = assets ? new R6TowerPlayback(c, assets) : null;
  }

  /** 발사체·즉발 효과의 시작점도 무기와 같이 올린다(EffectLayer가 읽는다). */
  weaponLift(towerId: number): number { return this.r6?.weaponLift(towerId) ?? this.towers.get(towerId)?.shotLift ?? 0; }
  weaponOffset(towerId: number): number { return this.r6?.weaponOffset(towerId) ?? 0; }

  onFire(e: Extract<DomainEvent, { type: 'fire' }>) {
    const t = this.towers.get(e.towerId);
    const shot = this.c.bridge.controller.state.projectiles.find(p => p.id === e.projectileId);
    if (this.r6) {
      if (shot) this.r6.attack(e.towerId, shot.toX - shot.fromX, shot.toY - shot.fromY);
      return;
    }
    if (t && shot) { t.angle = Math.atan2(shot.toY - shot.fromY, shot.toX - shot.fromX); t.recoilUntil = this.c.scene.time.now + 120; }
  }

  /** 즉발 공격(PRD §11.4): 무기는 첫 대상 쪽으로 돌고 반동한다. */
  onStrike(e: Strike) {
    const t = this.towers.get(e.towerId);
    const first = e.targets[0];
    if (!first) return;
    if (this.r6) {
      if (String(e.towerType) === 'hangar' && this.flyDrone(e, first)) return;
      this.r6.attack(e.towerId, first.x - e.fromX, first.y - e.fromY);
      return;
    }
    const fx = toWorld(e.fromX), fy = toWorld(e.fromY) - CELL_PX * 0.32 - (t?.shotLift ?? 0);
    if (t && e.towerType === 'wind') this.kickSpin(t);
    if (t && !FIXED_WEAPON.has(e.towerType)) { t.angle = Math.atan2(toWorld(first.y) - fy, toWorld(first.x) - fx); t.recoilUntil = this.c.scene.time.now + 120; }
  }

  private flyDrone(e: Strike, first: Strike['targets'][number]): boolean {
    const { scene, bridge } = this.c;
    const manifest = this.assets?.manifest;
    const art = manifest?.sheets[HANGAR_FLIGHT];
    const key = this.assets?.towerTexture(HANGAR_FLIGHT);
    if (!art || !key || bridge.reducedMotion) {
      // 비행 그림을 불러오는 중이나 움직임을 줄인 화면에서는 짧은 연사만 표시한다.
      const from = fieldPosition(this.c, e.fromX, e.fromY);
      const to = fieldPosition(this.c, first.x, first.y);
      const g = scene.add.graphics().setDepth(DEPTH.projectiles).setName('r6:vfx:drone-burst');
      this.droneBurst(g, from.x, from.y - CELL_PX * .32 - this.weaponLift(e.towerId), to.x, to.y - 12);
      scene.tweens.add({ targets: g, alpha: 0, duration: 100, onComplete: () => g.destroy() });
      return false;
    }
    const active = this.flights.get(e.towerId);
    const target = fieldPosition(this.c, first.x, first.y);
    const enemy = bridge.controller.state.enemies.find(value => value.id === first.enemyId);
    target.y -= enemy ? flyerLift(enemy, bridge.controller.state.tick) * CELL_PX : 0;
    if (active) {
      // 후속 공격도 같은 발진에서 처리해 도킹 동작을 끝까지 보여 준다.
      active.targetId = first.enemyId;
      active.goal = target;
      return true;
    }
    const tower = bridge.controller.state.towers.find(value => value.id === e.towerId);
    if (!tower) return false;
    const { stage, weapon } = evolutionAt(tower.level);
    const form = manifest?.towers.hangar?.[stage];
    if (!form) return false;
    const size = form.scale / 2.6;
    const name = `r6:tower:${tower.id}:drone`;
    const image = scene.add.image(0, 0, key, weapon * 8).setDepth(DEPTH.projectiles).setName(name)
      .setOrigin(art.pivot[0] / art.width, art.pivot[1] / art.height)
      .setDisplaySize(art.width * size, art.height * size).setVisible(false);
    const shots = scene.add.graphics().setDepth(DEPTH.projectiles - 1).setName(name + ':shots');
    this.flights.set(e.towerId, { image, shots, start: scene.time.now, fps: form.attack.fps,
      weapon, targetId: first.enemyId, target: { ...target }, goal: target, facing: 0 });
    return false;
  }

  private syncR6(s: RunState, time: number) {
    const sheets = this.r6!.sync(s, time);
    const projection = this.assets?.manifest?.projection;
    if (!projection) return;
    const { bridge } = this.c;
    const flightTexture = !bridge.reducedMotion && s.towers.some(tower => String(tower.type) === 'hangar')
      ? this.assets?.towerTexture(HANGAR_FLIGHT, sheets) : undefined;
    for (const [id, flight] of this.flights) {
      const { image, shots } = flight;
      const tower = s.towers.find(value => value.id === id);
      const frame = (time - flight.start) * flight.fps / 1000;
      if (!tower || bridge.reducedMotion || frame >= 7) {
        image.destroy();
        shots.destroy();
        this.flights.delete(id);
        continue;
      }
      if (flightTexture && image.texture.key !== flightTexture) {
        const { displayWidth, displayHeight } = image;
        image.setTexture(flightTexture, image.frame.name).setDisplaySize(displayWidth, displayHeight);
      }
      sheets.add(image.texture.key);
      if (frame < 1.9) continue;
      const progress = Phaser.Math.Clamp((frame - 1.9) / 5.1, 0, 1);
      const enemy = progress < .72 ? s.enemies.find(value => value.id === flight.targetId) : undefined;
      if (enemy) {
        const point = positionAt(bridge.controller.ctx.path, enemy.progress);
        const target = fieldPosition(this.c, point.x, point.y);
        target.y -= flyerLift(enemy, s.tick) * CELL_PX;
        flight.goal = target;
      }
      if (progress < .72) {
        flight.target.x = Phaser.Math.Linear(flight.target.x, flight.goal.x, .28);
        flight.target.y = Phaser.Math.Linear(flight.target.y, flight.goal.y, .28);
      }
      const foot = fieldPosition(this.c, tower.x, tower.y);
      const fromX = foot.x - 4;
      const fromY = foot.y - CELL_PX * .32 - this.weaponLift(id) + 9;
      const { x: targetX, y: groundY } = flight.target;
      const targetY = groundY - 12;
      const reach = Math.min(1, progress / .30, (1 - progress) / .29);
      const spread = reach ** 2 * (3 - 2 * reach);
      const orbit = Phaser.Math.Clamp((progress - .30) / .41, 0, 1) * Math.PI * 2;
      const x = Phaser.Math.Linear(fromX, targetX, spread) + Math.sin(orbit) * 20 * spread;
      const y = Phaser.Math.Linear(fromY, targetY - 14, spread) - (12 + Math.cos(orbit) * 7 * spread) * Math.sin(progress * Math.PI);
      const dx = image.visible ? x - image.x : targetX - fromX;
      const dy = image.visible ? y - image.y : targetY - fromY;
      if (Math.hypot(dx, dy) >= .25) flight.facing = Math.round(headDirection(dx, dy, projection) / 2) % 8;
      image.setPosition(x, y).setFrame(flight.weapon * 8 + flight.facing).setVisible(true);
      shots.clear();
      const volley = (progress - .33) * 8;
      if (volley >= 0 && volley < 3 && volley % 1 < .48) this.droneBurst(shots, x, y, targetX, targetY);
    }
    this.assets?.keepTowerSheets(sheets);
  }

  private droneBurst(g: Phaser.GameObjects.Graphics, x: number, y: number, tx: number, ty: number) {
    g.lineStyle(1.5, R6_COLORS.amber, .91);
    for (const start of [.22, .65]) {
      g.lineBetween(Phaser.Math.Linear(x, tx, start), Phaser.Math.Linear(y, ty, start),
        Phaser.Math.Linear(x, tx, start + .22), Phaser.Math.Linear(y, ty, start + .22));
    }
  }

  /** 바람개비탑이 돌풍을 날렸다: 날개가 순간 빨라진다. 움직임 줄이기면 돌지 않고 날개 투명도만 한 번 깜빡인다. */
  private kickSpin(v: TowerView) {
    const { scene, bridge } = this.c;
    if (!v.weapon) return;
    if (bridge.reducedMotion) { scene.tweens.add({ targets: v.weapon, alpha: { from: 0.55, to: 1 }, duration: 240, ease: 'Sine.easeOut' }); return; }
    v.spinBoost = WIND_SPIN.boost;
  }

  sync(s: RunState, time: number) {
    if (this.r6) { this.syncR6(s, time); return; }
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
        v = { body, weapon, pips, level: 0, branch: null, form: null, lift: 0, mountX: 0, recoilUntil: 0, angle: FIXED_WEAPON.has(t.type) ? 0 : -Math.PI / 2, x, y, footY: y + CELL_PX * 0.32, scale: 1, shotLift: 0, spin: t.id * 0.9, spinBoost: 0, spinAt: time };
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
      if (t.type === 'wind' && v.weapon) {
        const step = windSpinStep(v.spinBoost, Math.min(100, time - v.spinAt), bridge.reducedMotion);
        v.spin += step.turn; v.spinBoost = step.boost;
        v.weapon.setRotation(v.spin);
      }
      v.spinAt = time;
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

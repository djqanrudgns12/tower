import Phaser from 'phaser';
import { assetManifestSchema } from '../contracts/assetManifest';
import { ENEMY_KINDS, TOWER_IDS } from '../contracts/balance';
import { MAPS } from '../content';
import type { DomainEvent } from '../domain/events';
import { isR6Tower } from '../domain/r6Towers';
import { positionAt } from '../domain/geometry';
import { drawSprites } from './art';
import { applyManifest, ASSETS, CELL_PX, entriesForMap, WORLD_H, WORLD_W } from './assets';
import type { FieldBridge } from './bridge';
import { AmbientLayer } from './layers/AmbientLayer';
import { EffectLayer } from './layers/EffectLayer';
import { EnemyLayer } from './layers/EnemyLayer';
import { GroundLayer } from './layers/GroundLayer';
import { InputLayer, selectedCell } from './layers/InputLayer';
import { bossCue, spawnIntros, SPLIT_LABEL_RAISE_CELLS } from './layers/cues';
import { DEPTH, fieldPosition, type LayerContext } from './layers/shared';
import { TowerLayer } from './layers/TowerLayer';
import { battlefieldDensity } from './quality';
import { R6BattleAssets, R6_GROUND_KEY } from './r6/BattleAssets';
import { isR6Battlefield } from './r6/manifest';
import { projectField, r6Overview, R6_MAP_SCALE } from './r6/mapProjection';

/**
 * 전장 장면: 층(지면·타워·적·효과·입력/선택 표시)을 만들고 카메라·미니맵과 사건 전달만 맡는다.
 * 도메인 상태를 읽기만 하고 판정·보상을 만들지 않는다(PRD §11.4, §13.2).
 */
export class BattleScene extends Phaser.Scene {
  private bridge!: FieldBridge;
  private layerContext!: LayerContext;
  private ground!: GroundLayer;
  private towerLayer!: TowerLayer;
  private ambient: AmbientLayer | null = null;
  private r6Assets: R6BattleAssets | null = null;
  private enemyLayer!: EnemyLayer;
  private effects!: EffectLayer;
  private inputLayer!: InputLayer;
  private miniCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private miniFrame!: Phaser.GameObjects.Graphics;
  private offEvents: (() => void) | null = null;
  private cssCell = 0;
  private cameraKey = '';
  private layoutKey = '';

  constructor() { super('battle'); }

  init(data: { bridge: FieldBridge }) { this.bridge = data.bridge; }

  /**
   * 인수된 원화(public/assets/manifest.json의 integrated_pass)가 있으면 같은 ID로 먼저 싣는다. 없으면 임시 그림.
   * 지금 맵의 재료와 공용 그림만 받고 다른 맵 재료는 받지 않는다(맵 id는 전투 제어기의 판 정보, `?previewMap`·`?qaRun`도 같다).
   */
  preload() {
    const { ctx } = this.bridge.controller;
    const mapId = ctx.map.id;
    if (isR6Battlefield(ctx)) {
      this.r6Assets = new R6BattleAssets(this, () => this.bridge.controller.renderQuality.current === 0 && window.devicePixelRatio > 4 / 3);
      this.r6Assets.preload(mapId, this.bridge.controller.state.owned);
      return;
    }
    this.load.json('asset-manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-asset-manifest', (_key: string, _type: string, data: unknown) => {
      const parsed = assetManifestSchema.safeParse(data);
      if (!parsed.success) return;
      for (const a of entriesForMap(applyManifest(parsed.data), mapId, MAPS.map(m => m.id))) this.load.image(a.id, `assets/${a.file}`);
    });
    // 종족 특성 배지: 화면의 원화 특성 아이콘과 같은 그림(R4 B3). 실패하면 배지를 그리지 않는다(loaderror 무시).
    for (const key of Object.values(ASSETS.traitBadge)) this.load.image(key, `assets/ui/${key.slice('badge.'.length)}.webp`);
    this.load.on('loaderror', () => undefined);
  }

  create() {
    const c: LayerContext = {
      scene: this, bridge: this.bridge,
      projected: Boolean(this.r6Assets && this.bridge.controller.ctx.map.id === 'garden_u' && this.textures.exists(R6_GROUND_KEY)),
    };
    this.layerContext = c;
    this.ground = new GroundLayer(c);
    this.ground.bake();
    drawSprites(this);
    this.publishIcons();
    this.ground.build();
    this.inputLayer = new InputLayer(c, p => Boolean(this.miniCam?.visible && p.x >= this.miniCam.x && p.y <= this.miniCam.y + this.miniCam.height));
    this.enemyLayer = new EnemyLayer(c, this.r6Assets);
    this.effects = new EffectLayer(c, Boolean(this.r6Assets));
    this.towerLayer = new TowerLayer(c, this.r6Assets);
    if (!this.r6Assets) this.ambient = new AmbientLayer(c);
    this.r6Assets?.prepareWave(this.bridge.controller.ctx, this.bridge.controller.state);
    this.miniFrame = this.add.graphics().setDepth(DEPTH.ui + 1);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(false);
    this.cameras.main.ignore(this.miniFrame);
    this.inputLayer.listen();
    this.offEvents = this.bridge.controller.onEvents(this.onEvents);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offEvents?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.offEvents?.());
    this.resizeToHost();
    this.ground.applyMood(true);
  }

  private publishIcons() {
    const icons: Record<string, string> = {};
    for (const id of TOWER_IDS) for (const key of [`tower.${id}`, `tower.${id}.weapon`]) if (this.textures.exists(key)) icons[key] = this.textures.getBase64(key);
    // 준비판의 다음 웨이브 미리보기·웨이브 띠의 대장 초상화도 전장과 같은 그림을 쓴다.
    for (const kind of ENEMY_KINDS) { const key = `enemy.${kind}.0`; if (this.textures.exists(key)) icons[key] = this.textures.getBase64(key); }
    this.r6Assets?.addTowerIcons(icons);
    this.bridge.onIcons?.(icons);
  }

  /** 표시 크기는 유지하고 캔버스 내부 픽셀과 카메라를 함께 맞춘다. */
  resizeToHost(cssWidth?: number, cssHeight?: number) {
    const host = this.game.canvas.parentElement;
    const w = cssWidth ?? host?.clientWidth;
    const h = cssHeight ?? host?.clientHeight;
    const zoom = 1 / battlefieldDensity(this.bridge.controller.renderQuality.current);
    if (w && h) {
      const width = Math.max(1, Math.round(w / zoom));
      const height = Math.max(1, Math.round(h / zoom));
      if (this.scale.width !== width || this.scale.height !== height) this.scale.resize(width, height);
      if (this.scale.zoom !== zoom) this.scale.setZoom(zoom);
    }
    this.layout();
  }

  layout() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    const sel = this.bridge.magnify ? selectedCell(this.bridge) : null;
    const key = `${w}:${h}:${this.scale.zoom}:${sel?.id ?? ''}`;
    if (this.layoutKey === key) return;
    this.layoutKey = key;
    cam.setViewport(0, 0, w, h);
    const frame = this.layerContext.projected ? r6Overview : { x: 0, y: 0, width: WORLD_W, height: WORLD_H };
    const fit = Math.min(w / frame.width, h / frame.height);
    this.cssCell = fit * CELL_PX * (this.layerContext.projected ? R6_MAP_SCALE : 1) * this.scale.zoom;
    if (sel) {
      const factor = Math.max(1, 48 / Math.max(1, this.cssCell));
      cam.setZoom(fit * factor);
      const x = (sel.x + 0.5) * CELL_PX, y = (sel.y + 0.5) * CELL_PX;
      const point = this.layerContext.projected ? projectField(x, y) : { x, y };
      cam.centerOn(point.x, point.y);
      this.showMini(w, frame);
    } else {
      cam.setZoom(fit);
      cam.centerOn(frame.x + frame.width / 2, frame.y + frame.height / 2);
      this.hideMini();
    }
  }

  private showMini(canvasW: number, frame: { x: number; y: number; width: number; height: number }) {
    const dpr = 1 / this.scale.zoom;
    const mw = Math.round(90 * dpr), mh = Math.round(54 * dpr), pad = Math.round(6 * dpr);
    if (!this.miniCam) {
      this.miniCam = this.cameras.add(canvasW - mw - pad, pad, mw, mh).setBounds(0, 0, WORLD_W, WORLD_H);
      this.miniCam.setBackgroundColor('rgba(58,41,30,0.85)');
      this.miniCam.ignore([this.enemyLayer.hpBars, this.effects.callouts]);
    }
    const fit = Math.min(mw / frame.width, mh / frame.height);
    this.miniCam.setViewport(canvasW - mw - pad, pad, mw, mh).setZoom(fit)
      .centerOn(frame.x + frame.width / 2, frame.y + frame.height / 2);
    this.miniCam.setVisible(true);
  }

  private hideMini() { this.miniCam?.setVisible(false); this.miniFrame.clear(); }

  private onEvents = (events: DomainEvent[]) => {
    if (!this.sys.isActive()) return;
    const { balance, path } = this.bridge.controller.ctx;
    const state = this.bridge.controller.state;
    // 분열 파생체·호위병은 처음 그릴 때 등장 연출을 한다(cues.spawnIntros).
    const intros = spawnIntros(balance, events);
    if (intros.length) this.enemyLayer.expectIntros(intros);
    const enemyLift = (id: number) => this.enemyLayer.liftOf(id);
    for (const e of events) {
      if (e.type === 'hit') {
        this.enemyLayer.onHit(e.enemyId);
        this.effects.onHit(e, enemyLift(e.enemyId));
      } else if (e.type === 'kill') {
        this.enemyLayer.onKill(e.enemyId);
        const splits = Boolean(balance.enemies[e.kind].split);
        this.effects.onKill(e, splits ? CELL_PX * SPLIT_LABEL_RAISE_CELLS : 0);
        if (splits) this.effects.onSplit(e.x, e.y);
      } else if (e.type === 'bossSkill') {
        this.enemyLayer.onBossSkill(e.enemyId);
        const boss = state.enemies.find(x => x.id === e.enemyId);
        const cue = bossCue(balance, boss, e.skill);
        if (cue && boss) {
          const world = (progress: number) => { const p = positionAt(path, progress); return fieldPosition(this.layerContext, p.x, p.y); };
          // 호위병이 나타날 자리(같은 묶음에서 생긴 파생체). 대장 옆 먼지 구름을 그 자리에 피운다.
          const spots = cue.kind === 'dust' ? intros.flatMap(i => {
            const escort = i.style === 'escort' ? state.enemies.find(x => x.id === i.enemyId) : undefined;
            return escort ? [world(escort.progress)] : [];
          }) : [];
          this.effects.onBossSkill(cue, this.enemyLayer.placeOf(boss.id) ?? world(boss.progress), spots);
        }
      } else if (e.type === 'fire') {
        this.towerLayer.onFire(e);
      } else if (e.type === 'strike') {
        this.towerLayer.onStrike(e);
        this.effects.onStrike(e, this.towerLayer.weaponLift(e.towerId), enemyLift, this.towerLayer.weaponOffset(e.towerId));
      } else if (e.type === 'towerUnlocked' && isR6Tower(e.tower)) {
        this.r6Assets?.towerUnlocked(e.tower, () => this.publishIcons());
      } else if (e.type === 'hazardPlaced') {
        this.effects.onHazardPlaced(e);
      } else if (e.type === 'hazardTriggered') {
        this.effects.onHazardTriggered(e);
      } else if (e.type === 'burn') {
        const at = this.enemyLayer.spriteAt(e.enemyId);
        if (at) this.effects.onBurn(at);
      } else if (e.type === 'leak') {
        this.effects.onLeak();
      } else if (e.type === 'phase') {
        if (e.phase === 'PREP_QUIZ') this.ground.applyMood(false);
        if (e.phase === 'PREP_QUIZ' || e.phase === 'BATTLE') this.r6Assets?.prepareWave(this.bridge.controller.ctx, state);
      }
    }
  };

  override update(time: number, delta: number) {
    const { controller } = this.bridge;
    if (this.scale.zoom !== 1 / battlefieldDensity(controller.renderQuality.current)) this.resizeToHost();
    const s = controller.state;
    const alpha = controller.alpha;
    this.enemyLayer.advance(s);
    this.towerLayer.sync(s, time);
    this.ground.syncPads(s, delta);
    this.ambient?.update(delta, controller.renderQuality.current >= 2);
    this.enemyLayer.sync(s, time, alpha, delta);
    this.effects.syncHazards(s, alpha);
    this.effects.syncShots(s, alpha, (id, a) => this.enemyLayer.progressOf(id, a), id => this.towerLayer.weaponLift(id), id => this.enemyLayer.liftOf(id));
    this.inputLayer.draw(s);
    const v = this.cameras.main.worldView;
    if (this.miniCam?.visible) this.miniFrame.clear().lineStyle(6, 0xf5ebd4, 1).strokeRect(v.x, v.y, v.width, v.height);
    // 보이는 영역이 바뀌면 DOM 겹층(타워 옆 도구 묶음 등)이 칸 위치를 다시 맞춘다.
    const cameraKey = `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.width.toFixed(1)},${v.height.toFixed(1)}`;
    if (cameraKey !== this.cameraKey && v.width > 0) {
      this.cameraKey = cameraKey;
      this.bridge.onCamera?.({ x: v.x, y: v.y, width: v.width, height: v.height, ...(this.layerContext.projected ? { projected: true } : {}) });
    }
  }
}

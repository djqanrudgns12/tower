import Phaser from 'phaser';
import { assetManifestSchema } from '../contracts/assetManifest';
import { ENEMY_KINDS, TOWER_IDS } from '../contracts/balance';
import type { DomainEvent } from '../domain/events';
import { positionAt } from '../domain/geometry';
import { drawSprites } from './art';
import { applyManifest, ASSETS, CELL_PX, WORLD_H, WORLD_W } from './assets';
import type { FieldBridge } from './bridge';
import { AmbientLayer } from './layers/AmbientLayer';
import { EffectLayer } from './layers/EffectLayer';
import { EnemyLayer } from './layers/EnemyLayer';
import { GroundLayer } from './layers/GroundLayer';
import { InputLayer, selectedCell } from './layers/InputLayer';
import { bossCue, spawnIntros, SPLIT_LABEL_RAISE_CELLS } from './layers/cues';
import { DEPTH, toWorld } from './layers/shared';
import { TowerLayer } from './layers/TowerLayer';

/**
 * 전장 장면: 층(지면·타워·적·효과·입력/선택 표시)을 만들고 카메라·미니맵과 사건 전달만 맡는다.
 * 도메인 상태를 읽기만 하고 판정·보상을 만들지 않는다(PRD §11.4, §13.2).
 */
export class BattleScene extends Phaser.Scene {
  private bridge!: FieldBridge;
  private ground!: GroundLayer;
  private towerLayer!: TowerLayer;
  private ambient!: AmbientLayer;
  private enemyLayer!: EnemyLayer;
  private effects!: EffectLayer;
  private inputLayer!: InputLayer;
  private miniCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private miniFrame!: Phaser.GameObjects.Graphics;
  private offEvents: (() => void) | null = null;
  private cssCell = 0;
  private cameraKey = '';

  constructor() { super('battle'); }

  init(data: { bridge: FieldBridge }) { this.bridge = data.bridge; }

  /** 인수된 원화(public/assets/manifest.json의 integrated_pass)가 있으면 같은 ID로 먼저 싣는다. 없으면 임시 그림. */
  preload() {
    this.load.json('asset-manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-asset-manifest', (_key: string, _type: string, data: unknown) => {
      const parsed = assetManifestSchema.safeParse(data);
      if (!parsed.success) return;
      for (const a of applyManifest(parsed.data)) this.load.image(a.id, `assets/${a.file}`);
    });
    // 종족 특성 배지: 화면의 원화 특성 아이콘과 같은 그림(R4 B3). 실패하면 배지를 그리지 않는다(loaderror 무시).
    for (const key of Object.values(ASSETS.traitBadge)) this.load.image(key, `assets/ui/${key.slice('badge.'.length)}.png`);
    this.load.on('loaderror', () => undefined);
  }

  create() {
    const c = { scene: this as Phaser.Scene, bridge: this.bridge };
    this.ground = new GroundLayer(c);
    this.ground.bake();
    drawSprites(this);
    const icons: Record<string, string> = {};
    for (const id of TOWER_IDS) for (const key of [`tower.${id}`, `tower.${id}.weapon`]) if (this.textures.exists(key)) icons[key] = this.textures.getBase64(key);
    // 준비판의 다음 웨이브 미리보기·웨이브 띠의 대장 초상화도 전장과 같은 그림을 쓴다.
    for (const kind of ENEMY_KINDS) { const key = `enemy.${kind}.0`; if (this.textures.exists(key)) icons[key] = this.textures.getBase64(key); }
    this.bridge.onIcons?.(icons);
    this.ground.build();
    this.inputLayer = new InputLayer(c, p => Boolean(this.miniCam?.visible && p.x >= this.miniCam.x && p.y <= this.miniCam.y + this.miniCam.height));
    this.enemyLayer = new EnemyLayer(c);
    this.effects = new EffectLayer(c);
    this.towerLayer = new TowerLayer(c);
    this.ambient = new AmbientLayer(c);
    this.miniFrame = this.add.graphics().setDepth(DEPTH.ui + 1);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(false);
    this.cameras.main.ignore(this.miniFrame);
    this.inputLayer.listen();
    this.offEvents = this.bridge.controller.onEvents(this.onEvents);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offEvents?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.offEvents?.());
    this.layout();
    this.ground.applyMood(true);
  }

  /** 캔버스 크기가 바뀌면 React 쪽에서 호출한다. */
  layout() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setViewport(0, 0, w, h);
    const fit = Math.min(w / WORLD_W, h / WORLD_H);
    this.cssCell = (fit * CELL_PX) / Math.max(1, window.devicePixelRatio || 1);
    const sel = selectedCell(this.bridge);
    if (this.bridge.magnify && sel) {
      const factor = Math.max(1, 48 / Math.max(1, this.cssCell));
      cam.setZoom(fit * factor);
      cam.centerOn((sel.x + 0.5) * CELL_PX, (sel.y + 0.5) * CELL_PX);
      this.showMini(w);
    } else {
      cam.setZoom(fit);
      cam.centerOn(WORLD_W / 2, WORLD_H / 2);
      this.hideMini();
    }
  }

  private showMini(canvasW: number) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const mw = Math.round(90 * dpr), mh = Math.round(54 * dpr), pad = Math.round(6 * dpr);
    if (!this.miniCam) {
      this.miniCam = this.cameras.add(canvasW - mw - pad, pad, mw, mh).setBounds(0, 0, WORLD_W, WORLD_H);
      this.miniCam.setBackgroundColor('rgba(58,41,30,0.85)');
      this.miniCam.ignore([this.enemyLayer.hpBars, this.effects.callouts]);
    }
    this.miniCam.setViewport(canvasW - mw - pad, pad, mw, mh).setZoom(mw / WORLD_W).centerOn(WORLD_W / 2, WORLD_H / 2);
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
        const splits = Boolean(balance.enemies[e.kind].split);
        this.effects.onKill(e, splits ? CELL_PX * SPLIT_LABEL_RAISE_CELLS : 0);
        if (splits) this.effects.onSplit(e.x, e.y);
      } else if (e.type === 'bossSkill') {
        const boss = state.enemies.find(x => x.id === e.enemyId);
        const cue = bossCue(balance, boss, e.skill);
        if (cue && boss) {
          const world = (progress: number) => { const p = positionAt(path, progress); return { x: toWorld(p.x), y: toWorld(p.y) }; };
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
        this.effects.onStrike(e, this.towerLayer.weaponLift(e.towerId), enemyLift);
      } else if (e.type === 'hazardPlaced') {
        this.effects.onHazardPlaced(e);
      } else if (e.type === 'hazardTriggered') {
        this.effects.onHazardTriggered(e);
      } else if (e.type === 'burn') {
        const at = this.enemyLayer.spriteAt(e.enemyId);
        if (at) this.effects.onBurn(at);
      } else if (e.type === 'leak') {
        this.effects.onLeak();
      } else if (e.type === 'phase' && e.phase === 'PREP_QUIZ') this.ground.applyMood(false);
    }
  };

  override update(time: number, delta: number) {
    const s = this.bridge.controller.state;
    const alpha = this.bridge.controller.alpha;
    this.enemyLayer.advance(s);
    this.towerLayer.sync(s, time);
    this.ground.syncPads(s, delta);
    this.ambient.update(delta);
    this.enemyLayer.sync(s, time, alpha);
    this.effects.syncHazards(s, alpha);
    this.effects.syncShots(s, alpha, (id, a) => this.enemyLayer.progressOf(id, a), id => this.towerLayer.weaponLift(id), id => this.enemyLayer.liftOf(id));
    this.inputLayer.draw(s);
    const v = this.cameras.main.worldView;
    if (this.miniCam?.visible) this.miniFrame.clear().lineStyle(6, 0xf5ebd4, 1).strokeRect(v.x, v.y, v.width, v.height);
    // 보이는 영역이 바뀌면 DOM 겹층(타워 옆 도구 묶음 등)이 칸 위치를 다시 맞춘다.
    const cameraKey = `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.width.toFixed(1)},${v.height.toFixed(1)}`;
    if (cameraKey !== this.cameraKey && v.width > 0) {
      this.cameraKey = cameraKey;
      this.bridge.onCamera?.({ x: v.x, y: v.y, width: v.width, height: v.height });
    }
  }
}

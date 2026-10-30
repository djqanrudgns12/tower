import type Phaser from 'phaser';
import { DEFAULTS } from '../../content';
import { composeGroundArt, drawGround, isTreeCell } from '../art';
import { ASSETS, CELL_PX, TEX, WORLD_H, WORLD_W } from '../assets';
import { DEPTH, type LayerContext } from './shared';

/** deco.stele.r1 원화에서 비석 면 가운데의 세로 위치(원화 높이 대비, 면은 약 28~130/192px). */
const STELE_FACE_Y = 0.41;

/** 지면 층: 바닥 그림, 나무·바위·비석·성문 원화, 웨이브 무드 색층. */
export class GroundLayer {
  private readonly c: LayerContext;
  private mood!: Phaser.GameObjects.Rectangle;
  private moodWave = -1;
  private has = { gate: false, tree: false, stele: false, rock: false };

  constructor(c: LayerContext) { this.c = c; }

  /** 인수된 성문·나무·비석·바위 원화가 있으면 지면에 굽지 않고 이미지로 세운다. 바닥 재료(ART-002)가 있으면 지면도 원화로 조립한다. */
  bake() {
    const { scene } = this.c;
    const map = this.c.bridge.controller.ctx.map;
    const t = scene.textures;
    this.has = { gate: t.exists('map.gate'), tree: t.exists('deco.tree'), stele: t.exists('deco.stele'), rock: t.exists('deco.rock') };
    if (!t.exists(ASSETS.ground.key) && !composeGroundArt(scene, map)) drawGround(scene, map, this.has);
  }

  build() {
    const { scene } = this.c;
    const map = this.c.bridge.controller.ctx.map;
    scene.add.image(0, 0, ASSETS.ground.key).setOrigin(0).setScale(1 / TEX).setDepth(DEPTH.ground);
    const decor = new Map<string, Phaser.GameObjects.Image>();
    for (const d of map.decorations) {
      const [dx, dy] = d.cells[0]!;
      const key = d.kind === 'culture' ? 'deco.stele' : isTreeCell(dx, dy) ? 'deco.tree' : 'deco.rock';
      if (scene.textures.exists(key)) decor.set(`${dx},${dy}`, this.placeDecor(key, dx, dy));
    }
    if (this.has.gate) this.placeDecor('map.gate', map.exitCell[0], map.exitCell[1]);
    for (const d of map.decorations) if (d.kind === 'culture') {
      const [x, y] = d.cells[0]!;
      // 원화 비석은 칸보다 위로 솟아 있으므로 비석 면 가운데에 새기고, 비석 바로 위 깊이에 둔다.
      const art = decor.get(`${x},${y}`);
      const glyphY = art ? art.y - (art.originY - STELE_FACE_Y) * art.displayHeight : (y + 0.42) * CELL_PX;
      scene.add.text((x + 0.5) * CELL_PX, glyphY, '가', { fontFamily: 'Pretendard Variable, Pretendard, sans-serif', fontSize: '20px', fontStyle: '700', color: '#463c35', resolution: 2 }).setOrigin(0.5).setDepth(art ? art.depth + 0.1 : DEPTH.overlay);
    }
    this.mood = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff, 0).setOrigin(0).setDepth(DEPTH.mood);
  }

  private placeDecor(key: string, x: number, y: number) {
    const img = this.c.scene.add.image((x + 0.5) * CELL_PX, (y + 0.5) * CELL_PX, key);
    const src = img.texture.getSourceImage() as { width: number; height: number };
    const cells = key === 'map.gate' ? 1.8 : 1.05;
    return img.setOrigin(0.5, key === 'map.gate' ? 0.75 : 0.85).setDisplaySize(CELL_PX * cells, (CELL_PX * cells * src.height) / src.width).setDepth(DEPTH.units + (y + 0.5) * CELL_PX);
  }

  /** 웨이브 무드: 지면 위 약한 색층만 바꾼다(PRD §11.5). */
  applyMood(immediate: boolean) {
    const { scene, bridge } = this.c;
    const wave = Math.max(1, bridge.controller.state.wave);
    if (wave === this.moodWave) return;
    this.moodWave = wave;
    const entry = DEFAULTS.mood.entries[(wave - 1) % 5]!;
    const color = entry.tint ? Number.parseInt(entry.tint.slice(1), 16) : 0xffffff;
    scene.tweens.killTweensOf(this.mood);
    if (immediate || bridge.reducedMotion) { this.mood.setFillStyle(color, entry.alpha); return; }
    scene.tweens.add({ targets: this.mood, fillAlpha: 0, duration: 300, onComplete: () => { this.mood.setFillStyle(color, 0); scene.tweens.add({ targets: this.mood, fillAlpha: entry.alpha, duration: 300 }); } });
  }
}

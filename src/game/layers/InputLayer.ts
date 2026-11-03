import type Phaser from 'phaser';
import type { TowerId } from '../../contracts/balance';
import { evolutionChoices, reachMilli } from '../../domain/towers';
import type { RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { CELL_PX } from '../assets';
import type { FieldBridge } from '../bridge';
import { isPlacing } from './cues';
import { DEPTH, toWorld, type LayerContext } from './shared';

/** 지금 고른 설치 자리(빈 자리 또는 고른 타워의 자리). */
export function selectedCell(bridge: FieldBridge) {
  const sel = bridge.selection;
  const slotId = sel.slotId ?? bridge.controller.state.towers.find(t => t.id === sel.towerId)?.slotId ?? null;
  return slotId ? bridge.controller.ctx.map.slots.find(s => s.id === slotId) ?? null : null;
}

/** 입력·선택 표시 층: 전장 탭을 설치 자리로 바꿔 화면에 알리고, 선택 칸·사거리 원·키보드 커서·고대비 윤곽을 그린다. */
export class InputLayer {
  private readonly c: LayerContext;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private overlayKey = '';
  private down: { x: number; y: number } | null = null;
  /** 미니맵 위 탭인지. 미니맵은 위치 안내용이라 탭을 무시한다(PRD §12.4). */
  private readonly overMinimap: (p: Phaser.Input.Pointer) => boolean;

  constructor(c: LayerContext, overMinimap: (p: Phaser.Input.Pointer) => boolean) {
    this.c = c;
    this.overMinimap = overMinimap;
    this.overlay = c.scene.add.graphics().setDepth(DEPTH.overlay);
  }

  /** 장면 입력에 연결한다. 오버레이 생성 뒤, 다른 층이 준비된 다음에 부른다. */
  listen() {
    const input = this.c.scene.input;
    input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.down = { x: p.x, y: p.y }; });
    input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    const { scene, bridge } = this.c;
    const down = this.down;
    this.down = null;
    if (!down || Math.hypot(p.x - down.x, p.y - down.y) > 14 * (window.devicePixelRatio || 1)) return;
    if (this.overMinimap(p)) return;
    const world = scene.cameras.main.getWorldPoint(p.x, p.y);
    const state = bridge.controller.state;
    const slot = this.slotNear(world.x, world.y);
    if (!slot) { bridge.onTap({ kind: 'empty' }); return; }
    const tower = state.towers.find(t => t.slotId === slot.id);
    bridge.onTap(tower ? { kind: 'tower', towerId: tower.id, slotId: slot.id } : { kind: 'slot', slotId: slot.id });
  }

  /**
   * 탭한 칸의 설치 자리. 칸이 작으면(손끝 반지름 22px보다 작으면) 손끝 안의 가장 가까운 자리로 붙는다.
   * 휴대폰에서 바로 설치할 때 옆 칸을 잘못 누르는 일을 줄인다.
   */
  private slotNear(wx: number, wy: number) {
    const { scene, bridge } = this.c;
    const slots = bridge.controller.ctx.map.slots;
    const x = Math.floor(wx / CELL_PX), y = Math.floor(wy / CELL_PX);
    const exact = slots.find(s => s.x === x && s.y === y);
    if (exact) return exact;
    const cssPerCanvas = scene.game.canvas.getBoundingClientRect().width / Math.max(1, scene.scale.width);
    const cssCell = scene.cameras.main.zoom * CELL_PX * cssPerCanvas;
    const reach = Math.max(0.5, 22 / Math.max(1, cssCell)) * CELL_PX;
    let best: (typeof slots)[number] | null = null;
    let bestD = reach * reach;
    for (const s of slots) {
      const d = ((s.x + 0.5) * CELL_PX - wx) ** 2 + ((s.y + 0.5) * CELL_PX - wy) ** 2;
      if (d <= bestD) { best = s; bestD = d; }
    }
    return best;
  }

  /** 선택 칸·사거리 원·원 안의 길. 선택이 바뀔 때만 다시 그린다(PRD §12.4). */
  draw(s: RunState) {
    const { bridge } = this.c;
    const sel = bridge.selection;
    const tower = sel.towerId !== null ? s.towers.find(t => t.id === sel.towerId) ?? null : null;
    const highContrast = Boolean((bridge as { highContrastMap?: boolean }).highContrastMap);
    const drag = bridge.drag;
    const key = `${sel.slotId}|${sel.towerId}|${sel.previewType}|${sel.previewBranch}|${tower?.level}|${tower?.form}|${s.phase}|${s.towers.length}|${bridge.magnify}|${bridge.keyboardSlotId}|${highContrast}|${drag?.type}:${drag?.slotId}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const g = this.overlay.clear();
    const map = bridge.controller.ctx.map;
    const b = bridge.controller.ctx.balance;
    if (highContrast) {
      const pathSet = new Set(map.pathCells.map(([px, py]) => `${px},${py}`));
      for (const [px, py] of map.pathCells) {
        const x0 = px * CELL_PX, y0 = py * CELL_PX;
        if (!pathSet.has(`${px},${py - 1}`)) { g.lineStyle(4, PALETTE.outline, 0.95).lineBetween(x0, y0 + 2, x0 + CELL_PX, y0 + 2); g.lineStyle(2, 0xfff6d8, 0.9).lineBetween(x0, y0 + 5, x0 + CELL_PX, y0 + 5); }
        if (!pathSet.has(`${px},${py + 1}`)) { g.lineStyle(4, PALETTE.outline, 0.95).lineBetween(x0, y0 + CELL_PX - 2, x0 + CELL_PX, y0 + CELL_PX - 2); g.lineStyle(2, 0xfff6d8, 0.9).lineBetween(x0, y0 + CELL_PX - 5, x0 + CELL_PX, y0 + CELL_PX - 5); }
        if (!pathSet.has(`${px - 1},${py}`)) { g.lineStyle(4, PALETTE.outline, 0.95).lineBetween(x0 + 2, y0, x0 + 2, y0 + CELL_PX); g.lineStyle(2, 0xfff6d8, 0.9).lineBetween(x0 + 5, y0, x0 + 5, y0 + CELL_PX); }
        if (!pathSet.has(`${px + 1},${py}`)) { g.lineStyle(4, PALETTE.outline, 0.95).lineBetween(x0 + CELL_PX - 2, y0, x0 + CELL_PX - 2, y0 + CELL_PX); g.lineStyle(2, 0xfff6d8, 0.9).lineBetween(x0 + CELL_PX - 5, y0, x0 + CELL_PX - 5, y0 + CELL_PX); }
      }
      for (const slot of map.slots) {
        if (!s.towers.some(t => t.slotId === slot.id)) {
          g.lineStyle(3, PALETTE.outline, 0.95).strokeRoundedRect(slot.x * CELL_PX + 6, slot.y * CELL_PX + 6, CELL_PX - 12, CELL_PX - 12, 8);
          g.lineStyle(1.5, 0xf5d98e, 0.95).strokeRoundedRect(slot.x * CELL_PX + 8, slot.y * CELL_PX + 8, CELL_PX - 16, CELL_PX - 16, 6);
        }
      }
    }
    // 타워를 먼저 골랐거나 끌고 있으면 놓을 수 있는 빈 자리를 모두 밝힌다.
    if (isPlacing(s.phase, sel, Boolean(drag))) {
      for (const slot of map.slots) if (!s.towers.some(t => t.slotId === slot.id)) g.lineStyle(3, 0xf5ebd4, 0.9).strokeRoundedRect(slot.x * CELL_PX + 5, slot.y * CELL_PX + 5, CELL_PX - 10, CELL_PX - 10, 8);
    }
    const dragCell = drag?.slotId ? map.slots.find(slot => slot.id === drag.slotId) ?? null : null;
    const cell = drag ? dragCell : selectedCell(bridge);
    if (cell) {
      let range = 0;
      // 끌고 있으면 끄는 종류의 Lv1 사거리를 그린다.
      const type: TowerId | null = drag ? drag.type : tower?.type ?? sel.previewType;
      const built = drag ? null : tower;
      // 진화 미리보기: previewBranch는 두 선택지 가운데 첫째(A)·둘째(B)다.
      const choices = built && sel.previewBranch ? evolutionChoices(b, built) : null;
      const preview = choices ? choices[sel.previewBranch === 'A' ? 0 : 1]! : null;
      if (type) range = toWorld(reachMilli(b, type, built ? (preview ? built.level + 1 : built.level) : 1, built ? (preview ?? built.form) : 'base'));
      const cx = (cell.x + 0.5) * CELL_PX, cy = (cell.y + 0.5) * CELL_PX;
      if (range > 0) {
        g.fillStyle(0xf5ebd4, 0.16).fillCircle(cx, cy, range).lineStyle(2.5, 0xf5ebd4, 0.95).strokeCircle(cx, cy, range);
        for (const [x, y] of map.pathCells) {
          const px = (x + 0.5) * CELL_PX, py = (y + 0.5) * CELL_PX;
          if ((px - cx) ** 2 + (py - cy) ** 2 <= range * range) g.fillStyle(0xfff6d8, 0.42).fillRoundedRect(px - CELL_PX * 0.3, py - CELL_PX * 0.3, CELL_PX * 0.6, CELL_PX * 0.6, 8);
        }
      }
      g.lineStyle(4, PALETTE.outline, 1).strokeRoundedRect(cell.x * CELL_PX + 2, cell.y * CELL_PX + 2, CELL_PX - 4, CELL_PX - 4, 10);
      g.lineStyle(3, 0xf4d35e, 1).strokeRoundedRect(cell.x * CELL_PX + 3, cell.y * CELL_PX + 3, CELL_PX - 6, CELL_PX - 6, 9);
    }
    // 키보드 커서: 선택(금색)과 구별되는 파란 이중 테두리. 포커스가 전장에 있을 때만 보인다.
    const cursor = bridge.keyboardSlotId ? map.slots.find(slot => slot.id === bridge.keyboardSlotId) : null;
    if (cursor) {
      g.lineStyle(5, 0xf5ebd4, 1).strokeRoundedRect(cursor.x * CELL_PX - 1, cursor.y * CELL_PX - 1, CELL_PX + 2, CELL_PX + 2, 12);
      g.lineStyle(3, 0x245b88, 1).strokeRoundedRect(cursor.x * CELL_PX - 1, cursor.y * CELL_PX - 1, CELL_PX + 2, CELL_PX + 2, 12);
    }
  }
}

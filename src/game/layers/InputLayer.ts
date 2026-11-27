import type Phaser from 'phaser';
import type { TowerId } from '../../contracts/balance';
import { relicBalance } from '../../domain/relics';
import { evolutionChoices, reachMilli } from '../../domain/towers';
import type { RunState } from '../../domain/types';
import { PALETTE } from '../art';
import { CELL_PX } from '../assets';
import type { FieldBridge } from '../bridge';
import { R6_GROUND_KEY } from '../r6/BattleAssets';
import { projectField, unprojectField, r6Pad, R6_MAP_SCALE, R6_MAP_SQUASH } from '../r6/mapProjection';
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
  private readonly r6: boolean;
  private overlayKey = '';
  private down: { x: number; y: number } | null = null;
  private hovered: ReturnType<typeof selectedCell> = null;
  /** 미니맵 위 탭인지. 미니맵은 위치 안내용이라 탭을 무시한다(PRD §12.4). */
  private readonly overMinimap: (p: Phaser.Input.Pointer) => boolean;

  constructor(c: LayerContext, overMinimap: (p: Phaser.Input.Pointer) => boolean) {
    this.c = c;
    this.overMinimap = overMinimap;
    this.r6 = c.scene.textures.exists(R6_GROUND_KEY);
    this.overlay = c.scene.add.graphics().setDepth(DEPTH.overlay);
  }

  /** 장면 입력에 연결한다. 오버레이 생성 뒤, 다른 층이 준비된 다음에 부른다. */
  listen() {
    const input = this.c.scene.input;
    input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.down = { x: p.x, y: p.y }; });
    input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    if (this.r6) {
      input.on('pointermove', (p: Phaser.Input.Pointer) => {
        this.hovered = null;
        if (p.wasTouch || this.overMinimap(p)) return;
        const world = this.c.scene.cameras.main.getWorldPoint(p.x, p.y);
        this.hovered = this.exactSlot(world.x, world.y) ?? null;
      });
      input.on('gameout', () => { this.hovered = null; });
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    const { scene, bridge } = this.c;
    const down = this.down;
    this.down = null;
    if (!down || Math.hypot(p.x - down.x, p.y - down.y) * scene.scale.zoom > 14) return;
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
    const exact = this.exactSlot(wx, wy);
    if (exact) return exact;
    const cssPerCanvas = scene.game.canvas.getBoundingClientRect().width / Math.max(1, scene.scale.width);
    const cssCell = scene.cameras.main.zoom * CELL_PX * cssPerCanvas;
    const radius = this.c.projected ? r6Pad.radius * R6_MAP_SQUASH : CELL_PX * 0.5;
    const reach = Math.max(radius, 22 * CELL_PX / Math.max(1, cssCell));
    let best: (typeof slots)[number] | null = null;
    let bestD = reach * reach;
    for (const s of slots) {
      const point = this.cellCenter(s);
      const d = (point.x - wx) ** 2 + (point.y - wy) ** 2;
      if (d <= bestD) { best = s; bestD = d; }
    }
    return best;
  }

  private exactSlot(wx: number, wy: number) {
    const { x, y } = this.c.projected ? unprojectField(wx, wy) : { x: wx, y: wy };
    return this.c.bridge.controller.ctx.map.slots.find(slot => slot.x === Math.floor(x / CELL_PX) && slot.y === Math.floor(y / CELL_PX));
  }

  private cellCenter(cell: { x: number; y: number }) {
    const x = (cell.x + 0.5) * CELL_PX, y = (cell.y + 0.5) * CELL_PX;
    return this.c.projected ? projectField(x, y) : { x, y };
  }

  /** 선택 칸·사거리 원·원 안의 길. 선택이 바뀔 때만 다시 그린다(PRD §12.4). */
  draw(s: RunState) {
    const { bridge } = this.c;
    const sel = bridge.selection;
    const tower = sel.towerId !== null ? s.towers.find(t => t.id === sel.towerId) ?? null : null;
    const highContrast = Boolean((bridge as { highContrastMap?: boolean }).highContrastMap);
    const drag = bridge.drag;
    const hovered = this.hovered && !drag && s.pause.length === 0 && (s.phase === 'BUILD' || s.phase === 'BATTLE')
      && !s.towers.some(t => t.slotId === this.hovered?.id) ? this.hovered : null;
    const key = `${sel.slotId}|${sel.towerId}|${sel.previewType}|${sel.previewBranch}|${tower?.level}|${tower?.form}|${s.phase}|${s.towers.length}|${bridge.magnify}|${bridge.keyboardSlotId}|${highContrast}|${drag?.type}:${drag?.slotId}|${hovered?.id}|${(s.relics ?? []).join(',')}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    const g = this.overlay.clear();
    const map = bridge.controller.ctx.map;
    // 원정 보물(사거리·깃발 오라 범위)을 적용한 밸런스로 사거리 원을 그린다(엔진 판정과 같은 값).
    const b = relicBalance(bridge.controller.ctx.balance, s.relics);
    if (highContrast && this.c.projected) {
      for (const [weight, color] of [[5, 0x12161b], [2, 0xb8c0c8]] as const) {
        g.lineStyle(weight, color).beginPath();
        for (const [i, [x, y]] of map.pathCells.entries()) {
          const p = this.cellCenter({ x, y });
          if (i === 0) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.strokePath();
      }
      for (const slot of map.slots) if (!s.towers.some(t => t.slotId === slot.id)) this.strokePad(slot, 0xb8c0c8, 2);
    } else if (highContrast) {
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
    // 이전 전장은 타워를 고르거나 끄는 동안 빈 자리를 모두 표시한다.
    if (this.c.projected && isPlacing(s.phase, sel, Boolean(drag))) {
      for (const slot of map.slots) if (!s.towers.some(t => t.slotId === slot.id)) this.strokePad(slot, 0xb8c0c8, 1);
    }
    if (!this.r6 && isPlacing(s.phase, sel, Boolean(drag))) {
      for (const slot of map.slots) if (!s.towers.some(t => t.slotId === slot.id)) g.lineStyle(3, 0xf5ebd4, 0.9).strokeRoundedRect(slot.x * CELL_PX + 5, slot.y * CELL_PX + 5, CELL_PX - 10, CELL_PX - 10, 8);
    }
    const dragCell = drag?.slotId ? map.slots.find(slot => slot.id === drag.slotId) ?? null : null;
    const cell = drag ? dragCell : selectedCell(bridge);
    if (hovered && hovered.id !== cell?.id) this.strokePad(hovered, bridge.lightTheme ? 0xffffff : 0xb8c0c8, bridge.lightTheme ? 2.2 : 1.5);
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
      if (range > 0 && this.c.projected) {
        const p = this.cellCenter(cell);
        const rx = range * R6_MAP_SCALE, ry = rx * R6_MAP_SQUASH;
        g.fillStyle(0x2fb5a3, 0.12).fillEllipse(p.x, p.y, rx * 2, ry * 2);
        g.lineStyle(1.5, 0x2fb5a3, 0.95).strokeEllipse(p.x, p.y, rx * 2, ry * 2, 48);
        for (const [x, y] of map.pathCells) {
          const dx = (x - cell.x) * CELL_PX, dy = (y - cell.y) * CELL_PX;
          if (dx ** 2 + dy ** 2 > range ** 2) continue;
          const p = this.cellCenter({ x, y });
          g.fillStyle(0x2fb5a3, 0.42).fillEllipse(p.x, p.y, 13, 7);
        }
      } else if (range > 0) {
        g.fillStyle(0xf5ebd4, 0.16).fillCircle(cx, cy, range).lineStyle(2.5, 0xf5ebd4, 0.95).strokeCircle(cx, cy, range);
        for (const [x, y] of map.pathCells) {
          const px = (x + 0.5) * CELL_PX, py = (y + 0.5) * CELL_PX;
          if ((px - cx) ** 2 + (py - cy) ** 2 <= range * range) g.fillStyle(0xfff6d8, 0.42).fillRoundedRect(px - CELL_PX * 0.3, py - CELL_PX * 0.3, CELL_PX * 0.6, CELL_PX * 0.6, 8);
        }
      }
      if (this.r6) this.strokePad(cell, 0xe69f24, 2);
      else {
        g.lineStyle(4, PALETTE.outline, 1).strokeRoundedRect(cell.x * CELL_PX + 2, cell.y * CELL_PX + 2, CELL_PX - 4, CELL_PX - 4, 10);
        g.lineStyle(3, 0xf4d35e, 1).strokeRoundedRect(cell.x * CELL_PX + 3, cell.y * CELL_PX + 3, CELL_PX - 6, CELL_PX - 6, 9);
      }
    }
    // 키보드 커서: 선택(금색)과 구별되는 파란 이중 테두리. 포커스가 전장에 있을 때만 보인다.
    const cursor = bridge.keyboardSlotId ? map.slots.find(slot => slot.id === bridge.keyboardSlotId) : null;
    if (cursor) {
      if (this.r6) this.strokePad(cursor, 0x2fb5a3, 2, 4);
      else {
        g.lineStyle(5, 0xf5ebd4, 1).strokeRoundedRect(cursor.x * CELL_PX - 1, cursor.y * CELL_PX - 1, CELL_PX + 2, CELL_PX + 2, 12);
        g.lineStyle(3, 0x245b88, 1).strokeRoundedRect(cursor.x * CELL_PX - 1, cursor.y * CELL_PX - 1, CELL_PX + 2, CELL_PX + 2, 12);
      }
    }
  }

  private strokePad(cell: { x: number; y: number }, color: number, width: number, offset = 0) {
    const { x, y } = this.cellCenter(cell);
    if (this.c.projected) {
      const radius = r6Pad.radius * 0.85 + offset;
      for (const [weight, ink] of [[width + 2, 0x12161b], [width, color]] as const) {
        this.overlay.lineStyle(weight, ink).beginPath().moveTo(x + radius, y);
        for (let i = 1; i < 6; i++) {
          const angle = i * Math.PI / 3;
          this.overlay.lineTo(x + radius * Math.cos(angle), y + radius * R6_MAP_SQUASH * Math.sin(angle));
        }
        this.overlay.closePath().strokePath();
      }
      return;
    }
    const w = 21 + offset, h = 18 + offset, cut = 7;
    const points = [[w - cut, -h], [w, -h + cut], [w, h - cut], [w - cut, h],
      [-w + cut, h], [-w, h - cut], [-w, -h + cut]] as const;
    for (const [weight, ink] of [[width + 2, 0x12161b], [width, color]] as const) {
      this.overlay.lineStyle(weight, ink).beginPath().moveTo(x - w + cut, y - h);
      for (const [dx, dy] of points) this.overlay.lineTo(x + dx, y + dy);
      this.overlay.closePath().strokePath();
    }
  }
}

import type Phaser from 'phaser';
import type { TowerId } from '../../contracts/balance';
import { CELL_PX } from '../assets';
import type { FieldBridge } from '../bridge';
import { projectField } from '../r6/mapProjection';

export const toWorld = (milli: number) => (milli * CELL_PX) / 1000;
/** 도메인의 milli-cell을 지면 위의 Phaser 좌표로 옮긴다. */
export function fieldPosition(c: LayerContext, milliX: number, milliY: number) {
  const x = toWorld(milliX), y = toWorld(milliY);
  return c.projected ? projectField(x, y) : { x, y };
}
/** 돌지 않고 떠 있는 무기(서리 결정·번개 구슬·바람개비). */
export const FIXED_WEAPON = new Set<TowerId>(['frost', 'lightning', 'wind']);
export const DEPTH = { ground: 0, mood: 1, overlay: 5, units: 10, r6Marks: 1900, projectiles: 2000, fx: 2100, ui: 3000 };

/** 발밑 Y가 같으면 받침, 적, 타워 순으로 그린다. */
export function r6UnitDepth(y: number, kind: 'pad' | 'enemy' | 'tower'): number {
  const depth = DEPTH.units + y;
  const tie = Math.abs(depth) * Number.EPSILON;
  return depth + (kind === 'pad' ? -tie : kind === 'tower' ? tie : 0);
}

/** 층이 함께 쓰는 장면과 브리지. 층은 도메인 상태를 읽기만 하고 판정·보상을 만들지 않는다(PRD §11.4, §13.2). */
export interface LayerContext {
  scene: Phaser.Scene;
  bridge: FieldBridge;
  projected: boolean;
}

import type Phaser from 'phaser';
import type { TowerId } from '../../contracts/balance';
import { CELL_PX } from '../assets';
import type { FieldBridge } from '../bridge';

export const toWorld = (milli: number) => (milli * CELL_PX) / 1000;
/** 돌지 않고 떠 있는 무기(서리 결정·번개 구슬·바람개비). */
export const FIXED_WEAPON = new Set<TowerId>(['frost', 'lightning', 'wind']);
export const DEPTH = { ground: 0, mood: 1, overlay: 5, units: 10, projectiles: 2000, fx: 2100, ui: 3000 };

/** 층이 함께 쓰는 장면과 브리지. 층은 도메인 상태를 읽기만 하고 판정·보상을 만들지 않는다(PRD §11.4, §13.2). */
export interface LayerContext {
  scene: Phaser.Scene;
  bridge: FieldBridge;
}

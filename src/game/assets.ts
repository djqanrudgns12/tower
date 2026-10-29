import type { AssetEntry, AssetManifest } from '../contracts/assetManifest';
import { TOWER_IDS, type EnemyKind, type TowerId } from '../contracts/balance';

// 에셋 ID와 표시 규격. Codex 이미지 작업(ART-SAMPLE)은 같은 ID·기준점으로 PNG를 납품하고,
// 납품 전에는 art.ts가 같은 ID로 임시 그림을 만든다. 렌더러 코드는 출처를 구분하지 않는다(PRD §11.2).
export const CELL_PX = 64;
export const WORLD_W = 15 * CELL_PX;
export const WORLD_H = 9 * CELL_PX;
/** 임시 그림의 텍스처 배율(고해상도 화면 대비). */
export const TEX = 2;

export interface AssetSpec {
  key: string;
  /** 텍스처 원본 px. */
  width: number;
  height: number;
  /** 지면 기준점(0..1). */
  originX: number;
  originY: number;
  /** 전장 표시 너비(셀). */
  displayCells: number;
}

const tower = (id: TowerId): AssetSpec => ({ key: `tower.${id}`, width: 128, height: 160, originX: 0.5, originY: 0.86, displayCells: 1.12 });
const weapon = (id: TowerId): AssetSpec => ({ key: `tower.${id}.weapon`, width: 96, height: 96, originX: 0.5, originY: 0.5, displayCells: 0.8 });

export const ENEMY_DISPLAY: Record<EnemyKind, number> = { walker: 0.72, runner: 0.66, brute: 0.8, shell: 0.76, wisp: 0.7, swarm: 0.6, boss: 1.15 };
/** 인수된 원화의 적 기준점(발 중심). 없는 종류는 임시 그림 기준점(0.5, 0.78)을 쓴다. */
const ENEMY_ORIGIN: Partial<Record<EnemyKind, { x: number; y: number }>> = {};

export const ASSETS = {
  ground: { key: 'map.ground', width: WORLD_W * TEX, height: WORLD_H * TEX, originX: 0, originY: 0, displayCells: 15 },
  towers: Object.fromEntries(TOWER_IDS.map(id => [id, tower(id)])) as Record<TowerId, AssetSpec>,
  /** 깃발초소는 공격하지 않아 무기가 없다. */
  weapons: Object.fromEntries(TOWER_IDS.filter(id => id !== 'banner').map(id => [id, weapon(id)])) as Partial<Record<TowerId, AssetSpec>>,
  enemy: (kind: EnemyKind, frame: 0 | 1): AssetSpec => ({ key: `enemy.${kind}.${frame}`, width: kind === 'boss' ? 192 : 128, height: kind === 'boss' ? 192 : 128, originX: ENEMY_ORIGIN[kind]?.x ?? 0.5, originY: ENEMY_ORIGIN[kind]?.y ?? 0.78, displayCells: ENEMY_DISPLAY[kind] }),
  projectile: { arrow: 'fx.arrow', ball: 'fx.ball', shard: 'fx.shard', spark: 'fx.spark', puff: 'fx.puff' },
  badge: { armored: 'badge.armored', swift: 'badge.swift' },
} as const;

/** 인수된 원화의 기준점·표시 크기로 임시 규격을 덮어쓴다. 반환값은 실을 파일 목록. */
export function applyManifest(manifest: AssetManifest): AssetEntry[] {
  const accepted = manifest.assets.filter(a => a.status === 'integrated_pass');
  for (const a of accepted) {
    const override = { key: a.id, width: a.width, height: a.height, originX: a.originX, originY: a.originY, displayCells: a.displayCells };
    const tower = /^tower\.([a-z]+)$/.exec(a.id)?.[1] as TowerId | undefined;
    const weapon = /^tower\.([a-z]+)\.weapon$/.exec(a.id)?.[1] as TowerId | undefined;
    if (tower) ASSETS.towers[tower] = override;
    if (weapon) ASSETS.weapons[weapon] = override;
    const enemy = /^enemy\.([a-z]+)\.[01]$/.exec(a.id)?.[1] as EnemyKind | undefined;
    if (enemy) { ENEMY_DISPLAY[enemy] = a.displayCells; ENEMY_ORIGIN[enemy] = { x: a.originX, y: a.originY }; }
  }
  return accepted;
}

import type { EnemyKind, TowerId } from '../contracts/balance';
import type { Phase } from './types';

// 화면·렌더러로 보내는 사건. 보상은 이미 상태에 반영된 뒤 알린다(애니메이션이 보상을 만들지 않는다, PRD §10.3).
export type DomainEvent =
  | { type: 'phase'; phase: Phase; wave: number }
  | { type: 'encounter'; encounterId: number }
  | { type: 'answered'; encounterId: number; result: 'correct' | 'wrong' | 'skipped'; pt: number; gold: number }
  | { type: 'burning'; untilTick: number }
  | { type: 'spawn'; enemyId: number; kind: EnemyKind }
  | { type: 'fire'; projectileId: number; towerId: number; towerType: TowerId }
  /** 즉발 공격(번개·화염·근접). 비행 지연 없이 같은 틱에 맞힌다(PRD §11.4, §20.3). targets는 맞힌 순서다. */
  | { type: 'strike'; towerId: number; towerType: TowerId; fromX: number; fromY: number; targets: Array<{ enemyId: number; x: number; y: number }> }
  /** 화상 피해 한 번(적마다 0.5초 시계). */
  | { type: 'burn'; enemyId: number; damage: number }
  | { type: 'hit'; enemyId: number; x: number; y: number; damage: number; towerType: TowerId }
  | { type: 'kill'; enemyId: number; kind: EnemyKind; elite: boolean; x: number; y: number; gold: number; pt: number }
  | { type: 'leak'; enemyId: number; kind: EnemyKind; damage: number; gateHp: number }
  | { type: 'waveComplete'; wave: number; milestoneGold: number }
  | { type: 'gameOver'; completedWave: number; endedAtWave: number; reason: 'DEFEAT' | 'QUIT' }
  | { type: 'towerBuilt' | 'towerUpgraded' | 'towerSold'; towerId: number; slotId: string; gold: number };

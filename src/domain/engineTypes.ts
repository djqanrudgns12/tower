import type { TowerId } from '../contracts/balance';
import type { R6TowerId } from '../contracts/balanceV2';
import type * as State from './types';
import type { DomainEvent as LegacyEvent } from './events';

export type EngineTowerId = TowerId | R6TowerId;
/** 기존 UI의 공개 타입은 v1로 두고 같은 상태·명령 구조에서 타워 키만 판별로 선택한다. */
export type WithTowerIds<T, Id extends EngineTowerId> =
  T extends object ? { [P in keyof T]:
    P extends 'tower' | 'towerType' ? T[P] extends TowerId ? Id : T[P] :
    P extends 'type' ? T extends State.Tower ? Id : T[P] :
    P extends 'availableTowers' | 'owned' | 'offers' ? T[P] extends TowerId[] ? Id[] : T[P] :
    WithTowerIds<T[P], Id>
  } : T;
export type RunState = WithTowerIds<State.RunState, EngineTowerId>;
export type Tower = WithTowerIds<State.Tower, EngineTowerId>;
export type Projectile = WithTowerIds<State.Projectile, EngineTowerId>;
export type FieldHazard = WithTowerIds<State.FieldHazard, EngineTowerId>;
export type DomainEvent = WithTowerIds<LegacyEvent, EngineTowerId>;
export type ZoneHazard = Extract<FieldHazard,{ kind:'zone' }>;
export type RollerHazard = Extract<FieldHazard,{ kind:'roller' }>;
export type TrapHazard = Extract<FieldHazard,{ kind:'trap' }>;
export type HazardStrike = FieldHazard['strike'];

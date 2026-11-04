import { TRAIT_TAG, type Balance, type EnemyKind, type FactionTrait, type FoeTag, type TraitKind } from '../contracts/balance';
import type { PathGeometry } from './geometry';
import { bpFloor, msToTicks, mulDivFloor } from './num';
import type { Enemy } from './types';
import { hpBaseMilli } from './waves';

// 종족 특성(prd-r4 §7.2 E, R4 B3): 침입 종족의 일반 적에게 붙는 특성 하나. 수치는 balance factions.<id>.trait가 정하고,
// 판정(combat)·편성(waves)·렌더러(EnemyLayer)·미리보기(화면)가 이 파일의 같은 함수를 쓴다. 난수를 쓰지 않는다.

/** 종족의 특성(그 웨이브에 붙는 것만). 특성이 없거나 아직 fromWave 전이면 null. */
export function factionTrait(b: Balance, faction: string, wave: number): FactionTrait | null {
  const t = b.factions[faction]?.trait;
  return t && wave >= t.fromWave ? t : null;
}

/** 적 하나에 붙는 특성: 대장은 붙지 않는다(대장 기믹 6종은 그대로). 비행 적은 땅굴을 파지 않는다. */
export function enemyTrait(b: Balance, faction: string, kind: EnemyKind, wave: number): FactionTrait | null {
  if (kind === 'boss') return null;
  const t = factionTrait(b, faction, wave);
  if (!t) return null;
  if (t.kind === 'burrow' && b.enemies[kind].flying) return null;
  return t;
}

/** 특성이 적에게 더하는 상성 표지(하늘 떼는 비율만 바꾸므로 없음). */
export const traitTag = (kind: TraitKind): FoeTag | null => (kind === 'flyers' ? null : TRAIT_TAG[kind]);

/** 흙 보호막 한 타격당 막는 피해(milli-HP): 그 웨이브 기준 체력(115% 점화식, 초반 완충·난이도 전) × reductionBP. */
export const clayReductionMilli = (b: Balance, trait: Extract<FactionTrait, { kind: 'clay' }>, wave: number): number =>
  bpFloor(hpBaseMilli(b, Math.max(1, wave)), trait.reductionBP, 'trait.clay');

/** 땅굴 구간 [시작, 끝) 진행도(milli-cell): atBP 지점부터 기본 속도(speedBP 10000)로 durationMs 걷는 거리. */
export function burrowSpan(b: Balance, path: PathGeometry, trait: Extract<FactionTrait, { kind: 'burrow' }>): [number, number] {
  const start = mulDivFloor(path.length, trait.atBP, 10000, 'trait.burrow');
  const length = mulDivFloor(path.length, msToTicks(trait.durationMs), b.waves.baseTravelTicks, 'trait.burrow');
  return [start, Math.min(path.length, start + length)];
}

/** 지금 땅속에 있는가(표적이 안 된다). 땅굴 특성이 붙은 적이 그 종족 구간 안에 있을 때만 true. */
export function burrowed(b: Balance, path: PathGeometry, e: Pick<Enemy, 'trait' | 'faction' | 'progress' | 'flying'>): boolean {
  if (e.trait !== 'burrow' || e.flying) return false;
  const t = b.factions[e.faction]?.trait;
  if (t?.kind !== 'burrow') return false;
  const [lo, hi] = burrowSpan(b, path, t);
  return e.progress >= lo && e.progress < hi;
}

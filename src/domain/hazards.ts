import type { GameContext } from './context';
import type { DomainEvent, HazardEndReason } from './events';
import type { PathGeometry } from './geometry';
import { isqrt, safe } from './num';
import { effectsFor } from './towers';
import type { FieldHazard, RunState } from './types';

// 장판·덫·굴림체(towers.md §4-7 fieldHazards)의 자리 계산과 웨이브 경계 정리. 타격 판정은 combat.ts updateHazards가 한다.

/** 경로에서 점 (cx, cy) 반경 r 안에 드는 진행도 구간들(축 정렬 선분마다 하나). 경계는 정수 제곱근(내림)으로 안쪽에 둔다. */
export function pathIntervalsInRange(path: PathGeometry, cx: number, cy: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const pts = path.points;
  const r2 = safe(r * r, 'hazard.range');
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const horizontal = a.y === b.y;
    const off = horizontal ? a.y - cy : a.x - cx;
    const rest = r2 - off * off;
    if (rest < 0) continue;
    const h = isqrt(rest);
    const a0 = horizontal ? a.x : a.y, b0 = horizontal ? b.x : b.y, c0 = horizontal ? cx : cy;
    const lo = Math.max(Math.min(a0, b0), c0 - h), hi = Math.min(Math.max(a0, b0), c0 + h);
    if (lo > hi) continue;
    // 좌표 → 진행도: 선분 시작 a에서 b 쪽으로 간 거리.
    const pLo = a.at + Math.abs(lo - a0), pHi = a.at + Math.abs(hi - a0);
    out.push([Math.min(pLo, pHi), Math.max(pLo, pHi)]);
  }
  return out;
}

/**
 * 덫 자리(towers.md §2 [19] "사거리 안 경로 위"): 사거리 안 경로 가운데 다른 덫과 spacing 이상 떨어진, 성문에 가장 가까운(진행도 최대) 점.
 * 후보는 구간 끝과 이미 놓인 덫의 spacing 앞자리뿐이다(빈자리 구간의 최댓값은 둘 중 하나). 없으면 null.
 */
export function trapSpot(path: PathGeometry, x: number, y: number, range: number, taken: readonly number[], spacing: number): number | null {
  const intervals = pathIntervalsInRange(path, x, y, range);
  const inside = (p: number) => intervals.some(([lo, hi]) => p >= lo && p <= hi);
  const free = (p: number) => taken.every(q => Math.abs(p - q) >= spacing);
  let best: number | null = null;
  for (const p of [...intervals.map(i => i[1]), ...taken.map(q => q - spacing)]) {
    if (p >= 0 && (best === null || p > best) && inside(p) && free(p)) best = p;
  }
  return best;
}

const expired = (h: FieldHazard, reason: HazardEndReason): DomainEvent => ({ type: 'hazardExpired', hazardId: h.id, kind: h.kind, towerId: h.towerId, reason });

/**
 * 웨이브가 끝나면 장판·굴림체·지연 폭발은 사라지고, 덫은 타워마다 그 형태의 carryOver개(성문 쪽 먼저, 같으면 먼저 놓은 것)만 다음 웨이브로 넘긴다.
 * 넘긴 덫은 놓은 순간의 수치 그대로다(투사체처럼 스냅샷).
 */
export function settleHazardsAtWaveEnd(ctx: GameContext, s: RunState, ev: DomainEvent[]) {
  if (s.hazards.length === 0) return;
  const keep = new Set<number>();
  for (const tower of s.towers) {
    const carry = effectsFor(ctx.balance, tower.type, tower.form).trap?.carryOver ?? 0;
    s.hazards
      .flatMap(h => (h.kind === 'trap' && h.towerId === tower.id ? [h] : []))
      .sort((a, b) => b.progress - a.progress || a.id - b.id)
      .slice(0, carry)
      .forEach(h => keep.add(h.id));
  }
  for (const h of s.hazards) if (!keep.has(h.id)) ev.push(expired(h, 'wave'));
  s.hazards = s.hazards.filter(h => keep.has(h.id));
}

/** 타워를 팔면 그 타워가 놓은 장판·덫·굴림체도 함께 사라진다(팔고도 덫을 남기는 것을 막는다). */
export function removeTowerHazards(s: RunState, towerId: number, ev: DomainEvent[]) {
  for (const h of s.hazards) if (h.towerId === towerId) ev.push(expired(h, 'sold'));
  s.hazards = s.hazards.filter(h => h.towerId !== towerId);
}

export const hazardExpiredEvent = expired;

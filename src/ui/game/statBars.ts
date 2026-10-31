import { TOWER_IDS, type Balance, type TowerId } from '../../contracts/balance';
import { attackIntervalTicks, attacks, bannerAura } from '../../domain/towers';
import { fmtCells, fmtDamage } from '../copy';
import { towerStats, type FormId } from './evolution';

// 능력치 막대(ui-rules-v2 §1): 숫자를 칸 5개 막대로 바꾼다. 기준은 전체 타워의 기준 레벨 최댓값이라
// 같은 판에서 타워끼리 비교되고, 강화하면 막대가 자란다.
export const SEGMENTS = 5;
/** 이 레벨의 가장 센 타워가 막대를 꽉 채운다. */
const REFERENCE_LEVEL = 3;

export type StatKey = 'power' | 'speed' | 'range';
export interface StatBar { key: StatKey; label: string; value: string; filled: number; next: number | null }

interface Refs { power: number; speed: number; range: number }
const refCache = new WeakMap<Balance, Refs>();

function refs(b: Balance): Refs {
  let r = refCache.get(b);
  if (r) return r;
  r = { power: 1, speed: 1, range: 1 };
  for (const id of TOWER_IDS) {
    if (!b.towers[id]) continue;
    r.range = Math.max(r.range, b.towers[id].rangeMilli);
    if (!attacks(b, id)) continue;
    const s = towerStats(b, id, Math.min(REFERENCE_LEVEL, b.levels.max ?? REFERENCE_LEVEL), 'base');
    r.power = Math.max(r.power, s.damage);
    r.speed = Math.max(r.speed, 30 / attackIntervalTicks(b, s, 0));
  }
  refCache.set(b, r);
  return r;
}

const seg = (value: number, ref: number) => Math.max(1, Math.min(SEGMENTS, Math.round((value / ref) * SEGMENTS)));
const seconds = (ticks: number) => `${Number((ticks / 30).toFixed(2))}초`;

/** 타워 종류·레벨·형태의 막대 3개. next가 있으면 다음 단계 막대 칸 수도 함께 준다. */
export function statBars(b: Balance, type: TowerId, level: number, form: FormId, next?: { level: number; form: FormId } | null): StatBar[] {
  const r = refs(b);
  if (!attacks(b, type)) {
    const aura = (lv: number, f: FormId) => bannerAura(b, { type, level: lv, form: f });
    const cur = aura(level, form);
    const nx = next ? aura(next.level, next.form) : null;
    const bp = (a: { damageBP: number; speedBP: number }) => Math.max(a.damageBP, a.speedBP);
    const auraLabel = cur.speedBP > 0 ? '주변 속도' : '주변 힘';
    return [
      { key: 'power', label: auraLabel, value: `+${bp(cur) / 100}%`, filled: seg(bp(cur), 3000), next: nx ? seg(bp(nx), 3000) : null },
      { key: 'range', label: '사거리', value: fmtCells(b.towers[type].rangeMilli), filled: seg(b.towers[type].rangeMilli, r.range), next: null },
    ];
  }
  const s = towerStats(b, type, level, form);
  const n = next ? towerStats(b, type, next.level, next.form) : null;
  const iv = attackIntervalTicks(b, s, 0);
  return [
    { key: 'power', label: '공격력', value: fmtDamage(s.damage), filled: seg(s.damage, r.power), next: n ? seg(n.damage, r.power) : null },
    { key: 'speed', label: '공격 속도', value: seconds(iv), filled: seg(30 / iv, r.speed), next: n ? seg(30 / attackIntervalTicks(b, n, 0), r.speed) : null },
    { key: 'range', label: '사거리', value: fmtCells(s.range), filled: seg(s.range, r.range), next: n ? seg(n.range, r.range) : null },
  ];
}

/** 진화 카드에 적을 바뀌는 수치 1~2개. */
export function formDeltas(b: Balance, type: TowerId, level: number, form: FormId, toLevel: number, toForm: FormId): string[] {
  if (!attacks(b, type)) return [];
  const a = towerStats(b, type, level, form), c = towerStats(b, type, toLevel, toForm);
  const out: Array<{ weight: number; text: string }> = [];
  const ia = attackIntervalTicks(b, a, 0), ic = attackIntervalTicks(b, c, 0);
  if (c.damage !== a.damage) out.push({ weight: Math.abs(c.damage / a.damage - 1), text: `공격력 ${fmtDamage(a.damage)} → ${fmtDamage(c.damage)}` });
  if (ic !== ia) out.push({ weight: Math.abs(ia / ic - 1) + 0.05, text: `공격 간격 ${seconds(ia)} → ${seconds(ic)}` });
  if (c.range !== a.range) out.push({ weight: Math.abs(c.range / a.range - 1) + 0.05, text: `사거리 ${fmtCells(a.range)} → ${fmtCells(c.range)}` });
  if (c.maxTargets !== a.maxTargets) out.push({ weight: 1, text: `대상 ${a.maxTargets} → ${c.maxTargets}마리` });
  if (c.slowBP !== a.slowBP) out.push({ weight: 1, text: `느리게 ${a.slowBP / 100}% → ${c.slowBP / 100}%` });
  return out.sort((x, y) => y.weight - x.weight).slice(0, 2).map(x => x.text);
}

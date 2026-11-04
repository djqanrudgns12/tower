import { TOWER_IDS, type Balance, type TowerId } from '../../contracts/balance';
import { attackIntervalTicks, attacks, bannerAura } from '../../domain/towers';
import { fmtCells, fmtDamage } from '../copy';
import { towerStats, type FormId } from './evolution';
import { deltaSpeech, SHOTS_LABEL, shotsValue } from './gameCopy';

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

/** 진화 카드의 바뀌는 수치 칩 하나(R5 B9). down이면 그 능력이 줄어든다(붉은 윤곽 칩, 화면 읽기 '줄어듦'). */
export interface FormDelta {
  /** 보이는 글: "공격력 27.0 → 24.6". */
  text: string;
  /** 화면 읽기: "공격력 줄어듦, 27.0에서 24.6". */
  speech: string;
  /** 능력이 줄어든다(공격 간격은 길어지면 줄어듦). */
  down: boolean;
}

/**
 * 진화 카드에 적을 바뀌는 수치 칩 1~2개(R5 B9, pre-r4 진화 카드): 지금 형태 → 고른 형태에서 가장 크게 바뀌는 능력 순.
 * 줄어드는 능력이 있으면 둘째 칸을 내주어서라도 꼭 보인다(대상·느리게 같은 고정 무게에 밀려 숨지 않게, 예: 호박 설탕늪 공격력).
 * 깃발초소는 공격하지 않으므로 주변 힘·주변 속도(bannerAura)를 비교한다.
 */
export function formDeltas(b: Balance, type: TowerId, level: number, form: FormId, toLevel: number, toForm: FormId): FormDelta[] {
  const out: Array<FormDelta & { weight: number }> = [];
  // ability: 화면 읽기의 능력 이름. 값이 클수록 좋은 능력은 up = to > from, 공격 간격만 반대다.
  const push = (weight: number, ability: string, label: string, from: string, to: string, down: boolean) =>
    out.push({ weight, text: `${label} ${from} → ${to}`, speech: deltaSpeech(ability, label, from, to, down), down });
  const ratio = (x: number, y: number) => (x === 0 || y === 0 ? 1 : Math.abs(y / x - 1));
  if (!attacks(b, type)) {
    const a = bannerAura(b, { type, level, form }), c = bannerAura(b, { type, level: toLevel, form: toForm });
    const pct = (bp: number) => (bp > 0 ? `+${bp / 100}%` : '0%');
    if (c.damageBP !== a.damageBP) push(ratio(a.damageBP, c.damageBP), '주변 힘', '주변 힘', pct(a.damageBP), pct(c.damageBP), c.damageBP < a.damageBP);
    if (c.speedBP !== a.speedBP) push(ratio(a.speedBP, c.speedBP), '주변 속도', '주변 속도', pct(a.speedBP), pct(c.speedBP), c.speedBP < a.speedBP);
  } else {
    const a = towerStats(b, type, level, form), c = towerStats(b, type, toLevel, toForm);
    const ia = attackIntervalTicks(b, a, 0), ic = attackIntervalTicks(b, c, 0);
    const shots = (s: typeof a) => s.volley * (s.fx.burst?.count ?? 1);
    if (c.damage !== a.damage) push(ratio(a.damage, c.damage), '공격력', '공격력', fmtDamage(a.damage), fmtDamage(c.damage), c.damage < a.damage);
    if (ic !== ia) push(Math.abs(ia / ic - 1) + 0.05, '공격 속도', '공격 간격', seconds(ia), seconds(ic), ic > ia);
    if (c.range !== a.range) push(ratio(a.range, c.range) + 0.05, '사거리', '사거리', fmtCells(a.range), fmtCells(c.range), c.range < a.range);
    if (shots(c) !== shots(a)) push(1, SHOTS_LABEL, SHOTS_LABEL, `${shots(a)}`, shotsValue(shots(c)), shots(c) < shots(a));
    if (c.maxTargets !== a.maxTargets) push(1, '대상 수', '대상', `${a.maxTargets}`, `${c.maxTargets}마리`, c.maxTargets < a.maxTargets);
    if (c.slowBP !== a.slowBP) push(1, '느리게 하는 힘', '느리게', `${a.slowBP / 100}%`, `${c.slowBP / 100}%`, c.slowBP < a.slowBP);
  }
  // 정렬은 안정적이라 무게가 같으면 위에 적은 순서(공격력 → 공격 간격 → 사거리 → 공격 횟수 → 대상 → 느리게)를 따른다.
  const sorted = out.sort((x, y) => y.weight - x.weight);
  const top = sorted.slice(0, 2);
  const loss = sorted.find(d => d.down);
  if (loss && !top.some(d => d.down)) top[top.length - 1] = loss;
  return top.map(({ text, speech, down }) => ({ text, speech, down }));
}

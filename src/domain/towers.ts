import { EFFECT_KEYS, TOWER_IDS, TRAIT_TAG, type Balance, type BranchId, type FoeTag, type FormConfig, type FormId, type TowerConfig, type TowerId } from '../contracts/balance';
import { dist2 } from './geometry';
import { bpFloor, ceilDiv, msToTicks, mulDivFloor, round5Bp } from './num';
import type { Enemy, Tower } from './types';

export type { FormId } from '../contracts/balance';

// 타워 수치 계산은 도메인과 화면이 같은 함수를 쓴다(PRD §10.1 단일 기준). 성장·진화는 docs/renewal/progression.md.
export interface TowerStats {
  damage: number;
  damageType: 'physical' | 'magic';
  baseIntervalTicks: number;
  intervalBP: number;
  range: number;
  splashRadius: number;
  maxTargets: number;
  slowBP: number;
  slowTicks: number;
  projectileSpeed: number;
  physicalResistIgnoreBP: number;
  /** 즉발 공격(번개·화염·근접): 비행 없이 발사 틱에 맞힌다(PRD §20.3). */
  instant: boolean;
  /** 번개 연쇄: 다음 대상마다 최초 기준 피해에 곱하는 감쇠비와, 직전 대상 중심 탐색 반경. */
  chainFalloffBP: number;
  chainRadius: number;
  /** 화염 부채꼴(총각 90도). */
  cone: boolean;
  /** 화상 총피해(저항 전 milli-HP, 레벨 배율 반영)와 지속 틱. 0이면 화상 없음. */
  burnTotal: number;
  burnTicks: number;
  /** 정예·보스에게만 곱하는 상황 배율. */
  eliteBossDamageBP: number;
  /** 첫 대상 기절 틱(즉발 공격). */
  stunTicks: number;
  /** 관통: 두 번째 대상 피해 비율(0이면 없음)과 선분 폭. */
  pierceDamageBP: number;
  pierceWidth: number;
  /** 긴 창: 선분 폭(0이면 없음). 길이는 사거리. */
  lineWidth: number;
  /** 대공(towers.md §4-1): 떠 있는 비행 적을 노리고 맞히는가, 비행 적을 먼저 노리는가, 비행 적 상황 배율. */
  canHitFlyer: boolean;
  preferFlyer: boolean;
  flyerDamageBP: number;
  /** 도넛 사거리 안쪽 반경(0이면 없음). */
  minRange: number;
  /** 한 번에 쏘는 서로 다른 표적 수(1 이상). */
  volley: number;
  /** 관통 대상 수(관통이 있을 때). */
  pierceCount: number;
  /** 타워·형태에서 모은 나머지 공격 효과 설정(ms·BP 원값, 해석은 combat.ts). */
  fx: Effects;
}

/** 공격 효과 설정: 타워 기본값 위에 형태(2차형은 1차형을 물려받은 뒤) 값을 덮는다. */
export type Effects = Partial<Pick<TowerConfig, (typeof EFFECT_KEYS)[number]>>;

function effectsOf(t: TowerConfig, f: FormConfig | null): Effects {
  const fx: Record<string, unknown> = {};
  for (const k of EFFECT_KEYS) {
    const v = f?.[k] ?? t[k];
    if (v !== undefined) fx[k] = v;
  }
  return fx as Effects;
}

/** 형태 단계: 기본형 0, 1차형(A·B) 1, 2차형(A1~B2) 2. */
export function formTier(form: FormId): 0 | 1 | 2 {
  return form === 'base' ? 0 : form.length === 1 ? 1 : 2;
}

/** 화면의 길 표식(동그라미·마름모)에 쓰는 1차 길. 기본형은 null. */
export const formBranch = (form: FormId): BranchId | null => (form === 'base' ? null : (form[0] as BranchId));

/** 2차형은 1차형 값을 물려받고 적은 필드만 덮어쓴다. 기본형은 null. */
export function formConfig(b: Balance, type: TowerId, form: FormId): FormConfig | null {
  if (form === 'base') return null;
  const forms = b.forms[type];
  if (form === 'A' || form === 'B') return forms[form];
  const own = forms[form];
  return { ...forms[own.parent], ...own };
}

export function formInfo(b: Balance, type: TowerId, form: FormId): { label: string; summary: string; tier: 0 | 1 | 2 } {
  const tier = formTier(form);
  if (form === 'base') return { label: b.towers[type].label, summary: '기본형', tier };
  const f = b.forms[type][form];
  return { label: f.label, summary: f.summary, tier };
}

/** Lv L의 피해 배율(BP). 표를 넘으면 마지막 값에 한 레벨마다 숙련 성장률을 곱해 내림한다(progression.md §3). */
export function levelDamageBP(b: Balance, level: number): number {
  const table = b.levels.damageMultiplierBP;
  let v = table[Math.min(level, table.length) - 1]!;
  for (let l = table.length; l < level; l++) v = bpFloor(v, b.levels.beyond.damageGrowthBP, 'damage.beyond');
  return v;
}

/**
 * Lv L → L+1 강화 비용 배율(BP). 표를 넘으면 숙련 성장률을 곱한다. 기본가와 곱한 값이 안전 정수를 넘게 되는 레벨부터 null이다.
 * 그 레벨까지 쌓인 비용은 한 판에서 모을 수 있는 골드보다 훨씬 커서, 상한이 없어도 수치가 넘치기 전에 골드가 먼저 모자란다.
 */
function levelCostBP(b: Balance, level: number, base: number): number | null {
  const table = b.levels.upgradeCostOfBaseBP;
  const growth = b.levels.beyond.costGrowthBP;
  let v = table[Math.min(level, table.length) - 1]!;
  for (let l = table.length; l < level; l++) {
    if (v > Math.floor(Number.MAX_SAFE_INTEGER / growth)) return null;
    v = mulDivFloor(v, growth, 10000, 'cost.beyond');
  }
  return v > Math.floor(Number.MAX_SAFE_INTEGER / base) ? null : v;
}

/**
 * 같은 밸런스 객체·타워·레벨·형태면 같은 수치다. 전투가 틱마다 여러 번 읽으므로 밸런스 객체별로 기억한다
 * (밸런스는 문맥을 만든 뒤 바꾸지 않는다. 후보를 잴 때는 새 객체를 만든다).
 */
const statsCache = new WeakMap<Balance, Map<string, TowerStats>>();
const fxCache = new WeakMap<Balance, Map<string, Effects>>();

export function towerStats(b: Balance, type: TowerId, level: number, form: FormId): TowerStats {
  let byKey = statsCache.get(b);
  if (!byKey) { byKey = new Map(); statsCache.set(b, byKey); }
  const key = `${type}/${level}/${form}`;
  let stats = byKey.get(key);
  if (!stats) { stats = computeStats(b, type, level, form); byKey.set(key, stats); }
  return stats;
}

function computeStats(b: Balance, type: TowerId, level: number, form: FormId): TowerStats {
  const t = b.towers[type];
  const f = formConfig(b, type, form);
  const levelBP = levelDamageBP(b, level);
  let damage = bpFloor(t.damage * 1000, levelBP, 'damage.level');
  // 기본 피해 배율(원정 보물 광역 피해 +, 계약 파일에는 없다).
  if (t.damageBP !== undefined && t.damageBP !== 10000) damage = bpFloor(damage, t.damageBP, 'damage.tower');
  if (f?.damageBP) damage = bpFloor(damage, f.damageBP, 'damage.form');
  // 범위 공격 형태의 ‘각각 기본 피해의 N%’도 형태 배율로 한 단계 곱한다(PRD §7.3).
  if (f?.splashDamageBP) damage = bpFloor(damage, f.splashDamageBP, 'damage.splash');
  if (t.damageType === 'none') throw new Error(`${type}은 직접 공격 타워가 아니다`);
  const fx = effectsOf(t, f);
  return {
    damage,
    damageType: t.damageType,
    baseIntervalTicks: msToTicks(t.intervalMs),
    intervalBP: f?.intervalBP ?? 10000,
    range: t.rangeMilli + (f?.rangeAddMilli ?? 0),
    splashRadius: fx.splashRadiusMilli ?? 0,
    maxTargets: fx.maxTargets ?? 1,
    slowBP: fx.slowBP ?? 0,
    slowTicks: msToTicks(fx.slowMs ?? 0),
    projectileSpeed: fx.projectileSpeedMilliPerSec ?? 10000,
    physicalResistIgnoreBP: fx.physicalResistIgnoreBP ?? 0,
    instant: fx.instant ?? false,
    chainFalloffBP: fx.chainFalloffBP ?? 10000,
    chainRadius: fx.chainRadiusMilli ?? 0,
    cone: coneOf(type, t.coneDegrees),
    // 화상 = Lv1 총피해 × 레벨 배율 × 화상 형태 배율(직접 피해 형태·깃발은 화상에 쓰지 않는다, PRD §20.2).
    burnTotal: fx.burnTotal ? bpFloor(bpFloor(fx.burnTotal * 1000, levelBP, 'burn.level'), f?.burnBP ?? 10000, 'burn.form') : 0,
    burnTicks: msToTicks(fx.burnMs ?? 0),
    eliteBossDamageBP: fx.eliteBossDamageBP ?? 10000,
    stunTicks: msToTicks(f?.firstTargetStunMs ?? 0),
    pierceDamageBP: f?.pierceDamageBP ?? 0,
    pierceWidth: f?.pierceWidthMilli ?? 0,
    lineWidth: f?.lineWidthMilli ?? t.lineWidthMilli ?? 0,
    canHitFlyer: fx.canHitFlyer ?? true,
    preferFlyer: fx.preferFlyer ?? false,
    flyerDamageBP: fx.flyerDamageBP ?? 10000,
    minRange: fx.minRangeMilli ?? 0,
    volley: fx.volley ?? 1,
    pierceCount: fx.pierceCount ?? 1,
    fx,
  };
}

/** 부채꼴 판정식(2·dot² ≥ 거리²·축길이²)은 총각 90도 전용이다(PRD §20.3). 다른 각도는 새 판정식이 필요하다. */
function coneOf(type: TowerId, degrees: number | undefined): boolean {
  if (degrees === undefined) return false;
  if (degrees !== 90) throw new Error(`${type}: 부채꼴은 90도만 지원한다(${degrees})`);
  return true;
}

/** 타워·형태의 상성(prd-r4 §7.2 D): 잘 잡는 적·약한 적 표지. 화면 아이콘과 피해 배율이 같은 목록을 쓴다. */
export function matchupOf(b: Balance, type: TowerId, form: FormId): { strongVs: readonly FoeTag[]; weakVs: readonly FoeTag[] } {
  const fx = effectsFor(b, type, form);
  return { strongVs: fx.strongVs ?? [], weakVs: fx.weakVs ?? [] };
}

/**
 * 적 하나의 상성 표지: 역할(분열 조각은 분열), 정예면 elite, 종족 특성이 있으면 그 표지(shell·clay·burrow, R4 B3).
 * 같은 표지는 한 번만 센다(단단한 적 역할에 등껍질 특성이 붙어도 shell 하나).
 */
export function foeTags(e: Pick<Enemy, 'kind' | 'elite'> & Partial<Pick<Enemy, 'trait'>>): FoeTag[] {
  const role: FoeTag = e.kind === 'splitling' ? 'splitter' : e.kind;
  const tags: FoeTag[] = e.elite ? [role, 'elite'] : [role];
  const trait = e.trait && e.trait !== 'flyers' ? TRAIT_TAG[e.trait] : null;
  if (trait && !tags.includes(trait)) tags.push(trait);
  return tags;
}

/**
 * 직접 타격의 상성 배율(BP): 적의 표지가 strongVs에 있으면 matchup.strongBP, weakVs에 있으면 matchup.weakBP를 표지마다 한 번씩 곱한다(내림).
 * matchup이 없거나 맞는 표지가 없으면 10000.
 */
export function matchupBP(b: Balance, type: TowerId, form: FormId, e: Pick<Enemy, 'kind' | 'elite'> & Partial<Pick<Enemy, 'trait'>>): number {
  const rule = b.matchup;
  if (!rule) return 10000;
  const { strongVs, weakVs } = matchupOf(b, type, form);
  if (strongVs.length === 0 && weakVs.length === 0) return 10000;
  let v = 10000;
  for (const tag of foeTags(e)) {
    if (strongVs.includes(tag)) v = mulDivFloor(v, rule.strongBP, 10000, 'matchup');
    if (weakVs.includes(tag)) v = mulDivFloor(v, rule.weakBP, 10000, 'matchup');
  }
  return v;
}

/** 기본형 strongVs에 이 표지를 적은 타워(TOWER_IDS 순서). 징집 대응 보장이 쓴다. */
export const countersOf = (b: Balance, tag: FoeTag): TowerId[] => TOWER_IDS.filter(t => matchupOf(b, t, 'base').strongVs.includes(tag));

/** 직접 공격하는 타워인가(깃발은 공격하지 않는다). */
export const attacks = (b: Balance, type: TowerId) => b.towers[type].damageType !== 'none';

/** 형태까지 모은 공격 효과 설정(깃발처럼 공격하지 않는 타워도 쓴다). */
export function effectsFor(b: Balance, type: TowerId, form: FormId): Effects {
  let byKey = fxCache.get(b);
  if (!byKey) { byKey = new Map(); fxCache.set(b, byKey); }
  const key = `${type}/${form}`;
  let fx = byKey.get(key);
  if (!fx) { fx = effectsOf(b.towers[type], formConfig(b, type, form)); byKey.set(key, fx); }
  return fx;
}

/** 오라를 주는 타워인가: 깃발(레벨별 오라 표)이거나 형태가 사거리·속도·정예 배율·처치 골드 오라를 준다(종각 B 계열 등). */
export function isAuraGiver(b: Balance, t: Pick<Tower, 'type' | 'form'>): boolean {
  if (b.towers[t.type].auraDamageBPByLevel) return true;
  const fx = effectsFor(b, t.type, t.form);
  return fx.auraRangeMilli !== undefined || fx.auraSpeedBP !== undefined || fx.auraEliteBossBP !== undefined || fx.auraKillGold !== undefined;
}

/** 오라 반경: 형태의 auraRadiusMilli, 없으면 기본 반경 + 형태 사거리 보정. 버닝 중이면 깃발 B1처럼 더 넓어질 수 있다. */
function auraRange(b: Balance, type: TowerId, form: FormId, burning = false): number {
  const fx = effectsFor(b, type, form);
  const base = fx.auraRadiusMilli ?? b.towers[type].rangeMilli + (formConfig(b, type, form)?.rangeAddMilli ?? 0);
  return base + (burning ? fx.auraBurning?.rangeAddMilli ?? 0 : 0);
}

/** 화면의 범위 원: 공격 타워는 사거리, 깃발은 오라 반경(PRD §12.4). */
export const reachMilli = (b: Balance, type: TowerId, level: number, form: FormId) =>
  attacks(b, type) ? towerStats(b, type, level, form).range : auraRange(b, type, form);

/** 오라가 대상 타워에 닿는가. 버프 범위는 타워 바닥 중심 간 거리로 판정한다(PRD §7.3). */
export function auraReaches(b: Balance, giver: Pick<Tower, 'type' | 'form' | 'x' | 'y'>, target: Pick<Tower, 'x' | 'y'>, burning = false): boolean {
  const r = auraRange(b, giver.type, giver.form, burning);
  return dist2(giver.x, giver.y, target.x, target.y) <= r * r;
}

/**
 * 깃발 오라의 직접 피해 보너스(PRD §7.1·§7.3·§20.2). 같은 종류의 깃발 효과는 최고값만,
 * 전체 외부 피해 보너스는 상한까지만 준다. 깃발 자신·다른 깃발은 받지 않는다.
 */
export function auraDamageBonusBP(b: Balance, towers: readonly Tower[], target: Tower): number {
  return Math.min(bestAura(b, towers, target, 'damage', false), b.externalCaps.damageBP);
}

/** 공격 속도 오라(깃발 B 계열·종각 B1). 버닝과 합친 전체 상한은 attackIntervalTicks가 적용한다(PRD §7.3, §20.2). */
export const auraSpeedBonusBP = (b: Balance, towers: readonly Tower[], target: Tower, burning = false) => bestAura(b, towers, target, 'speed', burning);

/** 사거리 오라(종각 B 계열): 공격 타워의 사거리에 더한다. */
export const auraRangeBonusMilli = (b: Balance, towers: readonly Tower[], target: Tower, burning = false) => bestAura(b, towers, target, 'range', burning);

/** 정예·대장 상황 배율 가산 오라(깃발 A1). */
export const auraEliteBossBonusBP = (b: Balance, towers: readonly Tower[], target: Tower, burning = false) => bestAura(b, towers, target, 'eliteBoss', burning);

/**
 * 깃발 한 기가 주는 효과: 기본형은 레벨별 피해 보너스(타워 수치), 진화형은 그 형태 첫 레벨부터의 형태 값이다(표 밖은 마지막 값).
 * A 계열(용기)은 피해 보너스를 대체하고, B 계열(신속)은 피해 보너스를 없애고 속도 보너스를 준다(PRD §7.3).
 */
export function bannerAura(b: Balance, banner: Pick<Tower, 'type' | 'level' | 'form'>): { damageBP: number; speedBP: number } {
  const byLevel = b.towers[banner.type].auraDamageBPByLevel;
  if (!byLevel) return { damageBP: 0, speedBP: 0 };
  const f = formConfig(b, banner.type, banner.form);
  if (!f) return { damageBP: byLevel[Math.min(banner.level, byLevel.length) - 1]!, speedBP: 0 };
  // 2차형이 표를 물려받았으면 부모(1차형) 첫 레벨부터 이어 센다. 진화하면서 효과가 줄지 않게 한다.
  const own: FormConfig = banner.form === 'base' || banner.form === 'A' || banner.form === 'B' ? f : b.forms[banner.type][banner.form];
  const at = (key: 'auraDamageBPByLevel' | 'auraSpeedBPByLevel') => {
    const list = f[key];
    const from = b.levels.evolveAt[key in own ? formTier(banner.form) - 1 : 0]!;
    return list?.[Math.max(0, Math.min(banner.level - from, list.length - 1))] ?? 0;
  };
  return { damageBP: at('auraDamageBPByLevel'), speedBP: at('auraSpeedBPByLevel') };
}

/** 오라 한 기가 주는 값(종류별). */
function auraValue(b: Balance, giver: Tower, kind: 'damage' | 'speed' | 'range' | 'eliteBoss', burning: boolean): number {
  const fx = effectsFor(b, giver.type, giver.form);
  if (kind === 'range') return fx.auraRangeMilli ?? 0;
  if (kind === 'eliteBoss') return fx.auraEliteBossBP ?? 0;
  const banner = bannerAura(b, giver);
  if (kind === 'damage') return banner.damageBP;
  const speed = Math.max(banner.speedBP, burning && fx.auraBurning ? fx.auraBurning.speedBP : 0);
  return speed + (fx.auraSpeedBP ?? 0);
}

/** 같은 종류의 오라 효과는 범위 안 최고값 하나만(PRD §7.3). 자신은 받지 않고, 공격하지 않는 타워는 받지 않는다. */
function bestAura(b: Balance, towers: readonly Tower[], target: Tower, kind: 'damage' | 'speed' | 'range' | 'eliteBoss', burning: boolean): number {
  if (!attacks(b, target.type)) return 0;
  let best = 0;
  for (const t of towers) {
    if (t.id === target.id || !isAuraGiver(b, t) || !auraReaches(b, t, target, burning)) continue;
    best = Math.max(best, auraValue(b, t, kind, burning));
  }
  return best;
}

/** ceil(기본틱 × 형태비 / (1 + 외부 속도)), 최소 간격 이상(PRD §20.2). */
export function attackIntervalTicks(b: Balance, stats: TowerStats, speedBonusBP: number): number {
  const speed = Math.min(b.externalCaps.attackSpeedBP, speedBonusBP);
  const ticks = ceilDiv(stats.baseIntervalTicks * stats.intervalBP, 10000 + speed);
  return Math.max(msToTicks(b.externalCaps.minAttackIntervalMs), ticks);
}

export const buildCost = (b: Balance, type: TowerId) => b.towers[type].cost;

/** level → level+1 비용. 설정 상한(levels.max)이거나 비용이 안전 정수를 넘는 레벨이면 null. */
export function upgradeCost(b: Balance, type: TowerId, level: number): number | null {
  if (b.levels.max !== null && level >= b.levels.max) return null;
  const base = b.towers[type].cost;
  const costBP = levelCostBP(b, level, base);
  return costBP === null ? null : round5Bp(base, costBP);
}

/**
 * 다음 강화가 진화면 고를 수 있는 형태 두 개, 아니면 null. 최고 레벨이면 null.
 * Lv3→4는 A·B, Lv6→7은 지금 길의 두 갈래(A→A1·A2, B→B1·B2)다(progression.md §1·§5).
 */
export function evolutionChoices(b: Balance, tower: Pick<Tower, 'type' | 'level' | 'form'>): FormId[] | null {
  if (upgradeCost(b, tower.type, tower.level) === null) return null;
  const next = tower.level + 1;
  if (next === b.levels.evolveAt[0] && tower.form === 'base') return ['A', 'B'];
  if (next === b.levels.evolveAt[1] && tower.form === 'A') return ['A1', 'A2'];
  if (next === b.levels.evolveAt[1] && tower.form === 'B') return ['B1', 'B2'];
  return null;
}

export const sellRefund = (b: Balance, tower: Pick<Tower, 'invested'>) => mulDivFloor(tower.invested, b.run.sellRatioBP, 10000, 'sell');

import { TOWER_IDS, TRAIT_TAG, type Balance, type FoeTag, type FormId, type TowerId, type TraitKind } from '../../contracts/balance';
import { matchupOf } from '../../domain/towers';
import type { ArtIconName } from '../kit';
import { ENEMY_NAME } from './wavePreview';

// 잘 잡는 적·약한 적(prd-r4 §7.2 D·§9.1): 계약의 strongVs·weakVs에서만 만든다. 숫자(엔진 ×1.3·×0.7)와 화면 아이콘이 어긋나지 않는다.

/** 상성 표지 → 화면 이름(화면 읽기·호버 안내). */
export const FOE_LABEL: Record<FoeTag, string> = {
  walker: ENEMY_NAME.walker, runner: ENEMY_NAME.runner, brute: ENEMY_NAME.brute, shell: ENEMY_NAME.shell, wisp: ENEMY_NAME.wisp,
  swarm: ENEMY_NAME.swarm, flyer: ENEMY_NAME.flyer, splitter: ENEMY_NAME.splitter, boss: '대장', elite: '정예', clay: '흙 보호막', burrow: '땅굴',
};

/** 상성 표지 → 원화 특성 아이콘. 없는 표지(걷는 적·힘센 적·대장·정예)는 적 초상화나 글자로 보인다. */
export const FOE_TRAIT_ICON: Partial<Record<FoeTag, ArtIconName>> = {
  runner: 'trait.fast', shell: 'trait.armor', wisp: 'trait.ward', swarm: 'trait.swarm', flyer: 'trait.flying', splitter: 'trait.split',
  clay: 'trait.clay', burrow: 'trait.burrow',
};

/** 아이콘이 없는 표지의 초상화 텍스처(전장 icons 키). 정예는 초상화가 없어 글자로 보인다. */
export const FOE_PORTRAIT: Partial<Record<FoeTag, string>> = { walker: 'enemy.walker.0', brute: 'enemy.brute.0', boss: 'enemy.boss.0' };

/** 화면에 보일 상성: 잘 잡는 적 최대 2개, 약한 적 최대 1개(계약 순서). */
export function counterTags(b: Balance, type: TowerId, form: FormId): { strong: FoeTag[]; weak: FoeTag[] } {
  const m = matchupOf(b, type, form);
  return { strong: m.strongVs.slice(0, 2), weak: m.weakVs.slice(0, 1) };
}

/** 한 줄 설명(화면 읽기·호버 안내): "잘 잡는 적 빠른 적, 땅굴 · 약한 적 나는 적". 둘 다 없으면 빈 글. */
export function counterText(b: Balance, type: TowerId, form: FormId): string {
  const { strong, weak } = counterTags(b, type, form);
  const parts: string[] = [];
  if (strong.length) parts.push(`잘 잡는 적 ${strong.map(t => FOE_LABEL[t]).join(', ')}`);
  if (weak.length) parts.push(`약한 적 ${weak.map(t => FOE_LABEL[t]).join(', ')}`);
  return parts.join(' · ');
}

/** 가진 타워 가운데 이 표지를 잘 잡는 것이 있는가: 장착함 타워의 기본형과 지어 둔 타워의 지금 형태 strongVs. */
export function hasCounter(b: Balance, tag: FoeTag, owned: readonly TowerId[], built: ReadonlyArray<{ type: TowerId; form: FormId }>): boolean {
  return owned.some(t => matchupOf(b, t, 'base').strongVs.includes(tag)) || built.some(t => matchupOf(b, t.type, t.form).strongVs.includes(tag));
}

/** 특성의 상성 표지(하늘 떼는 비행). */
export const traitCounterTag = (trait: TraitKind): FoeTag => TRAIT_TAG[trait];

/** 표지를 잘 잡는 타워가 계약에 하나라도 있는가(없으면 경고하지 않는다). */
export const anyCounter = (b: Balance, tag: FoeTag): boolean => TOWER_IDS.some(t => matchupOf(b, t, 'base').strongVs.includes(tag));

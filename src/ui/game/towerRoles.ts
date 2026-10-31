import type { TowerId } from '../../contracts/balance';

/** 타워 역할 묶음(시안 1 v3). 장착 홈·능력치 요약이 같은 분류를 쓴다. */
export type TowerRoleGroup = 'fast' | 'area' | 'slow' | 'support';

export const TOWER_ROLE_GROUP: Record<TowerId, TowerRoleGroup> = {
  archer: 'fast',
  crossbow: 'fast',
  mage: 'fast',
  spear: 'fast',
  cannon: 'area',
  lightning: 'area',
  flame: 'area',
  frost: 'slow',
  guardian: 'support',
  banner: 'support',
  // 리뉴얼 신규 10종(towers.md §1 분류·역할). R2가 엔진과 함께 더했다.
  sling: 'fast',
  ballista: 'fast',
  falcon: 'fast',
  mortar: 'area',
  hwacha: 'area',
  roller: 'area',
  alchemist: 'area',
  wind: 'slow',
  trap: 'slow',
  bell: 'support',
};

/** 역할 이름(라벨). 문장이 아니라 두세 글자 낱말로 둔다(ui-rules-v2 §1). */
export const ROLE_LABEL: Record<TowerRoleGroup, string> = {
  fast: '빠른 공격',
  area: '범위',
  slow: '느리게',
  support: '지원',
};

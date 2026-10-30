import type { Balance, TowerId } from '../../contracts/balance';
import type { TowerView } from '../../application/view';
import { needsBranch, towerStats as branchStats, upgradeCost as branchUpgradeCost, type TowerStats } from '../../domain/towers';
import type { Command } from '../../domain/run';

/**
 * R1↔R2 진화 API 어댑터(docs/renewal/progression.md §5).
 * 화면은 이 파일의 이름만 쓴다. R2 엔진이 병합되면 아래 본문을 `domain/towers`의 같은 이름 함수로 바꾸고
 * 지금의 A/B 분기(레벨 2→3) 규칙을 감싼 부분만 지운다. 화면 코드는 고치지 않는다.
 */
export type FormId = 'base' | 'A' | 'B' | 'A1' | 'A2' | 'B1' | 'B2';

export function formTier(form: FormId): 0 | 1 | 2 {
  return form === 'base' ? 0 : form.length === 1 ? 1 : 2;
}

/** 지금 타워의 형태. R2 전에는 분기(A/B)가 곧 1차형이다. */
export function towerForm(tower: Pick<TowerView, 'branch'> & { form?: FormId }): FormId {
  return tower.form ?? tower.branch ?? 'base';
}

/** 다음 강화가 진화면 고를 수 있는 형태 목록(2개), 아니면 null. 최대 레벨이면 null. */
export function evolutionChoices(b: Balance, tower: Pick<TowerView, 'type' | 'level' | 'branch'>): FormId[] | null {
  if (branchUpgradeCost(b, tower.type, tower.level) === null) return null;
  if (!needsBranch(b, tower.level) || !b.branches[tower.type]) return null;
  return ['A', 'B'];
}

export function formInfo(b: Balance, type: TowerId, form: FormId): { label: string; summary: string; tier: 0 | 1 | 2 } {
  const tier = formTier(form);
  if (form === 'A' || form === 'B') {
    const br = b.branches[type]?.[form];
    if (br) return { label: br.label, summary: br.summary, tier };
  }
  return { label: b.towers[type].label, summary: '', tier };
}

export function upgradeCost(b: Balance, type: TowerId, level: number): number | null {
  return branchUpgradeCost(b, type, level);
}

export function towerStats(b: Balance, type: TowerId, level: number, form: FormId): TowerStats {
  return branchStats(b, type, level, form === 'A' || form === 'B' ? form : null);
}

/** 강화·진화 명령. 진화 레벨이면 form이 있어야 한다(R2: FORM_REQUIRED). */
export function upgradeCommand(towerId: number, form?: FormId): Command {
  return form === 'A' || form === 'B' ? { type: 'upgrade', towerId, branch: form } : { type: 'upgrade', towerId };
}

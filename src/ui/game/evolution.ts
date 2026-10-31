import type { Balance, FormId } from '../../contracts/balance';
import type { TowerView } from '../../application/view';
import type { Command } from '../../domain/run';
import { evolutionChoices } from '../../domain/towers';

/**
 * R1↔R2 진화 API 어댑터(docs/renewal/progression.md §5).
 * 화면은 이 파일의 이름만 쓴다. 엔진 이름이 바뀌면 이 파일만 고친다.
 */
export type { FormId } from '../../contracts/balance';
export type { TowerStats } from '../../domain/towers';
export { evolutionChoices, formInfo, formTier, towerStats, upgradeCost } from '../../domain/towers';

/** 지금 타워의 형태. */
export function towerForm(tower: Pick<TowerView, 'form'>): FormId {
  return tower.form;
}

/** 강화·진화 명령. 진화 레벨이면 form이 있어야 한다(엔진: FORM_REQUIRED·INVALID_FORM). */
export function upgradeCommand(towerId: number, form?: FormId): Command {
  return form ? { type: 'upgrade', towerId, form } : { type: 'upgrade', towerId };
}

/** 설치 직후 되돌리기(전액 환불). 시간이 지났거나 강화했으면 엔진이 UNDO_EXPIRED로 거절한다. */
export function undoBuildCommand(towerId: number): Command {
  return { type: 'undoBuild', towerId };
}

/**
 * 장면(InputLayer)의 진화 미리보기 표식. previewBranch는 두 선택지 가운데 첫째(A)·둘째(B)를 뜻한다.
 * 화면은 형태(FormId)로 다루고, 장면에 넘길 때만 이 표식으로 바꾼다.
 */
export function previewMarker(b: Balance, tower: Pick<TowerView, 'type' | 'level' | 'form'>, form: FormId | null): 'A' | 'B' | null {
  if (!form) return null;
  const choices = evolutionChoices(b, tower);
  const i = choices ? choices.indexOf(form) : -1;
  return i === 0 ? 'A' : i === 1 ? 'B' : null;
}

/** 표식 → 형태(previewMarker의 반대). */
export function previewForm(b: Balance, tower: Pick<TowerView, 'type' | 'level' | 'form'>, marker: 'A' | 'B' | null): FormId | null {
  if (!marker) return null;
  const choices = evolutionChoices(b, tower);
  return choices ? choices[marker === 'A' ? 0 : 1] ?? null : null;
}

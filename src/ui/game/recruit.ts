import type { Balance, TowerId } from '../../contracts/balance';
import type { GameView } from '../../application/view';
import type { Command } from '../../domain/run';
import { attacks, towerStats } from '../../domain/towers';
import { TOWER_COPY } from '../copy';

/**
 * R1↔R2 징집 어댑터(docs/renewal/catalog/towers.md §0-2, 엔진 src/domain/draft.ts).
 * 시작은 기본 4종, W3·W6·W10·W14를 지키면 갖지 않은 타워 3종 가운데 1종을 고른다. 장착함은 최대 8칸이다.
 * 고르지 않으면 엔진이 다음 징집 웨이브에 첫 후보로 정한다. 화면은 이 파일의 이름만 쓴다.
 */

/** 지금 고를 징집 후보(3종). 고르기를 기다리지 않으면 null. */
export const recruitOffer = (view: Pick<GameView, 'draft'>): readonly TowerId[] | null => view.draft?.offers ?? null;

/**
 * 징집 카드를 띄울 때: 후보가 있고, 웨이브 사이(정리·준비 문제·배치)이며 멈추지 않았을 때.
 * 전투 중에는 전장을 가리지 않게 숨긴다. 카드는 문제판을 가리지 않고 포커스도 빼앗지 않는다.
 */
export function showRecruit(view: Pick<GameView, 'draft' | 'phase' | 'pause'>): boolean {
  return view.draft !== null && view.pause.length === 0 && (view.phase === 'WAVE_WRAPUP' || view.phase === 'PREP_QUIZ' || view.phase === 'BUILD');
}

/**
 * 원정 보물 창을 띄울 때(prd-r4 §7.2-F): 후보가 있고 웨이브 사이이며 멈추지 않았고, 새 타워 창이 떠 있지 않을 때(새 타워가 먼저).
 */
export function showRelic(view: Pick<GameView, 'draft' | 'relicOffer' | 'phase' | 'pause'>): boolean {
  return view.relicOffer !== null && !showRecruit(view) && view.pause.length === 0 && (view.phase === 'WAVE_WRAPUP' || view.phase === 'PREP_QUIZ' || view.phase === 'BUILD');
}

/** 보물을 고르는 명령(엔진: NO_RELIC_OFFER·INVALID_RELIC으로 거절). */
export const relicCommand = (relic: string): Command => ({ type: 'relicPick', relic });

/** 고른 타워를 장착함에 넣는 명령(엔진: NO_DRAFT·INVALID_DRAFT로 거절). */
export const recruitCommand = (type: TowerId): Command => ({ type: 'draftPick', tower: type });

/** 징집 카드 한 장의 글: 역할 한 줄과 비행 적 공격 가능 여부(공격하지 않는 타워는 null). */
export function recruitCardInfo(b: Balance, type: TowerId): { role: string; air: boolean | null } {
  return { role: TOWER_COPY[type].role, air: attacks(b, type) ? towerStats(b, type, 1, 'base').canHitFlyer : null };
}

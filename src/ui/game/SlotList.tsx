import type { TowerId } from '../../contracts/balance';
import type { MapConfig } from '../../contracts/maps';
import type { GameView } from '../../application/view';
import type { GameContext } from '../../domain/context';
import { buildCost } from '../../domain/towers';
import { ChevronDownIcon } from '../icons/GameIcons';
import kit from '../kit.module.css';
import css from './GameScreen.module.css';

// 키보드·스크린리더용 설치 자리 목록(PRD §12.4). 보조 접근 경로이며 추천 자리를 알려 주지 않는다.
type Slot = MapConfig['slots'][number];
export type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const DIR: Record<Arrow, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/** 화살표 방향으로 가장 가까운 자리. 옆으로 벗어난 거리는 두 배로 친다. 그 방향에 자리가 없으면 그대로 둔다. */
export function nextSlot(slots: readonly Slot[], fromId: string | null, key: Arrow): string | null {
  const from = slots.find(s => s.id === fromId);
  if (!from) return slots[0]?.id ?? null;
  const [dx, dy] = DIR[key];
  let best: Slot | null = null;
  let bestScore = Infinity;
  for (const s of slots) {
    const ahead = (s.x - from.x) * dx + (s.y - from.y) * dy;
    if (ahead <= 0) continue;
    const side = Math.abs((s.x - from.x) * dy) + Math.abs((s.y - from.y) * dx);
    const score = ahead + 2 * side;
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best?.id ?? from.id;
}

export function slotDescription(ctx: GameContext, view: GameView, slotId: string): string {
  const index = ctx.map.slots.findIndex(s => s.id === slotId);
  const slot = ctx.map.slots[index];
  if (!slot) return '';
  const tower = view.towers.find(t => t.slotId === slotId);
  const state = tower ? `${ctx.balance.towers[tower.type].label} 레벨 ${tower.level}` : '비어 있음';
  return `자리 ${index + 1} · 가로 ${slot.x + 1}, 세로 ${slot.y + 1} · ${state}`;
}

interface Props {
  ctx: GameContext;
  view: GameView;
  towers: readonly TowerId[];
  selectedSlotId: string | null;
  onPick(slotId: string): void;
}

export function SlotList({ ctx, view, towers, selectedSlotId, onPick }: Props) {
  const empty = ctx.map.slots.filter(s => !view.towers.some(t => t.slotId === s.id)).length;
  const built = view.towers.length;
  const prices = towers.map(t => `${ctx.balance.towers[t].label} ${buildCost(ctx.balance, t)}골드`).join(' · ');
  return (
    <details className={css.slotList}>
      <summary className={css.slotSummary}>
        <span>{built > 0 ? `설치 자리 목록 · 설치 ${built} · 빈 자리 ${empty}곳` : `설치 자리 목록 · 빈 자리 ${empty}곳`}</span>
        <ChevronDownIcon size={12} />
      </summary>
      <p className={kit.muted}>빈 자리에 놓을 수 있는 타워: {prices}. 전장에서는 화살표로 자리를 옮기고 엔터로 골라요.</p>
      <ol className={css.slotItems}>
        {ctx.map.slots.map(slot => (
          <li key={slot.id}>
            <button
              type="button"
              className={css.slotButton}
              aria-current={slot.id === selectedSlotId ? 'true' : undefined}
              // 고르면 목록을 접고 관리 패널로 넘어간다(화면이 포커스를 옮긴다).
              onClick={e => {
                e.currentTarget.closest('details')?.removeAttribute('open');
                onPick(slot.id);
              }}
            >
              {slotDescription(ctx, view, slot.id)}
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}

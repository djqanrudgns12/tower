import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Balance, TowerId } from '../../contracts/balance';
import type { MapConfig } from '../../contracts/maps';
import type { TowerView } from '../../application/view';
import { buildCost, sellRefund } from '../../domain/towers';
import type { FieldView } from '../../game/bridge';
import { fmtNumber } from '../copy';
import { EvolveIcon, SellIcon, TowerShieldPortrait, UndoArrowIcon, UpgradeArrowIcon } from '../icons/GameIcons';
import { ArtIcon, Button } from '../kit';
import { evolutionChoices, upgradeCost } from './evolution';
import { cellRect, type CellRect } from './fieldGeometry';
import css from './FieldOverlay.module.css';
import pillarCss from './EvolvePillar.module.css';

export interface FieldFlash { id: number; text: string; slotId: string | null }

interface Props {
  balance: Balance;
  map: MapConfig;
  towers: readonly TowerId[];
  built: readonly TowerView[];
  gold: number;
  icons: Record<string, string>;
  boxW: number;
  boxH: number;
  camera: FieldView;
  /** 빈 자리를 먼저 눌렀다(작은 고르기 메뉴). */
  slotId: string | null;
  /** 설치된 타워를 눌렀다(도구 묶음). */
  tower: TowerView | null;
  flash: FieldFlash | null;
  /** 막 진화한 타워 칸의 빛기둥. */
  pillar?: { id: number; slotId: string } | null;
  onPillarDone?(id: number): void;
  /** 전장 왼쪽 위 '전체 지도' 단추와 겹치지 않도록 자리를 피한다. */
  avoidTopLeft?: boolean;
  /** 전장 아래쪽 가운데 안내 쪽지와 겹치지 않도록 자리를 피한다. */
  avoidBottom?: boolean;
  onBuild(slotId: string, type: TowerId): void;
  onPreview(type: TowerId | null): void;
  onUpgrade(): void;
  onEvolve(): void;
  onSell(): void;
  /** 설치 직후 되돌릴 수 있는 타워(가장 최근 것 하나). 그 칸 위에 되돌리기 칩을 띄운다. */
  undo?: TowerView | null;
  onUndo?(towerId: number): void;
  onClose(): void;
}

/** 키캡 안의 값(골드). 살 수 없으면 kit 비활성 모양(aria-disabled)이 알린다. */
const Cost = ({ value, plus = false }: { value: number; plus?: boolean }) => (
  <span className={css.cost}>{plus ? `+${fmtNumber(value)}` : <><ArtIcon name="coin" size={14} />{fmtNumber(value)}</>}</span>
);

/**
 * 전장 위 DOM 겹층(R4 PRD §9.2): 빈 자리 옆 작은 고르기 메뉴, 설치된 타워 옆 도구 묶음(진화·강화·판매 키캡), 짧은 이유 표.
 * 칸 위치는 카메라가 알려 준 보이는 영역으로 맞춘다. 겹층 자체는 누르기를 받지 않고 메뉴만 받는다.
 */
export function FieldOverlay(p: Props) {
  const slotOf = (id: string | null) => (id ? p.map.slots.find(s => s.id === id) ?? null : null);
  const rectOf = (id: string | null) => {
    const s = slotOf(id);
    return s ? cellRect(p.camera, p.boxW, p.boxH, s.x, s.y) : null;
  };
  const menuSlot = p.tower ? null : rectOf(p.slotId);
  const toolSlot = p.tower ? rectOf(p.tower.slotId) : null;
  const flashRect = p.flash ? rectOf(p.flash.slotId) : null;
  const pillarRect = p.pillar ? rectOf(p.pillar.slotId) : null;
  // 작은 고르기 메뉴나 도구 묶음이 열린 동안에는 되돌리기 칩을 따로 띄우지 않아 전장 위 말풍선 겹침을 막는다.
  const undoTower = p.undo && p.undo.undoable && !p.slotId && !p.tower ? p.undo : null;
  const undoRect = undoTower ? rectOf(undoTower.slotId) : null;
  const activePopover = menuSlot !== null || toolSlot !== null;

  return (
    <div className={css.layer}>
      {p.pillar && pillarRect && (
        <span
          key={`pillar-${p.pillar.id}`}
          className={pillarCss.pillar}
          aria-hidden="true"
          style={{ left: pillarRect.left + pillarRect.size * 0.18, top: pillarRect.top - pillarRect.size * 1.6, width: pillarRect.size * 0.64, height: pillarRect.size * 2.5 }}
          onAnimationEnd={() => p.onPillarDone?.(p.pillar!.id)}
        />
      )}
      {menuSlot && p.slotId && (
        <Anchored
          key={`menu-${p.slotId}`}
          cell={menuSlot}
          boxW={p.boxW}
          boxH={p.boxH}
          avoidTopLeft={p.avoidTopLeft}
          avoidBottom={p.avoidBottom}
          onEscape={p.onClose}
        >
          <div className={css.menu} role="group" aria-label="이 자리에 놓을 타워">
            {p.towers.map(type => {
              const price = buildCost(p.balance, type);
              const short = p.gold < price;
              return (
                <button
                  key={type}
                  type="button"
                  className={css.pick}
                  data-short={short || undefined}
                  aria-label={`${p.balance.towers[type].label} ${price} 골드${short ? `, ${price - p.gold} 부족` : ''}`}
                  title={p.balance.towers[type].label}
                  onPointerEnter={() => p.onPreview(type)}
                  onPointerLeave={() => p.onPreview(null)}
                  onFocus={() => p.onPreview(type)}
                  onBlur={() => p.onPreview(null)}
                  onClick={() => p.onBuild(p.slotId!, type)}
                >
                  <span className={css.pickArt}><TowerShieldPortrait type={type} icons={p.icons} size="fill" bare /></span>
                  <Cost value={price} />
                </button>
              );
            })}
          </div>
        </Anchored>
      )}
      {toolSlot && p.tower && (
        <Anchored
          key={`tools-${p.tower.id}`}
          cell={toolSlot}
          boxW={p.boxW}
          boxH={p.boxH}
          avoidTopLeft={p.avoidTopLeft}
          avoidBottom={p.avoidBottom}
          onEscape={p.onClose}
        >
          <TowerTools {...p} tower={p.tower} />
        </Anchored>
      )}
      {undoTower && undoRect && (
        <Anchored
          key={`undo-${undoTower.id}`}
          cell={undoRect}
          boxW={p.boxW}
          boxH={p.boxH}
          place="above"
          avoidTopLeft={p.avoidTopLeft}
          avoidBottom={p.avoidBottom}
        >
          <Button variant="secondary" className={css.tool} aria-label={`설치 되돌리기 +${undoTower.invested} 골드`} onClick={() => p.onUndo?.(undoTower.id)}>
            <UndoArrowIcon size={18} />
            <span>되돌리기</span>{' '}
            <Cost value={undoTower.invested} plus />
          </Button>
        </Anchored>
      )}
      {p.flash && (
        flashRect && !activePopover ? (
          <Anchored
            key={`flash-${p.flash.id}`}
            cell={flashRect}
            boxW={p.boxW}
            boxH={p.boxH}
            place="below"
            avoidTopLeft={p.avoidTopLeft}
            avoidBottom={p.avoidBottom}
          >
            <p className={css.flash} role="status">{p.flash.text}</p>
          </Anchored>
        ) : (
          <p key={`flash-${p.flash.id}`} className={`${css.flash} ${css.flashTop}`} role="status">{p.flash.text}</p>
        )
      )}
    </div>
  );
}

/** 설치된 타워 옆 도구 묶음: 진화(호박색)·강화(초록)·판매(빨강) 키캡. 설치 직후에는 판매 자리가 되돌리기다. */
function TowerTools(p: Props & { tower: TowerView }) {
  const t = p.tower;
  const [confirmSell, setConfirmSell] = useState(false);
  const label = p.balance.towers[t.type].label;
  const choices = evolutionChoices(p.balance, t);
  const next = upgradeCost(p.balance, t.type, t.level);
  const refund = sellRefund(p.balance, t);
  return (
    <div className={css.tools} role="group" aria-label={`${label} 레벨 ${t.level}`}>
      {next !== null && (choices ? (
        <Button variant="accent" className={css.tool} aria-disabled={p.gold < next || undefined} aria-label={`진화 ${next} 골드`} onClick={p.onEvolve}>
          <EvolveIcon size={18} />
          <span>진화</span>{' '}
          <Cost value={next} />
        </Button>
      ) : (
        <Button variant="primary" className={css.tool} aria-disabled={p.gold < next || undefined} aria-label={`강화 ${next} 골드`} onClick={p.onUpgrade}>
          <UpgradeArrowIcon size={18} />
          <span>강화</span>{' '}
          <Cost value={next} />
        </Button>
      ))}
      {t.undoable && p.onUndo ? (
        <Button variant="secondary" className={css.tool} aria-label={`설치 되돌리기 +${t.invested} 골드`} onClick={() => p.onUndo!(t.id)}>
          <UndoArrowIcon size={18} />
          <span>되돌리기</span>{' '}
          <Cost value={t.invested} plus />
        </Button>
      ) : (
        <Button
          variant="danger"
          className={css.tool}
          data-confirm={confirmSell || undefined}
          aria-label={confirmSell ? `판매 확인 +${refund} 골드` : `판매 +${refund} 골드`}
          onClick={() => (confirmSell ? p.onSell() : setConfirmSell(true))}
          onBlur={() => setConfirmSell(false)}
        >
          <SellIcon size={18} />
          <span>{confirmSell ? '확인' : '판매'}</span>{' '}
          <Cost value={refund} plus />
        </Button>
      )}
    </div>
  );
}

/**
 * 칸 옆에 붙는 상자. 칸이 전장 오른쪽 절반이면 왼쪽에, 아니면 오른쪽에 둔다. 전장 밖으로 나가지 않게 한 번 재서 당긴다.
 * place가 below면 칸 바로 아래 가운데, above면 칸 바로 위 가운데에 둔다.
 */
function Anchored({
  cell,
  boxW,
  boxH,
  place = 'side',
  avoidTopLeft = false,
  avoidBottom = false,
  onEscape,
  children,
}: {
  cell: CellRect;
  boxW: number;
  boxH: number;
  place?: 'side' | 'below' | 'above';
  avoidTopLeft?: boolean | undefined;
  avoidBottom?: boolean | undefined;
  onEscape?(): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const gap = 6;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const midX = cell.left + cell.size / 2 - w / 2, midY = cell.top + cell.size / 2 - h / 2;
    const sides = {
      right: { left: cell.left + cell.size + gap, top: midY },
      left: { left: cell.left - w - gap, top: midY },
      below: { left: midX, top: cell.top + cell.size + gap },
      above: { left: midX, top: cell.top - h - gap },
    };
    // 칸을 가리지 않는 쪽 중 전장 안에 들어가고 고정 안내 요소(전체 지도·하단 쪽지)와 겹치지 않는 첫 자리.
    const order = place === 'below' ? (['below', 'above'] as const) : place === 'above' ? (['above', 'below'] as const) : cell.left + cell.size / 2 < boxW / 2 ? (['right', 'left', 'below', 'above'] as const) : (['left', 'right', 'below', 'above'] as const);
    const inBounds = (p: { left: number; top: number }) => p.left >= 4 && p.left + w <= boxW - 4 && p.top >= 4 && p.top + h <= boxH - 4;
    const clearZones = (p: { left: number; top: number }) => {
      if (avoidTopLeft && p.left < 128 && p.top < 56) return false;
      if (avoidBottom && p.top + h > boxH - 56 && p.left + w > boxW * 0.15 && p.left < boxW * 0.85) return false;
      return true;
    };
    const pick = order.map(k => sides[k]).find(p => inBounds(p) && clearZones(p))
      ?? order.map(k => sides[k]).find(inBounds)
      ?? sides[order[0]];
    const left = Math.max(4, Math.min(boxW - w - 4, pick.left));
    const maxTop = avoidBottom && left + w > boxW * 0.15 && left < boxW * 0.85 ? Math.max(4, boxH - 56 - h) : boxH - h - 4;
    const minTop = avoidTopLeft && left < 128 ? Math.min(maxTop, 56) : 4;
    const top = Math.max(minTop, Math.min(maxTop, pick.top));
    setPos(prev => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  }, [cell.left, cell.top, cell.size, boxW, boxH, place, avoidTopLeft, avoidBottom]);
  return (
    <div
      ref={ref}
      className={css.anchored}
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
      onKeyDown={e => { if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); } }}
    >
      {children}
    </div>
  );
}

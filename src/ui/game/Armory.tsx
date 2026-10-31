import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Balance, TowerId } from '../../contracts/balance';
import { buildCost } from '../../domain/towers';
import { fmtNumber } from '../copy';
import { GoldCoinIcon, TowerShieldPortrait } from '../icons/GameIcons';
import css from './Armory.module.css';

/** 장착함 칸 수(towers.md §0-2: 시작 4종 + 징집, 최대 8칸). 우측 장착 홈은 이 칸 수를 전제로 배치한다. */
export const ARMORY_SLOTS = 8;

interface Props {
  balance: Balance;
  towers: readonly TowerId[];
  gold: number;
  /** 먼저 골라 둔 타워(빈 자리를 누르면 바로 설치). */
  armed: TowerId | null;
  icons: Record<string, string>;
  /** rail: 우측 레일 격자, strip: 휴대폰 전장 아래 가로 줄. */
  variant: 'rail' | 'strip';
  /** 낮은 화면(압축 레일): 소켓 여백·가격 글자를 줄인다. 정보는 그대로다. */
  compact?: boolean;
  /** 막 살 수 있게 된 타워(테두리가 한 번 빛난다). */
  fresh?: ReadonlySet<TowerId>;
  onArm(type: TowerId): void;
  onPress(type: TowerId, e: ReactPointerEvent<HTMLElement>): void;
  /** 끌기 뒤 따라오는 click을 거른다. true면 누르기로 친다. */
  takeClick(): boolean;
}

/**
 * 장착 홈(ui-rules-v2 §1·§4): 초상화와 가격만 보이는 소켓. 누르면 그 타워를 골라 두고(연속 설치),
 * 끌면 전장에 바로 놓는다. 이름은 화면 읽기와 길게 누르기(제목)로만 읽힌다.
 * 우측 레일은 장착함 8칸(4×2, towers.md §0-2)을 전제로 자리를 잡고, 아직 빈 칸은 파인 홈만 보인다(징집으로 채워져도 배치가 움직이지 않는다).
 */
export function Armory({ balance, towers, gold, armed, icons, variant, compact = false, fresh, onArm, onPress, takeClick }: Props) {
  const empty = variant === 'rail' ? Math.max(0, ARMORY_SLOTS - towers.length) : 0;
  return (
    <div className={variant === 'rail' ? css.rail : css.strip} data-compact={compact || undefined} role="listbox" aria-label="타워 장착 홈" aria-orientation={variant === 'rail' ? 'vertical' : 'horizontal'}>
      {towers.map(type => {
        const price = buildCost(balance, type);
        const short = gold < price;
        const label = balance.towers[type].label;
        return (
          <button
            key={type}
            type="button"
            role="option"
            aria-selected={armed === type}
            aria-label={`${label} ${price} 골드${short ? `, ${price - gold} 부족` : ''}`}
            title={label}
            className={css.socket}
            data-short={short || undefined}
            data-fresh={fresh?.has(type) || undefined}
            onPointerDown={e => onPress(type, e)}
            onClick={() => { if (takeClick()) onArm(type); }}
          >
            <span className={css.well}>
              <TowerShieldPortrait type={type} icons={icons} size={variant === 'rail' ? 'fill' : 40} bare />
            </span>
            <span className={css.price}>
              <GoldCoinIcon size={14} />
              <span>{fmtNumber(price)}</span>
            </span>
          </button>
        );
      })}
      {Array.from({ length: empty }, (_, i) => <span key={`empty-${i}`} className={css.empty} aria-hidden="true" />)}
    </div>
  );
}

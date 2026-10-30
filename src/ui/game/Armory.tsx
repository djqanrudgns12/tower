import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Balance, TowerId } from '../../contracts/balance';
import { buildCost } from '../../domain/towers';
import { fmtNumber } from '../copy';
import { GoldCoinIcon, TowerShieldPortrait } from '../icons/GameIcons';
import css from './Armory.module.css';

interface Props {
  balance: Balance;
  towers: readonly TowerId[];
  gold: number;
  /** 먼저 골라 둔 타워(빈 자리를 누르면 바로 설치). */
  armed: TowerId | null;
  icons: Record<string, string>;
  /** rail: 우측 레일 격자, strip: 휴대폰 전장 아래 가로 줄. */
  variant: 'rail' | 'strip';
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
 */
export function Armory({ balance, towers, gold, armed, icons, variant, fresh, onArm, onPress, takeClick }: Props) {
  return (
    <div className={variant === 'rail' ? css.rail : css.strip} role="listbox" aria-label="타워 장착 홈" aria-orientation={variant === 'rail' ? 'vertical' : 'horizontal'}>
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
              <TowerShieldPortrait type={type} icons={icons} size={variant === 'rail' ? 64 : 44} bare />
            </span>
            <span className={css.price}>
              <GoldCoinIcon size={14} />
              <span>{fmtNumber(price)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Balance, TowerId } from '../../contracts/balance';
import { buildCost } from '../../domain/towers';
import { fmtNumber } from '../copy';
import { TowerShieldPortrait } from '../icons/GameIcons';
import { ArtIcon } from '../kit';
import css from './Armory.module.css';

interface Props {
  balance: Balance;
  towers: readonly TowerId[];
  gold: number;
  /** 먼저 골라 둔 타워(빈 자리를 누르면 바로 설치). */
  armed: TowerId | null;
  icons: Record<string, string>;
  /** rail: 우측 카드 격자(4칸씩), strip: 휴대폰 전장 아래 한 줄(8칸 44px). */
  variant: 'rail' | 'strip';
  /** 낮은 화면(압축 레일): 그림을 줄인다. 정보는 그대로다. */
  compact?: boolean;
  /** 막 살 수 있게 된 타워(호박색 링이 한 번 켜진다). */
  fresh?: ReadonlySet<TowerId>;
  /** 다음 새 타워를 받는 때(잠긴 칸 하나의 안내). 더 받을 타워가 없으면 null이고 잠긴 칸도 없다. */
  locked?: string | null;
  onArm(type: TowerId): void;
  onPress(type: TowerId, e: ReactPointerEvent<HTMLElement>): void;
  /** 끌기 뒤 따라오는 click을 거른다. true면 누르기로 친다. */
  takeClick(): boolean;
}

/**
 * 타워 칸(R4 PRD §9.1): 가진 타워와 잠긴 칸 하나만 보인다. 누르면 그 타워를 골라 두고(연속 설치), 끌면 전장에 바로 놓는다.
 * 살 수 있는 칸은 밝은 키캡, 못 사는 칸은 그림을 50%로 흐리고 가격을 빨갛게, 막 살 수 있게 된 칸은 호박색 링이 한 번 켜진다.
 * 이름은 화면 읽기와 호버 안내(title)로만 읽힌다.
 */
export function Armory({ balance, towers, gold, armed, icons, variant, compact = false, fresh, locked = null, onArm, onPress, takeClick }: Props) {
  const lockId = `armory-lock-${variant}`;
  return (
    <>
      <div
        className={variant === 'rail' ? css.rail : css.strip}
        data-compact={compact || undefined}
        role="listbox"
        aria-label="타워 칸"
        aria-orientation={variant === 'rail' ? 'vertical' : 'horizontal'}
        aria-describedby={locked ? lockId : undefined}
      >
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
              <span className={css.art}>
                <TowerShieldPortrait type={type} icons={icons} size="fill" bare />
              </span>
              <span className={css.price}>
                <ArtIcon name="coin" size={variant === 'strip' ? 12 : 14} />
                {fmtNumber(price)}
              </span>
            </button>
          );
        })}
        {locked && (
          <span className={css.locked} title={locked} aria-hidden="true">
            <ArtIcon name="lock" size={variant === 'strip' ? 20 : 24} />
          </span>
        )}
      </div>
      {locked && <span id={lockId} className="sr-only">잠긴 칸: {locked}</span>}
    </>
  );
}

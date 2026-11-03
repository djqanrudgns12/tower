import { useRef, useState } from 'react';
import type { Balance, TowerId } from '../../contracts/balance';
import { SkyWingIcon, TowerShieldPortrait } from '../icons/GameIcons';
import { recruitCardInfo } from './recruit';
import css from './RecruitCard.module.css';

interface Props {
  balance: Balance;
  /** 후보 3종. */
  choices: readonly TowerId[];
  icons: Record<string, string>;
  /** 휴대폰: 전장 아래 줄에 두고 그림을 줄인다. 아니면 전장 위 가운데에 뜬다. */
  compact?: boolean;
  onPick(type: TowerId): void;
}

/**
 * 징집 화면(towers.md §0-2): 큰 타워 카드 3장(그림·이름·역할 한 줄·비행 적 공격 표시)과 고르기 단추만.
 * 문제 풀이 흐름을 막지 않는다: 모달이 아니고(화면을 잠그지 않음), 열릴 때 포커스를 빼앗지 않는다. 숫자 키는 문제 답으로 그대로 간다.
 * 카드를 누르면 고른 표시만 하고 ‘고르기’로 확정한다. 닫기는 없다(고르지 않으면 다음 징집 때 첫 카드로 정해진다).
 */
export function RecruitCard({ balance, choices, icons, compact = false, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<TowerId | null>(null);

  const move = (from: number, step: number) => {
    const next = (from + step + choices.length) % choices.length;
    setPicked(choices[next]!);
    box.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div ref={box} className={css.panel} data-compact={compact || undefined} role="dialog" aria-modal="false" aria-labelledby="recruit-title">
      <h2 id="recruit-title" className={css.title}>새 타워 징집</h2>
      <div className={css.choices} role="radiogroup" aria-labelledby="recruit-title">
        {choices.map((type, i) => {
          const selected = picked === type;
          const info = recruitCardInfo(balance, type);
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={(picked === null ? i === 0 : selected) ? 0 : -1}
              className={css.choice}
              onClick={() => setPicked(type)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
              }}
            >
              <span className={css.art}>
                <TowerShieldPortrait type={type} icons={icons} size={compact ? 56 : 104} bare />
              </span>
              <span className={css.name}>{balance.towers[type].label}</span>
              <span className={css.role}>{info.role}</span>
              {info.air !== null && (
                <span className={css.air} data-air={info.air || undefined}>
                  {info.air && <SkyWingIcon size={14} />}
                  {info.air ? '하늘 적 공격' : '땅 적만'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" className={css.pick} disabled={picked === null} onClick={() => { if (picked) onPick(picked); }}>
        고르기
      </button>
    </div>
  );
}

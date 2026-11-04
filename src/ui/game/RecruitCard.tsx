import type { Balance, TowerId } from '../../contracts/balance';
import { TOWER_COPY } from '../copy';
import { TowerShieldPortrait } from '../icons/GameIcons';
import { ArtIcon, Modal } from '../kit';
import { ChoiceCard } from './ChoiceCard';
import { CounterIcons } from './CounterIcons';
import css from './ChoiceCard.module.css';
import { recruitCardInfo } from './recruit';
import { statBars } from './statBars';

interface Props {
  balance: Balance;
  /** 후보 3종. */
  choices: readonly TowerId[];
  icons: Record<string, string>;
  /** 휴대폰: 카드를 가로 한 줄 짜임으로 세로로 쌓는다. */
  compact?: boolean;
  onPick(type: TowerId): void;
}

/**
 * 새 타워 고르기 창(towers.md §0-2, R4 PRD §9.2): 막이 전장과 문제 카드까지 덮고, 카드 3장마다 ‘고르기’ 한 번으로 바로 고른다.
 * 꼭 골라야 하는 창이라 닫기가 없다(kit Modal dismissable=false). 열리면 첫 ‘고르기’에 포커스가 가고 Tab은 창 안에서만 돈다.
 */
export function RecruitCard({ balance, choices, icons, compact = false, onPick }: Props) {
  return (
    <Modal titleId="recruit-title" title="새 타워" size={compact ? 'sm' : 'lg'} dismissable={false} onClose={() => {}}>
      <div className={compact ? css.listRow : css.list3}>
        {choices.map(type => {
          const info = recruitCardInfo(balance, type);
          const label = balance.towers[type].label;
          return (
            <ChoiceCard
              key={type}
              row={compact}
              art={<TowerShieldPortrait type={type} icons={icons} size="fill" bare />}
              name={label}
              desc={TOWER_COPY[type].role}
              note={info.air !== null && (
                <span className={css.note} data-air={info.air || undefined}>
                  {info.air && <ArtIcon name="trait.flying" size={20} />}
                  {info.air ? '하늘 적 공격' : '땅 적만'}
                </span>
              )}
              counters={<CounterIcons balance={balance} type={type} form="base" icons={icons} size={compact ? 18 : 20} />}
              bars={statBars(balance, type, 1, 'base')}
              action="고르기"
              actionLabel={`${label} 고르기`}
              variant="primary"
              onPick={() => onPick(type)}
            />
          );
        })}
      </div>
    </Modal>
  );
}

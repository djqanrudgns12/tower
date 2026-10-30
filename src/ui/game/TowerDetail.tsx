import type { Balance, TowerId } from '../../contracts/balance';
import { StatPowerIcon, StatRangeIcon, StatSpeedIcon, TowerShieldPortrait } from '../icons/GameIcons';
import { formInfo, type FormId } from './evolution';
import { SEGMENTS, statBars, type StatKey } from './statBars';
import css from './TowerDetail.module.css';

interface Props {
  balance: Balance;
  type: TowerId;
  level: number;
  form: FormId;
  icons: Record<string, string>;
  /** 강화하면 바뀌는 막대를 옅게 미리 보인다. */
  next?: { level: number; form: FormId } | null;
}

const ICON: Record<StatKey, typeof StatPowerIcon> = { power: StatPowerIcon, speed: StatSpeedIcon, range: StatRangeIcon };

/** 고른 타워(또는 골라 둔 종류)의 초상화·레벨·능력치 막대. 문장 없이 아이콘·막대·숫자만 보인다. */
export function TowerDetail({ balance, type, level, form, icons, next = null }: Props) {
  const bars = statBars(balance, type, level, form, next);
  const info = formInfo(balance, type, form);
  return (
    <section className={css.detail} aria-label={`${balance.towers[type].label} 능력치`}>
      <div className={css.head}>
        <TowerShieldPortrait type={type} icons={icons} size={56} />
        <div className={css.title}>
          <span className={css.name}>{balance.towers[type].label}</span>
          <span className={css.tags}>
            <span className={css.level}>레벨 {level}</span>
            {info.tier > 0 && <span className={css.form}>{info.label}</span>}
          </span>
        </div>
      </div>
      <dl className={css.bars}>
        {bars.map(bar => {
          const Icon = ICON[bar.key];
          return (
            <div key={bar.key} className={css.row}>
              <dt className={css.label}><Icon size={16} /><span>{bar.label}</span></dt>
              <dd className={css.value}>
                <span className={css.track} role="img" aria-label={`${bar.label} ${bar.filled}/${SEGMENTS}${bar.next !== null && bar.next > bar.filled ? `, 강화하면 ${bar.next}/${SEGMENTS}` : ''}`}>
                  {Array.from({ length: SEGMENTS }, (_, i) => (
                    <span key={i} className={css.seg} data-on={i < bar.filled || undefined} data-next={(bar.next !== null && i >= bar.filled && i < bar.next) || undefined} />
                  ))}
                </span>
                <span className={css.num}>{bar.value}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

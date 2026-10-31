import type { Balance, TowerId } from '../../contracts/balance';
import { StatPowerIcon, StatRangeIcon, StatSpeedIcon, TowerShieldPortrait } from '../icons/GameIcons';
import { formInfo, type FormId } from './evolution';
import { SEGMENTS, statBars, type StatKey } from './statBars';
import { ROLE_LABEL, TOWER_ROLE_GROUP } from './towerRoles';
import css from './TowerDetail.module.css';

interface Props {
  balance: Balance;
  type: TowerId;
  level: number;
  form: FormId;
  icons: Record<string, string>;
  /** 강화하면 바뀌는 막대를 옅게 미리 보인다. */
  next?: { level: number; form: FormId } | null;
  /**
   * 낮은 화면(압축 레일, 크롬북): 막대 대신 요약 한 줄 — 역할 이름과 아이콘+숫자 칩 세 개(공격력·속도·사거리).
   * 막대 세 줄이 레일 높이를 넘지 않게 하고, 그 대신 역할을 낱말로 보인다.
   */
  compact?: boolean;
}

const ICON: Record<StatKey, typeof StatPowerIcon> = { power: StatPowerIcon, speed: StatSpeedIcon, range: StatRangeIcon };

/** 고른 타워(또는 골라 둔 종류)의 초상화·레벨·능력치 막대. 문장 없이 아이콘·막대·숫자만 보인다. */
export function TowerDetail({ balance, type, level, form, icons, next = null, compact = false }: Props) {
  const bars = statBars(balance, type, level, form, next);
  const info = formInfo(balance, type, form);
  return (
    <section className={css.detail} data-compact={compact || undefined} aria-label={`${balance.towers[type].label} 능력치`}>
      <div className={css.head}>
        <TowerShieldPortrait type={type} icons={icons} size={compact ? 32 : 56} />
        <div className={css.title}>
          <span className={css.name}>{balance.towers[type].label}</span>
          <span className={css.tags}>
            <span className={css.level}>레벨 {level}</span>
            {info.tier > 0 && <span className={css.form}>{info.label}</span>}
            {compact && <span className={css.form}>{ROLE_LABEL[TOWER_ROLE_GROUP[type]]}</span>}
          </span>
        </div>
      </div>
      {compact ? (
        <ul className={css.chips}>
          {bars.map(bar => {
            const Icon = ICON[bar.key];
            const up = bar.next !== null && bar.next > bar.filled;
            return (
              <li key={bar.key} className={css.chip} data-up={up || undefined} aria-label={`${bar.label} ${bar.value}${up ? ', 강화하면 오름' : ''}`} title={bar.label}>
                <Icon size={14} />
                <span aria-hidden="true">{bar.value}</span>
              </li>
            );
          })}
        </ul>
      ) : (
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
      )}
    </section>
  );
}

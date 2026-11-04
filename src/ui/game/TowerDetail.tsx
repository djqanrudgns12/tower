import type { Balance, TowerId } from '../../contracts/balance';
import { StatPowerIcon, StatRangeIcon, StatSpeedIcon, TowerShieldPortrait } from '../icons/GameIcons';
import { formInfo, type FormId } from './evolution';
import { SEGMENTS, statBars, type StatBar, type StatKey } from './statBars';
import { ROLE_LABEL, TOWER_ROLE_GROUP } from './towerRoles';
import css from './TowerDetail.module.css';

interface Props {
  balance: Balance;
  type: TowerId;
  level: number;
  form: FormId;
  icons: Record<string, string>;
  /** 강화하면 바뀌는 막대를 호박색 칸으로 미리 보인다. */
  next?: { level: number; form: FormId } | null;
  /**
   * 낮은 화면(압축 레일, 크롬북): 막대 대신 요약 한 줄 — 역할 이름과 아이콘+숫자 칩 세 개(공격력·속도·사거리).
   * 막대 세 줄이 레일 높이를 넘지 않게 하고, 그 대신 역할을 낱말로 보인다.
   */
  compact?: boolean;
}

const ICON: Record<StatKey, typeof StatPowerIcon> = { power: StatPowerIcon, speed: StatSpeedIcon, range: StatRangeIcon };

/**
 * 능력치 막대 줄(아이콘·이름·칸 5개·숫자). 늘어날 칸은 호박색이다(R4 PRD §9.2). 상황 카드와 새 타워·진화 카드가 같이 쓴다.
 * 숫자를 문장(11.2 → 14.4)으로 읽히지 않고 칸 수로 비교한다.
 */
export function StatRows({ bars, values = true, labels = true }: { bars: readonly StatBar[]; values?: boolean; labels?: boolean }) {
  return (
    <dl className={css.bars}>
      {bars.map(bar => {
        const Icon = ICON[bar.key];
        const up = bar.next !== null && bar.next > bar.filled;
        return (
          <div key={bar.key} className={css.row}>
            <dt className={css.label} title={bar.label}><Icon size={16} /><span className={labels ? undefined : 'sr-only'}>{bar.label}</span></dt>
            <dd className={css.value}>
              <span className={css.track} role="img" aria-label={`${bar.label} ${bar.filled}/${SEGMENTS}${up ? `, 바뀌면 ${bar.next}/${SEGMENTS}` : ''}`}>
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <span key={i} className={css.seg} data-on={i < bar.filled || undefined} data-next={(up && i >= bar.filled && i < bar.next!) || undefined} />
                ))}
              </span>
              {values && <span className={css.num}>{bar.value}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** 고른 타워(또는 골라 둔 종류)의 초상화·이름·레벨·능력치 막대. 문장 없이 아이콘·막대·숫자만 보인다. */
export function TowerDetail({ balance, type, level, form, icons, next = null, compact = false }: Props) {
  const bars = statBars(balance, type, level, form, next);
  const info = formInfo(balance, type, form);
  return (
    <section className={css.detail} data-compact={compact || undefined} aria-label={`${balance.towers[type].label} 능력치`}>
      <div className={css.head}>
        <TowerShieldPortrait type={type} icons={icons} size={compact ? 36 : 52} bare />
        <div className={css.title}>
          <span className={css.name}>{balance.towers[type].label}</span>
          <span className={css.tags}>
            <span>레벨 {level}</span>
            {info.tier > 0 && <span className={css.form}>{info.label}</span>}
            {compact && <span>{ROLE_LABEL[TOWER_ROLE_GROUP[type]]}</span>}
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
                <Icon size={16} />
                <span aria-hidden="true">{bar.value}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <StatRows bars={bars} />
      )}
    </section>
  );
}

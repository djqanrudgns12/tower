import { Badge } from '../kit';
import { LineIcon, type LineIconName } from '../icons/LineIcon';
import { speciesPortraitUrl } from '../../game/r6/mapPhase';
import type { r6Forecast } from './r6Forecast';
import { BattleIcon } from './BattleIcon';
import type { Balance } from '../../contracts/balance';
import { FORECAST_WARNING } from '../copy';
import css from './ContextCard.module.css';
import { ENEMY_NAME, foeIconUrl, ROLE_TRAIT, TRAIT_ICON, type ForecastWarning, type PreviewFoe, type WavePreview } from './wavePreview';

interface ForecastProps {
  balance: Balance;
  preview: WavePreview;
  /** 원화 id → 주소(인수된 종족 그림). */
  urlOf(artId: string): string | undefined;
  /** 종족 그림이 없을 때 쓰는 전장 텍스처 그림(icons). */
  icons: Record<string, string>;
  /** 대응이 없을 때 경고 한 줄(forecastWarning): 하늘을 쏘는 타워가 없음, 또는 종족 특성을 잘 잡는 타워가 없음. 없으면 null. */
  warning: ForecastWarning | null;
  compact?: boolean;
}

/**
 * 상황 카드 — 다음 웨이브 적(R4 PRD §9.1): 적 초상화 × 수와 특성 아이콘, 대장은 크게 맨 앞. 제목 줄 오른쪽에 종족 특성 아이콘(prd-r4 §7.2 E).
 * 대응이 없을 때만 경고 한 줄. 웨이브 번호는 준비 바·상태 카드가 이미 보이므로 여기에는 다시 적지 않는다.
 */
export function WaveForecast({ balance, preview, urlOf, icons, warning, compact = false }: ForecastProps) {
  const foes: PreviewFoe[] = [...(preview.bossFoe ? [preview.bossFoe] : []), ...preview.kinds];
  const traits = preview.traits.map(t => TRAIT_ICON[t]);
  const said = foes.map(f => `${ENEMY_NAME[f.kind]} ${f.count}`).join(', ') + (traits.length ? `, 특성 ${traits.map(t => t.label).join(', ')}` : '');
  return (
    <section className={css.forecast} data-compact={compact || undefined} aria-label={`다음 적 ${preview.total}마리: ${said}`}>
      <h2 className={css.title} aria-hidden="true">
        다음 적 <span className={css.total}>{preview.total}</span>
        {traits.length > 0 && (
          <span className={css.traits}>
            {traits.map(t => <span key={t.icon} className={css.trait} title={t.label}><BattleIcon name={t.icon} size={compact ? 20 : 24} /></span>)}
          </span>
        )}
      </h2>
      <ul className={css.foes} aria-hidden="true">
        {foes.map(f => {
          const src = foeIconUrl(balance, f, urlOf, icons[`enemy.${f.kind}.0`]);
          const trait = ROLE_TRAIT[f.kind];
          return (
            <li key={f.kind} className={css.foe} data-boss={f.kind === 'boss' || undefined} title={trait ? `${ENEMY_NAME[f.kind]} · ${trait.label}` : ENEMY_NAME[f.kind]}>
              <span className={css.portrait}>{src && <img src={src} alt="" draggable={false} />}</span>
              <span className={css.count}>×{f.count}</span>
              {trait && <BattleIcon name={trait.icon} size={compact ? 20 : 24} />}
            </li>
          );
        })}
      </ul>
      {warning && (
        <p className={css.warn} role="status">
          <BattleIcon name={warning === 'air' ? 'trait.flying' : TRAIT_ICON[warning].icon} size={20} />
          {FORECAST_WARNING[warning]}
        </p>
      )}
    </section>
  );
}

/** 상황 카드 — 전투 중: 남은 적 수 하나. */
export function Remaining({ count }: { count: number }) {
  return (
    <div className={css.remain} role="img" aria-label={`남은 적 ${count}마리`}>
      <span className={css.remainLabel} aria-hidden="true">남은 적</span>
      <strong className={css.remainNum} aria-hidden="true">{count}</strong>
    </div>
  );
}

const TRAIT_NAMES: Partial<Record<LineIconName, string>> = {
  'traits/armor': '장갑', 'traits/ward': '마법 저항', 'traits/fast': '신속',
  'traits/flying': '비행', 'traits/split': '분열', 'traits/regen': '재생', 'traits/siege': '공성',
};

export function R6WaveForecast({ preview, airGap, wave }: { preview: ReturnType<typeof r6Forecast>; airGap: boolean; wave?: number }) {
  return (
    <section className={css.forecast} aria-label="웨이브 미리보기">
      <h2 className={css.title}>
        {wave ? `${wave}웨이브 예고` : '웨이브 예고'}
        <Badge tone="teal">다음 적 {preview.total}</Badge>
      </h2>
      <ul className={css.species}>
        {preview.species.map(({ id, count, name }) => (
          <li key={id} className={css.speciesItem}>
            <img src={speciesPortraitUrl(id)} alt="" className={css.speciesArt} draggable={false} />
            <span className={css.speciesText}>{name} {count}마리</span>
          </li>
        ))}
      </ul>
      <div className={css.traits}>
        {preview.boss && <Badge tone="amber">보스</Badge>}
        {preview.traits.map(icon => <Badge key={icon}><LineIcon name={icon} size={14} />{TRAIT_NAMES[icon]}</Badge>)}
      </div>
      {preview.counters.length > 0 && (
        <p className={css.counterRow}>
          <span className={css.counterLabel}>추천 대응</span>
          <span className={css.counterList}>{preview.counters.join(' · ')}</span>
        </p>
      )}
      {airGap && <p className={css.warn} role="status"><LineIcon name="traits/flying" />날아오는 적이 있어요. 공중 공격 타워를 준비해요.</p>}
    </section>
  );
}

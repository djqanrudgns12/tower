import type { Balance } from '../../contracts/balance';
import { ArtIcon } from '../kit';
import css from './ContextCard.module.css';
import { ENEMY_NAME, foeIconUrl, ROLE_TRAIT, type PreviewFoe, type WavePreview } from './wavePreview';

interface ForecastProps {
  balance: Balance;
  preview: WavePreview;
  /** 원화 id → 주소(인수된 종족 그림). */
  urlOf(artId: string): string | undefined;
  /** 종족 그림이 없을 때 쓰는 전장 텍스처 그림(icons). */
  icons: Record<string, string>;
  /** 나는 적이 오는데 하늘을 쏘는 타워가 없다(경고 한 줄). */
  airGap: boolean;
  compact?: boolean;
}

/**
 * 상황 카드 — 다음 웨이브 적(R4 PRD §9.1): 적 초상화 × 수와 특성 아이콘, 대장은 크게 맨 앞. 대응이 없을 때만 경고 한 줄.
 * 웨이브 번호는 준비 바·상태 카드가 이미 보이므로 여기에는 다시 적지 않는다.
 */
export function WaveForecast({ balance, preview, urlOf, icons, airGap, compact = false }: ForecastProps) {
  const foes: PreviewFoe[] = [...(preview.bossFoe ? [preview.bossFoe] : []), ...preview.kinds];
  const said = foes.map(f => `${ENEMY_NAME[f.kind]} ${f.count}`).join(', ');
  return (
    <section className={css.forecast} data-compact={compact || undefined} aria-label={`다음 적 ${preview.total}마리: ${said}`}>
      <h2 className={css.title} aria-hidden="true">다음 적 <span className={css.total}>{preview.total}</span></h2>
      <ul className={css.foes} aria-hidden="true">
        {foes.map(f => {
          const src = foeIconUrl(balance, f, urlOf, icons[`enemy.${f.kind}.0`]);
          const trait = ROLE_TRAIT[f.kind];
          return (
            <li key={f.kind} className={css.foe} data-boss={f.kind === 'boss' || undefined} title={trait ? `${ENEMY_NAME[f.kind]} · ${trait.label}` : ENEMY_NAME[f.kind]}>
              <span className={css.portrait}>{src && <img src={src} alt="" draggable={false} />}</span>
              <span className={css.count}>×{f.count}</span>
              {trait && <ArtIcon name={trait.icon} size={compact ? 20 : 24} />}
            </li>
          );
        })}
      </ul>
      {airGap && (
        <p className={css.warn} role="status">
          <ArtIcon name="trait.flying" size={20} />
          날아오는 적이 많아요 — 하늘을 쏘는 타워가 없어요
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

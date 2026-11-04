import { ArtIcon } from '../kit';
import css from './WaveBand.module.css';

interface Props {
  wave: number;
  boss: boolean;
  /** 대장 웨이브: 이번 종족 대장 초상화(wavePreview의 bossFoe → foeIconUrl). */
  bossArt?: string | undefined;
  onDone(): void;
}

/**
 * 웨이브 시작 띠(R4 PRD §9.2): 전장 위 가운데에 종이 띠가 1초 내려왔다 올라간다. 대장 웨이브는 그 종족 대장 초상화와 빨간 ‘대장’.
 * 모션을 끄면 자리에서 나타났다 사라진다. 화면 읽기에는 상태 카드의 웨이브 숫자가 이미 알린다.
 */
export function WaveBand({ wave, boss, bossArt, onDone }: Props) {
  return (
    <div className={css.band} data-boss={boss || undefined} aria-hidden="true" onAnimationEnd={onDone}>
      {boss && bossArt ? <img className={css.boss} src={bossArt} alt="" draggable={false} /> : <ArtIcon name="wave" size={32} />}
      <span className={css.text}>{wave}웨이브</span>
      {boss && <span className={css.tag}>보스</span>}
    </div>
  );
}

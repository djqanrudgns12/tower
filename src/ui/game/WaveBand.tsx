import { WaveFlagIcon } from '../icons/GameIcons';
import css from './WaveBand.module.css';

interface Props {
  wave: number;
  boss: boolean;
  bossArt?: string | undefined;
  onDone(): void;
}

/**
 * 웨이브 시작 띠(ui-rules-v2 §5): 전장 위 상단에 1초 내려왔다 올라간다. 대장 웨이브는 붉은 띠와 대장 초상화.
 * 모션을 끄면 자리에서 나타났다 사라진다. 화면 읽기에는 상태 바의 웨이브 숫자가 이미 알린다.
 */
export function WaveBand({ wave, boss, bossArt, onDone }: Props) {
  return (
    <div className={css.band} data-boss={boss || undefined} aria-hidden="true" onAnimationEnd={onDone}>
      {boss && bossArt ? <img className={css.boss} src={bossArt} alt="" draggable={false} /> : <WaveFlagIcon size={26} boss={boss} light />}
      <span className={css.text}>{wave}웨이브</span>
      {boss && <span className={css.tag}>대장</span>}
    </div>
  );
}

import { ArtIcon } from '../kit';
import css from './WaveBand.module.css';

interface Props {
  wave: number;
  boss: boolean;
  /** 보스 웨이브: 이번 종족 보스 초상화(wavePreview의 bossFoe → foeIconUrl). */
  bossArt?: string | undefined;
  onDone(): void;
}

/**
 * 웨이브 시작 띠(R4 PRD §9.2): 전장 위 가운데에 종이 띠가 1초 내려왔다 올라간다. 보스 웨이브는 띠가 붉은 칠 + 밝은 글(R5 B7)이고,
 * 그 종족 보스 초상화(R4)와 양피지 ‘보스’ 태그가 붙는다. 움직임을 줄이면(OS·게임 설정) 자리에서 나타났다 사라진다.
 * 화면 읽기에는 상태 카드의 웨이브 숫자가 이미 알린다.
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

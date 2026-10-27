import type { GameView } from '../../application/view';
import { fmtNumber } from '../copy';
import css from './Hud.module.css';

interface Props { view: GameView; mode: 'R' | 'S'; onPause(): void }

/** 성문·웨이브·골드·점수·정지(PRD §12.3). 하트 대신 실제 HP 막대. */
export function Hud({ view, mode, onPause }: Props) {
  const ratio = view.gateMaxHp ? view.gateHp / view.gateMaxHp : 0;
  return (
    <div className={`${css.hud} ${mode === 'R' ? css.rail : css.bar}`}>
      <div className={css.gate} role="meter" aria-label="성문" aria-valuemin={0} aria-valuemax={view.gateMaxHp} aria-valuenow={view.gateHp}>
        <span className={css.label}>성문</span>
        <span className={css.track}><span className={css.fill} data-low={ratio <= 0.34} style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
        <span className={css.value}>{view.gateHp}/{view.gateMaxHp}</span>
      </div>
      <div className={css.wave}>
        웨이브 <strong>{Math.max(1, view.wave)}</strong>
        {view.milestoneWave && <span className={css.milestone}>고비</span>}
      </div>
      <div className={css.gold} aria-label={`골드 ${view.gold}`}><Coin /> <strong>{fmtNumber(view.gold)}</strong></div>
      <div className={css.pt}>점수 <strong>{fmtNumber(view.pt)}</strong></div>
      {view.burningSecondsLeft > 0 && <div className={css.burn}>버닝 {view.burningSecondsLeft}초</div>}
      <button type="button" className={css.pause} onClick={onPause} aria-label="일시정지">
        <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.5" height="12" rx="1" /><rect x="11.5" y="4" width="3.5" height="12" rx="1" /></svg>
      </button>
    </div>
  );
}

export function Coin() {
  return <svg className={css.coin} viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="var(--gold)" stroke="var(--edge)" strokeWidth="2" /><circle cx="10" cy="10" r="4" fill="none" stroke="var(--wood)" strokeWidth="1.5" /></svg>;
}

import type { GameView } from '../../application/view';
import { fmtNumber } from '../copy';
import { BurningGemIcon, GateShieldIcon, GoldCoinIcon, PauseBarsIcon, ScoreCrestIcon } from '../icons/GameIcons';
import css from './Hud.module.css';

export interface RecentDelta {
  gold: number;
  pt: number;
}

interface Props {
  view: GameView;
  mode: 'R' | 'S';
  compactRail?: boolean;
  recentDelta?: RecentDelta | null;
  onPause(): void;
}

/**
 * 상단 상태판(PRD §12.3 + 시안 1 v3 왕국 원정대 정통 공방).
 * 짙은 호두나무 명패(--wood-dark)와 음각 금고(--wood-vault)는 이 상단 HUD에만 사용하여
 * 전장·하단 문제판·중간 관리함과의 시선 위계를 분리한다.
 */
export function Hud({ view, mode, compactRail = false, recentDelta = null, onPause }: Props) {
  const ratio = view.gateMaxHp ? view.gateHp / view.gateMaxHp : 0;
  const waveNo = Math.max(1, view.wave);
  const burning = view.burningSecondsLeft > 0;
  const streak = Math.min(3, view.battleStreak);

  if (mode === 'S') {
    return (
      <div className={`${css.hud} ${css.bar}`}>
        <div
          className={css.gate}
          role="meter"
          aria-label="성문"
          aria-valuemin={0}
          aria-valuemax={view.gateMaxHp}
          aria-valuenow={view.gateHp}
        >
          <GateShieldIcon size={15} />
          <span className={css.label}>성문</span>
          <span className={css.track}>
            <span className={css.fill} data-low={ratio <= 0.34} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
          <span className={css.value}>{view.gateHp}/{view.gateMaxHp}</span>
        </div>
        <div className={css.wave}>
          <span>웨이브</span>
          <strong>{waveNo}</strong>
          {view.milestoneWave && <span className={css.milestone}>고비</span>}
        </div>
        <div className={css.goldChip} aria-label={`골드 ${view.gold}`}>
          <GoldCoinIcon size={16} />
          <strong className={css.goldText}>{fmtNumber(view.gold)}</strong>
          {recentDelta && recentDelta.gold !== 0 && (
            <span className={css.deltaBadge} data-neg={recentDelta.gold < 0}>
              {recentDelta.gold > 0 ? `+${recentDelta.gold}` : recentDelta.gold}
            </span>
          )}
        </div>
        <div className={css.ptChip}>
          <ScoreCrestIcon size={16} />
          <span className={css.label}>점수</span>
          <strong>{fmtNumber(view.pt)}</strong>
          <span className={css.ptBreakdown}>
            (문제 {fmtNumber(view.stats.ptFromQuestions)} · 처치 {fmtNumber(view.stats.ptFromKills)})
          </span>
          {recentDelta && recentDelta.pt !== 0 && (
            <span className={css.deltaPtBadge} data-neg={recentDelta.pt < 0}>
              {recentDelta.pt > 0 ? `+${recentDelta.pt}` : recentDelta.pt}
            </span>
          )}
        </div>
        {burning && <div className={css.burnChip}>버닝 {view.burningSecondsLeft}초</div>}
        <button type="button" className={css.pause} onClick={onPause} aria-label="일시정지">
          <PauseBarsIcon size={18} />
        </button>
      </div>
    );
  }

  if (compactRail) {
    return (
      <div className={`${css.hud} ${css.railCompact}`}>
        <div className={css.railTop}>
          <div className={css.gateBlock}>
            <div className={css.gateMeta}>
              <span className={css.gateTitle}><GateShieldIcon size={14} /> 성문</span>
              <span className={css.waveInline}>
                웨이브 <strong>{waveNo}</strong>
                {view.milestoneWave && <span className={css.milestone}>고비</span>}
              </span>
            </div>
            <div
              className={css.gate}
              role="meter"
              aria-label="성문"
              aria-valuemin={0}
              aria-valuemax={view.gateMaxHp}
              aria-valuenow={view.gateHp}
            >
              <span className={css.track}>
                <span className={css.fill} data-low={ratio <= 0.34} style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
              <span className={css.value}>{view.gateHp}/{view.gateMaxHp}</span>
            </div>
          </div>
          <button type="button" className={css.pause} onClick={onPause} aria-label="일시정지">
            <PauseBarsIcon size={18} />
          </button>
        </div>
        <div className={css.vaultGridCompact}>
          <div className={css.vaultCompact} aria-label={`골드 ${view.gold}`}>
            <GoldCoinIcon size={15} />
            <span className={css.vaultCompactLabel}>골드</span>
            <strong className={css.goldText}>{fmtNumber(view.gold)}</strong>
          </div>
          <div className={css.vaultCompact}>
            <ScoreCrestIcon size={15} />
            <span className={css.vaultCompactLabel}>점수</span>
            <strong>{fmtNumber(view.pt)}</strong>
          </div>
          <div className={css.vaultCompact} data-burning={burning}>
            <BurningGemIcon active={burning || streak > 0} size={14} />
            <strong className={css.streakCompactText}>
              {burning ? `버닝 ${view.burningSecondsLeft}초` : `${streak}/3`}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${css.hud} ${css.rail}`}>
      <div className={css.railTop}>
        <div className={css.gateBlock}>
          <div className={css.gateMeta}>
            <span className={css.gateTitle}><GateShieldIcon size={15} /> 성문 내구도</span>
            <span className={css.waveInline}>
              웨이브 <strong>{waveNo}</strong>
              {view.milestoneWave && <span className={css.milestone}>고비</span>}
            </span>
          </div>
          <div
            className={css.gate}
            role="meter"
            aria-label="성문"
            aria-valuemin={0}
            aria-valuemax={view.gateMaxHp}
            aria-valuenow={view.gateHp}
          >
            <span className={css.track}>
              <span className={css.fill} data-low={ratio <= 0.34} style={{ width: `${Math.round(ratio * 100)}%` }} />
            </span>
            <span className={css.value}>{view.gateHp}/{view.gateMaxHp}</span>
          </div>
        </div>
        <button type="button" className={css.pause} onClick={onPause} aria-label="일시정지">
          <PauseBarsIcon size={18} />
        </button>
      </div>

      <div className={css.vaultGrid}>
        <div className={css.vault} aria-label={`골드 ${view.gold}`}>
          <div className={css.vaultTop}>
            <span className={css.vaultLabel}>보유 골드</span>
            {recentDelta && recentDelta.gold !== 0 && (
              <span className={css.deltaBadge} data-neg={recentDelta.gold < 0}>
                {recentDelta.gold > 0 ? `+${recentDelta.gold}` : recentDelta.gold}
              </span>
            )}
          </div>
          <div className={css.vaultMain}>
            <GoldCoinIcon size={18} />
            <strong className={css.goldValue}>{fmtNumber(view.gold)}</strong>
          </div>
          <span className={css.vaultSub}>설치 · 강화 재화</span>
        </div>

        <div className={css.vault}>
          <div className={css.vaultTop}>
            <span className={css.vaultLabel}>점수</span>
            {recentDelta && recentDelta.pt !== 0 && (
              <span className={css.deltaPtBadge} data-neg={recentDelta.pt < 0}>
                {recentDelta.pt > 0 ? `+${recentDelta.pt}` : recentDelta.pt}
              </span>
            )}
          </div>
          <div className={css.vaultMain}>
            <ScoreCrestIcon size={18} />
            <strong className={css.ptValue}>{fmtNumber(view.pt)}</strong>
            <span className={css.unit}>점</span>
          </div>
          <span className={css.vaultSub}>문제 {fmtNumber(view.stats.ptFromQuestions)} · 처치 {fmtNumber(view.stats.ptFromKills)}</span>
        </div>
      </div>

      <div className={css.streakBar} data-burning={burning}>
        <span className={css.gems}>
          {[0, 1, 2].map(i => (
            <BurningGemIcon key={i} active={burning || i < streak} size={14} />
          ))}
        </span>
        <span className={css.streakText}>
          {burning
            ? `버닝 ${view.burningSecondsLeft}초 · 공격 속도 +25%`
            : `연속 정답 ${streak}/3 · 버닝 시 속도 +25%`}
        </span>
      </div>
    </div>
  );
}

export const Coin = GoldCoinIcon;

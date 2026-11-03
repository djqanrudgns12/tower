import { useState } from 'react';
import type { Balance } from '../../contracts/balance';
import type { GameView } from '../../application/view';
import { fmtNumber } from '../copy';
import { BurningGemIcon, GateShieldIcon, GoldCoinIcon, PauseBarsIcon, ScoreCrestIcon, WaveFlagIcon } from '../icons/GameIcons';
import css from './Hud.module.css';
import { RollingNumber } from './RollingNumber';

export interface RecentDelta {
  gold: number;
  pt: number;
}

interface Props {
  view: GameView;
  burning: Balance['burning'];
  mode: 'R' | 'S';
  compactRail?: boolean;
  recentDelta?: RecentDelta | null;
  /** 골드 칸(정답 금화가 날아갈 곳)을 화면이 알 수 있게 붙이는 ref. */
  goldRef?: React.Ref<HTMLElement>;
  reducedMotion?: boolean;
  onPause(): void;
}

/** 연속 정답 보석: 조건 수(balance.burning.streak)마다 한 바퀴 돌고, 버닝 중에는 가득 찬다(PRD §5). */
export function streakGems(view: Pick<GameView, 'burningSecondsLeft' | 'battleStreak'>, rule: Pick<Balance['burning'], 'streak'>) {
  const burning = view.burningSecondsLeft > 0;
  return { burning, lit: burning ? rule.streak : view.battleStreak % rule.streak };
}

/**
 * 상단 상태 바(ui-rules-v2 §1, 41번 원화): 호두나무 판 한 장에 성문 막대, 골드·점수·웨이브, 연속 정답 보석, 일시정지.
 * 아이콘+숫자만 보인다. 자세한 뜻은 화면 읽기 이름과 길게 누르기(제목)로 읽힌다.
 */
export function Hud({ view, burning: rule, mode, compactRail = false, recentDelta = null, goldRef, reducedMotion = false, onPause }: Props) {
  const ratio = view.gateMaxHp ? view.gateHp / view.gateMaxHp : 0;
  const waveNo = Math.max(1, view.wave);
  const { burning, lit } = streakGems(view, rule);
  const speed = `공격 속도 +${rule.attackSpeedBP / 100}%`;
  // 성문 피해: 막대 테두리가 한 번 붉게 깜빡인다(ui-rules-v2 §5). 이전 값과 비교해 렌더 중에 센다.
  const [gate, setGate] = useState({ hp: view.gateHp, hits: 0 });
  if (gate.hp !== view.gateHp) setGate({ hp: view.gateHp, hits: view.gateHp < gate.hp ? gate.hits + 1 : gate.hits });

  // 데스크톱 레일(칸이 넉넉한 R 모드)은 연속 정답 보석을 성문 줄로 올린다. 고비 표식까지 붙은 숫자 줄(골드·점수·웨이브)에
  // 보석이 함께 있으면 1440×900에서 줄이 레일보다 길어져 일시정지 단추가 잘린다. 성문 막대는 남는 폭에 맞춰 줄어드니 어느 줄도 넘치지 않는다.
  // 압축 레일(크롬북)·휴대폰 상태 바는 이전 배치를 그대로 쓴다.
  const gemsOnTop = mode === 'R' && !compactRail;
  const gems = (
    <span
      className={css.streak}
      data-burning={burning || undefined}
      role="img"
      aria-label={burning ? `버닝 ${view.burningSecondsLeft}초 남음, ${speed}` : `연속 정답 ${lit}/${rule.streak}, 다 모으면 버닝 ${speed}`}
      title={burning ? `버닝 · ${speed}` : `연속 정답 · 다 모으면 ${speed}`}
    >
      {burning ? (
        <>
          <BurningGemIcon active size={16} />
          <strong className={css.burnNum}>{view.burningSecondsLeft}초</strong>
        </>
      ) : (
        Array.from({ length: rule.streak }, (_, i) => <BurningGemIcon key={i} active={i < lit} size={14} />)
      )}
    </span>
  );

  return (
    <div className={`${css.hud} ${mode === 'S' ? css.bar : css.rail} ${compactRail ? css.compact : ''}`}>
      <div className={css.top}>
        <div
          className={css.gate}
          role="meter"
          aria-label="성문"
          aria-valuemin={0}
          aria-valuemax={view.gateMaxHp}
          aria-valuenow={view.gateHp}
          title="성문"
        >
          <GateShieldIcon size={20} light />
          <span className={css.track}>
            <span className={css.fill} data-low={ratio <= 0.34 || undefined} style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }} />
            {gate.hits > 0 && <span key={gate.hits} className={css.hit} />}
          </span>
          <span className={css.gateNum}>{view.gateHp}<span className={css.of}>/{view.gateMaxHp}</span></span>
        </div>
        {gemsOnTop && gems}
        <button type="button" className={css.pause} onClick={onPause} aria-label="일시정지">
          <PauseBarsIcon size={18} />
        </button>
      </div>
      <div className={css.stats}>
        <span className={css.stat} data-kind="gold" role="img" aria-label={`골드 ${view.gold}`} title="골드">
          <GoldCoinIcon size={18} />
          <RollingNumber ref={goldRef} value={view.gold} className={css.num} reducedMotion={reducedMotion} />
          {recentDelta && recentDelta.gold !== 0 && (
            <span className={css.delta} data-neg={recentDelta.gold < 0 || undefined} aria-hidden="true">
              {recentDelta.gold > 0 ? `+${recentDelta.gold}` : `−${Math.abs(recentDelta.gold)}`}
            </span>
          )}
        </span>
        <span className={css.stat} role="img" aria-label={`점수 ${view.pt}점, 문제 ${view.stats.ptFromQuestions} · 처치 ${view.stats.ptFromKills}`} title={`문제 ${fmtNumber(view.stats.ptFromQuestions)} · 처치 ${fmtNumber(view.stats.ptFromKills)}`}>
          <ScoreCrestIcon size={18} />
          <strong className={css.num}>{fmtNumber(view.pt)}</strong>
          {recentDelta && recentDelta.pt !== 0 && (
            <span className={css.delta} data-neg={recentDelta.pt < 0 || undefined} aria-hidden="true">
              {recentDelta.pt > 0 ? `+${recentDelta.pt}` : `−${Math.abs(recentDelta.pt)}`}
            </span>
          )}
        </span>
        <span className={css.stat} role="img" aria-label={`웨이브 ${waveNo}${view.milestoneWave ? ', 고비 웨이브' : ''}`} title="웨이브">
          <WaveFlagIcon size={18} boss={view.milestoneWave} light />
          <strong className={css.num}>{waveNo}</strong>
          {view.milestoneWave && <span className={css.milestone}>고비</span>}
        </span>
        {!gemsOnTop && gems}
      </div>
    </div>
  );
}

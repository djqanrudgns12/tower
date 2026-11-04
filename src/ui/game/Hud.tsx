import { useState, type Ref } from 'react';
import type { Balance } from '../../contracts/balance';
import type { GameView } from '../../application/view';
import { bestLine, fmtNumber } from '../copy';
import { PauseIcon } from '../icons/ControlIcons';
import { ArtIcon, Card, IconButton } from '../kit';
import css from './Hud.module.css';
import { RelicStrip } from './RelicStrip';
import { RollingNumber } from './RollingNumber';

interface Props {
  view: GameView;
  burning: Balance['burning'];
  mode: 'R' | 'S';
  compactRail?: boolean;
  /** 골드 칸(정답 금화가 날아갈 곳)을 화면이 알 수 있게 붙이는 ref. */
  goldRef?: Ref<HTMLElement>;
  reducedMotion?: boolean;
  /** 이 기기의 같은 학년·난이도 최고 기록(그 판 전까지, 판 안에서 바뀌지 않는다). 없으면 null·생략. */
  bestWave?: number | null;
  /** 원정 보물 이름·규칙을 읽을 밸런스(prd-r4 §7.2-F). 없으면 보물 칸을 그리지 않는다. 휴대폰 한 줄에는 자리가 없어 상황 카드가 보인다. */
  relicInfo?: Balance;
  /** 보물 아이콘(타워 초상화)용 전장 텍스처 그림. */
  icons?: Record<string, string>;
  onPause(): void;
}


/** 연속 정답 불꽃 칸: 조건 수(balance.burning.streak)마다 한 바퀴 돌고, 불꽃(버닝) 중에는 가득 찬다(PRD §5). */
export function streakGems(view: Pick<GameView, 'burningSecondsLeft' | 'battleStreak'>, rule: Pick<Balance['burning'], 'streak'>) {
  const burning = view.burningSecondsLeft > 0;
  return { burning, lit: burning ? rule.streak : view.battleStreak % rule.streak };
}

/**
 * 상태 카드(R4 PRD §9.1): 성문 막대, 골드(가장 큰 숫자), 웨이브, 점수, 불꽃 3칸, 일시정지.
 * 아이콘+숫자만 보인다. 뜻은 화면 읽기 이름과 호버 안내(title)로 읽힌다. 골드 변화는 날아오는 금화와 숫자 굴림으로만 보인다.
 * - R(넓은 레일): 세 줄 — 성문·일시정지 / 골드·불꽃 / 웨이브·점수.
 * - R 압축(낮은 화면): 두 줄 — 성문·일시정지 / 골드·웨이브·점수·불꽃.
 * - S(휴대폰): 한 줄 — 성문·골드·웨이브·불꽃·일시정지(점수는 결과에서 본다).
 */
export function Hud({ view, burning: rule, mode, compactRail = false, goldRef, reducedMotion = false, bestWave = null, relicInfo, icons = {}, onPause }: Props) {
  const ratio = view.gateMaxHp ? view.gateHp / view.gateMaxHp : 0;
  const waveNo = Math.max(1, view.wave);
  const { burning, lit } = streakGems(view, rule);
  const speed = `공격 속도 +${rule.attackSpeedBP / 100}%`;
  // 성문 피해: 막대가 한 번 붉게 깜빡인다. 이전 값과 비교해 렌더 중에 센다.
  const [gate, setGate] = useState({ hp: view.gateHp, hits: 0 });
  if (gate.hp !== view.gateHp) setGate({ hp: view.gateHp, hits: view.gateHp < gate.hp ? gate.hits + 1 : gate.hits });
  const phone = mode === 'S';
  const big = !phone && !compactRail;

  const gateMeter = (
    <div className={css.gate} role="meter" aria-label="성문" aria-valuemin={0} aria-valuemax={view.gateMaxHp} aria-valuenow={view.gateHp} title="성문">
      <ArtIcon name="gate" size={phone ? 20 : 24} />
      <span className={css.track}>
        <span className={css.fill} data-low={ratio <= 0.34 || undefined} style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }} />
        {gate.hits > 0 && <span key={gate.hits} className={css.hit} />}
      </span>
      <span className={css.gateNum}>{view.gateHp}<span className={css.of}>/{view.gateMaxHp}</span></span>
    </div>
  );
  const pause = <IconButton label="일시정지" icon={<PauseIcon />} variant="secondary" className={css.pause} onClick={onPause} />;
  const gold = (
    <span className={css.gold} role="img" aria-label={`골드 ${view.gold}`} title="골드">
      <ArtIcon name="coin" size={big ? 28 : 22} />
      <RollingNumber ref={goldRef} value={view.gold} className={big ? css.goldBig : css.goldNum} reducedMotion={reducedMotion} />
    </span>
  );
  // 웨이브 옆 최고 기록 한 줄(prd-r4 §7.2-F): 평소 "최고 18", 가까우면 "최고 기록까지 2", 넘으면 "새 기록!".
  const best = bestLine(bestWave, waveNo, view.completedWave, phone || !big);
  const wave = (
    <span className={css.waveCell}>
      <span className={css.stat} data-boss={view.milestoneWave || undefined} role="img" aria-label={`웨이브 ${waveNo}${view.milestoneWave ? ', 대장 웨이브' : ''}`} title="웨이브">
        <ArtIcon name="wave" size={phone ? 18 : 22} />
        <strong>{waveNo}</strong>
      </span>
      {best && <span className={css.best} data-kind={best.kind} data-calm={reducedMotion || undefined}>{best.text}</span>}
    </span>
  );
  const score = (
    <span
      className={`${css.stat} ${css.score}`}
      role="img"
      aria-label={`점수 ${view.pt}점, 문제 ${view.stats.ptFromQuestions} · 처치 ${view.stats.ptFromKills}`}
      title={`점수 · 문제 ${fmtNumber(view.stats.ptFromQuestions)} · 처치 ${fmtNumber(view.stats.ptFromKills)}`}
    >
      <ArtIcon name="star" size={18} />
      <span>{fmtNumber(view.pt)}</span>
    </span>
  );
  const flames = (
    <span
      className={css.flames}
      data-burning={burning || undefined}
      role="img"
      aria-label={burning ? `불꽃 ${view.burningSecondsLeft}초 남음, ${speed}` : `연속 정답 ${lit}/${rule.streak}, 다 모으면 불꽃 ${speed}`}
      title={burning ? `불꽃 · ${speed}` : `연속 정답 · 다 모으면 불꽃(${speed})`}
    >
      {Array.from({ length: rule.streak }, (_, i) => (
        <ArtIcon key={i} name="flame" size={phone ? 16 : 20} className={(i < lit ? css.lit : css.unlit) ?? ''} />
      ))}
      {burning && <span className={css.burnNum}>{view.burningSecondsLeft}초</span>}
    </span>
  );

  // 원정 보물(prd-r4 §7.2-F): 넓은 레일은 아이콘을 하나씩, 압축 레일은 보물 상자 + 개수 하나. 휴대폰 한 줄은 자리가 없어 그리지 않는다.
  const relics = relicInfo && !phone ? <RelicStrip balance={relicInfo} relics={view.relics} icons={icons} variant={big ? 'icons' : 'count'} /> : null;

  if (phone) {
    return (
      <Card className={`${css.hud} ${css.bar}`}>
        {gateMeter}
        {gold}
        {wave}
        {flames}
        {pause}
      </Card>
    );
  }
  return (
    <Card className={`${css.hud} ${big ? css.rail : css.compact}`}>
      <div className={css.row}>
        {gateMeter}
        {pause}
      </div>
      {big ? (
        <>
          <div className={css.row}>
            {gold}
            {flames}
          </div>
          <div className={css.row}>
            {wave}
            {relics}
            {score}
          </div>
        </>
      ) : (
        <div className={css.row}>
          {gold}
          {wave}
          {relics}
          {score}
          {flames}
        </div>
      )}
    </Card>
  );
}

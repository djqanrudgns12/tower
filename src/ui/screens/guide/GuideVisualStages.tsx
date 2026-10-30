import { useEffect, useMemo, useState } from 'react';
import type { MotionMode } from '../../../application/session';
import type { DifficultyId, TowerId } from '../../../contracts/balance';
import {
  BranchMarkIcon,
  BurningGemIcon,
  CheckSealIcon,
  CrossSealIcon,
  GateShieldIcon,
  GoldCoinIcon,
  PauseBarsIcon,
  PlayArrowIcon,
  ScoreCrestIcon,
  TowerShieldPortrait,
} from '../../icons/GameIcons';
import css from '../GuideScreen.module.css';
import { useLobbySprites } from '../home/canvasAssets';
import {
  buildDifficultyGuideItems,
  buildQuizOutcomeSpecs,
  buildTowerGuideItems,
  GUIDE_WAVE_BEATS,
  sampleGuideWaveLoop,
  type GuideChapterSpec,
  type GuideRowIconId,
  type GuideWaveBeatId,
  type QuizOutcomeId,
} from './guideModel';
import { GuideStageCanvas } from './GuideStageCanvas';

function RangeTargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" fill="#efe0c2" stroke="#362419" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="3.6" fill="#235885" stroke="#362419" strokeWidth="1.3" />
      <circle cx="10" cy="10" r="1.4" fill="#fbf3e4" />
    </svg>
  );
}

function KeycapMiniIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3.5" width="14" height="13" rx="2.5" fill="#6b4225" stroke="#362419" strokeWidth="1.6" />
      <rect x="5.2" y="5.5" width="9.6" height="8.2" rx="1.5" fill="#9a6a42" />
      <circle cx="8" cy="9.6" r="1.1" fill="#fbf3e4" />
      <circle cx="12" cy="9.6" r="1.1" fill="#fbf3e4" />
    </svg>
  );
}

export function GuideRowIcon({ icon }: { icon: GuideRowIconId }) {
  switch (icon) {
    case 'gold':
      return <GoldCoinIcon size={18} />;
    case 'play':
      return <PlayArrowIcon size={16} />;
    case 'gate':
      return <GateShieldIcon size={17} />;
    case 'score':
      return <ScoreCrestIcon size={18} />;
    case 'seal':
      return <CheckSealIcon size={18} />;
    case 'burning':
      return <BurningGemIcon active size={16} />;
    case 'range':
      return <RangeTargetIcon />;
    case 'branch':
      return <BranchMarkIcon id="A" size={18} />;
    case 'key':
      return <KeycapMiniIcon />;
    case 'pause':
      return <PauseBarsIcon size={16} />;
  }
}

interface VisualStageProps {
  chapter: GuideChapterSpec;
  motionMode: MotionMode;
  highContrastMap: boolean;
}

function Chapter1WaveStage({ motionMode, highContrastMap }: { motionMode: MotionMode; highContrastMap: boolean }) {
  const [pinnedBeat, setPinnedBeat] = useState<GuideWaveBeatId | null>(null);
  const [autoBeat, setAutoBeat] = useState<GuideWaveBeatId>(2);
  const animate = motionMode === 'full';

  useEffect(() => {
    if (!animate || pinnedBeat !== null) return undefined;
    const sync = () => {
      const snap = sampleGuideWaveLoop(320, 100, performance.now(), true, null);
      setAutoBeat(snap.beat);
    };
    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, [animate, pinnedBeat]);

  const effectiveBeat: GuideWaveBeatId = pinnedBeat ?? (animate ? autoBeat : 2);
  const readout = sampleGuideWaveLoop(320, 100, 1250, false, effectiveBeat);

  return (
    <div className={css.interactivePane}>
      <div className={css.canvasBox} role="img" aria-label="4단계 수비 순환 실시간 시연">
        <GuideStageCanvas
          mode="wave_loop"
          motionMode={motionMode}
          highContrastMap={highContrastMap}
          pinnedBeat={pinnedBeat}
          className={css.stageCanvas}
        />
        <span className={css.canvasBadgeLeft}>{readout.statusTag}</span>
        <span className={css.canvasBadgeRight}>{readout.goldTag}</span>
      </div>
      <div className={css.stageSwitchRow} role="group" aria-label="한 판 진행 단계 시연 선택">
        {GUIDE_WAVE_BEATS.map(b => {
          const active = effectiveBeat === b.id;
          return (
            <button
              key={b.id}
              type="button"
              className={css.stageSwitchBtn}
              aria-pressed={active}
              onClick={() => setPinnedBeat(prev => (prev === b.id ? null : b.id))}
            >
              {b.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chapter2QuizStage({ motionMode }: { motionMode: MotionMode }) {
  const outcomes = useMemo(() => buildQuizOutcomeSpecs(), []);
  const [selectedId, setSelectedId] = useState<QuizOutcomeId | null>(null);
  const [autoIdx, setAutoIdx] = useState(0);
  const animate = motionMode === 'full';

  useEffect(() => {
    if (!animate || selectedId !== null) return undefined;
    const timer = window.setInterval(() => {
      setAutoIdx(i => (i + 1) % outcomes.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [animate, selectedId, outcomes.length]);

  const activeOutcome =
    (selectedId ? outcomes.find(o => o.id === selectedId) : outcomes[animate ? autoIdx : 3]) ?? outcomes[0]!;

  return (
    <div className={css.interactivePane}>
      <div className={css.stageSwitchRow} role="group" aria-label="문제 결과별 보상 시연">
        {outcomes.map(o => (
          <button
            key={o.id}
            type="button"
            className={css.stageSwitchBtn}
            aria-pressed={activeOutcome.id === o.id}
            onClick={() => setSelectedId(o.id)}
          >
            {o.tabLabel}
          </button>
        ))}
      </div>
      <div className={css.hudSimulator} data-burning={activeOutcome.id === 'burning'}>
        <div className={css.hudMetricStrip}>
          <span className={css.hudMetricItem}>
            <GoldCoinIcon size={16} />
            {activeOutcome.goldDeltaText}
          </span>
          <span className={css.hudMetricItem}>
            {activeOutcome.id === 'wrong' ? <CrossSealIcon size={16} /> : <ScoreCrestIcon size={16} />}
            {activeOutcome.scoreDeltaText}
          </span>
          <span className={css.hudGemsGroup} aria-label={`버닝 보석 ${activeOutcome.burningLitCount}개 점등`}>
            <BurningGemIcon active={activeOutcome.burningLitCount >= 1} size={13} />
            <BurningGemIcon active={activeOutcome.burningLitCount >= 2} size={13} />
            <BurningGemIcon active={activeOutcome.burningLitCount >= 3} size={13} />
            <span>{activeOutcome.gateNote}</span>
          </span>
        </div>
        <p className={css.hudOutcomeNote}>{activeOutcome.summary}</p>
      </div>
    </div>
  );
}

function Chapter3TowerStage({ motionMode, highContrastMap }: { motionMode: MotionMode; highContrastMap: boolean }) {
  const towers = useMemo(() => buildTowerGuideItems(), []);
  const sprites = useLobbySprites();
  const [selectedTowerId, setSelectedTowerId] = useState<TowerId>(() => towers[0]?.id ?? 'archer');

  const iconUrls = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const [key, val] of sprites) {
      rec[key] = val.url;
    }
    return rec;
  }, [sprites]);

  const activeTower = towers.find(t => t.id === selectedTowerId) ?? towers[0]!;

  return (
    <div className={css.interactivePane}>
      <div className={css.stageSwitchRowThree} role="group" aria-label="기본 수호 타워 사거리와 진화 비교">
        {towers.map(t => (
          <button
            key={t.id}
            type="button"
            className={css.stageSwitchBtn}
            aria-pressed={activeTower.id === t.id}
            onClick={() => setSelectedTowerId(t.id)}
          >
            <TowerShieldPortrait type={t.id} icons={iconUrls} size={18} />
            {t.label}
          </button>
        ))}
      </div>
      <div className={css.towerStageGrid}>
        <div className={css.rangeMiniBox} role="img" aria-label={`${activeTower.label} 밝은 흙길 사거리 시연`}>
          <GuideStageCanvas
            mode="range_demo"
            motionMode={motionMode}
            highContrastMap={highContrastMap}
            towerId={activeTower.id}
            rangeMilli={activeTower.rangeMilli}
            className={css.stageCanvas}
          />
          <span className={css.canvasBadgeLeft}>{`${activeTower.label} · ${activeTower.costGold}골드`}</span>
          <span className={css.canvasBadgeRight}>{`사거리 ${activeTower.rangeCellsText}`}</span>
        </div>
        <div className={css.branchPairStack}>
          <div className={css.branchRow}>
            <BranchMarkIcon id="A" size={18} />
            <div className={css.branchTexts}>
              <span className={css.branchTitle}>{activeTower.branchATitle}</span>
              <span className={css.branchDesc}>{activeTower.branchASummary}</span>
            </div>
          </div>
          <div className={css.branchRow}>
            <BranchMarkIcon id="B" size={18} />
            <div className={css.branchTexts}>
              <span className={css.branchTitle}>{activeTower.branchBTitle}</span>
              <span className={css.branchDesc}>{activeTower.branchBSummary}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chapter4CommandStage() {
  const diffs = useMemo(() => buildDifficultyGuideItems(), []);
  const [selectedDiff, setSelectedDiff] = useState<DifficultyId>('Hard');
  const [pressedKey, setPressedKey] = useState<'1' | '2' | '3' | '4'>('1');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        setPressedKey(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentDiff = diffs.find(d => d.id === selectedDiff) ?? diffs[2]!;

  return (
    <div className={css.interactivePane}>
      <div className={css.commandStageStack}>
        <div className={css.stageSwitchRow} role="group" aria-label="난이도별 성문 체력과 출제 범위 비교">
          {diffs.map(d => (
            <button
              key={d.id}
              type="button"
              className={css.stageSwitchBtn}
              aria-pressed={currentDiff.id === d.id}
              onClick={() => setSelectedDiff(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className={css.diffReadoutBar}>
          <span>{`성문 ${currentDiff.gateHp} · 정답 +${currentDiff.correctGold}골드`}</span>
          <span className={css.diffScopeTag} data-advanced={currentDiff.includesProverbDialect}>
            {currentDiff.vocabScope}
          </span>
        </div>
        <div className={css.keycapBar} aria-label="빠른 조작 키 안내">
          <div className={css.keycapCluster}>
            {(['1', '2', '3', '4'] as const).map(k => (
              <button
                key={k}
                type="button"
                className={css.woodKey}
                data-active={pressedKey === k}
                onClick={() => setPressedKey(k)}
              >
                {k}
                <span className="sr-only">번 보기 단축키</span>
              </button>
            ))}
            <span className={css.keycapHint}>{`보기 ${pressedKey}번 즉시 선택`}</span>
          </div>
          <span className={css.keycapHint}>정지 시 문제 가림</span>
        </div>
      </div>
    </div>
  );
}

export function GuideVisualStage({ chapter, motionMode, highContrastMap }: VisualStageProps) {
  return (
    <div className={css.visualStage}>
      <div className={css.artFrame}>
        <img src={chapter.illustrationUrl} alt={chapter.illustrationAlt} className={css.artImg} />
      </div>
      {chapter.id === 1 && <Chapter1WaveStage motionMode={motionMode} highContrastMap={highContrastMap} />}
      {chapter.id === 2 && <Chapter2QuizStage motionMode={motionMode} />}
      {chapter.id === 3 && <Chapter3TowerStage motionMode={motionMode} highContrastMap={highContrastMap} />}
      {chapter.id === 4 && <Chapter4CommandStage />}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import type { RankingPeriod, RankingTabId } from '../../contracts/lobby';
import type { Settings } from '../../application/session';
import { GuideScreen } from './GuideScreen';
import { useLobbySprites } from './home/canvasAssets';
import { BookIcon, GearIcon, RecordIcon } from './home/HomeIcons';
import { LaunchDeck } from './home/LaunchDeck';
import { MiniStageCanvas } from './home/MiniStageCanvas';
import { RankingBoard } from './home/RankingBoard';
import { RankingModal } from './home/RankingModal';
import { SteleStudyPanel } from './home/SteleStudyPanel';
import { TelemetryStrip } from './home/TelemetryStrip';
import { WorldBackdropCanvas } from './home/WorldBackdropCanvas';
import css from './home/home.module.css';
import { NewGameScreen } from './NewGameScreen';
import { SettingsModal } from './SettingsModal';

type ModalState =
  | null
  | 'new'
  | 'settings'
  | 'guide'
  | {
      kind: 'ranking';
      tab: RankingTabId;
      grade: 3 | 4 | 5 | 6 | 'all';
      difficulty: DifficultyId;
      period: RankingPeriod;
    };

interface Props {
  message: string | null;
  settings: Settings;
  initialModal?: 'new' | null;
  focusNicknameOnMount?: boolean;
  onClearMessage(): void;
  onStartNew(input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }): void;
  onSettings(patch: Partial<Settings>): void;
}

/**
 * 첫 화면(방향 2-A: 왕국 참나무 작전실).
 * 주 행동은 ‘새 게임’으로 단일화하고,
 * 별명 설정·오늘의 낱말 공부·통합 수호 랭킹·환경설정을 한 화면에서 제공한다.
 */
export function HomeScreen({
  message,
  settings,
  initialModal = null,
  focusNicknameOnMount = false,
  onClearMessage,
  onStartNew,
  onSettings,
}: Props) {
  const [activeModal, setActiveModal] = useState<ModalState>(initialModal);
  const [rankingTab, setRankingTab] = useState<RankingTabId>('single_score');
  const [refreshTick, setRefreshTick] = useState(0);
  const nickInputRef = useRef<HTMLInputElement>(null);
  const rankingBoardRef = useRef<HTMLElement>(null);
  const sprites = useLobbySprites();

  useEffect(() => {
    if (focusNicknameOnMount) {
      nickInputRef.current?.focus();
    }
  }, [focusNicknameOnMount]);

  const gateSprite = sprites.get('map.gate');
  const defaultDiff: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty)
    ? (settings.lastDifficulty as DifficultyId)
    : 'Normal';

  const handleMyRecordsShortcut = () => {
    setRankingTab('local_device');
    if (typeof window !== 'undefined' && window.innerWidth <= 959) {
      rankingBoardRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  return (
    <div className={css.lobbyRoot}>
      <WorldBackdropCanvas motionMode={settings.motionMode} className={css.backdropCanvas} />

      <div className={css.foreground} inert={activeModal !== null}>
        <header className={css.plaqueOuter}>
          <div className={css.plaqueInner}>
            <div className={css.brandGroup}>
              <div className={css.crestBox} aria-hidden="true">
                {gateSprite && <img src={gateSprite.url} alt="" className={css.crestImg} />}
              </div>
              <div>
                <h1 className={css.brandTitle}>어휘력 타워 디펜스</h1>
                <p className={css.brandSub}>왕국 학술원 수호 작전실 · 낱말의 힘으로 성문을 지켜요</p>
              </div>
            </div>

            <TelemetryStrip playerId={settings.playerId} refreshTick={refreshTick} />

            <div className={css.headerActions}>
              <button
                id="guideBtn"
                type="button"
                className={css.plaqueBtn}
                onClick={() => setActiveModal('guide')}
              >
                <BookIcon />
                사용 설명서
              </button>
              <button
                id="recordsBtn"
                type="button"
                className={css.plaqueBtn}
                onClick={handleMyRecordsShortcut}
              >
                <RecordIcon />
                내 기록
              </button>
              <button
                id="settingsBtn"
                type="button"
                className={css.plaqueBtn}
                onClick={() => setActiveModal('settings')}
              >
                <GearIcon />
                설정
              </button>
            </div>
          </div>
        </header>

        <main className={css.warRoomGrid}>
          <div className={css.oakFrame}>
            <div className={css.parchmentInner}>
              <div className={css.stageViewport} role="img" aria-label="왕국 성문 수비 전장 미리보기">
                <MiniStageCanvas
                  motionMode={settings.motionMode}
                  highContrastMap={settings.highContrastMap}
                  paused={activeModal !== null}
                  className={css.stageCanvas}
                />
                <span className={css.stageBadgeLeft}>왕국 초원 · 성문 수비전</span>
                <span className={css.stageBadgeRight}>고비 5웨이브 시연</span>
              </div>

              <SteleStudyPanel preferredGrade={settings.lastGrade} />

              <LaunchDeck
                savedNickname={settings.lastNickname}
                message={message}
                inputRef={nickInputRef}
                onCommitNickname={nick => onSettings({ lastNickname: nick })}
                onOpenNewGame={nick => {
                  onSettings({ lastNickname: nick });
                  onClearMessage();
                  setActiveModal('new');
                }}
              />
            </div>
          </div>

          <RankingBoard
            tab={rankingTab}
            onTabChange={setRankingTab}
            playerId={settings.playerId}
            currentNickname={settings.lastNickname}
            defaultGrade={settings.lastGrade}
            defaultDifficulty={defaultDiff}
            refreshTick={refreshTick}
            boardRef={rankingBoardRef}
            onOpenDetailModal={initial => setActiveModal({ kind: 'ranking', ...initial })}
          />
        </main>
      </div>

      {activeModal === 'new' && (
        <NewGameScreen
          settings={settings}
          onBack={() => setActiveModal(null)}
          onEditNickname={() => {
            setActiveModal(null);
            requestAnimationFrame(() => nickInputRef.current?.focus());
          }}
          onStart={input => {
            setActiveModal(null);
            onStartNew(input);
          }}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdate={onSettings}
          onHistoryCleared={() => setRefreshTick(t => t + 1)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'guide' && (
        <GuideScreen
          motionMode={settings.motionMode}
          highContrastMap={settings.highContrastMap}
          onBack={() => {
            setActiveModal(null);
            requestAnimationFrame(() => document.getElementById('guideBtn')?.focus());
          }}
        />
      )}

      {typeof activeModal === 'object' && activeModal !== null && activeModal.kind === 'ranking' && (
        <RankingModal
          initialTab={activeModal.tab}
          initialGrade={activeModal.grade}
          initialDifficulty={activeModal.difficulty}
          initialPeriod={activeModal.period}
          playerId={settings.playerId}
          currentNickname={settings.lastNickname}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}

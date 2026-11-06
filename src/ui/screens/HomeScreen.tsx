import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import type { RankingPeriod, RankingTabId } from '../../contracts/lobby';
import type { Settings } from '../../application/session';
import { GuideScreen } from './GuideScreen';
import { useLobbySprites } from './home/canvasAssets';
import { GearIcon, HomeUiArt } from './home/HomeIcons';
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
  /** 오답 노트 화면을 여는 동작. 주지 않으면 오답 노트 버튼을 숨긴다. */
  onOpenNote?(): void;
  /** 오답 노트 버튼에 붙는 낱말 개수. */
  noteCount?: number;
  /** 설정에서 이 기기 기록을 지웠을 때(오답 노트 개수처럼 홈 밖에서 계산한 값을 다시 읽게 한다). */
  onHistoryCleared?(): void;
  onClearMessage(): void;
  onStartNew(input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }, signal: AbortSignal): Promise<void>;
  onPractice?(): void;
  onSettings(patch: Partial<Settings>): void;
}

/**
 * 첫 화면(R6 참나무·양피지 공예 랜딩). 처음 온 학생에게는 연습을 권한다(PRD §12.2).
 * 닉네임·학교 설정, 오늘의 낱말, 통합 랭킹, 오답 노트, 환경설정을 한 화면에서 제공한다.
 */
export function HomeScreen({
  message,
  settings,
  initialModal = null,
  focusNicknameOnMount = false,
  onOpenNote,
  noteCount = 0,
  onHistoryCleared,
  onClearMessage,
  onStartNew,
  onPractice,
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

  // 새 게임 창의 '닉네임 바꾸기': 창을 닫은 뒤 닉네임 입력칸으로 포커스를 옮긴다.
  const focusNickAfterClose = useRef(false);
  useEffect(() => {
    if (activeModal === null && focusNickAfterClose.current) {
      focusNickAfterClose.current = false;
      nickInputRef.current?.focus();
    }
  }, [activeModal]);

  const gateSprite = sprites.get('map.gate');
  const defaultDiff: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty)
    ? (settings.lastDifficulty as DifficultyId)
    : 'Normal';

  const handleMyRecordsShortcut = () => {
    setRankingTab('local_device');
    if (typeof window !== 'undefined' && window.innerWidth <= 959) {
      rankingBoardRef.current?.scrollIntoView({
        behavior: settings.reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <div className={css.lobbyRoot}>
      <WorldBackdropCanvas motionMode={settings.motionMode} className={css.backdropCanvas} />

      <div className={css.foreground} inert={activeModal !== null}>
        <header className={css.headerPlaque}>
          <div className={css.brandGroup}>
            <div className={css.crestBox} aria-hidden="true">
              {gateSprite ? (
                <img src={gateSprite.url} alt="" draggable={false} className={css.crestImg} />
              ) : (
                <HomeUiArt file="icon.gate.webp" className={css.crestImg} />
              )}
            </div>
            <div className={css.brandText}>
              <h1 className={css.brandTitle}>어휘력 타워 디펜스</h1>
              <p className={css.brandSub}>낱말 문제를 풀고 타워로 성문을 지켜요</p>
            </div>
          </div>

          <TelemetryStrip playerId={settings.playerId} refreshTick={refreshTick} />

          <div className={css.headerActions}>
            <button
              id="guideBtn"
              type="button"
              className={css.plaqueKeyBtn}
              onClick={() => setActiveModal('guide')}
            >
              <HomeUiArt file="relic.wise_book.webp" className={css.btnIconArt} />
              사용 설명서
            </button>
            <button
              id="recordsBtn"
              type="button"
              className={css.plaqueKeyBtn}
              onClick={handleMyRecordsShortcut}
            >
              <HomeUiArt file="icon.star.webp" className={css.btnIconArt} />
              내 기록
            </button>
            {onOpenNote && (
              <button
                id="noteBtn"
                type="button"
                className={css.plaqueKeyBtn}
                aria-label={noteCount > 0 ? `오답 노트 ${noteCount}개` : undefined}
                onClick={onOpenNote}
              >
                <HomeUiArt file="icon.note.webp" className={css.btnIconArt} />
                오답 노트
                {noteCount > 0 && (
                  <span className={css.plaqueCount} aria-hidden="true">
                    {noteCount > 99 ? '99+' : noteCount}
                  </span>
                )}
              </button>
            )}
            <button
              id="settingsBtn"
              type="button"
              className={css.plaqueKeyBtn}
              onClick={() => setActiveModal('settings')}
            >
              <GearIcon className={css.btnIconSvg} />
              설정
            </button>
          </div>
        </header>

        <main className={css.warRoomGrid}>
          <div className={css.woodBoard}>
            <div className={css.stageViewport} role="img" aria-label="전장 미리보기">
              <MiniStageCanvas
                motionMode={settings.motionMode}
                highContrastMap={settings.highContrastMap}
                paused={activeModal !== null}
                className={css.stageCanvas}
              />
              <div className={css.stageOverlayTop}>
                <span className={css.stageBadgeLeft}>
                  <span className={css.stageLiveDot} aria-hidden="true" />
                  정원 미리보기
                </span>
                <span className={css.stageBadgeRight}>
                  <HomeUiArt file="icon.flame.webp" className={css.stageBossIcon} />
                  5웨이브 보스
                </span>
              </div>
            </div>

            <SteleStudyPanel preferredGrade={settings.lastGrade} />

            <LaunchDeck
              savedNickname={settings.lastNickname}
              savedSchoolName={settings.lastSchoolName}
              savedSchoolCode={settings.lastSchoolCode}
              message={message}
              practiceLabel={settings.practiceSeen ? '연습하기' : '처음이라면 연습부터'}
              onPractice={() => {
                onClearMessage();
                onPractice?.();
              }}
              inputRef={nickInputRef}
              onCommitNickname={nick => onSettings({ lastNickname: nick })}
              onCommitSchool={(name, code) => onSettings({ lastSchoolName: name, lastSchoolCode: code })}
              onOpenNewGame={nick => {
                onSettings({ lastNickname: nick });
                onClearMessage();
                setActiveModal('new');
              }}
            />
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
            focusNickAfterClose.current = true;
            setActiveModal(null);
          }}
          onStart={onStartNew}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdate={onSettings}
          onHistoryCleared={() => {
            setRefreshTick(t => t + 1);
            onHistoryCleared?.();
          }}
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

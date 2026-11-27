import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import type { HomeRankingTabId, RankingPeriod } from '../../contracts/lobby';
import type { Settings } from '../../application/session';
import { isGradeAvailable } from '../../content';
import { type LocalBalanceVersion } from '../../application/balanceSession';
import { ClassroomQrModal } from './home/ClassroomQrModal';
import { LaunchDeck } from './home/LaunchDeck';
import { RankingBoard } from './home/RankingBoard';
import { RankingModal } from './home/RankingModal';
import { SteleStudyPanel } from './home/SteleStudyPanel';
import css from './home/home.module.css';
import { NewGameScreen } from './NewGameScreen';
import { RecordConsentModal } from './RecordConsentModal';
import { SettingsModal } from './SettingsModal';
import { R6_HOME_CREST, R6_HOME_ICONS } from './r6Map';

const GuideScreen = lazy(() => import('./GuideScreen').then(m => ({ default: m.GuideScreen })));

type Grade = 3 | 4 | 5 | 6;

type ModalState =
  | null
  | 'consent'
  | 'new'
  | 'settings'
  | 'guide'
  | 'qr'
  | {
      kind: 'ranking';
      tab: HomeRankingTabId;
      grade: Grade | 'all';
      difficulty: DifficultyId;
      period: RankingPeriod;
    };

interface Props {
  balanceVersion: LocalBalanceVersion;
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
  onStartNew(input: { grade: Grade; difficulty: DifficultyId; nickname: string }, signal: AbortSignal): Promise<void>;
  onPractice?(): void;
  onSettings(patch: Partial<Settings>): void;
}

/**
 * v3 데이라이트 랜딩 화면:
 * 1) 초슬림 상단 헤더(엠블럼 + 유틸리티 4종)
 * 2) 좌측 플레이 허브(전장 슬롯 + 닉네임/학년/난이도 1-Click 시작) + 오늘의 낱말
 * 3) 우측 3탭 포디움 랭킹(1~100위 스크롤 + 내 순위 점프)
 */
export function HomeScreen({
  balanceVersion,
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
  const [rankingTab, setRankingTab] = useState<HomeRankingTabId>('single_score');
  const [refreshTick, setRefreshTick] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const nickInputRef = useRef<HTMLInputElement>(null);
  const rankingBoardRef = useRef<HTMLElement>(null);
  const startPendingRef = useRef<AbortController | null>(null);
  const consentPendingNickRef = useRef<string | null>(null);

  const selectedGrade: Grade = isGradeAvailable(settings.lastGrade) ? settings.lastGrade : 3;
  const selectedDifficulty: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty)
    ? (settings.lastDifficulty as DifficultyId)
    : 'Normal';

  useEffect(() => () => {
    startPendingRef.current?.abort();
  }, []);

  useEffect(() => {
    if (focusNicknameOnMount) {
      nickInputRef.current?.focus();
    }
  }, [focusNicknameOnMount]);

  const focusNickAfterClose = useRef(false);
  useEffect(() => {
    if (activeModal === null && focusNickAfterClose.current) {
      focusNickAfterClose.current = false;
      nickInputRef.current?.focus();
    }
  }, [activeModal]);

  const executeStart = useCallback(async (confirmedNickname: string) => {
    if (startPendingRef.current) return;
    const ctrl = new AbortController();
    startPendingRef.current = ctrl;
    setStarting(true);
    setStartError(null);
    onClearMessage();
    try {
      await onStartNew(
        {
          grade: selectedGrade,
          difficulty: selectedDifficulty,
          nickname: confirmedNickname,
        },
        ctrl.signal,
      );
    } catch {
      if (!ctrl.signal.aborted) {
        setStartError('시작하지 못했어요. 다시 눌러 주세요.');
      }
    } finally {
      if (!ctrl.signal.aborted) {
        startPendingRef.current = null;
        setStarting(false);
      }
    }
  }, [onClearMessage, onStartNew, selectedDifficulty, selectedGrade]);

  const handleStartPlay = (confirmedNickname: string) => {
    onSettings({ lastNickname: confirmedNickname });
    onClearMessage();
    setStartError(null);
    if (!settings.shareRecordsAsked && !settings.shareRecords) {
      consentPendingNickRef.current = confirmedNickname;
      setActiveModal('consent');
      return;
    }
    void executeStart(confirmedNickname);
  };

  return (
    <div className={css.lobbyRoot}>
      <div className={css.foreground} inert={activeModal !== null}>
        <header className={css.headerBar}>
          <div className={css.brandGroup}>
            <div className={css.crestWrap} aria-hidden="true">
              <img src={R6_HOME_CREST} width={38} height={38} alt="" className={`${css.crestImg} ${css.icon3d}`} />
            </div>
            <div className={css.brandText}>
              <h1 className={css.brandTitle}>어휘력 타워 디펜스</h1>
              <span className={css.seasonTag}>시즌 2</span>
            </div>
          </div>

          <nav className={css.headerActions} aria-label="상단 도구">
            {onOpenNote && (
              <button
                id="noteBtn"
                type="button"
                className={css.navGhostBtn}
                aria-label={noteCount > 0 ? `오답 노트 ${noteCount}개` : '오답 노트'}
                onClick={onOpenNote}
              >
                <span className={css.icon3dWrap} aria-hidden="true">
                  <img src={R6_HOME_ICONS.note} width={22} height={22} alt="" className={`${css.navIconImg} ${css.icon3d}`} />
                </span>
                <span className={css.navLabel}>오답 노트</span>
                {noteCount > 0 && (
                  <span className={css.navCount} aria-hidden="true">
                    {noteCount > 99 ? '99+' : noteCount}
                  </span>
                )}
              </button>
            )}
            <button
              id="guideBtn"
              type="button"
              className={css.navGhostBtn}
              onClick={() => setActiveModal('guide')}
            >
              <span className={css.icon3dWrap} aria-hidden="true">
                <img src={R6_HOME_ICONS.guide} width={22} height={22} alt="" className={`${css.navIconImg} ${css.icon3d}`} />
              </span>
              <span className={css.navLabel}>사용 설명서</span>
            </button>
            <button
              id="openQrModalBtn"
              type="button"
              className={css.navGhostBtn}
              onClick={() => setActiveModal('qr')}
            >
              <span className={css.icon3dWrap} aria-hidden="true">
                <img src={R6_HOME_ICONS.qr} width={22} height={22} alt="" className={`${css.navIconImg} ${css.icon3d}`} />
              </span>
              <span className={css.navLabel}>교실 QR</span>
            </button>
            <button
              id="settingsBtn"
              type="button"
              className={css.navGhostBtn}
              onClick={() => setActiveModal('settings')}
            >
              <span className={css.icon3dWrap} aria-hidden="true">
                <img src={R6_HOME_ICONS.settings} width={22} height={22} alt="" className={`${css.navIconImg} ${css.icon3d}`} />
              </span>
              <span className={css.navLabel}>설정</span>
            </button>
          </nav>
        </header>

        <main className={css.homeGrid}>
          <div className={css.leftColumn}>
            <LaunchDeck
              balanceVersion={balanceVersion}
              savedNickname={settings.lastNickname}
              grade={selectedGrade}
              difficulty={selectedDifficulty}
              starting={starting}
              message={startError ?? message}
              practiceLabel={settings.practiceSeen ? '연습하기' : '처음이라면 연습부터'}
              inputRef={nickInputRef}
              onGradeChange={next => {
                setStartError(null);
                onSettings({ lastGrade: next });
              }}
              onDifficultyChange={next => {
                setStartError(null);
                onSettings({ lastDifficulty: next });
              }}
              onCommitNickname={nick => onSettings({ lastNickname: nick })}
              onStartPlay={handleStartPlay}
              onPractice={() => {
                onClearMessage();
                onPractice?.();
              }}
            />

            <SteleStudyPanel preferredGrade={selectedGrade} />
          </div>

          <RankingBoard
            tab={rankingTab}
            onTabChange={setRankingTab}
            playerId={settings.playerId}
            currentNickname={settings.lastNickname}
            defaultGrade={selectedGrade}
            defaultDifficulty={selectedDifficulty}
            refreshTick={refreshTick}
            reducedMotion={settings.reducedMotion}
            boardRef={rankingBoardRef}
            onOpenDetailModal={initial => setActiveModal({ kind: 'ranking', ...initial })}
          />
        </main>
      </div>

      {activeModal === 'consent' && (
        <RecordConsentModal
          onDecide={shareRecords => {
            onSettings({ shareRecords, shareRecordsAsked: true });
            setActiveModal(null);
            const pendingNick = consentPendingNickRef.current;
            consentPendingNickRef.current = null;
            if (pendingNick) {
              void executeStart(pendingNick);
            }
          }}
          onClose={() => {
            consentPendingNickRef.current = null;
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'new' && (
        <NewGameScreen
          balanceVersion={balanceVersion}
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
        <Suspense fallback={null}>
          <GuideScreen
            balanceVersion={balanceVersion}
            motionMode={settings.motionMode}
            highContrastMap={settings.highContrastMap}
            onBack={() => {
              setActiveModal(null);
              requestAnimationFrame(() => document.getElementById('guideBtn')?.focus());
            }}
          />
        </Suspense>
      )}

      {activeModal === 'qr' && (
        <ClassroomQrModal
          defaultGrade={selectedGrade}
          onClose={() => {
            setActiveModal(null);
            requestAnimationFrame(() => document.getElementById('openQrModalBtn')?.focus());
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

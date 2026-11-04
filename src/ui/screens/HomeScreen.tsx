import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import type { RankingPeriod, RankingTabId } from '../../contracts/lobby';
import type { Settings } from '../../application/session';
import { GuideScreen } from './GuideScreen';
import { useLobbySprites } from './home/canvasAssets';
import { BookIcon, GearIcon, NoteIcon, RecordIcon } from './home/HomeIcons';
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
  onStartNew(input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }): void;
  onPractice?(): void;
  onSettings(patch: Partial<Settings>): void;
}

/**
 * 첫 화면(방향 2-A: 왕국 참나무 작전실). 처음 온 학생에게는 연습을 권한다(PRD §12.2).
 * 별명 설정·오늘의 낱말 공부·통합 수호 랭킹·오답 노트·환경설정을 한 화면에서 제공한다.
 * R4 U1(3426df8)이 타이틀 화면으로 바꿨던 것을 2026-11-04 사용자 결정으로 이 랜딩으로 되돌렸다. 오답 노트 단추만 더했다.
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
              {onOpenNote && (
                <button
                  id="noteBtn"
                  type="button"
                  className={css.plaqueBtn}
                  aria-label={noteCount > 0 ? `오답 노트 ${noteCount}개` : undefined}
                  onClick={onOpenNote}
                >
                  <NoteIcon />
                  오답 노트
                  {noteCount > 0 && <span className={css.plaqueCount}>{noteCount}</span>}
                </button>
              )}
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

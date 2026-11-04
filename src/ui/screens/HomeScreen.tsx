import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import type { Settings } from '../../application/session';
import { cleanNickname, HOME_COPY } from '../copy';
import { Button, Card, IconButton, Modal } from '../kit';
import { EditIcon, GuideIcon, NoteIcon, SettingsIcon } from '../icons/ControlIcons';
import { GuideScreen } from './GuideScreen';
import { MiniStageCanvas } from './home/MiniStageCanvas';
import { ProfileFields, type ProfileFieldsHandle } from './home/ProfileFields';
import { RankingModal } from './home/RankingModal';
import { RankingSummary } from './home/RankingSummary';
import { WordCard } from './home/WordCard';
import css from './home/lobby.module.css';
import { NewGameScreen } from './NewGameScreen';
import { SettingsModal } from './SettingsModal';

type ModalState = null | 'new' | 'settings' | 'guide' | 'ranking' | 'profile';

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
 * 첫 화면 = 게임 타이틀. 큰 미니 전투 무대 위에 로고, 그 아래 시작 버튼이 가장 크다.
 * 오른쪽에는 오늘의 낱말과 랭킹 요약. 닉네임은 칩으로 접혀 있고, 처음 온 학생에게만 입력칸이 펼쳐진다.
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
  const [refreshTick, setRefreshTick] = useState(0);
  // 닉네임이 아직 없는 학생에게는 입력칸을 펼쳐 둔다. 새 게임 창이 열릴 때까지 접지 않는다(입력 도중 화면이 움직이지 않게).
  const [inlineSetup, setInlineSetup] = useState(() => settings.lastNickname.trim() === '');
  const nickInputRef = useRef<HTMLInputElement>(null);
  const modalNickRef = useRef<HTMLInputElement>(null);
  const inlineRef = useRef<ProfileFieldsHandle>(null);
  const modalProfileRef = useRef<ProfileFieldsHandle>(null);

  useEffect(() => {
    if (focusNicknameOnMount) nickInputRef.current?.focus();
  }, [focusNicknameOnMount]);

  const nickname = settings.lastNickname.trim();
  const rankDifficulty: DifficultyId = (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty)
    ? (settings.lastDifficulty as DifficultyId)
    : 'Normal';
  const practiceLabel = settings.practiceSeen ? HOME_COPY.practiceAgain : HOME_COPY.practiceFirst;
  const commitProfile = {
    onCommitNickname: (n: string) => onSettings({ lastNickname: n }),
    onCommitSchool: (name: string, code: string) => onSettings({ lastSchoolName: name, lastSchoolCode: code }),
  };

  const practice = () => {
    onClearMessage();
    onPractice?.();
  };

  const openNewGame = () => {
    onClearMessage();
    if (inlineSetup) {
      const confirmed = inlineRef.current?.commit();
      if (!confirmed) return;
      onSettings({ lastNickname: confirmed });
      setInlineSetup(false);
      setActiveModal('new');
      return;
    }
    setActiveModal(cleanNickname(settings.lastNickname).error === null ? 'new' : 'profile');
  };

  const closeModal = () => setActiveModal(null);

  // 닉네임 칩: 누르면 닉네임·학교 작은 창이 열린다. 입력칸이 펼쳐져 있는 동안에는 칩이 없다.
  const chip = inlineSetup ? null : (
    <Button id="profileBtn" className={css.chip} aria-label={`닉네임 ${nickname}, 바꾸기`} onClick={() => setActiveModal('profile')}>
      <span className={css.chipText}>{nickname || '닉네임'}</span>
      <EditIcon size={18} />
    </Button>
  );

  return (
    <div className={css.root}>
      <div className={css.foreground} inert={activeModal !== null}>
        <main className={css.desk}>
          <section className={css.stageCol} aria-label="게임 시작">
            <div className={css.stage} role="img" aria-label="수비 전장 미리보기">
              <MiniStageCanvas
                motionMode={settings.motionMode}
                highContrastMap={settings.highContrastMap}
                paused={activeModal !== null}
                className={css.stageCanvas}
              />
              <Card className={css.logo}>
                <h1 className={css.logoTitle}>
                  <span>어휘력</span> <span>타워 디펜스</span>
                </h1>
              </Card>
            </div>

            {message && <p className={css.notice} role="status">{message}</p>}

            {/* 주 버튼은 짙은 바탕(--bg)이 아니라 종이 카드 위에 둔다(ui-rules-v3 §2 버튼 바탕). 입력칸·시작 줄·닉네임 칩이 한 카드다. */}
            <Card className={css.launchCard} aria-label="시작">
            {inlineSetup && (
              <div className={css.setupCard} aria-label="닉네임과 학교">
                <ProfileFields
                  variant="inline"
                  inputRef={nickInputRef}
                  ref={inlineRef}
                  savedNickname={settings.lastNickname}
                  savedSchoolName={settings.lastSchoolName}
                  savedSchoolCode={settings.lastSchoolCode}
                  {...commitProfile}
                />
              </div>
            )}

            <div className={css.actions}>
              <Button id="newGameBtn" variant="primary" size="lg" className={css.primaryAction} onClick={openNewGame}>
                {HOME_COPY.start}
              </Button>
              {onPractice && (
                <Button id="practiceBtn" className={css.secondaryAction} onClick={practice}>
                  {practiceLabel}
                </Button>
              )}
            </div>

            {chip && <div className={css.metaRow}>{chip}</div>}
            </Card>
          </section>

          <div className={css.tools}>
            <IconButton id="guideBtn" label="설명서" icon={<GuideIcon />} onClick={() => setActiveModal('guide')} />
            {onOpenNote && <IconButton id="noteBtn" label="오답 노트" icon={<NoteIcon />} count={noteCount} onClick={onOpenNote} />}
            <IconButton id="settingsBtn" label="설정" icon={<SettingsIcon />} onClick={() => setActiveModal('settings')} />
          </div>

          <div className={css.side}>
            <WordCard preferredGrade={settings.lastGrade} />
            <RankingSummary
              playerId={settings.playerId}
              nickname={settings.lastNickname}
              grade={settings.lastGrade}
              difficulty={rankDifficulty}
              refreshTick={refreshTick}
              onOpenAll={() => setActiveModal('ranking')}
            />
          </div>
        </main>
      </div>

      {activeModal === 'new' && (
        <NewGameScreen
          settings={settings}
          onBack={closeModal}
          onStart={input => {
            closeModal();
            onStartNew(input);
          }}
        />
      )}

      {activeModal === 'profile' && (
        <Modal
          titleId="profileModalTitle"
          title="내 정보"
          size="sm"
          onClose={closeModal}
          footer={
            <Button
              variant="primary"
              onClick={() => {
                if (modalProfileRef.current?.commit()) closeModal();
              }}
            >
              확인
            </Button>
          }
        >
          <ProfileFields
            variant="modal"
            inputRef={modalNickRef}
            ref={modalProfileRef}
            savedNickname={settings.lastNickname}
            savedSchoolName={settings.lastSchoolName}
            savedSchoolCode={settings.lastSchoolCode}
            {...commitProfile}
          />
        </Modal>
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdate={onSettings}
          onHistoryCleared={() => { setRefreshTick(t => t + 1); onHistoryCleared?.(); }}
          onClose={closeModal}
        />
      )}

      {activeModal === 'guide' && (
        <GuideScreen
          motionMode={settings.motionMode}
          highContrastMap={settings.highContrastMap}
          onBack={() => {
            closeModal();
            requestAnimationFrame(() => document.getElementById('guideBtn')?.focus());
          }}
        />
      )}

      {activeModal === 'ranking' && (
        <RankingModal grade={settings.lastGrade} difficulty={rankDifficulty} playerId={settings.playerId} nickname={settings.lastNickname} onClose={closeModal} />
      )}
    </div>
  );
}

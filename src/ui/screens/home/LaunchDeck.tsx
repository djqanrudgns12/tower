import { useEffect, useRef, useState, type RefObject } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { isGradeAvailable } from '../../../content';
import { getR6Battle, type LocalBalanceVersion } from '../../../application/balanceSession';
import { recommendNickname } from '../../../application/lobby';
import { useGradeContent } from '../../useGradeContent';
import { DIFFICULTY_COPY, cleanNickname } from '../../copy';
import { LineIcon } from '../../icons/LineIcon';
import { difficultyReadout } from '../guide/difficultyReadout';
import { R6_HOME_HERO, R6_HOME_ICONS, R6_MAP_NAME, showMapDiagram } from '../r6Map';
import css from './home.module.css';

const GRADES = [3, 4, 5, 6] as const;
type Grade = (typeof GRADES)[number];

interface Props {
  balanceVersion: LocalBalanceVersion;
  savedNickname: string;
  grade: Grade;
  difficulty: DifficultyId;
  starting: boolean;
  message: string | null;
  /** 처음 온 학생에게는 ‘처음이라면 연습부터’, 해 본 학생에게는 ‘연습하기’. */
  practiceLabel?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onGradeChange(next: Grade): void;
  onDifficultyChange(next: DifficultyId): void;
  onCommitNickname(nickname: string): void;
  onStartPlay(confirmedNickname: string): void;
  onPractice?(): void;
}

export function LaunchDeck({
  balanceVersion,
  savedNickname,
  grade,
  difficulty,
  starting,
  message,
  practiceLabel = '연습하기',
  inputRef,
  onGradeChange,
  onDifficultyChange,
  onCommitNickname,
  onStartPlay,
  onPractice,
}: Props) {
  const [draft, setDraft] = useState(savedNickname);
  const [touched, setTouched] = useState(false);
  const composingRef = useRef(false);
  const prevSavedRef = useRef(savedNickname);
  const commitRef = useRef(onCommitNickname);

  const { status, retry } = useGradeContent(grade);
  const r6 = balanceVersion === '2.0.0' ? getR6Battle() : null;
  const readoutLine = difficultyReadout(difficulty, r6?.balance).line;

  useEffect(() => {
    commitRef.current = onCommitNickname;
  }, [onCommitNickname]);

  useEffect(() => {
    if (prevSavedRef.current !== savedNickname) {
      prevSavedRef.current = savedNickname;
      if (!composingRef.current && savedNickname && draft === '') {
        setDraft(savedNickname);
      }
    }
  }, [savedNickname, draft]);

  useEffect(() => {
    const cleaned = cleanNickname(draft);
    if (cleaned.error !== null || cleaned.value === savedNickname) return undefined;
    const timer = setTimeout(() => {
      commitRef.current(cleaned.value);
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, savedNickname]);

  const check = cleanNickname(draft);
  const isEmpty = draft.trim().length === 0;
  const showError = touched && check.error !== null;
  const nickErrorText = showError
    ? isEmpty
      ? '새 게임 전에 닉네임(2~12자)을 먼저 적어 주세요.'
      : check.error!
    : null;

  const contentStatusText =
    status === 'error'
      ? '문제를 불러오지 못했어요.'
      : status !== 'ready' && status !== 'unavailable'
        ? '문제를 불러오는 중이에요.'
        : null;

  const applyCurrent = () => {
    setTouched(true);
    const cleaned = cleanNickname(draft);
    if (cleaned.error !== null) {
      inputRef.current?.focus();
      return;
    }
    setDraft(cleaned.value);
    if (cleaned.value !== savedNickname) onCommitNickname(cleaned.value);
  };

  const handleRecommend = () => {
    const next = recommendNickname(draft);
    setDraft(next);
    setTouched(false);
    onCommitNickname(next);
  };

  const handleNewGameClick = () => {
    if (starting) return;
    setTouched(true);
    const cleaned = cleanNickname(draft);
    if (cleaned.error !== null) {
      inputRef.current?.focus();
      return;
    }
    if (status !== 'ready') return;
    setDraft(cleaned.value);
    if (cleaned.value !== savedNickname) onCommitNickname(cleaned.value);
    onStartPlay(cleaned.value);
  };

  const startDisabled = starting || status !== 'ready';

  return (
    <section className={`${css.ceramicCard} ${css.launchCard}`} aria-label="새 게임 준비">
      <div className={css.stageViewport}>
        <img
          src={R6_HOME_HERO}
          onError={showMapDiagram}
          width={960}
          height={540}
          alt={`${R6_MAP_NAME} 전장 미리보기`}
          className={css.stageImage}
          draggable={false}
        />
        <span className={css.stageTag}>{R6_MAP_NAME}</span>
      </div>

      <div className={css.launchBody}>
        <div className={css.launchHead}>
          <h2 className={css.heroTitle}>낱말을 풀고, 타워로 성문을 지켜요</h2>
          <p className={css.readoutCaption}>{readoutLine}</p>
        </div>

        <div className={css.controlRow}>
          <div className={css.nickGroup}>
            <input
              ref={inputRef}
              id="landingNickInput"
              aria-label="닉네임"
              aria-describedby={nickErrorText ? 'landingNickStatus' : undefined}
              aria-invalid={showError || undefined}
              className={css.nickInputField}
              value={draft}
              maxLength={24}
              autoComplete="off"
              placeholder="닉네임 (2~12자)"
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={e => {
                composingRef.current = false;
                setDraft(e.currentTarget.value);
              }}
              onChange={e => setDraft(e.target.value)}
              onBlur={() => {
                if (composingRef.current) return;
                if (draft.trim().length > 0) {
                  setTouched(true);
                  const c = cleanNickname(draft);
                  if (c.error === null) {
                    setDraft(c.value);
                    if (c.value !== savedNickname) onCommitNickname(c.value);
                  }
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  applyCurrent();
                }
              }}
            />
            <button
              type="button"
              className={css.diceBtn}
              onClick={handleRecommend}
            >
              <span className={css.icon3dWrap} aria-hidden="true">
                <img src={R6_HOME_ICONS.dice} width={20} height={20} alt="" className={`${css.diceIcon} ${css.icon3d}`} />
              </span>
              <span>랜덤 추천</span>
            </button>
          </div>

          <div className={css.selectGroup}>
            <select
              id="landingGradeSelect"
              aria-label="학년"
              className={css.controlSelect}
              value={grade}
              disabled={starting}
              onChange={e => onGradeChange(Number(e.target.value) as Grade)}
            >
              {GRADES.map(g => (
                <option key={g} value={g} disabled={!isGradeAvailable(g)}>
                  {isGradeAvailable(g) ? `${g}학년` : `${g}학년 (준비 중)`}
                </option>
              ))}
            </select>

            <select
              id="landingDiffSelect"
              aria-label="난이도"
              className={css.controlSelect}
              value={difficulty}
              disabled={starting}
              onChange={e => onDifficultyChange(e.target.value as DifficultyId)}
            >
              {DIFFICULTY_IDS.map(d => (
                <option key={d} value={d}>
                  {DIFFICULTY_COPY[d].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(nickErrorText || contentStatusText || message) && (
          <div className={css.statusRow}>
            {nickErrorText && (
              <p id="landingNickStatus" role="status" aria-live="polite" className={css.inlineError}>
                {nickErrorText}
              </p>
            )}
            {contentStatusText && (
              <p role="status" aria-live="polite" className={status === 'error' ? css.inlineError : css.inlineMuted}>
                {contentStatusText}
                {status === 'error' && (
                  <button type="button" className={css.inlineRetryBtn} onClick={retry}>
                    다시 불러오기
                  </button>
                )}
              </p>
            )}
            {message && (
              <p className={css.bannerNotice} role="status">
                {message}
              </p>
            )}
          </div>
        )}

        <div className={css.ctaStack}>
          <button
            id="newGameBtn"
            type="button"
            className={css.ctaPrimary}
            aria-disabled={startDisabled || undefined}
            aria-busy={starting || undefined}
            onClick={handleNewGameClick}
          >
            <LineIcon name="hud/play" size={18} />
            <span>{starting ? '준비 중…' : '새 게임'}</span>
          </button>
          {onPractice && (
            <button
              id="practiceBtn"
              type="button"
              className={css.ctaSecondary}
              onClick={onPractice}
            >
              <span>{practiceLabel}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

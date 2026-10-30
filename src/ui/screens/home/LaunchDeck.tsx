import { useEffect, useRef, useState, type RefObject } from 'react';
import { recommendNickname } from '../../../application/lobby';
import { cleanNickname } from '../../copy';
import css from './home.module.css';

interface Props {
  savedNickname: string;
  message: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onCommitNickname(nickname: string): void;
  onOpenNewGame(confirmedNickname: string): void;
}

export function LaunchDeck({
  savedNickname,
  message,
  inputRef,
  onCommitNickname,
  onOpenNewGame,
}: Props) {
  const [draft, setDraft] = useState(savedNickname);
  const [touched, setTouched] = useState(false);
  const composingRef = useRef(false);
  const prevSavedRef = useRef(savedNickname);
  const commitRef = useRef(onCommitNickname);

  useEffect(() => {
    commitRef.current = onCommitNickname;
  }, [onCommitNickname]);

  // 외부에서 별명이 변경된 경우에만 빈 입력칸을 동기화한다(사용자가 지우는 중에는 되돌리지 않음).
  useEffect(() => {
    if (prevSavedRef.current !== savedNickname) {
      prevSavedRef.current = savedNickname;
      if (!composingRef.current && savedNickname && draft === '') {
        setDraft(savedNickname);
      }
    }
  }, [savedNickname, draft]);

  // 별도 '적용' 버튼 없이 유효한 별명을 입력하면 자동으로 저장·순위표와 연동한다.
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

  const statusText = showError
    ? (isEmpty ? '출정하기 전에 별명(2~12자)을 먼저 적어 주세요.' : check.error!)
    : check.error === null
      ? '출정 준비 완료 · 내 순위와 연동됨'
      : '별명 두 글자에서 열두 글자까지 적거나 랜덤 추천을 눌러요';

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
    setTouched(true);
    const cleaned = cleanNickname(draft);
    if (cleaned.error !== null) {
      inputRef.current?.focus();
      return;
    }
    setDraft(cleaned.value);
    if (cleaned.value !== savedNickname) onCommitNickname(cleaned.value);
    onOpenNewGame(cleaned.value);
  };

  return (
    <section className={css.launchDeck} aria-label="출정 준비">
      <div>
        <div className={css.nickHeader}>
          <label htmlFor="landingNickInput" className={css.nickLabel}>출정 별명</label>
          <span
            id="landingNickStatus"
            role="status"
            aria-live="polite"
            className={css.nickStatus}
            data-error={showError || undefined}
            data-ready={!showError && check.error === null ? 'true' : undefined}
          >
            {statusText}
          </span>
        </div>

        <div className={css.nickRow} style={{ marginTop: 8 }}>
          <input
            ref={inputRef}
            id="landingNickInput"
            aria-label="출정 별명"
            aria-describedby="landingNickStatus"
            aria-invalid={showError || undefined}
            className={css.nickInput}
            value={draft}
            maxLength={24}
            autoComplete="off"
            placeholder="별명 입력 (2~12자)"
            onCompositionStart={() => { composingRef.current = true; }}
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
            className={css.smallBtn}
            style={{ minHeight: 44, padding: '0 14px', whiteSpace: 'nowrap' }}
            onClick={handleRecommend}
          >
            랜덤 추천
          </button>
        </div>
      </div>

      {message && <p className={css.bannerNotice} role="status">{message}</p>}

      <div className={css.ctaStack}>
        <button
          id="newGameBtn"
          type="button"
          className={css.primaryCta}
          onClick={handleNewGameClick}
        >
          새 게임
        </button>
      </div>
    </section>
  );
}

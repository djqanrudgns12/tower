import { useEffect, useRef, useState, type RefObject } from 'react';
import { recommendNickname } from '../../../application/lobby';
import { searchNeisSchools, type NeisSchool } from '../../../application/neis';
import { cleanNickname } from '../../copy';
import css from './home.module.css';

interface Props {
  savedNickname: string;
  savedSchoolName: string;
  savedSchoolCode: string;
  message: string | null;
  /** 처음 온 학생에게는 ‘처음이라면 연습부터’, 해 본 학생에게는 ‘연습하기’. */
  practiceLabel?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCommitNickname(nickname: string): void;
  onCommitSchool?(schoolName: string, schoolCode: string): void;
  onOpenNewGame(confirmedNickname: string): void;
  onPractice?(): void;
}

export function LaunchDeck({
  savedNickname,
  savedSchoolName,
  savedSchoolCode,
  message,
  practiceLabel = '연습하기',
  inputRef,
  onCommitNickname,
  onCommitSchool,
  onOpenNewGame,
  onPractice,
}: Props) {
  const [draft, setDraft] = useState(savedNickname);
  const [touched, setTouched] = useState(false);
  const composingRef = useRef(false);
  const prevSavedRef = useRef(savedNickname);
  const commitRef = useRef(onCommitNickname);

  // 학교 이름 상태
  const [schoolDraft, setSchoolDraft] = useState(savedSchoolName);
  const [schoolResults, setSchoolResults] = useState<NeisSchool[]>([]);
  const [isSearchingSchool, setIsSearchingSchool] = useState(false);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [schoolStatusMsg, setSchoolStatusMsg] = useState<string | null>(null);

  const schoolBlockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commitRef.current = onCommitNickname;
  }, [onCommitNickname]);

  // 외부에서 닉네임이 변경된 경우 빈 입력칸을 동기화
  useEffect(() => {
    if (prevSavedRef.current !== savedNickname) {
      prevSavedRef.current = savedNickname;
      if (!composingRef.current && savedNickname && draft === '') {
        setDraft(savedNickname);
      }
    }
  }, [savedNickname, draft]);

  // 외부에서 학교 이름이 변경된 경우 동기화
  const [prevSavedSchool, setPrevSavedSchool] = useState(savedSchoolName);
  if (savedSchoolName !== prevSavedSchool) {
    setPrevSavedSchool(savedSchoolName);
    if (savedSchoolName && schoolDraft === '') {
      setSchoolDraft(savedSchoolName);
    }
  }

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (schoolBlockRef.current && !schoolBlockRef.current.contains(e.target as Node)) {
        setSchoolDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 유효한 닉네임을 입력하면 자동으로 저장·순위표와 연동
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
    ? (isEmpty ? '새 게임 전에 닉네임(2~12자)을 먼저 적어 주세요.' : check.error!)
    : check.error === null
      ? '준비 완료 · 내 순위와 연동됨'
      : '닉네임 두 글자에서 열두 글자까지 적거나 랜덤 추천을 눌러요';

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

    // 학교명도 저장
    const trimmedSchool = schoolDraft.trim();
    if (trimmedSchool !== savedSchoolName) {
      onCommitSchool?.(trimmedSchool, savedSchoolCode);
    }

    onOpenNewGame(cleaned.value);
  };

  // 학교 검색 실행
  const performSchoolSearch = async () => {
    const query = schoolDraft.trim();
    if (query.length < 2) {
      setSchoolStatusMsg('학교명을 2자 이상 입력해 주세요.');
      setSchoolDropdownOpen(false);
      return;
    }

    setIsSearchingSchool(true);
    setSchoolStatusMsg('NEIS에서 학교를 찾는 중...');
    setSchoolDropdownOpen(true);

    try {
      const results = await searchNeisSchools(query);
      setSchoolResults(results);
      if (results.length > 0) {
        setSchoolStatusMsg(`검색 결과 ${results.length}건`);
      } else {
        setSchoolStatusMsg('검색된 학교가 없습니다. 직접 입력하실 수 있어요.');
      }
    } catch {
      setSchoolResults([]);
      setSchoolStatusMsg('학교 검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearchingSchool(false);
    }
  };

  const handleSelectSchool = (school: NeisSchool) => {
    setSchoolDraft(school.schoolName);
    setSchoolDropdownOpen(false);
    setSchoolStatusMsg(`${school.schoolName} (${school.schoolKind})`);
    onCommitSchool?.(school.schoolName, school.schoolCode);
  };

  const handleSchoolBlur = () => {
    const trimmed = schoolDraft.trim();
    if (trimmed !== savedSchoolName) {
      onCommitSchool?.(trimmed, savedSchoolCode);
    }
  };

  return (
    <section className={css.launchDeck} aria-label="새 게임 준비">
      {/* 닉네임 입력 영역 */}
      <div>
        <div className={css.nickHeader}>
          <label htmlFor="landingNickInput" className={css.nickLabel}>닉네임</label>
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

        <div className={css.nickRow}>
          <input
            ref={inputRef}
            id="landingNickInput"
            aria-label="닉네임"
            aria-describedby="landingNickStatus"
            aria-invalid={showError || undefined}
            className={css.nickInput}
            value={draft}
            maxLength={24}
            autoComplete="off"
            placeholder="닉네임 입력 (2~12자)"
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

      {/* 학교 이름 입력 영역 (NEIS API 연동) */}
      <div className={css.schoolBlock} ref={schoolBlockRef}>
        <div className={css.nickHeader}>
          <label htmlFor="landingSchoolInput" className={css.nickLabel}>학교 이름</label>
          <span
            id="landingSchoolStatus"
            role="status"
            aria-live="polite"
            className={css.nickStatus}
          >
            {schoolStatusMsg ?? '학교 이름을 검색하거나 직접 적어요'}
          </span>
        </div>

        <div className={css.nickRow}>
          <input
            id="landingSchoolInput"
            aria-label="학교 이름"
            aria-describedby="landingSchoolStatus"
            className={css.nickInput}
            value={schoolDraft}
            maxLength={30}
            autoComplete="off"
            placeholder="학교 이름 입력 (예: 서울초등학교)"
            onChange={e => {
              setSchoolDraft(e.target.value);
              setSchoolStatusMsg(null);
            }}
            onBlur={handleSchoolBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                performSchoolSearch();
              } else if (e.key === 'Escape') {
                setSchoolDropdownOpen(false);
              }
            }}
          />
          <button
            type="button"
            className={css.smallBtn}
            style={{ minHeight: 44, padding: '0 14px', whiteSpace: 'nowrap' }}
            onClick={performSchoolSearch}
            disabled={isSearchingSchool}
          >
            {isSearchingSchool ? '검색 중' : '학교 검색'}
          </button>
        </div>

        {/* NEIS 검색 결과 드롭다운 */}
        {schoolDropdownOpen && (
          <div className={css.schoolDropdown} role="listbox" aria-label="학교 검색 결과">
            {isSearchingSchool ? (
              <div className={css.schoolEmpty}>NEIS에서 학교를 검색하고 있어요...</div>
            ) : schoolResults.length === 0 ? (
              <div className={css.schoolEmpty}>
                검색된 학교가 없습니다. 직접 이름을 입력해 사용할 수 있어요.
              </div>
            ) : (
              <ul className={css.schoolList}>
                {schoolResults.map(s => (
                  <li key={`${s.officeCode}-${s.schoolCode}-${s.schoolName}`}>
                    <button
                      type="button"
                      className={css.schoolItem}
                      onClick={() => handleSelectSchool(s)}
                    >
                      <div className={css.schoolItemTop}>
                        <span className={css.schoolItemName}>{s.schoolName}</span>
                        {s.schoolKind && (
                          <span className={css.schoolItemBadge}>{s.schoolKind}</span>
                        )}
                      </div>
                      <div className={css.schoolItemAddress}>
                        {s.officeName} · {s.roadAddress || s.locationName}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
        {onPractice && (
          <button
            id="practiceBtn"
            type="button"
            className={css.secondaryCta}
            onClick={onPractice}
          >
            {practiceLabel}
          </button>
        )}
      </div>
    </section>
  );
}

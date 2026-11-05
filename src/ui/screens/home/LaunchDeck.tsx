import { useEffect, useRef, useState, type RefObject } from 'react';
import { recommendNickname } from '../../../application/lobby';
import { searchNeisSchools, type NeisSchool } from '../../../application/neis';
import { cleanNickname } from '../../copy';
import { Button, Card, Modal } from '../../kit';
import { HomeUiArt, PencilIcon, PracticeTargetIcon, SchoolIcon } from './HomeIcons';
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
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [schoolStatusMsg, setSchoolStatusMsg] = useState<string | null>(null);

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
  const isReady = !showError && check.error === null;

  const statusText = showError
    ? isEmpty
      ? '새 게임 전에 닉네임(2~12자)을 먼저 적어 주세요.'
      : check.error!
    : isReady
      ? '내 순위와 자동 연동됨'
      : '2~12자 입력 또는 랜덤 추천';

  const headerBadgeText = showError
    ? '닉네임 확인'
    : isReady
      ? '준비 완료 · 순위 연동'
      : '닉네임 2~12자';

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

    const trimmedSchool = schoolDraft.trim();
    if (trimmedSchool !== savedSchoolName) {
      onCommitSchool?.(trimmedSchool, savedSchoolCode);
    }

    onOpenNewGame(cleaned.value);
  };

  // 학교 검색 실행(소형 모달에서 결과를 보여 아래 CTA와 겹치지 않게 한다)
  const performSchoolSearch = async () => {
    setSchoolModalOpen(true);
    const query = schoolDraft.trim();
    if (query.length < 2) {
      setSchoolResults([]);
      setSchoolStatusMsg('학교명을 2자 이상 입력해 주세요.');
      return;
    }

    setIsSearchingSchool(true);
    setSchoolStatusMsg('NEIS에서 학교를 찾는 중...');

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
    setSchoolModalOpen(false);
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
    <section className={`${css.subCard} ${css.launchCard}`} aria-label="새 게임 준비">
      <div className={css.cardHeaderRow}>
        <div className={css.cardTitleWrap}>
          <span className={css.sectionIconBadge} aria-hidden="true">
            <HomeUiArt file="icon.gate.webp" className={css.sectionIcon} />
          </span>
          <h2 className={css.sectionTitle}>새 게임 준비</h2>
        </div>
        <span
          className={css.readyStatusTag}
          data-ready={isReady ? 'true' : undefined}
          data-error={showError ? 'true' : undefined}
        >
          {headerBadgeText}
        </span>
      </div>

      <div className={css.formFieldsTray}>
        {/* 1. 닉네임 입력 영역 */}
        <div className={css.fieldGroup}>
          <div className={css.fieldLabelRow}>
            <label htmlFor="landingNickInput" className={css.fieldLabelTitle}>
              <span className={css.stepNumBadge} aria-hidden="true">1</span>
              닉네임
            </label>
            <span
              id="landingNickStatus"
              role="status"
              aria-live="polite"
              className={css.nickStatus}
              data-error={showError || undefined}
              data-ready={isReady ? 'true' : undefined}
            >
              {statusText}
            </span>
          </div>

          <div className={css.lockedInputRow}>
            <div className={css.inputIconWrap}>
              <PencilIcon className={css.inputInnerIcon} />
              <input
                ref={inputRef}
                id="landingNickInput"
                aria-label="닉네임"
                aria-describedby="landingNickStatus"
                aria-invalid={showError || undefined}
                className={css.parchInput}
                value={draft}
                maxLength={24}
                autoComplete="off"
                placeholder="닉네임 입력 (2~12자)"
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
            </div>
            <button
              type="button"
              className={css.lockedSlotBtn}
              onClick={handleRecommend}
            >
              랜덤 추천
            </button>
          </div>
        </div>

        <div className={css.trayDivider} aria-hidden="true" />

        {/* 2. 학교 이름 입력 영역 (결과는 소형 모달로 열어 아래 CTA와 겹치지 않는다) */}
        <div className={css.fieldGroup}>
          <div className={css.fieldLabelRow}>
            <label htmlFor="landingSchoolInput" className={css.fieldLabelTitle}>
              <span className={css.stepNumBadge} aria-hidden="true">2</span>
              학교 이름
              <span className={css.optionalTag}>(선택)</span>
            </label>
            <span
              id="landingSchoolStatus"
              role="status"
              aria-live="polite"
              className={css.nickStatus}
            >
              {schoolStatusMsg ?? '검색하거나 직접 입력해요'}
            </span>
          </div>

          <div className={css.lockedInputRow}>
            <div className={css.inputIconWrap}>
              <SchoolIcon className={css.inputInnerIcon} />
              <input
                id="landingSchoolInput"
                aria-label="학교 이름"
                aria-describedby="landingSchoolStatus"
                className={css.parchInput}
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
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void performSchoolSearch();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className={css.lockedSlotBtn}
              onClick={() => void performSchoolSearch()}
              disabled={isSearchingSchool}
            >
              {isSearchingSchool ? '검색 중' : '학교 검색'}
            </button>
          </div>
        </div>
      </div>

      {schoolModalOpen && (
        <Modal
          titleId="schoolModalTitle"
          title="학교 찾기"
          size="sm"
          onClose={() => setSchoolModalOpen(false)}
        >
          <div className={css.schoolModalStack}>
            <div className={css.schoolModalSearch}>
              <input
                id="schoolModalInput"
                aria-label="학교 이름 검색"
                className={css.nickInput}
                value={schoolDraft}
                maxLength={30}
                autoComplete="off"
                placeholder="학교 이름 (2자 이상)"
                onChange={e => {
                  setSchoolDraft(e.target.value);
                  setSchoolStatusMsg(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void performSchoolSearch();
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => void performSchoolSearch()}
                disabled={isSearchingSchool}
              >
                {isSearchingSchool ? '검색 중' : '검색'}
              </Button>
            </div>
            <p className={css.schoolModalStatus} role="status" aria-live="polite">
              {schoolStatusMsg ?? '학교 이름을 입력하고 검색을 눌러요.'}
            </p>
            <Card sunk pad="sm" className={css.schoolModalResults}>
              {isSearchingSchool ? (
                <p className={css.schoolEmpty}>NEIS에서 학교를 검색하고 있어요...</p>
              ) : schoolResults.length === 0 ? (
                <p className={css.schoolEmpty}>
                  검색된 학교가 없습니다. 직접 이름을 입력해 사용할 수 있어요.
                </p>
              ) : (
                <ul className={css.schoolList} aria-label="학교 검색 결과">
                  {schoolResults.map(s => (
                    <li key={`${s.officeCode}-${s.schoolCode}-${s.schoolName}`}>
                      <button
                        type="button"
                        className={css.schoolItem}
                        onClick={() => handleSelectSchool(s)}
                      >
                        <span className={css.schoolItemTop}>
                          <span className={css.schoolItemName}>{s.schoolName}</span>
                          {s.schoolKind && (
                            <span className={css.schoolItemBadge}>{s.schoolKind}</span>
                          )}
                        </span>
                        <span className={css.schoolItemAddress}>
                          {s.officeName} · {s.roadAddress || s.locationName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </Modal>
      )}

      {message && <p className={css.bannerNotice} role="status">{message}</p>}

      <div className={css.ctaStack}>
        <button
          id="newGameBtn"
          type="button"
          className={css.craftCtaPrimary}
          onClick={handleNewGameClick}
        >
          <HomeUiArt file="icon.gate.webp" className={css.ctaArtIcon} />
          새 게임
        </button>
        {onPractice && (
          <button
            id="practiceBtn"
            type="button"
            className={css.craftCtaSecondary}
            onClick={onPractice}
          >
            <PracticeTargetIcon className={css.btnIconSvg} />
            {practiceLabel}
          </button>
        )}
      </div>
    </section>
  );
}

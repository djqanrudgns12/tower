import { useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from 'react';
import { recommendNickname } from '../../../application/lobby';
import { searchNeisSchools, type NeisSchool } from '../../../application/neis';
import { cleanNickname, HOME_COPY } from '../../copy';
import { Button } from '../../kit';
import css from './lobby.module.css';

export interface ProfileFieldsHandle {
  /** 닉네임을 확인해 저장한다(학교 이름도 함께). 올바르면 정리된 닉네임, 아니면 입력칸에 포커스를 두고 null. */
  commit(): string | null;
}

interface Props {
  savedNickname: string;
  savedSchoolName: string;
  savedSchoolCode: string;
  /** inline: 처음 온 학생의 홈 입력칸(학교 검색은 Enter). modal: 닉네임 칩을 누르면 뜨는 작은 창(검색 버튼 있음). */
  variant: 'inline' | 'modal';
  inputRef: RefObject<HTMLInputElement | null>;
  ref?: Ref<ProfileFieldsHandle>;
  onCommitNickname(nickname: string): void;
  onCommitSchool(schoolName: string, schoolCode: string): void;
}

/** 닉네임(필수)과 학교 이름(선택) 입력. 올바른 닉네임은 잠깐 뒤 저장되어 랭킹과 이어진다. */
export function ProfileFields({ savedNickname, savedSchoolName, savedSchoolCode, variant, inputRef, ref, onCommitNickname, onCommitSchool }: Props) {
  const modal = variant === 'modal';
  const [draft, setDraft] = useState(savedNickname);
  const [touched, setTouched] = useState(false);
  const composingRef = useRef(false);
  const prevSavedRef = useRef(savedNickname);

  const [schoolDraft, setSchoolDraft] = useState(savedSchoolName);
  const [schoolResults, setSchoolResults] = useState<NeisSchool[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [schoolStatus, setSchoolStatus] = useState<string | null>(null);
  const schoolBlockRef = useRef<HTMLDivElement>(null);

  // 가장 최근 값을 가리켜 두고 타이머·닫힐 때 정리에서 쓴다.
  const latest = useRef({ savedNickname, savedSchoolName, savedSchoolCode, schoolDraft, onCommitNickname, onCommitSchool });
  useEffect(() => {
    latest.current = { savedNickname, savedSchoolName, savedSchoolCode, schoolDraft, onCommitNickname, onCommitSchool };
  });

  // 바깥에서 닉네임이 바뀌었고 입력칸이 비어 있으면 맞춘다.
  useEffect(() => {
    if (prevSavedRef.current === savedNickname) return;
    prevSavedRef.current = savedNickname;
    if (!composingRef.current && savedNickname && draft === '') setDraft(savedNickname);
  }, [savedNickname, draft]);

  // 바깥에서 학교 이름이 바뀌었고 입력칸이 비어 있으면 맞춘다.
  const [prevSavedSchool, setPrevSavedSchool] = useState(savedSchoolName);
  if (savedSchoolName !== prevSavedSchool) {
    setPrevSavedSchool(savedSchoolName);
    if (savedSchoolName && schoolDraft === '') setSchoolDraft(savedSchoolName);
  }

  // 학교 검색 결과 바깥을 누르면 닫는다.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (schoolBlockRef.current && !schoolBlockRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // 올바른 닉네임은 잠깐 뒤 자동 저장한다(랭킹의 '내 순위'와 바로 이어진다).
  useEffect(() => {
    const cleaned = cleanNickname(draft);
    if (cleaned.error !== null || cleaned.value === savedNickname) return undefined;
    const timer = setTimeout(() => latest.current.onCommitNickname(cleaned.value), 150);
    return () => clearTimeout(timer);
  }, [draft, savedNickname]);

  // 창이 닫혀도 입력하던 학교 이름은 남긴다.
  useEffect(() => () => {
    const l = latest.current;
    const trimmed = l.schoolDraft.trim();
    if (trimmed !== l.savedSchoolName) l.onCommitSchool(trimmed, l.savedSchoolCode);
  }, []);

  // 작은 창에서는 Modal이 첫 조작 요소(닫기)에 포커스를 두므로, 그 뒤에 닉네임 칸으로 옮긴다.
  useEffect(() => {
    if (!modal) return undefined;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [modal, inputRef]);

  const check = cleanNickname(draft);
  const isEmpty = draft.trim().length === 0;
  const showError = touched && check.error !== null;
  const errorText = showError ? (isEmpty ? HOME_COPY.nicknameFirst : check.error) : null;

  const apply = (): string | null => {
    setTouched(true);
    const cleaned = cleanNickname(draft);
    if (cleaned.error !== null) {
      inputRef.current?.focus();
      return null;
    }
    setDraft(cleaned.value);
    if (cleaned.value !== savedNickname) onCommitNickname(cleaned.value);
    const trimmedSchool = schoolDraft.trim();
    if (trimmedSchool !== savedSchoolName) onCommitSchool(trimmedSchool, savedSchoolCode);
    return cleaned.value;
  };
  useImperativeHandle(ref, () => ({ commit: apply }));

  const recommend = () => {
    const next = recommendNickname(draft);
    setDraft(next);
    setTouched(false);
    onCommitNickname(next);
  };

  const searchSchool = async () => {
    const query = schoolDraft.trim();
    if (query.length < 2) {
      setSchoolStatus('학교 이름을 두 글자 이상 적어요');
      setDropdownOpen(false);
      return;
    }
    setSearching(true);
    setSchoolStatus('학교를 찾는 중이에요');
    setDropdownOpen(true);
    try {
      const results = await searchNeisSchools(query);
      setSchoolResults(results);
      setSchoolStatus(results.length > 0 ? `${results.length}곳을 찾았어요` : '찾은 학교가 없어요. 그대로 써도 돼요');
    } catch {
      setSchoolResults([]);
      setSchoolStatus('학교를 찾지 못했어요');
    } finally {
      setSearching(false);
    }
  };

  const pickSchool = (school: NeisSchool) => {
    setSchoolDraft(school.schoolName);
    setDropdownOpen(false);
    setSchoolStatus(`${school.schoolName} (${school.schoolKind})`);
    onCommitSchool(school.schoolName, school.schoolCode);
  };

  const commitSchoolOnBlur = () => {
    const trimmed = schoolDraft.trim();
    if (trimmed !== savedSchoolName) onCommitSchool(trimmed, savedSchoolCode);
  };

  const schoolHint = schoolStatus ?? (!modal && schoolDraft.trim().length >= 2 ? 'Enter를 누르면 학교를 찾아요' : null);

  return (
    <div className={modal ? css.fieldsModal : css.fieldsInline}>
      <div className={css.field}>
        <label htmlFor={`${variant}NickInput`} className={css.fieldLabel}>닉네임</label>
        <div className={css.fieldRow}>
          <input
            ref={inputRef}
            id={`${variant}NickInput`}
            aria-label="닉네임"
            aria-describedby={`${variant}NickStatus`}
            aria-invalid={showError || undefined}
            className={css.input}
            value={draft}
            maxLength={24}
            autoComplete="off"
            placeholder="2~12글자"
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={e => {
              composingRef.current = false;
              setDraft(e.currentTarget.value);
            }}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => {
              if (composingRef.current || draft.trim().length === 0) return;
              setTouched(true);
              const c = cleanNickname(draft);
              if (c.error === null) {
                setDraft(c.value);
                if (c.value !== savedNickname) onCommitNickname(c.value);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                apply();
              }
            }}
          />
          <Button onClick={recommend}>랜덤 추천</Button>
        </div>
        <p id={`${variant}NickStatus`} role="status" aria-live="polite" className={css.fieldNote} data-error={errorText ? 'true' : undefined}>
          {errorText}
        </p>
      </div>

      <div className={css.field} ref={schoolBlockRef}>
        <label htmlFor={`${variant}SchoolInput`} className={css.fieldLabel}>학교 이름 (선택)</label>
        <div className={css.fieldRow}>
          <input
            id={`${variant}SchoolInput`}
            aria-label="학교 이름"
            aria-describedby={`${variant}SchoolStatus`}
            className={css.input}
            value={schoolDraft}
            maxLength={30}
            autoComplete="off"
            placeholder="예: 서울초등학교"
            onChange={e => {
              setSchoolDraft(e.target.value);
              setSchoolStatus(null);
            }}
            onBlur={commitSchoolOnBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchSchool();
              } else if (e.key === 'Escape' && dropdownOpen) {
                e.stopPropagation();
                setDropdownOpen(false);
              }
            }}
          />
          {modal && <Button onClick={() => void searchSchool()} disabled={searching}>{searching ? '찾는 중' : '학교 검색'}</Button>}
        </div>
        <p id={`${variant}SchoolStatus`} role="status" aria-live="polite" className={css.fieldNote}>{schoolHint}</p>

        {dropdownOpen && !searching && schoolResults.length > 0 && (
          <ul className={css.schoolList} role="listbox" aria-label="학교 검색 결과">
            {schoolResults.map(s => (
              <li key={`${s.officeCode}-${s.schoolCode}-${s.schoolName}`} role="presentation">
                <button type="button" role="option" aria-selected={s.schoolName === schoolDraft} className={css.schoolItem} onClick={() => pickSchool(s)}>
                  <span className={css.schoolName}>{s.schoolName}</span>
                  <span className={css.schoolMeta}>{[s.schoolKind, s.officeName].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

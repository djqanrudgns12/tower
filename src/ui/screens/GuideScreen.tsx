import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { MotionMode } from '../../application/session';
import css from './GuideScreen.module.css';
import {
  buildGuideChapters,
  GUIDE_CHAPTER_IDS,
  nextGuideChapter,
  type GuideChapterId,
} from './guide/guideModel';
import { GuideRowIcon, GuideVisualStage } from './guide/GuideVisualStages';
import { ChevronLeftIcon, ChevronRightIcon } from './home/HomeIcons';
import { ModalShell } from './home/ModalShell';

/** 방향키·Home·End를 스스로 쓰는 입력 칸·위젯. 이 안에서 누른 키는 장 이동으로 가로채지 않는다. */
const ARROW_KEY_WIDGETS = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="radiogroup"]',
  '[role="listbox"]',
  '[role="combobox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="treegrid"]',
  '[role="tablist"]',
  '[role="application"]',
].join(', ');

interface Props {
  motionMode?: MotionMode | undefined;
  highContrastMap?: boolean | undefined;
  onBack(): void;
}

/**
 * 사용 설명서 — 왕국 수호 작전 교범(개편 PRD v1.0).
 * 4장 구성('< >' 페이지 전환)과 실시간 수비 캔버스·전용 삽화로 핵심 규칙만 간결하게 안내한다.
 */
export function GuideScreen({ motionMode = 'full', highContrastMap = false, onBack }: Props) {
  const chapters = useMemo(() => buildGuideChapters(), []);
  const [chapterId, setChapterId] = useState<GuideChapterId>(1);

  const rootRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const shownChapter = useRef<GuideChapterId>(chapterId);

  // 장이 바뀌면서 포커스가 사라졌으면(눌렀던 무대 버튼이 사라짐·경계에서 '이전 장/다음 장'이 비활성) 현재 장 탭으로 옮겨
  // 대화상자 안의 키 처리가 계속 이어지게 한다. 포커스가 대화상자 안에 살아 있으면 건드리지 않는다.
  useEffect(() => {
    if (shownChapter.current === chapterId) return;
    shownChapter.current = chapterId;
    const dialog = rootRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
    const active = document.activeElement as HTMLElement | null;
    const lost =
      !active ||
      active === document.body ||
      !dialog?.contains(active) ||
      (active instanceof HTMLButtonElement && active.disabled);
    if (lost) tabRefs.current[chapterId - 1]?.focus({ preventScroll: true });
  }, [chapterId]);

  // ←/→/Home/End 장 이동은 설명서 대화상자에서만 받는다(window 전역 가로채기 금지).
  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const target = e.target as HTMLElement;
    // 입력 칸이나 방향키를 스스로 쓰는 위젯 안에서는 그 위젯에 맡긴다(설명서 목차 탭 목록은 제외).
    const widget = target.closest<HTMLElement>(ARROW_KEY_WIDGETS);
    if (widget && widget !== tablistRef.current && e.currentTarget.contains(widget)) return;
    const next: GuideChapterId =
      e.key === 'ArrowLeft'
        ? nextGuideChapter(chapterId, -1)
        : e.key === 'ArrowRight'
          ? nextGuideChapter(chapterId, 1)
          : e.key === 'Home'
            ? GUIDE_CHAPTER_IDS[0]
            : GUIDE_CHAPTER_IDS[GUIDE_CHAPTER_IDS.length - 1]!;
    e.preventDefault();
    setChapterId(next);
    // 목차 탭에서 누른 경우 탭 목록 규칙대로 새 장의 탭으로 포커스를 옮긴다.
    if (tablistRef.current?.contains(target)) tabRefs.current[next - 1]?.focus();
  };

  const chapter = chapters[chapterId - 1] ?? chapters[0];

  return (
    <ModalShell titleId="guideModalTitle" title="사용 설명서" wide onClose={onBack} onDialogKeyDown={onDialogKeyDown}>
      <div ref={rootRef} className={css.guideRoot}>
        <div ref={tablistRef} role="tablist" aria-label="사용 설명서 목차" className={css.chapterTabs}>
          {chapters.map((ch, i) => {
            const active = ch.id === chapter.id;
            return (
              <button
                key={ch.id}
                ref={el => { tabRefs.current[i] = el; }}
                id={`guideTab-${ch.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="guideChapterPanel"
                className={css.chapterTabBtn}
                onClick={() => setChapterId(ch.id)}
              >
                {ch.tabLabel}
              </button>
            );
          })}
        </div>

        <section
          id="guideChapterPanel"
          role="tabpanel"
          aria-labelledby={`guideTab-${chapter.id}`}
          className={css.chapterPanel}
        >
          <div className={css.headlineBar}>
            <span className={css.chapterPill}>{`제${chapter.id}장 · ${chapter.title}`}</span>
            <h3 className={css.headlineText}>{chapter.headline}</h3>
          </div>

          <GuideVisualStage
            chapter={chapter}
            motionMode={motionMode}
            highContrastMap={highContrastMap}
          />

          <ol className={css.summarySocketBox} aria-label={`${chapter.title} 핵심 요약`}>
            {chapter.rows.map(row => (
              <li key={row.title} className={css.summaryRow}>
                <span className={css.rowIconSlot} aria-hidden="true">
                  <GuideRowIcon icon={row.icon} />
                </span>
                <div className={css.rowTextGroup}>
                  <div className={css.rowHeaderLine}>
                    <span className={css.rowBadge}>{row.badge}</span>
                    <strong className={css.rowTitle}>{row.title}</strong>
                  </div>
                  <p className={css.rowBody}>{row.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className={css.pagerFooter} aria-label="사용 설명서 페이지 이동">
          <button
            type="button"
            className={css.pagerBtn}
            disabled={chapter.id === 1}
            onClick={() => setChapterId(prev => nextGuideChapter(prev, -1))}
          >
            <ChevronLeftIcon />
            이전 장
          </button>

          <div className={css.pageIndicator} aria-live="polite">
            <span>{`${chapter.id} / ${GUIDE_CHAPTER_IDS.length}`}</span>
            <span className="sr-only">{` · 제${chapter.id}장 ${chapter.title}`}</span>
          </div>

          <button
            type="button"
            className={css.pagerBtn}
            disabled={chapter.id === GUIDE_CHAPTER_IDS.length}
            onClick={() => setChapterId(prev => nextGuideChapter(prev, 1))}
          >
            다음 장
            <ChevronRightIcon />
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setChapterId(prev => nextGuideChapter(prev, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setChapterId(prev => nextGuideChapter(prev, 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setChapterId(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setChapterId(4);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const chapter = chapters[chapterId - 1] ?? chapters[0];

  return (
    <ModalShell titleId="guideModalTitle" title="사용 설명서" wide onClose={onBack}>
      <div className={css.guideRoot}>
        <div role="tablist" aria-label="사용 설명서 목차" className={css.chapterTabs}>
          {chapters.map(ch => {
            const active = ch.id === chapter.id;
            return (
              <button
                key={ch.id}
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

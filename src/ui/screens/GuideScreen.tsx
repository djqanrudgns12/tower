import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { MotionMode } from '../../application/session';
import { GUIDE_COPY as T } from '../copy';
import { BackIcon } from '../icons/ControlIcons';
import { ArtIcon, Button, Card, Modal } from '../kit';
import css from './GuideScreen.module.css';
import { GUIDE_UI as U } from './guide/guideCopy';
import {
  buildCounterRows,
  buildGuideChapters,
  chapterLabel,
  GUIDE_CHAPTER_IDS,
  GUIDE_COUNTER_CARD,
  nextGuideChapter,
  type GuideChapterId,
} from './guide/guideModel';
import { GuideArt, GuideRowIcon, GuideVisualStage, usePrefersReducedMotion } from './guide/GuideVisualStages';

/** 방향키·Home·End를 스스로 쓰는 입력 칸·위젯. 이 안에서 누른 키는 장 이동으로 가로채지 않는다(고르기 줄 끝에서 넘친 방향키 포함). */
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

const LAST_CHAPTER = GUIDE_CHAPTER_IDS[GUIDE_CHAPTER_IDS.length - 1]!;
/** 목차에서 상성 카드의 자리(장 카드 뒤). */
const COUNTER_SLOT = GUIDE_CHAPTER_IDS.length;

interface Props {
  /** 설정의 배경 움직임 단계. '전체'일 때만 1장 수비 순환·2장 결과 순환이 돈다(OS 동작 줄이기도 멈춘다). */
  motionMode?: MotionMode | undefined;
  /** 시연 캔버스의 길·받침 고대비 윤곽선. */
  highContrastMap?: boolean | undefined;
  onBack(): void;
}

/**
 * 사용 설명서(R5 G1). 첫 화면은 그림 카드 목차(R4), 카드를 누르면 장 화면(R4 이전 교범): 머리띠·시연·요약 3행과
 * ‹ 이전 장 · n/N · 다음 장 ›. 장 화면에서는 ←→·Home·End로도 넘긴다.
 */
export function GuideScreen({ motionMode = 'full', highContrastMap = false, onBack }: Props) {
  const chapters = useMemo(() => buildGuideChapters(), []);
  const counters = useMemo(() => buildCounterRows(), []);
  const [chapterId, setChapterId] = useState<GuideChapterId | null>(null);
  const osReduce = usePrefersReducedMotion();
  const animate = motionMode === 'full' && !osReduce;

  const headRef = useRef<HTMLHeadingElement>(null);
  const tocRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** 상성 카드로 5장을 열었는가. 그대로 목차로 돌아오면 상성 카드로 포커스를 돌린다. */
  const fromCounter = useRef(false);
  /** 화면이 바뀐 뒤 줄 포커스: 장 머리띠 또는 목차 카드 자리. */
  const pendingFocus = useRef<'head' | number | null>(null);

  // 목차 → 장은 장 머리띠, 장 → 목차는 그 장의 카드로 포커스를 옮긴다. 장끼리 넘길 때는 포커스가 사라졌을 때만
  // (경계에서 '이전 장·다음 장'이 꺼짐) 머리띠로 옮긴다. 포커스가 대화상자 안에 살아 있으면 건드리지 않는다.
  useEffect(() => {
    const want = pendingFocus.current;
    pendingFocus.current = null;
    if (chapterId === null) {
      if (typeof want === 'number') tocRefs.current[want]?.focus();
      return;
    }
    const dialog = headRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
    const active = document.activeElement as HTMLElement | null;
    const lost = !active || active === document.body || !dialog?.contains(active) || (active instanceof HTMLButtonElement && active.disabled);
    if (want === 'head' || lost) headRef.current?.focus({ preventScroll: true });
  }, [chapterId]);

  const openChapter = (id: GuideChapterId, viaCounter: boolean) => {
    fromCounter.current = viaCounter;
    pendingFocus.current = 'head';
    setChapterId(id);
  };
  const goChapter = (id: GuideChapterId) => {
    fromCounter.current = false;
    setChapterId(id);
  };
  const backToToc = () => {
    if (chapterId === null) return;
    pendingFocus.current = fromCounter.current ? COUNTER_SLOT : chapterId - 1;
    setChapterId(null);
  };

  // ←/→/Home/End 장 이동은 설명서 대화상자의 장 화면에서만 받는다(window 전역 가로채기 금지).
  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (chapterId === null || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const widget = (e.target as HTMLElement).closest<HTMLElement>(ARROW_KEY_WIDGETS);
    if (widget && e.currentTarget.contains(widget)) return;
    const next: GuideChapterId =
      e.key === 'ArrowLeft' ? nextGuideChapter(chapterId, -1)
      : e.key === 'ArrowRight' ? nextGuideChapter(chapterId, 1)
      : e.key === 'Home' ? GUIDE_CHAPTER_IDS[0]
      : LAST_CHAPTER;
    e.preventDefault();
    if (next !== chapterId) goChapter(next);
  };

  const chapter = chapterId === null ? null : (chapters[chapterId - 1] ?? chapters[0]!);

  return (
    <Modal titleId="guideModalTitle" title={T.title} size="lg" onClose={onBack} onDialogKeyDown={onDialogKeyDown}>
      {chapter === null ? (
        <nav aria-label={U.tocLabel}>
          <ol className={css.toc}>
            {chapters.map((ch, i) => (
              <li key={ch.id}>
                <button type="button" ref={el => { tocRefs.current[i] = el; }} className={css.tocCard} data-chapter={ch.id} onClick={() => openChapter(ch.id, false)}>
                  <GuideArt chapter={{ ...ch, illustrationAlt: '' }} className={css.tocArt} />
                  <span className={css.tocTitle}>
                    <span className={css.tocNo} aria-hidden="true">{ch.id}</span>
                    <span className="sr-only">{`제${ch.id}장 `}</span>
                    {ch.title}
                  </span>
                  <span className={css.tocSentence}>{ch.sentence}</span>
                  <span className={css.tocMore}>{T.more}<BackIcon size={18} /></span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                ref={el => { tocRefs.current[COUNTER_SLOT] = el; }}
                className={css.tocCard}
                data-counter-card
                onClick={() => openChapter(GUIDE_COUNTER_CARD.chapter, true)}
              >
                <span className={`${css.tocArt} ${css.tocTraits}`} aria-hidden="true">
                  {counters.map(c => <ArtIcon key={c.tag} name={c.icon} size={36} />)}
                </span>
                <span className={css.tocTitle}>{GUIDE_COUNTER_CARD.title}</span>
                <span className={css.tocSentence}>{GUIDE_COUNTER_CARD.sentence}</span>
                <span className={css.tocMore}>{T.more}<BackIcon size={18} /></span>
              </button>
            </li>
          </ol>
        </nav>
      ) : (
        <section className={css.chapter} aria-labelledby="guideChapterTitle" data-chapter={chapter.id}>
          <div className={css.head}>
            <h3 id="guideChapterTitle" ref={headRef} tabIndex={-1} className={css.ribbon}>{chapterLabel(chapter)}</h3>
            <p className={css.headline} data-content>{chapter.headline}</p>
          </div>

          <GuideVisualStage chapter={chapter} animate={animate} highContrastMap={highContrastMap} />

          <Card sunk pad="none">
            <ol className={css.rows} aria-label={`${chapter.title} 요약`}>
            {chapter.rows.map(row => (
              <li key={row.title} className={css.row}>
                <span className={css.rowIcon} aria-hidden="true"><GuideRowIcon icon={row.icon} /></span>
                <span className={css.rowHead}>
                  <span className={css.rowBadge}>{row.badge}</span>
                  <strong className={css.rowTitle}>{row.title}</strong>
                </span>
                <p className={css.rowBody} data-content>{row.body}</p>
              </li>
            ))}
            </ol>
          </Card>

          <nav className={css.pager} aria-label={U.pagerLabel}>
            <Button variant="ghost" className={css.tocBtn} onClick={backToToc}>
              <BackIcon size={20} />{U.toc}
            </Button>
            <span className={css.pagerMain}>
              <Button disabled={chapter.id === GUIDE_CHAPTER_IDS[0]} onClick={() => goChapter(nextGuideChapter(chapter.id, -1))}>
                <BackIcon size={18} />{U.prev}
              </Button>
              <span className={css.pageNo} aria-live="polite">
                {`${chapter.id} / ${GUIDE_CHAPTER_IDS.length}`}
                <span className="sr-only">{` · ${chapterLabel(chapter)}`}</span>
              </span>
              <Button disabled={chapter.id === LAST_CHAPTER} onClick={() => goChapter(nextGuideChapter(chapter.id, 1))}>
                {U.next}<span className={css.chevNext}><BackIcon size={18} /></span>
              </Button>
            </span>
          </nav>
        </section>
      )}
    </Modal>
  );
}

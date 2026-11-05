import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { MotionMode } from '../../application/session';
import { GUIDE_COPY as T } from '../copy';
import { Card, Modal, ModalTabPanel, ModalTabs, ModalTabShell, type ModalTabOption } from '../kit';
import css from './GuideScreen.module.css';
import { GUIDE_UI as U } from './guide/guideCopy';
import {
  buildGuideChapters,
  chapterLabel,
  GUIDE_CHAPTER_IDS,
  nextGuideChapter,
  type GuideChapterId,
} from './guide/guideModel';
import { GuideRowIcon, GuideVisualStage, usePrefersReducedMotion } from './guide/GuideVisualStages';

/** 방향키·Home·End를 스스로 쓰는 입력 칸·위젯. 이 안에서 누른 키는 장 이동으로 가로채지 않는다(고르기 줄·탭 줄 포함). */
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

interface Props {
  /** 설정의 배경 움직임 단계. '전체'일 때만 1장 수비 순환·2장 결과 순환이 돈다(OS 동작 줄이기도 멈춘다). */
  motionMode?: MotionMode | undefined;
  /** 시연 캔버스의 길·받침 고대비 윤곽선. */
  highContrastMap?: boolean | undefined;
  onBack(): void;
}

/**
 * 사용 설명서(lg 860×580 고정 프레임 + 상단 5장 직행 ModalTabs).
 * 목차 왕복이나 하단 쪽 넘김 없이 상단 책갈피 탭으로 1~5장을 즉시 오가며,
 * 시연 무대(왼쪽)와 핵심 3단계 요약 카드(오른쪽)를 한눈에 본다.
 */
export function GuideScreen({ motionMode = 'full', highContrastMap = false, onBack }: Props) {
  const chapters = useMemo(() => buildGuideChapters(), []);
  const [chapterId, setChapterId] = useState<GuideChapterId>(1);
  const osReduce = usePrefersReducedMotion();
  const animate = motionMode === 'full' && !osReduce;
  const headRef = useRef<HTMLHeadingElement>(null);

  const tabOptions: readonly ModalTabOption<`${GuideChapterId}`>[] = useMemo(
    () =>
      chapters.map(ch => ({
        value: `${ch.id}`,
        label: `${ch.id}. ${ch.title}`,
        id: `guide-tab-${ch.id}`,
      })),
    [chapters],
  );

  // 탭·고르기 줄 바깥(대화상자·본문)에서도 ←/→/Home/End로 장을 넘길 수 있게 둔다.
  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const widget = (e.target as HTMLElement).closest<HTMLElement>(ARROW_KEY_WIDGETS);
    if (widget && e.currentTarget.contains(widget)) return;
    const next: GuideChapterId =
      e.key === 'ArrowLeft' ? nextGuideChapter(chapterId, -1)
      : e.key === 'ArrowRight' ? nextGuideChapter(chapterId, 1)
      : e.key === 'Home' ? GUIDE_CHAPTER_IDS[0]
      : LAST_CHAPTER;
    e.preventDefault();
    if (next !== chapterId) setChapterId(next);
  };

  const chapter = chapters[chapterId - 1] ?? chapters[0]!;

  return (
    <Modal titleId="guideModalTitle" title={T.title} size="lg" fixed onClose={onBack} onDialogKeyDown={onDialogKeyDown}>
      <ModalTabShell>
        <ModalTabs<`${GuideChapterId}`>
          label={U.tabLabel}
          options={tabOptions}
          value={`${chapter.id}`}
          onChange={v => setChapterId(Number(v) as GuideChapterId)}
          controls="guide-tabpanel"
          className={css.guideTabs}
        />
        <ModalTabPanel id="guide-tabpanel" labelledBy={`guide-tab-${chapter.id}`} pad="sm" className={css.guidePanel}>
          <section className={css.chapter} aria-labelledby="guideChapterTitle" data-chapter={chapter.id}>
            <header className={css.head}>
              <h3 id="guideChapterTitle" ref={headRef} tabIndex={-1} className={css.chapterTitle}>
                {chapterLabel(chapter)}
              </h3>
              <span className={css.headSep} aria-hidden="true">·</span>
              <p className={css.headline} data-content>{chapter.headline}</p>
            </header>

            <div className={css.chapterBody}>
              <Card sunk pad="sm" className={css.stageCol}>
                <GuideVisualStage chapter={chapter} animate={animate} highContrastMap={highContrastMap} />
              </Card>

              <ol className={css.rows} aria-label={`${chapter.title} 요약`}>
                {chapter.rows.map(row => (
                  <li key={row.title} className={css.rowCard}>
                    <div className={css.rowHead}>
                      <span className={css.rowIcon} aria-hidden="true"><GuideRowIcon icon={row.icon} /></span>
                      <span className={css.rowBadge}>{row.badge}</span>
                      <strong className={css.rowTitle}>{row.title}</strong>
                    </div>
                    <p className={css.rowBody} data-content>{row.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </ModalTabPanel>
      </ModalTabShell>
    </Modal>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { OptionId } from '../../contracts/questions';
import type { QuestionStakesView, QuestionView } from '../../application/view';
import { DEFAULTS } from '../../content';
import { fmtSigned } from '../copy';
import { CheckSealIcon, CrossSealIcon } from '../icons/GameIcons';
import kit from '../kit.module.css';
import { useLayout } from '../useLayout';
import css from './QuestionPanel.module.css';

const GRID = DEFAULTS.layout.optionGrid;
const TOUCH = DEFAULTS.layout.touchMinPx;

interface Measured {
  key: string;
  cols: 1 | 2;
  /** 굵게 그린 보기 글자의 최대 높이. 정답 공개로 굵어져도 줄이 늘지 않게 미리 잡는다. */
  textH: number | null;
  /** 세로 적층(narrow)에서 해설 카드 자리 높이. */
  feedbackH: number | null;
}

interface Props {
  question: QuestionView;
  stakes: QuestionStakesView;
  wide: boolean;
  seamLock?: boolean;
  showKeyHints?: boolean;
  onAnswer(choice: OptionId): void;
  onSkip(): void;
  onNext(): void;
}

/**
 * 하단 문제판(PRD §12.5 + 시안 1 v3 상·하단 수직선 잠금 규격).
 * - 보기 4개는 같은 크기·모양이며, 실제 렌더 측정으로 2×2 / 1열을 정한 뒤 제출 전에 고정한다.
 *   측정은 보기 글자를 모두 굵게 그린 상태로 해서, 정답 공개로 굵어져도 줄바꿈·높이가 바뀌지 않는다.
 * - 채점 인장(36px 우측 여백)을 미리 예약해 제출 전후 보기 글자의 가로 흔들림을 0.0px로 유지한다.
 * - 해설 카드는 문제판 높이에 끼워 넣지 않는다. 두 칸 구획에서는 지문·보기 칸이 정한 높이(최소 예산 q)를
 *   채우고, 세로 적층에서는 미리 잡은 자리를 채운다. 넘치면 카드 안 해설만 스크롤한다(PRD §12.4·§12.5).
 * - showKeyHints=false이고 미응답일 때 보기 안에는 숨김 장식 요소를 두지 않는다.
 */
export function QuestionPanel({
  question,
  stakes,
  wide,
  seamLock = false,
  showKeyHints = true,
  onAnswer,
  onSkip,
  onNext,
}: Props) {
  const layout = useLayout();
  const optionsRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured>({ key: '', cols: 2, textH: null, feedbackH: null });
  const armed = useRef<string | null>(null);
  const keyReady = useRef(false);
  const answered = question.chosen !== null;
  const fb = question.feedback;
  const narrow = !seamLock && !wide;
  // 화면 회전·창 크기·글자 크기가 바뀌면 제출 뒤라도 다시 잰다. 굵게 재므로 제출 전후 결과가 같다.
  const measureKey = [
    question.encounterId, wide ? 1 : 0, seamLock ? 1 : 0, showKeyHints ? 1 : 0,
    layout.mode, layout.mapW, layout.railW, layout.font,
  ].join(':');
  const current = measured.key === measureKey;
  const cols = current ? measured.cols : 2;

  useLayoutEffect(() => {
    const box = optionsRef.current;
    if (!box || (current && measured.textH !== null)) return;
    // 1단계: 2열로 그린 상태에서 열 수를 정한다. 2단계: 정한 열 수에서 굵은 글자 높이와 해설 자리를 잡는다.
    box.dataset.measure = 'bold';
    const texts = [...box.querySelectorAll<HTMLElement>('[data-option-text]')];
    const heights = texts.map(t => t.getBoundingClientRect().height);
    delete box.dataset.measure;
    if (!current) {
      const lineHeight = Number.parseFloat(getComputedStyle(texts[0] ?? box).lineHeight) || 27;
      const gap = Number.parseFloat(getComputedStyle(box).columnGap) || 0;
      const cellWidth = (box.clientWidth - gap) / 2;
      const fits = cellWidth >= GRID.twoByTwoMinCellWidthPx && heights.every(h => h <= lineHeight * GRID.twoByTwoMaxLines + 2);
      setMeasured({ key: measureKey, cols: fits ? 2 : 1, textH: null, feedbackH: null });
      return;
    }
    const textH = Math.ceil(Math.max(0, ...heights));
    let feedbackH: number | null = null;
    if (narrow) {
      // 굵은 글자 높이를 잡은 뒤의 보기 높이로 남는 공간을 잰다.
      box.style.setProperty('--option-text-h', `${textH}px`);
      feedbackH = narrowFeedbackHeight(box, answered, layout.qWide);
      box.style.removeProperty('--option-text-h');
    }
    setMeasured({ key: measureKey, cols: measured.cols, textH, feedbackH });
  }, [measureKey, current, measured.cols, measured.textH, answered, narrow, layout.qWide]);

  useEffect(() => {
    keyReady.current = false;
    armed.current = null;
  }, [question.encounterId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable], [data-keyscope="field"]')) return;
      if (!keyReady.current) return;
      const index = ['1', '2', '3', '4'].indexOf(e.key);
      if (index >= 0 && !answered) {
        e.preventDefault();
        onAnswer(question.options[index]!.id);
      } else if ((e.key === 'Enter' || e.key === ' ') && fb?.canNext && document.activeElement === document.body) {
        e.preventDefault();
        onNext();
      }
    };
    const up = () => {
      keyReady.current = true;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [question, answered, fb?.canNext, onAnswer, onNext]);

  const stateOf = (id: OptionId) => {
    if (!answered) return '';
    if (fb && id === fb.correctOptionId) return css.correct;
    if (id === question.chosen) return css.chosenWrong;
    return css.dim;
  };

  const feedbackTone = !fb ? 'idle' : fb.result === 'correct' ? 'correct' : 'wrong';

  const feedback = (
    <div
      className={css.feedback}
      data-tone={feedbackTone}
      aria-live="polite"
      style={narrow && current && measured.feedbackH !== null ? { height: measured.feedbackH } : undefined}
    >
      <div className={css.feedbackBody}>
        {!fb && !answered && (
          <>
            <div className={css.stakeGroup}>
              <div className={css.stakeRow}>
                <span className={css.stakeBadgeOk}>정답</span>
                <strong>+{stakes.correctGold}골드 · +{stakes.correctPt}점</strong>
              </div>
              <div className={css.stakeRow}>
                <span className={css.stakeBadgeSub}>오답</span>
                <span className={css.stakeMuted}>점수 {fmtSigned(stakes.wrongPt)}점 · 해설 제공</span>
              </div>
            </div>
            <div className={css.skipGroup}>
              <button type="button" className={`${kit.button} ${kit.quietWood} ${css.skipBtn}`} onClick={onSkip}>
                모르겠어요
              </button>
              <span className={css.skipNote}>누르면 점수가 줄지 않아요 · 골드 없음</span>
            </div>
          </>
        )}
        {fb?.result === 'correct' && (
          <div className={css.goodBox}>
            <p className={css.good}>
              <CheckSealIcon size={22} label="정답" />
              <span>정답!</span>
            </p>
            {question.reward && (
              <p className={css.reward}>
                {fmtSigned(question.reward.gold)}골드 · {fmtSigned(question.reward.pt)}점 획득
              </p>
            )}
          </div>
        )}
        {fb && fb.result !== 'correct' && (
          <>
            {/* 해설이 카드보다 길면 이 칸만 스크롤한다. 키보드로도 스크롤할 수 있게 포커스를 받는다. */}
            <div className={css.wrongText} tabIndex={0} role="region" aria-label="해설">
              <p className={css.answer}>정답은 ‘{fb.correctText}’예요.</p>
              {fb.chosenRationale && <p className={css.why}>{fb.chosenRationale}</p>}
              <p className={css.why}>{fb.explanation}</p>
              {question.reward && question.reward.pt !== 0 && (
                <p className={css.penalty}>점수 {fmtSigned(question.reward.pt)}점</p>
              )}
            </div>
            <button type="button" className={`${kit.button} ${kit.primary} ${kit.block}`} disabled={!fb.canNext} onClick={onNext}>
              {fb.canNext ? '다음 문제' : `해설을 읽어 주세요 · ${fb.secondsLeft}초`}
            </button>
          </>
        )}
      </div>
    </div>
  );

  const layoutClass = seamLock ? css.seamR : wide ? css.wide : css.narrow;
  const panelStyle = {
    '--q-budget': `${layout.q}px`,
    ...(current && measured.textH !== null ? { '--option-text-h': `${measured.textH}px` } : {}),
  } as CSSProperties;

  return (
    <section
      className={`${kit.board} ${css.panel} ${layoutClass}`}
      style={panelStyle}
      data-tight={layout.compactRail || undefined}
      aria-label="어휘 문제"
    >
      <div className={css.main}>
        <p className={css.stem}>
          <span className={css.chip}>{question.label}</span>
          {question.badge && <span className={css.subchip}>{question.badge}</span>}
          <Stem text={question.stem} />
        </p>
        <div className={css.optionsWell}>
          <div ref={optionsRef} className={css.options} data-cols={cols} role="group" aria-label="보기">
            {question.options.map((o, i) => (
              <button
                key={`${question.encounterId}-${o.id}`}
                type="button"
                className={`${css.option} ${stateOf(o.id)}`}
                disabled={answered}
                aria-pressed={question.chosen === o.id}
                onPointerDown={() => {
                  armed.current = `${question.encounterId}-${o.id}`;
                }}
                onClick={e => {
                  // 키보드 클릭(detail=0)은 허용하고, 포인터 클릭은 이 요소에서 시작한 누름만 받는다.
                  if (e.detail > 0 && armed.current !== `${question.encounterId}-${o.id}`) return;
                  onAnswer(o.id);
                }}
              >
                {showKeyHints && <span className={css.num} aria-hidden="true">{i + 1}</span>}
                <span data-option-text className={css.optionText}>{o.text}</span>
                {answered && fb && o.id === fb.correctOptionId && (
                  <span className={css.sealSlot}>
                    <CheckSealIcon size={22} label="정답" />
                  </span>
                )}
                {answered && fb && o.id === question.chosen && o.id !== fb.correctOptionId && (
                  <span className={css.sealSlot}>
                    <CrossSealIcon size={22} label="고른 답" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      {feedback}
    </section>
  );
}

/**
 * 세로 적층(휴대폰)에서 해설 카드 자리 높이를 제출 전에 정한다.
 * - 최대: 두 칸 구획과 같은 카드 예산(qWide − 문제판 테두리·여백).
 * - 화면에 남는 세로 공간이 있으면 그만큼만 써서 문서가 넘치지 않게 한다.
 * - 남는 공간이 모자라 어차피 스크롤해야 하면(휴대폰 세로 스크롤 허용, PRD §12.1) 대기 내용+터치 한 줄은 지킨다.
 */
function narrowFeedbackHeight(box: HTMLElement, answered: boolean, qWide: number): number {
  const panel = box.closest('section');
  const card = panel?.lastElementChild as HTMLElement | null;
  if (!panel || !card) return qWide;
  const ps = getComputedStyle(panel);
  const px = (v: string) => Number.parseFloat(v) || 0;
  const chrome = px(ps.paddingTop) + px(ps.paddingBottom) + px(ps.borderTopWidth) + px(ps.borderBottomWidth);
  const full = Math.floor(qWide - chrome);
  const idleH = answered ? 0 : Math.ceil(card.firstElementChild?.scrollHeight ?? 0);
  const floor = Math.max(idleH, TOUCH) + TOUCH;
  const slack = document.documentElement.clientHeight - document.documentElement.getBoundingClientRect().height;
  const remaining = Math.floor(card.getBoundingClientRect().height + slack);
  return Math.max(idleH, Math.min(full, Math.max(remaining, floor)));
}

/** 빈칸 ‘(    )’을 읽기 쉬운 밑줄 칸으로 바꾼다. 스크린리더에는 ‘빈칸’으로 읽힌다. */
function Stem({ text }: { text: string }) {
  const parts = text.split(/\(\s+\)/);
  if (parts.length === 1) return <span>{text}</span>;
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className={css.blank} role="img" aria-label="빈칸" />}
        </span>
      ))}
    </span>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { OptionId } from '../../contracts/questions';
import type { QuestionStakesView, QuestionView } from '../../application/view';
import { fmtSigned } from '../copy';
import { CheckSealIcon, CrossSealIcon, GoldCoinIcon, ScoreCrestIcon } from '../icons/GameIcons';
import css from './QuestionPanel.module.css';

interface Props {
  question: QuestionView;
  stakes: QuestionStakesView;
  wide: boolean;
  seamLock?: boolean;
  showKeyHints?: boolean;
  /** 2×2 배치에 필요한 칸 최소 너비(계약 layout.optionGrid). */
  twoByTwoMinPx?: number;
  /** 정답 금화가 날아오를 자리(보상 칩). */
  rewardRef?: Ref<HTMLSpanElement>;
  onAnswer(choice: OptionId): void;
  onSkip(): void;
  onNext(): void;
}

/**
 * 하단 양피지 문제판과 나무 답안 키(ui-rules-v2 §1, PRD §12.5).
 * - 보기 4개는 같은 크기·모양이며, 실제 렌더 측정으로 2×2 / 1열을 정한 뒤 제출 전에 고정한다.
 * - 제출 흔들림 0: 채점 인장 자리(오른쪽 36px)를 미리 비워 두고, 채점 뒤에도 글자 굵기·테두리 두께·위치를 바꾸지 않는다.
 *   고른 키는 눌린 채(안쪽 그림자) 붉게 바래고, 정답 키는 바깥 그림자로 떠오른다. 보상·해설 칸은 높이가 고정이고 안에서만 넘긴다.
 */
export function QuestionPanel({
  question,
  stakes,
  wide,
  seamLock = false,
  showKeyHints = true,
  twoByTwoMinPx = 200,
  rewardRef,
  onAnswer,
  onSkip,
  onNext,
}: Props) {
  const optionsRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<{ key: string; cols: 1 | 2 }>({ key: '', cols: 2 });
  const armed = useRef<string | null>(null);
  const keyReady = useRef(false);
  const answered = question.chosen !== null;
  const fb = question.feedback;
  const measureKey = `${question.encounterId}:${wide ? 1 : 0}:${seamLock ? 1 : 0}:${showKeyHints ? 1 : 0}`;
  const cols = columns.key === measureKey ? columns.cols : 2;

  useLayoutEffect(() => {
    if (answered || columns.key === measureKey) return;
    const box = optionsRef.current;
    if (!box) return;
    const buttons = [...box.querySelectorAll<HTMLElement>('[data-option-text]')];
    const lineHeight = Number.parseFloat(getComputedStyle(buttons[0] ?? box).lineHeight) || 27;
    const cellWidth = (box.clientWidth - 8) / 2;
    const fits = cellWidth >= twoByTwoMinPx && buttons.every(b => b.scrollHeight <= lineHeight * 2 + 2);
    setColumns({ key: measureKey, cols: fits ? 2 : 1 });
  }, [measureKey, answered, columns.key, twoByTwoMinPx]);

  useEffect(() => {
    keyReady.current = false;
    armed.current = null;
  }, [question.encounterId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable], [data-keyscope="field"], [role="dialog"]')) return;
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
    if (!answered) return undefined;
    // 채점은 다음 논리 틱에 온다. 그 사이에는 고른 키만 눌린 채로 둔다.
    if (!fb) return id === question.chosen ? 'chosen' : undefined;
    if (id === fb.correctOptionId) return 'correct';
    if (id === question.chosen) return 'wrong';
    return 'dim';
  };

  const tone = !fb ? 'idle' : fb.result === 'correct' ? 'correct' : 'wrong';
  const skipNoteId = `skip-note-${question.encounterId}`;

  const feedback = (
    <div className={css.feedback} data-tone={tone} aria-live="polite">
      {!fb && !answered && (
        <>
          <div className={css.stakes}>
            <span className={css.stake} aria-label={`정답이면 골드 ${stakes.correctGold}, 점수 ${stakes.correctPt}`}>
              <CheckSealIcon size={18} />
              <span className={css.chip}><GoldCoinIcon size={15} />+{stakes.correctGold}</span>
              <span className={css.chip}><ScoreCrestIcon size={15} />+{stakes.correctPt}</span>
            </span>
            <span className={css.stake} aria-label={`오답이면 점수 ${fmtSigned(stakes.wrongPt)}, 해설을 보여 줘요`}>
              <CrossSealIcon size={18} />
              <span className={css.chip} data-tone="loss"><ScoreCrestIcon size={15} />{fmtSigned(stakes.wrongPt)}</span>
            </span>
          </div>
          <button type="button" className={css.skip} aria-describedby={skipNoteId} onClick={onSkip}>모르겠어요</button>
          <span id={skipNoteId} className="sr-only">누르면 점수가 줄지 않아요. 골드는 받지 않아요.</span>
        </>
      )}
      {answered && !fb && <span className={css.grading} aria-hidden="true" />}
      {fb?.result === 'correct' && (
        <div className={css.goodBox}>
          <p className={css.good}>
            <CheckSealIcon size={28} label="정답" />
            <span>정답!</span>
          </p>
          {question.reward && (
            <p className={css.rewards} aria-label={`골드 ${fmtSigned(question.reward.gold)}, 점수 ${fmtSigned(question.reward.pt)}`}>
              <span ref={rewardRef} className={css.chip} data-tone="gain"><GoldCoinIcon size={16} />{fmtSigned(question.reward.gold)}</span>
              <span className={css.chip} data-tone="gain"><ScoreCrestIcon size={16} />{fmtSigned(question.reward.pt)}</span>
            </p>
          )}
        </div>
      )}
      {fb && fb.result !== 'correct' && (
        <div className={css.wrongBox}>
          <div className={css.explain}>
            <p className={css.answer}>정답은 ‘{fb.correctText}’예요.</p>
            {fb.chosenRationale && <p className={css.why}>{fb.chosenRationale}</p>}
            <p className={css.why}>{fb.explanation}</p>
          </div>
          <div className={css.nextRow}>
            {question.reward && question.reward.pt !== 0 && (
              <span className={css.chip} data-tone="loss" aria-label={`점수 ${fmtSigned(question.reward.pt)}`}><ScoreCrestIcon size={15} />{fmtSigned(question.reward.pt)}</span>
            )}
            <button type="button" className={css.next} disabled={!fb.canNext} onClick={onNext}>
              {fb.canNext ? '다음 문제' : `해설을 읽어 주세요 · ${fb.secondsLeft}초`}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const layoutClass = seamLock ? css.seamR : wide ? css.wide : css.narrow;

  return (
    <section className={`${css.panel} ${layoutClass}`} aria-label="어휘 문제">
      <div className={css.main}>
        <p className={css.stem}>
          <span className={css.label}>{question.label}</span>
          {question.badge && <span className={css.badge}>{question.badge}</span>}
          <Stem text={question.stem} />
        </p>
        <div ref={optionsRef} className={css.options} data-cols={cols} role="group" aria-label="보기">
          {question.options.map((o, i) => {
            const state = stateOf(o.id);
            return (
              <button
                key={`${question.encounterId}-${o.id}`}
                type="button"
                className={css.option}
                data-state={state}
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
                <span className={css.sealSlot}>
                  {state === 'correct' && <CheckSealIcon size={22} label="정답" />}
                  {state === 'wrong' && <CrossSealIcon size={22} label="고른 답" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {feedback}
    </section>
  );
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

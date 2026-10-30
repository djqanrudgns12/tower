import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OptionId } from '../../contracts/questions';
import type { QuestionStakesView, QuestionView } from '../../application/view';
import { fmtSigned } from '../copy';
import { CheckSealIcon, CrossSealIcon } from '../icons/GameIcons';
import kit from '../kit.module.css';
import css from './QuestionPanel.module.css';

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
 * - 채점 인장(36px 우측 여백)을 미리 예약해 제출 전후 보기 글자의 가로 흔들림을 0.0px로 유지한다.
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
    const fits = cellWidth >= 200 && buttons.every(b => b.scrollHeight <= lineHeight * 2 + 2);
    setColumns({ key: measureKey, cols: fits ? 2 : 1 });
  }, [measureKey, answered, columns.key]);

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
    <div className={css.feedback} data-tone={feedbackTone} aria-live="polite">
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
        <div className={css.wrongBox}>
          <p className={css.answer}>정답은 ‘{fb.correctText}’예요.</p>
          {fb.chosenRationale && <p className={css.why}>{fb.chosenRationale}</p>}
          <p className={css.why}>{fb.explanation}</p>
          {question.reward && question.reward.pt !== 0 && (
            <p className={css.penalty}>점수 {fmtSigned(question.reward.pt)}점</p>
          )}
          <button type="button" className={`${kit.button} ${kit.primary} ${kit.block}`} disabled={!fb.canNext} onClick={onNext}>
            {fb.canNext ? '다음 문제' : `해설을 읽어 주세요 · ${fb.secondsLeft}초`}
          </button>
        </div>
      )}
    </div>
  );

  const layoutClass = seamLock ? css.seamR : wide ? css.wide : css.narrow;

  return (
    <section className={`${kit.board} ${css.panel} ${layoutClass}`} aria-label="어휘 문제">
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

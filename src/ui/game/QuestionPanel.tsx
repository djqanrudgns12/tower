import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OptionId } from '../../contracts/questions';
import type { QuestionView } from '../../application/view';
import { fmtSigned } from '../copy';
import kit from '../kit.module.css';
import css from './QuestionPanel.module.css';

interface Props {
  question: QuestionView;
  wide: boolean;
  onAnswer(choice: OptionId): void;
  onSkip(): void;
  onNext(): void;
}

/**
 * 하단 문제판(PRD §12.5). 보기 4개는 같은 모양이고, 2×2/1열은 실제 렌더 측정으로 정한 뒤 제출 전에 고정한다.
 * 유령 입력 방지: 보기는 encounter마다 새 DOM이며, 그 요소에서 시작한 누름만 제출한다. 숫자키는 반복 입력과
 * 문항 전환 뒤 첫 keyup 전 입력을 버린다.
 */
export function QuestionPanel({ question, wide, onAnswer, onSkip, onNext }: Props) {
  const optionsRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<{ id: number; cols: 1 | 2 }>({ id: -1, cols: 2 });
  const armed = useRef<string | null>(null);
  const keyReady = useRef(false);
  const answered = question.chosen !== null;
  const fb = question.feedback;
  const cols = columns.id === question.encounterId ? columns.cols : 2;

  useLayoutEffect(() => {
    if (answered || columns.id === question.encounterId) return;
    const box = optionsRef.current;
    if (!box) return;
    const buttons = [...box.querySelectorAll<HTMLElement>('[data-option-text]')];
    const lineHeight = Number.parseFloat(getComputedStyle(buttons[0] ?? box).lineHeight) || 27;
    const cellWidth = (box.clientWidth - 8) / 2;
    const fits = cellWidth >= 160 && buttons.every(b => b.scrollHeight <= lineHeight * 2 + 2);
    setColumns({ id: question.encounterId, cols: fits ? 2 : 1 });
  }, [question.encounterId, answered, columns.id]);

  useEffect(() => { keyReady.current = false; armed.current = null; }, [question.encounterId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable], [data-keyscope="field"]')) return;
      if (!keyReady.current) return;
      const index = ['1', '2', '3', '4'].indexOf(e.key);
      if (index >= 0 && !answered) { e.preventDefault(); onAnswer(question.options[index]!.id); }
      else if ((e.key === 'Enter' || e.key === ' ') && fb?.canNext && document.activeElement === document.body) { e.preventDefault(); onNext(); }
    };
    const up = () => { keyReady.current = true; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [question, answered, fb?.canNext, onAnswer, onNext]);

  const stateOf = (id: OptionId) => {
    if (!answered) return '';
    if (fb && id === fb.correctOptionId) return css.correct;
    if (id === question.chosen) return css.chosenWrong;
    return css.dim;
  };

  const feedback = (
    <div className={css.feedback} aria-live="polite">
      {!fb && !answered && (
        <>
          <button type="button" className={`${kit.button} ${kit.quiet}`} onClick={onSkip}>모르겠어요</button>
          <p className={kit.muted}>누르면 점수가 줄지 않아요. 대신 골드도 없어요.</p>
        </>
      )}
      {fb?.result === 'correct' && (
        <p className={css.good}><Mark kind="ok" /> 정답! <span className={css.reward}>{question.reward && `${fmtSigned(question.reward.gold)}골드 · ${fmtSigned(question.reward.pt)}점`}</span></p>
      )}
      {fb && fb.result !== 'correct' && (
        <>
          <p className={css.answer}>정답은 ‘{fb.correctText}’예요.</p>
          {fb.chosenRationale && <p className={css.why}>{fb.chosenRationale}</p>}
          <p className={css.why}>{fb.explanation}</p>
          {question.reward && question.reward.pt !== 0 && <p className={kit.muted}>점수 {fmtSigned(question.reward.pt)}</p>}
          <button type="button" className={`${kit.button} ${kit.primary}`} disabled={!fb.canNext} onClick={onNext}>
            {fb.canNext ? '다음 문제' : `해설을 읽어 주세요 · ${fb.secondsLeft}초`}
          </button>
        </>
      )}
    </div>
  );

  return (
    <section className={`${kit.board} ${css.panel} ${wide ? css.wide : css.narrow}`} aria-label="어휘 문제">
      <div className={css.main}>
        <p className={css.stem}><span className={css.chip}>{question.label}</span><Stem text={question.stem} /></p>
        <div ref={optionsRef} className={css.options} data-cols={cols} role="group" aria-label="보기">
          {question.options.map((o, i) => (
            <button
              key={`${question.encounterId}-${o.id}`}
              type="button"
              className={`${css.option} ${stateOf(o.id)}`}
              disabled={answered}
              aria-pressed={question.chosen === o.id}
              onPointerDown={() => { armed.current = `${question.encounterId}-${o.id}`; }}
              onClick={e => {
                // 키보드 클릭(detail=0)은 허용하고, 포인터 클릭은 이 요소에서 시작한 누름만 받는다.
                if (e.detail > 0 && armed.current !== `${question.encounterId}-${o.id}`) return;
                onAnswer(o.id);
              }}
            >
              <span className={css.num} aria-hidden="true">{i + 1}</span>
              <span data-option-text className={css.optionText}>{o.text}</span>
              {answered && fb && o.id === fb.correctOptionId && <Mark kind="ok" />}
              {answered && fb && o.id === question.chosen && o.id !== fb.correctOptionId && <Mark kind="no" />}
            </button>
          ))}
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
  return <span>{parts.map((part, i) => <span key={i}>{part}{i < parts.length - 1 && <span className={css.blank} role="img" aria-label="빈칸" />}</span>)}</span>;
}

function Mark({ kind }: { kind: 'ok' | 'no' }) {
  return kind === 'ok'
    ? <svg className={css.mark} viewBox="0 0 20 20" aria-label="정답" role="img"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg className={css.mark} viewBox="0 0 20 20" aria-label="고른 답" role="img"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

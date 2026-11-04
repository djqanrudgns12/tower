import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OptionId } from '../../contracts/questions';
import type { QuestionView } from '../../application/view';
import { DEFAULTS } from '../../content';
import { CheckIcon, CrossIcon } from '../icons/ControlIcons';
import { Button, Card } from '../kit';
import { useLayout } from '../useLayout';
import css from './QuestionPanel.module.css';

const GRID = DEFAULTS.layout.optionGrid;

/** 국면 태그 하나(준비=초록, 전투=호박, 대장=빨강). 마무리 문제는 준비와 같은 초록이다. */
export interface PhaseTag { text: string; tone: 'prep' | 'battle' | 'boss' }

interface Props {
  question: QuestionView;
  phase: PhaseTag;
  /** 준비 문제 진행 점(준비 단계에서만). */
  prep: { done: number; target: number } | null;
  /** seam: R 모드(오른쪽 열이 레일과 수직선을 맞춘다), wide: 태블릿 두 칸, narrow: 휴대폰. */
  variant: 'seam' | 'wide' | 'narrow';
  showKeyHints?: boolean;
  /** 2×2 배치에 필요한 칸 최소 너비(계약 layout.optionGrid). */
  twoByTwoMinPx?: number;
  onAnswer(choice: OptionId): void;
  onSkip(): void;
  onNext(): void;
}

/**
 * 문제 카드(R4 PRD §9.1): 국면 태그 + 준비 점 + 문제, 2×2 답안 키캡(56px), 오른쪽 열 바닥의 ‘모르겠어요’(글자만 있는 ghost 버튼이라 다섯째 답안 키로 보이지 않는다. 휴대폰은 오른쪽 위 작은 보조 버튼).
 * - 보기 4개는 같은 크기이며, 실제 렌더 측정으로 2×2 / 1열을 정한 뒤 제출 전에 고정한다.
 * - 제출 흔들림 0: 채점 뒤에는 면 색과 투명도만 바뀐다. 해설은 오른쪽 열(넓은 화면) 또는 카드 위 말풍선(휴대폰)에 나와 보기를 밀지 않는다.
 * - 정답: 고른 키가 초록이 되고 금화가 상태 카드의 골드로 날아간다(화면이 그린다). 오답: 고른 키가 붉게 바래고 정답 키가 초록이 되며 해설 한 칸.
 */
export function QuestionPanel({
  question,
  phase,
  prep,
  variant,
  showKeyHints = true,
  twoByTwoMinPx = GRID.twoByTwoMinCellWidthPx,
  onAnswer,
  onSkip,
  onNext,
}: Props) {
  const layout = useLayout();
  const optionsRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<{ key: string; cols: 1 | 2 }>({ key: '', cols: 2 });
  const armed = useRef<string | null>(null);
  const keyReady = useRef(false);
  const answered = question.chosen !== null;
  const fb = question.feedback;
  // 화면 회전·창 크기·글자 크기가 바뀌면 제출 뒤라도 다시 잰다. 채점 뒤에도 글자 굵기가 그대로라 제출 전후 결과가 같다.
  const measureKey = [question.encounterId, variant, showKeyHints ? 1 : 0, layout.mode, layout.mapW, layout.railW, layout.font].join(':');
  const cols = columns.key === measureKey ? columns.cols : 2;

  useLayoutEffect(() => {
    if (columns.key === measureKey) return;
    const box = optionsRef.current;
    if (!box) return;
    // 2열로 그린 상태에서 칸 너비(계약 optionGrid)와 줄 수를 재어 열 수를 정한다.
    const texts = [...box.querySelectorAll<HTMLElement>('[data-option-text]')];
    const lineHeight = Number.parseFloat(getComputedStyle(texts[0] ?? box).lineHeight) || 25;
    const gap = Number.parseFloat(getComputedStyle(box).columnGap) || 0;
    const cellWidth = (box.clientWidth - gap) / 2;
    // 휴대폰은 2×2 보기에 세 줄까지 둔다(계약 twoByTwoMaxLinesNarrow): 한 줄씩 네 칸이면 문제 카드가 240px을 넘는다(R4 PRD §9.3).
    const maxLines = variant === 'narrow' ? GRID.twoByTwoMaxLinesNarrow : GRID.twoByTwoMaxLines;
    const fits = cellWidth >= twoByTwoMinPx && texts.every(t => t.scrollHeight <= lineHeight * maxLines + 2);
    setColumns({ key: measureKey, cols: fits ? 2 : 1 });
  }, [measureKey, columns.key, twoByTwoMinPx, variant]);

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
    // 채점은 다음 논리 틱에 온다. 그 사이에는 고른 키만 표시한다.
    if (!fb) return id === question.chosen ? 'chosen' : undefined;
    if (id === fb.correctOptionId) return 'correct';
    if (id === question.chosen) return 'wrong';
    return 'dim';
  };

  const skipNoteId = `skip-note-${question.encounterId}`;
  const missed = fb !== null && fb.result !== 'correct';
  const explain = missed ? (
    <div className={css.explainBox}>
      <p className="sr-only">정답은 ‘{fb.correctText}’예요.</p>
      <p className={css.explain} data-explain data-content>{fb.explanation}</p>
      <Button variant="primary" block disabled={!fb.canNext} onClick={onNext}>
        {fb.canNext ? '다음 문제' : `다음 문제 · ${fb.secondsLeft}초`}
      </Button>
    </div>
  ) : null;

  const panelClass = variant === 'seam' ? css.seam : variant === 'wide' ? css.wide : css.narrow;

  return (
    <Card as="section" float className={`${css.panel} ${panelClass}`} aria-label="어휘 문제">
      <div className={css.main} data-content>
        <p className={css.stem}>
          <span className={css.tag} data-tone={phase.tone}>{phase.text}</span>
          {prep && (
            <span className={css.dots} role="img" aria-label={question.label}>
              {Array.from({ length: prep.target }, (_, i) => (
                <span key={i} className={css.dot} data-on={i < prep.done || undefined} data-now={i === prep.done || undefined} />
              ))}
            </span>
          )}
          {question.badge && <span className={css.badge}>{question.badge}</span>}
          <Stem text={question.stem} />
        </p>
        <div ref={optionsRef} className={css.options} data-cols={cols} role="group" aria-label="보기">
          {question.options.map((o, i) => {
            const state = stateOf(o.id);
            return (
              <Button
                key={`${question.encounterId}-${o.id}`}
                size="lg"
                art={false}
                className={css.option}
                data-state={state}
                data-option-id={o.id}
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
                <span className={css.seal}>
                  {state === 'correct' && <CheckIcon size={24} />}
                  {state === 'wrong' && <CrossIcon size={24} />}
                  {state === 'correct' && <span className="sr-only">정답</span>}
                  {state === 'wrong' && <span className="sr-only">고른 답</span>}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
      <div className={css.side} data-feedback data-tone={!fb ? 'idle' : fb.result === 'correct' ? 'correct' : 'wrong'} aria-live="polite">
        {!answered && (
          <>
            <Button variant={variant === 'narrow' ? 'secondary' : 'ghost'} size={variant === 'narrow' ? 'md' : 'lg'} art={false} className={css.skip} aria-describedby={skipNoteId} onClick={onSkip}>모르겠어요</Button>
            <span id={skipNoteId} className="sr-only">누르면 점수가 줄지 않아요. 골드는 받지 않아요.</span>
          </>
        )}
        {fb?.result === 'correct' && (
          <p className={css.good}>
            <CheckIcon size={variant === 'narrow' ? 22 : 28} />
            <span>정답!</span>
          </p>
        )}
        {explain}
      </div>
    </Card>
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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OptionId } from '../../contracts/questions';
import type { QuestionView } from '../../application/view';
import { DEFAULTS } from '../../content';
import { CheckIcon, CrossIcon } from '../icons/ControlIcons';
import { ArtIcon, Button, Card } from '../kit';
import { useLayout } from '../useLayout';
import { answerLine, EARNED_LABEL, readLock, REVIEW_BADGE, REVIEW_BADGE_LABEL, STAKES_LABEL, stakesGold } from './gameCopy';
import css from './QuestionPanel.module.css';

const GRID = DEFAULTS.layout.optionGrid;

/** 국면 태그 하나(준비=초록, 전투=호박, 대장=빨강). 마무리 문제는 준비와 같은 초록이다. */
export interface PhaseTag { text: string; tone: 'prep' | 'battle' | 'boss' }

interface Props {
  question: QuestionView;
  phase: PhaseTag;
  /** 준비 문제 진행 점(준비 단계에서만). */
  prep: { done: number; target: number } | null;
  /** 이 문제를 맞히면 받을 골드(view.stakes.correctGold: 웨이브·연속 정답 보너스·보물 합산, 엔진 채점과 같은 식). */
  correctGold: number;
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
 * 문제 카드(R4 PRD §9.1 + R5 B2·B3·B4·B10·B14): 국면 태그 + 준비 점 + 복습 배지 + 문제, 2×2 답안 키캡(56px), 오른쪽 열은 음각 홈 한 칸
 * (옛 보상 상자 자리: 위 "정답이면 +N 골드", 아래 ‘모르겠어요’. 글자만 있는 ghost 버튼이라 다섯째 답안 키로 보이지 않는다. 휴대폰은 오른쪽 위 작은 칸).
 * - 보기 4개는 같은 크기이며, 실제 렌더 측정으로 2×2 / 1열을 정한 뒤 제출 전에 고정한다.
 * - 제출 흔들림 0: 채점 뒤에는 면 색·바닥 두께·투명도만 바뀐다(정답 키는 바닥 6px로 떠오르고, 오답 키는 바닥 0으로 눌린 채, v4 §7.4 transform 금지).
 *   해설은 오른쪽 열(넓은 화면, 열 안에서만 스크롤) 또는 카드 위 말풍선(휴대폰)에 나와 보기를 밀지 않는다.
 * - 정답: 고른 키가 초록이 되고 받은 골드 칩, 금화가 상태 카드의 골드로 날아간다(화면이 그린다). 오답: 고른 키가 붉게 눌리고 정답 키가 초록으로 떠오르며,
 *   해설 칸 맨 위에 "왜 그 보기가 아닌지" 한 줄(chosenRationale), 잠금 동안 다음 문제 키는 "해설을 읽어 주세요 · N초".
 */
export function QuestionPanel({
  question,
  phase,
  prep,
  correctGold,
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
  const narrow = variant === 'narrow';
  // 보상 미리보기 값은 답한 순간에 고정한다(B2). 답하면 엔진이 연속 정답 수를 바로 바꿔 correctGold가 다음 문제 값이 되므로,
  // 채점 전 한 틱·채점 뒤에도 보던 숫자가 바뀌지 않게 문제마다 답하기 전 마지막 값을 붙든다(렌더 중 파생 상태).
  const [stakeAt, setStakeAt] = useState({ id: question.encounterId, gold: correctGold });
  if (!answered && (stakeAt.id !== question.encounterId || stakeAt.gold !== correctGold)) setStakeAt({ id: question.encounterId, gold: correctGold });
  const stakeGold = stakeAt.id === question.encounterId ? stakeAt.gold : correctGold;
  /** 채점 뒤 받은 골드(오답·모르겠어요는 0). 채점 전에는 null. */
  const earned = fb ? (question.reward?.gold ?? 0) : null;
  const missed = fb !== null && fb.result !== 'correct';
  // 오답 이유는 해설 칸 맨 위 한 줄(옛 문제판 B3). 해설·이유는 읽는 글이라 글자 크기 설정을 따른다(--read-font).
  const explain = missed ? (
    <div className={css.explainBox}>
      <div className={css.explainText} data-content>
        <p className="sr-only">{answerLine(fb.correctText)}</p>
        {fb.chosenRationale && (
          <p className={css.why} data-why>
            <CrossIcon size={16} />
            <span>{fb.chosenRationale}</span>
          </p>
        )}
        <p className={css.explain} data-explain>{fb.explanation}</p>
      </div>
      <Button variant="primary" block disabled={!fb.canNext} onClick={onNext}>
        {fb.canNext ? '다음 문제' : readLock(fb.secondsLeft)}
      </Button>
    </div>
  ) : null;
  // 보상 미리보기(B2). 오답 −점수 칩은 되살리지 않는다(계획서 §5.2). 넓은 화면은 오른쪽 칸 위에 채점 전까지,
  // 휴대폰은 오른쪽 위 칸에 자리가 없어 문제 줄 머리(태그 옆)에 둔다. 휴대폰 칩은 채점 뒤에도 그대로 둬 문제 줄이 다시 흐르지 않는다(제출 흔들림 0).
  const stake = !fb && !narrow ? (
    <p className={css.stake}>
      <span className={css.stakeLabel}>{STAKES_LABEL}</span>
      <span className={css.stakeValue}>
        <ArtIcon name="coin" size={22} />
        {stakesGold(stakeGold)}
      </span>
    </p>
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
          {question.isReview && (
            <span className={css.review} title={REVIEW_BADGE_LABEL}>
              <ArtIcon name="note" size={16} />
              {REVIEW_BADGE}
            </span>
          )}
          {question.badge && <span className={css.badge}>{question.badge}</span>}
          {narrow && (
            // 좁은 문제 줄을 덜 꺾도록 금화 + "+N"만 보이고(금화가 곧 골드), 화면 읽기는 "정답이면 +N 골드" → 채점 뒤 "받은 골드 +N 골드".
            // 채점 뒤에는 받은 골드를 보인다. 두 값을 같은 칸에 겹쳐 두어 칩 너비가 그대로라 문제 줄이 다시 흐르지 않는다(제출 흔들림 0).
            <span className={css.stakeTag} data-stake data-missed={earned === 0 || undefined}>
              <span className="sr-only">{earned === null ? `${STAKES_LABEL} ${stakesGold(stakeGold)}` : `${EARNED_LABEL} ${stakesGold(earned)}`}</span>
              <ArtIcon name="coin" size={14} />
              <span className={css.stakeNums} aria-hidden="true">
                <span data-shown={earned === null || undefined}>+{stakeGold}</span>
                <span data-shown={earned !== null || undefined}>+{earned ?? 0}</span>
              </span>
            </span>
          )}
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
      <div className={css.side} data-feedback data-tone={!fb ? 'idle' : fb.result === 'correct' ? 'correct' : 'wrong'}>
        {stake}
        <div className={css.result} aria-live="polite">
          {fb?.result === 'correct' && (
            <>
              <p className={css.good}>
                <CheckIcon size={narrow ? 22 : 28} />
                <span>정답!</span>
              </p>
              {!narrow && question.reward && question.reward.gold > 0 && (
                <p className={css.stakeValue} data-earned>
                  <span className="sr-only">{EARNED_LABEL}</span>
                  <ArtIcon name="coin" size={22} />
                  {stakesGold(question.reward.gold)}
                </p>
              )}
            </>
          )}
          {explain}
        </div>
        {!answered && (
          <>
            <Button variant={narrow ? 'secondary' : 'ghost'} size={narrow ? 'md' : 'lg'} art={false} className={css.skip} aria-describedby={skipNoteId} onClick={onSkip}>모르겠어요</Button>
            <span id={skipNoteId} className="sr-only">누르면 점수가 줄지 않아요. 골드는 받지 않아요.</span>
          </>
        )}
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

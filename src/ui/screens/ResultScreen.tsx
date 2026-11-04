import { useEffect, useId, useState } from 'react';
import { reviewQuestions } from '../../content';
import { computeHonorPoints } from '../../contracts/lobby';
import type { RunState } from '../../domain/types';
import { DIFFICULTY_COPY, fmtNumber, RESULT_COPY as T, resultHeadline } from '../copy';
import { BackIcon, RetryIcon } from '../icons/ControlIcons';
import { ArtIcon, Button, Card, Stat } from '../kit';
import { RESULT_EXTRA as X } from './home/homeCopy';
import frame from './home/windowFrame.module.css';
import css from './ResultScreen.module.css';
import { countUpAt, runLog } from './resultModel';

/** 오답 노트에 새로 담은 낱말 수·외운(졸업한) 낱말 수. `controller.getView().reviewDelta`와 같은 모양이다. */
export interface ResultReviewDelta { added: number; graduated: number }

interface Props {
  state: RunState;
  /** 이 판이 노트에 담은 값. null이면 노트 줄을 보이지 않는다. */
  reviewDelta?: ResultReviewDelta | null;
  /** 이 판 전까지 이 기기의 같은 학년·난이도 최고 기록(지킨 웨이브). 없으면 null. 첫 줄의 '새 최고 기록'·'아까워요'를 가른다. */
  previousBest?: number | null;
  /** 있으면 노트 줄에 '노트 보기' 버튼을 단다. 없으면 노트 줄을 보이지 않는다. */
  onOpenNote?(): void;
  onAgain(): void;
  onHome(): void;
}

interface ReviewItem { id: number; lemma: string; answer: string; stem: string; explanation: string }

/** 움직임 줄이기(기기 설정 또는 게임 설정 '정지')인가. 켜져 있으면 숫자 올라가기·팝 대신 투명도만 쓴다(v4 §7.3). */
function prefersStill(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.motion === 'minimal' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** 0에서 target까지 한 번 올라가는 숫자(약 0.4초, 끝이 느려지는 곡선). still이면 바로 target이다. */
function useCountUp(target: number, still: boolean, ms = 420): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (still || target <= 0) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setN(countUpAt(target, p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, still, ms]);
  return still ? target : n;
}

/**
 * 결과와 복습(R4 U3 → R5 R1·R2, PRD §10.1). 결과 창(성문 + 지킨 웨이브 + 한 줄 + 정답·처치·점수) 바로 아래에 다시 하기·홈이 붙는다.
 * '이번 판 기록'은 접어 두었다가 누르면 푼 문제·모르겠어요·만난 낱말을 보인다(퍼센트·숙련도는 없다, PRD §20.5).
 * 틀리거나 넘긴 낱말이 있을 때만 옆에 ‘틀린 낱말’ 창이 선다(없으면 빈 창을 그리지 않고 결과 창이 가운데에 선다).
 * 복습 재풀이는 보상이 없으므로(PRD §2.2) 여기서는 낱말 카드를 눌러 해설만 펼쳐 보인다.
 */
export function ResultScreen({ state, reviewDelta = null, previousBest = null, onOpenNote, onAgain, onHome }: Props) {
  const questions = reviewQuestions(state.config.grade);
  const answers = state.quiz.history;
  const total = answers.length;
  // 틀리거나 '모르겠어요'로 넘긴 문항을 한 번씩만. 철회된 문항은 해설을 다시 보여 주지 않는다(PRD §9.5).
  const missed = answers.filter(a => a.answer && !a.answer.correct);
  const items: ReviewItem[] = [...new Map(missed.map(a => [a.questionId, a])).values()].flatMap(a => {
    const q = questions.get(a.questionId);
    if (!q) return [];
    return [{ id: a.id, lemma: q.target.lemma, answer: q.options.find(o => o.id === q.correctOptionId)!.text, stem: q.stem, explanation: q.explanation }];
  });
  const honorPt = computeHonorPoints({
    pt: state.pt,
    difficulty: state.config.difficulty,
    completedWave: state.completedWave,
    correct: state.stats.correct,
  });
  const headline = resultHeadline({ endReason: state.endReason, completedWave: state.completedWave, previousBest });
  const noteParts = reviewDelta
    ? [
        reviewDelta.added > 0 ? `${T.noteAdded} ${reviewDelta.added}` : null,
        reviewDelta.graduated > 0 ? `${T.noteGraduated} ${reviewDelta.graduated}` : null,
      ].filter((p): p is string => p !== null)
    : [];

  const hasReview = items.length > 0;
  // R1 이번 판 기록(푼 문제·모르겠어요·만난 낱말)과 R2 만점 칭찬의 숫자.
  const log = runLog(state.stats, answers.filter(a => a.answer), id => questions.get(id)?.target.senseKey);

  const [still] = useState(prefersStill);
  const wave = useCountUp(state.completedWave, still);
  const logId = useId();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <main className={css.page}>
      <div className={css.scroll}>
        <div className={css.body} data-review={hasReview || undefined}>
          {/* 결과 창과 그 바로 아래 단추 두 개가 한 칸이다. 틀린 낱말이 없으면 이 칸만 가운데에 선다. */}
          <div className={css.resultCol}>
            <section className={`${frame.window} ${css.summary}`} aria-labelledby="resultWave">
              <p className={css.meta}>{state.config.nickname} · {state.config.grade}학년 · {DIFFICULTY_COPY[state.config.difficulty].label}</p>
              <div className={frame.rule} aria-hidden="true" />
              <ArtIcon name="gate" size={72} />
              {/* 화면 읽기에는 처음부터 끝 값을 읽히고, 눈에 보이는 숫자만 올라간다. 움직임 줄이기면 올라가지 않고 투명도로만 나타난다. */}
              <h1 id="resultWave" className={css.wave}>
                <span className="sr-only">{T.waveSr} {state.completedWave}{T.wave}</span>
                <span aria-hidden="true" className={css.waveNum} data-still={still || undefined}>{wave}{T.wave}</span>
              </h1>
              <p className={css.line} data-kind={headline.kind} data-pop={headline.kind === 'newBest' || undefined}>{headline.text}</p>
              {log.perfect && <p className={css.praise}>{X.perfect}</p>}

              <div className={css.stats}>
                <Card sunk pad="sm" className={css.tile ?? ''}><Stat icon={null} value={`${state.stats.correct}/${total}`} label={T.correct} className={css.stat ?? ''} /></Card>
                <Card sunk pad="sm" className={css.tile ?? ''}><Stat icon={null} value={fmtNumber(state.stats.kills)} label={T.kills} className={css.stat ?? ''} /></Card>
                <Card sunk pad="sm" className={css.tile ?? ''}><Stat icon={null} value={fmtNumber(state.pt)} label={T.score} className={css.stat ?? ''} /></Card>
              </div>

              <p className={css.ranking}>{T.ranking} <strong>{honorPt > 0 ? `+${fmtNumber(honorPt)}` : '0'}</strong></p>
              {onOpenNote && noteParts.length > 0 && (
                <div className={css.note}>
                  <p className={css.noteText}>{noteParts.join(' · ')}</p>
                  <Button onClick={onOpenNote}>{T.openNote}</Button>
                </div>
              )}

              {/* 이번 판 기록: 접어 두었다가 누르면 푼 문제 · 모르겠어요 · 만난 낱말(퍼센트 없음). */}
              <div className={css.log}>
                <Button variant="ghost" className={css.logBtn} aria-expanded={logOpen} aria-controls={logId} onClick={() => setLogOpen(v => !v)}>
                  <span>{X.logTitle}</span>
                  <span className={css.chevron} data-open={logOpen} aria-hidden="true"><BackIcon /></span>
                </Button>
                <dl id={logId} className={css.logList} hidden={!logOpen}>
                  <div><dt>{X.solved}</dt><dd>{log.solved}{X.unit}</dd></div>
                  <div><dt>{X.skipped}</dt><dd>{log.skipped}{X.unit}</dd></div>
                  <div><dt>{X.words}</dt><dd>{log.words}{X.unit}</dd></div>
                </dl>
              </div>

              {state.config.contentMode === 'development' && <p className={css.dev}>{T.dev}</p>}
              {/* 주 버튼은 짙은 바탕이 아니라 결과 창 안에 둔다(ui-rules-v3 §2 버튼 바탕). */}
              <div className={css.actions}>
                <Button variant="primary" size="lg" className={css.again} onClick={onAgain}><RetryIcon size={24} />{T.again}</Button>
                <Button size="lg" className={css.home} onClick={onHome}>{T.home}</Button>
              </div>
            </section>
          </div>

          {hasReview && (
            <section className={`${frame.window} ${css.review}`} aria-labelledby="resultReview">
              <h2 id="resultReview" className={css.reviewTitle}>{X.missedTitle}</h2>
              <div className={frame.rule} aria-hidden="true" />
              {/* 낱말·뜻·해설은 문제 내용이라 data-content로 표시한다(상시 문장 계측에서 뺀다). */}
              <ul className={css.list} data-content>
                {items.map(item => <WordCard key={item.id} item={item} />)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

/** 낱말 카드: 낱말과 정답을 보이고, 누르거나 Enter·Space를 누르면 문제와 해설이 펼쳐진다. */
function WordCard({ item }: { item: ReviewItem }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li>
      <Card sunk className={css.word}>
        <Button variant="ghost" className={css.wordBtn} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)}>
          <span className={css.wordText}>
            <span className={css.lemma}>{item.lemma}</span>
            <span className={css.answer}>{T.answer} {item.answer}</span>
          </span>
          <span className={css.chevron} data-open={open} aria-hidden="true"><BackIcon /></span>
        </Button>
        <div id={panelId} className={css.detail} hidden={!open}>
          <p className={css.stem}>{item.stem}</p>
          <p>{item.explanation}</p>
        </div>
      </Card>
    </li>
  );
}

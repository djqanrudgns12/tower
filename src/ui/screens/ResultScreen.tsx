import { useId, useState } from 'react';
import { reviewQuestions } from '../../content';
import { computeHonorPoints } from '../../contracts/lobby';
import type { RunState } from '../../domain/types';
import { DIFFICULTY_COPY, fmtNumber, RESULT_COPY as T, resultHeadline } from '../copy';
import { BackIcon, RetryIcon } from '../icons/ControlIcons';
import { ArtIcon, Button, Card, Stat } from '../kit';
import css from './ResultScreen.module.css';

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

/**
 * 결과와 복습(R4 U3, PRD §10.1). 위: 성문 + 지킨 웨이브 + 한 줄, 가운데: 정답·처치·점수, 아래 고정: 다시 하기·홈.
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

  return (
    <main className={css.page}>
      <div className={css.scroll}>
        <div className={css.body}>
          <Card as="section" float className={css.summary} aria-labelledby="resultWave">
            <p className={css.meta}>{state.config.nickname} · {state.config.grade}학년 · {DIFFICULTY_COPY[state.config.difficulty].label}</p>
            <ArtIcon name="gate" size={72} />
            <h1 id="resultWave" className={css.wave}>
              <span className="sr-only">{T.waveSr} </span>
              {state.completedWave}{T.wave}
            </h1>
            <p className={css.line} data-kind={headline.kind}>{headline.text}</p>

            <div className={css.stats}>
              <Stat icon={null} value={`${state.stats.correct}/${total}`} label={T.correct} className={css.tile ?? ''} />
              <Stat icon={null} value={fmtNumber(state.stats.kills)} label={T.kills} className={css.tile ?? ''} />
              <Stat icon={null} value={fmtNumber(state.pt)} label={T.score} className={css.tile ?? ''} />
            </div>

            <p className={css.ranking}>{T.ranking} <strong>{honorPt > 0 ? `+${fmtNumber(honorPt)}` : '0'}</strong></p>
            {onOpenNote && noteParts.length > 0 && (
              <div className={css.note}>
                <p className={css.noteText}>{noteParts.join(' · ')}</p>
                <Button onClick={onOpenNote}>{T.openNote}</Button>
              </div>
            )}
            {state.config.contentMode === 'development' && <p className={css.dev}>{T.dev}</p>}
          </Card>

          <Card as="section" float className={css.review} aria-labelledby="resultReview">
            <h2 id="resultReview" className={css.reviewTitle}>{T.reviewTitle}</h2>
            {items.length === 0 ? (
              <p className={css.empty}>{T.reviewEmpty}</p>
            ) : (
              // 낱말·뜻·해설은 문제 내용이라 data-content로 표시한다(상시 문장 계측에서 뺀다).
              <ul className={css.list} data-content>
                {items.map(item => <WordCard key={item.id} item={item} />)}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className={css.actions}>
        <Button variant="primary" size="lg" className={css.again} onClick={onAgain}><RetryIcon size={24} />{T.again}</Button>
        <Button size="lg" className={css.home} onClick={onHome}>{T.home}</Button>
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

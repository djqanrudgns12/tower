import { reviewQuestions } from '../../content';
import type { RunState } from '../../domain/types';
import { DIFFICULTY_COPY, fmtNumber } from '../copy';
import kit from '../kit.module.css';
import css from './screens.module.css';

interface Props { state: RunState; onAgain(): void; onHome(): void }

/** 결과와 복습(PRD §2.2). 복습 재풀이는 보상이 없으므로 여기서는 해설만 보여 준다. */
export function ResultScreen({ state, onAgain, onHome }: Props) {
  const questions = reviewQuestions(state.config.grade);
  const answers = state.quiz.history;
  const total = answers.length;
  const accuracy = total ? Math.round((state.stats.correct / total) * 100) : 0;
  const lemmas = new Set(answers.map(a => questions.get(a.questionId)?.target.lemma));
  const senses = new Set(answers.map(a => questions.get(a.questionId)?.target.senseKey));
  const review = answers.filter(a => a.answer && !a.answer.correct);
  const unique = [...new Map(review.map(a => [a.questionId, a])).values()];
  const title = state.endReason === 'DEFEAT'
    ? `성문이 무너졌어요. 이번에는 ${state.completedWave}웨이브까지 지켰어요.`
    : `이번 판을 마쳤어요. ${state.completedWave}웨이브까지 지켰어요.`;

  return (
    <main className={css.page}>
      <div className={`${kit.board} ${css.card}`}>
        <div className={css.stack}>
          <h1 className={css.title}>{title}</h1>
          <p className={css.subtitle}>{state.config.nickname} · {state.config.grade}학년 · {DIFFICULTY_COPY[state.config.difficulty].label}</p>
        </div>
        <div className={css.stats}>
          <Stat label="점수" value={fmtNumber(state.pt)} />
          <Stat label="지킨 웨이브" value={String(state.completedWave)} />
          <Stat label="정답" value={`${state.stats.correct}/${total}`} />
          <Stat label="정확도" value={`${accuracy}%`} />
          <Stat label="모르겠어요" value={String(state.stats.skipped)} />
          <Stat label="만난 낱말" value={`${lemmas.size}개`} />
          <Stat label="처치" value={`${state.stats.kills}마리`} />
        </div>
        <p className={kit.muted}>푼 문제 {total}개 · 서로 다른 낱말 {lemmas.size}개 · 서로 다른 뜻 {senses.size}개. 같은 낱말의 다른 뜻은 따로 세요.</p>
        {state.config.contentMode === 'development' && <p className={css.notice}>개발용 문제로 한 판이라 공개 기록에는 올라가지 않아요.</p>}
        <section className={css.stack}>
          <h2 className={css.h2}>다시 보기</h2>
          {unique.length === 0 ? <p>틀리거나 넘긴 문제가 없어요.</p> : (
            <ul className={css.review}>
              {unique.map(a => {
                const q = questions.get(a.questionId);
                if (!q) return null;
                const correct = q.options.find(o => o.id === q.correctOptionId)!.text;
                return (
                  <li key={a.id} className={css.reviewItem}>
                    <span className={css.lemma}>{q.target.lemma}</span>
                    <span>{q.stem}</span>
                    <span>정답: {correct}</span>
                    <span className={kit.muted}>{q.explanation}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <div className={css.row}>
          <button type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} onClick={onAgain}>다시 하기</button>
          <button type="button" className={kit.button} onClick={onHome}>처음으로</button>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className={css.stat}><p className={css.statLabel}>{label}</p><p className={css.statValue}>{value}</p></div>;
}

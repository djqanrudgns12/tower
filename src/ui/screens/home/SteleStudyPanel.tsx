import { useEffect, useMemo, useState } from 'react';
import {
  kstDateKey,
  pickRandomStudyIndex,
  selectDailySteleCards,
} from '../../../application/lobby';
import { useGradeContent } from '../../useGradeContent';
import css from './home.module.css';
import {
  STUDY_MONSTER_ARTS,
  advancePortraitDeck,
  createPortraitDeckState,
} from './portraitDeck';

export { STUDY_MONSTER_ARTS };

interface Props {
  preferredGrade: number;
}

export function SteleStudyPanel({ preferredGrade }: Props) {
  const date = kstDateKey();
  const { status, retry } = useGradeContent(preferredGrade);
  const cards = useMemo(
    () => (status === 'ready' ? selectDailySteleCards(preferredGrade, new Date(`${date}T00:00:00+09:00`)) : []),
    [preferredGrade, date, status],
  );
  const key = `${date}:${preferredGrade}`;
  const [selection, setSelection] = useState({ key, index: 0, visited: [0] });
  const [artDeck, setArtDeck] = useState(() => createPortraitDeckState());

  const index = selection.key === key ? selection.index : 0;
  const currentArt = artDeck.deck[artDeck.cursor]!;
  const nextArt = artDeck.deck[artDeck.cursor + 1];

  // 다음 1장만 백그라운드로 예열하여 초기 네트워크 비용과 클릭 전환 지연을 함께 줄인다.
  useEffect(() => {
    if (!nextArt || typeof Image === 'undefined') return;
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = `${import.meta.env.BASE_URL}${nextArt.path}`;
  }, [nextArt]);

  if (cards.length === 0) {
    return (
      <section className={`${css.ceramicCard} ${css.studyCard}`} aria-label="오늘의 낱말">
        <div className={css.studyHeader}>
          <h2 className={css.studyHeading}>오늘의 낱말</h2>
        </div>
        <p className={css.exampleText} role="status">
          {status === 'error'
            ? '낱말을 불러오지 못했어요.'
            : status === 'ready' || status === 'unavailable'
              ? '검수된 오늘의 낱말을 준비하는 중이에요.'
              : '오늘의 낱말을 불러오는 중이에요.'}
        </p>
        {status === 'error' && (
          <button type="button" className={css.studyRandomBtn} onClick={retry}>
            다시 불러오기
          </button>
        )}
      </section>
    );
  }

  const safeIndex = index % cards.length;
  const card = cards[safeIndex]!;

  const handleRandom = () => {
    const visited = new Set(selection.key === key ? selection.visited : [safeIndex]);
    if (visited.size >= cards.length) {
      visited.clear();
      visited.add(safeIndex);
    }
    const next = pickRandomStudyIndex(cards, safeIndex, visited);
    visited.add(next);
    setSelection({ key, index: next, visited: [...visited] });
    setArtDeck(prev => advancePortraitDeck(prev));
  };

  return (
    <section className={`${css.ceramicCard} ${css.studyCard}`} aria-label="오늘의 낱말">
      <div className={css.studyHeader}>
        <div className={css.studyTitleWrap}>
          <h2 className={css.studyHeading}>오늘의 낱말</h2>
          <span className={css.studyMeta}>
            · {card.gradeLabel} {card.levelLabel}
          </span>
        </div>
        <button
          type="button"
          className={css.studyRandomBtn}
          onClick={handleRandom}
        >
          랜덤
        </button>
      </div>

      <div className={css.wordStudyBody}>
        <div className={css.steleGardenFrame} data-race={currentArt.race} aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL}${currentArt.path}`}
            width={256}
            height={256}
            alt=""
            aria-hidden="true"
            decoding="async"
            draggable={false}
            className={css.steleStudyArt}
          />
        </div>

        <div className={css.wordStudyContent}>
          <div className={css.lemmaHeader}>
            <strong className={css.lemmaWord}>{card.lemma}</strong>
            <span className={css.posTag}>{card.partOfSpeech}</span>
          </div>

          <p className={css.meaningText} data-content>
            <span className="sr-only">뜻풀이: </span>
            {card.meaning}
          </p>

          <p className={css.exampleText} data-content>
            ‘{card.examplePrefix}
            {card.exampleHighlight && <strong className={css.exampleHighlight}>{card.exampleHighlight}</strong>}
            {card.exampleSuffix}’
          </p>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCachedAllStudyCards,
  loadAllStudyCards,
  pickRandomInitialStudyIndex,
  pickRandomStudyIndex,
  selectDailySteleCards,
  type SteleCardItem,
} from '../../../application/lobby';
import { useLobbySprites } from './canvasAssets';
import { ShuffleIcon } from './HomeIcons';
import css from './home.module.css';

interface Props {
  preferredGrade: number;
}

export function SteleStudyPanel({ preferredGrade }: Props) {
  const fallbackCards = useMemo(() => selectDailySteleCards(preferredGrade), [preferredGrade]);
  const [allCards, setAllCards] = useState<readonly SteleCardItem[] | null>(() => getCachedAllStudyCards());
  const cards = allCards && allCards.length > 0 ? allCards : fallbackCards;

  const [index, setIndex] = useState(() => pickRandomInitialStudyIndex(cards.length));
  const visitedRef = useRef<Set<number>>(new Set([index]));
  const hasInteractedRef = useRef(false);
  const sprites = useLobbySprites();

  useEffect(() => {
    if (allCards && allCards.length > 0) return;
    let cancelled = false;
    void loadAllStudyCards().then(loaded => {
      if (cancelled || loaded.length === 0) return;
      setAllCards(loaded);
      setIndex(prevIdx => {
        if (hasInteractedRef.current && fallbackCards.length > 0) {
          const currentQuestionId = fallbackCards[prevIdx % fallbackCards.length]?.questionId;
          const mapped = currentQuestionId
            ? loaded.findIndex(c => c.questionId === currentQuestionId)
            : -1;
          const resolved = mapped >= 0 ? mapped : pickRandomInitialStudyIndex(loaded.length);
          visitedRef.current = new Set([resolved]);
          return resolved;
        }
        const initialIdx = pickRandomInitialStudyIndex(loaded.length);
        visitedRef.current = new Set([initialIdx]);
        return initialIdx;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [allCards, fallbackCards]);

  const steleSprite = sprites.get('deco.stele');

  if (cards.length === 0) {
    return (
      <section className={css.stelePanel} aria-label="오늘의 낱말 공부">
        <div className={css.steleHeader}>
          <h2 className={css.sectionTitle}>오늘의 낱말 공부</h2>
        </div>
        <p className={css.exampleLine}>검수된 오늘의 낱말을 준비하는 중이에요.</p>
      </section>
    );
  }

  const safeIndex = index % cards.length;
  const card = cards[safeIndex]!;

  const handleRandom = () => {
    hasInteractedRef.current = true;
    if (visitedRef.current.size >= cards.length) {
      visitedRef.current = new Set([safeIndex]);
    }
    const next = pickRandomStudyIndex(cards, safeIndex, visitedRef.current);
    visitedRef.current.add(next);
    setIndex(next);
  };

  return (
    <section className={css.stelePanel} aria-label="오늘의 낱말 공부">
      <div className={css.steleHeader}>
        <div className={css.steleTitleGroup}>
          <h2 className={css.sectionTitle}>오늘의 낱말 공부</h2>
          <span className={css.chip}>{card.gradeLabel} · {card.levelLabel}</span>
        </div>
        <div className={css.steleControls}>
          <button
            type="button"
            className={css.smallBtn}
            onClick={handleRandom}
          >
            <ShuffleIcon />
            랜덤
          </button>
        </div>
      </div>

      <div className={css.steleBody}>
        <div className={css.steleArtBox} aria-hidden="true">
          {steleSprite && <img src={steleSprite.url} alt="" className={css.steleImg} />}
          <span className={css.steleGlyph}>{card.glyph}</span>
        </div>

        <div className={css.steleContent}>
          <div className={css.lemmaRow}>
            <strong className={css.lemmaWord}>{card.lemma}</strong>
            <span className={css.chip}>{card.partOfSpeech}</span>
          </div>

          <div className={css.meaningCard}>
            <span className={css.meaningTag}>뜻풀이</span>
            <span className={css.meaningText}>{card.meaning}</span>
          </div>

          <p className={css.exampleLine}>
            <span className={css.meaningTag}>예문 </span>
            ‘{card.examplePrefix}
            {card.exampleHighlight && <mark className={css.exampleMark}>{card.exampleHighlight}</mark>}
            {card.exampleSuffix}’
          </p>
        </div>
      </div>
    </section>
  );
}

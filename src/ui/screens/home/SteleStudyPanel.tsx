import { useEffect, useMemo, useState } from 'react';
import {
  kstDateKey,
  pickRandomStudyIndex,
  selectDailySteleCards,
} from '../../../application/lobby';
import { LineIcon } from '../../icons/LineIcon';
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
  const cards = useMemo(() => status === 'ready' ? selectDailySteleCards(preferredGrade, new Date(`${date}T00:00:00+09:00`)) : [], [preferredGrade, date, status]);
  const key = `${date}:${preferredGrade}`;
  const [selection, setSelection] = useState({ key, index: 0, visited: [0] });
  const [artDeck, setArtDeck] = useState(() => createPortraitDeckState());

  const index = selection.key === key ? selection.index : 0;
  const currentArt = artDeck.deck[artDeck.cursor]!;
  const nextArt = artDeck.deck[artDeck.cursor + 1];

  // 다음 1장만 백그라운드로 예열하여 초기 네트워크 비용(~14KB)과 클릭 전환 지연(0ms)을 동시에 확보한다.
  useEffect(() => {
    if (!nextArt || typeof Image === 'undefined') return;
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = `${import.meta.env.BASE_URL}${nextArt.path}`;
  }, [nextArt]);

  if (cards.length === 0) {
    return (
      <section className={`${css.subCard} ${css.studyCard}`} aria-label="오늘의 낱말">
        <div className={css.cardHeaderRow}>
          <div className={css.cardTitleWrap}>
            <span className={css.sectionIconBadge} aria-hidden="true">
              <LineIcon name="hud/guide" size={18} />
            </span>
            <h2 className={css.sectionTitle}>오늘의 낱말</h2>
          </div>
        </div>
        <p className={css.exampleText} role="status">{status === 'error' ? '낱말을 불러오지 못했어요.' : status === 'ready' || status === 'unavailable' ? '검수된 오늘의 낱말을 준비하는 중이에요.' : '오늘의 낱말을 불러오는 중이에요.'}</p>
        {status === 'error' && <button type="button" className={css.keyBtnSm} onClick={retry}>다시 불러오기</button>}
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
    <section className={`${css.subCard} ${css.studyCard}`} aria-label="오늘의 낱말">
      <div className={css.cardHeaderRow}>
        <div className={css.cardTitleWrap}>
          <span className={css.sectionIconBadge} aria-hidden="true">
            <LineIcon name="hud/guide" size={18} />
          </span>
          <h2 className={css.sectionTitle}>오늘의 낱말</h2>
          <span className={css.metaTag}>
            {card.gradeLabel} · {card.levelLabel}
          </span>
        </div>
        <button
          type="button"
          className={css.keyBtnSm}
          onClick={handleRandom}
        >
          <LineIcon name="hud/shuffle" size={16} />
          랜덤
        </button>
      </div>

      <div className={css.wordStudyBody}>
        <div className={css.steleGardenFrame} data-race={currentArt.race} aria-hidden="true">
          <div className={css.steleGardenInner}>
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
        </div>

        <div className={css.wordStudyContent}>
          <div className={css.lemmaHeader}>
            <strong className={css.lemmaWord}>{card.lemma}</strong>
            <span className={css.posTag}>{card.partOfSpeech}</span>
          </div>

          <div className={css.noteGridBox}>
            <div className={css.noteGridRow}>
              <span className={css.noteRowLabel}>뜻풀이</span>
              <span className={css.meaningText} data-content>{card.meaning}</span>
            </div>
            <div className={css.noteRowDivider} aria-hidden="true" />
            <div className={css.noteGridRow}>
              <span className={css.noteRowLabelMuted}>예문</span>
              <p className={css.exampleText} data-content>
                ‘{card.examplePrefix}
                {card.exampleHighlight && <mark className={css.exampleHighlight}>{card.exampleHighlight}</mark>}
                {card.exampleSuffix}’
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

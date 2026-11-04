import { useMemo, useState } from 'react';
import {
  kstDateKey,
  pickRandomStudyIndex,
  selectDailySteleCards,
} from '../../../application/lobby';
import { useLobbySprites } from './canvasAssets';
import { ShuffleIcon } from './HomeIcons';
import css from './home.module.css';

interface Props {
  preferredGrade: number;
}

export function SteleStudyPanel({ preferredGrade }: Props) {
  const date = kstDateKey();
  const cards = useMemo(() => selectDailySteleCards(preferredGrade, new Date(`${date}T00:00:00+09:00`)), [preferredGrade, date]);
  const key = `${date}:${preferredGrade}`;
  const [selection, setSelection] = useState({ key, index: 0, visited: [0] });
  const index = selection.key === key ? selection.index : 0;
  const sprites = useLobbySprites();

  const steleSprite = sprites.get('deco.stele');

  if (cards.length === 0) {
    return (
      <section className={css.stelePanel} aria-label="오늘의 낱말">
        <div className={css.steleHeader}>
          <h2 className={css.sectionTitle}>오늘의 낱말</h2>
        </div>
        <p className={css.exampleLine}>검수된 오늘의 낱말을 준비하는 중이에요.</p>
      </section>
    );
  }

  const safeIndex = index % cards.length;
  const card = cards[safeIndex]!;

  const handleRandom = () => {
    const visited = new Set(selection.key === key ? selection.visited : [safeIndex]);
    if (visited.size >= cards.length) { visited.clear(); visited.add(safeIndex); }
    const next = pickRandomStudyIndex(cards, safeIndex, visited);
    visited.add(next);
    setSelection({ key, index: next, visited: [...visited] });
  };

  return (
    <section className={css.stelePanel} aria-label="오늘의 낱말">
      <div className={css.steleHeader}>
        <div className={css.steleTitleGroup}>
          <h2 className={css.sectionTitle}>오늘의 낱말</h2>
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

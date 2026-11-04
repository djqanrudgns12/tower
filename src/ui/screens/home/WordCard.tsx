import { useMemo, useState } from 'react';
import { kstDateKey, selectDailySteleCards } from '../../../application/lobby';
import { Card } from '../../kit';
import { useLobbySprites } from './canvasAssets';
import css from './lobby.module.css';

interface Props {
  preferredGrade: number;
}

/** 오늘의 낱말 카드: 비석 그림 + 낱말 + 뜻 한 줄. 예문은 누르면 펼쳐진다. */
export function WordCard({ preferredGrade }: Props) {
  const date = kstDateKey();
  const cards = useMemo(() => selectDailySteleCards(preferredGrade, new Date(`${date}T00:00:00+09:00`)), [preferredGrade, date]);
  const stele = useLobbySprites().get('deco.stele');
  const [open, setOpen] = useState(false);
  const card = cards[0];

  return (
    <Card float as="section" aria-label="오늘의 낱말" className={css.wordCard}>
      <h2 className={css.cardTitle}>오늘의 낱말</h2>
      {card ? (
        <>
          <div className={css.wordBody}>
            <div className={css.steleArt} aria-hidden="true">
              {stele && <img src={stele.url} alt="" className={css.steleImg} draggable={false} />}
              <span className={css.steleGlyph}>{card.glyph}</span>
            </div>
            <div className={css.wordText}>
              <strong className={css.lemma}>{card.lemma}</strong>
              <p className={css.meaning}>{card.meaning}</p>
            </div>
          </div>
          <details className={css.example} open={open} onToggle={e => setOpen(e.currentTarget.open)}>
            <summary className={css.exampleSummary}>{open ? '예문 닫기' : '예문 보기'}</summary>
            <p className={css.exampleText}>
              {card.examplePrefix}
              {card.exampleHighlight && <mark className={css.exampleMark}>{card.exampleHighlight}</mark>}
              {card.exampleSuffix}
            </p>
          </details>
        </>
      ) : (
        <p className={css.meaning}>오늘의 낱말을 준비 중이에요</p>
      )}
    </Card>
  );
}

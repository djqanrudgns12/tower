import { useEffect, useMemo, useState } from 'react';
import {
  kstDateKey,
  pickRandomStudyIndex,
  selectDailySteleCards,
} from '../../../application/lobby';
import { HomeUiArt, ShuffleIcon } from './HomeIcons';
import { useGradeContent } from '../../useGradeContent';
import css from './home.module.css';

interface Props {
  preferredGrade: number;
}

/** 오늘의 낱말 액자용 인게임 8종족 평화로운 일상 일러스트 30종 (192×192 불투명 WebP). */
export const STUDY_MONSTER_ARTS = [
  'assets/ui/study/study.monster.01.webp',
  'assets/ui/study/study.monster.02.webp',
  'assets/ui/study/study.monster.03.webp',
  'assets/ui/study/study.monster.04.webp',
  'assets/ui/study/study.monster.05.webp',
  'assets/ui/study/study.monster.06.webp',
  'assets/ui/study/study.monster.07.webp',
  'assets/ui/study/study.monster.08.webp',
  'assets/ui/study/study.monster.09.webp',
  'assets/ui/study/study.monster.10.webp',
  'assets/ui/study/study.monster.11.webp',
  'assets/ui/study/study.monster.12.webp',
  'assets/ui/study/study.monster.13.webp',
  'assets/ui/study/study.monster.14.webp',
  'assets/ui/study/study.monster.15.webp',
  'assets/ui/study/study.monster.16.webp',
  'assets/ui/study/study.monster.17.webp',
  'assets/ui/study/study.monster.18.webp',
  'assets/ui/study/study.monster.19.webp',
  'assets/ui/study/study.monster.20.webp',
  'assets/ui/study/study.monster.21.webp',
  'assets/ui/study/study.monster.22.webp',
  'assets/ui/study/study.monster.23.webp',
  'assets/ui/study/study.monster.24.webp',
  'assets/ui/study/study.monster.25.webp',
  'assets/ui/study/study.monster.26.webp',
  'assets/ui/study/study.monster.27.webp',
  'assets/ui/study/study.monster.28.webp',
  'assets/ui/study/study.monster.29.webp',
  'assets/ui/study/study.monster.30.webp',
] as const;

/** crypto.getRandomValues 기반 Fisher-Yates 순열 덱 생성 (재셔플 경계 연속 중복 방지 포함). */
function shuffleArtDeck(excludeFirst?: string): string[] {
  const deck: string[] = [...STUDY_MONSTER_ARTS];
  const rand = new Uint32Array(deck.length);
  crypto.getRandomValues(rand);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (rand[i]! >>> 0) % (i + 1);
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  if (excludeFirst && deck.length > 1 && deck[0] === excludeFirst) {
    const first = deck[0]!;
    deck[0] = deck[1]!;
    deck[1] = first;
  }
  return deck;
}

export function SteleStudyPanel({ preferredGrade }: Props) {
  const date = kstDateKey();
  const { status, retry } = useGradeContent(preferredGrade);
  const cards = useMemo(() => status === 'ready' ? selectDailySteleCards(preferredGrade, new Date(`${date}T00:00:00+09:00`)) : [], [preferredGrade, date, status]);
  const key = `${date}:${preferredGrade}`;
  const [selection, setSelection] = useState({ key, index: 0, visited: [0] });
  const [artDeck, setArtDeck] = useState(() => ({
    deck: shuffleArtDeck(),
    cursor: 0,
  }));

  const index = selection.key === key ? selection.index : 0;
  const currentArt = artDeck.deck[artDeck.cursor]!;
  const nextArt = artDeck.deck[artDeck.cursor + 1];

  // 다음 1장만 백그라운드로 예열하여 초기 네트워크 비용(~30KB)과 클릭 전환 지연(0ms)을 동시에 확보한다.
  useEffect(() => {
    if (!nextArt || typeof Image === 'undefined') return;
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = `${import.meta.env.BASE_URL}${nextArt}`;
  }, [nextArt]);

  if (cards.length === 0) {
    return (
      <section className={css.subCard} aria-label="오늘의 낱말">
        <div className={css.cardHeaderRow}>
          <div className={css.cardTitleWrap}>
            <span className={css.sectionIconBadge} aria-hidden="true">
              <HomeUiArt file="relic.lucky_pouch.webp" className={css.sectionIcon} />
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
    setArtDeck(prev => {
      const nextCursor = prev.cursor + 1;
      if (nextCursor >= prev.deck.length - 1) {
        const currentLast = prev.deck[prev.deck.length - 1]!;
        return {
          deck: [currentLast, ...shuffleArtDeck(currentLast)],
          cursor: 0,
        };
      }
      return { deck: prev.deck, cursor: nextCursor };
    });
  };

  return (
    <section className={css.subCard} aria-label="오늘의 낱말">
      <div className={css.cardHeaderRow}>
        <div className={css.cardTitleWrap}>
          <span className={css.sectionIconBadge} aria-hidden="true">
            <HomeUiArt file="relic.lucky_pouch.webp" className={css.sectionIcon} />
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
          <ShuffleIcon className={css.btnIconSvg} />
          랜덤
        </button>
      </div>

      <div className={css.wordStudyBody}>
        <div className={css.steleGardenFrame} aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL}${currentArt}`}
            width={192}
            height={192}
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

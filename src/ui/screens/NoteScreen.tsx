import { useEffect, useEffectEvent, useRef } from 'react';
import type { RuntimeQuestion } from '../../domain/context';
import { NOTE_COPY as T } from '../copy';
import { BackIcon } from '../icons/ControlIcons';
import { Card, IconButton, Rule, Window } from '../kit';
import { NOTE_EXTRA as X } from './home/homeCopy';
import css from './NoteScreen.module.css';

/** 다른 판에서 이만큼 맞히면 노트를 졸업한다. persistence/reviewNote.ts의 REVIEW_GRADUATE_CLEARS와 같은 값이다(UI는 persistence를 가져오지 않는다). */
export const NOTE_GRADUATE_CLEARS = 2;

/** 노트 한 항목. persistence의 ReviewNoteItem이 이 모양을 만족한다. */
export interface NoteItemLike {
  lemma: string;
  senseKey: string;
  /** 틀린 문항(최근 것부터). */
  questionIds: readonly string[];
  /** 담은 뒤 다른 판에서 맞힌 판 수. */
  clears: number;
  lastSeenAt: string;
}

/** 화면에 그릴 낱말 카드 한 장. 퍼센트·점수는 두지 않는다(PRD v0.5 §20.5). */
export interface NoteEntry {
  senseKey: string;
  lemma: string;
  meaning: string;
  example: string | null;
  clears: number;
}

const correctText = (q: RuntimeQuestion) => q.options.find(o => o.id === q.correctOptionId)?.text ?? '';

/** 문항에서 예문 한 줄을 뽑는다: 쓰임 문항은 정답 문장, 빈칸은 정답을 채운 문장, 유의어·반의어는 따옴표 안 문장. 뜻풀이 문항은 없다. */
function exampleOf(q: RuntimeQuestion): string | null {
  switch (q.type) {
    case 'usage': return correctText(q) || null;
    case 'cloze': return q.stem.replace(/\(\s*\)/, correctText(q)).trim();
    case 'synonym_context':
    case 'antonym_context': return /‘([^’]+)’/.exec(q.stem)?.[1] ?? null;
    default: return null;
  }
}

/**
 * 노트 항목을 카드로 바꾼다(최근 것부터). 뜻은 같은 뜻의 뜻풀이 문항 정답이고, 없으면 틀린 문항의 해설이다.
 * `questions`에 문항이 하나도 없는 항목(철회·다른 은행)은 건너뛴다.
 */
export function buildNoteEntries(items: readonly NoteItemLike[], questions: ReadonlyMap<string, RuntimeQuestion>): NoteEntry[] {
  const bySense = new Map<string, RuntimeQuestion[]>();
  for (const q of questions.values()) {
    const list = bySense.get(q.target.senseKey);
    if (list) list.push(q); else bySense.set(q.target.senseKey, [q]);
  }
  const recent = [...items].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.lemma.localeCompare(b.lemma, 'ko'));
  return recent.flatMap(item => {
    const missed = item.questionIds.flatMap(id => questions.get(id) ?? []);
    const pool = [...missed, ...(bySense.get(item.senseKey) ?? [])];
    const first = pool[0];
    if (!first) return [];
    const definition = pool.find(q => q.type === 'definition');
    const meaning = definition ? correctText(definition) : first.explanation;
    const example = pool.map(exampleOf).find((e): e is string => e !== null) ?? null;
    return [{ senseKey: item.senseKey, lemma: item.lemma, meaning, example, clears: item.clears }];
  });
}

interface Props {
  entries: readonly NoteEntry[];
  onBack(): void;
}

/**
 * 오답 노트 화면(R4 U3 → R5 O1, PRD §10.2). 짙은 바탕 위에 양피지 공책 한 권(창 틀 한 벌)이 놓이고, 틀린 낱말 카드를 최근 순으로 격자에 보인다.
 * 넓은 화면에서도 공책이 화면을 채워 빈 공간이 작다. 비면 공책 가운데에 펼친 책 그림과 안내 두 줄.
 * 뜻·예문은 읽는 글이라 글자 크기 단계에 따라 +1·+2px 커진다(v4 §5.3).
 */
export function NoteScreen({ entries, onBack }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 부모가 렌더마다 새 onBack을 넘겨도 효과가 다시 돌지 않게(포커스를 다시 뺏지 않게) 최신 onBack만 부른다.
  const back = useEffectEvent(() => onBack());

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); back(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className={css.page}>
      <Window className={css.notebook}>
        <header className={css.header}>
          <IconButton label={T.back} icon={<BackIcon />} showLabel onClick={onBack} />
          <h1 ref={titleRef} tabIndex={-1} className={css.title}>{T.title}</h1>
          {entries.length > 0 && <p className={css.count}>{T.count(entries.length)}</p>}
        </header>
        <Rule />

        {entries.length === 0 ? (
          <div className={css.empty}>
            <img
              src={`${import.meta.env.BASE_URL}assets/ui/note.empty.webp`}
              width={320}
              height={223}
              alt=""
              draggable={false}
              className={css.emptyArt}
            />
            <p className={css.emptyText}>{T.empty}</p>
            <p className={css.emptyHint}>{X.emptyHint}</p>
          </div>
        ) : (
          <>
            <p className={css.hint}>{T.hint}</p>
            <ul className={css.list}>
              {entries.map(e => (
                <li key={e.senseKey}>
                  <Card className={css.word}>
                    <div className={css.top}>
                      <span className={css.lemma}>{e.lemma}</span>
                      <Dots clears={e.clears} />
                    </div>
                    <p className={css.meaning} data-content>{e.meaning}</p>
                    {e.example && <p className={css.example} data-content>{e.example}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </Window>
    </main>
  );
}

/** 졸업까지 ●○: 다른 판에서 맞힌 만큼 채운다. 색에만 기대지 않게 속이 빈 동그라미를 함께 쓴다. */
function Dots({ clears }: { clears: number }) {
  const filled = Math.min(NOTE_GRADUATE_CLEARS, Math.max(0, clears));
  return (
    <span className={css.dots} role="img" aria-label={T.progress(filled, NOTE_GRADUATE_CLEARS)}>
      {Array.from({ length: NOTE_GRADUATE_CLEARS }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          {i < filled
            ? <circle cx="8" cy="8" r="7" fill="currentColor" />
            : <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />}
        </svg>
      ))}
    </span>
  );
}

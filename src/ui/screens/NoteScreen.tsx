import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { NOTE_COPY as T } from '../copy';
import { LineIcon } from '../icons/LineIcon';
import { Button, Card, IconButton, ModalTabPanel, ModalTabs, ModalTabShell, Rule, Segmented, Window, type ModalTabOption } from '../kit';
import { NOTE_EXTRA as X } from './home/homeCopy';
import { NoteFlashcard } from './NoteFlashcard';
import {
  buildNoteEntries,
  filterNoteEntries,
  markNextRunPriority,
  NOTE_GRADUATE_CLEARS,
  sortNoteEntries,
  type NoteEntry,
  type NoteItemLike,
  type NoteSortMode,
} from './noteModel';
import css from './NoteScreen.module.css';

export { buildNoteEntries, NOTE_GRADUATE_CLEARS, type NoteEntry, type NoteItemLike };

type NoteTabId = 'all' | 'focus' | 'graduating';

interface Props {
  entries: readonly NoteEntry[];
  onBack(): void;
  loading?: boolean;
  loadError?: boolean;
  onRetry?(): void;
}

const SORT_OPTIONS: readonly { value: NoteSortMode; label: string }[] = [
  { value: 'recent', label: '최근 순' },
  { value: 'priority', label: '복습 우선' },
];

/**
 * 오답 노트 화면(lg 860×580 고정 프레임 Window + 3탭: 전체 / 집중 복습 / 졸업 임박, PRD §10.2 · WP-C2-02).
 * 짙은 바탕 한가운데에 정돈된 공책 창이 놓이고, 검색·우선 출제 배지·무보상 카드 복습을 지원한다.
 */
export function NoteScreen({ entries, onBack, loading = false, loadError = false, onRetry }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [tab, setTab] = useState<NoteTabId>('all');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<NoteSortMode>('recent');
  const [flashOpen, setFlashOpen] = useState(false);

  // 부모가 렌더마다 새 onBack을 넘겨도 효과가 다시 돌지 않게 최신 onBack과 flashOpen만 읽는다.
  const back = useEffectEvent(() => {
    if (flashOpen) setFlashOpen(false);
    else onBack();
  });

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); back(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const prioritized = useMemo(() => markNextRunPriority(entries), [entries]);
  const focusEntries = useMemo(() => prioritized.filter(e => e.clears === 0), [prioritized]);
  const gradEntries = useMemo(() => prioritized.filter(e => e.clears > 0 && e.clears < NOTE_GRADUATE_CLEARS), [prioritized]);
  const tabEntries = tab === 'focus' ? focusEntries : tab === 'graduating' ? gradEntries : prioritized;
  const visibleEntries = useMemo(
    () => sortNoteEntries(filterNoteEntries(tabEntries, query), sortMode),
    [tabEntries, query, sortMode],
  );

  const tabOptions: readonly ModalTabOption<NoteTabId>[] = useMemo(
    () => [
      { value: 'all', label: '전체', id: 'note-tab-all', count: entries.length },
      { value: 'focus', label: '집중 복습', id: 'note-tab-focus', count: focusEntries.length },
      { value: 'graduating', label: '졸업 임박', id: 'note-tab-graduating', count: gradEntries.length },
    ],
    [entries.length, focusEntries.length, gradEntries.length],
  );

  return (
    <main className={css.page}>
      <Window size="lg" fixed className={css.notebook}>
        <header className={css.header}>
          <IconButton label={T.back} icon={<LineIcon name="hud/back" />} showLabel onClick={onBack} />
          <h1 ref={titleRef} tabIndex={-1} className={css.title}>{T.title}</h1>
          {entries.length > 0 && <p className={css.count}>{T.count(entries.length)}</p>}
        </header>
        <Rule />

        {loading || loadError ? (
          <div className={css.empty}>
            <p className={css.emptyText} role="status">{loadError ? '오답 노트를 불러오지 못했어요.' : '오답 노트를 불러오는 중이에요.'}</p>
            {loadError && onRetry && <Button onClick={onRetry}>다시 불러오기</Button>}
          </div>
        ) : entries.length === 0 ? (
          <div className={css.empty}>
            <LineIcon name="hud/note" size={64} className={css.emptyArt} />
            <p className={css.emptyText}>{T.empty}</p>
            <p className={css.emptyHint}>{X.emptyHint}</p>
          </div>
        ) : flashOpen && visibleEntries.length > 0 ? (
          <NoteFlashcard entries={visibleEntries} onClose={() => setFlashOpen(false)} />
        ) : (
          <ModalTabShell>
            <ModalTabs<NoteTabId>
              label="복습 단계 분류"
              options={tabOptions}
              value={tab}
              onChange={setTab}
              controls="note-tabpanel"
              aside={T.hint}
            />
            <div className={css.toolbar}>
              <input
                type="search"
                className={css.searchInput}
                aria-label="낱말 검색"
                placeholder="낱말·뜻 찾기"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <Segmented<NoteSortMode>
                label="정렬 방식"
                options={SORT_OPTIONS}
                value={sortMode}
                onChange={setSortMode}
              />
              <Button
                variant="primary"
                size="md"
                disabled={visibleEntries.length === 0}
                onClick={() => setFlashOpen(true)}
              >
                카드 복습
              </Button>
            </div>
            <ModalTabPanel id="note-tabpanel" labelledBy={`note-tab-${tab}`} pad="sm">
              {visibleEntries.length === 0 ? (
                <Card sunk className={css.tabEmpty}>
                  <p className={css.tabEmptyText}>
                    {query.trim()
                      ? '찾는 낱말이 없어요'
                      : tab === 'focus'
                        ? '집중 복습할 낱말이 없어요'
                        : '졸업 임박한 낱말이 없어요'}
                  </p>
                </Card>
              ) : (
                <ul className={css.list}>
                  {visibleEntries.map(e => (
                    <li key={e.senseKey}>
                      <Card pad="sm" className={css.word}>
                        <div className={css.top}>
                          <span className={css.lemmaRow}>
                            <span className={css.lemma}>{e.lemma}</span>
                            {e.nextRunPriority && <span className={css.priorityBadge}>다음 판 출제 예정</span>}
                          </span>
                          <Dots clears={e.clears} />
                        </div>
                        <p className={css.meaning} data-content>{e.meaning}</p>
                        {e.example && <p className={css.example} data-content>{e.example}</p>}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </ModalTabPanel>
          </ModalTabShell>
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

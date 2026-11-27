import { useEffect, useState } from 'react';
import { Button, Card } from '../kit';
import { maskLemmaInExample, NOTE_GRADUATE_CLEARS, type NoteEntry } from './noteModel';
import css from './NoteFlashcard.module.css';

interface Props {
  entries: readonly NoteEntry[];
  onClose(): void;
}

/**
 * 무보상 자가 복습 플래시카드(WP-C2-02, PRD §2.2 준수).
 * localStorage·clears·점수를 전혀 수정하지 않고 세션 메모리 안의 덱 순서만 조정한다.
 */
export function NoteFlashcard({ entries, onClose }: Props) {
  const [queue, setQueue] = useState<readonly NoteEntry[]>(() => [...entries]);
  const [mastered, setMastered] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const total = entries.length;
  const done = queue.length === 0;
  const current = queue[0];

  const handleRestart = () => {
    setQueue([...entries]);
    setMastered(0);
    setRevealed(false);
  };

  const handleKnown = () => {
    setQueue(prev => prev.slice(1));
    setMastered(m => Math.min(total, m + 1));
    setRevealed(false);
  };

  const handleAgain = () => {
    setQueue(prev => (prev.length > 1 ? [...prev.slice(1), prev[0]!] : prev));
    setRevealed(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (done || !current || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      const interactive = (e.target as HTMLElement | null)?.closest('button, a, input, textarea, select');
      if (!revealed) {
        if ((e.key === ' ' || e.key === 'Enter') && !interactive) {
          e.preventDefault();
          setRevealed(true);
        }
      } else if (e.key === '1') {
        e.preventDefault();
        setQueue(prev => (prev.length > 1 ? [...prev.slice(1), prev[0]!] : prev));
        setRevealed(false);
      } else if (e.key === '2') {
        e.preventDefault();
        setQueue(prev => prev.slice(1));
        setMastered(m => Math.min(total, m + 1));
        setRevealed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose, done, current, revealed, total]);

  return (
    <section className={css.deck} aria-label="낱말 카드 복습">
      <div className={css.topBar}>
        <p className={css.notice}>연습용 복습 카드예요. 다음 판에서 맞히면 졸업해요.</p>
        <div className={css.topRight}>
          <span className={css.progress} aria-live="polite">
            {done ? `${total} / ${total}` : `${Math.min(total, mastered + 1)} / ${total}`}
          </span>
          <Button size="md" onClick={onClose}>목록으로</Button>
        </div>
      </div>

      {done || !current ? (
        <Card pad="md" className={css.finishCard}>
          <h2 className={css.finishTitle}>준비한 낱말 카드를 모두 살폈어요</h2>
          <p className={css.finishSub}>정규 판 준비 문제에서 두 번 맞히면 오답 노트를 졸업해요.</p>
          <div className={css.actions}>
            <Button variant="primary" size="lg" onClick={handleRestart}>한 번 더</Button>
            <Button size="lg" onClick={onClose}>목록으로</Button>
          </div>
        </Card>
      ) : (
        <Card pad="md" className={css.card}>
          <div className={css.cardHead}>
            <strong className={css.lemma}>{current.lemma}</strong>
            <span className={css.clearTag}>
              졸업 {Math.min(NOTE_GRADUATE_CLEARS, Math.max(0, current.clears))}/{NOTE_GRADUATE_CLEARS}
            </span>
          </div>

          {!revealed ? (
            <div className={css.front}>
              {(() => {
                const hint = maskLemmaInExample(current.example, current.lemma);
                return hint ? <p className={css.hint} data-content>{hint}</p> : <p className={css.prompt}>뜻을 먼저 떠올려 보세요.</p>;
              })()}
              <Button variant="primary" size="lg" onClick={() => setRevealed(true)}>뜻 확인</Button>
            </div>
          ) : (
            <div className={css.back}>
              <p className={css.meaning} data-content>{current.meaning}</p>
              {current.example && <p className={css.example} data-content>{current.example}</p>}
              <div className={css.actions}>
                <Button size="lg" onClick={handleAgain}>한 번 더</Button>
                <Button variant="primary" size="lg" onClick={handleKnown}>기억나요</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}

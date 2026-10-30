import { useEffect, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { RANKING_TAB_IDS, type RankingPeriod, type RankingResponse, type RankingTabId } from '../../../contracts/lobby';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY } from '../../copy';
import { ModalShell } from './ModalShell';
import { formatPrimaryMetric, PERIOD_LABELS, TAB_LABELS } from './RankingBoard';
import css from './home.module.css';

interface Props {
  initialTab: RankingTabId;
  initialGrade: 3 | 4 | 5 | 6 | 'all';
  initialDifficulty: DifficultyId;
  initialPeriod: RankingPeriod;
  playerId: string;
  currentNickname: string;
  onClose(): void;
}

export function RankingModal({
  initialTab,
  initialGrade,
  initialDifficulty,
  initialPeriod,
  playerId,
  currentNickname,
  onClose,
}: Props) {
  const [tab, setTab] = useState<RankingTabId>(initialTab);
  const [grade, setGrade] = useState<3 | 4 | 5 | 6 | 'all'>(initialGrade);
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [period, setPeriod] = useState<RankingPeriod>(initialPeriod);
  const [data, setData] = useState<RankingResponse | null>(null);

  const effectiveGrade: 3 | 4 | 5 | 6 | 'all' =
    (tab === 'single_score' || tab === 'best_wave') && grade === 'all' ? 3 : grade;

  useEffect(() => {
    let active = true;
    void fetchRanking(
      { tab, grade: effectiveGrade, difficulty, period, limit: 50, offset: 0 },
      playerId,
      currentNickname,
    ).then(res => {
      if (active) setData(res);
    });
    return () => { active = false; };
  }, [tab, effectiveGrade, difficulty, period, playerId, currentNickname]);

  return (
    <ModalShell titleId="rankingModalTitle" title="상세 수호 순위표 (상위 50위)" wide onClose={onClose}>
      <div className={css.tabBar} role="tablist" aria-label="상세 순위 분류">
        {RANKING_TAB_IDS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={css.tabBtn}
            onClick={() => setTab(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div className={css.filterStack}>
        <div className={css.filterRow} role="radiogroup" aria-label="상세 학년 범위">
          {(tab === 'honor_points' || tab === 'local_device') && (
            <button
              type="button"
              role="radio"
              aria-checked={effectiveGrade === 'all'}
              className={css.filterBtn}
              onClick={() => setGrade('all')}
            >
              전체 학년
            </button>
          )}
          {([3, 4, 5, 6] as const).map(g => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={effectiveGrade === g}
              className={css.filterBtn}
              onClick={() => setGrade(g)}
            >
              {g}학년
            </button>
          ))}
        </div>

        {(tab === 'single_score' || tab === 'best_wave') && (
          <div className={css.filterRow} role="radiogroup" aria-label="상세 난이도 범위">
            {DIFFICULTY_IDS.map(d => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                className={css.filterBtn}
                onClick={() => setDifficulty(d)}
              >
                {DIFFICULTY_COPY[d].label}
              </button>
            ))}
          </div>
        )}

        {tab === 'honor_points' && (
          <div className={css.filterRow} role="radiogroup" aria-label="상세 집계 기간">
            {(['weekly', 'season1', 'all_time'] as const).map(p => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                className={css.filterBtn}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'honor_points' && (
        <p className={css.sourceNotice}>
          <span>원정 명예점은 1웨이브 이상 지킨 정규 판마다 점수와 달성 웨이브·정답 수에 따라 적립돼요.</span>
        </p>
      )}

      {!data || data.entries.length === 0 ? (
        <div className={css.emptyRankBox}>
          <strong>{tab === 'local_device' ? '아직 기록이 없어요.' : '표시할 순위 기록이 아직 없어요.'}</strong>
        </div>
      ) : (
        <ol className={css.rankList} style={{ maxHeight: 360, overflowY: 'auto' }}>
          {data.entries.map(entry => (
            <li key={`${entry.rank}-${entry.playerIdHash}`} className={css.rankRow} data-me={entry.isMe || undefined}>
              <span className={css.rankMedal} data-rank={entry.rank <= 3 ? entry.rank : undefined}>
                {entry.rank}
              </span>
              <div className={css.rankInfo}>
                <span className={css.rankNick}>{entry.nickname}</span>
                <span className={css.rankSub}>{entry.secondaryLabel}</span>
              </div>
              <strong className={css.rankScore}>{formatPrimaryMetric(tab, entry.primaryValue)}</strong>
            </li>
          ))}
        </ol>
      )}

      {data?.myEntry && (
        <div className={css.myRankDock}>
          <span className={css.myRankLabel}>내 순위 · {data.myEntry.nickname}</span>
          <span className={css.myRankValue}>
            {data.myEntry.rank}위 · {formatPrimaryMetric(tab, data.myEntry.primaryValue)}
          </span>
        </div>
      )}
    </ModalShell>
  );
}

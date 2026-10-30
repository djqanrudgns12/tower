import { useEffect, useRef, useState, type RefObject } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { RANKING_TAB_IDS, type RankingPeriod, type RankingResponse, type RankingTabId } from '../../../contracts/lobby';
import { gradeContent } from '../../../content';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY, fmtNumber } from '../../copy';
import { TrophyIcon } from './HomeIcons';
import css from './home.module.css';

export const TAB_LABELS: Record<RankingTabId, string> = {
  single_score: '한 판 최고점',
  honor_points: '누적 명예점',
  best_wave: '최장 웨이브',
  local_device: '내 기기 기록',
};

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  weekly: '주간',
  season1: '시즌 1',
  all_time: '누적',
};

export function formatPrimaryMetric(tab: RankingTabId, value: number): string {
  if (tab === 'best_wave') return `${fmtNumber(value)}웨이브`;
  if (tab === 'honor_points') return `${fmtNumber(value)} 명예점`;
  return `${fmtNumber(value)}점`;
}

interface Props {
  tab: RankingTabId;
  onTabChange(next: RankingTabId): void;
  playerId: string;
  currentNickname: string;
  defaultGrade: 3 | 4 | 5 | 6;
  defaultDifficulty: DifficultyId;
  refreshTick: number;
  boardRef: RefObject<HTMLElement | null>;
  onOpenDetailModal(initial: {
    tab: RankingTabId;
    grade: 3 | 4 | 5 | 6 | 'all';
    difficulty: DifficultyId;
    period: RankingPeriod;
  }): void;
}

export function RankingBoard({
  tab,
  onTabChange,
  playerId,
  currentNickname,
  defaultGrade,
  defaultDifficulty,
  refreshTick,
  boardRef,
  onOpenDetailModal,
}: Props) {
  const [grade, setGrade] = useState<3 | 4 | 5 | 6 | 'all'>(defaultGrade);
  const [difficulty, setDifficulty] = useState<DifficultyId>(defaultDifficulty);
  const [period, setPeriod] = useState<RankingPeriod>('all_time');
  const [data, setData] = useState<RankingResponse | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const effectiveGrade: 3 | 4 | 5 | 6 | 'all' =
    (tab === 'single_score' || tab === 'best_wave') && grade === 'all' ? defaultGrade : grade;

  const bankMissing =
    effectiveGrade !== 'all' && tab !== 'local_device' && gradeContent(effectiveGrade).bank === null;

  useEffect(() => {
    let active = true;
    void fetchRanking(
      { tab, grade: effectiveGrade, difficulty, period, limit: 8, offset: 0 },
      playerId,
      currentNickname,
    ).then(res => {
      if (active) setData(res);
    });
    return () => { active = false; };
  }, [tab, effectiveGrade, difficulty, period, playerId, currentNickname, refreshTick]);

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % RANKING_TAB_IDS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + RANKING_TAB_IDS.length) % RANKING_TAB_IDS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = RANKING_TAB_IDS.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      const nextTab = RANKING_TAB_IDS[nextIdx]!;
      onTabChange(nextTab);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  const displayName = currentNickname.trim() || '별명 미설정';
  const myEntry = data?.myEntry ?? null;

  return (
    <aside ref={boardRef} className={css.oakFrame} aria-label="통합 수호 랭킹">
      <div className={css.parchmentInner}>
        <div className={css.rankHeader}>
          <div className={css.steleTitleGroup}>
            <TrophyIcon />
            <h2 className={css.sectionTitle}>통합 수호 랭킹</h2>
          </div>
          <button
            id="openRankingModalBtn"
            type="button"
            className={css.smallBtn}
            onClick={() => onOpenDetailModal({ tab, grade: effectiveGrade, difficulty, period })}
          >
            상세 순위표 열기
          </button>
        </div>

        <div className={css.tabBar} role="tablist" aria-label="순위 분류">
          {RANKING_TAB_IDS.map((id, i) => (
            <button
              key={id}
              ref={el => { tabRefs.current[i] = el; }}
              id={`rank-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="rank-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              className={css.tabBtn}
              onClick={() => onTabChange(id)}
              onKeyDown={e => onTabKeyDown(e, i)}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>

        <div className={css.filterStack}>
          <div className={css.filterRow} role="radiogroup" aria-label="학년 범위">
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
            <div className={css.filterRow} role="radiogroup" aria-label="난이도 범위">
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
            <div className={css.filterRow} role="radiogroup" aria-label="집계 기간">
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

        {tab !== 'local_device' && data?.source === 'local_fallback' && (
          <div className={css.sourceNotice}>
            <span>오프라인 상태예요 · 내 기기 기록 기준으로 보여 드려요</span>
          </div>
        )}

        <div id="rank-tabpanel" role="tabpanel" aria-labelledby={`rank-tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {bankMissing ? (
            <div className={css.emptyRankBox}>
              <strong>{effectiveGrade}학년 문제은행 검수 준비 중이에요.</strong>
              <span className={css.rankSub}>문제가 공개되면 이 학년 순위표가 바로 열려요.</span>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className={css.emptyRankBox}>
              <strong>{tab === 'local_device' ? '아직 기록이 없어요.' : '아직 이 부문 출정 기록이 없어요.'}</strong>
              <span className={css.rankSub}>새 게임을 시작해 성문을 지키면 첫 수호자로 기록돼요.</span>
            </div>
          ) : (
            <ol className={css.rankList}>
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
        </div>

        <div className={css.myRankDock} aria-label="내 순위 요약">
          <span className={css.myRankLabel}>내 순위 · {displayName}</span>
          <span className={css.myRankValue}>
            {myEntry
              ? `${myEntry.rank}위 · ${formatPrimaryMetric(tab, myEntry.primaryValue)}`
              : '기록 없음'}
          </span>
        </div>
      </div>
    </aside>
  );
}

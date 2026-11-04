import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { RANKING_PERIODS, type RankingPeriod, type RankingResponse, type RankingTabId } from '../../../contracts/lobby';
import { gradeContent } from '../../../content';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY, HOME_COPY } from '../../copy';
import { Card, Modal, Segmented, type SegmentOption } from '../../kit';
import { formatPrimaryMetric, PERIOD_LABELS, RANKING_TABS, TAB_LABELS } from './rankingText';
import css from './lobby.module.css';

type GradeFilter = '3' | '4' | '5' | '6' | 'all';

interface Props {
  grade: 3 | 4 | 5 | 6;
  difficulty: DifficultyId;
  playerId: string;
  nickname: string;
  onClose(): void;
}

const gradeLabel = (g: string) => (g === 'all' ? '전체' : (
  <span>{g}<span className={css.unit}>학년</span></span>
));

/** 랭킹 전체 보기: 탭 3개 + 학년·난이도(랭킹 점수는 학년·기간) 두 고르기 줄. 상위 50위. */
export function RankingModal({ grade, difficulty, playerId, nickname, onClose }: Props) {
  const [tab, setTab] = useState<RankingTabId>('single_score');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>(String(grade) as GradeFilter);
  const [diff, setDiff] = useState<DifficultyId>(difficulty);
  const [period, setPeriod] = useState<RankingPeriod>('all_time');
  const [data, setData] = useState<RankingResponse | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const honor = tab === 'honor_points';
  // 한 판 점수·웨이브는 학년마다 따로 겨루므로 '전체'가 없다.
  const shownGrade: GradeFilter = gradeFilter === 'all' && !honor ? (String(grade) as GradeFilter) : gradeFilter;
  const effectiveGrade: 3 | 4 | 5 | 6 | 'all' = shownGrade === 'all' ? 'all' : (Number(shownGrade) as 3 | 4 | 5 | 6);

  useEffect(() => {
    let live = true;
    void fetchRanking({ tab, grade: effectiveGrade, difficulty: diff, period, limit: 50, offset: 0 }, playerId, nickname).then(res => {
      if (live) setData(res);
    });
    return () => { live = false; };
  }, [tab, effectiveGrade, diff, period, playerId, nickname]);

  const gradeOptions: SegmentOption<GradeFilter>[] = [
    ...(honor ? [{ value: 'all' as const, label: gradeLabel('all'), ariaLabel: '전체 학년' }] : []),
    ...(['3', '4', '5', '6'] as const).map(g => ({
      value: g,
      label: gradeLabel(g),
      ariaLabel: `${g}학년`,
      disabled: gradeContent(Number(g)).bank === null,
    })),
  ];
  const diffOptions: SegmentOption<DifficultyId>[] = DIFFICULTY_IDS.map(id => ({ value: id, label: DIFFICULTY_COPY[id].label }));
  const periodOptions: SegmentOption<RankingPeriod>[] = RANKING_PERIODS.map(p => ({ value: p, label: PERIOD_LABELS[p] }));

  const onTabKeyDown = (e: KeyboardEvent, i: number) => {
    const n = RANKING_TABS.length;
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(RANKING_TABS[next]!);
    tabRefs.current[next]?.focus();
  };

  const entries = data?.entries ?? [];
  const mine = data?.myEntry ?? null;

  return (
    <Modal titleId="rankingModalTitle" title="랭킹" size="lg" onClose={onClose}>
      <div className={css.rankTabs} role="tablist" aria-label="랭킹 종류">
        {RANKING_TABS.map((id, i) => (
          <button
            key={id}
            ref={el => { tabRefs.current[i] = el; }}
            id={`rank-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="rank-tabpanel"
            tabIndex={tab === id ? 0 : -1}
            className={css.rankTab}
            onClick={() => setTab(id)}
            onKeyDown={e => onTabKeyDown(e, i)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div className={css.filterRow}>
        <div className={css.filterGroup}>
          <span className={css.fieldLabelInk}>학년</span>
          <Segmented
            label="학년"
            options={gradeOptions}
            value={shownGrade}
            onChange={v => { setBlocked(null); setGradeFilter(v); }}
            onBlocked={() => setBlocked(HOME_COPY.gradeSoon)}
          />
        </div>
        <div className={css.filterGroup}>
          <span className={css.fieldLabelInk}>{honor ? '기간' : '난이도'}</span>
          {honor
            ? <Segmented<RankingPeriod> label="집계 기간" options={periodOptions} value={period} onChange={v => setPeriod(v)} />
            : <Segmented<DifficultyId> label="난이도" options={diffOptions} value={diff} onChange={v => setDiff(v)} />}
        </div>
      </div>
      <p className={css.fieldNoteInk} role="status">{blocked}</p>

      <div id="rank-tabpanel" role="tabpanel" aria-labelledby={`rank-tab-${tab}`}>
        {entries.length === 0 ? (
          <p className={css.rankEmptyBig}>{data ? '아직 기록이 없어요' : ' '}</p>
        ) : (
          <ol className={css.rankListFull}>
            {entries.map(entry => (
              <li key={`${entry.rank}-${entry.playerIdHash}`} className={css.rankRow} data-me={entry.isMe || undefined}>
                <span className={css.rankNum}>{entry.rank}</span>
                <span className={css.rankNick}>
                  {entry.nickname}
                  <span className={css.rankSub}>{entry.secondaryLabel}</span>
                </span>
                <span className={css.rankScore}>{formatPrimaryMetric(tab, entry.primaryValue)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {mine && !entries.some(e => e.isMe) && (
        <Card sunk className={css.myRank} aria-label="내 순위 요약">
          <span className={css.myRankName}>{mine.nickname}</span>
          <span className={css.myRankValue}>{mine.rank}위 · {formatPrimaryMetric(tab, mine.primaryValue)}</span>
        </Card>
      )}
    </Modal>
  );
}

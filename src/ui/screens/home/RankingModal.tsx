import { useEffect, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import {
  HOME_RANKING_TAB_IDS,
  type HomeRankingTabId,
  type RankingPeriod,
  type RankingResponse,
} from '../../../contracts/lobby';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY } from '../../copy';
import { Card, Modal, ModalTabPanel, ModalTabs, ModalTabShell, Segmented, type ModalTabOption, type SegmentOption } from '../../kit';
import { RANKING_EXTRA } from './homeCopy';
import { formatPrimaryMetric, PERIOD_LABELS, RANKING_PERIOD_OPTIONS, TAB_LABELS } from './RankingBoard';
import css from './home.module.css';

const periodOptions: SegmentOption<RankingPeriod>[] = RANKING_PERIOD_OPTIONS.map(period => ({ value: period, label: PERIOD_LABELS[period] }));

interface Props {
  initialTab: HomeRankingTabId;
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
  const [tab, setTab] = useState<HomeRankingTabId>(initialTab);
  const [grade, setGrade] = useState<3 | 4 | 5 | 6 | 'all'>(initialGrade);
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [period, setPeriod] = useState<RankingPeriod>(initialPeriod);
  const [result, setResult] = useState<{ tab: HomeRankingTabId; period: RankingPeriod; data: RankingResponse } | null>(null);

  const effectiveGrade: 3 | 4 | 5 | 6 | 'all' =
    (tab === 'single_score' || tab === 'best_wave') && grade === 'all' ? 3 : grade;

  useEffect(() => {
    let active = true;
    void fetchRanking(
      {
        tab,
        grade: effectiveGrade,
        difficulty,
        period,
        limit: 100,
        offset: 0,
      },
      playerId,
      currentNickname,
    ).then(res => {
      if (active) setResult({ tab, period, data: res });
    });
    return () => { active = false; };
  }, [tab, effectiveGrade, difficulty, period, playerId, currentNickname]);

  const tabOptions: ModalTabOption<HomeRankingTabId>[] = HOME_RANKING_TAB_IDS.map(id => ({
    value: id,
    label: TAB_LABELS[id],
    id: `rank-modal-tab-${id}`,
  }));
  const gradeOptions: SegmentOption<string>[] = [
    ...(tab === 'local_device'
      ? [{ value: 'all', label: '전체', ariaLabel: '전체 학년' }]
      : []),
    ...([3, 4, 5, 6] as const).map(g => ({ value: String(g), label: `${g}학년` })),
  ];
  const difficultyOptions: SegmentOption<DifficultyId>[] = DIFFICULTY_IDS.map(d => ({ value: d, label: DIFFICULTY_COPY[d].label }));
  const data = result?.tab === tab && result.period === period ? result.data : null;
  const offline = result?.tab === tab && result.data.source === 'local_fallback';

  return (
    <Modal titleId="rankingModalTitle" title="전체 랭킹 (상위 100위)" size="md" fixed initialFocus="close" onClose={onClose}>
      <ModalTabShell>
        <ModalTabs<HomeRankingTabId>
          label="랭킹 분류"
          options={tabOptions}
          value={tab}
          onChange={setTab}
          controls="rank-modal-tabpanel"
        />
        <ModalTabPanel id="rank-modal-tabpanel" labelledBy={`rank-modal-tab-${tab}`} pad="sm" className={css.rankModalPanel}>
          <div className={css.modalFilterBar}>
            <Segmented
              className={css.compactSeg}
              label="상세 학년 범위"
              options={gradeOptions}
              value={String(effectiveGrade)}
              onChange={v => setGrade(v === 'all' ? 'all' : (Number(v) as 3 | 4 | 5 | 6))}
            />
            {(tab === 'single_score' || tab === 'best_wave') && (
              <Segmented<DifficultyId>
                className={css.compactSeg}
                label="상세 난이도 범위"
                options={difficultyOptions}
                value={difficulty}
                onChange={setDifficulty}
              />
            )}
            <Segmented<RankingPeriod>
              className={css.compactSeg}
              label="상세 집계 기간"
              options={periodOptions}
              value={period}
              onChange={setPeriod}
            />
            {tab !== 'local_device' && offline && <span className={css.filterMeta}>오프라인 · 이 기기 기록</span>}
            {tab === 'local_device' && <span className={css.filterMeta}>{RANKING_EXTRA.localShort}</span>}
          </div>

          {!data ? (
            <Card sunk className={css.modalEmptyRank}><span role="status">기록을 불러오는 중이에요.</span></Card>
          ) : data.entries.length === 0 ? (
            <Card sunk className={css.modalEmptyRank}>
              <strong>{tab === 'local_device' ? '아직 기록이 없어요.' : '표시할 순위 기록이 아직 없어요.'}</strong>
            </Card>
          ) : (
            <div className={css.rankScrollModal} tabIndex={0} role="region" aria-label={RANKING_EXTRA.listLabel}>
              <ol className={`${css.rankList} ${css.rankListModal}`}>
                {data.entries.map(entry => (
                  <li key={`${entry.rank}-${entry.playerIdHash}`} className={css.rankRow} data-me={entry.isMe || undefined}>
                    <span className={css.rankNum} data-rank={entry.rank <= 3 ? entry.rank : undefined}>
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
            </div>
          )}

          {data?.myEntry && (
            <div className={`${css.myRankDock} ${css.myRankDockModal}`}>
              <div className={css.myRankTop}>
                <span className={css.myRankLabel}>내 순위 · {data.myEntry.nickname}</span>
                <span className={css.myRankValue} data-has-entry="true">
                  {data.myEntry.rank}위 · {formatPrimaryMetric(tab, data.myEntry.primaryValue)}
                </span>
              </div>
            </div>
          )}
        </ModalTabPanel>
      </ModalTabShell>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { RANKING_TAB_IDS, type RankingPeriod, type RankingResponse, type RankingTabId } from '../../../contracts/lobby';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY } from '../../copy';
import { Card, Modal, ModalTabPanel, ModalTabs, ModalTabShell, Segmented, type ModalTabOption, type SegmentOption } from '../../kit';
import { RANKING_EXTRA } from './homeCopy';
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

  // 상단 분류는 책갈피형 ModalTabs, 본문 안 학년·난이도·기간은 값 선택기(Segmented radiogroup)로 위계를 나눈다.
  const tabOptions: ModalTabOption<RankingTabId>[] = RANKING_TAB_IDS.map(id => ({
    value: id,
    label: TAB_LABELS[id],
    id: `rank-modal-tab-${id}`,
  }));
  const gradeOptions: SegmentOption<string>[] = [
    ...(tab === 'honor_points' || tab === 'local_device'
      ? [{ value: 'all', label: '전체', ariaLabel: '전체 학년' }]
      : []),
    ...([3, 4, 5, 6] as const).map(g => ({ value: String(g), label: `${g}학년` })),
  ];
  const difficultyOptions: SegmentOption<DifficultyId>[] = DIFFICULTY_IDS.map(d => ({ value: d, label: DIFFICULTY_COPY[d].label }));
  const periodOptions: SegmentOption<RankingPeriod>[] = (['weekly', 'season1', 'all_time'] as const).map(p => ({ value: p, label: PERIOD_LABELS[p] }));

  return (
    // 읽고 둘러보는 창이라 첫 포커스는 닫기다(탭 줄은 Tab 한 번으로 들어간다). md 680×540 고정 프레임으로 4탭 모두 크기가 같다.
    <Modal titleId="rankingModalTitle" title="전체 랭킹 (상위 50위)" size="md" fixed initialFocus="close" onClose={onClose}>
      <ModalTabShell>
        <ModalTabs<RankingTabId>
          label="랭킹 분류"
          options={tabOptions}
          value={tab}
          onChange={setTab}
          controls="rank-modal-tabpanel"
          aside={tab === 'honor_points' ? RANKING_EXTRA.honorShort : undefined}
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
            {tab === 'honor_points' && (
              <Segmented<RankingPeriod>
                className={css.compactSeg}
                label="상세 집계 기간"
                options={periodOptions}
                value={period}
                onChange={setPeriod}
              />
            )}
            {tab === 'local_device' && <span className={css.filterMeta}>{RANKING_EXTRA.localShort}</span>}
          </div>

          {!data || data.entries.length === 0 ? (
            <Card sunk className={css.modalEmptyRank}>
              <strong>{tab === 'local_device' ? '아직 기록이 없어요.' : '표시할 순위 기록이 아직 없어요.'}</strong>
            </Card>
          ) : (
            // 안에서 스크롤하므로 Tab으로 닿고 방향키로 내릴 수 있게 포커스 가능한 이름 있는 영역으로 감싼다(WCAG 2.1.1).
            <div className={css.rankScrollModal} tabIndex={0} role="region" aria-label={RANKING_EXTRA.listLabel}>
              <ol className={`${css.rankList} ${css.rankListModal}`}>
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
            </div>
          )}

          {data?.myEntry && (
            <div className={`${css.myRankDock} ${css.myRankDockModal}`}>
              <span className={css.myRankLabel}>내 순위 · {data.myEntry.nickname}</span>
              <span className={css.myRankValue}>
                {data.myEntry.rank}위 · {formatPrimaryMetric(tab, data.myEntry.primaryValue)}
              </span>
            </div>
          )}
        </ModalTabPanel>
      </ModalTabShell>
    </Modal>
  );
}

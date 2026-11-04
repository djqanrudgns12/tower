import { useEffect, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { RANKING_TAB_IDS, type RankingPeriod, type RankingResponse, type RankingTabId } from '../../../contracts/lobby';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY } from '../../copy';
import { Card, Modal, Segmented, type SegmentOption } from '../../kit';
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

  // 창 안 고르기는 kit Segmented 한 벌(새 게임·설정 창과 같은 참나무 홈 + 양피지 칸). 분류는 아래 목록을 바꾸는 탭 줄이고
  // 방향키·Home·End가 선택과 포커스를 함께 옮긴다(roving tabindex). 학년·난이도·기간은 고르기 줄이다.
  const tabOptions: SegmentOption<RankingTabId>[] = RANKING_TAB_IDS.map(id => ({ value: id, label: TAB_LABELS[id], id: `rank-modal-tab-${id}` }));
  const gradeOptions: SegmentOption<string>[] = [
    ...(tab === 'honor_points' || tab === 'local_device' ? [{ value: 'all', label: '전체 학년' }] : []),
    ...([3, 4, 5, 6] as const).map(g => ({ value: String(g), label: `${g}학년` })),
  ];
  const difficultyOptions: SegmentOption<DifficultyId>[] = DIFFICULTY_IDS.map(d => ({ value: d, label: DIFFICULTY_COPY[d].label }));
  const periodOptions: SegmentOption<RankingPeriod>[] = (['weekly', 'season1', 'all_time'] as const).map(p => ({ value: p, label: PERIOD_LABELS[p] }));

  return (
    // 읽고 둘러보는 창이라 첫 포커스는 닫기다(탭 줄은 Tab 한 번으로 들어간다). 창 모양은 kit Modal 한 벌(v4 §4.7).
    <Modal titleId="rankingModalTitle" title="전체 랭킹 (상위 50위)" initialFocus="close" onClose={onClose}>
      <Segmented<RankingTabId> role="tablist" label="랭킹 분류" options={tabOptions} value={tab} onChange={setTab} controls="rank-modal-tabpanel" />

      <div className={css.filterStack}>
        <Segmented
          label="상세 학년 범위"
          options={gradeOptions}
          value={String(effectiveGrade)}
          onChange={v => setGrade(v === 'all' ? 'all' : (Number(v) as 3 | 4 | 5 | 6))}
        />
        {(tab === 'single_score' || tab === 'best_wave') && (
          <Segmented<DifficultyId> label="상세 난이도 범위" options={difficultyOptions} value={difficulty} onChange={setDifficulty} />
        )}
        {tab === 'honor_points' && <Segmented<RankingPeriod> label="상세 집계 기간" options={periodOptions} value={period} onChange={setPeriod} />}
      </div>

      {tab === 'honor_points' && (
        <p className={css.sourceNotice}>
          <span>랭킹 점수는 1웨이브 이상 지킨 정규 판마다 점수·웨이브·정답 수에 따라 쌓여요.</span>
        </p>
      )}

      <div id="rank-modal-tabpanel" role="tabpanel" aria-labelledby={`rank-modal-tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {!data || data.entries.length === 0 ? (
          <Card sunk style={{ minHeight: 220, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <strong>{tab === 'local_device' ? '아직 기록이 없어요.' : '표시할 순위 기록이 아직 없어요.'}</strong>
          </Card>
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
      </div>

      {data?.myEntry && (
        <div className={css.myRankDock}>
          <span className={css.myRankLabel}>내 순위 · {data.myEntry.nickname}</span>
          <span className={css.myRankValue}>
            {data.myEntry.rank}위 · {formatPrimaryMetric(tab, data.myEntry.primaryValue)}
          </span>
        </div>
      )}
    </Modal>
  );
}

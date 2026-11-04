import { useEffect, useState } from 'react';
import type { DifficultyId } from '../../../contracts/balance';
import type { RankingResponse } from '../../../contracts/lobby';
import { fetchRanking } from '../../../application/lobby';
import { ArtIcon, Button, Card } from '../../kit';
import { RankingIcon } from '../../icons/ControlIcons';
import { formatPrimaryMetric } from './rankingText';
import css from './lobby.module.css';

interface Props {
  playerId: string;
  nickname: string;
  grade: 3 | 4 | 5 | 6;
  difficulty: DifficultyId;
  refreshTick: number;
  onOpenAll(): void;
}

/**
 * 홈의 랭킹 요약: 한 판 최고점 상위 3 + 내 순위 + 전체 보기. 학년·난이도 고르기는 전체 보기 창에만 둔다.
 * 기록이 없으면 빈 상자를 늘리지 않고 한 줄 + 작은 아이콘만큼만 차지한다(오른쪽 열은 거기서 끝난다).
 */
export function RankingSummary({ playerId, nickname, grade, difficulty, refreshTick, onOpenAll }: Props) {
  const [data, setData] = useState<RankingResponse | null>(null);

  useEffect(() => {
    let live = true;
    void fetchRanking({ tab: 'single_score', grade, difficulty, period: 'all_time', limit: 8, offset: 0 }, playerId, nickname).then(res => {
      if (live) setData(res);
    });
    return () => { live = false; };
  }, [grade, difficulty, playerId, nickname, refreshTick]);

  const top = data?.entries.slice(0, 3) ?? [];
  const mine = data?.myEntry ?? null;

  return (
    <Card float as="aside" aria-label="랭킹" className={css.rankCard} data-empty={top.length === 0 || undefined}>
      <div className={css.rankHead}>
        <h2 className={css.cardTitle}><RankingIcon size={22} />랭킹</h2>
        {data?.source === 'local_fallback' && <span className={css.rankSource}>내 기기 기록</span>}
      </div>

      <div className={css.rankBody}>
        {top.length > 0 ? (
          <ol className={css.rankList}>
            {top.map(entry => (
              <li key={`${entry.rank}-${entry.playerIdHash}`} className={css.rankRow} data-me={entry.isMe || undefined}>
                <span className={css.rankNum}>{entry.rank}</span>
                <span className={css.rankNick}>{entry.nickname}</span>
                <span className={css.rankScore}>{formatPrimaryMetric('single_score', entry.primaryValue)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={css.rankEmpty}>
            {data && <ArtIcon name="star" size={28} />}
            {data ? '첫 판을 마치면 순위가 나와요' : '\u00a0'}
          </p>
        )}

        {mine && !top.some(e => e.isMe) && (
          <Card sunk className={css.myRank} aria-label="내 순위 요약">
            <span className={css.myRankName}>{nickname.trim() || '내 순위'}</span>
            <span className={css.myRankValue}>{mine.rank}위 · {formatPrimaryMetric('single_score', mine.primaryValue)}</span>
          </Card>
        )}
      </div>

      <Button id="openRankingModalBtn" className={css.rankAll} onClick={onOpenAll}>전체 보기</Button>
    </Card>
  );
}

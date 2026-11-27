import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import {
  HOME_RANKING_TAB_IDS,
  type HomeRankingTabId,
  type RankingEntry,
  type RankingPeriod,
  type RankingResponse,
  type RankingTabId,
} from '../../../contracts/lobby';
import { isGradeAvailable } from '../../../content';
import {
  fetchRanking,
  fnv1a32,
  isRecordSharingEnabled,
  lobbyTelemetryStore,
  subscribeRecordSharing,
} from '../../../application/lobby';
import { DIFFICULTY_COPY, fmtNumber } from '../../copy';
import { R6_HOME_ICONS } from '../r6Map';
import { RANKING_EXTRA } from './homeCopy';
import { R6_PORTRAITS } from './portraitDeck';
import css from './home.module.css';

export const TAB_LABELS: Record<RankingTabId, string> = {
  single_score: '최고 점수',
  honor_points: '랭킹 점수',
  best_wave: '최고 웨이브',
  local_device: '내 기록',
};

// all_time은 현재 시즌의 누적 순위다. 이전 클라이언트와 같은 기간 키를 쓴다.
export const PERIOD_LABELS = {
  all_time: '시즌 2',
  weekly: '이번 주',
  season1: '시즌 1',
} satisfies Record<RankingPeriod, string>;
export const RANKING_PERIOD_OPTIONS = Object.keys(PERIOD_LABELS) as RankingPeriod[];

export function formatPrimaryMetric(tab: RankingTabId, value: number): string {
  if (tab === 'best_wave') return `${fmtNumber(value)}웨이브`;
  return `${fmtNumber(value)}점`;
}

function avatarForNickname(nickname: string): string {
  const idx = fnv1a32(nickname || 'player') % R6_PORTRAITS.length;
  return `${import.meta.env.BASE_URL}${R6_PORTRAITS[idx]!.path}`;
}

function CrownSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className={css.podiumCrown}>
      <path d="M3 18h18l-1.5-9-4.5 3.5-3-5.5-3 5.5-4.5-3.5L3 18z" fill="#F59E0B" stroke="#C27803" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  tab: HomeRankingTabId;
  onTabChange(next: HomeRankingTabId): void;
  playerId: string;
  currentNickname: string;
  defaultGrade: 3 | 4 | 5 | 6;
  defaultDifficulty: DifficultyId;
  refreshTick: number;
  reducedMotion?: boolean;
  boardRef: RefObject<HTMLElement | null>;
  onOpenDetailModal(initial: {
    tab: HomeRankingTabId;
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
  reducedMotion = false,
  boardRef,
  onOpenDetailModal,
}: Props) {
  const [grade, setGrade] = useState<3 | 4 | 5 | 6 | 'all'>(defaultGrade);
  const [difficulty, setDifficulty] = useState<DifficultyId>(defaultDifficulty);
  const [period, setPeriod] = useState<RankingPeriod>('all_time');
  const [result, setResult] = useState<{ tab: HomeRankingTabId; period: RankingPeriod; data: RankingResponse } | null>(null);
  const [highlightedMe, setHighlightedMe] = useState(false);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const myRowRef = useRef<HTMLLIElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sharing = useSyncExternalStore(subscribeRecordSharing, isRecordSharingEnabled, () => false);
  const telemetry = useSyncExternalStore(
    lobbyTelemetryStore.subscribe,
    lobbyTelemetryStore.getSnapshot,
    lobbyTelemetryStore.getSnapshot,
  );

  useEffect(() => lobbyTelemetryStore.start(playerId), [playerId, sharing]);
  useEffect(() => {
    if (refreshTick > 0) void lobbyTelemetryStore.refreshCounts(playerId);
  }, [playerId, refreshTick]);

  // 플레이 허브에서 학년·난이도를 바꾸면 랭킹 기본 필터도 즉시 맞춘다.
  const [prevDefaultGrade, setPrevDefaultGrade] = useState(defaultGrade);
  if (prevDefaultGrade !== defaultGrade) {
    setPrevDefaultGrade(defaultGrade);
    if (grade !== 'all') setGrade(defaultGrade);
  }
  const [prevDefaultDifficulty, setPrevDefaultDifficulty] = useState(defaultDifficulty);
  if (prevDefaultDifficulty !== defaultDifficulty) {
    setPrevDefaultDifficulty(defaultDifficulty);
    setDifficulty(defaultDifficulty);
  }

  useEffect(() => () => {
    if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
  }, []);

  const showAllGrade = tab === 'local_device';
  const effectiveGrade: 3 | 4 | 5 | 6 | 'all' =
    !showAllGrade && grade === 'all' ? defaultGrade : grade;

  const gradeList: readonly (3 | 4 | 5 | 6 | 'all')[] = showAllGrade
    ? ['all', 3, 4, 5, 6]
    : [3, 4, 5, 6];

  const bankMissing =
    effectiveGrade !== 'all' && tab !== 'local_device' && !isGradeAvailable(effectiveGrade);

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
    return () => {
      active = false;
    };
  }, [tab, effectiveGrade, difficulty, period, playerId, currentNickname, refreshTick]);

  const moveTabRoving = (e: KeyboardEvent, idx: number) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % HOME_RANKING_TAB_IDS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + HOME_RANKING_TAB_IDS.length) % HOME_RANKING_TAB_IDS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = HOME_RANKING_TAB_IDS.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      onTabChange(HOME_RANKING_TAB_IDS[nextIdx]!);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  const displayName = currentNickname.trim() || '닉네임 미설정';
  const data = result?.tab === tab && result.period === period ? result.data : null;
  const myEntry = data?.myEntry ?? null;
  const showPodium = tab !== 'local_device' && Boolean(data && data.entries.length >= 3);
  const listEntries: readonly RankingEntry[] = showPodium ? data!.entries.slice(3) : (data?.entries ?? []);
  const myEntryInList = Boolean(data?.entries.some(e => e.isMe));

  const localBestScore = tab === 'local_device' && data && data.entries.length > 0
    ? Math.max(...data.entries.map(e => e.primaryValue))
    : 0;
  const localBestWave = tab === 'local_device' && data && data.entries.length > 0
    ? Math.max(...data.entries.map(e => {
        const m = /(\d+)웨이브/.exec(e.secondaryLabel);
        return m ? Number(m[1]) : 0;
      }))
    : 0;

  const handleJumpToMe = () => {
    if (!myRowRef.current) return;
    myRowRef.current.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    setHighlightedMe(true);
    if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedMe(false), 1100);
  };

  const showLiveMeta = sharing && telemetry.status === 'live' && telemetry.onlineNow !== null;

  return (
    <aside ref={boardRef} className={css.rankingColLock} aria-label="랭킹">
      <div className={`${css.ceramicCard} ${css.rankingPanel}`}>
        <div className={css.rankHeader}>
          <div className={css.rankTitleGroup}>
            <span className={css.icon3dWrap} aria-hidden="true">
              <img src={R6_HOME_ICONS.trophy} width={22} height={22} alt="" className={`${css.rankTrophyImg} ${css.icon3d}`} />
            </span>
            <h2 className={css.sectionTitle}>랭킹</h2>
            <span className={css.rankScopeChip}>{tab === 'local_device' ? '이 기기' : 'TOP 100'}</span>
          </div>
          <button
            id="openRankingModalBtn"
            type="button"
            className={css.rankTextLink}
            onClick={() =>
              onOpenDetailModal({
                tab,
                grade: effectiveGrade,
                difficulty,
                period,
              })
            }
          >
            전체 보기
          </button>
        </div>

        <div className={css.rankTabRail} role="tablist" aria-label="순위 분류">
          {HOME_RANKING_TAB_IDS.map((id, i) => (
            <button
              key={id}
              ref={el => {
                tabRefs.current[i] = el;
              }}
              id={`rank-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="rank-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              className={css.rankTabBtn}
              onClick={() => onTabChange(id)}
              onKeyDown={e => moveTabRoving(e, i)}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>

        <div
          id="rank-tabpanel"
          role="tabpanel"
          aria-labelledby={`rank-tab-${tab}`}
          className={css.rankPanelBody}
        >
          <div className={css.rankFilterRow}>
            <select
              aria-label="학년 범위"
              className={css.rankSelect}
              value={String(effectiveGrade)}
              onChange={e => setGrade(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 3 | 4 | 5 | 6))}
            >
              {gradeList.map(g => (
                <option key={String(g)} value={String(g)}>
                  {g === 'all' ? '전체 학년' : `${g}학년`}
                </option>
              ))}
            </select>

            {(tab === 'single_score' || tab === 'best_wave') && (
              <select
                aria-label="난이도 범위"
                className={css.rankSelect}
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as DifficultyId)}
              >
                {DIFFICULTY_IDS.map(d => (
                  <option key={d} value={d}>
                    {DIFFICULTY_COPY[d].label}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="집계 기간"
              className={css.rankSelect}
              value={period}
              onChange={e => setPeriod(e.target.value as RankingPeriod)}
            >
              {RANKING_PERIOD_OPTIONS.map(p => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className={css.rankBodyBox}>
            {bankMissing ? (
              <div className={css.emptyShowcase}>
                <strong>{effectiveGrade}학년 문제은행 준비 중</strong>
                <p>문제가 공개되면 이 학년 순위표가 열려요.</p>
              </div>
            ) : !data ? (
              <div className={css.emptyShowcase} role="status">기록을 불러오는 중이에요.</div>
            ) : data.entries.length === 0 ? (
              <div className={css.emptyShowcase}>
                <strong>{tab === 'local_device' ? '아직 기록이 없어요' : '아직 이 부문 기록이 없어요'}</strong>
                <p>새 게임을 시작해 첫 기록을 남겨 보세요.</p>
              </div>
            ) : (
              // 안에서 스크롤하므로 키보드로 닿도록 포커스 가능한 이름 있는 영역으로 감싼다(WCAG 2.1.1).
              <div className={css.rankScroll} tabIndex={0} role="region" aria-label={RANKING_EXTRA.listLabel}>
                {tab === 'local_device' && (
                  <div className={css.localKpiGrid}>
                    <div className={css.localKpiBox}>
                      <span className={css.localKpiLabel}>내 최고 점수</span>
                      <strong className={css.localKpiVal}>{fmtNumber(localBestScore)}점</strong>
                    </div>
                    <div className={css.localKpiBox} data-accent="teal">
                      <span className={css.localKpiLabel}>최고 웨이브</span>
                      <strong className={css.localKpiVal}>{fmtNumber(localBestWave)}웨이브</strong>
                    </div>
                    <div className={css.localKpiBox}>
                      <span className={css.localKpiLabel}>기록 수</span>
                      <strong className={css.localKpiVal}>{fmtNumber(data.totalCount)}판</strong>
                    </div>
                  </div>
                )}

                {showPodium && (
                  <div className={css.podiumGrid} aria-label="상위 3위">
                    {[data.entries[1]!, data.entries[0]!, data.entries[2]!].map((entry, idx) => {
                      const place = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                      return (
                        <div
                          key={`${entry.rank}-${entry.playerIdHash}`}
                          className={css.podiumCard}
                          data-place={place}
                          data-me={entry.isMe || undefined}
                        >
                          {place === 1 && <CrownSvg />}
                          <div className={css.podiumAvatarWrap}>
                            <img
                              src={avatarForNickname(entry.nickname)}
                              width={place === 1 ? 40 : 32}
                              height={place === 1 ? 40 : 32}
                              alt=""
                              aria-hidden="true"
                              className={css.podiumAvatar}
                            />
                            <span className={css.podiumBadge} data-place={place}>
                              {entry.rank}
                            </span>
                          </div>
                          <span className={css.podiumNick}>
                            {entry.nickname}
                            {entry.isMe && <span className={css.meTagInline}>나</span>}
                          </span>
                          <strong className={css.podiumScore}>
                            {formatPrimaryMetric(tab, entry.primaryValue)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}

                <ol className={css.rankList}>
                  {listEntries.map(entry => (
                    <li
                      key={`${entry.rank}-${entry.playerIdHash}`}
                      ref={entry.isMe ? myRowRef : undefined}
                      className={css.rankRow}
                      data-rank-num={entry.rank <= 3 ? entry.rank : undefined}
                      data-me={entry.isMe || undefined}
                      data-highlighted={entry.isMe && highlightedMe ? 'true' : undefined}
                    >
                      <span className={css.rankNum} data-rank={entry.rank <= 3 ? entry.rank : undefined}>
                        {entry.rank}
                      </span>
                      <img
                        src={avatarForNickname(entry.nickname)}
                        width={26}
                        height={26}
                        alt=""
                        aria-hidden="true"
                        className={css.rowAvatar}
                      />
                      <div className={css.rankInfo}>
                        <span className={css.rankNickWrap}>
                          <span className={css.rankNick}>{entry.nickname}</span>
                          {entry.isMe && <span className={css.meTag}>나</span>}
                        </span>
                        <span className={css.rankSub}>{entry.secondaryLabel}</span>
                      </div>
                      <strong className={css.rankScore}>
                        {formatPrimaryMetric(tab, entry.primaryValue)}
                      </strong>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className={css.myRankDock} aria-label="내 순위 요약">
            <div className={css.myRankTop}>
              <span className={css.myRankLabel}>내 순위 · {displayName}</span>
              <div className={css.myRankRight}>
                <span className={css.myRankValue} data-has-entry={myEntry ? 'true' : undefined}>
                  {myEntry
                    ? `${myEntry.rank}위 · ${formatPrimaryMetric(tab, myEntry.primaryValue)}`
                    : data ? '기록 없음' : '불러오는 중'}
                </span>
                {tab !== 'local_device' && myEntryInList && !showPodium && (
                  <button type="button" className={css.jumpBtn} onClick={handleJumpToMe}>
                    내 위치
                  </button>
                )}
                {tab !== 'local_device' && myEntryInList && showPodium && myEntry && myEntry.rank > 3 && (
                  <button type="button" className={css.jumpBtn} onClick={handleJumpToMe}>
                    내 위치
                  </button>
                )}
              </div>
            </div>
            {showLiveMeta && (
              <p className={css.liveMetaLine}>
                <span className={css.liveDot} aria-hidden="true" />
                실시간 {fmtNumber(telemetry.onlineNow!)}명 · 오늘 {fmtNumber(telemetry.todayPlays)}판
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

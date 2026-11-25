import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import {
  cleanPublicSchoolCode,
  cleanPublicSchoolName,
  RANKING_TAB_IDS,
  type RankingPeriod,
  type RankingResponse,
  type RankingTabId,
} from '../../../contracts/lobby';
import { isGradeAvailable } from '../../../content';
import { fetchRanking } from '../../../application/lobby';
import { DIFFICULTY_COPY, fmtNumber } from '../../copy';
import { LineIcon } from '../../icons/LineIcon';
import { RANKING_EXTRA } from './homeCopy';
import css from './home.module.css';

export const TAB_LABELS: Record<RankingTabId, string> = {
  single_score: '최고 점수',
  honor_points: '랭킹 점수',
  best_wave: '최고 웨이브',
  local_device: '내 기록',
};

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  weekly: '이번 주',
  season1: '시즌 1',
  all_time: '시즌 2',
};

// all_time은 현재 시즌의 누적 순위다. 이전 클라이언트와 같은 기간 키를 쓴다.
export function rankingPeriods(offline: boolean): readonly RankingPeriod[] {
  return offline ? ['all_time', 'weekly'] : ['all_time', 'weekly', 'season1'];
}

export function periodLabel(period: RankingPeriod, offline: boolean) {
  return offline && period === 'all_time' ? '누적' : PERIOD_LABELS[period];
}

export function formatPrimaryMetric(tab: RankingTabId, value: number): string {
  if (tab === 'best_wave') return `${fmtNumber(value)}웨이브`;
  if (tab === 'honor_points') return `${fmtNumber(value)}점`;
  return `${fmtNumber(value)}점`;
}

interface Props {
  tab: RankingTabId;
  onTabChange(next: RankingTabId): void;
  playerId: string;
  currentNickname: string;
  schoolName: string;
  schoolCode: string;
  defaultGrade: 3 | 4 | 5 | 6;
  defaultDifficulty: DifficultyId;
  refreshTick: number;
  boardRef: RefObject<HTMLElement | null>;
  onOpenQrModal(): void;
  onOpenDetailModal(initial: {
    tab: RankingTabId;
    grade: 3 | 4 | 5 | 6 | 'all';
    difficulty: DifficultyId;
    period: RankingPeriod;
    schoolOnly: boolean;
  }): void;
}

export function RankingBoard({
  tab,
  onTabChange,
  playerId,
  currentNickname,
  schoolName,
  schoolCode,
  defaultGrade,
  defaultDifficulty,
  refreshTick,
  boardRef,
  onOpenQrModal,
  onOpenDetailModal,
}: Props) {
  const [grade, setGrade] = useState<3 | 4 | 5 | 6 | 'all'>(defaultGrade);
  const [difficulty, setDifficulty] = useState<DifficultyId>(defaultDifficulty);
  const [period, setPeriod] = useState<RankingPeriod>('all_time');
  const [schoolOnly, setSchoolOnly] = useState(false);
  const [data, setData] = useState<RankingResponse | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gradeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const diffRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const periodRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const cleanSchool = cleanPublicSchoolName(schoolName);
  const cleanCode = cleanSchool ? cleanPublicSchoolCode(schoolCode) : '';
  const activeSchoolOnly = schoolOnly && cleanSchool !== '';

  const showAllGrade = tab === 'honor_points' || tab === 'local_device';
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
        limit: 8,
        offset: 0,
        ...(activeSchoolOnly
          ? {
              schoolName: cleanSchool,
              ...(cleanCode ? { schoolCode: cleanCode } : {}),
            }
          : {}),
      },
      playerId,
      currentNickname,
    ).then(res => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
  }, [tab, effectiveGrade, difficulty, period, activeSchoolOnly, cleanSchool, cleanCode, playerId, currentNickname, refreshTick]);

  const moveRoving = <T,>(
    e: KeyboardEvent,
    items: readonly T[],
    idx: number,
    refs: (HTMLButtonElement | null)[],
    onSelect: (next: T) => void,
  ) => {
    let nextIdx = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = items.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      onSelect(items[nextIdx]!);
      refs[nextIdx]?.focus();
    }
  };

  const displayName = currentNickname.trim() || '닉네임 미설정';
  const myEntry = data?.myEntry ?? null;
  const isFallback = tab !== 'local_device' && data?.source === 'local_fallback';
  const periodList = rankingPeriods(isFallback);
  const shownPeriod = isFallback && period === 'season1' ? 'all_time' : period;
  const syncLabel =
    tab === 'local_device'
      ? '기기 저장'
      : isFallback
        ? '오프라인 · 기기 기록'
        : '실시간 순위';

  return (
    <aside ref={boardRef} className={css.homeColumn} aria-label="랭킹">
      <div className={css.rankHeaderCard}>
        <div className={css.cardTitleWrap}>
          <span className={css.sectionIconBadge} aria-hidden="true">
            <LineIcon name="hud/score" size={18} />
          </span>
          <h2 className={css.sectionTitle}>랭킹</h2>
          <span className={css.syncStatusPill}>
            <span
              className={css.statusDot}
              data-offline={isFallback || tab === 'local_device' ? 'true' : undefined}
              aria-hidden="true"
            />
            {syncLabel}
          </span>
        </div>
        <div className={css.rankHeaderActions}>
          {cleanSchool !== '' && (
            <button
              type="button"
              className={css.keyBtnSm}
              data-active={activeSchoolOnly ? 'true' : undefined}
              aria-pressed={activeSchoolOnly}
              onClick={() => setSchoolOnly(v => !v)}
            >
              우리 학교
            </button>
          )}
          <button
            id="openQrModalBtn"
            type="button"
            className={css.keyBtnSm}
            onClick={onOpenQrModal}
          >
            <LineIcon name="hud/qr" size={16} />
            교실 QR
          </button>
          <button
            id="openRankingModalBtn"
            type="button"
            className={css.keyBtnSm}
            onClick={() =>
              onOpenDetailModal({
                tab,
                grade: effectiveGrade,
                difficulty,
                period,
                schoolOnly: activeSchoolOnly,
              })
            }
          >
            전체 보기
          </button>
        </div>
      </div>

      <div className={css.ledgerWrap}>
        <div className={css.ledgerTabRail} role="tablist" aria-label="순위 분류">
          {RANKING_TAB_IDS.map((id, i) => (
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
              className={css.ledgerTab}
              onClick={() => onTabChange(id)}
              onKeyDown={e => moveRoving(e, RANKING_TAB_IDS, i, tabRefs.current, onTabChange)}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>

        <div
          id="rank-tabpanel"
          role="tabpanel"
          aria-labelledby={`rank-tab-${tab}`}
          className={css.ledgerSheet}
        >
          <div className={css.ledgerFilterTray}>
            <div
              className={css.segmentedTrack}
              data-cols={gradeList.length}
              role="radiogroup"
              aria-label="학년 범위"
            >
              {gradeList.map((g, gi) => {
                const checked = effectiveGrade === g;
                return (
                  <button
                    key={String(g)}
                    ref={el => {
                      gradeRefs.current[gi] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={g === 'all' ? '전체 학년' : undefined}
                    tabIndex={checked ? 0 : -1}
                    className={css.segItem}
                    onClick={() => setGrade(g)}
                    onKeyDown={e => moveRoving(e, gradeList, gi, gradeRefs.current, setGrade)}
                  >
                    {g === 'all' ? '전체' : `${g}학년`}
                  </button>
                );
              })}
            </div>

            {(tab === 'single_score' || tab === 'best_wave') && (
              <div
                className={css.segmentedTrack}
                data-cols={4}
                role="radiogroup"
                aria-label="난이도 범위"
              >
                {DIFFICULTY_IDS.map((d, di) => {
                  const checked = difficulty === d;
                  return (
                    <button
                      key={d}
                      ref={el => {
                        diffRefs.current[di] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      className={css.segItem}
                      onClick={() => setDifficulty(d)}
                      onKeyDown={e => moveRoving(e, DIFFICULTY_IDS, di, diffRefs.current, setDifficulty)}
                    >
                      {DIFFICULTY_COPY[d].label}
                    </button>
                  );
                })}
              </div>
            )}

            {(tab === 'honor_points' || (tab !== 'local_device' && !isFallback)) && (
              <div
                className={css.segmentedTrack}
                data-cols={periodList.length}
                role="radiogroup"
                aria-label="집계 기간"
              >
                {periodList.map((p, pi) => {
                  const checked = shownPeriod === p;
                  return (
                    <button
                      key={p}
                      ref={el => {
                        periodRefs.current[pi] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      className={css.segItem}
                      onClick={() => setPeriod(p)}
                      onKeyDown={e => moveRoving(e, periodList, pi, periodRefs.current, setPeriod)}
                    >
                      {periodLabel(p, isFallback)}
                    </button>
                  );
                })}
              </div>
            )}

            {tab === 'local_device' && (
              <div className={css.fixedFilterInfoBar}>
                <span>{RANKING_EXTRA.localShort}</span>
              </div>
            )}
          </div>

          <div className={css.rankBodyBox}>
            {bankMissing ? (
              <div className={css.emptyShowcase}>
                <strong>{effectiveGrade}학년 문제은행 준비 중</strong>
                <p>문제가 공개되면 이 학년 순위표가 열려요.</p>
              </div>
            ) : !data || data.entries.length === 0 ? (
              <div className={css.emptyShowcase}>
                <LineIcon name="hud/score" size={32} />
                <strong>{tab === 'local_device' ? '아직 기록이 없어요' : '아직 이 부문 기록이 없어요'}</strong>
                <p>새 게임을 시작해 첫 기록을 남겨 보세요.</p>
              </div>
            ) : (
              // 안에서 스크롤하므로 키보드로 닿도록 포커스 가능한 이름 있는 영역으로 감싼다(WCAG 2.1.1).
              <div className={css.rankScroll} tabIndex={0} role="region" aria-label={RANKING_EXTRA.listLabel}>
                <ol className={css.rankList}>
                  {data.entries.map(entry => (
                    <li
                      key={`${entry.rank}-${entry.playerIdHash}`}
                      className={css.rankRow}
                      data-rank-num={entry.rank <= 3 ? entry.rank : undefined}
                      data-me={entry.isMe || undefined}
                    >
                      <span className={css.rankMedal} data-rank={entry.rank <= 3 ? entry.rank : undefined}>
                        {entry.rank}
                      </span>
                      <div className={css.rankInfo}>
                        <span className={css.rankNickWrap}>
                          <span className={css.rankNick}>{entry.nickname}</span>
                          {entry.isMe && <span className={css.meTag}>나</span>}
                        </span>
                        <span className={css.rankSub}>
                          {entry.secondaryLabel}
                          {!activeSchoolOnly && entry.schoolName ? ` · ${entry.schoolName}` : ''}
                        </span>
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
            <span className={css.myRankLabel}>
              <LineIcon name="hud/score" size={16} />
              내 순위 · {displayName}
            </span>
            <span className={css.myRankValue} data-has-entry={myEntry ? 'true' : undefined}>
              {myEntry
                ? `${myEntry.rank}위 · ${formatPrimaryMetric(tab, myEntry.primaryValue)}`
                : '기록 없음'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

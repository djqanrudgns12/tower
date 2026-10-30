import { useEffect, useSyncExternalStore } from 'react';
import { lobbyTelemetryStore } from '../../../application/lobby';
import { fmtNumber } from '../../copy';
import css from './home.module.css';

interface Props {
  playerId: string;
  refreshTick: number;
}

export function TelemetryStrip({ playerId, refreshTick }: Props) {
  const snap = useSyncExternalStore(lobbyTelemetryStore.subscribe, lobbyTelemetryStore.getSnapshot);

  useEffect(() => lobbyTelemetryStore.start(playerId), [playerId]);
  useEffect(() => {
    if (refreshTick > 0) void lobbyTelemetryStore.refreshCounts(playerId);
  }, [playerId, refreshTick]);

  const offline = snap.status === 'offline';
  const loading = snap.status === 'loading';

  const onlineText = loading
    ? '—'
    : snap.onlineNow !== null
      ? `${fmtNumber(snap.onlineNow)}명`
      : '오프라인';

  const todayText = loading
    ? '—'
    : offline
      ? `내 기기 ${fmtNumber(snap.todayPlays)}판`
      : `${fmtNumber(snap.todayPlays)}판`;

  const totalVisitorsText = loading
    ? '—'
    : snap.totalVisitors !== null
      ? `${fmtNumber(snap.totalVisitors)}명`
      : '연결 대기';

  const totalPlaysText = loading
    ? '—'
    : offline
      ? `내 기기 ${fmtNumber(snap.totalPlays)}판`
      : `${fmtNumber(snap.totalPlays)}판`;

  return (
    <div className={css.telemetryStrip} role="region" aria-label="왕국 수호 현황">
      <div className={css.metricCell}>
        <span className={css.metricLabel}>
          <span className={css.statusDot} data-offline={offline || snap.onlineNow === null} aria-hidden="true" />
          실시간 접속
        </span>
        <strong className={css.metricValue}>{onlineText}</strong>
      </div>
      <div className={css.metricCell}>
        <span className={css.metricLabel}>오늘 플레이</span>
        <strong className={css.metricValue}>{todayText}</strong>
      </div>
      <div className={css.metricCell}>
        <span className={css.metricLabel}>누적 접속</span>
        <strong className={css.metricValue}>{totalVisitorsText}</strong>
      </div>
      <div className={css.metricCell}>
        <span className={css.metricLabel}>누적 플레이</span>
        <strong className={css.metricValue}>{totalPlaysText}</strong>
      </div>
    </div>
  );
}

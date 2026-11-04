import { useEffect, useSyncExternalStore } from 'react';
import { getPublicRecordNotice, isRecordSharingEnabled, lobbyTelemetryStore, subscribePublicRecordNotice, subscribeRecordSharing } from '../../../application/lobby';
import { fmtNumber } from '../../copy';
import css from './home.module.css';

interface Props {
  playerId: string;
  refreshTick: number;
}

export function TelemetryStrip({ playerId, refreshTick }: Props) {
  const notice = useSyncExternalStore(subscribePublicRecordNotice, getPublicRecordNotice);
  const sharing = useSyncExternalStore(subscribeRecordSharing, isRecordSharingEnabled);
  const snap = useSyncExternalStore(lobbyTelemetryStore.subscribe, lobbyTelemetryStore.getSnapshot);

  useEffect(() => lobbyTelemetryStore.start(playerId), [playerId, sharing]);
  useEffect(() => {
    if (refreshTick > 0) void lobbyTelemetryStore.refreshCounts(playerId);
  }, [playerId, refreshTick]);

  const offline = snap.status === 'offline' || snap.status === 'disabled';
  const loading = snap.status === 'loading';

  const onlineText = !sharing ? '공개 기록 꺼짐' : loading
    ? '—'
    : snap.onlineNow !== null
      ? `${fmtNumber(snap.onlineNow)}명`
      : '오프라인';

  const todayText = loading
    ? '—'
    : offline
      ? `내 기록 ${fmtNumber(snap.todayPlays)}판`
      : `${fmtNumber(snap.todayPlays)}판`;

  const totalVisitorsText = loading
    ? '—'
    : snap.totalVisitors !== null
      ? `${fmtNumber(snap.totalVisitors)}명`
      : '연결 대기';

  const totalPlaysText = loading
    ? '—'
    : offline
      ? `내 기록 ${fmtNumber(snap.totalPlays)}판`
      : `${fmtNumber(snap.totalPlays)}판`;

  return (
    <div className={css.telemetryStrip} role="region" aria-label="접속 현황">
      {sharing && notice && <p role="status" style={{ gridColumn: '1 / -1' }}>{notice.message}</p>}
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

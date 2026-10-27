import { useEffect, useState } from 'react';
import type { DifficultyId } from '../../contracts/balance';
import { listRecords, type RunRecord } from '../../application/session';
import { DIFFICULTY_COPY, fmtNumber } from '../copy';
import kit from '../kit.module.css';
import css from './screens.module.css';

/** 내 기록(기기 안). 공개 참고 랭킹은 P3에서 붙인다(PRD §15). */
export function RecordsScreen({ onBack }: { onBack(): void }) {
  const [records, setRecords] = useState<RunRecord[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { listRecords().then(setRecords, () => setError(true)); }, []);
  return (
    <main className={css.page}>
      <div className={`${kit.board} ${css.card}`}>
        <h1 className={css.title}>내 기록</h1>
        <p className={kit.muted}>이 기기에 저장된 최근 기록이에요. 같은 학년·난이도끼리 비교해 보세요.</p>
        {error && <p className={css.notice}>기록을 불러오지 못했어요.</p>}
        {records && records.length === 0 && <p>아직 기록이 없어요.</p>}
        {records && records.length > 0 && (
          <table className={css.table}>
            <thead><tr><th>날짜</th><th>별명</th><th>학년·난이도</th><th>점수</th><th>웨이브</th><th>정답</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.runId}>
                  <td>{new Date(r.endedAt).toLocaleDateString('ko-KR')}</td>
                  <td>{r.nickname}</td>
                  <td>{r.grade}학년 · {DIFFICULTY_COPY[r.difficulty as DifficultyId]?.label ?? r.difficulty}</td>
                  <td>{fmtNumber(r.pt)}</td>
                  <td>{r.completedWave}</td>
                  <td>{r.correct}/{r.correct + r.wrong + r.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" className={kit.button} onClick={onBack}>처음으로</button>
      </div>
    </main>
  );
}

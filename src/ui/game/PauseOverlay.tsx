import { useEffect, useRef, useState } from 'react';
import type { PauseReason } from '../../domain/types';
import type { FontScale } from '../../application/session';
import { PAUSE_COPY } from '../copy';
import kit from '../kit.module.css';
import css from './PauseOverlay.module.css';

interface Props {
  reasons: PauseReason[];
  canSave: boolean;
  fontScale: FontScale;
  saveError: boolean;
  onResume(): void;
  onFont(scale: FontScale): void;
  onSaveExit(): Promise<boolean>;
  onRetrySave(): Promise<void>;
  onQuit(): void;
  onLeaveUnsaved(): void;
}

/** 불투명 정지층. 문제·보기·해설은 이 층이 열린 동안 DOM에서 빠진다(PRD §3.6, §12.7). */
export function PauseOverlay(p: Props) {
  const first = useRef<HTMLButtonElement>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocked = p.reasons.includes('STORAGE') || p.reasons.includes('OWNERSHIP') || p.reasons.includes('NUMERIC_LIMIT');
  const main = blocked ? p.reasons.find(r => r === 'STORAGE' || r === 'OWNERSHIP' || r === 'NUMERIC_LIMIT')! : p.reasons[p.reasons.length - 1] ?? 'USER';

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div className={css.layer} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={`${kit.board} ${css.box}`}>
        <h2 id="pause-title" className={css.title}>{blocked ? '잠깐만요' : '일시정지'}</h2>
        <p>{PAUSE_COPY[main]}</p>
        {p.reasons.includes('STORAGE') ? (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} disabled={busy} onClick={async () => { setBusy(true); await p.onRetrySave(); setBusy(false); }}>다시 저장하기</button>
            <button type="button" className={kit.button} onClick={p.onLeaveUnsaved}>저장하지 않고 나가기</button>
            <p className={kit.muted}>저장하지 않고 나가면 마지막으로 저장된 곳까지만 이어할 수 있어요.</p>
          </div>
        ) : blocked ? (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary}`} onClick={p.onLeaveUnsaved}>처음 화면으로</button>
          </div>
        ) : (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} onClick={p.onResume}>계속하기</button>
            <fieldset className={css.fonts}>
              <legend>글자 크기</legend>
              {(['base', 'large', 'xlarge'] as const).map((f, i) => (
                <label key={f} className={css.font}>
                  <input type="radio" name="font" checked={p.fontScale === f} onChange={() => p.onFont(f)} />
                  {['보통', '크게', '아주 크게'][i]}
                </label>
              ))}
            </fieldset>
            {p.canSave && (
              <button type="button" className={kit.button} disabled={busy} onClick={async () => { setBusy(true); setFailed(false); const ok = await p.onSaveExit(); setBusy(false); if (!ok) setFailed(true); }}>
                {busy ? '저장하는 중…' : '저장하고 나가기'}
              </button>
            )}
            {failed && <p className={kit.reason}>아직 저장되지 않았어요. 다시 눌러 주세요.</p>}
            {confirmQuit ? (
              <div className={css.confirm}>
                <p>이번 판을 끝낼까요? 지금까지의 점수가 기록돼요.</p>
                <div className={css.row}>
                  <button type="button" className={`${kit.button} ${kit.danger}`} onClick={p.onQuit}>끝내기</button>
                  <button type="button" className={kit.button} onClick={() => setConfirmQuit(false)}>취소</button>
                </div>
              </div>
            ) : (
              <button type="button" className={`${kit.button} ${kit.quiet}`} onClick={() => setConfirmQuit(true)}>이번 판 끝내기</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
